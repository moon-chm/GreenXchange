#!/usr/bin/env python3
"""
GreenXchange Arduino Hardware Bridge
------------------------------------
Reads serial output from Arduino Nano (AQI.ino) on COM11 (or specified port)
and forwards real-time gas sensor telemetries (MQ-135 CO2, MQ-7 CO, MQ-2 Smoke, AQI)
to the GreenXchange website backend.

Usage:
  python scripts/arduino_bridge.py --port COM11 --baud 9600
  python scripts/arduino_bridge.py --simulate
"""

import sys
import time
import re
import argparse
import logging
import urllib.request
import urllib.error
import json

logging.basicConfig(level=logging.INFO, format="[%(asctime)s] %(levelname)s: %(message)s")
logger = logging.getLogger("arduino_bridge")

DEFAULT_API_URL = "http://localhost/api/environment/hardware"

def send_telemetry(url, data):
    try:
        req = urllib.request.Request(
            url,
            data=json.dumps(data).encode("utf-8"),
            headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(req, timeout=3) as resp:
            if resp.status in (200, 201):
                logger.info(f"--> Posted to GreenXchange: AQI={data['aqi']}, CO2={data['mq135_co2']} ppm, CO={data['mq7_co']} ppm, Smoke={data['mq2_smoke']} ppm")
                return True
    except Exception as e:
        logger.warning(f"Failed to post hardware telemetry to {url}: {e}")
    return False

def run_simulation(url, interval=3):
    logger.info("Running in SIMULATION mode with readings from Arduino Nano...")
    data = {
        "device_id": "arduino_nano_com11",
        "aqi": 30,
        "mq135_co2": 1.33,
        "mq7_co": 2.63,
        "mq2_smoke": 0.00,
        "co_aqi": 30,
        "smoke_aqi": 0,
        "air_quality_status": "GOOD",
        "alert_level": 140,
        "buzzer_active": False
    }
    while True:
        send_telemetry(url, data)
        time.sleep(interval)

def run_serial_bridge(port, baud, url):
    try:
        import serial
    except ImportError:
        logger.error("pyserial module not found. Install via 'pip install pyserial' or run with --simulate")
        sys.exit(1)

    logger.info(f"Opening Serial Port {port} @ {baud} baud...")
    try:
        ser = serial.Serial(port, baud, timeout=2)
    except Exception as e:
        logger.error(f"Could not open serial port {port}: {e}")
        logger.info("Switching to simulation fallback...")
        run_simulation(url)
        return

    current_data = {
        "device_id": f"arduino_nano_{port.lower()}",
        "aqi": 30,
        "mq135_co2": 1.33,
        "mq7_co": 2.63,
        "mq2_smoke": 0.00,
        "co_aqi": 30,
        "smoke_aqi": 0,
        "air_quality_status": "GOOD",
        "alert_level": 140,
        "buzzer_active": False
    }

    buffer_modified = False

    while True:
        try:
            line_bytes = ser.readline()
            if not line_bytes:
                continue
            line = line_bytes.decode("utf-8", errors="ignore").strip()
            if not line:
                continue

            # Parse lines from AQI.ino
            m_co2 = re.search(r"MQ-135\s+CO2\s*:\s*([\d.]+)", line, re.IGNORECASE)
            if m_co2:
                current_data["mq135_co2"] = float(m_co2.group(1))
                buffer_modified = True

            m_co = re.search(r"MQ-7\s+CO\s*:\s*([\d.]+)", line, re.IGNORECASE)
            if m_co:
                current_data["mq7_co"] = float(m_co.group(1))
                buffer_modified = True

            m_smoke = re.search(r"MQ-2\s+Smoke\s*:\s*([\d.]+)", line, re.IGNORECASE)
            if m_smoke:
                current_data["mq2_smoke"] = float(m_smoke.group(1))
                buffer_modified = True

            m_co_aqi = re.search(r"CO\s+AQI\s*:\s*(\d+)", line, re.IGNORECASE)
            if m_co_aqi:
                current_data["co_aqi"] = int(m_co_aqi.group(1))

            m_smoke_aqi = re.search(r"Smoke\s+AQI\s*:\s*(\d+)", line, re.IGNORECASE)
            if m_smoke_aqi:
                current_data["smoke_aqi"] = int(m_smoke_aqi.group(1))

            m_aqi = re.search(r"Overall\s+AQI\s*:\s*(\d+)", line, re.IGNORECASE)
            if m_aqi:
                current_data["aqi"] = int(m_aqi.group(1))
                buffer_modified = True

            m_status = re.search(r"Air\s+Quality\s*:\s*(\w+)", line, re.IGNORECASE)
            if m_status:
                current_data["air_quality_status"] = m_status.group(1).upper()

            m_alert = re.search(r"AQI\s+Alert\s+Level\s*:\s*(\d+)", line, re.IGNORECASE)
            if m_alert:
                current_data["alert_level"] = int(m_alert.group(1))

            # Send telemetry when a complete frame (e.g. Overall AQI) is processed
            if buffer_modified and ("Overall AQI" in line or "Air Quality" in line):
                send_telemetry(url, current_data)
                buffer_modified = False

        except KeyboardInterrupt:
            logger.info("Stopping hardware serial bridge.")
            break
        except Exception as e:
            logger.warning(f"Error reading serial line: {e}")
            time.sleep(1)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="GreenXchange Arduino Hardware Serial Bridge")
    parser.add_argument("--port", default="COM11", help="Serial port (e.g. COM11 or /dev/ttyUSB0)")
    parser.add_argument("--baud", type=int, default=9600, help="Serial baud rate (default: 9600)")
    parser.add_argument("--url", default=DEFAULT_API_URL, help="GreenXchange backend hardware API URL")
    parser.add_argument("--simulate", action="store_true", help="Run simulated telemetry sender without physical COM port")

    args = parser.parse_args()

    if args.simulate:
        run_simulation(args.url)
    else:
        run_serial_bridge(args.port, args.baud, args.url)
