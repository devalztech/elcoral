"""
Profile read/edit endpoints.

Split from app/routers/onboarding.py on purpose:

- /api/onboarding is a one-shot, all-required submission that flips
  onboarding_complete once the wizard finishes.
- /api/profile/me is the incremental editor surface — PATCH writes only
  the keys actually present in the body, so the Edit Profile screen can
  save one section without blanking the fields it never rendered.
- /api/profile/{username} is the viewer-aware public profile the profile
  page renders for owners, logged-in visitors and logged-out guests.
"""
import re

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user, get_optional_user
from app.core.usernames import RESERVED_USERNAMES
from app.models.post import Post
from app.models.profile import Profile
from app.models.user import User
from app.routers.settings import is_blocked_between
from app.schemas.profile import (
    OwnerProfileOut,
    PrivacyUpdateRequest,
    ProfileUpdateRequest,
    PublicProfileOut,
)

router = APIRouter(prefix="/api/profile", tags=["profile"])

_USERNAME_RE = re.compile(r"^[a-zA-Z0-9_]{3,30}$")



async def _get_or_create_profile(db: AsyncSession, user_id) -> Profile:
    result = await db.execute(select(Profile).where(Profile.user_id == user_id))
    profile = result.scalar_one_or_none()
    if profile is None:
        profile = Profile(user_id=user_id)
        db.add(profile)
        await db.flush()
    return profile


@router.get("/username-available")
async def username_available(
    username: str = Query(min_length=3, max_length=30),
    user: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Unlike the onboarding-time check, this one is viewer-aware: someone
    editing their profile without changing their handle must not be told
    their own username is taken.
    """
    username = username.strip()
    if not _USERNAME_RE.match(username):
        return {"available": False, "reason": "Only letters, numbers, and underscores allowed"}
    if username.lower() in RESERVED_USERNAMES:
        return {"available": False, "reason": "That username is reserved"}

    existing = await db.scalar(select(Profile).where(func.lower(Profile.username) == username.lower()))
    if existing is None:
        return {"available": True}
    if user is not None and existing.user_id == user.id:
        return {"available": True}
    return {"available": False, "reason": "That username is already taken"}


@router.get("/me", response_model=OwnerProfileOut)
async def get_my_profile(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Always returns a profile row — an account that hasn't onboarded yet
    gets an empty one created on first read, so the editor and settings
    screens never have to special-case a null body.
    """
    profile = await _get_or_create_profile(db, user.id)
    await db.commit()
    await db.refresh(profile)
    return OwnerProfileOut.from_owner(profile, user)


@router.patch("/me", response_model=OwnerProfileOut)
async def update_my_profile(
    payload: ProfileUpdateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    profile = await _get_or_create_profile(db, user.id)

    # exclude_unset: only keys the client actually sent are written. An
    # explicit null still clears the field; an absent key is left alone.
    changes = payload.model_dump(exclude_unset=True)

    if "username" in changes and changes["username"]:
        new_username = changes["username"].strip()
        if new_username.lower() in RESERVED_USERNAMES:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="That username is reserved")
        if (profile.username or "").lower() != new_username.lower():
            taken = await db.scalar(
                select(Profile).where(func.lower(Profile.username) == new_username.lower())
            )
            if taken is not None and taken.user_id != user.id:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT, detail="Username is already taken"
                )
        changes["username"] = new_username

    if "work_experience" in changes and changes["work_experience"] is not None:
        # model_dump already turned the WorkExperienceItem models into
        # dicts, which is exactly what the JSON column stores.
        changes["work_experience"] = list(changes["work_experience"])

    budget_min = changes.get("budget_min", profile.budget_min)
    budget_max = changes.get("budget_max", profile.budget_max)
    if budget_min is not None and budget_max is not None and float(budget_max) < float(budget_min):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Maximum budget must be greater than or equal to the minimum",
        )

    for field, value in changes.items():
        setattr(profile, field, value)

    await db.commit()
    await db.refresh(profile)
    return OwnerProfileOut.from_owner(profile, user)


@router.patch("/me/privacy", response_model=OwnerProfileOut)
async def update_my_privacy(
    payload: PrivacyUpdateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    profile = await _get_or_create_profile(db, user.id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(profile, field, value)
    await db.commit()
    await db.refresh(profile)
    return OwnerProfileOut.from_owner(profile, user)


@router.get("/{username}", response_model=PublicProfileOut)
async def get_public_profile(
    username: str,
    viewer: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Profile, User)
        .join(User, User.id == Profile.user_id)
        .where(func.lower(Profile.username) == username.strip().lower())
    )
    row = result.first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found")

    profile, owner = row
    is_owner = viewer is not None and viewer.id == owner.id

    # A profile switched to private in Settings -> Privacy is only
    # reachable by its owner. 404 rather than 403 so a private handle
    # can't be distinguished from a non-existent one.
    if not profile.is_public and not is_owner:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found")

    if not owner.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found")

    # A block hides the profile in both directions: the blocker doesn't
    # want to see them, and the blocked person shouldn't be able to keep
    # watching the blocker. Same 404 as private/nonexistent, so the block
    # itself isn't advertised.
    if viewer is not None and not is_owner and await is_blocked_between(db, viewer.id, owner.id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found")

    posts_count = (
        await db.scalar(select(func.count(Post.id)).where(Post.author_id == owner.id))
    ) or 0

    return PublicProfileOut.from_public(profile, owner, is_owner=is_owner, posts_count=posts_count)
