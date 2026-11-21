// File-backed item store. Every write is schema-validated and atomic (temp file + rename).
import { randomUUID } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertValid, compileFile } from './validate.mjs';

const itemSchema = fileURLToPath(new URL('./schemas/item.schema.json', import.meta.url));
const validateItem = () => compileFile(itemSchema);

export function itemsDir(root) {
  return join(root, 'data', 'items');
}

export function writeTextAtomic(path, text) {
  mkdirSync(dirname(path), { recursive: true });
  const temp = `${path}.${randomUUID()}.tmp`;
  try {
    writeFileSync(temp, text, { flag: 'wx' });
    renameSync(temp, path);
  } finally {
    rmSync(temp, { force: true });
  }
}

export function writeJsonAtomic(path, value) {
  writeTextAtomic(path, JSON.stringify(value, null, 2) + '\n');
}

export function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

/** Load all items. Invalid files are reported in `errors`, never silently dropped. */
export function loadItems(root) {
  const dir = itemsDir(root);
  const items = [];
  const errors = [];
  if (!existsSync(dir)) return { items, errors };
  for (const name of readdirSync(dir).filter((n) => n.endsWith('.json')).sort()) {
    const path = join(dir, name);
    try {
      const item = assertValid(validateItem(), readJson(path), path);
      if (`${item.id}.json` !== name) throw new Error(`${path}: id must match filename`);
      items.push(item);
    } catch (error) {
      errors.push(error.message);
    }
  }
  return { items, errors };
}

export function saveItem(root, item) {
  assertValid(validateItem(), item, `item ${item.id}`);
  writeJsonAtomic(join(itemsDir(root), `${item.id}.json`), item);
  return item;
}

/** Append one event to the local run history (gitignored .backoffice/runs.jsonl). */
export function appendRun(root, event) {
  const path = join(root, '.backoffice', 'runs.jsonl');
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, JSON.stringify({ timestamp: new Date().toISOString(), ...event }) + '\n');
}

export function readRuns(root) {
  const path = join(root, '.backoffice', 'runs.jsonl');
  if (!existsSync(path)) return [];
  return readFileSync(path, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line));
}
