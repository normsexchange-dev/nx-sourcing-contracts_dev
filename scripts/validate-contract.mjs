import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CONTRACT_VERSION = '0.2.0';
const CONTRACT_TAG = `contract-v${CONTRACT_VERSION}`;
const DRAFT = 'https://json-schema.org/draft/2020-12/schema';
const REPOSITORY = 'normsexchange-dev/nx-sourcing-contracts_dev';
const TAGGED_SCHEMA_ROOT = `https://raw.githubusercontent.com/${REPOSITORY}/${CONTRACT_TAG}/schemas`;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const REQUIRED_FILES = [
  '.github/workflows/validate-contract.yml', '.gitignore', 'CONTRACT_VERSION', 'README.md',
  'docs/CONSUMER_VALIDATION.md', 'docs/SECURITY_BOUNDARY.md', 'docs/SOURCING_WORKFLOW.md',
  'docs/WTB_CANDIDATE_WORKFLOW.md', 'examples/empty-lead-batch.json',
  'examples/empty-wtb-candidate-batch.json', 'examples/minimal-wtb-candidate-batch.json',
  'schemas/lead-batch.schema.json', 'schemas/lead-record.schema.json',
  'schemas/wtb-candidate-batch.schema.json', 'schemas/wtb-candidate.schema.json',
  'scripts/validate-contract.mjs', 'tests/fixtures/adversarial-wtb-candidates.json'
].sort();

const CANDIDATE_FIELDS = [
  'contract_version', 'candidate_id', 'record_origin', 'record_classification', 'organization',
  'market', 'equipment_categories', 'requested_equipment', 'demand_classification',
  'demand_evidence_ids', 'factual_evidence', 'source_urls', 'source_languages',
  'research_timestamp', 'candidate_status', 'norms_review_status', 'buyer_confirmation_status',
  'publication_status', 'supersedes_candidate_id', 'deduplication_keys'
];
const BATCH_FIELDS = [
  'contract_version', 'batch_id', 'batch_classification', 'submission_purpose', 'generated_at',
  'generating_environment', 'assignment_reference', 'research_market', 'supersedes_batch_id',
  'record_count', 'records'
];
const EQUIPMENT_CATEGORIES = new Set(['camera', 'lens', 'lighting', 'grip', 'sound', 'power', 'vehicle', 'studio_equipment', 'complete_package', 'liquidation', 'other']);
const ORGANIZATION_TYPES = new Set(['production_company', 'rental_house', 'studio', 'broadcaster', 'school_or_university', 'reseller_or_dealer', 'government', 'nonprofit', 'independent_professional', 'other']);
const CONTACT_TYPES = new Set(['email', 'telephone', 'contact_form', 'website', 'public_professional_profile', 'other']);
const CLAIM_TYPES = new Set(['organization_identity', 'market_location', 'demand', 'equipment_request', 'quantity', 'budget', 'timeline', 'public_contact']);
const SOURCE_TYPES = new Set(['organization_website', 'public_business_profile', 'public_request', 'marketplace_wanted_post', 'directory', 'news', 'public_filing', 'public_professional_profile', 'other']);
const CANDIDATE_STATUSES = new Set(['researched', 'needs_verification', 'evidence_verified', 'rejected', 'superseded']);
const EXPECTED_ADVERSARIAL_MUTATIONS = [
  'inferred_with_budget', 'missing_demand_evidence', 'buyer_confirmed', 'record_count_mismatch',
  'duplicate_candidate_id', 'dangling_evidence_reference', 'self_supersession',
  'published_listing', 'unsupported_field', 'missing_source_language'
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function exactKeys(value, keys, label) {
  assert(isObject(value), `${label}: object required`);
  assert(JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort()), `${label}: unexpected or missing fields`);
}

function boundedString(value, label, maximum = 2000) {
  assert(typeof value === 'string' && value.trim().length >= 1 && value.length <= maximum, `${label}: bounded nonempty string required`);
}

function validDateTime(value, label) {
  assert(typeof value === 'string' && Number.isFinite(Date.parse(value)), `${label}: valid date-time required`);
}

