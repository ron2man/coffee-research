// Demand collection: real data, no AI, gathered by the scheduler before the idea agent runs.
//  - Search autocomplete per market: how people actually phrase searches (not volumes).
//  - Web search restricted to the niche's community sites (forums, subreddits) through a search
//    API: Tavily (TAVILY_API_KEY, free monthly credits), Serper (SERPER_API_KEY, Google results,
//    one-time free credits) or Brave (BRAVE_SEARCH_API_KEY), in the order niche.json lists them,
//    falling back to the next when one is out of credit. The community pages themselves are never
//    fetched: we keep the search engine's title, URL, date and snippet. This is how forum and Reddit
//    threads reach the idea agent now that Reddit's API, JSON and RSS are closed to new projects.
//  - "People also ask" questions and related searches from Google results (Serper): the questions
//    Google itself groups around a query.
//  - YouTube: videos for the focus products and the questions owners leave in their comments
//    (YouTube Data API, YOUTUBE_API_KEY).
// Every source reports what worked, what failed and what was skipped, so a gap is visible.
// Keyed sources stay within a monthly budget counted from earlier collections in data/demand/.
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { productName } from '../state/tokens.mjs';

const UA = 'research-engine/1.0 (site owner research; low volume)';
const isAscii = (text) => /^[\x20-\x7E]+$/.test(text);
const clip = (text, n = 280) => String(text ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, n);

// YouTube Data API quota costs (units): search.list 100, commentThreads.list 1. Daily quota 10,000.
const YT_SEARCH_UNITS = 100;
const YT_COMMENTS_UNITS = 1;

/** Search phrases to look up: focus products per market, plus English seeds. */
export function demandQueries(niche, { cards, seeds = [] }) {
  const suffixes = niche.demand?.querySuffixes ?? [''];
  const prefixes = niche.demand?.queryPrefixes ?? [];
  const max = niche.demand?.maxQueries ?? 24;
  const queries = [];
  for (const productId of niche.focus?.products ?? []) {
    for (const market of niche.markets) {
      const name = productName(cards, market, productId).toLowerCase();
      for (const suffix of suffixes) queries.push({ market: market.id, q: `${name}${suffix}`, source: `focus:${productId}` });
      // Question openings ("why is my <product>"): autocomplete then completes the problems people type.
      for (const prefix of prefixes) queries.push({ market: market.id, q: `${prefix.trim()} ${name}`, source: `focus:${productId}` });
    }
  }
  for (const seed of seeds) {
    const text = seed.text.split(/[?.!(]/)[0].trim();
    if (isAscii(text)) queries.push({ market: niche.markets[0].id, q: text.split(/\s+/).slice(0, 8).join(' ').toLowerCase(), source: `seed:${seed.id}` });
  }
  const seen = new Set();
  return queries.filter((x) => !seen.has(`${x.market}:${x.q}`) && seen.add(`${x.market}:${x.q}`)).slice(0, max);
}

/** Take `count` items from `list`, starting at an offset that moves every day, so runs cover different combinations over time. */
export function rotate(list, count, today) {
  if (!list.length || count <= 0) return [];
  const day = Math.floor(Date.parse(`${today}T00:00:00Z`) / 86_400_000);
  const start = ((day * count) % list.length + list.length) % list.length;
  return Array.from({ length: Math.min(count, list.length) }, (_, i) => list[(start + i) % list.length]);
}

/**
 * Keyed-source usage this month, from earlier collections:
 * { web: community searches, youtube: units, providers: { <search provider>: requests } }.
 */
export function demandUsage(root, month = new Date().toISOString().slice(0, 7)) {
  const dir = join(root, 'data', 'demand');
  const usage = { month, web: 0, youtube: 0, providers: {} };
  if (!existsSync(dir)) return usage;
  const add = (id, n) => { if (n) usage.providers[id] = (usage.providers[id] ?? 0) + n; };
  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.json')) continue;
    try {
      const data = JSON.parse(readFileSync(join(dir, file), 'utf8'));
      if (!String(data.date ?? '').startsWith(month)) continue;
      const web = data.sources?.web ?? {};
      usage.web += (web.ok ?? 0) + (web.failed ?? 0);
      if (web.byProvider) for (const [id, n] of Object.entries(web.byProvider)) add(id, n);
      else add('brave', (web.ok ?? 0) + (web.failed ?? 0)); // collections before providers were Brave only
      const questions = data.sources?.questions ?? {};
      add(questions.provider ?? 'serper', (questions.ok ?? 0) + (questions.failed ?? 0));
      usage.youtube += data.sources?.youtube?.units ?? 0;
    } catch { /* a broken file doesn't block collection */ }
  }
  return usage;
}

