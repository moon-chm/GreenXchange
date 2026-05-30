from pydantic import BaseModel, UUID4, Field
from datetime import datetime
from typing import Optional

class DriveCreate(BaseModel):
    title: str = Field(..., max_length=100)
    description: str
    lat: float
    lng: float
    radius_meters: float = Field(..., gt=0)
    start_date: datetime
    end_date: datetime

class DriveResponse(BaseModel):
    id: UUID4
    organizer_id: UUID4
    title: str
    description: str
    radius_meters: float
    start_date: datetime
    end_date: datetime
    participant_count: int
    lat: float
    lng: float
    distance_meters: Optional[float] = None
    
    class Config:
        from_attributes = True

class DriveJoinResponse(BaseModel):
    drive_id: UUID4
    participant_count: int
    status: str
