# Deploying yourcoffeesetup.com

The site is the Astro project in `site/`, served as static assets by a Cloudflare Worker
(`yourcoffeesetup`, configured in `wrangler.jsonc` at the repo root; no Worker code). Cloudflare
Workers Builds builds and deploys it straight from GitHub; no deploy keys live in GitHub or in this
repo. `site/`, `content/published/` and `wrangler.jsonc` are reader-facing paths
(`engine/scheduler/git-policy.json`), so they only change through a merged PR, and a tick can never
trigger a deploy.

## Modes

| Where | Mode | What it shows |
|---|---|---|
| `main` on Cloudflare (yourcoffeesetup.com) | production | `content/published/` only, real `data/offers/`, GTM (GA4), indexable. With no published guides the market homes show the holding message. |
| Any other branch / PR on Cloudflare (Preview on `*.workers.dev`) | preview | Drafts, quality reference, archived drafts (badged), mock prices and photos, `noindex`, robots disallow. |
| Local `npm run site:build` / `site:preview` | preview | Same as above. |
| Local `npm run site:build:production` | production | Same as the live site. |

`SITE_MODE=production|preview` overrides the automatic choice. A production build refuses to run
once a guide is published unless `niche.json` has verified disclosure text for every market.

## Cloudflare Workers (one-time setup)

1. **Workers & Pages > Create > Import a repository**, pick `ron2man/coffee-research`.
2. Settings:
   - Project name: `yourcoffeesetup` (must match `name` in `wrangler.jsonc`)
   - Production branch: `main`
   - Build command: `npm run site:build` (Workers Builds runs `npm ci` itself)
   - Deploy command: `npx wrangler deploy`
   - Preview command (non-production branches): `npx wrangler preview` (the default)
   - Root directory: *(leave empty: the build reads `engine/`, `knowledge/`, `content/` from the repo root)*
3. **Build watch paths** (Settings > Build): include `site/*`, `content/published/*`, `data/offers/*`,
   `package.json`, `package-lock.json`, `niches/*`, `knowledge/*`, `wrangler.jsonc`. Tick commits to
   `data/items/` and the like then don't trigger builds.
4. **Build variables** (Settings > Build > Variables and secrets): `NODE_VERSION` = `22`,
   `PUBLIC_GTM_ID` = `GTM-P6P44F42`. Optional: `PUBLIC_GSC_VERIFICATION` if you use the HTML-tag method.
   These are build-time only; the Worker has no runtime variables.
5. **Custom domains** come from `routes` in `wrangler.jsonc`: the first production deploy attaches
   `yourcoffeesetup.com` and `www.yourcoffeesetup.com` and creates their DNS records.
6. **Redirect www to the root domain**: Rules > Redirect Rules > "Redirect from WWW to root" template
   (301, preserve path and query).

Workers Builds sets `WORKERS_CI_BRANCH`; `site/lib/site-data.mjs` builds production on `main` and
preview everywhere else. `site/public/_headers` adds security headers and `X-Robots-Tag: noindex`
on every `*.workers.dev` address, so only yourcoffeesetup.com gets indexed. Unknown paths serve
`404.html` with a 404 status (`not_found_handling` in `wrangler.jsonc`).

Check the Worker locally with `npm run site:build && npx wrangler dev` (serves `site/dist` the way
production does, including `_headers`).

## Google Search Console

1. Add a **Domain** property for `yourcoffeesetup.com` (DNS verification; Search Console offers to add
   the TXT record in Cloudflare for you).
2. Sitemaps: submit `https://yourcoffeesetup.com/sitemap-index.xml`.
3. In GA4 (Admin > Product links > Search Console links), link the property so queries show in GA4.

## Analytics: GTM and GA4

The site loads Google Tag Manager (container `GTM-P6P44F42`, from `PUBLIC_GTM_ID`) in production
builds only. GA4 is configured inside the container, not in the site code.

- GA4 property: Your Coffee Setup, web stream `https://yourcoffeesetup.com`. Data retention: 14 months.
- Consent Mode v2 (`site/src/components/Analytics.astro`): the page sets consent defaults before GTM
  loads. Analytics storage is denied by default in the UK, EEA and Switzerland until a consent banner
  exists; ads signals are denied everywhere. In GTM, leave the GA4 tags on built-in consent checks.
- The page pushes `{ market, page_id }` to `dataLayer` before GTM loads.
- `site/public/assets/site.js` pushes custom events as `{ event: '<name>', params: { … } }`:
  `affiliate_click` (`page_id, product_id, seller, market, position, tool_state`), `tool_complete`
  (`tool_id, result, page_id`), `scroll_depth` (`percent, page_id`).

### GTM container setup (one-time)

1. **Tag: Google tag**, Tag ID = your GA4 `G-…` measurement ID. Trigger: *Initialization - All Pages*.
   Under Configuration settings add `market` = `{{DLV - market}}` and `page_id` = `{{DLV - page_id}}`.
2. **Variables** (User-Defined > Data Layer Variable, version 2): `market`, `page_id`, and
   `params.product_id`, `params.seller`, `params.market`, `params.position`, `params.tool_state`,
   `params.tool_id`, `params.result`, `params.percent`, `params.page_id`.
3. **Triggers** (Custom Event): `affiliate_click`, `tool_complete`, `scroll_depth`. Or one trigger
   with event name regex `^(affiliate_click|tool_complete|scroll_depth)$`.
4. **Tag: GA4 Event** per trigger, Measurement ID = the same `G-…`, Event name = `{{Event}}`, and
   event parameters mapped from the `params.*` variables above.
5. Preview in GTM Tag Assistant against `https://yourcoffeesetup.com`, then **Submit / Publish**.
6. In GA4 (Admin > Custom definitions), register `product_id`, `seller`, `market`, `position`,
   `page_id` as custom dimensions to report on them.

## CI

`.github/workflows/checks.yml` runs tests, validation and both site builds on every PR and push to
`main`. Make the `checks` job a required status check on `main`.
