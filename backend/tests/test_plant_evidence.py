"""Regression tests for evidence ownership, review eligibility and reward failures."""
import io
import uuid
from datetime import datetime, timezone, timedelta
from types import SimpleNamespace as NS
from unittest.mock import AsyncMock
import pytest
from fastapi import HTTPException
from PIL import Image
from pydantic import ValidationError
from app.models.enums import VerificationStatus
from app.models.evidence import GrowthDecision
from app.models.rewards import RewardTransaction
from app.schemas.plants import PlantRegistrationRequest
from app.services import plant_evidence as evidence
from app.services.media import sanitize_image


class FakeDB:
    def __init__(self, *results):
        self.results = list(results)
        self.added = []
        self.queries = []
        self.commit = AsyncMock()
        self.rollback = AsyncMock()

    async def execute(self, query):
        query.compile()  # Catch invalid joins before mocked results hide them.
        self.queries.append(query)
        assert self.results, "Unexpected database query"
        value = self.results.pop(0)
        return NS(scalar_one=lambda: value, scalar_one_or_none=lambda: value)

    def add(self, obj):
        self.added.append(obj)


def review_db(kind="registration", prior=None, paid=None, last=None, existing=None):
    owner, reviewer = uuid.uuid4(), uuid.uuid4()
    update = NS(id=uuid.uuid4(), plant_id=uuid.uuid4(), photo_id=uuid.uuid4(),
                submission_kind=kind, verification_status=VerificationStatus.MANUAL_REVIEW,
                server_timestamp=datetime.now(timezone.utc))
    plant = NS(id=update.plant_id, owner_id=owner, deleted_at=None)
    user = NS(id=owner, is_active=True, email_verified=True, device_fingerprint=None)
    db = FakeDB(update, plant, user, plant, update, existing, prior, paid, last, 100)
    return db, update, plant, reviewer


@pytest.mark.asyncio
async def test_normal_verified_account_without_fingerprint_receives_reviewed_bonus():
    db, update, _, reviewer = review_db()
    outcome = await evidence.review_submission(db, update.id, reviewer, True, "Distinct new plant confirmed", True)
    assert outcome == {"verification_status": "verified", "reward_status": "credited", "points_awarded": 50}
    tx = next(x for x in db.added if isinstance(x, RewardTransaction))
    assert tx.growth_update_id == update.id and tx.balance_snapshot == 150
    assert any(isinstance(x, GrowthDecision) for x in db.added)
    db.commit.assert_awaited_once()
    assert len([q for q in db.queries if getattr(q, "_for_update_arg", None) is not None]) == 3


@pytest.mark.asyncio
async def test_retry_does_not_issue_second_reward():
    db, update, _, reviewer = review_db(existing=NS(approved=True, reward_status="credited", points=50))
    update.verification_status = VerificationStatus.VERIFIED
    outcome = await evidence.review_submission(db, update.id, reviewer, True, "Distinct new plant confirmed", True)
    assert outcome["points_awarded"] == 50
    assert not db.added
    db.commit.assert_not_awaited()


@pytest.mark.asyncio
async def test_conflicting_retry_is_rejected():
    db, update, _, reviewer = review_db(existing=NS(approved=False, reward_status="not_awarded", points=0))
    with pytest.raises(HTTPException) as err:
        await evidence.review_submission(db, update.id, reviewer, True, "Distinct new plant confirmed", True)
    assert err.value.status_code == 409
    assert not db.added


@pytest.mark.asyncio
async def test_cannot_review_own_evidence():
    db, update, plant, _ = review_db()
    with pytest.raises(HTTPException) as err:
        await evidence.review_submission(db, update.id, plant.owner_id, True, "Distinct new plant confirmed", True)
    assert err.value.status_code == 403
    assert not db.added


@pytest.mark.asyncio
@pytest.mark.parametrize("case", ["legacy", "unconfirmed", "archived", "no_baseline"])
async def test_unsafe_approval_does_not_credit(case):
    db, update, plant, reviewer = review_db(kind="growth" if case == "no_baseline" else "registration")
    if case == "legacy": update.photo_id = None
    if case == "archived": plant.deleted_at = datetime.now(timezone.utc)
    with pytest.raises(HTTPException):
        await evidence.review_submission(db, update.id, reviewer, True, "Evidence has been inspected", case != "unconfirmed")
    assert not db.added
    db.commit.assert_not_awaited()


@pytest.mark.asyncio
async def test_rejection_commits_decision_without_points():
    db, update, _, reviewer = review_db()
    outcome = await evidence.review_submission(db, update.id, reviewer, False, "Cannot establish plant identity", False)
    assert outcome["points_awarded"] == 0
    assert update.growth_stage_label == "Not assessed"
    assert not any(isinstance(x, RewardTransaction) for x in db.added)
    db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_commit_failure_is_not_reported_as_verified_success():
    db, update, _, reviewer = review_db()
    db.commit.side_effect = RuntimeError("database unavailable")
    with pytest.raises(RuntimeError):
        await evidence.review_submission(db, update.id, reviewer, True, "Distinct new plant confirmed", True)
    db.commit.assert_awaited_once()  # No earlier verification-only commit.


@pytest.mark.asyncio
async def test_existing_registration_bonus_is_preserved_without_double_credit():
    db, update, _, reviewer = review_db(paid=uuid.uuid4())
    outcome = await evidence.review_submission(db, update.id, reviewer, True, "Distinct new plant confirmed", True)
    assert outcome["reward_status"] == "already_credited"
    assert not any(isinstance(x, RewardTransaction) for x in db.added)


