import uuid
from sqlalchemy import Column, String, DateTime, ForeignKey, Enum, Float, Boolean, text
from sqlalchemy.dialects.postgresql import UUID, ARRAY, JSONB
from geoalchemy2 import Geometry
from app.models.base import Base
from app.models.enums import ToxicityLevel, AllergenRisk, MaintenanceLevel, GrowthRate, SpaceType

class PlantSpecies(Base):
    __tablename__ = "plant_species"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    common_name = Column(String, nullable=False)
    scientific_name = Column(String, unique=True, nullable=False)
    genus = Column(String, nullable=False)
    family = Column(String, nullable=False)
    
    # all absorption rates (e.g. CO2, PM2.5, VOC) - we can use JSONB or specific columns. Let's use JSONB for flexibility or floats.
    co2_absorption_rate = Column(Float, nullable=True)
    pm25_absorption_rate = Column(Float, nullable=True)
    voc_absorption_rate = Column(Float, nullable=True)
    
    toxicity_level = Column(Enum(ToxicityLevel), nullable=False)
    allergen_risk = Column(Enum(AllergenRisk), nullable=False)
    maintenance_level = Column(Enum(MaintenanceLevel), nullable=False)
    growth_rate = Column(Enum(GrowthRate), nullable=False)
    
    space_type_compatibility = Column(ARRAY(Enum(SpaceType)), nullable=False)
    temperature_range = Column(String, nullable=True) # e.g. "15-25C"
    soil_ph_range = Column(String, nullable=True)     # e.g. "6.0-7.5"
    
    seasonal_allergen_modifier = Column(JSONB, nullable=True)
    data_source = Column(String, nullable=True)

class Plant(Base):
    __tablename__ = "plants"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    species_id = Column(UUID(as_uuid=True), ForeignKey("plant_species.id", ondelete="RESTRICT"), nullable=False)
    
    scan_id = Column(String(20), unique=True, nullable=False) # unique base62
    common_name = Column(String, nullable=True)
    
    registered_location = Column(Geometry(geometry_type='POINT', srid=4326), nullable=False)
    anchor_location = Column(Geometry(geometry_type='POINT', srid=4326), nullable=False)
    
    planting_date = Column(DateTime(timezone=True), nullable=False)
    space_type = Column(Enum(SpaceType), nullable=False)
    image_url = Column(String, nullable=True)
    is_public_on_map = Column(Boolean, default=True, nullable=False)
    
    created_at = Column(DateTime(timezone=True), server_default=text("now()"), nullable=False)



    from sqlalchemy.orm import relationship, foreign
    owner = relationship("User")
    species = relationship("PlantSpecies")
    growth_updates = relationship("GrowthUpdate", primaryjoin="Plant.id == foreign(GrowthUpdate.plant_id)", order_by="GrowthUpdate.server_timestamp.desc()")


