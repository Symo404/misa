# Phase 2 staging deployment — 12 November 2026

## Result

Phase 2 is deployed to https://misa-staging.gramsmorocco.workers.dev through the authenticated Cloudflare dashboard. Production `misa` was not modified during this Phase 2 task. The detailed implementation, schema, API contract, variable list and rollback procedure remain in [PHASE2.md](PHASE2.md).

## Account inventory and isolated resources

- Production `misa`: zero bindings at audit; active version `bb7b9c61-7d8e-40a4-a31d-001c944f43e1`.
- D1 inventory initially empty. Created only `misa-staging`, UUID `6da21fa3-b5ae-4a39-959e-b35e3de553e2`.
- Applied the tested `0001_platform.sql` schema through the D1 console and recorded it in `d1_migrations`. Verified the application tables through `sqlite_master`.
- Existing R2 buckets `grams-brand-assets` and `grams-brand-assets-staging` were preserved. Created only `misa-staging-private`; dashboard confirms Public Access Disabled.
- Staging Worker binds `DB` and `STORAGE` to these isolated resources. Five-minute scheduled outbox trigger is configured. Queues are optional and are not bound.
- Cloudflare reports Zero Trust setup is required before Workers Access sign-in is available. No staff Access application or identity allowlist has been configured by this task.
- Email is explicitly disabled at the owner's request. Public inquiry collection is disabled pending security configuration.

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

## Remaining configuration and promotion gate

Required before full remote workflow verification:

1. Staff email allowlist and Cloudflare Zero Trust/Access setup, including issuer, application audience and tested authenticated access. No default credentials were created.
2. Dedicated staging encryption and rate-limit secrets; real Turnstile widget/secret for the exact staging hostname; then enable collection only in staging.
3. An owner-approved raster image with provenance and alt text for remote import/publication testing. Local synthetic fixture images are not approved production assets.
4. Remote synthetic inquiry submission, D1 record verification, authenticated staff review, private attachment checks and remote asset lifecycle tests. Existing local integration tests do not substitute for these.
5. Email remains disabled. Real delivery/retry cannot be verified until provider settings and verified sender/recipient are supplied.

No production promotion was attempted. The supplied brief explicitly requires successful isolated staging verification, a deployment report, and a new production approval before live promotion. Current readiness: deployed restricted staging preview; not a fully operational or production-ready inquiry platform.

The additive schema and private originals are preserved for recovery. Before any later production migration, follow the inventory/export, restore rehearsal and key-backup procedure in PHASE2.md. No destructive rollback has been executed.
