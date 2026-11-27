import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { collectDemand, demandQueries, demandUsage, rotate } from '../demand/collect.mjs';

const niche = {
  markets: [{ id: 'US' }, { id: 'GB' }],
  focus: { products: ['m'], why: 'x' },
  demand: {
    querySuffixes: ['', ' problems'],
    maxQueries: 10,
    webSearch: { sites: ['forum.example', 'reddit.com/r/x'], maxQueries: 3, monthlyMax: 10 },
    youtube: { maxSearches: 1, videosPerSearch: 2, commentsPerVideo: 20 },
  },
};
const cards = new Map([['m', { card: { name: 'M', variants: [{ markets: ['US'], name: 'Brand M' }, { markets: ['GB'], name: 'Other M' }] } }]]);
const keys = { BRAVE_SEARCH_API_KEY: 'b', YOUTUBE_API_KEY: 'y' };

const fakeFetch = (calls = []) => async (url, options = {}) => {
  calls.push({ url, headers: options.headers ?? {} });
  const ok = (body) => ({ ok: true, json: async () => body });
  if (url.includes('suggestqueries')) return ok(['q', ['brand m grinder setting', 'brand m sour']]);
  if (url.includes('api.search.brave.com')) {
    const site = decodeURIComponent(url).match(/site:(\S+?)(&|$)/)[1];
    return ok({ web: { results: [
      { title: 'Shots <strong>too fast</strong>?', url: `https://www.${site}/t/1`, description: 'help', page_age: '2026-10-02T10:00:00', age: '1 month ago' },
      { title: 'Unrelated', url: 'https://elsewhere.example/a', description: 'x' },
    ] } });
  }
  if (url.includes('/youtube/v3/search')) return ok({ items: [{ id: { videoId: 'v1' }, snippet: { title: 'Dial in', publishedAt: '2026-01-05T00:00:00Z', channelTitle: 'C' } }, { id: { videoId: 'v2' }, snippet: { title: 'Clean', publishedAt: '2026-02-01T00:00:00Z' } }] });
  if (url.includes('commentThreads') && url.includes('videoId=v1')) {
    return ok({ items: [
      { snippet: { topLevelComment: { snippet: { textDisplay: 'Great video!', likeCount: 99 } } } },
      { snippet: { topLevelComment: { snippet: { textDisplay: 'Why is my shot sour at grind 5?', likeCount: 3, publishedAt: '2026-03-01T00:00:00Z' } } } },
      { snippet: { topLevelComment: { snippet: { textDisplay: 'How often should I descale', likeCount: 8 } } } },
    ] });
  }
  return { ok: false, status: 403 };
};

test('queries come from focus products per market and English seeds', () => {
  const q = demandQueries(niche, { cards, seeds: [{ id: 's1', text: 'Which grinder should I buy? (more)' }, { id: 's2', text: 'איזה מטחנה' }] });
  assert.deepEqual(q.map((x) => `${x.market}:${x.q}`), ['US:brand m', 'US:brand m problems', 'GB:other m', 'GB:other m problems', 'US:which grinder should i buy']);
});

test('rotate moves through the list day by day and never repeats within a run', () => {
  const list = ['a', 'b', 'c', 'd', 'e'];
  const day1 = rotate(list, 2, '2026-11-25');
  const day2 = rotate(list, 2, '2026-11-26');
  assert.equal(new Set(day1).size, 2);
  assert.notDeepEqual(day1, day2);
  assert.deepEqual(rotate(list, 9, '2026-11-25').length, 5);
  assert.deepEqual(rotate([], 3, '2026-11-25'), []);
});

