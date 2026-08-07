"""
Settings-screen persistence: per-user preferences, blocked users and
content reports.

Kept out of Profile on purpose — Profile is public-facing data rendered
on someone's page, while everything here is private, account-scoped
machinery that no visitor ever sees. Mixing them would mean every public
profile read pulls columns it must never serialize.
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
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Theme(str, PyEnum):
    dark = "dark"
    light = "light"
    system = "system"


class FontScale(str, PyEnum):
    small = "small"
    default = "default"
    large = "large"
    xlarge = "xlarge"


class ReportStatus(str, PyEnum):
    open = "open"
    reviewing = "reviewing"
    resolved = "resolved"
    dismissed = "dismissed"


class ReportTargetType(str, PyEnum):
    user = "user"
    post = "post"


# Accent colors the appearance screen offers. Validated in the schema
# layer rather than the DB for the same reason as the profile vocabularies
# (see app/models/profile.py): the palette will grow, a migration per
# color would be absurd.
ACCENT_CHOICES = ["lemon", "coral", "sky", "violet", "amber"]

# Locales the UI ships copy for. Same reasoning as above.
LANGUAGE_CHOICES = ["en", "fr", "es", "pt", "de", "ar", "sw"]


class UserSettings(Base):
    """
    One-to-one with User, created lazily on first read of GET
    /api/settings so an account that predates this table doesn't need a
    backfill. Every column is NOT NULL with a server default so the row
    is meaningful the moment it exists.
    """

    __tablename__ = "user_settings"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False
    )

    # --- Notifications (in-app / push) ---
    notify_messages: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    notify_mentions: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    notify_follows: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    notify_post_activity: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )
    notify_job_matches: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )

    # --- Email preferences ---
    email_product_updates: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )
    email_weekly_digest: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )
    email_security_alerts: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="true"
    )
    email_marketing: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )

    # --- Appearance ---
    theme: Mapped[Theme] = mapped_column(
        Enum(Theme, name="theme"), nullable=False, default=Theme.dark, server_default=Theme.dark.value
    )
    accent: Mapped[str] = mapped_column(String(20), nullable=False, default="lemon", server_default="lemon")

    # --- Language ---
    language: Mapped[str] = mapped_column(String(8), nullable=False, default="en", server_default="en")

    # --- Accessibility ---
    reduce_motion: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    high_contrast: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    font_scale: Mapped[FontScale] = mapped_column(
        Enum(FontScale, name="font_scale"),
        nullable=False,
        default=FontScale.default,
        server_default=FontScale.default.value,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    user: Mapped["User"] = relationship()


class BlockedUser(Base):
    """
    A directed block: `blocker_id` no longer wants anything to do with
    `blocked_id`. Enforced symmetrically at read time (see
    app/routers/profile.py) — neither side can view the other's profile
    once a block exists in either direction.
    """

    __tablename__ = "blocked_users"
    __table_args__ = (
        UniqueConstraint("blocker_id", "blocked_id", name="uq_blocked_users_pair"),
        Index("ix_blocked_users_blocker_id", "blocker_id"),
        Index("ix_blocked_users_blocked_id", "blocked_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    blocker_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    blocked_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )


class ContentReport(Base):
    """
    A report filed by a member against a user or a post. Reports are
    never deleted by the reporter — "Report history" is a read-only
    record of what they submitted and where it got to.
    """

    __tablename__ = "content_reports"
    __table_args__ = (Index("ix_content_reports_reporter_id", "reporter_id"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    reporter_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    target_type: Mapped[ReportTargetType] = mapped_column(
        Enum(ReportTargetType, name="report_target_type"), nullable=False
    )
    # Not a FK: the reported user or post may be deleted later, and the
    # report must survive that for moderation history.
    target_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    # Human-readable snapshot of what was reported (e.g. "@someone"), so
    # the history screen still reads sensibly after the target is gone.
    target_label: Mapped[str | None] = mapped_column(String(120), nullable=True)

    reason: Mapped[str] = mapped_column(String(40), nullable=False)
    details: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[ReportStatus] = mapped_column(
        Enum(ReportStatus, name="report_status"),
        nullable=False,
        default=ReportStatus.open,
        server_default=ReportStatus.open.value,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc), index=True
    )


REPORT_REASONS = [
    "spam",
    "harassment",
    "hate_speech",
    "impersonation",
    "scam_or_fraud",
    "nudity_or_sexual_content",
    "violence",
    "intellectual_property",
    "other",
]
