/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 89.2 Plan 01 -- per-source budget tracking + telemetry persistence.
 *
 * Generalizes the Phase 88.6-03 per-source telemetry pattern (introduced
 * by scripts/query-semantic-scholar.cjs) to the global per-user path
 * ~/.mindrian/telemetry/external-papers.json so every Wave-2 fetcher
 * (academic, patents, industry) shares one budget ledger.
 *
 * Two public surfaces:
 *
 *   recordTelemetry({source, query_text, status, http_status, rate_limit_remaining})
 *     -- appends a structured record to the ledger. CRITICAL: query_text
 *        is sha256-hashed (16-char prefix) before persist; the literal
 *        query string NEVER touches disk. Atomic tmp+rename write so
 *        concurrent fetchers cannot tear the file. Returns
 *        {success: bool, error?: string}; never throws on fs failure
 *        (graceful degradation).
 *
 *   computeRemainingBudget(source, defaultBudget)
 *     -- reads the ledger, sums entries within the rolling 24h window
 *        for the given source, returns max(0, budget - count). Cold
 *        start (no ledger) returns the full default. ENOENT / parse
 *        error returns the full default (graceful).
 *
 * Canon Part 8 enforcement (telemetry layer):
 *   1. query_text is sha256-hashed before persist (Test 6 fence).
 *   2. Hash is 16-hex-char prefix; oracle-verifiable but non-reversible
 *      against any practical query corpus.
 *   3. No request body, no response body, no API key, no header values
 *      are persisted -- only the source enum, status enum, hash, and
 *      two scalar HTTP signals (status code + remaining budget).
 *   4. Atomic write (tmp + rename) so a crashed fetcher cannot leave
 *      a partial JSON that would corrupt downstream readers.
 *
 * Pure CJS, zero npm deps, node built-ins only (fs, path, os, crypto).
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');

// ---------- Frozen invariants ----------

const SCHEMA_VERSION = '1.0';

const TELEMETRY_DIR = path.join(os.homedir(), '.mindrian', 'telemetry');
const TELEMETRY_FILE = path.join(TELEMETRY_DIR, 'external-papers.json');

const WINDOW_MS = 24 * 60 * 60 * 1000;

const HASH_LEN = 16;

// Per-source default budgets (24h window). Keep in sync with
// 89.2-CONTEXT.md Per-Source Rate-Limit Strategy section.
const DEFAULT_BUDGETS = Object.freeze({
  openalex: 100,
  arxiv: 100,
  scopus: 50,
  pubmed: 100,
  ieee: 50,
  nature: 25,
  google_patents: 50,
  uspto: 50,
  tavily: 30,
  crunchbase: 30,
});

const ALLOWED_STATUSES = Object.freeze(new Set([
  'ok',
  'rate_limited',
  'api_error',
  'network_error',
  'timeout',
  'api_key_missing',
]));

// ---------- hashQueryText ----------
//
// sha256 of the input string, hex-encoded, truncated to 16 chars
// (64-bit prefix). Collision-resistant for any practical telemetry
// volume. The literal query NEVER persists; the hash is the audit
// handle for "did we already hit this query?" without revealing what
// the query was.

function hashQueryText(s) {
  return crypto.createHash('sha256').update(String(s)).digest('hex').slice(0, HASH_LEN);
}

// ---------- readTelemetry ----------
//
// Returns the persisted ledger as {schema_version, entries[]}. Cold
// start (file absent) returns a fresh empty payload. ENOENT, parse
// error, or any fs failure returns the same default (graceful). NEVER
// throws.

function readTelemetry() {
  const empty = { schema_version: SCHEMA_VERSION, entries: [] };
  try {
    if (!fs.existsSync(TELEMETRY_FILE)) {
      return empty;
    }
    const raw = fs.readFileSync(TELEMETRY_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.entries)) {
      return empty;
    }
    if (parsed.schema_version !== SCHEMA_VERSION) {
      // Future schema migration would happen here. For now, treat
      // unrecognized schema as cold start so we never crash on an
      // older ledger left behind by a downgrade.
      return empty;
    }
    return parsed;
  } catch (_err) {
    return empty;
  }
}