test('collects autocomplete, community threads through web search, and YouTube questions', async () => {
  const calls = [];
  const result = await collectDemand(niche, { cards, fetchImpl: fakeFetch(calls), env: keys, today: '2026-11-25' });
  assert.equal(result.sources.autocomplete.ok, 4);
  assert.equal(result.queries[0].suggestions[0], 'brand m grinder setting');

  assert.equal(result.sources.web.ok, 3);
  assert.equal(result.web.length, 3);
  const thread = result.web[0].results[0];
  assert.equal(thread.title, 'Shots too fast?', 'HTML stripped');
  assert.equal(thread.date, '2026-10-02');
  assert.equal(result.web[0].results.length, 1, 'results off the site are dropped');
  const brave = calls.find((c) => c.url.includes('api.search.brave.com'));
  assert.equal(brave.headers['X-Subscription-Token'], 'b');
  assert.ok(!calls.some((c) => /reddit\.com|forum\.example/.test(new URL(c.url).host)), 'community sites are never fetched');

  assert.equal(result.sources.youtube.ok, 1);
  assert.equal(result.sources.youtube.units, 102);
  const [v1, v2] = result.youtube[0].videos;
  assert.deepEqual(v1.questions.map((x) => x.text), ['How often should I descale', 'Why is my shot sour at grind 5?'], 'questions only, most liked first');
  assert.match(v2.error, /403/, 'comments disabled is recorded, not fatal');
});

test('keyed sources are skipped without keys, stop on auth errors, and respect the monthly budget', async () => {
  const none = await collectDemand(niche, { cards, fetchImpl: fakeFetch(), env: {}, today: '2026-11-25' });
  assert.match(none.sources.web.skipped, /BRAVE_SEARCH_API_KEY/);
  assert.match(none.sources.youtube.skipped, /YOUTUBE_API_KEY/);

  const denied = await collectDemand(niche, { cards, fetchImpl: async (url) => (url.includes('suggestqueries') ? { ok: true, json: async () => ['q', []] } : { ok: false, status: 401 }), env: keys, today: '2026-11-25' });
  assert.equal(denied.sources.web.failed, 1, 'stops after the first auth error');
  assert.equal(denied.sources.youtube.failed, 1);

  const spent = await collectDemand(niche, { cards, fetchImpl: fakeFetch(), env: keys, today: '2026-11-25', usage: { web: 9, youtube: 59_950 } });
  assert.equal(spent.sources.web.ok, 1, 'only what is left of the monthly budget');
  assert.match(spent.sources.youtube.skipped, /budget/);
});

test('demandUsage counts this month\'s keyed searches from earlier collections', () => {
  const root = mkdtempSync(join(tmpdir(), 'demand-'));
  mkdirSync(join(root, 'data', 'demand'), { recursive: true });
  writeFileSync(join(root, 'data', 'demand', 'a.json'), JSON.stringify({ date: '2026-11-02', sources: { web: { ok: 5, failed: 1 }, youtube: { units: 303 } } }));
  writeFileSync(join(root, 'data', 'demand', 'b.json'), JSON.stringify({ date: '2026-10-30', sources: { web: { ok: 7 } } }));
  writeFileSync(join(root, 'data', 'demand', 'c.json'), 'not json');
  writeFileSync(join(root, 'data', 'demand', 'd.json'), JSON.stringify({ date: '2026-11-03', sources: { web: { ok: 3, failed: 1, byProvider: { tavily: 3, serper: 1 } }, questions: { provider: 'serper', ok: 4, failed: 0 } } }));
  assert.deepEqual(demandUsage(root, '2026-11'), { month: '2026-11', web: 10, youtube: 303, providers: { brave: 6, tavily: 3, serper: 5 } });
  assert.deepEqual(demandUsage(join(root, 'missing'), '2026-11'), { month: '2026-11', web: 0, youtube: 0, providers: {} });
});

test('question prefixes ask autocomplete how people start a problem', () => {
  const q = demandQueries({ ...niche, demand: { ...niche.demand, querySuffixes: [''], queryPrefixes: ['why is my '], maxQueries: 10 } }, { cards });
  assert.deepEqual(q.map((x) => `${x.market}:${x.q}`), ['US:brand m', 'US:why is my brand m', 'GB:other m', 'GB:why is my other m']);
});

const providerNiche = {
  ...niche,
  demand: {
    ...niche.demand,
    webSearch: { sites: ['forum.example', 'reddit.com/r/x'], maxQueries: 4, providers: ['tavily', 'serper', 'brave'] },
    searchBudgets: { tavily: 2, serper: 10, brave: 10 },
    peopleAlsoAsk: { maxQueries: 2 },
  },
};

