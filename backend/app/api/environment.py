import json
import time
from fastapi import APIRouter, Depends, Query
from app.api.deps import get_current_user
from app.models.users import User
from app.utils.geo import get_tile_id
from app.worker.tasks import refresh_environment_profile
from app.services.environment import generate_environment_profile
import redis.asyncio as redis
from app.core.config import settings

router = APIRouter()
redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True)

@router.get("/profile")
async def get_environment_profile(
    lat: float = Query(..., description="Latitude"),
    lng: float = Query(..., description="Longitude"),
    current_user: User = Depends(get_current_user)
):
    tile_id = get_tile_id(lat, lng)
    if not tile_id:
        return {"error": "Invalid coordinates"}
        
    cache_key = f"env:profile:{tile_id}"
    cached_data = await redis_client.get(cache_key)
    
    if cached_data:
        profile = json.loads(cached_data)
        updated_at = profile.get("updated_at", 0)
        age = int(time.time()) - updated_at
        
        # Stale if older than 1800s (30 minutes)
        if age > 1800:
            profile["stale"] = True
            # Trigger async refresh
            refresh_environment_profile.delay(lat, lng, tile_id)
            
        return profile
    
    # Cache miss: generate, save, and return
    profile = await generate_environment_profile(lat, lng)
    await redis_client.setex(cache_key, 172800, json.dumps(profile))  # 48 hours TTL
    return profile
