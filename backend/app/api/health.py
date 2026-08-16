from fastapi import APIRouter
from sqlalchemy import text
import redis.asyncio as redis
from app.core.config import settings
from app.db.session import engine
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/")
async def health_check():
    status = {"db": "down", "redis": "down", "status": "degraded"}
    
    # Check DB
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        status["db"] = "ok"
    except Exception as e:
        logger.error(f"Health DB check failed: {type(e).__name__}")
        status["db"] = "down"

    # Check Redis
    try:
        if settings.REDIS_URL:
            r = redis.from_url(settings.REDIS_URL, socket_connect_timeout=3)
            ping = await r.ping()
            if ping:
                status["redis"] = "ok"
            await r.aclose()
        else:
            status["redis"] = "not_configured"
    except Exception as e:
        logger.warning(f"Health Redis check failed: {type(e).__name__}")
        status["redis"] = "down"

    # MinIO — only check if endpoint is configured (not on Render free tier)
    if settings.MINIO_ENDPOINT:
        try:
            from minio import Minio
            client = Minio(
                settings.MINIO_ENDPOINT,
                access_key=settings.MINIO_ACCESS_KEY,
                secret_key=settings.MINIO_SECRET_KEY,
                secure=settings.MINIO_SECURE
            )
            client.list_buckets()
            status["minio"] = "ok"
        except Exception as e:
            logger.warning(f"Health MinIO check failed: {type(e).__name__}")
            status["minio"] = "down"
    else:
        status["minio"] = "skipped"

    # Set overall status
    if status["db"] == "ok":
        status["status"] = "ok"

    return status
