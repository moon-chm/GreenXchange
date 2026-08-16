import uuid
from sqlalchemy import Column, String, Integer, Boolean, DateTime, ForeignKey, text, CheckConstraint, Index
from sqlalchemy.dialects.postgresql import UUID
from app.models.base import Base

class RewardTransaction(Base):
    __tablename__ = "reward_transactions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    plant_id = Column(UUID(as_uuid=True), ForeignKey("plants.id", ondelete="SET NULL"), nullable=True)
    
    points = Column(Integer, nullable=False)
    trigger_event = Column(String, nullable=False)
    balance_snapshot = Column(Integer, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=text("now()"), nullable=False)

    __table_args__ = (
        CheckConstraint('balance_snapshot >= 0', name='check_balance_snapshot_non_negative'),
        Index("ix_reward_transactions_user_id_created_at", "user_id", "created_at"),
    )
    # Append-only will be enforced via Postgres Trigger


class MarketplaceItem(Base):
    __tablename__ = "marketplace_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String(255), nullable=False)
    description = Column(String, nullable=True)
    points_cost = Column(Integer, nullable=False)
    category = Column(String(100), default="Eco Voucher", nullable=False)
    image_url = Column(String, nullable=True)
    stock = Column(Integer, default=100, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=text("now()"), nullable=False)


class RedemptionTransaction(Base):
    __tablename__ = "redemption_transactions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    item_id = Column(UUID(as_uuid=True), ForeignKey("marketplace_items.id", ondelete="RESTRICT"), nullable=False)
    points_spent = Column(Integer, nullable=False)
    voucher_code = Column(String(64), nullable=False, unique=True)
    status = Column(String(50), default="CLAIMED", nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=text("now()"), nullable=False)


class PayoutRequest(Base):
    __tablename__ = "payout_requests"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    amount_gxc = Column(Integer, nullable=False)
    wallet_address = Column(String(255), nullable=False)
    tx_hash = Column(String(255), nullable=True)
    status = Column(String(50), default="PENDING", nullable=False)  # PENDING, PROCESSED, REJECTED
    created_at = Column(DateTime(timezone=True), server_default=text("now()"), nullable=False)
    processed_at = Column(DateTime(timezone=True), nullable=True)


class OrgPaymentRequest(Base):
    __tablename__ = "org_payment_requests"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    amount_gxc = Column(Integer, nullable=False)
    service_description = Column(String(255), nullable=False)
    status = Column(String(50), default="PENDING", nullable=False)  # PENDING, APPROVED, REJECTED
    created_at = Column(DateTime(timezone=True), server_default=text("now()"), nullable=False)
    processed_at = Column(DateTime(timezone=True), nullable=True)


