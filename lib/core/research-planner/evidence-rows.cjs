/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 363 Plan 11 -- quote-first, hash-anchored evidence rows.
 *
 * Generalizes Phase 361's evidence-row validator (D-02a). Phase 361 could only
 * check a quote's shape; here OpenAlex is fetched in-process, so every quote is
 * checked against the fetched text and its content hash (D-03, T-363-05).
 *
 * The model supplies: leaf_id, record_id, claim, quote, label (and funder,
 * program for a funding_signal). Code sets everything else: row_id, source_url,
 * source_title, retrieved_at, content_hash, evidence_tier, source_type, flags.
 * Any score, confidence, strength, probability or rank key drops the row
 * (Canon Part 12, T-363-35). A retracted record can only be context (D-18,
 * T-363-19).
 *
 * Pure CJS, no network, no fs. Canon Part 8: claim text is LOCAL and never
 * leaves this module; rows carry public literature quotes and code-set fields.
 * Fetched abstracts are untrusted data: render helpers strip injection spans.
 *
 * Downstream consumers: 363-06 rollUp and opportunityCandidates, 363-07
 * classifyLimiter (labels derivation, retest, scurve_ceiling, scurve_headroom),
 * 363-12/13 quick and deep runs, 363-14 artifacts.
 *
 * No em-dashes or en-dashes in this file; the characters are matched by code
 * point escape only.
 */

'use strict';

const crypto = require('node:crypto');
const evidencePack = require('../dominant-design/evidence-pack.cjs');
const { stripInjectionSpans } = require('../navigation/evidence-claim.cjs');

const FORBIDDEN_KEY_RE = new RegExp('(' + evidencePack.FORBIDDEN_ROW_KEYS.join('|') + ')', 'i');

// Closed label set. supports and contradicts settle a leaf (363-06 rollUp);
// derivation, retest, scurve_ceiling and scurve_headroom feed classifyLimiter
// (363-07); funding_signal feeds opportunityCandidates; context settles nothing.
const ROW_LABELS = Object.freeze([
  'supports',
  'contradicts',
  'context',
  'derivation',
  'retest',
  'scurve_ceiling',
  'scurve_headroom',
  'funding_signal',
]);

const REQUIRED_ROW_FIELDS = Object.freeze(['leaf_id', 'record_id', 'claim', 'quote', 'label']);

// A retracted record may only be context. Every other label either settles a
// leaf or feeds a limiter classification that ignores flags.retracted.
const RETRACTION_SAFE_LABELS = Object.freeze(['context']);

const DROP_KEYS = Object.freeze([
  'missing_field',
  'forbidden_key',
  'unknown_record',
  'unverified_quote',
  'hash_mismatch',
  'bad_label',
  'retracted_support',
]);

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

function isPlainObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

