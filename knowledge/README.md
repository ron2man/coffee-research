# Product knowledge base

Store each card in the folder for its category. Categories are listed in `niches/coffee/niche.json` (currently `machines/`, `grinders/` and `accessories/`). Name each card after its product ID with a `.md` extension. A card contains one fenced JSON block and can include a Markdown heading and summary. Use `YYYY-MM-DD` for dates.

This example uses placeholder data.

```json
{
  "schemaVersion": 1,
  "id": "example-machine",
  "name": "Example Machine",
  "category": "machines",
  "updatedAt": "2026-11-21",
  "variants": [{"id": "example-eu", "markets": ["DE", "ES", "IT"]}],
  "sources": [{"id": "manual", "url": "https://example.com/manual", "type": "manufacturer", "accessedAt": "2026-11-21"}],
  "claims": [{
    "id": "included-basket",
    "variantId": "example-eu",
    "statement": "The package includes one basket.",
    "status": "supported",
    "verifiedAt": "2026-11-21",
    "evidence": [{"sourceId": "manual", "locator": "Page 3"}]
  }]
}
```

Variants may carry the market's own product `name` (for example the brand it is sold under there), `brand` and `sku`. Posts are written once for every market and name products with `{{product:<id>}}`, which the site fills in per market from these fields.

Source types are `manufacturer`, `professional-test`, `owner-report`, and `merchant`.

- A `supported` claim needs at least one piece of evidence.
- A `disputed` claim needs at least two distinct sources and a `note` describing the disagreement.
- An `unknown` claim needs a `note` describing the gap and can include sources that were checked.

Omit `variantId` for a claim that applies at the product level. `verifiedAt` records when the claim status was checked, including checks that left a gap unresolved.

Run `node agent/validate-knowledge.mjs` from the repository root, optionally passing another knowledge directory as an argument. The validator checks card structure and internal references. During research, check that each source supports the claim for the stated product and variant.
