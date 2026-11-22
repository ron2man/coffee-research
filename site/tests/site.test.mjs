import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildSite, repoRoot } from '../build.mjs';
import { offersFor, mockOffers } from '../lib/offers.mjs';
import { parseMarkdown } from '../lib/markdown.mjs';
import { categoryCounts } from '../lib/content.mjs';

function out(t) {
  const dir = mkdtempSync(join(tmpdir(), 'site-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

test('preview build renders both markets, the picker, a pricebox and collapsed sources', (t) => {
  const outDir = out(t);
  const result = buildSite({ root: repoRoot, outDir });
  assert.ok(result.pages.includes('/en-us/guides/which-grinder-for-bambino/'));
  assert.ok(result.pages.includes('/en-gb/guides/which-grinder-for-bambino/'));
  const us = readFileSync(join(outDir, 'en-us/guides/which-grinder-for-bambino/index.html'), 'utf8');
  const gb = readFileSync(join(outDir, 'en-gb/guides/which-grinder-for-bambino/index.html'), 'utf8');
  assert.match(us, /class="picker" data-tool="bambino-grinder"/);
  assert.match(us, /<details class="sources"><summary>How this guide was put together/);
  assert.match(us, /\$[\d,]+\.\d\d/, 'US prices in dollars');
  assert.match(gb, /Written for readers in the United States/);
  assert.match(gb, /No UK model in our records yet/);
  assert.match(us, /noindex/);
  assert.match(us, /Quality reference · not published/);
});

test('preview build shows credited mock photos; they stay out of production assets', (t) => {
  const outDir = out(t);
  buildSite({ root: repoRoot, outDir });
  const home = readFileSync(join(outDir, 'en-us/index.html'), 'utf8');
  assert.match(home, /src="\/assets\/mock\/home-hero\.jpg"/);
  assert.match(home, /Photo: Nathan Dumlao on Unsplash\. Mock image for the preview\./);
});

test('sidebar pick shows the same product and price as the PriceBox', (t) => {
  const outDir = out(t);
  buildSite({ root: repoRoot, outDir });
  const us = readFileSync(join(outDir, 'en-us/guides/which-grinder-for-bambino/index.html'), 'utf8');
  const pickName = us.match(/class="pick-name">([^<]+)</)[1];
  const pickPrice = us.match(/class="pick-price">([^<]+)</)[1];
  const row = us.match(/<li class="pb-row" id="buy-baratza-encore-esp-pro">[\s\S]*?<\/li>/)[0];
  assert.match(row, new RegExp(`class="pb-name">${pickName}<`));
  assert.match(row, new RegExp(`class="pb-price">${pickPrice.replace(/[$.]/g, '\\$&')}<`));
  assert.match(us, /href="#buy-baratza-encore-esp-pro">Jump to the pick</);
});

test('a category reaches the nav only with three listed guides', () => {
  const cats = [{ id: 'machines', label: 'Home espresso machines' }, { id: 'grinders', label: 'Grinders' }];
  const post = (category, supersededBy) => ({ category, supersededBy });
  const counted = categoryCounts(cats, [post('machines'), post('machines'), post('machines'), post('grinders'), post('grinders'), post('grinders', 'newer-guide')]);
  assert.deepEqual(counted.map((c) => [c.id, c.count]), [['machines', 3]]);
});

test('home page links all guides and lists them as compact rows', (t) => {
  const outDir = out(t);
  const result = buildSite({ root: repoRoot, outDir });
  assert.ok(result.pages.includes('/en-us/guides/'));
  const home = readFileSync(join(outDir, 'en-us/index.html'), 'utf8');
  assert.match(home, /<a href="\/en-us\/guides\/">All guides<\/a>/);
  assert.doesNotMatch(home, /class="nav"[\s\S]*?How we work[\s\S]*?<\/nav>/, 'How we work lives in the footer, not the nav');
  assert.match(home, /class="band-link" href="\/en-us\/how-we-work\/"/);
});

test('production build refuses to ship without verified disclosures', (t) => {
  assert.throws(() => buildSite({ root: repoRoot, production: true, outDir: out(t) }), /No disclosure text/);
});

test('stale prices are hidden but the button stays', () => {
  const now = Date.parse('2026-11-21T12:00:00Z');
  const offers = mockOffers(['a', 'b'], [{ id: 'US', currency: 'USD' }, { id: 'GB', currency: 'GBP' }], { now });
  assert.equal(offersFor(offers, 'a', 'US', { now })[0].showPrice, true);
  const stale = offersFor(offers, 'b', 'GB', { now })[0];
  assert.equal(stale.showPrice, false);
  assert.ok(stale.url);
});

test('markdown escapes HTML and only allows http links', () => {
  const { blocks } = parseMarkdown('Hi <script>x</script> [a](javascript:alert(1)) [b](https://ok.test)');
  assert.doesNotMatch(blocks[0].html, /<script>/);
  assert.doesNotMatch(blocks[0].html, /href="javascript/);
  assert.match(blocks[0].html, /href="https:\/\/ok.test"/);
});
