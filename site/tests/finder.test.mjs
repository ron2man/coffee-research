import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';
import { fitsProfile, finderProblems, guideTags, loadFinder, questionVisible } from '../lib/finder.mjs';
import { loadSiteData, repoRoot, siteDir } from '../lib/site-data.mjs';

const finder = loadFinder(repoRoot);

// finder.js runs in the browser; load it with just enough of a page to reach window.YCSFinder.
const context = { window: {}, document: { readyState: 'complete', querySelectorAll: () => [], addEventListener() {} }, localStorage: { getItem: () => null, setItem() {} } };
vm.runInNewContext(readFileSync(join(siteDir, 'public', 'assets', 'finder.js'), 'utf8'), context);
const browser = context.window.YCSFinder;

test('the finder and every guide\'s setup tags are valid', () => {
  const { posts } = loadSiteData({ mode: 'preview' });
  assert.deepEqual(finderProblems(finder, posts), []);
});

test('finder problems: what a broken question or tag looks like', () => {
  const broken = {
    questions: [
      { key: 'brew', text: 'What?', use: 'filter', options: [['espresso', 'E'], ['capsule', 'C']] },
      { key: 'model', text: 'Which?', use: 'sort', showIf: { brew: ['pods'], later: ['x'] }, options: [['a', 'A'], ['a', 'A again']] },
      { key: 'later', text: 'Later', use: 'none', options: [['x', 'X']] },
    ],
  };
  const problems = finderProblems(broken, [{ slug: 'g', setup: { brew: ['kettle'], mood: ['calm'] } }]).join('\n');
  assert.match(problems, /use must be filter, rank or none/);
  assert.match(problems, /showIf "pods" is not an option of "brew"/);
  assert.match(problems, /showIf uses "later", which is not an earlier question/);
  assert.match(problems, /duplicate option values/);
  assert.match(problems, /\(later\): needs at least 2 options/);
  assert.match(problems, /g: setup "brew" has "kettle", not an option of that question/);
  assert.match(problems, /g: setup uses "mood", which is not a finder question/);
});

test('guide tags: products tag the model question, and the model implies its earlier answer', () => {
  assert.deepEqual(guideTags({ productIds: ['barista-express', 'baratza-encore'] }, finder), { model: ['barista-express'], brew: ['espresso'] });
  assert.deepEqual(guideTags({ productIds: ['barista-pro'], setup: { symptom: ['fast-sour'] } }, finder), { symptom: ['fast-sour'], model: ['barista-pro'], brew: ['espresso'], goal: ['problem'] }, 'a symptom implies the goal it is asked under');
  assert.deepEqual(guideTags({ productIds: ['barista-pro'], setup: { brew: ['b2c'] } }, finder).brew, ['b2c'], 'a guide that says otherwise wins');
  assert.deepEqual(guideTags({ productIds: [] }, finder), {}, 'an untagged guide fits every setup');
});

test('the browser filters and asks exactly as the build expects, for every answer combination', () => {
  const { posts } = loadSiteData({ mode: 'preview' });
  const filters = finder.questions.filter((q) => q.use === 'filter');
  const filterKeys = filters.map((q) => q.key);
  // Every combination of filter answers, unanswered included.
  const combos = filters.reduce((all, q) => all.flatMap((c) => [c, ...q.options.map(([v]) => ({ ...c, [q.key]: v }))]), [{}]);
  for (const post of posts) {
    for (const answers of combos) {
      assert.equal(browser.fits(post.setupTags, answers, filterKeys), fitsProfile(post.setupTags, answers, finder), `${post.slug} ${JSON.stringify(answers)}`);
    }
  }
  for (const q of finder.questions) {
    const deps = Object.keys(q.showIf ?? {}).map((k) => finder.questions.find((x) => x.key === k));
    const depCombos = deps.reduce((all, d) => all.flatMap((c) => [c, ...d.options.map(([v]) => ({ ...c, [d.key]: v }))]), [{}]);
    for (const answers of depCombos) assert.equal(browser.visible(q, answers), questionVisible(q, answers), `${q.key} ${JSON.stringify(answers)}`);
  }
});

test('question order: branches, skips and the end', () => {
  const Q = finder.questions;
  const next = (answers, after, skipped = {}) => browser.nextFrom(Q, Q.findIndex((q) => q.key === after), answers, skipped);
  assert.equal(next({ brew: 'espresso' }, 'brew'), 'model');
  assert.equal(next({ brew: 'capsule' }, 'brew'), 'pods');
  assert.equal(next({ brew: 'espresso', model: 'barista-express' }, 'model'), 'beans', 'a built-in grinder: no grinder question');
  assert.equal(next({ brew: 'espresso', model: 'bambino' }, 'model'), 'grinder');
  assert.equal(next({}, 'brew', { brew: true }), 'drink', 'skipping the machine skips everything that depends on it');
  assert.equal(next({ brew: 'capsule', pods: 'nespresso-original', drink: 'milk', goal: 'problem' }, 'goal'), null, 'no symptom question for capsules: done');
  assert.equal(next({ brew: 'espresso', goal: 'problem' }, 'goal'), 'symptom');
});

test('ranking: a guide that matches more of the rank answers comes first', () => {
  const rank = finder.questions.filter((q) => q.use === 'rank').map((q) => q.key);
  const sour = { symptom: ['fast-sour'], goal: ['problem'] };
  const light = { symptom: ['maintenance-light'], goal: ['problem'] };
  assert.ok(browser.rankScore(sour, { goal: 'problem', symptom: 'fast-sour' }, rank) > browser.rankScore(light, { goal: 'problem', symptom: 'fast-sour' }, rank));
  assert.equal(browser.rankScore({}, { goal: 'problem' }, rank), 0);
});
