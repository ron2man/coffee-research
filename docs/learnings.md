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

[Feedback loop](../engine/feedback/) · [Operations](operations.md) · [Site config](../site/astro.config.mjs) · [Idea prompt](../engine/agents/idea/prompt.md)

### 2026-11-22 · M4 · The first post through the whole pipeline, and what the owner changed

The Barista Express/Pro diagnosis went from idea to `passed` without manual edits to the content. Research first stopped at `needs_human` because the manuals were PDFs it couldn't read. After poppler was installed and the item resumed, it read Breville's booklets page by page. The post judge passed the draft, and the project lead called it "amazing". It also raised three points:

1. The content should not change by country. Only product sub-versions differ, and offers come from their own mechanism. This became principle 8 in the spec: products are named with tokens resolved from card variants, and the "written for another market" notice is gone.
2. The ending should give the escalation path. If the free fixes fail, buy a grinder, not a new machine. This became a writer rule ("end on the decision: the smallest sensible purchase") and a post-judge blocking check. The draft was sent back with `npm run item -- revise`.
3. A follow-up guide on which grinder Barista Express/Pro owners should buy. This was added as a seed. The two guides will link with `{{guide:…}}`.

Seeds work: the owner's capsule-machine seed produced a "Nespresso to beans" card with three signals.

[Writer prompt](../engine/agents/writer/prompt.md) · [Spec principle 8](../rebuild-spec.md)

### 2026-11-23 · M4/M5 · Tools, titles and publishing

The first post's title was 110 characters and named two interactive tools that didn't exist, and passed posts had no way out of preview. Titles now have limits measured in the market with the longest product names (headline 70, search title 60). The post judge re-runs the writer's checks, so a draft written under older rules can't pass. A toolsmith agent builds the pickers a brief asks for (validated data, no code) or declines diagrams with a reason, and the writer may only use tools that exist. Publishing is a pull request opened from the dashboard. The live site needs disclosure text for every market first, and that is the first thing blocking publication.

[Toolsmith](../engine/agents/toolsmith/prompt.md) · [Publishing](../engine/publish/publish.mjs) · [Operations](operations.md)

### 2026-11-23 · M0 · Done: headless runs draw from the subscription

One real agent run uses about 8% of the subscription's usage, as the project lead observed on `/usage`. The first measurement: one research tick (27 turns, 4.2 minutes, CLI estimate $1.46 at API prices) moved current usage from 10% to 18%. So `claude -p` runs count against the subscription, not a separate pool and not API billing. The runner strips API keys from the job environment and refuses non-subscription sign-ins. `--json-schema` structured output and `--permission-mode dontAsk` work on the installed CLI: every real run since 2026-11-21 returned validated output. The budget is about 10 to 12 runs of this size per usage window, fewer when the lead uses Claude at the same time. Hourly ticks can't use up the limit on their own, because a tick with nothing due uses nothing, but a busy pipeline can reach it. The scheduler runs as the lead's user in a dedicated clone rather than under a dedicated OS user; we accept that for the pilot.

Follow-up: watch the weekly limit, and lengthen the tick interval (`npm run schedule -- install --interval-minutes 120`) if runs start to crowd out the lead's own use.

### 2026-11-23 · Toward one guide a day: focus, demand data, budget, cleanup

The project lead set the goal: one guide a day, built around equipment, with "my setup" as the site's eventual core and affiliation moved to a separate service (`docs/offers-service.md`). Changes:

- `niche.json` `focus`: the Barista Express and Pro cluster. The idea agent starts there, and the judge prefers it when evidence is comparable. Six seeds cover the cluster.
- Demand data without AI before each idea run: autocomplete phrasing per market and Reddit posts (API with app credentials, or public JSON with blocks recorded). The idea agent can cite these as signals. This answers "the idea agent can't reach Reddit".
- Fewer runs per guide. The critic and tuner run only on idle ticks and review in batches of 5. The idea agent waits until fewer than 4 ideas are queued. A 12-runs-per-24h budget protects the subscription.
- Publishing: disclosure text is required only for posts with affiliate offers. Approvals can be queued, and the next tick opens the PR.
- Removed the legacy `agent/` pipeline, the old site renderer and the old dashboard view.

