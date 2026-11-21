// Runner abstraction: run({ agent, input, tools, permissions, root }) → { output, usage }.
// The scheduler validates `output`; runners only execute.
import { claudeRunner } from './claude.mjs';
import { RunnerUnavailableError } from './errors.mjs';

export { claudeRunner, RunnerUnavailableError };

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

/** Pick the runner per agent from its definition, unless an override is supplied (tests, simulation). */
export function runnerFor(agent, override) {
  if (override) return override;
  if (agent.runner.type === 'claude') return claudeRunner();
  throw new RunnerUnavailableError(`No runner available for type ${agent.runner.type}`);
}
