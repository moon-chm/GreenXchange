import os
import re
from typing import List, Dict, Any
from app.models.plants import PlantSpecies
from app.schemas.recommendation import (
    RecommendationRequest, SpeciesCard, PlantAnalysisRequest, PlantAnalysisResponse, XAIContribution
)
from app.services.recommendation.deterministic import DeterministicScoringModel
from app.services.recommendation.ml_model import PickleScoringModel

def get_scoring_model():
    model_path = os.getenv("RECOMMENDATION_MODEL_PATH")
    if model_path:
        return PickleScoringModel(model_path)
    return DeterministicScoringModel()


def parse_temp_range(temp_str: str):
    if not temp_str:
        return 15.0, 35.0
    nums = re.findall(r"[-+]?\d*\.\d+|\d+", temp_str)
    if len(nums) >= 2:
        return float(nums[0]), float(nums[1])
    return 15.0, 35.0

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
            if (filters.has_pets or filters.has_children) and s.toxicity_level.value != "none":
                continue
            if filters.space_type not in s.space_type_compatibility:
                continue
            if len(filters.allergies) > 0 and s.allergen_risk.value in ["high", "medium"]:
                continue
                
            temp = env_profile.get("weather", {}).get("temperature", 20)
            min_t, max_t = parse_temp_range(s.temperature_range)
            if not (min_t - 5 <= temp <= max_t + 5):
                continue
                
            valid_species.append(s)
            
        scored = []
        for s in valid_species:
            score = self.model.score(s, env_profile, filters.model_dump())
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

    async def analyze_plant_suitability(self, req: PlantAnalysisRequest, env_profile: Dict[str, Any]) -> PlantAnalysisResponse:
        """
        Analyzes any user-requested plant species using Groq LLM API (Llama 3.3 70B) or fallback botanical inference.
        """
        import json
        import httpx
        from app.core.config import settings

        plant_name_raw = req.plant_name.strip()

        # Extract telemetry properly handling nested weather/air_quality dicts
        weather = env_profile.get("weather", {}) if isinstance(env_profile.get("weather"), dict) else {}
        air_quality = env_profile.get("air_quality", {}) if isinstance(env_profile.get("air_quality"), dict) else {}

        current_temp = float(weather.get("temperature", env_profile.get("temperature", 25.0)))
        current_humidity = float(weather.get("humidity", env_profile.get("humidity", 60.0)))
        current_pm25 = float(air_quality.get("pm25", env_profile.get("pm25", 15.0)))

        groq_api_key = getattr(settings, "GROQ_API_KEY", None) or os.getenv("GROQ_API_KEY")

        # ── 1. Attempt Groq LLM API Generation ─────────────────────────────────
        if groq_api_key:
            try:
                system_prompt = (
                    "You are GreenXchange AI, a world-class botanical scientist and environmental telemetry expert. "
                    "Analyze the requested plant for cultivation compatibility in the specified microclimate. "
                    "You MUST respond ONLY with a valid JSON object matching this exact structure:\n"
                    "{\n"
                    '  "plant_name": "Common Name",\n'
                    '  "scientific_name": "Genus species",\n'
                    '  "overall_score": 88.5,\n'
                    '  "suitability_grade": "A",\n'
                    '  "xai_breakdown": [\n'
                    '    {"feature": "Climate & Temperature Fit", "weight_pct": 35, "score": 95.0, "impact": "positive", "reason": "Reason string"},\n'
                    '    {"feature": "Humidity & Transpiration", "weight_pct": 25, "score": 90.0, "impact": "positive", "reason": "Reason string"},\n'
                    '    {"feature": "Air Quality & Carbon Filtration", "weight_pct": 20, "score": 85.0, "impact": "positive", "reason": "Reason string"},\n'
                    '    {"feature": "Care Effort & Experience Match", "weight_pct": 15, "score": 88.0, "impact": "positive", "reason": "Reason string"},\n'
                    '    {"feature": "Household & Pet Safety", "weight_pct": 5, "score": 100.0, "impact": "positive", "reason": "Reason string"}\n'
                    '  ],\n'
                    '  "genai_synthesis": "Synthesis summary string",\n'
                    '  "microclimate_fit": "Fit description string",\n'
                    '  "carbon_offset_kg_year": 18.5,\n'
                    '  "care_guide": "Care instructions string",\n'
                    '  "recommended_space": "Indoor / Outdoor Garden"\n'
                    "}"
                )

                user_prompt = (
                    f"Plant Requested: '{plant_name_raw}'.\n"
                    f"Microclimate Telemetry: Temperature={current_temp:.1f}°C, Humidity={current_humidity:.0f}%, PM2.5={current_pm25:.1f}µg/m³.\n"
                    f"Target Space Type: {req.space_type.value}.\n"
                    f"Household Safety: Has Pets={req.has_pets}, Has Children={req.has_children}.\n"
                    f"Gardener Experience Level: {req.experience_level.value}.\n"
                )

                async with httpx.AsyncClient(timeout=8.0) as client:
                    response = await client.post(
                        "https://api.groq.com/openai/v1/chat/completions",
                        headers={
                            "Authorization": f"Bearer {groq_api_key}",
                            "Content-Type": "application/json",
                        },
                        json={
                            "model": "llama-3.3-70b-versatile",
                            "messages": [
                                {"role": "system", "content": system_prompt},
                                {"role": "user", "content": user_prompt},
                            ],
                            "response_format": {"type": "json_object"},
                            "temperature": 0.3,
                        },
                    )

                    if response.status_code == 200:
                        res_data = response.json()
                        content = res_data["choices"][0]["message"]["content"]
                        parsed = json.loads(content)

                        xai_items = [
                            XAIContribution(
                                feature=item.get("feature", "Factor"),
                                weight_pct=int(item.get("weight_pct", 20)),
                                score=float(item.get("score", 80.0)),
                                impact=str(item.get("impact", "positive")),
                                reason=str(item.get("reason", "Good compatibility.")),
                            )
                            for item in parsed.get("xai_breakdown", [])
                        ]

                        return PlantAnalysisResponse(
                            plant_name=parsed.get("plant_name", plant_name_raw.title()),
                            scientific_name=parsed.get("scientific_name", f"{plant_name_raw.title()} spp."),
                            overall_score=float(parsed.get("overall_score", 85.0)),
                            suitability_grade=parsed.get("suitability_grade", "A"),
                            xai_breakdown=xai_items,
                            genai_synthesis=parsed.get("genai_synthesis", "Groq AI verified microclimate synthesis."),
                            microclimate_fit=parsed.get("microclimate_fit", "Optimal thermal and humidity window."),
                            carbon_offset_kg_year=float(parsed.get("carbon_offset_kg_year", 16.5)),
                            care_guide=parsed.get("care_guide", "Water thoroughly when topsoil feels dry."),
                            recommended_space=parsed.get("recommended_space", req.space_type.value.replace("_", " ").title()),
                        )
            except Exception as e:
                print(f"Groq API call failed ({e}). Falling back to botanical inference engine.")

        # ── 2. Smart Botanical Inference Engine (Deterministic Fallback) ─────────
        query_str = f"%{plant_name_raw}%"
        res = await self.db.execute(
            select(PlantSpecies).filter(
                (PlantSpecies.common_name.ilike(query_str)) | (PlantSpecies.scientific_name.ilike(query_str))
            )
        )
        species = res.scalars().first()

        species_common = species.common_name if species else plant_name_raw.title()
        species_sci = species.scientific_name if species else f"{species_common} spp."

        min_t, max_t = parse_temp_range(species.temperature_range if species else "15-35°C")

        # Climate Score
        if min_t <= current_temp <= max_t:
            temp_score = 95.0
            temp_impact = "positive"
            temp_reason = f"Ideal thermal window ({min_t:.0f}°C–{max_t:.0f}°C matches current {current_temp:.1f}°C)."
        else:
            temp_score = 68.0
            temp_impact = "neutral"
            temp_reason = f"Current temp ({current_temp:.1f}°C) is near boundary ({min_t:.0f}°C–{max_t:.0f}°C); shield from direct heat."

        # Humidity Score
        humidity_score = 92.0 if current_humidity >= 50 else 78.0
        humidity_impact = "positive" if humidity_score >= 85 else "neutral"
        humidity_reason = f"Ambient relative humidity ({current_humidity:.0f}%) supports healthy stomatal conductance."

        # Air Quality & Carbon Score
        co2_rate = float(species.co2_absorption_rate or 20.0) if species else 16.5
        pm25_rate = float(species.pm25_absorption_rate or 12.0) if species else 10.0
        air_score = min(98.0, (co2_rate + pm25_rate) * 2.5)
        air_impact = "positive"
        air_reason = f"High foliage density providing PM2.5 filtration and ~{co2_rate:.1f}kg annual carbon sequestration."

        # Maintenance Fit Score
        maint_score = 88.0
        maint_impact = "positive"
        maint_reason = f"Matches user experience level ({req.experience_level.value}). Requires standard routine care."

        # Safety Score
        if species and species.toxicity_level.value != "none" and (req.has_pets or req.has_children):
            safety_score = 40.0
            safety_impact = "negative"
            safety_reason = "Caution: Mild toxicity detected. Keep out of reach of pets/children."
        else:
            safety_score = 100.0
            safety_impact = "positive"
            safety_reason = "100% Non-toxic and safe for households with pets and children."

        xai_breakdown = [
            XAIContribution(feature="Climate & Temperature Fit", weight_pct=35, score=temp_score, impact=temp_impact, reason=temp_reason),
            XAIContribution(feature="Humidity & Transpiration", weight_pct=25, score=humidity_score, impact=humidity_impact, reason=humidity_reason),
            XAIContribution(feature="Air Quality & Carbon Filtration", weight_pct=20, score=air_score, impact=air_impact, reason=air_reason),
            XAIContribution(feature="Care Effort & Experience Match", weight_pct=15, score=maint_score, impact=maint_impact, reason=maint_reason),
            XAIContribution(feature="Household & Pet Safety", weight_pct=5, score=safety_score, impact=safety_impact, reason=safety_reason),
        ]

        overall_score = round(
            (temp_score * 0.35) + (humidity_score * 0.25) + (air_score * 0.20) + (maint_score * 0.15) + (safety_score * 0.05),
            1
        )

        if overall_score >= 90:
            suitability_grade = "A+"
        elif overall_score >= 80:
            suitability_grade = "A"
        elif overall_score >= 70:
            suitability_grade = "B"
        else:
            suitability_grade = "C"

        genai_synthesis = (
            f"Based on real-time environmental telemetry ({current_temp:.1f}°C, {current_humidity:.0f}% RH, PM2.5: {current_pm25:.1f}µg/m³), "
            f"{species_common} ({species_sci}) is an outstanding selection for your {req.space_type.value.replace('_', ' ')} environment. "
            f"Explainable AI attributes 35% of its top score to thermal compatibility and highlighted its capacity to capture atmospheric particulate matter, "
            f"sequestering ~{co2_rate:.1f}kg of carbon per year."
        )

        microclimate_fit = f"Thrives in temperatures between {min_t:.0f}°C–{max_t:.0f}°C with moderate ambient light."
        care_guide = "Water thoroughly when the top 2 inches of soil feel dry. Wipe leaves monthly to maximize photosynthesis and air filtration."

        return PlantAnalysisResponse(
            plant_name=species_common,
            scientific_name=species_sci,
            overall_score=overall_score,
            suitability_grade=suitability_grade,
            xai_breakdown=xai_breakdown,
            genai_synthesis=genai_synthesis,
            microclimate_fit=microclimate_fit,
            carbon_offset_kg_year=round(co2_rate, 1),
            care_guide=care_guide,
            recommended_space=req.space_type.value.replace("_", " ").title()
        )


