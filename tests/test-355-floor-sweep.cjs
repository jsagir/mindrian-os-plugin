#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 355 (Hidden in Plain Sight: Jev-through-Theo cross-connection
 * engines) Plan 04 -- the D-22 floor sweep. No threshold literal in the
 * engine families is allowed to slip in unrecorded: every hit the pattern
 * pass finds must resolve to a row in data/floor-ledger.json by file +
 * anchor, every row's anchor must actually match a line of its own file (no
 * stale anchors), a planted literal must be caught (negative control), and
 * every disclosed row's dependent producers must get an honest 'unverified'
 * disclosure through lib/core/floor-disclosure.cjs (Task 2 leg).
 *
 * Per tests/helpers/hygiene-355.cjs: scrubVendorKey() and installNetGuard()
 * run BEFORE any repo module is required, and attempts() === 0 is asserted
 * last.
 *
 * No em-dashes (CLAUDE.md HARD RULE). Hyphens only.
 */

'use strict';

const hygiene = require('./helpers/hygiene-355.cjs');
hygiene.scrubVendorKey();
const netGuard = hygiene.installNetGuard();

const fs = require('node:fs');
const path = require('node:path');

const REPO = path.join(__dirname, '..');
const checker = hygiene.makeChecker('test-355-floor-sweep');
const check = checker.check;

const ledger = require('../scripts/check-floor-ledger.cjs');

// ---------------------------------------------------------------------------
// EXPECTED_IDS: the D-21 inventory plus the two HIPS-02 research additions,
// as primary rows the ledger must carry (355-04-PLAN.md action text).
// ---------------------------------------------------------------------------
const EXPECTED_IDS = [
  'rs-engine.DEFAULT_THRESHOLD',
  'rs-differential-scorer.DIFF_FLOOR',
  'rs-differential-scorer.LSA_FLOOR',
  'rs-differential-scorer.BERT_FLOOR',
  'rs-differential-scorer.SEMANTIC_FLOOR',
  'rs-differential-scorer.EUREKA_DIFF_FLOOR',
  'rs-differential-scorer.bandFor',
  'rs-differential-scorer.highLeg',
  'rs-innovation-classifier.LSA_HIGH',
  'rs-innovation-classifier.BERT_HIGH',
  'rs-breakthrough-scorer.rubrics',
  'hsi-engine.threshold',
  'hsi-engine.weights',
  'hsi-to-graph.threshold',
  'compute-whitespace-gaps.percentile',
  'whitespace-command.novelty-bands',
  'interpret-whitespace.thresholds',
  'eureka-critic.stage-a-gates',
  'eureka-critic.confidence-bands',
  'tail-quadrant.constants',
  'analogy-fitness.thresholds',
  'analogy-fitness.bands',
];

const LEDGER_PATH = path.join(REPO, 'data', 'floor-ledger.json');

function loadRawLedger() {
  return JSON.parse(fs.readFileSync(LEDGER_PATH, 'utf8'));
}

// ---------------------------------------------------------------------------
// Leg 1: the ledger loads, every row is disclosed, every EXPECTED_ID is on it.
// ---------------------------------------------------------------------------
function legLedgerShape() {
  console.log('--- leg 1: ledger shape + EXPECTED_IDS ---');
  let raw;
  try {
    raw = loadRawLedger();
  } catch (e) {
    check('data/floor-ledger.json parses', false, e.message);
    return;
  }
  check('data/floor-ledger.json parses', true);
  check('ledger.rows is a non-empty array', Array.isArray(raw.rows) && raw.rows.length > 0);
  check('ledger.floor_basis states disclosed-not-calibrated', typeof raw.floor_basis === 'string' && /disclosed/.test(raw.floor_basis));

  const ids = new Set(raw.rows.map((r) => r.id));
  for (const id of EXPECTED_IDS) {
    check('ledger carries row ' + id, ids.has(id));
  }

  const nonDisclosed = raw.rows.filter((r) => r.status !== 'disclosed');
  check('every row this phase is disclosed (D-19)', nonDisclosed.length === 0, nonDisclosed.map((r) => r.id).join(','));

  const bareLineNumberAnchors = raw.rows.filter((r) => /^\d+$/.test(String(r.line_anchor)));
  check('no row anchors on a bare line number', bareLineNumberAnchors.length === 0, bareLineNumberAnchors.map((r) => r.id).join(','));
}

