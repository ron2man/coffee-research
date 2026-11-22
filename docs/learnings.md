# Project learning log

Each entry records the date, workflow, what we tried, what we observed, a link to the evidence or revision, sample limitations, and the follow-up. When a finding becomes a working rule, link to the instruction or check it changed.

## Observations

### 2026-11-21 · Product Research · Match evidence to the model

For the initial Bambino Plus card we used a listing for a specific SKU. For the Encore ESP we used a Baratza guide that covers several grinders with similar names. A SKU listing helps scope specifications to the reviewed variant. When one source covers multiple models, record the exact section for the model. Include a variant ID when the claim depends on it. This lesson comes from the two pilot cards.

### 2026-11-21 · Editorial pilot · Test the actual reader decision

The first Classika comparison earned 5/5 for reader value while its own research left the price premium and comparable first-shot times open. A blind reader of the rendered comparison could identify the advertised numbers but could not settle the buying question. The commissioning check narrowed the story to identifying a used PID and checking its cold-start cues. The revised page passed. For the Bambino cleaning guide, the reader correctly selected a maintenance cycle from the light pattern, while the evidence judge identified missing procedural details. These two examples informed the commissioning and reader checks. They provide no traffic or conversion measurement.

[Classika decision](../content/opportunities/ecm-classika-iii-vs-classika-pid.json) · [Bambino decision](../content/opportunities/bambino-plus-cleaning-vs-descaling.json) · [Reader review](../agent/judge-editorial.mjs)

### 2026-11-21 · Buying guides · Let the reader see how the choice is made

In the Bambino grinder preview, the editor found that the immediate product pick, comparison table and repeated summaries felt like a generated report. The revised column opens with two shots on adjacent grind settings. That makes the difference between stepped and stepless adjustment tangible before a product appears. The reader judge accepted the revised guide. Audience and conversion effects remain unmeasured.

[Bambino grinder column](../content/archive/drafts/best-grinder-for-bambino.md) · [Writing instructions](../agent/skills/coffee-seo/SKILL.md)

### 2026-11-21 · Rebuild M1 · Item store, status machine and scheduler tick

We built the engine skeleton from [rebuild-spec.md](../rebuild-spec.md): `data/items/<id>.json` owns status, agents write artifacts to their own folders, and `engine/scheduler/tick.mjs` runs one agent per tick. Simulated items went from `idea` to `passed`, including one revision loop. Invalid output is rejected before any file is written. Two failures block an item. The idea agent stops at 10 queued ideas. A runner that cannot start (missing CLI) does not count as an item failure and does not use up the daily schedule; the first real tick on this Mac exposed that. All of this uses a fake runner. No real agent has run yet.

[Scheduler tests](../engine/tests/scheduler.test.mjs) · [Agent contracts](../engine/agents/)

### 2026-11-21 · Rebuild M1 review · Close the gaps before real agents run

A review of the M1 engine found gaps that only show up once real agents run. We fixed them, and none have been observed in a real run yet.

