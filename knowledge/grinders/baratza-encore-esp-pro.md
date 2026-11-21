# Baratza Encore ESP Pro

US variant `595-120V-A` as identified in Baratza’s US grinder catalog.

```json
{
  "schemaVersion": 1,
  "id": "baratza-encore-esp-pro",
  "name": "Baratza Encore ESP Pro",
  "category": "grinders",
  "updatedAt": "2026-11-21",
  "variants": [
    {
      "id": "595-120v-a",
      "sku": "595-120V-A",
      "markets": [
        "US"
      ]
    }
  ],
  "sources": [
    {
      "id": "baratza-us-product",
      "url": "https://www.baratza.com/en-us/product/encoretm-esp-pro-zcg595",
      "type": "manufacturer",
      "accessedAt": "2026-11-21"
    },
    {
      "id": "baratza-us-catalog",
      "url": "https://www.baratza.com/en-us/shop/grinders",
      "type": "manufacturer",
      "accessedAt": "2026-11-21"
    }
  ],
  "claims": [
    {
      "id": "grind-adjustment",
      "variantId": "595-120v-a",
      "statement": "Baratza describes a stepless adjustment range that covers espresso and pour-over.",
      "status": "supported",
      "verifiedAt": "2026-11-21",
      "evidence": [
        {
          "sourceId": "baratza-us-product",
          "locator": "Details — stepless grind adjustment"
        }
      ]
    },
    {
      "id": "single-dosing",
      "variantId": "595-120v-a",
      "statement": "Baratza lists an automatic stop feature for single dosing.",
      "status": "supported",
      "verifiedAt": "2026-11-21",
      "evidence": [
        {
          "sourceId": "baratza-us-product",
          "locator": "Details — Auto-Stop Grinding"
        }
      ]
    },
    {
      "id": "timed-dosing",
      "variantId": "595-120v-a",
      "statement": "The grinder has a timer with 0.1-second precision.",
      "status": "supported",
      "verifiedAt": "2026-11-21",
      "evidence": [
        {
          "sourceId": "baratza-us-product",
          "locator": "Details — timer"
        }
      ]
    }
  ]
}
```
