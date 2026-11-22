# Rebuild spec: an autonomous research and content system that helps people

Status: draft for implementation in Claude Code (VS Code). Owner: project lead.
Repo context: this replaces the editorial/judging half of the existing `coffee-research` repo and keeps its evidence layer.

---

## 1. Why we are rebuilding

The current system produces posts that read like AI output: citations after nearly every paragraph, spec-sheet prose, no point of view, no tool or decision aid. The cause is in our own instructions, not the model:

- `agent/skills/coffee-seo/SKILL.md` and `agent/editorial-workflow.md` say "keep citations close to the claims" and "sources near the claims".
- `agent/editorial-judge.md` rewards supported claims and hedging. Posts scored 5/5 on reader value while being weak.
- Topic selection starts from products ("product → idea") instead of reader problems ("problem → idea").
- Research output (atomic claim cards) goes straight to the writer, which rearranges claims instead of arguing a position.

The goal is a machine that does real good for coffee lovers: it finds what people struggle with, researches it properly, publishes content a person would send to a friend, and earns affiliate revenue as a consequence of being useful, not as the goal.

## 2. Principles (these override convenience)

1. **Two layers.** The *evidence layer* is internal and strict (claims, sources, locators). The *reader layer* is what is published: opinionated, plain, few links.
2. **Problem first.** Ideas come from reader questions and pain, not from the product catalog.
3. **Value without fake experience.** Never claim "we tested" unless a human supplied the data. Value comes from tools, diagnosis, decision rules, compatibility matrices, price/availability tracking.
4. **"Don't buy" is a valid output.** Every recommendation has a "keep what you have" path.
5. **State lives in files.** No hidden memory. Everything is inspectable and diffable in Git.
6. **Deterministic scheduling, AI only for judgement work.** No LLM orchestrator.
7. **Humans approve what ships.** Internal changes (items, research, briefs, drafts, knowledge cards) are committed straight to `main` with no approval, so the pipeline never waits on a merge. Anything that can reach a reader (published posts, site code, offers shown on the site) goes through its own PR that a human merges. The boundary is `engine/scheduler/git-policy.json`. *(Decision 2026-11-21.)*
8. **One post for every market.** A post is written once and shown in every market. What differs per market is data, not prose: product names and model numbers come from the knowledge card variants (`{{product:id}}`, `{{model:id}}`), and offers, prices, currency and disclosure come from the offers layer. The text only mentions a market when a variant really differs. *(Decision 2026-11-22.)*
9. **Measure before optimizing.** No SEO changes on fewer than 60 to 90 days of data.

## 3. Scope

- v1: coffee (home espresso machines, grinders, accessories), English, US market first, UK second.
- Architected so a second niche is a new `niches/<name>/` folder, not a rewrite. Do not build a generic framework up front; extract shared code only when niche #2 exists.
- Out of scope for v1: beans, ads, automatic publishing without human merge, localisation beyond data model and URL structure.

## 4. Architecture

```
repo/
  engine/                  # niche-agnostic code. No "coffee" strings.
    runner/                # agent runner abstraction (claude -p today, swappable)
    scheduler/             # tick script: picks next work item, runs one agent
    state/                 # item store, status machine, schema validation
    agents/<name>/         # prompt.md, input/output schema, runner config
    analytics/             # Search Console + GA4 clients
    offers/                # price/availability refresh + link checks
  niches/coffee/
    niche.json             # categories, product schema, markets, sellers, disclosures
    style.md               # voice and formatting rules
    rubric.md              # judge rubrics
  knowledge/               # product cards (existing format, schemaVersion 1 kept)
  data/
    ideas/ briefs/ research/ offers/ findings/ matrices/
  content/
    drafts/ published/
  site/                    # static site
  backoffice/              # dashboard (see section 9)
  docs/ learnings.md
  .backoffice/             # local run history (gitignored), existing convention
```

### 4.1 State machine

Each work item is one file in `data/items/<id>.json` with a `status`:

`idea → idea_approved → researched → briefed → drafted → passed → published → measured`
with side states `rejected`, `blocked`, `needs_human`.

