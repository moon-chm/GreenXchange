"""Opt-in integration tests. Only the disposable localhost audit database is allowed.

Run migrations first; set GX_EVIDENCE_INTEGRATION=1 and DATABASE_URL to the
gx_evidence_test database on 127.0.0.1:55439. MinIO runs on localhost:55440.
"""
import asyncio
import io
import os
import uuid
from datetime import datetime, timezone, timedelta
from types import SimpleNamespace as NS
import pytest
from PIL import Image
from sqlalchemy import select, func, event
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from app.models.users import User
from app.models.plants import PlantSpecies, Plant
from app.models.evidence import PlantPhoto, GrowthDecision
from app.models.growth import GrowthUpdate
from app.models.rewards import RewardTransaction
from app.models.enums import VerificationStatus
from app.services.plant_evidence import review_submission, save_photo

pytestmark = pytest.mark.skipif(os.getenv("GX_EVIDENCE_INTEGRATION") != "1", reason="requires disposable PostGIS/MinIO stack")


@pytest.fixture
async def database():
    url = os.environ["DATABASE_URL"]
    from sqlalchemy.engine import make_url
    parsed = make_url(url)
    assert (parsed.host, parsed.port, parsed.database) == ("127.0.0.1", 55439, "gx_evidence_test"), "Refusing non-disposable database"
    engine = create_async_engine(url)
    sessions = async_sessionmaker(engine, expire_on_commit=False)
    async with sessions() as db:
        owner = User(id=uuid.uuid4(), name="Evidence integration", email=f"{uuid.uuid4()}@example.test",
                     password_hash="unused", is_active=True, email_verified=True)
        admin = User(id=uuid.uuid4(), name="Reviewer integration", email=f"{uuid.uuid4()}@example.test",
                     password_hash="unused", is_active=True, email_verified=True, role="ADMIN")
        db.add_all([owner, admin]); await db.commit()
        species = (await db.execute(select(PlantSpecies.id).limit(1))).scalar_one()
    yield sessions, owner, admin, species
    await engine.dispose()


async def add_update(sessions, owner, plant_id, when, kind="growth"):
    async with sessions() as db:
        photo = PlantPhoto(id=uuid.uuid4(), owner_id=owner.id, image_url=f"s3://growth-updates/test/{uuid.uuid4()}",
                           digest=uuid.uuid4().hex + uuid.uuid4().hex, consumed=True)
        db.add(photo); await db.flush()
        update = GrowthUpdate(id=uuid.uuid4(), plant_id=plant_id, photo_id=photo.id, submission_kind=kind,
            image_url=photo.image_url, submitted_gps="SRID=4326;POINT(0 0)", server_timestamp=when,
            verification_status=VerificationStatus.MANUAL_REVIEW)
        db.add(update); await db.commit()
        return update.id