## Decisions

- **2026-11-21 · Git flow.** Internal changes (items, research, briefs, drafts, knowledge cards) are committed straight to `main` by `npm run tick -- --commit`, with no approval, so the pipeline never waits on a merge. Reader-facing paths (`content/published/`, `site/`, `data/offers/`) are never committed by a tick and need their own PR. The boundary is [git-policy.json](../engine/scheduler/git-policy.json). The publish step that opens content PRs arrives with M4/M5.
- **2026-11-21 · Idea approval.** The idea judge's picks are final. The dashboard shows its decisions for information, with an optional override.

- **2026-11-21 · Prompt changes.** The tuner proposes and a human applies (`npm run prompt -- apply`). Prompts never change unattended.
- **2026-11-21 · Site before the M4 gate.** The project lead asked for a local preview site now. It stays a preview (noindex, mock prices, no deploy). The M4 "send it to a friend" gate still applies before any public deploy.
- **2026-11-22 · Domain, Astro site and deploys.** The site is `yourcoffeesetup.com` (Cloudflare Registrar). `site/` is now an Astro project (plain JS islands, no UI framework) that replaces the custom builder. The page shell is Astro; the data layer and HTML components in `site/lib` are loaded unbundled at build time, because the engine modules resolve their files relative to themselves. URLs stay `/en-us/…` and `/en-gb/…` on one domain with `hreflang`, and the root page is the x-default market chooser. Cloudflare Pages builds from GitHub: `main` builds production, other branches build noindex previews. The project lead chose to finish and deploy the site before the M4 gate. Production shows only `content/published/` (none yet), so the market homes show a holding message, and no draft reaches the live site until a post is published through a PR. GA4 uses Consent Mode v2 (denied by default in the UK, EEA and Switzerland until a consent banner exists) and sends `affiliate_click`, `tool_complete` and `scroll_depth`. Setup steps are in [deploy.md](deploy.md).
- **2026-11-22 · Workers instead of Pages.** The site deploys as a Cloudflare Worker with static assets (`wrangler.jsonc` at the repo root, no Worker code) built by Workers Builds, not Cloudflare Pages: Cloudflare no longer recommends Pages for new projects, and if the site later needs on-demand rendering (server islands, `prerender = false` pages, API endpoints) it adds `@astrojs/cloudflare` and a `main` entry to the same Worker instead of migrating. Client-side islands and vanilla scripts are static files and work either way. Build mode now reads `WORKERS_CI_BRANCH`; `*.workers.dev` addresses get `X-Robots-Tag: noindex`. `wrangler.jsonc` is a reader-facing path in `git-policy.json`. Wrangler is a dev dependency so builds use a pinned version.
- **2026-11-22 · GA4 through GTM.** The site loads Google Tag Manager instead of `gtag.js`, so tags change in the GTM container without a site PR. Consent defaults are still set in the page before GTM loads. Custom events go to `dataLayer` as `{ event, params }`, with the parameters nested so one event's values never carry into the next. GA4 tags, triggers and variables live in the container, and the setup is in [deploy.md](deploy.md). That container is now configuration that can reach readers, but it is outside the repo and outside the PR rule. A Google tag imported from a container file is not linked to its GA4 destination and sent nothing for four published versions (5–8), even though GTM Preview reported it as fired. Only a Google tag made in the GTM UI works, so the container file holds variables, triggers and event tags only, and is imported with Merge. Verify against live hits (`/g/collect`), not just Preview.
- **2026-11-21 · Scheduler.** Hourly launchd job in a dedicated clone on `main` (`docs/operations.md`).

- **2026-11-22 · Design and name.** The site uses design A3 (white, near-black, one cherry red, Schibsted Grotesk, rules not cards) and the name YourCoffeeSetup. The affiliate disclosure and the "not tested by us" note sit under the title, before any link. Preview builds show credited Unsplash mock photos from `site/assets/mock/`; production builds never copy them.

