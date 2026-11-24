// Automatic publishing pull requests. With the GitHub CLI signed in, each tick:
//  1. queues passed posts that nothing blocks (so you don't have to press Approve);
//  2. opens a real pull request for requests that only have a compare link;
//  3. records merged or closed pull requests.
// Merging stays a human action: a post goes live only when you merge its pull request.
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

export function autoPullRequests(root, items, { gh = ghCli, now = new Date() } = {}) {
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
    const view = gh(root, ['pr', 'view', request.branch, '--json', 'url,state']);
    const { path, ...rest } = request;
    if (!view.ok) {
      const body = `Ready to publish: \`${request.slug}\` passed the post judge.\n\nMerging this publishes the guide on the live site. Close it to keep the guide unpublished.`;
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
    } else if (rest.prUrl !== pr.url) {
      writeJsonAtomic(join(root, path), { ...rest, prUrl: pr.url });
      written.push(path);
    }
  }
  return { written, events };
}
