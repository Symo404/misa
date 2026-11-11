# MISA

Cloudflare Worker website for Objects, Taste and Experiences. Framework-free server rendering keeps the site portable and the client JavaScript small. The specification recommends Next.js; this implementation uses the Workers runtime directly for the requested deployment target.

## Develop and validate

Node.js 24 and npm are used. From `/workspace/misa`:

```sh
npm ci --cache /workspace/.npm-cache
npm run check
npm test
npx wrangler deploy --dry-run --outdir /tmp/misa-build
npm run dev -- --ip 0.0.0.0
```

Use the existing checkout. Each cloud task is already isolated; do not create a worktree unless requested.

## Deploy

Set `CLOUDFLARE_API_TOKEN` securely (Workers Scripts Edit for the intended account) and `CLOUDFLARE_ACCOUNT_ID` for gramsmorocco. Run `npx wrangler whoami` to verify the account, then `npm run deploy`. Configuration creates the Worker named `misa` with workers.dev enabled; no custom domain is configured. Never save tokens in Git. For constrained cloud environments set `XDG_CONFIG_HOME=/workspace/.config` when invoking Wrangler.

## Routes and architecture

- `/`: three expanding desktop panels, stacked on mobile, gentle scroll treatment, reduced-motion support.
- `/gifts`, `/cheese-charcuterie`, `/events`: category filters and concept cards.
- Each category has a stable detail route under its world.
- `/contact`: contextual forms selected by `type` and `selected` query parameters.
- `/privacy`, `/sitemap.xml`, `/robots.txt`.
- `src/data.js`: structured category and concept records, ready for future CMS migration.
- `src/art.js`: locally rendered, labeled SVG placeholders.
- `src/style.js`: ivory, rose, olive and caramel tokens; responsive layouts.
- `src/worker.js`: routing, semantic layout, escaped rendering, security headers and small client script.

## Content and launch limitations

No approved visual previews or production images were included in the upload. All illustrations are original placeholder compositions labeled as such, not product photographs. All categories are demonstration concepts; availability, materials, lead times, food composition, allergens, servings and packaging require verification. No real projects, clients, testimonials, contact addresses or phone numbers are fabricated. The wordmark and favicon are interim typographic marks; approved custom logo vectors remain required. The font uses a system fallback; Manrope assets are not supplied.

Inquiries are deliberately disabled: the endpoint returns 503 and never claims success. Entered fields are not transmitted. No uploads or customer record storage are enabled. Production email delivery, verified sender/recipient, server validation, spam protection, rate limiting, duplicate protection and retention policy remain a separate required integration before inquiry collection is enabled. The form is a preview, not a working delivery system. Confirm legal operator and privacy requirements before launch.

No performance percentile claims or full WCAG certification are made. Add approved social preview raster assets before final social sharing rollout. Real email integration, approved imagery, contact details and visual reference comparison remain prerequisites for the full production acceptance criteria in the supplied brief.
