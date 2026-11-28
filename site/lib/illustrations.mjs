// Guide illustrations: original line drawings, one per guide (site/illustrations.json lists them).
// They are labelled as illustrations wherever they appear, so a drawing never passes for a photo
// of something we did. A guide's drawing is, in order: its frontmatter `image` ({ "illustration":
// id, "caption"?: text }), the first drawing whose `match` fits the guide's setup-finder tags, then
// its category's drawing. Guides that are none of these get no image.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const ILLUSTRATION_SIZE = { width: 240, height: 180 };

export function loadIllustrations(siteDir) {
  const file = join(siteDir, 'illustrations.json');
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null;
}

export const illustrationPath = (id) => `/assets/illustrations/${id}.svg`;

/** { id, alt, caption } for a guide, or null. `tags` are the guide's setup-finder tags. */
export function guideIllustration(post, tags, library) {
  if (!library) return null;
  const all = library.illustrations ?? {};
  const pick = (id, caption) => (all[id] ? { id, alt: all[id].alt, caption: caption ?? all[id].caption } : null);
  if (post.image?.illustration) return pick(post.image.illustration, post.image.caption);
  const matched = Object.keys(all).find((id) => {
    const match = Object.entries(all[id].match ?? {});
    return match.length && match.every(([key, values]) => (tags?.[key] ?? []).some((v) => values.includes(v)));
  });
  if (matched) return pick(matched);
  const byCategory = library.categories?.[post.category];
  return byCategory ? pick(byCategory) : null;
}

/** Problems with the library, its files, and the guides' `image` fields. Empty when all is well. */
export function illustrationProblems(library, posts = [], { siteDir } = {}) {
  if (!library) return [];
  const problems = [];
  const all = library.illustrations ?? {};
  for (const [id, entry] of Object.entries(all)) {
    if (!ID.test(id)) problems.push(`illustration "${id}": id must be lower-case words joined by "-"`);
    if (!entry.alt) problems.push(`illustration "${id}": no alt text`);
    if (!entry.caption) problems.push(`illustration "${id}": no caption`);
    if (siteDir && !existsSync(join(siteDir, 'public', illustrationPath(id)))) problems.push(`illustration "${id}": ${illustrationPath(id)} is missing`);
  }
  for (const [category, id] of Object.entries(library.categories ?? {})) {
    if (!all[id]) problems.push(`illustrations: category "${category}" uses "${id}", which is not in the list`);
  }
  for (const post of posts) {
    if (post.image === undefined) continue;
    if (!post.image || typeof post.image !== 'object' || !all[post.image.illustration]) problems.push(`${post.slug}: image must be {"illustration": <id>} with an id from site/illustrations.json`);
  }
  return problems;
}
