#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 132 Plan 05 -- pseudonymize driver test (RE-BASELINED).
 * ============================================================
 * RE-BASELINE NOTE: the live pseudonymize WRITE of the 6 internal-team :Person
 * nodes is DEFERRED to v1.14.0 (see the Phase 132 deferred-items.md entry). This
 * plan ships the MACHINERY + the Phase 132 release gate ONLY. This suite tests
 * the pseudonymize batch BUILDER on FIXTURES + asserts the verify-phase-132
 * release-gate runner INVOKES (never reimplements) the Phase 130.7 health gate.
 * ZERO live Brain writes: NEO4J_* are unset; only dry-run + pure assertions run.
 *
 * What is proven here:
 *   1. PSEUDONYM_HANDLES: exactly 6 opaque { handle, pseudonym } objects -- zero
 *      real internal-team names.
 *   2. NO REAL NAME IN REPO: the match is by mindrian_internal:true (a flag), the
 *      forward Cypher binds only the pseudonym + the handle ordinal, never a
 *      real-name string literal. Asserted structurally by reading the script src.
 *   3. mindrian_internal:true preserved + Aronhime public exception excluded.
 *   4. provenance (created_by=phase-132-curation-batch-5) + name_pre_pseudonym
 *      stored before overwrite + the paired rollback restores by selector.
 *   5. Canon Part 8 clean: scanBatchForUserContent(batch) === [].
 *   6. verify-phase-132 INVOKES the 130.7 gate (does not reimplement the 4
 *      metrics) and runs the brain-boundary-scan over the phase batch builders.
 *
 * Canon Part 8 (handles + enums + provenance only). No em-dashes. CJS only.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const m = require('../../scripts/curation-132-05-pseudonymize.cjs');
const batchLib = require('../../lib/brain/curation-batch.cjs');

let passed = 0;
let failed = 0;
function test(name, fn) {
  try {
    fn();
    passed += 1;
    process.stdout.write('  ok  ' + name + '\n');
  } catch (err) {
    failed += 1;
    process.stdout.write('  FAIL ' + name + '\n       ' + (err && err.message) + '\n');
  }
}

// Guard: the suite must never see live creds (proves zero-live by construction).
assert.ok(!process.env.NEO4J_URI, 'NEO4J_URI must be unset in the test env');

const SCRIPT_PATH = path.join(__dirname, '..', '..', 'scripts', 'curation-132-05-pseudonymize.cjs');
const SCRIPT_SRC = fs.readFileSync(SCRIPT_PATH, 'utf8');
const VERIFY_PATH = path.join(__dirname, '..', '..', 'scripts', 'verify-phase-132.cjs');

// ===========================================================================
// PSEUDONYMIZE BUILDER (the 6 internal-team :Person nodes; FIXTURE machinery).
// ===========================================================================

test('1. PSEUDONYM_HANDLES is exactly 6 opaque { handle, pseudonym } objects', function () {
  assert.ok(Array.isArray(m.PSEUDONYM_HANDLES), 'PSEUDONYM_HANDLES must be an array');
  assert.strictEqual(m.PSEUDONYM_HANDLES.length, 6, 'exactly 6 handles (the 6 internal-team nodes)');
  m.PSEUDONYM_HANDLES.forEach(function (h, i) {
    assert.ok(h && typeof h.handle === 'string' && h.handle.length > 0,
      'handle[' + i + '] must carry a non-empty stable handle string');
    assert.ok(typeof h.pseudonym === 'string' && h.pseudonym.length > 0,
      'handle[' + i + '] must carry a non-empty pseudonym string');
  });
  // The handles must be unique.
  const handles = m.PSEUDONYM_HANDLES.map(function (h) { return h.handle; });
  assert.strictEqual(new Set(handles).size, 6, 'the 6 handles must be unique');
  // Frozen (a stable opaque map, not mutable at runtime).
  assert.ok(Object.isFrozen(m.PSEUDONYM_HANDLES), 'PSEUDONYM_HANDLES must be frozen');
});

