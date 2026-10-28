import io
import os
import logging
import warnings
from PIL import Image
from app.core.config import settings

logger = logging.getLogger(__name__)

BUCKET_NAME = "growth-updates"

_minio_client = None

def get_minio_client():
    global _minio_client
    if _minio_client is None:
        try:
            from minio import Minio
            # Prefer real process env vars (docker-compose / Render set these directly)
            # for exact backward compatibility; fall back to Settings (which also picks
            # up backend/.env) instead of a hardcoded literal for plain local runs.
            endpoint = os.environ.get("MINIO_ENDPOINT") or settings.MINIO_ENDPOINT
            access_key = os.environ.get("MINIO_ACCESS_KEY") or settings.MINIO_ACCESS_KEY
            secret_key = os.environ.get("MINIO_SECRET_KEY") or settings.MINIO_SECRET_KEY
            if not endpoint or not access_key or not secret_key:
                raise RuntimeError("MINIO_ENDPOINT, MINIO_ACCESS_KEY, and MINIO_SECRET_KEY are required")
            secure_raw = os.environ.get("MINIO_SECURE")
            secure = (secure_raw.lower() == "true") if secure_raw is not None else settings.MINIO_SECURE
            _minio_client = Minio(
                endpoint,
                access_key=access_key,
                secret_key=secret_key,
                secure=secure
            )
        except Exception as e:
            logger.warning(f"MinIO client init warning: {e}")
            _minio_client = None
    return _minio_client

def ensure_bucket(client):
    try:
        if client and not client.bucket_exists(BUCKET_NAME):
            client.make_bucket(BUCKET_NAME)
        return True
    except Exception as e:
        logger.warning(f"MinIO bucket check failed: {e}")
        return False

def get_presigned_media_url(object_name: str, expires_seconds: int = 3600) -> str:
    """Create a temporary private-object URL signed for the browser-facing host."""
    from datetime import timedelta
    from minio import Minio
    endpoint = settings.MINIO_PUBLIC_ENDPOINT or settings.MINIO_ENDPOINT
    if not endpoint or not settings.MINIO_ACCESS_KEY or not settings.MINIO_SECRET_KEY:
        raise RuntimeError("Public MinIO endpoint and credentials are required for media links")
    secure = settings.MINIO_PUBLIC_SECURE
    if secure is None:
        secure = settings.MINIO_SECURE
    public_client = Minio(endpoint, access_key=settings.MINIO_ACCESS_KEY,
                          secret_key=settings.MINIO_SECRET_KEY, secure=secure)
    return public_client.presigned_get_object(BUCKET_NAME, object_name, expires=timedelta(seconds=expires_seconds))

def sanitize_image(image_bytes: bytes) -> bytes:
    """Sanitizes image bytes and converts to clean JPEG without GPS EXIF leak."""
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            image = Image.open(io.BytesIO(image_bytes))
            if image.format not in {"JPEG", "PNG", "WEBP"}:
                raise ValueError("Unsupported image format. Upload a JPEG, PNG, or WebP image.")
            if image.width * image.height > 20_000_000:
                raise ValueError("Image dimensions exceed the 20 megapixel limit")
            image.load()
            image = image.convert("RGB")
        out_buf = io.BytesIO()
        image.save(out_buf, format="JPEG", quality=85)
        return out_buf.getvalue()
    except ValueError:
        raise
    except Exception as e:
        logger.warning(f"Image sanitization rejected input: {e}")
        raise ValueError("The uploaded file is not a valid supported image") from e

def upload_to_minio(object_name: str, image_bytes: bytes, content_type: str = "image/jpeg") -> str:
    """
    Uploads image bytes to MinIO object storage if available,
    Fails closed if durable object storage is unavailable.
    """
    client = get_minio_client()
    try:
        if not ensure_bucket(client):
            raise RuntimeError("Growth image bucket is unavailable")
        client.put_object(
            BUCKET_NAME,
            object_name,
            io.BytesIO(image_bytes),
            length=len(image_bytes),
            content_type=content_type,
        )
        return f"s3://{BUCKET_NAME}/{object_name}"
    except Exception as exc:
        logger.error("MinIO upload failed: %s", exc)
        raise RuntimeError("Growth image storage is unavailable") from exc