// ---------- writeTelemetryAtomic ----------
//
// Tmp+rename so concurrent fetchers never tear the ledger. Tmp filename
// carries pid + timestamp so 88-13 guardian (and the Plan 89.2-01 A2
// sweep) can sweep orphans with a narrow regex. Returns true on
// success, false on any fs failure. NEVER throws.

function writeTelemetryAtomic(payload) {
  try {
    fs.mkdirSync(TELEMETRY_DIR, { recursive: true });
    const tmp = TELEMETRY_FILE + '.tmp.' + process.pid + '.' + Date.now();
    const body = JSON.stringify(payload, null, 2);
    fs.writeFileSync(tmp, body, 'utf8');
    fs.renameSync(tmp, TELEMETRY_FILE);
    return true;
  } catch (_err) {
    return false;
  }
}

// ---------- recordTelemetry ----------
//
// Append a record. Validates source against DEFAULT_BUDGETS allow-list
// and status against ALLOWED_STATUSES. Hashes query_text before persist.
// Returns {success: bool, error?: 'fs_error' | 'invalid_source' |
// 'invalid_status' | 'invalid_input'}.

function recordTelemetry(opts) {
  if (!opts || typeof opts !== 'object') {
    return { success: false, error: 'invalid_input' };
  }
  if (typeof opts.source !== 'string' || !Object.prototype.hasOwnProperty.call(DEFAULT_BUDGETS, opts.source)) {
    return { success: false, error: 'invalid_source' };
  }
  if (typeof opts.status !== 'string' || !ALLOWED_STATUSES.has(opts.status)) {
    return { success: false, error: 'invalid_status' };
  }
  if (typeof opts.query_text !== 'string') {
    return { success: false, error: 'invalid_input' };
  }

  const record = {
    source: opts.source,
    query_text_hash: hashQueryText(opts.query_text),
    status: opts.status,
    fetched_at: new Date().toISOString(),
  };
  if (typeof opts.http_status === 'number') {
    record.http_status = opts.http_status;
  }
  if (typeof opts.rate_limit_remaining === 'number') {
    record.rate_limit_remaining = opts.rate_limit_remaining;
  }

  const payload = readTelemetry();
  payload.entries.push(record);
  const ok = writeTelemetryAtomic(payload);
  if (!ok) {
    return { success: false, error: 'fs_error' };
  }
  return { success: true };
}

// ---------- computeRemainingBudget ----------
//
// Reads the ledger, counts entries for the given source within the
// rolling 24h window, returns max(0, budget - count). Throws TypeError
// if source is not in DEFAULT_BUDGETS (caller bug, not graceful).

function computeRemainingBudget(source, defaultBudget) {
  if (typeof source !== 'string' || !Object.prototype.hasOwnProperty.call(DEFAULT_BUDGETS, source)) {
    throw new TypeError('computeRemainingBudget: unknown source: ' + String(source));
  }
  const budget = (typeof defaultBudget === 'number' && defaultBudget >= 0)
    ? defaultBudget
    : DEFAULT_BUDGETS[source];
  const payload = readTelemetry();
  const now = Date.now();
  let count = 0;
  for (const entry of payload.entries) {
    if (entry.source !== source) continue;
    if (typeof entry.fetched_at !== 'string') continue;
    const t = Date.parse(entry.fetched_at);
    if (Number.isNaN(t)) continue;
    if ((now - t) <= WINDOW_MS) {
      count += 1;
    }
  }
  return Math.max(0, budget - count);
}

// ---------- Exports ----------

module.exports = {
  TELEMETRY_FILE,
  DEFAULT_BUDGETS,
  WINDOW_MS,
  SCHEMA_VERSION,
  hashQueryText,
  readTelemetry,
  writeTelemetryAtomic,
  recordTelemetry,
  computeRemainingBudget,
};
