// Feedback on agent output: deterministic checks, the critic agent and human notes.
// data/feedback/<agent>/<id>.json, one file per entry, committed like any internal state.
// Prompt proposals from the tuner: data/prompt-proposals/<id>.json, applied only by a human.
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { readJson, writeJsonAtomic } from '../state/store.mjs';

export const FEEDBACK_DIR = 'data/feedback';
export const PROPOSALS_DIR = 'data/prompt-proposals';
export const REVIEW_STATE = 'data/feedback/state.json';

const stamp = (at) => at.replace(/[:.]/g, '-');

/** Write one feedback entry. Returns its repo-relative path. */
export function addFeedback(root, { agent, source, findings, itemIds = [], at = new Date().toISOString(), extra = {} }) {
  // Two entries in the same millisecond (a comment and a revise) must not overwrite each other.
  let id = `${stamp(at)}-${source}`;
  for (let n = 2; existsSync(join(root, FEEDBACK_DIR, agent, `${id}.json`)); n += 1) id = `${stamp(at)}-${source}-${n}`;
  const path = `${FEEDBACK_DIR}/${agent}/${id}.json`;
  writeJsonAtomic(join(root, path), { id, agent, source, at, itemIds, findings, addressedBy: null, ...extra });
  return path;
}

export function listFeedback(root, agent) {
  const dir = join(root, FEEDBACK_DIR, agent);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((n) => n.endsWith('.json')).sort()
    .map((name) => ({ ...readJson(join(dir, name)), path: `${FEEDBACK_DIR}/${agent}/${name}` }));
}

export function openFeedback(root, agent) {
  return listFeedback(root, agent).filter((entry) => !entry.addressedBy);
}

export function markAddressed(root, entries, by) {
  return entries.map((entry) => {
    const { path, ...rest } = entry;
    writeJsonAtomic(join(root, path), { ...rest, addressedBy: by });
    return path;
  });
}

export function readReviewState(root) {
  const path = join(root, REVIEW_STATE);
  return existsSync(path) ? readJson(path) : { schemaVersion: 1, reviewedUntil: {} };
}

export function writeReviewState(root, state) {
  writeJsonAtomic(join(root, REVIEW_STATE), state);
  return REVIEW_STATE;
}

export function listProposals(root) {
  const dir = join(root, PROPOSALS_DIR);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((n) => n.endsWith('.json')).sort()
    .map((name) => ({ ...readJson(join(dir, name)), path: `${PROPOSALS_DIR}/${name}` }));
}

export function writeProposal(root, proposal) {
  const path = `${PROPOSALS_DIR}/${proposal.id}.json`;
  writeJsonAtomic(join(root, path), proposal);
  return path;
}

export const proposalId = (agent, at = new Date().toISOString()) => `${agent}-${stamp(at)}`;
