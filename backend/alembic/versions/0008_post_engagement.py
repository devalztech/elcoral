"""post composer fields + likes, comments, reposts, saves, poll votes

Revision ID: 0008_post_engagement
Revises: 0007_community_system
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0008_post_engagement"
down_revision = "0007_community_system"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # --- richer posts --------------------------------------------------------
    op.add_column("posts", sa.Column("kind", sa.String(20), nullable=False, server_default="text"))
    op.add_column("posts", sa.Column("title", sa.String(200), nullable=True))
    op.add_column("posts", sa.Column("media_types", postgresql.ARRAY(sa.String()), nullable=True))
    op.add_column("posts", sa.Column("tags", postgresql.ARRAY(sa.String()), nullable=True))
    op.add_column("posts", sa.Column("link_url", sa.String(500), nullable=True))
    op.add_column("posts", sa.Column("visibility", sa.String(20), nullable=False, server_default="public"))
    op.add_column("posts", sa.Column("poll_options", postgresql.ARRAY(sa.String()), nullable=True))
    op.add_column("posts", sa.Column("edited_at", sa.DateTime(timezone=True), nullable=True))
    # Articles need room; the old 3000-char cap was tuned for short posts.
    op.alter_column("posts", "body", type_=sa.String(20000), existing_nullable=False)

    # --- likes ---------------------------------------------------------------
    op.create_table(
        "post_likes",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("post_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("posts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("post_id", "user_id", name="uq_post_likes_pair"),
    )
    op.create_index("ix_post_likes_post_id", "post_likes", ["post_id"])

    # --- reposts -------------------------------------------------------------
    op.create_table(
        "post_reposts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("post_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("posts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("quote", sa.String(3000), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("post_id", "user_id", name="uq_post_reposts_pair"),
    )
    op.create_index("ix_post_reposts_post_id", "post_reposts", ["post_id"])
    op.create_index("ix_post_reposts_created_at", "post_reposts", ["created_at"])

    # --- saves ---------------------------------------------------------------
    op.create_table(
        "post_saves",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("post_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("posts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("post_id", "user_id", name="uq_post_saves_pair"),
    )

    # --- comments ------------------------------------------------------------
    op.create_table(
        "post_comments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("post_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("posts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("author_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("parent_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("post_comments.id", ondelete="CASCADE"), nullable=True),
        sa.Column("body", sa.String(2000), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_post_comments_post_created", "post_comments", ["post_id", "created_at"])
    op.create_index("ix_post_comments_created_at", "post_comments", ["created_at"])

    # --- poll votes ----------------------------------------------------------
    op.create_table(
        "post_poll_votes",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("post_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("posts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("option_index", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("post_id", "user_id", name="uq_post_poll_votes_pair"),
        sa.CheckConstraint("option_index >= 0", name="ck_post_poll_votes_index"),
    )


def downgrade() -> None:
    op.drop_table("post_poll_votes")
    op.drop_index("ix_post_comments_created_at", table_name="post_comments")
    op.drop_index("ix_post_comments_post_created", table_name="post_comments")
    op.drop_table("post_comments")
    op.drop_table("post_saves")
    op.drop_index("ix_post_reposts_created_at", table_name="post_reposts")
    op.drop_index("ix_post_reposts_post_id", table_name="post_reposts")
    op.drop_table("post_reposts")
    op.drop_index("ix_post_likes_post_id", table_name="post_likes")
    op.drop_table("post_likes")

    op.alter_column("posts", "body", type_=sa.String(3000), existing_nullable=False)
    for column in ("edited_at", "poll_options", "visibility", "link_url", "tags", "media_types", "title", "kind"):
        op.drop_column("posts", column)
