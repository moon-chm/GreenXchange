from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import uuid
import logging
import app.models  # Registers all models with Base.metadata
from app.models.base import Base
from app.db.session import engine
from app.api import health, auth, users, environment, recommendations, plants, growth, rewards, drives, news, dashboard
from app.core.logging import setup_logging
from app.core.config import settings

setup_logging()
logger = logging.getLogger("backend")

from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure database tables are created on startup (essential for cloud databases)
    try:
        async with engine.begin() as conn:
            try:
                from sqlalchemy import text
                await conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis;"))
            except Exception as e:
                logger.warning(f"PostGIS extension notice (non-fatal): {e}")
            await conn.run_sync(Base.metadata.create_all)
        logger.info("✅ Database tables verified and created successfully.")
    except Exception as e:
        logger.error(f"❌ Database table initialization error: {e}")

    # Seed default plant species if the table is empty
    try:
        await _seed_default_species()
        logger.info("✅ Plant species seed check complete.")
    except Exception as e:
        logger.warning(f"⚠️ Plant species seeding warning (non-fatal): {e}")

    # Seed default government-allocated organization accounts
    try:
        await _seed_default_orgs()
        logger.info("✅ Organization seed check complete.")
    except Exception as e:
        logger.warning(f"⚠️ Organization seeding warning (non-fatal): {e}")

    yield

