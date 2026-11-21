import { readFile, readdir } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { categoryIds, loadNiche } from '../engine/state/niche.mjs';

// Categories come from niches/<niche>/niche.json (NICHE env var, default coffee).
export const categories = categoryIds(loadNiche());
const sourceTypes = ['manufacturer', 'professional-test', 'owner-report', 'merchant'];

function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

function nonempty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function indexIds(records, label) {
  requireCondition(Array.isArray(records), `${label} must be an array`);
  const ids = new Set();
  for (const record of records) {
    requireCondition(
      typeof record?.id === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(record.id),
      `Invalid ID in ${label}`,
    );
    requireCondition(!ids.has(record.id), `Duplicate ${label} ID: ${record.id}`);
    ids.add(record.id);
  }
  return ids;
}

function validateCard(markdown, category, filename) {
  const blocks = [...markdown.matchAll(/^```json\r?\n([\s\S]*?)^```[ \t]*\r?$/gm)];
  requireCondition(blocks.length === 1, 'Expected exactly one fenced JSON block');
  const card = JSON.parse(blocks[0][1]);

  requireCondition(card?.schemaVersion === 1, 'Expected schemaVersion 1');
  requireCondition(card.id === basename(filename, '.md'), 'Product ID must match filename');
  indexIds([card], 'product');
  requireCondition(card.category === category, 'Category must match directory');
  requireCondition(nonempty(card.name) && isDate(card.updatedAt), 'Invalid name or updatedAt');

  const variantIds = indexIds(card.variants, 'variant');
  const sourceIds = indexIds(card.sources, 'source');
  indexIds(card.claims, 'claim');
  requireCondition(sourceIds.size > 0, 'Expected at least one source');

  for (const variant of card.variants) {
    requireCondition(
      Array.isArray(variant.markets) && variant.markets.length > 0 &&
        variant.markets.every((market) => typeof market === 'string' && /^[A-Z]{2}$/.test(market)),
      `Invalid markets for variant ${variant.id}`,
    );
  }

  for (const source of card.sources) {
    const url = typeof source.url === 'string' ? URL.parse(source.url) : null;
    requireCondition(
      ['https:', 'http:'].includes(url?.protocol) && sourceTypes.includes(source.type) &&
        isDate(source.accessedAt),
      `Invalid source metadata for ${source.id}`,
    );
  }

  for (const claim of card.claims) {
    const label = `Claim ${claim.id}`;
    requireCondition(
      nonempty(claim.statement) && isDate(claim.verifiedAt) && claim.verifiedAt <= card.updatedAt,
      `${label} has an invalid statement or verification date`,
    );
    requireCondition(
      claim.variantId === undefined || variantIds.has(claim.variantId),
      `${label} references an unknown variant`,
    );
    requireCondition(
      ['supported', 'disputed', 'unknown'].includes(claim.status) && Array.isArray(claim.evidence),
      `${label} has an invalid status or evidence list`,
    );

    const evidenceSources = new Set();
    for (const evidence of claim.evidence) {
      requireCondition(
        sourceIds.has(evidence?.sourceId) && nonempty(evidence.locator),
        `${label} references missing evidence or has no locator`,
      );
      evidenceSources.add(evidence.sourceId);
    }
    if (claim.status === 'supported') {
      requireCondition(evidenceSources.size > 0, `${label} requires supporting evidence`);
    } else {
      requireCondition(nonempty(claim.note), `${label} requires a note about the evidence gap or dispute`);
      if (claim.status === 'disputed') {
        requireCondition(evidenceSources.size >= 2, `${label} requires two distinct sources`);
      }
    }
  }

  return card;
}

export async function scanKnowledge(root, categoryList = categories) {
  const cards = new Map();
  const errors = [];
  for (const category of categoryList) {
    const directory = join(root, category);
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch (error) {
      if (error.code === 'ENOENT') continue; // A configured category may have no cards yet.
      throw error;
    }
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
      const path = join(directory, entry.name);
      try {
        const card = validateCard(await readFile(path, 'utf8'), category, entry.name);
        requireCondition(!cards.has(card.id), `Duplicate product ID: ${card.id}`);
        cards.set(card.id, card);
      } catch (error) {
        errors.push(`${path}: ${error.message}`);
      }
    }
  }
  return { cards, errors };
}
