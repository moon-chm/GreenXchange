"""Owned photo evidence and atomic, audited review rewards.

Existing credits are retained. Legacy photos are not asserted to be verified evidence.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20261030_plant_evidence"
down_revision = "20261028_integrity"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table("plant_photos",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column("owner_id", sa.UUID(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("image_url", sa.String(), nullable=False, unique=True),
        sa.Column("digest", sa.String(64), nullable=False, unique=True),
        sa.Column("analysis", postgresql.JSONB()),
        sa.Column("consumed", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")))
    op.add_column("growth_updates", sa.Column("photo_id", sa.UUID(), sa.ForeignKey("plant_photos.id")))
    op.create_unique_constraint("uq_growth_photo", "growth_updates", ["photo_id"])
    op.add_column("growth_updates", sa.Column("submission_kind", sa.String(), nullable=False, server_default="growth"))
    op.add_column("reward_transactions", sa.Column("growth_update_id", sa.UUID(), sa.ForeignKey("growth_updates.id")))
    op.create_unique_constraint("uq_reward_growth_update", "reward_transactions", ["growth_update_id"])
    op.create_table("growth_decisions",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column("growth_update_id", sa.UUID(), sa.ForeignKey("growth_updates.id"), nullable=False, unique=True),
        sa.Column("reviewer_id", sa.UUID(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("reason", sa.String(), nullable=False),
        sa.Column("approved", sa.Boolean(), nullable=False),
        sa.Column("reward_status", sa.String(), nullable=False),
        sa.Column("points", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")))
    op.execute("CREATE TRIGGER growth_decisions_append_only BEFORE UPDATE OR DELETE ON growth_decisions FOR EACH ROW EXECUTE FUNCTION prevent_modify_append_only()")
    op.execute("""CREATE FUNCTION protect_growth_evidence() RETURNS trigger AS $$
        BEGIN
            IF NEW.photo_id IS DISTINCT FROM OLD.photo_id OR NEW.submission_kind IS DISTINCT FROM OLD.submission_kind THEN
                RAISE EXCEPTION 'Photo evidence and submission kind are immutable';
            END IF;
            RETURN NEW;
        END; $$ LANGUAGE plpgsql""")
    op.execute("CREATE TRIGGER growth_evidence_immutable BEFORE UPDATE ON growth_updates FOR EACH ROW EXECUTE FUNCTION protect_growth_evidence()")


def downgrade():
    raise RuntimeError("Forward-only audit migration; retain reward evidence.")