function validUrl(value, label) {
  assert(typeof value === 'string' && URL.canParse(value), `${label}: valid URL required`);
  const url = new URL(value);
  assert(url.protocol === 'https:' && !url.username && !url.password, `${label}: public HTTPS URL required`);
  return url;
}

function uniqueStrings(value, label, { minimum = 0, pattern = null, allowed = null } = {}) {
  assert(Array.isArray(value) && value.length >= minimum, `${label}: array length is invalid`);
  assert(value.every((item) => typeof item === 'string'), `${label}: strings required`);
  assert(new Set(value).size === value.length, `${label}: duplicate value`);
  for (const item of value) {
    if (pattern) assert(pattern.test(item), `${label}: invalid value ${item}`);
    if (allowed) assert(allowed.has(item), `${label}: unsupported value ${item}`);
  }
}

async function findFiles(directory = root) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await findFiles(absolute));
    if (entry.isFile()) files.push(absolute);
  }
  return files;
}

async function json(relativePath) {
  try {
    return JSON.parse(await readFile(path.join(root, relativePath), 'utf8'));
  } catch (error) {
    throw new Error(`${relativePath}: invalid JSON: ${error.message}`);
  }
}

function assertSchema(schema, name, requiredFields) {
  assert(schema.$schema === DRAFT, `${name}: Draft 2020-12 required`);
  assert(schema.$id === `${TAGGED_SCHEMA_ROOT}/${name}`, `${name}: immutable schema ID mismatch`);
  assert(schema.type === 'object' && schema.additionalProperties === false, `${name}: restrictive object root required`);
  assert(schema.properties?.contract_version?.const === CONTRACT_VERSION, `${name}: contract version mismatch`);
  assert(Array.isArray(schema.required), `${name}: required fields missing`);
  for (const field of requiredFields) assert(schema.required.includes(field), `${name}: required field missing: ${field}`);
}

function evidenceReferences(ids, evidenceById, label, allowedClaims = null) {
  uniqueStrings(ids, label, { minimum: 1, pattern: /^evidence-[a-z0-9][a-z0-9-]{7,79}$/ });
  for (const id of ids) {
    const evidence = evidenceById.get(id);
    assert(evidence, `${label}: unknown evidence ID ${id}`);
    if (allowedClaims) assert(allowedClaims.has(evidence.claim_classification), `${label}: evidence ${id} has the wrong claim classification`);
  }
}

