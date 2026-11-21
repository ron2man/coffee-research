import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { scanKnowledge } from './knowledge.mjs';
import { renderCandidate } from '../site/article.mjs';

const root = new URL('../', import.meta.url);
function read(path) { return readFileSync(new URL(path, root), 'utf8'); }

export async function loadCards() {
  const { cards, errors } = await scanKnowledge(fileURLToPath(new URL('knowledge/', root)));
  if (errors.length) throw new Error(errors.join('\n'));
  return cards;
}

export function claimEvidence(brief, cards, required = true) {
  const refs = [...new Set([...brief.matchAll(/`([a-z0-9-]+\/[a-z0-9-]+)`/g)].map(match => match[1]))].sort();
  if (required && !refs.length) throw new Error('Brief needs supported product/claim references');
  return refs.map(ref => {
    const [id, claimId] = ref.split('/');
    const card = cards.get(id);
    const claim = card?.claims.find(item => item.id === claimId);
    if (claim?.status !== 'supported') throw new Error('Unresolved or unsupported claim ' + ref);
    return { ref, product: card.name, variant: card.variants.find(v => v.id === claim.variantId),
      claim, sources: card.sources.filter(s => claim.evidence.some(e => e.sourceId === s.id)) };
  });
}

export function reviewInputs(slug, cards) {
  if (!/^[a-z0-9-]+$/.test(slug)) throw new Error('Invalid slug');
  const draft = read('content/drafts/' + slug + '.md');
  const brief = read('content/drafts/' + slug + '.brief.md');
  const evidence = claimEvidence(brief, cards);
  const decisionPath = 'content/opportunities/' + slug + '.json';
  const commission = existsSync(new URL(decisionPath, root)) ? JSON.parse(read(decisionPath)) : null;
  const page = renderCandidate(draft);
  const rubric = read('agent/editorial-judge.md');
  const skill = read('agent/skills/coffee-seo/SKILL.md');
  const fingerprint = createHash('sha256').update(JSON.stringify([draft, brief, evidence,
    page, commission, rubric, skill, read('agent/judge-editorial.mjs')])).digest('hex');
  return { draft, brief, evidence, page, commission, rubric, skill, fingerprint };
}

export function matchesReview(slug, review, inputs) {
  return review?.draft === 'content/drafts/' + slug + '.md' &&
    review.brief === 'content/drafts/' + slug + '.brief.md' && review.fingerprint === inputs.fingerprint;
}
