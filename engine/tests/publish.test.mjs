import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { newItem, transition } from '../state/machine.mjs';
import { repoRoot } from '../state/niche.mjs';
import { loadItems, saveItem, writeJsonAtomic } from '../state/store.mjs';
import { parseFrontmatter } from '../../site/lib/markdown.mjs';
import { processPublishQueue, publishProblems, publishedMarkdown, queuePublish, requestPublish, syncPublished } from '../publish/publish.mjs';
import { pushFilesToBranch } from '../scheduler/git.mjs';

const writer = () => JSON.parse(readFileSync(join(repoRoot, 'engine/agents/writer/fixtures/valid.json'), 'utf8')).artifact;

function repo(t, { disclosures = true } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'engine-publish-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const root = join(dir, 'work');
  const remote = join(dir, 'remote.git');
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  mkdirSync(root);
  for (const d of ['niches', 'knowledge']) cpSync(join(repoRoot, d), join(root, d), { recursive: true });
  if (disclosures) {
    const p = join(root, 'niches/coffee/niche.json');
    const niche = JSON.parse(readFileSync(p, 'utf8'));
    niche.disclosures = { US: 'We may earn a commission.', GB: 'We may earn a commission.' };
    writeFileSync(p, JSON.stringify(niche));
  }
  let item = newItem({ id: 'post-a', niche: 'coffee', by: 'idea' });
  for (const to of ['idea_approved', 'researched', 'briefed', 'drafted', 'passed']) item = transition(item, to, { by: 'test' });
  writeJsonAtomic(join(root, 'content/drafts/post-a.json'), { ...writer(), slug: 'post-a' });
  saveItem(root, { ...item, artifacts: { writer: 'content/drafts/post-a.json' } });
  execFileSync('git', ['init', '--bare', '-q', '-b', 'main', remote]);
  git('init', '-q', '-b', 'main');
  git('config', 'user.email', 't@example.test');
  git('config', 'user.name', 'T');
  git('remote', 'add', 'origin', remote);
  git('add', '.');
  git('commit', '-qm', 'Fixture');
  git('push', '-q', 'origin', 'main');
  const remoteGit = (...args) => execFileSync('git', ['--git-dir', remote, ...args], { encoding: 'utf8' }).trim();
  return { root, git, remoteGit };
}

test('the published file carries frontmatter the site can read', () => {
  const md = publishedMarkdown({ ...writer(), slug: 'post-a', title: 'Fix: your {{product:x}}', seoTitle: 'Fix it' }, { publishedAt: '2026-11-23', category: 'machines' });
  const { data, body } = parseFrontmatter(md);
  assert.equal(data.title, 'Fix: your {{product:x}}');
  assert.equal(data.seoTitle, 'Fix it');
  assert.equal(data.slug, 'post-a');
  assert.deepEqual(data.offerIds, []);
  assert.equal(data.disclosure, true);
  assert.match(body, /Start with the basket/);
});

test('disclosure text never blocks publishing, with or without offers', (t) => {
  const { root } = repo(t, { disclosures: false });
  const [item] = loadItems(root).items;
  assert.deepEqual(publishProblems(root, item), []);
  writeJsonAtomic(join(root, 'content/drafts/post-a.json'), { ...writer(), slug: 'post-a', offerIds: ['bambino-plus'] });
  assert.deepEqual(publishProblems(root, item), []);
});

test('approve opens a branch with the post on top of main; the item turns published once it is merged', (t) => {
  const { root, git, remoteGit } = repo(t);
  const before = git('rev-parse', 'HEAD');
  const result = requestPublish(root, 'post-a', { by: 'ron', openPr: () => null, now: new Date('2026-11-23T10:00:00Z') });
  assert.equal(result.branch, 'publish/post-a');
  assert.equal(git('rev-parse', 'HEAD'), before, 'working branch untouched');
  assert.deepEqual(remoteGit('show', '--name-only', '--format=', 'publish/post-a').split('\n').sort(),
    ['content/published/post-a.claims.json', 'content/published/post-a.md']);
  assert.equal(remoteGit('rev-parse', 'publish/post-a~1'), before);
  // Merge (simulated): the file reaches main, and sync moves the item.
  git('fetch', '-q', 'origin', 'publish/post-a');
  git('merge', '-q', '--ff-only', 'FETCH_HEAD');
  assert.deepEqual(syncPublished(root, loadItems(root).items), ['data/items/post-a.json']);
  assert.equal(loadItems(root).items[0].status, 'published');
  assert.ok(pushFilesToBranch);
});

