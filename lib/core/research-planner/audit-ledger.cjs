'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 363-09 -- append-only research audit ledger.
 *
 * D-04 / DRP363-05: every executed research query leaves exactly one record
 * in <room>/.mindrian/research-audit.jsonl. The file is append-only (this
 * module never rewrites or truncates it), it never egresses (no network I/O
 * here, Canon Part 8), and it refuses any value that looks like the API key
 * (T-363-09). The only room-derived string it holds is the approved q.
 *
 * Plain closed-shape validation, no zod (zod lives at MCP edges only).
 * No em-dashes anywhere in this file (CLAUDE.md HARD RULE).
 */

const fs = require('node:fs');
const path = require('node:path');
const egressPolicy = require('./egress-policy.cjs');

const AUDIT_RELPATH = path.join('.mindrian', 'research-audit.jsonl');

const AUDIT_KEYS = Object.freeze([
  'ts', 'run_id', 'grant_id', 'grant_version', 'q', 'q_hash', 'template_id', 'family',
  'part8_verdict', 'provider', 'filters', 'pagination', 'fallback_used', 'origin_ref',
  'result_ids', 'content_hashes', 'outcome', 'failure_class', 'count', 'cost_usd',
  'remaining_usd', 'x_query', 'latency_ms',
]);
// 'not_applicable': a web string, which runs no content audit (ruling 2026-10-05, 369.2-05)
const VERDICTS = Object.freeze(['pass', 'tripped', 'not_applicable']);
const OUTCOMES = Object.freeze(['ok', 'empty_valid', 'failed', 'blocked', 'cache_hit']);

function auditPath(roomDir) {
  return path.join(roomDir, AUDIT_RELPATH);
}

// looksLikeKey(text): true when serialized record text carries the API key
// (read at call time from the environment, never stored) or a key-shaped
// header or query parameter.
function looksLikeKey(text) {
  if (/Bearer /i.test(text)) return true;
  if (/api_key=/i.test(text)) return true;
  const k = process.env.OPENALEX_API_KEY;
  if (typeof k === 'string' && k.length >= 4 && text.indexOf(k) !== -1) return true;
  return false;
}

function isStrOrNull(v) { return v === null || typeof v === 'string'; }
function isNumOrNull(v) { return v === null || (typeof v === 'number' && Number.isFinite(v)); }
function isStrArray(v) { return Array.isArray(v) && v.every(function (x) { return typeof x === 'string'; }); }

// validateRecord(rec) -> reason string or null.
function validateRecord(rec) {
  if (!rec || typeof rec !== 'object' || Array.isArray(rec)) return 'not_an_object';
  const keys = Object.keys(rec);
  for (let i = 0; i < AUDIT_KEYS.length; i += 1) {
    if (keys.indexOf(AUDIT_KEYS[i]) === -1) return 'missing_key';
  }
  if (keys.length !== AUDIT_KEYS.length) return 'extra_key';
  if (typeof rec.ts !== 'string' || typeof rec.run_id !== 'string' || typeof rec.grant_id !== 'string') return 'bad_type';
  if (!Number.isInteger(rec.grant_version)) return 'bad_type';
  if (typeof rec.q !== 'string' || typeof rec.q_hash !== 'string') return 'bad_type';
  if (typeof rec.template_id !== 'string' || typeof rec.family !== 'string' || typeof rec.provider !== 'string') return 'bad_type';
  if (VERDICTS.indexOf(rec.part8_verdict) === -1) return 'bad_verdict';
  if (OUTCOMES.indexOf(rec.outcome) === -1) return 'bad_outcome';
  if (rec.filters === null || typeof rec.filters !== 'object') return 'bad_type';
  const pg = rec.pagination;
  if (!pg || typeof pg !== 'object' || !('per_page' in pg) || !('page' in pg)) return 'bad_type';
  if (typeof rec.fallback_used !== 'boolean') return 'bad_type';
  if (!isStrOrNull(rec.origin_ref) || !isStrOrNull(rec.failure_class) || !isStrOrNull(rec.x_query)) return 'bad_type';
  if (!isStrArray(rec.result_ids) || !isStrArray(rec.content_hashes)) return 'bad_type';
  if (!isNumOrNull(rec.count) || !isNumOrNull(rec.cost_usd) || !isNumOrNull(rec.remaining_usd) || !isNumOrNull(rec.latency_ms)) return 'bad_type';
  return null;
}

// appendAudit(roomDir, record, opts) -> {ok:true} | {ok:false, reason}. Never throws.
// Key order is normalized to AUDIT_KEYS so every line reads the same.
// 366-17 (ADR-E16): the record's provider maps to a line of the one egress policy; a record for a
// line that is off (or for a provider with no line) is refused with egress_line_off and nothing is
// written. A WEB provider (openalex, tavily, patents) has no policy line since 2026-10-05
// (369.2-05): the ledger is the record of every web string, not a gate, so it is always written
// (a key-shaped line is still refused). opts.policy lets a caller that already loaded the policy
// skip the re-read.
function appendAudit(roomDir, record, opts) {
  const bad = validateRecord(record);
  if (bad) return { ok: false, reason: bad };
  if (egressPolicy.WEB_PROVIDERS.indexOf(record.provider) === -1) {
    const policy = opts && opts.policy ? opts.policy : egressPolicy.loadEgressPolicy(roomDir);
    if (!egressPolicy.lineAllowed(policy, egressPolicy.lineForProvider(record.provider))) return { ok: false, reason: 'egress_line_off' };
  }
  const ordered = {};
  AUDIT_KEYS.forEach(function (k) { ordered[k] = record[k]; });
  const line = JSON.stringify(ordered);
  if (looksLikeKey(line)) return { ok: false, reason: 'key_shaped_value' };
  try {
    fs.mkdirSync(path.join(roomDir, '.mindrian'), { recursive: true });
    fs.appendFileSync(auditPath(roomDir), line + '\n', 'utf8');
  } catch (_e) {
    return { ok: false, reason: 'write_failed' };
  }
  return { ok: true };
}

// readAudit(roomDir, {run_id}) -> records in file order; torn lines skipped.
function readAudit(roomDir, opts) {
  let raw;
  try { raw = fs.readFileSync(auditPath(roomDir), 'utf8'); } catch (_e) { return []; }
  const want = opts && opts.run_id;
  const out = [];
  raw.split('\n').forEach(function (line) {
    if (!line) return;
    let o;
    try { o = JSON.parse(line); } catch (_e) { return; }
    if (!o || typeof o !== 'object') return;
    if (want && o.run_id !== want) return;
    out.push(o);
  });
  return out;
}

function sliceForRun(roomDir, runId) {
  return readAudit(roomDir, { run_id: runId });
}

module.exports = {
  AUDIT_KEYS,
  appendAudit,
  readAudit,
  sliceForRun,
};
