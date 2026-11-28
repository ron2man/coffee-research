// Which checkout is the scheduler. Moving the scheduler to another machine must never leave two
// running: both would push to main. Each checkout has its own id (.backoffice/machine.json,
// gitignored, made on first use); the committed schedule state names the one that runs ticks.
// A tick with --commit elsewhere does nothing and says why. `npm run schedule -- claim` on the
// new machine makes it the scheduler (a fresh id, so a copied .backoffice can't claim twice).
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { hostname } from 'node:os';
import { join } from 'node:path';
import { readJson, writeJsonAtomic } from '../state/store.mjs';

export const MACHINE_PATH = '.backoffice/machine.json';

/** This checkout's identity: { id, name, createdAt }. `fresh` makes a new id. */
export function machineIdentity(root, { fresh = false, now = new Date(), name = hostname() } = {}) {
  const path = join(root, MACHINE_PATH);
  if (!fresh && existsSync(path)) {
    try {
      const saved = readJson(path);
      if (saved?.id) return saved;
    } catch { /* unreadable: make a new one */ }
  }
  const identity = { id: randomUUID(), name, createdAt: now.toISOString() };
  writeJsonAtomic(path, identity);
  return identity;
}

/**
 * May this checkout run committing ticks? `schedule` is the committed schedule state.
 * No scheduler named yet: the first checkout to tick claims it (returns claim: true).
 */
export function schedulerCheck(schedule, identity) {
  const owner = schedule?.scheduler;
  if (!owner?.id) return { allowed: true, claim: true };
  if (owner.id === identity.id) return { allowed: true, claim: false };
  return {
    allowed: false,
    reason: `this checkout (${identity.name}) is not the scheduler: ${owner.name} has been since ${String(owner.since).slice(0, 10)}. To move the scheduler here, run "npm run schedule -- claim" in this checkout, and uninstall the job on ${owner.name}.`,
  };
}

/** The schedule state with this checkout as the scheduler. */
export const withScheduler = (schedule, identity, now = new Date()) => ({ ...schedule, scheduler: { id: identity.id, name: identity.name, since: now.toISOString() } });
