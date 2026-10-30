# Plant upload, growth and rewards audit

Date: 2026-10-30

Update: the findings below describe the pre-fix implementation. See [PLANT_VERIFICATION.md](PLANT_VERIFICATION.md) for the implemented review-based verification flow, deployment requirements and completed integration checks.

Verdict: the current implementation is not ready to be described as reliable global plant-growth verification and rewards. Basic upload/storage and ledger safeguards exist, but important verification and reward paths are incomplete. This was a source review plus local tests, not a certification of the deployed service. Application code was not changed.

## Critical findings

1. **Normal web signup is incompatible with growth rewards.** `frontend/src/app/(auth)/register/page.tsx:122` submits only name, email and password. `backend/app/schemas/auth.py:20` defaults device_fingerprint to None; signup stores that value. `backend/app/services/rewards.py:125` refuses growth rewards without a fingerprint. Consequently a normal new web account can receive registration points but no growth points, even after verification. Fix the eligibility design consistently across signup, existing accounts and reward issuance; a caller-provided fingerprint alone is not robust identity proof.

2. **Registration points do not require a verified plant.** `backend/app/api/plants.py:174` awards 50 GXC per registration. The registration schema permits no image, accepts an arbitrary image_url, and the endpoint does not check image ownership, successful analysis, duplicate photos or duplicate physical plants. The upload endpoint validates image encoding, not whether it depicts a plant. Repeated registrations can therefore mint points without new plants; a request rate limit merely slows this. Enforce server-side upload ownership and eligibility, with duplicate controls and reward limits.

3. **AI failure can produce false verification.** In `backend/app/services/cv/models.py`, absent/failed tree inference falls back to green-pixel detection; absent health inference returns Healthy with 90% confidence. A local reproduction with both model references set to None and a solid green JPEG returned is_verified=True, tree_confidence=0.99, health_status=Healthy and growth_stage=Mature. This reproduces the fallback condition, not the behavior of successfully loaded trained weights. Missing models must produce unavailable/manual review rather than positive evidence. The API also labels results resnet18-dual-v1 even when heuristics supplied them.

4. **Growth is not measured over time.** `backend/app/services/cv/models.py:321` derives stages only from green-pixel coverage; its prior_image argument is unused. `verify_species` always returns a match. The upload handler does not retrieve an earlier photo or establish that this is the same plant. There is no image hash/deduplication field in GrowthUpdate. The same qualifying image can earn another 10 GXC after the default 24-hour reward interval. Zoom and framing can change the reported stage without biological growth. Implement comparison and identity/duplicate checks, or explicitly describe these results as photo observations rather than verified growth.

## Other high-priority findings

5. **Verified does not imply credited.** `backend/app/api/growth.py:146` commits VERIFIED before calling the reward service; the boolean credit result is ignored. Cooldown, ineligibility and database failure are not distinguished in the response. There is no durable growth-reward recovery job or ledger key linking a credit to a specific growth update. Use an atomic transaction or durable retry/outbox, unique update-linked credits, and explicit reward status/amount/next eligibility in the API.

6. **Manual review has no application resolution path.** Location mismatches and inference exceptions create MANUAL_REVIEW. No admin growth-review endpoint or frontend review workflow was found. The worker functions exist, but the submission handler does not queue this path. Add an authorized review queue with audited decisions and idempotent reward issuance.

7. **Location checks are too weak to establish presence.** `backend/app/api/growth.py:70` allows up to 100,000 metres from the plant anchor before flagging review. Form coordinates are caller supplied; missing EXIF is accepted. Browser camera captures normally have no camera GPS EXIF. Coordinate range validation and spherical distance calculations support worldwide coordinates, but that does not establish trustworthy physical presence. Define a realistic tolerance and uncertainty policy rather than treating raw coordinates as proof.

