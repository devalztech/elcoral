"""profile availability fields

Revision ID: 0005_profile_availability
Revises: 0004_profile_account_type

Adds the two columns behind the profile page's Availability strip, which
was previously frontend-only placeholder content. Both nullable — a
profile that hasn't set an availability status shows no strip at all
rather than a fake default.

"Looking for" on the About tab deliberately does NOT get a new column:
it reads from the existing `intents` array (find_work, hire, mentor,
etc.), which already expresses the same "what brings you here" goals.
"""
import sqlalchemy as sa
from alembic import op

revision = "0005_profile_availability"
down_revision = "0004_profile_account_type"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("profiles", sa.Column("availability_status", sa.String(length=20), nullable=True))
    op.add_column("profiles", sa.Column("availability_note", sa.String(length=120), nullable=True))


def downgrade() -> None:
    op.drop_column("profiles", "availability_note")
    op.drop_column("profiles", "availability_status")
