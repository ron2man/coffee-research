// Make this checkout the scheduler: a fresh machine id, written into the committed schedule state
// and pushed to main. The old scheduler's next tick pulls it and stops running (it says why in its
// log). Uninstall the job there too, so it stops trying.
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { machineIdentity, withScheduler } from '../engine/scheduler/host.mjs';
import { SCHEDULE_PATH, readSchedule } from '../engine/scheduler/tick.mjs';
import { writeJsonAtomic } from '../engine/state/store.mjs';
import { withLock } from '../engine/scheduler/lock.mjs';
import { commitInternal, syncMain } from '../engine/scheduler/git.mjs';

export async function claimScheduler(root, { now = new Date(), commit = true } = {}) {
  return withLock(root, async () => {
    // Start from the committed state: a claim that failed half-way may have left the file changed.
    if (commit) spawnSync('git', ['checkout', '--', SCHEDULE_PATH], { cwd: root });
    if (commit) syncMain(root);
    const before = readSchedule(root).scheduler ?? null;
    const identity = machineIdentity(root, { fresh: true, now });
    writeJsonAtomic(join(root, SCHEDULE_PATH), withScheduler(readSchedule(root), identity, now));
    if (commit) commitInternal(root, [SCHEDULE_PATH], `schedule: ${identity.name} is the scheduler${before ? ` (was ${before.name})` : ''}`);
    return `${identity.name} is now the scheduler${before ? `; ${before.name} stops at its next tick. Uninstall the job there: npm run schedule -- uninstall` : ''}.\nNext here: npm run schedule -- install`;
  }, { label: 'schedule claim' });
}
