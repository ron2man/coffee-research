// The feedback loop: checks → critic → tuner → human applies or rejects.
import test from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { instructionsFor, loadAgents } from '../agents/registry.mjs';
import { repoRoot } from '../state/niche.mjs';
import { fakeRunner } from '../runner/index.mjs';
import { tick } from '../scheduler/tick.mjs';
import { listFeedback, listProposals, openFeedback, readReviewState } from '../feedback/store.mjs';
import { addHumanNote, applyProposal, diffProposal, rejectProposal } from '../feedback/cli.mjs';
import { runChecks } from '../feedback/checks.mjs';

const fixture = (name) => JSON.parse(readFileSync(join(repoRoot, 'engine/agents', name, 'fixtures', 'valid.json'), 'utf8'));
// Give the loop agents a prompt so the planner does not skip them.
const agents = loadAgents().map((agent) => (['critic', 'tuner'].includes(agent.name) ? { ...agent, promptPath: '/dev/null' } : agent));
const only = (...names) => agents.filter((agent) => names.includes(agent.name));

function sandbox(t) {
  const root = mkdtempSync(join(tmpdir(), 'engine-feedback-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const dir of ['niches', 'knowledge']) cpSync(join(repoRoot, dir), join(root, dir), { recursive: true });
  return root;
}

const card = (id, signals) => ({ ...fixture('idea').items[0], id, question: `Q ${id}?`, demand: { kind: 'qualitative', signals } });
const signal = (url, date = '2026-10-01') => ({ url, date, note: 'asks this' });

test('idea checks warn on thin, reused, old and same-slug evidence', () => {
  const { warnings } = runChecks('idea', [
    { artifact: card('a', [signal('https://forum.test/1')]) },
    { artifact: card('b', [signal('https://forum.test/1'), signal('https://forum.test/2', '2018-01-01')]) },
  ], { today: '2026-11-21', existingContent: [{ slug: 'a', path: 'content/archive/drafts/a.md' }] });
  assert.ok(warnings.some((w) => /a: qualitative demand rests on 1/.test(w)));
  assert.ok(warnings.some((w) => /b: reuses the signal/.test(w)));
  assert.ok(warnings.some((w) => /older than 24 months/.test(w)));
  assert.ok(warnings.some((w) => /same slug as existing content/.test(w)));
});

test('checks → critic → tuner → apply closes the loop', async (t) => {
  const root = sandbox(t);
  const ideas = () => ({ items: ['a', 'b', 'c'].map((id) => card(id, [signal('https://forum.test/shared')])) });
  const idea = await tick({ root, agents: only('idea', 'critic', 'tuner'), runner: fakeRunner({ idea: ideas }) });
  assert.equal(idea.ran, 'idea');
  assert.ok(idea.warnings.length >= 3, 'deterministic checks ran');
  assert.equal(listFeedback(root, 'idea')[0].source, 'check');

  let criticInput;
  const critic = await tick({
    root, agents: only('idea', 'critic', 'tuner'),
    runner: fakeRunner({ critic: (input) => { criticInput = input; return fixture('critic'); } }),
  });
  assert.equal(critic.ran, 'critic');
  assert.equal(critic.review.target, 'idea');
  assert.equal(criticInput.outputs.length, 3);
  assert.match(criticInput.target.instructions, /# Idea agent/);
  assert.equal(criticInput.openFeedback.length, 1, 'the critic sees the check warnings');
  assert.ok(readReviewState(root).reviewedUntil.idea);

  // Nothing new to review; two open entries → the tuner proposes.
  let tunerInput;
  const tuner = await tick({
    root, agents: only('idea', 'critic', 'tuner'),
    runner: fakeRunner({
      tuner: (input) => {
        tunerInput = input;
        const out = structuredClone(fixture('tuner'));
        out.artifact.addresses = input.feedback.map((entry) => entry.id);
        return out;
      },
    }),
  });
  assert.equal(tuner.ran, 'tuner');
  assert.equal(tunerInput.files.prompt.path, 'engine/agents/idea/prompt.md');
  const [proposal] = listProposals(root);
  assert.equal(proposal.status, 'open');
  assert.match(diffProposal(root, proposal), /Require at least two independent signals/);

  // While a proposal is open the tuner does not run again for that agent.
  const idle = await tick({ root, agents: only('critic', 'tuner'), runner: fakeRunner({}) });
  assert.equal(idle.ran, null);

  const written = applyProposal(root, proposal.id, { by: 'ron' });
  assert.ok(written.includes('engine/agents/idea/prompt.md'));
  assert.match(readFileSync(join(root, 'engine/agents/idea/prompt.md'), 'utf8'), /two independent signals/);
  assert.equal(listProposals(root)[0].status, 'applied');
  assert.deepEqual(openFeedback(root, 'idea'), []);
});

test('a tuner that cites unknown feedback is rejected; human notes trigger tuning and rejections are remembered', async (t) => {
  const root = sandbox(t);
  addHumanNote(root, 'idea', 'Signals must come from owner communities, not off-topic boards', { by: 'ron' });
  assert.throws(() => addHumanNote(root, 'nope', 'x'), /Unknown pipeline agent/);

  const bad = await tick({ root, agents: only('idea', 'tuner'), runner: fakeRunner({ tuner: () => ({ artifact: { ...fixture('tuner').artifact, addresses: ['made-up'] } }) }) });
  assert.match(bad.error, /unknown feedback ids: made-up/);

  const good = await tick({
    root, agents: only('idea', 'tuner'),
    runner: fakeRunner({ tuner: (input) => ({ artifact: { ...fixture('tuner').artifact, addresses: input.feedback.map((e) => e.id) } }) }),
  });
  assert.equal(good.ran, 'tuner');
  const [proposal] = listProposals(root);
  assert.throws(() => rejectProposal(root, proposal.id, {}), /--reason is required/);
  rejectProposal(root, proposal.id, { reason: 'Too vague', by: 'ron' });
  let seen;
  await tick({ root, agents: only('idea', 'tuner'), runner: fakeRunner({ tuner: (input) => { seen = input; return { artifact: { ...fixture('tuner').artifact, addresses: [] } }; } }) });
  assert.equal(seen.recentlyRejected[0].rejectionReason, 'Too vague');
});

test('proposals may only change prompts and niche guidance', (t) => {
  const root = sandbox(t);
  mkdirSync(join(root, 'data/prompt-proposals'), { recursive: true });
  writeFileSync(join(root, 'data/prompt-proposals/x.json'), JSON.stringify({
    id: 'x', agent: 'idea', status: 'open', summary: 's', addresses: [], notAddressed: [],
    changes: [{ file: 'prompt', path: 'engine/scheduler/tick.mjs', newText: 'x'.repeat(60), why: 'w' }],
  }));
  assert.throws(() => applyProposal(root, 'x'), /may only change prompts/);
});

test('instructions include niche guidance and listed niche files', (t) => {
  const root = sandbox(t);
  mkdirSync(join(root, 'niches/coffee/agents'), { recursive: true });
  writeFileSync(join(root, 'niches/coffee/agents/idea.md'), 'Search the owner forums first.');
  const idea = agents.find((agent) => agent.name === 'idea');
  const text = instructionsFor({ ...idea, nicheFiles: ['style.md'] }, root, 'coffee');
  assert.match(text, /# Idea agent/);
  assert.match(text, /Niche guidance \(coffee\)\n\nSearch the owner forums first/);
  assert.match(text, /Niche file: style.md/);
  assert.throws(() => instructionsFor({ ...idea, nicheFiles: ['missing.md'] }, root, 'coffee'), /niche file missing.md not found/);
});

test('writer checks: product tokens must have cards, untokenised products and missing guides warn', () => {
  const cards = new Map([['machine-a', { card: { claims: [] } }]]);
  const draft = (body, productIds = ['machine-a']) => ({ itemId: 'x', artifact: { title: 'T', description: 'D', body, productIds, claims: [], humanData: [] } });
  const bad = runChecks('writer', [draft('Use the {{product:machine-z}}.')], { cards, existingContent: [] });
  assert.ok(bad.blocking.some((b) => /machine-z.*no knowledge card/.test(b)));
  const plain = runChecks('writer', [draft('Use the Machine A. See {{guide:other-guide|the other guide}}.')], { cards, existingContent: [] });
  assert.ok(plain.warnings.some((w) => /never named with \{\{product:machine-a\}\}/.test(w)));
  assert.ok(plain.warnings.some((w) => /guide other-guide, which doesn't exist yet/.test(w)));
});

test('writer checks: offered products need knowledge cards', () => {
  const cards = new Map([['machine-a', { card: { claims: [] } }]]);
  const { blocking } = runChecks('writer', [{ itemId: 'x', artifact: { title: 'T', description: 'D', body: 'Fix your {{product:machine-a}}.', productIds: ['machine-a'], offerIds: ['grinder-z'], claims: [] } }], { cards, existingContent: [] });
  assert.ok(blocking.some((b) => /offers grinder-z, which has no knowledge card/.test(b)));
});

test('testing-claim lint: real claims fail, workflow wording and disclaimers pass', async () => {
  const { testingClaims } = await import('../feedback/checks.mjs');
  assert.deepEqual(testingClaims("It's more hands-on per shot."), []);
  assert.deepEqual(testingClaims("We haven't tested either machine, and there was no hands-on testing."), []);
  assert.deepEqual(testingClaims('We did not run our own tests.'), []);
  assert.deepEqual(testingClaims('In our testing it was quiet.'), ['In our testing']);
  assert.deepEqual(testingClaims("We've tested it for a month."), ["We've tested"]);
  assert.deepEqual(testingClaims('Our hands-on review found it loud.'), ['Our hands-on']);
});

test('title rules: measured in the longest market after product names are filled in', async () => {
  const { titleProblems } = await import('../feedback/checks.mjs');
  const cards = new Map([['m', { card: { name: 'M', variants: [{ markets: ['US'], name: 'Brand Machine' }, { markets: ['GB'], name: 'Other Brand the Machine Pro Plus' }] } }]]);
  const markets = [{ id: 'US' }, { id: 'GB' }];
  assert.deepEqual(titleProblems({ title: 'Fix a fast {{product:m}} shot', description: 'd' }, { cards, markets }), []);
  const long = '{{product:m}} still too fast at grind setting 1? Check these in order first';
  const problems = titleProblems({ title: long, description: 'd' }, { cards, markets });
  assert.ok(problems.some((p) => /title is 1\d\d characters|title is \d\d characters with/.test(p)));
  assert.ok(problems.some((p) => /add a seoTitle/.test(p)));
  assert.deepEqual(titleProblems({ title: 'Fast {{product:m}} shots? Check these first', seoTitle: 'Fast {{product:m}} shots: what to check', description: 'd' }, { cards, markets }), []);
});
