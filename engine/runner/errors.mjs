/** The runner could not start (missing CLI, not signed in, wrong billing). Does not count as an item attempt. */
export class RunnerUnavailableError extends Error {
  constructor(message) {
    super(message);
    this.name = 'RunnerUnavailableError';
  }
}
