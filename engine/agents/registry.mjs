// Loads agent definitions and builds the validators for their outputs.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readJson } from '../state/store.mjs';
import { assertValid, compile, compileFile } from '../state/validate.mjs';
import { allowedTransitions } from '../state/machine.mjs';

export const agentsDir = fileURLToPath(new URL('./', import.meta.url));
const definitionSchema = join(agentsDir, 'agent.schema.json');

function envelopeSchema(agent) {
  if (agent.mode === 'review' || agent.mode === 'tune') {
    return { type: 'object', additionalProperties: false, required: ['artifact'], properties: { artifact: { type: 'object' } } };
  }
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
  else if (['item', 'review', 'tune'].includes(agent.mode)) envelope.properties.artifact = artifact;
  else envelope.properties.decisions.items.properties.artifact = artifact;
  return envelope;
}

function checkTargets(agent) {
  if (['generate', 'review', 'tune'].includes(agent.mode)) return;
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

/**
 * The full system instructions for a run: the agent's prompt.md, then niche guidance
 * (niches/<niche>/agents/<agent>.md) and any niche files the agent lists in `nicheFiles`.
 */
export function instructionsFor(agent, root, nicheId) {
  if (!agent.promptPath) return null;
  const parts = [readFileSync(agent.promptPath, 'utf8')];
  const nicheDir = join(root, 'niches', nicheId);
  const guidance = join(nicheDir, 'agents', `${agent.name}.md`);
  if (existsSync(guidance)) parts.push(`# Niche guidance (${nicheId})\n\n${readFileSync(guidance, 'utf8')}`);
  for (const file of agent.nicheFiles ?? []) {
    const path = join(nicheDir, file);
    if (!existsSync(path)) throw new Error(`Agent ${agent.name}: niche file ${file} not found in ${nicheDir}`);
    parts.push(`# Niche file: ${file}\n\n${readFileSync(path, 'utf8')}`);
  }
  return parts.join('\n\n---\n\n');
}

/** Agents that produce pipeline output (and so can be reviewed and tuned). */
export const isPipelineAgent = (agent) => ['generate', 'batch', 'item'].includes(agent.mode);

export function loadAgents(dir = agentsDir) {
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(dir, entry.name, 'agent.json')))
    .map((entry) => loadAgent(entry.name, dir))
    .sort((a, b) => b.priority - a.priority || a.name.localeCompare(b.name));
}
