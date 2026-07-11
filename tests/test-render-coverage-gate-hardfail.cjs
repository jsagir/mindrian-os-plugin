'use strict';
/*
 * Phase 178-02 Task 2 - the FLOOR/hard-fail adversarial test (C-3 floor).
 *
 * Mirrors tests/test-coverage-gate-hardfail.cjs (the CIRS invocation-side hard-fail
 * test) for the RENDER plane. Proves, BY CONSTRUCTION, that the render-coverage gate
 * FAILS CLOSED on a synthesized undeclared render entry point, while the live repo
 * stays GREEN and a render-only-excluded-with-reason entry is conformant.
 *
 *   Test 1: a SYNTHESIZED dark render entry point (declared card-emission but routing
 *           through NONE of pickShape / appendAskUserQuestionTrailer / renderDial-
 *           F.7-dial) classifies gap, AND --check exits NON-ZERO when that entry is
 *           present (the synthesized registry is fed via the RENDER_COVERAGE_REGISTRY
 *           override; the fixture + temp registry are removed in a finally; NO tracked
 *           file is ever mutated).
 *   Test 2: a SYNTHESIZED render-only-excluded entry WITH a reason classifies excluded
 *           and does NOT trip the gate (--check exits 0).
 *   Test 3: the .cjs render-entry-point axis (this test's own scope) stays gap=0 on
 *           the live tree (the F.7-dial entry is host-appended-covered; there is NO
 *           known live gap on this axis, the F.7-dial slip premise is FALSE on the
 *           live tree). Updated by the intern-w1-mode-gate-skip fix: the combined CLI
 *           --check now also fails on 5 known, pre-existing, OUT-OF-SCOPE skill gaps
 *           (a THIRD, orthogonal keyspace this test does not own) -- isolated via
 *           renderCoverageReport() directly so this test's own axis stays provably
 *           clean regardless of that separate, already-tracked finding.
 *   Test 4: the gate FAIL message names the offending entry + the recovery line.
 *
 * The dark fixture lives under tests/fixtures/render-coverage-gate-dark/ and is NEVER
 * walked by the live generator (lib/ + scripts/ only). The synthesized registries are
 * written to temp paths under tests/fixtures/ and removed in a finally.
 *
 * House rule: hyphens only, no em-dashes. Canon Part 8: zero Brain / network.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const GATE = path.join(REPO_ROOT, 'scripts', 'check-render-coverage.cjs');
const FIXTURE_DIR = path.join(REPO_ROOT, 'tests', 'fixtures', 'render-coverage-gate-dark');
const DARK_ENTRY_REL = 'tests/fixtures/render-coverage-gate-dark/dark-render-entry.cjs';

const gate = require(GATE);

let pass = 0;
function ok(name, cond) { assert.ok(cond, name); console.log('  ok - ' + name); pass++; }

// A minimal but registry-shaped wrapper so the synthesized registries the gate reads
// are structurally identical to data/render-coverage-registry.json.
function wrapRegistry(entries) {
  return {
    generated_note: 'SYNTHESIZED test fixture registry (Phase 178-02 FLOOR test); never committed.',
    dispatcher: { source: 'lib/hmi/selector-dispatcher.cjs', f_subshapes: [], has_dial_branch: true },
    render_counts: {
      card_emission: entries.filter((e) => e.render_coverage === 'card-emission').length,
      render_only_excluded: entries.filter((e) => e.render_coverage === 'render-only-excluded').length,
    },
    entries,
  };
}

function spawnCheckWithRegistry(registryAbs) {
  return cp.spawnSync('node', [GATE, '--check'], {
    encoding: 'utf8',
    timeout: 60000,
    env: Object.assign({}, process.env, { RENDER_COVERAGE_REGISTRY: registryAbs }),
  });
}

// ---------------------------------------------------------------------------
// Preflight: the dark fixture exists and carries NONE of the routing tokens.
// ---------------------------------------------------------------------------
const darkSrc = fs.readFileSync(path.join(REPO_ROOT, DARK_ENTRY_REL), 'utf8');
ok('the dark fixture exists and calls no real pickShape(', !gate.hasCallSite(DARK_ENTRY_REL, 'pickShape'));
ok('the dark fixture calls no real appendAskUserQuestionTrailer(', !gate.hasCallSite(DARK_ENTRY_REL, 'appendAskUserQuestionTrailer'));

// ---------------------------------------------------------------------------
// Test 1 (predicate level): a synthesized dark card-emission entry classifies gap
// (the pinned predicate returns NOT routed -- none of the three branches match).
// ---------------------------------------------------------------------------
const darkEntry = { entry: DARK_ENTRY_REL, kind: 'pickShape', render_coverage: 'card-emission' };
ok('the synthesized dark entry does NOT route through the card-emission door', gate.routesThroughCardEmissionDoor(darkEntry) === false);

// ---------------------------------------------------------------------------
// Test 1 (end-to-end): with the dark entry in the registry, --check exits non-zero.
// Test 4: the FAIL message names the offending entry + the recovery line.
// The synthesized registry is written to a temp path under tests/fixtures/ and
// removed in a finally; NO tracked file is mutated.
// ---------------------------------------------------------------------------
const DARK_REG = path.join(FIXTURE_DIR, '__synth_dark_registry__.json');
let darkRun;
try {
  fs.writeFileSync(DARK_REG, JSON.stringify(wrapRegistry([darkEntry]), null, 2) + '\n');
  darkRun = spawnCheckWithRegistry(DARK_REG);
} finally {
  try { fs.unlinkSync(DARK_REG); } catch (_e) { /* best-effort */ }
}
ok('dark render entry present -> --check exits non-zero (HARD FAIL / fail closed)', darkRun && darkRun.status !== 0);
const stderr1 = (darkRun && darkRun.stderr) || '';
ok('FAIL message names the offending entry', stderr1.indexOf(DARK_ENTRY_REL) !== -1);
ok('FAIL message says RENDER GAP', /RENDER GAP:/.test(stderr1));
ok('FAIL message carries the recovery line', /build-render-coverage\.cjs/.test(stderr1));

