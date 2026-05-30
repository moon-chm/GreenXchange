import os
import re
from typing import List, Dict, Any
from app.models.plants import PlantSpecies
from app.schemas.recommendation import RecommendationRequest, SpeciesCard
from app.services.recommendation.deterministic import DeterministicScoringModel
from app.services.recommendation.ml_model import PickleScoringModel

def get_scoring_model():
    model_path = os.getenv("RECOMMENDATION_MODEL_PATH")
    if model_path:
        return PickleScoringModel(model_path)
    return DeterministicScoringModel()

def parse_temp_range(temp_str: str):
    if not temp_str:
        return 0, 100
    nums = re.findall(r"[-+]?\d*\.\d+|\d+", temp_str)
    if len(nums) >= 2:
        return float(nums[0]), float(nums[1])
    return 0, 100

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

class RecommendationEngine:
    def __init__(self, db_session: AsyncSession):
        self.db = db_session
        self.model = get_scoring_model()
        
    async def run(self, filters: RecommendationRequest, env_profile: Dict[str, Any]) -> List[SpeciesCard]:
        result = await self.db.execute(select(PlantSpecies))
        all_species = result.scalars().all()
        
        valid_species = []
        for s in all_species:
            # 1. Toxicity Hard Constraint
            if (filters.has_pets or filters.has_children) and s.toxicity_level.value != "none":
                continue
            
            # 2. Space Type Hard Constraint
            if filters.space_type not in s.space_type_compatibility:
                continue
                
            # 3. Allergen Risk Hard Constraint
            if len(filters.allergies) > 0 and s.allergen_risk.value in ["high", "medium"]:
                continue
                
            # 4. Temperature Hard Constraint
            temp = env_profile.get("weather", {}).get("temperature", 20)
            min_t, max_t = parse_temp_range(s.temperature_range)
            # If the current temperature is wildly outside the plant's survivable limits
            if not (min_t - 5 <= temp <= max_t + 5):
                continue
                
            valid_species.append(s)
            
        scored = []
        for s in valid_species:
            score = self.model.score(s, env_profile, filters.model_dump())
            
            # Dynamic Explanation
            pollution = env_profile.get("air_quality", {}).get("pm25", 0)
            reason = f"{s.common_name} is a great match for your {filters.space_type.value} space."
            
            if pollution > 15 and (s.pm25_absorption_rate or 0) > 10:
                reason = f"Highly recommended: {s.common_name} excels at filtering the elevated PM2.5 levels currently detected in your area."
                
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
                care_guidance="Water when top inch of soil is dry.",
                score=round(score, 2)
            ) for score, s, reason in scored[:10]
        ]
