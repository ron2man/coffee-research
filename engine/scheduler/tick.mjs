#!/usr/bin/env node
// One scheduler tick: pick the highest-priority runnable agent, run it once,
// validate its output, apply status changes and log every change. No AI here.
//
//   node engine/scheduler/tick.mjs [--dry-run] [--root <dir>] [--niche <id>]
//
// Git branch/commit/PR handling is not part of M1 (see docs/learnings.md open questions).
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { loadAgents } from '../agents/registry.mjs';
import { newItem, transition } from '../state/machine.mjs';
import { defaultNicheId, loadNiche, repoRoot } from '../state/niche.mjs';
import { appendRun, loadItems, readJson, readRuns, saveItem, writeJsonAtomic } from '../state/store.mjs';
import { assertValid } from '../state/validate.mjs';
import { RunnerUnavailableError, runnerFor } from '../runner/index.mjs';

export const MAX_ATTEMPTS = 2;
const hourMs = 3_600_000;

class OutputError extends Error {
  constructor(message) {
    super(message);
    this.name = 'OutputError';
  }
}

function byAge(a, b) {
  return a.updatedAt.localeCompare(b.updatedAt) || a.id.localeCompare(b.id);
}

/** Decide what runs this tick. Pure: no I/O. */
export function planTick({ agents, items, runs, now = new Date() }) {
  const skipped = [];
  for (const agent of agents) {
    if (agent.mode === 'generate') {
      if (agent.queueCap) {
        const queued = items.filter((item) => agent.queueCap.statuses.includes(item.status)).length;
        if (queued >= agent.queueCap.max) {
          skipped.push({ agent: agent.name, reason: `queue cap: ${queued} items in ${agent.queueCap.statuses.join('/')} (max ${agent.queueCap.max})` });
          continue;
        }
      }
      if (agent.schedule) {
        // A run the runner never started (missing CLI, signed out) does not use up the interval.
        const last = runs.filter((run) => run.agent === agent.name && !run.runnerUnavailable).at(-1);
        const since = last ? now.getTime() - Date.parse(last.timestamp) : Infinity;
        if (since < agent.schedule.minIntervalHours * hourMs) {
          skipped.push({ agent: agent.name, reason: `ran ${(since / hourMs).toFixed(1)}h ago (interval ${agent.schedule.minIntervalHours}h)` });
          continue;
        }
      }
      return { chosen: { agent, items: [] }, skipped };
    }
    const waiting = items.filter((item) => item.status === agent.inputStatus).sort(byAge);
    if (!waiting.length) {
      skipped.push({ agent: agent.name, reason: `no items in ${agent.inputStatus}` });
      continue;
    }
    const batch = agent.mode === 'batch' ? waiting.slice(0, agent.batchSize) : waiting.slice(0, 1);
    return { chosen: { agent, items: batch }, skipped };
  }
  return { chosen: null, skipped };
}

function loadArtifacts(root, item, names = []) {
  const artifacts = {};
  for (const name of names) {
    const path = item.artifacts[name];
    if (path && existsSync(join(root, path))) artifacts[name] = readJson(join(root, path));
  }
  return artifacts;
}

function buildInput(root, niche, agent, chosenItems, allItems) {
  if (agent.mode === 'generate') {
    return {
      niche,
      existing: allItems.map((item) => ({
        id: item.id,
        status: item.status,
        question: loadArtifacts(root, item, [agent.name])[agent.name]?.question ?? null,
      })),
    };
  }
  const entries = chosenItems.map((item) => ({ item, artifacts: loadArtifacts(root, item, agent.inputArtifacts) }));
  return agent.mode === 'batch' ? { niche, items: entries } : { niche, ...entries[0] };
}

function validateArtifact(agent, artifact, label) {
  try {
    assertValid(agent.validateArtifact, artifact, label);
  } catch (error) {
    throw new OutputError(error.message);
  }
}

/** Validate the whole output before touching any file. Returns the decisions to apply. */
function checkOutput(agent, output, chosenItems, allItems) {
  try {
    assertValid(agent.validateEnvelope, output, `${agent.name} output`);
  } catch (error) {
    throw new OutputError(error.message);
  }
  if (agent.mode === 'generate') {
    const taken = new Set(allItems.map((item) => item.id));
    for (const artifact of output.items) {
      validateArtifact(agent, artifact, `${agent.name} item`);
      if (taken.has(artifact.id)) throw new OutputError(`${agent.name} produced duplicate id ${artifact.id}`);
      taken.add(artifact.id);
    }
    return output.items;
  }
  const decisions = agent.mode === 'batch' ? output.decisions : [{ ...output, itemId: chosenItems[0].id }];
  const expected = new Set(chosenItems.map((item) => item.id));
  const seen = new Set();
  for (const decision of decisions) {
    if (!expected.has(decision.itemId) || seen.has(decision.itemId)) {
      throw new OutputError(`${agent.name} decided on unexpected or repeated item ${decision.itemId}`);
    }
    seen.add(decision.itemId);
    validateArtifact(agent, decision.artifact, `${agent.name} artifact for ${decision.itemId}`);
  }
  if (seen.size !== expected.size) {
    throw new OutputError(`${agent.name} must decide on every input item (${seen.size}/${expected.size})`);
  }
  if (agent.maxAdvance) {
    const advanced = decisions.filter((d) => d.outcome === agent.maxAdvance.outcome).length;
    if (advanced > agent.maxAdvance.max) {
      throw new OutputError(`${agent.name} advanced ${advanced} items (max ${agent.maxAdvance.max})`);
    }
  }
  return decisions;
}

