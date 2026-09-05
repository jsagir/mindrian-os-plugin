'use strict';
/*
 * Phase 340-02 - the Appendix D entry 38 SOURCED CLAIMS FLOOR test (Canon Part 12;
 * requirement CANON-01; navigator-APPROVED WITH EDITS 2026-09-05, the blocking
 * Task-1 checkpoint of Plan 02).
 *
 * The canonical FLOOR test for entry 38. Mirrors tests/test-canon-entry-36-shape-declaration-floor.cjs's
 * FLOOR idiom: read docs/MINDRIAN-CANON.md and agents/larry-extended.md, SLICE the
 * canon by `## Part 12` / `## Appendix D` headers so Part-12-vs-Appendix-D
 * placement is PROVABLE, whitespace-collapse for prose matches across line
 * breaks, assert membership in BOTH the constitution and the persona mirror +
 * the full prior FLOOR (entries 1-37) preserved + the version bump + the frozen
 * scalars unchanged. NEVER asserts a raw count of Appendix D entries (no
 * `.length`, no `.size`) so a future entry 39 never false-fails this floor.
 *
 *   Test 1 (Part 12 placement proof): the Part 12 slice carries the subsection
 *           heading `### The Sourced Claims Doctrine (HARD requirement)` and both
 *           anchor strings `sourced or absent` and `A hedge word is not a source.`
 *           INSIDE that slice, not merely somewhere in the file.
 *   Test 2 (Elevation tone unweakened): the Part 12 slice still carries
 *           `hedged, cautious, evidence-backed, NEVER confident` byte-identical,
 *           proving the new doctrine EXTENDED rather than replaced the existing
 *           Elevation tone requirement.
 *   Test 3 (persona mirror proof): `agents/larry-extended.md` carries both anchor
 *           strings `sourced or absent` and `A hedge word is not a source.` - the
 *           assertion that makes the mirror structurally required, not aspirational.
 *   Test 4 (entry 38 body isolation): the Appendix D slice, isolated to entry 38
 *           via `sliceEntry`, carries `CANON-01`, a reference to SEED-086, the
 *           navigator-approval language, and the byte-identical frozen-scalar
 *           restatement `MAX_K=3, DIAL_REACH_K=6, the 0.70/0.15 gate`.
 *   Test 5 (full prior FLOOR preserved): loop n = 1..37 over the `## Appendix D`
 *           SLICE ONLY (never the whole canon, so a low number cannot false-match
 *           against an unrelated Part) and assert each prior entry heading is
 *           still present per-number. Never asserts sequential ordering (entries
 *           17/18 are intentionally out of numeric order) and never a raw count.
 *   Test 6 (frozen scalars byte-present): `MAX_K=3`, `DIAL_REACH_K=6`, and
 *           `0.70/0.15` are byte-present in the canon (the doctrine mints no scalar).
 *   Test 7 (version bump): header `/^Version: 1\.26$/m` AND footer
 *           `/_Mindrian Canon v1\.26 - MindrianOS Plugin_/` (anchor moved 1.25 -> 1.26 by
 *           Phase 340 Wave B's Appendix D entry 39; entry 38's own invariants unchanged).
 *   Test 8 (map row, light): `docs/CANON-PHASE-MAP.md` carries a "v1.26" token, an
 *           "entry 38" reference, and the phase slug
 *           `340-canon-currency-audit-and-amendment-v1-24-to-next-close-the-d`.
 *
 * NEVER asserts a raw count of Appendix D entries.
 * House rule: hyphens only, no em-dashes. Canon Part 8: zero Brain / network.
 */

const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');

const REPO_ROOT = path.resolve(__dirname, '..');
const CANON_PATH = path.join(REPO_ROOT, 'docs', 'MINDRIAN-CANON.md');
const MAP_PATH = path.join(REPO_ROOT, 'docs', 'CANON-PHASE-MAP.md');
const PERSONA_PATH = path.join(REPO_ROOT, 'agents', 'larry-extended.md');

let pass = 0;
function ok(name, cond) { assert.ok(cond, name); console.log('  ok - ' + name); pass++; }

const canon = fs.readFileSync(CANON_PATH, 'utf8');
const map = fs.readFileSync(MAP_PATH, 'utf8');
const persona = fs.readFileSync(PERSONA_PATH, 'utf8');

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

