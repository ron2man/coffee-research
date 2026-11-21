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
    productIds: data.productIds ?? [],
    tools: data.tools ?? [],
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
    slug: draft.slug, title: draft.title, description: draft.description, market: draft.market, language: draft.language,
    type: 'Draft', productIds: draft.productIds ?? [], tools: draft.tools ?? [], updatedAt: null, disclosure: true,
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
    posts.push(...list(join(root, 'content/archive/drafts'), '.md').filter((n) => archivedPassed(root, n))
      .map((n) => fromMarkdown(root, 'content/archive/drafts', n, 'archived')));
  }
  const seen = new Set();
  return posts.filter((post) => {
    post.slug = slugify(post.slug);
    if (seen.has(post.slug)) return false; // published wins over previews with the same slug
    seen.add(post.slug);
    return true;
  });
}

export function loadTools(root) {
  const tools = new Map();
  for (const name of list(join(root, 'content/tools'), '.json')) {
    const tool = JSON.parse(readFileSync(join(root, 'content/tools', name), 'utf8'));
    tools.set(tool.id, tool);
  }
  return tools;
}