async def _seed_default_species():
    """Ensure at least the default plant species exist in the database."""
    import uuid as _uuid
    from app.db.session import AsyncSessionLocal
    from app.models.plants import PlantSpecies
    from app.models.enums import ToxicityLevel, AllergenRisk, MaintenanceLevel, GrowthRate, SpaceType
    from sqlalchemy import select as _select

    # Valid SpaceType values: indoor, outdoor_balcony, outdoor_garden, public_park
    # Valid ToxicityLevel values: none, low, medium, high (lowercase)
    # Valid AllergenRisk values: none, low, medium, high (lowercase)
    # Valid MaintenanceLevel values: low, medium, high (lowercase)
    # Valid GrowthRate values: slow, moderate, fast (lowercase)
    DEFAULT_SPECIES = [
        {"common_name": "Neem Tree", "scientific_name": "Azadirachta indica", "genus": "Azadirachta", "family": "Meliaceae", "co2": 21.8, "pm25": 0.8, "voc": 0.6, "tox": "none", "allergen": "low", "maint": "low", "growth": "fast", "spaces": ["outdoor_garden", "public_park"], "temp": "20-40C", "ph": "6.2-7.0"},
        {"common_name": "Tulsi (Holy Basil)", "scientific_name": "Ocimum tenuiflorum", "genus": "Ocimum", "family": "Lamiaceae", "co2": 4.5, "pm25": 0.3, "voc": 0.5, "tox": "none", "allergen": "low", "maint": "low", "growth": "moderate", "spaces": ["indoor", "outdoor_garden", "outdoor_balcony"], "temp": "18-35C", "ph": "6.0-7.5"},
        {"common_name": "Money Plant (Pothos)", "scientific_name": "Epipremnum aureum", "genus": "Epipremnum", "family": "Araceae", "co2": 3.2, "pm25": 0.4, "voc": 0.7, "tox": "low", "allergen": "low", "maint": "low", "growth": "fast", "spaces": ["indoor", "outdoor_balcony"], "temp": "15-30C", "ph": "6.1-6.8"},
        {"common_name": "Snake Plant", "scientific_name": "Sansevieria trifasciata", "genus": "Sansevieria", "family": "Asparagaceae", "co2": 3.5, "pm25": 0.5, "voc": 0.9, "tox": "low", "allergen": "low", "maint": "low", "growth": "slow", "spaces": ["indoor"], "temp": "15-35C", "ph": "5.5-7.0"},
        {"common_name": "Peace Lily", "scientific_name": "Spathiphyllum wallisii", "genus": "Spathiphyllum", "family": "Araceae", "co2": 5.1, "pm25": 0.6, "voc": 1.1, "tox": "low", "allergen": "medium", "maint": "medium", "growth": "moderate", "spaces": ["indoor"], "temp": "16-30C", "ph": "5.8-6.5"},
        {"common_name": "Aloe Vera", "scientific_name": "Aloe barbadensis miller", "genus": "Aloe", "family": "Asphodelaceae", "co2": 2.8, "pm25": 0.2, "voc": 0.4, "tox": "low", "allergen": "low", "maint": "low", "growth": "slow", "spaces": ["indoor", "outdoor_balcony", "outdoor_garden"], "temp": "13-40C", "ph": "7.0-8.5"},
        {"common_name": "Banana Tree", "scientific_name": "Musa acuminata", "genus": "Musa", "family": "Musaceae", "co2": 35.0, "pm25": 1.2, "voc": 0.5, "tox": "none", "allergen": "low", "maint": "medium", "growth": "fast", "spaces": ["outdoor_garden", "public_park"], "temp": "18-38C", "ph": "5.5-7.0"},
        {"common_name": "Jasmine", "scientific_name": "Jasminum officinale", "genus": "Jasminum", "family": "Oleaceae", "co2": 5.5, "pm25": 0.35, "voc": 0.6, "tox": "none", "allergen": "medium", "maint": "medium", "growth": "moderate", "spaces": ["outdoor_garden", "outdoor_balcony"], "temp": "16-32C", "ph": "6.0-7.5"},
        {"common_name": "Bamboo", "scientific_name": "Bambusa vulgaris", "genus": "Bambusa", "family": "Poaceae", "co2": 30.0, "pm25": 0.9, "voc": 0.4, "tox": "none", "allergen": "low", "maint": "low", "growth": "fast", "spaces": ["outdoor_garden", "public_park"], "temp": "15-40C", "ph": "5.5-7.0"},
        {"common_name": "Mango Tree", "scientific_name": "Mangifera indica", "genus": "Mangifera", "family": "Anacardiaceae", "co2": 40.0, "pm25": 1.5, "voc": 0.7, "tox": "none", "allergen": "low", "maint": "low", "growth": "slow", "spaces": ["outdoor_garden", "public_park"], "temp": "24-35C", "ph": "5.5-7.5"},
        {"common_name": "Curry Leaf Plant", "scientific_name": "Murraya koenigii", "genus": "Murraya", "family": "Rutaceae", "co2": 6.0, "pm25": 0.4, "voc": 0.5, "tox": "none", "allergen": "low", "maint": "low", "growth": "moderate", "spaces": ["outdoor_garden", "outdoor_balcony"], "temp": "16-38C", "ph": "6.0-7.0"},
        {"common_name": "Spider Plant", "scientific_name": "Chlorophytum comosum", "genus": "Chlorophytum", "family": "Asparagaceae", "co2": 4.0, "pm25": 0.45, "voc": 0.8, "tox": "none", "allergen": "low", "maint": "low", "growth": "fast", "spaces": ["indoor", "outdoor_balcony"], "temp": "13-27C", "ph": "6.0-7.2"},
        {"common_name": "Rose", "scientific_name": "Rosa gallica", "genus": "Rosa", "family": "Rosaceae", "co2": 3.0, "pm25": 0.3, "voc": 0.4, "tox": "none", "allergen": "medium", "maint": "high", "growth": "moderate", "spaces": ["outdoor_garden", "outdoor_balcony"], "temp": "10-30C", "ph": "6.0-7.0"},
        {"common_name": "Ficus (Rubber Plant)", "scientific_name": "Ficus elastica", "genus": "Ficus", "family": "Moraceae", "co2": 6.0, "pm25": 0.5, "voc": 0.8, "tox": "low", "allergen": "medium", "maint": "low", "growth": "moderate", "spaces": ["indoor"], "temp": "15-30C", "ph": "5.5-7.0"},
        {"common_name": "Hibiscus", "scientific_name": "Hibiscus rosa-sinensis", "genus": "Hibiscus", "family": "Malvaceae", "co2": 7.0, "pm25": 0.5, "voc": 0.45, "tox": "none", "allergen": "low", "maint": "medium", "growth": "fast", "spaces": ["outdoor_garden", "outdoor_balcony"], "temp": "18-35C", "ph": "6.0-7.0"},
        {"common_name": "Marigold", "scientific_name": "Tagetes erecta", "genus": "Tagetes", "family": "Asteraceae", "co2": 2.0, "pm25": 0.2, "voc": 0.3, "tox": "none", "allergen": "medium", "maint": "low", "growth": "fast", "spaces": ["outdoor_garden", "outdoor_balcony"], "temp": "15-30C", "ph": "5.8-7.0"},
        {"common_name": "Papaya Tree", "scientific_name": "Carica papaya", "genus": "Carica", "family": "Caricaceae", "co2": 18.0, "pm25": 0.7, "voc": 0.4, "tox": "none", "allergen": "low", "maint": "low", "growth": "fast", "spaces": ["outdoor_garden"], "temp": "22-38C", "ph": "6.0-6.5"},
        {"common_name": "Mint", "scientific_name": "Mentha spicata", "genus": "Mentha", "family": "Lamiaceae", "co2": 1.5, "pm25": 0.15, "voc": 0.4, "tox": "none", "allergen": "low", "maint": "low", "growth": "fast", "spaces": ["indoor", "outdoor_balcony", "outdoor_garden"], "temp": "15-30C", "ph": "6.0-7.0"},
        {"common_name": "Bougainvillea", "scientific_name": "Bougainvillea spectabilis", "genus": "Bougainvillea", "family": "Nyctaginaceae", "co2": 8.0, "pm25": 0.5, "voc": 0.4, "tox": "low", "allergen": "low", "maint": "low", "growth": "fast", "spaces": ["outdoor_garden", "outdoor_balcony"], "temp": "18-35C", "ph": "5.5-6.0"},
        {"common_name": "Ashoka Tree", "scientific_name": "Saraca asoca", "genus": "Saraca", "family": "Fabaceae", "co2": 22.0, "pm25": 0.9, "voc": 0.5, "tox": "none", "allergen": "low", "maint": "low", "growth": "slow", "spaces": ["outdoor_garden", "public_park"], "temp": "18-38C", "ph": "6.0-7.5"},
    ]

    space_enum_map = {
        "indoor": SpaceType.INDOOR,
        "outdoor_balcony": SpaceType.OUTDOOR_BALCONY,
        "outdoor_garden": SpaceType.OUTDOOR_GARDEN,
        "public_park": SpaceType.PUBLIC_PARK,
    }

    async with AsyncSessionLocal() as session:
        result = await session.execute(_select(PlantSpecies).limit(1))
        if result.scalar_one_or_none() is not None:
            return  # Already seeded

        for s in DEFAULT_SPECIES:
            sp = PlantSpecies(
                id=_uuid.uuid4(),
                common_name=s["common_name"],
                scientific_name=s["scientific_name"],
                genus=s["genus"],
                family=s["family"],
                co2_absorption_rate=s.get("co2"),
                pm25_absorption_rate=s.get("pm25"),
                voc_absorption_rate=s.get("voc"),
                toxicity_level=ToxicityLevel(s["tox"]),
                allergen_risk=AllergenRisk(s["allergen"]),
                maintenance_level=MaintenanceLevel(s["maint"]),
                growth_rate=GrowthRate(s["growth"]),
                space_type_compatibility=[space_enum_map[x] for x in s.get("spaces", [])],
                temperature_range=s.get("temp"),
                soil_ph_range=s.get("ph"),
                data_source="GreenXchange Default Seed v1",
            )
            session.add(sp)
        await session.commit()
        logger.info(f"✅ Seeded {len(DEFAULT_SPECIES)} default plant species.")

