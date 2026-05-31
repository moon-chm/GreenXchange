from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, text, case
from typing import List, Optional
from datetime import datetime, timezone

from app.api.deps import get_db, get_current_admin_user
from app.models.users import User
from app.models.news import NewsFeedItem
from app.models.enums import NewsCategory
from app.schemas.news import NewsCreate, NewsFeedResponse

router = APIRouter()

@router.post("", response_model=NewsFeedResponse, status_code=status.HTTP_201_CREATED)
async def create_news_item(
    news_in: NewsCreate,
    current_user: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db)
):
    point = None
    if news_in.lat is not None and news_in.lng is not None:
        point = f"SRID=4326;POINT({news_in.lng} {news_in.lat})"
        
    new_item = NewsFeedItem(
        title=news_in.title,
        content_summary=news_in.content_summary,
        source_url=news_in.source_url,
        category=news_in.category,
        tags=news_in.tags,
        location_scope=point,
        published_at=datetime.now(timezone.utc),
        relevance_score=news_in.relevance_score
    )
    db.add(new_item)
    await db.commit()
    await db.refresh(new_item)
    
    return NewsFeedResponse(
        id=new_item.id,
        title=new_item.title,
        content_summary=new_item.content_summary,
        source_url=new_item.source_url,
        category=new_item.category,
        tags=new_item.tags,
        published_at=new_item.published_at,
        dynamic_score=new_item.relevance_score,
        is_local=point is not None
    )

from geoalchemy2 import Geography

@router.get("/feed", response_model=List[NewsFeedResponse])
async def get_news_feed(
    lat: Optional[float] = Query(None),
    lng: Optional[float] = Query(None),
    category: Optional[NewsCategory] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    # Default fallback if location not supplied yet
    actual_lat = lat if lat is not None else 0.0
    actual_lng = lng if lng is not None else 0.0

    # User's location geography
    user_location = f"SRID=4326;POINT({actual_lng} {actual_lat})"
    location_geog = func.ST_GeographyFromText(user_location)
    
    # Extract geography of the news item if it exists
    item_geog = func.cast(NewsFeedItem.location_scope, Geography(geometry_type='POINT', srid=4326))
    
    # Calculate distance (in meters). Default to large distance if global (no location_scope)
    distance = func.coalesce(func.ST_Distance(item_geog, location_geog), 10000000.0)
    
    # Geographic weight: max_distance = 1,000,000 meters (1000 km). 
    # Closer = higher score. Global = 0.5 flat score.
    # Note: distance / 1000000 can be > 1 if further than 1000km, so we use greatest to cap at 0
    max_dist = 1000000.0
    geo_weight = case(
        (NewsFeedItem.location_scope.is_(None), 0.5), # Global baseline
        else_=func.greatest(0, (max_dist - distance) / max_dist)
    )
    
    # Recency weight: 1 / (days_since_published + 1)
    # Using EXTRACT(EPOCH FROM ...) to get seconds, then convert to days
    age_seconds = func.extract('epoch', func.now() - NewsFeedItem.published_at)
    age_days = age_seconds / 86400.0
    recency_weight = 1.0 / (age_days + 1.0)
    
    # Total dynamic score
    dynamic_score = (geo_weight * 2.0) + recency_weight + (NewsFeedItem.relevance_score * 0.5)
    
    query = select(
        NewsFeedItem,
        dynamic_score.label('dynamic_score'),
        NewsFeedItem.location_scope.isnot(None).label('is_local')
    ).order_by(dynamic_score.desc()).limit(50)
    
    if category:
        query = query.filter(NewsFeedItem.category == category)
        
    result = await db.execute(query)
    
    feed = []
    for row in result:
        feed.append(NewsFeedResponse(
            id=row.NewsFeedItem.id,
            title=row.NewsFeedItem.title,
            content_summary=row.NewsFeedItem.content_summary,
            source_url=row.NewsFeedItem.source_url,
            category=row.NewsFeedItem.category,
            tags=row.NewsFeedItem.tags,
            published_at=row.NewsFeedItem.published_at,
            dynamic_score=float(row.dynamic_score),
            is_local=row.is_local
        ))
        
    return feed
