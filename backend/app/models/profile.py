import uuid
from datetime import datetime, timezone
from enum import Enum as PyEnum

from sqlalchemy import ARRAY, JSON, Boolean, DateTime, Enum, ForeignKey, Numeric, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class CompanySize(str, PyEnum):
    solo = "solo"
    small = "small"  # 2-10
    medium = "medium"  # 11-50
    large = "large"  # 50+


# Everything below is a curated, editable vocabulary rather than a rigid
# enum enforced at the DB level. Stored as plain string arrays (ARRAY of
# String) so new options can be added without a migration — validation of
# "is this a known value" happens in the Pydantic schema layer instead,
# where it's just data, not a schema change. This is deliberate: Elcoral's
# whole premise is defining people by goals/categories that will keep
# growing, not a fixed set baked into the database engine.

# "What brings you to Elcoral?" — a person can hold several at once.
INTENT_CHOICES = [
    "find_work",
    "hire",
    "build_startup",
    "find_collaborators",
    "learn",
    "mentor",
    "showcase_work",
    "network",
    "share_ideas",
    "recruit",
]

# "Why are you here?" — broad category, not a job title; multi-select.
CATEGORY_CHOICES = [
    "developer",
    "designer",
    "writer",
    "video_editor",
    "photographer",
    "animator",
    "devops_engineer",
    "cybersecurity_specialist",
    "ai_engineer",
    "data_analyst",
    "founder",
    "product_manager",
    "recruiter",
    "hr",
    "marketer",
    "creator",
    "student",
    "teacher",
    "mentor",
    "other",
]

# "What do you want to build?" — feeds future collaborator matching.
BUILDING_CHOICES = [
    "mobile_apps",
    "saas",
    "ai",
    "open_source",
    "business",
    "games",
    "content",
    "other",
]

# Availability strip shown in the About tab — a small, closed vocabulary
# (unlike intents/categories/building above) since it drives a colored
# status dot in the UI and needs to stay renderable without a lookup.
AVAILABILITY_CHOICES = [
    "open_to_work",
    "open_to_collab",
    "not_available",
]


class Profile(Base):
    """
    One-to-one with User. Deliberately NOT split by role — Elcoral defines
    people by intents/categories they choose (possibly several at once),
    not a single job type, so role-specific fields below are optional and
    shown/required in the UI based on selected intents/categories, not
    enforced by the schema itself.
    """

    __tablename__ = "profiles"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False
    )

    # @handle, separate from full_name. Checked for availability live
    # during onboarding (see /api/profile/username-available).
    username: Mapped[str | None] = mapped_column(String(30), unique=True, nullable=True)

    # Chosen on the signup form ("Join as"): individual | organization.
    # Kept as a plain string (not an Enum) so adding a future kind is a
    # data change rather than a Postgres type migration.
    account_type: Mapped[str] = mapped_column(
        String(20), default="individual", server_default="individual", nullable=False
    )

    # Photo/cover are stored in Telegram (see app/core/telegram_storage.py).
    # These are the compact pointers saved here; the API layer resolves
    # them to real-looking URLs (GET /api/media/{ref}) before they ever
    # reach the frontend — see schemas/profile.py.
    photo_ref: Mapped[str | None] = mapped_column(String(64), nullable=True)
    cover_ref: Mapped[str | None] = mapped_column(String(64), nullable=True)

    onboarding_complete: Mapped[bool] = mapped_column(Boolean, default=False)

    # --- Core identity (replaces the old rigid client/freelancer role) ---
    intents: Mapped[list[str] | None] = mapped_column(ARRAY(String), nullable=True)
    categories: Mapped[list[str] | None] = mapped_column(ARRAY(String), nullable=True)
    building: Mapped[list[str] | None] = mapped_column(ARRAY(String), nullable=True)
    interests: Mapped[list[str] | None] = mapped_column(ARRAY(String), nullable=True)

    # --- About tab: availability strip ---
    # Nullable so a profile that hasn't set this shows no availability
    # strip at all, rather than defaulting to a false "open to work".
    availability_status: Mapped[str | None] = mapped_column(String(20), nullable=True)
    # Free-text line under the status, e.g. "Usually replies within 15 mins".
    availability_note: Mapped[str | None] = mapped_column(String(120), nullable=True)

    # --- Shared fields ---
    country_code: Mapped[str | None] = mapped_column(String(2), nullable=True)
    city: Mapped[str | None] = mapped_column(String(120), nullable=True)
    is_remote: Mapped[bool] = mapped_column(Boolean, default=False)

    headline: Mapped[str | None] = mapped_column(String(120), nullable=True)
    bio: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    skills: Mapped[list[str] | None] = mapped_column(ARRAY(String), nullable=True)
    portfolio_links: Mapped[list[str] | None] = mapped_column(ARRAY(String), nullable=True)
    # Each entry: {"title": str, "company": str, "years": str}
    work_experience: Mapped[list[dict] | None] = mapped_column(JSON, nullable=True)

    # Social/external links — separate named columns rather than folding
    # into portfolio_links, since these are specific well-known platforms
    # the UI can render with recognizable icons (github, linkedin, etc).
    github_url: Mapped[str | None] = mapped_column(String(255), nullable=True)
    linkedin_url: Mapped[str | None] = mapped_column(String(255), nullable=True)
    website_url: Mapped[str | None] = mapped_column(String(255), nullable=True)
    telegram_handle: Mapped[str | None] = mapped_column(String(64), nullable=True)
    twitter_url: Mapped[str | None] = mapped_column(String(255), nullable=True)
    dribbble_url: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Free-text "About you" section on the profile editor — longer-form
    # than `bio` (which is the short 200-char blurb under the header).
    about: Mapped[str | None] = mapped_column(String(4000), nullable=True)

    # IANA-ish display label chosen in the editor (e.g. "(GMT+1) West
    # Africa Time"). Stored as the label the UI shows rather than a strict
    # tz identifier, matching how the picker works today.
    timezone: Mapped[str | None] = mapped_column(String(64), nullable=True)

    # --- Privacy preferences (Settings -> Privacy) ---
    is_public: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true", nullable=False)
    show_email: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false", nullable=False)
    show_activity: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true", nullable=False)

    # --- Freelance-rate fields (relevant if "find_work" is in intents) ---
    hourly_rate: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)

    # --- Hiring fields (relevant if "hire" is in intents) ---
    company_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    hiring_for: Mapped[str | None] = mapped_column(String(120), nullable=True)
    company_size: Mapped[CompanySize | None] = mapped_column(Enum(CompanySize), nullable=True)
    budget_min: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    budget_max: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    user: Mapped["User"] = relationship(back_populates="profile")
