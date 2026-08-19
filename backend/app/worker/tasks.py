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

async def run_verification(update_id_str: str):
    from app.db.session import AsyncSessionLocal
    from app.models.growth import GrowthUpdate
    from app.models.enums import VerificationStatus
    from app.services.cv.models import get_cv_model
    import uuid
    
    cv_model = get_cv_model()
    
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(GrowthUpdate).filter(GrowthUpdate.id == uuid.UUID(update_id_str))
        )
        update = result.scalars().first()
        if not update:
            return
            
        from app.services.media import minio_client, BUCKET_NAME
        
        obj_name = update.image_url.split("/")[-1]
        
        try:
            from app.models.plants import Plant
            plant_result = await session.execute(select(Plant).filter(Plant.id == update.plant_id))
            plant = plant_result.scalars().first()
            
            response = minio_client.get_object(BUCKET_NAME, obj_name)
            image_bytes = response.read()
            response.close()
            response.release_conn()
            
            # Run comprehensive 4-pillar dual PyTorch CV verification
            analysis = cv_model.analyze_plant_image(image_bytes)
            
            is_verified = analysis.get("is_verified", False)
            tree_conf = analysis.get("tree_confidence", 0.95)
            health_status = analysis.get("health_status", "Healthy")
            growth_stage = analysis.get("growth_stage", "Vegetative")
            summary_reason = analysis.get("summary_reason", "")
            
            if is_verified:
                update.verification_status = VerificationStatus.VERIFIED
                update.confidence_score = round(tree_conf, 4)
                update.growth_stage_label = f"{growth_stage} ({health_status})"
                update.cv_model_version = "resnet18-dual-v1"
                update.rejection_reason = None
            else:
                update.verification_status = VerificationStatus.REJECTED
                update.confidence_score = round(tree_conf, 4)
                update.growth_stage_label = growth_stage
                update.cv_model_version = "resnet18-dual-v1"
                update.rejection_reason = summary_reason or "Automated CV verification checks failed"
                
            await session.commit()
            
            if is_verified and plant:
                process_verified_reward.delay(str(plant.owner_id), str(plant.id))
                
        except Exception as e:
            update.verification_status = VerificationStatus.MANUAL_REVIEW
            update.rejection_reason = f"Error processing: {str(e)}"
            await session.commit()

@celery_app.task
def verify_growth_update(update_id: str):
    asyncio.run(run_verification(update_id))
    return f"Verified {update_id}"

@celery_app.task
def process_verified_reward(user_id_str: str, plant_id_str: str):
    from app.services.rewards import credit_growth_update_reward
    from app.db.session import AsyncSessionLocal
    import uuid
    
    async def _run():
        async with AsyncSessionLocal() as session:
            await credit_growth_update_reward(
                session, 
                uuid.UUID(user_id_str), 
                uuid.UUID(plant_id_str)
            )
            
    asyncio.run(_run())
    return f"Processed reward for User:{user_id_str} Plant:{plant_id_str}"

