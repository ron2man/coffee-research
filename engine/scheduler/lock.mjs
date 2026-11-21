// One tick at a time per checkout. The lock lives in the gitignored .backoffice/ folder.
// A lock is stale when its process is gone (same host) or it is older than maxAgeMs.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { hostname } from 'node:os';
import { dirname, join } from 'node:path';

export const DEFAULT_MAX_AGE_MS = 3 * 3_600_000;

export class LockedError extends Error {
  constructor(message, holder) {
    super(message);
    this.name = 'LockedError';
    this.holder = holder;
  }
}

export const lockPath = (root) => join(root, '.backoffice', 'tick.lock');

function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === 'EPERM';
  }
}

function readHolder(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null; // unreadable or half-written: treat as stale
  }
}

export function isStale(holder, { now = Date.now(), maxAgeMs = DEFAULT_MAX_AGE_MS, host = hostname() } = {}) {
  if (!holder || !Number.isFinite(Date.parse(holder.startedAt))) return true;
  if (now - Date.parse(holder.startedAt) > maxAgeMs) return true;
  return holder.host === host && !alive(holder.pid);
}

/** Take the lock or throw LockedError. Returns a release function. */
export function acquireLock(root, { label = 'tick', maxAgeMs = DEFAULT_MAX_AGE_MS } = {}) {
  const path = lockPath(root);
  mkdirSync(dirname(path), { recursive: true });
  const mine = { pid: process.pid, host: hostname(), label, startedAt: new Date().toISOString() };
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      writeFileSync(path, JSON.stringify(mine) + '\n', { flag: 'wx' });
      return () => {
        if (readHolder(path)?.pid === mine.pid && readHolder(path)?.startedAt === mine.startedAt) rmSync(path, { force: true });
      };
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      const holder = readHolder(path);
      if (!isStale(holder, { maxAgeMs })) {
        throw new LockedError(`Another ${holder.label} is running (pid ${holder.pid} on ${holder.host} since ${holder.startedAt})`, holder);
      }
      rmSync(path, { force: true }); // stale: take it over
    }
  }
  throw new LockedError('Could not take the tick lock');
}

export async function withLock(root, fn, options) {
  const release = acquireLock(root, options);
  try {
    return await fn();
  } finally {
    release();
  }
}
