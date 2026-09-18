import os
from celery import Celery
from app.core.config import settings

redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")

celery_app = Celery(
    "worker",
    broker=redis_url,
    backend=redis_url,
    include=["app.worker.tasks", "app.worker.email_tasks"]
)

from celery.schedules import crontab

# NOTE: no `worker` or `beat` service is deployed in render.yaml, so a Celery
# beat schedule here would never actually run — nothing consumes it. The
# active-location refresh and weekly digest are currently handled by an
# in-process asyncio scheduler in app/main.py's lifespan instead (works on a
# single-instance deployment with no extra infra). If you deploy a real
# Celery worker + beat process, re-enable the entries below AND remove the
# corresponding loops from app/main.py first — running both would double-fire
# (duplicate weekly digest emails, redundant cache refreshes).
celery_app.conf.beat_schedule = {
    # "refresh-active-locations-every-30-mins": {
    #     "task": "app.worker.tasks.refresh_active_locations",
    #     "schedule": crontab(minute="*/30"),
    # },
    # "weekly-eco-digest-every-monday": {
    #     "task": "app.worker.email_tasks.task_send_weekly_digest",
    #     "schedule": crontab(minute=0, hour=9, day_of_week=1), # Every Monday 9 AM
    # },
}

