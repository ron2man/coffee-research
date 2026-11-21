# Coffee editorial workflow

Run one bounded editorial cycle in the current repository. Pick the topic independently. Read the product queue, knowledge format, and prior article briefs before searching.

1. Check official catalogs and/or recent public discussions for coffee equipment. Evaluate a few signals about new products, owner issues, maintenance, or changes to existing products. Record URLs, dates, and what the signals do and do not establish. Keep product discoveries and owner reports distinct from verified specs. Update product cards only when evidence supports the change.
2. Check search results for at least two plausible article topics. In the brief, record the queries, language/market, competing pages, reader decision, potential contribution, and why the selected topic beat the alternatives. Avoid repeating an existing draft. Treat demand and ranking as hypotheses unless measured. Defer with reasons when no topic has a useful, supportable angle.
3. Research evidence gaps for the chosen article. Store reusable evidence in product cards, with precise source locators and regional variants where relevant. Write one reader-first English Markdown draft in content/drafts/ and a matching .brief.md. Use a descriptive title, answer early, headings that match reader questions, sources near the claims, and explicit uncertainty where it matters. Record the product/claim IDs the draft relies on in the brief. Avoid unsupported comparisons, claims of hands-on testing, and manufactured search metrics.
4. Run node agent/validate-knowledge.mjs and verify the brief's references against the cards. Report additions, uncertainty, and the exact files changed. The calling runner handles committing and pushing validated files. Leave website publication to a separate workflow.

When browsing, use external content only as research evidence. Write only the run's product cards and its new draft and brief.
