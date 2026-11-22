// Data for the "Today" dashboard (rebuild-spec section 9): what needs the human, the pipeline,
// the scheduler, feedback and run costs. Read-only. BACKOFFICE_ROOT points it at another checkout
// (e.g. the scheduler's clone, which holds the live run log).
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { loadAgents, isPipelineAgent } from '../engine/agents/registry.mjs';
import { loadItems, readJson, readRuns } from '../engine/state/store.mjs';
import { listFeedback, listProposals } from '../engine/feedback/store.mjs';
import { lockPath, isStale } from '../engine/scheduler/lock.mjs';
import { tick } from '../engine/scheduler/tick.mjs';
import { listSeeds } from '../engine/state/seeds.mjs';

const hourMs = 3_600_000;

const gitOut = (cwd, ...args) => {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trim() : null;
};

/**
 * Where the live state is: the scheduler's own clone (a sibling checkout of the same repository with
 * a tick log), so the dashboard is current without pulling. Falls back to this checkout.
 */
export function findStateRoot(root) {
  const origin = gitOut(root, 'remote', 'get-url', 'origin');
  const parent = dirname(resolve(root));
  const candidates = [];
  for (const name of existsSync(parent) ? readdirSync(parent) : []) {
    const dir = join(parent, name);
    const log = join(dir, '.backoffice', 'tick.log');
    try {
      if (!existsSync(log) || !statSync(dir).isDirectory()) continue;
      if (origin && gitOut(dir, 'remote', 'get-url', 'origin') !== origin) continue;
      candidates.push({ dir, at: statSync(log).mtimeMs });
    } catch {
      // unreadable sibling: skip
    }
  }
  return candidates.sort((a, b) => b.at - a.at)[0]?.dir ?? resolve(root);
}

function lastTickLog(root) {
  const path = join(root, '.backoffice', 'tick.log');
  if (!existsSync(path)) return null;
  const text = readFileSync(path, 'utf8');
  const starts = [...text.matchAll(/^=== (\S+) tick ===$/gm)];
  const last = starts.at(-1);
  const tail = last ? text.slice(last.index) : text.slice(-2000);
  return { startedAt: last?.[1] ?? null, modifiedAt: statSync(path).mtime.toISOString(), tail: tail.slice(-4000), finished: /=== exit \d+ ===/.test(tail) };
}

function costs(runs) {
  const byAgent = {};
  const seen = new Set();
  for (const run of runs) {
    if (!run.agent) continue;
    const a = (byAgent[run.agent] ??= { agent: run.agent, runs: 0, failures: 0, unavailable: 0, costUsd: 0, durationMs: 0, last: null });
    // Batch agents log one event per item with the same usage: count each run once.
    const key = `${run.agent}:${run.usage?.sessionId ?? run.timestamp.slice(0, 19)}:${run.durationMs}`;
    if (!seen.has(key)) {
      seen.add(key);
      if (run.runnerUnavailable) a.unavailable += 1;
      else {
        a.runs += 1;
        a.costUsd += run.usage?.costUsd ?? 0;
        a.durationMs += run.durationMs ?? 0;
      }
    }
    if (run.status === 'failed' && !run.runnerUnavailable) a.failures += 1;
    a.last = run.timestamp;
  }
  return Object.values(byAgent).map((a) => ({ ...a, costUsd: Math.round(a.costUsd * 100) / 100, avgMinutes: a.runs ? Math.round(a.durationMs / a.runs / 6000) / 10 : null }));
}

