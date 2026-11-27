import test from 'node:test';
import assert from 'node:assert/strict';
import { optionVisible, toolProblems } from '../state/tools.mjs';

const base = () => ({
  id: 'panel-key',
  title: 'What is it asking for?',
  questions: [
    { key: 'panel', text: 'Which panel?', options: [['light', 'A light'], ['screen', 'A screen']] },
    {
      key: 'signal', text: 'What does it show?', options: [
        ['flash', 'Flashing', { panel: 'light' }],
        ['solid', 'On steadily', { panel: ['light'] }],
        ['flush', 'FLUSH', { panel: 'screen' }],
        ['descale', 'DESCALE', { panel: 'screen' }],
        ['none', 'Nothing'],
      ],
    },
  ],
  results: { clean: { title: 'Clean it', text: 'Run the cleaning cycle.' }, keep: { title: 'Keep it', text: 'Nothing is due.' } },
  rules: [{ when: { panel: 'light', signal: 'flash' }, result: 'clean' }, { when: { panel: 'screen', signal: 'flush' }, result: 'clean' }],
  default: 'keep',
});

test('optionVisible: no showIf is always shown; an answered showIf key must match', () => {
  assert.equal(optionVisible(['a', 'A'], {}), true);
  assert.equal(optionVisible(['a', 'A', { panel: 'light' }], {}), true, 'shown until the earlier question is answered');
  assert.equal(optionVisible(['a', 'A', { panel: 'light' }], { panel: 'screen' }), false);
  assert.equal(optionVisible(['a', 'A', { panel: 'light' }], { panel: 'light' }), true);
  assert.equal(optionVisible(['a', 'A', { panel: ['light', 'screen'] }], { panel: 'screen' }), true);
  assert.equal(optionVisible(['a', 'A', { panel: 'light', mode: 'x' }], { panel: 'light', mode: 'y' }), false);
});

test('a tool with showIf passes, and its mistakes are reported', () => {
  assert.deepEqual(toolProblems(base()), []);

  const later = base();
  later.questions[0].options[0].push({ signal: 'flash' });
  assert.match(toolProblems(later).join('\n'), /showIf uses "signal", which is not an earlier question/);

  const unknown = base();
  unknown.questions[1].options[0][2] = { panel: 'dial' };
  assert.match(toolProblems(unknown).join('\n'), /"dial" is not an option of "panel"/);

  const one = base();
  one.questions[1].options = one.questions[1].options.map((o) => (o[0] === 'none' ? ['none', 'Nothing', { panel: 'screen' }] : o));
  one.questions[1].options.splice(1, 1); // light now shows only "flash"
  assert.match(toolProblems(one).join('\n'), /"signal" shows 1 option\(s\) when panel=light; keep at least 2/);

  const dead = base();
  dead.rules.push({ when: { panel: 'screen', signal: 'flash' }, result: 'clean' });
  assert.match(toolProblems(dead).join('\n'), /rule 3 can never match: "signal=flash" is hidden by its other answers/);

  const malformed = base();
  malformed.questions[1].options[0][2] = {};
  assert.ok(toolProblems(malformed).length > 0, 'an empty showIf fails the schema');
});
