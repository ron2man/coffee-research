// Interactive tools (pickers / troubleshooters) in content/tools/<id>.json: data the site renders.
import { existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { readJson } from './store.mjs';
import { compileFile } from './validate.mjs';

export const TOOLS_DIR = 'content/tools';
const schemaPath = fileURLToPath(new URL('./schemas/tool.schema.json', import.meta.url));

export function listTools(root) {
  const dir = join(root, TOOLS_DIR);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((n) => n.endsWith('.json')).sort().map((n) => readJson(join(dir, n)));
}

/**
 * Whether an option is offered, given the answers so far. An option [value, label, showIf] is hidden
 * once a showIf question has been answered with a value it doesn't list; until then it stays shown,
 * so a question never looks empty before the earlier ones are answered. The site's
 * Picker (site/public/assets/site.js, optionVisible) applies the same rule; a test keeps them equal.
 */
export function optionVisible(option, answers) {
  const showIf = option[2];
  if (!showIf) return true;
  return Object.entries(showIf).every(([key, allowed]) => answers[key] === undefined || [allowed].flat().includes(answers[key]));
}

/** Every combination of answers to the given questions (all answered). */
function combinations(questions) {
  return questions.reduce((combos, q) => combos.flatMap((c) => q.options.map(([value]) => ({ ...c, [q.key]: value }))), [{}]);
}

/** Problems with a tool, beyond its schema: references between questions, rules and results. */
export function toolProblems(tool, { cards } = {}) {
  const validate = compileFile(schemaPath);
  if (!validate(tool)) return validate.errors.map((e) => `${e.instancePath || '/'} ${e.message}`);
  const problems = [];
  const options = new Map(tool.questions.map((q) => [q.key, new Set(q.options.map(([value]) => value))]));
  if (options.size !== tool.questions.length) problems.push('question keys must be unique');
  // showIf may only use earlier questions and their real options, and must leave a real choice.
  tool.questions.forEach((q, qi) => {
    const earlier = tool.questions.slice(0, qi);
    const earlierKeys = new Set(earlier.map((e) => e.key));
    const used = new Set();
    for (const option of q.options) {
      for (const [key, allowed] of Object.entries(option[2] ?? {})) {
        used.add(key);
        if (!earlierKeys.has(key)) { problems.push(`"${q.key}" option "${option[0]}": showIf uses "${key}", which is not an earlier question`); continue; }
        for (const value of [allowed].flat()) if (!options.get(key).has(value)) problems.push(`"${q.key}" option "${option[0]}": "${value}" is not an option of "${key}"`);
      }
    }
    if (!used.size || problems.length) return;
    for (const answers of combinations(earlier.filter((e) => used.has(e.key)))) {
      const shown = q.options.filter((o) => optionVisible(o, answers)).length;
      if (shown < 2) problems.push(`"${q.key}" shows ${shown} option(s) when ${Object.entries(answers).map(([k, v]) => `${k}=${v}`).join(', ')}; keep at least 2`);
    }
  });
  const results = new Set(Object.keys(tool.results));
  if (!results.has(tool.default)) problems.push(`default "${tool.default}" is not a result`);
  const used = new Set([tool.default]);
  const byKey = new Map(tool.questions.map((q) => [q.key, new Map(q.options.map((o) => [o[0], o]))]));
  tool.rules.forEach((rule, i) => {
    if (!results.has(rule.result)) problems.push(`rule ${i + 1} picks unknown result "${rule.result}"`);
    // A rule that needs an option its own answers hide can never match.
    const hidden = Object.entries(rule.when).find(([key, value]) => {
      const option = byKey.get(key)?.get(value);
      return option && Object.entries(option[2] ?? {}).some(([k, allowed]) => k in rule.when && ![allowed].flat().includes(rule.when[k]));
    });
    if (hidden) { problems.push(`rule ${i + 1} can never match: "${hidden[0]}=${hidden[1]}" is hidden by its other answers`); return; }
    used.add(rule.result);
    for (const [key, value] of Object.entries(rule.when)) {
      if (!options.has(key)) problems.push(`rule ${i + 1} uses unknown question "${key}"`);
      else if (!options.get(key).has(value)) problems.push(`rule ${i + 1}: "${value}" is not an option of "${key}"`);
    }
  });
  for (const key of results) if (!used.has(key)) problems.push(`result "${key}" can never be reached`);
  if (cards) {
    for (const [key, result] of Object.entries(tool.results)) {
      if (result.productId && !cards.has(result.productId)) problems.push(`result "${key}" names product ${result.productId}, which has no knowledge card`);
    }
  }
  return problems;
}
