"""profile editor + privacy fields

Revision ID: 0002_profile_editor_fields
Revises: 0001_baseline

Adds the columns the Edit Profile screen and Settings -> Privacy need:
extra social links, the long-form "about" section, a display timezone,
and the three privacy toggles. All nullable or server-defaulted so the
migration is safe to run against a populated database.
"""
import sqlalchemy as sa
from alembic import op

revision = "0002_profile_editor_fields"
down_revision = "0001_baseline"
branch_labels = None
depends_on = None

_NEW_COLUMN_NAMES = [
    "twitter_url",
    "dribbble_url",
    "about",
    "timezone",
    "is_public",
    "show_email",
    "show_activity",
]


def upgrade() -> None:
    op.add_column("profiles", sa.Column("twitter_url", sa.String(255), nullable=True))
    op.add_column("profiles", sa.Column("dribbble_url", sa.String(255), nullable=True))
    op.add_column("profiles", sa.Column("about", sa.String(4000), nullable=True))
    op.add_column("profiles", sa.Column("timezone", sa.String(64), nullable=True))
    op.add_column(
        "profiles",
        sa.Column("is_public", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.add_column(
        "profiles",
        sa.Column("show_email", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column(
        "profiles",
        sa.Column("show_activity", sa.Boolean(), nullable=False, server_default=sa.true()),
    )


def downgrade() -> None:
    for name in reversed(_NEW_COLUMN_NAMES):
        op.drop_column("profiles", name)