- **Write boundary.** Agent definitions may only list read-only tools (Read, Grep, Glob, WebSearch, WebFetch). The research agent lost `Edit`; knowledge-card changes will come back in its output at M3. The tick also compares the git working tree before and after a run, and any file the tick did not write fails the run (counted as an attempt). If a human edits a file during a long run, the run fails the same way.
- **One tick at a time.** `.backoffice/tick.lock` covers sync, tick and commit. Stale locks (dead process, older than 3h, unreadable) are taken over. `npm run item` takes the same lock.
- **Human actions.** `npm run item -- resume|reject|park|reopen <id> --reason "..."` changes status through the machine and logs the action. Reopening a rejected item keeps only the idea artifact and resets revisions, so the writer never sees a stale review.
- **Git.** If `main` moved while an agent ran, the push is rebased once and retried. A diverged checkout is rebased at sync instead of stopping the scheduler. A real conflict aborts the rebase and says so.
- **Schedule survives a machine move.** Each scheduled agent's last run is committed in `data/scheduler/state.json`; the local run log stays gitignored.
- **Idea judge cap.** Advances over 3 are converted to `reject`, lowest total score first, with the reason recorded, instead of failing the batch and blocking every idea after two tries.
- **Claude runner.** `engine/runner/claude.mjs` runs `claude -p` with `--tools` limited to the agent's list, `--permission-mode dontAsk`, no MCP tools, a JSON Schema for the output, and a timeout. It removes `ANTHROPIC_API_KEY` and `ANTHROPIC_AUTH_TOKEN` from the job environment and refuses to start unless `claude auth status` reports a subscription sign-in (`CLAUDE_RUNNER_ALLOW_API_BILLING=1` overrides). It is tested against a fake CLI only, and the flags follow the current CLI reference. An agent without `prompt.md` counts as "runner unavailable", so nothing real runs until a prompt exists.
- **Legacy drafts archived** to `content/archive/drafts/`. The legacy pipeline, backoffice and preview were repointed, and the existing reviews still match their fingerprints.

[Runner](../engine/runner/claude.mjs) · [Lock](../engine/scheduler/lock.mjs) · [Item CLI](../engine/state/item-cli.mjs) · [Tests](../engine/tests/)

### 2026-11-21 · M0/M2 · First real run, the feedback loop and a preview site

The first real idea run took about 4 minutes and 44 turns (CLI estimate $1.01 at API prices; the subscription `/usage` delta is still to be recorded). It produced 4 valid cards that were specific, problem-first and offered a keep-what-you-have path. The evidence was thin: 3 of 4 cards rested on one signal, two cards shared the same off-topic thread, one signal dated from 2018, and one card overlapped an archived post the agent could not see. We tightened the prompt (two independent signals, no reuse, 24-month window, existing content in the input) and moved coffee-specific advice (which communities to search, Breville/Sage naming, existing coverage) into `niches/coffee/agents/idea.md`.

To keep learning from runs without hand reviews, we built a feedback loop. Deterministic checks run after every output and log warnings or block the run. A critic agent reviews each agent's recent outputs against its own prompt and spot-checks sources. A tuner turns open feedback into a prompt proposal, and a human applies or rejects it (`npm run prompt`). The research agent now returns knowledge-card changes, which the tick validates (it never drops claims) before writing. Writer drafts are linted for inline links, invented testing and unsupported claims. Prompts now exist for all agents. Only the idea prompt has run for real; the others are untested.

A local preview site now renders the quality reference, the archived drafts and future writer drafts for US and UK. It includes a data-driven Picker, a PriceBox with mock offers that hides prices older than 48h, a per-market disclosure, and a "How we work" page. The production build refuses to run without verified disclosure text.

[Feedback loop](../engine/feedback/) · [Operations](operations.md) · [Site build](../site/build.mjs) · [Idea prompt](../engine/agents/idea/prompt.md)

## Decisions

- **2026-11-21 · Git flow.** Internal changes (items, research, briefs, drafts, knowledge cards) are committed straight to `main` by `npm run tick -- --commit`, with no approval, so the pipeline never waits on a merge. Reader-facing paths (`content/published/`, `site/`, `data/offers/`) are never committed by a tick and need their own PR. The boundary is [git-policy.json](../engine/scheduler/git-policy.json). The publish step that opens content PRs arrives with M4/M5.
- **2026-11-21 · Idea approval.** The idea judge's picks are final. The dashboard shows its decisions for information, with an optional override.

- **2026-11-21 · Prompt changes.** The tuner proposes and a human applies (`npm run prompt -- apply`). Prompts never change unattended.
- **2026-11-21 · Site before the M4 gate.** The project lead asked for a local preview site now. It stays a preview (noindex, mock prices, no deploy). The M4 "send it to a friend" gate still applies before any public deploy.
- **2026-11-21 · Scheduler.** Hourly launchd job in a dedicated clone on `main` (`docs/operations.md`).

