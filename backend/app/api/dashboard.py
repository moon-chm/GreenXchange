import asyncio
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, text, case, literal_column
from sqlalchemy.orm import selectinload
import logging

from app.api.deps import get_db, get_current_user
from app.models.users import User
from app.models.plants import Plant
from app.models.rewards import RewardTransaction
from app.models.community import CommunityDrive
from app.models.news import NewsFeedItem
from geoalchemy2 import Geography
from app.schemas.dashboard import (
    DashboardResponse, DashboardPlants, DashboardRewards, DashboardDrives, DashboardNews, DashboardModule
)

router = APIRouter()
logger = logging.getLogger(__name__)

import redis.asyncio as redis
from app.core.config import settings
from app.utils.geo import get_tile_id
from app.services.environment import generate_environment_profile

redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True)

async def fetch_environment(lat, lng):
    tile_id = get_tile_id(lat, lng)
    cache_key = f"env:profile:{tile_id}"
    
    # Check for live hardware reading first
    hardware_dict = None
    try:
        hw_raw = await redis_client.get("env:hardware:latest")
        if hw_raw:
            import json, time
            hw_data = json.loads(hw_raw)
            age = int(time.time()) - hw_data.get("timestamp", 0)
            if age <= 300:
                hardware_dict = {
                    "connected": age <= 120,
                    "device_id": hw_data.get("device_id", "Arduino Nano"),
                    "aqi": hw_data.get("aqi", 30),
                    "co2_ppm": hw_data.get("mq135_co2", 1.33),
                    "co_ppm": hw_data.get("mq7_co", 2.63),
                    "smoke_ppm": hw_data.get("mq2_smoke", 0.00),
                    "co_aqi": hw_data.get("co_aqi", 30),
                    "smoke_aqi": hw_data.get("smoke_aqi", 0),
                    "air_quality_status": hw_data.get("air_quality_status", "GOOD"),
                    "alert_level": hw_data.get("alert_level", 140),
                    "buzzer_active": hw_data.get("buzzer_active", False),
                    "timestamp": hw_data.get("timestamp")
                }
    except Exception as e:
        logger.warning(f"Redis hardware lookup failed ({e})")

    base_env = None
    try:
        cached_data = await redis_client.get(cache_key)
        if cached_data:
            import json
            profile = json.loads(cached_data)
            weather = profile.get("weather", {})
            air_quality = profile.get("air_quality", {})
            base_env = {
                "aqi": air_quality.get("aqi", 25),
                "pm25": air_quality.get("pm25", 8.5),
                "temperature": weather.get("temperature", 24.5),
                "humidity": weather.get("humidity", 60)
            }
    except Exception as e:
        logger.warning(f"Redis cache lookup failed for telemetry ({e})")

    if not base_env:
        # Call Open-Meteo service with fallback
        profile = await generate_environment_profile(lat, lng)
        try:
            import json
            await redis_client.setex(cache_key, 600, json.dumps(profile))
        except Exception:
            pass

        weather = profile.get("weather", {})
        air_quality = profile.get("air_quality", {})
        base_env = {
            "aqi": air_quality.get("aqi", 25),
            "pm25": air_quality.get("pm25", 8.5),
            "temperature": weather.get("temperature", 24.5),
            "humidity": weather.get("humidity", 60)
        }

    # Override AQI if hardware telemetry is actively connected
    if hardware_dict and hardware_dict.get("connected"):
        base_env["aqi"] = hardware_dict["aqi"]

    base_env["hardware"] = hardware_dict
    return base_env

from app.models.growth import GrowthUpdate

async def fetch_plants(user_id, db):
    result = await db.execute(
        select(
            Plant,
            func.ST_Y(Plant.registered_location).label("lat"),
            func.ST_X(Plant.registered_location).label("lng")
        )
        .options(selectinload(Plant.species), selectinload(Plant.growth_updates))
        .filter(Plant.owner_id == user_id)
    )
    rows = result.all()

    plants_data = []
    for row in rows:
        plant = row.Plant
        latest_gu = plant.growth_updates[0] if (hasattr(plant, "growth_updates") and plant.growth_updates) else None
        status_str = latest_gu.verification_status.value.lower() if latest_gu else "verified"

        plants_data.append({
            "id": str(plant.id),
            "scan_id": plant.scan_id,
            "species_name": plant.species.common_name if plant.species else "Unknown",
            "common_name": plant.common_name,
            "planting_date": plant.planting_date,
            "space_type": plant.space_type,
            "lat": row.lat,
            "lng": row.lng,
            "status": status_str,
            "image_url": plant.image_url
        })


    return plants_data



