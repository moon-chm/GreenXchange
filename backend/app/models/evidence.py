import uuid
from sqlalchemy import Column, String, DateTime, ForeignKey, Boolean, Integer, text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.models.base import Base


class PlantPhoto(Base):
    __tablename__ = "plant_photos"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    image_url = Column(String, nullable=False, unique=True)
    digest = Column(String(64), nullable=False, unique=True)
    analysis = Column(JSONB, nullable=True)
    consumed = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), server_default=text("now()"), nullable=False)


class GrowthDecision(Base):
    __tablename__ = "growth_decisions"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    growth_update_id = Column(UUID(as_uuid=True), ForeignKey("growth_updates.id"), unique=True, nullable=False)
    reviewer_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    reason = Column(String, nullable=False)
    approved = Column(Boolean, nullable=False)
    reward_status = Column(String, nullable=False)
    points = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), server_default=text("now()"), nullable=False)
