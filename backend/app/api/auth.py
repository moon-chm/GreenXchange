import uuid
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.api.deps import get_db
from app.core.security import verify_password, get_password_hash, create_access_token, create_refresh_token
from app.core.rate_limiter import check_rate_limit, record_failed_attempt, clear_failed_attempts, blocklist_token, is_token_blocklisted
from app.models.users import User
from app.schemas.auth import UserCreate, UserResponse, Token
from app.core.config import settings
from jose import jwt, JWTError

router = APIRouter()

@router.post("/register", response_model=UserResponse)
async def register(user_in: UserCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == user_in.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")
        
    hashed_password = get_password_hash(user_in.password)
    
    user = User(
        email=user_in.email,
        password_hash=hashed_password,
        name=user_in.name,
        location_lat=user_in.location_lat,
        location_lng=user_in.location_lng,
        device_fingerprint=user_in.device_fingerprint,
        is_active=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user
    
@router.post("/login", response_model=Token)
async def login(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
    form_data: OAuth2PasswordRequestForm = Depends()
):
    await check_rate_limit(request)
    
    result = await db.execute(select(User).where(User.email == form_data.username))
    user = result.scalar_one_or_none()
    
    if not user or not verify_password(form_data.password, user.password_hash):
        await record_failed_attempt(request)
        raise HTTPException(status_code=400, detail="Incorrect email or password")
        
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
        
    await clear_failed_attempts(request)
    
    access_token = create_access_token(subject=user.id)
    
    jti = str(uuid.uuid4())
    refresh_token = create_refresh_token(subject=user.id, jti=jti)
    
    # We will use secure=False here to allow testing over HTTP since SSL isn't forced in dev compose
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400
    )
    
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/refresh", response_model=Token)
async def refresh(request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    refresh_token = request.cookies.get("refresh_token")
    if not refresh_token:
        raise HTTPException(status_code=401, detail="Refresh token missing")
        
    try:
        payload = jwt.decode(refresh_token, settings.jwt_public_key, algorithms=[settings.ALGORITHM])
        token_type = payload.get("type")
        if token_type != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
            
        jti = payload.get("jti")
        if await is_token_blocklisted(jti):
            raise HTTPException(status_code=401, detail="Token has been revoked")
            
        user_id = payload.get("sub")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")
        
    # Blocklist old token
    await blocklist_token(jti, settings.REFRESH_TOKEN_EXPIRE_DAYS)
    
    # Generate new tokens
    new_access_token = create_access_token(subject=user_id)
    new_jti = str(uuid.uuid4())
    new_refresh_token = create_refresh_token(subject=user_id, jti=new_jti)
    
    response.set_cookie(
        key="refresh_token",
        value=new_refresh_token,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400
    )
    
    return {"access_token": new_access_token, "token_type": "bearer"}

@router.post("/logout")
async def logout(request: Request, response: Response):
    refresh_token = request.cookies.get("refresh_token")
    if refresh_token:
        try:
            payload = jwt.decode(refresh_token, settings.jwt_public_key, algorithms=[settings.ALGORITHM])
            jti = payload.get("jti")
            if jti:
                await blocklist_token(jti, settings.REFRESH_TOKEN_EXPIRE_DAYS)
        except JWTError:
            pass
            
    response.delete_cookie("refresh_token")
    return {"msg": "Successfully logged out"}