async function getJson(fetchImpl, url, options = {}) {
  const response = await fetchImpl(url, { ...options, headers: { 'User-Agent': UA, ...(options.headers ?? {}) }, signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

export async function autocomplete(fetchImpl, { q, market }) {
  const url = `https://suggestqueries.google.com/complete/search?client=firefox&hl=en&gl=${market.toLowerCase()}&q=${encodeURIComponent(q)}`;
  const data = await getJson(fetchImpl, url);
  return (data?.[1] ?? []).filter((s) => s.toLowerCase() !== q.toLowerCase()).slice(0, 10);
}

const bareSite = (site) => site.replace(/^www\./, '');
const onSite = (site) => (r) => r.url && r.url.replace(/^https?:\/\/(www\.|old\.)?/, '').startsWith(bareSite(site));
const thread = ({ title, url, date, age, excerpt }) => ({ title: clip(title, 200), url, date: date ? String(date).slice(0, 10) : null, age: age ?? null, excerpt: clip(excerpt) });

/** Brave Search API: `<q> site:<site>`. */
async function braveSearch(fetchImpl, { q, site, key, country }) {
  const query = `${q} site:${site}`;
  const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=10&freshness=py&country=${country.toLowerCase()}&search_lang=en&safesearch=moderate`;
  const data = await getJson(fetchImpl, url, { headers: { Accept: 'application/json', 'X-Subscription-Token': key } });
  return (data?.web?.results ?? []).filter(onSite(site))
    .map((r) => thread({ title: r.title, url: r.url, date: r.page_age, age: r.age, excerpt: [r.description, ...(r.extra_snippets ?? [])].join(' ') }));
}

/** Tavily: domain filter plus the site's path (a subreddit) as words in the query; results are re-filtered to the site. */
async function tavilySearch(fetchImpl, { q, site, key }) {
  const [domain, ...path] = bareSite(site).split('/');
  const body = { query: path.length ? `${q} ${path.join('/')}` : q, include_domains: [domain], search_depth: 'basic', max_results: 10, time_range: 'year', topic: 'general' };
  const data = await getJson(fetchImpl, 'https://api.tavily.com/search', { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return (data?.results ?? []).filter(onSite(site))
    .map((r) => thread({ title: r.title, url: r.url, date: r.published_date, excerpt: r.content }));
}

/** Serper (Google results): `<q> site:<site>`, past year. Google gives relative dates ("3 weeks ago"), kept as `age`. */
async function serperSearch(fetchImpl, { q, site, key, country }) {
  const body = { q: `${q} site:${site}`, gl: country.toLowerCase(), hl: 'en', num: 10, tbs: 'qdr:y' };
  const data = await getJson(fetchImpl, 'https://google.serper.dev/search', { method: 'POST', headers: { 'X-API-KEY': key, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return (data?.organic ?? []).map((r) => ({ ...r, url: r.link })).filter(onSite(site))
    .map((r) => thread({ title: r.title, url: r.url, age: r.date ?? null, excerpt: r.snippet }));
}

/** Search providers in the order of preference niche.json gives; each needs its key in the environment. */
export const SEARCH_PROVIDERS = {
  tavily: { env: 'TAVILY_API_KEY', search: tavilySearch },
  serper: { env: 'SERPER_API_KEY', search: serperSearch },
  brave: { env: 'BRAVE_SEARCH_API_KEY', search: braveSearch },
};

/** One web search limited to a site. Returns search-engine metadata only. */
export async function webSearch(fetchImpl, { q, site, key, country = 'us', provider = 'brave' }) {
  return SEARCH_PROVIDERS[provider].search(fetchImpl, { q, site, key, country });
}

/** Google's "People also ask" questions and related searches for a query (Serper). */
export async function peopleAlsoAsk(fetchImpl, { q, key, country = 'us' }) {
  const data = await getJson(fetchImpl, 'https://google.serper.dev/search', { method: 'POST', headers: { 'X-API-KEY': key, 'Content-Type': 'application/json' }, body: JSON.stringify({ q, gl: country.toLowerCase(), hl: 'en', num: 10 }) });
  return {
    questions: (data?.peopleAlsoAsk ?? []).map((x) => ({ question: clip(x.question, 200), answerSnippet: clip(x.snippet), url: x.link ?? null })).filter((x) => x.question),
    related: (data?.relatedSearches ?? []).map((x) => clip(x.query, 120)).filter(Boolean).slice(0, 10),
  };
}

// Errors that mean "this provider can't serve more today" (bad key, no credit, rate limit): use the next one.
const EXHAUSTED = /HTTP (400|401|402|403|429|432|433)/;

const QUESTION = /\?|^(how|why|what|which|is|are|can|does|do|should|any|my|mine|i can't|i cant|help)\b/i;

/** Videos for a query and the question-like comments under them (YouTube Data API). */
export async function youtubeQuestions(fetchImpl, { q, key, videos = 3, comments = 50, keep = 10, country = 'US' }) {
  const api = 'https://www.googleapis.com/youtube/v3';
  const search = await getJson(fetchImpl, `${api}/search?part=snippet&type=video&order=relevance&relevanceLanguage=en&regionCode=${country}&maxResults=${videos}&q=${encodeURIComponent(q)}&key=${key}`);
  let units = YT_SEARCH_UNITS;
  const out = [];
  for (const item of search?.items ?? []) {
    const id = item.id?.videoId;
    if (!id) continue;
    const video = { title: clip(item.snippet?.title, 200), url: `https://www.youtube.com/watch?v=${id}`, date: String(item.snippet?.publishedAt ?? '').slice(0, 10) || null, channel: clip(item.snippet?.channelTitle, 100), questions: [], error: null };
    try {
      units += YT_COMMENTS_UNITS;
      const threads = await getJson(fetchImpl, `${api}/commentThreads?part=snippet&videoId=${id}&order=relevance&maxResults=${comments}&textFormat=plainText&key=${key}`);
      video.questions = (threads?.items ?? [])
        .map((t) => t.snippet?.topLevelComment?.snippet)
        .filter((c) => c?.textDisplay && QUESTION.test(c.textDisplay.trim()))
        .map((c) => ({ text: clip(c.textDisplay), likes: c.likeCount ?? 0, replies: 0, date: String(c.publishedAt ?? '').slice(0, 10) || null }))
        .sort((a, b) => b.likes - a.likes)
        .slice(0, keep);
    } catch (error) {
      video.error = error.message; // comments disabled on a video is common (403)
    }
    out.push(video);
  }
  return { videos: out, units };
}

/** Collect demand data. Never throws: failures are recorded per source. */
export async function collectDemand(niche, { cards, seeds = [], fetchImpl = fetch, env = process.env, today = new Date().toISOString().slice(0, 10), usage = { web: 0, youtube: 0, providers: {} } } = {}) {
  const queries = demandQueries(niche, { cards, seeds });
  const first = niche.markets[0].id;
  const englishQueries = [...new Set(queries.filter((x) => x.market === first).map((x) => x.q))];
  const result = {
    date: today,
    queries: [],
    web: [],
    questions: [],
    youtube: [],
    sources: {
      autocomplete: { ok: 0, failed: 0 },
      web: { ok: 0, failed: 0, error: null, skipped: null },
      questions: { provider: 'serper', ok: 0, failed: 0, error: null, skipped: null },
      youtube: { ok: 0, failed: 0, units: 0, error: null, skipped: null },
    },
  };

  for (const query of queries) {
    try {
      result.queries.push({ ...query, suggestions: await autocomplete(fetchImpl, query) });
      result.sources.autocomplete.ok += 1;
    } catch (error) {
      result.sources.autocomplete.failed += 1;
      result.sources.autocomplete.error = error.message;
    }
  }

  // Search providers: monthly budgets per provider, shared by every use in this collection.
  const web = niche.demand?.webSearch;
  const budgets = niche.demand?.searchBudgets ?? {};
  const used = { ...(usage.providers ?? { brave: usage.web ?? 0 }) };
  const room = (id) => Math.max(0, (budgets[id] ?? web?.monthlyMax ?? 900) - (used[id] ?? 0));
  const dead = new Set();
  const spend = (id) => { used[id] = (used[id] ?? 0) + 1; };

  // Community threads through web search.
  const webState = result.sources.web;
  webState.byProvider = {};
  const order = (web?.providers ?? Object.keys(SEARCH_PROVIDERS)).filter((id) => SEARCH_PROVIDERS[id]);
  const keyed = order.filter((id) => env[SEARCH_PROVIDERS[id].env]);
  const nextProvider = () => keyed.find((id) => !dead.has(id) && room(id) > 0);
  if (!web?.sites?.length) webState.skipped = 'no demand.webSearch.sites in niche.json';
  else if (!keyed.length) webState.skipped = `no search API key set (${order.map((id) => SEARCH_PROVIDERS[id].env).join(', ')})`;
  else {
    const pairs = englishQueries.flatMap((q) => web.sites.map((site) => ({ q, site })));
    const capacity = keyed.reduce((sum, id) => sum + room(id), 0);
    const picked = rotate(pairs, Math.min(web.maxQueries ?? 8, capacity), today);
    if (!picked.length) webState.skipped = capacity ? 'no queries' : 'monthly search budget reached for every provider';
    for (const { q, site } of picked) {
      let provider = nextProvider();
      while (provider) {
        spend(provider);
        webState.byProvider[provider] = (webState.byProvider[provider] ?? 0) + 1;
        try {
          result.web.push({ site, q, provider, results: await webSearch(fetchImpl, { q, site, key: env[SEARCH_PROVIDERS[provider].env], country: first, provider }) });
          webState.ok += 1;
          break;
        } catch (error) {
          webState.failed += 1;
          webState.error = `${provider}: ${error.message}`;
          if (!EXHAUSTED.test(error.message)) break; // a one-off failure: move on to the next query
          dead.add(provider); // out of credit or bad key: try this query with the next provider
          provider = nextProvider();
        }
      }
      if (!provider) break;
    }
  }

  // "People also ask" and related searches (Serper only: Google's own question boxes).
  const paa = niche.demand?.peopleAlsoAsk;
  const paaState = result.sources.questions;
  if (!paa) paaState.skipped = 'no demand.peopleAlsoAsk in niche.json';
  else if (!env.SERPER_API_KEY) paaState.skipped = 'SERPER_API_KEY not set';
  else if (dead.has('serper')) paaState.skipped = 'serper refused earlier in this collection';
  else {
    const picked = rotate(englishQueries, Math.min(paa.maxQueries ?? 4, room('serper')), today);
    if (!picked.length) paaState.skipped = room('serper') ? 'no queries' : 'monthly serper budget reached';
    for (const q of picked) {
      spend('serper');
      try {
        result.questions.push({ q, ...(await peopleAlsoAsk(fetchImpl, { q, key: env.SERPER_API_KEY, country: first })) });
        paaState.ok += 1;
      } catch (error) {
        paaState.failed += 1;
        paaState.error = error.message;
        if (EXHAUSTED.test(error.message)) break;
      }
    }
  }

  // YouTube videos and the questions in their comments.
  const yt = niche.demand?.youtube;
  const ytState = result.sources.youtube;
  if (!yt) ytState.skipped = 'no demand.youtube in niche.json';
  else if (!env.YOUTUBE_API_KEY) ytState.skipped = 'YOUTUBE_API_KEY not set';
  else {
    const perSearch = YT_SEARCH_UNITS + (yt.videosPerSearch ?? 3) * YT_COMMENTS_UNITS;
    const room = Math.max(0, (yt.monthlyUnits ?? 60_000) - (usage.youtube ?? 0));
    const count = Math.min(yt.maxSearches ?? 3, Math.floor(room / perSearch));
    const picked = rotate(englishQueries, count, today);
    if (!picked.length) ytState.skipped = room >= perSearch ? 'no queries' : 'monthly budget reached';
    for (const q of picked) {
      try {
        const { videos, units } = await youtubeQuestions(fetchImpl, { q, key: env.YOUTUBE_API_KEY, videos: yt.videosPerSearch ?? 3, comments: yt.commentsPerVideo ?? 50, country: first });
        result.youtube.push({ q, videos });
        ytState.units += units;
        ytState.ok += 1;
      } catch (error) {
        ytState.units += YT_SEARCH_UNITS;
        ytState.failed += 1;
        ytState.error = error.message;
        if (/HTTP (400|401|403)/.test(error.message)) break; // bad key or quota exceeded: stop
      }
    }
  }
  return result;
}
