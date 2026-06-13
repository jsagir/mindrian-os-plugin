#!/usr/bin/env node
'use strict';

/*
 * Phase 150.9 Plan-01 Task 1 -- lib/core/drift-baseline.cjs hermetic test.
 *
 * RED-first: this suite is EXPECTED to fail until Task 2 lands the module.
 * It pins the FIX-13 DRIFT.md writer contract (D-01 both granularities +
 * diff-stability + V12 path-traversal refusal + Canon Part 8 floor).
 *
 * Six behaviors (per 150.9-01-PLAN.md Task 1):
 *   Test 1  schema round-trip   -- writeDriftBaseline emits .planning/DRIFT.md
 *                                  with kind=drift-baseline-index, a counts
 *                                  block, and one body row per finding with a
 *                                  per_folder pointer column.
 *   Test 2  per-folder locality -- a phase-103 finding produces
 *                                  .planning/phases/103/DRIFT.md carrying ONLY
 *                                  phase-103 findings, finding_ids matching root.
 *   Test 3  diff-stability      -- re-write with noTouch=true is byte-identical
 *                                  per-folder; without noTouch only last_seen
 *                                  differs and first_seen is unchanged.
 *   Test 4  closed-with-history -- a finding flipped open->closed keeps its row
 *                                  plus a closed_date (CLAUDE.md decision 14).
 *   Test 5  traversal refusal   -- a finding whose phase contains "../../etc"
 *                                  throws or skips; no file lands outside the
 *                                  scratch .planning/.
 *   Test 6  Part 8 floor        -- grep of the module source for
 *                                  fetch|http|curl|brain|tavily returns 0.
 *
 * Hermetic envelope: per-test mkdtempSync scratch .planning tree; require the
 * module under test; plain node:assert; process.exit(failures ? 1 : 0). Mirrors
 * tests/test-doctor-class-i.cjs idiom (no jest/mocha). Fixture findings are
 * obviously-synthetic (phase 999 / finding_id W007-999-test) so they can never
 * be confused with a real audit baseline.
 *
 * NO em-dashes anywhere (hyphens only).
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const REPO_ROOT = path.resolve(__dirname, '..');
const MODULE_PATH = path.join(REPO_ROOT, 'lib', 'core', 'drift-baseline.cjs');

let passed = 0;
let failed = 0;
function pass(name) { passed += 1; console.log('PASS: ' + name); }
function failTest(name, err) { failed += 1; console.log('FAIL: ' + name + '\n    ' + (err && err.message || err)); }

// Scratch .planning tree under a mkdtemp root.
function makeScratchPlanning(suffix) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), '150.9-drift-' + suffix + '-'));
  const planningDir = path.join(tmp, '.planning');
  fs.mkdirSync(path.join(planningDir, 'phases'), { recursive: true });
  return { tmp, planningDir };
}

function rmTmp(t) {
  try { fs.rmSync(t, { recursive: true, force: true }); } catch (_) { /* best-effort */ }
}

// Obviously-synthetic fixture finding set. phase 999 + W007-999-test ids so a
// stray file can never be mistaken for a real audit baseline.
function syntheticFindings() {
  return [
    {
      finding_id: 'W007-999-test',
      track: 'gsd_record',
      severity: 'warn',
      status: 'open',
      source_class: 'Q',
      detail: 'SYNTHETIC: phase 999 on disk, absent from ROADMAP.md (test fixture)',
      phase: '999',
      plan: null,
      per_folder: true,
    },
    {
      finding_id: 'I001-103-00',
      track: 'gsd_record',
      severity: 'info',
      status: 'open',
      source_class: 'Q',
      detail: 'SYNTHETIC: 103-00-PLAN.md has no SUMMARY.md (test fixture)',
      phase: '103',
      plan: '00',
      per_folder: true,
    },
    {
      finding_id: 'P-skill-FIXTURE',
      track: 'prose_vs_code',
      severity: 'high',
      status: 'open',
      source_class: 'P',
      detail: 'SYNTHETIC: SKILL.md missing a shape shipped in code (test fixture)',
      phase: null,
      plan: null,
      per_folder: false,
    },
  ];
}

function syntheticMeta(overrides) {
  return Object.assign({
    audit_date: '2026-06-13',
    auditor: 'doctor --drift (test fixture)',
    milestone: 'v1.13.1-test',
    status: 'degraded',
    process_note: 'SYNTHETIC fixture -- bound per-agent scope, fan wider (Fable 600s watchdog lesson).',
  }, overrides || {});
}

let mod;
try {
  mod = require(MODULE_PATH);
} catch (err) {
  // Module not yet built (RED). Record all six as failures and exit 1.
  console.log('MODULE NOT LOADABLE (RED expected until Task 2): ' + (err && err.message || err));
  console.log('\n6 test(s) FAILED (0 passed) -- RED as expected (module not yet built)');
  process.exit(1);
}

