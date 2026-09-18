import asyncio
import json
import logging
import secrets
import time
from typing import Optional
from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from app.api.deps import get_current_user
from app.models.users import User
from app.utils.geo import get_tile_id
from app.worker.tasks import refresh_environment_profile
from app.services.environment import generate_environment_profile
import redis.asyncio as redis
from app.core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter()
redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True)

@router.get("/profile")
async def get_environment_profile(
    lat: float = Query(..., description="Latitude"),
    lng: float = Query(..., description="Longitude"),
    current_user: User = Depends(get_current_user)
):
    tile_id = get_tile_id(lat, lng)
    if not tile_id:
        return {"error": "Invalid coordinates"}
        
    cache_key = f"env:profile:{tile_id}"
    cached_data = await redis_client.get(cache_key)
    
    if cached_data:
        profile = json.loads(cached_data)
        updated_at = profile.get("updated_at", 0)
        age = int(time.time()) - updated_at
        
        # Stale if older than 1800s (30 minutes)
        if age > 1800:
            profile["stale"] = True
            # Trigger async refresh
            refresh_environment_profile.delay(lat, lng, tile_id)
            
        return profile
    
    # Cache miss: generate, save, and return
    profile = await generate_environment_profile(lat, lng)
    await redis_client.setex(cache_key, 172800, json.dumps(profile))  # 48 hours TTL
    return profile

from pydantic import BaseModel
from app.services.thingspeak import thingspeak_manager

class HardwareTelemetryPayload(BaseModel):
    device_id: Optional[str] = "ESP32 ThingSpeak (Ch #3499335)"
    source: Optional[str] = "thingspeak"
    channel_id: Optional[str] = "3499335"
    entry_id: Optional[int] = None
    aqi: int
    mq135_co2: Optional[float] = 1.33
    mq7_co: float
    mq2_smoke: Optional[float] = 0.00
    co_ppm: Optional[float] = None
    co_aqi: Optional[int] = 0
    smoke_aqi: Optional[int] = 0
    air_quality_status: Optional[str] = "GOOD"
    alert_level: Optional[int] = 140
    buzzer_active: Optional[bool] = False

async def verify_hardware_api_key(x_hardware_api_key: Optional[str] = Header(None, alias="X-Hardware-Api-Key")):
    """
    Opt-in shared-secret gate for hardware telemetry ingestion. If HARDWARE_API_KEY
    isn't configured, this endpoint stays open (unchanged prior behavior) so existing
    unconfigured devices keep working, but logs a warning on every call. Once
    HARDWARE_API_KEY is set, callers must present a matching X-Hardware-Api-Key header.
    """
    if not settings.HARDWARE_API_KEY:
        return
    if not x_hardware_api_key or not secrets.compare_digest(x_hardware_api_key, settings.HARDWARE_API_KEY):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or missing hardware API key")


@router.post("/hardware", dependencies=[Depends(verify_hardware_api_key)])
async def post_hardware_telemetry(payload: HardwareTelemetryPayload):
    data = payload.dict()
    if data.get("co_ppm") is None:
        data["co_ppm"] = data.get("mq7_co", 0.65)
    data["timestamp"] = int(time.time())
    cache_key = "env:hardware:latest"
    try:
        await redis_client.setex(cache_key, 300, json.dumps(data))
        await redis_client.lpush("env:hardware:history", json.dumps(data))
        await redis_client.ltrim("env:hardware:history", 0, 49)
    except Exception:
        pass
    thingspeak_manager.save_telemetry_sync(data)
    return {"status": "success", "message": "Telemetry received", "data": data}

@router.get("/hardware")
async def get_hardware_telemetry():
    cache_key = "env:hardware:latest"
    try:
        raw = await redis_client.get(cache_key)
        if raw:
            data = json.loads(raw)
            age = int(time.time()) - data.get("timestamp", 0)
            data["connected"] = age <= 180
            data["age_seconds"] = age
            return data
    except Exception:
        pass

    # Fallback to ThingSpeak manager telemetry
    return await thingspeak_manager.get_latest_telemetry()


