'use strict';

/*
 * Phase 127-01 Task 1 -- pure helpers for the Phase 127 migration script
 * (scripts/migrate-brain-mcp-from-http-to-stdio.cjs).
 *
 * Addresses BRAIN-MCP-127-06 (SG-2 snapshot path helper) +
 * BRAIN-MCP-127-07 (SG-4 idempotency log + sha256 fingerprint + raw-identifier
 * scrub).
 *
 * Pure module. NO network surface. NO process spawning. NO claude CLI
 * invocations (those live in the orchestration script, Task 2). Canon Part 8
 * delegation property: this file contains zero direct network calls.
 *
 * Source-name-prefixed sha256 fingerprint pattern matches TELEMETRY-121-02:
 *   fingerprint = sha256(SOURCE_NAME_PREFIX + JSON.stringify(entry-tuple)).slice(0, 16)
 *
 * The 16-hex-char truncation matches lib/core/brain-client.cjs::_hashKey (64
 * bits of key space, effectively zero collision at this volume).
 *
 * SG-4 raw-identifier guard: appendMigrationLog rejects any record string
 * matching Bearer-token / UUID / long-base64-or-hex (>= 24 chars, alphabet-
 * heterogeneous) regexes. Sha256 fingerprints (exactly 16 or 64 hex chars)
 * are whitelisted by-length-and-alphabet so legitimate migration metadata
 * passes through.
 *
 * HARD RULE: zero em-dashes in this file (hyphens only).
 */

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const SOURCE_NAME_PREFIX = 'mindrian-brain:';

/**
 * Compute a stable 16-hex-char sha256 fingerprint over a Brain MCP entry.
 * Mirrors brain-client.cjs::_hashKey shape verbatim (sha256 truncated).
 * Source-name prefix prevents cross-source collisions per TELEMETRY-121-02.
 *
 * @param {{command?: string, args?: string[], env?: object, type?: string}} entry
 * @returns {string}
 */
function fingerprintEntry(entry) {
  const e = entry || {};
  const input = SOURCE_NAME_PREFIX + JSON.stringify({
    command: e.command,
    args: e.args,
    env: e.env,
    type: e.type,
  });
  return crypto.createHash('sha256').update(input).digest('hex').slice(0, 16);
}

/**
 * Compute the pre-migration snapshot path. Replace colons with dashes for
 * Windows / CIFS filesystem safety per Tavily A127.3 cross-platform note.
 *
 * @param {string} homeDir
 * @param {string} isoTimestamp
 * @returns {string}
 */
function snapshotPath(homeDir, isoTimestamp) {
  const safe = String(isoTimestamp).replace(/:/g, '-');
  return path.join(homeDir, '.mindrian', 'pre-migration-snapshots', safe + '.json');
}

/**
 * Read the migration log (jsonl). Graceful when missing. Parse errors on a
 * single line skip that line silently (project precedent: migrate-telemetry-v1
 * uses the same shape).
 *
 * @param {string} homeDir
 * @returns {Array<object>}
 */
function readMigrationsLog(homeDir) {
  const logPath = path.join(homeDir, '.mindrian', 'migrations.jsonl');
  if (!fs.existsSync(logPath)) return [];
  let text;
  try { text = fs.readFileSync(logPath, 'utf8'); } catch (_) { return []; }
  const rows = [];
  for (const line of text.split('\n')) {
    if (!line) continue;
    try { rows.push(JSON.parse(line)); } catch (_) { continue; }
  }
  return rows;
}

/**
 * SG-4 raw-identifier guard. Recursively walk a record, scan strings for
 * Bearer / UUID / long-base64-or-hex (>= 24 chars) shapes. Whitelist exact
 * 16-char (truncated) and 64-char (full) sha256 by length-and-alphabet so
 * legitimate fingerprint fields pass through. Throw on any match.
 *
 * @param {object} record
 */
function _scanForRawIdentifiers(record) {
  const bearerRe = /Bearer\s+[A-Za-z0-9._\-]{16,}/i;
  const uuidRe = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
  const longRe = /[A-Za-z0-9+/=_\-]{24,}/;
  const sha256Full = /^[a-f0-9]{64}$/i;

  function walk(node) {
    if (node == null) return;
    if (typeof node === 'string') {
      if (bearerRe.test(node)) throw new Error('raw user identifier detected in migration log record (Bearer)');
      if (uuidRe.test(node)) throw new Error('raw user identifier detected in migration log record (UUID)');
      if (longRe.test(node)) {
        if (sha256Full.test(node)) return;
        throw new Error('raw user identifier detected in migration log record (long alphanumeric run)');
      }
      return;
    }
    if (Array.isArray(node)) { for (const v of node) walk(v); return; }
    if (typeof node === 'object') {
      for (const [k, v] of Object.entries(node)) {
        if (k === 'fingerprint' && typeof v === 'string' && /^[a-f0-9]{16}$/.test(v)) continue;
        walk(v);
      }
    }
  }

  walk(record);
}

/**
 * Append a record to the migration log. Enforces SG-4 raw-identifier scrub
 * BEFORE the write. Creates parent dir with mode 0700 (POSIX). Chmods the
 * log file to mode 0600 after first write per SEC-02 hygiene.
 *
 * @param {string} homeDir
 * @param {object} record
 */
function appendMigrationLog(homeDir, record) {
  _scanForRawIdentifiers(record);
  const dir = path.join(homeDir, '.mindrian');
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const logPath = path.join(dir, 'migrations.jsonl');
  const existed = fs.existsSync(logPath);
  fs.appendFileSync(logPath, JSON.stringify(record) + '\n');
  if (process.platform !== 'win32') {
    try { fs.chmodSync(logPath, 0o600); } catch (_) { /* best-effort */ }
  }
  return { written: true, log_path: logPath, first_write: !existed };
}

/**
 * Return true if a prior 'removed' record exists for (sourceName, fingerprint).
 *
 * @param {string} homeDir
 * @param {string} sourceName
 * @param {string} fingerprint
 * @returns {boolean}
 */
function isAlreadyMigrated(homeDir, sourceName, fingerprint) {
  const rows = readMigrationsLog(homeDir);
  for (const r of rows) {
    if (r && r.source === sourceName && r.fingerprint === fingerprint && r.action === 'removed') {
      return true;
    }
  }
  return false;
}

module.exports = {
  fingerprintEntry,
  snapshotPath,
  readMigrationsLog,
  appendMigrationLog,
  isAlreadyMigrated,
  _scanForRawIdentifiers,
};
