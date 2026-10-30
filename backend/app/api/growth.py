import uuid
from typing import Literal
from fastapi import APIRouter, Depends, HTTPException, UploadFile, Form, File, Request, Query
from pydantic import BaseModel, Field
from sqlalchemy import select, func
from app.api.deps import get_current_user, get_current_admin_user, get_db
from app.models.plants import Plant
from app.models.growth import GrowthUpdate
from app.models.evidence import PlantPhoto, GrowthDecision
from app.models.enums import VerificationStatus
from app.services.plant_evidence import save_photo, consume_photo, review_submission
from app.core.rate_limiter import check_endpoint_rate_limit
from app.utils.geo import haversine_distance, extract_exif_gps
import logging
logger = logging.getLogger(__name__)
router = APIRouter()

def _public_media_url(image_url: str) -> str | None:
    if image_url and image_url.startswith("s3://growth-updates/"):
        from app.services.media import get_presigned_media_url
        object_name = image_url.removeprefix("s3://growth-updates/")
        try:
            return get_presigned_media_url(object_name)
        except Exception:
            logger.exception("Could not create a signed growth image URL")
            return None
    return image_url


class ReviewRequest(BaseModel):
    decision: Literal["approve", "reject"]
    reason: str = Field(..., min_length=10, max_length=2000)
    evidence_confirmed: bool = False


@router.get("/review/queue")
async def review_queue(admin=Depends(get_current_admin_user), db=Depends(get_db),
                       limit: int = Query(30, ge=1, le=100), skip: int = Query(0, ge=0)):
    rows = (await db.execute(select(GrowthUpdate, Plant, PlantPhoto.analysis)
        .join(Plant, Plant.id == GrowthUpdate.plant_id)
        .outerjoin(PlantPhoto, PlantPhoto.id == GrowthUpdate.photo_id)
        .where(GrowthUpdate.verification_status.in_([VerificationStatus.PENDING, VerificationStatus.MANUAL_REVIEW]),
               Plant.deleted_at.is_(None), Plant.owner_id != admin.id)
        .order_by(GrowthUpdate.server_timestamp, GrowthUpdate.id).offset(skip).limit(limit))).all()
    output = []
    for update, plant, analysis in rows:
        prior = (await db.execute(select(GrowthUpdate).where(GrowthUpdate.plant_id == plant.id,
            GrowthUpdate.server_timestamp < update.server_timestamp,
            GrowthUpdate.photo_id.is_not(None),
            GrowthUpdate.verification_status == VerificationStatus.VERIFIED)
            .order_by(GrowthUpdate.server_timestamp.desc()).limit(1))).scalar_one_or_none()
        output.append({"id": str(update.id), "plant_id": str(plant.id), "plant_name": plant.common_name,
            "owner_id": str(plant.owner_id), "kind": update.submission_kind,
            "timestamp": update.server_timestamp, "reason": update.rejection_reason,
            "image_url": _public_media_url(update.image_url), "analysis": analysis,
            "prior_image_url": _public_media_url(prior.image_url) if prior else None,
            "prior_timestamp": prior.server_timestamp if prior else None,
            "can_approve": bool(update.photo_id) and (update.submission_kind == "registration" or prior is not None)})
    return output


@router.post("/review/{update_id}")
async def decide_review(update_id: uuid.UUID, req: ReviewRequest,
                        admin=Depends(get_current_admin_user), db=Depends(get_db)):
    if len(req.reason.strip()) < 10:
        raise HTTPException(422, "Explain the evidence for your decision")
    return await review_submission(db, update_id, admin.id, req.decision == "approve",
                                   req.reason.strip(), req.evidence_confirmed)