function applyGenerated(root, niche, agent, artifacts, meta) {
  const created = [];
  for (const artifact of artifacts) {
    const path = `${agent.artifactDir}/${artifact.id}.json`;
    writeJsonAtomic(join(root, path), artifact);
    const item = newItem({ id: artifact.id, niche: niche.id, by: agent.name, reason: 'generated' });
    item.artifacts[agent.name] = path;
    saveItem(root, item);
    appendRun(root, { ...meta, itemId: item.id, status: 'completed', outcome: 'created', from: null, to: item.status });
    created.push(item.id);
  }
  if (!created.length) appendRun(root, { ...meta, itemId: null, status: 'completed', outcome: 'no-items' });
  return created;
}

function applyDecisions(root, agent, decisions, chosenItems, meta) {
  const results = [];
  for (const decision of decisions) {
    let item = chosenItems.find((candidate) => candidate.id === decision.itemId);
    const path = `${agent.artifactDir}/${item.id}.json`;
    writeJsonAtomic(join(root, path), decision.artifact);
    item = { ...item, artifacts: { ...item.artifacts, [agent.name]: path } };
    let to = agent.outcomes[decision.outcome];
    let reason = decision.reason;
    if (agent.loop?.outcome === decision.outcome) {
      if (item.revisions >= agent.loop.limit) {
        to = agent.loop.exceeded;
        reason = `${decision.outcome} limit (${agent.loop.limit}) reached: ${decision.reason}`;
      } else {
        item.revisions += 1;
      }
    }
    const from = item.status;
    item = saveItem(root, transition(item, to, { by: agent.name, reason }));
    appendRun(root, { ...meta, itemId: item.id, status: 'completed', outcome: decision.outcome, from, to });
    results.push({ id: item.id, outcome: decision.outcome, to });
  }
  return results;
}

function recordFailure(root, agent, chosenItems, error, meta, maxAttempts) {
  if (!chosenItems.length) {
    appendRun(root, { ...meta, itemId: null, status: 'failed', error: error.message });
    return [];
  }
  return chosenItems.map((original) => {
    let item = { ...original, attempts: original.attempts + 1, lastError: error.message, updatedAt: new Date().toISOString() };
    const blocked = item.attempts >= maxAttempts;
    if (blocked) {
      item = transition(item, 'blocked', { by: 'scheduler', reason: `${agent.name} failed ${item.attempts} times: ${error.message}` });
      item.lastError = error.message;
    }
    saveItem(root, item);
    appendRun(root, {
      ...meta, itemId: item.id, status: 'failed', error: error.message, attempts: item.attempts,
      ...(blocked ? { from: original.status, to: 'blocked' } : {}),
    });
    return { id: item.id, attempts: item.attempts, blocked };
  });
}

/**
 * Run one tick. `runner` overrides per-agent runners (tests and simulation).
 * Returns a summary; throws only for store/config problems, never for agent failures.
 */
export async function tick({ root = repoRoot, runner, now = new Date(), nicheId, agents = loadAgents(), dryRun = false, maxAttempts = MAX_ATTEMPTS } = {}) {
  const niche = loadNiche(nicheId ?? defaultNicheId(root), root);
  const { items, errors } = loadItems(root);
  if (errors.length) throw new Error(`Item store is invalid; fix before scheduling:\n${errors.join('\n')}`);
  const plan = planTick({ agents, items, runs: readRuns(root), now });
  if (!plan.chosen) return { ran: null, skipped: plan.skipped };
  const { agent, items: chosenItems } = plan.chosen;
  const summary = { ran: agent.name, itemIds: chosenItems.map((item) => item.id), skipped: plan.skipped };
  if (dryRun) return { ...summary, dryRun: true };

  const started = Date.now();
  const meta = () => ({ workflow: `agent:${agent.name}`, agent: agent.name, durationMs: Date.now() - started });
  let response;
  try {
    const request = {
      agent,
      input: buildInput(root, niche, agent, chosenItems, items),
      tools: agent.runner.tools ?? [],
      permissions: agent.runner.permissions ?? {},
    };
    response = await runnerFor(agent, runner).run(request);
  } catch (error) {
    if (error instanceof RunnerUnavailableError) {
      appendRun(root, { ...meta(), itemId: null, status: 'failed', error: error.message, runnerUnavailable: true });
      return { ...summary, error: error.message, runnerUnavailable: true };
    }
    return { ...summary, error: error.message, failures: recordFailure(root, agent, chosenItems, error, meta(), maxAttempts) };
  }

  let checked;
  try {
    checked = checkOutput(agent, response.output, chosenItems, items);
  } catch (error) {
    if (!(error instanceof OutputError)) throw error;
    return { ...summary, error: error.message, failures: recordFailure(root, agent, chosenItems, error, meta(), maxAttempts) };
  }
  const eventMeta = { ...meta(), usage: response.usage ?? null };
  if (agent.mode === 'generate') return { ...summary, created: applyGenerated(root, niche, agent, checked, eventMeta) };
  return { ...summary, results: applyDecisions(root, agent, checked, chosenItems, eventMeta) };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { values } = parseArgs({
      options: { 'dry-run': { type: 'boolean' }, root: { type: 'string' }, niche: { type: 'string' } },
    });
    const result = await tick({ root: values.root ? resolve(values.root) : repoRoot, dryRun: values["dry-run"], nicheId: values.niche });
    console.log(JSON.stringify(result, null, 2));
    if (result.error) process.exitCode = 1;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
