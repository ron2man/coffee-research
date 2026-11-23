// Index of content that already exists outside the item store (published posts, archived drafts),
// so agents can check overlap. Reads titles only.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { guideSlugs } from './tokens.mjs';

export const CONTENT_DIRS = { published: 'content/published', archived: 'content/archive/drafts' };

/**
 * Guides that drafts already link to ({{guide:slug|text}}) but that don't exist yet. The angle
 * agent reuses the slug when it plans that guide, so the links start working once it's published.
 */
export function wantedGuides(root) {
  const draftsDir = join(root, 'content', 'drafts');
  const drafts = existsSync(draftsDir) ? readdirSync(draftsDir).filter((n) => n.endsWith('.json')).map((n) => JSON.parse(readFileSync(join(draftsDir, n), 'utf8'))) : [];
  const have = new Set([...contentIndex(root).map((post) => post.slug), ...drafts.map((draft) => draft.slug)]);
  const wanted = new Map();
  for (const draft of drafts) {
    for (const { slug, text } of guideSlugs(draft.body)) {
      if (have.has(slug)) continue;
      const entry = wanted.get(slug) ?? { slug, linkTexts: [], linkedFrom: [] };
      if (text && !entry.linkTexts.includes(text)) entry.linkTexts.push(text);
      if (!entry.linkedFrom.includes(draft.slug)) entry.linkedFrom.push(draft.slug);
      wanted.set(slug, entry);
    }
  }
  return [...wanted.values()];
}

export function contentIndex(root) {
  const entries = [];
  for (const [status, dir] of Object.entries(CONTENT_DIRS)) {
    const full = join(root, dir);
    if (!existsSync(full)) continue;
    for (const name of readdirSync(full).sort()) {
      if (!name.endsWith('.md') || name.endsWith('.brief.md')) continue;
      const text = readFileSync(join(full, name), 'utf8');
      const title = text.match(/^title:\s*["']?(.+?)["']?\s*$/m)?.[1] ?? text.match(/^#\s+(.+)$/m)?.[1] ?? null;
      entries.push({ slug: name.slice(0, -3), title, status, path: `${dir}/${name}` });
    }
  }
  return entries;
}
