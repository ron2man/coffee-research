# Barista Pro

These claims were researched for the built-in grinder troubleshooter and the standalone-grinder guide. The current US instruction booklet (BES878 USCM Q26) was read page by page. It documents the upper-burr adjustment, but it does not give the number range, a factory position or a burr-contact warning.

```json
{
  "schemaVersion": 1,
  "id": "barista-pro",
  "name": "Barista Pro",
  "category": "machines",
  "updatedAt": "2026-11-24",
  "variants": [
    {
      "id": "bes878-us",
      "sku": "BES878",
      "markets": [
        "US"
      ],
      "name": "Breville Barista Pro",
      "brand": "Breville"
    },
    {
      "id": "ses878-gb",
      "sku": "SES878",
      "markets": [
        "GB"
      ],
      "name": "Sage the Barista Pro",
      "brand": "Sage"
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
    },
    {
      "id": "ricambi-upper-burr-sp0001801",
      "url": "https://www.ricambi.com.au/breville-coffee-machine-outer-upper-burr-grinder-k",
      "type": "merchant",
      "accessedAt": "2026-11-22"
    },
    {
      "id": "breville-us-bes878",
      "url": "https://www.breville.com/en-us/product/bes878",
      "type": "manufacturer",
      "accessedAt": "2026-11-24"
    },
    {
      "id": "sage-uk-bes878",
      "url": "https://www.sageappliances.com/en-gb/product/BES878",
      "type": "manufacturer",
      "accessedAt": "2026-11-24"
    }
  ],
  "claims": [
    {
      "id": "grind-settings-start-15",
      "variantId": "bes878-us",
      "statement": "Breville's US setup tutorial says the Barista Pro has 30 grind settings and recommends starting with setting 15, then adjusting. The US booklet also says the machine has 30 grind settings and that the default grind size is 15.",
      "status": "supported",
      "verifiedAt": "2026-11-22",
      "evidence": [
        {
          "sourceId": "breville-us-grind-tutorial",
          "locator": "Page body: 'The Barista Pro™ has 30 grind settings. We recommend starting with setting 15 and adjust it accordingly.'"
        },
        {
          "sourceId": "breville-us-manual-q26",
          "locator": "Page 13, 'Setting the Grind Size': 'This machine has 30 grind settings ... The default grind size is 15.'"
        }
      ]
    },
    {
      "id": "grind-dial-1-finest-30-coarsest",
      "variantId": "bes878-us",
      "statement": "On the Barista Pro's GRIND SIZE dial, setting 1 is the finest and 30 is the coarsest.",
      "status": "supported",
      "verifiedAt": "2026-11-22",
      "evidence": [
        {
          "sourceId": "breville-us-manual-q26",
          "locator": "Page 21, 'Advanced Cleaning for the Conical Burr Grinder', steps 2 and 4: 'Set GRIND SIZE to 1 (finest)', 'Set GRIND SIZE to 30 (coarsest)'"
        }
      ]
    },
    {
      "id": "upper-burr-adjustment-documented",
      "variantId": "bes878-us",
      "statement": "Breville's US booklet calls the adjustable upper burr 'a feature of your Barista Pro' that extends the grind range, because 'some types of coffee may require a wider grind range'. Its 15-step illustrated procedure is: unlock the hopper, empty the beans into a container, refit the hopper and run the grinder empty, remove the hopper, remove the upper burr, remove its wire handle, move the adjustable top burr one number coarser or finer, align the number with the handle opening, refit the handle, push the burr in firmly and lock it, refit and lock the hopper, then check the extraction. Breville recommends making only one adjustment at a time.",
      "status": "supported",
      "verifiedAt": "2026-11-22",
      "evidence": [
        {
          "sourceId": "breville-us-manual-q26",
          "locator": "Page 18, 'Adjusting Conical Burrs': intro text and illustrated steps 1–15 ('Move adjustable top burr, 1 number, coarser or finer'; 'We recommend making only one adjustment at a time.')"
        }
      ],
      "note": "The illustrations show the burr ring marked FINE and COARSE, but the booklet text does not give the number range, a factory position or any warning about burr contact."
    },
    {
      "id": "baskets-single-vs-dual-wall",
      "variantId": "bes878-us",
      "statement": "The Barista Pro comes with four filter baskets: two single wall and two dual wall. Breville says to use single-wall baskets when grinding fresh whole beans, because they let you experiment with grind, dose and tamp. Dual-wall baskets are for pre-ground coffee and 'regulate the pressure and help to optimize the extraction regardless of the grind, dose and tamp pressure or freshness'. The 1 cup basket is designed for about 8–11 g and the 2 cup for about 16–19 g. With a finer grind in the single-wall baskets, you may need to increase the grind amount.",
      "status": "supported",
      "verifiedAt": "2026-11-22",
      "evidence": [
        {
          "sourceId": "breville-us-manual-q26",
          "locator": "Page 12, 'Filter Baskets' and the following Note"
        }
      ]
    },
    {
      "id": "beans-roasted-on-5-20-days",
      "variantId": "bes878-us",
      "statement": "Breville recommends beans with a 'Roasted On' date (not a Best Before or Use By date), best used 5–20 days after roasting. It warns that 'stale coffee may pour too quickly from the portafilter and taste bitter and watery'. For pre-ground coffee, it says to use it within a week of grinding.",
      "status": "supported",
      "verifiedAt": "2026-11-22",
      "evidence": [
        {
          "sourceId": "breville-us-manual-q26",
          "locator": "Page 14, Note after 'Tamping the Ground Coffee'; page 25, Troubleshooting 'No crema' row"
        }
      ]
    },
    {
      "id": "extraction-guide-fast-shot",
      "variantId": "bes878-us",
      "statement": "Breville's extraction guide says espresso should start to flow after 8–12 seconds. If it flows in less than 7 seconds, either the basket is under-dosed or the grind is too coarse, which gives an under-extracted shot that is pale, thin, and sharp and watery. The fixes it gives are a finer grind, a larger grind amount, a 22–33 lb tamp, and a dose where the tamper's metal cap sits level with the basket rim after tamping.",
      "status": "supported",
      "verifiedAt": "2026-11-22",
      "evidence": [
        {
          "sourceId": "breville-us-manual-q26",
          "locator": "Page 15, 'Extracting Espresso' bullets and 'Under Extraction' column; page 14 Note on tamper cap level"
        }
      ]
    },
    {
      "id": "troubleshooting-runs-too-quickly",
      "variantId": "bes878-us",
      "statement": "The Barista Pro troubleshooting table lists three causes for 'Espresso runs out too quickly': coffee ground too coarsely (use a slightly finer grind), not enough coffee in the basket (increase the dose, then trim with the Razor tool), and coffee tamped too lightly (tamp at 22–33 lb). It does not list the burrs or the upper-burr position as a cause.",
      "status": "supported",
      "verifiedAt": "2026-11-22",
      "evidence": [
        {
          "sourceId": "breville-us-manual-q26",
          "locator": "Page 24, Troubleshooting, 'Espresso runs out too quickly'"
        }
      ]
    },
    {
      "id": "burr-cleaning-cycle",
      "variantId": "bes878-us",
      "statement": "Breville's grinder cleaning procedure involves emptying and running the grinder empty, then removing the top burr and brushing both burrs and the chute. Breville says it 'removes oil build-up on the burrs which can impede performance'. Advanced cleaning (removing the lower burr) is 'only required if there is a blockage', and the booklet warns that the burrs are extremely sharp.",
      "status": "supported",
      "verifiedAt": "2026-11-22",
      "evidence": [
        {
          "sourceId": "breville-us-manual-q26",
          "locator": "Page 21, 'Cleaning the Conical Burr Grinder' steps 1–12, 'Advanced Cleaning' intro and Warning"
        }
      ]
    },
    {
      "id": "no-green-or-under-roasted-beans",
      "variantId": "bes878-us",
      "statement": "Breville says the machine is designed only for whole roasted beans. It warns against grinding unroasted green or under-roasted beans, which 'are dense and not brittle enough to run through a burr grinder' and can 'damage or break burr grinders'.",
      "status": "supported",
      "verifiedAt": "2026-11-22",
      "evidence": [
        {
          "sourceId": "breville-us-manual-q26",
          "locator": "Page 12, 'The Grind' Note"
        }
      ]
    },
    {
      "id": "warranty-scope",
      "variantId": "bes878-us",
      "statement": "The booklet's Limited Product Warranty paragraph says Breville's warranty 'covers the repair or replacement if it's found to be defective due to faulty materials, workmanship, or function within the warranty period'. For the warranty length and full terms, it refers owners to breville.com or the Breville Service Center.",
      "status": "supported",
      "verifiedAt": "2026-11-22",
      "evidence": [
        {
          "sourceId": "breville-us-manual-q26",
          "locator": "Page 2, 'Limited Product Warranty'"
        }
      ],
      "note": "The full warranty terms on breville.com were not read."
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
      "id": "upper-burr-part-sp0001801",
      "statement": "The same Australian parts seller lists an earlier upper burr kit, part SP0001801, as 'the PRE 1926 PDC burr', and tells buyers to check the production date code before purchasing. Its 'Suits' list includes the Barista Pro BES878 and the Barista Express BES870.",
      "status": "supported",
      "verifiedAt": "2026-11-22",
      "evidence": [
        {
          "sourceId": "ricambi-upper-burr-sp0001801",
          "locator": "Product listing: 'Part No: SP0001801'; 'This is the PRE 1926 PDC burr, please check your production date code before purchasing'; Suits list"
        }
      ],
      "note": "This is merchant evidence only (AUD RRP $184.95 at access). The Barista Pro was launched around 2019, so few BES878 units may predate the 1926 PDC cut-off. The seller's list was not checked against Breville."
    },
    {
      "id": "upper-burr-procedure",
      "statement": "Breville's documented procedure for repositioning the Barista Pro upper burr, including the steps, the range of numbered positions and any warnings.",
      "status": "unknown",
      "verifiedAt": "2026-11-22",
      "evidence": [
        {
          "sourceId": "breville-us-manual-q26",
          "locator": "Page 18, 'Adjusting Conical Burrs'"
        },
        {
          "sourceId": "williams-sonoma-bes878-manual",
          "locator": "Not read: PDF text could not be extracted (earlier pass)"
        }
      ],
      "note": "Partly resolved on 2026-11-22. The steps and the one-adjustment-at-a-time advice are now supported in upper-burr-adjustment-documented. The booklet still gives no number range and no warnings (including burr contact), so this claim stays unknown for those parts."
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
        },
        {
          "sourceId": "breville-us-manual-q26",
          "locator": "Page 18, 'Adjusting Conical Burrs': no factory position stated"
        }
      ],
      "note": "The US booklet does not state a factory position. Only a blogger (Brewing With Dani, 2025) states a factory default of 6, without naming the model. Search snippets from Tom's Guide and Home-Barista also say 6, but neither page was readable and neither is a manufacturer source. Breville support would have to confirm it."
    },
    {
      "id": "upper-burr-warranty",
      "statement": "Whether Breville treats owner adjustment or replacement of the upper burr as affecting the warranty.",
      "status": "unknown",
      "verifiedAt": "2026-11-22",
      "evidence": [
        {
          "sourceId": "breville-us-manual-q26",
          "locator": "Page 2 'Limited Product Warranty' and page 18 'Adjusting Conical Burrs'"
        }
      ],
      "note": "The booklet presents upper-burr adjustment as an owner feature (page 18), which makes it unlikely that adjustment alone voids the warranty, but the warranty paragraph (page 2) says nothing about burrs. In the Singletrack report, Breville offered a free upper burr to a refurbished-unit owner. A direct answer from Breville US support is still needed."
    },
    {
      "id": "portafilter-54mm-gb",
      "variantId": "ses878-gb",
      "statement": "Sage lists a '54mm Portafilter' in the Barista Pro's accessories, so a standalone grinder's cradle or dosing cup has to suit 54 mm.",
      "status": "supported",
      "verifiedAt": "2026-11-24",
      "evidence": [
        {
          "sourceId": "sage-uk-bes878",
          "locator": "Accessories list: '54mm Portafilter'"
        }
      ],
      "note": "The US product page (read 2026-11-24) doesn't state the included portafilter size. It only promotes a separate 'Naked Portafilter 54mm' accessory. The US and UK machines share model number BES878, but the size was not confirmed on a US Breville page."
    },
    {
      "id": "builtin-grinder-baratza-burrs",
      "statement": "Breville and Sage describe the Barista Pro's integrated conical burr grinder as having 'Baratza European Precision Burrs with 30 grind settings'.",
      "status": "supported",
      "verifiedAt": "2026-11-24",
      "evidence": [
        {
          "sourceId": "breville-us-bes878",
          "locator": "Section heading 'Baratza European Precision Burrs with 30 grind settings'"
        },
        {
          "sourceId": "sage-uk-bes878",
          "locator": "'Baratza European Precision Burrs with 30 grind settings'"
        }
      ],
      "note": "No burr diameter is given. Whether these burrs match the Smart Grinder Pro's or the Barista Express's is not stated by any source checked."
    }
  ]
}
```
