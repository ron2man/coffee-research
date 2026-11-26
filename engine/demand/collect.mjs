// Demand collection: real data, no AI, gathered by the scheduler before the idea agent runs.
//  - Search autocomplete per market: how people actually phrase searches (not volumes).
//  - Web search restricted to the niche's community sites (forums, subreddits) through a search
//    API (Brave Search, BRAVE_SEARCH_API_KEY). The community pages themselves are never fetched:
//    we keep the search engine's title, URL, date and snippet. This is how forum and Reddit
//    threads reach the idea agent now that Reddit's API, JSON and RSS are closed to new projects.
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
  const max = niche.demand?.maxQueries ?? 24;
  const queries = [];
  for (const productId of niche.focus?.products ?? []) {
    for (const market of niche.markets) {
      const name = productName(cards, market, productId).toLowerCase();
      for (const suffix of suffixes) queries.push({ market: market.id, q: `${name}${suffix}`, source: `focus:${productId}` });
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

/** Keyed-source usage this month, from earlier collections: { web: queries, youtube: units }. */
export function demandUsage(root, month = new Date().toISOString().slice(0, 7)) {
  const dir = join(root, 'data', 'demand');
  const usage = { month, web: 0, youtube: 0 };
  if (!existsSync(dir)) return usage;
  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.json')) continue;
    try {
      const data = JSON.parse(readFileSync(join(dir, file), 'utf8'));
      if (!String(data.date ?? '').startsWith(month)) continue;
      usage.web += (data.sources?.web?.ok ?? 0) + (data.sources?.web?.failed ?? 0);
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

/** One web search limited to a site (Brave Search API). Returns search-engine metadata only. */
export async function webSearch(fetchImpl, { q, site, key, country = 'us' }) {
  const query = `${q} site:${site}`;
  const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=10&freshness=py&country=${country.toLowerCase()}&search_lang=en&safesearch=moderate`;
  const data = await getJson(fetchImpl, url, { headers: { Accept: 'application/json', 'X-Subscription-Token': key } });
  return (data?.web?.results ?? [])
    .filter((r) => r.url && r.url.replace(/^https?:\/\/(www\.|old\.)?/, '').startsWith(site.replace(/^www\./, '')))
    .map((r) => ({
      title: clip(r.title, 200),
      url: r.url,
      date: r.page_age ? String(r.page_age).slice(0, 10) : null,
      age: r.age ?? null,
      excerpt: clip([r.description, ...(r.extra_snippets ?? [])].join(' ')),
    }));
}

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
export async function collectDemand(niche, { cards, seeds = [], fetchImpl = fetch, env = process.env, today = new Date().toISOString().slice(0, 10), usage = { web: 0, youtube: 0 } } = {}) {
  const queries = demandQueries(niche, { cards, seeds });
  const first = niche.markets[0].id;
  const englishQueries = [...new Set(queries.filter((x) => x.market === first).map((x) => x.q))];
  const result = {
    date: today,
    queries: [],
    web: [],
    youtube: [],
    sources: {
      autocomplete: { ok: 0, failed: 0 },
      web: { ok: 0, failed: 0, error: null, skipped: null },
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

  // Community threads through web search.
  const web = niche.demand?.webSearch;
  const webState = result.sources.web;
  if (!web?.sites?.length) webState.skipped = 'no demand.webSearch.sites in niche.json';
  else if (!env.BRAVE_SEARCH_API_KEY) webState.skipped = 'BRAVE_SEARCH_API_KEY not set';
  else {
    const monthly = web.monthlyMax ?? 900;
    const room = Math.max(0, monthly - (usage.web ?? 0));
    const pairs = englishQueries.flatMap((q) => web.sites.map((site) => ({ q, site })));
    const picked = rotate(pairs, Math.min(web.maxQueries ?? 8, room), today);
    if (!picked.length) webState.skipped = room ? 'no queries' : `monthly budget reached (${monthly} searches)`;
    for (const { q, site } of picked) {
      try {
        result.web.push({ site, q, results: await webSearch(fetchImpl, { q, site, key: env.BRAVE_SEARCH_API_KEY, country: first }) });
        webState.ok += 1;
      } catch (error) {
        webState.failed += 1;
        webState.error = error.message;
        if (/HTTP (401|403|429)/.test(error.message)) break; // bad key, out of credit or rate limited: stop
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
