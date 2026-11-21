// Index of content that already exists outside the item store (published posts, archived drafts),
// so agents can check overlap. Reads titles only.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const CONTENT_DIRS = { published: 'content/published', archived: 'content/archive/drafts' };

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
