from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user, require_verified
from app.core.usernames import username_rejection
from app.models.profile import Profile
from app.models.user import User
from app.schemas.profile import OnboardingRequest, OwnerProfileOut

router = APIRouter(prefix="/api/onboarding", tags=["onboarding"])

async def _get_or_create_profile(db: AsyncSession, user_id) -> Profile:
    result = await db.execute(select(Profile).where(Profile.user_id == user_id))
    profile = result.scalar_one_or_none()
    if profile is None:
        profile = Profile(user_id=user_id)
        db.add(profile)
    return profile


@router.get("/username-available")
async def check_username_available(
    username: str = Query(min_length=3, max_length=30),
    db: AsyncSession = Depends(get_db),
):
    username = username.strip()
    reason = username_rejection(username)
    if reason:
        return {"available": False, "reason": reason}

    existing = await db.scalar(
        select(Profile).where(func.lower(Profile.username) == username.lower())
    )
    if existing is not None:
        return {"available": False, "reason": "That username is already taken"}
    return {"available": True}


@router.post("", response_model=OwnerProfileOut)
async def submit_onboarding(
    payload: OnboardingRequest,
    user: User = Depends(require_verified),
    db: AsyncSession = Depends(get_db),
):
    profile = await _get_or_create_profile(db, user.id)

    # Username uniqueness re-checked here (not just at the availability
    # endpoint) since another user could grab it between the frontend's
    # last check and this submit — the DB unique constraint would catch
    # it too, but this gives a clean error instead of a raw IntegrityError.
    reason = username_rejection(payload.username)
    if reason:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=reason)

    if (profile.username or "").lower() != payload.username.lower():
        existing = await db.scalar(
            select(Profile).where(func.lower(Profile.username) == payload.username.lower())
        )
        if existing is not None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username is already taken")

    profile.username = payload.username
    profile.intents = payload.intents
    profile.categories = payload.categories
    profile.building = payload.building
    profile.interests = payload.interests

    profile.headline = payload.headline
    profile.bio = payload.bio
    profile.skills = payload.skills

    profile.photo_ref = payload.photo_ref
    profile.cover_ref = payload.cover_ref

    profile.country_code = payload.country_code
    profile.city = payload.city
    profile.is_remote = payload.is_remote

    profile.portfolio_links = payload.portfolio_links
    profile.work_experience = [item.model_dump() for item in payload.work_experience]
    profile.github_url = payload.github_url
    profile.linkedin_url = payload.linkedin_url
    profile.website_url = payload.website_url
    profile.telegram_handle = payload.telegram_handle
    profile.twitter_url = payload.twitter_url
    profile.dribbble_url = payload.dribbble_url
    profile.about = payload.about
    profile.timezone = payload.timezone

    profile.hourly_rate = payload.hourly_rate

    profile.company_name = payload.company_name
    profile.hiring_for = payload.hiring_for
    profile.company_size = payload.company_size
    profile.budget_min = payload.budget_min
    profile.budget_max = payload.budget_max

    profile.onboarding_complete = True

    await db.commit()
    await db.refresh(profile)
    return OwnerProfileOut.from_owner(profile, user)


@router.get("/me", response_model=OwnerProfileOut | None)
async def get_my_profile(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Profile).where(Profile.user_id == user.id))
    profile = result.scalar_one_or_none()
    if profile is None:
        return None
    return OwnerProfileOut.from_owner(profile, user)
