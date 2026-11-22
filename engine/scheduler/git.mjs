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

/**
 * Put local tick commits on top of the remote branch. Tick commits only touch internal data
 * files, so a rebase is safe; on a conflict the rebase is aborted and the error says so.
 */
function rebaseOnto(root, remote, branch) {
  const failed = tryGit(root, ['pull', '--rebase', '--autostash', '--quiet', remote, branch]);
  if (!failed) return;
  tryGit(root, ['rebase', '--abort']);
  throw new Error(`Could not rebase local ${branch} onto ${remote}/${branch}; resolve by hand, then rerun the tick. ${failed.message}`);
}

/** Refuse to run unless the checkout is on the main branch; then sync with the remote. */
export function syncMain(root, { remote = policy.remote, branch = policy.mainBranch } = {}) {
  const current = git(root, ['symbolic-ref', '--short', 'HEAD']);
  if (current !== branch) throw new Error(`Scheduler commits run only on ${branch} (checkout is on ${current})`);
  // Fast-forward normally; if an earlier push failed and someone pushed since, rebase instead.
  if (tryGit(root, ['pull', '--ff-only', '--quiet', remote, branch])) rebaseOnto(root, remote, branch);
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
