// Reports for the weekly review (no AI). Two parts:
//  - A daily digest of the local run log (.backoffice/runs.jsonl and tick.log are gitignored and live
//    only on the scheduler's machine). The tick commits one file per finished UTC day to
//    data/reports/daily/<date>.json, so anyone with the repository can see runs, failures, ticks and
//    cost without that machine.
//  - The week: what moved through the pipeline (from the items' committed histories), what failed,
//    what it cost, focus changes, prompt proposals and demand sources, from the daily digests and
//    the committed state. `npm run report -- week` prints it; the weekly review reads it.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadItems, readJson, readRuns, writeJsonAtomic } from '../state/store.mjs';
import { listProposals } from '../feedback/store.mjs';
import { readFocus } from '../focus/focus.mjs';

export const DAILY_DIR = 'data/reports/daily';
const dayMs = 86_400_000;
const MAX_BACKFILL_DAYS = 14;
const day = (t) => new Date(t).toISOString().slice(0, 10);
const round = (n, d = 2) => Math.round(n * 10 ** d) / 10 ** d;

function tickStarts(root) {
  const path = join(root, '.backoffice', 'tick.log');
  if (!existsSync(path)) return [];
  return [...readFileSync(path, 'utf8').matchAll(/^=== (\S+) tick ===$/gm)].map((m) => m[1]);
}

/** One day's digest from run events and tick starts. Pure. */
export function dailyDigest(date, runs, ticks = []) {
  const events = runs.filter((r) => day(r.timestamp) === date);
  const agents = {};
  for (const r of events.filter((e) => e.agent && !e.runnerUnavailable)) {
    const a = (agents[r.agent] ??= { runs: 0, failed: 0, minutes: 0, costUsd: 0 });
    a.runs += 1;
    if (r.status === 'failed') a.failed += 1;
    a.minutes = round(a.minutes + (r.durationMs ?? 0) / 60_000, 1);
    a.costUsd = round(a.costUsd + (r.usage?.costUsd ?? 0));
  }
  return {
    schemaVersion: 1,
    date,
    ticks: ticks.filter((t) => t.startsWith(date)).length,
    agents,
    failures: events.filter((e) => e.status === 'failed').map((e) => ({ at: e.timestamp, workflow: e.workflow, agent: e.agent ?? null, itemId: e.itemId ?? null, error: String(e.error ?? '').slice(0, 300) })),
    runnerUnavailable: events.filter((e) => e.runnerUnavailable).length,
    transitions: events.filter((e) => e.to && e.from !== e.to).map((e) => ({ itemId: e.itemId, from: e.from ?? null, to: e.to, by: e.agent ?? e.workflow })),
    focus: events.filter((e) => e.workflow === 'focus-review').map((e) => ({ status: e.status, trigger: e.trigger ?? null, added: e.added ?? [], removed: e.removed ?? [], error: e.error ?? null })),
  };
}

/**
 * Write digests for finished days that have none yet (up to two weeks back, never before the first
 * logged event). Returns the paths written. Called by the tick.
 */
export function writeDailyDigests(root, { now = new Date() } = {}) {
  const runs = readRuns(root);
  if (!runs.length) return [];
  const ticks = tickStarts(root);
  const first = Date.parse(`${day(runs[0].timestamp)}T00:00:00Z`);
  const today = Date.parse(`${day(now)}T00:00:00Z`);
  const written = [];
  for (let t = Math.max(first, today - MAX_BACKFILL_DAYS * dayMs); t < today; t += dayMs) {
    const date = day(t);
    const path = `${DAILY_DIR}/${date}.json`;
    if (existsSync(join(root, path))) continue;
    writeJsonAtomic(join(root, path), dailyDigest(date, runs, ticks));
    written.push(path);
  }
  return written;
}

function readDir(root, dir) {
  const full = join(root, dir);
  if (!existsSync(full)) return [];
  return readdirSync(full).filter((n) => n.endsWith('.json')).sort().map((n) => {
    try {
      return { name: n, data: readJson(join(full, n)) };
    } catch {
      return null;
    }
  }).filter(Boolean);
}

