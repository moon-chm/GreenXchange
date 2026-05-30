from pydantic import BaseModel, UUID4, Field
from datetime import datetime
from typing import Optional, List
from app.models.enums import NewsCategory

class NewsCreate(BaseModel):
    title: str = Field(..., max_length=200)
    content_summary: str
    source_url: str
    category: NewsCategory
    tags: List[str]
    lat: Optional[float] = None
    lng: Optional[float] = None
    relevance_score: float = 1.0

class NewsFeedResponse(BaseModel):
    id: UUID4
    title: str
    content_summary: str
    source_url: str
    category: NewsCategory
    tags: List[str]
    published_at: datetime
    dynamic_score: float
    is_local: bool
    
    class Config:
        from_attributes = True
