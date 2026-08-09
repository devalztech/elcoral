"""direct messaging: media-only messages, media types, presence last-seen

Revision ID: 0009_messaging_presence
Revises: 0008_post_engagement

Three small, additive changes:

* messages.body becomes nullable — a voice note / photo / document is a
  complete message with no caption, and forcing a placeholder body would
  put junk text in the inbox preview.
* messages.media_types stores the MIME type each ref was uploaded with,
  parallel to media_refs, so the client renders the right player instead
  of guessing from the ref.
* users.last_seen_at persists "last seen" across restarts; live
  online/offline is answered from app/core/presence.py, not this column.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0009_messaging_presence"
down_revision = "0008_post_engagement"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column("messages", "body", existing_type=sa.Text(), nullable=True)
    op.add_column("messages", sa.Column("media_types", postgresql.ARRAY(sa.String()), nullable=True))
    op.add_column("users", sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "last_seen_at")
    op.drop_column("messages", "media_types")
    # Empty bodies would violate the restored NOT NULL, so backfill first.
    op.execute("UPDATE messages SET body = '' WHERE body IS NULL")
    op.alter_column("messages", "body", existing_type=sa.Text(), nullable=False)