function validateCandidate(candidate, label = 'WTB candidate') {
  exactKeys(candidate, CANDIDATE_FIELDS, label);
  assert(candidate.contract_version === CONTRACT_VERSION, `${label}: contract version mismatch`);
  assert(/^wtb-candidate-[a-z0-9][a-z0-9-]{7,79}$/.test(candidate.candidate_id), `${label}: invalid candidate_id`);
  assert(['public_research', 'contract_fixture'].includes(candidate.record_origin), `${label}: invalid record_origin`);
  assert(candidate.record_classification === 'wtb_candidate_not_published_listing', `${label}: record is not classified as an unpublished candidate`);

  assert(Array.isArray(candidate.factual_evidence) && candidate.factual_evidence.length >= 1, `${label}: factual evidence required`);
  const evidenceById = new Map();
  for (const [index, evidence] of candidate.factual_evidence.entries()) {
    const evidenceLabel = `${label}.factual_evidence[${index}]`;
    exactKeys(evidence, ['evidence_id', 'claim_classification', 'claim', 'source_type', 'source_url', 'source_title', 'source_language', 'observed_at'], evidenceLabel);
    assert(/^evidence-[a-z0-9][a-z0-9-]{7,79}$/.test(evidence.evidence_id), `${evidenceLabel}: invalid evidence_id`);
    assert(!evidenceById.has(evidence.evidence_id), `${label}: duplicate evidence_id`);
    assert(CLAIM_TYPES.has(evidence.claim_classification), `${evidenceLabel}: invalid claim classification`);
    boundedString(evidence.claim, `${evidenceLabel}.claim`);
    assert(SOURCE_TYPES.has(evidence.source_type), `${evidenceLabel}: invalid source type`);
    validUrl(evidence.source_url, `${evidenceLabel}.source_url`);
    assert(evidence.source_title === null || (typeof evidence.source_title === 'string' && evidence.source_title.length <= 500), `${evidenceLabel}: invalid source_title`);
    boundedString(evidence.source_language, `${evidenceLabel}.source_language`, 35);
    validDateTime(evidence.observed_at, `${evidenceLabel}.observed_at`);
    evidenceById.set(evidence.evidence_id, evidence);
  }

  exactKeys(candidate.organization, ['name', 'organization_type', 'public_website', 'public_contact_channels', 'evidence_ids'], `${label}.organization`);
  boundedString(candidate.organization.name, `${label}.organization.name`, 240);
  assert(ORGANIZATION_TYPES.has(candidate.organization.organization_type), `${label}: invalid organization type`);
  if (candidate.organization.public_website !== null) validUrl(candidate.organization.public_website, `${label}.organization.public_website`);
  evidenceReferences(candidate.organization.evidence_ids, evidenceById, `${label}.organization.evidence_ids`, new Set(['organization_identity']));
  assert(Array.isArray(candidate.organization.public_contact_channels) && candidate.organization.public_contact_channels.length <= 20, `${label}: invalid public contacts`);
  for (const [index, contact] of candidate.organization.public_contact_channels.entries()) {
    const contactLabel = `${label}.organization.public_contact_channels[${index}]`;
    exactKeys(contact, ['channel_type', 'value', 'source_url', 'evidence_id'], contactLabel);
    assert(CONTACT_TYPES.has(contact.channel_type), `${contactLabel}: invalid channel type`);
    boundedString(contact.value, `${contactLabel}.value`, 500);
    validUrl(contact.source_url, `${contactLabel}.source_url`);
    evidenceReferences([contact.evidence_id], evidenceById, `${contactLabel}.evidence_id`, new Set(['public_contact']));
    assert(evidenceById.get(contact.evidence_id).source_url === contact.source_url, `${contactLabel}: source URL and evidence mismatch`);
  }

  exactKeys(candidate.market, ['country_code', 'country', 'city', 'region', 'evidence_ids'], `${label}.market`);
  assert(/^[A-Z]{2}$/.test(candidate.market.country_code), `${label}: invalid country code`);
  boundedString(candidate.market.country, `${label}.market.country`, 120);
  assert(candidate.market.city === null || (typeof candidate.market.city === 'string' && candidate.market.city.length <= 160), `${label}: invalid city`);
  assert(candidate.market.region === null || (typeof candidate.market.region === 'string' && candidate.market.region.length <= 160), `${label}: invalid region`);
  evidenceReferences(candidate.market.evidence_ids, evidenceById, `${label}.market.evidence_ids`, new Set(['market_location']));

  uniqueStrings(candidate.equipment_categories, `${label}.equipment_categories`, { minimum: 1, allowed: EQUIPMENT_CATEGORIES });
  assert(Array.isArray(candidate.requested_equipment) && candidate.requested_equipment.length >= 1, `${label}: requested equipment required`);
  const requestIds = new Set();
  for (const [index, request] of candidate.requested_equipment.entries()) {
    const requestLabel = `${label}.requested_equipment[${index}]`;
    exactKeys(request, ['request_id', 'description', 'equipment_category', 'evidence_ids', 'quantity', 'budget', 'timeline'], requestLabel);
    assert(/^request-[a-z0-9][a-z0-9-]{7,79}$/.test(request.request_id), `${requestLabel}: invalid request_id`);
    assert(!requestIds.has(request.request_id), `${label}: duplicate request_id`);
    requestIds.add(request.request_id);
    boundedString(request.description, `${requestLabel}.description`, 1000);
    assert(EQUIPMENT_CATEGORIES.has(request.equipment_category) && candidate.equipment_categories.includes(request.equipment_category), `${requestLabel}: equipment category mismatch`);
    evidenceReferences(request.evidence_ids, evidenceById, `${requestLabel}.evidence_ids`, new Set(['demand', 'equipment_request']));
    if (request.quantity !== null) {
      exactKeys(request.quantity, ['minimum', 'maximum', 'unit', 'evidence_ids'], `${requestLabel}.quantity`);
      assert(Number.isInteger(request.quantity.minimum) && request.quantity.minimum >= 1, `${requestLabel}: invalid quantity minimum`);
      assert(request.quantity.maximum === null || (Number.isInteger(request.quantity.maximum) && request.quantity.maximum >= request.quantity.minimum), `${requestLabel}: invalid quantity maximum`);
      boundedString(request.quantity.unit, `${requestLabel}.quantity.unit`, 80);
      evidenceReferences(request.quantity.evidence_ids, evidenceById, `${requestLabel}.quantity.evidence_ids`, new Set(['quantity']));
    }
    if (request.budget !== null) {
      exactKeys(request.budget, ['minimum', 'maximum', 'currency', 'evidence_ids'], `${requestLabel}.budget`);
      assert(request.budget.minimum !== null || request.budget.maximum !== null, `${requestLabel}: budget value required`);
      assert(request.budget.minimum === null || (typeof request.budget.minimum === 'number' && request.budget.minimum >= 0), `${requestLabel}: invalid budget minimum`);
      assert(request.budget.maximum === null || (typeof request.budget.maximum === 'number' && request.budget.maximum >= 0), `${requestLabel}: invalid budget maximum`);
      assert(request.budget.minimum === null || request.budget.maximum === null || request.budget.maximum >= request.budget.minimum, `${requestLabel}: budget range inverted`);
      assert(/^[A-Z]{3}$/.test(request.budget.currency), `${requestLabel}: invalid currency`);
      evidenceReferences(request.budget.evidence_ids, evidenceById, `${requestLabel}.budget.evidence_ids`, new Set(['budget']));
    }
    if (request.timeline !== null) {
      exactKeys(request.timeline, ['description', 'evidence_ids'], `${requestLabel}.timeline`);
      boundedString(request.timeline.description, `${requestLabel}.timeline.description`, 500);
      evidenceReferences(request.timeline.evidence_ids, evidenceById, `${requestLabel}.timeline.evidence_ids`, new Set(['timeline']));
    }
  }

  assert(['explicit', 'inferred'].includes(candidate.demand_classification), `${label}: invalid demand classification`);
  evidenceReferences(candidate.demand_evidence_ids, evidenceById, `${label}.demand_evidence_ids`, new Set(['demand']));
  if (candidate.demand_classification === 'inferred') {
    for (const request of candidate.requested_equipment) assert(request.quantity === null && request.budget === null && request.timeline === null, `${label}: inferred demand cannot carry quantity, budget, currency, or timeline`);
  }

  uniqueStrings(candidate.source_urls, `${label}.source_urls`, { minimum: 1 });
  for (const sourceUrl of candidate.source_urls) validUrl(sourceUrl, `${label}.source_urls`);
  uniqueStrings(candidate.source_languages, `${label}.source_languages`, { minimum: 1 });
  const evidenceUrls = [...new Set(candidate.factual_evidence.map((item) => item.source_url))].sort();
  const evidenceLanguages = [...new Set(candidate.factual_evidence.map((item) => item.source_language))].sort();
  assert(JSON.stringify([...candidate.source_urls].sort()) === JSON.stringify(evidenceUrls), `${label}: source_urls must exactly index evidence URLs`);
  assert(JSON.stringify([...candidate.source_languages].sort()) === JSON.stringify(evidenceLanguages), `${label}: source_languages must exactly index evidence languages`);
  validDateTime(candidate.research_timestamp, `${label}.research_timestamp`);
  assert(CANDIDATE_STATUSES.has(candidate.candidate_status), `${label}: external candidate status is prohibited`);
  assert(candidate.norms_review_status === 'not_reviewed', `${label}: Gemini cannot assign Norms review status`);
  assert(candidate.buyer_confirmation_status === 'unconfirmed', `${label}: Gemini cannot confirm a buyer`);
  assert(candidate.publication_status === 'not_approved', `${label}: Gemini cannot approve or publish a WTB listing`);
  assert(candidate.supersedes_candidate_id === null || /^wtb-candidate-[a-z0-9][a-z0-9-]{7,79}$/.test(candidate.supersedes_candidate_id), `${label}: invalid supersedes_candidate_id`);
  assert(candidate.supersedes_candidate_id !== candidate.candidate_id, `${label}: candidate cannot supersede itself`);
  exactKeys(candidate.deduplication_keys, ['normalized_website_domain', 'normalized_organization_name', 'external_public_ids'], `${label}.deduplication_keys`);
  assert(candidate.deduplication_keys.normalized_website_domain === null || /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(candidate.deduplication_keys.normalized_website_domain), `${label}: invalid normalized domain`);
  assert(candidate.deduplication_keys.normalized_organization_name === null || typeof candidate.deduplication_keys.normalized_organization_name === 'string', `${label}: invalid normalized organization name`);
  assert(Array.isArray(candidate.deduplication_keys.external_public_ids), `${label}: external public IDs must be an array`);
}

