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

/**
 * Mock offers for previews: clearly labelled sellers, recent timestamps, one stale offer per
 * product in the secondary market so the stale-price rule is visible.
 */
export function mockOffers(productIds, markets, { now = Date.now() } = {}) {
  const offers = new Map();
  productIds.forEach((productId, index) => {
    const variants = markets.map((market, m) => {
      const base = 150 + ((index * 37) % 250);
      const stale = m > 0 && index % 2 === 1;
      return {
        market: market.id,
        sku: `${productId}-${market.id.toLowerCase()}`,
        offers: [{
          seller: `mock-retailer-${market.id.toLowerCase()}`,
          sellerName: `Mock retailer (${market.id})`,
          type: 'affiliate',
          url: '#mock-offer',
          price: m === 0 ? base + 0.95 : Math.round(base * 0.85) + 0.99,
          currency: market.currency,
          availability: 'in_stock',
          checkedAt: new Date(now - (stale ? 72 : 3 + index) * 3_600_000).toISOString(),
          matchConfidence: 'high',
          linkOk: true,
          mock: true,
        }],
      };
    });
    offers.set(productId, { productId, variants });
  });
  return offers;
}
