// Text shown in every market (posts, tools) must not name one market's brand or the market itself.
// Products are named with tokens ({{product:id}}, {{brand:id}}) that the site fills in per market.

/** Brands that differ between a card's variants: writing one of them names a market. */
export function marketBrands(cards, productIds = [...cards.keys()]) {
  const brands = new Map(); // brand → product id
  for (const id of productIds) {
    const variants = cards.get(id)?.card?.variants ?? [];
    const names = new Set(variants.map((v) => v.brand).filter(Boolean));
    if (names.size > 1) for (const brand of names) if (!brands.has(brand)) brands.set(brand, id);
  }
  return brands;
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Tokens, link targets and code are not reader text.
const readerText = (text) => (text ?? '')
  .replace(/\{\{[^}]*\}\}/g, ' ')
  .replace(/\]\([^)]*\)/g, ']')
  .replace(/`[^`]*`/g, ' ');

/**
 * Market-specific words in text: [{ word, kind: 'brand' | 'market' | 'price', productId?, marketId?, excerpt }].
 * markets: niche markets, each with optional `names`.
 */
export function marketWords(text, { cards = new Map(), productIds, markets = [] } = {}) {
  const plain = readerText(text);
  const found = [];
  const look = (word, extra) => {
    const match = new RegExp(`(?<![\\w.])${escapeRe(word)}(?![\\w])`).exec(plain);
    if (match) found.push({ word, ...extra, excerpt: plain.slice(Math.max(0, match.index - 30), match.index + word.length + 30).replace(/\s+/g, ' ').trim() });
  };
  for (const [brand, productId] of marketBrands(cards, productIds)) look(brand, { kind: 'brand', productId });
  for (const market of markets) for (const name of market.names ?? []) look(name, { kind: 'market', marketId: market.id });
  // A price in one currency is only right in one market.
  const price = /(?:[$£€¥]\s?\d|\d\s?(?:USD|GBP|EUR)\b)/.exec(plain);
  if (price) found.push({ word: price[0], kind: 'price', excerpt: plain.slice(Math.max(0, price.index - 30), price.index + 30).replace(/\s+/g, ' ').trim() });
  return found;
}

/** The part of a post body before its sources section, where sources may be named as they are. */
export const bodyBeforeSources = (body) => (body ?? '').split(/^#+\s*How this guide was put together.*$/im)[0];
