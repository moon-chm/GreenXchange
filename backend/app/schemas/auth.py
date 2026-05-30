from pydantic import BaseModel, EmailStr
from uuid import UUID

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

class TokenPayload(BaseModel):
    sub: str | None = None
    admin: bool = False

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    location_lat: float | None = None
    location_lng: float | None = None
    device_fingerprint: str | None = None

class UserResponse(BaseModel):
    id: UUID
    email: EmailStr
    name: str
    is_active: bool
    
    class Config:
        from_attributes = True
