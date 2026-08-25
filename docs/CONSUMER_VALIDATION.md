# Consumer Validation

Any private results repository or other consumer that accepts populated lead batches must validate every batch before caching, accepting, transforming, deduplicating, or ingesting it. A populated batch must never be committed to this public contract repository.

## Resolve the declared contract version

Consumers must select schemas from the immutable contract tag declared by `contract_version`. Contract `0.1.0` resolves to `contract-v0.1.0`; consumers must not substitute schemas from the mutable `main` branch. Unknown or unsupported contract versions must be rejected explicitly.

Cached and previously accepted records must still be validated against their declared contract version whenever they are read or processed. Prior acceptance is not a substitute for validation.

## Genuine JSON Schema validation

Consumers must perform genuine JSON Schema Draft 2020-12 validation against both the lead-batch and referenced lead-record schemas. Validation must include applicable URI and format checks, including `uri`, `email`, and `date-time`; merely parsing JSON or checking selected properties is insufficient.

Schema validation preserves the lead-only invariants. A validated record remains a lead—not a WTS listing, seller, customer, submission, inventory item, or authorization to publish. External agents and contract consumers cannot authorize marketplace publication.

## Required deterministic cross-record checks

After JSON Schema validation succeeds, consumers must also enforce all of these checks:

1. `record_count` equals `records.length`.
2. Every `lead_id` is unique within the batch.
3. Every `evidence_id` is unique within its lead's `factual_evidence` array.
4. Every ID in `agent_assessment.derived_from_evidence_ids` references an existing `factual_evidence.evidence_id` in the same lead.
5. Every `factual_evidence.source_url` also appears in that lead's top-level `source_urls` array.
6. `supersedes_lead_id` does not equal the record's own `lead_id`.

Failures must reject the affected batch or record deterministically; consumers must not invent, repair, or silently discard values to force acceptance. Corrections create a superseding append-only record under the applicable contract version.

## Security boundary

Validation does not grant outreach or publication authority. Populated results belong only in a separately authorized private system and must not include credentials, private customer information, raw conversations, internal agent transcripts, or facts obtained by bypassing access controls.
