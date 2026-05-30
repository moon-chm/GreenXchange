import uuid
from sqlalchemy import Column, String, Integer, DateTime, Enum, Float, text, Index
from sqlalchemy.dialects.postgresql import UUID
from geoalchemy2 import Geometry
from app.models.base import Base
from app.models.enums import UrbanRuralClass, PollutionSeverityClass

class EnvironmentalProfile(Base):
    __tablename__ = "environmental_profiles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    location_tile = Column(String, nullable=False)
    
    location = Column(Geometry(geometry_type='POINT', srid=4326), nullable=False)
    
    aqi = Column(Integer, nullable=True)
    pm25 = Column(Float, nullable=True)
    temperature = Column(Float, nullable=True)
    humidity = Column(Float, nullable=True)
    soil_ph = Column(Float, nullable=True)
    soil_type = Column(String, nullable=True)
    sunlight_hours = Column(Float, nullable=True)
    rainfall = Column(Float, nullable=True)
    
    urban_rural_class = Column(Enum(UrbanRuralClass), nullable=True)
    pollution_severity_class = Column(Enum(PollutionSeverityClass), nullable=True)
    climate_zone = Column(String, nullable=True)
    
    cached_at = Column(DateTime(timezone=True), server_default=text("now()"), nullable=False)
    ttl_seconds = Column(Integer, default=3600, nullable=False)

    __table_args__ = (
        Index("ix_environmental_profiles_location_tile", "location_tile"),
    )
