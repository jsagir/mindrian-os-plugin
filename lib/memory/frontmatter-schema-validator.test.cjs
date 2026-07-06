#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 88.1-07 -- frontmatter schema validator acceptance tests.
 *
 * Verifies the pure validate(filePath, frontmatter) contract for the
 * per-section frontmatter schema module at lib/core/frontmatter-schemas.cjs.
 * The validator is consumed by the PostToolUse hook at
 * scripts/frontmatter-schema-validator.cjs, which handles fs I/O, stdin
 * envelope parsing, and the .room-root scope walk.
 *
 * Canon references:
 *   Part 5 Evidence Graded By Context -- schemas formalize the claim-level
 *     evidence tier properties so Part 5 enforcement has something to
 *     measure against.
 *   Part 6 Product-as-Venture -- dog-fooding: the plugin validates its own
 *     artifact frontmatter through its own mechanism.
 *   Part 8 Graph Boundary -- validator runs LOCAL only; pure function has
 *     zero network and zero fs, so no schema-violation payload can leave
 *     the workspace from this module.
 *
 * CONTRACT CHANGE (2026-07-06 writer-reconcile): Phase 88.1-07 originally
 * codified an aspirational vocabulary (artifacts required title+source+status,
 * ROOM.md required name+type, STATE.md required artifact_count) that no writer
 * ever emitted, making the advisory hook a noisy false-positive generator and
 * a Canon Part 6 dog-food self-violation. Per Decision 15 (filesystem writers
 * are the source of truth) the validator was reconciled to the writers: every
 * managed-file schema now has required=[] and recognizes the real writer
 * vocabularies. Tests 2, 3, 5, 6, 10 below were rewritten to assert the NEW
 * contract; this is the intended behavior change, not a regression.
 *
 * Test map (10 cases):
 *   1.  Valid artifact (artifact-default) with source/title/status
 *       -> valid:true, violations:[], severity 'info' or null
 *   2.  Artifact without `title` (title no longer required)
 *       -> valid:true, no blocking violation
 *   3.  Empty artifact frontmatter {} (no universal required key)
 *       -> valid:true, no blocking violation
 *   4.  Malformed YAML (frontmatter === null)
 *       -> valid:false, severity 'critical'
 *   5.  ROOM.md Phase 119 scaffold vocabulary (section/purpose/...)
 *       -> valid:true, no blocking violation
 *   6.  STATE.md compute-state computed vocabulary
 *       -> valid:true, no blocking violation
 *   7.  MINTO.md delegation: validate() detects MINTO.md and delegates to
 *       feynman-minto-invariants.cjs; returns proxy result shape
 *   8.  Unknown/custom frontmatter field
 *       -> warning (not error) in violations
 *   9.  Pure function: zero fs imports in the validator (grep assertion
 *       + no fs usage during validate())
 *  10.  USER.md routes to the USER.md schema (not artifact-default) and the
 *       converged machine schema validates clean
 *
 * Registered in lib/memory/run-feynman-tests.cjs.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..', '..');
const SCHEMAS_PATH = path.join(REPO, 'lib/core/frontmatter-schemas.cjs');
const INVARIANTS_PATH = path.join(REPO, 'lib/core/feynman-minto-invariants.cjs');

// ---------- Tmp root cleanup ----------

const TMP_ROOTS = [];
function mkTmp(prefix) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  TMP_ROOTS.push(d);
  return d;
}
process.on('exit', function () {
  for (const d of TMP_ROOTS) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch (_e) { /* ok */ }
  }
});

// ---------- Module under test ----------

// Defensive clear so repeated invocations in test harnesses reload fresh.
try { delete require.cache[require.resolve(SCHEMAS_PATH)]; } catch (_) {}
const schemas = require(SCHEMAS_PATH);

assert.equal(typeof schemas.validate, 'function',
  'module must export validate()');
assert.ok(schemas.SCHEMAS && typeof schemas.SCHEMAS === 'object',
  'module must export SCHEMAS object');

// ---------- Test 1: valid artifact with all required fields ----------

(function test1_valid_artifact() {
  const fm = {
    title: 'Whitespace in CAR-T trial design',
    source: 'meeting/2026-04-12-clinical-team',
    status: 'active',
  };
  const result = schemas.validate('room/problem-definition/artifact-01.md', fm);
  assert.equal(result.valid, true, 'Test 1: valid artifact should be valid');
  assert.deepEqual(result.violations, [], 'Test 1: no violations expected');
  // Severity is 'info' or null for a clean pass; either is acceptable.
  assert.ok(result.severity === 'info' || result.severity === null,
    'Test 1: severity should be info or null, got ' + String(result.severity));
  process.stdout.write('PASS Test 1: valid artifact with required fields\n');
})();

// ---------- Test 2: artifact without title -> valid (title not required) ----------

