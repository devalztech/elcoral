"""
Settings surface: preferences, verification status, blocked users,
report history, data export and the About panel.

Design notes
------------
- One row per user in `user_settings`, created lazily on first read so
  accounts that predate the table need no backfill.
- Each subpage PATCHes only its own slice (`exclude_unset`), matching the
  pattern already used by PATCH /api/profile/me: an absent key is left
  alone, so saving Appearance can never clobber Notifications.
- Privacy toggles deliberately stay on PATCH /api/profile/me/privacy —
  they are profile visibility flags, not account preferences, and moving
  them would break the existing Privacy screen.
"""
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings as app_settings
from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.limiter import limiter
from app.core.media_url import media_ref_to_url
from app.models.post import Post
from app.models.profile import Profile
from app.models.settings import (
    ACCENT_CHOICES,
    LANGUAGE_CHOICES,
    REPORT_REASONS,
    BlockedUser,
    ContentReport,
    ReportTargetType,
    UserSettings,
)
from app.models.user import User
from app.schemas.profile import OwnerProfileOut
from app.schemas.settings import (
    AboutOut,
    AccessibilitySettingsUpdate,
    AppearanceSettingsUpdate,
    BlockedUserOut,
    BlockUserRequest,
    EmailSettingsUpdate,
    LanguageUpdate,
    NotificationSettingsUpdate,
    ReportCreateRequest,
    ReportOut,
    SettingsOut,
    VerificationStatusOut,
)

router = APIRouter(prefix="/api/settings", tags=["settings"])

APP_VERSION = "0.1.0"


async def _get_or_create_settings(db: AsyncSession, user_id) -> UserSettings:
    result = await db.execute(select(UserSettings).where(UserSettings.user_id == user_id))
    row = result.scalar_one_or_none()
    if row is None:
        row = UserSettings(user_id=user_id)
        db.add(row)
        await db.flush()
    return row


async def _apply(db: AsyncSession, user: User, payload) -> UserSettings:
    row = await _get_or_create_settings(db, user.id)
    changes = payload.model_dump(exclude_unset=True, exclude_none=True)
    for field, value in changes.items():
        setattr(row, field, value)
    await db.commit()
    await db.refresh(row)
    return row


# --------------------------------------------------------------------------
# Preferences
# --------------------------------------------------------------------------


@router.get("", response_model=SettingsOut)
async def get_settings(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    row = await _get_or_create_settings(db, user.id)
    await db.commit()
    await db.refresh(row)
    return SettingsOut.from_row(row)


@router.get("/options")
async def get_settings_options():
    """
    The vocabularies the settings UI renders (accents, languages, report
    reasons). Served from the backend so the two sides can't drift — the
    same values the PATCH validators enforce.
    """
    return {
        "accents": ACCENT_CHOICES,
        "languages": LANGUAGE_CHOICES,
        "report_reasons": REPORT_REASONS,
    }


@router.patch("/notifications", response_model=SettingsOut)
async def update_notifications(
    payload: NotificationSettingsUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return SettingsOut.from_row(await _apply(db, user, payload))


@router.patch("/email", response_model=SettingsOut)
async def update_email_preferences(
    payload: EmailSettingsUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return SettingsOut.from_row(await _apply(db, user, payload))


@router.patch("/appearance", response_model=SettingsOut)
async def update_appearance(
    payload: AppearanceSettingsUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return SettingsOut.from_row(await _apply(db, user, payload))


@router.patch("/accessibility", response_model=SettingsOut)
async def update_accessibility(
    payload: AccessibilitySettingsUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return SettingsOut.from_row(await _apply(db, user, payload))


@router.patch("/language", response_model=SettingsOut)
async def update_language(
    payload: LanguageUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return SettingsOut.from_row(await _apply(db, user, payload))


# --------------------------------------------------------------------------
# Account verification
# --------------------------------------------------------------------------


@router.get("/verification", response_model=VerificationStatusOut)
async def get_verification_status(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Profile).where(Profile.user_id == user.id))
    profile = result.scalar_one_or_none()
    completion = OwnerProfileOut.from_owner(profile, user).profile_completion_pct if profile else 0
    profile_complete = bool(profile and profile.onboarding_complete)

    return VerificationStatusOut(
        email=user.email,
        email_verified=user.is_verified,
        email_delivery_enabled=app_settings.smtp_configured,
        profile_complete=profile_complete,
        profile_completion_pct=completion,
        verified=user.is_verified and profile_complete,
        member_since=user.created_at,
    )


# --------------------------------------------------------------------------
# Blocked users
# --------------------------------------------------------------------------


@router.get("/blocked", response_model=list[BlockedUserOut])
async def list_blocked_users(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(BlockedUser, User, Profile)
        .join(User, User.id == BlockedUser.blocked_id)
        .outerjoin(Profile, Profile.user_id == User.id)
        .where(BlockedUser.blocker_id == user.id)
        .order_by(BlockedUser.created_at.desc())
    )
    return [
        BlockedUserOut(
            user_id=blocked_user.id,
            username=profile.username if profile else None,
            full_name=blocked_user.full_name,
            photo_url=media_ref_to_url(profile.photo_ref) if profile else None,
            blocked_at=block.created_at,
        )
        for block, blocked_user, profile in result.all()
    ]


@router.post("/blocked", response_model=BlockedUserOut, status_code=status.HTTP_201_CREATED)
@limiter.limit("30/hour")
async def block_user(
    request: Request,
    payload: BlockUserRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Profile, User)
        .join(User, User.id == Profile.user_id)
        .where(func.lower(Profile.username) == payload.username.strip().lower())
    )
    row = result.first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No member with that username")

    profile, target = row
    if target.id == user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You can't block yourself")

    existing = await db.scalar(
        select(BlockedUser).where(
            BlockedUser.blocker_id == user.id, BlockedUser.blocked_id == target.id
        )
    )
    if existing is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="You've already blocked them")

    block = BlockedUser(blocker_id=user.id, blocked_id=target.id)
    db.add(block)
    await db.commit()
    await db.refresh(block)

    return BlockedUserOut(
        user_id=target.id,
        username=profile.username,
        full_name=target.full_name,
        photo_url=media_ref_to_url(profile.photo_ref),
        blocked_at=block.created_at,
    )


@router.delete("/blocked/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def unblock_user(
    user_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    block = await db.scalar(
        select(BlockedUser).where(BlockedUser.blocker_id == user.id, BlockedUser.blocked_id == user_id)
    )
    if block is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="They aren't blocked")
    await db.delete(block)
    await db.commit()
    return None


# --------------------------------------------------------------------------
# Reports
# --------------------------------------------------------------------------


@router.get("/reports", response_model=list[ReportOut])
async def list_my_reports(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ContentReport)
        .where(ContentReport.reporter_id == user.id)
        .order_by(ContentReport.created_at.desc())
    )
    return [ReportOut.model_validate(r) for r in result.scalars().all()]


@router.post("/reports", response_model=ReportOut, status_code=status.HTTP_201_CREATED)
@limiter.limit("20/hour")
async def create_report(
    request: Request,
    payload: ReportCreateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    label: str | None = None

    if payload.target_type == ReportTargetType.user:
        if payload.target_id is not None:
            target = await db.get(User, payload.target_id)
        else:
            target = await db.scalar(
                select(User)
                .join(Profile, Profile.user_id == User.id)
                .where(func.lower(Profile.username) == payload.target_username.lower())
            )
        if target is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="That member no longer exists")
        if target.id == user.id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You can't report yourself")
        profile = await db.scalar(select(Profile).where(Profile.user_id == target.id))
        label = f"@{profile.username}" if profile and profile.username else target.full_name
        target_id = target.id
    else:
        post = await db.get(Post, payload.target_id)
        if post is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="That post no longer exists")
        label = (post.body or "")[:80]
        target_id = post.id

    duplicate = await db.scalar(
        select(ContentReport).where(
            ContentReport.reporter_id == user.id,
            ContentReport.target_type == payload.target_type,
            ContentReport.target_id == target_id,
            ContentReport.status.in_(["open", "reviewing"]),
        )
    )
    if duplicate is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="You've already reported this — it's still under review"
        )

    report = ContentReport(
        reporter_id=user.id,
        target_type=payload.target_type,
        target_id=target_id,
        target_label=label,
        reason=payload.reason,
        details=payload.details,
    )
    db.add(report)
    await db.commit()
    await db.refresh(report)
    return ReportOut.model_validate(report)


