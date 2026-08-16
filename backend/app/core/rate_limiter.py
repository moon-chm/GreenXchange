import logging
import redis.asyncio as redis
from fastapi import HTTPException, Request, status
from app.core.config import settings

logger = logging.getLogger(__name__)

redis_client = None
try:
    if settings.REDIS_URL:
        redis_client = redis.from_url(
            settings.REDIS_URL,
            decode_responses=True,
            socket_connect_timeout=3,
            socket_timeout=3
        )
except Exception as e:
    logger.warning(f"Redis initialization warning: {e}")

MAX_FAILED_ATTEMPTS = 5
BLOCK_TIME_SECONDS = 30 * 60
TRACK_TIME_SECONDS = 10 * 60

def _get_client_ip(request: Request) -> str:
    if request.headers.get("x-forwarded-for"):
        return request.headers.get("x-forwarded-for").split(",")[0].strip()
    if request.client:
        return request.client.host
    return "127.0.0.1"

async def check_rate_limit(request: Request):
    if not redis_client:
        return
    try:
        ip = _get_client_ip(request)
        block_key = f"block:{ip}"
        
        if await redis_client.get(block_key):
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many failed login attempts. Please try again later."
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.warning(f"Rate limiter check error: {e}")

async def record_failed_attempt(request: Request):
    if not redis_client:
        return
    try:
        ip = _get_client_ip(request)
        attempt_key = f"attempts:{ip}"
        
        attempts = await redis_client.incr(attempt_key)
        if attempts == 1:
            await redis_client.expire(attempt_key, TRACK_TIME_SECONDS)
            
        if attempts >= MAX_FAILED_ATTEMPTS:
            block_key = f"block:{ip}"
            await redis_client.setex(block_key, BLOCK_TIME_SECONDS, "1")
    except Exception as e:
        logger.warning(f"Rate limiter record attempt error: {e}")

async def clear_failed_attempts(request: Request):
    if not redis_client:
        return
    try:
        ip = _get_client_ip(request)
        attempt_key = f"attempts:{ip}"
        await redis_client.delete(attempt_key)
    except Exception as e:
        logger.warning(f"Rate limiter clear error: {e}")

async def blocklist_token(jti: str, expires_in_days: int):
    if not redis_client:
        return
    try:
        await redis_client.setex(f"blocklist:{jti}", expires_in_days * 86400, "1")
    except Exception as e:
        logger.warning(f"Blocklist token error: {e}")

async def is_token_blocklisted(jti: str) -> bool:
    if not redis_client:
        return False
    try:
        return await redis_client.get(f"blocklist:{jti}") is not None
    except Exception as e:
        logger.warning(f"Is token blocklisted error: {e}")
        return False

async def check_endpoint_rate_limit(request: Request, key_prefix: str, max_requests: int, window_seconds: int):
    if not redis_client:
        return
    try:
        ip = _get_client_ip(request)
        user_id = request.state.user.id if hasattr(request.state, "user") and request.state.user else "anon"
        rate_key = f"rate:{key_prefix}:{ip}:{user_id}"
        
        current = await redis_client.incr(rate_key)
        if current == 1:
            await redis_client.expire(rate_key, window_seconds)
            
        if current > max_requests:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Rate limit exceeded"
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.warning(f"Endpoint rate limit error: {e}")