Rules:
- An agent only reads items in its input status and only writes to its own output folder plus the item's status.
- A failed item gets `attempts += 1`. At 2 failures it becomes `blocked` with a reason. Failures are logged, never swallowed.
- Queue caps: scheduler does not run the idea agent if there are already N items (default 10) in `idea` or `idea_approved`.
- Every status change appends to `.backoffice/runs.jsonl` (existing format) with agent, item id, duration, outcome, usage if available.

### 4.2 Scheduler

A small Node script (`engine/scheduler/tick.mjs`, no AI) run on a timer: `launchd` on the project lead's Mac first, then cron or `systemd` on another always-on machine or in the cloud. Do not assume Linux. Only one tick runs per checkout (lock file in `.backoffice/`); when the scheduler moves machines, the committed `data/scheduler/state.json` carries the schedule:
1. Read the item store and per-agent schedule config.
2. Pick the highest-priority runnable agent (one at a time, to control usage).
3. Run it through the runner; validate output against schema; commit internal changes to `main` and push (rebasing once if `main` moved during the run). A change touching a public path is never committed by the tick; it goes through a separate PR (principle 7).
4. Agents never write files. They get read-only tools and return everything (including knowledge-card changes) as output; the tick validates it and writes the files. A file that changes during a run without the tick writing it fails the run.

### 4.3 Runner abstraction

`runner.run({ agent, input, tools, permissions })` returns validated output. v1 implementation shells out to `claude -p` (Claude Code CLI, headless) under a dedicated OS user with access only to the repo directory. Keep the interface so Codex or another runner can be swapped in per agent.

**Billing check (milestone M0, blocking):** sources conflict on whether `claude -p` runs draw from subscription limits or from a separate agent credit pool. Before building on it: run one agent once, inspect `/usage`, and confirm what is counted. Ensure `ANTHROPIC_API_KEY` is not set in the job environment unless API billing is intended. Record the result in `docs/learnings.md`.

## 5. Agents

All agents use structured JSON output validated by schema. All prompts live in `engine/agents/<name>/prompt.md` and receive niche config from `niches/<niche>/`.

### 5.1 Idea agent (daily)
- **Input:** demand signals only: forum/Reddit questions, Search Console queries (when available), questionnaire answers (when available), competitor gaps, market changes (new product, price drop, known fault). Not the product catalog.
- **Output:** idea cards (section 6.1). Maximum 10 per run. Every card states its demand source and whether demand is `measured | qualitative | unmeasured`.
- **Rules:** group synonymous queries; check overlap with existing posts; no invented search volume.

### 5.2 Idea judge (separate run, separate prompt)
- Scores each idea 1 to 5 on: demand evidence, competitor gap, value-add without personal experience, evidence feasibility, commercial fit (honest), overlap with existing content.
- Selects at most 3 to advance, rejects the rest with a reason. The judge's decision is final; no human confirmation (decision 2026-11-21). Rejected ideas stay in the store (ideas can be re-scored when analytics arrives).

### 5.3 Research agent
- **Input:** approved idea. **Output:** updated/new knowledge cards, a research note (what we learned, what is unknown, what competitors say), and filled cells in the product-fit matrix.
- Evidence rules from the existing `knowledge/README.md` still apply: `supported` claims need a source and locator; disputes and gaps are recorded, not smoothed over. Primary sources first; retailer/blog snippets are leads, never proof.
- Fetch the full page before using a number. Snippets alone are not evidence.

### 5.4 Angle agent (new, critical)
- **Input:** idea + research note + top 3 competing pages. **Output:** `angle brief` (section 6.3): the single claim of the post, who it is for, what we add that competitors do not, the decision or tool it produces, what to leave out, planned assets (tool/diagram), and the affiliate/offers touchpoints.
- This is the step that prevents "claim rearranging". If it cannot state a distinct contribution, the item goes to `needs_human` or `rejected`.

### 5.5 Writer agent
- **Input:** angle brief + knowledge cards + `niches/coffee/style.md`. **Output:** a draft in `content/drafts/` with frontmatter, plus a `claims.json` mapping each factual statement to claim IDs (this is where evidence lives, not in the prose).
- Hard style rules (enforced by lint, section 7): see style guide.

### 5.6 Post judge (separate run)
- Reads the draft as a reader and compares it against the top 3 competitors for the primary query. Questions: would a reader forward this? Does it give something the top results do not? Is there an opinion? Is it honest about what we did not test?
- Includes automated checks (section 7) and returns `pass | revise | reject` with at most 3 blocking actions. One revision loop maximum, as today.

