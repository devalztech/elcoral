"""user settings, blocked users, content reports

Revision ID: 0003_settings_blocks_reports
Revises: 0002_profile_editor_fields

Backs the Settings screens: a one-row-per-user preferences table
(notifications, email, appearance, language, accessibility), the block
list, and the report history. Every preference column is NOT NULL with a
server default so rows created by older code paths are still valid, and
the tables are new so this is safe against a populated database.
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0003_settings_blocks_reports"
down_revision = "0002_profile_editor_fields"
branch_labels = None
depends_on = None

theme_enum = postgresql.ENUM("dark", "light", "system", name="theme", create_type=False)
font_scale_enum = postgresql.ENUM(
    "small", "default", "large", "xlarge", name="font_scale", create_type=False
)
report_status_enum = postgresql.ENUM(
    "open", "reviewing", "resolved", "dismissed", name="report_status", create_type=False
)
report_target_enum = postgresql.ENUM("user", "post", name="report_target_type", create_type=False)


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = set(inspector.get_table_names())

    theme_enum.create(bind, checkfirst=True)
    font_scale_enum.create(bind, checkfirst=True)
    report_status_enum.create(bind, checkfirst=True)
    report_target_enum.create(bind, checkfirst=True)

    if "user_settings" not in existing_tables:
        op.create_table(
            "user_settings",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column(
                "user_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("users.id", ondelete="CASCADE"),
                nullable=False,
                unique=True,
            ),
            sa.Column("notify_messages", sa.Boolean(), nullable=False, server_default=sa.text("true")),
            sa.Column("notify_mentions", sa.Boolean(), nullable=False, server_default=sa.text("true")),
            sa.Column("notify_follows", sa.Boolean(), nullable=False, server_default=sa.text("true")),
            sa.Column("notify_post_activity", sa.Boolean(), nullable=False, server_default=sa.text("true")),
            sa.Column("notify_job_matches", sa.Boolean(), nullable=False, server_default=sa.text("true")),
            sa.Column(
                "email_product_updates", sa.Boolean(), nullable=False, server_default=sa.text("true")
            ),
            sa.Column("email_weekly_digest", sa.Boolean(), nullable=False, server_default=sa.text("true")),
            sa.Column(
                "email_security_alerts", sa.Boolean(), nullable=False, server_default=sa.text("true")
            ),
            sa.Column("email_marketing", sa.Boolean(), nullable=False, server_default=sa.text("false")),
            sa.Column("theme", theme_enum, nullable=False, server_default="dark"),
            sa.Column("accent", sa.String(length=20), nullable=False, server_default="lemon"),
            sa.Column("language", sa.String(length=8), nullable=False, server_default="en"),
            sa.Column("reduce_motion", sa.Boolean(), nullable=False, server_default=sa.text("false")),
            sa.Column("high_contrast", sa.Boolean(), nullable=False, server_default=sa.text("false")),
            sa.Column("font_scale", font_scale_enum, nullable=False, server_default="default"),
            sa.Column(
                "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")
            ),
            sa.Column(
                "updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")
            ),
        )

    if "blocked_users" not in existing_tables:
        op.create_table(
            "blocked_users",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column(
                "blocker_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("users.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column(
                "blocked_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("users.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column(
                "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")
            ),
            sa.UniqueConstraint("blocker_id", "blocked_id", name="uq_blocked_users_pair"),
        )
        op.create_index("ix_blocked_users_blocker_id", "blocked_users", ["blocker_id"])
        op.create_index("ix_blocked_users_blocked_id", "blocked_users", ["blocked_id"])

    if "content_reports" not in existing_tables:
        op.create_table(
            "content_reports",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column(
                "reporter_id",
                postgresql.UUID(as_uuid=True),
                sa.ForeignKey("users.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("target_type", report_target_enum, nullable=False),
            sa.Column("target_id", postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("target_label", sa.String(length=120), nullable=True),
            sa.Column("reason", sa.String(length=40), nullable=False),
            sa.Column("details", sa.Text(), nullable=True),
            sa.Column("status", report_status_enum, nullable=False, server_default="open"),
            sa.Column(
                "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")
            ),
        )
        op.create_index("ix_content_reports_reporter_id", "content_reports", ["reporter_id"])
        op.create_index("ix_content_reports_created_at", "content_reports", ["created_at"])


def downgrade() -> None:
    bind = op.get_bind()
    op.drop_table("content_reports")
    op.drop_table("blocked_users")
    op.drop_table("user_settings")
    report_target_enum.drop(bind, checkfirst=True)
    report_status_enum.drop(bind, checkfirst=True)
    font_scale_enum.drop(bind, checkfirst=True)
    theme_enum.drop(bind, checkfirst=True)
