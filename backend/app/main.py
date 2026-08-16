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
    yield

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