// ---------------------------------------------------------------------------
// Leg 2: validateLedger -- shape validation + stale-anchor detection.
// ---------------------------------------------------------------------------
function legValidateLedger() {
  console.log('--- leg 2: validateLedger ---');
  const raw = loadRawLedger();
  const result = ledger.validateLedger(raw, REPO);
  check('validateLedger reports valid on the shipped ledger', result.valid === true, JSON.stringify(result.problems));

  // A row claiming 'calibrated' status with missing provenance.gold/n must
  // fail -- proves the gate itself works without needing a real calibrated
  // row in the shipped ledger (D-19: nothing here IS calibrated).
  const fakeCalibrated = {
    built_at: raw.built_at,
    phase: raw.phase,
    floor_basis: raw.floor_basis,
    rows: [
      {
        id: 'fake.calibrated-no-provenance',
        file: 'lib/core/rs-engine.cjs',
        line_anchor: 'DEFAULT_THRESHOLD',
        value: 0.3,
        gates: 'a fake row for the calibration gate test',
        kind: 'floor',
        env_override: null,
        env_read: null,
        status: 'calibrated',
        provenance: null,
        dependent_outputs: [],
      },
    ],
  };
  const badResult = ledger.validateLedger(fakeCalibrated, REPO);
  check('validateLedger rejects calibrated status with null provenance', badResult.valid === false);

  const fakeCalibratedPartial = {
    built_at: raw.built_at,
    phase: raw.phase,
    floor_basis: raw.floor_basis,
    rows: [
      {
        id: 'fake.calibrated-missing-n',
        file: 'lib/core/rs-engine.cjs',
        line_anchor: 'DEFAULT_THRESHOLD',
        value: 0.3,
        gates: 'a fake row for the calibration gate test',
        kind: 'floor',
        env_override: null,
        env_read: null,
        status: 'calibrated',
        provenance: { fixture: 'x', encoder: 'y', date: '2026-09-23', method: 'z', gold: 0.9 },
        dependent_outputs: [],
      },
    ],
  };
  const badResult2 = ledger.validateLedger(fakeCalibratedPartial, REPO);
  check('validateLedger rejects calibrated status missing provenance.n', badResult2.valid === false);
}

// ---------------------------------------------------------------------------
// Leg 3: resolveHits -- the pattern pass over the engine families, scanned
// file count printed and asserted > 0, every hit resolved by file + anchor.
// ---------------------------------------------------------------------------
function legResolveHits() {
  console.log('--- leg 3: resolveHits (the sweep) ---');
  const raw = loadRawLedger();
  const result = ledger.resolveHits(raw, REPO, []);
  console.log('scanned ' + result.scannedFiles + ' files');
  check('scanned more than zero files', result.scannedFiles > 0, String(result.scannedFiles));
  check('zero unresolved hits', result.unresolved.length === 0, JSON.stringify(result.unresolved.slice(0, 5)));
}

// ---------------------------------------------------------------------------
// Leg 4: negative control -- FAKE_FLOOR planted under lib/core/, resolveHits
// must catch it as unresolved, scratch file removed in finally.
// ---------------------------------------------------------------------------
function legNegativeControl() {
  console.log('--- leg 4: negative control (FAKE_FLOOR) ---');
  const raw = loadRawLedger();
  const scratchRel = 'lib/core/rs-__scratch-floor-355.cjs';
  const scratchAbs = path.join(REPO, scratchRel);
  fs.writeFileSync(scratchAbs, "'use strict';\nconst FAKE_FLOOR = 0.42;\nmodule.exports = { FAKE_FLOOR };\n");
  let caught = false;
  try {
    const result = ledger.resolveHits(raw, REPO, [scratchRel]);
    caught = result.unresolved.some((h) => h.file === scratchRel);
  } finally {
    try { fs.unlinkSync(scratchAbs); } catch (_e) { /* tolerant */ }
  }
  check('negative control: planted FAKE_FLOOR = 0.42 is caught as unresolved', caught);
  check('negative control: scratch file removed afterwards', !fs.existsSync(scratchAbs));
}

