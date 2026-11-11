# MISA

An editorial catalogue for Objects, Taste and Experiences, built on a Cloudflare Worker. Phase 2 adds encrypted D1 inquiries, private R2 media, staff dashboards, approved-image imports and a durable email notification outbox.

Start with [the Phase 2 report](docs/PHASE2.md) for architecture, schema, security boundaries, exact bindings/variables, validation evidence and the staging/promotion/rollback procedure.

## Local staging

Node.js 24, npm and Chromium are used. Work in the existing checkout; each cloud task is already isolated.

```sh
npm ci --cache /workspace/.npm-cache
npm run setup:local
XDG_CONFIG_HOME=/workspace/.config npm run migrate:local
npm run check
XDG_CONFIG_HOME=/workspace/.config npm test
XDG_CONFIG_HOME=/workspace/.config npm run build:staging
XDG_CONFIG_HOME=/workspace/.config npm run dev:staging
```

In another shell: `npm run test:browser`. Override `CHROMIUM_PATH` when needed. The browser suite uses synthetic local data and produces screenshots in ignored `artifacts/`.

`setup:local` creates random ignored credentials only if `.dev.vars` does not already exist. Local staff login reads the generated `LOCAL_ADMIN_TOKEN`; never put it in Git or expose it remotely. The loopback-only login is unavailable on deployed hosts. Real staging/production staff require Cloudflare Access JWT verification plus explicit staff allowlists.

## Manual approved image import

Use `/admin/assets` to upload, annotate, assign, approve and then publish. Originals stay private; public placements serve optimized variants. AI concepts remain labeled and cannot be assigned to real collaboration evidence. The alternate CLI uses Sharp:

```sh
npm run import:asset -- approved-image.png "Descriptive alt text" "Approval/source record" ai-concept
```

Supply `MISA_STAFF_ORIGIN`, `CF_ACCESS_CLIENT_ID` and `CF_ACCESS_CLIENT_SECRET` securely in the process environment, with an Access service policy and explicit service subject allowlist. No paid image-generation API is activated.

## Deployment boundary

- `wrangler.jsonc`: existing live Worker configuration, unchanged.
- `wrangler.staging.jsonc`: isolated staging config; D1 UUID is a local placeholder. Replace it only after authenticated inventory and creation of a separate staging database.
- `npm run build:staging` is a dry run, not a deployment.
- Do not merge or deploy Phase 2 to the live `misa` Worker before remote staging verification and explicit production approval.

The checked-in staging settings keep public persistence and email disabled. Remote collection additionally needs a secure encryption key, rate-limit secret, real Turnstile configuration and reviewed privacy/data retention arrangements. Email can remain disabled while inquiries persist; delivery status is reported separately.

Approved production images, verified contacts and final product/event details remain outstanding. Placeholder illustrations and catalogue concepts are clearly identified; no real clients, events, compositions or availability are invented.
