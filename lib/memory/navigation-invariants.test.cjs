/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 91-09 -- navigation-invariants validator test suite.
 *
 * Tests the registry-compatible drop-in validator that converts silent
 * Phase 91 navigation failure modes into first-class health signals.
 * Validator surfaces:
 *   INV-1 trace_missing_field (any of 8 Section 8 brain_md_* fields absent)
 *   INV-2 recommended_in_wrong_mode (RECOMMENDED rendered in mode_b/tier_0)
 *   INV-3 weight_clamp_breach (brain_md_weight_applied outside [0.0, 1.0])
 *   INV-4 trace_file_malformed (unparseable JSON in decision-traces dir)
 *   INV-5 unknown_verb_passed (fire_skill not in CANONICAL_VERBS)
 *
 * Plus registry compatibility (id/severity_map/scope/validate shape),
 * room-scope dispatch verification through the actual guardian, and
 * fail-open inheritance (a malformed sibling validator does NOT prevent
 * navigation-invariants from running).
 *
 * Three-surface compatibility: pure CJS + node built-ins + spawnSync into
 * the production guardian. No surface-specific branches.
 */

'use strict';

const assert = require('node:assert');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const VALIDATOR_PATH = path.join(REPO_ROOT, 'lib', 'memory', 'validators',
  'navigation-invariants.cjs');
const GUARDIAN_PATH = path.join(REPO_ROOT, 'scripts', 'feynman-minto-guardian.cjs');
const SHARED_PATH = path.join(REPO_ROOT, 'lib', 'core', 'navigation-engine-shared.cjs');

// Lazy-loaded validator (deleted from cache before each suite run so a
// fresh require() always reflects the latest implementation).
function loadValidator() {
  delete require.cache[require.resolve(VALIDATOR_PATH)];
  return require(VALIDATOR_PATH);
}

// 8 Section 8 fields per navigation-engine-brain-interface v1.
const REQUIRED_FIELDS = [
  'brain_md_version',
  'brain_md_staleness',
  'brain_md_stale_reason',
  'brain_md_weight_applied',
  'brain_md_recommended_confidence',
  'brain_md_recommended_marker_rendered',
  'brain_md_tier_mode',
  'brain_md_sections_consumed',
];

// ----------- fixture helpers -----------

function freshRoom(label) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nav-inv-' + label + '-'));
  // Minimum: a section with ROOM.md so guardian's walkSections sees it.
  const sec = path.join(dir, 'sec1');
  fs.mkdirSync(sec, { recursive: true });
  fs.writeFileSync(path.join(sec, 'ROOM.md'), '# sec1\n');
  fs.writeFileSync(path.join(sec, 'MINTO.md'),
    '---\ngoverning_thought: "stub"\n---\n\n# stub\n');
  return dir;
}

function makeTrace(overrides) {
  // Returns a synthetic trace ENTRY (a single element of traces[]). The
  // entry shape mirrors what scripts/intent-classifier.cjs persists per
  // turn -- decision_trace fields merged with turn/at metadata.
  const base = {
    turn: 1,
    at: new Date().toISOString(),
    brain_md_version: 1,
    brain_md_staleness: 'fresh',
    brain_md_stale_reason: null,
    brain_md_weight_applied: 1.0,
    brain_md_recommended_confidence: 0.85,
    brain_md_recommended_marker_rendered: false,
    brain_md_tier_mode: 'mode_a',
    brain_md_sections_consumed: ['pattern_matches'],
    icm_scope: { sectionPath: 'sec1' },
    sql_signals: null,
    minto_reasoning: null,
    intent_persona: null,
    chosen_rationale: 'stub',
  };
  return Object.assign(base, overrides || {});
}

function writeTraceFile(roomDir, sessionId, traces) {
  const dir = path.join(roomDir, '.mindrian', 'decision-traces');
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, sessionId + '.json');
  const data = { version: 1, session_id: sessionId, traces: traces };
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  return filePath;
}

