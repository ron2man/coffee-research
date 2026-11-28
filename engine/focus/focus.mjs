// Focus rotation: which products the idea agent and the demand collector start from.
//
// The niche's `focus.products` is only the starting list. The live focus is committed state in
// data/focus/state.json, so a move to another machine keeps it. A review (deterministic, no AI)
// runs from the tick once a week, or sooner when the idea queue has run dry:
//   1. Retire: an active product with `coveredAfterGuides` guides about it is covered. If the queue
//      is dry and nothing reached that number, the active product with the most guides (at least
//      half the number) is retired instead.
//   2. Fill: while fewer than `maxActive` products are active, add the best candidate. Candidates
//      are products with a knowledge card in a rotation category, sold in every active market (by
//      the card or the catalog),
//      not active, covered or excluded. With a catalog mirror, the manufacturer material it holds
//      (troubleshooting rows, documents) ranks them first; the top few then get a demand probe:
//      search-autocomplete completions for problem phrasings in every market. A candidate nobody
//      searches problems for is never added. Score = demand × material × (1.25 when it shares a
//      brand with an active or covered product, so the site grows in clusters).
// Every change is recorded with its numbers in `history`. A human can pin or exclude products in
// niche.json, and undo the last change (the products it added are excluded until allowed again).
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readJson, writeJsonAtomic } from '../state/store.mjs';
import { productName } from '../state/tokens.mjs';
import { catalogListing } from '../catalog/catalog.mjs';

export const FOCUS_PATH = 'data/focus/state.json';
const dayMs = 86_400_000;
const HISTORY_KEPT = 60;

export const ROTATION_DEFAULTS = {
  maxActive: 3,
  coveredAfterGuides: 6,
  reviewEveryDays: 7,
  probeCandidates: 8,
  // Problem phrasings for the demand probe; {name} is the product's name in that market.
  probeQueries: ['why is my {name}', '{name} problems', '{name} not working'],
};

export const rotationOf = (niche) => ({ ...ROTATION_DEFAULTS, ...(niche.focus?.rotation ?? {}) });

export function readFocus(root) {
  const path = join(root, FOCUS_PATH);
  return existsSync(path) ? readJson(path) : null;
}

export function writeFocus(root, state) {
  writeJsonAtomic(join(root, FOCUS_PATH), { ...state, history: (state.history ?? []).slice(-HISTORY_KEPT) });
  return FOCUS_PATH;
}

/** The starting state: the niche's own list, before the first review. */
export function initialFocus(niche, now = new Date()) {
  const at = now.toISOString();
  return {
    schemaVersion: 1,
    active: (niche.focus?.products ?? []).map((productId) => ({ productId, since: at, reason: 'starting list in niche.json' })),
    covered: [],
    excluded: [],
    lastReviewAt: null,
    history: [],
  };
}

/**
 * The niche as agents and the demand collector should see it: focus.products is the live list,
 * and focus.covered lists products that already have their cluster (still fine with strong evidence).
 */
export function withFocus(niche, state) {
  if (!niche.focus || !state) return niche;
  return {
    ...niche,
    focus: {
      ...niche.focus,
      products: state.active.map((a) => a.productId),
      covered: state.covered.map((c) => c.productId),
    },
  };
}

function frontmatterProducts(text) {
  const line = text.match(/^productIds:\s*(\[.*\])\s*$/m)?.[1];
  try {
    return line ? JSON.parse(line) : [];
  } catch {
    return [];
  }
}

/**
 * Guides about each product: published posts and drafts (one per slug; drafts of rejected items
 * don't count). A guide is about a product when it is one of the first two in its productIds, so a
 * guide that mentions six products for comparison counts only for the ones it is about.
 */
export function guidesPerProduct(root, items = []) {
  const rejected = new Set(items.filter((i) => i.status === 'rejected').map((i) => i.id));
  const bySlug = new Map();
  const published = join(root, 'content', 'published');
  if (existsSync(published)) {
    for (const name of readdirSync(published).filter((n) => n.endsWith('.md'))) {
      bySlug.set(name.slice(0, -3), frontmatterProducts(readFileSync(join(published, name), 'utf8')));
    }
  }
  const drafts = join(root, 'content', 'drafts');
  if (existsSync(drafts)) {
    for (const name of readdirSync(drafts).filter((n) => n.endsWith('.json'))) {
      if (rejected.has(name.slice(0, -5))) continue;
      try {
        const draft = JSON.parse(readFileSync(join(drafts, name), 'utf8'));
        const slug = draft.slug ?? name.slice(0, -5);
        if (!bySlug.has(slug)) bySlug.set(slug, draft.productIds ?? []);
      } catch { /* a broken draft is reported elsewhere */ }
    }
  }
  const counts = {};
  for (const ids of bySlug.values()) for (const id of ids.slice(0, 2)) counts[id] = (counts[id] ?? 0) + 1;
  return counts;
}

