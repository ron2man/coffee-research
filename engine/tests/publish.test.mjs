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

test('a post with offers needs disclosure text for every market; a post that sells nothing does not', (t) => {
  const { root } = repo(t, { disclosures: false });
  const [item] = loadItems(root).items;
  assert.deepEqual(publishProblems(root, item), []);
  writeJsonAtomic(join(root, 'content/drafts/post-a.json'), { ...writer(), slug: 'post-a', offerIds: ['bambino-plus'] });
  assert.ok(publishProblems(root, item).some((p) => /has offers, and niche.json has no disclosure text for US, GB/.test(p)));
  assert.throws(() => requestPublish(root, 'post-a', { openPr: () => null }), /Can't publish yet/);
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