### 5.7 Analyst agent (weekly)
- **Input:** Search Console + GA4 data, offers/link health, published posts. **Output:** `data/findings/<week>.json` and work items such as "rewrite title of X" or "add FAQ for query Y".
- Never edits content directly. Writer executes tasks via the normal PR flow.
- Does not act on pages younger than 60 days or with fewer than a minimum number of impressions (configurable).

### 5.8 Offers agent (daily, mostly deterministic code)
- Refreshes prices, availability and link health per product × market × seller. Mostly an API/HTTP job with no LLM. LLM is used only to match a product to a listing when ambiguous, and flags uncertain matches for human review.

## 6. Data contracts

JSON Schema for each, validated in CI and by the scheduler.

### 6.1 Idea card (`data/ideas/<id>.json`)
```json
{
  "id": "bambino-sour-shots",
  "question": "Why is my Bambino espresso always sour and what do I change first?",
  "audience": "New Breville Bambino / Bambino Plus owners, US",
  "market": "US", "language": "en",
  "pain": "Repeated sour shots despite changing grind",
  "decision": "What to change, in what order",
  "contentType": "troubleshooter-tool",
  "demand": { "kind": "qualitative", "signals": [{"url": "...", "date": "2026-11-21", "note": "..."}] },
  "competitorGap": "Generic guides; none Bambino-specific",
  "valueAdd": "Interactive diagnosis from shot time, ratio, basket, roast",
  "commercialPath": ["scale", "grinder"],
  "status": "idea"
}
```

### 6.2 Product-fit matrix (`data/matrices/<pair>.json`)
Compatibility between product classes, e.g. grinder × machine: portafilter size/cup fit, adjustment resolution, retention, noise, dosing mode, price per market. Each cell holds a value, a claim reference or `unknown`, and a source date. Empty cells are listed on the dashboard as research tasks.

### 6.3 Angle brief (`data/briefs/<id>.json`)
```json
{
  "id": "...", "thesis": "One sentence the post argues.",
  "reader": "...", "readerDecision": "...",
  "whatCompetitorsMiss": ["..."],
  "ourContribution": "Tool | decision rule | diagnosis | tracker",
  "mustInclude": ["adjacent-setting test"], "leaveOut": ["spec table"],
  "assets": ["quiz-component", "diagram"],
  "offerTouchpoints": [{"productId": "...", "role": "primary|alternative|dont-buy"}],
  "claimIds": ["baratza-encore-esp-pro/..."],
  "titleOptions": ["..."], "slug": "...", "metaDescription": "..."
}
```

### 6.4 Offers (`data/offers/<productId>.json`)
```json
{
  "productId": "baratza-encore-esp-pro",
  "variants": [{
    "market": "US", "sku": "ZCG595BLK1AUC1A",
    "offers": [{
      "seller": "amazon-us", "type": "affiliate",
      "url": "https://...", "price": 299.95, "currency": "USD",
      "availability": "in_stock", "checkedAt": "2026-11-21T08:00:00Z",
      "matchConfidence": "high", "linkOk": true
    }]
  }]
}
```
Rules: the site never shows a price older than a configured maximum age (default 48h); stale means hide the price and keep the button. Affiliate URLs are generated from templates plus per-market account IDs held in environment config, never written into post text.

### 6.5 Post frontmatter
`title, slug, description, market, language, primaryQuery, relatedQueries, publishedAt, updatedAt, claimsFile, productIds, tools[], disclosure: true`.

## 7. Content quality rules (lint + judge)

Style guide (`niches/coffee/style.md`):
- Open with the recommendation in the first paragraph, in a human voice.
- Maximum **2 inline links** in the body. All sources go in a collapsed "How this guide was put together" section. A single site-wide "How we work" page explains the method.
- No "we tested" / "in our testing" unless the post includes human-supplied data with an author and date.
- One clear opinion. "When I'd choose differently" section. Always include a "don't buy / keep yours" path.
- Prefer a tool, decision rule or diagnosis over a spec table.
- No hedging chains. State what is unknown once.

Automated lint (fails the draft):
- inline link count > 2; link density per 100 words
- forbidden claims phrases (tested, hands-on, we measured) without a data attachment
- every factual statement in `claims.json` resolves to a `supported` card claim
- missing disclosure, missing slug/meta
- generic-AI patterns: repeated section templates, "In conclusion", stacked hedges

