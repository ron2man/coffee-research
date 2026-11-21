import { readFileSync } from 'node:fs';
import { assessTopic } from './topic-gate.mjs';
import { claimEvidence, loadCards } from './review-inputs.mjs';

if (!process.argv[2]) throw new Error('Usage: node agent/check-topic.mjs <draft-slug> [...]');
const cards = await loadCards();
for (const slug of process.argv.slice(2)) {
  if (!/^[a-z0-9-]+$/.test(slug)) throw new Error('Invalid slug');
  const brief = readFileSync('content/archive/drafts/' + slug + '.brief.md', 'utf8');
  console.log(JSON.stringify({ slug, ...assessTopic(brief, claimEvidence(brief, cards)) }, null, 2));
}
