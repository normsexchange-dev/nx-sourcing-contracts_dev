# Sourcing Workflow

This document governs WTS-oriented lead records. WTB candidates use `WTB_CANDIDATE_WORKFLOW.md`; neither workflow grants sourcing, outreach, or publication authority.

## 1. Discover

Identify a public business source without bypassing access controls or platform restrictions. Do not perform outreach. Create a stable lead ID for the observation; the ID identifies a lead record, not a company or marketplace listing.

## 2. Record sourced facts

Capture only public business facts needed by the contract. Each factual evidence entry includes its own stable evidence ID, concise claim, controlled `source_type`, source URL, and `observed_at` timestamp. An optional concise `source_language` may identify the source language without inventing or translating facts. The record also lists its source URLs and overall observation time.

Do not infer missing facts. Optional information stays absent or `null` when unavailable.

## 3. Separate assessment

Keep any agent assessment separate from factual evidence. An assessment may describe relevance or verification needs, but it must cite the evidence IDs on which it relies and must not claim seller authorization.

Use disposition signals conservatively:

- `none`: no public disposition signal observed;
- `possible_excess_inventory`: public facts suggest possible excess equipment but do not offer it for sale;
- `possible_liquidation`: public facts suggest a possible business or asset liquidation;
- `explicit_for_sale`: a public source explicitly offers relevant equipment for sale.

Even `explicit_for_sale` remains a lead-only signal and does not authorize a Norms listing.

## 4. Set workflow status

- `discovered`: newly observed and not yet verified;
- `needs_verification`: material facts or identity require more checking;
- `qualified`: public evidence meets the sourcing criteria for Norms review;
- `rejected`: unsuitable, unverifiable, duplicate, or outside scope.

Qualification is not seller authorization and is not publication approval.

## 5. Prepare an append-only batch

Package records under the matching contract version. Set `record_count` to the exact records-array length. Describe the research market without including private instructions or data. Treat the submitted batch as append-only.

If a record needs correction, issue a new stable lead record with `supersedes_lead_id`. Preserve the original submission.

## 6. Private review boundary

Submit actual batches only to a separately authorized private results system. No lead batch with real records belongs in this public contract repository.

Norms performs identity review, deduplication, evidence review, and any separately authorized outreach. Only Norms review plus confirmed seller authorization can initiate a distinct marketplace-ingestion process. External agents never create customers, sellers, WTS submissions, inventory, or public listings.

Private consumers must resolve the record's declared contract version to its immutable `contract-v<version>` tag, perform genuine Draft 2020-12 schema and format validation, and enforce the cross-record checks in `CONSUMER_VALIDATION.md`. Contract `0.2.0` resolves to `contract-v0.2.0`. Validation never grants listing or publication authority.
