from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import decode_token
from app.models.user import User

bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    payload = decode_token(credentials.credentials)
    if not payload or payload.get("type") != "access":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")

    user = await db.get(User, payload["sub"])
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session")

    return user


async def require_verified(user: User = Depends(get_current_user)) -> User:
    """
    Use in place of get_current_user on routes that must be blocked until
    the user's email is verified (onboarding, posting). Users created
    while SMTP wasn't configured are auto-verified at signup, so this
    never blocks anyone in that mode — see app/routers/auth.py signup.
    """
    if not user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Please verify your email before continuing.",
        )
    return user


async def get_optional_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User | None:
    """
    Same as get_current_user but never raises — returns None for anonymous
    callers. Used by viewer-aware public endpoints (e.g. GET
    /api/profile/{username}) which must work logged-out but return extra
    owner-only context when the caller happens to be the profile owner.
    """
    if credentials is None:
        return None

    payload = decode_token(credentials.credentials)
    if not payload or payload.get("type") != "access":
        return None

    user = await db.get(User, payload["sub"])
    if not user or not user.is_active:
        return None
    return user


# ---------------------------------------------------------------------------
# Admin authorization (management app)
# ---------------------------------------------------------------------------
#
# Two independent gates, both required:
#
#   1. Token scope. Admin access tokens are minted by
#      POST /api/admin/auth/login with a `scope: "admin"` claim. A normal
#      member token — even one belonging to someone who happens to hold
#      the admin role — is rejected here. So an XSS on the member frontend
#      that steals a member token still cannot touch /api/admin/*.
#   2. Role. Checked against the `user_roles` TABLE on every single
#      request, never trusted from the token body. Revoking an admin's
#      role takes effect on their very next request instead of whenever
#      their token happens to expire.
async def get_current_admin(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    from sqlalchemy import select

    from app.models.admin import ADMIN_ROLES, UserRole

    forbidden = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED, detail="Admin authentication required"
    )

    if credentials is None:
        raise forbidden

    payload = decode_token(credentials.credentials)
    if not payload or payload.get("type") != "access" or payload.get("scope") != "admin":
        raise forbidden

    user = await db.get(User, payload["sub"])
    if not user or not user.is_active:
        raise forbidden

    roles = set(
        (await db.execute(select(UserRole.role).where(UserRole.user_id == user.id))).scalars().all()
    )
    if not (roles & ADMIN_ROLES):
        # Same 401 shape as a bad token: an authenticated non-admin
        # probing /api/admin/* learns nothing about whether the endpoint
        # exists or whether their account is "close" to having access.
        raise forbidden

    return user


async def require_superadmin(
    user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    Granting and revoking roles is superadmin-only. An ordinary admin
    being able to hand out the admin role would make the distinction
    between the two meaningless — any admin could promote an accomplice
    (or re-promote themselves after being demoted).
    """
    from sqlalchemy import select

    from app.models.admin import ROLE_MANAGER_ROLES, UserRole

    roles = set(
        (await db.execute(select(UserRole.role).where(UserRole.user_id == user.id))).scalars().all()
    )
    if not (roles & ROLE_MANAGER_ROLES):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This action requires a superadmin.",
        )
    return user


async def get_user_roles(db: AsyncSession, user_id) -> list[str]:
    """Roles for one user, always read fresh from the table."""
    from sqlalchemy import select

    from app.models.admin import UserRole

    return sorted(
        (await db.execute(select(UserRole.role).where(UserRole.user_id == user_id))).scalars().all()
    )
