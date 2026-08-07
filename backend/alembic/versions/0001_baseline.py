"""baseline schema: users, tokens, profiles, posts

Revision ID: 0001_baseline
Revises:
Create Date: 2025-01-01

This is the baseline for a database that already matches the models as
they were before profile editing/settings were added. Existing
deployments whose tables were created outside Alembic should run
`alembic stamp 0001_baseline` once and then `alembic upgrade head`;
fresh databases just run `alembic upgrade head`.
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0001_baseline"
down_revision = None
branch_labels = None
depends_on = None


def _token_table(name: str) -> None:
    op.create_table(
        name,
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("hashed_token", sa.String(255), nullable=False),
        sa.Column("used", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
    )


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column("full_name", sa.String(120), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("is_verified", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("failed_login_attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("locked_until", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    _token_table("email_verification_tokens")
    _token_table("password_reset_tokens")

    op.create_table(
        "refresh_tokens",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("hashed_token", sa.String(255), nullable=False),
        sa.Column("revoked", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
    )

    company_size = postgresql.ENUM(
        "solo", "small", "medium", "large", name="companysize", create_type=False
    )
    company_size.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "profiles",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("username", sa.String(30), nullable=True, unique=True),
        sa.Column("photo_ref", sa.String(64), nullable=True),
        sa.Column("cover_ref", sa.String(64), nullable=True),
        sa.Column("onboarding_complete", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("intents", postgresql.ARRAY(sa.String()), nullable=True),
        sa.Column("categories", postgresql.ARRAY(sa.String()), nullable=True),
        sa.Column("building", postgresql.ARRAY(sa.String()), nullable=True),
        sa.Column("interests", postgresql.ARRAY(sa.String()), nullable=True),
        sa.Column("country_code", sa.String(2), nullable=True),
        sa.Column("city", sa.String(120), nullable=True),
        sa.Column("is_remote", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("headline", sa.String(120), nullable=True),
        sa.Column("bio", sa.String(2000), nullable=True),
        sa.Column("skills", postgresql.ARRAY(sa.String()), nullable=True),
        sa.Column("portfolio_links", postgresql.ARRAY(sa.String()), nullable=True),
        sa.Column("work_experience", sa.JSON(), nullable=True),
        sa.Column("github_url", sa.String(255), nullable=True),
        sa.Column("linkedin_url", sa.String(255), nullable=True),
        sa.Column("website_url", sa.String(255), nullable=True),
        sa.Column("telegram_handle", sa.String(64), nullable=True),
        sa.Column("hourly_rate", sa.Numeric(10, 2), nullable=True),
        sa.Column("company_name", sa.String(120), nullable=True),
        sa.Column("hiring_for", sa.String(120), nullable=True),
        sa.Column("company_size", company_size, nullable=True),
        sa.Column("budget_min", sa.Numeric(10, 2), nullable=True),
        sa.Column("budget_max", sa.Numeric(10, 2), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        "posts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "author_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("body", sa.String(3000), nullable=False),
        sa.Column("media_refs", postgresql.ARRAY(sa.String()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_posts_created_at", "posts", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_posts_created_at", table_name="posts")
    op.drop_table("posts")
    op.drop_table("profiles")
    op.drop_table("refresh_tokens")
    op.drop_table("password_reset_tokens")
    op.drop_table("email_verification_tokens")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")
    postgresql.ENUM(name="companysize").drop(op.get_bind(), checkfirst=True)
