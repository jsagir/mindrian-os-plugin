'use strict';

// B1: local verification records for claim nodes.
//
// A verification record answers "what was this claim checked against?" It is
// evidence of a checking action, not a truth promotion. Claims remain at their
// existing review_status until a human gate promotes them.

const { insertNode } = require('../node-insert.cjs');

const CHECK_STATUSES = Object.freeze(new Set([
  'unchecked', 'checked', 'disputed', 'inconclusive',
]));
const AGAINST_KINDS = Object.freeze(new Set([
  'artifact', 'source', 'observation', 'person', 'experiment',
]));
const METHODS = Object.freeze(new Set(['read', 'compare', 'observe', 'test', 'ask']));
const RESULTS = Object.freeze(new Set(['supports', 'contradicts', 'inconclusive']));
const ACTORS = Object.freeze(new Set(['user', 'system']));

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function cleanString(value, max) {
  if (typeof value !== 'string' || value.length === 0 || value.length > max) return '';
  return value;
}

function readNode(db, claimId) {
  try {
    return db.prepare('SELECT id, type, properties, review_status FROM nodes WHERE id = ?').get(claimId);
  } catch (_e) {
    return null;
  }
}

function parseProperties(row) {
  try {
    const parsed = JSON.parse(row && row.properties ? row.properties : '{}');
    return isPlainObject(parsed) ? parsed : {};
  } catch (_e) {
    return {};
  }
}

function writeClaimProperties(db, row, properties) {
  const parsed = JSON.stringify(properties);
  try {
    insertNode(db, row.id, row.type, parsed, {
      source_path: 'verification:' + row.id,
      created_by: 'system',
      epistemic_type: typeof properties.epistemic_type === 'string'
        ? properties.epistemic_type : 'extracted_fact',
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: 'verification_write_failed', detail: String(e.message || '').slice(0, 100) };
  }
}

/**
 * Append one checking event to a claim's additive properties JSON.
 * Required fields are generic handles or closed enums. Free-form notes are
 * represented by note_handle, so claim prose never becomes graph metadata.
 */
function recordClaimVerification(db, params) {
  if (!isPlainObject(params)) return { ok: false, reason: 'invalid_params' };
  const claimId = cleanString(params.claim_id, 512);
  const againstId = cleanString(params.against_id, 512);
  const againstKind = cleanString(params.against_kind, 32);
  const method = cleanString(params.method, 32);
  const result = cleanString(params.result, 32);
  const checkedBy = cleanString(params.checked_by || 'user', 16);
  if (!claimId || !againstId) return { ok: false, reason: 'missing_handle' };
  if (!AGAINST_KINDS.has(againstKind)) return { ok: false, reason: 'invalid_against_kind' };
  if (!METHODS.has(method)) return { ok: false, reason: 'invalid_method' };
  if (!RESULTS.has(result)) return { ok: false, reason: 'invalid_result' };
  if (!ACTORS.has(checkedBy)) return { ok: false, reason: 'invalid_checked_by' };
  const row = readNode(db, claimId);
  if (!row || row.type !== 'claim') return { ok: false, reason: 'claim_not_found' };
  const props = parseProperties(row);
  const verification = isPlainObject(props.verification) ? props.verification : {};
  const records = Array.isArray(verification.records) ? verification.records.slice() : [];
  const checkedAt = cleanString(params.checked_at, 64) || new Date().toISOString();
  const record = {
    against_id: againstId,
    against_kind: againstKind,
    method: method,
    result: result,
    checked_by: checkedBy,
    checked_at: checkedAt,
  };
  const noteHandle = cleanString(params.note_handle, 512);
  if (noteHandle) record.note_handle = noteHandle;
  records.push(record);
  const status = result === 'contradicts' ? 'disputed'
    : result === 'inconclusive' ? 'inconclusive' : 'checked';
  props.verification = { status: status, records: records };
  const write = writeClaimProperties(db, row, props);
  if (!write.ok) return write;
  return { ok: true, claim_id: claimId, verification: props.verification };
}

/**
 * Read the B1 room portrait. Counts are descriptive and deliberately are not
 * collapsed into a score or a truth verdict.
 */
function readVerificationPortrait(db) {
  const out = {
    claims_total: 0,
    claims_unchecked: 0,
    claims_checked: 0,
    claims_disputed: 0,
    claims_inconclusive: 0,
    records_total: 0,
    records_by_result: { supports: 0, contradicts: 0, inconclusive: 0 },
  };
  let rows;
  try {
    rows = db.prepare("SELECT properties FROM nodes WHERE type = 'claim'").all();
  } catch (_e) {
    return out;
  }
  for (const row of rows || []) {
    out.claims_total += 1;
    const props = parseProperties(row);
    const verification = isPlainObject(props.verification) ? props.verification : {};
    const status = CHECK_STATUSES.has(verification.status) ? verification.status : 'unchecked';
    if (status === 'unchecked') out.claims_unchecked += 1;
    if (status === 'checked') out.claims_checked += 1;
    if (status === 'disputed') out.claims_disputed += 1;
    if (status === 'inconclusive') out.claims_inconclusive += 1;
    for (const record of Array.isArray(verification.records) ? verification.records : []) {
      if (!isPlainObject(record)) continue;
      out.records_total += 1;
      if (Object.prototype.hasOwnProperty.call(out.records_by_result, record.result)) {
        out.records_by_result[record.result] += 1;
      }
    }
  }
  return out;
}

module.exports = {
  CHECK_STATUSES,
  AGAINST_KINDS,
  METHODS,
  RESULTS,
  recordClaimVerification,
  readVerificationPortrait,
};
