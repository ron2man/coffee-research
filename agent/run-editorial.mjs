import { spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { claimEvidence, loadCards, reviewInputs } from './review-inputs.mjs';
import { assessTopic } from './topic-gate.mjs';
import { judgeEditorial } from './judge-editorial.mjs';
import { categories } from './knowledge.mjs';

const start = Date.now();
const opportunityFiles = new Map();

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
    const status = change.slice(0, 2);
    if (![' M', '??'].includes(status)) throw new Error('Unexpected workflow change: ' + change);
    if (opportunityFiles.has(path)) {
      if (readFileSync(path, 'utf8') !== opportunityFiles.get(path)) throw new Error('Commissioning input changed: ' + path);
      return path;
    }
    const knowledge = new RegExp(`^knowledge/(?:${categories.join('|')})/[a-z0-9-]+\\.md$`).test(path);
    const editorial = revision && [revision.draft, revision.brief].includes(path);
    if (!knowledge && !editorial) throw new Error('Unexpected workflow change: ' + change);
    return path;
  });
}

async function commission(seoSkill) {
  mkdirSync('content/opportunities', { recursive: true });
  run('codex', ['exec', '-s', 'workspace-write', readFileSync('agent/editorial-workflow.md', 'utf8') + '\n' + seoSkill]);
  const proposals = workingChanges().filter(change => /^(?: M|\?\?) content\/opportunities\/[a-z0-9-]+\.md$/.test(change));
  if (!proposals.length) {
    changedPaths();
    return null;
  }
  if (proposals.length !== 1) throw new Error('Research must produce one new or updated proposal');
  const path = proposals[0].slice(3);
  const proposal = readFileSync(path, 'utf8');
  opportunityFiles.set(path, proposal);
  changedPaths();
  const cards = await loadCards();
  const evidence = claimEvidence(proposal, cards, false);
  const decision = assessTopic(proposal, evidence);
  if (decision.outcome !== 'research' && !evidence.length) throw new Error('Commission needs supported claims');
  const slug = path.split('/').pop().slice(0, -3);
  const draft = 'content/archive/drafts/' + slug + '.md';
  const brief = draft.replace(/\.md$/, '.brief.md');
  const decisionPath = path.replace(/\.md$/, '.json');
  const priorDecision = existsSync(decisionPath) ? JSON.parse(readFileSync(decisionPath, 'utf8')) : null;
  const reviewPath = draft.replace(/\.md$/, '.review.json');
  const previousReview = existsSync(reviewPath) ? JSON.parse(readFileSync(reviewPath, 'utf8')) : null;
  const revisiting = existsSync(draft) && previousReview &&
    (['research', 'narrow'].includes(priorDecision?.outcome) || previousReview.verdict === 'defer');
  if (revisiting && previousReview.verdict !== 'defer' && decision.outcome !== 'proceed') {
    // Keep the existing narrow commission valid while research on its broader question continues.
    return null;
  }
  if (!revisiting && [draft, brief, draft.replace(/\.md$/, '.review.json')].some(file => existsSync(file))) {
    throw new Error('Commission collides with an existing draft: ' + slug);
  }
  const decisionText = JSON.stringify(decision, null, 2) + '\n';
  writeFileSync(decisionPath, decisionText);
  opportunityFiles.set(decisionPath, decisionText);
  if (decision.outcome === 'research') return null;
  run('codex', ['exec', '-s', 'workspace-write', [
    'Write the commissioned article and matching brief at the exact paths below. Answer only the commissioned question. Carry over the research, sources, alternatives, and backticked claim dependencies from the proposal. For a narrowed commission, explicitly narrow the headline and opening. Preserve the research proposal and decision files. Leave git to the runner.',
    seoSkill, JSON.stringify({ draft, brief, proposal, decision }),
  ].join('\n')]);
  changedPaths({ draft, brief });
  if (![draft, brief].every(file => existsSync(file))) throw new Error('Missing commissioned draft or brief');
  return { draft, brief, previousReview };
}

