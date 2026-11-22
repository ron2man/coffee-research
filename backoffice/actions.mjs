// Dashboard actions. Each one goes through the same engine functions as the CLIs (status only
// changes through the machine), runs under the tick lock, and (with commit) syncs, commits and
// pushes to main like a tick, so the scheduler sees it at its next run.
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { userInfo } from 'node:os';
import { act } from '../engine/state/item-cli.mjs';
import { addSeed } from '../engine/state/seeds.mjs';
import { addHumanNote, applyProposal, rejectProposal } from '../engine/feedback/cli.mjs';
import { LockedError, isStale, lockPath, withLock } from '../engine/scheduler/lock.mjs';
import { commitInternal, syncMain } from '../engine/scheduler/git.mjs';

const by = () => process.env.USER ?? userInfo().username;
const required = (value, label) => {
  if (typeof value !== 'string' || !value.trim()) throw new ActionError(`${label} is required`);
  return value.trim();
};

export class ActionError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

/** Each action returns { written, message }. */
const ACTIONS = {
  comment: (root, { itemId, agent = 'writer', text }) => ({
    written: [addHumanNote(root, agent, required(text, 'Comment'), { itemId, by: by() })],
    message: `Comment saved for the ${agent}. It reaches the ${agent} on this article's next pass and the prompt tuner.`,
  }),
  revise: (root, { itemId, text }) => {
    const item = act(root, 'revise', required(itemId, 'Article'), { reason: required(text, 'What to change'), by: by() });
    return { written: [`data/items/${itemId}.json`, item.feedbackPath], message: 'Sent back to the writer. The judge reviews the rewrite.' };
  },
  resume: (root, { itemId, text }) => {
    act(root, 'resume', required(itemId, 'Item'), { reason: required(text, 'Reason'), by: by() });
    return { written: [`data/items/${itemId}.json`], message: 'Resumed: it continues at the next tick.' };
  },
  reject: (root, { itemId, text }) => {
    act(root, 'reject', required(itemId, 'Item'), { reason: required(text, 'Reason'), by: by() });
    return { written: [`data/items/${itemId}.json`], message: 'Rejected.' };
  },
  reopen: (root, { itemId, text }) => {
    act(root, 'reopen', required(itemId, 'Item'), { reason: required(text, 'Reason'), by: by() });
    return { written: [`data/items/${itemId}.json`], message: 'Reopened as an idea: the judge scores it again.' };
  },
  seed: (root, { text, note }) => ({
    written: [addSeed(root, { text: required(text, 'Seed'), note: note ?? '', by: by() })],
    message: 'Seed added. The idea agent looks into it at the next tick.',
  }),
  'apply-proposal': (root, { proposalId }) => ({
    written: applyProposal(root, required(proposalId, 'Proposal'), { by: by() }),
    message: 'Prompt change applied. The agent uses it from its next run.',
  }),
  'reject-proposal': (root, { proposalId, text }) => ({
    written: rejectProposal(root, required(proposalId, 'Proposal'), { reason: required(text, 'Reason'), by: by() }),
    message: 'Proposal rejected. The tuner sees your reason next time.',
  }),
};

export const actionNames = Object.keys(ACTIONS);

export async function runAction(root, name, payload = {}, { commit = true } = {}) {
  const action = ACTIONS[name];
  if (!action) throw new ActionError(`Unknown action ${name}`, 404);
  const commitAllowed = commit && existsSync(join(root, '.git'));
  try {
    return await withLock(root, async () => {
      if (commitAllowed) syncMain(root);
      let result;
      try {
        result = action(root, payload);
      } catch (error) {
        throw error instanceof ActionError ? error : new ActionError(error.message);
      }
      const written = result.written.filter(Boolean);
      if (commitAllowed) commitInternal(root, written, `dashboard(${name}): ${payload.itemId ?? payload.proposalId ?? 'seed'}`);
      return { ok: true, message: result.message, written, committed: commitAllowed };
    }, { label: `dashboard ${name}` });
  } catch (error) {
    if (error instanceof LockedError) throw new ActionError('An agent run is in progress. Try again in a few minutes.', 409);
    throw error;
  }
}

/**
 * Start one tick now, exactly as the scheduler runs it (ops/tick.sh: commits, pushes, logs to
 * .backoffice/tick.log). Returns at once; the dashboard shows progress through the lock and the log.
 */
export function startTick(root, { spawnTick = spawn } = {}) {
  const lock = lockPath(root);
  if (existsSync(lock)) {
    let holder = null;
    try {
      holder = JSON.parse(readFileSync(lock, 'utf8'));
    } catch {
      // unreadable lock: the tick script decides
    }
    if (holder && !isStale(holder)) throw new ActionError('A tick is already running.', 409);
  }
  const script = join(root, 'ops', 'tick.sh');
  if (!existsSync(script)) throw new ActionError(`No ops/tick.sh in ${root}`, 500);
  const child = spawnTick('/bin/bash', [script], { cwd: root, detached: true, stdio: 'ignore' });
  child.unref?.();
  return { ok: true, message: 'Tick started. It usually takes 1 to 15 minutes; this page updates while it runs.' };
}
