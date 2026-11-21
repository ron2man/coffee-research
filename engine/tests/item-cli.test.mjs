import test from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { act } from '../state/item-cli.mjs';
import { newItem, transition } from '../state/machine.mjs';
import { repoRoot } from '../state/niche.mjs';
import { loadItems, readRuns, saveItem } from '../state/store.mjs';

function sandbox(t) {
  const root = mkdtempSync(join(tmpdir(), 'engine-item-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  cpSync(join(repoRoot, 'niches'), join(root, 'niches'), { recursive: true });
  return root;
}
const by = 'test';
const get = (root) => loadItems(root).items[0];

test('resume returns a blocked item to where it stopped, with a logged reason', (t) => {
  const root = sandbox(t);
  let item = transition(newItem({ id: 'x', niche: 'coffee', by }), 'idea_approved', { by });
  saveItem(root, transition({ ...item, attempts: 2 }, 'blocked', { by: 'scheduler', reason: 'research failed 2 times' }));
  assert.throws(() => act(root, 'resume', 'x', {}), /--reason is required/);
  item = act(root, 'resume', 'x', { reason: 'Fixed the source list', by: 'ron' });
  assert.equal(item.status, 'idea_approved');
  assert.equal(item.attempts, 0);
  assert.equal(item.history.at(-1).by, 'human:ron');
  assert.equal(readRuns(root).at(-1).outcome, 'resume');
});

test('reject, park and reopen follow the status machine', (t) => {
  const root = sandbox(t);
  saveItem(root, { ...newItem({ id: 'x', niche: 'coffee', by: 'idea' }), artifacts: { idea: 'data/ideas/x.json' } });
  assert.throws(() => act(root, 'resume', 'x', { reason: 'r' }), /only blocked or needs_human/);
  assert.throws(() => act(root, 'reopen', 'x', { reason: 'r' }), /only rejected/);
  assert.equal(act(root, 'park', 'x', { reason: 'Unsure about demand' }).status, 'needs_human');
  assert.equal(act(root, 'reject', 'x', { reason: 'Duplicate' }).status, 'rejected');
  const reopened = act(root, 'reopen', 'x', { reason: 'New forum threads' });
  assert.equal(reopened.status, 'idea');
  assert.deepEqual(get(root).artifacts, { idea: 'data/ideas/x.json' });
  assert.throws(() => act(root, 'reject', 'missing', { reason: 'r' }), /No item missing/);
});