# --------------------------------------------------------------------------
# Data & privacy
# --------------------------------------------------------------------------


@router.get("/export")
@limiter.limit("5/hour")
async def export_my_data(
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Everything this account holds, as plain JSON the browser saves to a
    file. Credentials (password hash, token hashes) are deliberately
    excluded — they are not the user's data to take away, and exporting
    them would be a liability.
    """
    profile = await db.scalar(select(Profile).where(Profile.user_id == user.id))
    prefs = await _get_or_create_settings(db, user.id)
    await db.commit()

    posts = (
        (await db.execute(select(Post).where(Post.author_id == user.id).order_by(Post.created_at.desc())))
        .scalars()
        .all()
    )
    reports = (
        (
            await db.execute(
                select(ContentReport)
                .where(ContentReport.reporter_id == user.id)
                .order_by(ContentReport.created_at.desc())
            )
        )
        .scalars()
        .all()
    )
    blocked = (
        (await db.execute(select(BlockedUser).where(BlockedUser.blocker_id == user.id))).scalars().all()
    )

    def profile_dict():
        if profile is None:
            return None
        data = OwnerProfileOut.from_owner(profile, user).model_dump(mode="json")
        return data

    return {
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "account": {
            "id": str(user.id),
            "email": user.email,
            "full_name": user.full_name,
            "is_verified": user.is_verified,
            "created_at": user.created_at.isoformat(),
        },
        "profile": profile_dict(),
        "settings": SettingsOut.from_row(prefs).model_dump(mode="json"),
        "posts": [
            {
                "id": str(p.id),
                "body": p.body,
                "media": [media_ref_to_url(r) for r in (p.media_refs or [])],
                "created_at": p.created_at.isoformat(),
            }
            for p in posts
        ],
        "reports": [ReportOut.model_validate(r).model_dump(mode="json") for r in reports],
        "blocked_user_ids": [str(b.blocked_id) for b in blocked],
    }


# --------------------------------------------------------------------------
# About
# --------------------------------------------------------------------------


@router.get("/about", response_model=AboutOut)
async def about():
    frontend = app_settings.frontend_url.rstrip("/")
    return AboutOut(
        app_name="Elcoral",
        version=APP_VERSION,
        environment=app_settings.environment,
        terms_url=f"{frontend}/terms" if frontend else "/terms",
        privacy_url=f"{frontend}/privacy" if frontend else "/privacy",
        support_email=app_settings.smtp_from_email or "support@elcoral.com",
    )


async def is_blocked_between(db: AsyncSession, a_id, b_id) -> bool:
    """
    True if either party has blocked the other. Used by the public
    profile endpoint so a block actually hides content rather than only
    listing a name on a settings screen.
    """
    row = await db.scalar(
        select(BlockedUser.id).where(
            or_(
                (BlockedUser.blocker_id == a_id) & (BlockedUser.blocked_id == b_id),
                (BlockedUser.blocker_id == b_id) & (BlockedUser.blocked_id == a_id),
            )
        )
    )
    return row is not None
