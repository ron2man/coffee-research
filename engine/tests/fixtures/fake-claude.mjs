#!/usr/bin/env node
// Stand-in for the Claude CLI in runner tests. Behaviour is driven by FAKE_CLAUDE_* env vars.
import { readFileSync, writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
if (args[0] === 'auth' && args[1] === 'status') {
  if (process.env.FAKE_CLAUDE_SIGNED_OUT) process.exit(1);
  console.log(JSON.stringify({ loggedIn: true, authMethod: process.env.FAKE_CLAUDE_AUTH ?? 'claude.ai' }));
  process.exit(0);
}
const stdin = readFileSync(0, 'utf8');
writeFileSync(process.env.FAKE_CLAUDE_LOG, JSON.stringify({ args, stdin, apiKey: process.env.ANTHROPIC_API_KEY ?? null, cwd: process.cwd() }));
const output = JSON.parse(process.env.FAKE_CLAUDE_OUTPUT ?? '{}');
console.log(JSON.stringify({
  type: 'result', subtype: 'success', is_error: Boolean(process.env.FAKE_CLAUDE_ERROR),
  result: process.env.FAKE_CLAUDE_ERROR ?? '', structured_output: output,
  total_cost_usd: 0.12, num_turns: 3, duration_ms: 4200, usage: { input_tokens: 10, output_tokens: 20 }, session_id: 's1',
}));