function validateBatch(batch, label = 'WTB candidate batch') {
  exactKeys(batch, BATCH_FIELDS, label);
  assert(batch.contract_version === CONTRACT_VERSION, `${label}: contract version mismatch`);
  assert(/^wtb-batch-[a-z0-9][a-z0-9-]{7,79}$/.test(batch.batch_id), `${label}: invalid batch_id`);
  assert(batch.batch_classification === 'untrusted_wtb_candidate_submission', `${label}: invalid batch classification`);
  assert(['intake_submission', 'contract_fixture'].includes(batch.submission_purpose), `${label}: invalid submission purpose`);
  validDateTime(batch.generated_at, `${label}.generated_at`);
  assert(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(batch.generating_environment), `${label}: invalid generating environment`);
  if (batch.assignment_reference !== null) validUrl(batch.assignment_reference, `${label}.assignment_reference`);
  exactKeys(batch.research_market, ['description', 'country_codes', 'cities'], `${label}.research_market`);
  boundedString(batch.research_market.description, `${label}.research_market.description`, 500);
  uniqueStrings(batch.research_market.country_codes, `${label}.research_market.country_codes`, { pattern: /^[A-Z]{2}$/ });
  uniqueStrings(batch.research_market.cities, `${label}.research_market.cities`);
  assert(batch.supersedes_batch_id === null || /^wtb-batch-[a-z0-9][a-z0-9-]{7,79}$/.test(batch.supersedes_batch_id), `${label}: invalid supersedes_batch_id`);
  assert(batch.supersedes_batch_id !== batch.batch_id, `${label}: batch cannot supersede itself`);
  assert(Number.isInteger(batch.record_count) && batch.record_count >= 0 && Array.isArray(batch.records) && batch.record_count === batch.records.length, `${label}: record_count mismatch`);

  const candidates = new Map();
  const supersededIds = new Set();
  for (const [index, candidate] of batch.records.entries()) {
    validateCandidate(candidate, `${label}.records[${index}]`);
    assert(!candidates.has(candidate.candidate_id), `${label}: duplicate candidate_id`);
    candidates.set(candidate.candidate_id, candidate);
    const expectedOrigin = batch.submission_purpose === 'contract_fixture' ? 'contract_fixture' : 'public_research';
    assert(candidate.record_origin === expectedOrigin, `${label}: record origin and submission purpose mismatch`);
    assert(batch.research_market.country_codes.includes(candidate.market.country_code), `${label}: candidate country missing from research market`);
    if (candidate.market.city !== null) assert(batch.research_market.cities.includes(candidate.market.city), `${label}: candidate city missing from research market`);
    if (candidate.supersedes_candidate_id !== null) {
      assert(!supersededIds.has(candidate.supersedes_candidate_id), `${label}: multiple candidates supersede the same record`);
      supersededIds.add(candidate.supersedes_candidate_id);
    }
    if (batch.submission_purpose === 'contract_fixture') {
      for (const evidence of candidate.factual_evidence) assert(new URL(evidence.source_url).hostname === 'example.invalid', `${label}: contract fixtures may use only example.invalid evidence`);
    }
  }
  for (const candidate of candidates.values()) {
    const seen = new Set([candidate.candidate_id]);
    let next = candidate.supersedes_candidate_id;
    while (next !== null && candidates.has(next)) {
      assert(!seen.has(next), `${label}: cyclic candidate supersession`);
      seen.add(next);
      next = candidates.get(next).supersedes_candidate_id;
    }
  }
}

