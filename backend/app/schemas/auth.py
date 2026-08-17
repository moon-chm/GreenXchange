from pydantic import BaseModel, EmailStr, model_validator
from uuid import UUID
from typing import Optional

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: Optional["UserResponse"] = None

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
    role: str = "USER"
    is_org: bool = False
    email_verified: bool = False

    class Config:
        from_attributes = True

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

class MessageResponse(BaseModel):
    message: str
    success: bool = True
