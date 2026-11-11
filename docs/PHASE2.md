# Phase 2 implementation and deployment report

## Outcome and boundaries

Phase 2 extends the original JavaScript Cloudflare Worker on `feature/phase-2-platform`. The public catalogue, three worlds, brand colors and GRAMS relationship remain intact. Typed backend modules add persistence and protected management workflows. No paid image generation was enabled or implemented.

The live URL supplied by the owner is `https://misa.gramsmorocco.workers.dev/`. The existing `wrangler.jsonc` names the production Worker `misa`; it is unchanged. The new `wrangler.staging.jsonc` names a separate `misa-staging` Worker. Its all-zero D1 UUID is a **local placeholder**, not a deployed resource. No Cloudflare account resources were created or modified, no production migrations were executed, and no production deployment was performed. Account-side resource inventory could not be authenticated: the environment has an account ID but no `CLOUDFLARE_API_TOKEN`; `wrangler whoami` reports unauthenticated. Do not infer the remote account has no other resources merely from the checkout's configuration.

## Audit

- Entrypoint: `src/worker.js`; direct server rendering, no React or build framework.
- Prior bindings: none in checked-in Wrangler configuration. No repository configuration for D1, R2, Queues or Turnstile.
- Prior form: disabled POST endpoint and client placeholder response. No persistence or private dashboard.
- Prior assets: generated illustrative SVG compositions, no approved product/event photographs.
- The original hero already supported hover and focus. This change makes the actual layout distribution 48/26/26 using animated grid tracks, adds supporting-text emphasis and mobile reveal, and retains reduced-motion behavior and passive scrolling.
- No supplied approved visual previews or generated image files were available. Automated fixtures demonstrate import only; they are never published to a remote Worker.

## Architecture and changed files

| Files | Responsibility |
| --- | --- |
| `src/worker.js`, `src/style.js`, `src/client.ts` | Preserve public pages; contextual forms, success/errors, responsive motion, image placements and security headers |
| `src/platform.ts` | Typed bindings, bounded body readers, persistent rate limits, same-origin checks, Access JWT verification and staff allowlists |
| `src/inquiries.ts` | Six inquiry types, validation, AES-GCM encryption, idempotency, staff details/status/history |
| `src/notifications.ts` | Provider abstraction, Resend adapter, durable outbox, delivery attempts and bounded retry/claim logic; optional Queue consumer and scheduled fallback |
| `src/assets.ts` | Private originals/attachments, file signature/dimension limits, optimized variants, approval/publishing/placement history |
| `src/backend.ts`, `src/admin.ts` | API routing; protected inquiry and asset dashboards |
| `migrations/0001_platform.sql` | Additive first-release schema, foreign keys and indexes |
| `wrangler.staging.jsonc` | Isolated staging bindings, disabled public collection/email by default, five-minute retry cron |
| `scripts/setup-local.mjs`, `scripts/import-asset.mjs` | Non-overwriting local setup; manual approved-image import with Sharp |
| `tests/backend.test.ts`, `tests/worker.test.js`, `tests/phase2-browser.mjs` | Isolated D1/R2 integration, public regressions, browser workflows |
| `package.json`, `package-lock.json`, `tsconfig.json`, `.gitignore`, `README.md` | Commands, pinned dependency resolution, Worker types and ignored credentials/artifacts |

The obsolete initial browser script was replaced by the Phase 2 browser suite.

## Database schema

- `inquiries`: random UUID reference, type, encrypted payload, status, notification status, hashed idempotency key and payload fingerprint, timestamp.
- `inquiry_history`: staff/customer audit events; internal notes encrypted with the inquiry key.
- `attachments`: private R2 key, associated reference, original filename, MIME and size.
- `notifications`: one durable outbox record per reference, state, attempts, retry time, lease, provider identifier.
- `notification_attempts`: outcome and time for each completed delivery attempt; no customer details in provider error logs.
- `assets`: original key, dimensions/MIME/size, alt text, source record, AI concept versus verified photo, lifecycle status, desired placement, focal coordinates and creator.
- `asset_variants`: private R2 keys for 640px/1280px WebP variants, bounded by source width.
- `asset_usage`: published placement → asset association. A replacement draft does not displace the published image until publication.
- `asset_history`: import and metadata/approval/publication audit events.
- `rate_limits`: hashed client identity and time-window counters; expired windows are pruned by the scheduled handler.

