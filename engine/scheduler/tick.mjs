#!/usr/bin/env node
// One scheduler tick: pick the highest-priority runnable agent, run it once,
// validate its output, apply status changes and log every change. No AI here.
//
//   node engine/scheduler/tick.mjs [--dry-run] [--commit] [--root <dir>] [--niche <id>]
//
// --commit: require the main branch, sync first, then commit and push the files this tick
// wrote. Reader-facing paths (git-policy.json) are never committed here; they need a PR.
// Only one tick runs per checkout at a time (.backoffice/tick.lock).
// --ignore-schedule: run a scheduled agent even if its interval has not passed (manual reruns).
// Rejected agent output is kept in .backoffice/rejected/ for inspection.
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { instructionsFor, loadAgents } from '../agents/registry.mjs';
import { contentIndex, wantedGuides } from '../state/content.mjs';
import { openSeeds, settleSeeds } from '../state/seeds.mjs';
import { categoryIds } from '../state/niche.mjs';
import { loadCardsSync, validateCard } from '../state/knowledge.mjs';
import { runChecks } from '../feedback/checks.mjs';
import { addFeedback, openFeedback, readReviewState } from '../feedback/store.mjs';
import { applyReview, applyTune, buildReviewInput, buildTuneInput, checkTuneArtifact, reviewCandidates, tuneCandidates } from '../feedback/loop.mjs';
import { newItem, transition } from '../state/machine.mjs';
import { defaultNicheId, loadNiche, repoRoot } from '../state/niche.mjs';
import { appendRun, loadItems, readJson, readRuns, saveItem, writeJsonAtomic, writeTextAtomic } from '../state/store.mjs';
import { assertValid } from '../state/validate.mjs';
import { RunnerUnavailableError, runnerFor } from '../runner/index.mjs';
import { assertFresh, commitInternal, commitMessage, remoteStatus, syncMain } from './git.mjs';
import { LockedError, acquireLock } from './lock.mjs';
import { changedSince, snapshot } from './workspace.mjs';

export const MAX_ATTEMPTS = 2;
export const SEED_WAIT_HOURS = 2;
const hourMs = 3_600_000;

class OutputError extends Error {
  constructor(message) {
    super(message);
    this.name = 'OutputError';
  }
}

/** Repo-relative path of an item file. */
const itemPath = (item) => `data/items/${item.id}.json`;

/**
 * Committed scheduler state: when each scheduled agent last ran. Lives in git (not only in the
 * gitignored run log) so moving the system to another machine keeps the schedule.
 */
export const SCHEDULE_PATH = 'data/scheduler/state.json';

export function readSchedule(root) {
  const path = join(root, SCHEDULE_PATH);
  return existsSync(path) ? readJson(path) : { schemaVersion: 1, agents: {} };
}

function recordScheduledRun(root, agent, at, outcome, written) {
  if (!agent.schedule) return;
  const state = readSchedule(root);
  state.agents[agent.name] = { lastRunAt: at, outcome };
  writeJsonAtomic(join(root, SCHEDULE_PATH), state);
  written.push(SCHEDULE_PATH);
}

/** Last time an agent really ran: the later of the committed state and the local run log. */
function lastRunAt(agent, runs, schedule) {
  const logged = runs.filter((run) => run.agent === agent.name && !run.runnerUnavailable).at(-1)?.timestamp;
  const committed = schedule?.agents?.[agent.name]?.lastRunAt;
  const times = [logged, committed].filter(Boolean).map((t) => Date.parse(t));
  return times.length ? Math.max(...times) : null;
}

function byAge(a, b) {
  return a.updatedAt.localeCompare(b.updatedAt) || a.id.localeCompare(b.id);
}

