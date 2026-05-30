import redis.asyncio as redis
from fastapi import HTTPException, Request, status
from app.core.config import settings

redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True)

MAX_FAILED_ATTEMPTS = 5
BLOCK_TIME_SECONDS = 30 * 60
TRACK_TIME_SECONDS = 10 * 60

async def check_rate_limit(request: Request):
    ip = request.client.host
    block_key = f"block:{ip}"
    
    if await redis_client.get(block_key):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many failed login attempts. Please try again later."
        )

async def record_failed_attempt(request: Request):
    ip = request.client.host
    attempt_key = f"attempts:{ip}"
    
    attempts = await redis_client.incr(attempt_key)
    if attempts == 1:
        await redis_client.expire(attempt_key, TRACK_TIME_SECONDS)
        
    if attempts >= MAX_FAILED_ATTEMPTS:
        block_key = f"block:{ip}"
        await redis_client.setex(block_key, BLOCK_TIME_SECONDS, "1")

async def clear_failed_attempts(request: Request):
    ip = request.client.host
    attempt_key = f"attempts:{ip}"
    await redis_client.delete(attempt_key)

async def blocklist_token(jti: str, expires_in_days: int):
    # Store token with TTL matching its expiration
    await redis_client.setex(f"blocklist:{jti}", expires_in_days * 86400, "1")

async def is_token_blocklisted(jti: str) -> bool:
    return await redis_client.get(f"blocklist:{jti}") is not None

async def check_endpoint_rate_limit(request: Request, key_prefix: str, max_requests: int, window_seconds: int):
    ip = request.client.host
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
