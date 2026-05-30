from app.services.recommendation.models import ScoringModel
from app.models.plants import PlantSpecies
from typing import Dict, Any

class DeterministicScoringModel(ScoringModel):
    def score(self, species: PlantSpecies, env_profile: Dict[str, Any], filters: Dict[str, Any]) -> float:
        # 0.35 pollution + 0.25 inverse maintenance + 0.20 growth + 0.20 ecological fit
        co2 = species.co2_absorption_rate or 0
        pm25 = species.pm25_absorption_rate or 0
        voc = species.voc_absorption_rate or 0
        
        pollution_score = (co2 + pm25 + voc) / 100.0
        pollution_score = min(max(pollution_score, 0), 1.0)
        
        maint_map = {"low": 1.0, "medium": 0.5, "high": 0.1}
        maint_val = species.maintenance_level.value if species.maintenance_level else "medium"
        inv_maint_score = maint_map.get(maint_val, 0.5)
        
        growth_map = {"slow": 0.2, "moderate": 0.6, "fast": 1.0}
        growth_val = species.growth_rate.value if species.growth_rate else "moderate"
        growth_score = growth_map.get(growth_val, 0.5)
        
        temp = env_profile.get("weather", {}).get("temperature", 20)
        eco_score = 0.5
        if species.temperature_range:
            try:
                parts = species.temperature_range.split("-")
                min_t, max_t = float(parts[0].replace("C","").strip()), float(parts[1].replace("C","").strip())
                if min_t <= temp <= max_t:
                    eco_score = 1.0
                elif abs(temp - min_t) < 5 or abs(temp - max_t) < 5:
                    eco_score = 0.7
                else:
                    eco_score = 0.2
            except:
                pass
                
        return 0.35 * pollution_score + 0.25 * inv_maint_score + 0.20 * growth_score + 0.20 * eco_score