Judge rubric (replaces `agent/editorial-judge.md` dimensions): `readerValue vs competitors` (weighted highest), `distinctiveness/voice`, `honesty about limits`, `evidence integrity` (mostly automated), `topic fit`. A post must beat or clearly differ from the top 3 competitors for the primary query to pass.

## 8. Site

- Static site in `site/` (Astro recommended; any SSG is acceptable if it supports components and content collections). Deploy via Cloudflare Pages or Vercel connected to the repo; the agent never holds deploy keys. Only `content/published/` and `site/` changes trigger deploy.
- Components: `PriceBox` (market-aware prices + where to buy, reads `data/offers`), `Picker` (questionnaire/decision tools, generalised from the Bambino grinder quiz), `Callout`, `ImageFigure`.
- Markets: URL structure `/en-us/`, `/en-gb/`; language and market are separate fields. Market determines offers, disclosure text and currency. Auto-detect country with a manual override.
- Disclosure: per market, rendered by the layout, not by writers. Verify current affiliate program terms per market before launch (see risks).
- Images: only manufacturer press assets, affiliate-program-provided images (subject to their terms), our own photos, or generated diagrams. Never hotlink or copy from reviews. Store image provenance in frontmatter.
- Performance and accessibility: mobile first, Core Web Vitals budget, keyboard-accessible tools.
- Questionnaire results (anonymous, aggregate only) feed the idea agent as demand data.

## 9. Dashboard (backoffice v2)

Principle: the dashboard answers **"what needs me today, and is this making money?"** It is not a data dump. Build on the existing `backoffice/` (loopback server, `server.mjs`, `app.js`). Read-only first; actions (approve/reject/merge) added in M6 by writing files and opening PRs, never by direct state edits.

