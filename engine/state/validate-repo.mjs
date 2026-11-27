#!/usr/bin/env node
// Validates niche config, agent definitions, the item store and every artifact an item references.
//   node engine/state/validate-repo.mjs [root]
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { loadAgents } from '../agents/registry.mjs';
import { defaultNicheId, loadNiche, repoRoot } from './niche.mjs';
import { loadItems, readJson } from './store.mjs';
import { libraryProblems } from '../library/library.mjs';

export function validateRepo(root = repoRoot) {
  const errors = [];
  let agents = [];
  try {
    loadNiche(defaultNicheId(root), root);
  } catch (error) {
    errors.push(error.message);
  }
  try {
    agents = loadAgents();
  } catch (error) {
    errors.push(error.message);
  }
  const byName = new Map(agents.map((agent) => [agent.name, agent]));
  const { items, errors: itemErrors } = loadItems(root);
  errors.push(...itemErrors);
  for (const item of items) {
    for (const [name, path] of Object.entries(item.artifacts)) {
      const agent = byName.get(name);
      const full = join(root, path);
      if (!agent) errors.push(`${item.id}: artifact from unknown agent ${name}`);
      else if (!existsSync(full)) errors.push(`${item.id}: missing artifact ${path}`);
      else if (!agent.validateArtifact(readJson(full))) {
        errors.push(`${item.id}: ${path} does not match ${name} artifact schema`);
      }
    }
  }
  errors.push(...libraryProblems(root).filter((p) => !/no knowledge card/.test(p)));
  return { agents: agents.length, items: items.length, errors };
}

if (import.meta.url === `file://${resolve(process.argv[1] ?? '')}`) {
  const result = validateRepo(process.argv[2] ? resolve(process.argv[2]) : repoRoot);
  for (const error of result.errors) console.error(error);
  console.log(`Validated ${result.agents} agents and ${result.items} items. Errors: ${result.errors.length}.`);
  process.exitCode = result.errors.length ? 1 : 0;
}
