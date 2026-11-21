# Baratza Virtuoso+

US variant `587-120V-A` as identified in Baratza’s US grinder catalog.

```json
{
  "schemaVersion": 1,
  "id": "baratza-virtuoso-plus",
  "name": "Baratza Virtuoso+",
  "category": "grinders",
  "updatedAt": "2026-11-21",
  "variants": [
    {
      "id": "587-120v-a",
      "sku": "587-120V-A",
      "markets": [
        "US"
      ]
    }
  ],
  "sources": [
    {
      "id": "baratza-us-product",
      "url": "https://www.baratza.com/en-us/product/virtuosotm-zcg587",
      "type": "manufacturer",
      "accessedAt": "2026-11-21"
    },
    {
      "id": "baratza-us-catalog",
      "url": "https://www.baratza.com/en-us/shop/grinders",
      "type": "manufacturer",
      "accessedAt": "2026-11-21"
    },
    {
      "id": "baratza-us-brew-guide",
      "url": "https://www.baratza.com/en-us/landing/shop-by-brew-method",
      "type": "manufacturer",
      "accessedAt": "2026-11-21"
    }
  ],
  "claims": [
    {
      "id": "burrs",
      "variantId": "587-120v-a",
      "statement": "Baratza identifies the burr as the M2.",
      "status": "supported",
      "verifiedAt": "2026-11-21",
      "evidence": [
        {
          "sourceId": "baratza-us-product",
          "locator": "Details"
        }
      ]
    },
    {
      "id": "timed-dosing",
      "variantId": "587-120v-a",
      "statement": "The timer can be set in 0.1-second increments.",
      "status": "supported",
      "verifiedAt": "2026-11-21",
      "evidence": [
        {
          "sourceId": "baratza-us-product",
          "locator": "Details"
        }
      ]
    },
    {
      "id": "pour-over-suitability",
      "variantId": "587-120v-a",
      "statement": "Baratza recommends the Virtuoso+ for pour-over.",
      "status": "supported",
      "verifiedAt": "2026-11-21",
      "evidence": [
        {
          "sourceId": "baratza-us-brew-guide",
          "locator": "Recommended for Pour-over"
        }
      ]
    }
  ]
}
```
