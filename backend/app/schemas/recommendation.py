from pydantic import BaseModel, Field
from typing import List, Optional
from app.models.enums import SpaceType, MaintenanceLevel

class RecommendationRequest(BaseModel):
    lat: float = Field(..., ge=-90, le=90, allow_inf_nan=False)
    lng: float = Field(..., ge=-180, le=180, allow_inf_nan=False)
    space_type: SpaceType = SpaceType.OUTDOOR_GARDEN
    available_space: float = Field(10.0, gt=0, allow_inf_nan=False, description="Available space in square meters")
    indoor: bool = False
    experience_level: MaintenanceLevel = MaintenanceLevel.MEDIUM
    allergies: List[str] = Field(default_factory=list)
    low_maintenance: bool = False
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
    environment_note: str = ""


class PlantAnalysisRequest(BaseModel):
    low_maintenance: bool = False
    plant_name: str = Field(..., min_length=1, max_length=100, pattern=r".*\S.*")
    lat: float = Field(..., ge=-90, le=90, allow_inf_nan=False)
    lng: float = Field(..., ge=-180, le=180, allow_inf_nan=False)
    space_type: SpaceType = SpaceType.OUTDOOR_GARDEN
    experience_level: MaintenanceLevel = MaintenanceLevel.MEDIUM
    has_pets: bool = False
    has_children: bool = False


class XAIContribution(BaseModel):
    feature: str
    weight_pct: int
    score: float
    impact: str  # positive, neutral, negative
    reason: str


class PlantAnalysisResponse(BaseModel):
    plant_name: str
    scientific_name: str
    overall_score: float
    suitability_grade: str  # e.g., "A+", "A", "B", "C"
    xai_breakdown: List[XAIContribution]
    genai_synthesis: str
    microclimate_fit: str
    carbon_offset_kg_year: Optional[float] = None
    care_guide: str
    recommended_space: str
    analysis_source: str = "catalog_rules"
    environment_note: str = ""
    safety_note: str = ""

