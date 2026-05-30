import uuid
from sqlalchemy import Column, String, DateTime, ForeignKey, Enum, Float, text, Index
from sqlalchemy.dialects.postgresql import UUID
from geoalchemy2 import Geometry
from app.models.base import Base
from app.models.enums import VerificationStatus

class GrowthUpdate(Base):
    __tablename__ = "growth_updates"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    plant_id = Column(UUID(as_uuid=True), ForeignKey("plants.id", ondelete="CASCADE"), nullable=False)
    image_url = Column(String, nullable=False)
    
    submitted_gps = Column(Geometry(geometry_type='POINT', srid=4326), nullable=False)
    exif_gps = Column(Geometry(geometry_type='POINT', srid=4326), nullable=True)
    
    server_timestamp = Column(DateTime(timezone=True), server_default=text("now()"), nullable=False)
    
    verification_status = Column(Enum(VerificationStatus), nullable=False, default=VerificationStatus.PENDING)
    confidence_score = Column(Float, nullable=True)
    cv_model_version = Column(String, nullable=True)
    growth_stage_label = Column(String, nullable=True)
    rejection_reason = Column(String, nullable=True)

    __table_args__ = (
        Index("ix_growth_updates_plant_id_timestamp", "plant_id", "server_timestamp"),
    )
    # The requirement says "append-only enforced via CHECK constraint".
    # PostgreSQL CHECK constraints don't support preventing updates/deletes natively without triggers or rules,
    # except via complicated hacks. We will use a database trigger in Alembic.