Customer request payloads and internal notes use AES-256-GCM with fresh nonces. Keep the encryption key in a Worker secret and back it up securely alongside database backups. The key is never sent to the browser. Rotation requires a separate tested re-encryption migration; changing it directly would make existing records unreadable. Reference, workflow metadata, filenames and technical timestamps remain plaintext in private D1. R2 originals and attachments are private and rely on Cloudflare storage encryption and staff authorization.

## APIs and authorization

- `POST /api/inquiries`: same origin, JSON ≤16 KiB, `Idempotency-Key`, six allowed types, contextual validation, consent, honeypot, per-IP keyed rate limit and real Turnstile verification on remote hosts. All successful responses confirm D1 persistence and distinguish notification status. Concurrent identical requests return the same reference. Conflicting payload reuse returns 409.
- `GET /api/inquiries/:reference`: authenticated staff only; knowing a reference grants no private access.
- `POST /api/inquiries/:reference/attachments`: up to three PNG/JPEG/WebP files (≤5 MiB each), protected by a high-entropy receipt returned after submission. Upload receipts expire after an hour. The receipt grants no read access.
- `/api/admin/inquiries`, `/api/admin/inquiries/:reference`: staff-only metadata search/pagination and status/note updates.
- `/api/admin/attachments/:id`: staff-only forced downloads; never public attachments.
- `/api/admin/assets` and `/:id`: staff-only import, metadata, lifecycle transitions and placements.
- `/api/admin/assets/:id/preview` and `/original`: staff-only; originals stay downloadable after replacement.
- `/media/:target`: only published WebP variants. Drafts/original keys never become public. Missing objects or bindings fall back to existing illustrations.
- `/admin/inquiries`, `/admin/assets`: remote requests require a signed Access JWT, correct issuer/audience, required expiry claims and an explicit email or service-subject allowlist. Supplied identity headers alone are not trusted. Missing configuration fails closed.

Cloudflare Access must protect `/admin/*` and `/api/admin/*`; also protect staff retrieval at `/api/inquiries/*` while allowing the customer attachment POST route through the Access policy, or rely on the Worker's JWT check for GET retrieval. Avoid an Access rule that blocks public inquiry submission or receipt-protected uploads. Test the exact path/method policy in remote staging.

For **loopback-only local staging**, a random ignored `LOCAL_ADMIN_TOKEN` permits a local HttpOnly SameSite cookie login. It is not accepted on any remote hostname, even when copied into a deployed configuration. No default administrator credential exists. Staff permissions currently have one staff role; finer-grained approval roles are future work.

## Required Cloudflare resources and settings

Provision these only after inspecting the account inventory with authenticated access. Use unique staging resources; never reuse production D1/R2 or notification queues.

| Binding / variable | Purpose |
| --- | --- |
| `DB` | D1 database; use the actual staging UUID in a reviewed staging config |
| `STORAGE` | Private R2 bucket; keep public R2 access disabled |
| `NOTIFICATIONS` | Optional Queue producer/consumer; cron outbox works without Queues |
| `ENVIRONMENT` | `staging` for staging; use a separate reviewed production config |
| `INQUIRIES_ENABLED` | `false` until legal/data handling and real safeguards are configured; `true` enables persistence |
| `INQUIRY_ENCRYPTION_KEY` | Secret: 32 random bytes as 64 hexadecimal characters |
| `RATE_LIMIT_SECRET` | Secret: strong random salt for keyed client identity hashes |
| `ACCESS_TEAM_DOMAIN` | Exact team hostname, e.g. `<team>.cloudflareaccess.com` |
| `ACCESS_AUD` | Access application audience |
| `STAFF_EMAILS` | Explicit comma-separated staff emails; no wildcard |
| `STAFF_SERVICE_SUBJECTS` | Optional explicit verified Access JWT subjects for manual CLI imports with Access service tokens |
| `TURNSTILE_SITE_KEY` | Public widget key for the exact staging hostname |
| `TURNSTILE_SECRET` | Secret for server-side verification |
| `TURNSTILE_HOSTNAME` | Expected hostname; action must be `inquiry` |
| `EMAIL_PROVIDER` | Default `disabled`; supported adapter `resend` |
| `EMAIL_API_KEY` | Secret; only needed when email is enabled |
| `EMAIL_FROM`, `EMAIL_TO` | Verified sender and actual team recipient; no invented addresses |