async function reviewDraft({ draft }) {
  const slug = draft.split('/').pop().slice(0, -3);
  const inputs = reviewInputs(slug, await loadCards());
  const review = judgeEditorial(inputs);
  if (reviewInputs(slug, await loadCards()).fingerprint !== inputs.fingerprint) throw new Error('Review inputs changed during judging');
  return review;
}

function reviseDraft({ draft, brief }, review, seoSkill, feedback) {
  const prompt = [
    'Revise the existing draft and brief named below. Resolve the independent judge’s blocking actions and any explicit editor feedback. Use score comments as context. Preserve the chosen topic and the same paths. Verify factual corrections against cited sources. Update affected product cards and claim references as needed. If evidence is insufficient, narrow or remove the unsupported material and explain the limitation in the brief. Keep the draft useful and readable. Change only the named draft, its brief, and relevant product cards. Do not write verdict files, commit, or push.',
    seoSkill,
    JSON.stringify({ draft, brief, verdict: review.verdict, scores: review.scores, actions: review.actions, editorFeedback: feedback }),
  ].join('\n\n');
  run('codex', ['exec', '-s', 'workspace-write', prompt]);
  changedPaths({ draft, brief });
  run(process.execPath, ['agent/validate-knowledge.mjs']);
}

function savedRevision(slug, feedback) {
  if (slug === undefined) return null;
  if (!/^[a-z0-9-]+$/.test(slug)) throw new Error('Provide a draft slug without its extension');
  const base = `content/archive/drafts/${slug}`;
  const draft = `${base}.md`;
  const brief = `${base}.brief.md`;
  const path = `${base}.review.json`;
  const review = JSON.parse(readFileSync(path, 'utf8'));
  if (review.draft !== draft || review.brief !== brief ||
      (!feedback && review.verdict !== 'revise') || !['pass', 'revise', 'defer'].includes(review.verdict)) {
    throw new Error(`Expected a matching saved review for ${slug}. A saved revise verdict or explicit editor feedback is required.`);
  }
  return { draft, brief, review };
}

try {
  const { values } = parseArgs({
    options: { revise: { type: 'string' }, feedback: { type: 'string' } },
  });
  const feedback = values.feedback?.trim();
  if (values.feedback !== undefined && (!feedback || !values.revise)) {
    throw new Error('--feedback requires nonempty editor feedback and a --revise draft slug');
  }
  const branch = run('git', ['symbolic-ref', '--short', 'HEAD'], true).trim();
  run('git', ['remote', 'get-url', 'origin'], true);
  if (workingChanges().length) throw new Error('Start the editorial workflow with a clean checkout');

  const seoSkill = readFileSync('agent/skills/coffee-seo/SKILL.md', 'utf8');
  const saved = savedRevision(values.revise, feedback);
  const article = saved ?? await commission(seoSkill);
  run(process.execPath, ['agent/validate-knowledge.mjs']);

  const verdicts = [];
  let files = changedPaths(article);
  if (article) {
    const { draft, brief } = article;
    const initial = saved?.review ?? await reviewDraft(article);
    const previous = initial.verdict === 'revise' || feedback ? initial : null;
    if (previous) reviseDraft(article, previous, seoSkill, feedback);

    const final = previous ? await reviewDraft(article) : initial;
    files = changedPaths(article);
    const path = draft.replace(/\.md$/, '.review.json');
    const history = [];
    for (const record of [article.previousReview, previous].filter(Boolean)) {
      const { draft: priorDraft, brief: priorBrief, history: older = [], ...prior } = record;
      history.push(...older, prior);
    }
    writeFileSync(path, JSON.stringify({ draft, brief, ...final, history }, null, 2) + '\n',
      { flag: saved || article.previousReview ? 'w' : 'wx' });
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
