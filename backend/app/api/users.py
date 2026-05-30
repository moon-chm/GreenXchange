from fastapi import APIRouter, Depends
from app.models.users import User
from app.schemas.auth import UserResponse
from app.api.deps import get_current_user

router = APIRouter()

@router.get("/me", response_model=UserResponse)
async def read_users_me(current_user: User = Depends(get_current_user)):
    return current_user
