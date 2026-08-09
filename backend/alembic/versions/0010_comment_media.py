"""photo comments: optional media on post_comments, nullable body

Revision ID: 0010_comment_media
Revises: 0009_messaging_presence

A comment can now be a photo with an optional caption, mirroring how
messages already work:

* post_comments.media_ref / media_type store one image (the same storage
  pointer + MIME pair used by posts and messages).
* post_comments.body becomes nullable, because a photo-only comment is a
  complete comment and a placeholder body would show as blank text.
"""
from alembic import op
import sqlalchemy as sa

revision = "0010_comment_media"
down_revision = "0009_messaging_presence"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("post_comments", sa.Column("media_ref", sa.String(length=512), nullable=True))
    op.add_column("post_comments", sa.Column("media_type", sa.String(length=120), nullable=True))
    op.alter_column("post_comments", "body", existing_type=sa.String(length=2000), nullable=True)


def downgrade() -> None:
    # Photo-only comments have no text; backfill before restoring NOT NULL.
    op.execute("UPDATE post_comments SET body = '' WHERE body IS NULL")
    op.alter_column("post_comments", "body", existing_type=sa.String(length=2000), nullable=False)
    op.drop_column("post_comments", "media_type")
    op.drop_column("post_comments", "media_ref")
