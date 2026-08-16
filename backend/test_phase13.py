import asyncio
from app.db.session import AsyncSessionLocal
from app.schemas.recommendation import PlantAnalysisRequest
from app.services.recommendation.engine import RecommendationEngine

async def main():
    print("==================================================")
    print("Testing Phase 13: GenAI & Explainable AI (XAI) Plant Analysis")
    print("==================================================")

    async with AsyncSessionLocal() as session:
        engine = RecommendationEngine(session)

        # Mock env telemetry profile
        env_profile = {
            "temperature": 28.5,
            "humidity": 65.0,
            "pm25": 22.4
        }

        # 1. Test Neem Tree Analysis
        req1 = PlantAnalysisRequest(
            plant_name="Neem",
            lat=28.6139,
            lng=77.2090,
            space_type="outdoor_garden",
            experience_level="low",
            has_pets=False,
            has_children=False
        )

        res1 = await engine.analyze_plant_suitability(req1, env_profile)
        print(f"\n1. Plant Analysis for '{res1.plant_name}' ({res1.scientific_name}):")
        print(f"   Overall Score: {res1.overall_score}/100 (Grade {res1.suitability_grade})")
        print(f"   Est. Carbon Offset: {res1.carbon_offset_kg_year} kg CO2/year")
        print(f"   GenAI Synthesis: {res1.genai_synthesis[:140]}...")
        print("\n   Explainable AI (XAI) Contribution Breakdown:")
        total_weight = 0
        for item in res1.xai_breakdown:
            print(f"    - [{item.weight_pct}% Weight] {item.feature}: Score {item.score}/100 ({item.impact.upper()}) -> {item.reason}")
            total_weight += item.weight_pct

        assert total_weight == 100
        assert res1.overall_score > 70
        print("SUCCESS: XAI feature weights sum to 100% and overall score is valid.")

        # 2. Test Custom Plant Analysis (e.g. Lavender)
        req2 = PlantAnalysisRequest(
            plant_name="Lavender",
            lat=28.6139,
            lng=77.2090,
            space_type="indoor",
            experience_level="medium",
            has_pets=True,
            has_children=False
        )
        res2 = await engine.analyze_plant_suitability(req2, env_profile)
        print(f"\n2. Plant Analysis for '{res2.plant_name}' ({res2.scientific_name}):")
        print(f"   Overall Score: {res2.overall_score}/100 (Grade {res2.suitability_grade})")
        print(f"   GenAI Synthesis: {res2.genai_synthesis[:140]}...")

        assert res2.overall_score > 0
        print("SUCCESS: Custom plant analysis generated successfully.")

if __name__ == "__main__":
    asyncio.run(main())