The deployment runner additionally needs `CLOUDFLARE_ACCOUNT_ID` and a scoped `CLOUDFLARE_API_TOKEN` with the appropriate Workers, D1, R2 and optional Queue permissions. Cloud task egress needs `api.cloudflare.com` for provisioning, the team Access hostname for JWKS, `challenges.cloudflare.com` for Turnstile, `api.resend.com` only if enabling Resend, and the actual staging hostname for smoke tests. Browser Turnstile loading and Worker-origin requests have their own network paths; task egress permission alone does not prove either works.

The CLI importer reads `MISA_STAFF_ORIGIN`, `CF_ACCESS_CLIENT_ID`, `CF_ACCESS_CLIENT_SECRET` from the process environment. An Access service policy and its approved subject must also be configured. Keep credentials out of command arguments and Git.

## Image import workflow

1. Obtain an approved file from ChatGPT manually. Do not assume generated images appear in the Worker.
2. Record approval/provenance and alt text. Keep AI concepts distinct from verified real photography.
3. Upload through `/admin/assets`. The browser decodes and generates 640/1280 WebP variants before a bounded authenticated multipart upload. Or use the Sharp importer described in the README.
4. Original raster signatures, dimensions (≥320px in each dimension, ≤20 megapixels) and ≤20 MiB size are checked server-side. WebP variants are bounded to 2 MiB and checked against source aspect and width. SVG and arbitrary files are rejected. EXIF-rotated source files should be normalized before import; the CLI rejects non-normalized orientation.
5. Save a desired placement and approve the draft. Publish in a separate action; draft → published is rejected.
6. Published image responses include alt text, responsive sources and focal metadata. AI concepts are labeled as concepts. No collaboration portfolio placement is available, preventing generated scenes from being used as project evidence.
7. Import a new image to replace one, approve it, and publish to the same placement. Existing originals and history remain recoverable.

There is no paid generation endpoint. A future generation provider can feed the same draft import contract after authenticated generation and explicit budget approval.

## Email behavior

The API commits the inquiry and outbox atomically before returning success. Email is a separate status (`disabled`, `pending`, `retry`, `sent`, `failed`). No disabled or failed delivery is described as sent. Existing disabled records are not automatically emailed when credentials are later configured.

A configured provider sends only inquiry type/reference and an invitation to sign in. A conditional D1 lease prevents concurrent sends. Resend idempotency keys are stable per reference; retries are bounded to eight attempts within a 20-hour window, inside the provider's 24-hour key retention. Temporary failures use backoff. A five-minute cron scans due records; optional Queues reduce initial latency. A crash after sending can be recovered with the same provider idempotency key. Exhausted/expired deliveries become failed and remain visible to staff. This is provider-backed deduplication, not a claim of mathematically exactly-once email delivery.

## Local isolated reproduction

Use the existing checkout; cloud tasks are already isolated. Do not create a worktree unless explicitly requested.

```sh
cd /workspace/misa
npm ci --cache /workspace/.npm-cache
npm run setup:local
XDG_CONFIG_HOME=/workspace/.config npm run migrate:local
XDG_CONFIG_HOME=/workspace/.config npm run migrate:local
npm run check
XDG_CONFIG_HOME=/workspace/.config npm test
XDG_CONFIG_HOME=/workspace/.config npm run build:staging
XDG_CONFIG_HOME=/workspace/.config npm run dev:staging
```