function ctxFor(roomDir, mode) {
  return { roomDir: roomDir, kind: mode || 'session-start', now: Date.now() };
}

function rmrf(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {}
}

// ----------- runner -----------

let pass = 0;
let fail = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    pass += 1;
    process.stdout.write('PASS ' + name + '\n');
  } catch (e) {
    fail += 1;
    failures.push({ name: name, error: e });
    process.stderr.write('FAIL ' + name + '\n  ' + (e && e.stack || e) + '\n');
  }
}

// =====================================================================
// Test 1: validator shape contract
// =====================================================================

test('Test 1: validator exports id/severity_map/scope/validate', () => {
  const v = loadValidator();
  assert.equal(typeof v, 'object', 'export is object');
  assert.equal(v.id, 'navigation-invariants', 'id matches');
  assert.equal(v.scope, 'room', 'scope is room');
  assert.equal(typeof v.validate, 'function', 'validate is function');
  assert.equal(typeof v.severity_map, 'object', 'severity_map present');
});

// =====================================================================
// Test 2: severity_map covers documented categories
// =====================================================================

test('Test 2: severity_map has all 6 documented categories at valid severities', () => {
  const v = loadValidator();
  const validSeverities = new Set(['critical', 'error', 'warning', 'info']);
  const required = [
    'trace_missing_field',
    'recommended_in_wrong_mode',
    'weight_clamp_breach',
    'unknown_verb_passed',
    'trace_file_malformed',
    'session_file_absent',
  ];
  for (const k of required) {
    const sev = v.severity_map[k];
    assert.ok(validSeverities.has(sev),
      'category ' + k + ' has valid severity (got ' + sev + ')');
  }
});

// =====================================================================
// Test 3: INV-1 missing trace field -> trace_missing_field violation
// =====================================================================

test('Test 3: INV-1 missing brain_md_stale_reason yields violation', () => {
  const room = freshRoom('t3');
  try {
    const trace = makeTrace();
    delete trace.brain_md_stale_reason;
    writeTraceFile(room, 'sess-t3', [trace]);
    const v = loadValidator();
    const result = v.validate(room, ctxFor(room));
    assert.ok(result && Array.isArray(result.violations), 'returns shape');
    const missing = result.violations.filter(function (x) {
      return x.category === 'trace_missing_field' && x.field === 'brain_md_stale_reason';
    });
    assert.equal(missing.length, 1, 'exactly one trace_missing_field violation');
    assert.equal(missing[0].severity, 'error', 'severity is error');
    assert.equal(missing[0].validator, 'navigation-invariants', 'self-tagged');
  } finally { rmrf(room); }
});

// =====================================================================
// Test 4: INV-1 all 8 fields present -> zero completeness violations
// =====================================================================

test('Test 4: INV-1 all fields present yields zero trace_missing_field', () => {
  const room = freshRoom('t4');
  try {
    writeTraceFile(room, 'sess-t4', [makeTrace()]);
    const v = loadValidator();
    const result = v.validate(room, ctxFor(room));
    const missing = result.violations.filter(function (x) {
      return x.category === 'trace_missing_field';
    });
    assert.equal(missing.length, 0,
      'no missing-field violations: got ' + JSON.stringify(missing));
  } finally { rmrf(room); }
});

// =====================================================================
// Test 5: INV-2 RECOMMENDED rendered in mode_b -> violation
// =====================================================================

test('Test 5: INV-2 RECOMMENDED rendered in mode_b -> recommended_in_wrong_mode', () => {
  const room = freshRoom('t5');
  try {
    const trace = makeTrace({
      brain_md_tier_mode: 'mode_b',
      brain_md_recommended_marker_rendered: true,
    });
    writeTraceFile(room, 'sess-t5', [trace]);
    const v = loadValidator();
    const result = v.validate(room, ctxFor(room));
    const wrong = result.violations.filter(function (x) {
      return x.category === 'recommended_in_wrong_mode';
    });
    assert.equal(wrong.length, 1, 'exactly one recommended_in_wrong_mode');
    assert.equal(wrong[0].severity, 'error', 'severity is error');
  } finally { rmrf(room); }
});

