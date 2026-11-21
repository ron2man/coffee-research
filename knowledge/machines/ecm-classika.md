# ECM Classika

```json
{
  "schemaVersion": 1,
  "id": "ecm-classika",
  "name": "ECM Classika",
  "category": "machines",
  "updatedAt": "2026-11-21",
  "variants": [
    {
      "id": "classika-pid-gb",
      "markets": [
        "GB"
      ]
    }
  ],
  "sources": [
    {
      "id": "manufacturer-product",
      "url": "https://www.ecm.de/en/products/classika-pid/",
      "type": "manufacturer",
      "accessedAt": "2026-11-21"
    },
    {
      "id": "manufacturer-manual",
      "url": "https://www.ecm.de/wp-content/uploads/2025/04/BA_Classika_-PID_2412-web.pdf",
      "type": "manufacturer",
      "accessedAt": "2026-11-21"
    }
  ],
  "claims": [
    {
      "id": "boiler-and-temperature-control",
      "statement": "ECM specifies a single boiler on the Classika PID, with PID adjustment of the boiler temperature for espresso and steam.",
      "status": "supported",
      "verifiedAt": "2026-11-21",
      "evidence": [
        {
          "sourceId": "manufacturer-product",
          "locator": "Technical Data — System and Details — PID control"
        }
      ]
    },
    {
      "id": "included-baskets",
      "statement": "ECM lists a 7 g single basket, a 14 g double basket, and a blind basket for the Classika PID.",
      "status": "supported",
      "verifiedAt": "2026-11-21",
      "evidence": [
        {
          "sourceId": "manufacturer-product",
          "locator": "Included in the box — baskets"
        }
      ]
    },
    {
      "id": "shot-timer",
      "statement": "ECM says the Classika PID display shows espresso shot time in seconds.",
      "status": "supported",
      "verifiedAt": "2026-11-21",
      "evidence": [
        {
          "sourceId": "manufacturer-product",
          "locator": "Details — espresso shot time display"
        }
      ]
    },
    {
      "id": "catalog-item-and-boiler",
      "statement": "ECM lists item CM100003-00 with an approximately 0.75 L stainless steel boiler.",
      "status": "supported",
      "verifiedAt": "2026-11-21",
      "evidence": [
        {
          "sourceId": "manufacturer-product",
          "locator": "Technical Data — Hardware and Item no."
        }
      ]
    },
    {
      "id": "catalog-brew-readiness",
      "statement": "ECM advertises 11 minutes to brew readiness for the currently listed Classika PID and lists Fast Heat-Up mode.",
      "status": "supported",
      "verifiedAt": "2026-11-21",
      "evidence": [
        {
          "sourceId": "manufacturer-product",
          "locator": "Details heading and Technical Data — Software"
        }
      ]
    },
    {
      "id": "fast-heat-up-flush",
      "statement": "For the Fast Heat-Up sequence in the Classika PID manual for item CM100003-00, ECM instructs users to flush at FLU until the display shows rdY/Go, the cue for brewing the first cup.",
      "status": "supported",
      "verifiedAt": "2026-11-21",
      "evidence": [
        {
          "sourceId": "manufacturer-manual",
          "locator": "PDF page 26, English §6.1, steps 5–6"
        }
      ]
    },
    {
      "id": "gb-electrical-rating",
      "statement": "ECM lists the UK Classika PID at 230 V and 50 Hz.",
      "status": "supported",
      "verifiedAt": "2026-11-21",
      "evidence": [
        {
          "sourceId": "manufacturer-manual",
          "locator": "PDF page 24, English §3.2, UK voltage and frequency rows"
        }
      ],
      "variantId": "classika-pid-gb"
    }
  ]
}
```