test('a queued approval is turned into a pull request by the next tick that can push', (t) => {
  const { root, remoteGit } = repo(t);
  queuePublish(root, 'post-a', { by: 'assistant' });
  assert.equal(JSON.parse(readFileSync(join(root, 'data/publish/post-a.json'), 'utf8')).status, 'queued');
  const written = processPublishQueue(root, { openPr: () => null });
  assert.deepEqual(written, ['data/publish/post-a.json']);
  assert.equal(JSON.parse(readFileSync(join(root, 'data/publish/post-a.json'), 'utf8')).status, 'open');
  assert.ok(remoteGit('rev-parse', 'publish/post-a'));
  assert.deepEqual(processPublishQueue(root, { openPr: () => null }), [], 'only once');
});

test('with gh signed in, passed posts get a publishing PR automatically; merging stays human', async (t) => {
  const { autoPullRequests } = await import('../publish/autopr.mjs');
  const { root } = repo(t);
  const calls = [];
  let prOpen = false;
  const gh = (_root, args) => {
    calls.push(args.join(' '));
    if (args[0] === 'auth') return { ok: true, out: '' };
    if (args[1] === 'view') return prOpen ? { ok: true, out: JSON.stringify({ url: 'https://github.com/o/r/pull/7', state: 'OPEN' }) } : { ok: false, out: '', err: 'no pull requests found' };
    if (args[1] === 'create') { prOpen = true; return { ok: true, out: 'https://github.com/o/r/pull/7' }; }
    return { ok: false, out: '' };
  };
  const first = autoPullRequests(root, loadItems(root).items, { gh });
  assert.deepEqual(first.events, ['queued post-a']);
  processPublishQueue(root, { openPr: () => null });
  const second = autoPullRequests(root, loadItems(root).items, { gh });
  assert.deepEqual(second.events, ['opened PR for post-a']);
  assert.equal(JSON.parse(readFileSync(join(root, 'data/publish/post-a.json'), 'utf8')).prUrl, 'https://github.com/o/r/pull/7');
  assert.ok(!calls.some((c) => c.startsWith('pr merge')), 'never merges');
  assert.deepEqual(autoPullRequests(root, loadItems(root).items, { gh: () => ({ ok: false }) }).events, [], 'nothing without gh');
});

test('auto-merge after the veto window, unless held or checks are red', async (t) => {
  const { autoPullRequests, holdPublish } = await import('../publish/autopr.mjs');
  const { root } = repo(t);
  requestPublish(root, 'post-a', { openPr: () => null });
  let pr = { number: 7, url: 'https://github.com/o/r/pull/7', state: 'OPEN', labels: [], createdAt: '2026-11-24T00:00:00Z', statusCheckRollup: [{ conclusion: 'SUCCESS' }] };
  const merges = [];
  const gh = (_r, args) => {
    if (args[0] === 'auth') return { ok: true, out: '' };
    if (args[1] === 'view') return { ok: true, out: JSON.stringify(pr) };
    if (args[1] === 'merge') { merges.push(args[2]); return { ok: true, out: '' }; }
    if (args[0] === 'label') return { ok: true, out: '' };
    if (args[1] === 'edit') { pr = { ...pr, labels: [{ name: 'hold' }] }; return { ok: true, out: '' }; }
    return { ok: false, out: '', err: '' };
  };
  const policy = { autoMerge: true, vetoHours: 24 };
  autoPullRequests(root, loadItems(root).items, { gh, policy, now: new Date('2026-11-24T20:00:00Z') });
  assert.deepEqual(merges, [], 'not before 24 hours');
  pr = { ...pr, statusCheckRollup: [{ conclusion: 'FAILURE' }] };
  autoPullRequests(root, loadItems(root).items, { gh, policy, now: new Date('2026-11-25T01:00:00Z') });
  assert.deepEqual(merges, [], 'not with red checks');
  pr = { ...pr, statusCheckRollup: [{ conclusion: 'SUCCESS' }] };
  holdPublish(root, 'post-a', { gh });
  autoPullRequests(root, loadItems(root).items, { gh, policy, now: new Date('2026-11-25T01:00:00Z') });
  assert.deepEqual(merges, [], 'not when held');
  pr = { ...pr, labels: [] };
  const done = autoPullRequests(root, loadItems(root).items, { gh, policy, now: new Date('2026-11-25T01:00:00Z') });
  assert.deepEqual(merges, ['7']);
  assert.deepEqual(done.events, ['merged post-a after the veto window']);
  assert.equal(JSON.parse(readFileSync(join(root, 'data/publish/post-a.json'), 'utf8')).status, 'merged');
  // Without autoMerge, nothing merges.
  merges.length = 0;
  writeJsonAtomic(join(root, 'data/publish/post-a.json'), { itemId: 'post-a', slug: 'post-a', status: 'open', branch: 'publish/post-a' });
  autoPullRequests(root, loadItems(root).items, { gh, policy: {}, now: new Date('2026-11-26T00:00:00Z') });
  assert.deepEqual(merges, []);
});
