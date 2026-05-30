import uuid
from sqlalchemy import Column, String, DateTime, Enum, Float, ARRAY, text
from sqlalchemy.dialects.postgresql import UUID
from geoalchemy2 import Geometry
from app.models.base import Base
from app.models.enums import NewsCategory

class NewsFeedItem(Base):
    __tablename__ = "news_feed_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String, nullable=False)
    content_summary = Column(String, nullable=False)
    source_url = Column(String, nullable=False)
    
    category = Column(Enum(NewsCategory), nullable=False)
    tags = Column(ARRAY(String), nullable=False)
    
    location_scope = Column(Geometry(geometry_type='POINT', srid=4326), nullable=True)
    
    published_at = Column(DateTime(timezone=True), nullable=False)
    relevance_score = Column(Float, nullable=False)
