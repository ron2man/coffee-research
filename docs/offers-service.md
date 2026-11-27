# Offers service (separate project)

Status: proposal, 2026-11-23. Owner: project lead. Not part of this repo: a small backend that owns everything affiliate, so the content system only knows product IDs.

## Why separate

- Affiliate programs, credentials, price data and their terms change on their own schedule; content shouldn't need a PR every time a price moves (the open question about `data/offers/` being a public path goes away).
- One place to enforce program rules (how long a price may be shown, which programs allow caching, which markets).
- Click analytics in one place, independent of GA4 consent and ad blockers.

## What the content system sends and gets

The content system only knows **product IDs** (knowledge card IDs, e.g. `barista-pro`) and **markets** (`US`, `GB`). The service maps them to retailer listings.

### `GET /v1/offers?ids=barista-pro,baratza-encore-esp&market=US`

```json
{
  "market": "US",
  "currency": "USD",
  "generatedAt": "2026-11-23T08:00:00Z",
  "products": {
    "barista-pro": {
      "status": "ok",
      "offers": [{
        "offerId": "o_8f3k2",
        "seller": "amazon-us",
        "sellerName": "Amazon",
        "price": 749.95,
        "checkedAt": "2026-11-23T07:12:00Z",
        "availability": "in_stock",
        "showPrice": true,
        "link": "https://go.yourcoffeesetup.com/r/o_8f3k2"
      }]
    },
    "baratza-encore-esp": { "status": "not_sold_in_market", "offers": [] }
  }
}
```

- `showPrice` is decided by the service under each program's terms (age limits, caching rules). The site shows the price only when it's true, and always keeps the button.
- `status`: `ok`, `no_listing`, `not_sold_in_market`, `unmatched` (listing found, match not confirmed).
- `link` never contains the affiliate tag: it points to the service's redirect.

### `GET /r/<offerId>?page=<slug>&pos=<pick|pricebox|tool>&mkt=US`

Logs the click (offer, product, seller, market, page, position, time, country from IP, no personal data stored), then `302`s to the retailer with the affiliate tag added server-side. Unknown or retired offers redirect to the product's retailer search page, never 404.

### `GET /v1/stats?from=&to=`

Clicks by page, product, seller, market and position, plus conversions and revenue when program reports are imported. This feeds the dashboard's Money view (spec section 9, view 6).

## Inside the service

- **Catalog:** product ID → per market: retailer listing IDs (ASIN, SKU), match confidence, who confirmed the match.
- **Programs:** per market: program, tag, credentials, terms (price display rules, caching window), status. Secrets live in the service's environment only.
- **Refresher:** a scheduled job pulls prices and availability through each program's API (for example Amazon's product data API; check which one the program currently offers), checks links, flags low-confidence matches for a human.
- **Click log and report import:** the redirect log, plus CSV or API imports of program reports for conversions.

## How this repo uses it

- Build time: the site calls `GET /v1/offers` for the product IDs in each guide's `offerIds`, per market (`OFFERS_API_URL`). Without it (previews, tests), mock offers are used as today.
- `data/offers/` is retired, so prices no longer pass through Git or PRs.
- A refresh doesn't need a content deploy if the site later fetches prices client-side or at the edge; start with build time.
- The dashboard reads `/v1/stats` for the Money view.

## Open questions for the lead

1. Hosting: Cloudflare Workers (next to the site, with D1/KV for catalog and click log) is the natural fit.
2. Programs to start with per market, and their terms on showing and caching prices.
3. Redirect domain: `go.yourcoffeesetup.com`?