In another shell run `npm run test:browser`. Set `CHROMIUM_PATH` if Chromium is not at `/usr/bin/chromium`. Browser test data is synthetic and stored only in `.wrangler/phase2-staging`. Unit/integration tests use a separate in-memory Miniflare D1/R2 instance. `.dev.vars` is generated only when absent and is never overwritten. Local Turnstile omission is permitted only for a loopback staging host; remote staging cannot use this omission. Never copy local synthetic data or keys into a production environment.

## Remote staging, migration and rollback procedure (not executed)

1. Verify the account and inventory with `wrangler whoami`, D1/R2/Queue lists, Worker bindings and Access applications. Confirm what production actually uses before editing anything.
2. Create an isolated staging D1 database and private R2 bucket (and optional Queue), then insert their real IDs/names into a staging-only config. Keep `wrangler.jsonc` and live bindings unchanged. Provision staff Access and Turnstile for the staging hostname. Configure required secrets securely.
3. Keep public collection disabled. Deploy **only** `misa-staging` with its explicit config. Apply `0001_platform.sql` **only** to the isolated staging database with `wrangler d1 migrations apply misa-staging --remote --config wrangler.staging.jsonc`. Verify the migrations table and schema before enabling staging collection.
4. Run staging smoke tests with synthetic data: all inquiry types, duplicates, rate limit, actual Turnstile, authorized and unauthorized staff, private file access, approved image import/publication/replacement, and real provider email failure/retry/delivery. Use a verified test recipient. Verify private bucket ACLs, cron/optional Queue delivery, Access issuer/audience and production binding separation.
5. Export the staging database and inventory recoverable R2 keys. Review the deployment report and obtain explicit approval **before** any live promotion. Local tests do not satisfy this gate.
6. Before later production migration, inventory/export production data, retain a recoverable encryption key backup, rehearse schema changes against a disposable restored copy, and record a tested recovery point and previous Worker version. This first migration only creates tables; if production already has conflicting tables, stop and create a reviewed compatibility migration. Never run a destructive down migration over populated operational data.
7. Rollback: disable collection, roll back the Worker version/config to the last known version, preserve D1/R2 and outbox data, and inspect failed/pending requests before resuming. The old prototype ignores the additive tables. Database disaster recovery uses the recorded export/Time Travel point after a rehearsal; no destructive automatic rollback is provided. For disposable local data only, starting with a new persist directory has been tested. Production restore has not been tested.

## Verification and remaining limits

Executed locally: type checking; 22 tests (public routes, isolated migration/FKs, six type validators, encrypted persistence, concurrent idempotency, persistent rate limits, CSRF/body bounds, unauthorized staff/private files, status/audit notes, asset lifecycle, disabled email, simulated notification retry/deduplication, genuine RSA/JWT claim validation with isolated keys, and simulated Turnstile response validation); staging production bundle; npm dependency audit (zero vulnerabilities); migrations applied once and repeated with no pending changes.

Browser: 48 responsive route checks across 375/390/768/1024/1440/1920; hover and keyboard navigation, actual 48/26/26 widths, reduced motion, filter and contextual product reference, native validation, confirmed persistence, staff review, browser WebP conversion/import/approval/publication and media rendering. No page JavaScript errors. Captured desktop/mobile screenshots under ignored `artifacts/`; representative homepage, mobile form and authenticated assets screenshots were inspected. No approved reference images were available for fidelity comparison.

Unverified externally: remote resource inventory/provisioning, remote Access/JWKS authentication, actual Turnstile token acceptance, real provider email, Queue delivery, private remote R2 policy, staging remote smoke tests, production migration/restore. The tests simulate provider responses and do not send email. Header-level raster checks do not replace malware scanning or full server-side media decoding; trusted staff import and forced private downloads reduce exposure, but attachments should undergo scanning before expanding supported types. PDF/office uploads are deliberately unsupported. A browser that cannot encode WebP should use the CLI importer. No production security certification, accessibility certification or field performance percentile claim is made.

Retention/deletion operations, privacy contact, operator identity, approved production imagery and final business specifications remain required before public collection. Staff have a single authorized role; approval separation, granular roles and automatic retention are future work.

**Readiness: locally verified development implementation; not cleared for production promotion.** Remote staging and a new explicit production approval are still required. No live Worker, remote database, remote bucket, environment publication or production branch was modified during implementation.
