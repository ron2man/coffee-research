# Baratza Forté BG

US variant `1086-120V-B` as identified in Baratza’s US grinder catalog.

```json
{
  "schemaVersion": 1,
  "id": "baratza-forte-bg",
  "name": "Baratza Forté BG",
  "category": "grinders",
  "updatedAt": "2026-11-21",
  "variants": [
    {
      "id": "1086-120v-b",
      "sku": "1086-120V-B",
      "markets": [
        "US"
      ]
    }
  ],
  "sources": [
    {
      "id": "baratza-us-product",
      "url": "https://www.baratza.com/en-us/product/fortetm-bg-zcg1086",
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
      "url": "https://assets.breville.com/ZCG1085/manual-forteapbg-v4-EN-082422.pdf",
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
      "variantId": "1086-120v-b",
      "statement": "Baratza specifies 54 mm flat steel burrs.",
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
      "id": "dosing-presets",
      "variantId": "1086-120v-b",
      "statement": "The Forté provides three programmable presets for weight-based dosing and three for time-based dosing.",
      "status": "supported",
      "verifiedAt": "2026-11-21",
      "evidence": [
        {
          "sourceId": "manual",
          "locator": "Adjusting a Preset, printed page 8"
        }
      ]
    },
    {
      "id": "pour-over-suitability",
      "variantId": "1086-120v-b",
      "statement": "Baratza recommends the Forté BG for pour-over.",
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
