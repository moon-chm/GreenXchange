import random
from typing import Dict, Any
from app.utils.geo import get_tile_id

def get_pollution_severity(aqi: int) -> str:
    if aqi <= 50: return "Good"
    if aqi <= 100: return "Moderate"
    if aqi <= 150: return "Unhealthy for Sensitive Groups"
    if aqi <= 200: return "Unhealthy"
    if aqi <= 300: return "Very Unhealthy"
    return "Hazardous"

# Mock fetchers
async def fetch_mock_weather(lat: float, lng: float) -> Dict[str, Any]:
    return {
        "temperature": round(random.uniform(10.0, 35.0), 1),
        "humidity": random.randint(30, 90),
        "climate_zone": "Temperate"
    }

async def fetch_mock_waqi(lat: float, lng: float) -> Dict[str, Any]:
    aqi = random.randint(20, 180)
    return {
        "aqi": aqi,
        "pm25": round(aqi * 0.4, 1),
        "severity": get_pollution_severity(aqi)
    }

async def generate_environment_profile(lat: float, lng: float) -> Dict[str, Any]:
    import time
    weather = await fetch_mock_weather(lat, lng)
    waqi = await fetch_mock_waqi(lat, lng)
    return {
        "tile_id": get_tile_id(lat, lng),
        "weather": weather,
        "air_quality": waqi,
        "stale": False,
        "updated_at": int(time.time())
    }

# Sync versions for Celery Worker
def sync_fetch_mock_weather(lat: float, lng: float) -> Dict[str, Any]:
    return {
        "temperature": round(random.uniform(10.0, 35.0), 1),
        "humidity": random.randint(30, 90),
        "climate_zone": "Temperate"
    }

def sync_fetch_mock_waqi(lat: float, lng: float) -> Dict[str, Any]:
    aqi = random.randint(20, 180)
    return {
        "aqi": aqi,
        "pm25": round(aqi * 0.4, 1),
        "severity": get_pollution_severity(aqi)
    }

def sync_generate_environment_profile(lat: float, lng: float) -> Dict[str, Any]:
    import time
    return {
        "tile_id": get_tile_id(lat, lng),
        "weather": sync_fetch_mock_weather(lat, lng),
        "air_quality": sync_fetch_mock_waqi(lat, lng),
        "stale": False,
        "updated_at": int(time.time())
    }
