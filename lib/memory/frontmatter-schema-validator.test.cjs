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
 * Test map (10 cases, one-to-one with the PLAN <behavior> block):
 *   1.  Valid artifact (artifact-default) with all required fields
 *       -> valid:true, violations:[], severity 'info' or null
 *   2.  Artifact missing `title`
 *       -> valid:false, violations contains {field:'title', type:'missing'}
 *   3.  Artifact missing ALL required fields
 *       -> severity 'critical'
 *   4.  Malformed YAML (frontmatter === null)
 *       -> valid:false, severity 'critical'
 *   5.  ROOM.md without `name`
 *       -> violation present
 *   6.  STATE.md without `artifact_count`
 *       -> violation present
 *   7.  MINTO.md delegation: validate() detects MINTO.md and delegates to
 *       feynman-minto-invariants.cjs; returns proxy result shape
 *   8.  Unknown/custom frontmatter field
 *       -> warning (not error) in violations
 *   9.  Pure function: zero fs imports in the validator (grep assertion
 *       + no fs usage during validate())
 *  10.  Empty frontmatter block (parsed to {}) -> critical (required
 *       fields missing)
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

// ---------- Test 2: artifact missing title ----------

(function test2_missing_title() {
  const fm = {
    source: 'meeting/2026-04-12-clinical-team',
    status: 'active',
  };
  const result = schemas.validate('room/problem-definition/artifact-02.md', fm);
  assert.equal(result.valid, false, 'Test 2: missing title should be invalid');
  const titleViol = result.violations.find(function (v) {
    return v.field === 'title' && v.type === 'missing';
  });
  assert.ok(titleViol, 'Test 2: violation for missing title must exist');
  assert.equal(titleViol.severity, 'error',
    'Test 2: missing required field is error severity');
  process.stdout.write('PASS Test 2: artifact missing title\n');
})();

// ---------- Test 3: artifact missing ALL required fields -> critical ----------

(function test3_missing_all_required() {
  const fm = {}; // no title, no source, no status
  const result = schemas.validate('room/market/artifact.md', fm);
  assert.equal(result.valid, false, 'Test 3: empty fm is invalid');
  assert.equal(result.severity, 'critical',
    'Test 3: all required missing -> critical aggregate severity, got ' +
      String(result.severity));
  // All three required fields should appear as missing violations.
  const missingFields = result.violations
    .filter(function (v) { return v.type === 'missing'; })
    .map(function (v) { return v.field; });
  for (const req of ['title', 'source', 'status']) {
    assert.ok(missingFields.indexOf(req) !== -1,
      'Test 3: missing ' + req + ' must be reported');
  }
  process.stdout.write('PASS Test 3: all required missing -> critical\n');
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

// ---------- Test 5: ROOM.md without name -> violation ----------

(function test5_room_md_missing_name() {
  const fm = { type: 'section' }; // no name
  const result = schemas.validate('room/problem-definition/ROOM.md', fm);
  assert.equal(result.valid, false, 'Test 5: ROOM.md missing name is invalid');
  const nameViol = result.violations.find(function (v) {
    return v.field === 'name' && v.type === 'missing';
  });
  assert.ok(nameViol, 'Test 5: missing name violation must exist for ROOM.md');
  process.stdout.write('PASS Test 5: ROOM.md missing name\n');
})();

// ---------- Test 6: STATE.md without artifact_count -> violation ----------

(function test6_state_md_missing_artifact_count() {
  const fm = { completeness_score: 0.5 }; // no artifact_count
  const result = schemas.validate('room/problem-definition/STATE.md', fm);
  assert.equal(result.valid, false, 'Test 6: STATE.md missing artifact_count is invalid');
  const countViol = result.violations.find(function (v) {
    return v.field === 'artifact_count' && v.type === 'missing';
  });
  assert.ok(countViol, 'Test 6: missing artifact_count violation must exist');
  process.stdout.write('PASS Test 6: STATE.md missing artifact_count\n');
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

// ---------- Test 10: empty frontmatter block {} -> critical ----------

(function test10_empty_frontmatter() {
  // An empty parsed frontmatter block (e.g. `---\n\n---`) yields {}.
  // All required fields are missing, so aggregate severity is critical.
  const result = schemas.validate('room/problem-definition/empty.md', {});
  assert.equal(result.valid, false, 'Test 10: empty {} frontmatter is invalid');
  assert.equal(result.severity, 'critical',
    'Test 10: empty {} -> critical severity, got ' + String(result.severity));
  process.stdout.write('PASS Test 10: empty {} -> critical\n');
})();

process.stdout.write('\nfrontmatter-schema-validator tests: 10/10 passed\n');