@router.post("/{plant_id}/growth")
@router.post("/{plant_id}")
async def submit_growth_update(request: Request, plant_id: str,
    lat: float = Form(..., ge=-90, le=90), lng: float = Form(..., ge=-180, le=180),
    image: UploadFile = File(...), current_user=Depends(get_current_user), db=Depends(get_db)):
    await check_endpoint_rate_limit(request, "growth_upload", max_requests=10, window_seconds=3600, user_id=str(current_user.id))
    try:
        pid = uuid.UUID(plant_id)
    except ValueError:
        raise HTTPException(400, "Invalid plant ID")
    row = (await db.execute(select(Plant, func.ST_X(Plant.anchor_location), func.ST_Y(Plant.anchor_location))
        .where(Plant.id == pid, Plant.owner_id == current_user.id, Plant.deleted_at.is_(None)))).first()
    if not row:
        raise HTTPException(404, "Plant not found")
    plant, anchor_lng, anchor_lat = row
    raw = await image.read(10 * 1024 * 1024 + 1)
    photo = await save_photo(db, current_user.id, raw)
    photo = await consume_photo(db, current_user.id, photo.image_url)
    # Recheck after slow storage/inference; serialize baseline selection per plant.
    active_plant = (await db.execute(select(Plant).where(Plant.id == pid,
        Plant.owner_id == current_user.id, Plant.deleted_at.is_(None)).with_for_update())).scalar_one_or_none()
    if not active_plant:
        raise HTTPException(409, "Plant was archived while uploading")
    reasons = ["Awaiting review of plant identity and growth. Points are awarded only after approval."]
    if anchor_lat is None or anchor_lng is None or haversine_distance(lat, lng, anchor_lat, anchor_lng) > 100:
        reasons.append("Submitted location is outside the 100 m tolerance or anchor is unavailable; verify location evidence.")
    exif = extract_exif_gps(raw)
    if exif and haversine_distance(lat, lng, *exif) > 100:
        reasons.append("Photo GPS differs from submitted location; verify location evidence.")
    # Legacy plants without a trusted baseline can establish one through this flow.
    baseline = (await db.execute(select(GrowthUpdate.id).where(GrowthUpdate.plant_id == pid,
        GrowthUpdate.photo_id.is_not(None), GrowthUpdate.verification_status != VerificationStatus.REJECTED)
        .limit(1))).scalar_one_or_none()
    update = GrowthUpdate(id=uuid.uuid4(), plant_id=pid, photo_id=photo.id,
        submission_kind="growth" if baseline else "registration", image_url=photo.image_url,
        submitted_gps=f"SRID=4326;POINT({lng} {lat})",
        exif_gps=f"SRID=4326;POINT({exif[1]} {exif[0]})" if exif else None,
        verification_status=VerificationStatus.MANUAL_REVIEW, rejection_reason=" ".join(reasons))
    db.add(update)
    await db.commit()
    return {"status": "success", "update_id": str(update.id), "verification_status": "manual_review",
        "growth_stage": "Not assessed", "confidence_score": None, "rejection_reason": update.rejection_reason,
        "analysis": photo.analysis, "reward_status": "pending_review", "points_awarded": 0}


@router.get("/{plant_id}/growth")
@router.get("/{plant_id}")
async def get_growth_updates(plant_id: uuid.UUID, current_user=Depends(get_current_user), db=Depends(get_db)):
    plant = (await db.execute(select(Plant).where(Plant.id == plant_id, Plant.owner_id == current_user.id))).scalar_one_or_none()
    if not plant:
        raise HTTPException(404, "Plant not found")
    rows = (await db.execute(select(GrowthUpdate, GrowthDecision).outerjoin(GrowthDecision,
        GrowthDecision.growth_update_id == GrowthUpdate.id).where(GrowthUpdate.plant_id == plant_id)
        .order_by(GrowthUpdate.server_timestamp.desc()))).all()
    return [{"id": str(u.id), "status": u.verification_status.value, "stage": u.growth_stage_label or "Not assessed",
        "confidence_score": u.confidence_score, "rejection_reason": u.rejection_reason,
        "timestamp": u.server_timestamp, "image_url": _public_media_url(u.image_url),
        "reward_status": d.reward_status if d else "pending_review" if u.verification_status in
            (VerificationStatus.PENDING, VerificationStatus.MANUAL_REVIEW) else "legacy",
        "points_awarded": d.points if d else 0} for u, d in rows]
