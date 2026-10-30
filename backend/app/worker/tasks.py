import json
import os
import redis
import asyncio
from sqlalchemy import select
from app.worker.celery_app import celery_app
from app.services.environment import sync_generate_environment_profile
from app.utils.geo import get_tile_id

redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
redis_client = redis.from_url(redis_url, decode_responses=True)

@celery_app.task
def refresh_environment_profile(lat: float, lng: float, tile_id: str):
    profile = sync_generate_environment_profile(lat, lng)
    # Store in Redis with TTL 3600 seconds
    redis_client.setex(f"env:profile:{tile_id}", 3600, json.dumps(profile))
    return f"Refreshed profile for {tile_id}"

async def get_active_locations():
    from app.db.session import AsyncSessionLocal
    from app.models.users import User
    
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(User).filter(
                User.is_active == True,
                User.location_lat != None,
                User.location_lng != None
            )
        )
        return result.scalars().all()

@celery_app.task
def refresh_active_locations():
    users = asyncio.run(get_active_locations())
    
    # Deduplicate to unique tiles
    unique_tiles = {}
    for user in users:
        tile_id = get_tile_id(user.location_lat, user.location_lng)
        if tile_id and tile_id not in unique_tiles:
            unique_tiles[tile_id] = (user.location_lat, user.location_lng)
    
    # Dispatch tasks
    for tile_id, (lat, lng) in unique_tiles.items():
        refresh_environment_profile.delay(lat, lng, tile_id)
        
    return f"Dispatched {len(unique_tiles)} environment refreshes."

# Kept as safe no-ops so already queued legacy jobs cannot bypass human review.
@celery_app.task
def verify_growth_update(update_id: str):
    return "Submission requires an audited review decision"


@celery_app.task
def process_verified_reward(user_id_str: str, plant_id_str: str):
    return "Rewards are issued atomically by the review workflow"
