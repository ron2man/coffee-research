import test from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { hostname, tmpdir } from 'node:os';
import { join } from 'node:path';
import { LockedError, acquireLock, isStale, lockPath } from '../scheduler/lock.mjs';
import { repoRoot } from '../state/niche.mjs';
import { newItem } from '../state/machine.mjs';
import { saveItem } from '../state/store.mjs';
import { fakeRunner } from '../runner/index.mjs';
import { tick } from '../scheduler/tick.mjs';

function sandbox(t) {
  const root = mkdtempSync(join(tmpdir(), 'engine-lock-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  cpSync(join(repoRoot, 'niches'), join(root, 'niches'), { recursive: true });
  cpSync(join(repoRoot, 'knowledge'), join(root, 'knowledge'), { recursive: true });
  return root;
}

test('a second lock is refused while the first is held, and released afterwards', (t) => {
  const root = sandbox(t);
  const release = acquireLock(root);
  assert.throws(() => acquireLock(root), LockedError);
  release();
  assert.equal(existsSync(lockPath(root)), false);
  acquireLock(root)();
});

test('stale locks (dead process, too old, unreadable) are taken over', (t) => {
  const root = sandbox(t);
  mkdirSync(join(root, '.backoffice'), { recursive: true });
  writeFileSync(lockPath(root), JSON.stringify({ pid: 999_999_999, host: hostname(), label: 'tick', startedAt: new Date().toISOString() }));
  acquireLock(root)();
  writeFileSync(lockPath(root), 'not json');
  acquireLock(root)();
  const old = { pid: process.pid, host: 'other-machine', startedAt: new Date(Date.now() - 4 * 3_600_000).toISOString() };
  assert.equal(isStale(old), true);
  assert.equal(isStale({ ...old, startedAt: new Date().toISOString() }), false, 'a fresh lock from another host is respected');
});

test('a tick that finds the lock held does nothing', async (t) => {
  const root = sandbox(t);
  saveItem(root, newItem({ id: 'sour-shots', niche: 'coffee', status: 'idea_approved', by: 'test' }));
  const release = acquireLock(root);
  let called = false;
  const result = await tick({ root, runner: fakeRunner({ research: () => { called = true; } }) });
  release();
  assert.equal(result.locked, true);
  assert.equal(called, false);
});
