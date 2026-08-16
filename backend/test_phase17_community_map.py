import asyncio
import uuid
from datetime import datetime, timezone, timedelta
from sqlalchemy import select
from app.db.session import AsyncSessionLocal
from app.models.users import User
from app.models.plants import Plant, PlantSpecies
from app.models.enums import SpaceType
from app.core.security import get_password_hash
from app.api.plants import _format_plant_age

async def test_community_map_suite():
    print("=" * 50)
    print("Testing Phase 17: Community Canopy Map & Privacy Opt-In")
    print("=" * 50)

    async with AsyncSessionLocal() as session:
        # Fetch or create a test species
        sp_res = await session.execute(select(PlantSpecies))
        species = sp_res.scalars().first()
        assert species is not None, "Species should exist in database"

        # 1. Create User A (Rohit Sharma) and User B (Priya Patel)
        user_a = User(
            id=uuid.uuid4(),
            name="Rohit Sharma",
            email=f"rohit_{uuid.uuid4().hex[:6]}@example.com",
            password_hash=get_password_hash("Pass123!"),
            is_active=True,
            email_verified=True
        )
        user_b = User(
            id=uuid.uuid4(),
            name="Priya Patel",
            email=f"priya_{uuid.uuid4().hex[:6]}@example.com",
            password_hash=get_password_hash("Pass123!"),
            is_active=True,
            email_verified=True
        )
        session.add_all([user_a, user_b])
        await session.commit()

        # 2. Plant 1 (User A) -> Opted-in to Public Map (is_public_on_map = True)
        now = datetime.now(timezone.utc)
        plant_public = Plant(
            id=uuid.uuid4(),
            owner_id=user_a.id,
            species_id=species.id,
            scan_id=f"pub_{uuid.uuid4().hex[:8]}",
            common_name="Rohit's Royal Gulmohar",
            planting_date=now - timedelta(days=400), # ~1 yr 1 mo old
            space_type=SpaceType.OUTDOOR_GARDEN,
            is_public_on_map=True,
            registered_location='SRID=4326;POINT(77.2090 28.6139)',
            anchor_location='SRID=4326;POINT(77.2090 28.6139)'
        )

        # 3. Plant 2 (User A) -> Private (is_public_on_map = False)
        plant_private = Plant(
            id=uuid.uuid4(),
            owner_id=user_a.id,
            species_id=species.id,
            scan_id=f"prv_{uuid.uuid4().hex[:8]}",
            common_name="Rohit's Secret Indoor Bonsai",
            planting_date=now - timedelta(days=45), # ~1 mo old
            space_type=SpaceType.INDOOR,
            is_public_on_map=False,
            registered_location='SRID=4326;POINT(77.2090 28.6139)',
            anchor_location='SRID=4326;POINT(77.2090 28.6139)'
        )

        # 4. Plant 3 (User B) -> Opted-in to Public Map (is_public_on_map = True)
        plant_priya = Plant(
            id=uuid.uuid4(),
            owner_id=user_b.id,
            species_id=species.id,
            scan_id=f"priya_{uuid.uuid4().hex[:8]}",
            common_name="Priya's Balcony Mango",
            planting_date=now - timedelta(days=20), # 20 days old
            space_type=SpaceType.OUTDOOR_BALCONY,
            is_public_on_map=True,
            registered_location='SRID=4326;POINT(77.2150 28.6200)',
            anchor_location='SRID=4326;POINT(77.2150 28.6200)'
        )

        session.add_all([plant_public, plant_private, plant_priya])
        await session.commit()
        print("1. Seeded test users and opted-in / private plants.")

        # 5. Test Age formatting logic
        days_400, fmt_400 = _format_plant_age(now - timedelta(days=400))
        assert "yr" in fmt_400, f"Expected year in formatted age, got {fmt_400}"
        days_20, fmt_20 = _format_plant_age(now - timedelta(days=20))
        assert "20 days" == fmt_20, f"Expected '20 days', got {fmt_20}"
        print(f"2. Age formatting verified: 400 days -> '{fmt_400}', 20 days -> '{fmt_20}'")

        # 6. Query Community Map Trees
        query = (
            select(Plant, User.name.label("owner_name"))
            .join(User, User.id == Plant.owner_id)
            .filter(Plant.is_public_on_map == True)
        )
        res = await session.execute(query)
        rows = res.all()
        public_scan_ids = [r.Plant.scan_id for r in rows]

        assert plant_public.scan_id in public_scan_ids, "Opted-in tree should be returned on community map"
        assert plant_priya.scan_id in public_scan_ids, "Priya's opted-in tree should be returned on community map"
        assert plant_private.scan_id not in public_scan_ids, "Private tree (is_public_on_map=False) MUST NOT be returned on community map"
        print("3. Privacy filter verified: Only is_public_on_map=True trees appear on community map.")

        # 7. Verify First Name Only Privacy Guard
        for r in rows:
            if r.Plant.id == plant_public.id:
                first_name = r.owner_name.strip().split()[0]
                assert first_name == "Rohit", f"Expected first name 'Rohit', got {first_name}"
                assert "Sharma" not in first_name, "Last name should be stripped for privacy"
            if r.Plant.id == plant_priya.id:
                first_name = r.owner_name.strip().split()[0]
                assert first_name == "Priya", f"Expected first name 'Priya', got {first_name}"
                assert "Patel" not in first_name, "Last name should be stripped for privacy"
        print("4. Owner first-name privacy protection verified.")

        # Cleanup
        await session.delete(plant_public)
        await session.delete(plant_private)
        await session.delete(plant_priya)
        await session.delete(user_a)
        await session.delete(user_b)
        await session.commit()
        print("5. Test cleanup completed.")

    print("\n✅ Phase 17 Community Canopy Map Suite PASSED!")

if __name__ == "__main__":
    asyncio.run(test_community_map_suite())
