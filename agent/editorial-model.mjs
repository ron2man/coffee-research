import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const string = { type: 'string' };
export function object(properties) {
  return { type: 'object', properties, additionalProperties: false, required: Object.keys(properties) };
}

// Start in an empty directory so blind reviews do not inherit the project's brief or prior verdict.
export function evaluate(prompt, schema) {
  const dir = mkdtempSync(join(tmpdir(), 'coffee-evaluation-'));
  try {
    const schemaPath = join(dir, 'schema.json');
    const output = join(dir, 'result.json');
    writeFileSync(schemaPath, JSON.stringify(schema));
    const result = spawnSync('codex', ['exec', '--skip-git-repo-check', '-s', 'read-only',
      '--output-schema', schemaPath, '-o', output, '-'], {
      cwd: dir, input: prompt, encoding: 'utf8', stdio: ['pipe', 'ignore', 'inherit'],
    });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error('Editorial evaluation failed');
    return JSON.parse(readFileSync(output, 'utf8'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
