import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class User(Base):
    """
    Deliberately no `role` COLUMN — authorization roles live in the
    separate `user_roles` table (app/models/admin.py) so nothing a member
    can edit about themselves sits next to the field that decides what
    they may do.

    Deliberately no product `role` field either. Elcoral defines people by the intents/
    categories they choose (possibly several, possibly changing over
    time) — see Profile.intents / Profile.categories — rather than a
    fixed account type decided at signup.
    """

    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(120), nullable=False)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    # Email confirmation ONLY. This is not the blue tick — confirming an
    # inbox proves you can read email, nothing else, so it must never by
    # itself decorate a profile as "verified". See is_badge_verified.
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)

    # The public verification badge (the blue rosette next to a name).
    # Granted and revoked exclusively by an admin through the management
    # app (POST/DELETE /api/admin/users/{id}/badge) — there is no code
    # path anywhere in the member-facing API that writes this column, so
    # a member can never award it to themselves by any combination of
    # email changes, profile edits or onboarding submissions.
    is_badge_verified: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="false", nullable=False
    )
    badge_verified_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    badge_verified_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    failed_login_attempts: Mapped[int] = mapped_column(default=0)
    locked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    # Last time this person had a live socket open (see app/core/presence.py).
    # Persisted so "last seen" survives a restart; live online/offline is
    # answered from the in-memory registry, not from this column.
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    refresh_tokens: Mapped[list["RefreshToken"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    roles: Mapped[list["UserRole"]] = relationship(  # noqa: F821
        back_populates="user",
        cascade="all, delete-orphan",
        foreign_keys="UserRole.user_id",
        lazy="selectin",
    )
    profile: Mapped["Profile"] = relationship(
        back_populates="user", uselist=False, cascade="all, delete-orphan"
    )


class RefreshToken(Base):
    """Refresh tokens are stored hashed so a DB leak alone can't be replayed."""

    __tablename__ = "refresh_tokens"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    hashed_token: Mapped[str] = mapped_column(String(255), nullable=False)
    revoked: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    user: Mapped["User"] = relationship(back_populates="refresh_tokens")


class EmailVerificationToken(Base):
    """
    One-time token emailed to the user to confirm their address. Stored
    hashed, same reasoning as RefreshToken — a DB leak alone shouldn't let
    someone verify arbitrary accounts. Old/used tokens are left in place
    for audit purposes rather than deleted; `used` marks whether it's
    still valid.
    """

    __tablename__ = "email_verification_tokens"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    hashed_token: Mapped[str] = mapped_column(String(255), nullable=False)
    used: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class PasswordResetToken(Base):
    """
    One-time token emailed to reset a forgotten password. Same hashed-
    token pattern as EmailVerificationToken. A short expiry (see
    PASSWORD_RESET_TOKEN_HOURS in app/routers/auth.py) since this grants
    account takeover if leaked, unlike a verification link.
    """

    __tablename__ = "password_reset_tokens"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    hashed_token: Mapped[str] = mapped_column(String(255), nullable=False)
    used: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