// ---------------------------------------------------------------------------
// Leg 5 (Task 2): dependent-outputs -- every disclosed row's dependent
// producers get an honest 'unverified' disclosure through
// lib/core/floor-disclosure.cjs.
// ---------------------------------------------------------------------------
function legDependentOutputs() {
  console.log('--- leg 5: dependent outputs (lib/core/floor-disclosure.cjs) ---');
  const disclosureModulePath = path.join(REPO, 'lib', 'core', 'floor-disclosure.cjs');
  if (!fs.existsSync(disclosureModulePath)) {
    check('lib/core/floor-disclosure.cjs exists', false);
    return;
  }
  const disclosure = require(disclosureModulePath);
  const raw = loadRawLedger();

  check('PRODUCER_IDS deep-equals the five producers', JSON.stringify(disclosure.PRODUCER_IDS) === JSON.stringify(['eureka', 'find-connections', 'find-bottlenecks', 'hsi', 'whitespace']));
  check('PRODUCER_IDS is frozen', Object.isFrozen(disclosure.PRODUCER_IDS));

  for (const p of disclosure.PRODUCER_IDS) {
    const d = disclosure.disclosureFor(p);
    check('disclosureFor(' + p + ') returns observation:null', d.observation === null);
    check('disclosureFor(' + p + ') returns suggests:null', d.suggests === null);
    check('disclosureFor(' + p + ') returns an unverified array', Array.isArray(d.unverified));
    check('disclosureFor(' + p + ') returns an evidence_used array', Array.isArray(d.evidence_used));

    const expectedRowIds = raw.rows.filter((r) => r.status === 'disclosed' && Array.isArray(r.dependent_outputs) && r.dependent_outputs.includes(p)).map((r) => r.id);
    for (const rid of expectedRowIds) {
      check('disclosureFor(' + p + ').evidence_used includes ' + rid, d.evidence_used.includes(rid));
    }
    check('disclosureFor(' + p + ').unverified has one sentence per dependent row', d.unverified.length === expectedRowIds.length);

    const line = disclosure.disclosureLine(p);
    check('disclosureLine(' + p + ") contains 'unverified'", /unverified/.test(line));
    check('disclosureLine(' + p + ') names data/floor-ledger.json', /data\/floor-ledger\.json/.test(line));
    const decimalRegex = /(^|[^0-9A-Za-z.])(0?\.[0-9]+|1\.0+)([^0-9.]|$)/;
    check('disclosureLine(' + p + ') carries no bare decimal', !decimalRegex.test(line));
    check('disclosureLine(' + p + ') carries no percent literal', !/[0-9]+%/.test(line));
  }

  let threw = false;
  try {
    disclosure.disclosureFor('not-a-producer');
  } catch (_e) {
    threw = true;
  }
  check('disclosureFor throws on an unknown producer id', threw);

  const src = fs.readFileSync(disclosureModulePath, 'utf8');
  const requireCount = (src.match(/require\(/g) || []).length;
  check('lib/core/floor-disclosure.cjs requires only node:fs and node:path', requireCount === 2 && /require\('node:fs'\)/.test(src) && /require\('node:path'\)/.test(src));
}

legLedgerShape();
legValidateLedger();
legResolveHits();
legNegativeControl();
legDependentOutputs();

check('no network attempted (hygiene-355 net guard)', netGuard.attempts() === 0, String(netGuard.attempts()));
netGuard.restore();

process.exit(checker.summary());
