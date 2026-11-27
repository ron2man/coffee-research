// Document library: manufacturer manuals, spec sheets, support and parts pages, stored locally so
// agents read them instead of searching the web. Text versions (Markdown with page markers) are
// committed (private repo); original PDFs stay in library/pdf/ (gitignored, large).
//   library/index.json                       what we have, where it came from
//   library/docs/<productId>/<docId>.md      text with "--- page N ---" markers, for page citations
//   library/pdf/<productId>/<docId>.pdf      the original file (not in Git)
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { readJson, writeJsonAtomic, writeTextAtomic } from '../state/store.mjs';

export const LIBRARY_DIR = 'library';
export const INDEX_PATH = `${LIBRARY_DIR}/index.json`;
export const KINDS = ['manual', 'quick-start', 'spec-sheet', 'support', 'parts', 'recall'];
// Manual mirror sites: copies of unknown provenance. Use the manufacturer's own copy.
export const MIRROR_HOSTS = ['manualslib.com', 'manualzz.com', 'manua.ls', 'manualsdir.com', 'device.report', 'manualmachine.com', 'manualsonline.com', 'usermanual.wiki', 'notice-facile.com', 'archive.org'];

const slug = (text) => text.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'doc';

export function readIndex(root) {
  const path = join(root, INDEX_PATH);
  return existsSync(path) ? readJson(path) : { schemaVersion: 1, documents: [] };
}

/** PDF text (pages separated by form feeds, as pdftotext prints them) → Markdown with page markers. */
export function pdfTextToMarkdown(text) {
  const pages = text.split('\f').map((page) => page.replace(/[ \t]+$/gm, '').replace(/\n{3,}/g, '\n\n').trim());
  while (pages.length && !pages.at(-1)) pages.pop();
  return { pages: pages.length, body: pages.map((page, i) => `--- page ${i + 1} ---\n\n${page}`).join('\n\n') };
}

const entities = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', ndash: '–', mdash: '—', deg: '°', trade: '™', reg: '®' };
const decode = (s) => s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e) => (e[0] === '#' ? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : entities[e.toLowerCase()] ?? m));

/** HTML page → readable Markdown-ish text (headings, lists, paragraphs, tables as rows). */
export function htmlToMarkdown(html) {
  const main = html.match(/<main[\s\S]*?<\/main>/i)?.[0] ?? html.match(/<article[\s\S]*?<\/article>/i)?.[0] ?? html;
  const text = main
    .replace(/<(script|style|noscript|svg|nav|header|footer|form|iframe)[\s\S]*?<\/\1>/gi, '')
    .replace(/<h([1-4])[^>]*>([\s\S]*?)<\/h\1>/gi, (_, n, t) => `\n\n${'#'.repeat(Number(n) + 1)} ${t.replace(/<[^>]+>/g, '').trim()}\n\n`)
    .replace(/<li[^>]*>/gi, '\n- ')
    .replace(/<\/(p|div|section|tr|ul|ol|table|h\d)>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/t[dh]>/gi, ' | ')
    .replace(/<[^>]+>/g, '');
  return decode(text).replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

export function checkUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Not a URL: ${url}`);
  }
  if (parsed.protocol !== 'https:') throw new Error('Use the https URL');
  const host = parsed.hostname.replace(/^www\./, '');
  if (MIRROR_HOSTS.some((m) => host === m || host.endsWith(`.${m}`))) throw new Error(`${host} is a manual mirror; use the manufacturer's own copy`);
  return parsed;
}

