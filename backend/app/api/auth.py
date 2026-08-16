import uuid
import secrets
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, Request, Response, Query
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.api.deps import get_db
from app.core.security import verify_password, get_password_hash, create_access_token, create_refresh_token
from app.core.rate_limiter import check_rate_limit, record_failed_attempt, clear_failed_attempts, blocklist_token, is_token_blocklisted
from app.models.users import User
from app.schemas.auth import (
    UserCreate, UserResponse, Token, ForgotPasswordRequest, ResetPasswordRequest, MessageResponse
)
from app.core.config import settings
from app.services.email import send_verification_email, send_password_reset_email
from jose import jwt, JWTError

router = APIRouter()

def _get_request_base_url(request: Request) -> str:
    """Detects if request originated from mobile IP, localhost, or production domain."""
    origin = request.headers.get("origin")
    if origin:
        return origin.rstrip("/")
    referer = request.headers.get("referer")
    if referer:
        from urllib.parse import urlparse
        p = urlparse(referer)
        return f"{p.scheme}://{p.netloc}".rstrip("/")
    host = request.headers.get("host")
    if host:
        proto = request.headers.get("x-forwarded-proto", "http")
        return f"{proto}://{host}".rstrip("/")
    return settings.FRONTEND_URL.rstrip("/")

@router.post("/register", response_model=UserResponse)
async def register(user_in: UserCreate, request: Request, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == user_in.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")
        
    hashed_password = get_password_hash(user_in.password)
    verification_token = secrets.token_urlsafe(32)
    now = datetime.now(timezone.utc)
    base_url = _get_request_base_url(request)
    
    user = User(
        email=user_in.email,
        password_hash=hashed_password,
        name=user_in.name,
        location_lat=user_in.location_lat,
        location_lng=user_in.location_lng,
        device_fingerprint=user_in.device_fingerprint,
        is_active=False, # Active once email verified
        email_verified=False,
        email_verification_token=verification_token,
        email_verification_expires_at=now + timedelta(hours=24)
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    
    # Dispatch verification email (async / celery fallback)
    try:
        from app.worker.email_tasks import task_send_verification_email
        task_send_verification_email.delay(user.email, user.name, verification_token, base_url)
    except Exception:
        await send_verification_email(user.email, user.name, verification_token, base_url)
        
    return user

@router.get("/verify-email", response_model=MessageResponse)
async def verify_email(token: str = Query(...), db: AsyncSession = Depends(get_db)):
    now = datetime.now(timezone.utc)
    result = await db.execute(select(User).where(User.email_verification_token == token))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired email verification link.")
        
    if user.email_verification_expires_at and user.email_verification_expires_at < now:
        raise HTTPException(status_code=400, detail="Verification link has expired. Please request a new link.")
        
    user.email_verified = True
    user.is_active = True
    user.email_verification_token = None
    user.email_verification_expires_at = None
    
    await db.commit()
    return MessageResponse(message="Email verified successfully! You may now sign in to GreenXchange.")

@router.post("/resend-verification", response_model=MessageResponse)
async def resend_verification(payload: ForgotPasswordRequest, request: Request, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == payload.email))
    user = result.scalar_one_or_none()
    
    if not user:
        # Prevent account enumeration
        return MessageResponse(message="If your account exists, a new verification link has been sent.")
        
    if user.email_verified:
        return MessageResponse(message="Account is already verified. Please sign in.")
        
    token = secrets.token_urlsafe(32)
    user.email_verification_token = token
    user.email_verification_expires_at = datetime.now(timezone.utc) + timedelta(hours=24)
    await db.commit()
    
    base_url = _get_request_base_url(request)
    try:
        from app.worker.email_tasks import task_send_verification_email
        task_send_verification_email.delay(user.email, user.name, token, base_url)
    except Exception:
        await send_verification_email(user.email, user.name, token, base_url)
        
    return MessageResponse(message="A new verification link has been sent to your email address.")

@router.post("/forgot-password", response_model=MessageResponse)
async def forgot_password(payload: ForgotPasswordRequest, request: Request, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == payload.email))
    user = result.scalar_one_or_none()
    
    if not user:
        # Don't leak registered emails
        return MessageResponse(message="If your email is registered, password reset instructions have been sent.")
        
    reset_token = secrets.token_urlsafe(32)
    user.password_reset_token = reset_token
    user.password_reset_expires_at = datetime.now(timezone.utc) + timedelta(hours=1)
    await db.commit()
    
    base_url = _get_request_base_url(request)
    try:
        from app.worker.email_tasks import task_send_password_reset_email
        task_send_password_reset_email.delay(user.email, user.name, reset_token, base_url)
    except Exception:
        await send_password_reset_email(user.email, user.name, reset_token, base_url)
        
    return MessageResponse(message="Password reset instructions have been sent to your email address.")

@router.post("/reset-password", response_model=MessageResponse)
async def reset_password(payload: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    now = datetime.now(timezone.utc)
    result = await db.execute(select(User).where(User.password_reset_token == payload.token))
    user = result.scalar_one_or_none()
    
    if not user or (user.password_reset_expires_at and user.password_reset_expires_at < now):
        raise HTTPException(status_code=400, detail="Invalid or expired password reset link.")
        
    user.password_hash = get_password_hash(payload.new_password)
    user.password_reset_token = None
    user.password_reset_expires_at = None
    await db.commit()
    
    return MessageResponse(message="Your password has been successfully reset! You can now log in.")

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
        
    if not user.email_verified:
        raise HTTPException(
            status_code=403,
            detail="email_not_verified"
        )

    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
        
    await clear_failed_attempts(request)
    
    access_token = create_access_token(subject=user.id)
    
    jti = str(uuid.uuid4())
    refresh_token = create_refresh_token(subject=user.id, jti=jti)
    
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

