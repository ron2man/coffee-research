# Local research pilot

Grow the knowledge base to 10 machines and 10 grinders, then refresh a sample of cards to verify repeat runs preserve identities and avoid duplicates. The existing cards count toward the batch.

1. Read the implementation plan and the format in `knowledge/README.md`. Check the existing cards before selecting candidates.
2. Run `node agent/research-plan.mjs --limit 5` from the repository root. The `batch` lists due refreshes followed by new products. Use the `openClaims` report to choose evidence gaps for a focused follow-up. Edit `agent/research-queue.json` to add candidates and record where they came from. The machine mapping summary supplies model names. Each specification must be verified against a source for that model and variant. Preserve existing product IDs.
3. For each product, research a small set of facts that affect purchase decisions. For machines, check portafilter size, basket type when identifiable, and milk or workflow features. For grinders, check stated espresso suitability and how the adjustment works. Record the source URL and a precise locator for each piece of evidence. Attribute manufacturer specifications and guidance to the manufacturer. Record gaps and disputes using the card format.
4. Update the existing card during a refresh. Change a verification date after rechecking the claim. Run `node agent/validate-knowledge.mjs` and sample cards to verify that the sources support the claims for the stated models.
5. Rerun the planner to check that the updated cards are current. Report how many cards were added and refreshed, remaining gaps, elapsed time, and any available cost data. Add lessons that affect future runs to the learning log.

The first pilot run writes local files. After a successful refresh, verify that an authorized run can commit and push from a working branch, then enable scheduling.