async def _seed_default_orgs():
    """Ensure default government-allocated organization accounts exist."""
    import uuid as _uuid
    from app.db.session import AsyncSessionLocal
    from app.models.users import User
    from app.core.security import get_password_hash
    from sqlalchemy import select as _select

    DEFAULT_ORGS = [
        {
            "email": "testorg@nursery.gov.in",
            "password": "TestOrg123!",
            "name": "Government Test Nursery Org",
            "role": "ORGANIZATION",
            "is_org": True,
        },
        {
            "email": "gov_nursery_delhi@greenxchange.gov.in",
            "password": "GovNurseryPass2026!",
            "name": "Delhi Municipal Green Nursery",
            "role": "ORGANIZATION",
            "is_org": True,
        },
        {
            "email": "ecocare_partner@greenxchange.org",
            "password": "EcoPartnerPass2026!",
            "name": "EcoCare Bio-Services Org",
            "role": "ORGANIZATION",
            "is_org": True,
        },
    ]

    async with AsyncSessionLocal() as session:
        for org in DEFAULT_ORGS:
            result = await session.execute(_select(User).filter(User.email == org["email"]))
            existing = result.scalars().first()
            if not existing:
                new_org = User(
                    id=_uuid.uuid4(),
                    email=org["email"],
                    password_hash=get_password_hash(org["password"]),
                    name=org["name"],
                    location_lat=28.6139,
                    location_lng=77.2090,
                    role=org["role"],
                    is_org=org["is_org"],
                    email_verified=True,
                    is_active=True,
                )
                session.add(new_org)
                logger.info(f"🌿 Seeded default organization: {org['email']}")
            else:
                updated = False
                if not getattr(existing, "is_org", False):
                    existing.is_org = True
                    updated = True
                if getattr(existing, "role", None) != "ORGANIZATION":
                    existing.role = "ORGANIZATION"
                    updated = True
                if not getattr(existing, "email_verified", False):
                    existing.email_verified = True
                    updated = True
                if updated:
                    session.add(existing)
        await session.commit()

