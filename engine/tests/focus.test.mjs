import test from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  FOCUS_PATH, allowProduct, focusCandidates, guidesPerProduct, initialFocus, readFocus, reviewDue, reviewFocus, undoLastChange, withFocus,
} from '../focus/focus.mjs';
import { commitMessage } from '../scheduler/git.mjs';
import { repoRoot } from '../state/niche.mjs';
import { fakeRunner } from '../runner/index.mjs';
import { loadAgents } from '../agents/registry.mjs';
import { tick } from '../scheduler/tick.mjs';

const card = (id, category, markets = ['US', 'GB']) => [id, { category, card: { id, name: id, variants: markets.map((m) => ({ id: `${id}-${m}`, markets: [m], name: `${id} ${m}` })) } }];
const cards = new Map([
  card('alpha', 'machines'), card('beta', 'machines'), card('gamma', 'grinders'), card('delta', 'machines', ['US']),
  card('omega', 'accessories'), card('quiet', 'machines'),
]);
const niche = {
  id: 'test',
  markets: [{ id: 'US', status: 'active' }, { id: 'GB', status: 'active' }],
  categories: [{ id: 'machines' }, { id: 'grinders' }, { id: 'accessories' }],
  focus: { products: ['alpha'], why: 'test', rotation: { maxActive: 2, coveredAfterGuides: 2, categories: ['machines', 'grinders'] } },
};
const listing = {
  products: [
    { id: 'acme-alpha', brand: 'acme', knowledgeCard: 'alpha', troubleshooting: 10, documents: 2 },
    { id: 'acme-beta', brand: 'acme', knowledgeCard: 'beta', troubleshooting: 5, documents: 1 },
    { id: 'other-gamma', brand: 'other', knowledgeCard: 'gamma', troubleshooting: 40, documents: 6 },
    { id: 'acme-delta', brand: 'acme', knowledgeCard: 'delta', troubleshooting: 99, documents: 9 },
    { id: 'acme-quiet', brand: 'acme', knowledgeCard: 'quiet', troubleshooting: 99, documents: 9 },
  ],
};
// Problem searches per product: quiet has none.
const searches = { beta: 3, gamma: 2, quiet: 0 };
const autocomplete = async ({ q }) => {
  const id = Object.keys(searches).find((k) => q.includes(k));
  return Array.from({ length: searches[id] ?? 0 }, (_, i) => `${q} ${i}`);
};

