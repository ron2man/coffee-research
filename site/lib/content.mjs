// Collects posts for the site. Production builds use content/published only. Preview builds
// also show writer drafts, the quality reference and archived drafts, each clearly badged.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseFrontmatter, slugify } from './markdown.mjs';

/** Shorten at a word boundary. */
export const clip = (text, max) => (text.length <= max ? text : `${text.slice(0, max - 1).replace(/\s+\S*$/, '')}…`);

const list = (dir, ext) => (existsSync(dir) ? readdirSync(dir).filter((n) => n.endsWith(ext) && !n.endsWith('.brief.md')).sort() : []);

function fromMarkdown(root, dir, name, status) {
  const text = readFileSync(join(root, dir, name), 'utf8');
  const { data, body } = parseFrontmatter(text);
  let content = body;
  let title = data.title;
  if (!title) {
    const heading = body.match(/^#\s+(.+)\r?\n/);
    title = heading?.[1] ?? name.replace(/\.md$/, '');
    if (heading) content = body.slice(heading.index + heading[0].length);
  }
  const firstParagraph = content.trim().split(/\r?\n\s*\r?\n/)[0] ?? '';
  return {
    slug: data.slug ?? name.replace(/\.md$/, ''),
    title,
    description: data.description ?? clip(firstParagraph.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\s+·\s*$/, '').replace(/[*`]/g, ''), 160),
    market: data.market ?? 'US',
    language: data.language ?? 'en',
    type: data.type ?? 'Guide',
    category: data.category ?? null,
    seoTitle: data.seoTitle ?? null,
    productIds: data.productIds ?? [],
    // What the guide recommends buying (pick card, PriceBox). Older frontmatter without it offered its products.
    offerIds: data.offerIds ?? data.productIds ?? [],
    tools: data.tools ?? [],
    setup: data.setup && typeof data.setup === 'object' ? data.setup : undefined,
    publishedAt: data.publishedAt ?? null,
    updatedAt: data.updatedAt ?? data.publishedAt ?? null,
    disclosure: data.disclosure !== false,
    humanData: data.humanData ?? [],
    body: content,
    status,
    source: `${dir}/${name}`,
  };
}

function fromWriterDraft(root, name) {
  const draft = JSON.parse(readFileSync(join(root, 'content/drafts', name), 'utf8'));
  return {
    slug: draft.slug, title: draft.title, seoTitle: draft.seoTitle ?? null, description: draft.description, market: draft.market, language: draft.language,
    type: 'Draft', category: draft.category ?? null, productIds: draft.productIds ?? [], offerIds: draft.offerIds ?? [], tools: draft.tools ?? [], updatedAt: null, disclosure: true,
    humanData: draft.humanData ?? [], body: draft.body, status: 'draft', source: `content/drafts/${name}`,
  };
}

function archivedPassed(root, name) {
  const review = join(root, 'content/archive/drafts', name.replace(/\.md$/, '.review.json'));
  if (!existsSync(review)) return false;
  try {
    return JSON.parse(readFileSync(review, 'utf8')).verdict === 'pass';
  } catch {
    return false;
  }
}

export function collectPosts(root, { preview = false } = {}) {
  const posts = list(join(root, 'content/published'), '.md').map((n) => fromMarkdown(root, 'content/published', n, 'published'));
  if (preview) {
    posts.push(...list(join(root, 'content/drafts'), '.json').map((n) => fromWriterDraft(root, n)));
    posts.push(...list(join(root, 'content/reference'), '.md').map((n) => fromMarkdown(root, 'content/reference', n, 'reference')));
    const supersededFile = join(root, 'content/archive/superseded.json');
    const superseded = existsSync(supersededFile) ? JSON.parse(readFileSync(supersededFile, 'utf8')) : {};
    posts.push(...list(join(root, 'content/archive/drafts'), '.md').filter((n) => archivedPassed(root, n))
      .map((n) => fromMarkdown(root, 'content/archive/drafts', n, 'archived'))
      .map((post) => (superseded[post.slug] ? { ...post, supersededBy: superseded[post.slug] } : post)));
  }
  const seen = new Set();
  return posts.filter((post) => {
    post.slug = slugify(post.slug);
    if (seen.has(post.slug)) return false; // published wins over previews with the same slug
    seen.add(post.slug);
    return true;
  });
}

/** Guides listed on the home page, in guide lists and in counts. Superseded drafts stay reachable by URL only. */
export const listed = (post) => !post.supersededBy;

/**
 * Categories that have earned a place in the nav and the category tiles: at least `min` listed
 * guides. A category with one guide looks abandoned, so it stays out until it qualifies.
 */
export function categoryCounts(categories, posts, min = 3) {
  return categories
    .map((c) => ({ ...c, count: posts.filter((p) => listed(p) && p.category === c.id).length }))
    .filter((c) => c.count >= min);
}

export function loadTools(root) {
  const tools = new Map();
  for (const name of list(join(root, 'content/tools'), '.json')) {
    const tool = JSON.parse(readFileSync(join(root, 'content/tools', name), 'utf8'));
    tools.set(tool.id, tool);
  }
  return tools;
}
