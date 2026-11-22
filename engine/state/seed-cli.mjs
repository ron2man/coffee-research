#!/usr/bin/env node
// Give the idea agent topics to look into.
//   npm run seed -- add "I own an entry-level machine and want better results; where do I start?" [--note "..."] [--commit]
//   npm run seed -- list [--all]
//   npm run seed -- close <id> --reason "..." [--commit]
// A new seed makes the idea agent run at the next tick, even before its daily interval.
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { userInfo } from 'node:os';
import { repoRoot } from './niche.mjs';
import { addSeed, closeSeed, listSeeds } from './seeds.mjs';
import { withLock } from '../scheduler/lock.mjs';
import { commitInternal, syncMain } from '../scheduler/git.mjs';

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { values, positionals } = parseArgs({
      allowPositionals: true,
      options: { note: { type: 'string' }, reason: { type: 'string' }, all: { type: 'boolean' }, commit: { type: 'boolean' }, root: { type: 'string' } },
    });
    const root = values.root ? resolve(values.root) : repoRoot;
    const [command, ...rest] = positionals;
    if (command === 'list') {
      for (const s of listSeeds(root).filter((s) => values.all || s.status === 'open')) {
        console.log(`${s.id}\t${s.status}\tconsidered ${s.considered}x${s.itemIds.length ? `\tcards: ${s.itemIds.join(', ')}` : ''}\n    ${s.text}`);
      }
    } else if (command === 'add' || command === 'close') {
      const path = await withLock(root, async () => {
        if (values.commit) syncMain(root);
        const written = command === 'add'
          ? addSeed(root, { text: rest.join(' '), note: values.note, by: process.env.USER ?? userInfo().username })
          : closeSeed(root, rest[0], { reason: values.reason });
        if (values.commit) commitInternal(root, [written], `seed(${command}): ${written.split('/').pop().replace('.json', '')}`);
        return written;
      }, { label: `seed ${command}` });
      console.log(`Wrote ${path}`);
    } else {
      throw new Error('Usage: npm run seed -- add "..." | list | close <id> --reason "..."');
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
