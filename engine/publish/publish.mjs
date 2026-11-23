// Publishing (rebuild-spec principle 7): a passed draft becomes content/published/<slug>.md in a
// pull request that a human merges. When the file reaches main, the next tick marks the item
// `published`.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { transition } from '../state/machine.mjs';
import { categoryIds, defaultNicheId, loadNiche } from '../state/niche.mjs';
import { loadCardsSync } from '../state/knowledge.mjs';
import { contentIndex } from '../state/content.mjs';
import { listTools } from '../state/tools.mjs';
import { loadItems, readJson, saveItem, writeJsonAtomic } from '../state/store.mjs';
import { runChecks } from '../feedback/checks.mjs';
import { githubUrl, pushFilesToBranch } from '../scheduler/git.mjs';

export const PUBLISHED_DIR = 'content/published';
export const REQUESTS_DIR = 'data/publish';

const field = (key, value) => `${key}: ${JSON.stringify(value)}`;

/** The published Markdown file: frontmatter (rebuild-spec 6.5) and the body, tokens kept. */
export function publishedMarkdown(draft, { publishedAt, updatedAt = publishedAt, category = null }) {
  const front = [
    field('title', draft.title),
    ...(draft.seoTitle ? [field('seoTitle', draft.seoTitle)] : []),
    field('slug', draft.slug),
    field('description', draft.description),
    field('market', draft.market),
    field('language', draft.language),
    ...(category ? [field('category', category)] : []),
    field('primaryQuery', draft.primaryQuery),
    field('relatedQueries', draft.relatedQueries ?? []),
    field('publishedAt', publishedAt),
    field('updatedAt', updatedAt),
    field('productIds', draft.productIds ?? []),
    field('offerIds', draft.offerIds ?? []),
    field('tools', draft.tools ?? []),
    field('claimsFile', `${PUBLISHED_DIR}/${draft.slug}.claims.json`),
    field('disclosure', true),
  ];
  return `---\n${front.join('\n')}\n---\n\n${draft.body.trim()}\n`;
}

const read = (root, item, name) => (item.artifacts[name] && existsSync(join(root, item.artifacts[name])) ? readJson(join(root, item.artifacts[name])) : null);

/** Everything that must be true before a post can go out. Returns problems (empty = ready). */
export function publishProblems(root, item) {
  const problems = [];
  if (item.status !== 'passed') problems.push(`it is ${item.status}; only drafts that passed the judge can be published`);
  const draft = read(root, item, 'writer');
  if (!draft) return [...problems, 'it has no draft'];
  const niche = loadNiche(defaultNicheId(root), root);
  // Disclosure is only required for a post that sells something (affiliate offers).
  const missing = niche.markets.filter((m) => !niche.disclosures?.[m.id]).map((m) => m.id);
  if (draft.offerIds?.length && missing.length) {
    problems.push(`this post has offers, and niche.json has no disclosure text for ${missing.join(', ')}. The live site refuses to build without it. Add it once the affiliate program terms for each market are checked (rebuild-spec section 8).`);
  }
  const { cards } = loadCardsSync(join(root, 'knowledge'), categoryIds(niche));
  const checks = runChecks('writer', [{ itemId: item.id, artifact: draft }], {
    today: new Date().toISOString().slice(0, 10), cards, markets: niche.markets,
    existingContent: contentIndex(root), tools: new Set(listTools(root).map((t) => t.id)),
  });
  problems.push(...checks.blocking.map((b) => b.replace(/^[^:]+: /, '')));
  if (existsSync(join(root, PUBLISHED_DIR, `${draft.slug}.md`))) problems.push(`${PUBLISHED_DIR}/${draft.slug}.md already exists`);
  return problems;
}

/**
 * Open the publishing pull request. Pushes branch publish/<slug> with the post and its claims,
 * then opens the PR with the GitHub CLI when it's installed; otherwise returns the compare URL.
 * Writes data/publish/<itemId>.json (internal) and returns { written, prUrl, branch }.
 */
export function requestPublish(root, itemId, { by = 'human', now = new Date(), push = pushFilesToBranch, openPr = ghPullRequest } = {}) {
  const item = loadItems(root).items.find((i) => i.id === itemId);
  if (!item) throw new Error(`No item ${itemId}`);
  const problems = publishProblems(root, item);
  if (problems.length) throw new Error(`Can't publish yet: ${problems.join(' ')}`);
  const draft = read(root, item, 'writer');
  const card = loadCardsSync(join(root, 'knowledge'), categoryIds(loadNiche(defaultNicheId(root), root))).cards.get(draft.offerIds?.[0] ?? draft.productIds?.[0]);
  const date = now.toISOString().slice(0, 10);
  const files = {
    [`${PUBLISHED_DIR}/${draft.slug}.md`]: publishedMarkdown(draft, { publishedAt: date, category: card?.category ?? null }),
    [`${PUBLISHED_DIR}/${draft.slug}.claims.json`]: `${JSON.stringify({ slug: draft.slug, itemId, claims: draft.claims ?? [] }, null, 2)}\n`,
  };
  const branch = `publish/${draft.slug}`;
  const title = `Publish: ${draft.slug}`;
  const sha = push(root, files, branch, `${title}\n\nApproved by ${by} from the dashboard. Item ${itemId}.`);
  const repo = githubUrl(root);
  const body = `Approved for publishing by ${by}.\n\n- Item: \`${itemId}\`\n- Post: \`${PUBLISHED_DIR}/${draft.slug}.md\`\n\nMerging this publishes the guide. The scheduler marks the item published at its next tick.`;
  const prUrl = openPr(root, { branch, title, body }) ?? (repo ? `${repo}/compare/main...${branch}?expand=1` : null);
  const path = `${REQUESTS_DIR}/${itemId}.json`;
  writeJsonAtomic(join(root, path), { itemId, slug: draft.slug, branch, sha, prUrl, requestedBy: by, at: now.toISOString() });
  return { written: [path], prUrl, branch };
}

/** Open a PR with the GitHub CLI if it's installed and signed in; null otherwise. */
export function ghPullRequest(root, { branch, title, body }) {
  const result = spawnSync('gh', ['pr', 'create', '--head', branch, '--base', 'main', '--title', title, '--body', body], { cwd: root, encoding: 'utf8' });
  if (result.status === 0) return result.stdout.trim().split('\n').at(-1);
  const existing = spawnSync('gh', ['pr', 'view', branch, '--json', 'url', '--jq', '.url'], { cwd: root, encoding: 'utf8' });
  return existing.status === 0 ? existing.stdout.trim() : null;
}

/** Items whose post is now on main move from passed to published. Returns the files written. */
export function syncPublished(root, items) {
  const written = [];
  for (const item of items.filter((i) => i.status === 'passed')) {
    const draft = read(root, item, 'writer');
    if (!draft || !existsSync(join(root, PUBLISHED_DIR, `${draft.slug}.md`))) continue;
    saveItem(root, transition(item, 'published', { by: 'scheduler', reason: `${PUBLISHED_DIR}/${draft.slug}.md is on main` }));
    written.push(`data/items/${item.id}.json`);
  }
  return written;
}
