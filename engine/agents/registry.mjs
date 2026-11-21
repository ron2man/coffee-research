// Loads agent definitions and builds the validators for their outputs.
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readJson } from '../state/store.mjs';
import { assertValid, compile, compileFile } from '../state/validate.mjs';
import { allowedTransitions } from '../state/machine.mjs';

export const agentsDir = fileURLToPath(new URL('./', import.meta.url));
const definitionSchema = join(agentsDir, 'agent.schema.json');

function envelopeSchema(agent) {
  if (agent.mode === 'generate') {
    return {
      type: 'object', additionalProperties: false, required: ['items'],
      properties: { items: { type: 'array', maxItems: agent.maxItems, items: { type: 'object' } } },
    };
  }
  const decision = {
    type: 'object', additionalProperties: false, required: ['outcome', 'reason', 'artifact'],
    properties: {
      outcome: { enum: Object.keys(agent.outcomes) },
      reason: { type: 'string', minLength: 1 },
      artifact: { type: 'object' },
    },
  };
  if (agent.mode === 'item') return decision;
  return {
    type: 'object', additionalProperties: false, required: ['decisions'],
    properties: {
      decisions: {
        type: 'array',
        items: { ...decision, required: ['itemId', ...decision.required], properties: { itemId: { type: 'string' }, ...decision.properties } },
      },
    },
  };
}

/** Strip keywords that only make sense at a schema's root, so it can be inlined. */
function inlineable(schema) {
  const { $schema, $id, ...rest } = schema;
  return rest;
}

/**
 * The full output contract (envelope with the artifact schema inlined). Passed to the runner
 * so the model gets one schema; the tick still validates envelope and artifact separately.
 */
export function outputSchema(agent, artifactSchema) {
  const envelope = structuredClone(envelopeSchema(agent));
  const artifact = inlineable(artifactSchema);
  if (agent.mode === 'generate') envelope.properties.items.items = artifact;
  else if (agent.mode === 'item') envelope.properties.artifact = artifact;
  else envelope.properties.decisions.items.properties.artifact = artifact;
  return envelope;
}

function checkTargets(agent) {
  if (agent.mode === 'generate') return;
  // Every outcome must map to a status reachable from the input status.
  const probe = { id: 'probe', type: 'new-post', status: agent.inputStatus };
  const reachable = allowedTransitions(probe);
  for (const [outcome, status] of Object.entries(agent.outcomes)) {
    if (!reachable.includes(status)) {
      throw new Error(`Agent ${agent.name}: outcome ${outcome} → ${status} is not reachable from ${agent.inputStatus}`);
    }
  }
  if (agent.loop && !(agent.loop.outcome in agent.outcomes)) {
    throw new Error(`Agent ${agent.name}: loop outcome ${agent.loop.outcome} is not an outcome`);
  }
  if (agent.maxAdvance && !(agent.maxAdvance.outcome in agent.outcomes)) {
    throw new Error(`Agent ${agent.name}: maxAdvance outcome is not an outcome`);
  }
  if (agent.maxAdvance?.overflow && !(agent.maxAdvance.overflow in agent.outcomes)) {
    throw new Error(`Agent ${agent.name}: maxAdvance overflow outcome is not an outcome`);
  }
}

export function loadAgent(name, dir = agentsDir) {
  const base = join(dir, name);
  const agent = assertValid(compileFile(definitionSchema), readJson(join(base, 'agent.json')), `${name}/agent.json`);
  if (agent.name !== name) throw new Error(`${name}/agent.json: name must match folder`);
  checkTargets(agent);
  const promptPath = join(base, 'prompt.md');
  const artifactSchemaPath = join(base, 'artifact.schema.json');
  return {
    ...agent,
    dir: base,
    promptPath: existsSync(promptPath) ? promptPath : null,
    validateEnvelope: compile(envelopeSchema(agent)),
    validateArtifact: compileFile(artifactSchemaPath),
    outputSchema: outputSchema(agent, readJson(artifactSchemaPath)),
  };
}

export function loadAgents(dir = agentsDir) {
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(dir, entry.name, 'agent.json')))
    .map((entry) => loadAgent(entry.name, dir))
    .sort((a, b) => b.priority - a.priority || a.name.localeCompare(b.name));
}
