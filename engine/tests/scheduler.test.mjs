import test from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadAgents } from '../agents/registry.mjs';
import { newItem } from '../state/machine.mjs';
import { repoRoot } from '../state/niche.mjs';
import { loadItems, readRuns, saveItem } from '../state/store.mjs';
import { validateRepo } from '../state/validate-repo.mjs';
import { fakeRunner } from '../runner/index.mjs';
import { planTick, tick } from '../scheduler/tick.mjs';

const agents = loadAgents();
const fixture = (name, kind = 'valid') =>
  JSON.parse(readFileSync(join(repoRoot, 'engine/agents', name, 'fixtures', `${kind}.json`), 'utf8'));

function sandbox(t) {
  const root = mkdtempSync(join(tmpdir(), 'engine-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  cpSync(join(repoRoot, 'niches'), join(root, 'niches'), { recursive: true });
  return root;
}

const ideaCard = (id) => ({ ...fixture('idea').items[0], id, question: `Question for ${id}?` });

/** Valid fake outputs for every agent. Override per test. */
function handlers(overrides = {}) {
  return {
    idea: () => ({ items: ['sour-shots', 'grinder-retention', 'descale-light'].map(ideaCard) }),
    'idea-judge': (input) => ({
      decisions: input.items.map(({ item }, index) => ({
        itemId: item.id,
        outcome: index === 0 ? 'advance' : 'reject',
        reason: index === 0 ? 'Best demand evidence' : 'Weaker than the advanced idea',
        artifact: fixture('idea-judge').decisions[0].artifact,
      })),
    }),
    research: () => fixture('research'),
    angle: () => fixture('angle'),
    writer: () => fixture('writer'),
    'post-judge': () => fixture('post-judge'),
    ...overrides,
  };
}

const statuses = (root) => Object.fromEntries(loadItems(root).items.map((item) => [item.id, item.status]));
const later = (hours) => new Date(Date.now() + hours * 3_600_000);

test('simulated items advance idea → passed with one revision loop, and every change is logged', async (t) => {
  const root = sandbox(t);
  let judged = 0;
  const runner = fakeRunner(handlers({
    'post-judge': () => {
      judged += 1;
      if (judged > 1) return fixture('post-judge');
      const review = structuredClone(fixture('post-judge'));
      review.outcome = 'revise';
      review.reason = 'Opening buries the recommendation';
      review.artifact.blockingActions = ['Move the recommendation into the first paragraph'];
      return review;
    },
    writer: (input) => {
      if (judged === 1) assert.ok(input.artifacts['post-judge'], 'revision pass sees the judge review');
      return fixture('writer');
    },
  }));

  const order = [];
  for (let i = 0; i < 10; i += 1) {
    const result = await tick({ root, runner });
    if (!result.ran) break;
    assert.equal(result.error, undefined, result.error);
    order.push(result.ran);
  }
  assert.deepEqual(order, ['idea', 'idea-judge', 'research', 'angle', 'writer', 'post-judge', 'writer', 'post-judge']);
  assert.deepEqual(statuses(root), { 'sour-shots': 'passed', 'grinder-retention': 'rejected', 'descale-light': 'rejected' });

  const item = loadItems(root).items.find((candidate) => candidate.id === 'sour-shots');
  assert.equal(item.revisions, 1);
  assert.deepEqual(item.history.map((entry) => entry.to),
    ['idea', 'idea_approved', 'researched', 'briefed', 'drafted', 'briefed', 'drafted', 'passed']);
  assert.deepEqual(Object.keys(item.artifacts).sort(), ['angle', 'idea', 'idea-judge', 'post-judge', 'research', 'writer']);

  const changes = readRuns(root).filter((run) => run.itemId === 'sour-shots');
  assert.equal(changes.length, 8);
  assert.ok(changes.every((run) => run.status === 'completed' && run.agent && Number.isInteger(run.durationMs)));
  assert.deepEqual(validateRepo(root).errors, []);
});

test('invalid output is rejected, counted, and blocks the item after two failures', async (t) => {
  const root = sandbox(t);
  saveItem(root, newItem({ id: 'sour-shots', niche: 'coffee', status: 'idea_approved', by: 'test' }));
  const runner = fakeRunner(handlers({ research: () => fixture('research', 'invalid') }));

  const first = await tick({ root, runner });
  assert.equal(first.ran, 'research');
  assert.match(first.error, /schema validation/);
  let [item] = loadItems(root).items;
  assert.equal(item.status, 'idea_approved');
  assert.equal(item.attempts, 1);
  assert.match(item.lastError, /schema validation/);

  await tick({ root, runner });
  [item] = loadItems(root).items;
  assert.equal(item.status, 'blocked');
  assert.equal(item.resumeStatus, 'idea_approved');
  assert.match(item.blockedReason, /research failed 2 times/);

  const failures = readRuns(root).filter((run) => run.status === 'failed');
  assert.equal(failures.length, 2);
  assert.equal(failures[1].to, 'blocked');
  // Nothing is written to the research folder for a rejected output.
  assert.equal(item.artifacts.research, undefined);
});

test('a thrown agent error counts as a failure; an unavailable runner does not', async (t) => {
  const root = sandbox(t);
  saveItem(root, newItem({ id: 'sour-shots', niche: 'coffee', status: 'idea_approved', by: 'test' }));
  const crash = await tick({ root, runner: fakeRunner(handlers({ research: () => { throw new Error('tool crashed'); } })) });
  assert.equal(crash.failures[0].attempts, 1);

  const unavailable = await tick({ root, runner: fakeRunner({}) });
  assert.equal(unavailable.runnerUnavailable, true);
  assert.equal(loadItems(root).items[0].attempts, 1);
  assert.equal(readRuns(root).at(-1).runnerUnavailable, true);
});

test('queue cap stops the idea agent at 10 waiting items', () => {
  const items = Array.from({ length: 10 }, (_, i) => newItem({ id: `idea-${i}`, niche: 'coffee', status: i % 2 ? 'idea' : 'idea_approved', by: 'test' }));
  const ideaOnly = agents.filter((agent) => agent.name === 'idea');
  const capped = planTick({ agents: ideaOnly, items, runs: [] });
  assert.equal(capped.chosen, null);
  assert.match(capped.skipped[0].reason, /queue cap: 10/);
  assert.equal(planTick({ agents: ideaOnly, items: items.slice(1), runs: [] }).chosen.agent.name, 'idea');
});

test('the idea agent respects its daily schedule', () => {
  const ideaOnly = agents.filter((agent) => agent.name === 'idea');
  const runs = [{ timestamp: new Date().toISOString(), agent: 'idea', status: 'completed' }];
  assert.equal(planTick({ agents: ideaOnly, items: [], runs }).chosen, null);
  assert.equal(planTick({ agents: ideaOnly, items: [], runs, now: later(25) }).chosen.agent.name, 'idea');
});

test('an unavailable runner does not use up the schedule interval', () => {
  const ideaOnly = agents.filter((agent) => agent.name === 'idea');
  const runs = [{ timestamp: new Date().toISOString(), agent: 'idea', status: 'failed', runnerUnavailable: true }];
  assert.equal(planTick({ agents: ideaOnly, items: [], runs }).chosen.agent.name, 'idea');
});

test('later pipeline stages run before earlier ones', () => {
  const items = [
    newItem({ id: 'a', niche: 'coffee', status: 'idea', by: 'test' }),
    newItem({ id: 'b', niche: 'coffee', status: 'drafted', by: 'test' }),
  ];
  assert.equal(planTick({ agents, items, runs: [] }).chosen.agent.name, 'post-judge');
});

test('idea judge may advance at most 3 and must decide on every idea', async (t) => {
  const root = sandbox(t);
  for (const id of ['a', 'b', 'c', 'd']) saveItem(root, newItem({ id, niche: 'coffee', by: 'test' }));
  const decide = (outcome) => (input) => ({
    decisions: input.items.map(({ item }) => ({ itemId: item.id, outcome, reason: 'r', artifact: fixture('idea-judge').decisions[0].artifact })),
  });
  // The idea agent is capped out of the way by schedule.
  const now = new Date();
  const onlyJudge = agents.filter((agent) => agent.name === 'idea-judge');

  const tooMany = await tick({ root, runner: fakeRunner(handlers({ 'idea-judge': decide('advance') })), agents: onlyJudge, now });
  assert.match(tooMany.error, /advanced 4 items \(max 3\)/);
  assert.ok(loadItems(root).items.every((item) => item.status === 'idea' && item.attempts === 1));

  const partial = await tick({
    root, agents: onlyJudge, now,
    runner: fakeRunner(handlers({ 'idea-judge': (input) => ({ decisions: decide('reject')(input).decisions.slice(1) }) })),
  });
  assert.match(partial.error, /every input item/);
  assert.ok(loadItems(root).items.every((item) => item.status === 'blocked'));
});

test('a second revise sends the draft to needs_human', async (t) => {
  const root = sandbox(t);
  saveItem(root, { ...newItem({ id: 'sour-shots', niche: 'coffee', status: 'drafted', by: 'test' }), revisions: 1 });
  const revise = { ...fixture('post-judge'), outcome: 'revise', reason: 'Still generic' };
  const result = await tick({ root, runner: fakeRunner(handlers({ 'post-judge': () => revise })) });
  assert.deepEqual(result.results, [{ id: 'sour-shots', outcome: 'revise', to: 'needs_human' }]);
  const [item] = loadItems(root).items;
  assert.equal(item.resumeStatus, 'drafted');
  assert.match(item.blockedReason, /revise limit \(1\) reached/);
});

test('the idea agent cannot reuse an existing id', async (t) => {
  const root = sandbox(t);
  saveItem(root, newItem({ id: 'sour-shots', niche: 'coffee', status: 'rejected', by: 'test' }));
  const result = await tick({ root, runner: fakeRunner(handlers()) });
  assert.equal(result.ran, 'idea');
  assert.match(result.error, /duplicate id sour-shots/);
  assert.equal(loadItems(root).items.length, 1);
  assert.equal(readRuns(root).at(-1).status, 'failed');
});

test('a corrupt item file stops the tick instead of being skipped', async (t) => {
  const root = sandbox(t);
  saveItem(root, newItem({ id: 'ok', niche: 'coffee', by: 'test' }));
  const bad = { ...newItem({ id: 'bad', niche: 'coffee', by: 'test' }), status: 'shipped' };
  const { writeJsonAtomic } = await import('../state/store.mjs');
  writeJsonAtomic(join(root, 'data/items/bad.json'), bad);
  await assert.rejects(tick({ root, runner: fakeRunner(handlers()) }), /Item store is invalid/);
});
