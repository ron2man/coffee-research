// Posts are written once for every market. Products are named with tokens that resolve per
// market from knowledge-card variants: {{product:id}} → that market's name, {{model:id}} → its
// SKU, {{brand:id}} → its brand. {{guide:slug|text}} links to another guide.
// Used by the site (rendering) and the writer checks (title length per market).

/** cards: Map(productId → { card }). */
function variantFor(card, market) {
  return card?.variants.find((v) => v.markets.includes(market.id)) ?? null;
}

export function productName(cards, market, productId) {
  const card = cards.get(productId)?.card;
  return variantFor(card, market)?.name ?? card?.variants.find((v) => v.name)?.name ?? card?.name ?? productId;
}

/** guideLink(slug, text) returns the replacement for a guide token (default: the text). */
export function resolveTokens(text, { cards, market, guideLink = (slug, label) => label }) {
  if (!text) return text;
  return text
    .replace(/\{\{product:([a-z0-9-]+)\}\}/g, (_, id) => productName(cards, market, id))
    .replace(/\{\{model:([a-z0-9-]+)\}\}/g, (_, id) => {
      const card = cards.get(id)?.card;
      return variantFor(card, market)?.sku ?? card?.variants[0]?.sku ?? '';
    })
    .replace(/\{\{brand:([a-z0-9-]+)\}\}/g, (_, id) => {
      const card = cards.get(id)?.card;
      return variantFor(card, market)?.brand ?? card?.brand ?? 'the manufacturer';
    })
    .replace(/\{\{guide:([a-z0-9-]+)(?:\|([^}]*))?\}\}/g, (_, slug, label) => guideLink(slug, label ?? slug.replace(/-/g, ' ')));
}

/** Guide slugs a text links to. */
export const guideSlugs = (text) => [...(text ?? '').matchAll(/\{\{guide:([a-z0-9-]+)(?:\|([^}]*))?\}\}/g)].map((m) => ({ slug: m[1], text: m[2] ?? null }));
