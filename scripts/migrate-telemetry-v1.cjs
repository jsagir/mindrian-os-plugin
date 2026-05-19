#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 121-01 Task 1 -- one-time idempotent migration of the 4 piecemeal
 * telemetry sources into the unified events-YYYY-WNN.jsonl stream produced
 * by lib/core/telemetry/writer.cjs (shipped in Plan 121-00).
 *
 * Sources (in order):
 *   1. ~/.mindrian/telemetry/v1.13/mva.jsonl           (Phase 118)
 *   2. ~/.mindrian/telemetry/selector.jsonl            (Phase 88.1 Plan 16 / 88.2)
 *   3. ~/.mindrian/telemetry/navigation-bypass.jsonl   (lib/core/room-db.cjs)
 *   4. ~/.mindrian/telemetry/query-efficiency.jsonl    (Phase 88.1 Plan 16)
 *
 * Destination:
 *   ~/.mindrian/telemetry/v1.13/events-YYYY-WNN.jsonl  (one file per ISO week)
 *
 * Per Canon Part 8 (Graph Boundary): every row passes through
 * validateEventPayload BEFORE the append. Rejected rows quarantine to
 * .quarantine-<source>.jsonl with a short reason; migration does NOT abort
 * on a single bad row. The quarantine timestamp is still covered by the
 * idempotence fingerprint so a re-run will not retry the bad row.
 *
 * Per Canon Part 9 (Memory Locality + single chokepoint): writer.emit()
 * would overwrite the historical timestamp with `new Date()`. To preserve
 * the original event time, this script bypasses writer.emit() and appends
 * directly via fs.appendFileSync AFTER explicit validateEventPayload
 * dispatch. This is a documented chokepoint exception, scoped to this
 * one-shot migration script -- runtime emit paths (Plans 121-02 / 121-03)
 * MUST route through writer.emit() unchanged. The SUMMARY documents this
 * exception for the verifier.
 *
 * Idempotence:
 *   - Compute sha256 of first 5 timestamps in each source file.
 *   - Persist seen fingerprints to .migration-fingerprints.json under
 *     ~/.mindrian/telemetry/v1.13/ alongside the events files.
 *   - On re-run, if the fingerprint is in the seen list, skip the source.
 *
 * Backup naming:
 *   - Originals rename to <filename>.pre-v121.bak so they remain
 *     inspectable but no longer accept new writes.
 *
 * Em-dash-free per memory rule. Pure CJS, node built-ins only. Zero
 * runtime dependencies. Zero network surface.
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');

const REPO = path.resolve(__dirname, '..');
const { validateEventPayload } = require(path.join(REPO, 'lib/core/telemetry/validator.cjs'));
const { ALLOWED_FIELDS, SCHEMA_VERSION } = require(path.join(REPO, 'lib/core/telemetry/schema.cjs'));

// ---------- Path resolvers (env-aware for hermetic testing) ----------

function homeDir() {
  return process.env.HOME || process.env.USERPROFILE || os.homedir();
}

function telemetryRoot() {
  return path.join(homeDir(), '.mindrian', 'telemetry');
}

function v113Dir() {
  return path.join(telemetryRoot(), 'v1.13');
}

// ---------- The 4 source descriptors with normalizers ----------

const SOURCES = [
  {
    name: 'mva',
    path: function () { return path.join(v113Dir(), 'mva.jsonl'); },
    normalize: function (row) {
      // mva.* event types and ALLOWED_FIELDS are inherited byte-identically
      // in schema.cjs. Pass through verbatim; the dispatch loop below strips
      // any extra keys via the ALLOWED_FIELDS whitelist.
      return row;
    }
  },
  {
    name: 'selector',
    path: function () { return path.join(telemetryRoot(), 'selector.jsonl'); },
    normalize: normalizeSelectorRow
  },
  {
    name: 'navigation-bypass',
    path: function () { return path.join(telemetryRoot(), 'navigation-bypass.jsonl'); },
    normalize: normalizeNavBypassRow
  },
  {
    name: 'query-efficiency',
    path: function () { return path.join(telemetryRoot(), 'query-efficiency.jsonl'); },
    normalize: normalizeQueryEfficiencyRow
  }
];

// ---------- Normalizers ----------

function normalizeSelectorRow(row) {
  // Legacy selector.jsonl rows are typically {event:'query.served',
  // command:'/mos:X', ratio:N, room_slug:'...'}. Plan 121-02 will wire the
  // proper selector_pick capture (sub_shape / mode / ranker_confidence);
  // legacy rows lack those fields. Coerce to command_invocation per the
  // PLAN normalization map (Source 2 -> command_invocation).
  const command = String(row.command || '').slice(0, 64);
  const ratio = Number(row.ratio);
  return {
    event: 'command_invocation',
    timestamp: row.ts || row.timestamp || new Date(0).toISOString(),
    command: command,
    outcome: 'served',
    duration_ms: Number.isFinite(ratio) ? Math.round(ratio) : 0,
    context_hash: sha256hex(String(row.room_slug || '')).slice(0, 16)
  };
}

