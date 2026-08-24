import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, Form, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func

from app.api.deps import get_current_user, get_db
from app.models.users import User
from app.models.plants import Plant
from app.models.growth import GrowthUpdate
from app.models.enums import VerificationStatus
from app.utils.geo import haversine_distance, extract_exif_gps
from app.services.media import sanitize_image, upload_to_minio
from app.worker.tasks import verify_growth_update
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

@router.post("/{plant_id}/growth")
@router.post("/{plant_id}")
async def submit_growth_update(
    plant_id: str,
    lat: float = Form(...),
    lng: float = Form(...),
    image: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    try:
        pid = uuid.UUID(plant_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid plant ID format")

    # Verify ownership and get anchor location
    result = await db.execute(
        select(Plant, func.ST_X(Plant.anchor_location).label("alng"), func.ST_Y(Plant.anchor_location).label("alat"))
        .filter(Plant.id == pid, Plant.owner_id == current_user.id)
    )
    row = result.first()
    if not row:
        raise HTTPException(status_code=404, detail="Plant not found or unauthorized")
        
    plant, anchor_lng, anchor_lat = row
    
    # 1. Geo Validation (flag for manual review if location is far away, without crashing)
    flag_manual = False
    if anchor_lat is not None and anchor_lng is not None:
        try:
            distance = haversine_distance(float(lat), float(lng), float(anchor_lat), float(anchor_lng))
            if distance > 100000:
                flag_manual = True
                logger.info(f"Growth update flagged for manual review: location distance {distance:.0f}m from anchor")
        except Exception as geo_err:
            logger.warning(f"Geo validation calculation notice: {geo_err}")
        
    image_bytes = await image.read()
    if not image_bytes or len(image_bytes) == 0:
        raise HTTPException(status_code=400, detail="Uploaded image file is empty. Please capture a valid photo.")
    
    # 2. EXIF validation
    exif_point_sql = None
    try:
        exif_gps = extract_exif_gps(image_bytes)
        if exif_gps:
            exif_lat, exif_lng = exif_gps
            exif_dist = haversine_distance(float(lat), float(lng), float(exif_lat), float(exif_lng))
            if exif_dist > 500:
                flag_manual = True
            exif_point_sql = f'SRID=4326;POINT({exif_lng} {exif_lat})'
    except Exception as exif_err:
        logger.warning(f"EXIF parsing notice: {exif_err}")
            
    # 3. Sanitize and Upload Image
    sanitized_bytes = sanitize_image(image_bytes)
    obj_name = f"{uuid.uuid4()}.jpg"
    minio_url = upload_to_minio(obj_name, sanitized_bytes, "image/jpeg")
    
    # 4. Save to DB
    update_id = uuid.uuid4()
    growth_update = GrowthUpdate(
        id=update_id,
        plant_id=plant.id,
        image_url=minio_url,
        submitted_gps=f'SRID=4326;POINT({lng} {lat})',
        exif_gps=exif_point_sql,
        verification_status=VerificationStatus.MANUAL_REVIEW if flag_manual else VerificationStatus.PENDING
    )
    
    db.add(growth_update)
    await db.commit()
    
    # 5. Execute CV verification (real-time with Dual PyTorch Models)
    analysis = None
    if not flag_manual:
        try:
            from app.services.cv.models import get_cv_model
            cv_model = get_cv_model()
            analysis = cv_model.analyze_plant_image(sanitized_bytes)
            
            is_verified = analysis.get("is_verified", False)
            tree_conf = analysis.get("tree_confidence", 0.95)
            health_status = analysis.get("health_status", "Healthy")
            growth_stage = analysis.get("growth_stage", "Vegetative")
            summary_reason = analysis.get("summary_reason", "")
            
            if is_verified:
                growth_update.verification_status = VerificationStatus.VERIFIED
                growth_update.confidence_score = round(float(tree_conf), 4)
                growth_update.growth_stage_label = f"{growth_stage} ({health_status})"
                growth_update.cv_model_version = "resnet18-dual-v1"
                growth_update.rejection_reason = None
            else:
                growth_update.verification_status = VerificationStatus.REJECTED
                growth_update.confidence_score = round(float(tree_conf), 4)
                growth_update.growth_stage_label = growth_stage
                growth_update.cv_model_version = "resnet18-dual-v1"
                growth_update.rejection_reason = summary_reason or "Automated CV verification checks failed"
                
            await db.commit()
            
            # Award points if verified
            if is_verified:
                from app.services.rewards import credit_growth_update_reward
                try:
                    await credit_growth_update_reward(db, current_user.id, plant.id)
                except Exception as rw_err:
                    logger.warning(f"Reward crediting notice: {rw_err}")
                    
        except Exception as cv_err:
            logger.warning(f"Immediate CV inference fallback: {cv_err}")
            try:
                verify_growth_update.delay(str(update_id))
            except Exception:
                pass
        
    return {
        "status": "success",
        "update_id": str(update_id),
        "verification_status": growth_update.verification_status.value,
        "growth_stage": growth_update.growth_stage_label,
        "confidence_score": growth_update.confidence_score,
        "rejection_reason": growth_update.rejection_reason,
        "analysis": analysis
    }

@router.get("/{plant_id}/growth")
@router.get("/{plant_id}")
async def get_growth_updates(
    plant_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    try:
        pid = uuid.UUID(plant_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid plant ID")
        
    # verify ownership
    result = await db.execute(select(Plant).filter(Plant.id == pid, Plant.owner_id == current_user.id))
    if not result.scalars().first():
        raise HTTPException(status_code=404, detail="Plant not found")
        
    updates_res = await db.execute(
        select(GrowthUpdate)
        .filter(GrowthUpdate.plant_id == pid)
        .order_by(GrowthUpdate.server_timestamp.desc())
    )
    
    updates = updates_res.scalars().all()
    
    return [
        {
            "id": str(u.id),
            "status": u.verification_status.value,
            "stage": u.growth_stage_label or "Vegetative",
            "confidence_score": u.confidence_score,
            "rejection_reason": u.rejection_reason,
            "timestamp": u.server_timestamp,
            "image_url": u.image_url.replace("s3://growth-updates/", "http://localhost:9000/growth-updates/") if u.image_url.startswith("s3://") else u.image_url
        } for u in updates
    ]
