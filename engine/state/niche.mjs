// Loads niches/<id>/niche.json. The engine never hard-codes niche values.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertValid, compileFile } from './validate.mjs';

export const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const schemaPath = fileURLToPath(new URL('./schemas/niche.schema.json', import.meta.url));

export function defaultNicheId() {
  return process.env.NICHE ?? 'coffee';
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
