from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, text, update, literal_column
from sqlalchemy.exc import IntegrityError
from typing import List
import uuid

from app.api.deps import get_db, get_current_user
from app.models.users import User
from app.models.community import CommunityDrive, DriveParticipation
from app.schemas.drives import DriveCreate, DriveResponse, DriveJoinResponse

router = APIRouter()

@router.post("", response_model=DriveResponse)
async def create_drive(
    drive_in: DriveCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if drive_in.end_date <= drive_in.start_date:
        raise HTTPException(status_code=422, detail="Drive end_date must be after start_date")
    point = f"SRID=4326;POINT({drive_in.lng} {drive_in.lat})"
    
    new_drive = CommunityDrive(
        organizer_id=current_user.id,
        title=drive_in.title,
        description=drive_in.description,
        radius_meters=drive_in.radius_meters,
        start_date=drive_in.start_date,
        end_date=drive_in.end_date,
        location_center=point
    )
    
    db.add(new_drive)
    await db.commit()
    await db.refresh(new_drive)
    
    # Re-fetch with explicit lat/lng extraction for response
    result = await db.execute(
        select(
            CommunityDrive,
            func.ST_Y(CommunityDrive.location_center).label('lat'),
            func.ST_X(CommunityDrive.location_center).label('lng')
        ).filter(CommunityDrive.id == new_drive.id)
    )
    row = result.first()
    
    return DriveResponse(
        id=row.CommunityDrive.id,
        organizer_id=row.CommunityDrive.organizer_id,
        title=row.CommunityDrive.title,
        description=row.CommunityDrive.description,
        radius_meters=row.CommunityDrive.radius_meters,
        start_date=row.CommunityDrive.start_date,
        end_date=row.CommunityDrive.end_date,
        participant_count=row.CommunityDrive.participant_count,
        lat=row.lat,
        lng=row.lng
    )

@router.get("/nearby", response_model=List[DriveResponse])
async def get_nearby_drives(
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
    radius: float = Query(50000, ge=1, le=100000),
    db: AsyncSession = Depends(get_db)
):
    from geoalchemy2 import Geography

    point = f"SRID=4326;POINT({lng} {lat})"
    # Cast to geography for accurate distance calculations in meters
    location_geog = func.ST_GeographyFromText(point)
    drive_geog = func.cast(CommunityDrive.location_center, Geography)
    
    result = await db.execute(
        select(
            CommunityDrive,
            func.ST_Y(CommunityDrive.location_center).label('lat'),
            func.ST_X(CommunityDrive.location_center).label('lng'),
            func.ST_Distance(drive_geog, location_geog).label('distance')
        )
        .filter(func.ST_DWithin(drive_geog, location_geog, radius))
        .order_by(literal_column('distance').asc())
        .limit(50)
    )
    
    drives = []
    for row in result:
        drives.append(DriveResponse(
            id=row.CommunityDrive.id,
            organizer_id=row.CommunityDrive.organizer_id,
            title=row.CommunityDrive.title,
            description=row.CommunityDrive.description,
            radius_meters=row.CommunityDrive.radius_meters,
            start_date=row.CommunityDrive.start_date,
            end_date=row.CommunityDrive.end_date,
            participant_count=row.CommunityDrive.participant_count,
            lat=row.lat,
            lng=row.lng,
            distance_meters=row.distance
        ))
    return drives

@router.post("/{drive_id}/join", response_model=DriveJoinResponse)
async def join_drive(
    drive_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    from datetime import datetime, timezone
    drive_result = await db.execute(select(CommunityDrive).where(CommunityDrive.id == drive_id).with_for_update())
    drive = drive_result.scalar_one_or_none()
    if not drive:
        raise HTTPException(status_code=404, detail="Drive not found")
    now = datetime.now(timezone.utc)
    if drive.end_date < now:
        raise HTTPException(status_code=409, detail="This drive has ended")

    participation = DriveParticipation(
        user_id=current_user.id,
        drive_id=drive_id
    )
    db.add(participation)
    
    try:
        await db.flush()
        drive.participant_count += 1
        await db.commit()
    except IntegrityError as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Unable to join drive: participation already exists or the drive is unavailable"
        )
    
    # Fetch latest count
    count = drive.participant_count
    
    return DriveJoinResponse(
        drive_id=drive_id,
        participant_count=count,
        status="joined"
    )

@router.get("/my", response_model=List[DriveResponse])
async def get_my_drives(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(
            CommunityDrive,
            func.ST_Y(CommunityDrive.location_center).label('lat'),
            func.ST_X(CommunityDrive.location_center).label('lng')
        )
        .join(DriveParticipation, DriveParticipation.drive_id == CommunityDrive.id)
        .filter(DriveParticipation.user_id == current_user.id)
        .order_by(DriveParticipation.joined_at.desc())
    )
    
    drives = []
    for row in result:
        drives.append(DriveResponse(
            id=row.CommunityDrive.id,
            organizer_id=row.CommunityDrive.organizer_id,
            title=row.CommunityDrive.title,
            description=row.CommunityDrive.description,
            radius_meters=row.CommunityDrive.radius_meters,
            start_date=row.CommunityDrive.start_date,
            end_date=row.CommunityDrive.end_date,
            participant_count=row.CommunityDrive.participant_count,
            lat=row.lat,
            lng=row.lng
        ))
    return drives

@router.get("/{drive_id}", response_model=DriveResponse)
async def get_drive(
    drive_id: uuid.UUID,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(
            CommunityDrive,
            func.ST_Y(CommunityDrive.location_center).label('lat'),
            func.ST_X(CommunityDrive.location_center).label('lng')
        ).filter(CommunityDrive.id == drive_id)
    )
    row = result.first()
    
    if not row:
        raise HTTPException(status_code=404, detail="Drive not found")
        
    return DriveResponse(
        id=row.CommunityDrive.id,
        organizer_id=row.CommunityDrive.organizer_id,
        title=row.CommunityDrive.title,
        description=row.CommunityDrive.description,
        radius_meters=row.CommunityDrive.radius_meters,
        start_date=row.CommunityDrive.start_date,
        end_date=row.CommunityDrive.end_date,
        participant_count=row.CommunityDrive.participant_count,
        lat=row.lat,
        lng=row.lng
    )
