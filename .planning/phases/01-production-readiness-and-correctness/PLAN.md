# Phase 1: Production Readiness and Correctness

**Status:** Draft for user review  
**Purpose:** Resolve the findings from the static code review while preserving the product requirements in `PRD.md`.  
**Scope:** Backend data integrity, authentication/authorization, storage and telemetry, async/background processing, API validation/privacy, and frontend auth reliability.  
**Approval gate:** Do not begin implementation until the user reviews and approves this plan.

## Phase goal

Make the existing GreenXchange system behave consistently across its FastAPI/SQLAlchemy/PostgreSQL+PostGIS backend, Next.js frontend, Redis/Celery services, MinIO/local development storage, Docker Compose, and Render deployment. Preserve append-only reward history while making growth verification and payout workflows operable. Fail safely when production dependencies or configuration are missing. Avoid breaking existing installations or silently losing user data.

## Existing-system constraints

- `PRD.md` requires a tamper-resistant reward ledger and automated growth verification; do not solve verification by making the reward ledger mutable.
- Alembic is the schema-change mechanism. Existing deployments may already have data and must receive forward-only migrations; do not reset or drop production data.
- `main.py` currently creates tables at startup and launches periodic tasks. Docker startup also runs Alembic. The implementation must settle on one clear migration owner and one scheduler owner.
- Both Render (`render.yaml`) and Docker Compose deployments exist. Preserve local developer usability while making production fail closed for required configuration.
- Render’s storage and filesystem lifecycle differs from Compose MinIO. Provide explicit supported configuration for both rather than assuming one storage setup.
- Existing source/config files contain working-tree changes and report artifacts. Do not overwrite unrelated user work.

## Implementation waves

### Wave 0 — Revalidate findings and define compatibility behavior

1. Reproduce each listed issue against current source and schema before changing it; classify it as confirmed, already fixed, or requiring a product decision. In particular, verify payout route lifecycle, migration coverage for every ORM field, active production storage, actual proxy headers, and whether the health endpoint is used as liveness or readiness.
2. Record the current API contracts and schema state needed for compatibility: user roles, growth status values, plant deletion semantics, map visibility defaults, payout status transitions, and upload URL shape.
3. Establish safe rollout decisions for legacy rows and configuration: how existing `NULL` token expiries are handled, how old exposed telemetry credentials are rotated, and whether public map visibility remains opt-out or changes to opt-in for new plants.

**Exit criteria:** Findings are marked confirmed/closed/decision-needed in the implementation record; no destructive database operation is proposed; user-visible behavior changes have documented migration/compatibility handling.

### Wave 1 — Database integrity and migration safety

1. Add Alembic migrations for all persisted model fields absent from migration history, including public-map visibility and user role/organization/email-verification/reset fields. Inspect live schema compatibility and provide safe defaults/backfills; migrations must be repeatable under the repository’s deployment process.
2. Remove migration-error suppression from backend startup. Make deployment fail visibly when a migration fails, and document/run migrations exactly once before serving traffic (avoid four API workers racing migrations).
3. Repair growth-update append-only semantics without sacrificing an audit trail. Preferred design: immutable submission/event history plus a separate verification decision/current-state record, or a narrowly defined transition mechanism with immutable audit events. Update API and Celery task behavior consistently.
4. Make plant deletion compatible with retained growth/reward history. Prefer soft deletion/tombstoning or a documented retention policy; do not cascade mutations into immutable ledger rows.
5. Review database constraints/indexes for valid coordinates, radius/date ranges, unique participation, payout idempotency, and allowed state transitions. Add constraints through migrations only after legacy data has been audited/backfilled.

**Exit criteria:** Fresh database and representative upgraded database reach Alembic head; verification state transitions work; immutable reward entries remain immutable; deleting/archiving a plant with history follows the selected policy; migration failure prevents application startup.

### Wave 2 — Authentication, authorization, and secret handling

