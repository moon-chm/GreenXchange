from fastapi import APIRouter
from fastapi.responses import JSONResponse
from sqlalchemy import text
import redis.asyncio as redis
from app.core.config import settings
from app.db.session import engine
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/")
async def health_check():
    status = {"db": "down", "redis": "down", "storage": "down", "status": "degraded"}
    
    # Check DB
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        status["db"] = "ok"
    except Exception as e:
        logger.error("Health DB check failed: %s", type(e).__name__)
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

    # Growth media is a required feature dependency; no endpoint means not ready.
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
            status["storage"] = "ok"
        except Exception as e:
            logger.warning(f"Health MinIO check failed: {type(e).__name__}")
            status["storage"] = "down"
    else:
        status["storage"] = "not_configured"

    # Set overall status
    if status["db"] == "ok" and status["redis"] == "ok" and status["storage"] == "ok":
        status["status"] = "ok"

    return JSONResponse(status_code=200 if status["status"] == "ok" else 503, content=status)
