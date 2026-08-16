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

    yield

async def _seed_default_species():
    """Ensure at least the default plant species exist in the database."""
    import uuid as _uuid
    from app.db.session import AsyncSessionLocal
    from app.models.plants import PlantSpecies
    from sqlalchemy import select as _select

    DEFAULT_SPECIES = [
        {"common_name": "Neem Tree", "scientific_name": "Azadirachta indica", "genus": "Azadirachta", "family": "Meliaceae", "co2_absorption_rate": 21.8, "pm25_absorption_rate": 0.8, "voc_absorption_rate": 0.6, "toxicity_level": "NONE", "allergen_risk": "LOW", "maintenance_level": "LOW", "growth_rate": "FAST", "space_type_compatibility": ["outdoor"], "temperature_range": "20-40C", "soil_ph_range": "6.2-7.0"},
        {"common_name": "Tulsi (Holy Basil)", "scientific_name": "Ocimum tenuiflorum", "genus": "Ocimum", "family": "Lamiaceae", "co2_absorption_rate": 4.5, "pm25_absorption_rate": 0.3, "voc_absorption_rate": 0.5, "toxicity_level": "NONE", "allergen_risk": "LOW", "maintenance_level": "LOW", "growth_rate": "MODERATE", "space_type_compatibility": ["indoor", "outdoor", "balcony"], "temperature_range": "18-35C", "soil_ph_range": "6.0-7.5"},
        {"common_name": "Money Plant (Pothos)", "scientific_name": "Epipremnum aureum", "genus": "Epipremnum", "family": "Araceae", "co2_absorption_rate": 3.2, "pm25_absorption_rate": 0.4, "voc_absorption_rate": 0.7, "toxicity_level": "MILD", "allergen_risk": "LOW", "maintenance_level": "LOW", "growth_rate": "FAST", "space_type_compatibility": ["indoor", "balcony"], "temperature_range": "15-30C", "soil_ph_range": "6.1-6.8"},
        {"common_name": "Snake Plant", "scientific_name": "Sansevieria trifasciata", "genus": "Sansevieria", "family": "Asparagaceae", "co2_absorption_rate": 3.5, "pm25_absorption_rate": 0.5, "voc_absorption_rate": 0.9, "toxicity_level": "MILD", "allergen_risk": "LOW", "maintenance_level": "LOW", "growth_rate": "SLOW", "space_type_compatibility": ["indoor"], "temperature_range": "15-35C", "soil_ph_range": "5.5-7.0"},
        {"common_name": "Peace Lily", "scientific_name": "Spathiphyllum wallisii", "genus": "Spathiphyllum", "family": "Araceae", "co2_absorption_rate": 5.1, "pm25_absorption_rate": 0.6, "voc_absorption_rate": 1.1, "toxicity_level": "MILD", "allergen_risk": "MODERATE", "maintenance_level": "MODERATE", "growth_rate": "MODERATE", "space_type_compatibility": ["indoor"], "temperature_range": "16-30C", "soil_ph_range": "5.8-6.5"},
        {"common_name": "Aloe Vera", "scientific_name": "Aloe barbadensis miller", "genus": "Aloe", "family": "Asphodelaceae", "co2_absorption_rate": 2.8, "pm25_absorption_rate": 0.2, "voc_absorption_rate": 0.4, "toxicity_level": "MILD", "allergen_risk": "LOW", "maintenance_level": "LOW", "growth_rate": "SLOW", "space_type_compatibility": ["indoor", "balcony", "outdoor"], "temperature_range": "13-40C", "soil_ph_range": "7.0-8.5"},
        {"common_name": "Banana Tree", "scientific_name": "Musa acuminata", "genus": "Musa", "family": "Musaceae", "co2_absorption_rate": 35.0, "pm25_absorption_rate": 1.2, "voc_absorption_rate": 0.5, "toxicity_level": "NONE", "allergen_risk": "LOW", "maintenance_level": "MODERATE", "growth_rate": "FAST", "space_type_compatibility": ["outdoor"], "temperature_range": "18-38C", "soil_ph_range": "5.5-7.0"},
        {"common_name": "Jasmine", "scientific_name": "Jasminum officinale", "genus": "Jasminum", "family": "Oleaceae", "co2_absorption_rate": 5.5, "pm25_absorption_rate": 0.35, "voc_absorption_rate": 0.6, "toxicity_level": "NONE", "allergen_risk": "MODERATE", "maintenance_level": "MODERATE", "growth_rate": "MODERATE", "space_type_compatibility": ["outdoor", "balcony"], "temperature_range": "16-32C", "soil_ph_range": "6.0-7.5"},
        {"common_name": "Bamboo", "scientific_name": "Bambusa vulgaris", "genus": "Bambusa", "family": "Poaceae", "co2_absorption_rate": 30.0, "pm25_absorption_rate": 0.9, "voc_absorption_rate": 0.4, "toxicity_level": "NONE", "allergen_risk": "LOW", "maintenance_level": "LOW", "growth_rate": "FAST", "space_type_compatibility": ["outdoor"], "temperature_range": "15-40C", "soil_ph_range": "5.5-7.0"},
        {"common_name": "Mango Tree", "scientific_name": "Mangifera indica", "genus": "Mangifera", "family": "Anacardiaceae", "co2_absorption_rate": 40.0, "pm25_absorption_rate": 1.5, "voc_absorption_rate": 0.7, "toxicity_level": "NONE", "allergen_risk": "LOW", "maintenance_level": "LOW", "growth_rate": "SLOW", "space_type_compatibility": ["outdoor"], "temperature_range": "24-35C", "soil_ph_range": "5.5-7.5"},
        {"common_name": "Curry Leaf Plant", "scientific_name": "Murraya koenigii", "genus": "Murraya", "family": "Rutaceae", "co2_absorption_rate": 6.0, "pm25_absorption_rate": 0.4, "voc_absorption_rate": 0.5, "toxicity_level": "NONE", "allergen_risk": "LOW", "maintenance_level": "LOW", "growth_rate": "MODERATE", "space_type_compatibility": ["outdoor", "balcony"], "temperature_range": "16-38C", "soil_ph_range": "6.0-7.0"},
        {"common_name": "Spider Plant", "scientific_name": "Chlorophytum comosum", "genus": "Chlorophytum", "family": "Asparagaceae", "co2_absorption_rate": 4.0, "pm25_absorption_rate": 0.45, "voc_absorption_rate": 0.8, "toxicity_level": "NONE", "allergen_risk": "LOW", "maintenance_level": "LOW", "growth_rate": "FAST", "space_type_compatibility": ["indoor", "balcony"], "temperature_range": "13-27C", "soil_ph_range": "6.0-7.2"},
        {"common_name": "Rose", "scientific_name": "Rosa gallica", "genus": "Rosa", "family": "Rosaceae", "co2_absorption_rate": 3.0, "pm25_absorption_rate": 0.3, "voc_absorption_rate": 0.4, "toxicity_level": "NONE", "allergen_risk": "MODERATE", "maintenance_level": "HIGH", "growth_rate": "MODERATE", "space_type_compatibility": ["outdoor", "balcony"], "temperature_range": "10-30C", "soil_ph_range": "6.0-7.0"},
        {"common_name": "Ficus (Rubber Plant)", "scientific_name": "Ficus elastica", "genus": "Ficus", "family": "Moraceae", "co2_absorption_rate": 6.0, "pm25_absorption_rate": 0.5, "voc_absorption_rate": 0.8, "toxicity_level": "MILD", "allergen_risk": "MODERATE", "maintenance_level": "LOW", "growth_rate": "MODERATE", "space_type_compatibility": ["indoor"], "temperature_range": "15-30C", "soil_ph_range": "5.5-7.0"},
        {"common_name": "Hibiscus", "scientific_name": "Hibiscus rosa-sinensis", "genus": "Hibiscus", "family": "Malvaceae", "co2_absorption_rate": 7.0, "pm25_absorption_rate": 0.5, "voc_absorption_rate": 0.45, "toxicity_level": "NONE", "allergen_risk": "LOW", "maintenance_level": "MODERATE", "growth_rate": "FAST", "space_type_compatibility": ["outdoor", "balcony"], "temperature_range": "18-35C", "soil_ph_range": "6.0-7.0"},
        {"common_name": "Marigold", "scientific_name": "Tagetes erecta", "genus": "Tagetes", "family": "Asteraceae", "co2_absorption_rate": 2.0, "pm25_absorption_rate": 0.2, "voc_absorption_rate": 0.3, "toxicity_level": "NONE", "allergen_risk": "MODERATE", "maintenance_level": "LOW", "growth_rate": "FAST", "space_type_compatibility": ["outdoor", "balcony"], "temperature_range": "15-30C", "soil_ph_range": "5.8-7.0"},
        {"common_name": "Papaya Tree", "scientific_name": "Carica papaya", "genus": "Carica", "family": "Caricaceae", "co2_absorption_rate": 18.0, "pm25_absorption_rate": 0.7, "voc_absorption_rate": 0.4, "toxicity_level": "NONE", "allergen_risk": "LOW", "maintenance_level": "LOW", "growth_rate": "FAST", "space_type_compatibility": ["outdoor"], "temperature_range": "22-38C", "soil_ph_range": "6.0-6.5"},
        {"common_name": "Mint", "scientific_name": "Mentha spicata", "genus": "Mentha", "family": "Lamiaceae", "co2_absorption_rate": 1.5, "pm25_absorption_rate": 0.15, "voc_absorption_rate": 0.4, "toxicity_level": "NONE", "allergen_risk": "LOW", "maintenance_level": "LOW", "growth_rate": "FAST", "space_type_compatibility": ["indoor", "balcony", "outdoor"], "temperature_range": "15-30C", "soil_ph_range": "6.0-7.0"},
        {"common_name": "Bougainvillea", "scientific_name": "Bougainvillea spectabilis", "genus": "Bougainvillea", "family": "Nyctaginaceae", "co2_absorption_rate": 8.0, "pm25_absorption_rate": 0.5, "voc_absorption_rate": 0.4, "toxicity_level": "MILD", "allergen_risk": "LOW", "maintenance_level": "LOW", "growth_rate": "FAST", "space_type_compatibility": ["outdoor", "balcony"], "temperature_range": "18-35C", "soil_ph_range": "5.5-6.0"},
        {"common_name": "Ashoka Tree", "scientific_name": "Saraca asoca", "genus": "Saraca", "family": "Fabaceae", "co2_absorption_rate": 22.0, "pm25_absorption_rate": 0.9, "voc_absorption_rate": 0.5, "toxicity_level": "NONE", "allergen_risk": "LOW", "maintenance_level": "LOW", "growth_rate": "SLOW", "space_type_compatibility": ["outdoor"], "temperature_range": "18-38C", "soil_ph_range": "6.0-7.5"},
    ]

    async with AsyncSessionLocal() as session:
        result = await session.execute(_select(PlantSpecies).limit(1))
        if result.scalar_one_or_none() is not None:
            return  # Already seeded

        from app.models.enums import ToxicityLevel, AllergenRisk, MaintenanceLevel, GrowthRate, SpaceType
        enum_map = {
            "toxicity_level": ToxicityLevel,
            "allergen_risk": AllergenRisk,
            "maintenance_level": MaintenanceLevel,
            "growth_rate": GrowthRate,
        }
        space_map = {
            "indoor": SpaceType.indoor,
            "outdoor": SpaceType.outdoor,
            "balcony": SpaceType.balcony,
            "community": SpaceType.community,
        }

        for s in DEFAULT_SPECIES:
            sp = PlantSpecies(
                id=_uuid.uuid4(),
                common_name=s["common_name"],
                scientific_name=s["scientific_name"],
                genus=s["genus"],
                family=s["family"],
                co2_absorption_rate=s.get("co2_absorption_rate"),
                pm25_absorption_rate=s.get("pm25_absorption_rate"),
                voc_absorption_rate=s.get("voc_absorption_rate"),
                toxicity_level=ToxicityLevel(s["toxicity_level"]),
                allergen_risk=AllergenRisk(s["allergen_risk"]),
                maintenance_level=MaintenanceLevel(s["maintenance_level"]),
                growth_rate=GrowthRate(s["growth_rate"]),
                space_type_compatibility=[space_map[x] for x in s.get("space_type_compatibility", [])],
                temperature_range=s.get("temperature_range"),
                soil_ph_range=s.get("soil_ph_range"),
                data_source="GreenXchange Default Seed v1",
            )
            session.add(sp)
        await session.commit()
        logger.info(f"✅ Seeded {len(DEFAULT_SPECIES)} default plant species.")

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
