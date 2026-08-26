# WTB Candidate Workflow

A WTB candidate is an untrusted, evidence-backed research result. It is not a buyer-confirmed request and never becomes a published WTB listing merely because it validates.

The governed lifecycle is:

```text
researched candidate → evidence verified → Norms review → buyer confirmed → approved WTB listing
```

External research environments may perform only the first two stages when explicitly assigned. They submit contract-valid, public-information-only batches to an authorized isolated intake repository. Missing facts stay `null` or absent, and every material demand claim cites factual evidence.

`demand_classification` distinguishes an explicit public request from inferred demand. Inferred demand cannot carry quantities, budgets, currencies, or timelines. Explicit demand may carry those details only in evidence-linked objects; otherwise they remain `null`.

Candidate status never grants authority. External submissions keep `norms_review_status: "not_reviewed"`, `buyer_confirmation_status: "unconfirmed"`, and `publication_status: "not_approved"`. Only Norms may review, confirm a buyer, approve publication, or create a Shopify WTB listing.

Batches are append-only. Corrections use stable `supersedes_candidate_id` and `supersedes_batch_id` relationships rather than rewriting accepted history. Deduplication keys are comparison hints only.
