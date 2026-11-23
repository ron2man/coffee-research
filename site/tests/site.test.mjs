import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadSiteData, repoRoot, siteMode } from '../lib/site-data.mjs';
import { offersFor, mockOffers } from '../lib/offers.mjs';
import { parseMarkdown } from '../lib/markdown.mjs';
import { categoryCounts } from '../lib/content.mjs';

const astro = join(repoRoot, 'node_modules', '.bin', 'astro');
const builds = new Map();
/** One real Astro build per mode, shared by the tests below. */
function build(mode) {
  if (builds.has(mode)) return builds.get(mode);
  const outDir = mkdtempSync(join(tmpdir(), `site-${mode}-`));
  const env = { ...process.env, SITE_MODE: mode, PUBLIC_GTM_ID: 'GTM-TEST0001', ASTRO_TELEMETRY_DISABLED: '1' };
  delete env.WORKERS_CI_BRANCH;
  execFileSync(astro, ['build', '--root', 'site', '--outDir', outDir], { cwd: repoRoot, env, stdio: 'pipe' });
  const read = (path) => readFileSync(join(outDir, path), 'utf8');
  const result = { outDir, read, has: (path) => existsSync(join(outDir, path)) };
  builds.set(mode, result);
  return result;
}
test.after(() => { for (const { outDir } of builds.values()) rmSync(outDir, { recursive: true, force: true }); });

test('build mode: SITE_MODE wins, then the Cloudflare branch, else preview', () => {
  assert.equal(siteMode({ SITE_MODE: 'production', WORKERS_CI_BRANCH: 'feature' }), 'production');
  assert.equal(siteMode({ WORKERS_CI_BRANCH: 'main' }), 'production');
  assert.equal(siteMode({ WORKERS_CI_BRANCH: 'site/astro' }), 'preview');
  assert.equal(siteMode({}), 'preview');
});

test('preview build renders both markets, the picker, a pricebox and collapsed sources', () => {
  const { read } = build('preview');
  const us = read('en-us/guides/which-grinder-for-bambino/index.html');
  const gb = read('en-gb/guides/which-grinder-for-bambino/index.html');
  assert.match(us, /class="picker" data-tool="bambino-grinder"/);
  assert.match(us, /<details class="sources"><summary>How this guide was put together/);
  assert.match(us, /\$[\d,]+\.\d\d/, 'US prices in dollars');
  // One post for every market: no "written for another market" notice (rebuild-spec principle 8).
  assert.doesNotMatch(gb, /Written for readers in/);
  assert.match(gb, /No UK model in our records yet/);
  assert.match(us, /<meta name="robots" content="noindex, nofollow">/);
  assert.match(us, /Quality reference · not published/);
});

