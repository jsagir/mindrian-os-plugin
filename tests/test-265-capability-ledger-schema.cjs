#!/usr/bin/env node
'use strict';
/*
 * tests/test-265-capability-ledger-schema.cjs -- Phase 265 Plan 01 Task 2.
 *
 * Row-shape and enum validation for every row in data/capability-ledger.json.
 * Plain Node script (no node:test), matching the phase harness contract
 * (tests/run-all-265.sh runs it via bare `node "$t"`).
 *
 * Parses with JSON.parse only -- never eval. A row with an extra or missing
 * key, an out-of-enum value, or an empty evidence citation is exactly the
 * rot pattern Phase 138's markdown table let back in; this script exists to
 * make that rot loud instead of silent.
 */

const fs = require('fs');
const path = require('path');

const LEDGER_PATH = path.join(__dirname, '..', 'data', 'capability-ledger.json');

const REQUIRED_KEYS = [
  'capability',
  'version',
  'date',
  'domain',
  'leverage',
  'destination',
  'status',
  'evidence',
];

// Plan 265-06: one optional ninth key, a cross-reference to the document that
// carries the reasoning for a row whose disposition needed a judgment call
// rather than a mechanical read. Optional means: permitted, never required.
// The extra-key rejection below stays in force for anything outside this set --
// widening it further would loosen the injection fence from plan 265-05's
// threat register (T-265-23), which this schema test exists to hold shut.
const OPTIONAL_KEYS = ['decision_ref'];
const ALLOWED_KEYS = REQUIRED_KEYS.concat(OPTIONAL_KEYS);

const STATUS_ENUM = ['dormant', 'adopting', 'shipped', 'superseded', 'no-op'];
const DOMAIN_ENUM = ['models', 'code', 'desktop_cowork', 'plugins_mcp', 'visualization'];

const CLAUDE_CODE_VERSION_PATTERN = /^\d+\.\d+\.\d+$/;
const DOTTED_VERSION_PATTERN = /^\d+\.\d+\.\d+$/;

let failed = false;

function fail(msg) {
  console.error('FAIL: ' + msg);
  failed = true;
}

let raw;
try {
  raw = fs.readFileSync(LEDGER_PATH, 'utf8');
} catch (e) {
  console.error('FAIL: could not read ' + LEDGER_PATH + ': ' + e.message);
  process.exit(1);
}

let ledger;
try {
  ledger = JSON.parse(raw);
} catch (e) {
  console.error('FAIL: ' + LEDGER_PATH + ' is not valid JSON: ' + e.message);
  process.exit(1);
}

// schema_version
if (ledger.schema_version !== 1) {
  fail('schema_version must be 1, got: ' + JSON.stringify(ledger.schema_version));
}

// ledger_covers
const lc = ledger.ledger_covers;
if (!lc || typeof lc !== 'object') {
  fail('ledger_covers must be an object');
} else {
  const lcKeys = ['from', 'to', 'fetched_at', 'installed_claude_version'];
  for (const k of lcKeys) {
    if (!(k in lc)) fail('ledger_covers missing key: ' + k);
  }
  if (typeof lc.from !== 'string' || !DOTTED_VERSION_PATTERN.test(lc.from)) {
    fail('ledger_covers.from must be a dotted version string, got: ' + JSON.stringify(lc.from));
  }
  if (typeof lc.to !== 'string' || !DOTTED_VERSION_PATTERN.test(lc.to)) {
    fail('ledger_covers.to must be a dotted version string, got: ' + JSON.stringify(lc.to));
  }
}

// entries
if (!Array.isArray(ledger.entries) || ledger.entries.length === 0) {
  fail('entries must be a non-empty array');
} else {
  let highestDottedVersion = null;
  ledger.entries.forEach((row, idx) => {
    if (!row || typeof row !== 'object') {
      fail('entries[' + idx + '] is not an object');
      return;
    }
    const rowKeys = Object.keys(row);
    for (const k of REQUIRED_KEYS) {
      if (!(k in row)) fail('entries[' + idx + '] missing required key: ' + k);
    }
    for (const k of rowKeys) {
      if (!ALLOWED_KEYS.includes(k)) fail('entries[' + idx + '] has extra key: ' + k);
    }
    if (!STATUS_ENUM.includes(row.status)) {
      fail('entries[' + idx + '].status invalid: ' + JSON.stringify(row.status));
    }
    if (!DOMAIN_ENUM.includes(row.domain)) {
      fail('entries[' + idx + '].domain invalid: ' + JSON.stringify(row.domain));
    }
    if (typeof row.evidence !== 'string' || row.evidence.length === 0) {
      fail('entries[' + idx + '].evidence must be a non-empty string');
    }
    if ('decision_ref' in row && (typeof row.decision_ref !== 'string' || row.decision_ref.length === 0)) {
      fail('entries[' + idx + '].decision_ref must be a non-empty string when present');
    }
    if (typeof row.version === 'string' && CLAUDE_CODE_VERSION_PATTERN.test(row.version)) {
      if (highestDottedVersion === null || compareDotted(row.version, highestDottedVersion) > 0) {
        highestDottedVersion = row.version;
      }
    }
  });

  if (lc && typeof lc.to === 'string' && highestDottedVersion !== null) {
    if (lc.to !== highestDottedVersion) {
      fail(
        'ledger_covers.to (' +
          lc.to +
          ') does not equal the highest dotted-triple version among entries (' +
          highestDottedVersion +
          ')'
      );
    }
  }
}

function compareDotted(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return pa[i] - pb[i];
  }
  return 0;
}

if (failed) {
  console.error('tests/test-265-capability-ledger-schema.cjs: FAILED');
  process.exit(1);
}

console.log('tests/test-265-capability-ledger-schema.cjs: PASSED (' + ledger.entries.length + ' rows)');
process.exit(0);
