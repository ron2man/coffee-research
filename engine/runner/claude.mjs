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
    '--output-format', 'stream-json', '--verbose', // events let us keep a trace of searches and fetches
    '--no-session-persistence',
    '--permission-mode', 'dontAsk', // anything not pre-approved is denied; nobody is there to answer
    '--tools', tools.join(','), // only these built-in tools exist in the session
    '--disallowedTools', 'mcp__*',
    '--max-turns', String(config.maxTurns),
    '--append-system-prompt', request.instructions,
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

const FAILED_FETCH = /\b(403|404|429|5\d\d|forbidden|blocked|access denied|unable to fetch|failed to fetch|could not fetch|timed out|captcha)\b/i;
const resultText = (content) => (typeof content === 'string' ? content : Array.isArray(content) ? content.map((c) => c.text ?? '').join(' ') : '');

/**
 * What the agent did, from the stream-json events: every tool call (search query, fetched URL,
 * file read) and whether it worked. Kept even when a run times out.
 */
export function traceFromEvents(lines) {
  const calls = [];
  const byId = new Map();
  for (const line of lines) {
    let event;
    try {
      event = JSON.parse(line);
    } catch {
      continue;
    }
    for (const part of event.message?.content ?? []) {
      if (event.type === 'assistant' && part.type === 'tool_use') {
        const input = part.input ?? {};
        const call = { tool: part.name, target: String(input.query ?? input.url ?? input.file_path ?? input.pattern ?? JSON.stringify(input)).slice(0, 200), ok: null };
        byId.set(part.id, call);
        calls.push(call);
      } else if (event.type === 'user' && part.type === 'tool_result' && byId.has(part.tool_use_id)) {
        const call = byId.get(part.tool_use_id);
        const text = resultText(part.content);
        call.ok = !part.is_error && !(call.tool === 'WebFetch' && FAILED_FETCH.test(text.slice(0, 400)));
        if (!call.ok) call.note = text.replace(/\s+/g, ' ').slice(0, 160);
      }
    }
  }
  const count = (tool, ok) => calls.filter((c) => c.tool === tool && (ok === undefined || c.ok === ok)).length;
  return {
    calls: calls.slice(0, 200),
    summary: { searches: count('WebSearch'), fetches: count('WebFetch'), failedFetches: count('WebFetch', false), reads: count('Read'), unanswered: calls.filter((c) => c.ok === null).length },
  };
}

export function claudeRunner({ bin = process.env.CLAUDE_BIN ?? 'claude', env = process.env } = {}) {
  return {
    type: 'claude',
    async run(request) {
      const { agent, root } = request;
      if (!agent.promptPath || !request.instructions) throw new RunnerUnavailableError(`Agent ${agent.name} has no prompt.md yet`);
      const runEnv = childEnv(env);
      checkAuth({ bin, env: runEnv });
      const timeoutMs = (agent.runner.timeoutMinutes ?? DEFAULTS.timeoutMinutes) * 60_000;
      const lines = [];
      const stdout = await new Promise((resolve, reject) => {
        const child = spawn(bin, buildArgs(request), { cwd: root, env: runEnv, stdio: ['pipe', 'pipe', 'pipe'] });
        let out = '';
        let err = '';
        let pending = '';
        const fail = (error) => {
          error.trace = traceFromEvents(lines);
          reject(error);
        };
        const timer = setTimeout(() => {
          child.kill('SIGTERM');
          fail(new Error(`claude -p timed out after ${timeoutMs / 60_000} minutes`));
        }, timeoutMs);
        // Progress on the terminal only (never in cron logs or tests): a real run takes minutes.
        const started = Date.now();
        const progress = process.stderr.isTTY
          ? setInterval(() => process.stderr.write(`  ${agent.name}: still running (${Math.round((Date.now() - started) / 60_000)} min)\n`), 60_000)
          : null;
        if (process.stderr.isTTY) process.stderr.write(`Running ${agent.name} with claude -p (timeout ${timeoutMs / 60_000} min). Output appears when it finishes.\n`);
        child.on('close', () => clearInterval(progress));
        child.stdout.on('data', (chunk) => {
          out += chunk;
          pending += chunk;
          const parts = pending.split('\n');
          pending = parts.pop();
          lines.push(...parts.filter(Boolean));
        });
        child.stderr.on('data', (chunk) => { err += chunk; });
        child.on('error', (error) => {
          clearTimeout(timer);
          reject(error.code === 'ENOENT' ? new RunnerUnavailableError(`Claude CLI not found (${bin})`) : error);
        });
        child.on('close', (code) => {
          clearTimeout(timer);
          if (pending.trim()) lines.push(pending.trim());
          if (code === 0 || out.trim().startsWith('{')) resolve(out);
          else fail(new Error(`claude -p exited ${code}: ${(err || out).trim().slice(0, 500)}`));
        });
        child.stdin.end(buildPrompt(request));
      });
      const trace = traceFromEvents(lines);
      // stream-json ends with a "result" event; older CLIs print one JSON object.
      const isResult = (line) => {
        try {
          return JSON.parse(line).type === 'result';
        } catch {
          return false;
        }
      };
      const resultLine = [...lines].reverse().find(isResult) ?? stdout;
      try {
        return { ...parseResult(resultLine), trace };
      } catch (error) {
        error.trace = trace;
        throw error;
      }
    },
  };
}
