# Coffee Research

> **Rebuild in progress.** See [rebuild-spec.md](rebuild-spec.md) and [CLAUDE.md](CLAUDE.md). The new engine lives in `engine/` (`npm install`, `npm test`, `npm run validate`, `npm run tick -- --dry-run`). The `agent/` editorial pipeline below is legacy and is being replaced.

A workflow for coffee product research, editorial content, site publishing, and measurement.

- [Implementation plan](docs/planning-spec.md)
- [Product knowledge format](knowledge/README.md)
- [Research pilot](agent/research-pilot.md)
- [Project learning log](docs/learnings.md)

Validate the product cards with Node.js. There are no dependencies to install.

```sh
node agent/validate-knowledge.mjs
```

Generate the next local research batch as JSON.

```sh
node agent/research-plan.mjs --limit 5
node agent/research-plan.mjs --category machines --limit 3
```

The queue starts with 10 machines and 10 grinders. The planner checks product cards, lists refreshes before new products, and reports unresolved claims. The default refresh interval is 90 days from each claim's verification date. Use `--refresh-days` to override it. See the research pilot for how to act on the report.

## Local backoffice

Run `node backoffice/server.mjs` and open the printed loopback URL. The dashboard reads the local product cards, queue, roadmap, learning log, and recorded planner activity. The Drafts view shows article previews, brief metadata, review verdicts and scores, revision actions, and recorded GitHub commits. Refresh data after local changes. The server binds to the loopback interface and serves only the dashboard assets and its data endpoint.

Run `node agent/research-plan.mjs --limit 5 --record` to record a planner run in the dashboard. Run history lives in the ignored `.backoffice/runs.jsonl` file. A recorded planner run represents batch planning. The research runner can add its own events once integrated.

## Discover products

Run `node agent/discover-baratza.mjs` to preview candidates from Baratza's official US grinder catalog. Use `node agent/discover-baratza.mjs --apply` to add new models directly to the queue and record the run in the backoffice. Listings that match an existing model are skipped. A listing for a market outside a card's recorded variants is reported as a lead for separate verification. Each new candidate carries the manufacturer's catalog and product URLs. Discovery adds candidates for research.

## Run one editorial cycle

From a clean checkout, run `node agent/run-editorial.mjs`. Use the same command for a manual pilot or a local scheduler. The host needs Node.js, Git, a signed-in Codex CLI on its PATH, network access, and permission to push the current branch to `origin`. The workflow selects its own topic, validates knowledge and draft claim references, pushes accepted changes, and records the run locally. Files in `content/drafts/` are editorial drafts.

The editorial runner explicitly loads the repository's [coffee SEO skill](agent/skills/coffee-seo/SKILL.md). A separate read-only Codex invocation evaluates each draft against its brief and product evidence. Its `.review.json` is saved beside the draft, and the verdict appears in the backoffice run history. Pass, revise, and defer drafts are all retained in Git for review. Only a pass qualifies for a future website handoff. The runner stops before committing if a draft cannot be validated or the judge cannot return a valid review.

To judge drafts already in the repository, run `node agent/review-drafts.mjs`. Pass a draft slug to review a specific draft. Current verdicts are skipped by default. Legacy reviews and reviews whose inputs have changed are checked again. Add `--rejudge` to evaluate the current drafts again and preserve previous verdicts in review history. The command writes local review files for the backoffice without rerunning discovery, drafting, or Git sync.

The judge uses `revise` only for material, fixable blockers. A draft that clears the handoff standard can pass with optional improvements. When the judge returns `revise`, the editorial runner gives the draft, brief, and blocking actions to a fresh writer pass. It validates the revised evidence and runs the independent judge again. The second verdict is the current status. The first remains in review history. Each invocation makes at most one revision pass.

To apply that loop to an existing draft with a saved `revise` verdict, start from a clean checkout and run `node agent/run-editorial.mjs --revise linea-micra-cup-clearance` (replace the slug with the one you want). This mode uses the saved feedback and revisits the selected draft without searching for a new topic.

## Coffee Fieldnotes website preview

Run `node site/preview.mjs` and open `http://127.0.0.1:4180/`. Refresh the page after editing a draft, article manifest, or stylesheet. Restart the server after editing preview or renderer code. This preview reads only articles listed in [the site manifest](site/articles.json) and requires a saved passing review for each draft. The homepage lists included guides. The reviewed opening paragraph appears directly beneath the headline. A stale or failed review removes that guide from both the index and its route. Preview pages are marked noindex.

The future website agent can add approved entries to the manifest and improve the shared templates in `site/`. Manifest entries select the draft, slug, category and guide type. Headlines and summaries come directly from the reviewed article. Run the preview to check the rendered page before adding production hosting.


## Editorial commissioning and review

Each cycle researches a proposal in `content/opportunities/` before an independent read-only evaluation chooses `proceed`, `narrow`, or `research`. The decision is saved beside the proposal. A research decision queues the missing evidence and ends the cycle before drafting. A narrow decision commissions a smaller reader question and keeps the broader research task open. Research tasks appear in the planner JSON and the backoffice attention list. The planner checks all product cards for refresh, including discoveries outside the original queue.

For an existing brief, run `node agent/check-topic.mjs <slug>` to inspect its commissioning decision without changing the draft. The two pilot slugs are `ecm-classika-iii-vs-classika-pid` and `bambino-plus-cleaning-vs-descaling`.

The reader judge receives the rendered article in an isolated working directory. It poses a reader question, quotes the page, and records the action and unresolved details. The evidence judge then receives that result alongside the brief, referenced claims, and commissioning decision. Review fingerprints bind the article, brief, cited claims and sources, rubric, and rendered HTML together. Existing reviews without fingerprints show as out of date. Use `node agent/review-drafts.mjs` to migrate or refresh them.