function clone(value) {
  return structuredClone(value);
}

function expectReject(label, callback) {
  let rejected = false;
  try { callback(); } catch { rejected = true; }
  assert(rejected, `adversarial fixture was accepted: ${label}`);
}

function applyMutation(document, mutation) {
  const candidate = document.records[0];
  const request = candidate?.requested_equipment?.[0];
  if (mutation === 'inferred_with_budget') {
    candidate.demand_classification = 'inferred';
    request.budget = { minimum: 100, maximum: null, currency: 'USD', evidence_ids: ['evidence-fixture-demand-0001'] };
  } else if (mutation === 'missing_demand_evidence') candidate.demand_evidence_ids = [];
  else if (mutation === 'buyer_confirmed') candidate.buyer_confirmation_status = 'buyer_confirmed';
  else if (mutation === 'record_count_mismatch') document.record_count = 2;
  else if (mutation === 'duplicate_candidate_id') { document.records.push(clone(candidate)); document.record_count = 2; }
  else if (mutation === 'dangling_evidence_reference') request.evidence_ids = ['evidence-does-not-exist-0001'];
  else if (mutation === 'self_supersession') candidate.supersedes_candidate_id = candidate.candidate_id;
  else if (mutation === 'published_listing') candidate.record_classification = 'published_wtb_listing';
  else if (mutation === 'unsupported_field') candidate.unreviewed_claim = 'unsupported';
  else if (mutation === 'missing_source_language') delete candidate.factual_evidence[0].source_language;
  else throw new Error(`unknown adversarial mutation: ${mutation}`);
  return document;
}

