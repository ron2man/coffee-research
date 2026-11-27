import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { DEFAULT_DISCLOSURE, loadSiteData, repoRoot, siteMode } from '../lib/site-data.mjs';
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

test('no built page shows an unresolved token or "<Brand> the <Model>"', () => {
  for (const mode of ['preview', 'production']) {
    const { outDir } = build(mode);
    const pages = readdirSync(outDir, { recursive: true }).filter((f) => f.endsWith('.html'));
    assert.ok(pages.length > 0, `${mode}: no pages built`);
    for (const page of pages) {
      const html = readFileSync(join(outDir, page), 'utf8');
      assert.doesNotMatch(html, /\{\{[a-z]+:[^}]*\}\}/, `${mode} ${page}: unresolved {{token}}`);
      assert.doesNotMatch(html, /\b(Sage|Breville) the /, `${mode} ${page}: "<Brand> the <Model>"`);
    }
  }
});

test('home feature resolves product names for each market', () => {
  const { read } = build('preview');
  for (const [locale, brand] of [['en-us', 'Breville'], ['en-gb', 'Sage']]) {
    const feature = read(`${locale}/index.html`).match(/<div class="feature">[\s\S]*?<\/div>\s*<\/div>/)?.[0] ?? '';
    assert.ok(feature, `${locale}: home has a feature`);
    assert.doesNotMatch(feature, /\{\{/);
    if (/Barista Express/.test(feature)) assert.match(feature, new RegExp(`${brand} Barista Express`));
  }
});

test('production build: published guides only, indexable, GTM with consent defaults', () => {
  const { read, has } = build('production');
  const home = read('en-us/index.html');
  assert.doesNotMatch(home, /name="robots"/);
  assert.doesNotMatch(home, /Preview build/);
  assert.match(home, /googletagmanager\.com\/gtm\.js\?id=GTM-TEST0001/);
  assert.doesNotMatch(home, /gtag\/js/);
  assert.ok(home.indexOf("gtag('consent', 'default'") < home.indexOf('gtm.js?id='), 'consent defaults are set before GTM loads');
  assert.match(home, /analytics_storage: 'denied', region: regions/);
  assert.match(home, /<link rel="canonical" href="https:\/\/yourcoffeesetup\.com\/en-us\/">/);
  assert.match(home, /hreflang="en-GB" href="https:\/\/yourcoffeesetup\.com\/en-gb\/"/);
  assert.match(home, /hreflang="x-default" href="https:\/\/yourcoffeesetup\.com\/"/);
  // Every published guide is built for every market; drafts, references and mock photos are not.
  const published = readdirSync(join(repoRoot, 'content/published')).filter((f) => f.endsWith('.md')).map((f) => f.slice(0, -3));
  assert.ok(published.length > 0, 'this test expects published guides; the empty case is covered below');
  for (const locale of ['en-us', 'en-gb']) {
    assert.ok(has(`${locale}/guides/index.html`), `${locale}: guide list`);
    for (const slug of published) assert.ok(has(`${locale}/guides/${slug}/index.html`), `${locale}: ${slug}`);
    assert.doesNotMatch(read(`${locale}/index.html`), /class="holding"|Coming soon for the/, `${locale}: real home, not the holding page`);
  }
  assert.ok(!has('en-us/guides/which-grinder-for-bambino/index.html'), 'drafts and references stay out of production');
  assert.ok(!has('assets/mock'), 'mock photos never ship');
  assert.match(read('robots.txt'), /Allow: \/\n\nSitemap: https:\/\/yourcoffeesetup\.com\/sitemap-index\.xml/);
  assert.match(read('sitemap-0.xml'), /<loc>https:\/\/yourcoffeesetup\.com\/en-us\/<\/loc>/);
  assert.match(read('en-us/how-we-work/index.html'), /may earn us a commission/);
  assert.match(home, /<p class="disclosure">Some links on this site may earn us a commission/, 'placeholder in the footer');
});

test('every production page: one h1, valid JSON-LD, a share image; indexable pages also a self canonical', () => {
  const { outDir, read } = build('production');
  const pages = readdirSync(outDir, { recursive: true }).filter((f) => f.endsWith('.html'));
  // PNG width and height live at bytes 16–23 of the IHDR chunk.
  const pngSize = (file) => { const b = readFileSync(join(outDir, file)); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };
  for (const page of pages) {
    const html = read(page);
    const at = `${page}:`;
    assert.equal((html.match(/<h1[\s>]/g) ?? []).length, 1, `${at} exactly one <h1>`);
    for (const [, json] of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) assert.doesNotThrow(() => JSON.parse(json), `${at} JSON-LD parses`);
    const og = html.match(/<meta property="og:image" content="https:\/\/yourcoffeesetup\.com(\/[^"?]+)(?:\?v=[0-9a-f]+)?">/)?.[1];
    assert.ok(og, `${at} absolute og:image`);
    assert.ok(existsSync(join(outDir, og)), `${at} og:image ${og} is built`);
    const [w, h] = pngSize(og);
    assert.match(html, new RegExp(`<meta property="og:image:width" content="${w}">`), `${at} og:image:width matches the file`);
    assert.match(html, new RegExp(`<meta property="og:image:height" content="${h}">`), `${at} og:image:height matches the file`);
    assert.match(html, /<meta property="og:image:alt" content="[^"]+">/, `${at} og:image:alt`);
    assert.match(html, /<meta name="twitter:card" content="summary_large_image">/, `${at} large card`);
    const noindex = /<meta name="robots" content="[^"]*noindex/.test(html);
    const canonical = html.match(/<link rel="canonical" href="https:\/\/yourcoffeesetup\.com([^"]*)">/)?.[1];
    if (noindex) assert.equal(canonical, undefined, `${at} no canonical on a noindex page`);
    else assert.equal(canonical, `/${page.replace(/index\.html$/, '')}`.replace(/^\/\//, '/'), `${at} canonical points to itself`);
  }
});

test('structured data: market homes carry WebSite + Organization with a logo; guides an Article image', () => {
  const { read, has } = build('production');
  const ld = (html) => [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
  const home = ld(read('en-gb/index.html'));
  const website = home.find((d) => d['@type'] === 'WebSite');
  assert.equal(website.url, 'https://yourcoffeesetup.com/en-gb/');
  assert.equal(website.inLanguage, 'en-GB');
  const org = home.find((d) => d['@type'] === 'Organization');
  assert.ok(has(new URL(org.logo.url).pathname.slice(1)), 'the logo file is built');
  assert.ok(ld(read('index.html')).some((d) => d['@type'] === 'WebSite' && d.url === 'https://yourcoffeesetup.com/'), 'root chooser');
  const guide = readdirSync(join(repoRoot, 'content/published')).find((f) => f.endsWith('.md')).slice(0, -3);
  const html = read(`en-gb/guides/${guide}/index.html`);
  const article = ld(html).find((d) => d['@type'] === 'Article');
  assert.ok(article.image?.length, 'Article has an image');
  assert.ok(article.publisher.logo?.url, 'publisher has a logo');
  assert.match(html, /Updated <time datetime="\d{4}-\d{2}-\d{2}">\d{1,2} [A-Z][a-z]{2,3} \d{4}<\/time>/, 'readable date with a machine date');
});

test('asset URLs carry a content hash, and assets have one year-long Cache-Control rule', () => {
  const { read } = build('production');
  const home = read('en-us/index.html');
  for (const asset of ['site.css', 'site.js', 'consent.js', 'icon.svg', 'logo-512.png', 'og-default.png']) {
    const version = home.match(new RegExp(`/assets/${asset.replace('.', '\\.')}\\?v=([0-9a-f]{10})`))?.[1];
    assert.ok(version, `${asset} is versioned`);
    const hash = createHash('sha256').update(readFileSync(join(repoRoot, 'site/public/assets', asset))).digest('hex').slice(0, 10);
    assert.equal(version, hash, `${asset} version is its content hash`);
  }
  assert.doesNotMatch(home, /\/assets\/(?!fonts\/)[^"?]+"/, 'no unversioned asset URL apart from fonts');
  const headers = read('_headers');
  assert.equal((headers.match(/^\/assets\//gm) ?? []).length, 1, 'one /assets rule, so one Cache-Control header');
  assert.match(headers, /\/assets\/\*\n  Cache-Control: public, max-age=31536000, immutable/);
});

test('consent banner: production pages with GTM carry it hidden, previews do not', () => {
  const home = build('production').read('en-gb/index.html');
  assert.match(home, /<section class="consent" id="consent" aria-label="Cookie choice" hidden>/);
  assert.match(home, /<button type="button" id="consent-accept">Accept<\/button>/);
  assert.match(home, /<button type="button" id="consent-reject">Reject<\/button>/);
  assert.match(home, /id="consent-settings" hidden>Cookie settings<\/button>/, 'a way back to the choice in the footer');
  assert.match(home, /<script src="\/assets\/consent\.js\?v=[0-9a-f]{10}" defer><\/script>/);
  const saved = home.indexOf("localStorage.getItem('analytics-consent')");
  assert.ok(saved > home.indexOf("gtag('consent', 'default'") && saved < home.indexOf('gtm.js?id='), 'a saved choice is applied after the defaults and before GTM loads');
  const preview = build('preview').read('en-gb/index.html');
  assert.doesNotMatch(preview, /id="consent"|consent\.js|Cookie settings/);
});

test('production with no published guides: holding homes and no guide list', (t) => {
  // A copy of the repo with content/published emptied, built the way the live site is built.
  const root = mkdtempSync(join(tmpdir(), 'site-empty-'));
  const outDir = join(root, 'out');
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const skip = new Set(['node_modules', 'dist', '.astro']);
  for (const dir of ['engine', 'niches', 'knowledge', 'content', 'data', 'site']) {
    cpSync(join(repoRoot, dir), join(root, dir), { recursive: true, filter: (src) => !skip.has(basename(src)) });
  }
  cpSync(join(repoRoot, 'package.json'), join(root, 'package.json'));
  symlinkSync(join(repoRoot, 'node_modules'), join(root, 'node_modules'), 'dir');
  rmSync(join(root, 'content/published'), { recursive: true, force: true });
  mkdirSync(join(root, 'content/published'));
  const env = { ...process.env, SITE_MODE: 'production', PUBLIC_GTM_ID: 'GTM-TEST0001', ASTRO_TELEMETRY_DISABLED: '1' };
  delete env.WORKERS_CI_BRANCH;
  execFileSync(astro, ['build', '--root', 'site', '--outDir', outDir], { cwd: root, env, stdio: 'pipe' });
  const read = (path) => readFileSync(join(outDir, path), 'utf8');
  assert.match(read('en-us/index.html'), /Fix it, upgrade it, <em>or keep it\.<\/em>/);
  assert.match(read('en-gb/index.html'), /Coming soon for the UK/);
  assert.doesNotMatch(read('en-us/index.html'), /name="robots"/, 'the holding page is indexable');
  assert.ok(!existsSync(join(outDir, 'en-us/guides/index.html')), 'no guide list without guides');
});

test('disclosure never blocks a build: the footer shows the placeholder until a market has its own text', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'site-root-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const dir of ['niches', 'knowledge', 'engine']) cpSync(join(repoRoot, dir), join(root, dir), { recursive: true });
  mkdirSync(join(root, 'content/published'), { recursive: true });
  writeFileSync(join(root, 'content/published/live.md'), '# A live guide\n\nKeep yours.\n');
  assert.equal(loadSiteData({ root, mode: 'production' }).posts.length, 1);
  writeFileSync(join(root, 'content/published/live.md'), '---\noffers: 1\nofferIds: ["bambino-plus"]\n---\n# A live guide\n\nGet the X.\n');
  const data = loadSiteData({ root, mode: 'production' });
  assert.equal(data.posts.length, 1, 'a guide with offers builds without market disclosure text');
  assert.equal(data.site.disclosure(data.markets[0]), DEFAULT_DISCLOSURE);
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

test('guides link to related guides, carry breadcrumbs and structured data, and x-default is the primary market', () => {
  const { read } = build('preview');
  const page = read('en-gb/guides/barista-express-pro-sour-bitter-what-to-change-first/index.html');
  assert.match(page, /<nav class="breadcrumbs" aria-label="Breadcrumb"><ol><li><a href="\/en-gb\/">Home<\/a><\/li>/);
  const related = page.match(/<section class="wrap related"[\s\S]*?<\/section>/)?.[0] ?? '';
  assert.ok(related, 'a Related guides section');
  const links = [...related.matchAll(/href="(\/en-gb\/guides\/[^"]+)"/g)].map((m) => m[1]);
  assert.ok(links.length >= 2 && links.length <= 4, `2–4 related links, got ${links.length}`);
  assert.ok(!links.includes('/en-gb/guides/barista-express-pro-sour-bitter-what-to-change-first/'), 'never itself');
  const blocks = [...page.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
  const article = blocks.find((b) => b['@type'] === 'Article');
  const crumbs = blocks.find((b) => b['@type'] === 'BreadcrumbList');
  assert.equal(article.inLanguage, 'en-GB');
  assert.equal(article.url, 'https://yourcoffeesetup.com/en-gb/guides/barista-express-pro-sour-bitter-what-to-change-first/');
  assert.equal(article.author['@type'], 'Organization', 'no invented author');
  assert.equal(crumbs.itemListElement.at(-1).item, article.url);
  assert.match(page, /hreflang="x-default" href="https:\/\/yourcoffeesetup\.com\/en-us\/guides\/barista-express-pro-sour-bitter-what-to-change-first\/"/);
  assert.match(read('en-gb/index.html'), /hreflang="x-default" href="https:\/\/yourcoffeesetup\.com\/"/, 'market homes keep the chooser');
});

test('related guides: shared products and links first, other markets and itself never', async () => {
  const { relatedPosts } = await import('../lib/templates.mjs');
  const market = { id: 'US' };
  const p = (slug, productIds, extra = {}) => ({ slug, productIds, markets: ['US'], category: 'machines', body: '', ...extra });
  const post = p('a', ['x', 'y'], { body: 'see {{guide:d|d}}' });
  const posts = [post, p('b', ['x', 'y']), p('c', ['x']), p('d', []), p('e', ['z'], { category: 'grinders' }), p('f', ['x'], { markets: ['GB'] })];
  assert.deepEqual(relatedPosts({ post, posts, market }).map((x) => x.slug), ['b', 'c', 'd']);
});
