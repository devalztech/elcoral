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
from app.models.notification import Notification
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
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    rows = await db.execute(
        select(Notification)
        .options(selectinload(Notification.actor).selectinload(User.profile))
        .where(Notification.user_id == user.id)
        .order_by(Notification.created_at.desc())
        .limit(limit)
    )
    return NotificationListOut(
        items=[NotificationOut.from_model(r) for r in rows.scalars().all()],
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
