'use strict';
/*
 * Phase 340-03 - the Appendix D entry 39 GRAPH SUBSTRATE FLOOR test (Canon
 * Part 9 + Part 4 + Appendix B; requirements CANON-02, CANON-03, CANON-04;
 * navigator-APPROVED 2026-09-05, the blocking Task-1 checkpoint of Plan 03).
 *
 * The canonical FLOOR test for entry 39. Mirrors tests/test-canon-entry-36-shape-declaration-floor.cjs's
 * FLOOR idiom (and its sibling tests/test-canon-entry-38-sourced-claims-floor.cjs,
 * written one wave earlier in this same phase): read docs/MINDRIAN-CANON.md and
 * docs/CANON-PHASE-MAP.md, SLICE the canon by `## Part 9 - ` / `## Part 4 - ` /
 * `## Appendix B` / `## Appendix D` headers so each Part's own citation is
 * PROVABLE independently - a citation that landed only in Appendix D fails
 * this test, not just a whole-file grep. Whitespace-collapse for prose matches
 * across line breaks, assert membership in EACH slice + non-regression of
 * pre-existing prose in Part 9 and Part 4 + the full prior FLOOR (entries
 * 1-38) preserved + the version bump + the frozen scalars unchanged.
 *
 *   Test 1 (Part 9 placement proof, CANON-02): the Part 9 slice carries
 *           `two constitutional chokepoints`, `lib/core/navigation.cjs`,
 *           `lib/core/node-insert.cjs`, `epistemic_type`, and `fail-closed` -
 *           all five INSIDE the Part 9 slice, proving D-01's "two named
 *           things, not a footnote" structural requirement.
 *   Test 2 (Part 9 non-regression): the Part 9 slice still carries the
 *           five-role invariant lines `**SQL remembers and navigates.**` and
 *           `**The human confirms truth.**` byte-identical, and still
 *           carries `readSextuple` and the seven-kind memory complement
 *           language entry 35 ratified - this wave EXTENDED Part 9, it did
 *           not rewrite it.
 *   Test 3 (Part 4 placement proof, CANON-03): the Part 4 slice carries
 *           `lib/core/navigation/edges.cjs`, `enumerated from disk`, and
 *           EACH of the fifteen ratified edge type names individually, so a
 *           partial landing fails loudly. Never a total count.
 *   Test 4 (Part 4 non-regression): the Part 4 slice still carries a
 *           representative sample of the pre-existing 29 types individually
 *           (INFORMS, CONTRADICTS, REFINES, ROOT_CAUSES, INSTANTIATES,
 *           NESTED_WITHIN, DECOMPOSED_INTO) plus the existing amendment
 *           provenance clauses (Appendix D entry 18 / 21 / 23).
 *   Test 5 (Appendix B placement proof, CANON-04): the Appendix B slice
 *           carries `lib/core/room-skeleton-scaffold.cjs`, `STATEMENT`,
 *           `CONTEXT.md`, `references/`, `lib/core/section-registry.cjs`,
 *           AND all five original Layer-to-Part mappings byte-identical.
 *   Test 6 (entry 39 body isolation): the Appendix D slice, isolated to
 *           entry 39 via `sliceEntry`, carries CANON-02, CANON-03, CANON-04,
 *           the navigator-approval language, and the byte-identical
 *           frozen-scalar restatement `MAX_K=3, DIAL_REACH_K=6, the
 *           0.70/0.15 gate`. Also asserts the honesty clause: entry 39 does
 *           NOT contain the false phrase `mints NO new edge type` (it
 *           reconciles fifteen already-shipped types, it does not mint one).
 *   Test 7 (full prior FLOOR preserved): loop n = 1..38 over the `## Appendix
 *           D` SLICE ONLY (never the whole canon) and assert each prior
 *           entry heading is still present per-number. Never asserts
 *           sequential ordering (entries 17/18 are intentionally out of
 *           numeric order) and never a raw entry count.
 *   Test 8 (frozen scalars byte-present): `MAX_K=3`, `DIAL_REACH_K=6`, and
 *           `0.70/0.15` are byte-present in the canon (the amendment mints
 *           no scalar).
 *   Test 9 (version bump): header `/^Version: 1\.26$/m` AND footer
 *           `/_Mindrian Canon v1\.26 - MindrianOS Plugin_/`.
 *   Test 10 (map row, light): `docs/CANON-PHASE-MAP.md` carries a "v1.26"
 *           token, an "entry 39" reference, and the phase slug.
 *
 * NEVER asserts a raw count of Appendix D entries.
 * NEVER asserts a total count of edge types - membership is authoritative in
 * lib/core/navigation/edges.cjs and an additive type must not false-fail
 * this test.
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

const part4 = sliceByHeader(canon, /^## Part 4 - /);
const part9 = sliceByHeader(canon, /^## Part 9 - /);
const appendixB = sliceByHeader(canon, /^## Appendix B/);
const appendixD = sliceByHeader(canon, /^## Appendix D/);

ok('Part 4 slice is non-empty', part4.length > 0);
ok('Part 9 slice is non-empty', part9.length > 0);
ok('Appendix B slice is non-empty', appendixB.length > 0);
ok('Appendix D slice is non-empty', appendixD.length > 0);

const part4Flat = collapse(part4);
const part9Flat = collapse(part9);
const appendixBFlat = collapse(appendixB);
const appendixDFlat = collapse(appendixD);

// Isolate the entry-39 body so its assertions cannot false-pass against another entry.
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
const entry39 = sliceEntry(appendixDFlat, 39);

// ---------------------------------------------------------------------------
// Test 1: Part 9 placement proof (CANON-02) - two named chokepoints, not a footnote.
// ---------------------------------------------------------------------------
ok('Part 9 slice carries "two constitutional chokepoints"', /two constitutional chokepoints/.test(part9Flat));
ok('Part 9 slice carries lib/core/navigation.cjs', /lib\/core\/navigation\.cjs/.test(part9Flat));
ok('Part 9 slice carries lib/core/node-insert.cjs', /lib\/core\/node-insert\.cjs/.test(part9Flat));
ok('Part 9 slice carries epistemic_type', /epistemic_type/.test(part9Flat));
ok('Part 9 slice carries fail-closed', /fail-closed/.test(part9Flat));

// ---------------------------------------------------------------------------
// Test 2: Part 9 non-regression - the wave EXTENDED Part 9, it did not rewrite it.
// ---------------------------------------------------------------------------
ok('Part 9 slice still carries the SQL role invariant byte-identical',
  /\*\*SQL remembers and navigates\.\*\*/.test(part9));
