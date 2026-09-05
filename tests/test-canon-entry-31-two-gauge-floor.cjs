'use strict';
/*
 * Phase 180-01 - the Appendix D entry 31 WELDED TWO-GAUGE FLOOR test (Task 1, the
 * RED pin; Canon Part 5 + Part 10 two-gauge amendment, navigator-LOCKED 2026-06-27,
 * the v1.15.0 GA "Cure Under-Invocation" governing act).
 *
 * The canonical FLOOR test for entry 31. Mirrors the canon-text FLOOR idiom of
 * tests/test-cirs-render-coverage-floor.cjs (entry 27) and the four-class floor
 * (entry 26): read docs/MINDRIAN-CANON.md, SLICE by `## Part N` / `## Appendix D`
 * headers so Part-5-vs-Part-10 placement is PROVABLE, whitespace-collapse for prose
 * matches across line breaks, assert membership + the welded pair in BOTH parts +
 * the self-binding clause + the full prior FLOOR (entries 1-30) preserved + the
 * version bump. NEVER asserts a raw count of Appendix D entries (no `.length === 31`,
 * no `.size`) so a future entry 32 never false-fails this floor.
 *
 *   Test 1 (entry present): Appendix D entry 31 heading is present (the line-start
 *           "31." bold heading) and its body names the two-gauge instrument.
 *   Test 2 (welded pair in BOTH parts): the Part 5 slice AND the Part 10 slice EACH
 *           carry the welded two-gauge tokens (whitespace-collapsed): "two-gauge";
 *           "Gauge 1" + "invocation density must RISE"; "Gauge 2" +
 *           "transfer-per-invocation must HOLD or CLIMB"; "reported TOGETHER";
 *           "never as one number". Asserting in both slices proves the instrument
 *           was written INTO Part 5 + Part 10, not only into Appendix D.
 *   Test 3 (welded, not a clause): "un-reportable without the transfer denominator"
 *           (D-180-01 structural weld).
 *   Test 4 (two-directional guard): both regressions named -- "volume-up-quality-flat"
 *           (Dealer) AND a quality-up-by-(starving|suppressing)-volume phrasing
 *           (D-180-02). The synonym is accepted EITHER way (W1 hardening): the canon
 *           authors ONE term, the test is not brittle to which.
 *   Test 5 (retire Hooked, keep Matrix): a "Hooked" gate "retired" statement AND the
 *           kept "Manipulation Matrix".
 *   Test 6 (self-binding clause): "entry 32" within a sentence containing "live
 *           navigator on the gate".
 *   Test 7 (Part 8 local): the two-gauge canon text carries a "LOCAL telemetry"
 *           marker (the metric is LOCAL; adoption aggregate-only).
 *   Test 8 (full prior FLOOR preserved): loop n = 1..30 over the `## Appendix D`
 *           SLICE ONLY (W2 hardening -- so low-numbered entries cannot false-pass
 *           against Part 3's 10-verb list / Part 9's 5 roles / Part 12's 6 moves) and
 *           assert each prior entry heading is still present per-number. (Entries
 *           17 and 18 are intentionally out of numeric order; assert per-number
 *           presence, NOT sequential ordering.)
 *   Test 9 (version bump): header /^Version: 1\.26$/m AND footer
 *           /_Mindrian Canon v1\.27 - MindrianOS Plugin_/. (Canon moved 1.26 -> 1.27
 *           at the Phase 340 Wave C corpus-figures amendment, Appendix D
 *           entry 40; entry 31's invariants are unchanged, only the version anchor tracks
 *           the current canon.)
 *   Test 10 (map row, light): docs/CANON-PHASE-MAP.md carries a "v1.21" token AND an
 *           "entry 31" / "two-gauge" reference.
 *
 * House rule: hyphens only, no em-dashes. Canon Part 8: zero Brain / network.
 */

const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');

const REPO_ROOT = path.resolve(__dirname, '..');
const CANON_PATH = path.join(REPO_ROOT, 'docs', 'MINDRIAN-CANON.md');
const MAP_PATH = path.join(REPO_ROOT, 'docs', 'CANON-PHASE-MAP.md');

let pass = 0;
function ok(name, cond) { assert.ok(cond, name); console.log('  ok - ' + name); pass++; }

const canon = fs.readFileSync(CANON_PATH, 'utf8');
const map = fs.readFileSync(MAP_PATH, 'utf8');

