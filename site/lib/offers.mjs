// Offers (rebuild-spec 6.4): data/offers/<productId>.json. The site never shows a price older
// than maxAgeHours; a stale price is hidden and the button kept.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const DEFAULT_MAX_AGE_HOURS = 48;

export function loadOffers(dir) {
  const offers = new Map();
  if (!dir || !existsSync(dir)) return offers;
  for (const name of readdirSync(dir).filter((n) => n.endsWith('.json'))) {
    const data = JSON.parse(readFileSync(join(dir, name), 'utf8'));
    offers.set(data.productId, data);
  }
  return offers;
}

/** Offers for one product in one market, newest first, with `showPrice` decided. */
export function offersFor(offers, productId, market, { now = Date.now(), maxAgeHours = DEFAULT_MAX_AGE_HOURS } = {}) {
  const data = offers.get(productId);
  if (!data) return [];
  return data.variants
    .filter((variant) => variant.market === market)
    .flatMap((variant) => variant.offers.map((offer) => ({ ...offer, sku: variant.sku })))
    .filter((offer) => offer.linkOk !== false)
    .map((offer) => {
      const ageHours = (now - Date.parse(offer.checkedAt)) / 3_600_000;
      return { ...offer, ageHours, showPrice: Number.isFinite(ageHours) && ageHours <= maxAgeHours && offer.availability !== 'out_of_stock' };
    })
    .sort((a, b) => a.ageHours - b.ageHours);
}

export function formatPrice(price, currency, locale) {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(price);
}

const MOCK_SELLERS = [
  ['mock-marketplace', 'Mock marketplace'],
  ['mock-brand-store', 'Mock brand store'],
  ['mock-specialty-shop', 'Mock specialty shop'],
];

/**
 * Mock offers for previews: clearly labelled sellers (three per product, like a real page), recent
 * timestamps, and one stale market per odd product so the stale-price rule is visible. `prices`
 * ({ productId: { US: 299.95 } }) keeps mock prices in line with the guides; others are generated.
 */
export function mockOffers(productIds, markets, { now = Date.now(), prices = {} } = {}) {
  const offers = new Map();
  productIds.forEach((productId, index) => {
    const variants = markets.map((market, m) => {
      const generated = 150 + ((index * 37) % 250);
      const price = prices[productId]?.[market.id] ?? (m === 0 ? generated + 0.95 : Math.round(generated * 0.85) + 0.99);
      const stale = m > 0 && index % 2 === 1;
      return {
        market: market.id,
        sku: `${productId}-${market.id.toLowerCase()}`,
        offers: MOCK_SELLERS.map(([seller, name], s) => ({
          seller: `${seller}-${market.id.toLowerCase()}`,
          sellerName: `${name} (${market.id})`,
          type: 'affiliate',
          url: '#mock-offer',
          price,
          currency: market.currency,
          availability: 'in_stock',
          checkedAt: new Date(now - (stale ? 72 + s : 3 + index + s * 2) * 3_600_000).toISOString(),
          matchConfidence: 'high',
          linkOk: true,
          mock: true,
        })),
      };
    });
    offers.set(productId, { productId, variants });
  });
  return offers;
}