ok('Part 9 slice still carries the human-confirms-truth invariant byte-identical',
  /\*\*The human confirms truth\.\*\*/.test(part9));
ok('Part 9 slice still carries readSextuple', /readSextuple/.test(part9Flat));
ok('Part 9 slice still carries the seven-kind memory complement language (entry 35)',
  /SEVEN kinds/.test(part9Flat) || /seven kinds/i.test(part9Flat));

// ---------------------------------------------------------------------------
// Test 3: Part 4 placement proof (CANON-03) - every ratified edge type named
// individually, plus the authoritative-source and non-frozen-count anchors.
// ---------------------------------------------------------------------------
ok('Part 4 slice carries lib/core/navigation/edges.cjs', /lib\/core\/navigation\/edges\.cjs/.test(part4Flat));
ok('Part 4 slice carries "enumerated from disk"', /enumerated from disk/.test(part4Flat));

const ratifiedEdgeTypes = [
  'ATTRIBUTED_TO', 'AUTHORED_BY', 'COMPETES_WITH', 'CONCERNS', 'DISCOVERED',
  'ELEVATES_TO', 'MAPS_TO_SECTION', 'NOT_REMEMBERED_BECAUSE', 'REMEMBERED_AS',
  'SHARES_JOB', 'SOURCED_FROM', 'SUPPLIES_TO', 'UMBILICAL_TO', 'USES_COMPONENT',
  'USES_FRAMEWORK',
];
for (const type of ratifiedEdgeTypes) {
  ok('Part 4 slice ratifies edge type ' + type, new RegExp(type).test(part4Flat));
}

// ---------------------------------------------------------------------------
// Test 4: Part 4 non-regression - a representative sample of the pre-existing
// 29 types, plus the existing amendment provenance clauses, stay present.
// ---------------------------------------------------------------------------
const priorEdgeSample = ['INFORMS', 'CONTRADICTS', 'REFINES', 'ROOT_CAUSES', 'INSTANTIATES', 'NESTED_WITHIN', 'DECOMPOSED_INTO'];
for (const type of priorEdgeSample) {
  ok('Part 4 slice still carries pre-existing edge type ' + type, new RegExp(type).test(part4Flat));
}
ok('Part 4 slice still carries "Appendix D entry 18"', /Appendix D entry 18/.test(part4Flat));
ok('Part 4 slice still carries "Appendix D entry 21"', /Appendix D entry 21/.test(part4Flat));
ok('Part 4 slice still carries "Appendix D entry 23"', /Appendix D entry 23/.test(part4Flat));

