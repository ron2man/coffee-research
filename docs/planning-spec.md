# Coffee site implementation plan

## Goal

Turn questions about buying and using coffee equipment and beans into useful, evidence-based content. The system will maintain a product knowledge base in Git, find content opportunities, produce pages, and learn from search performance and on-site behavior. Research starts with espresso machines and grinders. Accessories and beans follow when demand and evidence justify coverage.

Track evidence coverage, research time and cost, impressions for relevant queries, and the share of eligible visits that lead to a merchant click. An outbound click measures a visit to a merchant. Track sales and revenue through affiliate reports when attribution data is available.

## Three workflows in one repository

| Workflow | Inputs | Outputs and decisions |
|---|---|---|
| Product Research | Candidate products, sources, requests from writers, and refresh dates | Product cards, variants, and evidence. Record gaps and conflicting claims for follow-up. |
| Content and SEO | Product knowledge, queries, market-specific search results, and Search Console data | Opportunities, briefs, articles, and revisions. Send focused research requests when evidence is missing. |
| Site and Conversion | Articles, merchant offers, event data, and sampled session recordings | Page templates, navigation, microcopy, localization, weekly findings, and experiments. |

One Codex setup can run all three workflows independently. The site workflow can design templates and plan measurement alongside research. The workflows exchange files with stable identifiers and version references. Pages will reference the products, claims, and research revision they rely on.

## Repository and operations

- `agent/` holds run instructions and validation tools. `knowledge/` holds product claims and sources. `site/` will hold the website and its publishable content. `docs/` holds decisions, lessons, and the implementation plan.
- Store one Markdown card per product with a machine-readable JSON block and an optional summary. Use stable product, variant, source, and claim IDs. Each claim records its statement, evidence status, verification date, and a precise locator for every cited source. Keep the card's update date separate from claim verification dates.
- Use manufacturer sources for specifications, professional tests for measured results, and owner reports for reported experiences. Preserve competing evidence when sources disagree. A gap or dispute that affects a recommendation holds that recommendation for review. Community reports can surface patterns and questions. Assess the strength of each source against the claim it supports.
- Research runs discover products, deduplicate by manufacturer and model, and deepen coverage as needed. Start with 10 machines and 10 grinders, then scale toward roughly 100 of each once the workflow is reliable. Use earlier market reports to find candidates and accessible sources to verify claims.
- Refresh runs check verification dates and source changes, update the affected claims, and identify affected pages. Record status by product, changes, errors, elapsed time, and available cost data. Retry failed items while retaining successful results. Repeated runs preserve existing identifiers. Commit validated updates to Git when files change.
- Run the pilot with local Codex. Once we verify source access and Git write permissions, schedule runs in a desktop worktree or run `codex exec` through a local scheduler. The host must be awake and online for local runs. Revisit remote execution and API access based on availability, throughput, and cost.
- Research updates and site deployments run independently. A research change can generate a proposed article update. Deployment uses content that has passed editorial, compatibility, link, and disclosure checks, with support for rolling back. Review a sample and approve templates early in the pilot. Expand automatic publishing to page types once their checks have proven reliable.
- Keep bulky source material and session recordings in their collection tools. Git holds claims, references, findings, and revision history. Check source availability, run costs, and time spent handling failures before increasing volume.

## Internal backoffice

The local backoffice reads the same files as the research workflows. It shows product cards with evidence, queue status, suggested next work, validation issues, unresolved claims, milestones, run history, and the learning log. It is read-only and binds to the loopback interface. The run history distinguishes planning from research execution. Connect future workflow events as discovery, research, and publishing are automated. Keep operational records local and the project learning log in Git.

## Topic selection, writing, and localization

Record the reader's question, language, market, observation date, gaps in search results, and evidence coverage for each opportunity. Prioritize a clear reader need, a gap in existing answers, the ability to support an answer, and a demand signal. State where the signal came from. When the evidence is sufficient, draft a direct answer with conditions and sources. Three candidate topics are choosing a grinder for an existing machine, diagnosing fast espresso flow, and deciding which component to upgrade. Research will determine which topics to pursue.

English is the initial working and editorial language. Model content language, target market, and product variant separately. Localized pages can adapt search phrasing, examples, and recommendations to local inventory and model differences. Prioritize translations based on local demand and product and merchant coverage. Adapt the interface, microcopy, and buying links to the target market. Each offer records its market, merchant, variant, and verified link. Rank products according to reader needs. Show stock and prices when reliable updates are available. Check affiliate terms, disclosures, and measurement settings for the chosen market before launch.

## Site experience, analytics, and experiments

Start with two mobile-friendly templates, a buying guide and a comparison page. Use two example pages to refine layout, editorial tone, and button copy. Where relevant, explain who a product suits, its limitations, and the buying options available in the target market.

The content workflow uses Search Console to prioritize topics and improve answers. The site workflow measures eligible visits, recommendation exposure, and merchant clicks. Include the page ID, button position, and experiment variant in event data. A weekly report connects each finding to its evidence, sample, and proposed change. Sample session recordings with personal data masked and appropriate consent settings. A recording can suggest a hypothesis. Event data and additional samples help estimate how often the issue occurs.

Start with organic traffic. When traffic supports a useful sample, test one change against a control with a predetermined metric, audience, duration, and decision rule. Sparse data leaves the result inconclusive. Consider Google Ads later for a defined hypothesis, with an approved budget and separate reporting for paid traffic.

## Project learning and reuse

Each workflow can add to the project learning log. Record the date, hypothesis, change, evidence, limitations, and follow-up. When a lesson becomes a lasting rule, update the relevant instruction or validation check.

A new niche can start with its own repository and deployment, using the coffee project as a starting point. Carry over the workflows and relevant lessons. Define niche-specific product fields, evidence sources, merchants, design, and reader questions. Treat findings about coffee content and conversion as hypotheses to test with the new audience. Extract shared code once there are two concrete use cases.

## Implementation milestones

| Phase | Deliverable | Verification before proceeding |
|---|---|---|
| 1. Knowledge foundation | Markdown format, validator, category directories, and learning log | Valid cards pass. Missing sources, invalid dates, and broken internal evidence references fail. |
| 2. Research batch | 10 machines and 10 grinders with evidence, a refresh run, and a run summary | Check stable IDs, evidence scoped to the right model, explicit gaps, and repeat runs without duplicates. Verify a local run before scheduling or pushing. |
| 3. Content and site preview | Three drafts and two preview templates | Verify search signals, claims, mobile readability, and click instrumentation. Template work can start during phase 2. |
| 4. Live pilot | 6–10 pages, search and click measurement, and affiliate links where available | Verify permissions, merchant market, deployment, and rollback. Track indexing, demand, clicks, and attribution separately over 60–90 days. |
| 5. Iteration and expansion | Broader product coverage, the first experiment when traffic allows, and staged localization | Track maintenance effort, reader value, and commercial contribution. Approve any ad spend before launch. |

The knowledge foundation and two initial product cards are in place. Choose the hosting provider, analytics tooling, affiliate programs, and first merchant market based on pilot needs and data.
