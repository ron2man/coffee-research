#!/usr/bin/env node
// Static site build. Writes site/dist/.
//
//   npm run site:build              preview: published posts plus drafts, the quality reference and
//                                   archived drafts (badged), mock offers, noindex
//   npm run site:build -- --production   published posts only, real data/offers, disclosures required
//   npm run site:preview            build (preview) and serve on http://127.0.0.1:4321, rebuilding on reload
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { defaultNicheId, loadNiche, categoryIds } from '../engine/state/niche.mjs';
import { loadCardsSync } from '../engine/state/knowledge.mjs';
import { categoryCounts, collectPosts, listed, loadTools } from './lib/content.mjs';
import { loadOffers, mockOffers } from './lib/offers.mjs';
import { guideListPage, homePage, howWeWorkPage, layout, postPage, postPath, rootPage } from './lib/templates.mjs';

const here = dirname(fileURLToPath(import.meta.url));
export const repoRoot = resolve(here, '..');

// Mock photos (site/assets/mock) appear in preview builds only and are never copied into production.
function loadMock() {
  const file = join(here, 'assets', 'mock', 'credits.json');
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

export function buildSite({ root = repoRoot, production = false, now = Date.now(), outDir = join(root, 'site', 'dist') } = {}) {
  const preview = !production;
  const niche = loadNiche(defaultNicheId(root), root);
  const markets = niche.markets;
  const { cards, errors } = loadCardsSync(join(root, 'knowledge'), categoryIds(niche));
  if (errors.length && production) throw new Error(`Knowledge cards are invalid:\n${errors.join('\n')}`);
  const disclosure = (market) => {
    const text = niche.disclosures?.[market.id];
    if (text) return text;
    if (production) throw new Error(`No disclosure text for ${market.id} in niche.json; verify affiliate terms first (rebuild-spec 8).`);
    return 'Disclosure placeholder: affiliate terms for this market are not verified yet, so the final disclosure text is pending.';
  };
  const posts = collectPosts(root, { preview });
  // Every post is available in every market: a post written for another market gets a notice,
  // and its PriceBox shows that market's offers (or says the product isn't sold there).
  for (const post of posts) post.markets = markets.map((m) => m.id);
  // A guide's category: its front matter, else the category of its first product's card.
  for (const post of posts) post.category = post.category ?? cards.get(post.productIds[0])?.card?.category ?? null;
  const productIds = [...new Set(posts.flatMap((p) => p.productIds))];
  const mockPrices = join(here, 'mock-prices.json');
  const offers = preview
    ? mockOffers(productIds, markets, { now, prices: existsSync(mockPrices) ? JSON.parse(readFileSync(mockPrices, 'utf8')) : {} })
    : loadOffers(join(root, 'data', 'offers'));
  const tools = loadTools(root);

  const pages = new Map();
  const categories = categoryCounts(niche.categories ?? [], posts);
  const site = { name: niche.name, markets, cards, tools, disclosure, pages, categories, allCategories: niche.categories ?? [], mock: preview ? loadMock() : null };
  const plan = [];
  for (const market of markets) {
    plan.push({ path: `/${market.locale}/`, market, kind: 'home' });
    plan.push({ path: `/${market.locale}/how-we-work/`, market, kind: 'how' });
    plan.push({ path: `/${market.locale}/guides/`, market, kind: 'list' });
    for (const category of categories) plan.push({ path: `/${market.locale}/${category.id}/`, market, kind: 'list', category });
    for (const post of posts.filter((p) => p.markets.includes(market.id))) plan.push({ path: postPath(market, post.slug), market, kind: 'post', post });
  }
  for (const entry of plan) pages.set(entry.path, null);
  const robots = preview ? 'noindex, nofollow' : null;
  for (const entry of plan) {
    const { market } = entry;
    let title;
    let description;
    let body;
    if (entry.kind === 'home') {
      title = `${niche.name}: straight answers for home espresso`;
      description = 'One clear recommendation, a test for what you already own, and when to buy nothing.';
      body = homePage({ site, market, posts });
    } else if (entry.kind === 'list') {
      const label = entry.category?.label ?? 'All guides';
      title = `${label} | ${niche.name}`;
      description = entry.category ? `Every ${niche.name} guide about ${label.toLowerCase()}.` : `Every ${niche.name} guide, newest first.`;
      body = guideListPage({ site, market, posts: posts.filter(listed), category: entry.category });
    } else if (entry.kind === 'how') {
      title = `How we work | ${niche.name}`;
      description = 'Where our topics come from, what we check, and what we never claim.';
      body = howWeWorkPage({ site, market });
    } else {
      title = `${entry.post.title} | ${niche.name}`;
      description = entry.post.description;
      body = postPage({ site, market, post: entry.post, offers, now, preview });
    }
    pages.set(entry.path, layout({ site, market, title, description, body, path: entry.path, preview, robots }));
  }
  pages.set('/', rootPage({ site }));

  rmSync(outDir, { recursive: true, force: true });
  for (const [path, html] of pages) {
    const file = join(outDir, path, 'index.html');
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, html);
  }
  const mockDir = join(here, 'assets', 'mock');
  cpSync(join(here, 'assets'), join(outDir, 'assets'), { recursive: true, filter: (src) => preview || !(src === mockDir || src.startsWith(mockDir + sep)) });
  return { outDir, pages: [...pages.keys()].sort(), posts: posts.map((p) => ({ slug: p.slug, status: p.status, markets: p.markets })) };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { values } = parseArgs({ options: { production: { type: 'boolean' }, out: { type: 'string' } } });
    const result = buildSite({ production: values.production, ...(values.out ? { outDir: resolve(values.out) } : {}) });
    console.log(`Built ${result.pages.length} pages into ${result.outDir}`);
    for (const post of result.posts) console.log(`  ${post.slug} (${post.status}) → ${post.markets.join(', ')}`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
