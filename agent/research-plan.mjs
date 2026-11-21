import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { categories, indexIds, scanKnowledge } from './knowledge.mjs';

const dayMs = 86_400_000;
const runOptions = {
  record: { type: 'boolean' },
  queue: { type: 'string', default: 'agent/research-queue.json' },
  knowledge: { type: 'string', default: 'knowledge' },
  category: { type: 'string' },
  limit: { type: 'string' },
  'refresh-days': { type: 'string', default: '90' },
};

function positiveInteger(value, option) {
  const number = Number(value);
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(number) || number < 1) {
    throw new Error(`--${option} must be a positive integer`);
  }
  return number;
}

function productStatus(card, todayMs, refreshDays) {
  if (!card) return { status: 'new' };
  const dueClaims = card.claims.filter((claim) => {
    const age = (todayMs - Date.parse(claim.verifiedAt)) / dayMs;
    return age >= refreshDays;
  }).map((claim) => claim.id);
  const openClaims = card.claims
    .filter((claim) => claim.status !== 'supported')
    .map((claim) => claim.id);
  const needsReview = card.claims.length === 0 || dueClaims.length > 0;
  return { status: needsReview ? 'refresh' : 'current', dueClaims, openClaims };
}

let shouldRecord = false;
const startedAt = Date.now();

async function recordRun(status, details) {
  await mkdir('.backoffice', { recursive: true });
  const event = {
    timestamp: new Date().toISOString(),
    workflow: 'Research planner',
    status,
    durationMs: Date.now() - startedAt,
    details,
  };
  await appendFile('.backoffice/runs.jsonl', JSON.stringify(event) + '\n');
}

try {
  const { values } = parseArgs({ options: runOptions });
  shouldRecord = values.record;
  const limit = values.limit === undefined ? Infinity : positiveInteger(values.limit, 'limit');
  const refreshDays = positiveInteger(values['refresh-days'], 'refresh-days');
  if (values.category !== undefined && !categories.includes(values.category)) {
    throw new Error(`--category must be one of: ${categories.join(', ')}`);
  }
  const queue = JSON.parse(await readFile(values.queue, 'utf8'));
  if (queue?.schemaVersion !== 1) throw new Error('Expected research queue schemaVersion 1');
  indexIds(queue.products, 'candidate');
  for (const candidate of queue.products) {
    if (!categories.includes(candidate.category) || typeof candidate.name !== 'string' ||
        !candidate.name.trim() || typeof candidate.origin !== 'string' ||
        !Object.hasOwn(queue.origins ?? {}, candidate.origin)) {
      throw new Error(`Invalid category, name, or origin for candidate ${candidate.id}`);
    }
  }
  const { cards, errors } = await scanKnowledge(values.knowledge);
  if (errors.length) throw new Error(errors.join('\n'));
  const asOf = new Date().toISOString().slice(0, 10);
  const results = [];
  for (const candidate of queue.products) {
    const card = cards.get(candidate.id);
    if (card && card.category !== candidate.category) {
      throw new Error(`Queue category differs from card category for ${candidate.id}`);
    }
    if (values.category && candidate.category !== values.category) continue;
    results.push({ ...candidate, ...productStatus(card, Date.parse(asOf), refreshDays) });
  }
  const refresh = results.filter(({ status }) => status === 'refresh');
  const pending = results.filter(({ status }) => status === 'new');
  const openClaims = results
    .filter((product) => product.openClaims?.length > 0)
    .map((product) => ({ id: product.id, claimIds: product.openClaims }));
  const work = [...refresh, ...pending];
  const summary = {
    candidates: results.length,
    new: pending.length,
    refresh: refresh.length,
    current: results.length - work.length,
    productsWithOpenClaims: openClaims.length,
  };
  if (shouldRecord) await recordRun('completed', summary);
  console.log(JSON.stringify({
    asOf, refreshDays, summary, openClaims, batch: work.slice(0, limit),
  }, null, 2));
} catch (error) {
  if (shouldRecord) {
    try {
      await recordRun('failed', error.message);
    } catch (logError) {
      console.error(`Could not write run history: ${logError.message}`);
    }
  }
  console.error(error.message);
  process.exitCode = 1;
}