(function test2_no_title_is_valid() {
  // New contract: title is no longer required (no writer emits it). An entry
  // with only source (the new-project Step 6 shape carries source + date) is
  // advisory-clean.
  const fm = {
    source: 'new-project exploration',
    date: '2026-07-06',
  };
  const result = schemas.validate('room/problem-definition/artifact-02.md', fm);
  assert.equal(result.valid, true,
    'Test 2: artifact without title is valid under the reconciled schema');
  const titleViol = result.violations.find(function (v) {
    return v.field === 'title' && v.type === 'missing';
  });
  assert.ok(!titleViol, 'Test 2: no missing-title violation should be raised');
  process.stdout.write('PASS Test 2: artifact without title is valid\n');
})();

// ---------- Test 3: empty artifact frontmatter {} -> non-blocking ----------

(function test3_empty_artifact_non_blocking() {
  // New contract: there is no universally-emitted artifact key, so required
  // is []. Empty frontmatter produces no blocking (error/critical) violation.
  const fm = {};
  const result = schemas.validate('room/market/artifact.md', fm);
  assert.equal(result.valid, true, 'Test 3: empty {} artifact is non-blocking');
  const blocking = result.violations.filter(function (v) {
    return v.severity === 'error' || v.severity === 'critical';
  });
  assert.equal(blocking.length, 0,
    'Test 3: empty {} artifact must raise zero blocking violations, got ' +
      blocking.length);
  process.stdout.write('PASS Test 3: empty {} artifact is non-blocking\n');
})();

// ---------- Test 4: malformed YAML (fm === null) ----------

(function test4_malformed_yaml() {
  // Convention: the hook signals a YAML parse failure by passing fm === null
  // (gray-matter yields {} on empty / null on throw, but schema-wise we
  // treat null as the parser-failure signal to avoid ambiguity with test 10).
  const result = schemas.validate('room/anywhere/artifact.md', null);
  assert.equal(result.valid, false, 'Test 4: malformed YAML is invalid');
  assert.equal(result.severity, 'critical',
    'Test 4: parse failure -> critical severity');
  const parseViol = result.violations.find(function (v) {
    return v.type === 'malformed';
  });
  assert.ok(parseViol, 'Test 4: a malformed-type violation must be recorded');
  process.stdout.write('PASS Test 4: malformed YAML (null fm) -> critical\n');
})();

// ---------- Test 5: ROOM.md scaffold vocabulary -> valid ----------

(function test5_room_md_scaffold_vocab_valid() {
  // New contract: ROOM.md recognizes the Phase 119 ROOM.md.section.tmpl
  // vocabulary and no longer requires name/type.
  const fm = {
    section: 'problem-definition',
    purpose: 'Define the core problem this venture addresses.',
    stage_relevance: ['Pre-Opportunity', 'Discovery'],
    default_methodologies: ['domain-explorer'],
    icm_layer: 0,
    auto_scaffolded: true,
  };
  const result = schemas.validate('room/problem-definition/ROOM.md', fm);
  assert.equal(result.valid, true,
    'Test 5: scaffold ROOM.md validates clean under the reconciled schema');
  const blocking = result.violations.filter(function (v) {
    return v.severity === 'error' || v.severity === 'critical';
  });
  assert.equal(blocking.length, 0,
    'Test 5: scaffold ROOM.md must raise zero blocking violations, got ' +
      blocking.length);
  process.stdout.write('PASS Test 5: ROOM.md scaffold vocabulary valid\n');
})();

// ---------- Test 6: STATE.md compute-state vocabulary -> valid ----------

(function test6_state_md_computed_vocab_valid() {
  // New contract: STATE.md recognizes the scripts/compute-state computed
  // vocabulary (computed / venture_stage / total_entries); artifact_count is
  // no longer required.
  const fm = {
    computed: '2026-07-06T00:00:00Z',
    venture_stage: 'Pre-Opportunity',
    total_entries: 0,
  };
  const result = schemas.validate('room/STATE.md', fm);
  assert.equal(result.valid, true,
    'Test 6: compute-state STATE.md validates clean under the reconciled schema');
  const blocking = result.violations.filter(function (v) {
    return v.severity === 'error' || v.severity === 'critical';
  });
  assert.equal(blocking.length, 0,
    'Test 6: compute-state STATE.md must raise zero blocking violations, got ' +
      blocking.length);
  process.stdout.write('PASS Test 6: STATE.md compute-state vocabulary valid\n');
})();

// ---------- Test 7: MINTO.md delegates to feynman-minto-invariants.cjs ----------

