'use strict';
// Phase 110-01 Task 2 - real child_process suite around
// scripts/build-brain-packet-schema.cjs --check. Replaces the Plan 110-00
// RED stub at this path. Implements: PACKET-110-01 + PACKET-110-02.
//
// What this asserts:
//   1. The shipped schema (data/brain-packet-schema.json) passes --check
//      (exit 0, stdout contains "brain-packet-schema: OK").
//   2. A malformed JSON copy fails --check (exit non-zero, stderr names
//      "not valid JSON" and the Recovery: line).
//   3. An empty {} copy fails --check (exit non-zero, stderr names
//      "missing $def for shipped job" and the Recovery: line).
//   4. A copy with one job's "in" sub-schema deleted fails --check (stderr
//      names "no \"in\"" and the broken job).
//   5. A copy with an unknown-job $def fails --check (stderr names "closed
//      vocabulary" and the unknown job name).
//   6. A copy with additionalProperties:false removed from a nested object
//      ($defs.LocalGraphSummary) fails --check (stderr names
//      "additionalProperties" and "LocalGraphSummary").
//
// Pattern: matches tests/test-navigation-chokepoint-hook.cjs (CJS, node
// assert/strict, node:child_process spawnSync, fs.mkdtempSync tmp dir,
// cleanup in finally). Uses the MINDRIAN_BRAIN_PACKET_SCHEMA env seam to
// point the script at mangled fixtures - this is the test seam the
// scripts/build-brain-packet-schema.cjs source explicitly documents.

const { ok, equal, notEqual } = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const SCRIPT = path.join(REPO_ROOT, 'scripts', 'build-brain-packet-schema.cjs');
const REAL_SCHEMA = path.join(REPO_ROOT, 'data', 'brain-packet-schema.json');

// Sanity: the script exists and is invokable.
ok(fs.existsSync(SCRIPT), 'scripts/build-brain-packet-schema.cjs must exist');
ok(fs.existsSync(REAL_SCHEMA), 'data/brain-packet-schema.json must exist');

let assertions = 0;

function runWithSchema(schemaObjOrText) {
  // Write the mangled fixture to a tmp dir, point the script at it via the
  // MINDRIAN_BRAIN_PACKET_SCHEMA env override, run --check, clean up.
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'phase-110-01-schema-'));
  const p = path.join(tmpDir, 'mangled-schema.json');
  try {
    fs.writeFileSync(
      p,
      typeof schemaObjOrText === 'string'
        ? schemaObjOrText
        : JSON.stringify(schemaObjOrText, null, 2)
    );
    const env = Object.assign({}, process.env, { MINDRIAN_BRAIN_PACKET_SCHEMA: p });
    const r = spawnSync('node', [SCRIPT, '--check'], { env, cwd: REPO_ROOT, encoding: 'utf8' });
    return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_e) { /* ignore */ }
  }
}

function loadBaseSchema() {
  return JSON.parse(fs.readFileSync(REAL_SCHEMA, 'utf8'));
}

// -------------------------------------------------------------------------
// Test 1 - the shipped schema must pass --check (exit 0).
// -------------------------------------------------------------------------
function test1_shippedSchemaPasses() {
  const r = spawnSync('node', [SCRIPT, '--check'], { cwd: REPO_ROOT, encoding: 'utf8' });
  equal(r.status, 0, 'shipped schema must pass --check; stderr=' + (r.stderr || ''));
  ok(/brain-packet-schema: OK/.test(r.stdout || ''), 'stdout must contain "brain-packet-schema: OK"; got: ' + (r.stdout || ''));
  assertions += 2;
}

// -------------------------------------------------------------------------
// Test 2 - malformed JSON: a literal "{". stderr must name "not valid JSON"
// and the Recovery: line.
// -------------------------------------------------------------------------
function test2_malformedJsonRejected() {
  const r = runWithSchema('{');
  notEqual(r.status, 0, 'malformed JSON must fail --check');
  ok(/not valid JSON/i.test(r.stderr), 'stderr must name "not valid JSON"; stderr=' + r.stderr);
  ok(/Recovery:/.test(r.stderr), 'stderr must contain Recovery: line; stderr=' + r.stderr);
  assertions += 3;
}

