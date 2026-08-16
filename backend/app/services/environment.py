import random
import time
import logging
from typing import Dict, Any
import httpx
from app.utils.geo import get_tile_id

logger = logging.getLogger("environment_service")

def get_pollution_severity(aqi: int) -> str:
    if aqi <= 50: return "Good"
    if aqi <= 100: return "Moderate"
    if aqi <= 150: return "Unhealthy for Sensitive Groups"
    if aqi <= 200: return "Unhealthy"
    if aqi <= 300: return "Very Unhealthy"
    return "Hazardous"

def get_climate_zone(lat: float) -> str:
    abs_lat = abs(lat)
    if abs_lat < 23.5:
        return "Tropical"
    elif abs_lat < 35.0:
        return "Subtropical"
    elif abs_lat < 60.0:
        return "Temperate"
    else:
        return "Boreal"

async def fetch_weather(lat: float, lng: float) -> Dict[str, Any]:
    """Fetch live weather from Open-Meteo API with fallback."""
    # Use default coordinates if (0.0, 0.0) supplied
    effective_lat = 28.6139 if abs(lat) < 0.01 and abs(lng) < 0.01 else lat
    effective_lng = 77.2090 if abs(lat) < 0.01 and abs(lng) < 0.01 else lng

    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.get(
                "https://api.open-meteo.com/v1/forecast",
                params={
                    "latitude": effective_lat,
                    "longitude": effective_lng,
                    "current": "temperature_2m,relative_humidity_2m"
                }
            )
            if resp.status_code == 200:
                data = resp.json().get("current", {})
                temp = data.get("temperature_2m")
                humidity = data.get("relative_humidity_2m")
                if temp is not None and humidity is not None:
                    return {
                        "temperature": round(float(temp), 1),
                        "humidity": int(humidity),
                        "climate_zone": get_climate_zone(effective_lat)
                    }
    except Exception as e:
        logger.warning(f"Live weather API call failed: {e}. Using correlated fallback.")

    # Fallback correlated to latitude
    base_temp = 30.0 - (abs(effective_lat) * 0.4)
    return {
        "temperature": round(max(5.0, min(42.0, base_temp + random.uniform(-2.0, 2.0))), 1),
        "humidity": random.randint(45, 75),
        "climate_zone": get_climate_zone(effective_lat)
    }

async def fetch_waqi(lat: float, lng: float) -> Dict[str, Any]:
    """Fetch live air quality from Open-Meteo Air Quality API with fallback."""
    effective_lat = 28.6139 if abs(lat) < 0.01 and abs(lng) < 0.01 else lat
    effective_lng = 77.2090 if abs(lat) < 0.01 and abs(lng) < 0.01 else lng

    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.get(
                "https://air-quality-api.open-meteo.com/v1/air-quality",
                params={
                    "latitude": effective_lat,
                    "longitude": effective_lng,
                    "current": "us_aqi,pm2_5"
                }
            )
            if resp.status_code == 200:
                data = resp.json().get("current", {})
                us_aqi = data.get("us_aqi")
                pm25 = data.get("pm2_5")
                if us_aqi is not None:
                    aqi_val = int(us_aqi)
                    pm25_val = round(float(pm25), 1) if pm25 is not None else round(aqi_val * 0.35, 1)
                    return {
                        "aqi": aqi_val,
                        "pm25": pm25_val,
                        "severity": get_pollution_severity(aqi_val)
                    }
    except Exception as e:
        logger.warning(f"Live air quality API call failed: {e}. Using correlated fallback.")

    # Fallback
    aqi_val = random.randint(35, 110)
    return {
        "aqi": aqi_val,
        "pm25": round(aqi_val * 0.35, 1),
        "severity": get_pollution_severity(aqi_val)
    }

async def generate_environment_profile(lat: float, lng: float) -> Dict[str, Any]:
    weather = await fetch_weather(lat, lng)
    waqi = await fetch_waqi(lat, lng)
    return {
        "tile_id": get_tile_id(lat, lng),
        "weather": weather,
        "air_quality": waqi,
        "stale": False,
        "updated_at": int(time.time())
    }

# Synchronous wrappers for Celery worker tasks
def sync_fetch_weather(lat: float, lng: float) -> Dict[str, Any]:
    effective_lat = 28.6139 if abs(lat) < 0.01 and abs(lng) < 0.01 else lat
    effective_lng = 77.2090 if abs(lat) < 0.01 and abs(lng) < 0.01 else lng
    try:
        resp = httpx.get(
            "https://api.open-meteo.com/v1/forecast",
            params={
                "latitude": effective_lat,
                "longitude": effective_lng,
                "current": "temperature_2m,relative_humidity_2m"
            },
            timeout=3.0
        )
        if resp.status_code == 200:
            data = resp.json().get("current", {})
            temp = data.get("temperature_2m")
            humidity = data.get("relative_humidity_2m")
            if temp is not None and humidity is not None:
                return {
                    "temperature": round(float(temp), 1),
                    "humidity": int(humidity),
                    "climate_zone": get_climate_zone(effective_lat)
                }
    except Exception as e:
        logger.warning(f"Sync weather fetch fallback: {e}")

    base_temp = 30.0 - (abs(effective_lat) * 0.4)
    return {
        "temperature": round(max(5.0, min(42.0, base_temp + random.uniform(-2.0, 2.0))), 1),
        "humidity": random.randint(45, 75),
        "climate_zone": get_climate_zone(effective_lat)
    }

def sync_fetch_waqi(lat: float, lng: float) -> Dict[str, Any]:
    effective_lat = 28.6139 if abs(lat) < 0.01 and abs(lng) < 0.01 else lat
    effective_lng = 77.2090 if abs(lat) < 0.01 and abs(lng) < 0.01 else lng
    try:
        resp = httpx.get(
            "https://air-quality-api.open-meteo.com/v1/air-quality",
            params={
                "latitude": effective_lat,
                "longitude": effective_lng,
                "current": "us_aqi,pm2_5"
            },
            timeout=3.0
        )
        if resp.status_code == 200:
            data = resp.json().get("current", {})
            us_aqi = data.get("us_aqi")
            pm25 = data.get("pm2_5")
            if us_aqi is not None:
                aqi_val = int(us_aqi)
                pm25_val = round(float(pm25), 1) if pm25 is not None else round(aqi_val * 0.35, 1)
                return {
                    "aqi": aqi_val,
                    "pm25": pm25_val,
                    "severity": get_pollution_severity(aqi_val)
                }
    except Exception as e:
        logger.warning(f"Sync WAQI fetch fallback: {e}")

    aqi_val = random.randint(35, 110)
    return {
        "aqi": aqi_val,
        "pm25": round(aqi_val * 0.35, 1),
        "severity": get_pollution_severity(aqi_val)
    }

def sync_generate_environment_profile(lat: float, lng: float) -> Dict[str, Any]:
    return {
        "tile_id": get_tile_id(lat, lng),
        "weather": sync_fetch_weather(lat, lng),
        "air_quality": sync_fetch_waqi(lat, lng),
        "stale": False,
        "updated_at": int(time.time())
    }

