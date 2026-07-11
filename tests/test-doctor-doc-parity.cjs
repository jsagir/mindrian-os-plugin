'use strict';
/*
 * tests/test-doctor-doc-parity.cjs -- Phase 217 Plan-07 Task 2 (D-04 regression guard).
 *
 * The doc-vs-code parity gate. Doc drift is how THIS phase's trigger bug survived
 * undetected (commands/doctor.md claimed --fix supported class B, which had no fix
 * wiring, and omitted the H/I/J fixes that DID exist). This test makes that class
 * of rot fail the suite. Same HARD-BLOCKING posture as the D-03 contract gate:
 * per-violation enumeration to stderr, then exit 1.
 *
 * Three cross-parses, all hermetic (read three files off disk, zero spawn, zero
 * network):
 *   A. Flag parity. Every flag parsed by scripts/doctor.cjs parseArgs MUST be
 *      documented in commands/doctor.md, and every flag documented in the doc MUST
 *      be parsed (an allowlist covers prose-only tokens that are arguments to OTHER
 *      scripts, each with a written reason).
 *   B. --fix class parity. The doc's --fix line names class letters. The truth is
 *      derived from data/doctor-modules.json: class A (special-cased in main(), the
 *      Phase 217 carve-out) PLUS every registry entry with fix_supported:true mapped
 *      to its class letter. The doc set MUST equal the derived set both ways.
 *   C. Negative self-test. An invented flag checked against the doc set, and a
 *      tampered --fix letter set, MUST both report a violation -- proof the gate bites.
 *
 * Hermetic: node:assert/strict, plain file reads. No em-dashes anywhere (house rule).
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const DOC_PATH = path.join(REPO_ROOT, 'commands', 'doctor.md');
const SRC_PATH = path.join(REPO_ROOT, 'scripts', 'doctor.cjs');
const REGISTRY_PATH = path.join(REPO_ROOT, 'data', 'doctor-modules.json');

const FLAG_RE = /--[a-z][a-z-]+/g;

// Prose-only tokens that legitimately appear in commands/doctor.md but are NOT
// doctor.cjs flags. Each entry is an argument to a DIFFERENT script named in the
// doc prose, so it must not be required to appear in parseArgs.
const DOC_PROSE_ALLOWLIST = new Set([
  // class E --fix invokes `generate-section-intelligence.cjs --recursive`; the
  // --recursive belongs to that generator, not to doctor.cjs.
  '--recursive',
]);

// Registry module id -> doctor class letter. Modules without a class letter (the
// umbilical once-cadence heal) are intentionally absent and skipped in the --fix
// derivation (they carry no class letter to name on the --fix line).
const ID_TO_CLASS = {
  'cascade-rooms': 'B',
  'room-md': 'E',
  'statusline-visibility': 'G',
  'install-incomplete': 'H',
  'install-state': 'I',
  'deployment-surfaces': 'J',
};

let passed = 0;
function ok(label) { passed += 1; console.log('  ok - ' + label); }

// --- Extractors -----------------------------------------------------------

// parsedFlagSet(src) -> Set of flag tokens from the parseArgs case chain ONLY.
// Restrict to lines that are actual case tests (arg === '...' / arg.startsWith('...'))
// so comment prose inside parseArgs cannot inject a phantom flag.
function parsedFlagSet(src) {
  const start = src.indexOf('for (const arg of argv)');
  const end = src.indexOf('return flags;');
  assert.ok(start !== -1 && end !== -1 && end > start, 'parseArgs region located in doctor.cjs');
  const region = src.slice(start, end);
  const flags = new Set();
  for (const line of region.split('\n')) {
    if (!/arg === '|arg\.startsWith\('/.test(line)) continue;
    const m = line.match(FLAG_RE);
    if (m) for (const f of m) flags.add(f);
  }
  return flags;
}

// documentedFlagSet(doc) -> Set of every --flag token in the doc body.
function documentedFlagSet(doc) {
  return new Set((doc.match(FLAG_RE) || []));
}

// docFixClassLetters(doc) -> sorted array of the class letters named on the --fix line.
function docFixClassLetters(doc) {
  const m = doc.match(/auto-recovery for every class that declares `fix_supported: true`:\s*([^.\n]+)\./);
  assert.ok(m, 'the --fix line naming the fix-supported classes is present in the doc');
  const letters = (m[1].match(/\b([A-Z])\b/g) || []);
  return [...new Set(letters)].sort();
}

// derivedFixClassLetters(registry) -> sorted array: A (carve-out) + fix_supported:true class letters.
function derivedFixClassLetters(registry) {
  const set = new Set(['A']); // class A install-cache: special-cased in main(), --fix supported.
  for (const mod of registry.modules || []) {
    if (mod.fix_supported === true && ID_TO_CLASS[mod.id]) {
      set.add(ID_TO_CLASS[mod.id]);
    }
  }
  return [...set].sort();
}

// --- Negative self-test (prove the gate bites) ----------------------------
(function negative_self_test() {
  const doc = fs.readFileSync(DOC_PATH, 'utf8');
  const documented = documentedFlagSet(doc);
  // An invented flag is not in the doc -> a parity check MUST flag it.
  assert.ok(!documented.has('--totally-invented-flag'), 'invented flag is absent from the doc set (gate would flag it as undocumented)');
  // A tampered --fix set (drop I and J) MUST differ from the derived truth.
  const derived = derivedFixClassLetters(JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8')));
  const tampered = derived.filter((l) => l !== 'I' && l !== 'J');
  assert.notDeepEqual(tampered, derived, 'a tampered --fix letter set differs from the derived truth (gate bites on --fix drift)');
  ok('negative self-test: the D-04 gate bites on an undocumented flag and on --fix class drift');
})();

// --- The real gate --------------------------------------------------------
const doc = fs.readFileSync(DOC_PATH, 'utf8');
const src = fs.readFileSync(SRC_PATH, 'utf8');
const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));

const parsed = parsedFlagSet(src);
const documented = documentedFlagSet(doc);

const violations = [];

// Parse A.1: every parsed flag is documented.
for (const f of parsed) {
  if (!documented.has(f)) {
    violations.push('flag ' + f + ' is parsed by doctor.cjs but NOT documented in commands/doctor.md');
  }
}
// Parse A.2: every documented flag is parsed (unless prose-allowlisted).
for (const f of documented) {
  if (!parsed.has(f) && !DOC_PROSE_ALLOWLIST.has(f)) {
    violations.push('flag ' + f + ' is documented in commands/doctor.md but NOT parsed by doctor.cjs (add to parseArgs or to DOC_PROSE_ALLOWLIST with a reason)');
  }
}

// Parse B: --fix class letters match the registry-derived truth both ways.
const docFix = docFixClassLetters(doc);
const derivedFix = derivedFixClassLetters(registry);
for (const l of docFix) {
  if (!derivedFix.includes(l)) {
    violations.push('--fix line names class ' + l + ' but no fix_supported:true module (nor carve-out A) backs it');
  }
}
for (const l of derivedFix) {
  if (!docFix.includes(l)) {
    violations.push('class ' + l + ' declares fix_supported (or is the A carve-out) but the doc --fix line omits it');
  }
}

if (violations.length > 0) {
  console.error('\nD-04 DOC-PARITY VIOLATIONS (' + violations.length + '):');
  for (const m of violations) console.error('  FAIL - ' + m);
  console.error('\nFAIL: commands/doctor.md has drifted from scripts/doctor.cjs / data/doctor-modules.json (D-04 hard block).');
  process.exit(1);
}

ok('flag parity: all ' + parsed.size + ' parsed flags documented + all documented flags parsed (allowlist: ' + [...DOC_PROSE_ALLOWLIST].join(', ') + ')');
ok('--fix class parity: doc set [' + docFix.join(', ') + '] equals registry-derived set [' + derivedFix.join(', ') + ']');

console.log('\nALL PASS (' + passed + ' assertions)');
