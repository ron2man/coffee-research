import test from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadAgents } from '../agents/registry.mjs';
import { newItem } from '../state/machine.mjs';
import { repoRoot } from '../state/niche.mjs';
import { loadItems, readRuns, saveItem } from '../state/store.mjs';
import { listFeedback } from '../feedback/store.mjs';
import { validateRepo } from '../state/validate-repo.mjs';
import { fakeRunner } from '../runner/index.mjs';
import { SCHEDULE_PATH, planTick, readSchedule, tick } from '../scheduler/tick.mjs';

const allAgents = loadAgents();
// Pipeline agents only; the feedback loop (critic, tuner) has its own tests.
const agents = allAgents.filter((agent) => !['review', 'tune'].includes(agent.mode));
const fixture = (name, kind = 'valid') =>
  JSON.parse(readFileSync(join(repoRoot, 'engine/agents', name, 'fixtures', `${kind}.json`), 'utf8'));

function sandbox(t) {
  const root = mkdtempSync(join(tmpdir(), 'engine-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  cpSync(join(repoRoot, 'niches'), join(root, 'niches'), { recursive: true });
  cpSync(join(repoRoot, 'knowledge'), join(root, 'knowledge'), { recursive: true });
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
    const result = await tick({ root, agents, runner, agents });
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

  const first = await tick({ root, agents, runner });
  assert.equal(first.ran, 'research');
  assert.match(first.error, /schema validation/);
  let [item] = loadItems(root).items;
  assert.equal(item.status, 'idea_approved');
  assert.equal(item.attempts, 1);
  assert.match(item.lastError, /schema validation/);

  await tick({ root, agents, runner });
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
  const crash = await tick({ root, agents, runner: fakeRunner(handlers({ research: () => { throw new Error('tool crashed'); } })) });
  assert.equal(crash.failures[0].attempts, 1);

  const unavailable = await tick({ root, agents, runner: fakeRunner({}) });
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

test('idea judge: extra advances are converted to reject by score; every idea needs a decision', async (t) => {
  const root = sandbox(t);
  const ids = ['a', 'b', 'c', 'd'];
  for (const id of ids) saveItem(root, newItem({ id, niche: 'coffee', by: 'test' }));
  const scored = (total) => {
    const artifact = structuredClone(fixture('idea-judge').decisions[0].artifact);
    for (const entry of Object.values(artifact.scores)) entry.score = 1;
    artifact.scores.demandEvidence.score = total;
    return artifact;
  };
  const scores = { a: 2, b: 5, c: 4, d: 5 };
  const decide = (outcome) => (input) => ({
    decisions: input.items.map(({ item }) => ({ itemId: item.id, outcome, reason: 'r', artifact: scored(scores[item.id]) })),
  });
  const now = new Date();
  const onlyJudge = agents.filter((agent) => agent.name === 'idea-judge');

  const tooMany = await tick({ root, agents, runner: fakeRunner(handlers({ 'idea-judge': decide('advance') })), agents: onlyJudge, now });
  assert.equal(tooMany.error, undefined);
  assert.match(tooMany.warnings[0], /converted to reject: a/);
  assert.deepEqual(statuses(root), { a: 'rejected', b: 'idea_approved', c: 'idea_approved', d: 'idea_approved' });
  const a = loadItems(root).items.find((item) => item.id === 'a');
  assert.match(a.history.at(-1).reason, /Over the advance cap \(3\)/);

  // A judge without an overflow outcome still fails the whole run.
  const strict = onlyJudge.map((agent) => ({ ...agent, maxAdvance: { outcome: 'advance', max: 3 } }));
  const root2 = sandbox(t);
  for (const id of ids) saveItem(root2, newItem({ id, niche: 'coffee', by: 'test' }));
  const failed = await tick({ root: root2, agents, runner: fakeRunner(handlers({ 'idea-judge': decide('advance') })), agents: strict, now });
  assert.match(failed.error, /advanced 4 items \(max 3\)/);

  const partial = await tick({
    root: root2, agents: onlyJudge, now,
    runner: fakeRunner(handlers({ 'idea-judge': (input) => ({ decisions: decide('reject')(input).decisions.slice(1) }) })),
  });
  assert.match(partial.error, /every input item/);
  assert.ok(loadItems(root2).items.every((item) => item.status === 'blocked'));
});

test('a second revise sends the draft to needs_human', async (t) => {
  const root = sandbox(t);
  saveItem(root, { ...newItem({ id: 'sour-shots', niche: 'coffee', status: 'drafted', by: 'test' }), revisions: 1 });
  const revise = { ...fixture('post-judge'), outcome: 'revise', reason: 'Still generic' };
  const result = await tick({ root, agents, runner: fakeRunner(handlers({ 'post-judge': () => revise })) });
  assert.deepEqual(result.results, [{ id: 'sour-shots', outcome: 'revise', to: 'needs_human' }]);
  const [item] = loadItems(root).items;
  assert.equal(item.resumeStatus, 'drafted');
  assert.match(item.blockedReason, /revise limit \(1\) reached/);
});

test('the idea agent cannot reuse an existing id', async (t) => {
  const root = sandbox(t);
  saveItem(root, newItem({ id: 'sour-shots', niche: 'coffee', status: 'rejected', by: 'test' }));
  const result = await tick({ root, agents, runner: fakeRunner(handlers()) });
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
  await assert.rejects(tick({ root, agents, runner: fakeRunner(handlers()) }), /Item store is invalid/);
});

test('the schedule is kept in a committed state file, so a fresh checkout respects it', async (t) => {
  const root = sandbox(t);
  const result = await tick({ root, agents, runner: fakeRunner(handlers()) });
  assert.equal(result.ran, 'idea');
  assert.ok(result.changedFiles.includes(SCHEDULE_PATH));
  assert.ok(readSchedule(root).agents.idea.lastRunAt);
  // Lose the local run log (new machine): the committed state still holds the interval.
  const onlyIdea = agents.filter((agent) => agent.name === 'idea');
  assert.equal(planTick({ agents: onlyIdea, items: [], runs: [], schedule: readSchedule(root) }).chosen, null);
  assert.equal(planTick({ agents: onlyIdea, items: [], runs: [], schedule: readSchedule(root), now: later(25) }).chosen.agent.name, 'idea');
});

test('rejected output is kept with its usage, and --ignore-schedule allows a manual rerun', async (t) => {
  const root = sandbox(t);
  const runner = { type: 'fake', run: async () => ({ output: { items: [{ id: 'bad' }] }, usage: { costUsd: 0.5 } }) };
  const result = await tick({ root, agents, runner });
  assert.match(result.error, /schema validation/);
  const kept = JSON.parse(readFileSync(join(root, result.rejectedOutput), 'utf8'));
  assert.deepEqual(kept.usage, { costUsd: 0.5 });
  assert.equal(readRuns(root).at(-1).usage.costUsd, 0.5);
  const onlyIdea = agents.filter((agent) => agent.name === 'idea');
  assert.equal(planTick({ agents: onlyIdea, items: [], runs: readRuns(root), schedule: readSchedule(root) }).chosen, null);
  assert.equal(planTick({ agents: onlyIdea, items: [], runs: readRuns(root), schedule: readSchedule(root), ignoreSchedule: true }).chosen.agent.name, 'idea');
});

test('research card changes are validated, cannot drop claims, and make new claims citable', async (t) => {
  const root = sandbox(t);
  saveItem(root, newItem({ id: 'sour-shots', niche: 'coffee', status: 'idea_approved', by: 'test' }));
  const card = (claims) => `# Test Grinder\n\n\`\`\`json\n${JSON.stringify({
    schemaVersion: 1, id: 'test-grinder', name: 'Test Grinder', category: 'grinders', updatedAt: '2026-11-21',
    variants: [{ id: 'us', markets: ['US'] }],
    sources: [{ id: 'manual', url: 'https://example.com/manual', type: 'manufacturer', accessedAt: '2026-11-21' }],
    claims,
  }, null, 2)}\n\`\`\`\n`;
  const claim = (id) => ({ id, statement: `Claim ${id}.`, status: 'supported', verifiedAt: '2026-11-21', evidence: [{ sourceId: 'manual', locator: 'p. 2' }] });
  const output = (claims, claimIds) => ({ ...fixture('research'), artifact: { ...fixture('research').artifact, claimIds,
    cardChanges: [{ path: 'knowledge/grinders/test-grinder.md', content: card(claims), summary: 'New card' }] } });

  const onlyResearch = agents.filter((agent) => agent.name === 'research');
  const ok = await tick({ root, agents: onlyResearch, runner: fakeRunner(handlers({ research: () => output([claim('burr-size'), claim('steps')], ['test-grinder/burr-size']) })) });
  assert.equal(ok.error, undefined, ok.error);
  assert.deepEqual(ok.cardsChanged, ['knowledge/grinders/test-grinder.md']);
  assert.ok(ok.changedFiles.includes('knowledge/grinders/test-grinder.md'));

  // Next item: a change that drops an existing claim is refused, and nothing is written.
  saveItem(root, newItem({ id: 'next', niche: 'coffee', status: 'idea_approved', by: 'test' }));
  const dropped = await tick({ root, agents: onlyResearch, runner: fakeRunner(handlers({ research: () => output([claim('burr-size')], []) })) });
  assert.match(dropped.error, /drops existing claims: steps/);
  assert.match(readFileSync(join(root, 'knowledge/grinders/test-grinder.md'), 'utf8'), /"steps"/);

  const missing = await tick({ root, agents: onlyResearch, runner: fakeRunner(handlers({ research: () => ({ ...fixture('research'), artifact: { ...fixture('research').artifact, claimIds: ['test-grinder/nope'] } }) })) });
  assert.match(missing.error, /claim test-grinder\/nope does not exist/);
  assert.ok(listFeedback(root, 'research').some((entry) => entry.source === 'check'), 'blocking checks are logged as feedback');
});

test('writer lint: inline links, invented testing and unsupported claims fail the draft', async (t) => {
  const root = sandbox(t);
  saveItem(root, newItem({ id: 'sour-shots', niche: 'coffee', status: 'briefed', by: 'test' }));
  const filler = ' Start with the basket, then the dose, then the grind.'.repeat(6);
  const draft = (body) => ({ ...fixture('writer'), artifact: { ...fixture('writer').artifact, body: body.replace('{filler}', filler) } });
  const links = 'Get the [a](https://a.test) and [b](https://b.test) or [c](https://c.test).';
  const bad = await tick({ root, agents, runner: fakeRunner(handlers({ writer: () => draft(`${links} In our testing it was great.{filler}`) })) });
  assert.match(bad.error, /3 inline links/);
  assert.match(bad.error, /first-hand testing/);
  const sources = '\n\n## When I\'d choose differently\n\nx\n\n## How this guide was put together\n\n[c](https://c.test) [d](https://d.test) [e](https://e.test)';
  const good = await tick({ root, agents, runner: fakeRunner(handlers({ writer: () => draft(`Get the [a](https://a.test).{filler}${sources}`) })) });
  assert.equal(good.error, undefined, good.error);
});

test('seeds: a fresh seed brings the idea run forward, cards cite it, and unused seeds close after 3 runs', async (t) => {
  const { addSeed, listSeeds } = await import('../state/seeds.mjs');
  const root = sandbox(t);
  const onlyIdea = agents.filter((agent) => agent.name === 'idea');
  const first = await tick({ root, agents: onlyIdea, runner: fakeRunner({ idea: () => ({ items: [] }) }) });
  assert.equal(first.ran, 'idea');
  assert.equal((await tick({ root, agents: onlyIdea, runner: fakeRunner({ idea: () => ({ items: [] }) }) })).ran, null, 'daily interval');

  addSeed(root, { text: 'I have a capsule machine and want better coffee', by: 'ron' });
  addSeed(root, { text: 'Is a lever machine worth it', by: 'ron' });
  const [capsule, lever] = listSeeds(root);
  let seen;
  const withSeed = await tick({
    root, agents: onlyIdea,
    runner: fakeRunner({ idea: (input) => { seen = input.seeds; return { items: [{ ...ideaCard('capsule-upgrade'), seedId: capsule.id }] }; } }),
  });
  assert.equal(withSeed.ran, 'idea', 'a fresh seed overrides the interval');
  assert.equal(seen.length, 2);
  const after = Object.fromEntries(listSeeds(root).map((s) => [s.id, s]));
  assert.equal(after[capsule.id].status, 'used');
  assert.deepEqual(after[capsule.id].itemIds, ['capsule-upgrade']);
  assert.equal(after[lever.id].considered, 1);
  assert.equal(after[lever.id].status, 'open');

  const bad = await tick({ root, agents: onlyIdea, ignoreSchedule: true, runner: fakeRunner({ idea: () => ({ items: [{ ...ideaCard('x'), seedId: 'made-up' }] }) }) });
  assert.match(bad.error, /unknown or closed seed made-up/);
  for (let i = 0; i < 2; i += 1) await tick({ root, agents: onlyIdea, ignoreSchedule: true, runner: fakeRunner({ idea: () => ({ items: [] }) }) });
  assert.equal(listSeeds(root).find((s) => s.id === lever.id).status, 'no-demand');
});

test('a seed that waited 2 hours jumps the queue; wanted guide links reach the agents', async (t) => {
  const { addSeed } = await import('../state/seeds.mjs');
  const { writeJsonAtomic } = await import('../state/store.mjs');
  const root = sandbox(t);
  saveItem(root, newItem({ id: 'busy', niche: 'coffee', status: 'idea_approved', by: 'test' }));
  addSeed(root, { text: 'Which grinder for my machine?', at: new Date(Date.now() - 3 * 3_600_000).toISOString() });
  writeJsonAtomic(join(root, 'content/drafts/a.json'), { ...fixture('writer').artifact, slug: 'a', body: 'Then see {{guide:grinder-for-x|our grinder guide}}.' });
  let input;
  const result = await tick({ root, agents, runner: fakeRunner(handlers({ idea: (i) => { input = i; return { items: [] }; } })) });
  assert.equal(result.ran, 'idea', 'the seed beats research on the busy item');
  assert.deepEqual(input.wantedGuides, [{ slug: 'grinder-for-x', linkTexts: ['our grinder guide'], linkedFrom: ['a'] }]);
});

test('the post judge sees the writer checks re-run, and a draft that still fails them cannot pass', async (t) => {
  const { writeJsonAtomic } = await import('../state/store.mjs');
  const root = sandbox(t);
  const longTitle = 'This title is far too long for a search result and keeps going on and on until it is past seventy';
  writeJsonAtomic(join(root, 'content/drafts/x.json'), { ...fixture('writer').artifact, title: longTitle });
  saveItem(root, { ...newItem({ id: 'x', niche: 'coffee', status: 'drafted', by: 'test' }), artifacts: { writer: 'content/drafts/x.json' } });
  let input;
  const result = await tick({ root, agents, runner: fakeRunner(handlers({ 'post-judge': (i) => { input = i; return fixture('post-judge'); } })) });
  assert.ok(input.automatedChecks.blocking.some((b) => /title is \d+ characters/.test(b)));
  assert.deepEqual(result.results, [{ id: 'x', outcome: 'revise', to: 'briefed' }]);
  const review = JSON.parse(readFileSync(join(root, 'data/reviews/x.json'), 'utf8'));
  assert.ok(review.blockingActions.some((a) => /title is/.test(a)));
});
