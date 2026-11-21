// The feedback loop: the critic reviews each pipeline agent's recent outputs, the tuner turns
// open feedback into a prompt proposal, and a human applies or rejects it (npm run prompt).
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { instructionsFor, isPipelineAgent } from '../agents/registry.mjs';
import { readJson } from '../state/store.mjs';
import { addFeedback, listProposals, openFeedback, proposalId, readReviewState, writeProposal, writeReviewState } from './store.mjs';

const hourMs = 3_600_000;

/** Every output an agent produced after `since`, newest artifact per item. */
function outputsSince(agentName, items, since) {
  const out = [];
  for (const item of items) {
    for (const entry of item.history) {
      if (entry.by === agentName && (!since || entry.at > since)) out.push({ item, entry });
    }
  }
  return out.sort((a, b) => a.entry.at.localeCompare(b.entry.at));
}

/** Pipeline agents whose unreviewed outputs are due for the critic. Pure. */
export function reviewCandidates({ critic, agents, items, state, now = new Date() }) {
  const { minEntries = 3, maxWaitHours = 24, maxEntries = 10 } = critic.review ?? {};
  const due = [];
  for (const target of agents.filter(isPipelineAgent)) {
    const pending = outputsSince(target.name, items, state.reviewedUntil?.[target.name]);
    if (!pending.length) continue;
    const waited = (now.getTime() - Date.parse(pending[0].entry.at)) / hourMs;
    if (pending.length < minEntries && waited < maxWaitHours) continue;
    due.push({ target: target.name, entries: pending.slice(0, maxEntries), oldest: pending[0].entry.at });
  }
  return due.sort((a, b) => a.oldest.localeCompare(b.oldest));
}

/** Pipeline agents with enough open feedback and no open proposal. */
export function tuneCandidates({ tuner, agents, root }) {
  const { minOpen = 2 } = tuner.tune ?? {};
  const openProposals = new Set(listProposals(root).filter((p) => p.status === 'open').map((p) => p.agent));
  const due = [];
  for (const target of agents.filter(isPipelineAgent)) {
    if (!target.promptPath || openProposals.has(target.name)) continue;
    const open = openFeedback(root, target.name);
    const human = open.some((entry) => entry.source === 'human');
    const judged = open.some((entry) => entry.source === 'critic' || entry.source === 'human');
    if (judged && (open.length >= minOpen || human)) due.push({ target: target.name, open });
  }
  return due.sort((a, b) => b.open.length - a.open.length);
}

const guidancePath = (nicheId, agentName) => `niches/${nicheId}/agents/${agentName}.md`;
const readIf = (root, path) => (existsSync(join(root, path)) ? readFileSync(join(root, path), 'utf8') : null);
const entryView = ({ path, addressedBy, ...entry }) => entry;

export function buildReviewInput({ root, niche, agents, candidate }) {
  const target = agents.find((agent) => agent.name === candidate.target);
  return {
    today: new Date().toISOString().slice(0, 10),
    target: { name: target.name, description: target.description, instructions: instructionsFor(target, root, niche.id) },
    outputs: candidate.entries.map(({ item, entry }) => ({
      itemId: item.id,
      at: entry.at,
      movedTo: entry.to,
      reason: entry.reason,
      artifact: item.artifacts[target.name] && existsSync(join(root, item.artifacts[target.name]))
        ? readJson(join(root, item.artifacts[target.name])) : null,
    })),
    openFeedback: openFeedback(root, target.name).map(entryView),
  };
}

export function buildTuneInput({ root, niche, agents, candidate }) {
  const target = agents.find((agent) => agent.name === candidate.target);
  const promptRel = `engine/agents/${target.name}/prompt.md`;
  const rejected = listProposals(root).filter((p) => p.agent === target.name && p.status === 'rejected').slice(-3);
  return {
    target: { name: target.name, description: target.description },
    niche: { id: niche.id, name: niche.name },
    files: {
      prompt: { path: promptRel, text: readFileSync(target.promptPath, 'utf8') },
      'niche-guidance': { path: guidancePath(niche.id, target.name), text: readIf(root, guidancePath(niche.id, target.name)) },
    },
    feedback: candidate.open.map(entryView),
    recentlyRejected: rejected.map((p) => ({ id: p.id, summary: p.summary, rejectionReason: p.rejectionReason })),
  };
}

/** Throws a message string problem (caller wraps it as an output error). */
export function checkTuneArtifact(artifact, input) {
  const ids = new Set(input.feedback.map((entry) => entry.id));
  const unknown = [...artifact.addresses, ...artifact.notAddressed.map((n) => n.id)].filter((id) => !ids.has(id));
  if (unknown.length) return `tuner referenced unknown feedback ids: ${unknown.join(', ')}`;
  const files = artifact.changes.map((change) => change.file);
  if (new Set(files).size !== files.length) return 'tuner changed the same file twice';
  return null;
}

export function applyReview({ root, candidate, artifact, written }) {
  const path = addFeedback(root, {
    agent: candidate.target,
    source: 'critic',
    itemIds: [...new Set(candidate.entries.map(({ item }) => item.id))],
    findings: artifact.findings,
    extra: { summary: artifact.summary, keep: artifact.keep, promptChanges: artifact.promptChanges },
  });
  const state = readReviewState(root);
  state.reviewedUntil[candidate.target] = candidate.entries.at(-1).entry.at;
  written.push(path, writeReviewState(root, state));
  return { target: candidate.target, feedback: path, findings: artifact.findings.length };
}

export function applyTune({ root, niche, candidate, input, artifact, written }) {
  const id = proposalId(candidate.target);
  const proposal = {
    id,
    agent: candidate.target,
    status: 'open',
    at: new Date().toISOString(),
    summary: artifact.summary,
    changes: artifact.changes.map((change) => ({ ...change, path: input.files[change.file].path })),
    addresses: artifact.addresses,
    notAddressed: artifact.notAddressed,
    niche: niche.id,
  };
  written.push(writeProposal(root, proposal));
  return { target: candidate.target, proposal: id };
}
