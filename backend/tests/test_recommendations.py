import asyncio
from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from pydantic import ValidationError
from app.models.enums import MaintenanceLevel, SpaceType, ToxicityLevel, AllergenRisk, GrowthRate
from app.schemas.recommendation import RecommendationRequest, PlantAnalysisRequest
from app.services.recommendation.helpers import parse_temp_range
from app.services.recommendation.engine import RecommendationEngine
from app.services.recommendation.deterministic import DeterministicScoringModel


def species(name="Tulsi", care=MaintenanceLevel.LOW, toxicity=ToxicityLevel.NONE):
    return SimpleNamespace(id=name, common_name=name, scientific_name=f"{name} example", maintenance_level=care,
        toxicity_level=toxicity, allergen_risk=AllergenRisk.NONE, growth_rate=GrowthRate.MODERATE,
        space_type_compatibility=[SpaceType.OUTDOOR_GARDEN], temperature_range="15-35°C",
        pm25_absorption_rate=10, co2_absorption_rate=15, voc_absorption_rate=5)


class FakeDB:
    def __init__(self, plants): self.plants = plants
    async def execute(self, query):
        return SimpleNamespace(scalars=lambda: SimpleNamespace(all=lambda: self.plants))


def engine(plants):
    instance = RecommendationEngine.__new__(RecommendationEngine)
    instance.db = FakeDB(plants)
    instance.model = DeterministicScoringModel()
    return instance


PROFILE = {"weather": {"temperature": 25}, "simulated": True}


@pytest.mark.parametrize("text,expected", [("15-35°C", (15, 35)), ("-10–5°C", (-10, 5)), ("-15--5 C", (-15, -5)), ("10 to 20", (10, 20)), ("unknown", None), ("35-15", None)])
def test_temperature_ranges(text, expected):
    assert parse_temp_range(text) == expected


@pytest.mark.parametrize("coords", [{}, {"lat": 91, "lng": 0}, {"lat": 0, "lng": 181}, {"lat": float('nan'), "lng": 0}])
def test_invalid_coordinates(coords):
    with pytest.raises(ValidationError): RecommendationRequest(**coords)


def test_zero_coordinates_are_valid_when_explicit():
    assert RecommendationRequest(lat=0, lng=0).lat == 0


def test_low_maintenance_and_household_exclusions():
    items = [species(), species("Demanding", MaintenanceLevel.HIGH), species("Toxic", toxicity=ToxicityLevel.HIGH)]
    output = asyncio.run(engine(items).run(RecommendationRequest(lat=10, lng=20, low_maintenance=True, has_pets=True), PROFILE))
    assert [item.common_name for item in output] == ["Tulsi"]
    assert 0 <= output[0].score <= 1
    assert "estimated" in output[0].environment_note


def test_beginner_excludes_high_care():
    output = asyncio.run(engine([species("Demanding", MaintenanceLevel.HIGH)]).run(RecommendationRequest(lat=10, lng=20, experience_level="low"), PROFILE))
    assert output == []


def test_unknown_plant_does_not_get_invented_facts():
    with pytest.raises(HTTPException) as exc:
        asyncio.run(engine([species()]).analyze_plant_suitability(PlantAnalysisRequest(plant_name="Imaginary", lat=10, lng=20), PROFILE))
    assert exc.value.status_code == 404


def test_toxicity_is_reported_even_without_household_filters():
    output = asyncio.run(engine([species(toxicity=ToxicityLevel.HIGH)]).analyze_plant_suitability(PlantAnalysisRequest(plant_name="Tulsi", lat=10, lng=20), PROFILE))
    assert "toxicity" in output.safety_note
    assert output.carbon_offset_kg_year is None
    assert sum(item.weight_pct for item in output.xai_breakdown) == 100


def test_incompatible_space_and_household_override_grade():
    output = asyncio.run(engine([species(toxicity=ToxicityLevel.HIGH)]).analyze_plant_suitability(PlantAnalysisRequest(plant_name="Tulsi", lat=10, lng=20, space_type="indoor", has_pets=True), PROFILE))
    assert output.suitability_grade == "Not recommended"


def test_unknown_temperature_not_claimed_as_ideal():
    plant = species(); plant.temperature_range = None
    output = asyncio.run(engine([plant]).analyze_plant_suitability(PlantAnalysisRequest(plant_name="Tulsi", lat=10, lng=20), PROFILE))
    assert "not available" in output.xai_breakdown[0].reason


def test_low_maintenance_analysis_respects_preference():
    output = asyncio.run(engine([species(care=MaintenanceLevel.HIGH)]).analyze_plant_suitability(PlantAnalysisRequest(plant_name="Tulsi", lat=10, lng=20, low_maintenance=True), PROFILE))
    assert output.suitability_grade == "Not recommended"


def test_partial_name_is_not_silently_matched():
    with pytest.raises(HTTPException):
        asyncio.run(engine([species()]).analyze_plant_suitability(PlantAnalysisRequest(plant_name="Tul", lat=10, lng=20), PROFILE))


def test_cache_outage_does_not_block_recommendations(monkeypatch):
    from app.api import recommendations as api
    from redis.exceptions import ConnectionError
    class BrokenCache:
        async def get(self, key): raise ConnectionError("offline")
        async def setex(self, *args): raise ConnectionError("offline")
    async def profile(lat, lng): return PROFILE
    monkeypatch.setattr(api, "redis_client", BrokenCache())
    monkeypatch.setattr(api, "generate_environment_profile", profile)
    assert asyncio.run(api.get_or_create_env_profile(10, 20)) == PROFILE