function normalizeNavBypassRow(row) {
  // Source 3: navigation-bypass.jsonl already shaped close to the
  // unified nav_bypass schema. Add the event discriminator and
  // (if missing) the room_slug_sha256 derived from any `room` field.
  return {
    event: 'nav_bypass',
    timestamp: row.timestamp || new Date(0).toISOString(),
    op: String(row.op || '').slice(0, 64),
    reason: String(row.reason || '').slice(0, 64),
    caller_hash: String(row.caller_hash || '').slice(0, 16),
    room_slug_sha256: String(row.room_slug_sha256 || sha256hex(String(row.room || '')))
  };
}

function normalizeQueryEfficiencyRow(row) {
  // Source 4 shares the legacy 'query.served' shape with Source 2.
  return normalizeSelectorRow(row);
}

// ---------- Pure helpers ----------

function sha256hex(s) {
  return crypto.createHash('sha256').update(s).digest('hex');
}

// ISO-week filename helper; mirrors writer.cjs isoWeekFilename math exactly
// (UTC throughout; year is the year of the shifted Thursday).
function isoWeekKey(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return d.getUTCFullYear() + '-W' + String(weekNum).padStart(2, '0');
}

// ---------- Idempotence: sha256 of source-name + first 5 timestamps ----------
//
// The fingerprint includes the source name so two source files with
// coincidentally-identical first-5 timestamps (a real-world case when
// users seed multiple stream types from the same boot event) do not
// collide on the seen-list. This is the unit of idempotence: one source
// file with a specific timestamp prefix.

function sourceFingerprint(filePath, sourceName) {
  if (!fs.existsSync(filePath)) return null;
  let text;
  try { text = fs.readFileSync(filePath, 'utf8'); } catch (_) { return null; }
  const ts = [];
  for (const line of text.split('\n')) {
    if (!line) continue;
    let row;
    try { row = JSON.parse(line); } catch (_) { continue; }
    const t = row.timestamp || row.ts;
    if (t) ts.push(t);
    if (ts.length >= 5) break;
  }
  if (ts.length === 0) return null;
  const prefix = sourceName ? String(sourceName) + '|' : '';
  return sha256hex(prefix + ts.join('|'));
}

function fingerprintsPath() {
  return path.join(v113Dir(), '.migration-fingerprints.json');
}

function alreadyMerged(fingerprint) {
  if (!fingerprint) return false;
  const p = fingerprintsPath();
  if (!fs.existsSync(p)) return false;
  try {
    const seen = JSON.parse(fs.readFileSync(p, 'utf8'));
    return Array.isArray(seen.fingerprints) && seen.fingerprints.includes(fingerprint);
  } catch (_) {
    return false;
  }
}

function recordFingerprint(fingerprint) {
  if (!fingerprint) return;
  fs.mkdirSync(v113Dir(), { recursive: true });
  const p = fingerprintsPath();
  let prior = { fingerprints: [] };
  if (fs.existsSync(p)) {
    try { prior = JSON.parse(fs.readFileSync(p, 'utf8')); } catch (_) {}
    if (!Array.isArray(prior.fingerprints)) prior.fingerprints = [];
  }
  if (!prior.fingerprints.includes(fingerprint)) {
    prior.fingerprints.push(fingerprint);
  }
  fs.writeFileSync(p, JSON.stringify(prior, null, 2), 'utf8');
}

// ---------- Append-historical (the Canon Part 9 chokepoint exception) ----------
//
// writer.emit() overwrites timestamp with `new Date()`. We preserve the
// historical timestamp so post-hoc analysis of the migrated corpus is
// time-accurate. The Canon Part 8 gate (validateEventPayload) is enforced
// inline at every call site; the chokepoint deviation is scoped to this
// migration script and documented in the file header.

function appendUnified(eventType, payload, historicalTimestamp) {
  const ts = historicalTimestamp || new Date(0).toISOString();
  const date = new Date(ts);
  fs.mkdirSync(v113Dir(), { recursive: true });
  const fname = 'events-' + isoWeekKey(date) + '.jsonl';
  const target = path.join(v113Dir(), fname);
  const record = Object.assign(
    {
      event: eventType,
      schema_version: SCHEMA_VERSION,
      timestamp: ts,
      session_id: 'migrated'
    },
    payload
  );
  try {
    fs.appendFileSync(target, JSON.stringify(record) + '\n', 'utf8');
  } catch (_) {
    // Best-effort: telemetry storage failure must never crash the migration.
  }
}

