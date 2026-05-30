import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy import func

from app.api.deps import get_current_user, get_db
from app.models.users import User
from app.models.plants import Plant, PlantSpecies
from app.schemas.plants import PlantRegistrationRequest, PlantRegistrationResponse, PlantPublicResponse, PlantPortfolioResponse
from app.utils.identity import generate_scan_id, generate_qr_code
from app.core.rate_limiter import check_endpoint_rate_limit

router = APIRouter()

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
    
    # Create plant with postgis geom
    plant = Plant(
        id=plant_uuid,
        owner_id=current_user.id,
        species_id=species.id,
        scan_id=scan_id,
        common_name=req.common_name or species.common_name,
        planting_date=req.planting_date,
        space_type=req.space_type,
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
        common_name=plant.common_name
    )

@router.get("/species")
async def get_all_species(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(PlantSpecies))
    return result.scalars().all()

@router.get("/my", response_model=List[PlantPortfolioResponse])
async def get_my_plants(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Plant)
        .options(selectinload(Plant.species))
        .filter(Plant.owner_id == current_user.id)
    )
    plants = result.scalars().all()
    
    return [
        PlantPortfolioResponse(
            id=str(p.id),
            scan_id=p.scan_id,
            species_name=p.species.common_name,
            common_name=p.common_name,
            planting_date=p.planting_date,
            space_type=p.space_type
        ) for p in plants
    ]

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
