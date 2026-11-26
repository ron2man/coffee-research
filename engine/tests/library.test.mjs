import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { addDocument, checkUrl, htmlToMarkdown, libraryCatalog, libraryProblems, pdfTextToMarkdown } from '../library/library.mjs';

function sandbox(t) {
  const root = mkdtempSync(join(tmpdir(), 'library-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}
const longText = (n) => 'Adjust the grind one step at a time. '.repeat(n);

test('PDF text becomes Markdown with page markers', () => {
  const { pages, body } = pdfTextToMarkdown(`Page one   \n\n\n\ntext\fPage two\f`);
  assert.equal(pages, 2);
  assert.equal(body, '--- page 1 ---\n\nPage one\n\ntext\n\n--- page 2 ---\n\nPage two');
});

test('HTML pages keep headings, lists and text, drop scripts and navigation', () => {
  const md = htmlToMarkdown('<nav>Menu</nav><main><h1>Descaling</h1><p>Fill the tank &amp; start.</p><ul><li>Step one</li></ul><script>x()</script></main>');
  assert.match(md, /^## Descaling/m);
  assert.match(md, /Fill the tank & start\./);
  assert.match(md, /^- Step one/m);
  assert.doesNotMatch(md, /Menu|x\(\)/);
});

test('only https manufacturer copies, never manual mirrors', () => {
  assert.throws(() => checkUrl('http://example.com/a.pdf'), /https/);
  assert.throws(() => checkUrl('https://www.manualslib.com/manual/1.html'), /mirror/);
  assert.ok(checkUrl('https://assets.example.com/manual.pdf'));
});

test('add: a PDF is stored (original outside Git), converted, indexed; duplicates refused', async (t) => {
  const root = sandbox(t);
  const pdf = Buffer.from('%PDF-1.7 fake');
  const fetchImpl = async () => ({ ok: true, url: 'https://assets.example.com/m.pdf', arrayBuffer: async () => pdf });
  const entry = await addDocument(root, { productId: 'machine-a', markets: ['US'], kind: 'manual', url: 'https://assets.example.com/m.pdf', title: 'Machine A manual', fetchImpl, pdfText: () => `${longText(10)}\f${longText(10)}` });
  assert.equal(entry.pages, 2);
  assert.equal(entry.pdfPath, 'library/pdf/machine-a/manual-us-machine-a-manual.pdf');
  const md = readFileSync(join(root, entry.mdPath), 'utf8');
  assert.match(md, /^# Machine A manual/);
  assert.match(md, /Source: https:\/\/assets\.example\.com\/m\.pdf/);
  assert.match(md, /--- page 2 ---/);
  assert.equal(libraryCatalog(root)[0].mdPath, entry.mdPath);
  await assert.rejects(addDocument(root, { productId: 'machine-a', markets: ['US'], kind: 'manual', url: 'https://assets.example.com/m.pdf', fetchImpl, pdfText: () => longText(20) }), /Already in the library/);
  assert.deepEqual(libraryProblems(root), []);
  assert.deepEqual(libraryProblems(root, { cards: new Map() }), ['machine-a/manual-us-machine-a-manual: no knowledge card for machine-a yet (research can create one)']);
});

test('add: a page with almost no text (scanned PDF, JavaScript page) is refused', async (t) => {
  const root = sandbox(t);
  const fetchImpl = async () => ({ ok: true, url: 'https://x.example.com/p', arrayBuffer: async () => Buffer.from('<html><body><div id="app"></div></body></html>') });
  await assert.rejects(addDocument(root, { productId: 'machine-a', markets: ['GB'], kind: 'support', url: 'https://x.example.com/p', fetchImpl }), /Almost no text/);
});
