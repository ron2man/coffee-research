// The setup finder (content/finder.json) and the guide tags that lists filter by.
// Two sides that only share the profile: the finder (public/assets/finder.js) asks questions and
// stores the answers; any guide list marked data-setup-list filters or sorts itself by them, using
// the tags rendered here on each row. Neither side knows the other is on the page.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { resolveTokens } from '../../engine/state/tokens.mjs';

const KEY = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const USES = new Set(['filter', 'rank', 'none']);

export function loadFinder(root) {
  const file = join(root, 'content', 'finder.json');
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null;
}

/** A question is asked only when the earlier answers it depends on (showIf) were given and match. */
export function questionVisible(question, answers) {
  return Object.entries(question.showIf ?? {}).every(([key, allowed]) => allowed.includes(answers[key]));
}

/**
 * A guide's tags: its frontmatter `setup` ({ key: [values] }), plus, for a question with
 * tagFrom "productIds", the guide's products that are options of that question. A question a
 * guide is tagged for also tags the earlier answers it depends on (a Barista Express guide is an
 * espresso-machine guide), unless the guide says otherwise.
 */
export function guideTags(post, finder) {
  const tags = {};
  for (const [key, values] of Object.entries(post.setup ?? {})) tags[key] = [...values];
  for (const q of finder?.questions ?? []) {
    if (q.tagFrom !== 'productIds' || tags[q.key]) continue;
    const values = q.options.map((o) => o[0]).filter((v) => (post.productIds ?? []).includes(v));
    if (values.length) tags[q.key] = values;
  }
  for (const q of finder?.questions ?? []) {
    if (!tags[q.key] || !q.showIf) continue;
    for (const [key, allowed] of Object.entries(q.showIf)) if (!tags[key]) tags[key] = [...allowed];
  }
  return tags;
}

/** Does a guide fit the profile? Only filter questions count; a key the guide isn't tagged for never excludes it. */
export function fitsProfile(tags, profile, finder) {
  return (finder?.questions ?? []).filter((q) => q.use === 'filter' && q.key in profile)
    .every((q) => !tags[q.key] || tags[q.key].includes(profile[q.key]));
}

/** The finder as one market reads it: product tokens in labels resolved. */
export function localizeFinder(finder, site, market) {
  const text = (s) => resolveTokens(s, { cards: site.cards, market });
  return { questions: finder.questions.map((q) => ({ ...q, text: text(q.text), options: q.options.map(([v, label]) => [v, text(label)]) })) };
}

/** Problems with the finder and with the guides' `setup` tags. Empty when all is well. */
export function finderProblems(finder, posts = []) {
  if (!finder) return [];
  const problems = [];
  const options = new Map();
  finder.questions.forEach((q, i) => {
    const at = `finder question ${i + 1} (${q.key})`;
    if (!KEY.test(q.key ?? '')) problems.push(`${at}: key must be lower-case words joined by "-"`);
    if (options.has(q.key)) problems.push(`${at}: duplicate key`);
    if (!q.text) problems.push(`${at}: no text`);
    if (!USES.has(q.use)) problems.push(`${at}: use must be filter, rank or none`);
    if (q.tagFrom && q.tagFrom !== 'productIds') problems.push(`${at}: tagFrom can only be "productIds"`);
    const values = (q.options ?? []).map((o) => o[0]);
    if (values.length < 2) problems.push(`${at}: needs at least 2 options`);
    if (new Set(values).size !== values.length) problems.push(`${at}: duplicate option values`);
    for (const o of q.options ?? []) if (!KEY.test(o[0] ?? '') || !o[1]) problems.push(`${at}: option ${JSON.stringify(o)} needs a value and a label`);
    for (const [key, allowed] of Object.entries(q.showIf ?? {})) {
      if (!options.has(key)) { problems.push(`${at}: showIf uses "${key}", which is not an earlier question`); continue; }
      for (const v of allowed) if (!options.get(key).has(v)) problems.push(`${at}: showIf "${v}" is not an option of "${key}"`);
    }
    options.set(q.key, new Set(values));
  });
  for (const post of posts) {
    for (const [key, values] of Object.entries(post.setup ?? {})) {
      if (!options.has(key)) { problems.push(`${post.slug}: setup uses "${key}", which is not a finder question`); continue; }
      if (!Array.isArray(values) || !values.length) problems.push(`${post.slug}: setup "${key}" must be a non-empty list`);
      else for (const v of values) if (!options.get(key).has(v)) problems.push(`${post.slug}: setup "${key}" has "${v}", not an option of that question`);
    }
  }
  return problems;
}
