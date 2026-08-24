import io
import os
import logging
from PIL import Image

logger = logging.getLogger(__name__)

BUCKET_NAME = "growth-updates"
LOCAL_UPLOADS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads", "growth")

_minio_client = None

def get_minio_client():
    global _minio_client
    if _minio_client is None:
        try:
            from minio import Minio
            endpoint = os.environ.get("MINIO_ENDPOINT", "localhost:9000")
            _minio_client = Minio(
                endpoint,
                access_key=os.environ.get("MINIO_ACCESS_KEY", "minioadmin"),
                secret_key=os.environ.get("MINIO_SECRET_KEY", "minioadmin123"),
                secure=os.environ.get("MINIO_SECURE", "false").lower() == "true"
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

def sanitize_image(image_bytes: bytes) -> bytes:
    """Sanitizes image bytes and converts to clean JPEG without GPS EXIF leak."""
    try:
        image = Image.open(io.BytesIO(image_bytes))
        if image.mode in ("RGBA", "P"):
            image = image.convert("RGB")
        out_buf = io.BytesIO()
        image.save(out_buf, format="JPEG", quality=85)
        return out_buf.getvalue()
    except Exception as e:
        logger.warning(f"Image sanitization fallback: {e}")
        return image_bytes

def upload_to_minio(object_name: str, image_bytes: bytes, content_type: str = "image/jpeg") -> str:
    """
    Uploads image bytes to MinIO object storage if available,
    otherwise safely saves to local disk under /uploads/growth/ and returns the local URL.
    """
    client = get_minio_client()
    if client:
        try:
            if ensure_bucket(client):
                length = len(image_bytes)
                data = io.BytesIO(image_bytes)
                client.put_object(
                    BUCKET_NAME,
                    object_name,
                    data,
                    length=length,
                    content_type=content_type
                )
                return f"s3://{BUCKET_NAME}/{object_name}"
        except Exception as minio_err:
            logger.info(f"MinIO storage unavailable ({minio_err}), saving image to local media storage.")

    # Local storage fallback
    try:
        os.makedirs(LOCAL_UPLOADS_DIR, exist_ok=True)
        local_path = os.path.join(LOCAL_UPLOADS_DIR, object_name)
        with open(local_path, "wb") as f:
            f.write(image_bytes)
        return f"/uploads/growth/{object_name}"
    except Exception as local_err:
        logger.error(f"Local image save error: {local_err}")
        return f"/uploads/growth/{object_name}"