- **2026-11-22 · Design and name.** The site uses design A3 (white, near-black, one cherry red, Schibsted Grotesk, rules not cards) and the name YourCoffeeSetup. The affiliate disclosure and the "not tested by us" note sit under the title, before any link. Preview builds show credited Unsplash mock photos from `site/assets/mock/`; production builds never copy them.

- **2026-11-22 · Homepage setup questionnaire: parked.** A "What's your setup?" picker (sentence form: "I have a [machine] and I want to [upgrade / fix / buy]", with the straight answer shown in place) is mocked up on the design canvas as A4. It waits until there are enough guides that most machine × intent combinations have a real answer; with 4 guides about half would show "Not answered yet". Revisit when each listed machine has guides for at least two intents.

## Open questions

- **Offers as public paths:** `data/offers/` is treated as reader-facing because prices appear on the site, which would mean a PR for every daily price refresh. Revisit at M7: one option is to have the site read offers at build time from an internal file.
- **M0 billing (first measurement, 2026-11-22):** one research tick (27 turns, 4.2 min, CLI estimate $1.46 at API prices) moved the subscription's current-session usage from 10% to 18%. So `claude -p` runs do draw from the subscription, at roughly 8 points per research run. That allows about 10 to 12 runs of this size per session window, fewer if the lead uses Claude at the same time. Still open: the reading may include other Claude use in the same window, so repeat once with nothing else running; check the weekly limit too; and confirm `--json-schema` and `--permission-mode dontAsk` on the installed CLI.
- **Scheduler on macOS:** the launchd job runs `ops/tick.sh` from its own clone (`npm run schedule -- install`). At about 8% of a session per research run, hourly ticks use most of a session window when every tick runs a heavy agent. Consider every 2 hours, or a daily cap on heavy runs, and revisit after a week. Don't run manual ticks in a second checkout while it runs: on 2026-11-22 a manual tick in the working copy re-ran research on a stale checkout (the scheduler had already done research and angle) and its autostash conflicted on pull. Fixed the same day: a plain tick now fetches and refuses to run when the checkout is behind `origin/main` (dry runs only warn), and the `--commit` sync no longer pulls over local edits to files the remote changed. It stops with the file list and touches nothing.
- **Untested prompts:** angle, writer, post-judge and tuner have not run for real (idea, idea-judge, research and critic have). Expect the first proposals from the tuner within a day of hourly runs.
- **Writer output to Markdown:** writer drafts are JSON in `content/drafts/`; the site reads them directly. The publish step (draft → `content/published/<slug>.md` in a PR) is not built yet.
- **Mock offer prices** now come from `site/mock-prices.json` (near US list prices checked 2026-11-22: Encore ESP Pro $299.95, Encore ESP $199.95, DF54 about $249) so previews match the guides, with three mock sellers per product. Replace with the offers agent (M7) after affiliate terms are verified.
- **Amazon Associates price display:** its rules on showing and caching prices are stricter than our 48-hour window (prices from its product API, how fresh they must be, and whether we may store them). Check the current Operating Agreement before M7 designs price storage or display for Amazon links.
- **Display ads (AdSense or similar):** not before 60–90 days of traffic data. Before any trial, check program approval rules, policies for sites that also use affiliate links, and the consent banner needed for UK/EU visitors. The guide page's right column (planned) reserves one slot for this.
- **Voice and author:** guides mix "I" (the recommendation) and "we" (the method). Decide on a single voice, ideally a named author, since the no-fake-testing promise relies on named people.
- **Audience:** current guides range from a Bambino (about $300) to a Linea Micra (about $4–5k). Decide entry-level vs every machine, and whether to organise guides by machine.
- **Niche-aware checks:** `market` and `contentType` in artifacts are not yet checked against `niche.json`.
- **Affiliate terms and consent:** sellers and disclosure text in `niche.json` stay empty until program terms are verified per market.
