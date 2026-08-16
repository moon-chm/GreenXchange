from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional
from app.models.users import User
from app.schemas.auth import UserResponse
from app.api.deps import get_db, get_current_user

router = APIRouter()

class UserUpdate(BaseModel):
    name: Optional[str] = None
    location_lat: Optional[float] = None
    location_lng: Optional[float] = None

@router.get("/me", response_model=UserResponse)
async def read_users_me(current_user: User = Depends(get_current_user)):
    return current_user

@router.put("/me", response_model=UserResponse)
async def update_users_me(
    payload: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if payload.name is not None:
        current_user.name = payload.name.strip()
    if payload.location_lat is not None:
        current_user.location_lat = payload.location_lat
    if payload.location_lng is not None:
        current_user.location_lng = payload.location_lng
    
    db.add(current_user)
    await db.commit()
    await db.refresh(current_user)
    return current_user
