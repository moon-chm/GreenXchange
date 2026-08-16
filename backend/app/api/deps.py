from typing import AsyncGenerator
import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from app.db.session import AsyncSessionLocal
from app.core.config import settings
from app.models.users import User
from app.schemas.auth import TokenPayload
from sqlalchemy import select

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session

def _decode_jwt(token: str) -> dict:
    key = settings.jwt_public_key
    algo = settings.ALGORITHM
    if not key or not key.strip() or algo == "HS256":
        key = settings.SECRET_KEY
        algo = "HS256"
    return jwt.decode(token, key, algorithms=[algo, "RS256", "HS256"])

async def get_current_user(
    db: AsyncSession = Depends(get_db), token: str = Depends(oauth2_scheme)
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = _decode_jwt(token)
        token_type: str = payload.get("type")
        if token_type != "access":
            raise credentials_exception
            
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
        admin_claim: bool = payload.get("admin", False)
        token_data = TokenPayload(sub=user_id, admin=admin_claim)
    except JWTError:
        raise credentials_exception
        
    try:
        user_uuid = uuid.UUID(token_data.sub)
    except ValueError:
        raise credentials_exception
        
    result = await db.execute(select(User).where(User.id == user_uuid))
    user = result.scalar_one_or_none()
    if user is None or not user.is_active:
        raise credentials_exception
    
    # Store token_data directly on user for admin check
    user._token_data = token_data
    return user

async def get_current_admin_user(current_user: User = Depends(get_current_user)) -> User:
    if not hasattr(current_user, '_token_data') or not current_user._token_data.admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="The user doesn't have enough privileges"
        )
    return current_user

async def get_current_user_optional(
    db: AsyncSession = Depends(get_db),
    token: str = Depends(OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False))
) -> User | None:
    if not token:
        return None
    try:
        return await get_current_user(db=db, token=token)
    except Exception:
        return None
