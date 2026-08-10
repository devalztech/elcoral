"""admin: user_roles, admin_audit_logs, admin-granted verification badge

Revision ID: 0011_admin_roles_badge
Revises: 0010_comment_media

Three things, all in service of the management app:

* `user_roles` — authorization roles in their own table (user / moderator
  / admin / superadmin) instead of a column on `users`, so no member-
  editable payload is ever adjacent to the field that grants power.
* `admin_audit_logs` — an append-only trail of every admin action.
* `users.is_badge_verified` (+ when/by whom) — the public blue tick,
  separated from `users.is_verified`, which stays a pure "this inbox was
  confirmed" flag. The upgrade deliberately does NOT backfill the badge
  from is_verified: every existing email-verified account would otherwise
  silently become badge-verified, which is exactly the behaviour this
  migration exists to end.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0011_admin_roles_badge"
down_revision = "0010_comment_media"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "is_badge_verified",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )
    op.add_column("users", sa.Column("badge_verified_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column(
        "users",
        sa.Column("badge_verified_by", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_users_badge_verified_by",
        "users",
        "users",
        ["badge_verified_by"],
        ["id"],
        ondelete="SET NULL",
    )

    op.create_table(
        "user_roles",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("role", sa.String(length=32), nullable=False),
        sa.Column(
            "granted_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.UniqueConstraint("user_id", "role", name="uq_user_roles_user_role"),
    )
    op.create_index("ix_user_roles_user_id", "user_roles", ["user_id"])

    op.create_table(
        "admin_audit_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "actor_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("actor_email", sa.String(length=255), nullable=True),
        sa.Column("action", sa.String(length=64), nullable=False),
        sa.Column("target_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("target_email", sa.String(length=255), nullable=True),
        sa.Column("detail", sa.JSON(), nullable=True),
        sa.Column("ip_address", sa.String(length=64), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index("ix_admin_audit_logs_action", "admin_audit_logs", ["action"])
    op.create_index("ix_admin_audit_logs_created_at", "admin_audit_logs", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_admin_audit_logs_created_at", table_name="admin_audit_logs")
    op.drop_index("ix_admin_audit_logs_action", table_name="admin_audit_logs")
    op.drop_table("admin_audit_logs")
    op.drop_index("ix_user_roles_user_id", table_name="user_roles")
    op.drop_table("user_roles")
    op.drop_constraint("fk_users_badge_verified_by", "users", type_="foreignkey")
    op.drop_column("users", "badge_verified_by")
    op.drop_column("users", "badge_verified_at")
    op.drop_column("users", "is_badge_verified")
