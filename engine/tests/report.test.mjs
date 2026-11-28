import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DAILY_DIR, dailyDigest, weekMarkdown, weekReport, writeDailyDigests } from '../report/report.mjs';
import { saveItem } from '../state/store.mjs';
import { newItem, transition } from '../state/machine.mjs';
import { cpSync } from 'node:fs';
import { repoRoot } from '../state/niche.mjs';

const runs = [
  { timestamp: '2026-12-01T09:00:00.000Z', workflow: 'agent:writer', agent: 'writer', itemId: 'a', status: 'completed', from: 'researched', to: 'drafted', durationMs: 120_000, usage: { costUsd: 1.25 } },
  { timestamp: '2026-12-01T10:00:00.000Z', workflow: 'agent:research', agent: 'research', itemId: 'b', status: 'failed', error: 'timed out', durationMs: 60_000 },
  { timestamp: '2026-12-01T11:00:00.000Z', workflow: 'agent:idea', agent: 'idea', status: 'failed', error: 'not signed in', runnerUnavailable: true },
  { timestamp: '2026-12-02T09:00:00.000Z', workflow: 'focus-review', agent: null, status: 'completed', trigger: 'weekly', added: ['x'], removed: [] },
];

test('a daily digest counts runs, failures, cost, ticks and moves for that day only', () => {
  const d = dailyDigest('2026-12-01', runs, ['2026-12-01T09:00:00Z', '2026-12-01T10:00:00Z', '2026-12-02T00:00:00Z']);
  assert.equal(d.ticks, 2);
  assert.deepEqual(d.agents.writer, { runs: 1, failed: 0, minutes: 2, costUsd: 1.25 });
  assert.equal(d.agents.research.failed, 1);
  assert.equal(d.agents.idea, undefined, 'a runner that could not start is not a run');
  assert.equal(d.runnerUnavailable, 1);
  assert.equal(d.failures.length, 2);
  assert.deepEqual(d.transitions, [{ itemId: 'a', from: 'researched', to: 'drafted', by: 'writer' }]);
  assert.deepEqual(dailyDigest('2026-12-02', runs).focus, [{ status: 'completed', trigger: 'weekly', added: ['x'], removed: [], error: null }]);
});

test('digests are written for finished days only, once each', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'report-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, '.backoffice'), { recursive: true });
  writeFileSync(join(root, '.backoffice', 'runs.jsonl'), runs.map((r) => JSON.stringify(r)).join('\n') + '\n');
  assert.deepEqual(writeDailyDigests(root, { now: new Date('2026-12-03T08:00:00Z') }), [`${DAILY_DIR}/2026-12-01.json`, `${DAILY_DIR}/2026-12-02.json`]);
  assert.deepEqual(writeDailyDigests(root, { now: new Date('2026-12-03T09:00:00Z') }), [], 'already written');
  assert.ok(!existsSync(join(root, DAILY_DIR, '2026-12-03.json')), 'today is not finished');
});

test('the week report: distinct items per stage, rejections with reasons, runs and gaps', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'report-week-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  cpSync(join(repoRoot, 'niches'), join(root, 'niches'), { recursive: true });
  const at = (d) => ({ by: 'test', at: d });
  let a = newItem({ id: 'a', niche: 'coffee', by: 'idea', at: '2026-12-01T08:00:00.000Z' });
  a = transition(a, 'idea_approved', at('2026-12-01T09:00:00.000Z'));
  let b = newItem({ id: 'b', niche: 'coffee', by: 'idea', at: '2026-12-01T08:00:00.000Z' });
  b = transition(b, 'rejected', { by: 'idea-judge', reason: 'off focus', at: '2026-12-01T09:00:00.000Z' });
  saveItem(root, a);
  saveItem(root, b);
  mkdirSync(join(root, DAILY_DIR), { recursive: true });
  writeFileSync(join(root, DAILY_DIR, '2026-12-01.json'), JSON.stringify(dailyDigest('2026-12-01', runs, ['2026-12-01T09:00:00Z'])));
  const r = weekReport(root, { to: new Date('2026-12-03T00:00:00Z'), days: 3 });
  assert.equal(r.output.ideasCreated, 2);
  assert.equal(r.output.ideasApproved, 1);
  assert.deepEqual(r.output.rejected.map((x) => [x.itemId, x.by, x.reason]), [['b', 'idea-judge', 'off focus']]);
  assert.deepEqual(r.runs.missingDays, ['2026-11-30', '2026-12-02']);
  assert.equal(r.runs.costUsd, 1.25);
  assert.equal(r.runs.failures.length, 2);
  const md = weekMarkdown(r);
  assert.match(md, /Rejected: 1\n  - b \(by idea-judge, from idea\): off focus/);
  assert.match(md, /research on b failed: timed out/);
});