/** Is a review due? `dry`: nothing waiting in the idea queue. */
export function reviewDue(state, { now = new Date(), niche, dry = false }) {
  const { reviewEveryDays } = rotationOf(niche);
  if (!state.lastReviewAt) return { due: true, trigger: 'first review' };
  const since = now.getTime() - Date.parse(state.lastReviewAt);
  if (since >= reviewEveryDays * dayMs) return { due: true, trigger: 'weekly' };
  if (dry && since >= dayMs) return { due: true, trigger: 'idea queue empty' };
  return { due: false };
}

const brandOf = (listing, productId) => listing?.products.find((p) => p.knowledgeCard === productId)?.brand ?? null;

/** Candidates with their catalog material, before the demand probe. Pure apart from the catalog read. */
export function focusCandidates({ niche, cards, state, listing = null }) {
  const rotation = rotationOf(niche);
  const categories = new Set(rotation.categories ?? (niche.categories ?? []).map((c) => c.id));
  const markets = niche.markets.filter((m) => m.status !== 'paused').map((m) => m.id);
  const taken = new Set([...state.active, ...state.covered, ...state.excluded].map((x) => x.productId));
  for (const id of niche.focus?.exclude ?? []) taken.add(id);
  const clusterBrands = new Set([...state.active, ...state.covered].map((x) => brandOf(listing, x.productId)).filter(Boolean));
  const out = [];
  for (const [id, { card, category }] of cards) {
    if (taken.has(id) || !categories.has(category)) continue;
    const entry = listing?.products.find((p) => p.knowledgeCard === id) ?? null;
    if (listing && !entry) continue; // with a catalog, only products it holds
    // Sold where the card or the catalog says (cards start with the variants research needed).
    const sold = new Set([...(card.variants ?? []).flatMap((v) => v.markets ?? []), ...(entry?.markets ?? [])]);
    if (!markets.every((m) => sold.has(m))) continue;
    const troubleshooting = entry?.troubleshooting ?? 0;
    const documents = entry?.documents ?? 0;
    const material = 1 + Math.log1p(troubleshooting) / 4 + Math.log1p(documents) / 8;
    const adjacent = Boolean(entry?.brand && clusterBrands.has(entry.brand));
    out.push({ productId: id, category, brand: entry?.brand ?? null, troubleshooting, documents, material: round(material), adjacent });
  }
  return out.sort((a, b) => b.material * (b.adjacent ? 1.25 : 1) - a.material * (a.adjacent ? 1.25 : 1) || a.productId.localeCompare(b.productId));
}

const round = (n) => Math.round(n * 100) / 100;

/** Distinct autocomplete completions for the probe phrasings, across markets. */
export async function probeDemand({ niche, cards, productId, autocomplete }) {
  const { probeQueries } = rotationOf(niche);
  const completions = new Set();
  let failed = 0;
  let asked = 0;
  for (const market of niche.markets.filter((m) => m.status !== 'paused')) {
    const name = productName(cards, market, productId).toLowerCase();
    for (const template of probeQueries) {
      asked += 1;
      try {
        for (const s of await autocomplete({ q: template.replace('{name}', name), market: market.id })) completions.add(s.toLowerCase());
      } catch {
        failed += 1;
      }
    }
  }
  return { demand: completions.size, failed, asked, examples: [...completions].slice(0, 5) };
}

/**
 * One review. Returns { state, change } where change is null when nothing moved. Never writes.
 * `autocomplete({ q, market })` → suggestions; injected so tests run offline.
 */
