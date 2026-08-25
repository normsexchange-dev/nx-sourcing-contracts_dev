import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CONTRACT_VERSION = '0.1.0';
const DRAFT_2020_12 = 'https://json-schema.org/draft/2020-12/schema';
const CONTRACT_TAG = `contract-v${CONTRACT_VERSION}`;
const TAGGED_SCHEMA_ROOT = `https://raw.githubusercontent.com/normsexchange-dev/nx-sourcing-contracts_dev/${CONTRACT_TAG}/schemas`;
const SOURCE_TYPES = [
  'company_website',
  'public_business_profile',
  'marketplace_listing',
  'directory',
  'news',
  'public_filing',
  'social_business_profile',
  'other'
];
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function readJson(relativePath) {
  const text = await readFile(path.join(root, relativePath), 'utf8');
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`${relativePath}: invalid JSON: ${error.message}`);
  }
}

async function findJsonFiles(directory = root) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await findJsonFiles(absolute));
    if (entry.isFile() && entry.name.endsWith('.json')) files.push(absolute);
  }
  return files;
}

function assertSchema(schema, relativePath, expectedId, requiredFields) {
  assert(schema.$schema === DRAFT_2020_12, `${relativePath}: must use JSON Schema Draft 2020-12`);
  assert(schema.$id === expectedId, `${relativePath}: unexpected $id`);
  assert(schema.type === 'object', `${relativePath}: root type must be object`);
  assert(schema.additionalProperties === false, `${relativePath}: root must reject additional properties`);
  assert(schema.properties?.contract_version?.const === CONTRACT_VERSION, `${relativePath}: contract version invariant missing`);
  assert(Array.isArray(schema.required), `${relativePath}: required must be an array`);
  for (const field of requiredFields) {
    assert(schema.required.includes(field), `${relativePath}: required field missing: ${field}`);
  }
}

function inspectExample(value, location = 'example') {
  const forbiddenKeys = new Set([
    'customer', 'customer_id', 'seller', 'seller_id', 'wts_listing', 'listing_id',
    'inventory_item', 'shopify', 'credential', 'credentials', 'secret', 'token',
    'outreach_message', 'raw_conversation', 'transcript'
  ]);
  if (Array.isArray(value)) {
    value.forEach((item, index) => inspectExample(item, `${location}[${index}]`));
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, nested] of Object.entries(value)) {
    assert(!forbiddenKeys.has(key.toLowerCase()), `${location}: forbidden field: ${key}`);
    inspectExample(nested, `${location}.${key}`);
  }
}

const jsonFiles = await findJsonFiles();
assert(jsonFiles.length > 0, 'no JSON files found');
const parsedJson = new Map();
for (const file of jsonFiles) {
  const relative = path.relative(root, file).split(path.sep).join('/');
  const value = await readJson(relative);
  parsedJson.set(relative, value);
  if (value && typeof value === 'object' && !Array.isArray(value)
      && ('record_count' in value || 'records' in value)) {
    assert(Number.isInteger(value.record_count) && value.record_count >= 0, `${relative}: record_count must be a non-negative integer`);
    assert(Array.isArray(value.records), `${relative}: records must be an array`);
    assert(value.record_count === value.records.length, `${relative}: record_count does not equal records length`);
  }
}

const version = (await readFile(path.join(root, 'CONTRACT_VERSION'), 'utf8')).trim();
assert(version === CONTRACT_VERSION, `CONTRACT_VERSION must be ${CONTRACT_VERSION}`);

const leadSchemaPath = 'schemas/lead-record.schema.json';
const leadSchema = await readJson(leadSchemaPath);
assertSchema(
  leadSchema,
  leadSchemaPath,
  `${TAGGED_SCHEMA_ROOT}/lead-record.schema.json`,
  ['contract_version', 'lead_id', 'marketplace_state', 'public_listing_authorized', 'factual_evidence', 'observed_at', 'source_urls']
);
assert(leadSchema.properties.marketplace_state.const === 'lead_only', 'lead schema must fix marketplace_state to lead_only');
assert(leadSchema.properties.public_listing_authorized.const === false, 'lead schema must forbid public listing authorization');
const evidenceSchema = leadSchema.properties.factual_evidence.items;
assert(evidenceSchema.additionalProperties === false, 'factual evidence must reject additional properties');
assert(evidenceSchema.required.includes('source_type'), 'factual evidence must require source_type');
assert(
  JSON.stringify(evidenceSchema.properties.source_type.enum) === JSON.stringify(SOURCE_TYPES),
  'factual evidence source_type enum does not match the contract'
);
assert(evidenceSchema.properties.source_language?.type === 'string', 'source_language must be a string when present');
assert(!evidenceSchema.required.includes('source_language'), 'source_language must remain optional');
assert(leadSchema.properties.agent_assessment.additionalProperties === false, 'agent assessment must be structurally separate and restrictive');

const batchSchemaPath = 'schemas/lead-batch.schema.json';
const batchSchema = await readJson(batchSchemaPath);
assertSchema(
  batchSchema,
  batchSchemaPath,
  `${TAGGED_SCHEMA_ROOT}/lead-batch.schema.json`,
  ['contract_version', 'batch_id', 'generated_at', 'generating_agent', 'research_market', 'record_count', 'records']
);
assert(batchSchema.properties.records.items.$ref === 'lead-record.schema.json', 'batch schema must reference lead-record.schema.json');

const examplePath = 'examples/empty-lead-batch.json';
const example = parsedJson.get(examplePath);
const exampleKeys = Object.keys(example).sort();
const allowedExampleKeys = Object.keys(batchSchema.properties).sort();
assert(batchSchema.required.every((field) => field in example), `${examplePath}: required batch field missing`);
assert(exampleKeys.every((field) => allowedExampleKeys.includes(field)), `${examplePath}: undeclared batch field present`);
assert(example.contract_version === CONTRACT_VERSION, `${examplePath}: contract version mismatch`);
assert(/^batch-[a-z0-9][a-z0-9-]{7,63}$/.test(example.batch_id), `${examplePath}: invalid batch_id`);
assert(typeof example.generated_at === 'string' && Number.isFinite(Date.parse(example.generated_at)), `${examplePath}: invalid generated_at`);
assert(typeof example.generating_agent === 'string' && example.generating_agent.length > 0, `${examplePath}: generating_agent is required`);
assert(
  example.research_market && typeof example.research_market === 'object' && !Array.isArray(example.research_market)
    && typeof example.research_market.description === 'string' && example.research_market.description.length > 0,
  `${examplePath}: research_market.description is required`
);
assert(Array.isArray(example.records), `${examplePath}: records must be an array`);
assert(example.record_count === example.records.length, `${examplePath}: record_count does not equal records length`);
assert(example.record_count === 0, `${examplePath}: example must contain zero records`);
assert(example.records.length === 0, `${examplePath}: example must contain no leads`);
inspectExample(example);

for (const record of example.records) {
  assert(record.marketplace_state === 'lead_only', 'example record marketplace_state must be lead_only');
  assert(record.public_listing_authorized === false, 'example record must not authorize a listing');
}

console.log(`validate-contract: PASS (${jsonFiles.length} JSON files; contract ${CONTRACT_VERSION}; empty batch 0 records)`);
