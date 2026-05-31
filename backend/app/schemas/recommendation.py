from pydantic import BaseModel, Field
from typing import List, Optional
from app.models.enums import SpaceType, MaintenanceLevel

class RecommendationRequest(BaseModel):
    lat: float = 0.0
    lng: float = 0.0
    space_type: SpaceType = SpaceType.OUTDOOR_GARDEN
    available_space: float = Field(10.0, description="Available space in square meters")
    indoor: bool = False
    experience_level: MaintenanceLevel = MaintenanceLevel.MEDIUM
    allergies: List[str] = []
    has_pets: bool = False
    has_children: bool = False

class SpeciesCard(BaseModel):
    species_id: str
    common_name: str
    scientific_name: str
    pollution_absorption_score: float
    maintenance_level: str
    explanation: str
    care_guidance: str
    score: float
