// Detects files an agent changed on its own during a run. Agents may only return output;
// the tick writes every file. Works when the root is a git checkout; otherwise returns null.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const IGNORED = ['.backoffice/', 'node_modules/'];

function hashFile(path) {
  if (!existsSync(path)) return 'deleted';
  if (statSync(path).isDirectory()) return 'dir';
  return createHash('sha1').update(readFileSync(path)).digest('hex');
}

/** Map of every dirty or untracked path → content hash, or null outside a git checkout. */
export function snapshot(root) {
  const result = spawnSync('git', ['status', '--porcelain=v1', '-z', '--untracked-files=all'], { cwd: root, encoding: 'utf8' });
  if (result.error || result.status !== 0) return null;
  const entries = result.stdout.split('\0').filter(Boolean);
  const files = new Map();
  for (let i = 0; i < entries.length; i += 1) {
    const code = entries[i].slice(0, 2);
    const path = entries[i].slice(3);
    if (code.startsWith('R') || code.startsWith('C')) i += 1; // the next entry is the source path
    if (IGNORED.some((prefix) => path.startsWith(prefix))) continue;
    files.set(path, hashFile(join(root, path)));
  }
  return files;
}

/** Paths that changed between two snapshots. */
export function changedSince(before, after) {
  if (!before || !after) return [];
  const paths = new Set([...before.keys(), ...after.keys()]);
  return [...paths].filter((path) => before.get(path) !== after.get(path)).sort();
}
