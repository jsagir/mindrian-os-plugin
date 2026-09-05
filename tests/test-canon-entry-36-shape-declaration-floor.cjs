'use strict';
/*
 * Phase 190-05 - the Appendix D entry 36 BORN-DECLARED-SHAPE FLOOR test (Canon
 * Part 11 R16; navigator-APPROVED 2026-07-02, the one true human gate of Phase 190).
 *
 * The canonical FLOOR test for entry 36. Mirrors tests/test-canon-entry-31-two-gauge-floor.cjs's
 * FLOOR idiom: read docs/MINDRIAN-CANON.md, SLICE by `## Part 11` / `## Appendix D`
 * headers so R16-in-Part-11 vs entry-36-in-Appendix-D placement is PROVABLE,
 * whitespace-collapse for prose matches across line breaks, assert membership in
 * BOTH parts + the skills fold-in + the full prior FLOOR (entries 1-35) preserved +
 * the version bump + the frozen scalars unchanged. NEVER asserts a raw count of
 * Appendix D entries (no `.length`, no `.size`) so a future entry 37 never
 * false-fails this floor, and NEVER asserts a hardcoded surface-count scalar --
 * instead it asserts the ratified text FRAMES the count as enumerated-from-disk,
 * an illustrative snapshot, never a canon-frozen constant (threat T-190-05-04).
 *
 *   Test 1 (R16 present in Part 11): the Part 11 slice carries the "R16" born-declared-shape
 *           rule naming ALL FOUR surface classes -- command, agent, pipeline, AND skill.
 *   Test 2 (R16 shape mandate): the Part 11 slice names the declaration fields
 *           (hitl_shape / hitl_stages) and the connector.excluded skill exemption.
 *   Test 3 (closed-set move): the "R1-R16" closed-set reference is present (R1-R15 -> R1-R16).
 *   Test 4 (entry 36 present): Appendix D entry 36 heading is present and its body
 *           names "hitl_shape", "R16", and the skills fold-in.
 *   Test 5 (the count is NOT a frozen scalar): the entry-36 body frames the surface
 *           count as enumerated-from-disk / an illustrative snapshot, NOT a
 *           canon-frozen constant (threat T-190-05-04).
 *   Test 6 (full prior FLOOR preserved): loop n = 1..35 over the `## Appendix D`
 *           SLICE ONLY and assert each prior entry heading is still present per-number
 *           (per-number presence, NOT sequential ordering -- entries 17/18 are
 *           intentionally out of numeric order).
 *   Test 7 (frozen scalars unchanged): MAX_K=3, DIAL_REACH_K=6, and the 0.70/0.15
 *           gate are byte-present in the canon (R16 mints no scalar).
 *   Test 8 (version bump): header /^Version: 1\.26$/m AND footer
 *           /_Mindrian Canon v1\.26 - MindrianOS Plugin_/ (anchor moved 1.25 -> 1.26 by
 *           Phase 340 Wave B's Appendix D entry 39, the graph/room-substrate amendment).
 *   Test 9 (map row, light): docs/CANON-PHASE-MAP.md carries a "v1.26" token AND an
 *           "entry 36" / "R16" reference AND flips Phase 190 to shipped.
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
// match is provably INSIDE that section (not a member leaking in from elsewhere).
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

const part11 = sliceByHeader(canon, /^## Part 11 /);
const appendixD = sliceByHeader(canon, /^## Appendix D/);
ok('Part 11 slice is non-empty', part11.length > 0);
ok('Appendix D slice is non-empty', appendixD.length > 0);

const part11Flat = collapse(part11);
const appendixDFlat = collapse(appendixD);

// Isolate the entry-36 body so its assertions cannot false-pass against another entry.
function sliceEntry(flatAppendix, n) {
  const startRe = new RegExp('(^|\\s)' + n + '\\.\\s+\\*\\*');
  const m = startRe.exec(flatAppendix);
  if (!m) return '';
  const startIdx = m.index + m[0].indexOf(n + '.');
  const nextRe = new RegExp('\\s' + (n + 1) + '\\.\\s+\\*\\*');
  const nm = nextRe.exec(flatAppendix.slice(startIdx + 1));
  const endIdx = nm ? startIdx + 1 + nm.index : flatAppendix.length;
  return flatAppendix.slice(startIdx, endIdx);
}
const entry36 = sliceEntry(appendixDFlat, 36);

// ---------------------------------------------------------------------------
// Test 1: R16 present in Part 11 naming all four surface classes.
// ---------------------------------------------------------------------------
ok('Part 11 carries the R16 born-declared-shape rule', /\*\*R16\*\*/.test(part11) || /R16/.test(part11));
ok('R16 names the command surface class', /command/.test(part11Flat));
ok('R16 names the agent surface class', /agent/.test(part11Flat));
ok('R16 names the pipeline surface class', /pipeline/.test(part11Flat));
ok('R16 names the skill surface class alongside commands/agents/pipelines',
  /R16[\s\S]*skill/.test(part11Flat) && /skill that reaches a genuine Decision-Gate fork/.test(part11Flat));

