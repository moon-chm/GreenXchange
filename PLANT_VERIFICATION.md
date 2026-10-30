# Plant evidence and rewards

Implemented 2026-10-30. This supersedes the behavior described in the original audit.

## User flow

1. Upload a JPEG, PNG or WebP photo, up to 10 MB and 20 megapixels. Phone orientation is corrected and EXIF is stripped before storage. The server records ownership and a unique digest of the sanitized photo. An already-consumed identical photo cannot be reused across plants or accounts.
2. Register the plant using that account-owned upload. Registration consumes the upload and creates a baseline submission awaiting review. It does **not** immediately mint points.
3. An administrator opens **Plant Reviews** (`/reviews`). The screen displays the current evidence, the earlier approved photo for growth submissions, AI observations and location concerns. Reviewers must explain the decision and confirm the evidence. They cannot review their own plants.
4. Approving a distinct new plant awards **50 GXC once**. Approving subsequent same-plant growth awards **10 GXC**, subject to a minimum **24-hour interval between credited growth photos** (`REWARD_MIN_INTERVAL_HOURS` may increase that interval). A delayed review does not reset the evidence timestamp. Reviews within the interval can confirm the observation but return `cooldown` and zero points.
5. Verification, the review decision and the ledger credit commit in one database transaction. A unique update-linked reward and user-row lock prevent duplicate credits during concurrent requests or retries. A failed transaction leaves the submission reviewable; retry the same decision.
6. The growth timeline reports the decision reason and actual reward outcome. Plant cards use ledger totals; the dashboard and rewards page use the same authoritative ledger sum.

Active, email-verified users are eligible without a device fingerprint. Archived plants cannot receive new approvals. Existing ledger credits are retained; reviewing a legacy plant's new baseline does not repeat its previous registration reward. Legacy queued automatic verification/reward tasks no longer issue credits.

## Meaning of verification

The supplied ResNet models provide plant/health observations. They do not establish photo authenticity, species identity, same-plant identity or biological growth. Missing/failed models produce an unavailable observation, never a verified or healthy fallback. Green-pixel coverage is no longer presented as a growth stage. New approvals therefore require human evidence review; an administrator must operate the review queue.

The review screen supports comparison; this release does not introduce a validated automatic longitudinal-growth model. Exact duplicate detection is not perceptual duplicate detection: crops, changed framing, altered pixels and photographs of screens still require reviewer scrutiny. Coordinates are user-supplied evidence, not independent proof of presence. Distances above 100 metres and EXIF mismatches are flagged for review. Worldwide coordinates, the antimeridian and UTC reward intervals are supported; worldwide model accuracy and high-volume multi-region capacity are not certified by these tests.

User-entered species labels are excluded from the trusted recommendation catalog. Newly created custom records no longer receive invented absorption rates. Community-map carbon is shown as “Not measured” rather than an age-based invented quantity.

## Deployment

- Ship the backend, worker and frontend together. Do not leave old automatic-credit workers/API processes running during rollout.
- Run `python -m alembic upgrade head` from `backend` using the intended deployment database configuration. The new revision is `20261030_plant_evidence`; it adds owned photo receipts, review decisions and unique ledger-to-submission links. It preserves old balances and evidence and is forward-only.
- Configure durable MinIO credentials and a browser-reachable signed-URL endpoint. Keep Redis available for upload rate limits. Upload limits are per authenticated account, so users sharing an IP do not share one quota.
- Assign review work to existing authorized `ADMIN` accounts; the application does not automatically promote anyone. Users see pending-review status until a decision is made.
- Back up the database before a production migration. No production migration or deployment was performed during this change.
- Staged uploads are retained when a user abandons registration or a commit outcome is uncertain. A storage retention process must reconcile receipts and references before removing unused objects. The application removes a new orphan object after a confirmed duplicate-insert rollback; it never deletes an object after an ambiguous commit.

## Validation

Final results: **67 backend tests passed** (including the two opt-in database/storage tests), **6 frontend helper tests passed**, TypeScript passed, and the production build passed. Temporary test containers were removed afterward.

- Backend regression tests cover normal accounts without fingerprints, ownership, duplicate photo reuse, missing models, review authorization, self-review denial, missing baselines, archived plants, cooldown boundaries, idempotent retries, schema constraints, global coordinates and phone orientation.
- A disposable PostgreSQL 15/PostGIS database successfully applied the **entire Alembic migration chain**, including the new revision.
- Opt-in integration tests exercised real MinIO uploads, registration, growth submission, review queue, simultaneous approvals, timeline/portfolio/dashboard totals, and an injected ledger failure followed by successful retry. They verify that failed crediting rolls back verification and that concurrent approvals do not duplicate credits.
- Frontend helper tests, TypeScript checking and the Next.js production build passed. The build configuration skips linting; lint is not claimed as a passed check.

Run regular tests with `python -m pytest tests -q --tb=short` from `backend`, and `node --test tests/ui-errors.test.cjs` plus `npm run build` from `frontend`.

`tests/test_plant_evidence_postgres.py` is opt-in through `GX_EVIDENCE_INTEGRATION=1`. It refuses any database except `gx_evidence_test` on `127.0.0.1:55439`. Use disposable PostGIS and MinIO instances with no application volumes; migrate the database first. Configure MinIO on `127.0.0.1:55440`. These tests create isolated test users and intentionally keep immutable records until the disposable database is removed. They mock AI observations and request rate limiting so no external AI/Redis services are contacted.
