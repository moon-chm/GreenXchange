# Website UX fixes — 2026-10-29

Scope: website usability and error handling. MQTT and device connectivity excluded.

## Fixed in this working tree

- Restored hidden mobile bottom navigation, including Rewards, active-page labels and safe-area spacing.
- Added skip-to-content navigation and an accessible mobile drawer with focus trapping, Escape dismissal and scroll locking.
- Made plant registration a keyboard-accessible, scrollable dialog that fits phone screens.
- Preserved failed-upload photos for retry; ignored stale upload/GPS callbacks; blocked duplicate plant submissions and dismissal during submission.
- Validated planting dates before advancing registration.
- Allowed same-origin camera use in Permissions-Policy. Stopped camera streams from stale requests and on cleanup; prevented capture before video readiness.
- Validated native photos as JPEG/PNG/WebP, nonempty and no larger than 10 MB.
- Removed fabricated fallback coordinates from growth updates. Location failure now requires recovery before submission.
- Removed assumed verified/healthy/rewarded results when the server does not provide them. Results stay visible until the user leaves.
- Replaced growth alerts with inline accessible error messages and clearer loading copy.
- Added friendly network, timeout and rate-limit errors; suppress raw internal server-error details.
- Added route error recovery, removed the forced five-second intro delay, respected reduced-motion preferences and prevented mobile input zoom.
- Corrected production metadata URLs.

## Validation

- TypeScript noEmit passes.
- Production build passes (19 routes).
- Changed-file lint has no errors; raw-image preview performance warnings remain.
- Four Node regression tests pass: photo boundaries/formats, network/timeout/rate-limit guidance, internal error suppression, malformed validation details.
- Local production login and registration checked at 390px: no horizontal overflow.

## Remaining verification / separate backlog

- These edits are local and have not been pushed or deployed.
- Signed-in drawer, plant registration, camera permissions, GPS and storage upload need an end-to-end check after deployment. No user account or real camera/location data was used in this check.
- Existing repository-wide lint debt and previously reported dependency advisories are not resolved by this patch.
- Prior server logging exposed a third-party API key in URL logs; log redaction and key rotation remain separate work.
- This is a focused improvement pass, not a guarantee that every website route is defect-free.