1. Replace token-only admin authorization with a server-side role check (or securely minted, short-lived role claim with clear revocation behavior). Ensure login/refresh and `/news` admin operations agree with the persisted role model.
2. Remove startup role promotion based solely on known email addresses. Use an explicit, auditable provisioning path and ensure seed credentials cannot unexpectedly grant privileges.
3. Fix unverified-email registration so a caller cannot replace credentials for an account before proving email ownership. Preserve a safe resend/verification flow and prevent account enumeration where the current API intends generic responses.
4. Require non-null, unexpired, single-use verification/reset tokens. Hash stored token material where practical and invalidate refresh sessions after password reset; handle legacy null-expiry rows explicitly.
5. Constrain CORS to exact configured origins. Stop using arbitrary request origin/host headers to build security-sensitive email links; use a trusted configured frontend URL and trusted-proxy configuration.
6. Remove raw request-body logging from validation failures; redact credentials, tokens, and personal data from exception logs and client error responses.
7. Make rate-limit client identity honor only trusted proxy hops and document behavior when Redis is unavailable. Sensitive auth and recovery paths must not silently disable controls.
8. Remove tracked/default ThingSpeak credentials from code/deployment manifests, rotate any live exposed credentials, and source runtime secrets from environment/secret management. Reject insecure default MinIO credentials in production.

**Exit criteria:** Role-based route access works for authorized and unauthorized accounts; registration/reset/verification flows resist takeover and token replay; only configured origins are trusted; auth payloads never appear in logs; secrets are absent from tracked runtime defaults and old exposed credentials are rotated.

### Wave 3 — Durable media, telemetry, and background work

1. Define storage behavior per environment: MinIO/S3-compatible object storage in production; local filesystem only for local development. Make production storage required, durable, and externally reachable through configured URLs or signed URLs. Return an error when persistence fails instead of a URL to missing content.
2. Harden image handling with request byte limits, decoded pixel limits, accepted format/content checks, safe EXIF handling, and fail-closed sanitization. Keep the upload API response compatible or version it if URL semantics change.
3. Require hardware ingestion authentication in production; reject missing configuration and unauthorized writes. Ensure telemetry ingestion cannot be anonymously overwritten.
4. Restrict shared ThingSpeak configuration to authorized administrators or move it to a per-user/per-organization configuration model. Avoid allowing ordinary accounts to reconfigure global telemetry.
5. Move CV inference and blocking storage/image operations off the async event loop using the existing Celery/worker architecture where supported. Ensure workers are actually configured and monitored in each deployment; keep request status transitions idempotent across retries.
6. Move periodic environment refresh and weekly digest scheduling to one scheduler/leader mechanism. API worker count must not multiply scheduled side effects.
7. Mark synthetic environment fallback values as simulated/stale with their source, or replace random values with a deterministic documented fallback. Surface unavailable dependencies accurately.

**Exit criteria:** Failed storage produces no success URL; uploads are bounded and sanitized; production telemetry requires auth; worker retries do not duplicate rewards/emails; one scheduled execution occurs per interval across multiple API workers; synthetic data is visibly identified.

### Wave 4 — Business workflows, validation, privacy, and frontend behavior

1. Audit the payout lifecycle end to end, including API route exposure and authorization. Implement explicit pending/approved/rejected/settled transitions, idempotency, and refunds or balance holds for rejected/failed payouts. Reconcile existing pending payouts before deployment.
2. Make drive joining transactional and distinguish duplicate membership from a missing drive. Validate date window, active status, coordinates, and radius before allowing a join.
3. Apply schema-level geographic bounds and sensible size/radius/date limits to plant, growth, and drive inputs; add password/name bounds consistent with the authentication implementation.
4. Paginate public map and portfolio APIs, avoid loading every growth history to show latest status, and return only public data needed by the client. Decide and implement map visibility defaults consistently in schema, DB migration, forms, and APIs; avoid exposing precise coordinates/owner identifiers beyond the intended audience.
5. Fix `ProtectedRoute` to wait for auth hydration and redirect unauthenticated users deterministically. Decode JWT payloads using correct base64url handling if client-side expiry remains necessary; server remains authoritative.
6. Ensure email endpoints only claim a message was sent when a configured provider accepted it; provide useful generic UX while surfacing delivery failures operationally.

**Exit criteria:** Payout and drive state changes are atomic/idempotent; invalid spatial/date inputs are rejected; public endpoints are bounded and privacy-reviewed; logged-out app routes redirect instead of rendering blank; email failure is observable.

