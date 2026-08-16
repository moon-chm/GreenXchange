import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy import func, text

from app.api.deps import get_current_user, get_current_user_optional, get_db
from app.models.users import User
from app.models.plants import Plant, PlantSpecies
from app.schemas.plants import (
    PlantRegistrationRequest, PlantRegistrationResponse, PlantPublicResponse,
    PlantPortfolioResponse, CommunityMapPlantResponse
)
from app.utils.identity import generate_scan_id, generate_qr_code
from app.core.rate_limiter import check_endpoint_rate_limit
from datetime import datetime, timezone

router = APIRouter()

def _format_plant_age(planting_date: datetime) -> tuple[int, str]:
    now = datetime.now(timezone.utc)
    if planting_date.tzinfo is None:
        planting_date = planting_date.replace(tzinfo=timezone.utc)
    delta_days = max(0, (now - planting_date).days)
    
    if delta_days < 30:
        return delta_days, f"{delta_days} day{'s' if delta_days != 1 else ''}"
    elif delta_days < 365:
        months = max(1, delta_days // 30)
        return delta_days, f"{months} month{'s' if months != 1 else ''}"
    else:
        years = delta_days // 365
        rem_months = (delta_days % 365) // 30
        if rem_months > 0:
            return delta_days, f"{years} yr{'s' if years != 1 else ''}, {rem_months} mo{'s' if rem_months != 1 else ''}"
        return delta_days, f"{years} year{'s' if years != 1 else ''}"

@router.post("/register", response_model=PlantRegistrationResponse)
async def register_plant(
    req: PlantRegistrationRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    await check_endpoint_rate_limit(request, "plant_register", max_requests=5, window_seconds=3600)

    # Verify species exists
    result = await db.execute(select(PlantSpecies).filter(PlantSpecies.id == uuid.UUID(req.species_id)))
    species = result.scalars().first()
    if not species:
        raise HTTPException(status_code=404, detail="Species not found")
        
    plant_uuid = uuid.uuid4()
    scan_id = generate_scan_id(plant_uuid)
    
    # Create plant with postgis geom and public map preference
    plant = Plant(
        id=plant_uuid,
        owner_id=current_user.id,
        species_id=species.id,
        scan_id=scan_id,
        common_name=req.common_name or species.common_name,
        planting_date=req.planting_date,
        space_type=req.space_type,
        image_url=req.image_url,
        is_public_on_map=req.is_public_on_map,
        registered_location=f'SRID=4326;POINT({req.lng} {req.lat})',
        anchor_location=f'SRID=4326;POINT({req.lng} {req.lat})'
    )
    
    db.add(plant)
    await db.commit()
    await db.refresh(plant)
    
    qr_b64 = generate_qr_code(scan_id)
    
    return PlantRegistrationResponse(
        id=str(plant.id),
        scan_id=scan_id,
        qr_code_base64=qr_b64,
        common_name=plant.common_name,
        image_url=plant.image_url,
        is_public_on_map=plant.is_public_on_map
    )

@router.get("/species")
async def get_all_species(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(PlantSpecies))
    return result.scalars().all()

from app.models.growth import GrowthUpdate

@router.get("/my", response_model=List[PlantPortfolioResponse])
async def get_my_plants(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(
            Plant,
            func.ST_Y(Plant.registered_location).label("lat"),
            func.ST_X(Plant.registered_location).label("lng")
        )
        .options(selectinload(Plant.species), selectinload(Plant.growth_updates))
        .filter(Plant.owner_id == current_user.id)
    )
    rows = result.all()
    
    portfolio = []
    for row in rows:
        plant = row.Plant
        latest_gu = plant.growth_updates[0] if (hasattr(plant, "growth_updates") and plant.growth_updates) else None
        status_str = latest_gu.verification_status.value.lower() if latest_gu else "verified"

        portfolio.append(
            PlantPortfolioResponse(
                id=str(plant.id),
                scan_id=plant.scan_id,
                species_name=plant.species.common_name if plant.species else "Unknown",
                common_name=plant.common_name,
                planting_date=plant.planting_date,
                space_type=plant.space_type,
                lat=row.lat,
                lng=row.lng,
                status=status_str,
                image_url=plant.image_url,
                is_public_on_map=getattr(plant, "is_public_on_map", True)
            )
        )
    return portfolio

@router.get("/community-map", response_model=List[CommunityMapPlantResponse])
async def get_community_map_trees(
    current_user: User = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db)
):
    """
    Returns all public trees opted-in to the community map.
    Includes only the owner's first name for privacy.
    """
    result = await db.execute(
        select(
            Plant,
            User.name.label("owner_name"),
            func.ST_Y(Plant.registered_location).label("lat"),
            func.ST_X(Plant.registered_location).label("lng")
        )
        .join(User, User.id == Plant.owner_id)
        .options(selectinload(Plant.species), selectinload(Plant.growth_updates))
        .filter(Plant.is_public_on_map == True)
        .order_by(Plant.created_at.desc())
    )
    rows = result.all()
    
    community_trees = []
    for row in rows:
        plant = row.Plant
        owner_full_name = row.owner_name or "Citizen"
        # Protect privacy: extract first name only (e.g. "Rohit Kumbhar" -> "Rohit")
        owner_first_name = owner_full_name.strip().split()[0]
        
        age_days, age_formatted = _format_plant_age(plant.planting_date)
        estimated_carbon = round(max(5.0, age_days * 0.06), 1)

        latest_gu = plant.growth_updates[0] if (hasattr(plant, "growth_updates") and plant.growth_updates) else None
        status_str = latest_gu.verification_status.value.lower() if latest_gu else "verified"

        is_owner = False
        if current_user and current_user.id == plant.owner_id:
            is_owner = True

        community_trees.append(
            CommunityMapPlantResponse(
                id=str(plant.id),
                scan_id=plant.scan_id,
                common_name=plant.common_name or (plant.species.common_name if plant.species else "Urban Tree"),
                species_name=plant.species.common_name if plant.species else "Urban Species",
                owner_first_name=owner_first_name,
                owner_id=str(plant.owner_id),
                is_owner=is_owner,
                planting_date=plant.planting_date,
                age_days=age_days,
                age_formatted=age_formatted,
                space_type=plant.space_type,
                lat=row.lat,
                lng=row.lng,
                image_url=plant.image_url,
                estimated_carbon_kg=estimated_carbon,
                status=status_str
            )
        )
    return community_trees




@router.get("/{scan_id}/public", response_model=PlantPublicResponse)
async def get_public_plant(
    scan_id: str,
    db: AsyncSession = Depends(get_db)
):
    # We need to get the lat/lng out of the geometry to obfuscate it
    result = await db.execute(
        select(Plant, func.ST_X(Plant.registered_location).label("lng"), func.ST_Y(Plant.registered_location).label("lat"))
        .options(selectinload(Plant.species))
        .filter(Plant.scan_id == scan_id)
    )
    row = result.first()
    if not row:
        raise HTTPException(status_code=404, detail="Plant not found")
        
    p, lng, lat = row
    
    # Obfuscate GPS to 1 decimal place (roughly 11.1 km accuracy)
    locality_lat = round(lat, 1)
    locality_lng = round(lng, 1)
    
    return PlantPublicResponse(
        scan_id=p.scan_id,
        species_name=p.species.common_name,
        scientific_name=p.species.scientific_name,
        common_name=p.common_name,
        planting_date=p.planting_date,
        space_type=p.space_type,
        locality_lat=locality_lat,
        locality_lng=locality_lng
    )


@router.delete("/{plant_id}")
async def delete_plant(
    plant_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    try:
        p_uuid = uuid.UUID(plant_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid plant ID format")

    result = await db.execute(select(Plant).filter(Plant.id == p_uuid, Plant.owner_id == current_user.id))
    plant = result.scalars().first()
    if not plant:
        raise HTTPException(status_code=404, detail="Plant not found or unauthorized")

    # Delete related growth updates
    await db.execute(text("DELETE FROM growth_updates WHERE plant_id = :pid"), {"pid": str(p_uuid)})

    await db.delete(plant)
    await db.commit()

    return {"message": "Plant deleted successfully", "id": plant_id}


from app.schemas.plants import NurseryCareRequest, NurseryCareResponse, WaterAdvice, SunlightAdvice, FertilizerAdvice
import json
import httpx
import os
from app.core.config import settings

@router.post("/nursery-ai-guide", response_model=NurseryCareResponse)
async def generate_nursery_care_guide(
    req: NurseryCareRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Generates personalized plant nursery care guidance from Sprout AI (Plant Caretaker) in the user's preferred language.
    """
    groq_api_key = getattr(settings, "GROQ_CARE_API_KEY", None) or getattr(settings, "GROQ_API_KEY", None) or os.getenv("GROQ_CARE_API_KEY") or os.getenv("GROQ_API_KEY")

    if groq_api_key:
        try:
            system_prompt = (
                "You are 'Sprout', a gentle, loving, world-class plant nursery teacher and master gardener caretaker. "
                "Your goal is to give simple, practical, highly encouraging care advice for a user's plant. "
                f"You MUST generate all response strings natively in the requested language: '{req.language}'. "
                "Respond STRICTLY in valid JSON matching this exact structure:\n"
                "{\n"
                f'  "plant_name": "{req.plant_name}",\n'
                '  "caretaker_greeting": "Warm, cute greeting introducing yourself as Sprout in requested language",\n'
                f'  "language": "{req.language}",\n'
                f'  "age_months": {req.age_months},\n'
                '  "water_advice": {\n'
                '    "quantity_ml_or_cups": "Exact quantity (e.g. 200ml / 1 cup per session)",\n'
                '    "frequency": "Frequency (e.g. Every 2-3 days when soil feels dry)",\n'
                '    "instructions": "Simple step-by-step watering advice"\n'
                '  },\n'
                '  "sunlight_advice": {\n'
                '    "placement": "Sunlight location (e.g. Bright indirect sunlight near east window)",\n'
                '    "hours_per_day": "3-5 hours daily",\n'
                '    "tip": "Sunlight protection tip"\n'
                '  },\n'
                '  "fertilizer_advice": {\n'
                '    "type_recommended": "Recommended fertilizer (e.g. Organic compost / Seaweed extract)",\n'
                '    "frequency": "Feeding frequency suitable for plant age",\n'
                '    "npk_or_organic_tip": "Specific organic feeding trick"\n'
                '  },\n'
                '  "pruning_soil_advice": "Pruning and soil aeration advice",\n'
                '  "nursery_secret_tip": "A secret nursery caretaker trick for this specific species!"\n'
                "}"
            )

            user_prompt = (
                f"Plant Requested: '{req.plant_name}'.\n"
                f"Plant Age: {req.age_months} months.\n"
                f"Target Language: {req.language}.\n"
                f"Growing Space: {req.space_type}.\n"
                f"Season/Condition: {req.season_or_condition}.\n"
            )

            async with httpx.AsyncClient(timeout=10.0) as client:
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

                    w_adv = parsed.get("water_advice", {})
                    s_adv = parsed.get("sunlight_advice", {})
                    f_adv = parsed.get("fertilizer_advice", {})

                    return NurseryCareResponse(
                        plant_name=parsed.get("plant_name", req.plant_name.title()),
                        caretaker_greeting=parsed.get("caretaker_greeting", f"Hello! I am Sprout, your plant caretaker guide for {req.plant_name}!"),
                        language=req.language,
                        age_months=req.age_months,
                        water_advice=WaterAdvice(
                            quantity_ml_or_cups=w_adv.get("quantity_ml_or_cups", "150-200 ml"),
                            frequency=w_adv.get("frequency", "Every 2-3 days"),
                            instructions=w_adv.get("instructions", "Water gently at the base until topsoil is moist.")
                        ),
                        sunlight_advice=SunlightAdvice(
                            placement=s_adv.get("placement", "Bright indirect light"),
                            hours_per_day=s_adv.get("hours_per_day", "4-6 hours"),
                            tip=s_adv.get("tip", "Rotate pot weekly for even growth.")
                        ),
                        fertilizer_advice=FertilizerAdvice(
                            type_recommended=f_adv.get("type_recommended", "Organic Compost"),
                            frequency=f_adv.get("frequency", "Once a month"),
                            npk_or_organic_tip=f_adv.get("npk_or_organic_tip", "Mix 1 tbsp vermicompost into topsoil.")
                        ),
                        pruning_soil_advice=parsed.get("pruning_soil_advice", "Trim yellow leaves and maintain well-draining soil."),
                        nursery_secret_tip=parsed.get("nursery_secret_tip", "Wipe leaves gently with a damp cloth to boost photosynthesis!")
                    )
        except Exception as e:
            print(f"Nursery AI Groq call failed ({e}). Falling back to internal nursery logic.")

    # ── Deterministic Fallback ──────────────────────────────────────────────────
    return NurseryCareResponse(
        plant_name=req.plant_name.title(),
        caretaker_greeting=f"Hello dear gardener! I'm Sprout, your nursery caretaker companion. Here is my loving care guide for your {req.age_months}-month-old {req.plant_name.title()}!",
        language=req.language,
        age_months=req.age_months,
        water_advice=WaterAdvice(
            quantity_ml_or_cups="150 - 250 ml (about 1 cup)",
            frequency="2 to 3 times a week",
            instructions="Check the top inch of soil. If it feels dry to touch, water slowly until drops appear at the drainage hole."
        ),
        sunlight_advice=SunlightAdvice(
            placement="Bright, filtered indirect sunlight",
            hours_per_day="4 - 6 hours daily",
            tip="Keep away from harsh midday direct sun to prevent leaf scorching."
        ),
        fertilizer_advice=FertilizerAdvice(
            type_recommended="Balanced organic vermicompost or seaweed extract",
            frequency="Every 30 days during active growing season",
            npk_or_organic_tip="Add a handful of rich organic compost around the rim of the pot."
        ),
        pruning_soil_advice="Prune any dry or discolored stems. Ensure potting mix contains 30% perlite or coarse sand for root aeration.",
        nursery_secret_tip="Nursery Secret: Spritz leaves with clean water in the early morning to boost humidity and keep dust off stomatal pores!"
    )