// =====================================================================
// Test 6: INV-2 RECOMMENDED rendered in tier_0 -> violation
// =====================================================================

test('Test 6: INV-2 RECOMMENDED rendered in tier_0 -> recommended_in_wrong_mode', () => {
  const room = freshRoom('t6');
  try {
    const trace = makeTrace({
      brain_md_tier_mode: 'tier_0',
      brain_md_recommended_marker_rendered: true,
    });
    writeTraceFile(room, 'sess-t6', [trace]);
    const v = loadValidator();
    const result = v.validate(room, ctxFor(room));
    const wrong = result.violations.filter(function (x) {
      return x.category === 'recommended_in_wrong_mode';
    });
    assert.equal(wrong.length, 1, 'exactly one recommended_in_wrong_mode in tier_0');
  } finally { rmrf(room); }
});

// =====================================================================
// Test 7: INV-2 RECOMMENDED in mode_a -> zero violation
// =====================================================================

test('Test 7: INV-2 RECOMMENDED in mode_a OK', () => {
  const room = freshRoom('t7');
  try {
    const trace = makeTrace({
      brain_md_tier_mode: 'mode_a',
      brain_md_recommended_marker_rendered: true,
    });
    writeTraceFile(room, 'sess-t7', [trace]);
    const v = loadValidator();
    const result = v.validate(room, ctxFor(room));
    const wrong = result.violations.filter(function (x) {
      return x.category === 'recommended_in_wrong_mode';
    });
    assert.equal(wrong.length, 0,
      'mode_a + recommended is allowed: got ' + JSON.stringify(wrong));
  } finally { rmrf(room); }
});

// =====================================================================
// Test 8: INV-3 weight clamp breach (over and under)
// =====================================================================

test('Test 8: INV-3 weight outside [0.0, 1.0] -> weight_clamp_breach', () => {
  const room = freshRoom('t8');
  try {
    writeTraceFile(room, 'sess-t8a', [makeTrace({ brain_md_weight_applied: 1.5 })]);
    writeTraceFile(room, 'sess-t8b', [makeTrace({ brain_md_weight_applied: -0.1 })]);
    const v = loadValidator();
    const result = v.validate(room, ctxFor(room));
    const breaches = result.violations.filter(function (x) {
      return x.category === 'weight_clamp_breach';
    });
    assert.equal(breaches.length, 2, 'one breach per offending trace; got ' + breaches.length);
    for (const b of breaches) {
      assert.equal(b.severity, 'error', 'breach severity is error');
    }
  } finally { rmrf(room); }
});

// =====================================================================
// Test 9: INV-4 malformed trace file -> trace_file_malformed
// =====================================================================

test('Test 9: INV-4 malformed JSON yields trace_file_malformed; valid sibling still scanned', () => {
  const room = freshRoom('t9');
  try {
    // Write a valid file alongside a garbage file. Ensure both are processed.
    writeTraceFile(room, 'sess-t9-good', [makeTrace({ brain_md_weight_applied: 1.5 })]);
    const dir = path.join(room, '.mindrian', 'decision-traces');
    fs.writeFileSync(path.join(dir, 'sess-t9-bad.json'), 'not-json{{{');
    const v = loadValidator();
    const result = v.validate(room, ctxFor(room));
    const malformed = result.violations.filter(function (x) {
      return x.category === 'trace_file_malformed';
    });
    assert.equal(malformed.length, 1, 'one malformed violation');
    assert.equal(malformed[0].severity, 'error', 'malformed severity is error');
    // Verify the good file's weight breach still surfaced (sibling scan).
    const breaches = result.violations.filter(function (x) {
      return x.category === 'weight_clamp_breach';
    });
    assert.equal(breaches.length, 1, 'valid sibling scanned despite malformed peer');
  } finally { rmrf(room); }
});

