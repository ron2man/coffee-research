// Seeds: topic hints from a human for the idea agent ("I own an entry-level machine and want better
// results"). A seed is a hypothesis, not demand: the idea agent turns it into a card only when it
// finds real people asking. data/seeds/<id>.json, committed like other internal state.
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { readJson, writeJsonAtomic } from './store.mjs';

export const SEEDS_DIR = 'data/seeds';
export const MAX_CONSIDERED = 3; // idea runs without a card before a seed is closed as no-demand

const slug = (text) => text.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'seed';

export function listSeeds(root) {
  const dir = join(root, SEEDS_DIR);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((n) => n.endsWith('.json')).sort().map((n) => readJson(join(dir, n)));
}

export const openSeeds = (root) => listSeeds(root).filter((seed) => seed.status === 'open');

export function addSeed(root, { text, note = '', by = 'human', at = new Date().toISOString() }) {
  if (!text?.trim()) throw new Error('Write the seed as the argument, e.g. npm run seed -- add "..."');
  const taken = new Set(listSeeds(root).map((s) => s.id));
  let id = `${at.slice(0, 10)}-${slug(text)}`;
  for (let n = 2; taken.has(id); n += 1) id = `${at.slice(0, 10)}-${slug(text)}-${n}`;
  const seed = { id, text: text.trim(), note: note.trim(), by, at, status: 'open', considered: 0, itemIds: [] };
  const path = `${SEEDS_DIR}/${id}.json`;
  writeJsonAtomic(join(root, path), seed);
  return path;
}

/**
 * After an idea run: seeds that produced cards become `used`; the rest of the seeds that were in
 * the input count one more consideration and close as `no-demand` after MAX_CONSIDERED runs.
 */
export function settleSeeds(root, offered, cards, notes = []) {
  const written = [];
  for (const seed of offered) {
    const itemIds = cards.filter((card) => card.seedId === seed.id).map((card) => card.id);
    const why = notes.find((n) => n.seedId === seed.id)?.why ?? (itemIds.length ? 'became a card' : 'no reason given');
    const next = { ...seed, considered: seed.considered + 1, itemIds: [...seed.itemIds, ...itemIds], attempts: [...(seed.attempts ?? []), { at: new Date().toISOString(), cards: itemIds, why }] };
    if (itemIds.length) next.status = 'used';
    else if (next.considered >= MAX_CONSIDERED) next.status = 'no-demand';
    const path = `${SEEDS_DIR}/${seed.id}.json`;
    writeJsonAtomic(join(root, path), next);
    written.push(path);
  }
  return written;
}

export function closeSeed(root, id, { reason }) {
  const seed = listSeeds(root).find((s) => s.id === id);
  if (!seed) throw new Error(`No seed ${id}`);
  const path = `${SEEDS_DIR}/${id}.json`;
  writeJsonAtomic(join(root, path), { ...seed, status: 'closed', closedReason: reason ?? '' });
  return path;
}
