"""
The notification bell.

Read-only plus two write actions (mark one read, mark all read). Rows are
produced by app/core/notify.py from the posts, comments and follow paths.
"""
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.media_url import media_ref_to_url
from app.models.notification import Notification
from app.models.post import Post
from app.models.social import Follow
from app.models.user import User
from app.schemas.notification import NotificationListOut, NotificationOut, UnreadCountOut

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


async def _unread(db: AsyncSession, user_id) -> int:
    return (
        await db.scalar(
            select(func.count(Notification.id)).where(
                Notification.user_id == user_id, Notification.is_read.is_(False)
            )
        )
    ) or 0


@router.get("", response_model=NotificationListOut)
async def list_notifications(
    limit: int = Query(default=50, ge=1, le=100),
    kind: str | None = Query(
        default=None,
        description=(
            "Optional filter for the tab strip: a single kind, or a comma "
            "separated list (e.g. 'comment,reply')."
        ),
    ),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(Notification)
        .options(selectinload(Notification.actor).selectinload(User.profile))
        .where(Notification.user_id == user.id)
    )
    if kind:
        kinds = [k.strip() for k in kind.split(",") if k.strip()]
        if kinds:
            query = query.where(Notification.kind.in_(kinds))

    rows = list(
        (await db.scalars(query.order_by(Notification.created_at.desc()).limit(limit))).all()
    )

    # One batched lookup each for post thumbnails and follow-back state,
    # so a 50-row list is still three queries in total.
    post_ids = {r.post_id for r in rows if r.post_id is not None}
    thumbs: dict = {}
    if post_ids:
        for pid, refs in (
            await db.execute(select(Post.id, Post.media_refs).where(Post.id.in_(post_ids)))
        ).all():
            url = media_ref_to_url((refs or [None])[0]) if refs else None
            if url:
                thumbs[pid] = url

    actor_ids = {r.actor_id for r in rows if r.actor_id is not None}
    following: set = set()
    if actor_ids:
        following = {
            r[0]
            for r in (
                await db.execute(
                    select(Follow.following_id).where(
                        Follow.follower_id == user.id, Follow.following_id.in_(actor_ids)
                    )
                )
            ).all()
        }

    return NotificationListOut(
        items=[
            NotificationOut.from_model(
                r,
                media_url=thumbs.get(r.post_id),
                actor_is_following=r.actor_id in following,
            )
            for r in rows
        ],
        unread_count=await _unread(db, user.id),
    )


@router.get("/unread-count", response_model=UnreadCountOut)
async def unread_count(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return UnreadCountOut(unread_count=await _unread(db, user.id))


@router.post("/read-all", response_model=UnreadCountOut)
async def mark_all_read(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await db.execute(
        update(Notification)
        .where(Notification.user_id == user.id, Notification.is_read.is_(False))
        .values(is_read=True)
    )
    await db.commit()
    return UnreadCountOut(unread_count=0)


@router.post("/{notification_id}/read", response_model=UnreadCountOut)
async def mark_read(
    notification_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    row = await db.get(Notification, notification_id)
    if row is None or row.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")
    if not row.is_read:
        row.is_read = True
        await db.commit()
    return UnreadCountOut(unread_count=await _unread(db, user.id))
