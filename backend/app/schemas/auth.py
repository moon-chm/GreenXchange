from pydantic import BaseModel, EmailStr, model_validator, Field, field_validator
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
    password: str = Field(..., min_length=8, max_length=72)
    name: str = Field(..., min_length=1, max_length=120)
    location_lat: float | None = Field(None, ge=-90, le=90)
    location_lng: float | None = Field(None, ge=-180, le=180)
    device_fingerprint: str | None = None

    @field_validator("password")
    @classmethod
    def validate_password_bytes(cls, value: str) -> str:
        if len(value.encode("utf-8")) > 72:
            raise ValueError("password must be at most 72 UTF-8 bytes")
        return value

class UserResponse(BaseModel):
    id: UUID
    email: EmailStr
    name: str
    is_active: bool
    role: str = "USER"
    is_org: bool = False
    email_verified: bool = False
    location_lat: float | None = None
    location_lng: float | None = None

    class Config:
        from_attributes = True

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(..., min_length=8, max_length=72)

    @field_validator("new_password")
    @classmethod
    def validate_password_bytes(cls, value: str) -> str:
        if len(value.encode("utf-8")) > 72:
            raise ValueError("new_password must be at most 72 UTF-8 bytes")
        return value

class MessageResponse(BaseModel):
    message: str
    success: bool = True
