"""
Follow graph endpoints.

Kept in its own router rather than bolted onto /api/profile because the
follow edge is viewer-scoped social state, not profile content — and the
profile router is already the viewer-aware read surface for one person,
while this one deals with lists of people.

Blocks are honoured everywhere here (see is_blocked_between): you cannot
follow someone you've blocked or who blocked you, and blocked accounts
are filtered out of follower/following lists.
"""
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core import notify
from app.core.deps import get_current_user, get_optional_user
from app.models.profile import Profile
from app.models.settings import BlockedUser
from app.models.social import Follow
from app.models.user import User
from app.routers.settings import is_blocked_between
from app.schemas.social import OFFICIAL_USERNAMES, FollowStateOut, PersonListOut, PersonOut

router = APIRouter(prefix="/api/social", tags=["social"])

PAGE_SIZE = 30


async def resolve_user_by_username(db: AsyncSession, username: str) -> tuple[User, Profile]:
    result = await db.execute(
        select(User, Profile)
        .join(Profile, Profile.user_id == User.id)
        .where(func.lower(Profile.username) == username.strip().lower())
    )
    row = result.first()
    if row is None or not row[0].is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found")
    return row[0], row[1]


async def follower_counts(db: AsyncSession, user_id) -> tuple[int, int]:
    followers = (
        await db.scalar(select(func.count(Follow.id)).where(Follow.following_id == user_id))
    ) or 0
    following = (
        await db.scalar(select(func.count(Follow.id)).where(Follow.follower_id == user_id))
    ) or 0
    return followers, following


async def follow_flags(db: AsyncSession, viewer_id, target_id) -> tuple[bool, bool]:
    """(viewer follows target, target follows viewer)."""
    if viewer_id is None or viewer_id == target_id:
        return False, False
    rows = (
        await db.execute(
            select(Follow.follower_id, Follow.following_id).where(
                or_(
                    (Follow.follower_id == viewer_id) & (Follow.following_id == target_id),
                    (Follow.follower_id == target_id) & (Follow.following_id == viewer_id),
                )
            )
        )
    ).all()
    is_following = any(r[0] == viewer_id for r in rows)
    follows_you = any(r[0] == target_id for r in rows)
    return is_following, follows_you


async def _blocked_ids(db: AsyncSession, viewer_id) -> set[uuid.UUID]:
    if viewer_id is None:
        return set()
    rows = (
        await db.execute(
            select(BlockedUser.blocker_id, BlockedUser.blocked_id).where(
                or_(BlockedUser.blocker_id == viewer_id, BlockedUser.blocked_id == viewer_id)
            )
        )
    ).all()
    out: set[uuid.UUID] = set()
    for blocker, blocked in rows:
        out.add(blocked if blocker == viewer_id else blocker)
    return out


async def _followers_counts(db: AsyncSession, candidate_ids) -> dict:
    """followers-per-user for a batch of people, in one query."""
    if not candidate_ids:
        return {}
    rows = await db.execute(
        select(Follow.following_id, func.count(Follow.follower_id))
        .where(Follow.following_id.in_(candidate_ids))
        .group_by(Follow.following_id)
    )
    return {r[0]: r[1] for r in rows.all()}


async def _viewer_following_ids(db: AsyncSession, viewer_id, candidate_ids) -> set[uuid.UUID]:
    if viewer_id is None or not candidate_ids:
        return set()
    rows = await db.execute(
        select(Follow.following_id).where(
            Follow.follower_id == viewer_id, Follow.following_id.in_(candidate_ids)
        )
    )
    return {r[0] for r in rows.all()}


async def _viewer_followed_by_ids(db: AsyncSession, viewer_id, candidate_ids) -> set[uuid.UUID]:
    if viewer_id is None or not candidate_ids:
        return set()
    rows = await db.execute(
        select(Follow.follower_id).where(
            Follow.following_id == viewer_id, Follow.follower_id.in_(candidate_ids)
        )
    )
    return {r[0] for r in rows.all()}


