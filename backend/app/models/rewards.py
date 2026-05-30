import uuid
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, text, CheckConstraint, Index
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
