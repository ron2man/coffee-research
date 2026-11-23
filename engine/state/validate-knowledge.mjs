#!/usr/bin/env node
// Validates every knowledge card: node engine/state/validate-knowledge.mjs [knowledgeDir]
import { resolve } from 'node:path';
import { categoryIds, defaultNicheId, loadNiche, repoRoot } from './niche.mjs';
import { scanKnowledge } from './knowledge.mjs';

try {
  const categories = categoryIds(loadNiche(defaultNicheId(repoRoot), repoRoot));
  const { cards, errors } = await scanKnowledge(resolve(process.argv[2] ?? `${repoRoot}/knowledge`), categories);
  for (const error of errors) console.error(error);
  console.log(`Validated ${cards.size} product cards. Invalid cards: ${errors.length}.`);
  process.exitCode = errors.length > 0 ? 1 : 0;
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
