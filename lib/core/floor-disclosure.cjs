/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 355 (Hidden in Plain Sight: Jev-through-Theo cross-connection
 * engines) Plan 04 -- HIPS-02 / D-19 / D-22. One helper every producer calls
 * to turn data/floor-ledger.json into the honest statement a user never
 * mistakes for a measured verdict: "this cut-off is a default." No value
 * ever rides the disclosure text (D-30 decimal regex asserted per producer
 * in tests/test-355-floor-sweep.cjs).
 *
 * Exports: PRODUCER_IDS, loadLedger, disclosureFor, disclosureLine.
 * No zod, no network, no writes. Requires only node:fs and node:path.
 *
 * No em-dashes (CLAUDE.md HARD RULE). Hyphens only.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

// ---------------------------------------------------------------------------
// PRODUCER_IDS -- the five producers a disclosed floor can be shown against.
// Frozen: this is a closed set for this phase.
// ---------------------------------------------------------------------------
const PRODUCER_IDS = Object.freeze(['eureka', 'find-connections', 'find-bottlenecks', 'hsi', 'whitespace']);

const LEDGER_REL_PATH = path.join('data', 'floor-ledger.json');

let _cachedLedger = null;

// ---------------------------------------------------------------------------
// loadLedger() -- lazy fs read, cached for the life of the process. Degrades
// to { rows: [] } on any read/parse failure so a render can never crash on a
// missing or malformed ledger (T-355-20, accepted risk: loadLedger degrades,
// the sweep test catches a missing ledger in CI).
// ---------------------------------------------------------------------------
function loadLedger() {
  if (_cachedLedger !== null) return _cachedLedger;
  try {
    const repoRoot = path.resolve(__dirname, '..', '..');
    const raw = fs.readFileSync(path.join(repoRoot, LEDGER_REL_PATH), 'utf8');
    const parsed = JSON.parse(raw);
    _cachedLedger = (parsed && Array.isArray(parsed.rows)) ? parsed : { rows: [] };
  } catch (_e) {
    _cachedLedger = { rows: [] };
  }
  return _cachedLedger;
}

function _assertKnownProducer(producerId) {
  if (!PRODUCER_IDS.includes(producerId)) {
    throw new Error('floor-disclosure: unknown producer id "' + producerId + '" (expected one of ' + PRODUCER_IDS.join(', ') + ')');
  }
}

function _rowsFor(producerId) {
  const ledger = loadLedger();
  return ledger.rows.filter((r) => r.status === 'disclosed' && Array.isArray(r.dependent_outputs) && r.dependent_outputs.includes(producerId));
}

function _lowerFirst(s) {
  if (typeof s !== 'string' || s.length === 0) return s;
  return s.charAt(0).toLowerCase() + s.slice(1);
}

// ---------------------------------------------------------------------------
// disclosureFor(producerId) -- the devpkg-shaped disclosure block: observation
// and suggests stay null (this helper renders nothing but the unverified
// floor list), unverified is one plain sentence per disclosed row this
// producer depends on, never the numeric value, evidence_used is the row ids
// behind it.
// ---------------------------------------------------------------------------
function disclosureFor(producerId) {
  _assertKnownProducer(producerId);
  const rows = _rowsFor(producerId);
  return {
    observation: null,
    suggests: null,
    unverified: rows.map((r) => _lowerFirst(r.gates) + ' uses a default cut-off that has not been calibrated'),
    evidence_used: rows.map((r) => r.id),
  };
}

// ---------------------------------------------------------------------------
// disclosureLine(producerId) -- the one rendered line every producer prints.
// Fixed text, no producer-specific number, no percent: honest and generic on
// purpose.
// ---------------------------------------------------------------------------
function disclosureLine(producerId) {
  _assertKnownProducer(producerId);
  return 'unverified: the cut-offs behind these findings are defaults, not calibrated yet (data/floor-ledger.json)';
}

module.exports = {
  PRODUCER_IDS: PRODUCER_IDS,
  loadLedger: loadLedger,
  disclosureFor: disclosureFor,
  disclosureLine: disclosureLine,
};
