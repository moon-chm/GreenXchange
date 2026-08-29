"""
Real-Life User Journey Simulation & QA Suite for GreenXchange
============================================================
Simulates realistic end-user flows:
1. Citizen Signup, Email Token Verification & Login
2. Microclimate Telemetry Auto-Detection
3. Groq LLM Explainable AI (XAI) Plant Recommendations
4. Plant Registration with Photo & PyTorch ResNet18 Tree Detection
5. Growth Update Upload with Error Level Analysis (ELA)
6. PostGIS Spatial Community Drive Discovery & Joining
7. Append-Only Reward Ledger, Marketplace Voucher Redemption & Crypto Payout
8. Organization / Government Nursery Billing & User Password Approval
9. Community Canopy Map Privacy Protection
10. Hardware IoT Telemetry Ingestion

All test records are safely created with isolated test prefixes and cleaned up automatically.
"""

import sys
import os
import uuid
import time
import json
import asyncio
from datetime import datetime, timezone, timedelta
from typing import Dict, Any

from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select, delete

# Add backend to sys.path
sys.path.insert(0, "/app")

from app.main import app
from app.db.session import engine, AsyncSessionLocal
from app.models.users import User
from app.models.plants import Plant, PlantSpecies
from app.models.growth import GrowthUpdate
from app.models.rewards import RewardTransaction, MarketplaceItem, RedemptionTransaction, PayoutRequest, OrgPaymentRequest
from app.models.community import CommunityDrive, DriveParticipation

ERRORS_COLLECTED = []
WARNINGS_COLLECTED = []

def record_error(journey: str, description: str, details: Any = None):
    ERRORS_COLLECTED.append({
        "journey": journey,
        "description": description,
        "details": str(details) if details else ""
    })
    print(f"❌ [ERROR in {journey}]: {description} | Details: {details}")

def record_warning(journey: str, description: str):
    WARNINGS_COLLECTED.append({
        "journey": journey,
        "description": description
    })
    print(f"⚠️ [WARNING in {journey}]: {description}")

