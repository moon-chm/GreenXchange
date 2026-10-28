# Product Requirements Document (PRD)

## Problem

Rapid urbanization and climate change have exacerbated urban heat islands, particulate pollution (PM2.5, PM10), and biodiversity loss in metropolitan regions. While municipal and citizen-led urban greening initiatives exist, they suffer from high attrition, lack of sustained plant care, zero verifiable proof of ongoing cultivation, and absent economic incentives. Citizens lack reliable, localized environmental guidance on which plant species effectively filter target pollutants or thrive in their specific microclimates, leading to premature plant mortality and disengagement.

## Goals

1. **Incentivize Long-term Stewardship**: Motivate ongoing urban greening through a tamper-resistant, append-only reward ledger distributing GXC tokens for verified plant survival and growth.
2. **Automate Growth Verification**: Deploy an automated computer vision pipeline (Error Level Analysis for manipulation detection, visual growth stage classification, and GPS geofence checks) that eliminates manual verification bottlenecks.
3. **Data-Driven Plant Matching**: Deliver personalized, microclimate-specific plant species recommendations based on real-time environmental telemetry (AQI, temperature, humidity, sunlight, and soil metrics).
4. **Mobilize Community Action**: Enable grassroots and organizational coordination through spatial community planting drives with PostGIS geofencing.
5. **Facilitate Circular Eco-Economy**: Provide a functional marketplace allowing users to redeem accrued GXC points for eco-vouchers, merchant perks, or direct withdrawals.

## Users

1. **Urban Citizens & Home Gardeners**: Residents with balconies, terraces, or indoor spaces looking to cultivate plants, improve local air quality, and earn rewards for documented care.
2. **Community Organizers**: Local environmental leaders and neighborhood groups coordinating localized tree planting drives and urban forestry campaigns.
3. **Eco-Conscious Organizations & Sponsors**: Corporate ESG initiatives, NGOs, or municipal bodies funding greening projects, sponsoring marketplace vouchers, and disbursing payments for verified impact.
4. **Platform Administrators & Reviewers**: Team members auditing flagged growth submissions, reviewing high-value payouts, managing plant species taxonomy, and approving workspace documentation drafts.

## Scope

- **User Authentication & Profiles**: Secure JWT authentication (HS256/RS256), multi-role accounts (Individual, Organization, Admin), and spatial location anchoring.
- **AI Recommendation Engine**: Rule-based and telemetry-assisted matching algorithm evaluating ambient AQI, PM2.5, temperature, sunlight hours, and user space constraints against plant botanical traits.
- **Growth Tracking & Verification**: Image upload pipeline with automated EXIF extraction, anchor location proximity validation, Error Level Analysis (ELA), and ML growth-stage classification.
- **Append-Only Reward Ledger**: PostgreSQL trigger-enforced immutable ledger tracking all GXC credit emissions, balance snapshots, and debit transactions.
- **Reward Marketplace & Payouts**: Catalog of eco-vouchers, coupon issuance with unique redemption codes, and cryptographic payout request tracking.
- **Community Drives**: Creation and discovery of spatial tree planting events with radius filtering, geofencing polygons, and participant management.
- **Unified Environmental Dashboard**: Real-time aggregated feed of local telemetry, registered flora status, reward balances, and eco-news.

## Out of scope

- **Public Proof-of-Work Blockchain Mining**: The platform utilizes an internal cryptographic append-only ledger and off-chain smart contract integration interfaces rather than running a custom proof-of-work blockchain node.
- **Automated Physical Drone / Satellite Surveillance**: Plant validation relies on citizen smartphone capture and verified EXIF/GPS telemetry rather than autonomous aerial or satellite imagery.
- **Direct Physical Nursery Fulfillment & Shipping**: GreenXchange provides vouchers, partnership redemptions, and recommendations, but does not operate direct plant nursery logistics or shipping fleets.

## User stories

- **US-01 (Recommendation)**: As an apartment resident with an outdoor balcony, I want plant recommendations tailored to my local AQI and space type so that I can choose flora that improves my immediate air quality.
- **US-02 (Plant Registration)**: As a user planting a new sapling, I want to record its anchor location and initial photo so that its growth progression can be tracked over time.
- **US-03 (Growth Verification)**: As a gardener uploading an updated plant photo, I want the system to automatically analyze growth and verify legitimacy so that I receive GXC reward tokens promptly.
- **US-04 (Reward Redemption)**: As a reward earner, I want to browse the marketplace and redeem my GXC tokens for partner discount vouchers or request a payout.
- **US-05 (Community Drives)**: As a community organizer, I want to create a localized planting drive with a geofenced area and date range so that neighborhood volunteers can join and contribute collectively.
- **US-06 (Environmental Monitoring)**: As an environmentally conscious citizen, I want to view live air quality, temperature, and localized environmental alerts from my dashboard so that I stay informed about local conditions.

## Success metrics

- **Plant Survival Rate**: > 80% of registered plants receive verified growth updates past the 90-day mark.
- **Verification Accuracy & Throughput**: > 95% of growth updates verified or flagged automatically within 30 seconds with < 2% false rejection rate.
- **Community Engagement**: At least 30% month-over-month increase in active monthly planters and community drive participation.
- **Reward Velocity**: > 60% of earned GXC points engaged in marketplace redemptions, community stakes, or eco-voucher claims.
- **System Uptime & Responsiveness**: 99.9% uptime for core API endpoints with p95 response time under 250ms for dashboard queries.

## Open questions

- **Offline / Low-Connectivity Submissions**: How should mobile photo uploads with deferred sync handle timestamp verification when network access is delayed in remote urban drive locations? (TBD)
- **Third-Party Nursery API Integration**: Should local nurseries be granted direct API access to validate eco-voucher claims in-store via QR code scanning? (TBD)
- **Advanced Multi-Angle Photogrammetry**: Can multi-angle 3D volume reconstruction improve sapling biomass calculation in future CV model iterations? (TBD)