const inRange = (iso, from, to) => iso && iso >= from && iso < to;

/** The week ending at `to` (exclusive), from committed files only. */
export function weekReport(root, { to = new Date(), days = 7 } = {}) {
  const end = to.toISOString();
  const start = new Date(to.getTime() - days * dayMs).toISOString();
  const { items } = loadItems(root);

  // Pipeline: every status change in the window, from the items' own histories.
  const moves = items.flatMap((item) => item.history.filter((h) => inRange(h.at, start, end)).map((h) => ({ itemId: item.id, ...h })));
  // Distinct items: a guide that passed, was sent back and passed again counts once.
  const count = (to) => new Set(moves.filter((m) => m.to === to).map((m) => m.itemId)).size;
  const rejected = moves.filter((m) => m.to === 'rejected').map((m) => ({ itemId: m.itemId, from: m.from, by: m.by, reason: m.reason }));
  const revisions = moves.filter((m) => m.from === 'drafted' && m.to === 'briefed').map((m) => ({ itemId: m.itemId, by: m.by, reason: m.reason }));
  const stuck = items.filter((i) => ['needs_human', 'blocked'].includes(i.status)).map((i) => ({ itemId: i.id, status: i.status, since: i.updatedAt, reason: i.blockedReason ?? i.lastError ?? i.history.at(-1)?.reason ?? '' }));
  const queue = Object.fromEntries(['idea', 'idea_approved', 'researched', 'briefed', 'drafted', 'passed'].map((s) => [s, items.filter((i) => i.status === s).length]));

  // Runs, failures and cost: daily digests in the window.
  const digests = readDir(root, DAILY_DIR).map((f) => f.data).filter((d) => d.date >= day(start) && d.date < day(end));
  const agents = {};
  for (const d of digests) {
    for (const [name, a] of Object.entries(d.agents)) {
      const t = (agents[name] ??= { runs: 0, failed: 0, minutes: 0, costUsd: 0 });
      t.runs += a.runs; t.failed += a.failed; t.minutes = round(t.minutes + a.minutes, 1); t.costUsd = round(t.costUsd + a.costUsd);
    }
  }
  const coveredDays = new Set(digests.map((d) => d.date));
  const missingDays = Array.from({ length: days }, (_, i) => day(Date.parse(start) + i * dayMs)).filter((d) => !coveredDays.has(d));

  // Demand collections in the window: which sources worked.
  const demand = readDir(root, 'data/demand').filter((f) => inRange(`${f.data.date ?? ''}T12:00:00Z`, start, end) || inRange(f.data.collectedAt, start, end));
  const sources = {};
  for (const { data } of demand) {
    for (const [name, s] of Object.entries(data.sources ?? {})) {
      const t = (sources[name] ??= { ok: 0, failed: 0, skipped: null, error: null });
      t.ok += s.ok ?? 0; t.failed += s.failed ?? 0;
      if (s.skipped) t.skipped = s.skipped;
      if (s.error) t.error = s.error;
    }
  }

  const focus = readFocus(root);
  const proposals = listProposals(root);
  return {
    from: start,
    to: end,
    output: {
      ideasCreated: count('idea'),
      ideasApproved: count('idea_approved'),
      researched: count('researched'),
      drafted: count('drafted'),
      passed: count('passed'),
      published: count('published'),
      rejected,
      revisions,
    },
    queue,
    stuck,
    runs: {
      digestDays: digests.length,
      missingDays,
      ticks: digests.reduce((n, d) => n + d.ticks, 0),
      daysWithoutTicks: digests.filter((d) => d.ticks === 0).map((d) => d.date),
      agents,
      costUsd: round(Object.values(agents).reduce((n, a) => n + a.costUsd, 0)),
      failures: digests.flatMap((d) => d.failures),
      runnerUnavailable: digests.reduce((n, d) => n + d.runnerUnavailable, 0),
    },
    focus: focus ? {
      active: focus.active.map((a) => a.productId),
      changes: (focus.history ?? []).filter((h) => inRange(h.at, start, end) && (h.added?.length || h.removed?.length))
        .map((h) => ({ at: h.at, trigger: h.trigger, added: h.added, removed: h.removed.map((r) => r.productId), undone: h.undone ?? null })),
    } : null,
    proposals: {
      opened: proposals.filter((p) => inRange(p.at, start, end)).map((p) => ({ id: p.id, agent: p.agent, status: p.status, summary: p.summary })),
      open: proposals.filter((p) => p.status === 'open').map((p) => p.id),
    },
    demand: { collections: demand.length, sources },
  };
}

