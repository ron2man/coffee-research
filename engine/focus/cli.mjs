#!/usr/bin/env node
// The live focus (data/focus/state.json): which products the idea agent starts from.
//   npm run focus -- show                      active, covered and excluded products, last changes
//   npm run focus -- undo [--commit]           undo the last change (what it added is excluded)
//   npm run focus -- allow <id> [--commit]     let an excluded product be chosen again
//   npm run focus -- review [--commit]         run a review now (network: search autocomplete)
// Pin or exclude products for good in niche.json (focus.pinned, focus.exclude).
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { userInfo } from 'node:os';
import { categoryIds, defaultNicheId, loadNiche, repoRoot } from '../state/niche.mjs';
import { loadItems } from '../state/store.mjs';
import { loadCardsSync } from '../state/knowledge.mjs';
import { autocomplete } from '../demand/collect.mjs';
import { withLock } from '../scheduler/lock.mjs';
import { commitInternal, syncMain } from '../scheduler/git.mjs';
import { FOCUS_PATH, allowProduct, initialFocus, readFocus, reviewFocus, undoLastChange, writeFocus } from './focus.mjs';

const by = () => process.env.USER ?? userInfo().username;

export function focusSummary(root, niche) {
  const state = readFocus(root) ?? initialFocus(niche);
  return {
    active: state.active,
    covered: state.covered,
    excluded: state.excluded,
    lastReviewAt: state.lastReviewAt,
    changes: (state.history ?? []).filter((h) => h.added?.length || h.removed?.length).slice(-5).reverse(),
    canUndo: (state.history ?? []).some((h) => !h.undo && !h.undone && (h.added?.length || h.removed?.length)),
  };
}

/** Human actions. Each returns { written, message }. */
export function focusAction(root, niche, command, { productId, now = new Date() } = {}) {
  const state = readFocus(root) ?? initialFocus(niche, now);
  if (command === 'undo') {
    const next = undoLastChange(state, { now, by: by() });
    const last = next.history.at(-1);
    return { written: [writeFocus(root, next)], message: `Focus change undone: back ${last.added.join(', ') || 'nothing'}; excluded ${last.removed.map((r) => r.productId).join(', ') || 'nothing'}.` };
  }
  if (command === 'allow') {
    if (!productId) throw new Error('Which product? npm run focus -- allow <id>');
    return { written: [writeFocus(root, allowProduct(state, productId))], message: `${productId} can be chosen again at the next review.` };
  }
  throw new Error(`Unknown focus action ${command}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { values, positionals } = parseArgs({ allowPositionals: true, options: { commit: { type: 'boolean' }, root: { type: 'string' }, niche: { type: 'string' } } });
    const root = values.root ? resolve(values.root) : repoRoot;
    const niche = loadNiche(values.niche ?? defaultNicheId(root), root);
    const [command = 'show', productId] = positionals;
    if (command === 'show') {
      const s = focusSummary(root, niche);
      console.log(`Active (last review ${s.lastReviewAt ?? 'never'}):`);
      for (const a of s.active) console.log(`  ${a.productId}\tsince ${a.since.slice(0, 10)}\t${a.reason}`);
      if (s.covered.length) console.log(`Covered:\n${s.covered.map((c) => `  ${c.productId}\t${c.at.slice(0, 10)}\t${c.reason}`).join('\n')}`);
      if (s.excluded.length) console.log(`Excluded:\n${s.excluded.map((e) => `  ${e.productId}\t${e.reason}`).join('\n')}`);
      for (const h of s.changes) console.log(`${h.at.slice(0, 16)} ${h.trigger}: +${h.added.join(' +') || '-'}  -${h.removed.map((r) => r.productId).join(' -') || '-'}${h.undone ? ' (undone)' : ''}`);
    } else if (['undo', 'allow', 'review'].includes(command)) {
      const result = await withLock(root, async () => {
        if (values.commit) syncMain(root);
        let out;
        if (command === 'review') {
          const { items } = loadItems(root);
          const { cards } = loadCardsSync(join(root, 'knowledge'), categoryIds(niche));
          const reviewed = await reviewFocus({ root, niche, cards, items, state: readFocus(root) ?? initialFocus(niche), trigger: `manual by ${by()}`, autocomplete: (q) => autocomplete(fetch, q) });
          out = { written: [writeFocus(root, reviewed.state)], message: reviewed.change ? `+${reviewed.change.added.join(' +') || '-'} -${reviewed.change.removed.map((r) => r.productId).join(' -') || '-'}` : 'No change.' };
          for (const s of reviewed.state.history.at(-1).scores ?? []) console.log(`  ${s.productId}\tscore ${s.score}\tdemand ${s.demand}\ttroubleshooting ${s.troubleshooting}\tdocs ${s.documents}${s.adjacent ? '\tsame brand' : ''}`);
        } else out = focusAction(root, niche, command, { productId });
        if (values.commit) commitInternal(root, out.written, `focus(${command}): ${out.message.slice(0, 100)}`);
        return out;
      }, { label: `focus ${command}` });
      console.log(result.message);
    } else {
      throw new Error('Usage: npm run focus -- show | undo | allow <id> | review [--commit]');
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

export { FOCUS_PATH };