// Slice the canon body between a section header and the NEXT `## ` header, so a
// match is provably INSIDE that section (not a low-numbered entry leaking in from
// elsewhere in the document).
function sliceByHeader(text, headerRe) {
  const lines = text.split('\n');
  let start = -1;
  for (let i = 0; i < lines.length; i++) { if (headerRe.test(lines[i])) { start = i; break; } }
  if (start === -1) return '';
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) { if (/^## /.test(lines[i])) { end = i; break; } }
  return lines.slice(start, end).join('\n');
}
const collapse = (s) => s.replace(/\s+/g, ' ');

const part5 = sliceByHeader(canon, /^## Part 5 /);
const part10 = sliceByHeader(canon, /^## Part 10 /);
const appendixD = sliceByHeader(canon, /^## Appendix D/);
ok('Part 5 slice is non-empty', part5.length > 0);
ok('Part 10 slice is non-empty', part10.length > 0);
ok('Appendix D slice is non-empty', appendixD.length > 0);

const part5Flat = collapse(part5);
const part10Flat = collapse(part10);
const canonFlat = collapse(canon);

// ---------------------------------------------------------------------------
// Test 1: Appendix D entry 31 is present and names the two-gauge instrument.
// ---------------------------------------------------------------------------
ok('Appendix D entry 31 heading is present', /^31\.\s+\*\*/m.test(appendixD));
ok('entry 31 body names the two-gauge instrument', /two-gauge/.test(collapse(appendixD)));

// ---------------------------------------------------------------------------
// Test 2: the welded two-gauge pair is in BOTH Part 5 AND Part 10 (placement proof).
// ---------------------------------------------------------------------------
function assertWeldedPair(label, flat) {
  ok(label + ': carries the "two-gauge" token', /two-gauge/.test(flat));
  ok(label + ': Gauge 1 invocation density must RISE',
    /Gauge 1[^.]*invocation density must RISE/.test(flat));
  ok(label + ': Gauge 2 transfer-per-invocation must HOLD or CLIMB',
    /Gauge 2[^.]*transfer-per-invocation must HOLD or CLIMB/.test(flat));
  ok(label + ': the two are "reported TOGETHER"', /reported TOGETHER/.test(flat));
  ok(label + ': "never as one number"', /never as one number/.test(flat));
}
assertWeldedPair('Part 5', part5Flat);
assertWeldedPair('Part 10', part10Flat);

// ---------------------------------------------------------------------------
// Test 3: the weld is structural, not a separable clause (D-180-01).
// ---------------------------------------------------------------------------
ok('the canon states invocation density is un-reportable without the transfer denominator',
  /un-reportable without the transfer denominator/.test(canonFlat));

// ---------------------------------------------------------------------------
// Test 4: both regressions named (D-180-02 two-directional guard). The
// starving/suppressing synonym is accepted EITHER way (W1 hardening).
// ---------------------------------------------------------------------------
ok('the Hooked Dealer regression "volume-up-quality-flat" is named',
  /volume-up-quality-flat/.test(canonFlat));
ok('the inverse regression quality-up-by-(starving|suppressing)-volume is named',
  /quality-up-by-(starving|suppressing)-volume/.test(canonFlat));

// ---------------------------------------------------------------------------
// Test 5: the Hooked ratification gate is retired; the Manipulation Matrix is kept.
// ---------------------------------------------------------------------------
ok('a Hooked gate "retired" statement is present',
  /Hooked[^.]*retired/.test(canonFlat) || /retired[^.]*Hooked/.test(canonFlat));
ok('the Manipulation Matrix is kept', /Manipulation Matrix/.test(canonFlat));

// ---------------------------------------------------------------------------
// Test 6: the self-binding clause (no entry 32 until a real two-gauge reading).
// ---------------------------------------------------------------------------
ok('the self-binding clause blocks entry 32 until a live navigator reading on the gate',
  /entry 32[^.]*live navigator on the gate/.test(canonFlat));

// ---------------------------------------------------------------------------
// Test 7: the metric is LOCAL telemetry (Part 8 boundary marker).
// ---------------------------------------------------------------------------
ok('the two-gauge canon text carries a "LOCAL telemetry" marker', /LOCAL telemetry/.test(canonFlat));

// ---------------------------------------------------------------------------
// Test 8: the full prior FLOOR (entries 1-30) is preserved, asserted against the
// `## Appendix D` SLICE ONLY (W2 hardening). Per-number presence, NOT ordering.
// ---------------------------------------------------------------------------
for (let n = 1; n <= 30; n++) {
  const re = new RegExp('^' + n + '\\.\\s', 'm');
  ok('prior Appendix D entry ' + n + ' is still present in the Appendix D slice', re.test(appendixD));
}

// ---------------------------------------------------------------------------
// Test 9: the header + footer version (canon at 1.27 after the Phase 340 Wave C corpus-figures amendment; anchor tracks the version forward, entry-31 invariants unchanged).
// ---------------------------------------------------------------------------
ok('header carries Version: 1.27', /^Version: 1\.27$/m.test(canon));
ok('footer carries Mindrian Canon v1.27', /_Mindrian Canon v1\.27 - MindrianOS Plugin_/.test(canon));

// ---------------------------------------------------------------------------
// Test 10: the CANON-PHASE-MAP carries a v1.21 token + an entry-31 / two-gauge ref.
// ---------------------------------------------------------------------------
ok('CANON-PHASE-MAP carries a "v1.21" token', /v1\.21/.test(map));
ok('CANON-PHASE-MAP references entry 31 / two-gauge',
  /entry 31/.test(map) && /two-gauge/.test(map));

console.log('');
console.log('PASS ' + pass + ' assertions');
console.log('>>> test-canon-entry-31-two-gauge-floor.cjs: PASSED');
