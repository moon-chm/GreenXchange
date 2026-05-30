from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from app.models.enums import SpaceType

class PlantRegistrationRequest(BaseModel):
    species_id: str
    common_name: Optional[str] = None
    lat: float
    lng: float
    planting_date: datetime
    space_type: SpaceType

class PlantRegistrationResponse(BaseModel):
    id: str
    scan_id: str
    qr_code_base64: str
    common_name: Optional[str] = None

class PlantPublicResponse(BaseModel):
    scan_id: str
    species_name: str
    scientific_name: str
    common_name: Optional[str] = None
    planting_date: datetime
    space_type: SpaceType
    locality_lat: float
    locality_lng: float

class PlantPortfolioResponse(BaseModel):
    id: str
    scan_id: str
    species_name: str
    common_name: Optional[str] = None
    planting_date: datetime
    space_type: SpaceType