app = FastAPI(
    title="GreenXchange API",
    version="1.0.0",
    description="GreenXchange Municipal Climate Network API",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url=None,
)

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    body = await request.body()
    logger.error(f"Validation error on {request.url.path}: {exc.errors()} | Body: {body.decode('utf-8', errors='ignore')}")
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors()}
    )

@app.middleware("http")
async def log_requests(request: Request, call_next):
    request_id = str(uuid.uuid4())
    logger.info("Request started", extra={
        "endpoint": request.url.path,
        "method": request.method,
        "request_id": request_id
    })
    response = await call_next(request)
    logger.info("Request completed", extra={
        "endpoint": request.url.path,
        "method": request.method,
        "request_id": request_id,
        "status_code": response.status_code
    })
    return response

# CORS — allow frontend origin + localhost for dev
allowed_origins = [
    settings.FRONTEND_URL,
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"https?://greenxchange.*\.onrender\.com",
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept", "Origin", "X-Requested-With"],
    expose_headers=["Content-Length", "X-Request-ID"],
    max_age=600,
)

# Route definitions — each router mounted at /api/<prefix> and /<prefix>
routers_list = [
    (health.router, "health"),
    (auth.router, "auth"),
    (users.router, "users"),
    (environment.router, "environment"),
    (recommendations.router, "recommendations"),
    (plants.router, "plants"),
    (growth.router, "growth"),       # Fixed: was colliding with plants on /plants
    (rewards.router, "rewards"),
    (drives.router, "drives"),
    (news.router, "news"),
    (dashboard.router, "dashboard"),
]

for router_obj, prefix in routers_list:
    app.include_router(router_obj, prefix=f"/api/{prefix}", tags=[prefix])
    app.include_router(router_obj, prefix=f"/{prefix}", tags=[prefix])

@app.get("/")
def root():
    return {"message": "GreenXchange API", "status": "online", "version": "1.0.0"}