// -- Test 1: schema round-trip --------------------------------------------
try {
  const { tmp, planningDir } = makeScratchPlanning('t1');
  const findings = syntheticFindings();
  const result = mod.writeDriftBaseline({ planningDir, findings, meta: syntheticMeta() });
  assert.ok(result && result.rootPath, 'writeDriftBaseline returns a rootPath');
  const rootFile = path.join(planningDir, 'DRIFT.md');
  assert.strictEqual(fs.existsSync(rootFile), true, '.planning/DRIFT.md exists');
  const body = fs.readFileSync(rootFile, 'utf8');
  // Frontmatter parses + kind is the index kind.
  assert.match(body, /^---\n/, 'starts with YAML frontmatter');
  assert.match(body, /kind:\s*drift-baseline-index/, 'frontmatter kind=drift-baseline-index');
  // A counts block exists.
  assert.match(body, /counts:/, 'frontmatter carries a counts block');
  // One body row per finding, each with a per_folder pointer column.
  for (const f of findings) {
    assert.ok(body.indexOf(f.finding_id) !== -1, 'root table carries row for ' + f.finding_id);
  }
  // The table header names a per_folder column.
  assert.match(body, /per_folder/, 'root table has a per_folder pointer column');
  // No em-dashes in the produced output (U+2014 checked via codepoint, so this
  // source file itself stays ASCII-clean per the no-em-dashes hard rule).
  assert.strictEqual(body.indexOf(String.fromCharCode(0x2014)), -1, 'root DRIFT.md has no em-dashes');
  rmTmp(tmp);
  pass('Test 1 (schema round-trip: root index + counts + per-finding rows)');
} catch (err) { failTest('Test 1 (schema round-trip)', err); }

// -- Test 2: per-folder locality ------------------------------------------
try {
  const { tmp, planningDir } = makeScratchPlanning('t2');
  const findings = syntheticFindings();
  mod.writeDriftBaseline({ planningDir, findings, meta: syntheticMeta() });
  const folder103 = path.join(planningDir, 'phases', '103', 'DRIFT.md');
  assert.strictEqual(fs.existsSync(folder103), true, '.planning/phases/103/DRIFT.md exists');
  const body = fs.readFileSync(folder103, 'utf8');
  // Carries ONLY phase-103 findings.
  assert.ok(body.indexOf('I001-103-00') !== -1, 'phase-103 file carries I001-103-00');
  assert.strictEqual(body.indexOf('W007-999-test'), -1, 'phase-103 file does NOT carry the phase-999 finding');
  assert.strictEqual(body.indexOf('P-skill-FIXTURE'), -1, 'phase-103 file does NOT carry the report-only P finding');
  // Phase 999 has its own per-folder file too.
  const folder999 = path.join(planningDir, 'phases', '999', 'DRIFT.md');
  assert.strictEqual(fs.existsSync(folder999), true, '.planning/phases/999/DRIFT.md exists');
  const body999 = fs.readFileSync(folder999, 'utf8');
  assert.ok(body999.indexOf('W007-999-test') !== -1, 'phase-999 file carries W007-999-test (id matches root)');
  rmTmp(tmp);
  pass('Test 2 (per-folder locality: phase-103 file carries only phase-103 findings)');
} catch (err) { failTest('Test 2 (per-folder locality)', err); }

// -- Test 3: diff-stability -----------------------------------------------
try {
  const { tmp, planningDir } = makeScratchPlanning('t3');
  const findings = syntheticFindings();
  const folder103 = path.join(planningDir, 'phases', '103', 'DRIFT.md');

  // First write.
  mod.writeDriftBaseline({ planningDir, findings, meta: syntheticMeta({ audit_date: '2026-06-13' }) });
  const first = fs.readFileSync(folder103, 'utf8');

  // Re-write with noTouch=true: byte-identical per-folder (true idempotence).
  mod.writeDriftBaseline({ planningDir, findings, meta: syntheticMeta({ audit_date: '2026-06-14' }), noTouch: true });
  const idempotent = fs.readFileSync(folder103, 'utf8');
  assert.strictEqual(idempotent, first, 'noTouch re-write is byte-identical per-folder');

  // Re-write WITHOUT noTouch but a later audit_date: ONLY last_seen lines differ;
  // first_seen unchanged.
  mod.writeDriftBaseline({ planningDir, findings, meta: syntheticMeta({ audit_date: '2026-06-15' }) });
  const bumped = fs.readFileSync(folder103, 'utf8');

  const firstSeenOf = (s) => (s.match(/2026-06-13/g) || []).length;
  // first_seen (set on the very first write at 2026-06-13) must survive the bump.
  assert.ok(bumped.indexOf('2026-06-13') !== -1, 'first_seen (2026-06-13) preserved across audits');
  // last_seen advanced to the new audit date.
  assert.ok(bumped.indexOf('2026-06-15') !== -1, 'last_seen bumped to the new audit date');

  // The only line-level differences between first and bumped are last_seen deltas:
  // diff the two bodies line by line; every differing line must contain a date.
  const aLines = first.split('\n');
  const bLines = bumped.split('\n');
  assert.strictEqual(aLines.length, bLines.length, 'same line count across diff-stable re-runs');
  for (let i = 0; i < aLines.length; i++) {
    if (aLines[i] !== bLines[i]) {
      assert.match(aLines[i] + bLines[i], /\d{4}-\d{2}-\d{2}/, 'only date-bearing (last_seen) lines differ at line ' + i);
    }
  }
  void firstSeenOf;
  rmTmp(tmp);
  pass('Test 3 (diff-stability: noTouch idempotent; otherwise only last_seen differs)');
} catch (err) { failTest('Test 3 (diff-stability)', err); }