async def fetch_rewards(user_id, db):
    result = await db.execute(
        select(RewardTransaction.balance_snapshot)
        .filter(RewardTransaction.user_id == user_id)
        .order_by(RewardTransaction.created_at.desc())
        .limit(1)
    )
    balance = result.scalar() or 0
    return {"balance": balance}

async def fetch_drives(lat, lng, db):
    from geoalchemy2 import Geography

    point = f"SRID=4326;POINT({lng} {lat})"
    location_geog = func.ST_GeographyFromText(point)
    drive_geog = func.cast(CommunityDrive.location_center, Geography)
    
    result = await db.execute(
        select(
            CommunityDrive,
            func.ST_Y(CommunityDrive.location_center).label('lat'),
            func.ST_X(CommunityDrive.location_center).label('lng'),
            func.ST_Distance(drive_geog, location_geog).label('distance')
        )
        .filter(func.ST_DWithin(drive_geog, location_geog, 50000))
        .order_by(literal_column('distance').asc())
        .limit(3) # Just top 3 for dashboard
    )
    
    return [
        {
            "id": r.CommunityDrive.id,
            "organizer_id": r.CommunityDrive.organizer_id,
            "title": r.CommunityDrive.title,
            "description": r.CommunityDrive.description,
            "radius_meters": r.CommunityDrive.radius_meters,
            "start_date": r.CommunityDrive.start_date,
            "end_date": r.CommunityDrive.end_date,
            "participant_count": r.CommunityDrive.participant_count,
            "lat": r.lat,
            "lng": r.lng,
            "distance_meters": r.distance
        } for r in result
    ]

async def fetch_news(lat, lng, db):
    user_location = f"SRID=4326;POINT({lng} {lat})"
    location_geog = func.ST_GeographyFromText(user_location)
    item_geog = func.cast(NewsFeedItem.location_scope, Geography(geometry_type='POINT', srid=4326))
    
    distance = func.coalesce(func.ST_Distance(item_geog, location_geog), 10000000.0)
    geo_weight = case(
        (NewsFeedItem.location_scope.is_(None), 0.5),
        else_=func.greatest(0, (1000000.0 - distance) / 1000000.0)
    )
    age_seconds = func.extract('epoch', func.now() - NewsFeedItem.published_at)
    age_days = age_seconds / 86400.0
    recency_weight = 1.0 / (age_days + 1.0)
    
    dynamic_score = (geo_weight * 2.0) + recency_weight + (NewsFeedItem.relevance_score * 0.5)
    
    result = await db.execute(
        select(
            NewsFeedItem,
            dynamic_score.label('dynamic_score'),
            NewsFeedItem.location_scope.isnot(None).label('is_local')
        ).order_by(dynamic_score.desc()).limit(3) # Top 3 for dashboard
    )
    
    return [
        {
            "id": r.NewsFeedItem.id,
            "title": r.NewsFeedItem.title,
            "content_summary": r.NewsFeedItem.content_summary,
            "source_url": r.NewsFeedItem.source_url,
            "category": r.NewsFeedItem.category,
            "tags": r.NewsFeedItem.tags,
            "published_at": r.NewsFeedItem.published_at,
            "dynamic_score": float(r.dynamic_score),
            "is_local": r.is_local
        } for r in result
    ]

async def safe_fetch(coro, timeout=5.0):
    try:
        data = await asyncio.wait_for(coro, timeout=timeout)
        return {"stale": False, "data": data}
    except Exception as e:
        logger.error(f"Dashboard module fetch failed ({type(e).__name__}): {e}")
        return {"stale": True, "data": None}

@router.get("", response_model=DashboardResponse)
async def get_dashboard(
    lat: float = Query(None),
    lng: float = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    use_lat = lat if lat is not None else (current_user.location_lat or 51.5072)
    use_lng = lng if lng is not None else (current_user.location_lng or -0.1276)
    
    results = await asyncio.gather(
        safe_fetch(fetch_environment(use_lat, use_lng)),
        safe_fetch(fetch_plants(current_user.id, db)),
        safe_fetch(fetch_rewards(current_user.id, db)),
        safe_fetch(fetch_drives(use_lat, use_lng, db)),
        safe_fetch(fetch_news(use_lat, use_lng, db))
    )
    
    env_res, plants_res, rewards_res, drives_res, news_res = results
    
    user_info = {
        "id": current_user.id,
        "name": current_user.name,
        "location_lat": use_lat,
        "location_lng": use_lng
    }
    
    return DashboardResponse(
        user=user_info,
        environment=DashboardModule(**env_res),
        plants=DashboardPlants(**plants_res),
        rewards=DashboardRewards(**rewards_res),
        drives=DashboardDrives(**drives_res),
        news=DashboardNews(**news_res)
    )