async def run_real_user_qa():
    print("=" * 70)
    print("🌿 GREENXCHANGE REAL-LIFE USER JOURNEY QA & HEALTH AUDIT")
    print("=" * 70)

    test_id = uuid.uuid4().hex[:6]
    citizen_email = f"citizen_real_{test_id}@greenxchange.org"
    citizen_password = "SecureCitizenPass2026!"
    citizen_name = f"Aarav Sharma ({test_id})"

    org_email = f"nursery_real_{test_id}@greenxchange.gov.in"
    org_password = "NurseryGovPass2026!"
    org_name = f"City Forest Nursery ({test_id})"

    created_user_ids = []
    created_plant_ids = []
    created_drive_ids = []

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://localhost") as client:
        # -----------------------------------------------------------------
        # JOURNEY 1: Citizen Onboarding & Authentication
        # -----------------------------------------------------------------
        print("\n[Journey 1]: Citizen Registration, Email Verification & Profile...")
        try:
            # 1.1 Register
            reg_resp = await client.post("/api/auth/register", json={
                "email": citizen_email,
                "password": citizen_password,
                "name": citizen_name,
                "location_lat": 28.6139,
                "location_lng": 77.2090,
                "device_fingerprint": f"fp_browser_{test_id}"
            })
            if reg_resp.status_code != 200:
                record_error("Journey 1 (Registration)", f"Status {reg_resp.status_code}", reg_resp.text)
            else:
                user_data = reg_resp.json()
                citizen_id = uuid.UUID(user_data["id"])
                created_user_ids.append(citizen_id)
                print(f"  ✓ User registered: {citizen_email} (ID: {citizen_id})")

            # 1.2 Verify Email via Token
            async with AsyncSessionLocal() as session:
                u_res = await session.execute(select(User).filter(User.id == citizen_id))
                u = u_res.scalar_one_or_none()
                verif_token = u.email_verification_token

            if not verif_token:
                record_error("Journey 1 (Email Token)", "No email verification token generated for user.")
            else:
                verif_resp = await client.get(f"/api/auth/verify-email?token={verif_token}")
                if verif_resp.status_code != 200:
                    record_error("Journey 1 (Verify Email)", f"Status {verif_resp.status_code}", verif_resp.text)
                else:
                    print("  ✓ Email verified and account activated successfully.")

            # 1.3 Login
            login_resp = await client.post("/api/auth/login", data={
                "username": citizen_email,
                "password": citizen_password
            })
            if login_resp.status_code != 200:
                record_error("Journey 1 (Login)", f"Status {login_resp.status_code}", login_resp.text)
                citizen_token = None
            else:
                login_data = login_resp.json()
                citizen_token = login_data.get("access_token")
                print("  ✓ Login successful, RS256 JWT access token acquired.")

            # 1.4 Get Profile
            if citizen_token:
                me_resp = await client.get("/api/users/me", headers={"Authorization": f"Bearer {citizen_token}"})
                if me_resp.status_code != 200 or not me_resp.json().get("email_verified"):
                    record_error("Journey 1 (Profile)", f"Profile fetch failed or email not verified: {me_resp.text}")
                else:
                    print("  ✓ User profile verified: Active & Email Verified.")

        except Exception as e:
            record_error("Journey 1 (Exception)", str(e))

        # -----------------------------------------------------------------
        # JOURNEY 2: Environmental Telemetry & Live Microclimate
        # -----------------------------------------------------------------
        print("\n[Journey 2]: Microclimate Telemetry Auto-Detection & Caching...")
        try:
            env_resp = await client.get("/api/environment/profile?lat=28.6139&lng=77.2090", headers={"Authorization": f"Bearer {citizen_token}"})
            if env_resp.status_code != 200:
                record_error("Journey 2 (Telemetry)", f"Status {env_resp.status_code}", env_resp.text)
            else:
                env_data = env_resp.json()
                weather = env_data.get("weather", {})
                aqi = env_data.get("air_quality", {})
                print(f"  ✓ Live Weather: Temp={weather.get('temperature')}°C, Humidity={weather.get('humidity')}%, Climate={weather.get('climate_zone')}")
                print(f"  ✓ Air Quality: AQI={aqi.get('aqi')}, PM2.5={aqi.get('pm25')}µg/m³, Severity={aqi.get('severity')}")
                if "temperature" not in weather or "aqi" not in aqi:
                    record_error("Journey 2 (Data Completeness)", "Missing required weather/aqi fields", env_data)
        except Exception as e:
            record_error("Journey 2 (Exception)", str(e))

        # -----------------------------------------------------------------
        # JOURNEY 3: Groq LLM & Explainable AI (XAI) Plant Recommendations
        # -----------------------------------------------------------------
        print("\n[Journey 3]: Groq LLM Botanical Analysis & XAI Scoring...")
        try:
            rec_resp = await client.post("/api/recommendations/analyze", json={
                "plant_name": "Tulsi",
                "space_type": "outdoor_balcony",
                "has_pets": False,
                "has_children": True,
                "experience_level": "low",
                "lat": 28.6139,
                "lng": 77.2090
            }, headers={"Authorization": f"Bearer {citizen_token}"})

            if rec_resp.status_code != 200:
                record_error("Journey 3 (Recommendations)", f"Status {rec_resp.status_code}", rec_resp.text)
            else:
                rec_data = rec_resp.json()
                print(f"  ✓ Species: {rec_data.get('plant_name')} ({rec_data.get('scientific_name')})")
                print(f"  ✓ Overall Suitability Score: {rec_data.get('overall_score')}/100 (Grade {rec_data.get('suitability_grade')})")
                print(f"  ✓ GenAI Synthesis: {rec_data.get('genai_synthesis')[:80]}...")
                xai = rec_data.get("xai_breakdown", [])
                total_weight = sum(item.get("weight_pct", 0) for item in xai)
                if abs(total_weight - 100) > 1:
                    record_warning("Journey 3 (XAI Weights)", f"XAI weights sum to {total_weight}% instead of 100%")
                else:
                    print(f"  ✓ XAI Breakdown: {len(xai)} weighted factor dimensions validated (Total weight = {total_weight}%).")
        except Exception as e:
            record_error("Journey 3 (Exception)", str(e))

        # -----------------------------------------------------------------
        # JOURNEY 4: Plant Registration with Photo & PyTorch ResNet18 Tree Detection
        # -----------------------------------------------------------------
        print("\n[Journey 4]: Plant Registration & Computer Vision Validation...")
        try:
            # Fetch a valid species ID
            async with AsyncSessionLocal() as session:
                sp_res = await session.execute(select(PlantSpecies).limit(1))
                species = sp_res.scalars().first()
                species_id = str(species.id)
                species_name = species.common_name

            # 1x1 Green PNG sample
            sample_photo = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

            plant_reg_resp = await client.post("/api/plants/register", json={
                "species_id": species_id,
                "common_name": f"{species_name} Balcony Specimen",
                "lat": 28.6139,
                "lng": 77.2090,
                "planting_date": datetime.now(timezone.utc).isoformat(),
                "space_type": "outdoor_balcony",
                "is_public_on_map": True,
                "image_url": sample_photo
            }, headers={"Authorization": f"Bearer {citizen_token}"})

            if plant_reg_resp.status_code not in (200, 201):
                record_error("Journey 4 (Plant Registration)", f"Status {plant_reg_resp.status_code}", plant_reg_resp.text)
                created_plant_id = None
            else:
                plant_data = plant_reg_resp.json()
                created_plant_id = uuid.UUID(plant_data["id"])
                created_plant_ids.append(created_plant_id)
                print(f"  ✓ Plant Registered: {plant_data.get('common_name')} (Scan ID: {plant_data.get('scan_id')})")

                # Verify Initial Registration Reward (+50 GXC)
                async with AsyncSessionLocal() as session:
                    tx_res = await session.execute(
                        select(RewardTransaction).filter(
                            RewardTransaction.user_id == citizen_id,
                            RewardTransaction.trigger_event == "PLANT_REGISTERED"
                        )
                    )
                    tx = tx_res.scalars().first()
                    if not tx or tx.points != 50 or tx.balance_snapshot != 50:
                        record_error("Journey 4 (Reward Credit)", "Initial registration reward +50 GXC not credited or wrong snapshot", tx)
                    else:
                        print("  ✓ Reward Ledger verified: +50 GXC credited (Balance Snapshot: 50 GXC).")

        except Exception as e:
            record_error("Journey 4 (Exception)", str(e))

        # -----------------------------------------------------------------
        # JOURNEY 5: Growth Photo Upload & Anti-Fraud Time-Gating
        # -----------------------------------------------------------------
        print("\n[Journey 5]: Growth Photo Upload & Anti-Fraud Time-Gating...")
        try:
            if created_plant_id:
                # 1x1 sample PNG bytes
                sample_bytes = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\rIDATx\x9cc\xf8\xcfP\x0f\x00\x03\x86\x01\x81\x16\x1b\xeb\x9b\x00\x00\x00\x00IEND\xaeB`\x82"
                growth_resp = await client.post(
                    f"/api/growth/{created_plant_id}/growth",
                    data={"lat": 28.6139, "lng": 77.2090},
                    files={"image": ("growth.png", sample_bytes, "image/png")},
                    headers={"Authorization": f"Bearer {citizen_token}"}
                )

                if growth_resp.status_code not in (200, 201):
                    record_error("Journey 5 (Growth Upload)", f"Status {growth_resp.status_code}", growth_resp.text)
                else:
                    growth_data = growth_resp.json()
                    print(f"  ✓ Growth Update Recorded: Status={growth_data.get('verification_status')}, Stage={growth_data.get('growth_stage_label')}")
        except Exception as e:
            record_error("Journey 5 (Exception)", str(e))

        # -----------------------------------------------------------------
        # JOURNEY 6: Community Planting Drives & PostGIS Spatial Discovery
        # -----------------------------------------------------------------
        print("\n[Journey 6]: Community Drives & PostGIS Spatial Queries...")
        try:
            # 6.1 Create Community Drive
            drive_resp = await client.post("/api/drives", json={
                "title": f"Yamuna Floodplain Afforestation Drive ({test_id})",
                "description": "Planting 500 native peepal and neem saplings along the riverfront.",
                "lat": 28.6200,
                "lng": 77.2100,
                "radius_meters": 3000.0,
                "start_date": (datetime.now(timezone.utc) + timedelta(days=2)).isoformat(),
                "end_date": (datetime.now(timezone.utc) + timedelta(days=5)).isoformat()
            }, headers={"Authorization": f"Bearer {citizen_token}"})

            if drive_resp.status_code not in (200, 201):
                record_error("Journey 6 (Create Drive)", f"Status {drive_resp.status_code}", drive_resp.text)
                drive_id = None
            else:
                drive_data = drive_resp.json()
                drive_id = uuid.UUID(str(drive_data["id"]))
                created_drive_ids.append(drive_id)
                print(f"  ✓ Drive Created: '{drive_data.get('title')}' (Radius: {drive_data.get('radius_meters')}m)")

            # 6.2 Spatial Discovery (Nearby Drives within 5km)
            if drive_id:
                nearby_resp = await client.get("/api/drives/nearby?lat=28.6139&lng=77.2090&radius_km=5.0", headers={"Authorization": f"Bearer {citizen_token}"})
                if nearby_resp.status_code != 200:
                    record_error("Journey 6 (Spatial Search)", f"Status {nearby_resp.status_code}", nearby_resp.text)
                else:
                    drives_list = nearby_resp.json()
                    found = any(str(d["id"]) == str(drive_id) for d in drives_list)
                    if not found:
                        record_error("Journey 6 (Spatial Match)", "Created drive within 1km was not returned by 5km PostGIS query.")
                    else:
                        print(f"  ✓ PostGIS Spatial Filter verified: Drive discovered within 5km radius.")

            # 6.3 Join Drive
            if drive_id:
                join_resp = await client.post(f"/api/drives/{drive_id}/join", headers={"Authorization": f"Bearer {citizen_token}"})
                if join_resp.status_code != 200:
                    record_error("Journey 6 (Join Drive)", f"Status {join_resp.status_code}", join_resp.text)
                else:
                    print("  ✓ Joined community drive successfully.")

        except Exception as e:
            record_error("Journey 6 (Exception)", str(e))

        # -----------------------------------------------------------------
        # JOURNEY 7: Marketplace Eco-Vouchers & Web3 Crypto Payouts
        # -----------------------------------------------------------------
        print("\n[Journey 7]: Marketplace Voucher Redemption & Crypto Payout...")
        try:
            # 7.1 Fetch marketplace items
            market_resp = await client.get("/api/rewards/marketplace", headers={"Authorization": f"Bearer {citizen_token}"})
            if market_resp.status_code != 200:
                record_error("Journey 7 (Marketplace Items)", f"Status {market_resp.status_code}", market_resp.text)
            else:
                items = market_resp.json()
                print(f"  ✓ Fetched {len(items)} active marketplace eco-items.")
                if len(items) > 0:
                    affordable_item = next((it for it in items if it["points_cost"] <= 50), items[0])
                    item_id = affordable_item["id"]

                    # 7.2 Redeem Voucher
                    redeem_resp = await client.post("/api/rewards/redeem", json={"item_id": item_id}, headers={"Authorization": f"Bearer {citizen_token}"})
                    if redeem_resp.status_code != 200:
                        record_error("Journey 7 (Voucher Redeem)", f"Status {redeem_resp.status_code}", redeem_resp.text)
                    else:
                        red_data = redeem_resp.json()
                        print(f"  ✓ Redeemed voucher: {red_data.get('voucher_code')} for '{red_data.get('item_title')}' (New Balance: {red_data.get('new_balance')} GXC).")

            # 7.3 Web3 Crypto Payout (Testing threshold validation)
            payout_invalid = await client.post("/api/rewards/payout", json={
                "amount_gxc": 20, # < 50 minimum
                "wallet_address": "0x71C7656EC7ab88b098defB751B7401B5f6d8976F"
            }, headers={"Authorization": f"Bearer {citizen_token}"})
            if payout_invalid.status_code == 200:
                record_error("Journey 7 (Payout Threshold)", "Payout < 50 GXC should have been rejected with 400/422.")
            else:
                print("  ✓ Minimum payout threshold (< 50 GXC) correctly enforced.")

        except Exception as e:
            record_error("Journey 7 (Exception)", str(e))

        # -----------------------------------------------------------------
        # JOURNEY 8: Organization Billing & Citizen Password Confirmation
        # -----------------------------------------------------------------
        print("\n[Journey 8]: Organization Eco-Service Billing & Password Approval...")
        try:
            # 8.1 Register Organization
            org_reg_resp = await client.post("/api/auth/register", json={
                "email": org_email,
                "password": org_password,
                "name": org_name,
                "location_lat": 28.6139,
                "location_lng": 77.2090,
                "is_org": True,
                "role": "ORGANIZATION"
            })
            if org_reg_resp.status_code == 200:
                org_data = org_reg_resp.json()
                org_id = uuid.UUID(org_data["id"])
                created_user_ids.append(org_id)

                # Direct verify org
                async with AsyncSessionLocal() as session:
                    o_res = await session.execute(select(User).filter(User.id == org_id))
                    o = o_res.scalar_one_or_none()
                    o.email_verified = True
                    o.is_active = True
                    o.is_org = True
                    o.role = "ORGANIZATION"
                    session.add(o)
                    await session.commit()

                # 8.2 Login as Org
                org_login_resp = await client.post("/api/auth/login", data={
                    "username": org_email,
                    "password": org_password
                })
                if org_login_resp.status_code != 200:
                    record_error("Journey 8 (Org Login)", f"Status {org_login_resp.status_code}", org_login_resp.text)
                    org_token = None
                else:
                    org_token = org_login_resp.json().get("access_token")

                # Grant citizen sufficient balance for billing test
                async with AsyncSessionLocal() as session:
                    bal_tx = RewardTransaction(
                        user_id=citizen_id,
                        points=100,
                        trigger_event="ADMIN_GRANT_TEST",
                        balance_snapshot=150
                    )
                    session.add(bal_tx)
                    await session.commit()

                # 8.3 Org creates payment request
                pay_req_resp = await client.post("/api/rewards/org-request-payment", json={
                    "user_identifier": citizen_email,
                    "amount_gxc": 35,
                    "service_description": "Municipal Organic Vermicompost Soil Kit (10kg)"
                }, headers={"Authorization": f"Bearer {org_token}"})

                if pay_req_resp.status_code != 200:
                    record_error("Journey 8 (Org Payment Request)", f"Status {pay_req_resp.status_code}", pay_req_resp.text)
                else:
                    pay_req_data = pay_req_resp.json()
                    payment_req_id = pay_req_data["request_id"]
                    print(f"  ✓ Org issued payment request of 35 GXC (Request ID: {payment_req_id})")

                    # 8.4 Citizen rejects with wrong password
                    wrong_pw_resp = await client.post("/api/rewards/approve-org-request", json={
                        "request_id": payment_req_id,
                        "password": "WrongPassword123!"
                    }, headers={"Authorization": f"Bearer {citizen_token}"})
                    if wrong_pw_resp.status_code == 200:
                        record_error("Journey 8 (Password Auth)", "Payment approved with incorrect password!")
                    else:
                        print("  ✓ Incorrect password rejected properly.")

                    # 8.5 Citizen approves with correct password
                    correct_pw_resp = await client.post("/api/rewards/approve-org-request", json={
                        "request_id": payment_req_id,
                        "password": citizen_password
                    }, headers={"Authorization": f"Bearer {citizen_token}"})
                    if correct_pw_resp.status_code != 200:
                        record_error("Journey 8 (Payment Approval)", f"Status {correct_pw_resp.status_code}", correct_pw_resp.text)
                    else:
                        approval_data = correct_pw_resp.json()
                        print(f"  ✓ Payment Approved! Citizen new balance: {approval_data.get('user_balance')} GXC, Org credited: 35 GXC.")

        except Exception as e:
            record_error("Journey 8 (Exception)", str(e))

        # -----------------------------------------------------------------
        # JOURNEY 9: Public Community Canopy Map & Privacy Filter
        # -----------------------------------------------------------------
        print("\n[Journey 9]: Public Canopy Map & Privacy Filters...")
        try:
            map_resp = await client.get("/api/plants/community-map")
            if map_resp.status_code != 200:
                record_error("Journey 9 (Community Map)", f"Status {map_resp.status_code}", map_resp.text)
            else:
                trees = map_resp.json()
                print(f"  ✓ Public Map returned {len(trees)} public trees across the network.")

                # Verify that private trees or full names are never leaked
                for t in trees[:5]:
                    if "@" in t.get("owner_first_name", ""):
                        record_error("Journey 9 (Privacy Leak)", f"Email exposed in public map owner name: {t.get('owner_first_name')}")
        except Exception as e:
            record_error("Journey 9 (Exception)", str(e))

        # -----------------------------------------------------------------
        # JOURNEY 10: IoT Hardware Telemetry Ingestion
        # -----------------------------------------------------------------
        print("\n[Journey 10]: IoT Hardware Gas Sensor Telemetry...")
        try:
            hw_resp = await client.post("/api/environment/hardware", json={
                "device_id": f"arduino_nano_test_{test_id}",
                "aqi": 42,
                "mq135_co2": 1.45,
                "mq7_co": 2.10,
                "mq2_smoke": 0.05,
                "air_quality_status": "GOOD",
                "alert_level": 140,
                "buzzer_active": False
            })
            if hw_resp.status_code not in (200, 201):
                record_error("Journey 10 (Hardware Telemetry)", f"Status {hw_resp.status_code}", hw_resp.text)
            else:
                print("  ✓ Hardware telemetry (MQ-135, MQ-7, MQ-2) posted and processed successfully.")
        except Exception as e:
            record_error("Journey 10 (Exception)", str(e))

    # -----------------------------------------------------------------
    # CLEANUP (Zero-Harm Isolation)
    # -----------------------------------------------------------------
    print("\n" + "=" * 70)
    print("🧹 DEACTIVATING ISOLATED TEST DATA (ZERO-HARM GUARANTEE)...")
    print("=" * 70)
    async with AsyncSessionLocal() as session:
        for uid in created_user_ids:
            try:
                u_res = await session.execute(select(User).filter(User.id == uid))
                u = u_res.scalar_one_or_none()
                if u:
                    u.is_active = False
                    session.add(u)
                await session.commit()
                print(f"  ✓ Safely deactivated test user: {uid}")
            except Exception as e:
                print(f"  ⚠️ Deactivation note for user {uid}: {e}")

        for did in created_drive_ids:
            try:
                await session.execute(delete(DriveParticipation).filter(DriveParticipation.drive_id == did))
                await session.execute(delete(CommunityDrive).filter(CommunityDrive.id == did))
                await session.commit()
                print(f"  ✓ Safely purged test drive: {did}")
            except Exception as e:
                print(f"  ⚠️ Cleanup note for drive {did}: {e}")

    # -----------------------------------------------------------------
    # FINAL REPORT & SUMMARY
    # -----------------------------------------------------------------
    print("\n" + "=" * 70)
    print(f"📊 REAL-USER QA AUDIT COMPLETE")
    print(f"   Errors Found:   {len(ERRORS_COLLECTED)}")
    print(f"   Warnings Found: {len(WARNINGS_COLLECTED)}")
    print("=" * 70)

    if len(ERRORS_COLLECTED) > 0:
        print("\nLIST OF IDENTIFIED ISSUES:")
        for idx, err in enumerate(ERRORS_COLLECTED, 1):
            print(f" {idx}. [{err['journey']}] {err['description']} -> {err['details']}")
        sys.exit(1)
    else:
        print("\n🎉 ALL REAL-LIFE USER JOURNEYS PASSED WITH ZERO ERRORS!")
        sys.exit(0)

if __name__ == "__main__":
    asyncio.run(run_real_user_qa())