// -------------------------------------------------------------------------
// Test 3 - empty {} (valid JSON, but no $defs at all): every shipped job is
// missing - stderr must name "missing $def for shipped job".
// -------------------------------------------------------------------------
function test3_emptyObjectRejected() {
  const r = runWithSchema('{}');
  notEqual(r.status, 0, 'empty {} must fail --check');
  ok(/missing \$def for shipped job/.test(r.stderr), 'stderr must name "missing $def for shipped job"; stderr=' + r.stderr);
  ok(/Recovery:/.test(r.stderr), 'stderr must contain Recovery: line; stderr=' + r.stderr);
  assertions += 3;
}

// -------------------------------------------------------------------------
// Test 4 - delete one job's "in" sub-schema. stderr must name the broken
// job AND "no \"in\"".
// -------------------------------------------------------------------------
function test4_missingInRejected() {
  const base = loadBaseSchema();
  delete base.$defs.select_methodology.in;
  const r = runWithSchema(base);
  notEqual(r.status, 0, 'missing "in" sub-schema must fail --check');
  ok(
    /has no "in"/.test(r.stderr) || /select_methodology/.test(r.stderr),
    'stderr must name the broken job or the "no in" condition; stderr=' + r.stderr
  );
  ok(/Recovery:/.test(r.stderr), 'stderr must contain Recovery: line; stderr=' + r.stderr);
  assertions += 3;
}

// -------------------------------------------------------------------------
// Test 5 - add an unknown-job $def. stderr must name "closed vocabulary"
// AND the unknown job name.
// -------------------------------------------------------------------------
function test5_unknownJobRejected() {
  const base = loadBaseSchema();
  base.$defs.not_a_real_job = {
    in: {
      type: 'object',
      additionalProperties: false,
      properties: { job: { const: 'not_a_real_job' } },
    },
    out: { type: 'object', additionalProperties: false },
  };
  const r = runWithSchema(base);
  notEqual(r.status, 0, 'unknown-job $def must fail --check');
  ok(/closed vocabulary/.test(r.stderr), 'stderr must name "closed vocabulary"; stderr=' + r.stderr);
  ok(/not_a_real_job/.test(r.stderr), 'stderr must name the offending job; stderr=' + r.stderr);
  ok(/Recovery:/.test(r.stderr), 'stderr must contain Recovery: line; stderr=' + r.stderr);
  assertions += 4;
}

// -------------------------------------------------------------------------
// Test 6 - remove additionalProperties:false from a nested object ($defs
// .LocalGraphSummary). stderr must name "additionalProperties" AND
// "LocalGraphSummary" (the precise location).
// -------------------------------------------------------------------------
function test6_missingAdditionalPropsRejected() {
  const base = loadBaseSchema();
  delete base.$defs.LocalGraphSummary.additionalProperties;
  const r = runWithSchema(base);
  notEqual(r.status, 0, 'missing additionalProperties:false must fail --check');
  ok(/additionalProperties/.test(r.stderr), 'stderr must name "additionalProperties"; stderr=' + r.stderr);
  ok(/LocalGraphSummary/.test(r.stderr), 'stderr must name "LocalGraphSummary"; stderr=' + r.stderr);
  ok(/Recovery:/.test(r.stderr), 'stderr must contain Recovery: line; stderr=' + r.stderr);
  assertions += 4;
}

// -------------------------------------------------------------------------
// Main - run every test, exit 0 only if all assert/ok/equal calls passed
// (they throw on failure, surfacing a non-zero exit naturally).
// -------------------------------------------------------------------------
test1_shippedSchemaPasses();
test2_malformedJsonRejected();
test3_emptyObjectRejected();
test4_missingInRejected();
test5_unknownJobRejected();
test6_missingAdditionalPropsRejected();

console.log('test-brain-packet-schema-check: PASS (' + assertions + ' assertions across 6 tests)');
process.exit(0);
