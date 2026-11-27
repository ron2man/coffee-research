// Automatic publishing pull requests. With the GitHub CLI signed in, each tick:
//  1. queues passed posts that nothing blocks (so you don't have to press Approve);
//  2. opens a real pull request for requests that only have a compare link;
//  3. records merged or closed pull requests;
//  4. with niche.json publishing.autoMerge on, merges a publishing PR once it has been open for
//     vetoHours, its checks are green and nobody added the "hold" label (approved by the project
//     lead on 2026-11-24: "a human can stop it" replaces "a human merges every post").
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { readJson, writeJsonAtomic } from '../state/store.mjs';
import { publishProblems, queuePublish, REQUESTS_DIR } from './publish.mjs';

/** gh wrapper: { ok, out, err }. Injectable for tests. */
export function ghCli(root, args) {
  const result = spawnSync('gh', args, { cwd: root, encoding: 'utf8' });
  return { ok: !result.error && result.status === 0, out: (result.stdout ?? '').trim(), err: (result.stderr ?? '').trim() };
}

function requests(root) {
  const dir = join(root, REQUESTS_DIR);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((n) => n.endsWith('.json')).map((n) => ({ path: `${REQUESTS_DIR}/${n}`, ...readJson(join(dir, n)) }));
}

export const HOLD_LABEL = 'hold';
const checksGreen = (rollup = []) => rollup.length > 0 && rollup.every((c) => ['SUCCESS', 'NEUTRAL', 'SKIPPED'].includes(c.conclusion ?? c.state));

export function autoPullRequests(root, items, { gh = ghCli, now = new Date(), policy = {} } = {}) {
  const written = [];
  const events = [];
  if (!gh(root, ['auth', 'status']).ok) return { written, events };
  const known = new Set(requests(root).map((r) => r.itemId));
  for (const item of items.filter((i) => i.status === 'passed' && !known.has(i.id))) {
    if (publishProblems(root, item).length) continue;
    written.push(queuePublish(root, item.id, { by: 'scheduler (passed the judge)', now }));
    events.push(`queued ${item.id}`);
  }
  for (const request of requests(root).filter((r) => r.status === 'open')) {
    const view = gh(root, ['pr', 'view', request.branch, '--json', 'number,url,state,labels,statusCheckRollup,createdAt']);
    const { path, ...rest } = request;
    if (!view.ok) {
      const veto = policy.autoMerge
        ? `It merges itself ${policy.vetoHours ?? 24} hours after it opens if the checks pass. To stop that, add the **${HOLD_LABEL}** label (or press Hold in the dashboard), or close it.`
        : 'Merging this publishes the guide on the live site. Close it to keep the guide unpublished.';
      const body = `Ready to publish: \`${request.slug}\` passed the post judge.\n\n${veto}`;
      const created = gh(root, ['pr', 'create', '--head', request.branch, '--base', 'main', '--title', `Publish: ${request.slug}`, '--body', body]);
      if (created.ok) {
        writeJsonAtomic(join(root, path), { ...rest, prUrl: created.out.split('\n').at(-1), prOpenedAt: now.toISOString() });
        written.push(path);
        events.push(`opened PR for ${request.itemId}`);
      }
      continue;
    }
    const pr = JSON.parse(view.out);
    if (pr.state === 'MERGED' || pr.state === 'CLOSED') {
      writeJsonAtomic(join(root, path), { ...rest, status: pr.state.toLowerCase(), prUrl: pr.url });
      written.push(path);
      events.push(`${request.itemId}: PR ${pr.state.toLowerCase()}`);
      continue;
    }
    const held = pr.labels?.some((l) => l.name === HOLD_LABEL);
    const age = now.getTime() - Date.parse(pr.createdAt ?? rest.prOpenedAt ?? now.toISOString());
    if (policy.autoMerge && !held && age >= (policy.vetoHours ?? 24) * 3_600_000 && checksGreen(pr.statusCheckRollup)) {
      const merged = gh(root, ['pr', 'merge', String(pr.number), '--squash', '--delete-branch']);
      if (merged.ok) {
        writeJsonAtomic(join(root, path), { ...rest, status: 'merged', prUrl: pr.url, mergedAt: now.toISOString(), mergedBy: 'scheduler (veto window passed)' });
        written.push(path);
        events.push(`merged ${request.itemId} after the veto window`);
        continue;
      }
      events.push(`merge failed for ${request.itemId}: ${merged.err.slice(0, 120)}`);
    }
    if (rest.prUrl !== pr.url || Boolean(rest.held) !== Boolean(held)) {
      writeJsonAtomic(join(root, path), { ...rest, prUrl: pr.url, held: Boolean(held), prOpenedAt: rest.prOpenedAt ?? pr.createdAt });
      written.push(path);
    }
  }
  return { written, events };
}

/** Stop a publishing PR from merging itself (dashboard "Hold"). */
export function holdPublish(root, itemId, { gh = ghCli } = {}) {
  const request = requests(root).find((r) => r.itemId === itemId);
  if (!request) throw new Error(`No publishing request for ${itemId}`);
  gh(root, ['label', 'create', HOLD_LABEL, '--color', 'B60205', '--description', 'Do not auto-merge']);
  const result = gh(root, ['pr', 'edit', request.branch, '--add-label', HOLD_LABEL]);
  if (!result.ok) throw new Error(`Could not add the hold label: ${result.err || 'is the GitHub CLI signed in?'}`);
  const { path, ...rest } = request;
  writeJsonAtomic(join(root, path), { ...rest, held: true });
  return [path];
}
