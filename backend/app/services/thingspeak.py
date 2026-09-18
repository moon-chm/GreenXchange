"""
ThingSpeak IoT Integration Service for GreenXchange
---------------------------------------------------
Connects to ThingSpeak via:
1. MQTT (mqtt3.thingspeak.com) for instantaneous push telemetry from ESP32.
2. REST API (api.thingspeak.com) for historical feeds and chart data.

Maps:
  - Field 1: AQI (overall Air Quality Index calculated on ESP32)
  - Field 2: CO_PPM (MQ-7 Carbon Monoxide sensor in ppm)
  - Field 3 (optional): MQ-135 CO2 in ppm
  - Field 4 (optional): MQ-2 Smoke in ppm

Computes Indian CPCB Air Quality Index classification and maintains
both in-memory state and Redis cache (env:hardware:latest / history).
"""

import asyncio
import json
import logging
import time
import urllib.parse
from typing import Any, Dict, List, Optional
import httpx

try:
    import paho.mqtt.client as mqtt
except ImportError:
    mqtt = None

from app.core.config import settings

logger = logging.getLogger("thingspeak_service")

# In-memory store fallback when Redis is offline
_in_memory_latest_telemetry: Optional[Dict[str, Any]] = None
_in_memory_history: List[Dict[str, Any]] = []


def calculate_cpcb_status(aqi: float) -> str:
    """Classifies AQI into standard Indian CPCB categories."""
    val = round(aqi)
    if val <= 50:
        return "GOOD"
    elif val <= 100:
        return "SATISFACTORY"
    elif val <= 200:
        return "MODERATE"
    elif val <= 300:
        return "POOR"
    elif val <= 400:
        return "VERY POOR"
    else:
        return "SEVERE"


def parse_payload_to_dict(payload_str: str) -> Dict[str, Any]:
    """Parses ThingSpeak MQTT payload (URL-encoded or JSON)."""
    payload_str = payload_str.strip()
    if payload_str.startswith("{") and payload_str.endswith("}"):
        try:
            return json.loads(payload_str)
        except Exception:
            pass
    # Try parsing URL-encoded format: field1=35.00&field2=0.65&created_at=...
    try:
        parsed = urllib.parse.parse_qs(payload_str)
        return {k: v[0] if len(v) == 1 else v for k, v in parsed.items()}
    except Exception:
        return {}


