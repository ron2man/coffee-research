// Legacy entry point. The implementation lives in engine/state/knowledge.mjs.
import { categoryIds, loadNiche } from '../engine/state/niche.mjs';
import { scanKnowledge as scan } from '../engine/state/knowledge.mjs';

export { indexIds, validateCard } from '../engine/state/knowledge.mjs';

// Categories come from niches/<niche>/niche.json (NICHE env var, or the only niche).
export const categories = categoryIds(loadNiche());

export function scanKnowledge(root, categoryList = categories) {
  return scan(root, categoryList);
}
