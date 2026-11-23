import test from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runAction } from '../actions.mjs';
import { articleDetail, articles } from '../today.mjs';
import { newItem, transition } from '../../engine/state/machine.mjs';
import { repoRoot } from '../../engine/state/niche.mjs';
import { loadItems, saveItem, writeJsonAtomic } from '../../engine/state/store.mjs';
import { listFeedback } from '../../engine/feedback/store.mjs';
import { listSeeds } from '../../engine/state/seeds.mjs';
import { acquireLock } from '../../engine/scheduler/lock.mjs';

function sandbox(t) {
  const root = mkdtempSync(join(tmpdir(), 'backoffice-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const dir of ['niches', 'knowledge']) cpSync(join(repoRoot, dir), join(root, dir), { recursive: true });
  let item = newItem({ id: 'post-a', niche: 'coffee', by: 'idea' });
  for (const to of ['idea_approved', 'researched', 'briefed', 'drafted', 'passed']) item = transition(item, to, { by: to === 'passed' ? 'post-judge' : 'test' });
  const draft = { title: 'Fix your {{product:bambino-plus}}', slug: 'post-a', description: 'd', body: 'Keep it.\n\n## When I’d choose differently\n\nBuy a grinder.', productIds: ['bambino-plus'], offerIds: [], claims: [] };
  writeJsonAtomic(join(root, 'content/drafts/post-a.json'), draft);
  saveItem(root, { ...item, artifacts: { writer: 'content/drafts/post-a.json' } });
  return root;
}

test('articles list and detail resolve product names and show what the human may do', (t) => {
  const root = sandbox(t);
  const [a] = articles(root);
  assert.equal(a.status, 'passed');
  assert.doesNotMatch(a.title, /\{\{/);
  const detail = articleDetail(root, 'post-a');
  assert.deepEqual(detail.allowed, { publish: true, comment: true, revise: true, resume: false, reject: true });
  assert.deepEqual(detail.publishBlockers, [], 'sells nothing, so no disclosure needed');
  assert.match(detail.draft.html, /<h2 id="when-id-choose-differently">/);
});

test('dashboard actions: comment, send back to the writer, seed; a running tick blocks them', async (t) => {
  const root = sandbox(t);
  await assert.rejects(runAction(root, 'comment', { itemId: 'post-a', text: '' }, { commit: false }), /Comment is required/);
  await runAction(root, 'comment', { itemId: 'post-a', text: 'Shorter intro' }, { commit: false });
  const revised = await runAction(root, 'revise', { itemId: 'post-a', text: 'End with the grinder' }, { commit: false });
  assert.equal(loadItems(root).items[0].status, 'briefed');
  assert.equal(revised.written.length, 2);
  assert.equal(listFeedback(root, 'writer').length, 2);
  await runAction(root, 'seed', { text: 'Is a lever machine worth it?' }, { commit: false });
  assert.equal(listSeeds(root).length, 1);
  await assert.rejects(runAction(root, 'nope', {}, { commit: false }), /Unknown action/);
  const release = acquireLock(root);
  await assert.rejects(runAction(root, 'seed', { text: 'x' }, { commit: false }), (e) => e.status === 409);
  release();
});

test('run-tick starts ops/tick.sh in the state root, and refuses while a tick holds the lock', async (t) => {
  const { startTick } = await import('../actions.mjs');
  const { mkdirSync, writeFileSync } = await import('node:fs');
  const root = sandbox(t);
  assert.throws(() => startTick(root, { spawnTick: () => ({}) }), /No ops\/tick.sh/);
  mkdirSync(join(root, 'ops'));
  writeFileSync(join(root, 'ops/tick.sh'), '#!/bin/bash\n');
  const calls = [];
  startTick(root, { spawnTick: (cmd, args, opts) => { calls.push({ cmd, args, opts }); return { unref() {} }; } });
  assert.equal(calls[0].cmd, '/bin/bash');
  assert.equal(calls[0].args[0], join(root, 'ops/tick.sh'));
  assert.equal(calls[0].opts.detached, true);
  const release = acquireLock(root);
  assert.throws(() => startTick(root, { spawnTick: () => ({}) }), /already running/);
  release();
});