class ThingSpeakManager:
    _instance = None

    def __init__(self):
        self.channel_id = settings.THINGSPEAK_CHANNEL_ID or "3499335"
        self.read_api_key = settings.THINGSPEAK_READ_API_KEY
        self.mqtt_client = None
        self.is_mqtt_running = False
        self.last_sync_time = 0
        self._redis_client = None

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = ThingSpeakManager()
        return cls._instance

    async def get_redis(self):
        if self._redis_client is None:
            try:
                import redis.asyncio as aioredis
                if settings.REDIS_URL:
                    self._redis_client = aioredis.from_url(
                        settings.REDIS_URL,
                        decode_responses=True,
                        socket_connect_timeout=2,
                        socket_timeout=2
                    )
            except Exception as e:
                logger.debug(f"Redis not available for ThingSpeak service: {e}")
        return self._redis_client

    def save_telemetry_sync(self, telemetry: Dict[str, Any]):
        """Synchronous record save for MQTT background thread."""
        global _in_memory_latest_telemetry, _in_memory_history
        _in_memory_latest_telemetry = telemetry
        _in_memory_history.insert(0, telemetry)
        _in_memory_history = _in_memory_history[:50]

        # Non-blocking async dispatch to Redis if event loop is running
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                asyncio.run_coroutine_threadsafe(self._save_to_redis(telemetry), loop)
        except Exception:
            pass

    async def _save_to_redis(self, telemetry: Dict[str, Any]):
        try:
            r = await self.get_redis()
            if r:
                raw = json.dumps(telemetry)
                await r.setex("env:hardware:latest", 600, raw)
                await r.lpush("env:hardware:history", raw)
                await r.ltrim("env:hardware:history", 0, 49)
        except Exception as e:
            logger.debug(f"Redis store telemetry error: {e}")

    async def get_latest_telemetry(self) -> Dict[str, Any]:
        """Returns the most recent hardware telemetry from Redis, memory, or directly from ThingSpeak REST API."""
        global _in_memory_latest_telemetry
        now = int(time.time())

        # 1. Check Redis cache if fresh (< 15s)
        try:
            r = await self.get_redis()
            if r:
                raw = await r.get("env:hardware:latest")
                if raw:
                    data = json.loads(raw)
                    age = now - data.get("timestamp", 0)
                    if age < 15:
                        data["connected"] = age <= 180
                        data["age_seconds"] = age
                        return data
        except Exception as e:
            logger.debug(f"Redis read telemetry error: {e}")

        # 2. Check in-memory telemetry if fresh (< 15s)
        if _in_memory_latest_telemetry:
            age = now - _in_memory_latest_telemetry.get("timestamp", 0)
            if age < 15:
                data = dict(_in_memory_latest_telemetry)
                data["connected"] = age <= 180
                data["age_seconds"] = age
                return data

        # 3. Auto-refresh from ThingSpeak REST API
        try:
            feed_result = await self.fetch_rest_feeds(results=10)
            if feed_result.get("success") and feed_result.get("latest"):
                return feed_result["latest"]
        except Exception as e:
            logger.warning(f"Auto-refresh from ThingSpeak REST API failed: {e}")

        # 4. Fallback to existing memory cache if fetch failed
        if _in_memory_latest_telemetry:
            data = dict(_in_memory_latest_telemetry)
            age = now - data.get("timestamp", 0)
            data["connected"] = age <= 180
            data["age_seconds"] = age
            return data

        # 5. Baseline fallback when offline
        return {
            "connected": False,
            "source": "thingspeak",
            "channel_id": self.channel_id,
            "device_id": f"ESP32 ThingSpeak (Ch #{self.channel_id})",
            "aqi": 35,
            "co_ppm": 0.65,
            "mq7_co": 0.65,
            "mq135_co2": 16.32,
            "methane_ppm": 16.32,
            "mq2_smoke": 0.70,
            "smoke_ppm": 0.70,
            "lpg_ppm": 0.70,
            "air_quality_status": "GOOD",
            "alert_level": 140,
            "buzzer_active": False,
            "message": "Waiting for ThingSpeak telemetry stream"
        }

    async def fetch_rest_feeds(
        self,
        channel_id: Optional[str] = None,
        api_key: Optional[str] = None,
        results: int = 20
    ) -> Dict[str, Any]:
        """Queries ThingSpeak REST API for recent channel feeds and field meta."""
        ch_id = channel_id or self.channel_id
        key = api_key if api_key is not None else self.read_api_key

        url = f"https://api.thingspeak.com/channels/{ch_id}/feeds.json"
        params: Dict[str, Any] = {"results": results}
        if key:
            params["api_key"] = key

        async with httpx.AsyncClient(timeout=6.0) as client:
            resp = await client.get(url, params=params)
            if resp.status_code != 200:
                return {
                    "success": False,
                    "status_code": resp.status_code,
                    "error": "Failed to fetch ThingSpeak feeds. Check if channel is public or enter Read API Key.",
                    "channel_id": ch_id
                }

            payload = resp.json()
            channel_info = payload.get("channel", {})
            feeds = payload.get("feeds", [])

            history = []
            latest_aqi = 35.0
            latest_co = 0.65
            latest_co2 = 16.32
            latest_smoke = 0.70
            latest_f5 = "0"
            latest_entry_id = None
            latest_timestamp = int(time.time())

            for f in feeds:
                try:
                    f1 = float(f.get("field1")) if f.get("field1") is not None else None
                    f2 = float(f.get("field2")) if f.get("field2") is not None else None
                    f3 = float(f.get("field3")) if f.get("field3") is not None else None
                    f4 = float(f.get("field4")) if f.get("field4") is not None else None
                    f5 = f.get("field5")

                    if f1 is not None:
                        latest_aqi = f1
                    if f2 is not None:
                        latest_co = f2
                    if f3 is not None:
                        latest_co2 = f3
                    if f4 is not None:
                        latest_smoke = f4
                    if f5 is not None:
                        latest_f5 = str(f5)

                    latest_entry_id = f.get("entry_id")
                    history.append({
                        "entry_id": f.get("entry_id"),
                        "created_at": f.get("created_at"),
                        "aqi": f1 if f1 is not None else latest_aqi,
                        "co_ppm": f2 if f2 is not None else latest_co,
                        "co2_ppm": f3 if f3 is not None else latest_co2,
                        "methane_ppm": f3 if f3 is not None else latest_co2,
                        "smoke_ppm": f4 if f4 is not None else latest_smoke,
                        "lpg_ppm": f4 if f4 is not None else latest_smoke,
                        "buzzer_status": f5
                    })
                except Exception:
                    continue

            status_str = calculate_cpcb_status(latest_aqi)
            telemetry = {
                "connected": True,
                "source": "thingspeak",
                "channel_id": ch_id,
                "channel_name": channel_info.get("name", "GreenXchange Air Quality"),
                "entry_id": latest_entry_id,
                "device_id": f"ESP32 ThingSpeak (Ch #{ch_id})",
                "aqi": round(latest_aqi),
                "co_ppm": round(latest_co, 2),
                "mq7_co": round(latest_co, 2),
                "mq135_co2": round(latest_co2, 2),
                "methane_ppm": round(latest_co2, 2),
                "mq2_smoke": round(latest_smoke, 2),
                "smoke_ppm": round(latest_smoke, 2),
                "lpg_ppm": round(latest_smoke, 2),
                "buzzer_status": latest_f5,
                "buzzer_active": str(latest_f5) == "1" or latest_aqi > 140,
                "air_quality_status": status_str,
                "alert_level": 140,
                "timestamp": latest_timestamp,
                "history": history
            }

            self.save_telemetry_sync(telemetry)
            return {
                "success": True,
                "channel": channel_info,
                "latest": telemetry,
                "history": history
            }

    def start_mqtt_listener(self):
        """Starts background MQTT subscriber client for live push notifications."""
        if mqtt is None:
            logger.warning("paho-mqtt not installed. Real-time push listener disabled.")
            return

        if self.is_mqtt_running:
            logger.info("ThingSpeak MQTT listener is already running.")
            return

        client_id = settings.THINGSPEAK_MQTT_CLIENT_ID
        username = settings.THINGSPEAK_MQTT_USERNAME
        password = settings.THINGSPEAK_MQTT_PASSWORD
        host = settings.THINGSPEAK_MQTT_HOST
        port = settings.THINGSPEAK_MQTT_PORT
        ch_id = self.channel_id

        def on_connect(client, userdata, flags, rc):
            if rc == 0:
                logger.info(f"Connected to ThingSpeak MQTT broker {host}:{port} (rc=0)")
                # Subscribe to general channel and individual fields
                client.subscribe(f"channels/{ch_id}/subscribe")
                client.subscribe(f"channels/{ch_id}/subscribe/json")
                client.subscribe(f"channels/{ch_id}/subscribe/fields/+")
                logger.info(f"Subscribed to ThingSpeak Channel {ch_id} topics")
            else:
                logger.warning(f"ThingSpeak MQTT connection failed with result code {rc}")

        def on_message(client, userdata, msg):
            try:
                topic = msg.topic
                payload_str = msg.payload.decode("utf-8", errors="ignore")
                logger.info(f"ThingSpeak MQTT msg received on {topic}: {payload_str}")

                parsed = parse_payload_to_dict(payload_str)
                field1 = parsed.get("field1")
                field2 = parsed.get("field2")
                field3 = parsed.get("field3")
                field4 = parsed.get("field4")

                # Handle specific field topic: channels/<id>/subscribe/fields/field1
                if "/fields/field1" in topic:
                    field1 = payload_str
                elif "/fields/field2" in topic:
                    field2 = payload_str

                # Fallback to previous values if not present in partial field update
                prev = _in_memory_latest_telemetry or {}
                prev_aqi = prev.get("aqi", 35.0)
                prev_co = prev.get("co_ppm", 0.65)
                prev_co2 = prev.get("mq135_co2", 1.33)
                prev_smoke = prev.get("mq2_smoke", 0.00)

                aqi = float(field1) if field1 is not None else prev_aqi
                co_ppm = float(field2) if field2 is not None else prev_co
                co2_ppm = float(field3) if field3 is not None else prev_co2
                smoke_ppm = float(field4) if field4 is not None else prev_smoke

                status_str = calculate_cpcb_status(aqi)

                telemetry = {
                    "connected": True,
                    "source": "thingspeak",
                    "channel_id": ch_id,
                    "entry_id": parsed.get("entry_id") or prev.get("entry_id"),
                    "device_id": f"ESP32 ThingSpeak (Ch #{ch_id})",
                    "aqi": round(aqi),
                    "co_ppm": round(co_ppm, 2),
                    "mq7_co": round(co_ppm, 2),
                    "mq135_co2": round(co2_ppm, 2),
                    "mq2_smoke": round(smoke_ppm, 2),
                    "air_quality_status": status_str,
                    "alert_level": 140,
                    "buzzer_active": aqi > 140,
                    "timestamp": int(time.time())
                }

                self.save_telemetry_sync(telemetry)
                logger.info(f"Updated Live GreenXchange Telemetry: AQI={telemetry['aqi']} ({status_str}), CO={co_ppm} ppm")

            except Exception as e:
                logger.warning(f"Error handling ThingSpeak MQTT message: {e}")

        try:
            client = mqtt.Client(client_id=client_id)
            client.username_pw_set(username, password)
            client.on_connect = on_connect
            client.on_message = on_message
            client.connect_async(host, port, 60)
            client.loop_start()
            self.mqtt_client = client
            self.is_mqtt_running = True
            logger.info("ThingSpeak MQTT background loop initiated.")
        except Exception as e:
            logger.error(f"Failed to start ThingSpeak MQTT listener: {e}")

    def stop_mqtt_listener(self):
        if self.mqtt_client and self.is_mqtt_running:
            try:
                self.mqtt_client.loop_stop()
                self.mqtt_client.disconnect()
                self.is_mqtt_running = False
                logger.info("ThingSpeak MQTT listener stopped.")
            except Exception as e:
                logger.warning(f"Error stopping MQTT client: {e}")


# Singleton instance
thingspeak_manager = ThingSpeakManager.get_instance()
