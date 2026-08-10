"""Featured communities.

A staff-curated flag surfaced by GET /api/communities?scope=featured and
toggled from the management app.

Revision ID: 0013_community_featured
Revises: 0012_comment_likes_notifications
"""
import sqlalchemy as sa
from alembic import op

revision = "0013_community_featured"
down_revision = "0012_comment_likes_notifications"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "communities",
        sa.Column("is_featured", sa.Boolean(), nullable=False, server_default="false"),
    )
    op.add_column("communities", sa.Column("featured_rank", sa.Integer(), nullable=True))
    op.create_index("ix_communities_is_featured", "communities", ["is_featured"])


def downgrade() -> None:
    op.drop_index("ix_communities_is_featured", table_name="communities")
    op.drop_column("communities", "featured_rank")
    op.drop_column("communities", "is_featured")
