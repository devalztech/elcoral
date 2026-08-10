"""
In-app notifications.

One row per "something happened to you" event: a like on your post, a
comment or reply, a like on your comment, a new follower, or a mention.

Design notes
------------
* `actor_id` is the person who caused it; a notification is never created
  when the actor is the recipient (you don't get told about your own like).
* `post_id` / `comment_id` are optional pointers used to build the deep
  link on the client. They cascade-delete with their target so a deleted
  post can't leave a dead notification behind.
* Likes are deduplicated per (recipient, actor, type, post, comment) so
  an unlike/relike loop doesn't spam the bell.
"""
import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


# Kinds the API accepts. Kept as plain strings rather than a PG enum so a
# new kind is a code change, not a migration.
NOTIFICATION_KINDS = (
    "post_like",
    "comment_like",
    "comment",
    "reply",
    "follow",
    "mention",
)


class Notification(Base):
    __tablename__ = "notifications"
    __table_args__ = (
        Index("ix_notifications_user_created", "user_id", "created_at"),
        Index("ix_notifications_user_read", "user_id", "is_read"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # Who receives it.
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    # Who caused it.
    actor_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=True
    )
    kind: Mapped[str] = mapped_column(String(30), nullable=False)

    post_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("posts.id", ondelete="CASCADE"), nullable=True
    )
    comment_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("post_comments.id", ondelete="CASCADE"), nullable=True
    )
    # A short excerpt of the thing that happened (comment text, post body),
    # snapshotted so the list renders without extra joins.
    preview: Mapped[str | None] = mapped_column(String(280), nullable=True)

    is_read: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_now, index=True
    )

    actor: Mapped["User"] = relationship(foreign_keys=[actor_id])  # noqa: F821