async def _people_page(
    db: AsyncSession,
    *,
    viewer: User | None,
    id_column,
    filter_column,
    subject_id,
    cursor: datetime | None,
) -> PersonListOut:
    """
    Shared body for followers/following: same join, same viewer-relative
    flags, only the direction of the edge differs.
    """
    total = (await db.scalar(select(func.count(Follow.id)).where(filter_column == subject_id))) or 0

    query = (
        select(User, Profile, Follow.created_at)
        .join(Follow, id_column == User.id)
        .outerjoin(Profile, Profile.user_id == User.id)
        .where(filter_column == subject_id, User.is_active.is_(True))
        .order_by(Follow.created_at.desc())
        .limit(PAGE_SIZE + 1)
    )
    if cursor is not None:
        query = query.where(Follow.created_at < cursor)

    rows = (await db.execute(query)).all()
    has_more = len(rows) > PAGE_SIZE
    rows = rows[:PAGE_SIZE]

    viewer_id = viewer.id if viewer else None
    hidden = await _blocked_ids(db, viewer_id)
    rows = [r for r in rows if r[0].id not in hidden]

    ids = [r[0].id for r in rows]
    following_ids = await _viewer_following_ids(db, viewer_id, ids)
    followed_by_ids = await _viewer_followed_by_ids(db, viewer_id, ids)

    items = [
        PersonOut.from_user(
            user,
            profile,
            is_following=user.id in following_ids,
            follows_you=user.id in followed_by_ids,
            is_self=viewer_id is not None and user.id == viewer_id,
        )
        for user, profile, _ in rows
    ]

    return PersonListOut(
        items=items,
        total=total,
        next_cursor=rows[-1][2] if (has_more and rows) else None,
    )