function pdfToText(pdfPath) {
  const result = spawnSync('pdftotext', ['-layout', '-enc', 'UTF-8', pdfPath, '-'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (result.error?.code === 'ENOENT') throw new Error('pdftotext is not installed (brew install poppler)');
  if (result.status !== 0) throw new Error(`pdftotext failed: ${result.stderr.trim()}`);
  return result.stdout;
}

/**
 * Download a document and add it to the library. Returns the index entry.
 * options: { productId, markets: ['US'], kind, url, title, notes, fetchImpl, pdfText, now }
 */
export async function addDocument(root, { productId, markets, kind, url, title, notes = '', fetchImpl = fetch, pdfText = pdfToText, now = new Date() }) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(productId ?? '')) throw new Error('--product must be a kebab-case product id');
  if (!KINDS.includes(kind)) throw new Error(`--kind must be one of ${KINDS.join(', ')}`);
  if (!markets?.length || !markets.every((m) => /^[A-Z]{2}$/.test(m))) throw new Error('--market must be like US or US,GB');
  checkUrl(url);
  const index = readIndex(root);
  if (index.documents.some((d) => d.url === url && d.productId === productId)) throw new Error(`Already in the library: ${url}`);

  let response;
  try {
    response = await fetchImpl(url, { redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) research-library/1.0' }, signal: AbortSignal.timeout(60_000) });
  } catch (error) {
    throw new Error(`Download failed: ${error.cause?.code ?? error.cause?.message ?? error.message}`);
  }
  if (!response.ok) throw new Error(`Download failed: HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const isPdf = bytes.subarray(0, 5).toString('latin1') === '%PDF-';
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  if (index.documents.some((d) => d.sha256 === sha256 && d.productId === productId)) throw new Error('This exact file is already in the library for this product');

  const docId = `${kind}-${markets.join('-').toLowerCase()}-${slug(title ?? new URL(url).pathname.split('/').filter(Boolean).at(-1) ?? 'doc')}`;
  const mdPath = `${LIBRARY_DIR}/docs/${productId}/${docId}.md`;
  const pdfPath = isPdf ? `${LIBRARY_DIR}/pdf/${productId}/${docId}.pdf` : null;
  let converted;
  if (isPdf) {
    mkdirSync(dirname(join(root, pdfPath)), { recursive: true });
    writeFileSync(join(root, pdfPath), bytes);
    converted = pdfTextToMarkdown(pdfText(join(root, pdfPath)));
  } else {
    converted = { pages: null, body: htmlToMarkdown(bytes.toString('utf8')) };
  }
  if (converted.body.replace(/--- page \d+ ---/g, '').trim().length < 200) {
    throw new Error('Almost no text came out (a scanned PDF or a page that needs JavaScript). Not added.');
  }
  const entry = {
    id: docId, productId, kind, markets, title: title ?? docId, url, finalUrl: response.url || url,
    format: isPdf ? 'pdf' : 'html', pages: converted.pages, sha256, bytes: bytes.length,
    retrievedAt: now.toISOString().slice(0, 10), mdPath, pdfPath, notes,
  };
  const header = [`# ${entry.title}`, '', `- Product: ${productId}`, `- Kind: ${kind}`, `- Markets: ${markets.join(', ')}`, `- Source: ${url}`, `- Retrieved: ${entry.retrievedAt}`, ...(converted.pages ? [`- Pages: ${converted.pages} (cite as "p. N")`] : []), '', ''].join('\n');
  writeTextAtomic(join(root, mdPath), `${header}${converted.body}\n`);
  index.documents.push(entry);
  index.documents.sort((a, b) => a.productId.localeCompare(b.productId) || a.id.localeCompare(b.id));
  writeJsonAtomic(join(root, INDEX_PATH), index);
  return entry;
}

/** Problems with the library: missing files, duplicate ids, unknown products (when cards given). */
export function libraryProblems(root, { cards } = {}) {
  const problems = [];
  const seen = new Set();
  for (const doc of readIndex(root).documents) {
    const key = `${doc.productId}/${doc.id}`;
    if (seen.has(key)) problems.push(`duplicate document ${key}`);
    seen.add(key);
    if (!existsSync(join(root, doc.mdPath))) problems.push(`${key}: missing ${doc.mdPath}`);
    if (cards && !cards.has(doc.productId)) problems.push(`${key}: no knowledge card for ${doc.productId} yet (research can create one)`);
  }
  return problems;
}

/** Short listing for agents: what's in the library and where. */
export function libraryCatalog(root) {
  return readIndex(root).documents.map(({ id, productId, kind, markets, title, pages, mdPath, retrievedAt }) => ({ id, productId, kind, markets, title, pages, mdPath, retrievedAt }));
}

export const readDoc = (root, doc) => readFileSync(join(root, doc.mdPath), 'utf8');
