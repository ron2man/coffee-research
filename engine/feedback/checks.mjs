// Deterministic quality checks on agent output (no AI). Blocking findings fail the run like a
// schema error; warnings are logged as feedback for the critic and the prompt tuner.
// Checks are about evidence and honesty rules from the spec, never about one niche.
import { claimStatus } from '../state/knowledge.mjs';
import { resolveTokens } from '../state/tokens.mjs';

// Title rules (all markets, after product names are filled in). The H1 can carry a little more
// than the search-result title, which Google cuts at about 60 characters.
export const TITLE_MAX = 70;
export const SEO_TITLE_MAX = 60;
export const DESCRIPTION_MAX = 160;

const DAY_MS = 86_400_000;
export const SIGNAL_MAX_AGE_DAYS = 730;
// First-person testing claims. "Hands-on" alone is fine ("more hands-on per shot" describes a workflow);
// negated phrases ("we haven't tested", "no hands-on testing") are honest disclaimers, not claims.
const FORBIDDEN_EXPERIENCE = /\b(we(?:'ve| have)? tested|i(?:'ve| have)? tested|in (?:our|my) testing|we(?:'ve| have)? measured|i measured|our (?:own )?tests?|our hands-on|hands-on (?:tests?|testing|reviews?|trials?))\b/gi;
const NEGATION = /\b(no|not|never|without|haven'?t|hasn'?t|didn'?t|don'?t|nor|n't)\b[^.]{0,25}$/i;
export function testingClaims(text) {
  return [...text.matchAll(FORBIDDEN_EXPERIENCE)]
    .filter((m) => !NEGATION.test(text.slice(Math.max(0, m.index - 40), m.index)))
    .map((m) => m[0]);
}
const AI_PATTERNS = [/\bin conclusion\b/i, /\bit'?s worth noting\b/i, /\bwhen it comes to\b/i, /\bultimately,/i];

const domain = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};

function checkClaims(refs, cards, label, blocking) {
  for (const ref of refs ?? []) {
    const status = claimStatus(cards, ref);
    if (status === 'missing') blocking.push(`${label}: claim ${ref} does not exist in the knowledge cards`);
    else if (status !== 'supported') blocking.push(`${label}: claim ${ref} is ${status}, not supported`);
  }
}

const CHECKS = {
  idea({ outputs, context }) {
    const warnings = [];
    const seen = new Map();
    const today = Date.parse(context.today);
    for (const { artifact: card } of outputs) {
      const signals = card.demand?.signals ?? [];
      if (card.demand?.kind === 'qualitative' && signals.length < 2) {
        warnings.push(`${card.id}: qualitative demand rests on ${signals.length} signal(s); aim for at least 2 independent ones`);
      }
      const domains = new Set(signals.map((s) => domain(s.url)));
      if (signals.length >= 3 && domains.size === 1) warnings.push(`${card.id}: all signals come from one site (${[...domains][0]})`);
      for (const signal of signals) {
        const age = (today - Date.parse(signal.date)) / DAY_MS;
        if (age > SIGNAL_MAX_AGE_DAYS) warnings.push(`${card.id}: signal from ${signal.date} is older than 24 months (${signal.url})`);
        if (age < -1) warnings.push(`${card.id}: signal dated in the future (${signal.date})`);
        if (seen.has(signal.url) && seen.get(signal.url) !== card.id) {
          warnings.push(`${card.id}: reuses the signal ${signal.url} already used by ${seen.get(signal.url)}`);
        }
        seen.set(signal.url, card.id);
      }
      for (const post of context.existingContent ?? []) {
        if (post.slug === card.id) warnings.push(`${card.id}: same slug as existing content ${post.path}`);
      }
    }
    return { blocking: [], warnings };
  },

  research({ outputs, context }) {
    const blocking = [];
    for (const { itemId, artifact } of outputs) checkClaims(artifact.claimIds, context.cards, itemId, blocking);
    return { blocking, warnings: [] };
  },

  angle({ outputs, context }) {
    const blocking = [];
    const warnings = [];
    for (const { itemId, artifact } of outputs) {
      checkClaims(artifact.claimIds, context.cards, itemId, blocking);
      if (!artifact.offerTouchpoints?.some((t) => t.role === 'dont-buy')) {
        blocking.push(`${itemId}: no "dont-buy" touchpoint; every brief needs a keep-what-you-have path`);
      }
    }
    return { blocking, warnings };
  },

  writer({ outputs, context }) {
    const blocking = [];
    const warnings = [];
    for (const { itemId, artifact: draft } of outputs) {
      const body = draft.body ?? '';
      const main = body.split(/^#+\s*How this guide was put together.*$/im)[0];
      const inlineLinks = (main.match(/\]\((https?:[^)]+)\)/g) ?? []).length;
      if (inlineLinks > 2) blocking.push(`${itemId}: ${inlineLinks} inline links before the sources section (max 2)`);
      const words = main.split(/\s+/).filter(Boolean).length;
      if (words && inlineLinks / (words / 100) > 1) warnings.push(`${itemId}: link density above 1 per 100 words`);
      const claimsTesting = testingClaims(body);
      if (claimsTesting.length && !(draft.humanData?.length)) {
        blocking.push(`${itemId}: claims first-hand testing ("${claimsTesting[0]}") without human data`);
      }
      if (!/^#+\s*How this guide was put together/im.test(body)) warnings.push(`${itemId}: no "How this guide was put together" section`);
      if (!/^#+\s*When I'?d choose differently/im.test(body)) warnings.push(`${itemId}: no "When I'd choose differently" section`);
      for (const pattern of AI_PATTERNS) if (pattern.test(body)) warnings.push(`${itemId}: generic phrasing matches ${pattern}`);
      for (const claim of draft.claims ?? []) checkClaims(claim.claimIds, context.cards, `${itemId} "${claim.statement.slice(0, 60)}"`, blocking);
      // Market-neutral naming: products are named with tokens the site fills in per market.
      const text = [draft.title, draft.description, body].join('\n');
      for (const [, kind, id] of text.matchAll(/\{\{(product|model|brand):([a-z0-9-]+)\}\}/g)) {
        if (!context.cards?.has(id)) blocking.push(`${itemId}: {{${kind}:${id}}} names a product with no knowledge card`);
        else if (!(draft.productIds ?? []).includes(id)) warnings.push(`${itemId}: {{${kind}:${id}}} is not in productIds`);
      }
      for (const id of draft.productIds ?? []) {
        if (context.cards?.has(id) && !text.includes(`{{product:${id}}}`)) warnings.push(`${itemId}: product ${id} is never named with {{product:${id}}}, so its name won't adapt per market`);
      }
      for (const id of draft.offerIds ?? []) {
        if (!context.cards?.has(id)) blocking.push(`${itemId}: offers ${id}, which has no knowledge card`);
      }
      for (const problem of titleProblems(draft, context)) blocking.push(`${itemId}: ${problem}`);
      const slugs = new Set((context.existingContent ?? []).map((post) => post.slug));
      for (const [, slug] of body.matchAll(/\{\{guide:([a-z0-9-]+)(?:\|[^}]*)?\}\}/g)) {
        if (!slugs.has(slug)) warnings.push(`${itemId}: links to guide ${slug}, which doesn't exist yet (rendered as plain text)`);
      }
    }
    return { blocking, warnings };
  },
};

/** Length problems for title, seoTitle and description in the longest market. */
export function titleProblems(draft, { cards = new Map(), markets = [{ id: 'US' }] } = {}) {
  const longest = (text) => (text ? Math.max(...markets.map((market) => resolveTokens(text, { cards, market }).length)) : 0);
  const problems = [];
  const title = longest(draft.title);
  const seo = longest(draft.seoTitle);
  const description = longest(draft.description);
  if (title > TITLE_MAX) problems.push(`title is ${title} characters with product names filled in (max ${TITLE_MAX}); shorten it and move the detail to the description`);
  if (draft.seoTitle && seo > SEO_TITLE_MAX) problems.push(`seoTitle is ${seo} characters (max ${SEO_TITLE_MAX})`);
  if (!draft.seoTitle && title > SEO_TITLE_MAX) problems.push(`title is ${title} characters, over the ${SEO_TITLE_MAX} a search result shows; add a seoTitle of at most ${SEO_TITLE_MAX}`);
  if (description > DESCRIPTION_MAX) problems.push(`description is ${description} characters with product names filled in (max ${DESCRIPTION_MAX})`);
  return problems;
}

/** outputs: [{ itemId, artifact }]. context: { today, cards, markets, existingContent }. */
export function runChecks(agentName, outputs, context) {
  const check = CHECKS[agentName];
  return check ? check({ outputs, context }) : { blocking: [], warnings: [] };
}
