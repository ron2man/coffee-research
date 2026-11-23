// Demand collection: real data, no AI, gathered by the scheduler before the idea agent runs.
//  - Search autocomplete per market: how people actually phrase searches (not volumes).
//  - Reddit posts from the niche's subreddits: who asks what, when, with how many replies.
//    Uses Reddit's API with an app's credentials (REDDIT_CLIENT_ID / REDDIT_CLIENT_SECRET);
//    without them it tries the public JSON once and records if that's blocked.
// Every source reports what worked and what didn't, so a blocked source is visible.
import { productName } from '../state/tokens.mjs';

const UA = 'research-engine/1.0 (site owner research; low volume)';
const isAscii = (text) => /^[\x20-\x7E]+$/.test(text);

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

async function redditToken(fetchImpl, env) {
  if (!env.REDDIT_CLIENT_ID || !env.REDDIT_CLIENT_SECRET) return null;
  const response = await fetchImpl('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: { 'User-Agent': UA, Authorization: `Basic ${Buffer.from(`${env.REDDIT_CLIENT_ID}:${env.REDDIT_CLIENT_SECRET}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Reddit token: HTTP ${response.status}`);
  return (await response.json()).access_token;
}

export async function redditSearch(fetchImpl, { subreddit, q, token }) {
  const base = token ? 'https://oauth.reddit.com' : 'https://www.reddit.com';
  const url = `${base}/r/${subreddit}/search${token ? '' : '.json'}?q=${encodeURIComponent(q)}&restrict_sr=1&sort=relevance&t=year&limit=10&raw_json=1`;
  const data = await getJson(fetchImpl, url, token ? { headers: { Authorization: `Bearer ${token}` } } : {});
  return (data?.data?.children ?? []).map(({ data: p }) => ({
    title: p.title,
    url: `https://www.reddit.com${p.permalink}`,
    date: new Date(p.created_utc * 1000).toISOString().slice(0, 10),
    comments: p.num_comments,
    score: p.score,
    excerpt: (p.selftext ?? '').replace(/\s+/g, ' ').slice(0, 280),
  }));
}

/** Collect demand data. Never throws: failures are recorded per source. */
export async function collectDemand(niche, { cards, seeds = [], fetchImpl = fetch, env = process.env, today = new Date().toISOString().slice(0, 10) } = {}) {
  const queries = demandQueries(niche, { cards, seeds });
  const result = { date: today, queries: [], reddit: [], sources: { autocomplete: { ok: 0, failed: 0 }, reddit: { ok: 0, failed: 0, mode: null, error: null } } };
  for (const query of queries) {
    try {
      result.queries.push({ ...query, suggestions: await autocomplete(fetchImpl, query) });
      result.sources.autocomplete.ok += 1;
    } catch (error) {
      result.sources.autocomplete.failed += 1;
      result.sources.autocomplete.error = error.message;
    }
  }
  let token = null;
  try {
    token = await redditToken(fetchImpl, env);
    result.sources.reddit.mode = token ? 'api' : 'public-json';
  } catch (error) {
    result.sources.reddit.error = error.message;
    result.sources.reddit.mode = 'public-json';
  }
  const redditQueries = [...new Set(queries.filter((x) => x.market === niche.markets[0].id).map((x) => x.q))].slice(0, 6);
  outer: for (const subreddit of niche.demand?.subreddits ?? []) {
    for (const q of redditQueries) {
      try {
        const posts = await redditSearch(fetchImpl, { subreddit, q, token });
        result.reddit.push({ subreddit, q, posts });
        result.sources.reddit.ok += 1;
      } catch (error) {
        result.sources.reddit.failed += 1;
        result.sources.reddit.error = error.message;
        if (!token) break outer; // public JSON blocked: don't hammer it
      }
    }
  }
  return result;
}