/** Decide what runs this tick. Pure: no I/O. */
export function planTick({ agents, items, runs, schedule = null, now = new Date(), ignoreSchedule = false, loop = {} }) {
  const skipped = [];
  // A human seed shouldn't wait behind a busy pipeline: after SEED_WAIT_HOURS the seed-taking agent
  // runs first (unless its queue is full).
  const seedAgent = agents.find((agent) => agent.acceptsSeeds);
  if (seedAgent && loop.oldestFreshSeedAt && now.getTime() - Date.parse(loop.oldestFreshSeedAt) >= SEED_WAIT_HOURS * hourMs) {
    const queued = seedAgent.queueCap ? items.filter((item) => seedAgent.queueCap.statuses.includes(item.status)).length : 0;
    if (!seedAgent.queueCap || queued < seedAgent.queueCap.max) return { chosen: { agent: seedAgent, items: [] }, skipped: [{ agent: '*', reason: `a seed has waited over ${SEED_WAIT_HOURS}h` }] };
  }
  for (const agent of agents) {
    if (agent.mode === 'review' || agent.mode === 'tune') {
      const due = (agent.mode === 'review' ? loop.review : loop.tune) ?? [];
      if (!agent.promptPath) skipped.push({ agent: agent.name, reason: 'no prompt.md yet' });
      else if (!due.length) skipped.push({ agent: agent.name, reason: agent.mode === 'review' ? 'no outputs due for review' : 'no agent has enough open feedback' });
      else return { chosen: { agent, items: [], candidate: due[0] }, skipped };
      continue;
    }
    if (agent.mode === 'generate') {
      if (agent.queueCap) {
        const queued = items.filter((item) => agent.queueCap.statuses.includes(item.status)).length;
        if (queued >= agent.queueCap.max) {
          skipped.push({ agent: agent.name, reason: `queue cap: ${queued} items in ${agent.queueCap.statuses.join('/')} (max ${agent.queueCap.max})` });
          continue;
        }
      }
      // A seed nobody has looked at yet (a human's topic hint) brings the daily run forward.
      const freshSeed = (loop.freshSeeds ?? 0) > 0 && agent.acceptsSeeds;
      if (agent.schedule && !ignoreSchedule && !freshSeed) {
        // A run the runner never started (missing CLI, signed out) does not use up the interval.
        const last = lastRunAt(agent, runs, schedule);
        const since = last === null ? Infinity : now.getTime() - last;
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
      today: new Date().toISOString().slice(0, 10),
      existingContent: contentIndex(root),
      wantedGuides: wantedGuides(root),
      ...(agent.acceptsSeeds ? { seeds: openSeeds(root).map(({ id, text, note }) => ({ id, text, note })) } : {}),
      existing: allItems.map((item) => ({
        id: item.id,
        status: item.status,
        question: loadArtifacts(root, item, [agent.name])[agent.name]?.question ?? null,
      })),
    };
  }
  // Human notes on this item (e.g. a revision request) go straight to the agent they are for.
  const notes = (item) => openFeedback(root, agent.name)
    .filter((entry) => entry.source === 'human' && entry.itemIds.includes(item.id))
    .map((entry) => ({ at: entry.at, note: entry.findings.map((f) => f.problem).join(' ') }));
  const recheck = (item, artifacts) => {
    if (!agent.recheck || !artifacts[agent.recheck.agent]) return undefined;
    const { cards } = loadCardsSync(join(root, 'knowledge'), categoryIds(niche));
    return runChecks(agent.recheck.agent, [{ itemId: item.id, artifact: artifacts[agent.recheck.agent] }], {
      today: new Date().toISOString().slice(0, 10), cards, markets: niche.markets, existingContent: contentIndex(root),
    });
  };
  const entries = chosenItems.map((item) => {
    const artifacts = loadArtifacts(root, item, agent.inputArtifacts);
    const automatedChecks = recheck(item, artifacts);
    return { item, artifacts, humanNotes: notes(item), ...(automatedChecks ? { automatedChecks } : {}) };
  });
  const today = new Date().toISOString().slice(0, 10);
  const existingContent = contentIndex(root);
  const wanted = wantedGuides(root);
  return agent.mode === 'batch' ? { niche, today, existingContent, wantedGuides: wanted, items: entries } : { niche, today, existingContent, wantedGuides: wanted, ...entries[0] };
}

function validateArtifact(agent, artifact, label) {
  try {
    assertValid(agent.validateArtifact, artifact, label);
  } catch (error) {
    throw new OutputError(error.message);
  }
}

/** Validate the whole output before touching any file. Returns the decisions to apply. */
function checkOutput(root, agent, output, chosenItems, allItems) {
  try {
    assertValid(agent.validateEnvelope, output, `${agent.name} output`);
  } catch (error) {
    throw new OutputError(error.message);
  }
  if (agent.mode === 'generate') {
    const taken = new Set(allItems.map((item) => item.id));
    const seedIds = new Set(agent.acceptsSeeds ? openSeeds(root).map((seed) => seed.id) : []);
    for (const artifact of output.items) {
      validateArtifact(agent, artifact, `${agent.name} item`);
      if (artifact.seedId && !seedIds.has(artifact.seedId)) throw new OutputError(`${agent.name} item ${artifact.id} cites unknown or closed seed ${artifact.seedId}`);
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
  if (agent.maxAdvance) return capAdvances(agent, decisions);
  return decisions;
}

/** A post can't pass while the writer's blocking checks fail (e.g. a rule added after it was written). */
function enforceRecheck(agent, decisions, input) {
  const blocking = (agent.mode === 'batch' ? [] : input.automatedChecks?.blocking) ?? [];
  if (!blocking.length) return decisions;
  return decisions.map((d) => (d.outcome !== agent.recheck.passOutcome ? d : {
    ...d,
    outcome: agent.recheck.failOutcome,
    reason: `Automated checks still fail, so it can't pass: ${blocking.join('; ')}. Judge's view: ${d.reason}`,
    artifact: { ...d.artifact, blockingActions: [...blocking.map((b) => b.replace(/^[^:]+: /, '')).slice(0, 3 - Math.min(3, d.artifact.blockingActions?.length ?? 0)), ...(d.artifact.blockingActions ?? [])].slice(0, 3) },
  }));
}

function rankScore(artifact, key) {
  if (!key) return 0;
  return Object.values(artifact?.[key] ?? {}).reduce((sum, entry) => sum + (Number(entry?.score) || 0), 0);
}

/**
 * Enforce maxAdvance. Without `overflow` an excess fails the run. With it, the lowest-ranked
 * extra advances (by `rankBy` score, then the agent's own order) become the overflow outcome.
 */
export function capAdvances(agent, decisions) {
  const { outcome, max, overflow, rankBy } = agent.maxAdvance;
  const advanced = decisions.map((d, index) => ({ d, index })).filter(({ d }) => d.outcome === outcome);
  if (advanced.length <= max) return decisions;
  if (!overflow) throw new OutputError(`${agent.name} advanced ${advanced.length} items (max ${max})`);
  const keep = new Set(
    advanced
      .sort((a, b) => rankScore(b.d.artifact, rankBy) - rankScore(a.d.artifact, rankBy) || a.index - b.index)
      .slice(0, max)
      .map(({ d }) => d.itemId),
  );
  return decisions.map((d) => (d.outcome !== outcome || keep.has(d.itemId) ? d : {
    ...d,
    outcome: overflow,
    reason: `Over the ${outcome} cap (${max}); ranked below the kept items. Judge's reason: ${d.reason}`,
    capped: true,
  }));
}

/**
 * Knowledge-card changes returned by an agent (artifact.cardChanges). Validated with the card
 * validator before anything is written. Existing claims may be updated but never dropped.
 */
function prepareCardChanges(root, niche, outputs) {
  const changes = [];
  const categories = categoryIds(niche);
  for (const { itemId, artifact } of outputs) {
    for (const change of artifact.cardChanges ?? []) {
      const match = change.path.match(/^knowledge\/([a-z0-9-]+)\/([a-z0-9-]+)\.md$/);
      if (!match || !categories.includes(match[1])) throw new OutputError(`${itemId}: card path ${change.path} is not knowledge/<category>/<id>.md for a niche category`);
      let card;
      try {
        card = validateCard(change.content, match[1], `${match[2]}.md`);
      } catch (error) {
        throw new OutputError(`${itemId}: invalid card ${change.path}: ${error.message}`);
      }
      const existingPath = join(root, change.path);
      if (existsSync(existingPath)) {
        const before = validateCard(readFileSync(existingPath, 'utf8'), match[1], `${match[2]}.md`);
        const kept = new Set(card.claims.map((claim) => claim.id));
        const dropped = before.claims.filter((claim) => !kept.has(claim.id)).map((claim) => claim.id);
        if (dropped.length) throw new OutputError(`${itemId}: card ${change.path} drops existing claims: ${dropped.join(', ')}`);
      }
      if (changes.some((c) => c.path === change.path)) throw new OutputError(`${itemId}: card ${change.path} changed twice`);
      changes.push({ path: change.path, content: change.content.endsWith('\n') ? change.content : `${change.content}\n`, card, category: match[1] });
    }
  }
  return changes;
}

function cardsWith(root, niche, changes) {
  const { cards } = loadCardsSync(join(root, 'knowledge'), categoryIds(niche));
  for (const change of changes) cards.set(change.card.id, { card: change.card, category: change.category, path: change.path });
  return cards;
}

function applyGenerated(root, niche, agent, artifacts, meta, written) {
  const created = [];
  for (const artifact of artifacts) {
    const path = `${agent.artifactDir}/${artifact.id}.json`;
    writeJsonAtomic(join(root, path), artifact);
    written.push(path, itemPath(artifact));
    const item = newItem({ id: artifact.id, niche: niche.id, by: agent.name, reason: 'generated' });
    item.artifacts[agent.name] = path;
    saveItem(root, item);
    appendRun(root, { ...meta, itemId: item.id, status: 'completed', outcome: 'created', from: null, to: item.status });
    created.push(item.id);
  }
  if (!created.length) appendRun(root, { ...meta, itemId: null, status: 'completed', outcome: 'no-items' });
  return created;
}

function applyDecisions(root, agent, decisions, chosenItems, meta, written) {
  const results = [];
  for (const decision of decisions) {
    let item = chosenItems.find((candidate) => candidate.id === decision.itemId);
    const path = `${agent.artifactDir}/${item.id}.json`;
    writeJsonAtomic(join(root, path), decision.artifact);
    written.push(path, itemPath(item));
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

function recordFailure(root, agent, chosenItems, error, meta, maxAttempts, written) {
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
    written.push(itemPath(item));
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
export async function tick({ root = repoRoot, runner, now = new Date(), nicheId, agents = loadAgents(), dryRun = false, maxAttempts = MAX_ATTEMPTS, lock = true, ignoreSchedule = false } = {}) {
  if (lock && !dryRun) {
    let release;
    try {
      release = acquireLock(root);
    } catch (error) {
      if (error instanceof LockedError) return { ran: null, locked: true, error: error.message, changedFiles: [] };
      throw error;
    }
    try {
      return await tick({ root, runner, now, nicheId, agents, dryRun, maxAttempts, lock: false, ignoreSchedule });
    } finally {
      release();
    }
  }
  const niche = loadNiche(nicheId ?? defaultNicheId(root), root);
  const { items, errors } = loadItems(root);
  if (errors.length) throw new Error(`Item store is invalid; fix before scheduling:\n${errors.join('\n')}`);
  const critic = agents.find((agent) => agent.mode === 'review');
  const tuner = agents.find((agent) => agent.mode === 'tune');
  const loop = {
    review: critic ? reviewCandidates({ critic, agents, items, state: readReviewState(root), now }) : [],
    tune: tuner ? tuneCandidates({ tuner, agents, root }) : [],
    freshSeeds: openSeeds(root).filter((seed) => seed.considered === 0).length,
    oldestFreshSeedAt: openSeeds(root).filter((seed) => seed.considered === 0).map((seed) => seed.at).sort()[0] ?? null,
  };
  const plan = planTick({ agents, items, runs: readRuns(root), schedule: readSchedule(root), now, ignoreSchedule, loop });
  if (!plan.chosen) return { ran: null, skipped: plan.skipped };
  const { agent, items: chosenItems } = plan.chosen;
  const written = [];
  const summary = { ran: agent.name, itemIds: chosenItems.map((item) => item.id), skipped: plan.skipped, changedFiles: written };
  if (dryRun) return { ...summary, dryRun: true };

  const started = Date.now();
  const candidate = plan.chosen.candidate;
  const meta = () => ({ workflow: `agent:${agent.name}`, agent: agent.name, durationMs: Date.now() - started });
  let response;
  let request;
  const before = snapshot(root);
  try {
    request = {
      agent,
      root,
      instructions: instructionsFor(agent, root, niche.id),
      input: candidate
        ? (agent.mode === 'review' ? buildReviewInput : buildTuneInput)({ root, niche, agents, candidate })
        : buildInput(root, niche, agent, chosenItems, items),
      tools: agent.runner.tools ?? [],
      permissions: agent.runner.permissions ?? {},
    };
    response = await runnerFor(agent, runner).run(request);
  } catch (error) {
    if (error instanceof RunnerUnavailableError) {
      appendRun(root, { ...meta(), itemId: null, status: 'failed', error: error.message, runnerUnavailable: true });
      return { ...summary, error: error.message, runnerUnavailable: true };
    }
    recordScheduledRun(root, agent, new Date().toISOString(), 'failed', written);
    return { ...summary, error: error.message, failures: recordFailure(root, agent, chosenItems, error, meta(), maxAttempts, written) };
  }
  recordScheduledRun(root, agent, new Date().toISOString(), 'completed', written);

  let checked;
  let cardChanges = [];
  let checks = { blocking: [], warnings: [] };
  let blockingFindings = [];
  try {
    // Agents only return output. Any file that changed during the run was not written by the tick.
    const strays = changedSince(before, snapshot(root)).filter((path) => !written.includes(path));
    if (strays.length) {
      throw new OutputError(`${agent.name} changed files outside its output (left in place for review; a human may also have edited them during the run): ${strays.join(', ')}`);
    }
    if (candidate) {
      try {
        assertValid(agent.validateEnvelope, response.output, `${agent.name} output`);
      } catch (error) {
        throw new OutputError(error.message);
      }
      validateArtifact(agent, response.output.artifact, `${agent.name} artifact`);
      const problem = agent.mode === 'tune' ? checkTuneArtifact(response.output.artifact, request.input) : null;
      if (problem) throw new OutputError(problem);
      checked = response.output.artifact;
    } else {
      checked = checkOutput(root, agent, response.output, chosenItems, items);
      if (agent.recheck) checked = enforceRecheck(agent, checked, request.input);
      const outputs = agent.mode === 'generate'
        ? checked.map((artifact) => ({ itemId: artifact.id, artifact }))
        : checked.map((d) => ({ itemId: d.itemId, artifact: d.artifact }));
      cardChanges = prepareCardChanges(root, niche, outputs);
      checks = runChecks(agent.name, outputs, {
        today: new Date().toISOString().slice(0, 10),
        cards: cardsWith(root, niche, cardChanges),
        markets: niche.markets,
        existingContent: contentIndex(root),
      });
      if (checks.blocking.length) {
        blockingFindings = checks.blocking;
        throw new OutputError(`quality checks failed: ${checks.blocking.join('; ')}`);
      }
    }
  } catch (error) {
    if (!(error instanceof OutputError)) throw error;
    if (blockingFindings.length) {
      written.push(addFeedback(root, {
        agent: agent.name, source: 'check', itemIds: chosenItems.map((item) => item.id),
        findings: blockingFindings.map((text) => ({ severity: 'major', problem: text, evidence: 'deterministic check (run rejected)', suggestion: 'Fix in the prompt so the agent stops producing this.' })),
      }));
    }
    // Keep what the agent returned (a real run costs usage) so a human can inspect or reuse it.
    const kept = `.backoffice/rejected/${agent.name}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    writeJsonAtomic(join(root, kept), { agent: agent.name, error: error.message, usage: response.usage ?? null, output: response.output });
    const failureMeta = { ...meta(), usage: response.usage ?? null, rejectedOutput: kept };
    return { ...summary, error: error.message, rejectedOutput: kept, failures: recordFailure(root, agent, chosenItems, error, failureMeta, maxAttempts, written) };
  }
  const eventMeta = { ...meta(), usage: response.usage ?? null };
  if (candidate) {
    const result = agent.mode === 'review'
      ? applyReview({ root, candidate, artifact: checked, written })
      : applyTune({ root, niche, candidate, input: request.input, artifact: checked, written });
    appendRun(root, { ...eventMeta, itemId: null, status: 'completed', outcome: agent.mode, target: candidate.target });
    return { ...summary, [agent.mode]: result };
  }
  for (const change of cardChanges) {
    writeTextAtomic(join(root, change.path), change.content);
    written.push(change.path);
  }
  const warnings = [...checks.warnings];
  const capped = agent.mode === 'generate' ? [] : checked.filter((d) => d.capped).map((d) => d.itemId);
  if (capped.length) warnings.push(`${agent.name} advanced more than allowed; converted to ${agent.maxAdvance.overflow}: ${capped.join(', ')}`);
  if (checks.warnings.length) {
    written.push(addFeedback(root, {
      agent: agent.name, source: 'check',
      itemIds: agent.mode === 'generate' ? checked.map((a) => a.id) : chosenItems.map((item) => item.id),
      findings: checks.warnings.map((text) => ({ severity: 'minor', problem: text, evidence: 'deterministic check', suggestion: 'Address in the prompt if it recurs.' })),
    }));
  }
  const extra = { ...(warnings.length ? { warnings } : {}), ...(cardChanges.length ? { cardsChanged: cardChanges.map((c) => c.path) } : {}) };
  if (agent.mode === 'generate') {
    if (agent.acceptsSeeds) written.push(...settleSeeds(root, request.input.seeds ? openSeeds(root).filter((seed) => request.input.seeds.some((s) => s.id === seed.id)) : [], checked));
    return { ...summary, created: applyGenerated(root, niche, agent, checked, eventMeta, written), ...extra };
  }
  return { ...summary, results: applyDecisions(root, agent, checked, chosenItems, eventMeta, written), ...extra };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { values } = parseArgs({
      options: {
        'dry-run': { type: 'boolean' }, commit: { type: 'boolean' },
        root: { type: 'string' }, niche: { type: 'string' },
        'ignore-schedule': { type: 'boolean' },
      },
    });
    const root = values.root ? resolve(values.root) : repoRoot;
    const commit = values.commit && !values['dry-run'];
    const run = async () => {
      // Never run agents on a stale checkout: --commit syncs first; a plain tick refuses if behind.
      let freshness = null;
      if (commit) syncMain(root);
      else if (values['dry-run']) freshness = remoteStatus(root);
      else freshness = assertFresh(root);
      const result = await tick({ root, dryRun: values['dry-run'], nicheId: values.niche, lock: false, ignoreSchedule: values['ignore-schedule'] });
      if (freshness?.behind > 0) result.warning = `checkout is ${freshness.behind} commit(s) behind the remote; a real tick here would refuse to run`;
      if (freshness?.unknown) result.warning = `could not check the remote (${freshness.reason}); this checkout may be stale`;
      if (commit && result.changedFiles?.length) result.commit = commitInternal(root, result.changedFiles, commitMessage(result));
      return result;
    };
    let result;
    if (values['dry-run']) result = await run();
    else {
      // The lock covers sync, tick and commit, so two scheduled runs never interleave.
      let release;
      try {
        release = acquireLock(root);
      } catch (error) {
        if (!(error instanceof LockedError)) throw error;
        console.log(JSON.stringify({ ran: null, locked: true, reason: error.message }, null, 2));
        process.exit(0); // not a failure: the other tick is doing the work
      }
      try {
        result = await run();
      } finally {
        release();
      }
    }
    console.log(JSON.stringify(result, null, 2));
    if (result.error) process.exitCode = 1;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