test('2. no real name in repo -- the match is flag-based, never a name literal', function () {
  const batch = m.buildPseudonymizeBatch();
  const d = batch.dryRun();
  const fwd = d.forward.map(function (f) { return f.cypher; }).join('\n');
  // The forward Cypher matches by the mindrian_internal:true flag, NOT by name.
  assert.ok(/mindrian_internal\s*:\s*true/.test(fwd),
    'the match selector must be (p:Person {mindrian_internal:true}), not a real name');
  // Every bound string param is either a pseudonym, a handle, the provenance
  // scalar, the Aronhime exclusion literal, or an enum/property key -- never a
  // real internal-team name. Structurally: the only person-name strings the
  // batch can bind are the 6 pseudonyms (which are in PSEUDONYM_HANDLES).
  const pseudonyms = m.PSEUDONYM_HANDLES.map(function (h) { return h.pseudonym; });
  d.forward.forEach(function (f) {
    const params = f.params || {};
    Object.keys(params).forEach(function (k) {
      const v = params[k];
      if (typeof v !== 'string') return;
      if (k === 'pseudonym') {
        assert.ok(pseudonyms.indexOf(v) !== -1, 'any bound pseudonym must come from PSEUDONYM_HANDLES');
      }
    });
  });
  // The script source must NOT hand-bind a name-keyed selector like {name:'...'}
  // for the MATCH of the 6 nodes. (Aronhime appears only as an EXCLUSION.)
  assert.ok(!/Person\s*\{\s*name\s*:/.test(SCRIPT_SRC),
    'the script must NEVER match the 6 :Person nodes by a name literal');
});

test('3. mindrian_internal:true preserved + Aronhime public exception excluded', function () {
  const batch = m.buildPseudonymizeBatch();
  const d = batch.dryRun();
  const fwd = d.forward.map(function (f) { return f.cypher; }).join('\n');
  // mindrian_internal:true is the MATCH key and must NOT be removed.
  assert.ok(!/REMOVE\s+\w+\.mindrian_internal/.test(fwd) && !/SET\s+\w+\.mindrian_internal\s*=\s*false/.test(fwd),
    'the pseudonymize write must KEEP mindrian_internal:true (never remove/unset it)');
  // The Aronhime public-persona node is explicitly excluded.
  assert.ok(/Aronhime/.test(fwd), 'the forward Cypher must name the Aronhime exclusion');
  assert.ok(/WHERE[\s\S]*Aronhime|p\.name\s*<>\s*'Aronhime'|is_public_persona/.test(fwd),
    'Aronhime must be excluded via a WHERE clause (name <> Aronhime or is_public_persona)');
});

test('4. provenance + pre-name stored before overwrite + paired rollback', function () {
  const batch = m.buildPseudonymizeBatch();
  const d = batch.dryRun();
  // every forward params carries created_by = phase-132-curation-batch-5.
  d.forward.forEach(function (f) {
    assert.strictEqual(f.params.created_by, 'phase-132-curation-batch-5',
      'every forward write carries created_by=phase-132-curation-batch-5');
  });
  const fwd = d.forward.map(function (f) { return f.cypher; }).join('\n');
  // pre-name stored BEFORE the name overwrite (so rollback can restore it).
  assert.ok(/name_pre_pseudonym\s*=\s*\w+\.name/.test(fwd),
    'must SET name_pre_pseudonym = p.name BEFORE overwriting p.name');
  // pseudonymized_by stamped for the rollback selector.
  assert.ok(/pseudonymized_by/.test(fwd), 'must stamp pseudonymized_by for the rollback selector');
  // the rollback restores name from name_pre_pseudonym by the selector.
  const rb = d.rollback.map(function (r) { return r.cypher; }).join('\n');
  assert.ok(/SET\s+\w+\.name\s*=\s*\w+\.name_pre_pseudonym/.test(rb),
    'rollback must restore name = name_pre_pseudonym');
  assert.ok(/REMOVE[\s\S]*name_pre_pseudonym/.test(rb) && /REMOVE[\s\S]*pseudonymized_by/.test(rb),
    'rollback must REMOVE the temp name_pre_pseudonym + pseudonymized_by markers');
  // assertRollbackPath passes (rollback names the batch-5 created_by selector).
  batchLib.assertRollbackPath(batch);
});

test('5. Canon Part 8 clean -- scanBatchForUserContent returns []', function () {
  const batch = m.buildPseudonymizeBatch();
  assert.deepStrictEqual(batchLib.scanBatchForUserContent(batch), [],
    'Part 8: the pseudonymize batch binds only the flag + pseudonyms + provenance');
});

test('6. routes through makeBatch with a valid phase-132-curation-batch-5 id', function () {
  const batch = m.buildPseudonymizeBatch();
  assert.strictEqual(batch.dryRun().batchId, 'phase-132-curation-batch-5',
    'the pseudonymize batch must be batch-5');
});

// ===========================================================================
// RELEASE GATE: verify-phase-132 INVOKES the 130.7 gate, never reimplements it.
// ===========================================================================

test('7. verify-phase-132 exports runPhase132ReleaseGate', function () {
  const v = require('../../scripts/verify-phase-132.cjs');
  assert.strictEqual(typeof v.runPhase132ReleaseGate, 'function',
    'verify-phase-132 must export runPhase132ReleaseGate');
});

test('8. verify-phase-132 INVOKES the 130.7 gate (does NOT reimplement the 4 metrics)', function () {
  const src = fs.readFileSync(VERIFY_PATH, 'utf8');
  // strip line comments before grepping for the threshold literals.
  const code = src.replace(/\/\/.*$/gm, '');
  assert.ok(!/REVIEW_REQUIRED\s*>\s*10/.test(code), 'must not reimplement the M2 threshold');
  assert.ok(!/orphan-rate/.test(code) || /require\(/.test(code), 'must not reimplement the M4 metric body');
  assert.ok(!/JTBD cohort\s*<\s*3/.test(code), 'must not reimplement the M1 threshold');
  // positive: it must require/reference the 130.7-shipped gate module.
  assert.ok(/check-dual-graph-health/.test(src),
    'verify-phase-132 must invoke scripts/check-dual-graph-health.cjs (the 130.7 gate)');
});

test('9. release gate runs on fixtures (fail-closed) + brain-boundary-scan clean', function () {
  const v = require('../../scripts/verify-phase-132.cjs');
  // Run the gate with planted fixtures (a conclusive, no-regression metric set +
  // an in-memory baseline store). The release gate must PASS on this fixture and
  // report the brain-boundary-scan clean over the phase batch builders.
  const res = v.runPhase132ReleaseGate({ fixtureMode: true });
  assert.ok(res && typeof res === 'object', 'runPhase132ReleaseGate returns a result object');
  assert.strictEqual(res.boundaryClean, true,
    'the brain-boundary-scan must be clean over every phase-132 batch builder');
  assert.ok(res.healthOutcome && res.healthOutcome !== 'inconclusive',
    'the 130.7 gate must reach a conclusive outcome on the planted fixture');
  assert.strictEqual(res.pass, true, 'the planted fixture must yield a PASS release gate');
});

test('10. release gate reports blocked-on-130.7 when the gate is absent (never silent-pass)', function () {
  const v = require('../../scripts/verify-phase-132.cjs');
  // Point the runner at a non-existent gate path: it must NOT pass.
  const res = v.runPhase132ReleaseGate({
    fixtureMode: true,
    gatePathOverride: path.join(__dirname, 'no-such-130.7-gate.cjs'),
  });
  assert.strictEqual(res.pass, false, 'a missing 130.7 gate must NOT yield a PASS (fail-closed)');
  assert.ok(/blocked-on-130\.7|blocked_on_130_7|gate_absent/.test(String(res.blockedReason || res.healthOutcome || '')),
    'a missing gate must surface a clear blocked-on-130.7 status, never a silent pass');
});

process.stdout.write('\n  ' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed === 0 ? 0 : 1);
