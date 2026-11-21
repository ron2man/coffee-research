# Sage Dual Boiler

```json
{
  "schemaVersion": 1,
  "id": "sage-dual-boiler",
  "name": "Sage Dual Boiler",
  "category": "machines",
  "updatedAt": "2026-11-21",
  "variants": [
    {
      "id": "dual-boiler-gb",
      "markets": [
        "GB"
      ]
    }
  ],
  "sources": [
    {
      "id": "manufacturer-product",
      "url": "https://www.sageappliances.com/en-gb/product/bes920",
      "type": "manufacturer",
      "accessedAt": "2026-11-21"
    }
  ],
  "claims": [
    {
      "id": "portafilter-diameter",
      "variantId": "dual-boiler-gb",
      "statement": "Sage lists a 58 mm stainless steel portafilter.",
      "status": "supported",
      "verifiedAt": "2026-11-21",
      "evidence": [
        {
          "sourceId": "manufacturer-product",
          "locator": "Technical Specifications — Accessories — Included Accessories"
        }
      ]
    },
    {
      "id": "included-baskets",
      "variantId": "dual-boiler-gb",
      "statement": "Sage lists one-cup and two-cup baskets in both single-wall and dual-wall versions.",
      "status": "supported",
      "verifiedAt": "2026-11-21",
      "evidence": [
        {
          "sourceId": "manufacturer-product",
          "locator": "Technical Specifications — Accessories — Included Accessories"
        }
      ]
    },
    {
      "id": "simultaneous-brewing-and-steaming",
      "variantId": "dual-boiler-gb",
      "statement": "Sage specifies that the dual-boiler system can brew espresso and deliver steam simultaneously.",
      "status": "supported",
      "verifiedAt": "2026-11-21",
      "evidence": [
        {
          "sourceId": "manufacturer-product",
          "locator": "The Dual Boiler heating system delivers simultaneous extraction & steam and a heated group head"
        }
      ]
    }
  ]
}
```
