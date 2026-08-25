# NX Sourcing Contracts

> **No lead data belongs in this public repository.** Do not commit leads, customer or seller information, private business data, outreach records, credentials, raw conversations, or internal agent transcripts.

This repository contains versioned public interface contracts for the Norms Exchange sourcing-agent staging workflow. It provides schemas, safety boundaries, workflow rules, and deterministic validation only. It is not a sourcing agent, lead database, marketplace, or Shopify integration.

## Contract boundary

- An externally sourced record is a lead only. It is not a WTS listing, customer, seller, submission, or inventory item.
- Every lead remains `marketplace_state: "lead_only"` and `public_listing_authorized: false`.
- External agents cannot authorize or publish marketplace listings.
- Only Norms review plus confirmed seller authorization can move information into a separate marketplace workflow.
- Sourcing uses public business information only and performs no outreach unless Ray separately authorizes it.
- Missing facts remain absent or `null`; they are never invented.

The detailed boundaries are in [docs/SECURITY_BOUNDARY.md](docs/SECURITY_BOUNDARY.md), the submission lifecycle is in [docs/SOURCING_WORKFLOW.md](docs/SOURCING_WORKFLOW.md), and mandatory private-consumer checks are in [docs/CONSUMER_VALIDATION.md](docs/CONSUMER_VALIDATION.md).

## Version and schemas

The current contract version is recorded in `CONTRACT_VERSION`. Released schemas use immutable `contract-v<version>` tags rather than mutable `main` URLs. Contract `0.1.0` resolves to `contract-v0.1.0`. The schemas use JSON Schema Draft 2020-12:

- `schemas/lead-record.schema.json` defines one lead-only sourcing record.
- `schemas/lead-batch.schema.json` defines an append-only batch of records.
- `examples/empty-lead-batch.json` is a zero-record example containing no lead or marketplace data.

Schemas are restrictive and reject undeclared properties where practical. Non-authoritative deduplication keys are hints for later review; they never assert that similar organizations are identical.

Each factual-evidence entry requires a controlled `source_type`. It may include an optional concise `source_language`, while its factual claim, source URL, and observation time remain required. Valid schema conformance never turns a lead into a WTS listing, seller, customer, inventory item, or authorization to publish.

Private consumers of populated batches must perform genuine Draft 2020-12 validation—including URI and format validation—and the deterministic cross-record checks documented in `docs/CONSUMER_VALIDATION.md`. Cached or previously accepted records remain subject to the schema version they declare.

## Deterministic validation

Node.js 24 or another supported compatible release is sufficient. No dependencies, credentials, network calls, or AI/model calls are used.

```sh
node scripts/validate-contract.mjs
```

The validator parses every JSON file, checks schema identity and contract-version invariants, confirms the example is empty and unauthorized for listing, and checks each batch's declared `record_count` against its records array.

## Public-repository rule

Use this repository only to evolve the sanitized interface contract. Store actual sourcing results in a separately authorized private system. Pull requests containing lead, customer, Shopify, credential, or private operational data must be rejected.