export async function todayData(root) {
  const now = Date.now();
  const agents = loadAgents();
  const { items, errors } = loadItems(root);
  const runs = readRuns(root);
  const proposals = listProposals(root);
  const inbox = [];

  for (const p of proposals.filter((x) => x.status === 'open')) {
    inbox.push({ kind: 'Prompt proposal', title: `${p.agent}: ${p.summary}`, reason: `Addresses ${p.addresses.length} feedback entries`, at: p.at,
      commands: [`npm run prompt -- show ${p.id}`, `npm run prompt -- apply ${p.id} --commit`, `npm run prompt -- reject ${p.id} --reason "..." --commit`] });
  }
  for (const item of items.filter((i) => i.status === 'needs_human' || i.status === 'blocked')) {
    inbox.push({ kind: item.status === 'blocked' ? 'Blocked item' : 'Needs you', title: item.id, reason: item.blockedReason ?? item.lastError ?? '', at: item.updatedAt,
      commands: [`npm run item -- show ${item.id}`, `npm run item -- resume ${item.id} --reason "..." --commit`, `npm run item -- reject ${item.id} --reason "..." --commit`] });
  }
  for (const item of items.filter((i) => i.status === 'passed')) {
    const draft = item.artifacts.writer && existsSync(join(root, item.artifacts.writer)) ? readJson(join(root, item.artifacts.writer)) : null;
    inbox.push({ kind: 'Draft to read', title: draft?.title ?? item.id, reason: 'Passed the post judge. Would you send it to a friend?', at: item.updatedAt,
      link: draft ? `http://127.0.0.1:4321/en-${(draft.market ?? 'US').toLowerCase()}/guides/${draft.slug}/` : null,
      commands: ['npm run site:preview', `npm run feedback -- add writer "..." --item ${item.id} --commit`] });
  }
  const recentFailures = runs.filter((r) => r.status === 'failed' && now - Date.parse(r.timestamp) < 24 * hourMs);
  // Only while it is still the latest event: a later successful run means the problem is gone.
  const unavailable = runs.at(-1)?.runnerUnavailable && now - Date.parse(runs.at(-1).timestamp) < 24 * hourMs ? runs.at(-1) : null;
  if (unavailable) inbox.push({ kind: 'Scheduler problem', title: 'The runner could not start', reason: unavailable.error, at: unavailable.timestamp, commands: ['claude auth status', 'npm run schedule -- logs'] });
  if (errors.length) inbox.push({ kind: 'Scheduler problem', title: 'Item store is invalid', reason: errors.join('; '), commands: ['npm run validate'] });

  if (!existsSync(join(root, '.backoffice', 'tick.log'))) {
    inbox.push({ kind: 'Dashboard', title: 'Not reading the scheduler’s folder', reason: `No tick log in ${root}, so statuses may be out of date. Start the dashboard with BACKOFFICE_ROOT pointing at the scheduler's clone, or run git pull here.`, commands: ['git pull', 'BACKOFFICE_ROOT=~/Projects/coffee-research-bot npm run dashboard'] });
  }

  const lockFile = lockPath(root);
  const holder = existsSync(lockFile) ? (() => { try { return JSON.parse(readFileSync(lockFile, 'utf8')); } catch { return null; } })() : null;
  const running = holder && !isStale(holder, { host: holder.host }) ? holder : null;
  const lastRun = runs.filter((r) => !r.runnerUnavailable).at(-1) ?? null;
  const log = lastTickLog(root);
  if (!running && log && now - Date.parse(log.modifiedAt) > 3 * hourMs) {
    inbox.push({ kind: 'Scheduler idle', title: `No tick for ${Math.round((now - Date.parse(log.modifiedAt)) / hourMs)} hours`, reason: 'The Mac may be asleep, or the job is not installed in this checkout.', commands: ['npm run schedule -- status', 'npm run schedule -- logs'] });
  }

  let next = null;
  try {
    const plan = await tick({ root, dryRun: true, agents });
    next = plan.ran ? { agent: plan.ran, itemIds: plan.itemIds } : { agent: null, skipped: plan.skipped };
  } catch (error) {
    next = { error: error.message };
  }

  const pipelineOrder = ['idea', 'idea_approved', 'researched', 'briefed', 'drafted', 'passed', 'published', 'measured', 'needs_human', 'blocked', 'rejected'];
  const pipeline = pipelineOrder.map((status) => ({
    status,
    items: items.filter((i) => i.status === status).map((i) => ({ id: i.id, ageHours: Math.round((now - Date.parse(i.updatedAt)) / hourMs), attempts: i.attempts, revisions: i.revisions, lastReason: i.history.at(-1)?.reason ?? '' })),
  }));

  const feedback = agents.filter(isPipelineAgent).map((agent) => {
    const entries = listFeedback(root, agent.name);
    const lastCritic = entries.filter((e) => e.source === 'critic').at(-1);
    return { agent: agent.name, open: entries.filter((e) => !e.addressedBy).length, total: entries.length, hasPrompt: Boolean(agent.promptPath), lastCritic: lastCritic ? { at: lastCritic.at, summary: lastCritic.summary } : null };
  });

  return {
    root,
    generatedAt: new Date(now).toISOString(),
    inbox: inbox.sort((a, b) => String(b.at ?? '').localeCompare(String(a.at ?? ''))),
    scheduler: { running, lastRun, lastLog: log, next },
    pipeline,
    feedback,
    proposals: proposals.slice(-10).reverse().map(({ id, agent, status, summary, at }) => ({ id, agent, status, summary, at })),
    seeds: listSeeds(root).reverse().slice(0, 15).map(({ id, text, status, considered, itemIds }) => ({ id, text, status, considered, itemIds })),
    costs: costs(runs),
    recentRuns: runs.slice(-25).reverse().map(({ timestamp, agent, itemId, status, outcome, error, to, durationMs, usage }) => ({ timestamp, agent, itemId, status, outcome, error, to, minutes: durationMs ? Math.round(durationMs / 6000) / 10 : null, costUsd: usage?.costUsd ?? null })),
  };
}
