import pytest
import asyncio
from app.services.thingspeak import thingspeak_manager, calculate_cpcb_status

def test_calculate_cpcb_status():
    assert calculate_cpcb_status(35) == "GOOD"
    assert calculate_cpcb_status(80) == "SATISFACTORY"
    assert calculate_cpcb_status(150) == "MODERATE"
    assert calculate_cpcb_status(250) == "POOR"
    assert calculate_cpcb_status(350) == "VERY POOR"
    assert calculate_cpcb_status(450) == "SEVERE"

@pytest.mark.asyncio
async def test_thingspeak_live_feed_fetch():
    res = await thingspeak_manager.fetch_rest_feeds(results=5)
    assert res.get("success") is True
    assert "channel" in res
    assert "latest" in res
    latest = res["latest"]
    assert latest["channel_id"] == "3499335"
    assert "aqi" in latest
    assert "co_ppm" in latest
    assert "methane_ppm" in latest
    assert "lpg_ppm" in latest
    assert "buzzer_status" in latest

@pytest.mark.asyncio
async def test_get_latest_telemetry():
    latest = await thingspeak_manager.get_latest_telemetry()
    assert latest is not None
    assert latest.get("aqi") is not None
    assert latest.get("co_ppm") is not None
    assert latest.get("methane_ppm") is not None
    assert latest.get("lpg_ppm") is not None
