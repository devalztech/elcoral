"""profile.account_type

Revision ID: 0004_profile_account_type
Revises: 0003_settings_blocks_reports

The signup form's "Join as" choice (individual / organization) was being
collected and then thrown away. This adds the column that stores it.
NOT NULL with a server default so existing profiles stay valid.
"""
import sqlalchemy as sa
from alembic import op

revision = "0004_profile_account_type"
down_revision = "0003_settings_blocks_reports"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "profiles",
        sa.Column(
            "account_type",
            sa.String(length=20),
            nullable=False,
            server_default="individual",
        ),
    )


def downgrade() -> None:
    op.drop_column("profiles", "account_type")
