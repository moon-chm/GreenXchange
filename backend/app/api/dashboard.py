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

async def fetch_environment(lat, lng):
    # Call the external Open-Meteo API using httpx
    import httpx
    async with httpx.AsyncClient() as client:
        # Air Quality
        aqi_res = await client.get(
            "https://air-quality-api.open-meteo.com/v1/air-quality",
            params={
                "latitude": lat,
                "longitude": lng,
                "current": "us_aqi,pm10,pm2_5",
                "timezone": "auto"
            }
        )
        aqi_data = aqi_res.json()
        
        # Weather
        weather_res = await client.get(
            "https://api.open-meteo.com/v1/forecast",
            params={
                "latitude": lat,
                "longitude": lng,
                "current": "temperature_2m,relative_humidity_2m",
                "timezone": "auto"
            }
        )
        weather_data = weather_res.json()
        
    return {
        "aqi": aqi_data["current"]["us_aqi"],
        "temperature": weather_data["current"]["temperature_2m"],
        "humidity": weather_data["current"]["relative_humidity_2m"]
    }

async def fetch_plants(user_id, db):
    result = await db.execute(
        select(Plant)
        .options(selectinload(Plant.species))
        .filter(Plant.owner_id == user_id)
    )
    plants = result.scalars().all()
    return [
        {
            "id": str(p.id),
            "scan_id": p.scan_id,
            "species_name": p.species.common_name if p.species else "Unknown",
            "common_name": p.common_name,
            "planting_date": p.planting_date,
            "space_type": p.space_type
        }
        for p in plants
    ]

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
    point = f"SRID=4326;POINT({lng} {lat})"
    location_geog = func.ST_GeographyFromText(point)
    drive_geog = func.cast(CommunityDrive.location_center, literal_column('geography'))
    
    result = await db.execute(
        select(
            CommunityDrive,
            func.ST_Y(CommunityDrive.location_center).label('lat'),
            func.ST_X(CommunityDrive.location_center).label('lng'),
            func.ST_Distance(drive_geog, location_geog).label('distance')
        )
        .filter(func.ST_DWithin(drive_geog, location_geog, 50000))
        .order_by(text('distance ASC'))
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

async def safe_fetch(coro, timeout=2.0):
    try:
        data = await asyncio.wait_for(coro, timeout=timeout)
        return {"stale": False, "data": data}
    except Exception as e:
        logger.error(f"Dashboard module fetch failed: {e}")
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
