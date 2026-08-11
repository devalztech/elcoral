"""Message actions: replies, forwards, reactions, per-side deletes.

Four separate concerns, one migration because they all land on the DM
surface at once:

  · messages.reply_to_id      — a message can answer another message
  · messages.is_forwarded     — drawn as the "Forwarded" label
  · messages.deleted_for_all  — tombstone; the row stays so both sides
                                keep the same ordering and reply targets
  · message_reactions         — one emoji per person per message
  · message_deletions         — "delete for me", which must not affect
                                what the other participant sees

Revision ID: 0014_message_actions
Revises: 0013_community_featured
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = "0014_message_actions"
down_revision = "0013_community_featured"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("messages", sa.Column("reply_to_id", UUID(as_uuid=True), nullable=True))
    op.create_foreign_key(
        "fk_messages_reply_to",
        "messages",
        "messages",
        ["reply_to_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.add_column(
        "messages",
        sa.Column("is_forwarded", sa.Boolean(), nullable=False, server_default="false"),
    )
    op.add_column(
        "messages",
        sa.Column("deleted_for_all", sa.Boolean(), nullable=False, server_default="false"),
    )
    op.add_column("messages", sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True))

    op.create_table(
        "message_reactions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "message_id",
            UUID(as_uuid=True),
            sa.ForeignKey("messages.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("emoji", sa.String(length=16), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("message_id", "user_id", name="uq_message_reaction_user"),
    )
    op.create_index("ix_message_reactions_message_id", "message_reactions", ["message_id"])

    op.create_table(
        "message_deletions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "message_id",
            UUID(as_uuid=True),
            sa.ForeignKey("messages.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("message_id", "user_id", name="uq_message_deletion_user"),
    )
    op.create_index("ix_message_deletions_user_id", "message_deletions", ["user_id"])


def downgrade() -> None:
    op.drop_table("message_deletions")
    op.drop_table("message_reactions")
    op.drop_column("messages", "deleted_at")
    op.drop_column("messages", "deleted_for_all")
    op.drop_column("messages", "is_forwarded")
    op.drop_constraint("fk_messages_reply_to", "messages", type_="foreignkey")
    op.drop_column("messages", "reply_to_id")