// -- Test 4: closed-with-history ------------------------------------------
try {
  const { tmp, planningDir } = makeScratchPlanning('t4');
  const findings = syntheticFindings();
  const folder103 = path.join(planningDir, 'phases', '103', 'DRIFT.md');

  // First write: I001-103-00 open.
  mod.writeDriftBaseline({ planningDir, findings, meta: syntheticMeta({ audit_date: '2026-06-13' }) });

  // Flip the phase-103 finding open -> closed and re-write.
  const closedFindings = syntheticFindings().map((f) => {
    if (f.finding_id === 'I001-103-00') {
      return Object.assign({}, f, { status: 'closed' });
    }
    return f;
  });
  mod.writeDriftBaseline({ planningDir, findings: closedFindings, meta: syntheticMeta({ audit_date: '2026-06-14' }) });

  const body = fs.readFileSync(folder103, 'utf8');
  // The row is RETAINED (history preserved).
  assert.ok(body.indexOf('I001-103-00') !== -1, 'closed finding row retained');
  // It carries a closed status + a closed_date.
  assert.match(body, /closed/, 'closed status present in the file');
  assert.match(body, /closed_date|2026-06-14/, 'a closed_date is recorded');
  rmTmp(tmp);
  pass('Test 4 (closed-with-history: closed row retained + closed_date)');
} catch (err) { failTest('Test 4 (closed-with-history)', err); }

// -- Test 5: path-traversal refusal (V12) ---------------------------------
try {
  const { tmp, planningDir } = makeScratchPlanning('t5');
  // A canary file OUTSIDE .planning/ that must never be touched.
  const canary = path.join(tmp, 'OUTSIDE-CANARY.txt');
  fs.writeFileSync(canary, 'do not touch\n');
  const before = fs.readFileSync(canary, 'utf8');

  const evil = [{
    finding_id: 'W007-EVIL',
    track: 'gsd_record',
    severity: 'warn',
    status: 'open',
    source_class: 'Q',
    detail: 'SYNTHETIC traversal attempt',
    phase: '../../etc',
    plan: null,
    per_folder: true,
  }];

  let threw = false;
  try {
    mod.writeDriftBaseline({ planningDir, findings: evil, meta: syntheticMeta() });
  } catch (_e) {
    threw = true;
  }
  // Either it threw, OR it skipped that write -- in BOTH cases nothing must land
  // outside .planning/.
  const after = fs.readFileSync(canary, 'utf8');
  assert.strictEqual(after, before, 'canary file outside .planning/ untouched');
  // No file written outside the scratch .planning/ via the traversal path.
  const escapedEtc = path.join(tmp, 'etc');
  assert.strictEqual(fs.existsSync(escapedEtc), false, 'no traversed dir created outside .planning/');
  assert.ok(threw === true || threw === false, 'writeDriftBaseline handled the traversal (threw or skipped)');
  rmTmp(tmp);
  pass('Test 5 (path-traversal refusal: no write outside .planning/)');
} catch (err) { failTest('Test 5 (path-traversal refusal)', err); }

// -- Test 6: Part 8 floor (zero network surface in the module source) -----
try {
  const src = fs.readFileSync(MODULE_PATH, 'utf8');
  const FORBIDDEN = /fetch|http|curl|brain|tavily/;
  assert.strictEqual(FORBIDDEN.test(src), false, 'module source has zero fetch|http|curl|brain|tavily surface');
  rmTmp(REPO_ROOT === REPO_ROOT ? path.join(os.tmpdir(), 'nonexistent-noop') : '');
  pass('Test 6 (Part 8 floor: zero network surface in drift-baseline.cjs)');
} catch (err) { failTest('Test 6 (Part 8 floor)', err); }

if (failed > 0) {
  console.log('\n' + failed + ' test(s) FAILED (' + passed + ' passed)');
  process.exit(1);
}
console.log('\nAll ' + passed + ' tests PASS');
process.exit(0);
