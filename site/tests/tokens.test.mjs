// Posts are written once for every market; product names resolve per market from the cards.
import test from 'node:test';
import assert from 'node:assert/strict';
import { localize, productName, resolveTokens } from '../lib/templates.mjs';

const card = { name: 'Barista Express', variants: [
  { id: 'us', markets: ['US'], name: 'Breville Barista Express', brand: 'Breville', sku: 'BES870XL' },
  { id: 'gb', markets: ['GB'], name: 'Sage the Barista Express', brand: 'Sage', sku: 'SES875' },
] };
const US = { id: 'US', locale: 'en-us' };
const GB = { id: 'GB', locale: 'en-gb' };
const site = { cards: new Map([['barista-express', { card }]]), pages: new Set(['/en-gb/guides/other/']) };

test('product, model and brand tokens resolve per market', () => {
  const text = 'Your {{product:barista-express}} ({{model:barista-express}}), per {{brand:barista-express}}.';
  assert.equal(resolveTokens(text, { site, market: US }), 'Your Breville Barista Express (BES870XL), per Breville.');
  assert.equal(resolveTokens(text, { site, market: GB }), 'Your Sage the Barista Express (SES875), per Sage.');
  assert.equal(productName(site, { id: 'DE' }, 'barista-express'), 'Breville Barista Express', 'falls back to a named variant');
});

test('guide links render only when the guide is built; titles never carry link syntax', () => {
  assert.equal(resolveTokens('See {{guide:other|this guide}}.', { site, market: GB }), 'See [this guide](/en-gb/guides/other/).');
  assert.equal(resolveTokens('See {{guide:missing|that guide}}.', { site, market: GB }), 'See that guide.');
  const post = localize({ title: 'Fix your {{product:barista-express}}', description: 'd', body: 'b' }, site, GB);
  assert.equal(post.title, 'Fix your Sage the Barista Express');
});

test('the pick and the PriceBox come from offerIds, never from the products discussed', async () => {
  const { postPage } = await import('../lib/templates.mjs');
  const market = { id: 'US', locale: 'en-us', language: 'en' };
  const s = { ...site, markets: [market], tools: new Map(), disclosure: () => 'Disclosure.' };
  const post = { slug: 'p', title: 'Fix your {{product:barista-express}}', description: 'd', type: 'Guide', status: 'draft',
    body: 'Keep your {{product:barista-express}}.\n\n## When I’d choose differently\n\nBuy a grinder.', productIds: ['barista-express'], offerIds: [], humanData: [] };
  const html = postPage({ site: s, market, post, offers: new Map(), now: Date.now() });
  assert.doesNotMatch(html, /Our pick/);
  assert.doesNotMatch(html, /Where to buy/);
  assert.match(html, /Fix your Breville Barista Express/);
});

test('page title prefers the SEO title and drops the site name when it would not fit', async () => {
  const { pageTitle } = await import('../lib/templates.mjs');
  assert.equal(pageTitle({ title: 'Short title' }, 'YourCoffeeSetup'), 'Short title | YourCoffeeSetup');
  assert.equal(pageTitle({ title: 'A very long title that goes on', seoTitle: 'Fast shots on a Barista Express: what to check' }, 'YourCoffeeSetup'), 'Fast shots on a Barista Express: what to check');
});
