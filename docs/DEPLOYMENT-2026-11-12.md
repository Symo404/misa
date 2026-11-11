# Phase 2 staging deployment — 12 November 2026

## Result

Phase 2 is deployed to https://misa-staging.gramsmorocco.workers.dev through the authenticated Cloudflare dashboard. Production `misa` was not modified during this Phase 2 task. The detailed implementation, schema, API contract, variable list and rollback procedure remain in [PHASE2.md](PHASE2.md).

## Account inventory and isolated resources

- Production `misa`: zero bindings at audit; active version `bb7b9c61-7d8e-40a4-a31d-001c944f43e1`.
- D1 inventory initially empty. Created only `misa-staging`, UUID `6da21fa3-b5ae-4a39-959e-b35e3de553e2`.
- Applied the tested `0001_platform.sql` schema through the D1 console and recorded it in `d1_migrations`. Verified the application tables through `sqlite_master`.
- Existing R2 buckets `grams-brand-assets` and `grams-brand-assets-staging` were preserved. Created only `misa-staging-private`; dashboard confirms Public Access Disabled.
- Staging Worker binds `DB` and `STORAGE` to these isolated resources. Five-minute scheduled outbox trigger is configured. Queues are optional and are not bound.
- The owner activated Zero Trust Free and explicitly approved protecting the entire staging Worker. Application `MISA staging staff` (`aec50d16-1ddb-4cdf-a449-6c6cdfa3e098`) uses an exact email allow policy and email one-time PIN authentication. The approved staff identity successfully signed in; both dashboards loaded their D1 records. Staff email is stored as an encrypted Worker secret rather than committed to Git.
- Email is explicitly disabled at the owner's request. Staging inquiry collection is enabled behind the approved Access gate; production collection remains unchanged and disabled.
- Dedicated staging encryption and rate-limit secrets were generated with a cryptographic random number generator. Access issuer/audience and Turnstile settings were installed as encrypted Worker secrets and survived the subsequent Git deployment. Never reuse these keys for production.
- Created `MISA staging inquiries`, a managed Turnstile widget restricted to `misa-staging.gramsmorocco.workers.dev`; pre-clearance remains disabled. A real automatic verification token was accepted server-side during inquiry submission.

## Source and build pipeline

Development branch: `codex/phase2-deployment`, based on existing Phase 2 commit `4da3027`.

The initial dashboard wizard cloned `main`; its explicit build command fetched and checked out the development branch before installing dependencies. Deployment used only `npx wrangler deploy --config wrangler.staging.jsonc`. Initial successful staging version: `980eccae-ba33-46f1-a2b7-6649ae763880`, build `38e15368-d84c-4721-8435-cb9c56635396`.

The staging project's branch was then set to `codex/phase2-deployment`, with build command `npm run check && npm test` and the explicit staging deploy command. Preview builds were disabled in the creation wizard; version preview URLs are explicitly disabled in the staging configuration.

Task changes: actual staging database UUID; portable Playwright browser selection; ignored artifact build output; explicit preview setting; reproducible remote staging smoke script; this report. No production configuration or operational data was changed.

## Verification performed

- `npm ci`: success; zero audit vulnerabilities reported.
- `npm run check`: passed.
- `npm test`: 22/22 passed, including encryption, persistence, idempotency, rate limits, authorization, private attachments, asset lifecycle and simulated notification retries.
- Local migration applied successfully; repeat migration reported no pending migrations.
- `npm run build:staging`: passed; 109.82 KiB uploaded bundle in dry run.
- `npm run test:browser`: passed 48 responsive route checks plus hover/focus expansion, keyboard navigation, reduced motion, contextual persistence, staff review and browser image import/approval/publication. An initial run failed after the database UUID change caused the local emulator to use a fresh database; applying its migration resolved the failure.
- Desktop and mobile screenshots were visually inspected. Existing editorial three-panel identity is preserved; imagery remains labeled placeholder illustrations.
- `node scripts/staging-smoke.mjs`: passed against the deployed Worker. Public pages return 200; hero expansion and keyboard navigation work; mobile has no horizontal overflow; reduced motion works; disabled form cannot submit; unconfigured staff/private routes return 503; inquiry POST returns 503 and explicitly reports no persistence. No browser page errors.
- R2 public access is disabled. Staging settings show the intended D1 and R2 bindings and email/collection disabled.

## Authenticated remote verification follow-up

- Real Access login by the approved staff email succeeded. Both `/admin/inquiries` and `/admin/assets` loaded successfully, including D1 queries.
- Remote synthetic inquiry `MISA-45091ff8-85dd-4a2a-a405-3c7b32ca41e7` persisted with a real Turnstile verification and private PNG attachment `0724a655-0686-46de-8fe7-41de7d6cdbb8`. The UI displayed the server reference, disabled repeat submission, and correctly reported email disabled. The staff dashboard decrypted the payload, showed the attachment, and persisted a Completed status plus encrypted internal note/audit history across a reload.
- Remote synthetic asset `453fcfbb-16c9-46fd-899d-0b0b6be2e7f9` imported as draft with private original and browser-generated WebP variants. Approval and publication were separate persisted actions. Published `item-MISA-01-01` rendered successfully with the AI concept label. The fixture was then returned to draft and the original catalogue placeholder was verified to return. No test image was published to production.
- Anonymous requests for the staging catalogue, admin pages, APIs, private attachments and inquiry POST all redirect to the intended Cloudflare Access login. Production remains public. The remote smoke script now supports this approved staging protection.
- Challenge-provider frames emit diagnostic console messages; no MISA page script error was observed. Actual Turnstile verification and persistence succeeded. No claim is made that third-party console output is empty.
- Local tests cover all six validators, idempotency races, limits, authorization, assets and simulated email retries. Remote end-to-end persistence was exercised with the general inquiry type; exhaustive remote concurrency/rate-limit tests, every contextual form submission and live email delivery remain unverified.

## Remaining configuration and promotion gate

Required before full remote workflow verification:

1. Separate production D1/R2 resources, production-hostname Turnstile and staff Access configuration, production-only secrets with a secure encryption-key backup, and a reviewed production config. No production resources were provisioned or migrated.
2. Production recovery rehearsal and reviewed migration/rollback procedure before enabling live customer collection. Do not promote staging records, keys or fixtures into production.
3. Owner-approved production imagery/provenance and verified business contacts, operator/privacy/retention details. Synthetic fixture images are not approved production assets.
4. Complete remaining remote validation as noted above. The completed staging workflows provide evidence but do not establish a full production-readiness certification.
5. Email remains disabled. Real delivery/retry cannot be verified until provider settings and verified sender/recipient are supplied.

No production promotion was attempted. The supplied brief explicitly requires successful isolated staging verification, a deployment report, and a new production approval before live promotion. Current readiness: authenticated staging with verified inquiry and asset workflows; production preparation and approval remain outstanding.

The additive schema and private originals are preserved for recovery. Before any later production migration, follow the inventory/export, restore rehearsal and key-backup procedure in PHASE2.md. No destructive rollback has been executed.