function sandbox(t, guides = {}) {
  const root = mkdtempSync(join(tmpdir(), 'focus-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'content', 'drafts'), { recursive: true });
  mkdirSync(join(root, 'content', 'published'), { recursive: true });
  for (const [slug, productIds] of Object.entries(guides)) {
    writeFileSync(join(root, 'content', 'drafts', `${slug}.json`), JSON.stringify({ slug, productIds }));
  }
  return root;
}

test('guides count for the first two products they name, once per slug, not for rejected items', (t) => {
  const root = sandbox(t, { g1: ['alpha', 'beta', 'gamma'], g2: ['alpha'], g3: ['alpha'] });
  writeFileSync(join(root, 'content', 'published', 'g1.md'), '---\ntitle: "x"\nproductIds: ["alpha","beta","gamma"]\n---\nbody');
  assert.deepEqual(guidesPerProduct(root, [{ id: 'g3', status: 'rejected' }]), { alpha: 2, beta: 1 });
});

test('a review is due weekly, or after a day when the idea queue is empty', () => {
  const now = new Date('2026-12-10T12:00:00Z');
  assert.equal(reviewDue({ lastReviewAt: null }, { now, niche }).trigger, 'first review');
  assert.equal(reviewDue({ lastReviewAt: '2026-12-09T00:00:00Z' }, { now, niche }).due, false);
  assert.equal(reviewDue({ lastReviewAt: '2026-12-09T00:00:00Z' }, { now, niche, dry: true }).trigger, 'idea queue empty');
  assert.equal(reviewDue({ lastReviewAt: '2026-12-01T00:00:00Z' }, { now, niche }).trigger, 'weekly');
});

test('candidates: rotation categories, sold in every market, held by the catalog, same brand first', () => {
  const state = initialFocus(niche);
  const ids = focusCandidates({ niche, cards, state, listing }).map((c) => c.productId);
  assert.deepEqual(ids.sort(), ['beta', 'gamma', 'quiet'], 'not delta (US only), omega (category), alpha (active)');
  assert.ok(focusCandidates({ niche, cards, state, listing }).find((c) => c.productId === 'beta').adjacent, 'beta shares a brand with alpha');
});

test('a covered product is retired and the best searched-for candidate fills its place, with its numbers', async (t) => {
  const root = sandbox(t, { g1: ['alpha'], g2: ['alpha'] });
  const now = new Date('2026-12-10T12:00:00Z');
  const { state, change } = await reviewFocus({ root, niche, cards, items: [], state: initialFocus(niche, now), now, trigger: 'weekly', autocomplete, listing });
  assert.deepEqual(change.removed.map((r) => r.productId), ['alpha']);
  assert.deepEqual(state.active.map((a) => a.productId), ['beta', 'gamma'], 'beta first (demand and same brand); quiet never (no problem searches)');
  assert.match(state.active[0].reason, /problem searches, 5 troubleshooting rows, 1 documents, same brand/);
  assert.deepEqual(state.covered.map((c) => c.productId), ['alpha']);
  assert.equal(state.lastReviewAt, now.toISOString());
  assert.deepEqual(withFocus(niche, state).focus.products, ['beta', 'gamma']);
  assert.deepEqual(withFocus(niche, state).focus.covered, ['alpha']);
});

test('pinned products stay; excluded ones are never added; a failed probe adds nothing', async (t) => {
  const root = sandbox(t, { g1: ['alpha'], g2: ['alpha'] });
  const pinned = { ...niche, focus: { ...niche.focus, pinned: ['alpha'], exclude: ['beta'] } };
  const { state } = await reviewFocus({ root, niche: pinned, cards, items: [], state: initialFocus(pinned), trigger: 'weekly', autocomplete, listing });
  assert.deepEqual(state.active.map((a) => a.productId), ['alpha', 'gamma']);
  const down = async () => { throw new Error('offline'); };
  const failed = await reviewFocus({ root, niche: { ...niche, focus: { ...niche.focus, products: [] } }, cards, items: [], state: { ...initialFocus(niche), active: [] }, trigger: 'weekly', autocomplete: down, listing });
  assert.deepEqual(failed.state.active, []);
  assert.equal(failed.change, null);
  assert.equal(failed.state.history.at(-1).note, 'no change');
});

test('an empty idea queue retires the most covered product early, if it has at least half the guides', async (t) => {
  const wide = { ...niche, focus: { ...niche.focus, rotation: { ...niche.focus.rotation, coveredAfterGuides: 4, maxActive: 1 } } };
  const root = sandbox(t, { g1: ['alpha'], g2: ['alpha'] });
  const { change } = await reviewFocus({ root, niche: wide, cards, items: [], state: initialFocus(wide), trigger: 'idea queue empty', autocomplete, listing });
  assert.match(change.removed[0].reason, /idea queue empty/);
  const weekly = await reviewFocus({ root, niche: wide, cards, items: [], state: initialFocus(wide), trigger: 'weekly', autocomplete, listing });
  assert.equal(weekly.change, null, 'on a weekly review 2 of 4 guides is not covered');
});

test('undo restores what was retired and excludes what was added, until allowed again', async (t) => {
  const root = sandbox(t, { g1: ['alpha'], g2: ['alpha'] });
  const { state } = await reviewFocus({ root, niche, cards, items: [], state: initialFocus(niche), trigger: 'weekly', autocomplete, listing });
  const undone = undoLastChange(state, { by: 'ron' });
  assert.deepEqual(undone.active.map((a) => a.productId), ['alpha']);
  assert.deepEqual(undone.excluded.map((e) => e.productId), ['beta', 'gamma']);
  assert.ok(undone.history.find((h) => h.trigger === 'weekly').undone);
  assert.throws(() => undoLastChange(undone), /No focus change to undo|undone/);
  assert.deepEqual(allowProduct(undone, 'beta').excluded.map((e) => e.productId), ['gamma']);
});

test('commit messages name focus changes', () => {
  assert.equal(commitMessage({ ran: null, changedFiles: [FOCUS_PATH], focus: { added: ['beta'], removed: ['alpha'], trigger: 'weekly' } }), 'tick: focus +beta -alpha (weekly)');
  assert.match(commitMessage({ ran: 'idea', created: ['x'], focus: { added: ['beta'], removed: [], trigger: 'weekly' } }), /^tick\(idea\): created x · focus \+beta$/);
});

test('the tick runs a due review, commits the state, and agents see the live focus', async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'focus-tick-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  cpSync(join(repoRoot, 'niches'), join(root, 'niches'), { recursive: true });
  cpSync(join(repoRoot, 'knowledge'), join(root, 'knowledge'), { recursive: true });
  let seen = null;
  const focusReview = async ({ state, now, trigger }) => ({
    state: { ...state, active: [{ productId: 'new-one', since: now.toISOString(), reason: 'test' }], lastReviewAt: now.toISOString() },
    change: { at: now.toISOString(), trigger, added: ['new-one'], removed: state.active.map((a) => ({ productId: a.productId, reason: 'test' })) },
  });
  const idea = loadAgents().filter((a) => a.name === 'idea');
  const result = await tick({ root, agents: idea, focusReview, dailyDigests: () => ['data/reports/daily/2026-12-01.json'], demandCollector: null, runner: fakeRunner({ idea: (input) => { seen = input.niche.focus.products; return { items: [] }; } }) });
  assert.deepEqual(seen, ['new-one']);
  assert.ok(result.changedFiles.includes(FOCUS_PATH));
  assert.ok(result.changedFiles.includes('data/reports/daily/2026-12-01.json'), 'daily digests are committed with the tick');
  assert.deepEqual(result.focus.added, ['new-one']);
  assert.equal(readFocus(root).active[0].productId, 'new-one');
  assert.match(readFileSync(join(root, '.backoffice', 'runs.jsonl'), 'utf8'), /"workflow":"focus-review"/);
  const again = await tick({ root, agents: idea, focusReview: () => { throw new Error('not due'); }, demandCollector: null, runner: fakeRunner({ idea: () => ({ items: [] }) }), ignoreSchedule: true });
  assert.ok(!again.changedFiles.includes(FOCUS_PATH), 'no review a second time the same day');
});
