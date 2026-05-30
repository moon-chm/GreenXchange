import asyncio
from datetime import datetime, timezone, timedelta
from app.db.session import AsyncSessionLocal
from sqlalchemy import text
from app.models.news import NewsFeedItem
from app.models.enums import NewsCategory

async def main():
    print("Testing News Feed Relevance Scoring...")
    
    async with AsyncSessionLocal() as session:
        try:
            # Clear old news items to ensure clean test
            await session.execute(text("DELETE FROM news_feed_items"))
            await session.commit()
            
            # Create a "Global" news item (no location scope) published yesterday
            global_news = NewsFeedItem(
                title="Global Carbon Emissions Report",
                content_summary="New study reveals global carbon trends.",
                source_url="http://example.com/global",
                category=NewsCategory.ENVIRONMENT,
                tags=["global", "report"],
                location_scope=None,
                published_at=datetime.now(timezone.utc) - timedelta(days=1),
                relevance_score=1.0
            )
            
            # Create a "Local" news item (London) published yesterday
            lon_lat = (51.5072, -0.1276) # London
            local_news = NewsFeedItem(
                title="London Local Action",
                content_summary="Mayor announces new green zones.",
                source_url="http://example.com/london",
                category=NewsCategory.COMMUNITY,
                tags=["london", "policy"],
                location_scope=f"SRID=4326;POINT({lon_lat[1]} {lon_lat[0]})",
                published_at=datetime.now(timezone.utc) - timedelta(days=1),
                relevance_score=1.0
            )
            
            # Create a "Distant Local" news item (Sydney) published just now
            syd_lat = (-33.8688, 151.2093) # Sydney
            distant_news = NewsFeedItem(
                title="Sydney Renewable Milestone",
                content_summary="Sydney hits 100% renewable power.",
                source_url="http://example.com/sydney",
                category=NewsCategory.ENVIRONMENT,
                tags=["sydney", "milestone"],
                location_scope=f"SRID=4326;POINT({syd_lat[1]} {syd_lat[0]})",
                published_at=datetime.now(timezone.utc), # Fresher!
                relevance_score=1.0
            )
            
            session.add_all([global_news, local_news, distant_news])
            await session.commit()
            
            # Test: Query as a user in London
            print("Querying news feed for user in London...")
            from app.api.news import get_news_feed
            feed = await get_news_feed(lat=51.5072, lng=-0.1276, category=None, db=session)
            
            for idx, item in enumerate(feed):
                print(f"{idx+1}. [{item.dynamic_score:.2f}] {item.title} (Local: {item.is_local})")
                
            # Assertions
            if feed[0].title != "London Local Action":
                print("FAILURE: Local news was not ranked #1 for a local user.")
            else:
                print("SUCCESS: Local news properly boosted based on geographic weight!")
                
            if feed[1].title != "Global Carbon Emissions Report":
                print("FAILURE: Global news was not ranked #2.")
            else:
                print("SUCCESS: Global news correctly ranked.")
                
            if feed[2].title != "Sydney Renewable Milestone":
                print("FAILURE: Distant news was not ranked #3.")
            else:
                print("SUCCESS: Distant news severely penalized by geo-weight despite recency!")
                
        finally:
            print("Cleaning up test records...")
            await session.execute(text("DELETE FROM news_feed_items"))
            await session.commit()

if __name__ == "__main__":
    asyncio.run(main())
