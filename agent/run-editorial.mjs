import { spawnSync } from 'node:child_process';
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { scanKnowledge } from './knowledge.mjs';
import { judgeEditorial } from './judge-editorial.mjs';

const start = Date.now();

function record(status, details) {
  mkdirSync('.backoffice', { recursive: true });
  appendFileSync('.backoffice/runs.jsonl', JSON.stringify({
    timestamp: new Date().toISOString(),
    workflow: 'Coffee editorial workflow',
    status,
    durationMs: Date.now() - start,
    details,
  }) + '\n');
}

function run(command, args, capture = false) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    stdio: capture ? ['ignore', 'pipe', 'inherit'] : ['ignore', 'inherit', 'inherit'],
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} exited with status ${result.status}`);
  return capture ? result.stdout : '';
}

function workingChanges() {
  return run('git', ['status', '--porcelain=v1', '-z', '--untracked-files=all'], true)
    .split('\0').filter(Boolean);
}

try {
  const branch = run('git', ['symbolic-ref', '--short', 'HEAD'], true).trim();
  run('git', ['remote', 'get-url', 'origin'], true);
  if (workingChanges().length) throw new Error('Start the editorial workflow with a clean checkout');

  const seoSkill = readFileSync('agent/skills/coffee-seo/SKILL.md', 'utf8');
  const prompt = [readFileSync('agent/editorial-workflow.md', 'utf8'), seoSkill].join('\n\n');
  run('codex', ['exec', '-s', 'workspace-write', prompt]);
  run(process.execPath, ['agent/validate-knowledge.mjs']);

  const changes = workingChanges();
  if (!changes.length) {
    record('completed', { changedFiles: [], outcome: 'No repository changes' });
    console.log('No repository changes to push.');
  } else {
    const paths = changes.map((change) => {
      const path = change.slice(3);
      if (![' M', '??'].includes(change.slice(0, 2)) ||
          !/^(?:knowledge\/(?:grinders|machines)|content\/drafts)\/[a-z0-9-]+(?:\.brief)?\.md$/.test(path)) {
        throw new Error(`Unexpected workflow change: ${change}`);
      }
      return path;
    });

    const { cards } = await scanKnowledge('knowledge');
    const briefs = paths.filter((path) => path.endsWith('.brief.md'));
    const drafts = paths.filter((path) => path.startsWith('content/drafts/') && !path.endsWith('.brief.md'));
    for (const draft of drafts) {
      if (!briefs.includes(draft.replace(/\.md$/, '.brief.md'))) {
        throw new Error(`Missing changed brief for ${draft}`);
      }
    }
    const reviews = [];
    for (const brief of briefs) {
      const draft = brief.replace(/\.brief\.md$/, '.md');
      if (!drafts.includes(draft)) throw new Error(`Missing changed draft for ${brief}`);
      const markdown = readFileSync(brief, 'utf8');
      const links = [...markdown.matchAll(/`([a-z0-9-]+)\/([a-z0-9-]+)`/g)];
      if (!links.length) throw new Error(`No claim references in ${brief}`);
      for (const [, product, claim] of links) {
        if (!cards.get(product)?.claims.some((entry) => entry.id === claim && entry.status === 'supported')) {
          throw new Error(`Unresolved or unsupported claim ${product}/${claim} in ${brief}`);
        }
      }
      const evidence = [...new Set(links.map(([, product]) => product))].map((id) => cards.get(id));
      reviews.push({ draft, brief, review: judgeEditorial(readFileSync(draft, 'utf8'), markdown, evidence, seoSkill) });
    }

    if (JSON.stringify(workingChanges()) !== JSON.stringify(changes)) {
      throw new Error('Repository changes appeared during editorial judging');
    }
    const verdicts = reviews.map(({ draft, brief, review }) => {
      const path = draft.replace(/\.md$/, '.review.json');
      writeFileSync(path, JSON.stringify({ draft, brief, ...review }, null, 2) + '\n', { flag: 'wx' });
      paths.push(path);
      return { draft, verdict: review.verdict, review: path };
    });
    run('git', ['add', '--', ...paths]);
    run('git', ['diff', '--cached', '--check']);
    run('git', ['commit', '-m', 'Run coffee editorial research workflow']);
    run('git', ['push', 'origin', `HEAD:refs/heads/${branch}`]);
    record('completed', { changedFiles: paths, verdicts, branch, commit: run('git', ['rev-parse', 'HEAD'], true).trim() });
  }
} catch (error) {
  try {
    record('failed', error.message);
  } catch (logError) {
    console.error(logError.message);
  }
  console.error(error.message);
  process.exitCode = 1;
}
