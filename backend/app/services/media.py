import io
import os
from PIL import Image
from minio import Minio

minio_client = Minio(
    os.environ.get("MINIO_ENDPOINT", "minio:9000"),
    access_key=os.environ.get("MINIO_ACCESS_KEY", "minioadmin"),
    secret_key=os.environ.get("MINIO_SECRET_KEY", "minioadmin123"),
    secure=os.environ.get("MINIO_SECURE", "false").lower() == "true"
)

BUCKET_NAME = "growth-updates"

def ensure_bucket():
    if not minio_client.bucket_exists(BUCKET_NAME):
        minio_client.make_bucket(BUCKET_NAME)

def sanitize_image(image_bytes: bytes) -> bytes:
    image = Image.open(io.BytesIO(image_bytes))
    
    if image.mode in ("RGBA", "P"):
        image = image.convert("RGB")
        
    out_buf = io.BytesIO()
    # Save as JPEG strips all EXIF metadata by default unless explicitly passed via exif kwarg
    image.save(out_buf, format="JPEG", quality=85)
    return out_buf.getvalue()

def upload_to_minio(object_name: str, image_bytes: bytes, content_type: str = "image/jpeg") -> str:
    ensure_bucket()
    length = len(image_bytes)
    data = io.BytesIO(image_bytes)
    
    minio_client.put_object(
        BUCKET_NAME,
        object_name,
        data,
        length=length,
        content_type=content_type
    )
    return f"s3://{BUCKET_NAME}/{object_name}"
