'use strict';
/*
 * Phase 178-04 - the CIRS R15 (Render Coverage) FLOOR test (Task 1, Canon Part 11
 * R15 amendment, navigator-LOCKED 2026-06-24, Option A).
 *
 * The canonical FLOOR test for the render-plane born-wired rule R15. Mirrors the
 * frozen-set FLOOR idiom of tests/test-cirs-four-class-floor.cjs (entry 26) and the
 * edge-vocabulary floor tests (entries 18/21/22/23): membership + the full prior
 * FLOOR preserved + frozen-set + a reachable-undeclared-surface NEGATIVE the gate
 * rejects. NEVER asserts a `.size` / total rule count (so a future ADDITIVE CIRS
 * rule never false-fails this floor).
 *
 *   Test 1: R15 is a MEMBER of the closed CIRS ruling set. R15 is canon-text only
 *           (it mints no enum/constant in code -- the gate IS the implementation,
 *           not a rule enum), so membership is asserted against the canon text:
 *           the **R15** Render coverage rule body is present in Part 11's closed
 *           ruling set, named as the render-plane peer of R2 + R9, distinct from R3.
 *   Test 2: the FULL prior FLOOR R1-R14 is PRESERVED (every prior rule still a
 *           member of the closed ruling set; the additive move did not drop any).
 *   Test 3: the closed-set BOUND is enumerated as "R1-R15" (the frozen-set move
 *           R1-R14 -> R1-R15 landed) and the stale "R1-R14" bound is gone from the
 *           enumerating references; the header/footer carry Version 1.16.
 *   Test 4: the render gate's covered/excluded/gap counting contract is BYTE-STABLE
 *           (a class-blind recount of the registry entries equals the reported
 *           counts; the XOR partition holds). NEVER asserts a `.size` total.
 *   Test 5: the NEGATIVE -- a reachable-undeclared (card-emission, unrouted) surface
 *           is REJECTED by the gate (renderCoverageReport counts it a gap + names it
 *           an error), exercised on a SYNTHESIZED fixture registry via the test-only
 *           RENDER_COVERAGE_REGISTRY override, never the tracked live registry.
 *
 * House rule: hyphens only, no em-dashes. Canon Part 8: zero Brain / network.
 */

const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const REPO_ROOT = path.resolve(__dirname, '..');
const CANON_PATH = path.join(REPO_ROOT, 'docs', 'MINDRIAN-CANON.md');
const REGISTRY_PATH = path.join(REPO_ROOT, 'data', 'render-coverage-registry.json');

let pass = 0;
function ok(name, cond) { assert.ok(cond, name); console.log('  ok - ' + name); pass++; }

const canon = fs.readFileSync(CANON_PATH, 'utf8');

// ---------------------------------------------------------------------------
// Test 1: R15 is a MEMBER of the closed CIRS ruling set (canon-text membership).
// ---------------------------------------------------------------------------
ok('Part 11 declares an **R15** Render coverage rule', /-\s+\*\*R15\*\*\s+Render coverage/.test(canon));
// The R15 rule body wraps across lines in the canon; collapse whitespace so the
// membership assertions match the prose regardless of line breaks.
const canonFlat = canon.replace(/\s+/g, ' ');
ok('R15 is named the render-plane peer of R2 (born-wired) + R9',
  /R15 is the render-plane peer of R2 \(born-wired\) \+ R9/.test(canonFlat));
