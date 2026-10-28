"""Complete ORM schema gaps and safely audit growth verification changes.

Revision ID: 20261028_integrity
Revises: fix_is_active_default_false, 6f001aedd7d4
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "20261028_integrity"
down_revision: Union[str, Sequence[str], None] = ("fix_is_active_default_false", "6f001aedd7d4")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _add_column_if_missing(table: str, column: sa.Column) -> None:
    columns = {item["name"] for item in sa.inspect(op.get_bind()).get_columns(table)}
    if column.name not in columns:
        op.add_column(table, column)


def _create_table_if_missing(name: str, *items) -> None:
    if not sa.inspect(op.get_bind()).has_table(name):
        op.create_table(name, *items)


def upgrade() -> None:
    # Legacy schemas may be stamped past the initial extension migration.
    op.execute('CREATE EXTENSION IF NOT EXISTS "pgcrypto"')

    # Older startup create_all deployments may already have some/all of these.
    _add_column_if_missing("users", sa.Column("role", sa.String(50), server_default="USER", nullable=False))
    _add_column_if_missing("users", sa.Column("is_org", sa.Boolean(), server_default=sa.false(), nullable=False))
    _add_column_if_missing("users", sa.Column("email_verified", sa.Boolean(), server_default=sa.false(), nullable=False))
    _add_column_if_missing("users", sa.Column("email_verification_token", sa.String(), nullable=True))
    _add_column_if_missing("users", sa.Column("email_verification_expires_at", sa.DateTime(timezone=True), nullable=True))
    _add_column_if_missing("users", sa.Column("password_reset_token", sa.String(), nullable=True))
    _add_column_if_missing("users", sa.Column("password_reset_expires_at", sa.DateTime(timezone=True), nullable=True))
    _add_column_if_missing("users", sa.Column("token_version", sa.Integer(), server_default="0", nullable=False))
    indexes = {item["name"] for item in sa.inspect(op.get_bind()).get_indexes("users")}
    if "ix_users_email_verification_token" not in indexes:
        op.create_index("ix_users_email_verification_token", "users", ["email_verification_token"])
    if "ix_users_password_reset_token" not in indexes:
        op.create_index("ix_users_password_reset_token", "users", ["password_reset_token"])
    op.execute("UPDATE users SET is_active = FALSE WHERE is_active IS NULL")
    op.alter_column("users", "is_active", nullable=False, server_default=sa.false(), existing_type=sa.Boolean())
    # Preserve outstanding links created by older releases while hashing tokens at rest.
    op.execute("UPDATE users SET email_verification_token = encode(digest(email_verification_token, 'sha256'), 'hex') WHERE email_verification_token IS NOT NULL AND length(email_verification_token) <> 64")
    op.execute("UPDATE users SET password_reset_token = encode(digest(password_reset_token, 'sha256'), 'hex') WHERE password_reset_token IS NOT NULL AND length(password_reset_token) <> 64")

    # Preserve existing public visibility; new plant records default private.
    _add_column_if_missing("plants", sa.Column("is_public_on_map", sa.Boolean(), server_default=sa.true(), nullable=False))
    _add_column_if_missing("plants", sa.Column("image_url", sa.String(), nullable=True))
    op.execute("UPDATE plants SET is_public_on_map = TRUE WHERE is_public_on_map IS NULL")
    op.alter_column("plants", "is_public_on_map", existing_type=sa.Boolean(), nullable=False, server_default=sa.false())
    _add_column_if_missing("plants", sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True))

    # These ORM tables previously appeared only through create_all, not Alembic.
    _create_table_if_missing("marketplace_items",
        sa.Column("id", sa.UUID(), nullable=False), sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.String(), nullable=True), sa.Column("points_cost", sa.Integer(), nullable=False),
        sa.Column("category", sa.String(100), server_default="Eco Voucher", nullable=False),
        sa.Column("image_url", sa.String(), nullable=True), sa.Column("stock", sa.Integer(), server_default="100", nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"))
    _create_table_if_missing("redemption_transactions",
        sa.Column("id", sa.UUID(), nullable=False), sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("item_id", sa.UUID(), nullable=False), sa.Column("points_spent", sa.Integer(), nullable=False),
        sa.Column("voucher_code", sa.String(64), nullable=False), sa.Column("status", sa.String(50), server_default="CLAIMED", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["item_id"], ["marketplace_items.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"), sa.UniqueConstraint("voucher_code"))
    _create_table_if_missing("payout_requests",
        sa.Column("id", sa.UUID(), nullable=False), sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("amount_gxc", sa.Integer(), nullable=False), sa.Column("wallet_address", sa.String(255), nullable=False),
        sa.Column("tx_hash", sa.String(255), nullable=True), sa.Column("status", sa.String(50), server_default="PENDING", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("processed_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"), sa.PrimaryKeyConstraint("id"))
    _create_table_if_missing("org_payment_requests",
        sa.Column("id", sa.UUID(), nullable=False), sa.Column("org_id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False), sa.Column("amount_gxc", sa.Integer(), nullable=False),
        sa.Column("service_description", sa.String(255), nullable=False), sa.Column("status", sa.String(50), server_default="PENDING", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("processed_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["org_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"), sa.PrimaryKeyConstraint("id"))

    _create_table_if_missing("growth_verification_events",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("growth_update_id", sa.UUID(), nullable=False), sa.Column("from_status", sa.String(32), nullable=False),
        sa.Column("to_status", sa.String(32), nullable=False), sa.Column("confidence_score", sa.Float(), nullable=True),
        sa.Column("model_version", sa.String(), nullable=True), sa.Column("stage_label", sa.String(), nullable=True),
        sa.Column("reason", sa.String(), nullable=True),
        sa.Column("recorded_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["growth_update_id"], ["growth_updates.id"], ondelete="RESTRICT"), sa.PrimaryKeyConstraint("id"))
    indexes = {item["name"] for item in sa.inspect(op.get_bind()).get_indexes("growth_verification_events")}
    if "ix_growth_verification_events_update_time" not in indexes:
        op.create_index("ix_growth_verification_events_update_time", "growth_verification_events", ["growth_update_id", "recorded_at"])

    op.execute("""
        CREATE OR REPLACE FUNCTION protect_growth_update()
        RETURNS trigger AS $$
        BEGIN
            IF TG_OP = 'DELETE' THEN
                RAISE EXCEPTION 'Growth submissions are retained; archive the plant instead.';
            END IF;
            IF NEW.id IS DISTINCT FROM OLD.id OR NEW.plant_id IS DISTINCT FROM OLD.plant_id
               OR NEW.image_url IS DISTINCT FROM OLD.image_url
               OR NEW.submitted_gps IS DISTINCT FROM OLD.submitted_gps
               OR NEW.exif_gps IS DISTINCT FROM OLD.exif_gps
               OR NEW.server_timestamp IS DISTINCT FROM OLD.server_timestamp THEN
                RAISE EXCEPTION 'Growth submission fields are immutable.';
            END IF;
            IF NEW.verification_status IS DISTINCT FROM OLD.verification_status THEN
                IF OLD.verification_status::text NOT IN ('PENDING', 'MANUAL_REVIEW')
                   OR NEW.verification_status::text NOT IN ('VERIFIED', 'REJECTED', 'MANUAL_REVIEW') THEN
                    RAISE EXCEPTION 'Invalid growth verification status transition.';
                END IF;
                INSERT INTO growth_verification_events
                    (growth_update_id, from_status, to_status, confidence_score, model_version, stage_label, reason)
                VALUES (NEW.id, OLD.verification_status::text, NEW.verification_status::text,
                    NEW.confidence_score, NEW.cv_model_version, NEW.growth_stage_label, NEW.rejection_reason);
            ELSIF NEW.confidence_score IS DISTINCT FROM OLD.confidence_score
               OR NEW.cv_model_version IS DISTINCT FROM OLD.cv_model_version
               OR NEW.growth_stage_label IS DISTINCT FROM OLD.growth_stage_label
               OR NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason THEN
                RAISE EXCEPTION 'Verification details may only change with a status transition.';
            END IF;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)
    # Older schemas may have skipped the original migration that defined this function.
    op.execute("""
        CREATE OR REPLACE FUNCTION prevent_modify_append_only()
        RETURNS trigger AS $$
        BEGIN
            RAISE EXCEPTION 'This table is append-only. Updates and Deletes are not allowed.';
        END;
        $$ LANGUAGE plpgsql;
    """)
    op.execute("DROP TRIGGER IF EXISTS growth_updates_append_only ON growth_updates")
    op.execute("CREATE TRIGGER growth_updates_append_only BEFORE UPDATE OR DELETE ON growth_updates FOR EACH ROW EXECUTE FUNCTION protect_growth_update()")
    op.execute("DROP TRIGGER IF EXISTS growth_verification_events_append_only ON growth_verification_events")
    op.execute("CREATE TRIGGER growth_verification_events_append_only BEFORE UPDATE OR DELETE ON growth_verification_events FOR EACH ROW EXECUTE FUNCTION prevent_modify_append_only()")


def downgrade() -> None:
    raise RuntimeError("This data migration is forward-only: it hashes live token values and adds audit history.")