// ---------------------------------------------------------------------------
// Test 5: Appendix B placement proof (CANON-04) - real file citations AND the
// five original Layer-to-Part mappings preserved byte-identical.
// ---------------------------------------------------------------------------
ok('Appendix B slice carries lib/core/room-skeleton-scaffold.cjs', /lib\/core\/room-skeleton-scaffold\.cjs/.test(appendixBFlat));
ok('Appendix B slice carries STATEMENT', /STATEMENT/.test(appendixBFlat));
ok('Appendix B slice carries CONTEXT.md', /CONTEXT\.md/.test(appendixBFlat));
ok('Appendix B slice carries references/', /references\//.test(appendixBFlat));
ok('Appendix B slice carries lib/core/section-registry.cjs', /lib\/core\/section-registry\.cjs/.test(appendixBFlat));

const layerMappings = ['Layer 0 - Identity', 'Layer 1 - Routing', 'Layer 2 - Contracts', 'Layer 3 - Reference', 'Layer 4 - Artifacts'];
for (const layer of layerMappings) {
  ok('Appendix B slice still carries "' + layer + '"', appendixBFlat.includes(layer));
}

// ---------------------------------------------------------------------------
// Test 6: entry 39 body isolation - requirement ids, navigator-approval
// language, frozen-scalar restatement, and the honesty clause.
// ---------------------------------------------------------------------------
ok('Appendix D entry 39 heading is present', /^39\.\s+\*\*/m.test(appendixD));
ok('entry 39 body names CANON-02', /CANON-02/.test(entry39));
ok('entry 39 body names CANON-03', /CANON-03/.test(entry39));
ok('entry 39 body names CANON-04', /CANON-04/.test(entry39));
ok('entry 39 body carries navigator-approval language',
  /navigator-APPROVED/.test(entry39) && /blocking checkpoint/.test(entry39));
ok('entry 39 body restates the frozen scalars byte-identical',
  entry39.includes('MAX_K=3, DIAL_REACH_K=6, the 0.70/0.15 gate'));
ok('entry 39 body does NOT contain the false phrase "mints NO new edge type"',
  !entry39.includes('mints NO new edge type'));

// ---------------------------------------------------------------------------
// Test 7: the full prior FLOOR (entries 1-38) is preserved, asserted against
// the `## Appendix D` SLICE ONLY. Per-number presence, NOT ordering.
// ---------------------------------------------------------------------------
for (let n = 1; n <= 38; n++) {
  const re = new RegExp('^' + n + '\\.\\s', 'm');
  ok('prior Appendix D entry ' + n + ' is still present in the Appendix D slice', re.test(appendixD));
}

// ---------------------------------------------------------------------------
// Test 8: the frozen Part 3 scalars are byte-present (the amendment mints no scalar).
// ---------------------------------------------------------------------------
ok('frozen scalar MAX_K=3 is byte-present', /MAX_K=3/.test(canon));
ok('frozen scalar DIAL_REACH_K=6 is byte-present', /DIAL_REACH_K=6/.test(canon));
ok('the frozen 0.70/0.15 gate is byte-present', /0\.70\/0\.15/.test(canon));

// ---------------------------------------------------------------------------
// Test 9: the header + footer version bump to 1.27 (anchor tracks forward through Wave C entry 40).
// ---------------------------------------------------------------------------
ok('header carries Version: 1.27', /^Version: 1\.27$/m.test(canon));
ok('footer carries Mindrian Canon v1.27', /_Mindrian Canon v1\.27 - MindrianOS Plugin_/.test(canon));

// ---------------------------------------------------------------------------
// Test 10: the CANON-PHASE-MAP carries a v1.26 token + an entry-39 reference +
// the phase slug.
// ---------------------------------------------------------------------------
ok('CANON-PHASE-MAP carries a "v1.26" token', /v1\.26/.test(map));
ok('CANON-PHASE-MAP references entry 39', /entry 39/.test(map));
ok('CANON-PHASE-MAP names the phase slug',
  /340-canon-currency-audit-and-amendment-v1-24-to-next-close-the-d/.test(map));

console.log('');
console.log('PASS ' + pass + ' assertions');
console.log('>>> test-canon-entry-39-graph-substrate-floor.cjs: PASSED');