const files = await findFiles();
const relativeFiles = files.map((file) => path.relative(root, file).split(path.sep).join('/')).sort();
assert(JSON.stringify(relativeFiles) === JSON.stringify(REQUIRED_FILES), 'repository topology must match the exact 17-file contract core');
const jsonFiles = relativeFiles.filter((file) => file.endsWith('.json'));
const parsed = new Map();
for (const relativePath of jsonFiles) parsed.set(relativePath, await json(relativePath));
assert((await readFile(path.join(root, 'CONTRACT_VERSION'), 'utf8')).trim() === CONTRACT_VERSION, 'CONTRACT_VERSION mismatch');

const leadRecordSchema = parsed.get('schemas/lead-record.schema.json');
const leadBatchSchema = parsed.get('schemas/lead-batch.schema.json');
const candidateSchema = parsed.get('schemas/wtb-candidate.schema.json');
const candidateBatchSchema = parsed.get('schemas/wtb-candidate-batch.schema.json');
assertSchema(leadRecordSchema, 'lead-record.schema.json', ['contract_version', 'lead_id', 'marketplace_state', 'public_listing_authorized', 'factual_evidence', 'observed_at', 'source_urls']);
assertSchema(leadBatchSchema, 'lead-batch.schema.json', ['contract_version', 'batch_id', 'generated_at', 'generating_agent', 'research_market', 'record_count', 'records']);
assertSchema(candidateSchema, 'wtb-candidate.schema.json', CANDIDATE_FIELDS);
assertSchema(candidateBatchSchema, 'wtb-candidate-batch.schema.json', BATCH_FIELDS);
assert(leadRecordSchema.properties.marketplace_state.const === 'lead_only' && leadRecordSchema.properties.public_listing_authorized.const === false, 'lead-only invariants changed');
assert(candidateSchema.properties.record_classification.const === 'wtb_candidate_not_published_listing', 'candidate classification invariant missing');
assert(candidateSchema.properties.norms_review_status.const === 'not_reviewed', 'Norms review must remain unassigned');
assert(candidateSchema.properties.buyer_confirmation_status.const === 'unconfirmed', 'buyer confirmation must remain unassigned');
assert(candidateSchema.properties.publication_status.const === 'not_approved', 'publication must remain unapproved');
assert(candidateBatchSchema.properties.records.items.$ref === 'wtb-candidate.schema.json', 'WTB batch schema reference mismatch');