function providerFetch(calls, { tavilyStatus } = {}) {
  return async (url, options = {}) => {
    const body = options.body ? JSON.parse(options.body) : null;
    calls.push({ url, headers: options.headers ?? {}, body });
    const ok = (data) => ({ ok: true, json: async () => data });
    if (url.includes('suggestqueries')) return ok(['q', []]);
    if (url.includes('api.tavily.com')) {
      if (tavilyStatus) return { ok: false, status: tavilyStatus };
      const domain = body.include_domains[0];
      return ok({ results: [{ title: 'Grind <b>help</b>', url: `https://${domain}/r/x/comments/1`, content: 'sour shots', published_date: '2026-09-01T00:00:00Z' }, { title: 'Other sub', url: `https://${domain}/r/y/2`, content: 'x' }] });
    }
    if (url.includes('google.serper.dev')) {
      if (body.q.includes('site:')) {
        const site = body.q.split('site:')[1];
        return ok({ organic: [{ title: 'Thread', link: `https://www.${site}/t/9`, snippet: 'channeling', date: '3 weeks ago' }] });
      }
      return ok({ peopleAlsoAsk: [{ question: 'Why is my espresso sour?', snippet: 'Under-extracted', link: 'https://a.example/x' }], relatedSearches: [{ query: 'brand m sour shots' }] });
    }
    return { ok: false, status: 403 };
  };
}

test('web search uses the first provider with a key and budget, then falls back; Serper adds People also ask', async () => {
  const calls = [];
  const env = { TAVILY_API_KEY: 't', SERPER_API_KEY: 's' };
  const result = await collectDemand(providerNiche, { cards, fetchImpl: providerFetch(calls), env, today: '2026-11-25' });
  assert.equal(result.sources.web.ok, 4);
  assert.deepEqual(result.sources.web.byProvider, { tavily: 2, serper: 2 }, 'tavily until its budget is used, then serper');
  const tavily = calls.find((c) => c.url.includes('tavily'));
  assert.equal(tavily.headers.Authorization, 'Bearer t');
  const redditTavily = result.web.find((w) => w.provider === 'tavily' && w.site === 'reddit.com/r/x');
  if (redditTavily) assert.deepEqual(redditTavily.results.map((r) => r.url), ['https://reddit.com/r/x/comments/1'], 'only the subreddit asked for');
  const serperThread = result.web.find((w) => w.provider === 'serper').results[0];
  assert.deepEqual([serperThread.date, serperThread.age], [null, '3 weeks ago']);

  assert.equal(result.sources.questions.ok, 2);
  assert.equal(result.questions[0].questions[0].question, 'Why is my espresso sour?');
  assert.deepEqual(result.questions[0].related, ['brand m sour shots']);
  assert.ok(!calls.some((c) => /reddit\.com|forum\.example/.test(new URL(c.url).host)), 'community sites are never fetched');
});

test('a provider out of credit hands the same query to the next one', async () => {
  const calls = [];
  const env = { TAVILY_API_KEY: 't', SERPER_API_KEY: 's' };
  const result = await collectDemand({ ...providerNiche, demand: { ...providerNiche.demand, peopleAlsoAsk: undefined } }, { cards, fetchImpl: providerFetch(calls, { tavilyStatus: 432 }), env, today: '2026-11-25' });
  assert.equal(calls.filter((c) => c.url.includes('tavily')).length, 1, 'tavily is not asked again after refusing');
  assert.equal(result.sources.web.ok, 4);
  assert.equal(result.sources.web.failed, 1);
  assert.match(result.sources.web.error, /tavily: HTTP 432/);
  assert.match(result.sources.questions.skipped, /peopleAlsoAsk/);
});

test('budgets come from earlier collections this month', async () => {
  const env = { TAVILY_API_KEY: 't', SERPER_API_KEY: 's' };
  const spent = await collectDemand(providerNiche, { cards, fetchImpl: providerFetch([]), env, today: '2026-11-25', usage: { web: 0, youtube: 0, providers: { tavily: 2, serper: 10 } } });
  assert.match(spent.sources.web.skipped, /budget reached/);
  assert.match(spent.sources.questions.skipped, /serper budget/);
});
