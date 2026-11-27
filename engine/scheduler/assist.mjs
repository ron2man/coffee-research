// Assist agents work on an item without moving its status. Today: the toolsmith builds the
// interactive tools (pickers / troubleshooters) a brief or draft asks for, before the writer
// writes (or rewrites) the post.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { readJson, saveItem, writeJsonAtomic } from '../state/store.mjs';
import { listTools, toolProblems, TOOLS_DIR } from '../state/tools.mjs';

const read = (root, item, name) => (item.artifacts[name] && existsSync(join(root, item.artifacts[name])) ? readJson(join(root, item.artifacts[name])) : null);

/** Tool ids an item needs that don't exist yet and that the toolsmith hasn't declined. */
export function missingTools(root, item, { agentName = 'toolsmith', existing = new Set(listTools(root).map((t) => t.id)) } = {}) {
  const wanted = new Set([...(read(root, item, 'angle')?.assets ?? []), ...(read(root, item, 'writer')?.tools ?? [])]);
  const declined = new Set((read(root, item, agentName)?.skipped ?? []).map((s) => s.id));
  return [...wanted].filter((id) => !existing.has(id) && !declined.has(id));
}

/** Items in the agent's input status that need tools, oldest first. */
export function assistCandidates({ agent, root, items }) {
  const existing = new Set(listTools(root).map((t) => t.id));
  return items
    .filter((item) => item.status === agent.inputStatus)
    .map((item) => ({ target: item.id, item, missing: missingTools(root, item, { agentName: agent.name, existing }) }))
    .filter((c) => c.missing.length)
    .sort((a, b) => a.item.updatedAt.localeCompare(b.item.updatedAt));
}

export function buildAssistInput({ root, niche, agent, candidate }) {
  const { item } = candidate;
  return {
    niche,
    today: new Date().toISOString().slice(0, 10),
    item: { id: item.id, status: item.status },
    missingTools: candidate.missing,
    artifacts: Object.fromEntries((agent.inputArtifacts ?? []).map((name) => [name, read(root, item, name)]).filter(([, v]) => v)),
    exampleTool: listTools(root)[0] ?? null,
  };
}

/** Returns a problem string, or null. */
export function checkAssistArtifact(artifact, input, { cards, markets }) {
  const asked = new Set(input.missingTools);
  const answered = [...artifact.tools.map((t) => t.id), ...artifact.skipped.map((s) => s.id)];
  const unknown = answered.filter((id) => !asked.has(id));
  if (unknown.length) return `answered tools that weren't asked for: ${unknown.join(', ')}`;
  const unanswered = [...asked].filter((id) => !answered.includes(id));
  if (unanswered.length) return `must build or skip every missing tool (${unanswered.join(', ')})`;
  for (const tool of artifact.tools) {
    const problems = toolProblems(tool, { cards, markets });
    if (problems.length) return `tool ${tool.id}: ${problems.join('; ')}`;
  }
  return null;
}

export function applyAssist({ root, agent, candidate, artifact, written }) {
  for (const tool of artifact.tools) {
    const path = `${TOOLS_DIR}/${tool.id}.json`;
    writeJsonAtomic(join(root, path), tool);
    written.push(path);
  }
  const path = `${agent.artifactDir}/${candidate.item.id}.json`;
  const previous = read(root, candidate.item, agent.name);
  // Keep earlier declines so the same tool isn't asked for again.
  const merged = { tools: [...(previous?.tools ?? []), ...artifact.tools], skipped: [...(previous?.skipped ?? []), ...artifact.skipped] };
  writeJsonAtomic(join(root, path), merged);
  const item = { ...candidate.item, artifacts: { ...candidate.item.artifacts, [agent.name]: path }, updatedAt: new Date().toISOString() };
  saveItem(root, item);
  written.push(path, `data/items/${item.id}.json`);
  return { target: item.id, built: artifact.tools.map((t) => t.id), skipped: artifact.skipped.map((s) => s.id) };
}
