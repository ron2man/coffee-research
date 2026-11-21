import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { newItem } from '../state/machine.mjs';
import { repoRoot } from '../state/niche.mjs';
import { saveItem } from '../state/store.mjs';
import { fakeRunner } from '../runner/index.mjs';
import { tick } from '../scheduler/tick.mjs';
import { classify, commitInternal, commitMessage, syncMain } from '../scheduler/git.mjs';

function repo(t) {
  const dir = mkdtempSync(join(tmpdir(), 'engine-git-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const root = join(dir, 'work');
  const remote = join(dir, 'remote.git');
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  mkdirSync(root);
  cpSync(join(repoRoot, 'niches'), join(root, 'niches'), { recursive: true });
  writeFileSync(join(root, '.gitignore'), '.backoffice/\n');
  execFileSync('git', ['init', '--bare', '-q', '-b', 'main', remote]);
  git('init', '-q', '-b', 'main');
  git('config', 'user.email', 'tick@example.test');
  git('config', 'user.name', 'Tick');
  git('remote', 'add', 'origin', remote);
  git('add', '.');
  git('commit', '-qm', 'Fixture');
  git('push', '-q', 'origin', 'main');
  const remoteGit = (...args) => execFileSync('git', ['--git-dir', remote, ...args], { encoding: 'utf8' }).trim();
  return { root, git, remoteGit };
}

const research = () => JSON.parse(readFileSync(join(repoRoot, 'engine/agents/research/fixtures/valid.json'), 'utf8'));

test('reader-facing paths are classified as public', () => {
  assert.deepEqual(classify(['data/items/a.json', 'site/index.astro', 'content/published/a.md', 'content/drafts/a.json', 'data/offers/p.json', 'data/items/a.json']), {
    internal: ['content/drafts/a.json', 'data/items/a.json'],
    public: ['content/published/a.md', 'data/offers/p.json', 'site/index.astro'],
  });
});

test('a tick commits only the files it wrote and pushes them to main', async (t) => {
  const { root, git, remoteGit } = repo(t);
  saveItem(root, newItem({ id: 'sour-shots', niche: 'coffee', status: 'idea_approved', by: 'test' }));
  git('add', 'data/items/sour-shots.json');
  git('commit', '-qm', 'Seed item');
  git('push', '-q', 'origin', 'main');
  writeFileSync(join(root, 'unrelated.txt'), 'a human is editing this');
  git('add', 'unrelated.txt'); // staged by someone else: must not ride along

  syncMain(root);
  const result = await tick({ root, runner: fakeRunner({ research }) });
  assert.deepEqual([...new Set(result.changedFiles)].sort(), ['data/items/sour-shots.json', 'data/research/sour-shots.json']);
  const sha = commitInternal(root, result.changedFiles, commitMessage(result));

  assert.equal(remoteGit('rev-parse', 'main'), sha);
  assert.equal(remoteGit('log', '-1', '--format=%s', 'main'), 'tick(research): sour-shots done→researched');
  assert.deepEqual(remoteGit('show', '--name-only', '--format=', 'main').split('\n').sort(),
    ['data/items/sour-shots.json', 'data/research/sour-shots.json']);
  assert.match(git('status', '--porcelain'), /^A {2}unrelated\.txt$/m);
});

test('public paths are never committed by a tick', (t) => {
  const { root, remoteGit } = repo(t);
  const before = remoteGit('rev-parse', 'main');
  mkdirSync(join(root, 'content/published'), { recursive: true });
  writeFileSync(join(root, 'content/published/post.md'), '# Post');
  writeFileSync(join(root, 'note.json'), '{}');
  assert.throws(() => commitInternal(root, ['note.json', 'content/published/post.md'], 'x'), /open a PR instead: content\/published\/post\.md/);
  assert.equal(remoteGit('rev-parse', 'main'), before);
});

test('scheduler commits refuse to run off the main branch', (t) => {
  const { root, git } = repo(t);
  git('switch', '-q', '-c', 'feature');
  assert.throws(() => syncMain(root), /only on main \(checkout is on feature\)/);
});
