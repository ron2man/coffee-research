import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { guideIllustration, illustrationPath, illustrationProblems, loadIllustrations } from '../lib/illustrations.mjs';
import { loadSiteData, siteDir } from '../lib/site-data.mjs';
import { illustrationPng } from '../lib/og.mjs';

const library = loadIllustrations(siteDir);

test('the illustration library is valid and every drawing is a plain line drawing', () => {
  assert.deepEqual(illustrationProblems(library, [], { siteDir }), []);
  for (const id of Object.keys(library.illustrations)) {
    const svg = readFileSync(join(siteDir, 'public', illustrationPath(id)), 'utf8');
    assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 240 180"/, `${id}: 240×180`);
    assert.doesNotMatch(svg, /<(text|image|script|foreignObject)\b|href=/, `${id}: no text, images, scripts or links`);
    const png = illustrationPng(id);
    assert.equal(png.readUInt32BE(16), 1200, `${id}: PNG 1200 wide`);
    assert.equal(png.readUInt32BE(20), 900, `${id}: PNG 900 high`);
  }
});

test('a guide gets its frontmatter drawing, else one matching its setup tags, else its category\'s', () => {
  const post = { slug: 'g', category: 'machines' };
  assert.equal(guideIllustration(post, {}, library).id, 'espresso-machine', 'category');
  assert.equal(guideIllustration(post, { symptom: ['fast-sour'] }, library).id, 'fast-sour-shot', 'setup tag');
  assert.equal(guideIllustration(post, { symptom: ['grinder-too-coarse', 'fast-sour'] }, library).id, 'grind-dial', 'the first match in list order');
  const chosen = guideIllustration({ ...post, image: { illustration: 'grinder', caption: 'Own words.' } }, { symptom: ['fast-sour'] }, library);
  assert.deepEqual([chosen.id, chosen.caption], ['grinder', 'Own words.'], 'frontmatter wins, with its caption');
  assert.equal(guideIllustration({ slug: 'x', category: 'unknown' }, {}, library), null, 'no drawing for an unknown category');
});

test('every guide with a category has a drawing; broken references are reported', () => {
  const data = loadSiteData({ mode: 'preview' });
  const current = data.posts.filter((p) => p.category);
  assert.ok(current.some((p) => p.status === 'published'));
  for (const post of current) assert.ok(post.illustration, `${post.slug} has a drawing`);
  const problems = illustrationProblems(
    { illustrations: { 'Bad Id': { alt: '' } }, categories: { machines: 'missing' } },
    [{ slug: 'g', image: { illustration: 'nope' } }],
    { siteDir },
  ).join('\n');
  for (const text of ['lower-case', 'no alt text', 'no caption', 'is missing', 'category "machines"', 'g: image']) assert.match(problems, new RegExp(text));
});
