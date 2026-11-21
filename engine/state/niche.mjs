// Loads niches/<id>/niche.json. The engine never hard-codes niche values.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertValid, compileFile } from './validate.mjs';

export const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const schemaPath = fileURLToPath(new URL('./schemas/niche.schema.json', import.meta.url));

/** NICHE env var, or the only folder in niches/. Ambiguity is an error, not a guess. */
export function defaultNicheId(root = repoRoot) {
  if (process.env.NICHE) return process.env.NICHE;
  const niches = readdirSync(join(root, 'niches'), { withFileTypes: true }).filter((entry) => entry.isDirectory());
  if (niches.length !== 1) throw new Error(`Set NICHE: found ${niches.length} folders in niches/`);
  return niches[0].name;
}

export function loadNiche(id = defaultNicheId(), root = repoRoot) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) throw new Error(`Invalid niche id: ${id}`);
  const path = join(root, 'niches', id, 'niche.json');
  const niche = assertValid(compileFile(schemaPath), JSON.parse(readFileSync(path, 'utf8')), path);
  if (niche.id !== id) throw new Error(`${path}: id must be "${id}"`);
  return niche;
}

export function categoryIds(niche) {
  return niche.categories.map((category) => category.id);
}