const emptyLead = parsed.get('examples/empty-lead-batch.json');
assert(emptyLead.contract_version === CONTRACT_VERSION && emptyLead.record_count === 0 && Array.isArray(emptyLead.records) && emptyLead.records.length === 0, 'empty lead batch fixture is invalid');
const emptyWtb = parsed.get('examples/empty-wtb-candidate-batch.json');
const minimalWtb = parsed.get('examples/minimal-wtb-candidate-batch.json');
validateBatch(emptyWtb, 'examples/empty-wtb-candidate-batch.json');
validateBatch(minimalWtb, 'examples/minimal-wtb-candidate-batch.json');
assert(emptyWtb.record_count === 0, 'empty WTB fixture must contain zero records');
assert(minimalWtb.record_count === 1 && minimalWtb.records[0].record_origin === 'contract_fixture', 'minimal WTB example must be one explicit fixture');

const adversarial = parsed.get('tests/fixtures/adversarial-wtb-candidates.json');
exactKeys(adversarial, ['contract_version', 'fixture_model', 'cases'], 'adversarial fixture catalog');
assert(adversarial.contract_version === CONTRACT_VERSION && adversarial.fixture_model === 'mutations_of_minimal_wtb_candidate_batch', 'adversarial fixture catalog identity mismatch');
assert(Array.isArray(adversarial.cases) && adversarial.cases.length === EXPECTED_ADVERSARIAL_MUTATIONS.length, 'adversarial fixture count mismatch');
assert(JSON.stringify(adversarial.cases.map((item) => item.mutation)) === JSON.stringify(EXPECTED_ADVERSARIAL_MUTATIONS), 'adversarial mutation order or coverage mismatch');
for (const fixture of adversarial.cases) {
  exactKeys(fixture, ['case_id', 'mutation', 'expected'], `adversarial fixture ${fixture.case_id}`);
  assert(fixture.expected === 'reject', `adversarial fixture ${fixture.case_id}: expected result must be reject`);
  expectReject(fixture.case_id, () => validateBatch(applyMutation(clone(minimalWtb), fixture.mutation), fixture.case_id));
}

const allText = (await Promise.all(files.map((file) => readFile(file, 'utf8')))).join('\n');
assert(!/[A-Za-z]:[\\/]Users[\\/]/.test(allText), 'local Windows user path found');
assert(!/(?:^|\s)\/(?:home|Users)\/[A-Za-z0-9._-]+\//m.test(allText), 'local POSIX user path found');
assert(!/(?:api[_-]?key|access[_-]?token|client[_-]?secret|password|private[_-]?key)\s*[:=]\s*["']?[A-Za-z0-9_./+=-]{12,}/i.test(allText), 'credential-like value found');
assert(!/(?:buyer_confirmed|publication_status"\s*:\s*"approved|published_wtb_listing)/.test(JSON.stringify(minimalWtb)), 'minimal fixture asserts restricted marketplace state');
const validatorSource = await readFile(fileURLToPath(import.meta.url), 'utf8');
for (const token of [['node', ':http'].join(''), ['node', ':https'].join(''), ['f', 'etch('].join(''), ['Open', 'AI'].join(''), ['model', '.generate'].join('')]) {
  assert(!validatorSource.includes(token), `validator contains prohibited network or model token: ${token}`);
}
for (const match of validatorSource.matchAll(/^import .* from ['"]([^'"]+)['"];$/gm)) assert(match[1].startsWith('node:'), `third-party import found: ${match[1]}`);

console.log(`validate-contract: PASS (${relativeFiles.length} files; ${jsonFiles.length} JSON; contract ${CONTRACT_VERSION}; WTB examples 0+1 fixture records; adversarial rejections ${adversarial.cases.length})`);
