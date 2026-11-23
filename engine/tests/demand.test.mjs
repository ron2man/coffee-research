import test from 'node:test';
import assert from 'node:assert/strict';
import { collectDemand, demandQueries } from '../demand/collect.mjs';

const niche = {
  markets: [{ id: 'US' }, { id: 'GB' }],
  focus: { products: ['m'], why: 'x' },
  demand: { subreddits: ['espresso'], querySuffixes: ['', ' problems'], maxQueries: 10 },
};
const cards = new Map([['m', { card: { name: 'M', variants: [{ markets: ['US'], name: 'Brand M' }, { markets: ['GB'], name: 'Other M' }] } }]]);

test('queries come from focus products per market and English seeds', () => {
  const q = demandQueries(niche, { cards, seeds: [{ id: 's1', text: 'Which grinder should I buy? (more)' }, { id: 's2', text: 'איזה מטחנה' }] });
  assert.deepEqual(q.map((x) => `${x.market}:${x.q}`), ['US:brand m', 'US:brand m problems', 'GB:other m', 'GB:other m problems', 'US:which grinder should i buy']);
});

test('collects autocomplete and Reddit posts, and records blocked sources instead of failing', async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    if (url.includes('suggestqueries')) return { ok: true, json: async () => ['q', ['brand m grinder setting', 'brand m sour']] };
    if (url.includes('access_token')) return { ok: true, json: async () => ({ access_token: 't' }) };
    if (url.includes('oauth.reddit.com')) return { ok: true, json: async () => ({ data: { children: [{ data: { title: 'Shots too fast?', permalink: '/r/espresso/comments/1/x/', created_utc: 1790000000, num_comments: 12, score: 30, selftext: 'help' } }] } }) };
    return { ok: false, status: 403 };
  };
  const result = await collectDemand(niche, { cards, fetchImpl, env: { REDDIT_CLIENT_ID: 'a', REDDIT_CLIENT_SECRET: 'b' } });
  assert.equal(result.sources.autocomplete.ok, 4);
  assert.equal(result.sources.reddit.mode, 'api');
  assert.equal(result.reddit[0].posts[0].url, 'https://www.reddit.com/r/espresso/comments/1/x/');
  assert.equal(result.queries[0].suggestions[0], 'brand m grinder setting');

  const blocked = await collectDemand(niche, { cards, fetchImpl: async (url) => (url.includes('suggestqueries') ? { ok: true, json: async () => ['q', []] } : { ok: false, status: 403 }), env: {} });
  assert.equal(blocked.sources.reddit.mode, 'public-json');
  assert.equal(blocked.sources.reddit.failed, 1, 'stops after the first block');
  assert.match(blocked.sources.reddit.error, /403/);
});
