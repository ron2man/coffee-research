import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadAgents } from '../agents/registry.mjs';
import { RunnerUnavailableError, claudeRunner } from '../runner/index.mjs';
import { buildArgs, childEnv } from '../runner/claude.mjs';
import { repoRoot } from '../state/niche.mjs';

const bin = fileURLToPath(new URL('./fixtures/fake-claude.mjs', import.meta.url));
const research = loadAgents().find((agent) => agent.name === 'research');
const fixture = JSON.parse(readFileSync(join(repoRoot, 'engine/agents/research/fixtures/valid.json'), 'utf8'));

function setup(t, extraEnv = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'engine-runner-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const promptPath = join(dir, 'prompt.md');
  writeFileSync(promptPath, '# Research agent\n');
  const log = join(dir, 'log.json');
  const env = { PATH: process.env.PATH, ANTHROPIC_API_KEY: 'sk-should-not-leak', FAKE_CLAUDE_LOG: log, FAKE_CLAUDE_OUTPUT: JSON.stringify(fixture), ...extraEnv };
  const agent = { ...research, promptPath };
  const request = { agent, root: dir, instructions: '# Research agent\n', input: { item: { id: 'x' } }, tools: agent.runner.tools, permissions: {} };
  return { runner: claudeRunner({ bin, env }), request, log: () => JSON.parse(readFileSync(log, 'utf8')), dir };
}

test('claude runner: read-only tools, schema, no API key, usage returned', async (t) => {
  const { runner, request, log, dir } = setup(t);
  const { output, usage } = await runner.run(request);
  assert.deepEqual(output, fixture);
  assert.equal(usage.costUsd, 0.12);
  const call = log();
  assert.equal(call.apiKey, null, 'ANTHROPIC_API_KEY is removed from the job environment');
  // macOS tmpdir is a symlink (/var → /private/var); the child reports the resolved path.
  assert.equal(realpathSync(call.cwd), realpathSync(dir));
  const at = (flag) => call.args[call.args.indexOf(flag) + 1];
  assert.equal(at('--tools'), 'WebSearch,WebFetch,Read,Glob,Grep');
  assert.equal(at('--permission-mode'), 'dontAsk');
  assert.equal(at('--append-system-prompt'), '# Research agent\n');
  assert.equal(at('--disallowedTools'), 'mcp__*');
  assert.deepEqual(JSON.parse(at('--json-schema')).properties.artifact.required, ['learned', 'unknowns', 'competitors', 'claimIds']);
  assert.match(call.stdin, /"id": "x"/);
});

test('claude runner refuses API-key auth, signed-out CLI, missing CLI and missing prompt', async (t) => {
  const api = setup(t, { FAKE_CLAUDE_AUTH: 'api_key' });
  await assert.rejects(api.runner.run(api.request), (error) => error instanceof RunnerUnavailableError && /not a subscription/.test(error.message));
  const out = setup(t, { FAKE_CLAUDE_SIGNED_OUT: '1' });
  await assert.rejects(out.runner.run(out.request), /not signed in/);
  const missing = setup(t);
  await assert.rejects(claudeRunner({ bin: '/nonexistent/claude', env: {} }).run(missing.request), RunnerUnavailableError);
  await assert.rejects(missing.runner.run({ ...missing.request, agent: { ...research, promptPath: null } }), /no prompt\.md/);
});

test('claude runner surfaces an error result as a run failure (counts as an attempt)', async (t) => {
  const { runner, request } = setup(t, { FAKE_CLAUDE_ERROR: 'max turns reached' });
  await assert.rejects(runner.run(request), (error) => !(error instanceof RunnerUnavailableError) && /max turns reached/.test(error.message));
});

test('API billing must be opted into explicitly', () => {
  assert.equal(childEnv({ ANTHROPIC_API_KEY: 'k' }).ANTHROPIC_API_KEY, undefined);
  assert.equal(childEnv({ ANTHROPIC_API_KEY: 'k', CLAUDE_RUNNER_ALLOW_API_BILLING: '1' }).ANTHROPIC_API_KEY, 'k');
  assert.ok(buildArgs({ agent: { ...research, promptPath: 'p.md' }, instructions: 'x', tools: [] }).includes(''), 'no tools means --tools ""');
});

test('agent definitions cannot request write tools', () => {
  for (const agent of loadAgents()) {
    assert.ok((agent.runner.tools ?? []).every((tool) => ['Read', 'Grep', 'Glob', 'WebSearch', 'WebFetch'].includes(tool)), agent.name);
  }
});