const part12 = sliceByHeader(canon, /^## Part 12 - /);
const appendixD = sliceByHeader(canon, /^## Appendix D/);
ok('Part 12 slice is non-empty', part12.length > 0);
ok('Appendix D slice is non-empty', appendixD.length > 0);

const part12Flat = collapse(part12);
const appendixDFlat = collapse(appendixD);

// Isolate the entry-38 body so its assertions cannot false-pass against another entry.
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
const entry38 = sliceEntry(appendixDFlat, 38);

// ---------------------------------------------------------------------------
// Test 1: Part 12 placement proof - the subsection heading + both anchors are
// INSIDE the Part 12 slice, not merely somewhere in the document.
// ---------------------------------------------------------------------------
ok('Part 12 slice carries the Sourced Claims Doctrine heading',
  /### The Sourced Claims Doctrine \(HARD requirement\)/.test(part12));
ok('Part 12 slice carries the "sourced or absent" anchor', /sourced or absent/.test(part12Flat));
ok('Part 12 slice carries the "A hedge word is not a source." anchor',
  /A hedge word is not a source\./.test(part12Flat));

// ---------------------------------------------------------------------------
// Test 2: the pre-existing Elevation tone rule is unweakened (extended, not
// replaced) by the new doctrine.
// ---------------------------------------------------------------------------
ok('Part 12 slice still carries the Elevation tone requirement byte-identical',
  /hedged, cautious, evidence-backed, NEVER confident/.test(part12Flat));

// ---------------------------------------------------------------------------
// Test 3: persona mirror proof - agents/larry-extended.md carries both anchors,
// making the mirror structurally required rather than aspirational.
// ---------------------------------------------------------------------------
ok('agents/larry-extended.md carries the "sourced or absent" anchor',
  /sourced or absent/.test(persona));
ok('agents/larry-extended.md carries the "A hedge word is not a source." anchor',
  /A hedge word is not a source\./.test(persona));

// ---------------------------------------------------------------------------
// Test 4: entry 38 body isolation - CANON-01, SEED-086, navigator-approval
// language, and the byte-identical frozen-scalar restatement.
// ---------------------------------------------------------------------------
ok('Appendix D entry 38 heading is present', /^38\.\s+\*\*/m.test(appendixD));
ok('entry 38 body names CANON-01', /CANON-01/.test(entry38));
ok('entry 38 body references SEED-086', /SEED-086/.test(entry38));
ok('entry 38 body carries navigator-approval language',
  /navigator-APPROVED/.test(entry38) && /blocking checkpoint/.test(entry38));
ok('entry 38 body restates the frozen scalars byte-identical',
  /MAX_K=3, DIAL_REACH_K=6, the 0\.70\/0\.15 gate/.test(entry38));

// ---------------------------------------------------------------------------
// Test 5: the full prior FLOOR (entries 1-37) is preserved, asserted against
// the `## Appendix D` SLICE ONLY. Per-number presence, NOT ordering.
// ---------------------------------------------------------------------------
for (let n = 1; n <= 37; n++) {
  const re = new RegExp('^' + n + '\\.\\s', 'm');
  ok('prior Appendix D entry ' + n + ' is still present in the Appendix D slice', re.test(appendixD));
}

// ---------------------------------------------------------------------------
// Test 6: the frozen Part 3 scalars are unchanged (the doctrine mints no scalar).
// ---------------------------------------------------------------------------
ok('frozen scalar MAX_K=3 is byte-present', /MAX_K=3/.test(canon));
ok('frozen scalar DIAL_REACH_K=6 is byte-present', /DIAL_REACH_K=6/.test(canon));
ok('the frozen 0.70/0.15 gate is byte-present', /0\.70\/0\.15/.test(canon));

// ---------------------------------------------------------------------------
// Test 7: the header + footer version bump to 1.26 (anchor moved by Phase 340 Wave B entry 39).
// ---------------------------------------------------------------------------
ok('header carries Version: 1.26', /^Version: 1\.26$/m.test(canon));
ok('footer carries Mindrian Canon v1.26', /_Mindrian Canon v1\.26 - MindrianOS Plugin_/.test(canon));

// ---------------------------------------------------------------------------
// Test 8: the CANON-PHASE-MAP carries a v1.26 token + an entry-38 ref + the
// phase slug.
// ---------------------------------------------------------------------------
ok('CANON-PHASE-MAP carries a "v1.26" token', /v1\.26/.test(map));
ok('CANON-PHASE-MAP references entry 38', /entry 38/.test(map));
ok('CANON-PHASE-MAP names the phase slug',
  /340-canon-currency-audit-and-amendment-v1-24-to-next-close-the-d/.test(map));

console.log('');
console.log('PASS ' + pass + ' assertions');
console.log('>>> test-canon-entry-38-sourced-claims-floor.cjs: PASSED');
