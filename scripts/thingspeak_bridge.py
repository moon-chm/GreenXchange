#!/usr/bin/env python3
"""
GreenXchange ThingSpeak IoT Hardware Bridge
-------------------------------------------
Connects to ThingSpeak via MQTT and REST to bridge live ESP32 gas sensor
telemetry (AQI from Field 1, CO PPM from Field 2) into the GreenXchange
website backend.

Usage:
  python scripts/thingspeak_bridge.py
  python scripts/thingspeak_bridge.py --channel 3499335 --url http://localhost:8000/api/environment/hardware
  python scripts/thingspeak_bridge.py --simulate
"""

import sys
import time
import json
import logging
import argparse
import urllib.request
import urllib.error
import urllib.parse

try:
    import paho.mqtt.client as mqtt
except ImportError:
    mqtt = None

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(levelname)s [ThingSpeakBridge]: %(message)s"
)
logger = logging.getLogger("thingspeak_bridge")

DEFAULT_CHANNEL_ID = "3499335"
DEFAULT_CLIENT_ID = "GgwMOC8KCyQlIzsoLhgcARw"
DEFAULT_USERNAME = "GgwMOC8KCyQlIzsoLhgcARw"
DEFAULT_PASSWORD = "buw0sT0NKP2HU5VOilaICd2D"
DEFAULT_BROKER = "mqtt3.thingspeak.com"
DEFAULT_PORT = 1883
DEFAULT_API_URL = "http://localhost:8000/api/environment/hardware"


def classify_cpcb_aqi(aqi_val: float) -> str:
    val = round(aqi_val)
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
    return "SEVERE"


def send_to_greenxchange(url: str, telemetry: dict) -> bool:
    try:
        req = urllib.request.Request(
            url,
            data=json.dumps(telemetry).encode("utf-8"),
            headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(req, timeout=4) as resp:
            if resp.status in (200, 201):
                logger.info(
                    f"--> Dispatched to GreenXchange Dashboard: AQI={telemetry.get('aqi')}, "
                    f"CO={telemetry.get('mq7_co')} ppm, Status={telemetry.get('air_quality_status')}"
                )
                return True
    except Exception as e:
        logger.debug(f"Posting to {url} failed: {e}")
    return False


def run_simulation(url: str, interval: int = 5):
    logger.info("Starting SIMULATION mode with sample ESP32 ThingSpeak readings...")
    sim_data = {
        "device_id": "ESP32 ThingSpeak (Ch #3499335)",
        "source": "thingspeak",
        "channel_id": "3499335",
        "aqi": 35,
        "mq7_co": 0.65,
        "co_ppm": 0.65,
        "mq135_co2": 1.33,
        "mq2_smoke": 0.00,
        "co_aqi": 35,
        "smoke_aqi": 0,
        "air_quality_status": "GOOD",
        "alert_level": 140,
        "buzzer_active": False
    }
    while True:
        send_to_greenxchange(url, sim_data)
        time.sleep(interval)


def run_mqtt_bridge(
    channel_id: str,
    client_id: str,
    username: str,
    password: str,
    broker: str,
    port: int,
    backend_url: str
):
    if mqtt is None:
        logger.error("paho-mqtt is required. Run: pip install paho-mqtt")
        sys.exit(1)

    latest_data = {
        "device_id": f"ESP32 ThingSpeak (Ch #{channel_id})",
        "source": "thingspeak",
        "channel_id": channel_id,
        "aqi": 35,
        "mq7_co": 0.65,
        "co_ppm": 0.65,
        "mq135_co2": 1.33,
        "mq2_smoke": 0.00,
        "co_aqi": 35,
        "smoke_aqi": 0,
        "air_quality_status": "GOOD",
        "alert_level": 140,
        "buzzer_active": False
    }

    def on_connect(client, userdata, flags, rc):
        if rc == 0:
            logger.info(f"Connected to ThingSpeak MQTT broker {broker}:{port} (rc=0)")
            client.subscribe(f"channels/{channel_id}/subscribe")
            client.subscribe(f"channels/{channel_id}/subscribe/json")
            client.subscribe(f"channels/{channel_id}/subscribe/fields/+")
            logger.info(f"Subscribed to Channel {channel_id} telemetry streams")
            # Push initial baseline
            send_to_greenxchange(backend_url, latest_data)
        else:
            logger.warning(f"MQTT connection failed with code: {rc}")

    def on_message(client, userdata, msg):
        try:
            payload_str = msg.payload.decode("utf-8", errors="ignore").strip()
            topic = msg.topic
            logger.info(f"MQTT update received on [{topic}]: {payload_str}")

            field1 = None
            field2 = None

            if "/fields/field1" in topic:
                field1 = payload_str
            elif "/fields/field2" in topic:
                field2 = payload_str
            elif payload_str.startswith("{"):
                d = json.loads(payload_str)
                field1 = d.get("field1")
                field2 = d.get("field2")
            else:
                parsed = urllib.parse.parse_qs(payload_str)
                field1 = parsed.get("field1", [None])[0]
                field2 = parsed.get("field2", [None])[0]

            if field1 is not None:
                try:
                    latest_data["aqi"] = round(float(field1))
                    latest_data["co_aqi"] = latest_data["aqi"]
                except Exception:
                    pass

            if field2 is not None:
                try:
                    val = round(float(field2), 2)
                    latest_data["mq7_co"] = val
                    latest_data["co_ppm"] = val
                except Exception:
                    pass

            latest_data["air_quality_status"] = classify_cpcb_aqi(latest_data["aqi"])
            latest_data["buzzer_active"] = latest_data["aqi"] > latest_data["alert_level"]

            send_to_greenxchange(backend_url, latest_data)

        except Exception as e:
            logger.warning(f"Error parsing MQTT packet: {e}")

    logger.info(f"Connecting MQTT client '{client_id}' to {broker}...")
    client = mqtt.Client(client_id=client_id)
    client.username_pw_set(username, password)
    client.on_connect = on_connect
    client.on_message = on_message

    try:
        client.connect(broker, port, 60)
        client.loop_forever()
    except KeyboardInterrupt:
        logger.info("Stopping ThingSpeak bridge.")
        client.disconnect()
    except Exception as e:
        logger.error(f"MQTT bridge encountered error: {e}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="GreenXchange ThingSpeak Hardware Bridge")
    parser.add_argument("--channel", default=DEFAULT_CHANNEL_ID, help="ThingSpeak Channel ID")
    parser.add_argument("--client-id", default=DEFAULT_CLIENT_ID, help="ThingSpeak MQTT Client ID")
    parser.add_argument("--username", default=DEFAULT_USERNAME, help="ThingSpeak MQTT Username")
    parser.add_argument("--password", default=DEFAULT_PASSWORD, help="ThingSpeak MQTT Password")
    parser.add_argument("--broker", default=DEFAULT_BROKER, help="ThingSpeak MQTT Broker host")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT, help="ThingSpeak MQTT Broker port")
    parser.add_argument("--url", default=DEFAULT_API_URL, help="GreenXchange backend hardware API URL")
    parser.add_argument("--simulate", action="store_true", help="Run in simulation mode")

    args = parser.parse_args()

    if args.simulate:
        run_simulation(args.url)
    else:
        run_mqtt_bridge(
            channel_id=args.channel,
            client_id=args.client_id,
            username=args.username,
            password=args.password,
            broker=args.broker,
            port=args.port,
            backend_url=args.url
        )
