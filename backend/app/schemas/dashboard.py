from pydantic import BaseModel
from typing import Any, Optional, List
from app.schemas.plants import PlantPortfolioResponse
from app.schemas.drives import DriveResponse
from app.schemas.news import NewsFeedResponse

class DashboardModule(BaseModel):
    stale: bool
    data: Optional[Any] = None

class DashboardPlants(DashboardModule):
    data: Optional[List[PlantPortfolioResponse]] = None

class DashboardRewards(DashboardModule):
    data: Optional[dict] = None  # { balance: int }

class DashboardDrives(DashboardModule):
    data: Optional[List[DriveResponse]] = None

class DashboardNews(DashboardModule):
    data: Optional[List[NewsFeedResponse]] = None

class DashboardResponse(BaseModel):
    user: dict  # User info (non-failing)
    environment: DashboardModule
    plants: DashboardPlants
    rewards: DashboardRewards
    drives: DashboardDrives
    news: DashboardNews