test('preview builds never load GTM and block crawlers', () => {
  const { read } = build('preview');
  assert.doesNotMatch(read('en-us/index.html'), /googletagmanager/);
  assert.match(read('robots.txt'), /Disallow: \//);
});

test('preview build shows credited mock photos', () => {
  const home = build('preview').read('en-us/index.html');
  assert.match(home, /src="\/assets\/mock\/home-hero\.jpg"/);
  assert.match(home, /Photo: Nathan Dumlao on Unsplash\. Mock image for the preview\./);
});

test('sidebar pick shows the same product and price as the PriceBox', () => {
  const us = build('preview').read('en-us/guides/which-grinder-for-bambino/index.html');
  const pickName = us.match(/class="pick-name">([^<]+)</)[1];
  const pickPrice = us.match(/class="pick-price">([^<]+)</)[1];
  const row = us.match(/<li class="pb-row" id="buy-baratza-encore-esp-pro">[\s\S]*?<\/li>/)[0];
  assert.match(row, new RegExp(`class="pb-name">${pickName}<`));
  assert.match(row, new RegExp(`class="pb-price">${pickPrice.replace(/[$.]/g, '\\$&')}<`));
  assert.match(us, /href="#buy-baratza-encore-esp-pro">Jump to the pick</);
});

test('affiliate links carry what the affiliate_click event reports', () => {
  const us = build('preview').read('en-us/guides/which-grinder-for-bambino/index.html');
  assert.match(us, /rel="sponsored nofollow noopener" target="_blank" data-product="baratza-encore-esp-pro" data-seller="[^"]+" data-market="US" data-position="pricebox"/);
  assert.match(us, /data-position="pick"/);
  assert.match(us, /<body[^>]* data-page="which-grinder-for-bambino"/);
});

test('a category reaches the nav only with three listed guides', () => {
  const cats = [{ id: 'machines', label: 'Home espresso machines' }, { id: 'grinders', label: 'Grinders' }];
  const post = (category, supersededBy) => ({ category, supersededBy });
  const counted = categoryCounts(cats, [post('machines'), post('machines'), post('machines'), post('grinders'), post('grinders'), post('grinders', 'newer-guide')]);
  assert.deepEqual(counted.map((c) => [c.id, c.count]), [['machines', 3]]);
});

test('home page links all guides and lists them as compact rows', () => {
  const { read, has } = build('preview');
  assert.ok(has('en-us/guides/index.html'));
  const home = read('en-us/index.html');
  assert.match(home, /<a href="\/en-us\/guides\/">All guides<\/a>/);
  assert.doesNotMatch(home, /class="nav"[\s\S]*?How we work[\s\S]*?<\/nav>/, 'How we work lives in the footer, not the nav');
  assert.match(home, /class="band-link" href="\/en-us\/how-we-work\/"/);
});

test('production with no published guides: holding homes, indexable, GTM with consent defaults', () => {
  const { read, has } = build('production');
  const home = read('en-us/index.html');
  assert.match(home, /Fix it, upgrade it, <em>or keep it\.<\/em>/);
  assert.doesNotMatch(home, /name="robots"/);
  assert.doesNotMatch(home, /Preview build/);
  assert.match(home, /googletagmanager\.com\/gtm\.js\?id=GTM-TEST0001/);
  assert.doesNotMatch(home, /gtag\/js/);
  assert.ok(home.indexOf("gtag('consent', 'default'") < home.indexOf('gtm.js?id='), 'consent defaults are set before GTM loads');
  assert.match(home, /analytics_storage: 'denied', region: regions/);
  assert.match(home, /<link rel="canonical" href="https:\/\/yourcoffeesetup\.com\/en-us\/">/);
  assert.match(home, /hreflang="en-GB" href="https:\/\/yourcoffeesetup\.com\/en-gb\/"/);
  assert.match(home, /hreflang="x-default" href="https:\/\/yourcoffeesetup\.com\/"/);
  assert.match(read('en-gb/index.html'), /Coming soon for the UK/);
  assert.ok(!has('en-us/guides/index.html'), 'no guide list without guides');
  assert.ok(!has('en-us/guides/which-grinder-for-bambino/index.html'), 'drafts and references stay out of production');
  assert.ok(!has('assets/mock'), 'mock photos never ship');
  assert.match(read('robots.txt'), /Allow: \/\n\nSitemap: https:\/\/yourcoffeesetup\.com\/sitemap-index\.xml/);
  assert.match(read('sitemap-0.xml'), /<loc>https:\/\/yourcoffeesetup\.com\/en-us\/<\/loc>/);
  assert.match(read('en-us/how-we-work/index.html'), /We don’t use affiliate links yet/);
});

test('production refuses to build a live guide with offers without verified disclosures', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'site-root-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const dir of ['niches', 'knowledge', 'engine']) cpSync(join(repoRoot, dir), join(root, dir), { recursive: true });
  mkdirSync(join(root, 'content/published'), { recursive: true });
  writeFileSync(join(root, 'content/published/live.md'), '# A live guide\n\nKeep yours.\n');
  assert.equal(loadSiteData({ root, mode: 'production' }).posts.length, 1, 'a guide that sells nothing needs no disclosure');
  writeFileSync(join(root, 'content/published/live.md'), '---\noffers: 1\nofferIds: ["bambino-plus"]\n---\n# A live guide\n\nGet the X.\n');
  assert.throws(() => loadSiteData({ root, mode: 'production' }), /No disclosure text/);
  assert.equal(loadSiteData({ root, mode: 'preview' }).posts[0].slug, 'live');
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