Views:
1. **Today** (home): human action inbox: drafts awaiting review (content PRs), blocked items, stale offers needing a match decision, broken links, analyst recommendations. Each row has one button and one-line reason.
2. **Pipeline**: kanban by status with item age, attempts, and which agent runs next. Queue cap indicators.
3. **Idea inbox**: card details, demand evidence, judge scores and decisions (informational; the judge's picks stand), with optional override / re-score. Show why rejected ideas were rejected.
4. **Draft review**: rendered post, side-by-side with judge scores, lint failures, claims map, and top-3 competitor comparison summary. Approve opens/merges the PR.
5. **Performance**: per post: impressions, clicks, CTR, average position (Search Console), engaged sessions and scroll (GA4), with 7/28/90-day windows and a "too early to judge" badge for young pages. Query-level table to spot "impressions, no clicks".
6. **Money**: affiliate link clicks by page, button position, market, seller; click-through from visit to merchant; conversion/revenue when affiliate reports are importable (manual CSV import first). Top pages by clicks, pages with traffic but no clicks.
7. **Offers health**: price freshness per product × market, broken links, low-confidence matches, coverage (which markets/sellers missing).
8. **Knowledge coverage**: matrix completeness, claims past refresh interval (existing 90-day rule), open/disputed claims, research tasks generated from empty matrix cells.
9. **Runs and cost**: per agent: runs, success rate, duration, usage consumed, failures with reasons; weekly trend; budget warning if usage trend threatens limits.
10. **Learning log**: existing `docs/learnings.md`, plus an "experiments" table: hypothesis, change, start date, metric, decision rule, result.

Dashboard non-goals: vanity charts, real-time everything, auth (loopback only for now).

## 10. Analytics integration

- **Search Console API** (read-only service account; domain property must be verified). Daily pull of page and query metrics into `data/analytics/gsc/`.
- **GA4 Data API.** Custom events: `affiliate_click` with `page_id, product_id, seller, market, position, tool_state`; `tool_complete` for quiz/picker; `scroll_depth`. Data stored as daily aggregates, not raw user data.
- Privacy: no personal data in the repo. Respect consent requirements for EU/UK (consent banner or cookieless/aggregate measurement). Decide before launching UK pages.
- Decision rules live in `engine/analytics/rules.md`: minimum age (60 days), minimum impressions, one change at a time per page, record each change in the experiments table.

## 11. Migration from the current repo

Keep (rename/move as needed): `agent/knowledge.mjs` and the knowledge card format, `agent/validate-knowledge.mjs`, `agent/research-plan.mjs` (generalise categories from `niche.json`), `.backoffice/runs.jsonl` convention, `backoffice/` server, `docs/learnings.md`.

Rewrite: `agent/editorial-workflow.md`, `agent/editorial-judge.md`, `agent/skills/coffee-seo/SKILL.md` (remove the citation-near-claims rule), `agent/run-editorial.mjs` (replace Codex-specific calls with runner abstraction, split into per-agent steps), `agent/judge-editorial.mjs`.

Remove hard-coding: `categories = ['machines', 'grinders']` in `agent/knowledge.mjs` and category paths in `research-plan.mjs` and `discover-baratza.mjs` should read `niches/coffee/niche.json`.

Existing drafts: archive in `content/archive/` (done 2026-11-21: `content/archive/drafts/`; the legacy pipeline, backoffice and preview read from there); the rewritten Bambino grinder guide (with picker) is the quality reference for new posts.

## 12. Milestones and acceptance tests

| M | Deliverable | Acceptance |
|---|---|---|
| M0 | Runner + billing check on the project lead's Mac | One headless agent run completes; `/usage` shows what it consumed; learnings entry written; no API key in job env |
| M1 | Item store, status machine, schemas, scheduler tick, run logging | Simulated items advance through states; invalid output rejected; queue caps and 2-failure `blocked` work |
| M2 | Idea agent + idea judge | 10 real coffee idea cards generated; judge advances ≤3; project lead agrees at least 2 are worth writing |
| M3 | Research agent + product-fit matrix (grinder × Bambino first) | Matrix cells each have value+source or `unknown`; research task list generated from gaps |
| M4 | Angle agent, writer, post judge, lint | 3 posts produced for chosen ideas; pass lint; judge beats top-3 comparison on at least 2; lead would send them to a friend |
| M5 | Site + PriceBox + Picker + offers data (mock offers) | Preview deploys; US and UK views differ correctly; stale price hides; disclosure per market |
| M6 | Dashboard v2 (read-only views 1 to 4, 9) then actions | "Today" view lists real work; approve opens a PR |
| M7 | Offers agent + live price/link refresh | Prices refresh on schedule; broken links surface on dashboard |
| M8 | Search Console + GA4 + analyst + Performance/Money views | Weekly findings generated; no action on pages younger than 60 days |
| M9 | Go-live pilot | 6 to 10 posts published; 60 to 90 days of tracking before any scaling or niche #2 |

Gate rule: do not start M5 if M4 posts do not pass the "would you send it to a friend" test.

## 13. Risks and open questions

- **Subscription vs API billing for headless runs** (M0). Decide runner before anything else.
- **Affiliate programs and price data.** Verify current terms per program and market (Amazon Associates and its product-data API conditions, local sellers, AliExpress) before designing price display and storage. Some programs restrict caching or showing prices. Do not assume.
- **Content quality ceiling.** Without hands-on testing, posts are curation and tools. Provide a structured slot for human-supplied measurements and photos, and label them with author and date.
- **Search Console data arrives slowly** for a new domain. The first weeks of analytics will be noise.
- **Legal/consent** for analytics in EU/UK.
- **Image rights** (section 8).
- **Search policy risk:** scaled low-value content can be demoted. Keep volume low, quality high, and human approval on.
- **Usage limits:** run one agent at a time; monitor usage per agent.

## 14. Working instructions for Claude Code

- Read this spec, `docs/planning-spec.md`, `knowledge/README.md` and the files listed in section 11 before changing anything.
- Human actions on items go through `npm run item` (resume, reject, park, reopen), never by editing item files.
- Work milestone by milestone. At the end of each: run validators and tests, update `docs/learnings.md`, and summarise what changed and what remains uncertain.
- Add a `CLAUDE.md` at the repo root with: repo layout, how to run validators, the principles in section 2, and the style rules in section 7.
- Do not hard-code "coffee" in `engine/`. Do not write secrets to the repo. Internal changes may go to `main`; anything reader-facing needs its own PR (principle 7).
- Prefer small, tested modules. Every agent output has a JSON Schema and a failing-case test.
- When a requirement is ambiguous or depends on external terms (billing, affiliate, consent), stop and record an open question instead of guessing.
