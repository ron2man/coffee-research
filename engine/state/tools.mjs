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

/** Problems with a tool, beyond its schema: references between questions, rules and results. */
export function toolProblems(tool, { cards } = {}) {
  const validate = compileFile(schemaPath);
  if (!validate(tool)) return validate.errors.map((e) => `${e.instancePath || '/'} ${e.message}`);
  const problems = [];
  const options = new Map(tool.questions.map((q) => [q.key, new Set(q.options.map(([value]) => value))]));
  if (options.size !== tool.questions.length) problems.push('question keys must be unique');
  const results = new Set(Object.keys(tool.results));
  if (!results.has(tool.default)) problems.push(`default "${tool.default}" is not a result`);
  const used = new Set([tool.default]);
  tool.rules.forEach((rule, i) => {
    if (!results.has(rule.result)) problems.push(`rule ${i + 1} picks unknown result "${rule.result}"`);
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
