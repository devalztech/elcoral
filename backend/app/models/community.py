"""
Communities: the groups themselves, membership, and the discussions that
live inside them.

Design notes
------------
- `slug` is the public identifier used in URLs (/home/community/{slug}),
  generated from the name at creation. Immutable afterwards so links
  don't rot.
- `topic` is a plain string validated against COMMUNITY_TOPICS in the
  schema layer, matching the existing convention for profile vocabularies
  (see app/models/profile.py) — the filter rail will keep growing and a
  Postgres enum migration per topic would be absurd.
- `tone` / `glyph` carry the existing Community screen's visual language
  (tile colour + mark) so the design renders from real rows instead of
  the hardcoded MINE/TRENDING arrays it used before.
- Counts (members, likes, comments) are derived at read time. Only
  `view_count` is a stored counter, because there is no per-view row to
  count and an approximate number is fine.
"""
import uuid
from datetime import datetime, timezone
from enum import Enum as PyEnum

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

# Filter rail on the Communities screen. "For you" / "All" are computed
# views, not topics, so they are not listed here.
COMMUNITY_TOPICS = [
    "tech",
    "design",
    "business",
    "ai",
    "startups",
    "creative",
    "career",
    "other",
]

# Tile tones the Community screen already styles (cm-tile tone-*).
COMMUNITY_TONES = ["lemon", "dark", "violet", "leaf", "pink"]


class CommunityRole(str, PyEnum):
    owner = "owner"
    admin = "admin"
    member = "member"


class Community(Base):
    __tablename__ = "communities"
    __table_args__ = (Index("ix_communities_topic", "topic"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    slug: Mapped[str] = mapped_column(String(60), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    description: Mapped[str | None] = mapped_column(String(300), nullable=True)

    topic: Mapped[str] = mapped_column(String(30), nullable=False, default="other", server_default="other")

    # Visual identity used by the existing Community design.
    tone: Mapped[str] = mapped_column(String(20), nullable=False, default="dark", server_default="dark")
    glyph: Mapped[str | None] = mapped_column(String(24), nullable=True)
    icon_ref: Mapped[str | None] = mapped_column(String(64), nullable=True)
    cover_ref: Mapped[str | None] = mapped_column(String(64), nullable=True)

    # Elcoral's own space gets the brand mark and a crown in the UI.
    is_official: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    is_private: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )

    # Nullable: a seeded/official community may outlive the account that
    # created it without taking the community down with it.
    owner_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc), index=True
    )

    members: Mapped[list["CommunityMember"]] = relationship(
        back_populates="community", cascade="all, delete-orphan"
    )


class CommunityMember(Base):
    __tablename__ = "community_members"
    __table_args__ = (
        UniqueConstraint("community_id", "user_id", name="uq_community_member"),
        Index("ix_community_members_user_id", "user_id"),
        Index("ix_community_members_community_id", "community_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    community_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("communities.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    role: Mapped[CommunityRole] = mapped_column(
        Enum(CommunityRole, name="community_role"),
        nullable=False,
        default=CommunityRole.member,
        server_default=CommunityRole.member.value,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc), index=True
    )

    community: Mapped["Community"] = relationship(back_populates="members")
    user: Mapped["User"] = relationship()


class Discussion(Base):
    __tablename__ = "discussions"
    __table_args__ = (Index("ix_discussions_community_created", "community_id", "created_at"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    community_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("communities.id", ondelete="CASCADE"), nullable=False
    )
    author_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    title: Mapped[str] = mapped_column(String(180), nullable=False)
    body: Mapped[str | None] = mapped_column(Text, nullable=True)

    view_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc), index=True
    )

    community: Mapped["Community"] = relationship()
    author: Mapped["User"] = relationship()


class DiscussionLike(Base):
    __tablename__ = "discussion_likes"
    __table_args__ = (
        UniqueConstraint("discussion_id", "user_id", name="uq_discussion_like"),
        Index("ix_discussion_likes_discussion_id", "discussion_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    discussion_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("discussions.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )


class DiscussionSave(Base):
    """Bookmark — private to the member who saved it."""

    __tablename__ = "discussion_saves"
    __table_args__ = (
        UniqueConstraint("discussion_id", "user_id", name="uq_discussion_save"),
        Index("ix_discussion_saves_user_id", "user_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    discussion_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("discussions.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )


class DiscussionComment(Base):
    __tablename__ = "discussion_comments"
    __table_args__ = (Index("ix_discussion_comments_discussion_id", "discussion_id"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    discussion_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("discussions.id", ondelete="CASCADE"), nullable=False
    )
    author_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc), index=True
    )

    author: Mapped["User"] = relationship()
