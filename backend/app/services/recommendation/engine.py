import os
from fastapi import HTTPException
from app.services.recommendation.helpers import parse_temp_range, normalize_name, environment_note
from typing import List, Dict, Any
from app.models.plants import PlantSpecies
from app.schemas.recommendation import (
    RecommendationRequest, SpeciesCard, PlantAnalysisRequest, PlantAnalysisResponse, XAIContribution
)
from app.services.recommendation.deterministic import DeterministicScoringModel

def get_scoring_model():
    model_path = os.getenv("RECOMMENDATION_MODEL_PATH")
    if model_path:
        from app.services.recommendation.ml_model import PickleScoringModel
        return PickleScoringModel(model_path)
    return DeterministicScoringModel()


from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func

class RecommendationEngine:
    def __init__(self, db_session: AsyncSession):
        self.db = db_session
        self.model = None
        
    async def run(self, filters: RecommendationRequest, env_profile: Dict[str, Any]) -> List[SpeciesCard]:
        if self.model is None:
            self.model = get_scoring_model()
        result = await self.db.execute(select(PlantSpecies).where(func.coalesce(PlantSpecies.data_source, "") != "User-Registered Species"))
        all_species = result.scalars().all()
        
        valid_species = []
        for s in all_species:
            if (filters.has_pets or filters.has_children) and s.toxicity_level.value != "none":
                continue
            if filters.low_maintenance and s.maintenance_level.value != "low":
                continue
            if filters.experience_level.value == "low" and s.maintenance_level.value == "high":
                continue
            if filters.space_type not in s.space_type_compatibility:
                continue
            if len(filters.allergies) > 0 and s.allergen_risk.value in ["high", "medium"]:
                continue
                
            temp = env_profile.get("weather", {}).get("temperature", 20)
            temp_range = parse_temp_range(s.temperature_range)
            if temp_range and not (temp_range[0] - 5 <= temp <= temp_range[1] + 5):
                continue
                
            valid_species.append(s)
            
        scored = []
        for s in valid_species:
            score = self.model.score(s, env_profile, filters.model_dump(mode="json"))
            reason = f"Catalog-listed for {filters.space_type.value.replace('_', ' ')} with {s.maintenance_level.value} care needs."
            
            scored.append((score, s, reason))
            
        scored.sort(key=lambda x: x[0], reverse=True)
        
        return [
            SpeciesCard(
                species_id=str(s.id),
                common_name=s.common_name,
                scientific_name=s.scientific_name,
                pollution_absorption_score=min(100, (s.pm25_absorption_rate or 0) + (s.co2_absorption_rate or 0)),
                maintenance_level=s.maintenance_level.value.capitalize(),
                explanation=reason,
                care_guidance="Check species-specific light, watering and mature-size requirements before planting.",
                environment_note=environment_note(env_profile),
                score=round(score, 2)
            ) for score, s, reason in scored[:10]
        ]

    async def analyze_plant_suitability(self, req: PlantAnalysisRequest, env_profile: Dict[str, Any]) -> PlantAnalysisResponse:
        # Only use catalog-backed facts. Unknown names must not receive invented
        # taxonomy, safety guarantees, carbon estimates or suitability scores.
        result = await self.db.execute(select(PlantSpecies).where(func.coalesce(PlantSpecies.data_source, "") != "User-Registered Species"))
        query = normalize_name(req.plant_name)
        matches = [s for s in result.scalars().all()
                   if query in (normalize_name(s.common_name), normalize_name(s.scientific_name))]
        if not matches:
            raise HTTPException(404, "This plant is not in our catalog yet. Try its full common or scientific name, or explore the recommendations below.")
        if len(matches) != 1:
            raise HTTPException(422, "Several plants share this name. Please enter the scientific name.")
        species = matches[0]
        temperature = env_profile.get("weather", {}).get("temperature")
        temp_range = parse_temp_range(species.temperature_range)
        climate_score = 50.0
        climate_reason = "Temperature compatibility is not available for this plant."
        if temp_range and isinstance(temperature, (int, float)):
            low, high = temp_range
            climate_score = 100.0 if low <= temperature <= high else 30.0
            climate_reason = f"Area temperature: {temperature:.1f}°C. Catalog range: {low:g}–{high:g}°C."
        space_ok = req.space_type in (species.space_type_compatibility or [])
        care_level = species.maintenance_level.value
        care_score = 40.0 if req.experience_level.value == "low" and care_level == "high" else 80.0
        if req.low_maintenance and care_level != "low":
            care_score = 0.0
        toxic = species.toxicity_level.value != "none"
        safety_note = (
            "The catalog lists toxicity for this plant. Keep away from pets and children."
            if toxic else "No toxicity is listed in this catalog. This is not a guarantee of safety or edibility."
        )
        contributions = [
            XAIContribution(feature="Temperature fit", weight_pct=45, score=climate_score,
                            impact="positive" if climate_score >= 80 else "neutral" if climate_score == 50 else "negative", reason=climate_reason),
            XAIContribution(feature="Growing space", weight_pct=30, score=100 if space_ok else 0,
                            impact="positive" if space_ok else "negative", reason="Listed for your selected space." if space_ok else "Not listed for your selected space."),
            XAIContribution(feature="Care effort", weight_pct=25, score=care_score,
                            impact="positive" if care_score >= 80 else "negative", reason=f"Catalog care level: {care_level}. Your experience: {req.experience_level.value}."),
        ]
        score = round(sum(item.score * item.weight_pct / 100 for item in contributions), 1)
        unsuitable = not space_ok or (toxic and (req.has_pets or req.has_children)) or (req.low_maintenance and care_level != "low")
        grade = "Not recommended" if unsuitable else "Good fit" if score >= 80 else "Needs care" if score >= 60 else "Poor fit"
        return PlantAnalysisResponse(
            plant_name=species.common_name, scientific_name=species.scientific_name,
            overall_score=score, suitability_grade=grade, xai_breakdown=contributions,
            genai_synthesis=f"{species.common_name}: {grade.lower()} for the selected preferences. Review the factors and household notes before deciding.",
            microclimate_fit=climate_reason,
            # The catalog does not document units or methodology for absorption
            # rates, so do not convert them into verified annual carbon credits.
            carbon_offset_kg_year=None,
            care_guide=f"{care_level.capitalize()} care needs. Confirm species-specific watering, light and mature size before planting.",
            recommended_space=", ".join(space.value.replace("_", " ") for space in species.space_type_compatibility),
            environment_note=environment_note(env_profile), safety_note=safety_note,
        )
