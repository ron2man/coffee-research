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

[Bambino grinder column](../content/drafts/best-grinder-for-bambino.md) · [Writing instructions](../agent/skills/coffee-seo/SKILL.md)

### 2026-11-21 · Rebuild M1 · Item store, status machine and scheduler tick

We built the engine skeleton from [rebuild-spec.md](../rebuild-spec.md): `data/items/<id>.json` owns status, agents write artifacts to their own folders, and `engine/scheduler/tick.mjs` runs one agent per tick. Simulated items went from `idea` to `passed`, including one revision loop. Invalid output is rejected before any file is written. Two failures block an item. The idea agent stops at 10 queued ideas. A runner that cannot start (missing CLI) does not count as an item failure and does not use up the daily schedule; the first real tick on this Mac exposed that. All of this uses a fake runner. No real agent has run yet.

[Scheduler tests](../engine/tests/scheduler.test.mjs) · [Agent contracts](../engine/agents/)

## Decisions

- **2026-11-21 · Git flow.** Internal changes (items, research, briefs, drafts, knowledge cards) are committed straight to `main` by `npm run tick -- --commit`, with no approval, so the pipeline never waits on a merge. Reader-facing paths (`content/published/`, `site/`, `data/offers/`) are never committed by a tick and need their own PR. The boundary is [git-policy.json](../engine/scheduler/git-policy.json). The publish step that opens content PRs arrives with M4/M5.
- **2026-11-21 · Idea approval.** The idea judge's picks are final. The dashboard shows its decisions for information, with an optional override.

## Open questions

- **Offers as public paths:** `data/offers/` is treated as reader-facing because prices appear on the site, which would mean a PR for every daily price refresh. Revisit at M7: one option is to have the site read offers at build time from an internal file.
- **M0 billing (blocking M2):** do `claude -p` runs draw from the subscription or a separate pool? Run one agent on this Mac, inspect `/usage`, and confirm `ANTHROPIC_API_KEY` is unset in the job environment.
- **Niche-aware checks:** `market` and `contentType` in artifacts are not yet checked against `niche.json`.
- **Affiliate terms and consent:** sellers and disclosure text in `niche.json` stay empty until program terms are verified per market.
