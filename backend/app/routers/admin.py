"""
Management API — everything the separately-hosted admin app calls.

Design notes:

* Mounted at /api/admin on the SAME backend as the member-facing API.
  The management app is its own deployment (its own host, its own build,
  its own CORS origin), but it talks to one database through one API, so
  an admin action and a member action can never disagree about state.
* Admin sessions are separate from member sessions: a distinct login
  endpoint mints a token carrying `scope: "admin"`, and get_current_admin
  refuses any token without it. There is no path from a member token to
  an admin capability.
* Every mutation writes an AdminAuditLog row before committing.
* Rate limits mirror the member auth router (tighter, actually — the
  admin login is a far higher-value target).
"""
import logging
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import get_current_admin, get_user_roles, require_superadmin
from app.core.limiter import limiter
from app.core.media_url import media_ref_to_url
from app.core.security import create_access_token, hash_password, verify_password
from app.core.usernames import username_rejection
from app.models.admin import (
    ADMIN_ROLES,
    ASSIGNABLE_ROLES,
    AdminAuditLog,
    AppRole,
    UserRole,
)
from app.models.profile import Profile
from app.models.user import RefreshToken, User
from app.schemas.admin import (
    AdminBadgeRequest,
    AdminCreateUserRequest,
    AdminLoginRequest,
    AdminOut,
    AdminRoleRequest,
    AdminSetActiveRequest,
    AdminStatsOut,
    AdminTokenResponse,
    AdminUserListOut,
    AdminUserOut,
    AuditLogOut,
    RoleCatalogOut,
    RoleOptionOut,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin", tags=["admin"])

MAX_FAILED_ATTEMPTS = 5
LOCKOUT_MINUTES = 15

ROLE_CATALOG = [
    RoleOptionOut(
        value=AppRole.user.value,
        label="User",
        description="Ordinary member. Everyone has this implicitly; it grants nothing extra.",
        can_sign_in_to_admin=False,
    ),
    RoleOptionOut(
        value=AppRole.moderator.value,
        label="Moderator",
        description="Reserved for content moderation. No management-app access yet.",
        can_sign_in_to_admin=False,
    ),
    RoleOptionOut(
        value=AppRole.admin.value,
        label="Admin",
        description="Signs in to the management app: manage users, accounts and badges.",
        can_sign_in_to_admin=True,
    ),
    RoleOptionOut(
        value=AppRole.superadmin.value,
        label="Superadmin",
        description="Everything an admin can do, plus granting and revoking roles.",
        can_sign_in_to_admin=True,
    ),
]


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------


async def _audit(
    db: AsyncSession,
    request: Request,
    actor: User,
    action: str,
    *,
    target: User | None = None,
    target_user_id: uuid.UUID | None = None,
    target_email: str | None = None,
    detail: dict | None = None,
) -> None:
    db.add(
        AdminAuditLog(
            actor_id=actor.id,
            actor_email=actor.email,
            action=action,
            target_user_id=target.id if target is not None else target_user_id,
            target_email=target.email if target is not None else target_email,
            detail=detail,
            ip_address=request.client.host if request.client else None,
        )
    )


def _row(user: User, profile: Profile | None, roles: list[str]) -> AdminUserOut:
    return AdminUserOut(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        username=getattr(profile, "username", None),
        photo_url=media_ref_to_url(getattr(profile, "photo_ref", None)) if profile else None,
        headline=getattr(profile, "headline", None) if profile else None,
        account_type=getattr(profile, "account_type", None) if profile else None,
        is_active=user.is_active,
        is_email_verified=user.is_verified,
        is_badge_verified=user.is_badge_verified,
        badge_verified_at=user.badge_verified_at,
        roles=roles,
        onboarding_complete=bool(getattr(profile, "onboarding_complete", False)),
        created_at=user.created_at,
        last_seen_at=user.last_seen_at,
    )


async def _roles_map(db: AsyncSession, user_ids: list[uuid.UUID]) -> dict[uuid.UUID, list[str]]:
    if not user_ids:
        return {}
    rows = (
        await db.execute(
            select(UserRole.user_id, UserRole.role).where(UserRole.user_id.in_(user_ids))
        )
    ).all()
    out: dict[uuid.UUID, list[str]] = {}
    for user_id, role in rows:
        out.setdefault(user_id, []).append(role)
    for value in out.values():
        value.sort()
    return out


async def _load_target(db: AsyncSession, user_id: uuid.UUID) -> User:
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return user


# ---------------------------------------------------------------------------
# auth
# ---------------------------------------------------------------------------


@router.post("/auth/login", response_model=AdminTokenResponse)
@limiter.limit("5/minute")
async def admin_login(request: Request, body: AdminLoginRequest, db: AsyncSession = Depends(get_db)):
    """
    Only accounts holding `admin` or `superadmin` in `user_roles` can get
    a token here. Everyone else — including a perfectly valid member with
    the right password — gets the same generic 401 as a wrong password,
    so this endpoint can't be used to discover who the admins are.
    """
    generic_error = HTTPException(status_code=401, detail="Incorrect email or password")

    user = await db.scalar(select(User).where(User.email == body.email))
    if not user:
        hash_password(body.password)  # constant-ish timing, same as member login
        raise generic_error

    if user.locked_until and user.locked_until > datetime.now(timezone.utc):
        raise HTTPException(status_code=423, detail="Account temporarily locked. Try again later.")

    if not verify_password(body.password, user.hashed_password):
        user.failed_login_attempts += 1
        if user.failed_login_attempts >= MAX_FAILED_ATTEMPTS:
            user.locked_until = datetime.now(timezone.utc) + timedelta(minutes=LOCKOUT_MINUTES)
        await db.commit()
        raise generic_error

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is disabled")

    roles = await get_user_roles(db, user.id)
    if not (set(roles) & ADMIN_ROLES):
        # Password was right but this isn't an admin. Still counts as a
        # failed attempt so the lockout applies to admin-panel probing too.
        user.failed_login_attempts += 1
        if user.failed_login_attempts >= MAX_FAILED_ATTEMPTS:
            user.locked_until = datetime.now(timezone.utc) + timedelta(minutes=LOCKOUT_MINUTES)
        await db.commit()
        raise generic_error

    user.failed_login_attempts = 0
    user.locked_until = None

    expires_minutes = settings.admin_access_token_expire_minutes
    token = create_access_token(
        subject=str(user.id),
        extra_claims={"scope": "admin", "roles": roles},
        expires_minutes=expires_minutes,
    )
    await _audit(db, request, user, "admin.login", target=user)
    await db.commit()

    return AdminTokenResponse(
        access_token=token,
        expires_in=expires_minutes * 60,
        admin=AdminOut(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            roles=roles,
            is_superadmin=AppRole.superadmin.value in roles,
        ),
    )


@router.get("/auth/me", response_model=AdminOut)
async def admin_me(admin: User = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    roles = await get_user_roles(db, admin.id)
    return AdminOut(
        id=admin.id,
        email=admin.email,
        full_name=admin.full_name,
        roles=roles,
        is_superadmin=AppRole.superadmin.value in roles,
    )


@router.get("/roles", response_model=RoleCatalogOut)
async def role_catalog(admin: User = Depends(get_current_admin)):
    return RoleCatalogOut(roles=ROLE_CATALOG)


@router.get("/stats", response_model=AdminStatsOut)
async def admin_stats(admin: User = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    week_ago = datetime.now(timezone.utc) - timedelta(days=7)
    total = await db.scalar(select(func.count()).select_from(User)) or 0
    active = await db.scalar(select(func.count()).select_from(User).where(User.is_active.is_(True))) or 0
    email_verified = (
        await db.scalar(select(func.count()).select_from(User).where(User.is_verified.is_(True))) or 0
    )
    badge_verified = (
        await db.scalar(select(func.count()).select_from(User).where(User.is_badge_verified.is_(True)))
        or 0
    )
    admins = (
        await db.scalar(
            select(func.count(func.distinct(UserRole.user_id))).where(UserRole.role.in_(ADMIN_ROLES))
        )
        or 0
    )
    new_users = (
        await db.scalar(select(func.count()).select_from(User).where(User.created_at >= week_ago)) or 0
    )
    return AdminStatsOut(
        total_users=total,
        active_users=active,
        email_verified_users=email_verified,
        badge_verified_users=badge_verified,
        admins=admins,
        new_users_7d=new_users,
    )


# ---------------------------------------------------------------------------
# users
# ---------------------------------------------------------------------------


@router.get("/users", response_model=AdminUserListOut)
async def list_users(
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
    q: str | None = Query(default=None, max_length=120),
    role: str | None = Query(default=None),
    badge: bool | None = Query(default=None),
    active: bool | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
):
    stmt = select(User, Profile).outerjoin(Profile, Profile.user_id == User.id)
    count_stmt = select(func.count()).select_from(User).outerjoin(Profile, Profile.user_id == User.id)

    if q:
        term = f"%{q.strip().lower()}%"
        condition = or_(
            func.lower(User.email).like(term),
            func.lower(User.full_name).like(term),
            func.lower(func.coalesce(Profile.username, "")).like(term),
        )
        stmt = stmt.where(condition)
        count_stmt = count_stmt.where(condition)

    if role:
        if role not in ASSIGNABLE_ROLES:
            raise HTTPException(status_code=400, detail="Unknown role")
        sub = select(UserRole.user_id).where(UserRole.role == role)
        stmt = stmt.where(User.id.in_(sub))
        count_stmt = count_stmt.where(User.id.in_(sub))

    if badge is not None:
        stmt = stmt.where(User.is_badge_verified.is_(badge))
        count_stmt = count_stmt.where(User.is_badge_verified.is_(badge))

    if active is not None:
        stmt = stmt.where(User.is_active.is_(active))
        count_stmt = count_stmt.where(User.is_active.is_(active))

    total = await db.scalar(count_stmt) or 0
    rows = (
        await db.execute(
            stmt.order_by(User.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
        )
    ).all()

    roles = await _roles_map(db, [u.id for u, _ in rows])
    return AdminUserListOut(
        items=[_row(u, p, roles.get(u.id, [])) for u, p in rows],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/users/{user_id}", response_model=AdminUserOut)
async def get_user(
    user_id: uuid.UUID,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    user = await _load_target(db, user_id)
    profile = await db.scalar(select(Profile).where(Profile.user_id == user.id))
    return _row(user, profile, await get_user_roles(db, user.id))


@router.post("/users", response_model=AdminUserOut, status_code=status.HTTP_201_CREATED)
@limiter.limit("30/hour")
async def create_user(
    request: Request,
    body: AdminCreateUserRequest,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    existing = await db.scalar(select(User).where(func.lower(User.email) == body.email.lower()))
    if existing:
        raise HTTPException(status_code=409, detail="An account with that email already exists")

    username = body.username.strip() if body.username else None
    if username:
        rejection = username_rejection(username)
        if rejection:
            raise HTTPException(status_code=400, detail=rejection)
        taken = await db.scalar(
            select(Profile).where(func.lower(Profile.username) == username.lower())
        )
        if taken:
            raise HTTPException(status_code=409, detail="That username is taken")

    # Roles: only a superadmin may seed an admin-capable account at
    # creation time, for the same reason only a superadmin can grant one
    # afterwards.
    requested_roles = sorted(set(body.roles))
    if set(requested_roles) & ADMIN_ROLES:
        actor_roles = await get_user_roles(db, admin.id)
        if AppRole.superadmin.value not in actor_roles:
            raise HTTPException(
                status_code=403, detail="Only a superadmin can create an admin account"
            )

    user = User(
        email=body.email.lower(),
        hashed_password=hash_password(body.password),
        full_name=body.full_name.strip(),
        is_active=True,
        is_verified=body.mark_email_verified,
    )
    if body.grant_badge:
        user.is_badge_verified = True
        user.badge_verified_at = datetime.now(timezone.utc)
        user.badge_verified_by = admin.id
    db.add(user)
    await db.flush()

    profile = Profile(user_id=user.id, username=username, account_type=body.account_type)
    db.add(profile)

    for role in requested_roles:
        if role == AppRole.user.value:
            continue  # implicit for everyone; storing it adds no capability
        db.add(UserRole(user_id=user.id, role=role, granted_by=admin.id))

    await _audit(
        db,
        request,
        admin,
        "user.create",
        target=user,
        detail={
            "roles": requested_roles,
            "badge": body.grant_badge,
            "email_verified": body.mark_email_verified,
        },
    )
    await db.commit()
    await db.refresh(user)

    return _row(user, profile, await get_user_roles(db, user.id))


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    request: Request,
    user_id: uuid.UUID,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    Hard delete. Every child row (profile, posts, messages, tokens,
    roles) is removed by the ON DELETE CASCADE already declared on those
    foreign keys — the audit row survives because admin_audit_logs stores
    the target as a plain UUID plus a copied email, not a foreign key.
    """
    user = await _load_target(db, user_id)

    if user.id == admin.id:
        raise HTTPException(status_code=400, detail="You cannot delete your own admin account")

    target_roles = await get_user_roles(db, user.id)
    if set(target_roles) & ADMIN_ROLES:
        actor_roles = await get_user_roles(db, admin.id)
        if AppRole.superadmin.value not in actor_roles:
            raise HTTPException(
                status_code=403, detail="Only a superadmin can delete an admin account"
            )

    await _audit(
        db,
        request,
        admin,
        "user.delete",
        target_user_id=user.id,
        target_email=user.email,
        detail={"full_name": user.full_name, "roles": target_roles},
    )
    await db.delete(user)
    await db.commit()
    return None


@router.patch("/users/{user_id}/active", response_model=AdminUserOut)
async def set_user_active(
    request: Request,
    user_id: uuid.UUID,
    body: AdminSetActiveRequest,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Suspend/restore — the reversible alternative to deletion."""
    user = await _load_target(db, user_id)
    if user.id == admin.id:
        raise HTTPException(status_code=400, detail="You cannot suspend your own admin account")

    user.is_active = body.is_active
    if not body.is_active:
        # Kill live sessions immediately; otherwise a suspended account
        # keeps working until its access token happens to expire.
        for token in (
            (await db.execute(select(RefreshToken).where(RefreshToken.user_id == user.id)))
            .scalars()
            .all()
        ):
            token.revoked = True

    await _audit(
        db, request, admin, "user.active" if body.is_active else "user.suspend", target=user
    )
    await db.commit()

    profile = await db.scalar(select(Profile).where(Profile.user_id == user.id))
    return _row(user, profile, await get_user_roles(db, user.id))


# ---------------------------------------------------------------------------
# verification badge
# ---------------------------------------------------------------------------


@router.post("/users/{user_id}/badge", response_model=AdminUserOut)
async def grant_badge(
    request: Request,
    user_id: uuid.UUID,
    body: AdminBadgeRequest | None = None,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    Grant the public verification badge. Note what this endpoint does NOT
    look at: `user.is_verified`. A confirmed email address is not, and
    never becomes, grounds for a badge — the badge is a human decision
    recorded here with the deciding admin's name attached.
    """
    user = await _load_target(db, user_id)
    user.is_badge_verified = True
    user.badge_verified_at = datetime.now(timezone.utc)
    user.badge_verified_by = admin.id

    await _audit(
        db,
        request,
        admin,
        "badge.grant",
        target=user,
        detail={"reason": (body.reason if body else None)},
    )
    await db.commit()

    profile = await db.scalar(select(Profile).where(Profile.user_id == user.id))
    return _row(user, profile, await get_user_roles(db, user.id))


@router.delete("/users/{user_id}/badge", response_model=AdminUserOut)
async def revoke_badge(
    request: Request,
    user_id: uuid.UUID,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    user = await _load_target(db, user_id)
    user.is_badge_verified = False
    user.badge_verified_at = None
    user.badge_verified_by = None

    await _audit(db, request, admin, "badge.revoke", target=user)
    await db.commit()

    profile = await db.scalar(select(Profile).where(Profile.user_id == user.id))
    return _row(user, profile, await get_user_roles(db, user.id))


# ---------------------------------------------------------------------------
# roles
# ---------------------------------------------------------------------------


@router.post("/users/{user_id}/roles", response_model=AdminUserOut)
async def grant_role(
    request: Request,
    user_id: uuid.UUID,
    body: AdminRoleRequest,
    admin: User = Depends(require_superadmin),
    db: AsyncSession = Depends(get_db),
):
    user = await _load_target(db, user_id)

    if body.role == AppRole.user.value:
        raise HTTPException(
            status_code=400,
            detail="Every account already has the user role — it isn't stored explicitly.",
        )

    existing = await db.scalar(
        select(UserRole).where(UserRole.user_id == user.id, UserRole.role == body.role)
    )
    if existing is None:
        db.add(UserRole(user_id=user.id, role=body.role, granted_by=admin.id))
        await _audit(db, request, admin, "role.grant", target=user, detail={"role": body.role})
        await db.commit()

    profile = await db.scalar(select(Profile).where(Profile.user_id == user.id))
    return _row(user, profile, await get_user_roles(db, user.id))


@router.delete("/users/{user_id}/roles/{role}", response_model=AdminUserOut)
async def revoke_role(
    request: Request,
    user_id: uuid.UUID,
    role: str,
    admin: User = Depends(require_superadmin),
    db: AsyncSession = Depends(get_db),
):
    user = await _load_target(db, user_id)

    if role not in ASSIGNABLE_ROLES:
        raise HTTPException(status_code=400, detail="Unknown role")

    if user.id == admin.id and role == AppRole.superadmin.value:
        # Locking yourself out of role management is unrecoverable from
        # inside the app; it would need a DB console to undo.
        raise HTTPException(
            status_code=400, detail="You cannot remove your own superadmin role"
        )

    if role == AppRole.superadmin.value:
        remaining = await db.scalar(
            select(func.count())
            .select_from(UserRole)
            .where(UserRole.role == AppRole.superadmin.value)
        )
        if (remaining or 0) <= 1:
            raise HTTPException(
                status_code=400, detail="At least one superadmin must remain"
            )

    row = await db.scalar(select(UserRole).where(UserRole.user_id == user.id, UserRole.role == role))
    if row is not None:
        await db.delete(row)
        await _audit(db, request, admin, "role.revoke", target=user, detail={"role": role})
        await db.commit()

    profile = await db.scalar(select(Profile).where(Profile.user_id == user.id))
    return _row(user, profile, await get_user_roles(db, user.id))


# ---------------------------------------------------------------------------
# audit trail
# ---------------------------------------------------------------------------


@router.get("/audit", response_model=list[AuditLogOut])
async def list_audit_logs(
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
    limit: int = Query(default=50, ge=1, le=200),
):
    rows = (
        (await db.execute(select(AdminAuditLog).order_by(AdminAuditLog.created_at.desc()).limit(limit)))
        .scalars()
        .all()
    )
    return [AuditLogOut.model_validate(r) for r in rows]
