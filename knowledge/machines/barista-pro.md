# Barista Pro

These claims were researched for the built-in grinder troubleshooter. Breville's instruction booklets could not be read in this research pass because the PDFs failed to extract. The upper-burr procedure, range and warranty claims are recorded as gaps.

```json
{
  "schemaVersion": 1,
  "id": "barista-pro",
  "name": "Barista Pro",
  "category": "machines",
  "updatedAt": "2026-11-22",
  "variants": [
    {
      "id": "bes878-us",
      "sku": "BES878",
      "markets": ["US"]
    },
    {
      "id": "ses878-gb",
      "sku": "SES878",
      "markets": ["GB"]
    }
  ],
  "sources": [
    {
      "id": "breville-us-grind-tutorial",
      "url": "https://breville.com/inspiration/en-us/tutorials/the-barista-pro/first-time-setup/how-to-adjust-grind-size",
      "type": "manufacturer",
      "accessedAt": "2026-11-22"
    },
    {
      "id": "breville-us-manual-q26",
      "url": "https://assets.breville.com/BES878/BES878_USCM_IB_Q26_LR.pdf",
      "type": "manufacturer",
      "accessedAt": "2026-11-22"
    },
    {
      "id": "williams-sonoma-bes878-manual",
      "url": "https://www.williams-sonoma.com/netstorage/pdf/Breville-Barista-Pro-BES878-User-Manual.pdf",
      "type": "merchant",
      "accessedAt": "2026-11-22"
    },
    {
      "id": "singletrack-refurb-thread",
      "url": "https://singletrackworld.com/forum/off-topic/sage-breville-barista-pro-grinder/",
      "type": "owner-report",
      "accessedAt": "2026-11-22"
    },
    {
      "id": "brewing-with-dani-inner-burr",
      "url": "https://daffodil-seal-3z25.squarespace.com/blog/how-to-adjust-the-inner-burr-and-grind-finer-on-the-sage/breville-home-espresso-machines",
      "type": "owner-report",
      "accessedAt": "2026-11-22"
    },
    {
      "id": "ricambi-upper-burr-sp0027464",
      "url": "https://www.ricambi.com.au/breville-barista-express-upper-burr-from-pdc-1926",
      "type": "merchant",
      "accessedAt": "2026-11-22"
    }
  ],
  "claims": [
    {
      "id": "grind-settings-start-15",
      "variantId": "bes878-us",
      "statement": "Breville's US setup tutorial says the Barista Pro has 30 grind settings and recommends starting with setting 15, then adjusting.",
      "status": "supported",
      "verifiedAt": "2026-11-22",
      "evidence": [
        {
          "sourceId": "breville-us-grind-tutorial",
          "locator": "Page body: 'The Barista Pro™ has 30 grind settings. We recommend starting with setting 15 and adjust it accordingly.'"
        }
      ]
    },
    {
      "id": "owner-refurb-upper-burr-fix",
      "statement": "In one owner report (Singletrack forum, 30 Aug–1 Sep 2026), a refurbished Sage/Breville Barista Pro bought from Breville's eBay store produced gritty, chunky grounds and only a passable shot with the pressurised basket, with the internal burr at 2 and the dial at 2. The owner cleaned the grinder and set the internal (upper) burr to 1 with the dial at 2, then reported a 28-second shot that was 'WAY better'. Breville separately emailed to say it would send a new upper burr. That burr had not arrived by the last post, so the reported improvement came from cleaning and the burr setting, not from a new burr.",
      "status": "supported",
      "verifiedAt": "2026-11-22",
      "evidence": [
        {
          "sourceId": "singletrack-refurb-thread",
          "locator": "Original post 30/08/2026 (aphex_2k); owner updates 31/08/2026 and 01/09/2026 11:31 am ('WAY better', 'I'll accept the free part')"
        }
      ],
      "note": "This is one owner's experience, not a specification. Replies in the thread disagree: some say adjust or shim the burr, some say the internal burr isn't meant to be adjusted, and some say return the machine or buy a separate grinder."
    },
    {
      "id": "upper-burr-part-sp0027464",
      "statement": "An Australian parts seller lists a Breville upper (outer) burr, part SP0027464, for Barista Pro BES878 and Barista Express BES870 variants, among others. It is only for machines with a 1926 PDC batch date or later (2019 week 26 onwards). The batch date is on the model sticker underneath the machine.",
      "status": "supported",
      "verifiedAt": "2026-11-22",
      "evidence": [
        {
          "sourceId": "ricambi-upper-burr-sp0027464",
          "locator": "Product listing: Part No. SP0027464; compatibility list; 'MAKE SURE ITS FROM 1926 PDC (2019 Week 26 onwards)'"
        }
      ],
      "note": "This is merchant evidence for a listing only. The seller is in Australia (AUD pricing, RRP $241.95 at access). Breville US part availability, US price and fitment were not checked against a Breville source."
    },
    {
      "id": "upper-burr-procedure",
      "statement": "Breville's documented procedure for repositioning the Barista Pro upper burr, including the steps, the range of numbered positions and any warnings.",
      "status": "unknown",
      "verifiedAt": "2026-11-22",
      "evidence": [
        {
          "sourceId": "breville-us-manual-q26",
          "locator": "Not read: PDF text could not be extracted"
        },
        {
          "sourceId": "williams-sonoma-bes878-manual",
          "locator": "Not read: PDF text could not be extracted"
        }
      ],
      "note": "I could not read the Breville booklets (compressed PDFs, no renderer available), and ManualsLib returned 403. Search snippets suggest the booklet has an 'Adjusting conical burrs' section that recommends one adjustment at a time, but snippets are not evidence. A human needs to supply the booklet page text with page numbers."
    },
    {
      "id": "upper-burr-factory-position",
      "statement": "The factory upper-burr position on the Barista Pro.",
      "status": "unknown",
      "verifiedAt": "2026-11-22",
      "evidence": [
        {
          "sourceId": "brewing-with-dani-inner-burr",
          "locator": "Step list: '6 (default factory setting)'"
        }
      ],
      "note": "Only a blogger (Brewing With Dani, 2025) states a factory default of 6, and the post does not say which model it applies to. No manufacturer source was readable."
    },
    {
      "id": "upper-burr-warranty",
      "statement": "Whether Breville treats owner adjustment or replacement of the upper burr as affecting the warranty.",
      "status": "unknown",
      "verifiedAt": "2026-11-22",
      "evidence": [
        {
          "sourceId": "breville-us-manual-q26",
          "locator": "Not read: PDF text could not be extracted"
        }
      ],
      "note": "No readable Breville warranty or support text addresses this. In the Singletrack report, Breville offered to send a free upper burr to a refurbished-unit owner, which suggests the burr is a user-replaceable part. Breville's terms were not quoted."
    }
  ]
}
```