function appendQuarantine(sourceName, originalRow, reason) {
  fs.mkdirSync(v113Dir(), { recursive: true });
  const qPath = path.join(v113Dir(), '.quarantine-' + sourceName + '.jsonl');
  const line = JSON.stringify({
    source: sourceName,
    reason: String(reason).slice(0, 60),
    original_sha256: sha256hex(JSON.stringify(originalRow))
  }) + '\n';
  try { fs.appendFileSync(qPath, line, 'utf8'); } catch (_) {}
}

// ---------- Per-source migration ----------

function migrateOne(source) {
  const p = source.path();
  const result = {
    name: source.name,
    migrated: 0,
    quarantined: 0,
    idempotent_skipped: 0,
    renamed: false
  };
  if (!fs.existsSync(p)) return result;

  const fingerprint = sourceFingerprint(p, source.name);
  if (fingerprint && alreadyMerged(fingerprint)) {
    result.idempotent_skipped = 1;
    return result;
  }

  let text;
  try { text = fs.readFileSync(p, 'utf8'); } catch (_) { return result; }
  const rows = [];
  for (const line of text.split('\n')) {
    if (!line) continue;
    try { rows.push(JSON.parse(line)); } catch (_) { continue; }
  }

  // Sort by timestamp ASC for stable replay order. Use the legacy field
  // names (timestamp or ts) before normalization since the source may use
  // either.
  rows.sort(function (a, b) {
    const ta = a.timestamp || a.ts || '';
    const tb = b.timestamp || b.ts || '';
    return String(ta).localeCompare(String(tb));
  });

  for (const raw of rows) {
    let normalized;
    try { normalized = source.normalize(raw); } catch (_) {
      result.quarantined++;
      appendQuarantine(source.name, raw, 'normalize_threw');
      continue;
    }
    const eventType = normalized && normalized.event;
    const allowed = eventType ? ALLOWED_FIELDS[eventType] : null;
    if (!allowed) {
      result.quarantined++;
      appendQuarantine(source.name, raw, 'unknown_event:' + String(eventType));
      continue;
    }
    // Strip to whitelist; the validator will reject any leftover-key surprise
    // but the whitelist pre-filter catches the common case (extra legacy
    // fields like 'tool' or 'tokens_used' that ALLOWED_FIELDS does not cover).
    const payload = {};
    for (const k of allowed) {
      if (normalized[k] !== undefined) payload[k] = normalized[k];
    }
    // Canon Part 8 emit-time gate -- inline at the migration call site.
    const v = validateEventPayload(eventType, payload);
    if (!v.ok) {
      result.quarantined++;
      appendQuarantine(source.name, raw, v.error);
      continue;
    }
    appendUnified(eventType, payload, normalized.timestamp);
    result.migrated++;
  }

  // Record fingerprint + rename source AFTER processing (quarantined rows
  // are still covered by the fingerprint so a re-run does not retry).
  if (fingerprint) recordFingerprint(fingerprint);
  try {
    fs.renameSync(p, p + '.pre-v121.bak');
    result.renamed = true;
  } catch (_) {}

  return result;
}

// ---------- main ----------

function main() {
  const summary = {
    migrated: 0,
    quarantined: 0,
    idempotent_skipped: 0,
    sources_renamed: [],
    target_files_touched: [],
    per_source: []
  };
  for (const s of SOURCES) {
    const r = migrateOne(s);
    summary.migrated += r.migrated;
    summary.quarantined += r.quarantined;
    summary.idempotent_skipped += r.idempotent_skipped;
    if (r.renamed) summary.sources_renamed.push(s.name);
    summary.per_source.push(r);
  }
  // Best-effort enumerate events files touched in the destination dir.
  try {
    if (fs.existsSync(v113Dir())) {
      summary.target_files_touched = fs.readdirSync(v113Dir())
        .filter(function (f) { return /^events-\d{4}-W\d{2}\.jsonl$/.test(f); })
        .sort();
    }
  } catch (_) {}
  process.stdout.write(JSON.stringify(summary, null, 2) + '\n');
  process.exit(0);
}

if (require.main === module) main();

module.exports = {
  migrateOne,
  sourceFingerprint,
  alreadyMerged,
  recordFingerprint,
  isoWeekKey,
  sha256hex,
  normalizeSelectorRow,
  normalizeNavBypassRow,
  normalizeQueryEfficiencyRow,
  appendUnified,
  appendQuarantine,
  SOURCES,
  homeDir,
  telemetryRoot,
  v113Dir
};
