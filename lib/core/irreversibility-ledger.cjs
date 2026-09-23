'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 356 (chain-executor irreversibility ledger) R5/R6 -- the runtime
 * ledger reader.
 * =============================================================================
 * Reads a dev-time-scored ledger shipped as data (data/command-irreversibility-
 * ledger.json). Add-only: this module can force isIrreversibleStep to halt,
 * it can never clear a halt the older signals already decided. Zero network.
 * The ledger is read from local disk at most once per process; a missing or
 * unreadable ledger degrades to an empty result for every command.
 *
 * lib/ must never require the dev-time scoring client (scripts/jev-devtime-
 * client.cjs) or make a network call -- this file requires only node:fs,
 * node:path, node:crypto, and lazily the local command-resolver.
 *
 * A ledger entry counts only when its text_hash equals the sha256 hex of
 * JSON.stringify([command, teaching, jtbd_summary]) over the CURRENT registry
 * row for that command (non-string values normalize to ''). A stale, unknown
 * or malformed entry is ignored silently -- never thrown, never reported.
 *
 * License: BSL 1.1.
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

// Default ledger location. Test-only override via MINDRIAN_IRREVERSIBILITY_LEDGER,
// mirroring command-resolver.cjs's MINDRIAN_COMMAND_REGISTRY override.
const DEFAULT_LEDGER_PATH = path.join(__dirname, '..', '..', 'data', 'command-irreversibility-ledger.json');

function _ledgerPath() {
  const override = process.env.MINDRIAN_IRREVERSIBILITY_LEDGER;
  return (typeof override === 'string' && override.length > 0) ? override : DEFAULT_LEDGER_PATH;
}

// The ONE staleness hash basis. The builder (356-07) imports commandTextHash
// directly; a future Theo-side re-emission would port this documented rule.
const TEXT_HASH_BASIS = 'sha256 hex of UTF-8 JSON.stringify([command, teaching, jtbd_summary]), non-string -> ""';

function _norm(v) {
  return typeof v === 'string' ? v : '';
}

// commandTextHash(command, teaching, jtbdSummary) -> 64-char lowercase hex.
// Deterministic; never throws (non-string inputs normalize to '').
function commandTextHash(command, teaching, jtbdSummary) {
  const payload = JSON.stringify([_norm(command), _norm(teaching), _norm(jtbdSummary)]);
  return crypto.createHash('sha256').update(payload, 'utf8').digest('hex');
}

const TEXT_HASH_RE = /^[0-9a-f]{64}$/;

// Module-level cache: a Set of commands with a FRESH flag:true entry. null
// until the first forcesIrreversible call builds it (read at most once per
// process). __reset() clears it for tests.
let _fresh = null;

// _build() -> Set<string>. Any error anywhere in this path (missing file,
// malformed JSON, missing resolver, missing commandRow) degrades to an empty
// Set -- the add-only, silent-degradation contract (R5/R6).
function _build() {
  const out = new Set();

  let raw;
  try {
    raw = fs.readFileSync(_ledgerPath(), 'utf8');
  } catch (_e) {
    return out; // missing / unreadable ledger
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (_e) {
    return out; // malformed JSON
  }

  const entries = (parsed && Array.isArray(parsed.entries)) ? parsed.entries : [];
  if (entries.length === 0) return out;

  let resolver;
  try {
    resolver = require(path.join(__dirname, '..', 'workflow', 'command-resolver.cjs'));
  } catch (_e) {
    return out; // resolver unavailable
  }
  if (!resolver || typeof resolver.commandRow !== 'function') return out;

  for (const entry of entries) {
    if (!entry || typeof entry !== 'object') continue;
    if (entry.flag !== true) continue;
    if (typeof entry.command !== 'string') continue;
    if (typeof entry.text_hash !== 'string' || !TEXT_HASH_RE.test(entry.text_hash)) continue;

    const row = resolver.commandRow(entry.command);
    if (!row) continue; // unknown to the CURRENT registry: ignore

    if (commandTextHash(entry.command, row.teaching, row.jtbd_summary) === entry.text_hash) {
      out.add(entry.command);
    }
    // else: stale entry (registry text changed since scoring) -- ignore silently
  }

  return out;
}

// forcesIrreversible(command) -> boolean. Never throws. True only for a
// command with a fresh flag:true entry in the current ledger.
function forcesIrreversible(command) {
  try {
    if (_fresh === null) _fresh = _build();
    return typeof command === 'string' && _fresh.has(command);
  } catch (_e) {
    return false;
  }
}

// Test-only: clear the per-process cache so a test can rebuild against a
// different ledger / registry override.
function __reset() {
  _fresh = null;
}

module.exports = {
  DEFAULT_LEDGER_PATH: DEFAULT_LEDGER_PATH,
  TEXT_HASH_BASIS: TEXT_HASH_BASIS,
  commandTextHash: commandTextHash,
  forcesIrreversible: forcesIrreversible,
  // Test-only surface (see header).
  __reset: __reset,
};
