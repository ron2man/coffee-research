// Runner abstraction: run({ agent, input, tools, permissions }) → { output, usage }.
// The scheduler validates `output`; runners only execute.

/** The runner could not start (missing CLI, not signed in). Does not count as an item attempt. */
export class RunnerUnavailableError extends Error {
  constructor(message) {
    super(message);
    this.name = 'RunnerUnavailableError';
  }
}

/** Test/simulation runner: `handlers[agentName](input, request)` returns the agent output. */
export function fakeRunner(handlers) {
  return {
    type: 'fake',
    async run(request) {
      const handler = handlers[request.agent.name];
      if (!handler) throw new RunnerUnavailableError(`No fake handler for agent ${request.agent.name}`);
      return { output: await handler(request.input, request), usage: null };
    },
  };
}

/** Headless Claude Code (`claude -p`). Implemented in M0 after the billing check. */
export function claudeRunner() {
  return {
    type: 'claude',
    async run() {
      throw new RunnerUnavailableError(
        'The claude runner is not implemented yet. It lands in milestone M0 after the billing check (rebuild-spec 4.3).',
      );
    },
  };
}

/** Pick the runner per agent from its definition, unless an override is supplied (tests, simulation). */
export function runnerFor(agent, override) {
  if (override) return override;
  if (agent.runner.type === 'claude') return claudeRunner();
  throw new RunnerUnavailableError(`No runner available for type ${agent.runner.type}`);
}
