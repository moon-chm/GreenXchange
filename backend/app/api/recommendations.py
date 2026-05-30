import json
from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import get_current_user
from app.models.users import User
from app.schemas.recommendation import RecommendationRequest, SpeciesCard
from app.services.recommendation.engine import RecommendationEngine
from app.api.deps import get_db
import redis.asyncio as redis
from app.core.config import settings
from app.utils.geo import get_tile_id

router = APIRouter()
redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True)

@router.post("/", response_model=List[SpeciesCard])
async def get_recommendations(
    req: RecommendationRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    tile_id = get_tile_id(req.lat, req.lng)
    
    # Get environment profile from Redis
    cache_key = f"env:profile:{tile_id}"
    cached_data = await redis_client.get(cache_key)
    env_profile = {}
    if cached_data:
        env_profile = json.loads(cached_data)
        
    engine = RecommendationEngine(db)
    return await engine.run(req, env_profile)