ok('R15 is stated DISTINCT from R3 (the trigger wire)',
  /distinct from R3'?s trigger wire/.test(canonFlat));
ok('R15 names the build failing CLOSED (hard-FAIL) on an undeclared reachable gate surface',
  /fails the build CLOSED \(hard-FAIL, nonzero exit\) on a reachable gate surface that declares neither/.test(canonFlat));
ok('R15 names the implementing gate scripts/check-render-coverage.cjs',
  /scripts\/check-render-coverage\.cjs/.test(canon));

// ---------------------------------------------------------------------------
// Test 2: the FULL prior FLOOR R1-R14 is PRESERVED (no prior rule dropped).
// Membership is asserted by the **Rn** rule-heading idiom for every prior rule.
// ---------------------------------------------------------------------------
for (let n = 1; n <= 14; n++) {
  const re = new RegExp('-\\s+\\*\\*R' + n + '\\*\\*\\s+');
  ok('prior CIRS rule R' + n + ' is still a member of the closed ruling set', re.test(canon));
}

// ---------------------------------------------------------------------------
// Test 3: the closed-set BOUND moved R1-R14 -> R1-R15; Version is 1.16.
// ---------------------------------------------------------------------------
ok('the closed-set bound is enumerated as "R1-R15" (the frozen-set move landed)',
  /MUST satisfy R1-R15/.test(canonFlat));
ok('the stale "MUST satisfy R1-R14" bound is gone', !/MUST satisfy R1-R14/.test(canonFlat));
ok('header carries Version: 1.16', /^Version: 1\.16$/m.test(canon));
ok('footer carries Mindrian Canon v1.16', /_Mindrian Canon v1\.16 - MindrianOS Plugin_/.test(canon));
ok('Appendix D entry 27 (Part 11 R15) is present',
  /^27\.\s+\*\*Part 11 R15 \(Render Coverage\) minted/m.test(canon));

// ---------------------------------------------------------------------------
// Test 4: the render gate's covered/excluded/gap counting contract is BYTE-STABLE.
// Recompute class-blind from the registry entries and assert byte-equality with the
// gate's reported counts. NEVER asserts a `.size` total. The render predicate is the
// counting contract the FLOOR pins (the SEED-020 card-emission routing predicate).
// ---------------------------------------------------------------------------
const gate = require(path.join(REPO_ROOT, 'scripts', 'check-render-coverage.cjs'));
const reg = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
const report = gate.renderCoverageReport();

ok('the gate report exposes covered/excluded/gap counts',
  report && report.counts &&
  typeof report.counts.covered === 'number' &&
  typeof report.counts.excluded === 'number' &&
  typeof report.counts.gap === 'number');

// Class-blind recount: re-evaluate the pinned predicate over the registry entries
// independent of the gate's tally, then assert byte-equality.
const registryEntries = Array.isArray(reg.entries) ? reg.entries : [];
const recount = { covered: 0, excluded: 0, gap: 0 };
for (const e of registryEntries) {
  if (e.render_coverage === 'render-only-excluded') {
    if (typeof e.reason === 'string' && e.reason.trim().length > 0) recount.excluded += 1;
    else recount.gap += 1;
    continue;
  }
  if (gate.routesThroughCardEmissionDoor(e)) recount.covered += 1;
  else recount.gap += 1;
}
ok('recount covered === report covered (byte-stable)', recount.covered === report.counts.covered);
ok('recount excluded === report excluded (byte-stable)', recount.excluded === report.counts.excluded);
ok('recount gap === report gap (byte-stable)', recount.gap === report.counts.gap);
ok('entries.length === covered + excluded + gap (the XOR partition holds)',
  report.entries.length === (report.counts.covered + report.counts.excluded + report.counts.gap));
ok('the live render baseline is gap=0 (every reachable gate surface declares its routing)',
  report.counts.gap === 0);

// ---------------------------------------------------------------------------
// Test 5: the NEGATIVE -- a reachable-undeclared (card-emission, unrouted) surface
// is REJECTED by the gate. Synthesize a fixture registry with a dark entry (a
// card-emission entry whose file routes through NEITHER pickShape NOR
// appendAskUserQuestionTrailer NOR the renderDial host-append), point the gate at it
// via the test-only RENDER_COVERAGE_REGISTRY override, and assert it counts a gap +
// names the error. The tracked live registry is NEVER mutated.
// ---------------------------------------------------------------------------
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'r15-floor-'));
const fixturePath = path.join(tmpDir, 'render-coverage-registry.fixture.json');
const fixture = {
  generated_note: 'TEST FIXTURE - synthesized dark render entry for the R15 FLOOR negative',
  entries: [
    {
      // A reachable gate surface (card-emission) whose entry file (this test file
      // itself) routes through NONE of the card-emission doors -> a render GAP.
      entry: 'tests/test-cirs-render-coverage-floor.cjs',
      kind: 'pickShape',
      render_coverage: 'card-emission',
      shape: 'F.1',
    },
  ],
};
fs.writeFileSync(fixturePath, JSON.stringify(fixture, null, 2));

const prevOverride = process.env.RENDER_COVERAGE_REGISTRY;
process.env.RENDER_COVERAGE_REGISTRY = fixturePath;
let negReport;
try {
  // Re-require with a fresh module cache so resolveRegistryPath re-reads the env.
  // The gate reads the override at call time, so a fresh require is not strictly
  // required, but renderCoverageReport() re-resolves the path on each call.
  negReport = gate.renderCoverageReport();
} finally {
  if (prevOverride === undefined) delete process.env.RENDER_COVERAGE_REGISTRY;
  else process.env.RENDER_COVERAGE_REGISTRY = prevOverride;
}

ok('a reachable-undeclared (card-emission, unrouted) surface is counted a GAP',
  negReport.counts.gap === 1 && negReport.counts.covered === 0 && negReport.counts.excluded === 0);
ok('the gate NAMES the undeclared surface as a render-gap error',
  negReport.errors.length >= 1 &&
  negReport.errors.some(function (m) { return /RENDER GAP/.test(m) && /test-cirs-render-coverage-floor\.cjs/.test(m); }));

// Restore env was already done; clean the fixture temp dir.
try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_e) { /* best-effort */ }

// Confirm the override is cleared so the live gate is byte-stable post-test.
const afterReport = gate.renderCoverageReport();
ok('the live gate is byte-stable after the negative (override cleared, gap=0 again)',
  afterReport.counts.gap === 0 && afterReport.counts.covered === report.counts.covered);

console.log('');
console.log('PASS ' + pass + ' assertions');
console.log('>>> test-cirs-render-coverage-floor.cjs: PASSED');
