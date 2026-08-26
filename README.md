# NX Sourcing Contracts

> **No real lead or WTB-candidate data belongs in this public repository.** Do not commit candidates, leads, customer or seller information, private business data, outreach records, credentials, raw conversations, or internal agent transcripts.

This repository contains versioned public interface contracts for the Norms Exchange sourcing-agent staging workflow. It provides schemas, safety boundaries, workflow rules, reserved-domain fixtures, and deterministic validation only. It is not a sourcing agent, results database, marketplace, or Shopify integration.

## Contract boundary

- An externally sourced record is a lead only. It is not a WTS listing, customer, seller, submission, or inventory item.
- Every lead remains `marketplace_state: "lead_only"` and `public_listing_authorized: false`.
- External agents cannot authorize or publish marketplace listings.
- Only Norms review plus confirmed seller authorization can move information into a separate marketplace workflow.
- Sourcing uses public business information only and performs no outreach unless Ray separately authorizes it.
- Missing facts remain absent or `null`; they are never invented.
- A WTB candidate is an evidence-backed research result, not a confirmed buyer request or published WTB listing.
- WTB candidate publication requires evidence verification, Norms review, buyer confirmation, and separate approval.

The detailed boundaries are in [docs/SECURITY_BOUNDARY.md](docs/SECURITY_BOUNDARY.md), the submission lifecycle is in [docs/SOURCING_WORKFLOW.md](docs/SOURCING_WORKFLOW.md), and mandatory private-consumer checks are in [docs/CONSUMER_VALIDATION.md](docs/CONSUMER_VALIDATION.md).

## Version and schemas

The current contract version is recorded in `CONTRACT_VERSION`. Released schemas use immutable `contract-v<version>` tags rather than mutable `main` URLs. Contract `0.2.0` resolves to `contract-v0.2.0`; `contract-v0.1.0` remains immutable. The schemas use JSON Schema Draft 2020-12:

- `schemas/lead-record.schema.json` defines one lead-only sourcing record.
- `schemas/lead-batch.schema.json` defines an append-only batch of records.
- `examples/empty-lead-batch.json` is a zero-record example containing no lead or marketplace data.
- `schemas/wtb-candidate.schema.json` defines one untrusted WTB candidate that is not a listing.
- `schemas/wtb-candidate-batch.schema.json` defines an append-only WTB-candidate batch.
- `examples/empty-wtb-candidate-batch.json` and `examples/minimal-wtb-candidate-batch.json` are explicitly marked contract fixtures; the minimal fixture uses only the reserved `example.invalid` domain.
- `tests/fixtures/adversarial-wtb-candidates.json` drives deterministic rejection cases without containing real sourcing data.

Schemas are restrictive and reject undeclared properties where practical. Non-authoritative deduplication keys are hints for later review; they never assert that similar organizations are identical.

Each factual-evidence entry requires a controlled `source_type`. Lead evidence may include an optional concise `source_language`; WTB evidence requires it. Every factual claim also requires a source URL and observation time. Valid schema conformance never turns a lead into a WTS listing or a candidate into a confirmed or published WTB listing.

Private consumers of populated batches must perform genuine Draft 2020-12 validation—including URI and format validation—and the deterministic cross-record checks documented in `docs/CONSUMER_VALIDATION.md`. Cached or previously accepted records remain subject to the schema version they declare.

## Deterministic validation

Node.js 24 or another supported compatible release is sufficient. No dependencies, credentials, network calls, or AI/model calls are used.

```sh
node scripts/validate-contract.mjs
```

The validator parses every JSON file, checks schema identity and contract-version invariants, validates the empty and reserved-domain minimal examples, enforces WTB evidence/reference/status rules and cross-record consistency, and proves rejection of every adversarial fixture.

## Public-repository rule

Use this repository only to evolve the sanitized interface contract. Store actual sourcing results in a separately authorized private system. Pull requests containing real candidates, leads, customers, Shopify data, credentials, or private operational data must be rejected.
