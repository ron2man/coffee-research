# Deploying yourcoffeesetup.com

The site is the Astro project in `site/`. Cloudflare Pages builds it straight from GitHub; no deploy
keys live in GitHub or in this repo. `site/` and `content/published/` are reader-facing paths
(`engine/scheduler/git-policy.json`), so they only change through a merged PR, and a tick can never
trigger a deploy.

## Modes

| Where | Mode | What it shows |
|---|---|---|
| `main` on Cloudflare (yourcoffeesetup.com) | production | `content/published/` only, real `data/offers/`, GA4, indexable. With no published guides the market homes show the holding message. |
| Any other branch / PR on Cloudflare (`*.pages.dev`) | preview | Drafts, quality reference, archived drafts (badged), mock prices and photos, `noindex`, robots disallow. |
| Local `npm run site:build` / `site:preview` | preview | Same as above. |
| Local `npm run site:build:production` | production | Same as the live site. |

`SITE_MODE=production|preview` overrides the automatic choice. A production build refuses to run
once a guide is published unless `niche.json` has verified disclosure text for every market.

## Cloudflare Pages (one-time setup)

1. **Workers & Pages > Create > Pages > Connect to Git**, pick `ron2man/coffee-research`.
2. Build settings:
   - Production branch: `main`
   - Framework preset: None
   - Build command: `npm run site:build` (Pages runs `npm ci` itself)
   - Build output directory: `site/dist`
   - Root directory: *(leave empty: the build reads `engine/`, `knowledge/`, `content/` from the repo root)*
3. **Build watch paths** (Settings > Builds): include `site/*`, `content/published/*`, `data/offers/*`,
   `package.json`, `package-lock.json`, `niches/*`, `knowledge/*`. Tick commits to `data/items/` and the
   like then don't trigger builds.
4. **Variables** (Settings > Variables and secrets, Production): `NODE_VERSION` = `22`,
   `PUBLIC_GA4_ID` = your `G-…` ID. Optional: `PUBLIC_GSC_VERIFICATION` if you use the HTML-tag method.
5. **Custom domains**: add `yourcoffeesetup.com` and `www.yourcoffeesetup.com`.
6. **Redirect www to the root domain**: Rules > Redirect Rules > "Redirect from WWW to root" template
   (301, preserve path and query).

`site/public/_headers` adds security headers and `X-Robots-Tag: noindex` on every `*.pages.dev`
address, so only yourcoffeesetup.com gets indexed.

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
