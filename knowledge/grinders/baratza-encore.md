# Baratza Encore

US variant `485-120V-A` as identified in Baratza’s US grinder catalog.

```json
{
  "schemaVersion": 1,
  "id": "baratza-encore",
  "name": "Baratza Encore",
  "category": "grinders",
  "updatedAt": "2026-11-21",
  "variants": [
    {
      "id": "485-120v-a",
      "sku": "485-120V-A",
      "markets": [
        "US"
      ]
    }
  ],
  "sources": [
    {
      "id": "baratza-us-product",
      "url": "https://www.baratza.com/en-us/product/encoretm-zcg485",
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
      "id": "baratza-us-burr-guide",
      "url": "https://www.baratza.com/en-us/landing/shop-by-burr-type",
      "type": "manufacturer",
      "accessedAt": "2026-11-21"
    }
  ],
  "claims": [
    {
      "id": "filter-suitability",
      "variantId": "485-120v-a",
      "statement": "Baratza positions the Encore for filter coffee, including pour-over.",
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
      "id": "burrs",
      "variantId": "485-120v-a",
      "statement": "Baratza identifies the Encore as a 40 mm conical-burr grinder.",
      "status": "supported",
      "verifiedAt": "2026-11-21",
      "evidence": [
        {
          "sourceId": "baratza-us-burr-guide",
          "locator": "Conical Burr and Recommended for Conical Burr"
        }
      ]
    }
  ]
}
```
