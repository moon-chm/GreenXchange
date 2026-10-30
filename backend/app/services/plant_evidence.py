"""Photo intake and review. Review status and credits commit together."""
import hashlib
import uuid
import threading
from datetime import datetime, timezone, timedelta
from fastapi import HTTPException
from sqlalchemy import select, func
from sqlalchemy.exc import IntegrityError
from starlette.concurrency import run_in_threadpool
from app.models.evidence import PlantPhoto, GrowthDecision
from app.models.growth import GrowthUpdate
from app.models.plants import Plant
from app.models.users import User
from app.models.rewards import RewardTransaction
from app.models.enums import VerificationStatus
from app.services.media import sanitize_image, upload_to_minio, remove_unreferenced_upload

_inference_slot = threading.BoundedSemaphore(1)


def observe_photo(data):
    if not _inference_slot.acquire(blocking=False):
        return {"requires_review": True, "summary_reason": "AI busy; awaiting human review."}
    try:
        from app.services.cv.models import get_cv_model
        return get_cv_model().analyze_plant_image(data)
    except Exception:
        return {"requires_review": True, "summary_reason": "AI unavailable; awaiting human review."}
    finally:
        _inference_slot.release()


async def save_photo(db, owner_id, raw):
    if not raw or len(raw) > 10 * 1024 * 1024:
        raise HTTPException(400 if not raw else 413, "Photo must contain 1 byte to 10 MB")
    try:
        data = await run_in_threadpool(sanitize_image, raw)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    digest = hashlib.sha256(data).hexdigest()
    existing = (await db.execute(select(PlantPhoto).where(PlantPhoto.digest == digest))).scalar_one_or_none()
    if existing:
        if existing.owner_id == owner_id and not existing.consumed:
            return existing
        raise HTTPException(409, "This photo has already been submitted. Take a new photo.")
    photo_id = uuid.uuid4()
    object_name = f"plant-images/{owner_id}/{photo_id}.jpg"
    try:
        url = await run_in_threadpool(upload_to_minio, object_name, data, "image/jpeg")
    except RuntimeError as exc:
        raise HTTPException(503, "Photo storage is unavailable. Please retry.") from exc
    photo = PlantPhoto(id=photo_id, owner_id=owner_id, image_url=url, digest=digest,
                       analysis=await run_in_threadpool(observe_photo, data), consumed=False)
    db.add(photo)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        await run_in_threadpool(remove_unreferenced_upload, object_name)
        raise HTTPException(409, "This photo was submitted concurrently. Please retry.") from exc
    return photo


async def consume_photo(db, owner_id, image_url):
    photo = (await db.execute(select(PlantPhoto).where(
        PlantPhoto.image_url == image_url, PlantPhoto.owner_id == owner_id
    ).with_for_update())).scalar_one_or_none()
    if not photo or photo.consumed:
        raise HTTPException(409, "Upload a new photo owned by your account before submitting.")
    photo.consumed = True
    return photo


def reward_eligibility(kind, submitted_at, last_reward_at, registration_paid):
    """Eligibility uses evidence time, so delayed approvals cannot bypass cooldown."""
    if kind == "registration":
        return (0, "already_credited") if registration_paid else (50, "credited")
    if last_reward_at:
        if submitted_at.tzinfo is None:
            submitted_at = submitted_at.replace(tzinfo=timezone.utc)
        if last_reward_at.tzinfo is None:
            last_reward_at = last_reward_at.replace(tzinfo=timezone.utc)
        from app.services.rewards import REWARD_MIN_INTERVAL_HOURS
        if submitted_at < last_reward_at + timedelta(hours=max(24, REWARD_MIN_INTERVAL_HOURS)):
            return 0, "cooldown"
    return 10, "credited"


