// Product catalog: a separate, read-only Git repository of manufacturer data (versions per market,
// specifications, manuals as text with page markers, troubleshooting tables), maintained by its
// own job. The niche names it in niche.json `catalog`; every tick refreshes a local mirror first
// (deterministic, no AI) so agents read current manufacturer facts locally instead of the web.
//   <dir>/catalog.json                          index of brands and products
//   <dir>/products/<id>/product.json            identity and regional versions (market names, model numbers)
//   <dir>/products/<id>/specs.json              specifications with document + page sources
//   <dir>/products/<id>/troubleshooting.json    the manufacturer's troubleshooting tables
//   <dir>/products/<id>/documents.json, docs/   manuals as Markdown with "--- page N ---" markers
// The mirror is gitignored in this repo and never edited here: a mirror with local edits is left
// alone (and reported) rather than overwritten.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const GIT_TIMEOUT_MS = 180_000;

function git(cwd, args, timeout = GIT_TIMEOUT_MS) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8', timeout, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } });
  if (result.error) throw new Error(`git ${args[0]}: ${result.error.code === 'ETIMEDOUT' ? 'timed out' : result.error.message}`);
  if (result.status !== 0) throw new Error(`git ${args[0]} failed: ${(result.stderr || result.stdout).trim().split('\n').slice(-2).join(' ')}`);
  return result.stdout.trim();
}

/** Absolute path of the mirror, or null when the niche has no catalog. Must stay inside the repo so agents can read it. */
export function catalogDir(root, niche) {
  if (!niche?.catalog) return null;
  const dir = resolve(root, niche.catalog.dir ?? 'catalog');
  if (!dir.startsWith(resolve(root))) throw new Error('niche.catalog.dir must be inside the repository (agents can only read files there)');
  return dir;
}

/**
 * Bring the mirror up to date with the catalog's remote branch: clone it (shallow) the first time,
 * then fetch and move to the remote head. Never throws; returns what happened:
 * { ok, skipped?, cloned?, from, to, changed, error? }.
 */
export function syncCatalog(root, niche, { gitImpl = git } = {}) {
  const dir = catalogDir(root, niche);
  if (!dir) return { ok: true, skipped: 'no catalog in niche.json' };
  const { repo, branch = 'main' } = niche.catalog;
  try {
    if (!existsSync(join(dir, '.git'))) {
      if (existsSync(dir)) return { ok: false, error: `${niche.catalog.dir} exists but is not a Git checkout; move it away so the tick can clone the catalog` };
      gitImpl(root, ['clone', '--quiet', '--depth', '1', '--branch', branch, repo, dir]);
      const to = gitImpl(dir, ['rev-parse', 'HEAD']);
      return { ok: true, cloned: true, from: null, to, changed: true };
    }
    const dirty = gitImpl(dir, ['status', '--porcelain', '--untracked-files=no']);
    if (dirty) return { ok: false, error: `the catalog mirror has local edits (${dirty.split('\n').length} files); it is read-only here. Discard them (git -C ${niche.catalog.dir} checkout -- .) and the next tick updates it` };
    const from = gitImpl(dir, ['rev-parse', 'HEAD']);
    gitImpl(dir, ['fetch', '--quiet', '--depth', '1', 'origin', branch]);
    const to = gitImpl(dir, ['rev-parse', 'FETCH_HEAD']);
    if (to !== from) gitImpl(dir, ['reset', '--quiet', '--hard', 'FETCH_HEAD']);
    return { ok: true, from, to, changed: to !== from };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

function readJsonSafe(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

/** The knowledge card a catalog product belongs to: same id, or the catalog id ends with "-<card id>" (brand prefix). */
export function matchCard(productId, cardIds) {
  if (cardIds.includes(productId)) return productId;
  const hits = cardIds.filter((id) => productId.endsWith(`-${id}`));
  return hits.length === 1 ? hits[0] : null;
}

/**
 * Short listing for agents: what the catalog holds and where, from its generated index.
 * Returns null without a catalog, or { dir, head, generatedAt, products: [...] , note? }.
 */
export function catalogListing(root, niche, { cardIds = [], max = niche?.catalog?.maxListed ?? 150 } = {}) {
  const dir = catalogDir(root, niche);
  if (!dir || !existsSync(join(dir, 'catalog.json'))) return null;
  const index = readJsonSafe(join(dir, 'catalog.json'));
  if (!index?.products) return null;
  const rel = niche.catalog.dir ?? 'catalog';
  let head = null;
  try {
    head = git(dir, ['rev-parse', '--short', 'HEAD'], 10_000);
  } catch { /* not fatal */ }
  const products = index.products.map((p) => {
    const card = matchCard(p.id, cardIds);
    const markets = [...new Set((p.versions ?? []).flatMap((v) => v.markets ?? []))].sort();
    return {
      id: p.id, brand: p.brand, name: p.name, category: p.category, status: p.status,
      ...(card ? { knowledgeCard: card } : {}),
      marketNames: [...new Set((p.versions ?? []).map((v) => v.marketName).filter(Boolean))],
      markets,
      documents: p.documents ?? 0, troubleshooting: p.troubleshooting ?? 0, specFields: p.specFields ?? 0,
      path: `${rel}/${(p.path ?? `products/${p.id}/`).replace(/^\/+/, '')}`,
    };
  });
  // Products tied to a knowledge card first, then the rest in index order.
  products.sort((a, b) => Number(Boolean(b.knowledgeCard)) - Number(Boolean(a.knowledgeCard)));
  return {
    dir: rel, head, generatedAt: index.generatedAt ?? null, total: products.length,
    products: products.slice(0, max),
    ...(products.length > max ? { note: `${products.length - max} more products: Grep ${rel}/catalog.json` } : {}),
  };
}
