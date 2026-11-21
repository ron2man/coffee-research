# ECM Classika III

```json
{
  "schemaVersion": 1,
  "id": "ecm-classika-iii",
  "name": "ECM Classika III",
  "category": "machines",
  "updatedAt": "2026-11-21",
  "variants": [
    {
      "id": "classika-iii-gb",
      "markets": [
        "GB"
      ]
    }
  ],
  "sources": [
    {
      "id": "manufacturer-product",
      "url": "https://www.ecm.de/en/products/classika-iii/",
      "type": "manufacturer",
      "accessedAt": "2026-11-21"
    },
    {
      "id": "manufacturer-introduction",
      "url": "https://www.ecm.de/en/ecm-classika-iii-single-boiler-espresso-machine/",
      "type": "manufacturer",
      "accessedAt": "2026-11-21"
    },
    {
      "id": "manufacturer-manual",
      "url": "https://www.ecm.de/wp-content/uploads/2026/08/BA_Classika-III-web.pdf",
      "type": "manufacturer",
      "accessedAt": "2026-11-21"
    }
  ],
  "claims": [
    {
      "id": "successor",
      "statement": "ECM identifies the Classika III as the successor to the Classika PID.",
      "status": "supported",
      "verifiedAt": "2026-11-21",
      "evidence": [
        {
          "sourceId": "manufacturer-introduction",
          "locator": "Opening paragraph"
        }
      ]
    },
    {
      "id": "catalog-item-and-boiler",
      "statement": "ECM lists item CM100024-00 with an approximately 0.5 L stainless steel boiler in a single-boiler system.",
      "status": "supported",
      "verifiedAt": "2026-11-21",
      "evidence": [
        {
          "sourceId": "manufacturer-product",
          "locator": "Technical data — System, Hardware and Item No."
        }
      ]
    },
    {
      "id": "core-heat-and-brew-readiness",
      "statement": "ECM advertises 6.5 minutes to brew readiness and attributes the faster warm-up to the ECM-61 Core Heat group with integrated heating cartridges. ECM also lists Fast Heat-Up mode.",
      "status": "supported",
      "verifiedAt": "2026-11-21",
      "evidence": [
        {
          "sourceId": "manufacturer-product",
          "locator": "Details opening paragraph and Technical data — Hardware and Software"
        }
      ]
    },
    {
      "id": "oled-and-control-dial",
      "statement": "ECM lists an OLED display and a rotary encoder that turns to navigate and presses to confirm.",
      "status": "supported",
      "verifiedAt": "2026-11-21",
      "evidence": [
        {
          "sourceId": "manufacturer-product",
          "locator": "Details opening paragraph and feature list"
        }
      ]
    },
    {
      "id": "brew-and-steam-modes",
      "statement": "ECM specifies PID adjustment for brewing and steaming and describes switching the single boiler between the two temperatures.",
      "status": "supported",
      "verifiedAt": "2026-11-21",
      "evidence": [
        {
          "sourceId": "manufacturer-product",
          "locator": "Details — PID and 500 ml boiler bullets"
        }
      ]
    },
    {
      "id": "startup-flush",
      "statement": "The Classika III v1.0 manual instructs users to run a five-second flush within 60 seconds if MAKE A FLUSH appears after heating.",
      "status": "supported",
      "verifiedAt": "2026-11-21",
      "evidence": [
        {
          "sourceId": "manufacturer-manual",
          "locator": "PDF pages 106 and 112, English §§9.2.2 and 9.8.1"
        }
      ]
    },
    {
      "id": "gb-electrical-rating",
      "statement": "The Classika III v1.0 manual lists 230 V AC, 50/60 Hz for the market group that includes the UK.",
      "status": "supported",
      "verifiedAt": "2026-11-21",
      "evidence": [
        {
          "sourceId": "manufacturer-manual",
          "locator": "PDF page 142, English §14, Power supply"
        }
      ],
      "variantId": "classika-iii-gb"
    }
  ]
}
```
