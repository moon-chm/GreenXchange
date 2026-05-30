from fastapi import APIRouter
from sqlalchemy import text
from minio import Minio
import redis.asyncio as redis
from app.core.config import settings
from app.db.session import engine

router = APIRouter()

@router.get("/")
async def health_check():
    status = {"db": "down", "redis": "down", "minio": "down"}
    
    # Check DB
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        status["db"] = "ok"
    except Exception as e:
        print(f"DB Error: {e}")
        status["db"] = str(e)
        
    # Check Redis
    try:
        r = redis.from_url(settings.REDIS_URL)
        ping = await r.ping()
        if ping:
            status["redis"] = "ok"
        await r.aclose()
    except Exception as e:
        print(f"Redis Error: {e}")
        status["redis"] = str(e)
        
    # Check MinIO
    try:
        client = Minio(
            settings.MINIO_ENDPOINT,
            access_key=settings.MINIO_ACCESS_KEY,
            secret_key=settings.MINIO_SECRET_KEY,
            secure=settings.MINIO_SECURE
        )
        # Just listing buckets confirms connectivity
        client.list_buckets()
        status["minio"] = "ok"
    except Exception as e:
        print(f"MinIO Error: {e}")
        status["minio"] = str(e)
        
    return status