export async function reviewFocus({ root, niche, cards, items, state, now = new Date(), trigger, autocomplete, listing }) {
  const rotation = rotationOf(niche);
  const at = now.toISOString();
  const next = structuredClone(state);
  const guides = guidesPerProduct(root, items);
  const pinned = new Set(niche.focus?.pinned ?? []);
  const removed = [];
  for (const a of state.active) {
    const n = guides[a.productId] ?? 0;
    if (!pinned.has(a.productId) && n >= rotation.coveredAfterGuides) removed.push({ productId: a.productId, guides: n, reason: `${n} guides (covered at ${rotation.coveredAfterGuides})` });
  }
  if (!removed.length && trigger === 'idea queue empty' && next.active.length >= rotation.maxActive) {
    const most = state.active.filter((a) => !pinned.has(a.productId))
      .map((a) => ({ productId: a.productId, guides: guides[a.productId] ?? 0 }))
      .sort((a, b) => b.guides - a.guides)[0];
    if (most && most.guides >= Math.ceil(rotation.coveredAfterGuides / 2)) removed.push({ ...most, reason: `idea queue empty; most covered active product (${most.guides} guides)` });
  }
  const gone = new Set(removed.map((r) => r.productId));
  next.active = next.active.filter((a) => !gone.has(a.productId));
  next.covered.push(...removed.map((r) => ({ productId: r.productId, at, guides: r.guides, reason: r.reason })));
  // Pinned products are always active.
  for (const id of pinned) if (!next.active.some((a) => a.productId === id)) next.active.push({ productId: id, since: at, reason: 'pinned in niche.json' });

  const added = [];
  let scores = [];
  let probe = null;
  if (next.active.length < rotation.maxActive) {
    const candidates = focusCandidates({ niche, cards, state: next, listing: listing ?? (root ? catalogListing(root, niche, { cardIds: [...cards.keys()], max: 10_000 }) : null) })
      .slice(0, rotation.probeCandidates);
    let failures = 0;
    let asked = 0;
    for (const c of candidates) {
      const p = await probeDemand({ niche, cards, productId: c.productId, autocomplete });
      failures += p.failed;
      asked += p.asked;
      scores.push({ ...c, demand: p.demand, examples: p.examples, score: round(p.demand * c.material * (c.adjacent ? 1.25 : 1)) });
    }
    scores.sort((a, b) => b.score - a.score || a.productId.localeCompare(b.productId));
    probe = { asked, failed: failures };
    // A probe that mostly failed says nothing about demand: add nothing this time.
    if (asked && failures / asked <= 0.5) {
      for (const s of scores) {
        if (next.active.length >= rotation.maxActive) break;
        if (s.demand === 0) continue;
        next.active.push({ productId: s.productId, since: at, reason: `score ${s.score}: ${s.demand} problem searches, ${s.troubleshooting} troubleshooting rows, ${s.documents} documents${s.adjacent ? ', same brand as the cluster' : ''}` });
        added.push(s.productId);
      }
    }
  }
  next.lastReviewAt = at;
  const change = added.length || removed.length ? { at, trigger, added, removed, scores: scores.slice(0, 5), probe } : null;
  next.history = [...(state.history ?? []), change ?? { at, trigger, added: [], removed: [], scores: scores.slice(0, 5), probe, note: 'no change' }];
  return { state: next, change };
}

/** Undo the last change: its removed products come back, its added products are excluded. */
export function undoLastChange(state, { now = new Date(), by = 'human' } = {}) {
  const last = [...(state.history ?? [])].reverse().find((h) => !h.undo && (h.added?.length || h.removed?.length));
  if (!last || last.undone) throw new Error('No focus change to undo');
  const at = now.toISOString();
  const next = structuredClone(state);
  const added = new Set(last.added);
  next.active = next.active.filter((a) => !added.has(a.productId));
  for (const r of last.removed) {
    next.covered = next.covered.filter((c) => c.productId !== r.productId);
    next.active.push({ productId: r.productId, since: at, reason: `restored by ${by} (undo)` });
  }
  next.excluded.push(...last.added.map((productId) => ({ productId, at, reason: `undone by ${by}` })));
  const index = next.history.findIndex((h) => h.at === last.at && h.trigger === last.trigger);
  if (index >= 0) next.history[index] = { ...next.history[index], undone: at };
  next.history.push({ at, trigger: `undo by ${by}`, undo: true, added: last.removed.map((r) => r.productId), removed: last.added.map((productId) => ({ productId, reason: 'undo' })) });
  return next;
}

/** Let an excluded product be chosen again. */
export function allowProduct(state, productId) {
  if (!state.excluded.some((e) => e.productId === productId)) throw new Error(`${productId} is not excluded`);
  return { ...state, excluded: state.excluded.filter((e) => e.productId !== productId) };
}
