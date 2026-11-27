# Oracle Dual Boiler (Breville / Sage)

The current dual-boiler Oracle. The original Oracle (BES980) is listed as discontinued on Breville US. Researched for the upgrade-from-Barista-Express decision.

```json
{
  "schemaVersion": 1,
  "id": "breville-oracle-dual-boiler",
  "name": "Oracle Dual Boiler",
  "category": "machines",
  "updatedAt": "2026-11-25",
  "variants": [
    {"id": "bes995-us", "markets": ["US"], "name": "Breville Oracle Dual Boiler", "brand": "Breville", "sku": "BES995"},
    {"id": "ses995-gb", "markets": ["GB"], "name": "Sage Oracle Dual Boiler", "brand": "Sage", "sku": "SES995"}
  ],
  "sources": [
    {"id": "breville-us-bes995", "url": "https://www.breville.com/en-us/product/bes995", "type": "manufacturer", "accessedAt": "2026-11-25"},
    {"id": "sage-uk-bes995", "url": "https://www.sageappliances.com/en-gb/product/BES995", "type": "manufacturer", "accessedAt": "2026-11-25"},
    {"id": "breville-us-bes980", "url": "https://www.breville.com/en-us/product/bes980", "type": "manufacturer", "accessedAt": "2026-11-25"},
    {"id": "ozbargain-981985", "url": "https://www.ozbargain.com.au/node/981985", "type": "owner-report", "accessedAt": "2026-11-25"}
  ],
  "claims": [
    {
      "id": "dual-boilers-simultaneous",
      "statement": "The Oracle Dual Boiler's stainless steel dual boilers allow espresso extraction while steaming milk simultaneously.",
      "status": "supported",
      "verifiedAt": "2026-11-25",
      "evidence": [
        {"sourceId": "breville-us-bes995", "locator": "'Powerful stainless steel dual boilers allow you to extract the perfect espresso while steaming milk simultaneously'"},
        {"sourceId": "sage-uk-bes995", "locator": "'powerful stainless steel dual boilers for simultaneous extraction and steaming'"}
      ]
    },
    {
      "id": "pid-triple-heating",
      "statement": "Breville and Sage say the Oracle Dual Boiler's 'triple heating system features PID temperature control'. The Sage page says it adjusts in 1-degree steps.",
      "status": "supported",
      "verifiedAt": "2026-11-25",
      "evidence": [
        {"sourceId": "breville-us-bes995", "locator": "'The triple heating system features PID temperature control'"},
        {"sourceId": "sage-uk-bes995", "locator": "Triple heating / PID feature text"}
      ]
    },
    {
      "id": "grinder-auto-adjust",
      "statement": "The Oracle Dual Boiler has 'fully-integrated Baratza European Precision Burrs with 45 settings that adjust automatically for optimal results'.",
      "status": "supported",
      "verifiedAt": "2026-11-25",
      "evidence": [
        {"sourceId": "breville-us-bes995", "locator": "Grinder feature text"},
        {"sourceId": "sage-uk-bes995", "locator": "Grinder feature text; 'Electronic Grind Adjust'"}
      ]
    },
    {
      "id": "auto-grind-dose-tamp",
      "statement": "The Oracle Dual Boiler automatically grinds, doses and tamps each puck into a 'Professional 58mm stainless steel portafilter' that 'holds a 22g dose'.",
      "status": "supported",
      "verifiedAt": "2026-11-25",
      "evidence": [
        {"sourceId": "breville-us-bes995", "locator": "'it automatically grinds, doses & tamps each puck'; portafilter spec"},
        {"sourceId": "sage-uk-bes995", "locator": "'the machine automatically grinds, doses, and tamps each puck'; portafilter spec"}
      ]
    },
    {
      "id": "auto-milq",
      "statement": "The Oracle Dual Boiler's Auto MilQ 'delivers silky microfoam hands-free', with settings for dairy, soy, almond and oat. The Sage page also describes a Manual mode and a cool-touch steam wand.",
      "status": "supported",
      "verifiedAt": "2026-11-25",
      "evidence": [
        {"sourceId": "breville-us-bes995", "locator": "Auto MilQ feature text"},
        {"sourceId": "sage-uk-bes995", "locator": "Auto MilQ text; 'hands-on barista experience with Manual mode'; cool-touch steam wand"}
      ]
    },
    {
      "id": "original-oracle-discontinued-us",
      "statement": "Breville's US page for the original Oracle (BES980), which also had a dual boiler, auto grind/dose/tamp and Auto MilQ, says 'This model has been discontinued.'",
      "status": "supported",
      "verifiedAt": "2026-11-25",
      "evidence": [{"sourceId": "breville-us-bes980", "locator": "Page notice 'This model has been discontinued'; feature text 'Stainless Steel Dual Boiler', 'automatically grinds, doses and tamps 22 grams'"}],
      "note": "UK status of the original Sage Oracle was seen only in search snippets (Sage page and John Lewis marking BES980 discontinued or unavailable) and was not fetched."
    },
    {
      "id": "owner-oracle-workflow",
      "statement": "In a November 2026 OzBargain thread about an Oracle deal, owners of the original Oracle said they 'Much prefer the workflow of the oracle over a dual boiler and separate grinder, its quicker and less mess', and called one-touch milk during extraction 'a game changer'. Others called the built-in grinder 'a bit meh' and kept an external grinder. One said the grinder is 'only a pain with multiple coffees' because grinds after the first come out coarser and need about one step finer. A six-year Barista Express owner in the thread asked whether to choose the Oracle or the Oracle Jet and got no direct answer.",
      "status": "supported",
      "verifiedAt": "2026-11-25",
      "evidence": [{"sourceId": "ozbargain-981985", "locator": "noise36 07/11/2026 09:51 and 16:25; 16k-zx81 07/11/2026 11:53 and 12:06; serpserpserp 07/11/2026 11:59 and 13:27; mirz 08/11/2026 (question)"}],
      "note": "These reports are about the original Oracle (BES980), not the Oracle Dual Boiler (BES995) or the Oracle Jet. They are owner opinions, not measurements."
    }
  ]
}
```
