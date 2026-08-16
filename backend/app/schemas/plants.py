from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from app.models.enums import SpaceType

class PlantRegistrationRequest(BaseModel):
    species_id: Optional[str] = None
    common_name: Optional[str] = None
    lat: float
    lng: float
    planting_date: datetime
    space_type: SpaceType
    image_url: Optional[str] = None
    is_public_on_map: bool = True

class PlantRegistrationResponse(BaseModel):
    id: str
    scan_id: str
    qr_code_base64: str
    common_name: Optional[str] = None
    image_url: Optional[str] = None
    is_public_on_map: bool = True

class PlantPublicResponse(BaseModel):
    scan_id: str
    species_name: str
    scientific_name: str
    common_name: Optional[str] = None
    planting_date: datetime
    space_type: SpaceType
    locality_lat: float
    locality_lng: float
    image_url: Optional[str] = None

class PlantPortfolioResponse(BaseModel):
    id: str
    scan_id: str
    species_name: str
    common_name: Optional[str] = None
    planting_date: datetime
    space_type: SpaceType
    lat: float
    lng: float
    status: str = "verified"
    image_url: Optional[str] = None
    is_public_on_map: bool = True

class CommunityMapPlantResponse(BaseModel):
    id: str
    scan_id: str
    common_name: str
    species_name: str
    owner_first_name: str
    owner_id: str
    is_owner: bool = False
    planting_date: datetime
    age_days: int
    age_formatted: str
    space_type: SpaceType
    lat: float
    lng: float
    image_url: Optional[str] = None
    estimated_carbon_kg: float
    status: str = "verified"



class NurseryCareRequest(BaseModel):
    plant_name: str
    language: str = "English"
    age_months: int = 6
    space_type: Optional[str] = "indoor"
    season_or_condition: Optional[str] = "Summer/Monsoon"
    lat: Optional[float] = 0.0
    lng: Optional[float] = 0.0


class WaterAdvice(BaseModel):
    quantity_ml_or_cups: str
    frequency: str
    instructions: str


class SunlightAdvice(BaseModel):
    placement: str
    hours_per_day: str
    tip: str


class FertilizerAdvice(BaseModel):
    type_recommended: str
    frequency: str
    npk_or_organic_tip: str


class NurseryCareResponse(BaseModel):
    plant_name: str
    caretaker_greeting: str
    language: str
    age_months: int
    water_advice: WaterAdvice
    sunlight_advice: SunlightAdvice
    fertilizer_advice: FertilizerAdvice
    pruning_soil_advice: str
    nursery_secret_tip: str



