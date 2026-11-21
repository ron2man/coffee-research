# Baratza Forté AP

US variant `1085-120V-B` as identified in Baratza’s US grinder catalog.

```json
{
  "schemaVersion": 1,
  "id": "baratza-forte-ap",
  "name": "Baratza Forté AP",
  "category": "grinders",
  "updatedAt": "2026-11-21",
  "variants": [
    {
      "id": "1085-120v-b",
      "sku": "1085-120V-B",
      "markets": [
        "US"
      ]
    }
  ],
  "sources": [
    {
      "id": "baratza-us-product",
      "url": "https://www.baratza.com/en-us/product/fortetm-ap-zcg1085",
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
    }
  ],
  "claims": [
    {
      "id": "burrs",
      "variantId": "1085-120v-b",
      "statement": "Baratza specifies flat ceramic burrs for the Forté AP.",
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
      "variantId": "1085-120v-b",
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
      "id": "portafilter-holder",
      "variantId": "1085-120v-b",
      "statement": "The Forté AP comes with a portafilter holder. Weight-based dosing requires removing the holder to expose the scale platform for the grounds bin.",
      "status": "supported",
      "verifiedAt": "2026-11-21",
      "evidence": [
        {
          "sourceId": "manual",
          "locator": "Grinder Setup, steps 4–5, printed page 5"
        }
      ]
    }
  ]
}
```