async def review_submission(db, update_id, reviewer_id, approved, reason, evidence_confirmed):
    update = (await db.execute(select(GrowthUpdate).where(GrowthUpdate.id == update_id))).scalar_one_or_none()
    if not update:
        raise HTTPException(404, "Submission not found")
    plant = (await db.execute(select(Plant).where(Plant.id == update.plant_id))).scalar_one()
    if plant.owner_id == reviewer_id:
        raise HTTPException(403, "Reviewers cannot approve or reject their own submissions")
    # Same lock order as all other wallet operations. Re-read evidence after locking.
    user = (await db.execute(select(User).where(User.id == plant.owner_id).with_for_update())).scalar_one()
    plant = (await db.execute(select(Plant).where(Plant.id == plant.id).with_for_update()
                             .execution_options(populate_existing=True))).scalar_one()
    update = (await db.execute(select(GrowthUpdate).where(GrowthUpdate.id == update_id)
                              .with_for_update().execution_options(populate_existing=True))).scalar_one()
    existing = (await db.execute(select(GrowthDecision).where(GrowthDecision.growth_update_id == update_id))).scalar_one_or_none()
    if existing:
        if existing.approved != approved:
            raise HTTPException(409, "A final decision already exists")
        return {"reward_status": existing.reward_status, "points_awarded": existing.points,
                "verification_status": update.verification_status.value}
    if update.verification_status not in (VerificationStatus.PENDING, VerificationStatus.MANUAL_REVIEW):
        raise HTTPException(409, "Submission already finalized")
    if approved and (not evidence_confirmed or not update.photo_id):
        raise HTTPException(422, "Confirm new plant evidence or same-plant growth against prior evidence. Legacy uploads require a new photo.")
    if approved and (plant.deleted_at is not None or not user.is_active or not user.email_verified):
        raise HTTPException(409, "An active plant and verified active account are required")
    prior = (await db.execute(select(GrowthUpdate).where(
        GrowthUpdate.plant_id == plant.id, GrowthUpdate.id != update.id,
        GrowthUpdate.server_timestamp < update.server_timestamp,
        GrowthUpdate.photo_id.is_not(None),
        GrowthUpdate.verification_status == VerificationStatus.VERIFIED
    ).order_by(GrowthUpdate.server_timestamp.desc()).limit(1))).scalar_one_or_none()
    if approved and update.submission_kind == "growth" and not prior:
        raise HTTPException(409, "Approve a baseline photo first, or reject this submission and request a new baseline")
    points, outcome = 0, "not_awarded"
    if approved:
        registration = (await db.execute(select(RewardTransaction.id).where(
            RewardTransaction.plant_id == plant.id, RewardTransaction.user_id == user.id,
            RewardTransaction.trigger_event == "PLANT_REGISTERED").limit(1))).scalar_one_or_none()
        evidence_time = func.coalesce(GrowthUpdate.server_timestamp, RewardTransaction.created_at)
        last = (await db.execute(select(evidence_time).select_from(RewardTransaction).outerjoin(GrowthUpdate,
            GrowthUpdate.id == RewardTransaction.growth_update_id).where(
            RewardTransaction.plant_id == plant.id, RewardTransaction.user_id == user.id,
            RewardTransaction.trigger_event == "GROWTH_UPDATE_VERIFIED"
        ).order_by(evidence_time.desc()).limit(1))).scalar_one_or_none()
        points, outcome = reward_eligibility(update.submission_kind, update.server_timestamp, last, registration is not None)
        if points:
            from app.services.rewards import get_user_balance
            balance = await get_user_balance(db, user.id)
            db.add(RewardTransaction(user_id=user.id, plant_id=plant.id, growth_update_id=update.id,
                points=points, balance_snapshot=balance + points,
                trigger_event="PLANT_REGISTERED" if update.submission_kind == "registration" else "GROWTH_UPDATE_VERIFIED"))
    update.verification_status = VerificationStatus.VERIFIED if approved else VerificationStatus.REJECTED
    update.rejection_reason = reason
    update.cv_model_version = "human-review-v1"
    update.growth_stage_label = ("Baseline confirmed" if update.submission_kind == "registration" else "Growth confirmed") if approved else "Not assessed"
    db.add(GrowthDecision(growth_update_id=update.id, reviewer_id=reviewer_id, reason=reason,
                         approved=approved, reward_status=outcome, points=points))
    await db.commit()
    return {"verification_status": update.verification_status.value, "reward_status": outcome, "points_awarded": points}
