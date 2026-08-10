"""Comment likes + in-app notifications.

Revision ID: 0012_comment_likes_notifications
Revises: 0011_admin_roles_badge
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = "0012_comment_likes_notifications"
down_revision = "0011_admin_roles_badge"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "post_comment_likes",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "comment_id",
            UUID(as_uuid=True),
            sa.ForeignKey("post_comments.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("comment_id", "user_id", name="uq_post_comment_likes_pair"),
    )
    op.create_index("ix_post_comment_likes_comment_id", "post_comment_likes", ["comment_id"])

    op.create_table(
        "notifications",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "actor_id",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column("kind", sa.String(length=30), nullable=False),
        sa.Column(
            "post_id", UUID(as_uuid=True), sa.ForeignKey("posts.id", ondelete="CASCADE"), nullable=True
        ),
        sa.Column(
            "comment_id",
            UUID(as_uuid=True),
            sa.ForeignKey("post_comments.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column("preview", sa.String(length=280), nullable=True),
        sa.Column("is_read", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_notifications_created_at", "notifications", ["created_at"])
    op.create_index("ix_notifications_user_created", "notifications", ["user_id", "created_at"])
    op.create_index("ix_notifications_user_read", "notifications", ["user_id", "is_read"])


def downgrade() -> None:
    op.drop_index("ix_notifications_user_read", table_name="notifications")
    op.drop_index("ix_notifications_user_created", table_name="notifications")
    op.drop_index("ix_notifications_created_at", table_name="notifications")
    op.drop_table("notifications")
    op.drop_index("ix_post_comment_likes_comment_id", table_name="post_comment_likes")
    op.drop_table("post_comment_likes")
