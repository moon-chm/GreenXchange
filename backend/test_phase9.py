import asyncio
import uuid
from datetime import datetime, timezone, timedelta
from app.db.session import AsyncSessionLocal
from sqlalchemy import text
from app.models.community import CommunityDrive, DriveParticipation

async def main():
    print("Testing Community Drives Module...")
    
    organizer_id = uuid.uuid4()
    participant_id = uuid.uuid4()
    
    async with AsyncSessionLocal() as session:
        # Create test users
        await session.execute(
            text("INSERT INTO users (id, name, email, password_hash, is_active) VALUES (:id, 'Organizer', 'org@test.com', 'hash', true)"),
            {"id": organizer_id}
        )
        await session.execute(
            text("INSERT INTO users (id, name, email, password_hash, is_active) VALUES (:id, 'Participant', 'part@test.com', 'hash', true)"),
            {"id": participant_id}
        )
        await session.commit()
        
        try:
            # 1. Create a drive in London
            lon_lat = (51.5072, -0.1276) # London
            london_drive = CommunityDrive(
                organizer_id=organizer_id,
                title="London Tree Planting",
                description="Planting trees in Hyde Park",
                radius_meters=5000,
                start_date=datetime.now(timezone.utc),
                end_date=datetime.now(timezone.utc) + timedelta(days=1),
                location_center=f"SRID=4326;POINT({lon_lat[1]} {lon_lat[0]})"
            )
            
            # 2. Create a drive in Paris
            par_lat = (48.8566, 2.3522) # Paris
            paris_drive = CommunityDrive(
                organizer_id=organizer_id,
                title="Paris Cleanup",
                description="Cleaning up the Seine",
                radius_meters=5000,
                start_date=datetime.now(timezone.utc),
                end_date=datetime.now(timezone.utc) + timedelta(days=1),
                location_center=f"SRID=4326;POINT({par_lat[1]} {par_lat[0]})"
            )
            
            session.add_all([london_drive, paris_drive])
            await session.commit()
            
            print(f"Created drives: London={london_drive.id}, Paris={paris_drive.id}")
            
            # 3. Test duplicate join (Unique constraint)
            print("Testing duplicate join constraint...")
            from sqlalchemy.exc import IntegrityError
            
            p1 = DriveParticipation(user_id=participant_id, drive_id=london_drive.id)
            session.add(p1)
            await session.commit()
            print("First join successful")
            
            p2 = DriveParticipation(user_id=participant_id, drive_id=london_drive.id)
            session.add(p2)
            try:
                await session.commit()
                print("FAILED: Duplicate join allowed")
            except IntegrityError:
                await session.rollback()
                print("SUCCESS: Duplicate join blocked (IntegrityError)")
                
        finally:
            # Cleanup
            print("Cleaning up test records...")
            await session.execute(text(f"DELETE FROM users WHERE id IN ('{organizer_id}', '{participant_id}')"))
            await session.commit()

if __name__ == "__main__":
    asyncio.run(main())
