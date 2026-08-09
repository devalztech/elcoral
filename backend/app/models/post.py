import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    ARRAY,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Post(Base):
    __tablename__ = "posts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    author_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    # What kind of thing this is: text | media | article | link | poll.
    # One table rather than one per kind — the feed reads them all in a
    # single reverse-chronological query, and the differences are a couple
    # of nullable columns, not a different lifecycle.
    kind: Mapped[str] = mapped_column(String(20), nullable=False, default="text")

    # Articles get a headline; everything else leaves this null.
    title: Mapped[str | None] = mapped_column(String(200), nullable=True)

    body: Mapped[str] = mapped_column(String(20000), nullable=False)

    # Media (images/video) stored in Telegram — see app/core/telegram_storage.py.
    # Each entry is a photo_ref-style pointer; resolved to real URLs by the
    # API layer, same pattern as Profile.photo_ref. media_types keeps the
    # mime type per ref so the client knows whether to render <img> or
    # <video> without sniffing the bytes.
    media_refs: Mapped[list[str] | None] = mapped_column(ARRAY(String), nullable=True)
    media_types: Mapped[list[str] | None] = mapped_column(ARRAY(String), nullable=True)

    tags: Mapped[list[str] | None] = mapped_column(ARRAY(String), nullable=True)
    link_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # public | followers — enforced on read in app/routers/posts.py.
    visibility: Mapped[str] = mapped_column(String(20), nullable=False, default="public")

    # Poll options live inline; votes are their own table (post_poll_votes).
    poll_options: Mapped[list[str] | None] = mapped_column(ARRAY(String), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, index=True)
    edited_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    author: Mapped["User"] = relationship()


class PostLike(Base):
    __tablename__ = "post_likes"
    __table_args__ = (
        UniqueConstraint("post_id", "user_id", name="uq_post_likes_pair"),
        Index("ix_post_likes_post_id", "post_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    post_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("posts.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class PostRepost(Base):
    __tablename__ = "post_reposts"
    __table_args__ = (
        UniqueConstraint("post_id", "user_id", name="uq_post_reposts_pair"),
        Index("ix_post_reposts_post_id", "post_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    post_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("posts.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    # Optional "quote repost" note.
    quote: Mapped[str | None] = mapped_column(String(3000), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, index=True)


class PostSave(Base):
    __tablename__ = "post_saves"
    __table_args__ = (UniqueConstraint("post_id", "user_id", name="uq_post_saves_pair"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    post_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("posts.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class PostComment(Base):
    __tablename__ = "post_comments"
    __table_args__ = (Index("ix_post_comments_post_created", "post_id", "created_at"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    post_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("posts.id", ondelete="CASCADE"), nullable=False)
    author_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    # One level of threading: a reply points at a top-level comment.
    parent_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("post_comments.id", ondelete="CASCADE"), nullable=True
    )
    body: Mapped[str] = mapped_column(String(2000), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, index=True)

    author: Mapped["User"] = relationship()


class PostPollVote(Base):
    __tablename__ = "post_poll_votes"
    __table_args__ = (
        UniqueConstraint("post_id", "user_id", name="uq_post_poll_votes_pair"),
        CheckConstraint("option_index >= 0", name="ck_post_poll_votes_index"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    post_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("posts.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    option_index: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
