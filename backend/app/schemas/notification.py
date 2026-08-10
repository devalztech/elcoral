"""Notification wire shapes (see app/routers/notifications.py)."""
import uuid
from datetime import datetime

from pydantic import BaseModel

from app.schemas.post import PostAuthorOut


class NotificationOut(BaseModel):
    id: uuid.UUID
    kind: str
    preview: str | None = None
    post_id: uuid.UUID | None = None
    comment_id: uuid.UUID | None = None
    is_read: bool = False
    created_at: datetime
    actor: PostAuthorOut | None = None
    # Thumbnail of the post the notification is about (first image), so the
    # row can render the same preview tile the design calls for.
    media_url: str | None = None
    # Viewer-relative follow state for the actor, used by the inline
    # "Follow back" action on follow notifications.
    actor_is_following: bool = False

    @staticmethod
    def from_model(row, *, media_url: str | None = None, actor_is_following: bool = False) -> "NotificationOut":
        return NotificationOut(
            id=row.id,
            kind=row.kind,
            preview=row.preview,
            post_id=row.post_id,
            comment_id=row.comment_id,
            is_read=row.is_read,
            created_at=row.created_at,
            actor=PostAuthorOut.from_user(row.actor) if row.actor is not None else None,
            media_url=media_url,
            actor_is_following=actor_is_following,
        )


class NotificationListOut(BaseModel):
    items: list[NotificationOut]
    unread_count: int


class UnreadCountOut(BaseModel):
    unread_count: int
