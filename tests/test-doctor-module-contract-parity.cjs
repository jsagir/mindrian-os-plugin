'use strict';
/*
 * tests/test-doctor-module-contract-parity.cjs -- Phase 217 Plan-02 Task 1 (D-03).
 *
 * The HARD-BLOCKING module contract-parity gate. This is NOT advisory: any
 * declaration gap in data/doctor-modules.json enumerates to stderr and the
 * process exits 1. Part 11 R16's advisory-by-default posture is DELIBERATELY
 * NOT followed here -- the CONTEXT rules that precedent out for doctor.cjs
 * (D-03). The renderer became generic in quick-260711-nrd, so print parity is
 * already structural; this test's real job is DECLARATION COMPLETENESS.
 *
 * For EVERY entry in data/doctor-modules.json modules[] it asserts nine rules:
 *   1. id is a non-empty kebab-case string, unique across the registry.
 *   2. introduced_version is valid semver (prerelease labels pass).
 *   3. cadence is EXACTLY 'always' or 'once', explicitly present.
 *   4. flag is present and is a string or null.
 *   5. fix_supported is an explicit boolean (silence is not a no-fix declaration).
 *   6. runner resolves to an existing file relative to the repo root.
 *   7. require(runner) succeeds and exports a check() function.
 *   8. Two-way fix declaration parity: fix_supported:true -> exports fix();
 *      fix_supported:false -> does NOT export fix() (no undeclared remediation).
 *   9. check(scratch ctx) does not throw, returns a status in ok|warn|error|skip
 *      and a non-empty detail string; action_lines, when present, is a string[].
 *
 * Hermetic: node:assert/strict, fs.mkdtempSync scratch homes, zero network.
 * No em-dashes anywhere (house rule).
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const semver = require('semver');

const REPO_ROOT = path.resolve(__dirname, '..');
const REGISTRY_PATH = path.join(REPO_ROOT, 'data', 'doctor-modules.json');

const STATUS_VOCAB = new Set(['ok', 'warn', 'error', 'skip']);
const KEBAB_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

let passed = 0;
function ok(label) { passed += 1; console.log('  ok - ' + label); }

function freshHome() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'doctor-contract-'));
}

// checkModuleDeclaration(mod, seenIds) -> string[] of violation messages for the
// DECLARATION rules (1-5). No runner require, so this is reusable by the
// in-memory negative self-test (proving the gate actually bites).
function checkModuleDeclaration(mod, seenIds) {
  const v = [];
  const id = (mod && typeof mod.id === 'string') ? mod.id : '<no-id>';
  // Rule 1: id kebab-case + unique.
  if (typeof mod.id !== 'string' || !KEBAB_RE.test(mod.id)) {
    v.push(id + ': rule 1 -- id must be a non-empty kebab-case string');
  } else if (seenIds && seenIds.has(mod.id)) {
    v.push(id + ': rule 1 -- duplicate id in registry');
  }
  // Rule 2: introduced_version valid semver.
  if (semver.valid(mod.introduced_version) === null) {
    v.push(id + ': rule 2 -- introduced_version must be valid semver');
  }
  // Rule 3: cadence exactly always|once, explicitly present.
  if (mod.cadence !== 'always' && mod.cadence !== 'once') {
    v.push(id + ": rule 3 -- cadence must be exactly 'always' or 'once' (explicit)");
  }
  // Rule 4: flag present, string or null.
  if (!('flag' in mod) || !(mod.flag === null || typeof mod.flag === 'string')) {
    v.push(id + ': rule 4 -- flag must be present and a string or null');
  }
  // Rule 5: fix_supported explicit boolean.
  if (typeof mod.fix_supported !== 'boolean') {
    v.push(id + ': rule 5 -- fix_supported must be an explicit boolean (absence is not a no-fix declaration)');
  }
  return v;
}

// checkModuleRunner(mod) -> string[] of violations for the RUNNER rules (6-9):
// require the runner and invoke check() against a scratch ctx.
function checkModuleRunner(mod) {
  const v = [];
  const id = mod.id;
  // Rule 6: runner resolves to an existing file relative to the repo root.
  const runnerPath = path.resolve(REPO_ROOT, mod.runner || '');
  if (!mod.runner || !fs.existsSync(runnerPath)) {
    v.push(id + ': rule 6 -- runner does not resolve to an existing file: ' + mod.runner);
    return v;
  }
  // Rule 7: require(runner) + check is a function.
  let runner;
  try {
    runner = require(runnerPath);
  } catch (e) {
    v.push(id + ': rule 7 -- require(runner) threw: ' + (e && e.message));
    return v;
  }
  if (typeof runner.check !== 'function') {
    v.push(id + ': rule 7 -- runner exports no check() function');
    return v;
  }
  // Rule 8: two-way fix declaration parity.
  if (mod.fix_supported === true && typeof runner.fix !== 'function') {
    v.push(id + ': rule 8 -- fix_supported:true but runner exports no fix() function');
  }
  if (mod.fix_supported === false && typeof runner.fix !== 'undefined') {
    v.push(id + ': rule 8 -- fix_supported:false but runner DOES export fix() (undeclared remediation)');
  }
  // Rule 9: invoke check() -> no throw, status vocab, non-empty detail.
  // NOTE: a check may read real machine state (e.g. plugin-enabled reads
  // ~/.claude/settings.json; card-fire-health reads ~/.mindrian). We assert
  // vocabulary + detail ONLY, never a specific ok/warn outcome, so the gate
  // stays machine-independent.
  let result;
  try {
    result = runner.check({ home: freshHome(), running: '99.99.99', dryRun: true, fix: false, flags: {} });
  } catch (e) {
    v.push(id + ': rule 9 -- check() threw: ' + (e && e.message));
    return v;
  }
  if (!result || typeof result !== 'object') {
    v.push(id + ': rule 9 -- check() did not return an object');
    return v;
  }
  if (!STATUS_VOCAB.has(result.status)) {
    v.push(id + ': rule 9 -- check() status not in ok|warn|error|skip: ' + result.status);
  }
  if (typeof result.detail !== 'string' || result.detail.length === 0) {
    v.push(id + ': rule 9 -- check() detail must be a non-empty string');
  }
  if ('action_lines' in result
      && !(Array.isArray(result.action_lines) && result.action_lines.every((s) => typeof s === 'string'))) {
    v.push(id + ': rule 9 -- action_lines, when present, must be an array of strings');
  }
  return v;
}

// ---------------------------------------------------------------------------
// Negative self-test: prove the gate BITES (D-03 acceptance). An in-memory bad
// entry missing fix_supported MUST report a violation; a fully-malformed entry
// MUST report multiple. If the gate ever stops biting, this fails first.
// ---------------------------------------------------------------------------
(function negative_self_test() {
  const missingFix = { id: 'bad-entry', introduced_version: '1.0.0', cadence: 'always', flag: null /* fix_supported MISSING */ };
  const v1 = checkModuleDeclaration(missingFix, new Set());
  assert.ok(v1.some((m) => /rule 5/.test(m)), 'gate reports a rule-5 violation for a module missing fix_supported');

  const fullyBad = { id: 'Bad_ID', introduced_version: 'not-semver', cadence: 'sometimes', flag: 5, fix_supported: 'yes' };
  const v2 = checkModuleDeclaration(fullyBad, new Set());
  assert.ok(v2.length >= 4, 'gate reports >= 4 violations for a fully-malformed entry (got ' + v2.length + ')');

  const dup = { id: 'umbilical', introduced_version: '1.0.0', cadence: 'once', flag: null, fix_supported: false };
  const seen = new Set(['umbilical']);
  const v3 = checkModuleDeclaration(dup, seen);
  assert.ok(v3.some((m) => /duplicate/.test(m)), 'gate reports a duplicate-id violation');

  ok('negative self-test: the D-03 gate bites on declaration gaps (missing fix_supported, bad id/semver/cadence/flag, dup id)');
})();

// ---------------------------------------------------------------------------
// The real gate over data/doctor-modules.json.
// ---------------------------------------------------------------------------
const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
const modules = Array.isArray(registry.modules) ? registry.modules : [];
assert.ok(modules.length >= 1, 'registry has at least one module');

const violations = [];
const seenIds = new Set();
for (const mod of modules) {
  const decl = checkModuleDeclaration(mod, seenIds);
  if (mod && typeof mod.id === 'string') seenIds.add(mod.id);
  violations.push(...decl);
  // Runner rules only when the declaration passed (an id + a shot at a runner);
  // otherwise the enumerated declaration violations are the actionable signal.
  if (decl.length === 0) {
    violations.push(...checkModuleRunner(mod));
  }
}

if (violations.length > 0) {
  console.error('\nD-03 CONTRACT VIOLATIONS (' + violations.length + '):');
  for (const m of violations) console.error('  FAIL - ' + m);
  console.error('\nFAIL: data/doctor-modules.json has declaration/contract gaps (D-03 hard block).');
  process.exit(1);
}
ok('all ' + modules.length + ' registry module(s) pass the 9-rule D-03 contract');

console.log('\nALL PASS (' + passed + ' assertions)');
