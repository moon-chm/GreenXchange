import os
from celery import Celery
from app.core.config import settings

redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")

celery_app = Celery(
    "worker",
    broker=redis_url,
    backend=redis_url,
    include=["app.worker.tasks"]
)

from celery.schedules import crontab

celery_app.conf.beat_schedule = {
    "refresh-active-locations-every-30-mins": {
        "task": "app.worker.tasks.refresh_active_locations",
        "schedule": crontab(minute="*/30"),
    },
}
