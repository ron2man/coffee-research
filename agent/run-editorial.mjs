import { spawnSync } from 'node:child_process';
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
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

function changedPaths(revision) {
  return workingChanges().map((change) => {
    const path = change.slice(3);
    const knowledge = /^knowledge\/(?:grinders|machines)\/[a-z0-9-]+\.md$/.test(path);
    const editorial = revision
      ? [revision.draft, revision.brief].includes(path)
      : /^content\/drafts\/[a-z0-9-]+(?:\.brief)?\.md$/.test(path);
    if (![' M', '??'].includes(change.slice(0, 2)) || !(knowledge || editorial)) {
      throw new Error(`Unexpected workflow change: ${change}`);
    }
    return path;
  });
}

function newDraft(paths) {
  const editorial = paths.filter((path) => path.startsWith('content/drafts/'));
  if (!editorial.length) return null;
  const draft = editorial.find((path) => !path.endsWith('.brief.md'));
  const brief = draft?.replace(/\.md$/, '.brief.md');
  if (editorial.length !== 2 || !editorial.includes(brief)) {
    throw new Error('Expected one changed draft and its matching brief');
  }
  return { draft, brief };
}

async function reviewDraft({ draft, brief }, seoSkill) {
  const { cards, errors } = await scanKnowledge('knowledge');
  if (errors.length) throw new Error(errors.join('\n'));
  const markdown = readFileSync(brief, 'utf8');
  const links = [...markdown.matchAll(/`([a-z0-9-]+)\/([a-z0-9-]+)`/g)];
  if (!links.length) throw new Error(`No claim references in ${brief}`);
  for (const [, product, claim] of links) {
    if (!cards.get(product)?.claims.some((entry) => entry.id === claim && entry.status === 'supported')) {
      throw new Error(`Unresolved or unsupported claim ${product}/${claim} in ${brief}`);
    }
  }
  const evidence = [...new Set(links.map(([, product]) => product))].map((id) => cards.get(id));
  const before = workingChanges();
  const review = judgeEditorial(readFileSync(draft, 'utf8'), markdown, evidence, seoSkill);
  if (JSON.stringify(workingChanges()) !== JSON.stringify(before)) {
    throw new Error('Repository changes appeared during editorial judging');
  }
  return review;
}

function reviseDraft({ draft, brief }, review, seoSkill) {
  const prompt = [
    'Revise the existing draft and brief named below. Apply the independent judge’s feedback as editorial evidence. Preserve the chosen topic and the same paths. Verify factual corrections against cited sources. Update affected product cards and claim references as needed. If evidence is insufficient, narrow or remove the unsupported material and explain the limitation in the brief. Keep the draft useful and readable. Change only the named draft, its brief, and relevant product cards. Do not write verdict files, commit, or push.',
    seoSkill,
    JSON.stringify({ draft, brief, verdict: review.verdict, scores: review.scores, actions: review.actions }),
  ].join('\n\n');
  run('codex', ['exec', '-s', 'workspace-write', prompt]);
  changedPaths({ draft, brief });
  run(process.execPath, ['agent/validate-knowledge.mjs']);
}

function savedRevision(slug) {
  if (slug === undefined) return null;
  if (!/^[a-z0-9-]+$/.test(slug)) throw new Error('Provide a draft slug without its extension');
  const base = `content/drafts/${slug}`;
  const draft = `${base}.md`;
  const brief = `${base}.brief.md`;
  const path = `${base}.review.json`;
  const review = JSON.parse(readFileSync(path, 'utf8'));
  if (review.draft !== draft || review.brief !== brief || review.verdict !== 'revise') {
    throw new Error(`Expected a saved revise verdict for ${slug}`);
  }
  return { draft, brief, review };
}

try {
  const { values } = parseArgs({ options: { revise: { type: 'string' } } });
  const branch = run('git', ['symbolic-ref', '--short', 'HEAD'], true).trim();
  run('git', ['remote', 'get-url', 'origin'], true);
  if (workingChanges().length) throw new Error('Start the editorial workflow with a clean checkout');

  const seoSkill = readFileSync('agent/skills/coffee-seo/SKILL.md', 'utf8');
  const saved = savedRevision(values.revise);
  let article = saved;
  if (!saved) {
    const prompt = [readFileSync('agent/editorial-workflow.md', 'utf8'), seoSkill].join('\n\n');
    run('codex', ['exec', '-s', 'workspace-write', prompt]);
    run(process.execPath, ['agent/validate-knowledge.mjs']);
    article = newDraft(changedPaths());
  }

  const verdicts = [];
  let files = changedPaths(article);
  if (article) {
    const { draft, brief } = article;
    const initial = saved?.review ?? await reviewDraft(article, seoSkill);
    const previous = initial.verdict === 'revise' ? initial : null;
    if (previous) reviseDraft(article, previous, seoSkill);

    const final = previous ? await reviewDraft(article, seoSkill) : initial;
    files = changedPaths(article);
    const path = draft.replace(/\.md$/, '.review.json');
    const history = previous ? [
      ...(Array.isArray(previous.history) ? previous.history : []),
      { verdict: previous.verdict, scores: previous.scores, actions: previous.actions },
    ] : [];
    writeFileSync(path, JSON.stringify({ draft, brief, ...final, history }, null, 2) + '\n',
      { flag: saved ? 'w' : 'wx' });
    files.push(path);
    verdicts.push({ draft, verdict: final.verdict, initialVerdict: initial.verdict, review: path });
  }

  if (!files.length) {
    record('completed', { changedFiles: [], outcome: 'No repository changes' });
    console.log('No repository changes to push.');
  } else {
    run('git', ['add', '--', ...files]);
    run('git', ['diff', '--cached', '--check']);
    run('git', ['commit', '-m', 'Run coffee editorial research workflow']);
    run('git', ['push', 'origin', `HEAD:refs/heads/${branch}`]);
    record('completed', { changedFiles: files, verdicts, branch, commit: run('git', ['rev-parse', 'HEAD'], true).trim() });
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
