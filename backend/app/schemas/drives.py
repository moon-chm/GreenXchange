from pydantic import BaseModel, UUID4, Field, model_validator
from datetime import datetime
from typing import Optional

class DriveCreate(BaseModel):
    title: str = Field(..., max_length=100)
    description: str
    lat: float = Field(..., ge=-90, le=90)
    lng: float = Field(..., ge=-180, le=180)
    radius_meters: float = Field(..., gt=0, le=100000)
    start_date: datetime
    end_date: datetime

    @model_validator(mode="after")
    def validate_dates(self):
        if self.end_date <= self.start_date:
            raise ValueError("end_date must be after start_date")
        return self

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
