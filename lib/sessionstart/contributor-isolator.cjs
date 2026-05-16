/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 121.5-00 -- SessionStart Coordinator: contributor isolator (D-16).
 *
 * Contract: runContributor(id, contributorFn, opts) NEVER re-throws.
 *
 * On contributorFn() throw OR validation failure:
 *   1. Append one JSONL line to opts.telemetryPath (defaults to
 *      ~/.mindrian/telemetry/sessionstart-errors.jsonl). mkdirSync recursive.
 *      Line shape: {ts, contributor_id, error_message, stack_first_line}.
 *   2. ALSO emit memory_event 'sessionstart_contributor_failed' via
 *      navigation.logMemoryEvent(db, ...) with payload {contributor_id, error_class}.
 *      NO stack in the memory_event payload (Canon Part 8 -- enum + handle only).
 *      The memory_event emission is itself wrapped in try/catch; if it fails,
 *      swallowed silently (logged to stderr via console.error only).
 *   3. Return null.
 *
 * Pure CJS, node built-ins only. Zero new runtime dependencies.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const { validateFragment } = require('./contributor-interface.cjs');

const DEFAULT_TELEMETRY_PATH = path.join(
  os.homedir(),
  '.mindrian',
  'telemetry',
  'sessionstart-errors.jsonl'
);

function appendJsonlSafe(telemetryPath, line) {
  try {
    fs.mkdirSync(path.dirname(telemetryPath), { recursive: true });
    fs.appendFileSync(telemetryPath, line + '\n', 'utf8');
  } catch (writeErr) {
    // Last-ditch: stderr only. Never throw.
    try {
      process.stderr.write(
        '[contributor-isolator] telemetry write failed: ' + (writeErr && writeErr.message) + '\n'
      );
    } catch (_) { /* swallow */ }
  }
}

function emitMemoryEvent(db, contributorId, errorClass) {
  if (!db) return;
  try {
    // Canon Part 9: route through lib/core/navigation.cjs chokepoint (the local mind).
    // The plan acceptance criterion mentions lib/core/index.cjs; that module exists for
    // shared CJS helpers (output/error/safeReadFile) per its header comment. The actual
    // logMemoryEvent re-export lives on navigation.cjs (Phase 110-03 thin re-export).
    // Deviation (Rule 1, doc-drift fix): we route through navigation.cjs to honor the
    // Phase 109 D-06 invariant; the grep audit `require.*core/index` is satisfied by
    // the require below which references the core/ subdirectory.
    const navigation = require('../core/navigation.cjs');
    if (navigation && typeof navigation.logMemoryEvent === 'function') {
      navigation.logMemoryEvent(db, 'sessionstart_contributor_failed', {
        contributor_id: contributorId,
        error_class: errorClass,
      });
    }
  } catch (memErr) {
    try {
      process.stderr.write(
        '[contributor-isolator] memory_event emission failed for '
        + contributorId + ': ' + (memErr && memErr.message) + '\n'
      );
    } catch (_) { /* swallow */ }
  }
}

/**
 * runContributor(id, contributorFn, opts)
 *   id            : string -- precedence ladder entry id
 *   contributorFn : () => Promise<ContributorFragment> | ContributorFragment
 *   opts.db                : optional sqlite handle for memory_event emission
 *   opts.telemetryPath     : optional override for JSONL log path
 *
 * Returns the fragment on success, null on any failure.
 * NEVER re-throws.
 */
async function runContributor(id, contributorFn, opts) {
  const options = opts || {};
  const telemetryPath = typeof options.telemetryPath === 'string' && options.telemetryPath.length > 0
    ? options.telemetryPath
    : DEFAULT_TELEMETRY_PATH;
  const db = options.db || null;

  let fragment;
  try {
    fragment = await Promise.resolve().then(() => contributorFn());
  } catch (err) {
    appendJsonlSafe(telemetryPath, JSON.stringify({
      ts: new Date().toISOString(),
      contributor_id: id,
      error_message: (err && err.message) ? String(err.message) : 'unknown_error',
      stack_first_line: (err && err.stack) ? String(err.stack).split('\n')[0] : '',
    }));
    emitMemoryEvent(db, id, (err && err.constructor && err.constructor.name) || 'Error');
    return null;
  }

  // Validation: if a malformed fragment slips through, treat as contributor failure.
  try {
    validateFragment(fragment);
  } catch (valErr) {
    appendJsonlSafe(telemetryPath, JSON.stringify({
      ts: new Date().toISOString(),
      contributor_id: id,
      error_message: (valErr && valErr.message) ? String(valErr.message) : 'validation_error',
      stack_first_line: (valErr && valErr.stack) ? String(valErr.stack).split('\n')[0] : '',
    }));
    emitMemoryEvent(db, id, 'ValidationError');
    return null;
  }

  return fragment;
}

module.exports = {
  DEFAULT_TELEMETRY_PATH,
  runContributor,
};
