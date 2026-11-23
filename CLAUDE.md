# CLAUDE.md

This repo is being rebuilt per [rebuild-spec.md](rebuild-spec.md). It's an autonomous research and content system: it finds what coffee lovers struggle with, researches it, and publishes content a person would send to a friend. Read the spec before structural changes. Work milestone by milestone (spec section 12). At the end of each milestone, run the checks, update `docs/learnings.md`, and summarise what changed and what is still uncertain.

## Layout

- `engine/` is niche-agnostic code. **No coffee strings** (a test enforces this; fixtures and tests are exempt).
  - `state/`: item store (`data/items/<id>.json`), status machine, JSON Schema validation, niche loader.
  - `scheduler/tick.mjs`: one deterministic tick. Picks the highest-priority runnable agent, runs it once, validates, applies status changes and logs them to `.backoffice/runs.jsonl`. One tick per checkout at a time (`.backoffice/tick.lock`). Schedule state is committed in `data/scheduler/state.json`.
  - `runner/`: runner abstraction (`fake` for tests; `claude.mjs` runs `claude -p` with read-only tools, a JSON Schema for the output, and refuses API-key auth).
  - `state/item-cli.mjs`: human actions on items (resume, reject, park, reopen). `state/knowledge.mjs`: card validation; `state/validate-knowledge.mjs` checks every card.
  - `publish/`: the publishing pull request (`requestPublish`) and the passed → published sync each tick.
  - `scheduler/assist.mjs`: assist agents (the toolsmith) work on an item without changing its status.
  - `feedback/`: deterministic checks on every output (`checks.mjs`), the feedback store, the critic/tuner loop, and `cli.mjs` (`npm run feedback`, `npm run prompt`). Agents `critic` and `tuner` review outputs and propose prompt changes; a human applies them.
  - `agents/<name>/`: `agent.json` (mode, input status, outcomes → statuses, caps), `artifact.schema.json`, `fixtures/valid.json` + `fixtures/invalid.json`, and `prompt.md` once written. Agents get read-only tools only; the tick writes every file from their validated output, and any file an agent changes itself fails the run.
- `niches/coffee/`: `niche.json` (categories, markets, sellers, disclosures), `style.md`, and `agents/<agent>.md` niche guidance appended to that agent's prompt. Engine prompts stay niche-agnostic; coffee specifics go here.
- `knowledge/<category>/<product>.md`: product cards (evidence layer, schemaVersion 1, see `knowledge/README.md`).
- `data/`: agent artifacts (`ideas/`, `idea-scores/`, `research/`, `briefs/`, `reviews/`, …). `content/drafts/`: writer output. `content/archive/`: drafts and decisions from the removed legacy pipeline (Bambino grinder guide is the quality reference).
- `backoffice/`: loopback dashboard. `site/`: the Astro website for yourcoffeesetup.com (`src/` pages and layout, `lib/` data layer and HTML components, `public/assets/`); deploy, GA4 and Search Console setup in `docs/deploy.md`.  Tools live in `content/tools/<id>.json`.
- `ops/`: `tick.sh` and the launchd installer (`npm run schedule`). See `docs/operations.md`.

## Commands

```sh
npm install
npm test                                   # all tests
npm run validate                           # niche, agents, items, artifacts, knowledge cards
npm run tick -- --dry-run                  # show what the scheduler would run next
npm run tick -- --commit                   # run one tick, commit + push internal changes to main
npm run item -- list                       # items and status; also show|resume|reject|park|reopen|revise <id> --reason "..."
npm run seed -- add "topic hint" --commit    # seed the idea agent (runs at the next tick)
npm run feedback -- list | add <agent> "note"   # feedback per agent
npm run prompt -- list | show|apply|reject <id> # prompt proposals from the tuner
npm run site:preview                       # preview site on http://127.0.0.1:4321 (mock prices; restart to pick up content changes)
npm run site:build:production              # what the live site builds (published posts only)
npm run schedule -- install|status|logs    # hourly launchd job (run in the scheduler's own clone)
node backoffice/server.mjs                 # dashboard
```

## Principles (spec section 2, these override convenience)

1. Two layers: a strict internal evidence layer, and a published reader layer that is opinionated, plain and has few links.
2. Problem first: ideas come from reader questions, not the product catalog.
3. No fake experience: never claim "we tested" without human-supplied data.
4. "Don't buy" is a valid output. Every recommendation has a keep-what-you-have path.
5. State lives in files. No hidden memory.
6. Scheduling is deterministic; AI is used only for judgement work.
7. Humans approve what ships. Internal changes (items, research, briefs, drafts, knowledge) are committed straight to `main`. Anything that can reach a reader (`content/published/`, `site/`, `data/offers/`) needs its own PR. The list lives in `engine/scheduler/git-policy.json`. The idea judge's picks are final.
8. Measure before optimizing (60–90 days of data).

## Style rules (spec section 7; full guide in `niches/coffee/style.md`)

- Recommendation in the first paragraph, human voice, one clear opinion, a "When I'd choose differently" section, a "don't buy / keep yours" path.
- One post for every market: name products with `{{product:<id>}}` / `{{model:<id>}}` (resolved per market from card variants); no market-specific brands, prices or retailers in the text. Link our own guides with `{{guide:<slug>|text}}`.
- At most 2 inline links. Sources go in a collapsed "How this guide was put together" section.
- No "we tested / hands-on / we measured" without human data that has an author and a date.
- Prefer a tool, decision rule or diagnosis over a spec table. No hedging chains, no "In conclusion".

## Working rules

- Every agent output has a JSON Schema and a failing-case fixture (tested in `engine/tests/contracts.test.mjs`).
- Status only changes through `engine/state/machine.mjs`. Item writes go through `saveItem` (validated, atomic).
- No secrets in the repo; affiliate IDs live in environment config.
- When a requirement depends on external terms (billing, affiliate programs, consent), stop and record an open question in `docs/learnings.md` instead of guessing.
- The system runs on the project lead's Mac first, then another machine or the cloud, so don't assume Linux or systemd.
