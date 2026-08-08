"""community system: roles, permissions, projects, chat, bans

Revision ID: 0007_community_system
Revises: 0006_social_messages_communities
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0007_community_system"
down_revision = "0006_social_messages_communities"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # --- new role + report target enum values -------------------------------
    op.execute("ALTER TYPE community_role ADD VALUE IF NOT EXISTS 'moderator'")
    for value in ("community", "discussion", "comment", "message", "member"):
        op.execute(f"ALTER TYPE report_target_type ADD VALUE IF NOT EXISTS '{value}'")

    # --- owner-controlled permission policies -------------------------------
    op.add_column("communities", sa.Column("post_policy", sa.String(20), nullable=False, server_default="members"))
    op.add_column("communities", sa.Column("chat_policy", sa.String(20), nullable=False, server_default="members"))
    op.add_column("communities", sa.Column("project_policy", sa.String(20), nullable=False, server_default="members"))
    op.add_column("communities", sa.Column("invite_policy", sa.String(20), nullable=False, server_default="members"))
    op.add_column(
        "communities", sa.Column("moderate_policy", sa.String(20), nullable=False, server_default="moderators")
    )
    op.add_column("communities", sa.Column("chat_enabled", sa.Boolean(), nullable=False, server_default="true"))

    # --- discussions: media + edit marker ------------------------------------
    op.add_column("discussions", sa.Column("media_refs", postgresql.ARRAY(sa.String()), nullable=True))
    op.add_column("discussions", sa.Column("edited_at", sa.DateTime(timezone=True), nullable=True))

    # --- bans ----------------------------------------------------------------
    op.create_table(
        "community_bans",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("community_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("communities.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("banned_by_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("reason", sa.String(200), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("community_id", "user_id", name="uq_community_ban"),
    )
    op.create_index("ix_community_bans_community_id", "community_bans", ["community_id"])

    # --- projects -------------------------------------------------------------
    op.create_table(
        "community_projects",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("community_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("communities.id", ondelete="CASCADE"), nullable=False),
        sa.Column("owner_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("media_refs", postgresql.ARRAY(sa.String()), nullable=True),
        sa.Column("skills", postgresql.ARRAY(sa.String()), nullable=True),
        sa.Column("roles_needed", postgresql.ARRAY(sa.String()), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="idea"),
        sa.Column("seats", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_community_projects_created_at", "community_projects", ["created_at"])
    op.create_index("ix_community_projects_community_created", "community_projects", ["community_id", "created_at"])

    op.create_table(
        "community_project_collaborators",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("community_projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("state", sa.String(20), nullable=False, server_default="requested"),
        sa.Column("note", sa.String(300), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("project_id", "user_id", name="uq_project_collaborator"),
    )
    op.create_index("ix_project_collaborators_project_id", "community_project_collaborators", ["project_id"])

    # --- community chat --------------------------------------------------------
    op.create_table(
        "community_messages",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("community_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("communities.id", ondelete="CASCADE"), nullable=False),
        sa.Column("sender_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("body", sa.Text(), nullable=True),
        sa.Column("media_refs", postgresql.ARRAY(sa.String()), nullable=True),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_community_messages_created_at", "community_messages", ["created_at"])
    op.create_index("ix_community_messages_community_created", "community_messages", ["community_id", "created_at"])


def downgrade() -> None:
    op.drop_table("community_messages")
    op.drop_table("community_project_collaborators")
    op.drop_table("community_projects")
    op.drop_table("community_bans")
    op.drop_column("discussions", "edited_at")
    op.drop_column("discussions", "media_refs")
    for column in ("chat_enabled", "moderate_policy", "invite_policy", "project_policy", "chat_policy", "post_policy"):
        op.drop_column("communities", column)
    # Enum values added above are intentionally left in place: PostgreSQL
    # cannot remove a value from an enum type without recreating it.
