#!/usr/bin/env node
// Weekly review data (no AI).
//   npm run report -- week [--to 2026-12-06] [--days 7] [--json]   the week before --to (default now)
//   npm run report -- digest [--commit]                             write missing daily run digests
// Run digests come from the scheduler's local run log; the tick commits them every day.
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { repoRoot } from '../state/niche.mjs';
import { withLock } from '../scheduler/lock.mjs';
import { commitInternal, syncMain } from '../scheduler/git.mjs';
import { weekMarkdown, weekReport, writeDailyDigests } from './report.mjs';

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { values, positionals } = parseArgs({ allowPositionals: true, options: { to: { type: 'string' }, days: { type: 'string' }, json: { type: 'boolean' }, commit: { type: 'boolean' }, root: { type: 'string' } } });
    const root = values.root ? resolve(values.root) : repoRoot;
    const [command = 'week'] = positionals;
    if (command === 'week') {
      const to = values.to ? new Date(`${values.to}T00:00:00Z`) : new Date();
      const report = weekReport(root, { to, days: Number(values.days ?? 7) });
      console.log(values.json ? JSON.stringify(report, null, 2) : weekMarkdown(report));
    } else if (command === 'digest') {
      const written = await withLock(root, async () => {
        if (values.commit) syncMain(root);
        const paths = writeDailyDigests(root);
        if (values.commit && paths.length) commitInternal(root, paths, 'report: daily run digest');
        return paths;
      }, { label: 'report digest' });
      console.log(written.length ? `Wrote ${written.join(', ')}` : 'No missing days.');
    } else {
      throw new Error('Usage: npm run report -- week [--to YYYY-MM-DD] [--json] | digest [--commit]');
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
