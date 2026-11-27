# Oracle Jet (Breville / Sage)

Automated machine with a built-in grinder and auto milk, heated by a ThermoJet rather than boilers. Researched for the upgrade-from-Barista-Express decision.

```json
{
  "schemaVersion": 1,
  "id": "breville-oracle-jet",
  "name": "Oracle Jet",
  "category": "machines",
  "updatedAt": "2026-11-25",
  "variants": [
    {"id": "bes985-us", "markets": ["US"], "name": "Breville the Oracle Jet", "brand": "Breville", "sku": "BES985"},
    {"id": "ses985-gb", "markets": ["GB"], "name": "Sage the Oracle Jet", "brand": "Sage", "sku": "SES985"}
  ],
  "sources": [
    {"id": "breville-us-bes985", "url": "https://www.breville.com/en-us/product/bes985", "type": "manufacturer", "accessedAt": "2026-11-25"},
    {"id": "sage-uk-bes985", "url": "https://prod-next.sageappliances.com/en-gb/product/bes985", "type": "manufacturer", "accessedAt": "2026-11-25"}
  ],
  "claims": [
    {
      "id": "thermojet-not-boiler",
      "statement": "The Oracle Jet heats with a ThermoJet ('Digitally printed heating circuit'), not boilers.",
      "status": "supported",
      "verifiedAt": "2026-11-25",
      "evidence": [
        {"sourceId": "breville-us-bes985", "locator": "ThermoJet feature: 'Digitally printed heating circuit, up to 44.3% more energy efficient when compared to a Thermoblock heating system'"},
        {"sourceId": "sage-uk-bes985", "locator": "'ThermoJet® heating system' feature text"}
      ],
      "note": "Both pages give inconsistent efficiency figures (32% in the summary, 44.3% in the feature). Don't cite either."
    },
    {
      "id": "auto-grind-dose-tamp",
      "statement": "The Oracle Jet will 'Auto grind, dose & tamp' into a 'Professional 58 mm stainless steel portafilter' that 'holds a 22g dose'.",
      "status": "supported",
      "verifiedAt": "2026-11-25",
      "evidence": [
        {"sourceId": "breville-us-bes985", "locator": "'Auto grind, dose & tamp into the professional-style 58 mm portafilter'; 'Professional 58 mm stainless steel portafilter holds a 22g dose'"},
        {"sourceId": "sage-uk-bes985", "locator": "Same wording on the Sage UK page"}
      ]
    },
    {
      "id": "grinder-45-settings",
      "statement": "The Oracle Jet has a 'Fully-integrated high carbon hardened steel precision burr grinder with 45 grind settings', described as using Baratza European Precision Burrs.",
      "status": "supported",
      "verifiedAt": "2026-11-25",
      "evidence": [
        {"sourceId": "breville-us-bes985", "locator": "Grinder feature text and 'Auto grind, dose & tamp with Baratza European Precision Burrs'"},
        {"sourceId": "sage-uk-bes985", "locator": "Grinder feature text, '45 grind settings'"}
      ]
    },
    {
      "id": "auto-milq",
      "statement": "The Oracle Jet's Auto MilQ gives hands-free microfoam with settings for dairy, soy, almond and oat. The US page lists adjustable temperatures (104°F to 167°F) and 8 texture levels.",
      "status": "supported",
      "verifiedAt": "2026-11-25",
      "evidence": [
        {"sourceId": "breville-us-bes985", "locator": "Auto MilQ feature: 'Adjustable temperatures (104°F to 167°F) and 8 texture levels'"},
        {"sourceId": "sage-uk-bes985", "locator": "Auto MilQ: 'settings optimised for dairy, soy, almond and oat'"}
      ]
    },
    {
      "id": "simultaneous-brew-steam",
      "statement": "Whether the Oracle Jet can extract espresso and steam milk at the same time.",
      "status": "unknown",
      "verifiedAt": "2026-11-25",
      "evidence": [
        {"sourceId": "breville-us-bes985", "locator": "'Auto Queue': 'Seamlessly initiate the automatic steaming of your milk or extraction of your espresso'"}
      ],
      "note": "The page describes queued steps, not simultaneous operation, and doesn't say either way. The instruction booklet (SES985 EU UG8 C26) was not read."
    }
  ]
}
```
