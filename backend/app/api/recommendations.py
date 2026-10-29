import json
import logging
from redis.exceptions import RedisError
from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import get_current_user
from app.models.users import User
from app.schemas.recommendation import RecommendationRequest, SpeciesCard, PlantAnalysisRequest, PlantAnalysisResponse
from app.services.recommendation.engine import RecommendationEngine
from app.services.environment import generate_environment_profile
from app.api.deps import get_db
import redis.asyncio as redis
from app.core.config import settings
from app.utils.geo import get_tile_id

router = APIRouter()
logger = logging.getLogger(__name__)
redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True, socket_connect_timeout=2, socket_timeout=2) if settings.REDIS_URL else None

async def get_or_create_env_profile(lat: float, lng: float) -> dict:
    tile_id = get_tile_id(lat, lng)
    cache_key = f"env:profile:{tile_id}"
    if redis_client is not None:
        try:
            cached_data = await redis_client.get(cache_key)
            if cached_data:
                profile = json.loads(cached_data)
                if isinstance(profile, dict) and isinstance(profile.get("weather"), dict):
                    return profile
        except (RedisError, ValueError, TypeError):
            logger.warning("Recommendation environment cache unavailable; fetching fresh data")
    profile = await generate_environment_profile(lat, lng)
    if redis_client is not None:
        try:
            await redis_client.setex(cache_key, 3600, json.dumps(profile))
        except RedisError:
            logger.warning("Could not cache recommendation environment data")
    return profile

@router.post("/", response_model=List[SpeciesCard])
async def get_recommendations(
    req: RecommendationRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    env_profile = await get_or_create_env_profile(req.lat, req.lng)
    engine = RecommendationEngine(db)
    return await engine.run(req, env_profile)


@router.post("/analyze", response_model=PlantAnalysisResponse)
async def analyze_plant(
    req: PlantAnalysisRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    env_profile = await get_or_create_env_profile(req.lat, req.lng)
    engine = RecommendationEngine(db)
    return await engine.analyze_plant_suitability(req, env_profile)


