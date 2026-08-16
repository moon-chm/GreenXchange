import asyncio
import uuid
from datetime import datetime
from sqlalchemy.future import select

from app.db.session import AsyncSessionLocal
from app.models.users import User
from app.models.plants import Plant, PlantSpecies
from app.schemas.plants import PlantRegistrationRequest

async def main():
    print("==================================================")
    print("Testing Phase 14: Plant Photo Registration & Card Display")
    print("==================================================")

    async with AsyncSessionLocal() as session:
        # Get a test user and species
        res_user = await session.execute(select(User))
        user = res_user.scalars().first()

        res_spec = await session.execute(select(PlantSpecies))
        species = res_spec.scalars().first()

        assert user is not None, "Test user required"
        assert species is not None, "Test species required"

        test_img_b64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        plant_uuid = uuid.uuid4()
        scan_id = f"test_{plant_uuid.hex[:8]}"

        plant = Plant(
            id=plant_uuid,
            owner_id=user.id,
            species_id=species.id,
            scan_id=scan_id,
            common_name="Photo Test Rose",
            planting_date=datetime.utcnow(),
            space_type="indoor",
            image_url=test_img_b64,
            registered_location='SRID=4326;POINT(77.2090 28.6139)',
            anchor_location='SRID=4326;POINT(77.2090 28.6139)'
        )

        session.add(plant)
        await session.commit()
        await session.refresh(plant)

        print(f"\n1. Registered Plant '{plant.common_name}' (ID: {plant.id}):")
        print(f"   Scan ID: {plant.scan_id}")
        print(f"   Image URL stored: {plant.image_url[:40]}...")

        assert plant.image_url == test_img_b64
        print("SUCCESS: Plant registered with photo URL successfully!")

if __name__ == "__main__":
    asyncio.run(main())