// =====================================================================
// Test 10: INV-5 unknown verb -> unknown_verb_passed warning
// =====================================================================

test('Test 10: INV-5 unknown fire_skill verb yields warning', () => {
  const room = freshRoom('t10');
  try {
    const trace = makeTrace({ fire_skill: 'Invent New Verb' });
    writeTraceFile(room, 'sess-t10', [trace]);
    const v = loadValidator();
    const result = v.validate(room, ctxFor(room));
    const unknown = result.violations.filter(function (x) {
      return x.category === 'unknown_verb_passed';
    });
    assert.equal(unknown.length, 1, 'one unknown_verb_passed violation');
    assert.equal(unknown[0].severity, 'warning', 'severity is warning');
  } finally { rmrf(room); }
});

// =====================================================================
// Test 10b: INV-5 known canonical verb -> zero violation (negative path)
// =====================================================================

test('Test 10b: INV-5 canonical verb passes silently', () => {
  const room = freshRoom('t10b');
  try {
    // Use a verb known to be in the frozen 10-verb canon.
    const sharedMod = require(SHARED_PATH);
    assert.ok(Array.isArray(sharedMod.CANONICAL_VERBS) && sharedMod.CANONICAL_VERBS.length > 0,
      'shared exports CANONICAL_VERBS');
    const verb = sharedMod.CANONICAL_VERBS[0];
    writeTraceFile(room, 'sess-t10b', [makeTrace({ fire_skill: verb })]);
    const v = loadValidator();
    const result = v.validate(room, ctxFor(room));
    const unknown = result.violations.filter(function (x) {
      return x.category === 'unknown_verb_passed';
    });
    assert.equal(unknown.length, 0, 'canonical verb does not flag: got ' + JSON.stringify(unknown));
  } finally { rmrf(room); }
});

// =====================================================================
// Test 10c: session_file_absent when decision-traces dir is missing
// =====================================================================

test('Test 10c: missing decision-traces dir -> session_file_absent info', () => {
  const room = freshRoom('t10c');
  try {
    const v = loadValidator();
    const result = v.validate(room, ctxFor(room));
    const absent = result.violations.filter(function (x) {
      return x.category === 'session_file_absent';
    });
    assert.equal(absent.length, 1, 'one session_file_absent info');
    assert.equal(absent[0].severity, 'info', 'severity is info');
    // No noise: no other categories from this run.
    assert.equal(result.violations.length, 1, 'only the absent info; total: ' +
      JSON.stringify(result.violations));
  } finally { rmrf(room); }
});

// =====================================================================
// Test 11: registry integration -- guardian on-stop picks up validator
// =====================================================================

test('Test 11: registry integration via on-stop guardian + GUARDIAN_VALIDATORS_DIR', () => {
  const room = freshRoom('t11');
  // Stage isolated validators dir with ONLY navigation-invariants present.
  const validatorsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nav-inv-vdir-t11-'));
  try {
    fs.copyFileSync(VALIDATOR_PATH, path.join(validatorsDir, 'navigation-invariants.cjs'));
    // Seed a malformed trace + a clean trace so the on-stop pass produces
    // an invariant-report with our validator's signature.
    const trace = makeTrace({ brain_md_weight_applied: 5.0 });
    writeTraceFile(room, 'sess-t11', [trace]);
    const result = spawnSync(process.execPath,
      [GUARDIAN_PATH, 'on-stop', room],
      { env: Object.assign({}, process.env, { GUARDIAN_VALIDATORS_DIR: validatorsDir }) }
    );
    assert.equal(result.status, 0, 'guardian on-stop exits 0; stderr=' +
      (result.stderr && result.stderr.toString()));
    const reportPath = path.join(room, '.mindrian', 'invariant-report.json');
    assert.ok(fs.existsSync(reportPath), 'invariant-report.json written');
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    assert.ok(report.sections && report.sections.__room__,
      '__room__ section in report');
    const viols = report.sections.__room__.violations || [];
    const tagged = viols.filter(function (v) { return v.validator === 'navigation-invariants'; });
    assert.ok(tagged.length >= 1, 'navigation-invariants tagged in report; got ' +
      JSON.stringify(viols));
  } finally {
    rmrf(room);
    rmrf(validatorsDir);
  }
});