// normalizeText: lowercase, curly quotes to straight, em and en dash to hyphen,
// whitespace runs to one space, trimmed. Used for both hashing and quote
// matching, so a whitespace-variant quote still counts as literal.
function normalizeText(s) {
  if (typeof s !== 'string') return '';
  return s
    .normalize('NFKC')
    .replace(/[\u2018\u2019\u201a\u201b]/g, "'")
    .replace(/[\u201c\u201d\u201e\u201f]/g, '"')
    .replace(/[\u2013\u2014\u2212]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// reconstructAbstract: OpenAlex abstract_inverted_index -> original word order.
// A plain string passes through so hand-built records work.
function reconstructAbstract(inverted) {
  if (typeof inverted === 'string') return inverted;
  if (!isPlainObject(inverted)) return '';
  const pairs = [];
  for (const word of Object.keys(inverted)) {
    const positions = inverted[word];
    if (!Array.isArray(positions)) continue;
    for (const pos of positions) {
      const n = parseInt(pos, 10);
      if (Number.isNaN(n)) continue;
      pairs.push([n, word]);
    }
  }
  pairs.sort(function (a, b) { return a[0] - b[0]; });
  return pairs.map(function (p) { return p[1]; }).join(' ');
}

function abstractOf(record) {
  if (!record) return '';
  if (typeof record.abstract === 'string' && record.abstract.length > 0) return record.abstract;
  return reconstructAbstract(record.abstract_inverted_index);
}

function titleOf(record) {
  return record && typeof record.title === 'string' ? record.title : '';
}

// contentHash: 'sha256:' + sha256 of the normalized title plus reconstructed
// abstract, computed at fetch time (recordsIndex) and recomputed at validation.
function contentHash(record) {
  const text = normalizeText(titleOf(record) + '\n' + abstractOf(record));
  return 'sha256:' + crypto.createHash('sha256').update(text).digest('hex');
}

function bareId(id) {
  if (typeof id !== 'string') return '';
  const m = /(W\d+)\s*$/i.exec(id.trim());
  return m ? m[1].toUpperCase() : id.trim();
}

// recordsIndex(records) -> Map keyed by the full OpenAlex id AND its bare W id.
// First record for an id wins.
function recordsIndex(records) {
  const map = new Map();
  for (const rec of Array.isArray(records) ? records : []) {
    if (!isPlainObject(rec) || !isNonEmptyString(rec.id)) continue;
    const entry = {
      record: rec,
      text_title: normalizeText(titleOf(rec)),
      text_abstract: normalizeText(abstractOf(rec)),
      content_hash: contentHash(rec),
    };
    const full = rec.id.trim();
    const bare = bareId(full);
    if (!map.has(full)) map.set(full, entry);
    if (bare && !map.has(bare)) map.set(bare, entry);
  }
  return map;
}

// OpenAlex type -> evidence-pack SOURCE_TYPES member. article and review are
// peer_reviewed. SOURCE_TYPES has no preprint member, so preprint and
// posted-content take 'other' (Practitioner tier: never a guess upward), the
// same member every unknown type takes.
function sourceTypeFor(record) {
  const t = record && typeof record.type === 'string' ? record.type.toLowerCase() : '';
  if (t === 'article' || t === 'review') return 'peer_reviewed';
  return 'other';
}

function sourceUrlFor(record) {
  if (isNonEmptyString(record.doi)) {
    const d = record.doi.trim();
    return /^https?:\/\//i.test(d) ? d : 'https://doi.org/' + d.replace(/^doi:\s*/i, '');
  }
  const id = String(record.id).trim();
  return /^https?:\/\//i.test(id) ? id : 'https://openalex.org/' + id;
}

function emptyDropped() {
  const d = {};
  for (const k of DROP_KEYS) d[k] = 0;
  return d;
}

// validateRows(rawRows, index, {leafIds, lane, retrievedAt})
//   -> { rows, dropped }. Drops are counted, never hedged. Check order:
//   forbidden key, required fields, label, funding fields, leaf id, record,
//   hash, quote, retraction.
function validateRows(rawRows, index, opts) {
  const o = opts || {};
  const dropped = emptyDropped();
  const rows = [];
  const lane = String(o.lane || 'XX').toUpperCase();
  const leafSet = Array.isArray(o.leafIds) ? new Set(o.leafIds) : null;
  const retrievedAt = isNonEmptyString(o.retrievedAt) ? o.retrievedAt : new Date().toISOString();
  const idx = index instanceof Map ? index : new Map();

  for (const raw of Array.isArray(rawRows) ? rawRows : []) {
    if (!isPlainObject(raw)) { dropped.missing_field += 1; continue; }
    if (Object.keys(raw).some(function (k) { return FORBIDDEN_KEY_RE.test(k); })) {
      dropped.forbidden_key += 1;
      continue;
    }
    if (!REQUIRED_ROW_FIELDS.every(function (f) { return isNonEmptyString(raw[f]); })) {
      dropped.missing_field += 1;
      continue;
    }
    if (ROW_LABELS.indexOf(raw.label) === -1) { dropped.bad_label += 1; continue; }
    if (raw.label === 'funding_signal'
      && !(isNonEmptyString(raw.funder) && isNonEmptyString(raw.program))) {
      dropped.missing_field += 1;
      continue;
    }
    // A leaf id outside the plan is counted as missing_field: the closed drop
    // set has no separate bucket and the row has no valid leaf to attach to.
    if (leafSet && !leafSet.has(raw.leaf_id)) { dropped.missing_field += 1; continue; }

    const entry = idx.get(raw.record_id.trim()) || idx.get(bareId(raw.record_id));
    if (!entry) { dropped.unknown_record += 1; continue; }

    const recomputed = contentHash(entry.record);
    if (raw.content_hash !== undefined && raw.content_hash !== recomputed) {
      dropped.hash_mismatch += 1;
      continue;
    }

    const q = normalizeText(raw.quote);
    if (!q || (entry.text_title.indexOf(q) === -1 && entry.text_abstract.indexOf(q) === -1)) {
      dropped.unverified_quote += 1;
      continue;
    }

    const retracted = entry.record.is_retracted === true;
    if (retracted && RETRACTION_SAFE_LABELS.indexOf(raw.label) === -1) {
      dropped.retracted_support += 1;
      continue;
    }

    const sourceType = sourceTypeFor(entry.record);
    const row = {
      row_id: 'E-' + lane + '-' + (rows.length + 1),
      leaf_id: raw.leaf_id,
      record_id: String(entry.record.id).trim(),
      claim: raw.claim,
      quote: raw.quote,
      label: raw.label,
      source_url: sourceUrlFor(entry.record),
      source_title: titleOf(entry.record),
      retrieved_at: retrievedAt,
      content_hash: recomputed,
      evidence_tier: evidencePack.tierFor(sourceType),
      source_type: sourceType,
      flags: {
        retracted: retracted,
        is_in_doaj: typeof entry.record.is_in_doaj === 'boolean' ? entry.record.is_in_doaj : null,
        venue: typeof entry.record.venue === 'string' ? entry.record.venue : null,
      },
    };
    if (raw.label === 'funding_signal') {
      row.funder = raw.funder;
      row.program = raw.program;
    }
    rows.push(row);
  }
  return { rows: rows, dropped: dropped };
}

function splitSentences(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(/(?<=[.!?])\s+/)
    .filter(function (s) { return s.length > 0; });
}

// deterministicTermRows(records, term, {leafId, lane, label}) -> raw rows (the
// model-supplied shape) with no model present: one per record whose abstract
// contains the exact term (normalized, case-insensitive), the quote being the
// full sentence that contains it. A title-only match quotes the title. The
// claim is a code-written statement of what was found, LOCAL only. Rows go
// through validateRows like any other, so retraction rules still apply.
function deterministicTermRows(records, term, opts) {
  const o = opts || {};
  const needle = normalizeText(term);
  const out = [];
  if (!needle) return out;
  const label = ROW_LABELS.indexOf(o.label) !== -1 ? o.label : 'context';
  for (const rec of Array.isArray(records) ? records : []) {
    if (!isPlainObject(rec) || !isNonEmptyString(rec.id)) continue;
    let quote = null;
    for (const s of splitSentences(abstractOf(rec))) {
      if (normalizeText(s).indexOf(needle) !== -1) { quote = s; break; }
    }
    if (!quote && normalizeText(titleOf(rec)).indexOf(needle) !== -1) quote = titleOf(rec).trim();
    if (!quote) continue;
    out.push({
      leaf_id: o.leafId,
      record_id: String(rec.id).trim(),
      claim: 'The record text contains the exact term "' + String(term).trim() + '".',
      quote: quote,
      label: label,
    });
  }
  return out;
}

// renderRowCitation(row, {withQuote}) -> '[E-WS-1]'. With withQuote the
// stripped quote follows as inert quoted text (T-363-06): fetched abstracts are
// untrusted data, so injection spans are removed on render.
function renderRowCitation(row, opts) {
  const id = row && typeof row.row_id === 'string' ? row.row_id : '';
  const cite = '[' + id + ']';
  if (opts && opts.withQuote && row && typeof row.quote === 'string') {
    return cite + ' "' + stripInjectionSpans(row.quote).replace(/"/g, "'") + '"';
  }
  return cite;
}

module.exports = {
  ROW_LABELS,
  REQUIRED_ROW_FIELDS,
  normalizeText,
  reconstructAbstract,
  contentHash,
  recordsIndex,
  validateRows,
  deterministicTermRows,
  renderRowCitation,
};
