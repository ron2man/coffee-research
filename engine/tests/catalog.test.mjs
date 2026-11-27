import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { catalogDir, catalogListing, matchCard, syncCatalog } from '../catalog/catalog.mjs';

const run = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();

function setup(t) {
  const dir = mkdtempSync(join(tmpdir(), 'engine-catalog-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const remote = join(dir, 'catalog.git');
  const source = join(dir, 'source');
  const root = join(dir, 'root');
  mkdirSync(root);
  execFileSync('git', ['init', '--bare', '-q', '-b', 'main', remote]);
  mkdirSync(join(source, 'products', 'brand-machine-a'), { recursive: true });
  run(source, 'init', '-q', '-b', 'main');
  run(source, 'config', 'user.email', 'c@example.test');
  run(source, 'config', 'user.name', 'Catalog');
  run(source, 'remote', 'add', 'origin', remote);
  const publish = (products, message) => {
    writeFileSync(join(source, 'catalog.json'), JSON.stringify({ schemaVersion: 1, generatedAt: '2026-11-27T00:00:00Z', brands: [], products }));
    run(source, 'add', '.');
    run(source, 'commit', '-qm', message);
    run(source, 'push', '-q', 'origin', 'main');
  };
  const product = (id, extra = {}) => ({ id, brand: 'brand', name: id, category: 'machine', status: 'current', versions: [{ id: 'v-us', marketName: `Brand ${id}`, markets: ['US', 'CA'] }, { id: 'v-eu', marketName: `Other ${id}`, markets: ['GB'] }], documents: 2, troubleshooting: 5, specFields: 9, path: `products/${id}/`, ...extra });
  const niche = { id: 'n', catalog: { repo: remote, dir: 'catalog' } };
  return { root, niche, publish, product };
}

test('sync clones the catalog the first time, then follows the remote; no change is reported as such', (t) => {
  const { root, niche, publish, product } = setup(t);
  publish([product('brand-machine-a')], 'first');
  const first = syncCatalog(root, niche);
  assert.equal(first.ok, true);
  assert.equal(first.cloned, true);
  const again = syncCatalog(root, niche);
  assert.deepEqual([again.ok, again.changed], [true, false]);
  publish([product('brand-machine-a'), product('brand-machine-b')], 'second');
  const moved = syncCatalog(root, niche);
  assert.deepEqual([moved.ok, moved.changed], [true, true]);
  assert.notEqual(moved.from, moved.to);
  assert.equal(catalogListing(root, niche).total, 2);
});

test('sync never throws: an unreachable remote and local edits are reported, the mirror is kept', (t) => {
  const { root, niche, publish, product } = setup(t);
  const missing = syncCatalog(root, { ...niche, catalog: { ...niche.catalog, repo: join(root, 'nowhere.git') } });
  assert.equal(missing.ok, false);
  assert.match(missing.error, /clone/);
  publish([product('brand-machine-a')], 'first');
  assert.equal(syncCatalog(root, niche).ok, true);
  writeFileSync(join(root, 'catalog', 'catalog.json'), '{}');
  const dirty = syncCatalog(root, niche);
  assert.equal(dirty.ok, false);
  assert.match(dirty.error, /local edits/);
});

test('no catalog in the niche: nothing to do; a dir outside the repo is refused', () => {
  assert.equal(syncCatalog('/tmp/x', { id: 'n' }).skipped, 'no catalog in niche.json');
  assert.throws(() => catalogDir('/tmp/x', { catalog: { repo: 'r', dir: '../y' } }), /inside the repository/);
});

test('listing: markets and names per product, card matches first, a cap with a note', (t) => {
  const { root, niche, publish, product } = setup(t);
  publish([product('brand-other'), product('brand-machine-a'), product('brand-machine-b')], 'first');
  syncCatalog(root, niche);
  const listing = catalogListing(root, { ...niche, catalog: { ...niche.catalog, maxListed: 2 } }, { cardIds: ['machine-a'] });
  assert.equal(listing.products[0].id, 'brand-machine-a');
  assert.equal(listing.products[0].knowledgeCard, 'machine-a');
  assert.deepEqual(listing.products[0].markets, ['CA', 'GB', 'US']);
  assert.deepEqual(listing.products[0].marketNames, ['Brand brand-machine-a', 'Other brand-machine-a']);
  assert.equal(listing.products[0].path, 'catalog/products/brand-machine-a/');
  assert.equal(listing.products.length, 2);
  assert.match(listing.note, /1 more/);
});

test('card matching: exact id or a unique brand-prefixed id', () => {
  assert.equal(matchCard('machine-a', ['machine-a']), 'machine-a');
  assert.equal(matchCard('brand-machine-a', ['machine-a', 'other']), 'machine-a');
  assert.equal(matchCard('brand-pro', ['pro', 'brand-pro-x']), 'pro');
  assert.equal(matchCard('brand-a', ['b']), null);
});
