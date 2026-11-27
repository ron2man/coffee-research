import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';
import { repoRoot, siteDir } from '../lib/site-data.mjs';
import { listTools, optionVisible } from '../../engine/state/tools.mjs';

// site.js runs in the browser; load it with just enough of a page to reach window.YCSPicker.
const context = { document: { addEventListener() {} }, window: { addEventListener() {} } };
vm.runInNewContext(readFileSync(join(siteDir, 'public', 'assets', 'site.js'), 'utf8'), context);
const picker = context.window.YCSPicker;

const combinations = (questions) =>
  questions.reduce((combos, q) => combos.flatMap((c) => [...q.options.map(([v]) => ({ ...c, [q.key]: v })), c]), [{}]);

test('the browser picker shows the same options and picks the same result as the engine, for every tool', () => {
  const tools = listTools(repoRoot);
  assert.ok(tools.length > 0);
  for (const tool of tools) {
    for (const answers of combinations(tool.questions)) {
      for (const q of tool.questions) {
        for (const option of q.options) {
          assert.equal(picker.optionVisible(option, answers), optionVisible(option, answers), `${tool.id} ${q.key}=${option[0]} ${JSON.stringify(answers)}`);
        }
      }
      const rule = tool.rules.find((r) => Object.entries(r.when).every(([k, v]) => answers[k] === v));
      assert.equal(picker.resultFor(tool, answers), rule ? rule.result : tool.default, `${tool.id} ${JSON.stringify(answers)}`);
    }
  }
});

test('maintenance key: Express readers see light signals, Pro readers see screen signals', () => {
  const tool = listTools(repoRoot).find((t) => t.id === 'barista-maintenance-alert-key');
  const signal = tool.questions.find((q) => q.key === 'signal');
  const shown = (panel) => signal.options.filter((o) => picker.optionVisible(o, { panel })).map((o) => o[0]);
  assert.deepEqual(shown('express-cd'), ['flash', 'solid', 'none']);
  assert.deepEqual(shown('express-cm'), ['flash', 'solid', 'none']);
  assert.deepEqual(shown('pro'), ['flush', 'descale', 'new', 'none']);
});
