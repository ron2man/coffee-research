#!/usr/bin/env node
// npm run library -- add --product <id> --market US[,GB] --kind manual --url https://... [--title "..."] [--notes "..."]
// npm run library -- list [--product <id>]
// npm run library -- check
// Adds the document's text to library/docs/ and its record to library/index.json. Commit those.
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { categoryIds, defaultNicheId, loadNiche, repoRoot } from '../state/niche.mjs';
import { loadCardsSync } from '../state/knowledge.mjs';
import { addDocument, libraryProblems, readIndex } from './library.mjs';

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { values, positionals } = parseArgs({
      allowPositionals: true,
      options: { product: { type: 'string' }, market: { type: 'string' }, kind: { type: 'string' }, url: { type: 'string' }, title: { type: 'string' }, notes: { type: 'string' }, root: { type: 'string' } },
    });
    const root = values.root ? resolve(values.root) : repoRoot;
    const [command] = positionals;
    if (command === 'add') {
      const entry = await addDocument(root, { productId: values.product, markets: (values.market ?? '').split(',').filter(Boolean), kind: values.kind, url: values.url, title: values.title, notes: values.notes });
      console.log(`Added ${entry.productId}/${entry.id}: ${entry.format}${entry.pages ? `, ${entry.pages} pages` : ''} → ${entry.mdPath}`);
    } else if (command === 'list') {
      for (const d of readIndex(root).documents.filter((d) => !values.product || d.productId === values.product)) {
        console.log(`${d.productId}\t${d.kind}\t${d.markets.join(',')}\t${d.pages ?? '-'}p\t${d.title}\t${d.url}`);
      }
    } else if (command === 'check') {
      const { cards } = loadCardsSync(`${root}/knowledge`, categoryIds(loadNiche(defaultNicheId(root), root)));
      const problems = libraryProblems(root, { cards });
      for (const p of problems) console.log(p);
      console.log(`${readIndex(root).documents.length} documents, ${problems.length} notes.`);
    } else {
      throw new Error('Usage: npm run library -- add|list|check (see engine/library/cli.mjs)');
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