@pytest.mark.asyncio
async def test_real_upload_registration_and_concurrent_reviews(database, monkeypatch):
    from app.api.plants import register_plant
    from app.schemas.plants import PlantRegistrationRequest
    from app.services import plant_evidence, media
    from app.api import plants
    from unittest.mock import AsyncMock
    sessions, owner, admin, species = database
    monkeypatch.setattr(plants, "check_endpoint_rate_limit", AsyncMock())
    monkeypatch.setattr(plant_evidence, "observe_photo", lambda raw: {"requires_review": True})
    monkeypatch.setattr(media, "_minio_client", None)
    raw = io.BytesIO()
    # Unique pixels make this test repeatable without deleting immutable evidence.
    Image.frombytes("RGB", (24, 24), os.urandom(24 * 24 * 3)).save(raw, format="PNG")
    async with sessions() as db:
        photo = await save_photo(db, owner.id, raw.getvalue())
        assert photo.image_url.startswith("s3://growth-updates/plant-images/")
        result = await register_plant(PlantRegistrationRequest(species_id=str(species), common_name="Integration plant",
            lat=0, lng=0, planting_date=datetime.now(timezone.utc), space_type="indoor", image_url=photo.image_url),
            NS(), owner, db)
        plant_id = uuid.UUID(result.id)
        baseline = (await db.execute(select(GrowthUpdate).where(GrowthUpdate.plant_id == plant_id))).scalar_one()
        assert baseline.verification_status == VerificationStatus.MANUAL_REVIEW
        assert (await db.execute(select(func.count()).select_from(RewardTransaction).where(RewardTransaction.user_id == owner.id))).scalar_one() == 0
        # Actual storage is readable, not just a fabricated URL.
        object_name = photo.image_url.removeprefix("s3://growth-updates/")
        assert media.get_minio_client().stat_object("growth-updates", object_name).size > 0

    async def approve(update_id):
        async with sessions() as db:
            return await review_submission(db, update_id, admin.id, True, "Plant identity and evidence confirmed", True)
    outcomes = await asyncio.gather(approve(baseline.id), approve(baseline.id))
    assert all(o["points_awarded"] == 50 for o in outcomes)
    from app.api import growth
    from fastapi import UploadFile
    monkeypatch.setattr(growth, "check_endpoint_rate_limit", AsyncMock())
    raw_growth = io.BytesIO()
    Image.frombytes("RGB", (24, 24), os.urandom(24 * 24 * 3)).save(raw_growth, format="PNG")
    raw_growth.seek(0)
    async with sessions() as db:
        submitted = await growth.submit_growth_update(NS(), str(plant_id), 0, 0,
            UploadFile(file=raw_growth, filename="growth.png"), owner, db)
        assert submitted["reward_status"] == "pending_review" and submitted["points_awarded"] == 0
        first = uuid.UUID(submitted["update_id"])
        queue = await growth.review_queue(admin, db, 100, 0)
        queued = next(item for item in queue if item["id"] == str(first))
        assert queued["prior_image_url"] and queued["can_approve"]
    outcomes = await asyncio.gather(approve(first), approve(first))
    assert all(o["points_awarded"] == 10 for o in outcomes)
    second = await add_update(sessions, owner, plant_id, datetime.now(timezone.utc) + timedelta(hours=1))
    assert (await approve(second))["reward_status"] == "cooldown"
    async with sessions() as db:
        assert (await db.execute(select(func.sum(RewardTransaction.points)).where(RewardTransaction.user_id == owner.id))).scalar_one() == 60
        assert (await db.execute(select(func.count()).select_from(RewardTransaction).where(RewardTransaction.user_id == owner.id))).scalar_one() == 2
        assert (await db.execute(select(func.count()).select_from(GrowthDecision).where(GrowthDecision.growth_update_id.in_([baseline.id, first, second])))).scalar_one() == 3
        timeline = await growth.get_growth_updates(plant_id, owner, db)
        assert sum(item["points_awarded"] for item in timeline) == 60
        portfolio = await plants.get_my_plants(owner, db)
        assert portfolio[0].points_earned == 60
        from app.api.dashboard import fetch_rewards
        assert await fetch_rewards(owner.id, db) == {"balance": 60}


@pytest.mark.asyncio
async def test_database_failure_rolls_back_verification_and_audit(database):
    sessions, owner, admin, species = database
    async with sessions() as db:
        plant = Plant(id=uuid.uuid4(), owner_id=owner.id, species_id=species, scan_id=uuid.uuid4().hex[:20],
            planting_date=datetime.now(timezone.utc), space_type="indoor",
            registered_location="SRID=4326;POINT(0 0)", anchor_location="SRID=4326;POINT(0 0)")
        db.add(plant); await db.commit()
    update_id = await add_update(sessions, owner, plant.id, datetime.now(timezone.utc), "registration")
    def fail_credit(*args): raise RuntimeError("Injected ledger insert failure")
    event.listen(RewardTransaction, "before_insert", fail_credit)
    try:
        async with sessions() as db:
            with pytest.raises(RuntimeError, match="Injected"):
                await review_submission(db, update_id, admin.id, True, "Distinct plant evidence confirmed", True)
            await db.rollback()
    finally:
        event.remove(RewardTransaction, "before_insert", fail_credit)
    async with sessions() as db:
        assert (await db.get(GrowthUpdate, update_id)).verification_status == VerificationStatus.MANUAL_REVIEW
        assert (await db.execute(select(func.count()).select_from(GrowthDecision).where(GrowthDecision.growth_update_id == update_id))).scalar_one() == 0
        assert (await db.execute(select(func.count()).select_from(RewardTransaction).where(RewardTransaction.user_id == owner.id))).scalar_one() == 0
        outcome = await review_submission(db, update_id, admin.id, True, "Distinct plant evidence confirmed", True)
        assert outcome["points_awarded"] == 50
