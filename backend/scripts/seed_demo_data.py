import asyncio
import uuid
from datetime import datetime, timedelta, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.db.session import AsyncSessionLocal
from app.models.users import User
from app.models.plants import PlantSpecies, Plant
from app.models.enums import NewsCategory, ToxicityLevel, AllergenRisk, MaintenanceLevel, GrowthRate, SpaceType
from app.models.community import CommunityDrive
from app.models.news import NewsFeedItem
from app.services.rewards import seed_default_marketplace_items
from app.core.security import get_password_hash

async def seed_demo_data():
    async with AsyncSessionLocal() as session:
        print("🌱 Seeding GreenXchange demo & real-world data...")

        # 1. Seed Plant Species if empty
        res = await session.execute(select(func.count(PlantSpecies.id)))
        species_count = res.scalar()
        if species_count == 0:
            species_list = [
                PlantSpecies(
                    id=uuid.uuid4(),
                    common_name="Snake Plant",
                    scientific_name="Sansevieria trifasciata",
                    genus="Sansevieria",
                    family="Asparagaceae",
                    co2_absorption_rate=12.5,
                    pm25_absorption_rate=8.2,
                    voc_absorption_rate=15.0,
                    toxicity_level=ToxicityLevel.MODERATE,
                    allergen_risk=AllergenRisk.LOW,
                    maintenance_level=MaintenanceLevel.LOW,
                    growth_rate=GrowthRate.SLOW,
                    space_type_compatibility=[SpaceType.INDOOR, SpaceType.BALCONY],
                    temperature_range="15-30C",
                    soil_ph_range="6.0-7.5",
                    data_source="NASA Clean Air Study"
                ),
                PlantSpecies(
                    id=uuid.uuid4(),
                    common_name="Neem Tree",
                    scientific_name="Azadirachta indica",
                    genus="Azadirachta",
                    family="Meliaceae",
                    co2_absorption_rate=25.8,
                    pm25_absorption_rate=18.5,
                    voc_absorption_rate=22.0,
                    toxicity_level=ToxicityLevel.LOW,
                    allergen_risk=AllergenRisk.LOW,
                    maintenance_level=MaintenanceLevel.LOW,
                    growth_rate=GrowthRate.FAST,
                    space_type_compatibility=[SpaceType.OUTDOOR, SpaceType.ROOFTOP],
                    temperature_range="20-40C",
                    soil_ph_range="5.5-8.5",
                    data_source="Urban Forestry Research"
                ),
                PlantSpecies(
                    id=uuid.uuid4(),
                    common_name="Peace Lily",
                    scientific_name="Spathiphyllum wallisii",
                    genus="Spathiphyllum",
                    family="Araceae",
                    co2_absorption_rate=10.2,
                    pm25_absorption_rate=14.1,
                    voc_absorption_rate=19.4,
                    toxicity_level=ToxicityLevel.HIGH,
                    allergen_risk=AllergenRisk.MODERATE,
                    maintenance_level=MaintenanceLevel.MODERATE,
                    growth_rate=GrowthRate.MEDIUM,
                    space_type_compatibility=[SpaceType.INDOOR],
                    temperature_range="18-28C",
                    soil_ph_range="5.8-6.8",
                    data_source="NASA Clean Air Study"
                ),
                PlantSpecies(
                    id=uuid.uuid4(),
                    common_name="Tulsi (Holy Basil)",
                    scientific_name="Ocimum tenuiflorum",
                    genus="Ocimum",
                    family="Lamiaceae",
                    co2_absorption_rate=18.4,
                    pm25_absorption_rate=12.0,
                    voc_absorption_rate=10.5,
                    toxicity_level=ToxicityLevel.NONE,
                    allergen_risk=AllergenRisk.LOW,
                    maintenance_level=MaintenanceLevel.LOW,
                    growth_rate=GrowthRate.FAST,
                    space_type_compatibility=[SpaceType.BALCONY, SpaceType.INDOOR, SpaceType.OUTDOOR],
                    temperature_range="20-35C",
                    soil_ph_range="6.0-7.5",
                    data_source="Botanical Survey of India"
                ),
                PlantSpecies(
                    id=uuid.uuid4(),
                    common_name="Aloe Vera",
                    scientific_name="Aloe barbadensis miller",
                    genus="Aloe",
                    family="Asphodelaceae",
                    co2_absorption_rate=11.0,
                    pm25_absorption_rate=6.5,
                    voc_absorption_rate=12.8,
                    toxicity_level=ToxicityLevel.MODERATE,
                    allergen_risk=AllergenRisk.LOW,
                    maintenance_level=MaintenanceLevel.LOW,
                    growth_rate=GrowthRate.MEDIUM,
                    space_type_compatibility=[SpaceType.INDOOR, SpaceType.BALCONY],
                    temperature_range="15-35C",
                    soil_ph_range="6.0-7.0",
                    data_source="Ecosystem Health Journal"
                )
            ]
            session.add_all(species_list)
            await session.flush()
            print("  [+] Seeded 5 Real-World Plant Species")
        else:
            print("  [✓] Plant Species already seeded")

        # 2. Ensure Admin, Demo Users, and Government Allocated Organizations exist
        res = await session.execute(select(User).filter(User.email == "admin@greenxchange.org"))
        admin = res.scalars().first()
        if not admin:
            admin = User(
                id=uuid.uuid4(),
                email="admin@greenxchange.org",
                password_hash=get_password_hash("AdminPass123!"),
                name="GreenXchange Admin",
                location_lat=28.6139,
                location_lng=77.2090,
                role="ADMIN",
                is_org=False
            )
            session.add(admin)
            await session.flush()
            print("  [+] Admin user created: admin@greenxchange.org")
        else:
            print("  [✓] Admin user already exists")

        # Government Allocated Organization 1: Delhi Municipal Green Nursery
        res_org1 = await session.execute(select(User).filter(User.email == "gov_nursery_delhi@greenxchange.gov.in"))
        org1 = res_org1.scalars().first()
        if not org1:
            org1 = User(
                id=uuid.uuid4(),
                email="gov_nursery_delhi@greenxchange.gov.in",
                password_hash=get_password_hash("GovNurseryPass2026!"),
                name="Delhi Municipal Green Nursery",
                location_lat=28.6139,
                location_lng=77.2090,
                role="ORGANIZATION",
                is_org=True
            )
            session.add(org1)
            await session.flush()
            print("  [+] Government Allocated Org 1 created: gov_nursery_delhi@greenxchange.gov.in (Pass: GovNurseryPass2026!)")

        # Government Allocated Organization 2: EcoCare Bio-Services Org
        res_org2 = await session.execute(select(User).filter(User.email == "ecocare_partner@greenxchange.org"))
        org2 = res_org2.scalars().first()
        if not org2:
            org2 = User(
                id=uuid.uuid4(),
                email="ecocare_partner@greenxchange.org",
                password_hash=get_password_hash("EcoPartnerPass2026!"),
                name="EcoCare Bio-Services Org",
                location_lat=28.6139,
                location_lng=77.2090,
                role="ORGANIZATION",
                is_org=True
            )
            session.add(org2)
            await session.flush()
            print("  [+] Government Allocated Org 2 created: ecocare_partner@greenxchange.org (Pass: EcoPartnerPass2026!)")

        # Government Test Organization: Government Test Nursery Org
        res_testorg = await session.execute(select(User).filter(User.email == "testorg@nursery.gov.in"))
        testorg = res_testorg.scalars().first()
        if not testorg:
            testorg = User(
                id=uuid.uuid4(),
                email="testorg@nursery.gov.in",
                password_hash=get_password_hash("TestOrg123!"),
                name="Government Test Nursery Org",
                location_lat=28.6139,
                location_lng=77.2090,
                role="ORGANIZATION",
                is_org=True
            )
            session.add(testorg)
            await session.flush()
            print("  [+] Test Org created: testorg@nursery.gov.in (Pass: TestOrg123!)")


        res_demo = await session.execute(select(User).filter(User.email == "test3@example.com"))
        demo_user = res_demo.scalars().first()
        if not demo_user:
            demo_user = User(
                id=uuid.uuid4(),
                email="test3@example.com",
                password_hash=get_password_hash("password123"),
                name="Demo Eco Gardener",
                location_lat=28.6139,
                location_lng=77.2090,
                is_active=True
            )
            session.add(demo_user)
            await session.flush()
            print("  [+] Demo user created: test3@example.com")

        # 3. Seed Community Drives if empty
        res = await session.execute(select(func.count(CommunityDrive.id)))
        drives_count = res.scalar()
        if drives_count == 0:
            now = datetime.now(timezone.utc)
            drives = [
                CommunityDrive(
                    id=uuid.uuid4(),
                    organizer_id=admin.id,
                    title="Yamuna Riverfront Urban Reforestation",
                    description="Planting native Neem, Peepal, and Sheesham saplings to restore riverbed biodiversity and mitigate urban smog.",
                    location_center="SRID=4326;POINT(77.2295 28.6129)",
                    radius_meters=5000.0,
                    start_date=now - timedelta(days=2),
                    end_date=now + timedelta(days=14),
                    participant_count=48
                ),
                CommunityDrive(
                    id=uuid.uuid4(),
                    organizer_id=admin.id,
                    title="City Center Rooftop Air-Clean Drive",
                    description="Distributing Snake Plants and Peace Lilies to urban apartments to reduce indoor PM2.5 and VOC levels.",
                    location_center="SRID=4326;POINT(77.2090 28.6139)",
                    radius_meters=3000.0,
                    start_date=now - timedelta(days=5),
                    end_date=now + timedelta(days=7),
                    participant_count=112
                ),
                CommunityDrive(
                    id=uuid.uuid4(),
                    organizer_id=admin.id,
                    title="Suburban Greenway Corridor Drive",
                    description="Establishing a 2km continuous tree canopy along suburban bike paths for shade and carbon absorption.",
                    location_center="SRID=4326;POINT(77.1800 28.5500)",
                    radius_meters=4000.0,
                    start_date=now + timedelta(days=3),
                    end_date=now + timedelta(days=20),
                    participant_count=29
                )
            ]
            session.add_all(drives)
            print("  [+] Seeded 3 Community Reforestation Drives")
        else:
            print("  [✓] Community Drives already seeded")

        # 4. Seed News Feed Items if empty
        res = await session.execute(select(func.count(NewsFeedItem.id)))
        news_count = res.scalar()
        if news_count == 0:
            now = datetime.now(timezone.utc)
            news_items = [
                NewsFeedItem(
                    id=uuid.uuid4(),
                    title="Urban Trees Absorption Study: 15% Reduction in Smog Peak",
                    content_summary="New satellite telemetry demonstrates that densely planted urban micro-forests significantly lower localized particulate matter concentrations during winter inversions.",
                    source_url="https://climate.example.org/articles/urban-trees-smog-reduction",
                    category=NewsCategory.ENVIRONMENT,
                    tags=["AirQuality", "Reforestation", "UrbanForestry"],
                    location_scope="SRID=4326;POINT(77.2090 28.6139)",
                    published_at=now - timedelta(hours=6),
                    relevance_score=0.95
                ),
                NewsFeedItem(
                    id=uuid.uuid4(),
                    title="GreenXchange Milestones: 50,000 Verified Saplings Planted",
                    content_summary="Community members have officially reached 50k verified plant passport registrations, offsetting over 750 metric tons of carbon annually.",
                    source_url="https://greenxchange.org/news/50k-milestone",
                    category=NewsCategory.COMMUNITY,
                    tags=["Milestone", "CarbonOffset", "Community"],
                    location_scope=None,
                    published_at=now - timedelta(days=1),
                    relevance_score=0.90
                ),
                NewsFeedItem(
                    id=uuid.uuid4(),
                    title="Heatwave Mitigation: How Shade Canopies Lower City Temps by 3°C",
                    content_summary="Microclimate monitoring confirms street tree canopies noticeably cool pavement surfaces and reduce building cooling energy consumption.",
                    source_url="https://climate.example.org/articles/heatwave-mitigation-shade",
                    category=NewsCategory.ENVIRONMENT,
                    tags=["Heatwave", "Microclimate", "Shade"],
                    location_scope="SRID=4326;POINT(77.2200 28.6300)",
                    published_at=now - timedelta(days=2),
                    relevance_score=0.85
                ),
                NewsFeedItem(
                    id=uuid.uuid4(),
                    title="Native Plant Species Guide for Suburban Balconies",
                    content_summary="Discover high-absorption, low-maintenance native foliage optimal for small balcony planters and urban terraces.",
                    source_url="https://greenxchange.org/guides/balcony-plants",
                    category=NewsCategory.TIPS,
                    tags=["NativePlants", "Gardening", "UrbanLiving"],
                    location_scope=None,
                    published_at=now - timedelta(days=3),
                    relevance_score=0.80
                )
            ]
            session.add_all(news_items)
            print("  [+] Seeded 4 News Feed Items")
        else:
            print("  [✓] News Feed Items already seeded")

        # 5. Seed Reward Marketplace Items
        await seed_default_marketplace_items(session)
        print("  [+] Seeded Marketplace Items")

        await session.commit()

        # 6. Seed User Plant Portfolios
        from scripts.seed_user_plants import seed_plants_for_users
        await seed_plants_for_users()

        print("✅ Real-world demo data seeding completed successfully!")

if __name__ == "__main__":
    asyncio.run(seed_demo_data())


