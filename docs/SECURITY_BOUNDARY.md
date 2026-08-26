# Security Boundary

## Public contract, private results

This public repository contains interface definitions, empty examples, and clearly marked reserved-domain contract fixtures only. Actual leads, WTB candidates, research results, business contacts, outreach activity, customer or seller information, marketplace records, credentials, raw conversations, and internal agent transcripts do not belong here.

The contract does not grant access to any private system. It contains no Shopify integration, secrets, tokens, deploy keys, account instructions, private configuration, or executable sourcing agent.

## Lead-only invariant

An externally sourced record is a lead only. It is not a WTS listing, customer, seller, submission, inventory item, offer, or authorization. Every record must retain both immutable staging values:

```json
{
  "marketplace_state": "lead_only",
  "public_listing_authorized": false
}
```

External sourcing agents cannot authorize, create, or publish WTS listings. Only Norms review and separately confirmed seller authorization can later move information into a distinct marketplace workflow.

## WTB-candidate invariant

A WTB candidate is a research result, not a confirmed request or published listing. External submissions always retain:

```json
{
  "record_classification": "wtb_candidate_not_published_listing",
  "norms_review_status": "not_reviewed",
  "buyer_confirmation_status": "unconfirmed",
  "publication_status": "not_approved"
}
```

Only Norms may review evidence, confirm an actual buyer, approve publication, or create a Shopify WTB listing. Inferred demand never carries quantities, budgets, currencies, or timelines. Explicit details are permitted only when linked to factual evidence.

## Permitted collection

Agents may collect only information that is publicly available for a legitimate business-research purpose:

- public business identity and website;
- public professional business profiles;
- public business contact channels;
- public professional contact name and title when presented for that person's business role;
- public evidence about production services, equipment categories, or possible disposition signals.

Personal social-media information is prohibited unless the profile is explicitly used for the person's public professional business. Agents must not bypass logins, paywalls, access controls, robots protections, technical restrictions, or platform terms. No outreach is permitted unless Ray separately authorizes it.

## Evidence and inference

Every factual claim must be supported by a source URL and an observation timestamp. Quoted or summarized facts belong in `factual_evidence`. Agent judgment belongs separately in `agent_assessment` and must identify the evidence records from which it was derived. Assessments must never be represented as sourced facts.

Missing or uncertain information remains absent or `null`. Agents must not invent companies, people, buyers, contact details, equipment, quantities, budgets, currencies, timelines, prices, authorization, marketplace activity, or evidence.

## Deduplication and history

Normalized domains and other deduplication keys are non-authoritative hints. Similar names, websites, locations, or phone numbers do not prove that two organizations are identical. Identity decisions require later human review.

Lead batches are append-only submissions. A correction creates a new record with `supersedes_lead_id`; it does not silently rewrite prior history.

## Prohibited content

Never include secrets, credentials, tokens, cookies, private keys, customer data, seller data, non-public business information, private correspondence, raw conversations, internal prompts, reasoning, runtime transcripts, or access instructions for private systems.