8. **Unverified registrations display as verified.** The portfolio, community map and dashboard default to verified when no growth record exists (`plants.py:252`, `plants.py:324`, `dashboard.py:158`). Store and display a truthful registration verification state.

9. **Dashboard balance uses different accounting.** `backend/app/api/dashboard.py:178` reads the most recent balance_snapshot; the rewards service uses SUM(points). Timestamp ties or historical bad snapshots can cause disagreement. The dashboard also runs multiple database queries concurrently on the same AsyncSession (`dashboard.py:298`), risking session/connection concurrency errors hidden behind stale module fallbacks. Use the authoritative balance helper and sequential queries or separate sessions.

10. **Balance reads perform growing write work.** `backend/app/api/rewards.py:98` loads all a user's plants, including archived plants, then issues a reward existence query per plant and may credit missing registration rewards. This scales linearly on every balance read and can credit archived registrations that were never rewarded. Move reconciliation into a controlled background process with explicit eligibility.

11. **User-entered species create unsupported catalog facts.** `backend/app/api/plants.py:119` inserts a new species for arbitrary names, assigning toxicity NONE, allergen risk NONE and fixed absorption rates. Those shared rows can influence recommendations for other users. Keep unvalidated user labels separate from trusted botanical catalog data. Community-map carbon is also a generic age formula with a minimum of 5 kg, not measured sequestration (`plants.py:321`).

12. **Upload processing needs production hardening.** CV runs inside each upload request without endpoint-specific inference rate limiting or a durable bounded job queue. Stored images can become orphaned when a later database operation fails. Sanitization re-encodes JPEGs before ELA, and strips EXIF without applying its orientation, potentially rotating phone photos incorrectly. Multi-region latency, simultaneous uploads, model memory usage and object-storage availability were not load-tested.

## Safeguards found in source

- Growth submissions require authenticated ownership and exclude archived plants.
- Both image paths enforce a 10 MB input limit; decoding checks supported formats and a 20-megapixel limit.
- Durable storage errors fail the request rather than returning a fake stored URL; private object references use signed browser links.
- Latitude and longitude are bounded, and reward cooldown calculations use UTC.
- Reward balance uses ledger sums; credit/debit services use user-row locks, and redemption also locks stock.
- A migration allows audited growth-status transitions while protecting submitted evidence. The deployed migration state was not checked.

## Validation and limits

- Frontend: `node --test tests/ui-errors.test.cjs`: 6 passed. These are helper tests, not an upload-to-ledger end-to-end test.
- Backend: `python -m pytest tests/test_config_origin_allowlist.py tests/test_security.py -q`: 13 passed, 1 failed. The failing test expects an onrender subdomain to be allowed, but current configuration rejects it. This needs a test/configuration review; it does not justify widening the allowlist automatically.
- Full backend suite and recommendation subset did not finish in this local environment and were interrupted. Their partial progress is not counted as a pass. A mocked asynchronous reward probe also did not complete; the fingerprint finding is based on the complete source call chain.
- Direct synchronous CV fallback reproduction completed and demonstrated the green-square false positive described above.
- No live accounts, rewards, emails, database records or deployment settings were changed. No real Postgres/MinIO/Redis end-to-end, transaction race, manual-review, mobile-camera or global load test was completed.
- The default backend test directory has no dedicated upload/growth/reward integration coverage. Additional standalone scripts exist outside that suite, but were not executed against a live database.

## Recommended implementation order

1. Correct normal-account reward eligibility and stop awarding registration credits without trusted evidence.
2. Fail closed when verification models are unavailable; label estimates honestly.
3. Add update-linked idempotent rewards, explicit outcomes and durable recovery.
4. Add duplicate/same-plant checks and a real manual-review workflow.
5. Unify status/balance displays, isolate user labels from the trusted catalog and remove database concurrency hazards.
6. Validate against an isolated Postgres/PostGIS, storage and worker stack, then test representative global plant photos, phones, geographies and concurrent users before claiming global readiness.
