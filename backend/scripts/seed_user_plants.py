import asyncio
import uuid
from datetime import datetime, timezone, timedelta
from sqlalchemy import select, func
from app.db.session import AsyncSessionLocal
from app.models.users import User
from app.models.plants import Plant, PlantSpecies
from app.models.enums import SpaceType

async def seed_plants_for_users():
    print("🌱 Seeding realistic plant portfolios for all registered users...")
    async with AsyncSessionLocal() as session:
        # Get all species
        sp_res = await session.execute(select(PlantSpecies))
        species_list = sp_res.scalars().all()
        if not species_list:
            print("❌ No plant species found! Run seed_demo_data.py first.")
            return

        snake_sp = next((s for s in species_list if "Snake" in s.common_name), species_list[0])
        neem_sp = next((s for s in species_list if "Neem" in s.common_name), species_list[0])
        tulsi_sp = next((s for s in species_list if "Tulsi" in s.common_name), species_list[0])

        # Get all users
        users_res = await session.execute(select(User))
        users = users_res.scalars().all()

        added_count = 0
        now = datetime.now(timezone.utc)

        for u in users:
            # Check if user already has plants
            p_res = await session.execute(select(func.count(Plant.id)).filter(Plant.owner_id == u.id))
            cnt = p_res.scalar() or 0

            if cnt == 0:
                lat = u.location_lat or 28.6139
                lng = u.location_lng or 77.2090
                point_str = f"SRID=4326;POINT({lng} {lat})"

                p1 = Plant(
                    id=uuid.uuid4(),
                    owner_id=u.id,
                    species_id=snake_sp.id,
                    scan_id=f"scan_{uuid.uuid4().hex[:8]}",
                    common_name="Indoor Air Purifier",
                    registered_location=point_str,
                    anchor_location=point_str,
                    planting_date=now - timedelta(days=45),
                    space_type=SpaceType.INDOOR,
                    image_url="https://images.unsplash.com/photo-1593482892290-f54927ae1bac?auto=format&fit=crop&w=800&q=80"
                )

                p2 = Plant(
                    id=uuid.uuid4(),
                    owner_id=u.id,
                    species_id=neem_sp.id,
                    scan_id=f"scan_{uuid.uuid4().hex[:8]}",
                    common_name="Neem Canopy Tree",
                    registered_location=point_str,
                    anchor_location=point_str,
                    planting_date=now - timedelta(days=90),
                    space_type=SpaceType.OUTDOOR_GARDEN,
                    image_url="https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=800&q=80"
                )

                p3 = Plant(
                    id=uuid.uuid4(),
                    owner_id=u.id,
                    species_id=tulsi_sp.id,
                    scan_id=f"scan_{uuid.uuid4().hex[:8]}",
                    common_name="Holy Tulsi Shrine",
                    registered_location=point_str,
                    anchor_location=point_str,
                    planting_date=now - timedelta(days=20),
                    space_type=SpaceType.OUTDOOR_BALCONY,
                    image_url="https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?auto=format&fit=crop&w=800&q=80"
                )

                session.add_all([p1, p2, p3])
                added_count += 3
                print(f"  [+] Seeded 3 plants for user '{u.email}'")

        await session.commit()
        print(f"✅ Seeding finished! Total new plant records added: {added_count}")

if __name__ == "__main__":
    asyncio.run(seed_plants_for_users())