@pytest.mark.asyncio
@pytest.mark.parametrize("hours,points", [(23, 0), (24, 10), (25, 10)])
async def test_growth_cooldown_boundary(hours, points, monkeypatch):
    from app.services import rewards
    monkeypatch.setattr(rewards, "REWARD_MIN_INTERVAL_HOURS", 24)
    db, update, _, reviewer = review_db(kind="growth", prior=NS(id=uuid.uuid4()),
        last=datetime.now(timezone.utc) - timedelta(hours=hours, seconds=1))
    outcome = await evidence.review_submission(db, update.id, reviewer, True, "Same plant shows visible growth", True)
    assert outcome["points_awarded"] == points


@pytest.mark.asyncio
@pytest.mark.parametrize("photo", [None, NS(consumed=True)])
async def test_unowned_or_consumed_upload_is_rejected(photo):
    db = FakeDB(photo)
    owner = uuid.uuid4()
    with pytest.raises(HTTPException):
        await evidence.consume_photo(db, owner, "s3://growth-updates/other.jpg")
    assert owner in db.queries[0].compile().params.values()
    db.commit.assert_not_awaited()


@pytest.mark.asyncio
async def test_duplicate_photo_cannot_be_reused(monkeypatch):
    owner = uuid.uuid4()
    raw = io.BytesIO(); Image.new("RGB", (8, 8), "green").save(raw, format="PNG")
    db = FakeDB(NS(owner_id=owner, consumed=True))
    with pytest.raises(HTTPException) as err:
        await evidence.save_photo(db, owner, raw.getvalue())
    assert err.value.status_code == 409
    assert not db.added


def test_missing_models_do_not_verify_green_square():
    from app.services.cv.models import PyTorchCVModel
    model = object.__new__(PyTorchCVModel)
    model.tree_model = model.health_model = None
    raw = io.BytesIO(); Image.new("RGB", (256, 256), "green").save(raw, format="JPEG")
    with pytest.raises(RuntimeError): model.analyze_plant_image(raw.getvalue())
    with pytest.raises(RuntimeError): model.detect_tree(raw.getvalue())
    with pytest.raises(RuntimeError): model.assess_health(raw.getvalue())
    assert model.classify_growth_stage(raw.getvalue())["stage"] == "Not assessed"
    assert not model.verify_species(raw.getvalue(), "Mango")["pass"]


def test_photo_orientation_is_applied_before_exif_is_removed():
    raw = io.BytesIO(); image = Image.new("RGB", (12, 8), "red")
    exif = image.getexif(); exif[274] = 6
    image.save(raw, format="JPEG", exif=exif)
    output = Image.open(io.BytesIO(sanitize_image(raw.getvalue())))
    assert output.size == (8, 12)
    assert not output.getexif()


def test_registration_requires_photo_and_nonfuture_date():
    req = dict(lat=0, lng=0, planting_date=datetime.now(timezone.utc), space_type="indoor")
    with pytest.raises(ValidationError): PlantRegistrationRequest(**req)
    req["image_url"] = "s3://growth-updates/example.jpg"
    assert PlantRegistrationRequest(**req).lat == 0
    req["planting_date"] += timedelta(days=1)
    with pytest.raises(ValidationError): PlantRegistrationRequest(**req)


def test_schema_enforces_single_reward_and_photo_consumption():
    from sqlalchemy import UniqueConstraint
    from app.models.growth import GrowthUpdate
    for table, field in [(RewardTransaction.__table__, "growth_update_id"),
                         (GrowthUpdate.__table__, "photo_id"),
                         (GrowthDecision.__table__, "growth_update_id")]:
        assert any(isinstance(c, UniqueConstraint) and field in c.columns for c in table.constraints)


def test_global_coordinates_and_antimeridian():
    from app.utils.geo import haversine_distance
    assert haversine_distance(0, 0, 0, 0) == 0
    assert 200 < haversine_distance(0, 179.999, 0, -179.999) < 250
    assert 20_000_000 < haversine_distance(90, 0, -90, 0) < 20_100_000
    assert haversine_distance(-33.86, 151.2, -33.86, 151.2) == 0


def test_non_admin_cannot_access_review_api():
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from app.api.growth import router
    from app.api.deps import get_current_user, get_db
    app = FastAPI(); app.include_router(router)
    app.dependency_overrides[get_current_user] = lambda: NS(role="USER")
    app.dependency_overrides[get_db] = lambda: FakeDB()
    with TestClient(app) as client:
        assert client.get("/review/queue").status_code == 403
        response = client.post(f"/review/{uuid.uuid4()}", json={
            "decision": "approve", "reason": "Attempt to approve own photo", "evidence_confirmed": True})
        assert response.status_code == 403


def test_evidence_migration_renders_constraints_and_audit_triggers():
    import importlib.util
    from pathlib import Path
    from alembic.migration import MigrationContext
    from alembic.operations import Operations
    path = Path(__file__).parents[1] / "alembic/versions/20261030_plant_evidence.py"
    spec = importlib.util.spec_from_file_location("evidence_migration", path)
    migration = importlib.util.module_from_spec(spec); spec.loader.exec_module(migration)
    output = io.StringIO()
    context = MigrationContext.configure(dialect_name="postgresql", opts={"as_sql": True, "output_buffer": output})
    with Operations.context(context): migration.upgrade()
    sql = output.getvalue()
    assert "uq_reward_growth_update" in sql and "uq_growth_photo" in sql
    assert "growth_decisions_append_only" in sql and "growth_evidence_immutable" in sql
