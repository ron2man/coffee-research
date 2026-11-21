# Baratza Sette 30

US variant `1130-120V-B` as identified in Baratza’s US grinder catalog.

```json
{
  "schemaVersion": 1,
  "id": "baratza-sette-30",
  "name": "Baratza Sette 30",
  "category": "grinders",
  "updatedAt": "2026-11-21",
  "variants": [
    {
      "id": "1130-120v-b",
      "sku": "1130-120V-B",
      "markets": [
        "US"
      ]
    }
  ],
  "sources": [
    {
      "id": "baratza-us-product",
      "url": "https://www.baratza.com/en-us/product/settetm-30-zcg1130",
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
      "id": "manual",
      "url": "https://assets.breville.com/ZCG1130/manual-sette30-en-v3.pdf",
      "type": "manufacturer",
      "accessedAt": "2026-11-21"
    }
  ],
  "claims": [
    {
      "id": "espresso-suitability",
      "variantId": "1130-120v-b",
      "statement": "Baratza presents the Sette 30 as an espresso grinder.",
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
      "id": "starting-settings",
      "variantId": "1130-120v-b",
      "statement": "Baratza gives grind setting 10 for espresso and 25 for manual brewing as starting points.",
      "status": "supported",
      "verifiedAt": "2026-11-21",
      "evidence": [
        {
          "sourceId": "manual",
          "locator": "Starting Settings, printed page 6"
        }
      ]
    }
  ]
}
```
