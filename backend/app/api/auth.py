import uuid
import secrets
import logging
import hashlib
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, Request, Response, Query, BackgroundTasks, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.api.deps import get_db
from app.core.security import verify_password, get_password_hash, create_access_token, create_refresh_token, decode_token
from app.core.rate_limiter import (
    check_rate_limit, record_failed_attempt, clear_failed_attempts,
    check_endpoint_rate_limit, is_token_blocklisted,
)
from app.models.users import User
from app.schemas.auth import (
    UserCreate, UserResponse, Token, ForgotPasswordRequest, ResetPasswordRequest, MessageResponse
)
from app.core.config import settings
from app.services.email import send_verification_email, send_password_reset_email

logger = logging.getLogger("auth")
router = APIRouter()

def _token_digest(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()

def _get_request_base_url(request: Request) -> str:
    """Use the configured frontend origin; request headers are untrusted."""
    return settings.FRONTEND_URL.rstrip("/")

@router.post("/register", response_model=UserResponse)
async def register(user_in: UserCreate, request: Request, background_tasks: BackgroundTasks, db: AsyncSession = Depends(get_db)):
    # Unthrottled registration lets an attacker email-bomb arbitrary addresses
    # (every call dispatches a real verification email) — cap per-IP attempts.
    await check_endpoint_rate_limit(request, "register", max_requests=5, window_seconds=3600)

    clean_email = user_in.email.strip().lower()
    base_url = _get_request_base_url(request)
    now = datetime.now(timezone.utc)
    
    try:
        result = await db.execute(select(User).where(User.email == clean_email))
        existing_user = result.scalar_one_or_none()
        
        if existing_user:
            if existing_user.email_verified:
                raise HTTPException(status_code=400, detail="Email already registered. Please sign in.")
            raise HTTPException(status_code=409, detail="An account is pending verification. Use the resend verification option.")
            
        hashed_password = get_password_hash(user_in.password)
        verification_token = secrets.token_urlsafe(32)
        
        user = User(
            email=clean_email,
            password_hash=hashed_password,
            name=user_in.name,
            location_lat=user_in.location_lat,
            location_lng=user_in.location_lng,
            device_fingerprint=user_in.device_fingerprint,
            is_active=False, # Active once email verified
            email_verified=False,
            email_verification_token=_token_digest(verification_token),
            email_verification_expires_at=now + timedelta(hours=24)
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error registering user '{clean_email}': {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Registration failed. Please try again.")
    
    # Non-blocking async background email dispatch
    background_tasks.add_task(send_verification_email, user.email, user.name, verification_token, base_url)
    return user

@router.get("/verify-email", response_model=MessageResponse)
async def verify_email(token: str = Query(...), db: AsyncSession = Depends(get_db)):
    now = datetime.now(timezone.utc)
    try:
        result = await db.execute(select(User).where(User.email_verification_token == _token_digest(token)))
        user = result.scalar_one_or_none()
        
        if not user:
            raise HTTPException(status_code=400, detail="Invalid or expired email verification link.")
            
        if not user.email_verification_expires_at or user.email_verification_expires_at < now:
            raise HTTPException(status_code=400, detail="Verification link has expired. Please request a new link.")
            
        user.email_verified = True
        user.is_active = True
        user.email_verification_token = None
        user.email_verification_expires_at = None
        
        await db.commit()
        return MessageResponse(message="Email verified successfully! You may now sign in to GreenXchange.")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error during email verification: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Verification failed. Please request a new link.")

@router.post("/resend-verification", response_model=MessageResponse)
async def resend_verification(payload: ForgotPasswordRequest, request: Request, background_tasks: BackgroundTasks, db: AsyncSession = Depends(get_db)):
    await check_endpoint_rate_limit(request, "resend_verification", max_requests=5, window_seconds=3600)
    clean_email = payload.email.strip().lower()
    try:
        result = await db.execute(select(User).where(User.email == clean_email))
        user = result.scalar_one_or_none()
        
        if not user:
            return MessageResponse(message="If your account exists, a new verification link has been sent.")
            
        if user.email_verified:
            return MessageResponse(message="Account is already verified. Please sign in.")
            
        token = secrets.token_urlsafe(32)
        user.email_verification_token = _token_digest(token)
        user.email_verification_expires_at = datetime.now(timezone.utc) + timedelta(hours=24)
        await db.commit()
        
        base_url = _get_request_base_url(request)
        background_tasks.add_task(send_verification_email, user.email, user.name, token, base_url)
        return MessageResponse(message="A new verification link has been sent to your email address.")
    except Exception as e:
        logger.error(f"Resend verification error: {e}")
        return MessageResponse(message="If your account exists, a new verification link has been sent.")

@router.post("/forgot-password", response_model=MessageResponse)
async def forgot_password(payload: ForgotPasswordRequest, request: Request, background_tasks: BackgroundTasks, db: AsyncSession = Depends(get_db)):
    await check_endpoint_rate_limit(request, "forgot_password", max_requests=5, window_seconds=3600)
    clean_email = payload.email.strip().lower()
    try:
        result = await db.execute(select(User).where(User.email == clean_email))
        user = result.scalar_one_or_none()
        
        if not user:
            return MessageResponse(message="If your email is registered, password reset instructions have been sent.")
            
        reset_token = secrets.token_urlsafe(32)
        user.password_reset_token = _token_digest(reset_token)
        user.password_reset_expires_at = datetime.now(timezone.utc) + timedelta(hours=1)
        await db.commit()
        
        base_url = _get_request_base_url(request)
        background_tasks.add_task(send_password_reset_email, user.email, user.name, reset_token, base_url)
        return MessageResponse(message="Password reset instructions have been sent to your email address.")
    except Exception as e:
        logger.error(f"Forgot password error: {e}")
        return MessageResponse(message="If your email is registered, password reset instructions have been sent.")

@router.post("/reset-password", response_model=MessageResponse)
async def reset_password(payload: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    now = datetime.now(timezone.utc)
    try:
        result = await db.execute(select(User).where(User.password_reset_token == _token_digest(payload.token)))
        user = result.scalar_one_or_none()
        
        if not user or not user.password_reset_expires_at or user.password_reset_expires_at < now:
            raise HTTPException(status_code=400, detail="Invalid or expired password reset link.")
            
        user.password_hash = get_password_hash(payload.new_password)
        user.token_version += 1
        user.password_reset_token = None
        user.password_reset_expires_at = None
        await db.commit()
        
        return MessageResponse(message="Your password has been successfully reset! You can now log in.")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Reset password error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Password reset failed.")

@router.post("/login", response_model=Token)
async def login(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
    form_data: OAuth2PasswordRequestForm = Depends()
):
    await check_rate_limit(request)
    await check_endpoint_rate_limit(request, "login", max_requests=10, window_seconds=900)

    clean_email = form_data.username.strip().lower()
    try:
        result = await db.execute(select(User).where(User.email == clean_email))
        user = result.scalar_one_or_none()
    except Exception as e:
        logger.error(f"DB error during login for '{clean_email}': {e}", exc_info=True)
        raise HTTPException(status_code=503, detail="Login is temporarily unavailable. Please try again.")
    
    if not user or not verify_password(form_data.password, user.password_hash):
        try:
            await record_failed_attempt(request)
        except Exception:
            pass
        raise HTTPException(status_code=400, detail="Incorrect email or password. If you haven't registered yet, please create an account.")
        
    if not user.email_verified:
        raise HTTPException(
            status_code=403,
            detail="email_not_verified"
        )

    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
        
    try:
        await clear_failed_attempts(request)
    except Exception:
        pass
    
    access_token = create_access_token(subject=user.id, token_version=user.token_version)
    
    jti = str(uuid.uuid4())
    refresh_token = create_refresh_token(subject=user.id, jti=jti, token_version=user.token_version)
    
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=True,
        # Frontend and backend live on different onrender.com subdomains, which the
        # public suffix list treats as different sites — SameSite=Lax cookies are
        # never sent on cross-site XHR/fetch, only top-level navigation. "None"
        # (paired with Secure, already set) is required for the browser to send
        # this cookie on cross-origin API calls; localhost dev still works since
        # modern browsers treat http://localhost as a secure context.
        samesite="none",
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400
    )
    
    return {"access_token": access_token, "token_type": "bearer", "user": user}

@router.post("/refresh", response_model=Token)
async def refresh(request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    refresh_token = request.cookies.get("refresh_token")
    if not refresh_token:
        raise HTTPException(status_code=401, detail="Refresh token missing")
        
    try:
        payload = decode_token(refresh_token)
        token_type = payload.get("type")
        if token_type != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")

        jti = payload.get("jti")
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="User ID missing in token")

        user_uuid = uuid.UUID(user_id)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    if jti and await is_token_blocklisted(jti):
        raise HTTPException(status_code=401, detail="Refresh token has been revoked")
        
    result = await db.execute(select(User).where(User.id == user_uuid))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User inactive or not found")
    if payload.get("ver", 0) != user.token_version:
        raise HTTPException(status_code=401, detail="Refresh token has been revoked")
        
    access_token = create_access_token(subject=user.id, token_version=user.token_version)
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/logout", response_model=MessageResponse)
async def logout(request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    # Blocklist the refresh token's jti so it can't be used again even if it
    # was captured before logout — clearing the cookie alone only stops this
    # browser from presenting it, it doesn't revoke the token itself.
    refresh_token = request.cookies.get("refresh_token")
    if refresh_token:
        try:
            payload = decode_token(refresh_token)
            if payload.get("type") == "refresh" and payload.get("jti"):
                user_id = uuid.UUID(payload.get("sub", ""))
                result = await db.execute(select(User).where(User.id == user_id).with_for_update())
                user = result.scalar_one_or_none()
                if user:
                    user.token_version += 1
                    await db.commit()
        except Exception as exc:
            await db.rollback()
            logger.error("Could not revoke refresh sessions during logout: %s", type(exc).__name__)
            raise HTTPException(status_code=503, detail="Logout could not revoke the session. Please retry.")

    response.delete_cookie(key="refresh_token", samesite="none", secure=True)
    return MessageResponse(message="Successfully logged out")