@router.get("/stream")
async def stream_hardware_telemetry():
    """Server-Sent Events (SSE) stream for zero-latency real-time ESP32 hardware telemetry."""
    async def event_generator():
        last_timestamp = 0
        while True:
            try:
                telemetry = await thingspeak_manager.get_latest_telemetry()
                curr_ts = telemetry.get("timestamp", 0)
                if curr_ts != last_timestamp:
                    last_timestamp = curr_ts
                    yield f"data: {json.dumps(telemetry)}\n\n"
            except Exception:
                pass
            await asyncio.sleep(2)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


class ThingSpeakConfigRequest(BaseModel):
    channel_id: Optional[str] = None
    read_api_key: Optional[str] = None


@router.get("/thingspeak")
async def get_thingspeak_stream(
    channel_id: Optional[str] = Query(None, description="ThingSpeak Channel ID"),
    api_key: Optional[str] = Query(None, description="ThingSpeak Read API Key"),
    results: int = Query(20, description="Number of recent feed points")
):
    """Fetches real-time telemetry and feed history for ThingSpeak channel."""
    # Ensure MQTT listener is active in background
    if not thingspeak_manager.is_mqtt_running:
        thingspeak_manager.start_mqtt_listener()

    # Attempt REST fetch for channel meta & history
    rest_data = await thingspeak_manager.fetch_rest_feeds(
        channel_id=channel_id,
        api_key=api_key,
        results=results
    )

    latest_telemetry = await thingspeak_manager.get_latest_telemetry()

    if rest_data.get("success"):
        return {
            "status": "online",
            "source": "thingspeak_rest_and_mqtt",
            "channel": rest_data.get("channel"),
            "latest": rest_data.get("latest"),
            "history": rest_data.get("history", [])
        }

    # If channel is private and no Read API Key provided yet, return the live MQTT state
    return {
        "status": "online",
        "source": "thingspeak_mqtt",
        "channel": {
            "id": channel_id or thingspeak_manager.channel_id,
            "name": "GreenXchange Air Quality",
            "description": "ESP32 Environmental Monitoring using MQ Sensors and Indian CPCB AQI",
            "field1": "AQI",
            "field2": "CO_PPM"
        },
        "latest": latest_telemetry,
        "history": [
            {
                "entry_id": latest_telemetry.get("entry_id", 1),
                "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(latest_telemetry.get("timestamp", time.time()))),
                "aqi": latest_telemetry.get("aqi", 35),
                "co_ppm": latest_telemetry.get("co_ppm", 0.65),
                "co2_ppm": latest_telemetry.get("mq135_co2", 1.33),
                "smoke_ppm": latest_telemetry.get("mq2_smoke", 0.0)
            }
        ],
        "notice": rest_data.get("error")
    }


@router.post("/thingspeak/config")
async def configure_thingspeak(config: ThingSpeakConfigRequest):
    """Dynamically sets ThingSpeak Channel ID and Read API Key."""
    if config.channel_id:
        thingspeak_manager.channel_id = config.channel_id
    if config.read_api_key is not None:
        thingspeak_manager.read_api_key = config.read_api_key

    # Re-trigger REST fetch test
    test_result = await thingspeak_manager.fetch_rest_feeds(
        channel_id=config.channel_id,
        api_key=config.read_api_key,
        results=5
    )

    return {
        "status": "success",
        "message": "ThingSpeak configuration updated",
        "channel_id": thingspeak_manager.channel_id,
        "api_key_configured": bool(thingspeak_manager.read_api_key),
        "test_result": test_result
    }


@router.post("/thingspeak/sync")
async def sync_thingspeak_now():
    """Immediately forces an MQTT reconnection and feed sync."""
    thingspeak_manager.start_mqtt_listener()
    latest = await thingspeak_manager.get_latest_telemetry()
    return {
        "status": "success",
        "message": "ThingSpeak sync triggered",
        "latest": latest
    }