// ---------------------------------------------------------------------------
// Test 2: a synthesized render-only-excluded-with-reason entry classifies excluded
// and does NOT trip the gate (--check exits 0).
// ---------------------------------------------------------------------------
const exclEntry = {
  entry: DARK_ENTRY_REL,
  kind: 'pickShape',
  render_coverage: 'render-only-excluded',
  reason: 'synthesized fixture: a render-only surface that never reaches a Decision Gate',
};
const EXCL_REG = path.join(FIXTURE_DIR, '__synth_excluded_registry__.json');
let exclRun;
try {
  fs.writeFileSync(EXCL_REG, JSON.stringify(wrapRegistry([exclEntry]), null, 2) + '\n');
  exclRun = spawnCheckWithRegistry(EXCL_REG);
} finally {
  try { fs.unlinkSync(EXCL_REG); } catch (_e) { /* best-effort */ }
}
ok('render-only-excluded-with-reason entry -> --check exits 0 (conformant, does NOT trip the gate)', exclRun && exclRun.status === 0);
ok('render-only-excluded-with-reason entry prints the OK line', /render-coverage: OK/.test((exclRun && exclRun.stdout) || ''));

// Corroborate at the predicate level: a render-only-excluded entry is not a card-
// emission entry, so it is never asked to route.
const exclReport = (function () {
  // Classify the excluded entry through the same code path the gate uses.
  return gate.routesThroughCardEmissionDoor({ entry: DARK_ENTRY_REL, kind: 'pickShape', render_coverage: 'render-only-excluded' });
})();
ok('the excluded entry would not route as card-emission (it is excluded, not gap)', exclReport === false);

// ---------------------------------------------------------------------------
// Test 3: the .cjs render-entry-point axis (Phase 178, THIS test's own scope)
// stays gap=0 on the live tree (the F.7-dial entry is host-appended-covered;
// no known live gap on THIS axis). Isolated via renderCoverageReport()
// directly (the .cjs-only classifier) rather than shelling out to the full
// CLI, because the intern-w1-mode-gate-skip fix (RCA gap 1) extended the SAME
// --check CLI invocation to ALSO cover a THIRD, orthogonal keyspace
// (skills/*/SKILL.md declared-implies-wired) that carries 5 known,
// pre-existing, out-of-scope gaps (see the debug file Resolution section) --
// asserting "clean live repo --check exits 0" against the COMBINED CLI exit
// code would conflate this test's OWN axis (.cjs entry points, still
// genuinely gap=0) with that unrelated, already-tracked finding.
// ---------------------------------------------------------------------------
const cjsReport = gate.renderCoverageReport();
ok('the .cjs render-entry-point axis stays gap=0 on the live tree (this test\'s own scope, unaffected by the skills keyspace)', cjsReport.counts.gap === 0);
ok('the .cjs render-entry-point axis has zero errors', cjsReport.errors.length === 0);

// The COMBINED CLI --check now correctly exits non-zero because of the 5
// known, tracked skill gaps (a SEPARATE, already-documented finding); confirm
// it fails for exactly that reason and not a NEW .cjs-axis regression.
const combined = cp.spawnSync('node', [GATE, '--check'], { encoding: 'utf8', timeout: 60000 });
ok('the combined CLI --check now exits non-zero (5 known skill gaps; see intern-w1-mode-gate-skip debug file)', combined.status !== 0);
ok('the combined CLI --check failure names a skills/*/SKILL.md surface, not a .cjs entry point', /skills\/.*\/SKILL\.md/.test(combined.stderr || ''));
ok('the combined CLI --check failure does NOT report a RENDER GAP against any .cjs entry (this test\'s own axis is still clean)', !/RENDER GAP: entry (lib|scripts)\//.test(combined.stderr || ''));

// Confirm no temp registry leaked.
ok('synthesized dark registry removed', !fs.existsSync(DARK_REG));
ok('synthesized excluded registry removed', !fs.existsSync(EXCL_REG));

console.log('\nPASS test-render-coverage-gate-hardfail (' + pass + ' assertions)');
console.log('>>> test-render-coverage-gate-hardfail.cjs: PASSED');