(function test7_minto_delegation() {
  // Prove the validator detects MINTO.md and proxies. We confirm two things:
  //   (a) the schemas module source references feynman-minto-invariants
  //       (static wiring proof)
  //   (b) calling validate() with a MINTO.md filename on a real fixture
  //       produces an invariants-shaped result.
  const src = fs.readFileSync(SCHEMAS_PATH, 'utf8');
  assert.ok(/require\([^\)]*feynman-minto-invariants/.test(src),
    'Test 7a: schemas module must require feynman-minto-invariants');

  // Build a fixture MINTO.md on disk so the delegated invariants validator
  // has something to read. It performs fs I/O by design (Phase 88-00-B
  // contract); the pure schema validate() delegates to it for MINTO paths.
  const tmp = mkTmp('fm-schema-minto-');
  const mintoPath = path.join(tmp, 'MINTO.md');
  const contents =
    '---\n' +
    'schema_version: "88-00"\n' +
    'governing_thought: "CAR-T manufacturing cost is the reverse salient"\n' +
    'last_generated_at: "2026-04-23T00:00:00Z"\n' +
    '---\n' +
    'narrative body within budget.\n';
  fs.writeFileSync(mintoPath, contents, 'utf8');

  const fm = {
    schema_version: '88-00',
    governing_thought: 'CAR-T manufacturing cost is the reverse salient',
  };
  const result = schemas.validate(mintoPath, fm);

  // The delegation result must expose the invariants validator shape:
  // { valid, violations, severity }. We do not assert severity value --
  // invariants validator may return info/warning depending on timestamps.
  assert.ok('valid' in result, 'Test 7b: delegated result has valid');
  assert.ok(Array.isArray(result.violations),
    'Test 7b: delegated result has violations array');
  assert.ok('severity' in result,
    'Test 7b: delegated result has severity key');
  process.stdout.write('PASS Test 7: MINTO.md delegation to invariants\n');
})();

// ---------- Test 8: unknown frontmatter field -> warning (not error) ----------

(function test8_unknown_field_warning() {
  const fm = {
    title: 'Whitespace entry',
    source: 'manual',
    status: 'active',
    made_up_field: 'garbage',
    another_unknown: 42,
  };
  const result = schemas.validate('room/problem-definition/artifact-08.md', fm);
  // Unknown fields alone should not make the artifact "invalid" (required
  // fields present), but they should surface as WARNING severity.
  const unknownViols = result.violations.filter(function (v) {
    return v.type === 'unknown';
  });
  assert.ok(unknownViols.length >= 2,
    'Test 8: at least 2 unknown violations expected, got ' + unknownViols.length);
  for (const v of unknownViols) {
    assert.equal(v.severity, 'warning',
      'Test 8: unknown fields carry warning severity, got ' + v.severity);
  }
  // Aggregate severity should not be higher than warning (no errors).
  assert.ok(result.severity === 'warning' || result.severity === 'info',
    'Test 8: aggregate severity must be warning or info, got ' + String(result.severity));
  process.stdout.write('PASS Test 8: unknown fields -> warning\n');
})();

// ---------- Test 9: pure function -- zero fs imports ----------

(function test9_pure_function() {
  const src = fs.readFileSync(SCHEMAS_PATH, 'utf8');
  // The schemas module itself MUST NOT require fs directly. It may
  // re-export an fs-using invariants module for MINTO delegation, but
  // the schema core is pure. Grep the top-level require statements.
  //
  // We look for `require('fs')` or `require('node:fs')` at import position.
  const fsRequireRe = /require\(\s*['"](?:node:)?fs['"]\s*\)/;
  assert.ok(!fsRequireRe.test(src),
    'Test 9: lib/core/frontmatter-schemas.cjs must not require fs');

  // BSL 1.1 header required within first 20 lines (Part 6 dog-food).
  const firstLines = src.split(/\r?\n/).slice(0, 20).join('\n');
  assert.ok(/BSL\s*1\.1/.test(firstLines),
    'Test 9: BSL 1.1 header required in first 20 lines');

  // No em-dashes or en-dashes anywhere (hard project rule).
  const DASH_RE = /[\u2013\u2014]/;
  assert.ok(!DASH_RE.test(src),
    'Test 9: schemas module must not contain em-dashes or en-dashes');
  process.stdout.write('PASS Test 9: pure function, no fs, BSL header, no dashes\n');
})();

// ---------- Test 10: USER.md routes to USER.md schema and validates clean ----------

(function test10_user_md_schema() {
  // New contract: USER.md must route to its own schema (not artifact-default)
  // and the converged machine schema (user-md-ops.cjs buildFrontmatter) must
  // validate with zero blocking violations. Previously USER.md wrongly matched
  // artifact-default and false-flagged on every key.
  assert.equal(schemas.selectSchemaKey('room/USER.md'), 'USER.md',
    'Test 10: USER.md must route to the USER.md schema');
  const fm = {
    schema_version: 1,
    user_id: null,
    canonical_role: 'navigator',
    larry_persona: null,
    brain_persona: null,
    journey_stage: null,
    role_blend: { founder: 0, researcher: 0, operator: 0 },
    problem_type: 'unknown',
    venture_stage: 'unknown',
    last_detected_at: null,
    last_updated_at: null,
    detection_confidence: 0.0,
    update_threshold: 0.7,
    consecutive_signal_count: 0,
  };
  const result = schemas.validate('room/USER.md', fm);
  assert.equal(result.valid, true, 'Test 10: converged USER.md validates clean');
  const blocking = result.violations.filter(function (v) {
    return v.severity === 'error' || v.severity === 'critical';
  });
  assert.equal(blocking.length, 0,
    'Test 10: USER.md must raise zero blocking violations, got ' + blocking.length);
  process.stdout.write('PASS Test 10: USER.md schema routing + clean validate\n');
})();

process.stdout.write('\nfrontmatter-schema-validator tests: 10/10 passed\n');
