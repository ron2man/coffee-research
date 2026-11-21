// Headless Claude Code runner: `claude -p` with read-only tools and a JSON Schema for the output.
//
// Billing guard (rebuild-spec 4.3, M0): API-key variables are removed from the child environment,
// and the run refuses to start unless `claude auth status` reports a subscription sign-in.
// Set CLAUDE_RUNNER_ALLOW_API_BILLING=1 only if API billing is intended.
// CLAUDE_BIN overrides the executable (tests use a fake).
import { spawn, spawnSync } from 'node:child_process';
import { RunnerUnavailableError } from './errors.mjs';

export const API_KEY_VARS = ['ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN'];
const SUBSCRIPTION_AUTH = ['claude.ai', 'oauth_token'];
const DEFAULTS = { maxTurns: 40, timeoutMinutes: 30 };

export function childEnv(env = process.env) {
  const next = { ...env };
  if (env.CLAUDE_RUNNER_ALLOW_API_BILLING !== '1') for (const name of API_KEY_VARS) delete next[name];
  return next;
}

/** Throws RunnerUnavailableError unless the CLI is installed and signed in the intended way. */
export function checkAuth({ bin, env }) {
  const result = spawnSync(bin, ['auth', 'status'], { env, encoding: 'utf8', timeout: 30_000 });
  if (result.error?.code === 'ENOENT') throw new RunnerUnavailableError(`Claude CLI not found (${bin}). Install it or set CLAUDE_BIN.`);
  if (result.error) throw new RunnerUnavailableError(`Claude CLI did not start: ${result.error.message}`);
  if (result.status !== 0) throw new RunnerUnavailableError('Claude CLI is not signed in (claude auth status failed). Run `claude auth login`.');
  let status;
  try {
    status = JSON.parse(result.stdout);
  } catch {
    throw new RunnerUnavailableError('Could not read `claude auth status` output; update the Claude CLI.');
  }
  if (!SUBSCRIPTION_AUTH.includes(status.authMethod) && env.CLAUDE_RUNNER_ALLOW_API_BILLING !== '1') {
    throw new RunnerUnavailableError(
      `Claude CLI auth method is "${status.authMethod}", not a subscription sign-in. Refusing to run so usage is not billed to an API account (set CLAUDE_RUNNER_ALLOW_API_BILLING=1 if intended).`,
    );
  }
  return status;
}

export function buildArgs(request) {
  const { agent, tools = [] } = request;
  const config = { ...DEFAULTS, ...agent.runner };
  const args = [
    '-p',
    '--output-format', 'json',
    '--no-session-persistence',
    '--permission-mode', 'dontAsk', // anything not pre-approved is denied; nobody is there to answer
    '--tools', tools.join(','), // only these built-in tools exist in the session
    '--disallowedTools', 'mcp__*',
    '--max-turns', String(config.maxTurns),
    '--append-system-prompt-file', agent.promptPath,
    '--json-schema', JSON.stringify(agent.outputSchema),
  ];
  if (tools.length) args.push('--allowedTools', ...tools);
  if (config.model) args.push('--model', config.model);
  return args;
}

export function buildPrompt(request) {
  return [
    `You are the "${request.agent.name}" agent. Your instructions are in the system prompt.`,
    'You cannot write files. Return your whole result as the structured output; the scheduler validates it and writes every file.',
    '',
    'Input:',
    '```json',
    JSON.stringify(request.input, null, 2),
    '```',
  ].join('\n');
}

/** Turn the CLI's JSON result into { output, usage }. Throws on an error result or unreadable output. */
export function parseResult(stdout) {
  let result;
  try {
    result = JSON.parse(stdout);
  } catch {
    throw new Error(`claude -p did not return JSON: ${stdout.slice(0, 200)}`);
  }
  if (result.is_error) throw new Error(`claude -p reported an error (${result.subtype ?? 'error'}): ${String(result.result ?? '').slice(0, 500)}`);
  let output = result.structured_output;
  if (output === undefined) {
    try {
      output = JSON.parse(result.result);
    } catch {
      throw new Error('claude -p returned no structured output');
    }
  }
  const usage = {
    costUsd: result.total_cost_usd ?? null,
    turns: result.num_turns ?? null,
    durationMs: result.duration_ms ?? null,
    tokens: result.usage ?? null,
    sessionId: result.session_id ?? null,
  };
  return { output, usage };
}

export function claudeRunner({ bin = process.env.CLAUDE_BIN ?? 'claude', env = process.env } = {}) {
  return {
    type: 'claude',
    async run(request) {
      const { agent, root } = request;
      if (!agent.promptPath) throw new RunnerUnavailableError(`Agent ${agent.name} has no prompt.md yet`);
      const runEnv = childEnv(env);
      checkAuth({ bin, env: runEnv });
      const timeoutMs = (agent.runner.timeoutMinutes ?? DEFAULTS.timeoutMinutes) * 60_000;
      const stdout = await new Promise((resolve, reject) => {
        const child = spawn(bin, buildArgs(request), { cwd: root, env: runEnv, stdio: ['pipe', 'pipe', 'pipe'] });
        let out = '';
        let err = '';
        const timer = setTimeout(() => {
          child.kill('SIGTERM');
          reject(new Error(`claude -p timed out after ${timeoutMs / 60_000} minutes`));
        }, timeoutMs);
        child.stdout.on('data', (chunk) => { out += chunk; });
        child.stderr.on('data', (chunk) => { err += chunk; });
        child.on('error', (error) => {
          clearTimeout(timer);
          reject(error.code === 'ENOENT' ? new RunnerUnavailableError(`Claude CLI not found (${bin})`) : error);
        });
        child.on('close', (code) => {
          clearTimeout(timer);
          if (code === 0 || out.trim().startsWith('{')) resolve(out);
          else reject(new Error(`claude -p exited ${code}: ${(err || out).trim().slice(0, 500)}`));
        });
        child.stdin.end(buildPrompt(request));
      });
      return parseResult(stdout);
    },
  };
}