@router.get("/{username}/state", response_model=FollowStateOut)
async def get_follow_state(
    username: str,
    viewer: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    target, _ = await resolve_user_by_username(db, username)
    followers, following = await follower_counts(db, target.id)
    is_following, follows_you = await follow_flags(db, viewer.id if viewer else None, target.id)
    return FollowStateOut(
        is_following=is_following,
        follows_you=follows_you,
        followers_count=followers,
        following_count=following,
    )


@router.post("/{username}/follow", response_model=FollowStateOut, status_code=status.HTTP_201_CREATED)
async def follow_user(
    username: str,
    viewer: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    target, _ = await resolve_user_by_username(db, username)
    if target.id == viewer.id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="You can't follow yourself"
        )
    if await is_blocked_between(db, viewer.id, target.id):
        # Same 404 the profile endpoint returns, so a block isn't advertised.
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found")

    existing = await db.scalar(
        select(Follow).where(Follow.follower_id == viewer.id, Follow.following_id == target.id)
    )
    if existing is None:
        db.add(Follow(follower_id=viewer.id, following_id=target.id))
        await notify.push(db, user_id=target.id, actor_id=viewer.id, kind="follow")
        await db.commit()

    followers, following = await follower_counts(db, target.id)
    is_following, follows_you = await follow_flags(db, viewer.id, target.id)
    return FollowStateOut(
        is_following=is_following,
        follows_you=follows_you,
        followers_count=followers,
        following_count=following,
    )


@router.delete("/{username}/follow", response_model=FollowStateOut)
async def unfollow_user(
    username: str,
    viewer: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    target, _ = await resolve_user_by_username(db, username)
    existing = await db.scalar(
        select(Follow).where(Follow.follower_id == viewer.id, Follow.following_id == target.id)
    )
    if existing is not None:
        await db.delete(existing)
        await db.commit()

    followers, following = await follower_counts(db, target.id)
    is_following, follows_you = await follow_flags(db, viewer.id, target.id)
    return FollowStateOut(
        is_following=is_following,
        follows_you=follows_you,
        followers_count=followers,
        following_count=following,
    )


@router.get("/{username}/followers", response_model=PersonListOut)
async def list_followers(
    username: str,
    cursor: datetime | None = Query(default=None),
    viewer: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    target, profile = await resolve_user_by_username(db, username)
    is_owner = viewer is not None and viewer.id == target.id
    if not profile.is_public and not is_owner:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found")
    if viewer is not None and not is_owner and await is_blocked_between(db, viewer.id, target.id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found")

    return await _people_page(
        db,
        viewer=viewer,
        id_column=Follow.follower_id,
        filter_column=Follow.following_id,
        subject_id=target.id,
        cursor=cursor,
    )


@router.get("/{username}/following", response_model=PersonListOut)
async def list_following(
    username: str,
    cursor: datetime | None = Query(default=None),
    viewer: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    target, profile = await resolve_user_by_username(db, username)
    is_owner = viewer is not None and viewer.id == target.id
    if not profile.is_public and not is_owner:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found")
    if viewer is not None and not is_owner and await is_blocked_between(db, viewer.id, target.id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found")

    return await _people_page(
        db,
        viewer=viewer,
        id_column=Follow.following_id,
        filter_column=Follow.follower_id,
        subject_id=target.id,
        cursor=cursor,
    )


@router.get("/suggestions", response_model=PersonListOut)
async def follow_suggestions(
    limit: int = Query(default=10, ge=1, le=30),
    viewer: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    People the viewer doesn't follow yet, newest public profiles first.
    Deliberately simple — a real recommender belongs behind its own
    service, and an honest "who's new" list beats a fake ranked one.
    """
    already = select(Follow.following_id).where(Follow.follower_id == viewer.id)
    hidden = await _blocked_ids(db, viewer.id)

    query = (
        select(User, Profile)
        .join(Profile, Profile.user_id == User.id)
        .where(
            User.is_active.is_(True),
            User.id != viewer.id,
            Profile.username.is_not(None),
            Profile.is_public.is_(True),
            User.id.not_in(already),
        )
        .order_by(Profile.created_at.desc())
        .limit(limit + len(hidden))
    )
    rows = [r for r in (await db.execute(query)).all() if r[0].id not in hidden][:limit]

    ids = [r[0].id for r in rows]
    followed_by_ids = await _viewer_followed_by_ids(db, viewer.id, ids)
    items = [
        PersonOut.from_user(user, profile, is_following=False, follows_you=user.id in followed_by_ids)
        for user, profile in rows
    ]
    return PersonListOut(items=items, total=len(items))


@router.get("/search/people", response_model=PersonListOut)
async def search_people(
    q: str = Query(default="", max_length=60),
    limit: int = Query(default=8, ge=1, le=20),
    viewer: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Typeahead behind the "@" mention menu: public, active accounts whose
    handle or name starts with what has been typed so far.
    """
    term = q.strip().lstrip("@").lower()

    hidden = await _blocked_ids(db, viewer.id)
    base = (
        select(User, Profile)
        .join(Profile, Profile.user_id == User.id)
        .where(
            User.is_active.is_(True),
            Profile.username.is_not(None),
            Profile.is_public.is_(True),
        )
    )

    if term:
        prefix = f"{term}%"
        query = base.where(
            or_(
                func.lower(Profile.username).like(prefix),
                func.lower(User.full_name).like(prefix),
                func.lower(User.full_name).like(f"% {term}%"),
            )
        ).order_by(func.lower(Profile.username))
    else:
        # No term yet: the menu still opens, so show a useful starting
        # set — the official account first, then people the viewer
        # already follows, then everyone else by recency.
        followed = select(Follow.following_id).where(Follow.follower_id == viewer.id)
        query = base.order_by(
            func.lower(func.coalesce(Profile.username, "")).in_(sorted(OFFICIAL_USERNAMES)).desc(),
            User.id.in_(followed).desc(),
            User.created_at.desc(),
        )

    rows = [r for r in (await db.execute(query.limit(limit + len(hidden)))).all() if r[0].id not in hidden][:limit]
    ids = [r[0].id for r in rows]
    following_ids = await _viewer_following_ids(db, viewer.id, ids)
    followed_by_ids = await _viewer_followed_by_ids(db, viewer.id, ids)
    counts = await _followers_counts(db, ids)
    items = [
        PersonOut.from_user(
            user,
            profile,
            is_following=user.id in following_ids,
            follows_you=user.id in followed_by_ids,
            is_self=user.id == viewer.id,
            followers_count=counts.get(user.id, 0),
        )
        for user, profile in rows
    ]
    # The official account always leads the menu.
    items.sort(key=lambda p: (not p.is_official,))
    return PersonListOut(items=items, total=len(items))