// ---------------------------------------------------------------------------
// Test 2: R16 names the declaration fields + the connector.excluded skill exemption.
// ---------------------------------------------------------------------------
ok('R16 names the hitl_shape declaration field', /hitl_shape/.test(part11Flat));
ok('R16 names the hitl_stages declaration field', /hitl_stages/.test(part11Flat));
ok('R16 names the connector.excluded skill exemption',
  /connector\.excluded/.test(part11Flat));
ok('R16 names the enforcing gate scripts/check-shape-declaration.cjs',
  /check-shape-declaration\.cjs/.test(part11Flat));

// ---------------------------------------------------------------------------
// Test 3: the closed-set move R1-R15 -> R1-R16 (R16 is in the closed ruling set).
// ---------------------------------------------------------------------------
ok('the closed CIRS ruling set now references R1-R16',
  /R1-R16/.test(part11Flat) || /R1-R16/.test(collapse(canon)));

// ---------------------------------------------------------------------------
// Test 4: Appendix D entry 36 is present and names hitl_shape + R16 + the skills fold-in.
// ---------------------------------------------------------------------------
ok('Appendix D entry 36 heading is present', /^36\.\s+\*\*/m.test(appendixD));
ok('entry 36 body names R16', /R16/.test(entry36));
ok('entry 36 body names hitl_shape', /hitl_shape/.test(entry36));
ok('entry 36 body names the skills fold-in', /skills fold-in/.test(entry36) && /skill/.test(entry36));

// ---------------------------------------------------------------------------
// Test 5: the surface count is framed as enumerated-from-disk, NOT a frozen scalar
// (threat T-190-05-04: the count must never be canonized as a constant).
// ---------------------------------------------------------------------------
ok('entry 36 frames the count as enumerated-from-disk',
  /enumerated from disk/.test(entry36));
ok('entry 36 marks the count as an illustrative snapshot, not a canon-frozen constant',
  /NOT a canon-frozen constant/.test(entry36) || /not a canon-frozen constant/.test(entry36));
ok('R16 itself states the count is NEVER a frozen scalar',
  /NEVER a frozen scalar/.test(part11Flat));

// ---------------------------------------------------------------------------
// Test 6: the full prior FLOOR (entries 1-35) is preserved, asserted against the
// `## Appendix D` SLICE ONLY. Per-number presence, NOT ordering.
// ---------------------------------------------------------------------------
for (let n = 1; n <= 35; n++) {
  const re = new RegExp('^' + n + '\\.\\s', 'm');
  ok('prior Appendix D entry ' + n + ' is still present in the Appendix D slice', re.test(appendixD));
}

// ---------------------------------------------------------------------------
// Test 7: the frozen Part 3 scalars are unchanged (R16 mints no scalar).
// ---------------------------------------------------------------------------
ok('frozen scalar MAX_K=3 is byte-present', /MAX_K=3/.test(canon));
ok('frozen scalar DIAL_REACH_K=6 is byte-present', /DIAL_REACH_K=6/.test(canon));
ok('the frozen 0.70/0.15 gate is byte-present', /0\.70\/0\.15/.test(canon));
ok('R16 restates the frozen scalars UNCHANGED',
  /MAX_K=3/.test(part11Flat) && /DIAL_REACH_K=6/.test(part11Flat) && /UNCHANGED by R16/.test(part11Flat));

// ---------------------------------------------------------------------------
// Test 8: the header + footer version bump to 1.26 (anchor moved by Phase 340 Wave B entry 39).
// ---------------------------------------------------------------------------
ok('header carries Version: 1.26', /^Version: 1\.26$/m.test(canon));
ok('footer carries Mindrian Canon v1.26', /_Mindrian Canon v1\.26 - MindrianOS Plugin_/.test(canon));

// ---------------------------------------------------------------------------
// Test 9: the CANON-PHASE-MAP carries a v1.26 token + an entry-36 / R16 ref + shipped.
// ---------------------------------------------------------------------------
ok('CANON-PHASE-MAP carries a "v1.26" token', /v1\.26/.test(map));
ok('CANON-PHASE-MAP references entry 36 / R16',
  /entry 36/.test(map) && /R16/.test(map));
ok('CANON-PHASE-MAP flips Phase 190 shape-f-declaration-mandate to shipped',
  /shipped \| Phase 190 shape-f-declaration-mandate/.test(map));

console.log('');
console.log('PASS ' + pass + ' assertions');
console.log('>>> test-canon-entry-36-shape-declaration-floor.cjs: PASSED');
