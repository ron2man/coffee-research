import { appendFile, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { parseArgs } from 'node:util';
import { indexIds, scanKnowledge } from './knowledge.mjs';

const catalogUrl = 'https://www.baratza.com/en-us/shop/grinders';
const queuePath = 'agent/research-queue.json';
const origin = 'baratza-us-catalog';
const market = 'US';
const started = Date.now();

function modelId(name) {
  return 'baratza-' + name.replace(/[™®]/g, '').normalize('NFD')
    .replace(/\p{M}/gu, '').toLowerCase().trim().replace(/\+/g, ' plus')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function readCatalog(html) {
  const scripts = html.matchAll(/<script\b[^>]*\btype=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  const lists = [...scripts].flatMap((match) => {
    const data = JSON.parse(match[1]);
    return Array.isArray(data) ? data : data['@graph'] ?? [data];
  }).filter((entry) => entry['@type'] === 'ItemList');
  if (lists.length !== 1) throw new Error('Expected one product list in the Baratza catalog');
  const list = lists[0];
  if (!Array.isArray(list.itemListElement) || !list.itemListElement.length ||
      list.itemListElement.length !== list.numberOfItems) {
    throw new Error('The Baratza catalog product list is empty or incomplete');
  }

  const products = list.itemListElement.map(({ name, url }) => {
    const link = new URL(url);
    if (typeof name !== 'string' || !name.trim() ||
        link.origin !== new URL(catalogUrl).origin ||
        !/^\/en-us\/product\/[a-z0-9-]+\/?$/i.test(link.pathname)) {
      throw new Error('Unexpected product entry in the Baratza catalog');
    }
    return {
      id: modelId(name),
      name: 'Baratza ' + name.replace(/[™®]/g, '').trim(),
      category: 'grinders',
      origin,
      discovery: { catalogUrl, productUrl: link.href, market },
    };
  });
  indexIds(products, 'catalog product');
  return products;
}

async function saveQueue(queue) {
  const temp = `${queuePath}.${randomUUID()}.tmp`;
  try {
    const metadata = JSON.stringify({ ...queue, products: [] }, null, 2);
    const rows = queue.products.map((item) => '    ' + JSON.stringify(item));
    const contents = metadata.replace('"products": []', () => '"products": [\n' + rows.join(',\n') + '\n  ]');
    await writeFile(temp, contents + '\n', { flag: 'wx' });
    await rename(temp, queuePath);
  } finally {
    await rm(temp, { force: true });
  }
}

async function plan(products, apply) {
  const queue = JSON.parse(await readFile(queuePath, 'utf8'));
  if (queue.schemaVersion !== 1) throw new Error('Expected research queue schemaVersion 1');
  indexIds(queue.products, 'candidate');
  const queued = new Map(queue.products.map((item) => [item.id, item]));
  const { cards, errors } = await scanKnowledge('knowledge');
  if (errors.length) throw new Error(errors.join('\n'));

  const added = [];
  const known = [];
  const variantLeads = [];
  for (const item of products) {
    const card = cards.get(item.id);
    const candidate = queued.get(item.id);
    if ((card && card.category !== item.category) || (candidate && candidate.category !== item.category)) {
      throw new Error(`Category conflict for ${item.id}`);
    }
    if (card || candidate) {
      known.push(item.id);
      if (card?.variants.length && !card.variants.some((variant) => variant.markets.includes(market))) {
        variantLeads.push({ id: item.id, ...item.discovery });
      }
    } else {
      added.push(item);
    }
  }

  if (apply && added.length) {
    queue.origins[origin] = 'Official Baratza US grinder catalog';
    queue.products.push(...added);
    await saveQueue(queue);
  }
  return { catalogUrl, mode: apply ? 'apply' : 'preview', added, known, variantLeads };
}

async function record(status, details) {
  await mkdir('.backoffice', { recursive: true });
  await appendFile('.backoffice/runs.jsonl', JSON.stringify({
    timestamp: new Date().toISOString(),
    workflow: 'Baratza product discovery',
    status,
    durationMs: Date.now() - started,
    details,
  }) + '\n');
}

let apply = false;
try {
  const { values } = parseArgs({ options: { apply: { type: 'boolean' }, html: { type: 'string' } } });
  apply = values.apply;
  const response = values.html ? null : await fetch(catalogUrl, { signal: AbortSignal.timeout(20_000) });
  if (response && (!response.ok || response.url !== catalogUrl)) {
    throw new Error(`Unexpected catalog response: HTTP ${response.status}`);
  }
  const products = readCatalog(values.html ? await readFile(values.html, 'utf8') : await response.text());
  let report;
  if (apply) {
    await mkdir('.backoffice', { recursive: true });
    const lock = '.backoffice/discovery.lock';
    await mkdir(lock);
    try {
      report = await plan(products, true);
      await record('completed', report);
    } finally {
      await rm(lock, { recursive: true });
    }
  } else {
    report = await plan(products, false);
  }
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  if (apply) {
    try {
      await record('failed', error.message);
    } catch (logError) {
      console.error(`Could not write run history: ${logError.message}`);
    }
  }
  console.error(error.message);
  process.exitCode = 1;
}