### Wave 5 — Readiness, deployment hardening, and release verification

1. Split liveness from readiness (or document the existing health contract). Readiness must reflect required dependencies; health responses must not expose DB errors or deployment details to unauthenticated clients.
2. Remove or restrict public host port bindings for DB, Redis, and MinIO in production Compose. Confirm the production overlay actually applies the intended network and secrets policy.
3. Validate required production settings at startup: DB, auth keys, email, media storage, hardware key where ingestion is enabled, and external service configuration. Keep local dev defaults isolated from production.
4. Update README/deployment docs and `.env.example` with accurate setup, migration ownership, worker/scheduler roles, storage requirements, and credential rotation. Never copy live credentials into examples.
5. Add/update focused automated tests for migration upgrade paths, append-only ledger, growth verification transitions, admin authorization, registration/reset tokens, CORS/log redaction, upload rejection/storage failure, hardware auth, payout/drive transactions, public map privacy/pagination, and readiness. Add deployment smoke checks for Render and Compose paths.
6. Run formatting/static analysis and the focused test suite, then broader existing tests; inspect migration SQL and generated diffs. Do not deploy or rotate live services until the user approves the implementation and the rollout step.

**Exit criteria:** Focused test and migration checks pass; both deployment configurations are reviewed; no secret values are committed; runbook describes rollback/forward-fix procedures; user can review the finished implementation before any production deployment.

## Cross-cutting implementation requirements

- Keep reward transactions append-only; corrections must be compensating ledger events, never edits/deletes.
- Use forward-only, reversible-where-safe database migrations, with explicit backfills and preflight checks for legacy data.
- Make retries idempotent for rewards, payout transitions, email jobs, and CV verification tasks.
- Keep authorization decisions server-side and test both allowed and denied access.
- Preserve local development support without allowing local fallback credentials, URLs, or disk storage in production.
- Avoid logging request bodies, secrets, access tokens, reset links, or raw precise location data.
- Document API response changes and migrate frontend consumers in the same implementation wave.
- Keep user data and existing local changes intact; do not reset the database, delete uploads, or rewrite unrelated report artifacts.

## Verification checklist for implementation

- [ ] Database migration succeeds on an empty database and an upgraded fixture containing legacy rows.
- [ ] Migration errors stop release startup and are visible to operators.
- [ ] Growth status moves through the valid lifecycle while submission/audit history is retained.
- [ ] Reward transaction update/delete attempts fail; plant archive does not mutate ledger history.
- [ ] Non-admin users cannot mutate news/global telemetry/payout decisions; valid admins can.
- [ ] Email ownership, expiry, single-use reset/verification, and session revocation work.
- [ ] CORS accepts configured origins and rejects unconfigured lookalikes; validation errors do not log secrets.
- [ ] Invalid/oversized images fail; storage failures return errors; returned media can be loaded by the intended viewer.
- [ ] Missing hardware auth/config fails closed; rate limits cannot be bypassed by spoofed forwarded headers.
- [ ] Payout rejection/failure restores or releases held balance; transitions are idempotent.
- [ ] Drive participant count and participation remain consistent under duplicate/concurrent joins.
- [ ] Public API pagination and field selection meet privacy decisions; invalid coordinates/ranges/dates are rejected.
- [ ] Logged-out frontend routes redirect after auth hydration; token parsing handles base64url payloads.
- [ ] Readiness reflects required dependency failures; multiple API workers do not duplicate scheduled work.
- [ ] Compose and Render deployment docs/config agree with runtime requirements.

## Deferred product decisions

1. Should public map visibility default to private for new plants, and how should existing plants be treated?
2. Should payouts be real external transfers, an admin-reviewed request, or an off-chain integration interface until a provider is selected?
3. Is environment synthetic fallback acceptable for recommendations if visibly labeled, or should recommendations be unavailable when live data is missing?
4. Which deployment is the current production source of truth: Render, Docker Compose, or both? The plan covers both until confirmed.

## Approval request

Review this plan and either approve it as written or identify scope/order changes. No implementation has started.
