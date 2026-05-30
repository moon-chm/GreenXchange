import uuid
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, UniqueConstraint, Float, text
from sqlalchemy.dialects.postgresql import UUID
from geoalchemy2 import Geometry
from app.models.base import Base

class CommunityDrive(Base):
    __tablename__ = "community_drives"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organizer_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    title = Column(String, nullable=False)
    description = Column(String, nullable=False)
    
    location_center = Column(Geometry(geometry_type='POINT', srid=4326), nullable=False)
    geofence_polygon = Column(Geometry(geometry_type='POLYGON', srid=4326), nullable=True)
    radius_meters = Column(Float, nullable=False)
    
    start_date = Column(DateTime(timezone=True), nullable=False)
    end_date = Column(DateTime(timezone=True), nullable=False)
    participant_count = Column(Integer, default=0, nullable=False)

class DriveParticipation(Base):
    __tablename__ = "drive_participations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    drive_id = Column(UUID(as_uuid=True), ForeignKey("community_drives.id", ondelete="CASCADE"), nullable=False)
    
    joined_at = Column(DateTime(timezone=True), server_default=text("now()"), nullable=False)

    __table_args__ = (
        UniqueConstraint('user_id', 'drive_id', name='uq_user_drive'),
    )
