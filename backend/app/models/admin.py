"""
Admin/authorization models.

Roles live in their OWN table (`user_roles`), never as a column on
`users` or `profiles`. That's deliberate: a role column on the user row
is one careless `PATCH /api/auth/me` away from privilege escalation,
because the same object the user is allowed to edit would also carry the
field that decides what they're allowed to do. A separate table means no
user-facing endpoint ever writes to it — only the admin router does, and
only for callers who already hold the admin role.

`AdminAuditLog` records every state-changing admin action. Admin powers
here are destructive (delete an account, grant a verification badge), so
each one leaves a row naming the actor, the target and the payload.
"""
import uuid
from datetime import datetime, timezone
from enum import Enum as PyEnum

from sqlalchemy import JSON, DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class AppRole(str, PyEnum):
    """
    Ordered least → most privileged. `user` is implicit: everyone who
    signs up has it whether or not a row exists, so the table only ever
    stores elevated grants. Keeping it in the vocabulary anyway means the
    management UI can show and revoke it without special-casing.
    """

    user = "user"
    moderator = "moderator"
    admin = "admin"
    superadmin = "superadmin"


# Roles that may sign in to the management app at all.
ADMIN_ROLES = {AppRole.admin.value, AppRole.superadmin.value}
# Roles allowed to grant/revoke roles themselves.
ROLE_MANAGER_ROLES = {AppRole.superadmin.value}
# Everything the management UI is allowed to assign.
ASSIGNABLE_ROLES = [r.value for r in AppRole]


class UserRole(Base):
    __tablename__ = "user_roles"
    __table_args__ = (UniqueConstraint("user_id", "role", name="uq_user_roles_user_role"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    # Plain string, not a Postgres ENUM: adding a role later is a data
    # change, not a type migration (same reasoning as Profile.account_type).
    role: Mapped[str] = mapped_column(String(32), nullable=False)

    granted_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    user: Mapped["User"] = relationship(  # noqa: F821
        back_populates="roles", foreign_keys=[user_id]
    )


class AdminAuditLog(Base):
    __tablename__ = "admin_audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # SET NULL rather than CASCADE: deleting an admin account must not
    # erase the trail of what that admin did.
    actor_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    actor_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    action: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    target_user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    target_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    detail: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True
    )