- **2026-11-22 · Homepage setup questionnaire: parked.** A "What's your setup?" picker (sentence form: "I have a [machine] and I want to [upgrade / fix / buy]", with the straight answer shown in place) is mocked up on the design canvas as A4. It waits until there are enough guides that most machine × intent combinations have a real answer; with 4 guides about half would show "Not answered yet". Revisit when each listed machine has guides for at least two intents.

- **2026-11-22 · One post for every market.** Per-market differences are data (card variants, offers, disclosures), not prose.

- **2026-11-23 · M0 done.** Subscription billing, about 8% of usage per run; the job environment has no API key.

- **2026-11-24 · Humans can stop what ships.** Passed posts merge themselves after a 24-hour veto window with green checks unless held (approved by the project lead). Site code and offers still need a human merge.
- **2026-11-24 · Reddit.** The Data API needs approval under Reddit's Responsible Builder Policy and the public JSON is blocked; apply, and lean on other sources until then.

## Open questions

- **Disclosure text per market (blocks the first publish):** `niches/coffee/niche.json` `disclosures` is empty. Decide the wording for US and GB after checking the affiliate programs you will join.

- **Offers as public paths:** `data/offers/` is treated as reader-facing because prices appear on the site, which would mean a PR for every daily price refresh. Revisit at M7: one option is to have the site read offers at build time from an internal file.
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

### 2026-11-25 · Demand from Reddit without Reddit
- Reddit closed every route for a new small project (API approval closed 2026-10-31, RSS ended 2026-11-13, public JSON 403, public API ends March 2027). The Reddit collector is removed.
- Replaced by two keyed sources in `engine/demand/collect.mjs`: community threads via Brave Search `site:` queries (search metadata only, the sites are never fetched) and YouTube comment questions. Both have monthly budgets counted from `data/demand/`, rotate queries daily, and report `skipped` without a key.
- Open question: Brave's terms on storing search results. We keep only titles, URLs, dates and snippets as internal research notes and never publish them; check the terms before anything from them reaches a reader.

### 2026-11-27 · Catalog mirror and more demand sources
- The coffee-catalog repository (its own hourly job) is now the first source of manufacturer facts. Every tick refreshes a read-only mirror in `catalog/` (gitignored) before planning; agents get a `catalog` listing and the research prompt reads it before the web. A failed refresh is logged (`catalog-sync`) and never stops a tick. The in-repo `library/` stayed empty and is now the fallback.
- Demand search is provider-based: Tavily (1,000 free credits a month) first, Serper (2,500 free once, Google results) second, Brave last. A provider that refuses hands the query to the next. Serper also returns Google's "People also ask" questions and related searches (`demandSignals.questions`). Autocomplete now uses question openings ("why is my …") as well as suffixes, up to 60 queries per collection; YouTube up to 6 searches per collection.
- Open question: storage terms. Brave's API terms (2026-09-01) forbid storing results beyond transient use, which our `data/demand/` files do; Tavily's and Serper's terms on keeping result snippets were not checked. We keep titles, URLs, dates and snippets as internal notes only and never publish them; check both terms before relying on them for long.
- Uncertain: whether Tavily's domain filter plus subreddit words finds subreddit threads as well as Google `site:` does. Compare `byProvider` yields in `data/demand/` after a week.

### 2026-11-27 · Disclosure is a footer placeholder, never a blocker
- Decision (project lead): one generic disclosure in the footer of every page (`DEFAULT_DISCLOSURE` in `site/lib/site-data.mjs`), overridden per market by `niche.json` `disclosures`. It no longer blocks the build or publishing, and nothing is shown above the content.
- Why it mattered: the three passed guides without offers had publishing PRs since 2026-11-24, but their `checks` failed because those branches were cut from a main where the production build refused to run without disclosure text. They need their branch updated from main to re-run checks.
- Open question, for when real affiliate links go live: Amazon Associates requires its own statement on the site, and UK advertising guidance (ASA/CAP) expects affiliate content to be identifiable as advertising, usually with an upfront label. A footer-only note may not be enough then; revisit before joining a programme.
