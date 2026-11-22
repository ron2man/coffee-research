// Git handling for scheduler ticks (rebuild-spec principle 7):
// internal changes are committed straight to the main branch; public paths never are.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

export const policy = JSON.parse(readFileSync(new URL('./git-policy.json', import.meta.url), 'utf8'));

export function isPublic(path, publicPaths = policy.publicPaths) {
  return publicPaths.some((prefix) => path === prefix.replace(/\/$/, '') || path.startsWith(prefix));
}

export function classify(paths, publicPaths = policy.publicPaths) {
  const unique = [...new Set(paths)].sort();
  return {
    internal: unique.filter((path) => !isPublic(path, publicPaths)),
    public: unique.filter((path) => isPublic(path, publicPaths)),
  };
}

function git(root, args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${(result.stderr || result.stdout).trim()}`);
  return result.stdout.trim();
}

function tryGit(root, args) {
  try {
    git(root, args);
    return null;
  } catch (error) {
    return error;
  }
}

function lines(text) {
  return text ? text.split('\n').filter(Boolean) : [];
}

export class StaleCheckoutError extends Error {}

/**
 * Fetch and compare with the remote branch. Returns { behind, ahead } or, when the remote
 * cannot be reached (offline, no remote), { unknown: true, reason }.
 */
export function remoteStatus(root, { remote = policy.remote, branch = policy.mainBranch } = {}) {
  const failed = tryGit(root, ['fetch', '--quiet', remote, branch]);
  if (failed) return { unknown: true, reason: failed.message };
  const count = (range) => Number(git(root, ['rev-list', '--count', range]));
  return { behind: count(`HEAD..${remote}/${branch}`), ahead: count(`${remote}/${branch}..HEAD`) };
}

/**
 * Refuse to run agents on a checkout that is behind the remote: another checkout (usually the
 * scheduler's clone) has already moved items on, so this run would redo or contradict its work.
 */
export function assertFresh(root, { remote = policy.remote, branch = policy.mainBranch } = {}) {
  const status = remoteStatus(root, { remote, branch });
  if (status.behind > 0) {
    throw new StaleCheckoutError(`This checkout is ${status.behind} commit(s) behind ${remote}/${branch}: another checkout (probably the scheduler) has moved on. Pull first, or start a tick with \`npm run schedule -- run-now\`.`);
  }
  return status;
}

/**
 * Files with uncommitted local changes that the incoming commits also change. Pulling over them
 * (with or without autostash) is what leaves conflict markers in data files, so refuse instead.
 */
function clashes(root, remote, branch) {
  const incoming = new Set(lines(git(root, ['diff', '--name-only', `HEAD...${remote}/${branch}`])));
  const local = lines(git(root, ['diff', '--name-only', 'HEAD']));
  return local.filter((path) => incoming.has(path));
}

function assertNoClash(root, remote, branch) {
  const clashing = clashes(root, remote, branch);
  if (clashing.length) {
    throw new Error(`Local uncommitted changes clash with new commits on ${remote}/${branch}: ${clashing.join(', ')}. Nothing was changed. Keep the remote version (git checkout HEAD -- <file>, then pull) or commit yours first, then rerun.`);
  }
}

/**
 * Put local tick commits on top of the remote branch. Tick commits only touch internal data
 * files, so a rebase is safe; on a conflict the rebase is aborted and the error says so.
 * Uncommitted edits to files the remote also changed stop it before anything is touched.
 */
function rebaseOnto(root, remote, branch) {
  tryGit(root, ['fetch', '--quiet', remote, branch]);
  assertNoClash(root, remote, branch);
  const failed = tryGit(root, ['pull', '--rebase', '--autostash', '--quiet', remote, branch]);
  if (!failed) return;
  tryGit(root, ['rebase', '--abort']);
  throw new Error(`Could not rebase local ${branch} onto ${remote}/${branch}; resolve by hand, then rerun the tick. ${failed.message}`);
}

/** Refuse to run unless the checkout is on the main branch; then sync with the remote. */
export function syncMain(root, { remote = policy.remote, branch = policy.mainBranch } = {}) {
  const current = git(root, ['symbolic-ref', '--short', 'HEAD']);
  if (current !== branch) throw new Error(`Scheduler commits run only on ${branch} (checkout is on ${current})`);
  const status = remoteStatus(root, { remote, branch });
  if (status.unknown) throw new Error(`Cannot reach ${remote}/${branch} to sync before committing: ${status.reason}`);
  if (status.behind === 0) return;
  assertNoClash(root, remote, branch);
  // Fast-forward normally; if an earlier push failed and someone pushed since, rebase instead.
  if (status.ahead === 0) git(root, ['merge', '--ff-only', '--quiet', `${remote}/${branch}`]);
  else rebaseOnto(root, remote, branch);
}

/**
 * Commit exactly `paths` (nothing else that happens to be staged) and push to main.
 * Throws without committing if any path is public: those need a PR.
 */
export function commitInternal(root, paths, message, { remote = policy.remote, branch = policy.mainBranch, publicPaths = policy.publicPaths } = {}) {
  const { internal, public: blocked } = classify(paths, publicPaths);
  if (blocked.length) {
    throw new Error(`Refusing to commit reader-facing paths to ${branch}; open a PR instead: ${blocked.join(', ')}`);
  }
  if (!internal.length) return null;
  git(root, ['add', '--', ...internal]);
  git(root, ['commit', '--quiet', '-m', message, '--', ...internal]);
  // Someone may have pushed while the agent ran: rebase once and retry.
  if (tryGit(root, ['push', '--quiet', remote, `HEAD:refs/heads/${branch}`])) {
    rebaseOnto(root, remote, branch);
    git(root, ['push', '--quiet', remote, `HEAD:refs/heads/${branch}`]);
  }
  return git(root, ['rev-parse', 'HEAD']);
}

export function commitMessage(result) {
  if (result.review) return `tick(${result.ran}): reviewed ${result.review.target} (${result.review.findings} findings)`;
  if (result.tune) return `tick(${result.ran}): proposed ${result.tune.proposal} for ${result.tune.target}`;
  const outcomes = result.created?.length
    ? `created ${result.created.join(', ')}`
    : result.results?.map((r) => `${r.id} ${r.outcome}→${r.to}`).join('; ')
      ?? result.failures?.map((f) => `${f.id} failed (attempt ${f.attempts}${f.blocked ? ', blocked' : ''})`).join('; ')
      ?? 'no changes';
  return `tick(${result.ran}): ${outcomes}`;
}
