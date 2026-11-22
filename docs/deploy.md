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
| `main` on Cloudflare (yourcoffeesetup.com) | production | `content/published/` only, real `data/offers/`, GA4, indexable. With no published guides the market homes show the holding message. |
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
   `PUBLIC_GA4_ID` = your `G-…` ID. Optional: `PUBLIC_GSC_VERIFICATION` if you use the HTML-tag method.
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

## GA4

- Property: Your Coffee Setup, web stream `https://yourcoffeesetup.com`. Data retention: 14 months.
- Consent Mode v2 (`site/src/components/Analytics.astro`): analytics storage denied by default in the
  UK, EEA and Switzerland until a consent banner exists; ads signals denied everywhere.
- Custom events from `site/public/assets/site.js`: `affiliate_click` (`page_id, product_id, seller,
  market, position, tool_state`), `tool_complete` (`tool_id, result`), `scroll_depth` (`percent`).
  Register `product_id`, `seller`, `market`, `position`, `page_id` as custom dimensions in GA4
  (Admin > Custom definitions) to report on them.

## CI

`.github/workflows/checks.yml` runs tests, validation and both site builds on every PR and push to
`main`. Make the `checks` job a required status check on `main`.
