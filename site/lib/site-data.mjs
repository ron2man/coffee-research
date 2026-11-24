// Everything the pages need, loaded once per build from the repo (niche, knowledge cards, posts,
// offers, tools). Two modes:
//   preview     drafts, the quality reference and archived drafts (badged), mock offers and photos, noindex
//   production  content/published only, real data/offers, disclosures required once a guide is live
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defaultNicheId, loadNiche, categoryIds } from '../../engine/state/niche.mjs';
import { loadCardsSync } from '../../engine/state/knowledge.mjs';
import { guideAliases } from '../../engine/state/content.mjs';
import { categoryCounts, collectPosts, listed, loadTools } from './content.mjs';
import { loadOffers, mockOffers } from './offers.mjs';

export const siteDir = resolve(fileURLToPath(new URL('..', import.meta.url)));
export const repoRoot = resolve(siteDir, '..');
export const SITE_URL = 'https://yourcoffeesetup.com';

/**
 * Build mode. SITE_MODE wins; on Cloudflare Workers Builds the production branch builds production
 * and every other branch (PR previews) builds preview; local builds default to preview.
 */
export function siteMode(env = process.env) {
  if (env.SITE_MODE === 'production' || env.SITE_MODE === 'preview') return env.SITE_MODE;
  if (env.WORKERS_CI_BRANCH) return env.WORKERS_CI_BRANCH === 'main' ? 'production' : 'preview';
  return 'preview';
}

function loadMock() {
  const file = join(siteDir, 'public', 'assets', 'mock', 'credits.json');
  if (!existsSync(file)) return null;
  const data = JSON.parse(readFileSync(file, 'utf8'));
  const entries = Object.entries(data.images).map(([name, meta]) => ({ file: name, ...meta }));
  const byName = new Map(entries.map((e) => [e.file, e]));
  return {
    home: byName.get(data.home) ?? null,
    posts: new Map(Object.entries(data.posts ?? {}).map(([slug, name]) => [slug, byName.get(name)]).filter(([, e]) => e)),
    wide: entries.filter((e) => e.shape === 'wide'),
    thumbs: entries.filter((e) => e.shape === 'square'),
  };
}

export function loadSiteData({ root = repoRoot, mode = siteMode(), now = Date.now() } = {}) {
  const preview = mode !== 'production';
  const production = !preview;
  const niche = loadNiche(defaultNicheId(root), root);
  const markets = niche.markets;
  const { cards, errors } = loadCardsSync(join(root, 'knowledge'), categoryIds(niche));
  if (errors.length && production) throw new Error(`Knowledge cards are invalid:\n${errors.join('\n')}`);

  const posts = collectPosts(root, { preview });
  // Every post is available in every market: a post written for another market gets a notice,
  // and its PriceBox shows that market's offers (or says the product isn't sold there).
  for (const post of posts) post.markets = markets.map((m) => m.id);
  for (const post of posts) post.category = post.category ?? cards.get(post.productIds[0])?.card?.category ?? null;

  // Disclosure is needed once a live guide carries affiliate offers, so production refuses to build
  // without verified disclosure text then. Guides that sell nothing (no offerIds) can go live first.
  const affiliate = posts.some((p) => p.offerIds?.length);
  const disclosure = (market) => {
    const text = niche.disclosures?.[market.id];
    if (text) return text;
    if (production && affiliate) throw new Error(`No disclosure text for ${market.id} in niche.json, and a live guide has offers; verify affiliate terms first (rebuild-spec 8).`);
    if (production) return null;
    return 'Disclosure placeholder: affiliate terms for this market are not verified yet, so the final disclosure text is pending.';
  };
  if (production && affiliate) markets.forEach(disclosure);

  const productIds = [...new Set(posts.flatMap((p) => p.offerIds ?? []))];
  const mockPrices = join(siteDir, 'mock-prices.json');
  const offers = preview
    ? mockOffers(productIds, markets, { now, prices: existsSync(mockPrices) ? JSON.parse(readFileSync(mockPrices, 'utf8')) : {} })
    : loadOffers(join(root, 'data', 'offers'));

  const categories = categoryCounts(niche.categories ?? [], posts);
  const site = {
    name: niche.name, markets, cards, tools: loadTools(root), disclosure, categories,
    allCategories: niche.categories ?? [], mock: preview ? loadMock() : null, pages: new Set(),
    guideAliases: guideAliases(root),
  };
  // Every path the build will produce, so the market switcher only links to pages that exist.
  for (const market of markets) {
    site.pages.add(`/${market.locale}/`);
    site.pages.add(`/${market.locale}/how-we-work/`);
    if (posts.length) site.pages.add(`/${market.locale}/guides/`);
    for (const category of categories) site.pages.add(`/${market.locale}/${category.id}/`);
    for (const post of posts) site.pages.add(`/${market.locale}/guides/${post.slug}/`);
  }
  return { mode, preview, production, niche, markets, posts, listedPosts: posts.filter(listed), offers, site, now };
}

let cached;
/** One load per build: every page of a build sees the same data and the same "now". */
export function siteData() {
  cached ??= loadSiteData();
  return cached;
}
