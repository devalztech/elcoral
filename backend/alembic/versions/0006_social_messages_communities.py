"""social graph, direct messages, communities and discussions

Revision ID: 0006_social_messages_communities
Revises: 0005_profile_availability

Creates the tables behind three previously mock-only surfaces:

- follows                    profile follower/following counts and lists
- conversations / participants / messages    direct messaging
- communities / members / discussions (+ likes, saves, comments)

Everything user-owned cascades from users.id so an account deletion
leaves no orphans. communities.owner_id is the one exception: it is
SET NULL, because an official/seeded space should outlive the account
that created it rather than take its members' discussions down with it.
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0006_social_messages_communities"
down_revision = "0005_profile_availability"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ------------------------------------------------------------ follows ---
    op.create_table(
        "follows",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "follower_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "following_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("follower_id", "following_id", name="uq_follows_pair"),
        sa.CheckConstraint("follower_id <> following_id", name="ck_follows_not_self"),
    )
    op.create_index("ix_follows_follower_id", "follows", ["follower_id"])
    op.create_index("ix_follows_following_id", "follows", ["following_id"])

    # ----------------------------------------------------------- messaging ---
    op.create_table(
        "conversations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("pair_key", sa.String(length=80), nullable=True, unique=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_message_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_conversations_last_message_at", "conversations", ["last_message_at"])

    op.create_table(
        "conversation_participants",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "conversation_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("conversations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("last_read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("conversation_id", "user_id", name="uq_conversation_participant"),
    )
    op.create_index(
        "ix_conversation_participants_user_id", "conversation_participants", ["user_id"]
    )

    op.create_table(
        "messages",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "conversation_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("conversations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "sender_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("media_refs", postgresql.ARRAY(sa.String()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_messages_created_at", "messages", ["created_at"])
    op.create_index(
        "ix_messages_conversation_created", "messages", ["conversation_id", "created_at"]
    )

    # --------------------------------------------------------- communities ---
    op.create_table(
        "communities",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("slug", sa.String(length=60), nullable=False, unique=True),
        sa.Column("name", sa.String(length=80), nullable=False),
        sa.Column("description", sa.String(length=300), nullable=True),
        sa.Column("topic", sa.String(length=30), nullable=False, server_default="other"),
        sa.Column("tone", sa.String(length=20), nullable=False, server_default="dark"),
        sa.Column("glyph", sa.String(length=24), nullable=True),
        sa.Column("icon_ref", sa.String(length=64), nullable=True),
        sa.Column("cover_ref", sa.String(length=64), nullable=True),
        sa.Column("is_official", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("is_private", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column(
            "owner_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_communities_slug", "communities", ["slug"])
    op.create_index("ix_communities_topic", "communities", ["topic"])
    op.create_index("ix_communities_created_at", "communities", ["created_at"])

    community_role = postgresql.ENUM(
        "owner", "admin", "member", name="community_role", create_type=False
    )
    community_role.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "community_members",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "community_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("communities.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("role", community_role, nullable=False, server_default="member"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("community_id", "user_id", name="uq_community_member"),
    )
    op.create_index("ix_community_members_user_id", "community_members", ["user_id"])
    op.create_index("ix_community_members_community_id", "community_members", ["community_id"])

    # --------------------------------------------------------- discussions ---
    op.create_table(
        "discussions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "community_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("communities.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "author_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("title", sa.String(length=180), nullable=False),
        sa.Column("body", sa.Text(), nullable=True),
        sa.Column("view_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_discussions_created_at", "discussions", ["created_at"])
    op.create_index(
        "ix_discussions_community_created", "discussions", ["community_id", "created_at"]
    )

    op.create_table(
        "discussion_likes",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "discussion_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("discussions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("discussion_id", "user_id", name="uq_discussion_like"),
    )
    op.create_index("ix_discussion_likes_discussion_id", "discussion_likes", ["discussion_id"])

    op.create_table(
        "discussion_saves",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "discussion_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("discussions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("discussion_id", "user_id", name="uq_discussion_save"),
    )
    op.create_index("ix_discussion_saves_user_id", "discussion_saves", ["user_id"])

    op.create_table(
        "discussion_comments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "discussion_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("discussions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "author_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_discussion_comments_created_at", "discussion_comments", ["created_at"])
    op.create_index(
        "ix_discussion_comments_discussion_id", "discussion_comments", ["discussion_id"]
    )


def downgrade() -> None:
    op.drop_table("discussion_comments")
    op.drop_table("discussion_saves")
    op.drop_table("discussion_likes")
    op.drop_table("discussions")
    op.drop_table("community_members")
    postgresql.ENUM(name="community_role").drop(op.get_bind(), checkfirst=True)
    op.drop_table("communities")
    op.drop_table("messages")
    op.drop_table("conversation_participants")
    op.drop_table("conversations")
    op.drop_table("follows")