/** The report as Markdown for people. */
export function weekMarkdown(r) {
  const o = r.output;
  const lines = [
    `# Week ${r.from.slice(0, 10)} → ${r.to.slice(0, 10)}`,
    '',
    '## Output',
    `- Ideas: ${o.ideasCreated} created, ${o.ideasApproved} approved by the judge`,
    `- Guides: ${o.researched} researched, ${o.drafted} drafts, ${o.passed} passed the post judge, ${o.published} published`,
    `- Sent back for a rewrite: ${o.revisions.length}`,
    `- Rejected: ${o.rejected.length}`,
    ...o.rejected.map((x) => `  - ${x.itemId} (by ${x.by}, from ${x.from}): ${x.reason}`),
    `- Waiting now: ${Object.entries(r.queue).map(([s, n]) => `${s} ${n}`).join(', ')}`,
    '',
    '## Problems',
    ...(r.stuck.length ? r.stuck.map((s) => `- ${s.itemId} is ${s.status}: ${s.reason}`) : ['- Nothing waiting for a human.']),
    ...(r.runs.failures.length ? r.runs.failures.map((f) => `- ${f.at.slice(0, 16)} ${f.agent ?? f.workflow}${f.itemId ? ` on ${f.itemId}` : ''} failed: ${f.error}`) : ['- No failed runs.']),
    ...(r.runs.runnerUnavailable ? [`- The runner could not start ${r.runs.runnerUnavailable} times.`] : []),
    ...(r.runs.daysWithoutTicks.length ? [`- No tick at all on ${r.runs.daysWithoutTicks.join(', ')}.`] : []),
    ...(r.runs.missingDays.length ? [`- No run digest for ${r.runs.missingDays.join(', ')} (the scheduler's machine didn't commit one).`] : []),
    '',
    '## Runs and cost',
    `- ${r.runs.ticks} ticks; estimated cost $${r.runs.costUsd} at API prices (not the subscription bill)`,
    ...Object.entries(r.runs.agents).map(([name, a]) => `- ${name}: ${a.runs} runs, ${a.failed} failed, ${a.minutes} min, $${a.costUsd}`),
    '',
    '## Focus',
    ...(r.focus ? [`- Active: ${r.focus.active.join(', ')}`, ...r.focus.changes.map((c) => `- ${c.at.slice(0, 10)} ${c.trigger}: +${c.added.join(' +') || '-'} -${c.removed.join(' -') || '-'}${c.undone ? ' (undone)' : ''}`)] : ['- No focus state yet.']),
    '',
    '## Prompt proposals',
    ...(r.proposals.opened.length ? r.proposals.opened.map((p) => `- ${p.id} (${p.status}): ${p.summary}`) : ['- None opened this week.']),
    `- Open now: ${r.proposals.open.join(', ') || 'none'}`,
    '',
    '## Demand sources',
    `- ${r.demand.collections} collections`,
    ...Object.entries(r.demand.sources).map(([name, s]) => `- ${name}: ${s.ok} ok, ${s.failed} failed${s.skipped ? `, skipped: ${s.skipped}` : ''}${s.error ? `, last error: ${s.error}` : ''}`),
    '',
  ];
  return lines.join('\n');
}