// =====================================================================
// Test 12: fail-open inheritance from Phase 88-13 registry
// =====================================================================

test('Test 12: malformed sibling validator does not prevent navigation-invariants', () => {
  const room = freshRoom('t12');
  const validatorsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nav-inv-vdir-t12-'));
  try {
    // 1) Drop a deliberately malformed validator (missing required exports).
    fs.writeFileSync(path.join(validatorsDir, 'broken-validator.cjs'),
      "module.exports = { id: 'broken' /* no validate, no severity_map */ };");
    // 2) Drop our validator alongside.
    fs.copyFileSync(VALIDATOR_PATH, path.join(validatorsDir, 'navigation-invariants.cjs'));
    // 3) Seed a violation we can recognize.
    writeTraceFile(room, 'sess-t12', [makeTrace({ brain_md_weight_applied: 7.0 })]);
    const result = spawnSync(process.execPath,
      [GUARDIAN_PATH, 'on-stop', room],
      { env: Object.assign({}, process.env, { GUARDIAN_VALIDATORS_DIR: validatorsDir }) }
    );
    assert.equal(result.status, 0, 'guardian still exits 0 despite broken sibling');
    const reportPath = path.join(room, '.mindrian', 'invariant-report.json');
    assert.ok(fs.existsSync(reportPath), 'invariant-report still written');
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    const viols = (report.sections.__room__ && report.sections.__room__.violations) || [];
    const tagged = viols.filter(function (v) { return v.validator === 'navigation-invariants'; });
    assert.ok(tagged.length >= 1,
      'navigation-invariants ran despite broken sibling; got ' + JSON.stringify(viols));
  } finally {
    rmrf(room);
    rmrf(validatorsDir);
  }
});

// =====================================================================
// Test 13: Canon Part 8 source scan -- validator is LOCAL only
// =====================================================================

test('Test 13: validator source has zero network surface (Canon Part 8)', () => {
  const src = fs.readFileSync(VALIDATOR_PATH, 'utf8');
  // Forbid Brain client, fetch, https/http modules, child_process curl.
  const forbidden = [
    /require\(\s*['"]https?['"]\s*\)/,
    /require\(\s*['"]node:https?['"]\s*\)/,
    /\bfetch\s*\(/,
    /brain[-_]?client/i,
    /smartSearch|brainQuery/i,
  ];
  for (const re of forbidden) {
    assert.ok(!re.test(src),
      'forbidden network reference matched ' + re + ' in navigation-invariants.cjs');
  }
});

// =====================================================================
// Test 14: BSL header present
// =====================================================================

test('Test 14: BSL 1.1 header on validator', () => {
  const src = fs.readFileSync(VALIDATOR_PATH, 'utf8');
  const head = src.split('\n').slice(0, 20).join('\n');
  assert.ok(/BSL\s*1\.1/i.test(head), 'BSL 1.1 mentioned in first 20 lines');
});

// ----------- summary -----------

const total = pass + fail;
process.stdout.write('\n' + pass + '/' + total + ' passed\n');
if (fail > 0) {
  process.stdout.write(fail + ' failed:\n');
  for (const f of failures) process.stdout.write('  - ' + f.name + '\n');
}
process.exit(fail === 0 ? 0 : 1);
