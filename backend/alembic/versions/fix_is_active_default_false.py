from alembic import op
import sqlalchemy as sa

revision = "fix_is_active_default_false"
down_revision = "f60f71918573"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        "users",
        "is_active",
        server_default=sa.false(),
        existing_type=sa.Boolean(),
        existing_nullable=True,
    )


def downgrade() -> None:
    op.alter_column(
        "users",
        "is_active",
        server_default=sa.true(),
        existing_type=sa.Boolean(),
        existing_nullable=True,
    )
