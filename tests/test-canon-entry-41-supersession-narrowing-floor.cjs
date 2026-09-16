'use strict';
/*
 * Phase 348-09 - the Appendix D entry 41 SUPERSESSION NARROWING FLOOR test
 * (Canon Part 9; requirement SUPER-15; navigator-APPROVED at the 348-08
 * blocking checkpoint, 2026-09-16 - "Approved as specified", zero wording
 * changes, full atomic lockstep WD-348-10, version target v1.27 -> v1.28,
 * entry-31 released the same way entries 32-40 recorded it).
 *
 * WHAT A FLOOR TEST IS FOR IN THIS REPO: it pins the amendment's load-bearing
 * text so a later edit cannot silently weaken it, it is SLICE-SCOPED so a
 * correct sentence pasted into the wrong Part fails it, and it NEVER asserts
 * a raw Appendix D entry COUNT because the count is not a contract - only
 * per-number membership is.
 *
 * The canonical FLOOR test for entry 41. Mirrors
 * tests/test-canon-entry-40-corpus-figures-floor.cjs's FLOOR idiom (slice by
 * `## Part 9 - ` / `## Appendix D` headers so a match is provably INSIDE that
 * Part, not merely somewhere in the file) and
 * tests/test-canon-entry-39-graph-substrate-floor.cjs's multi-surface variant
 * (this narrowing also touches CLAUDE.md and docs/CANON-PHASE-MAP.md).
 * Every literal asserted below is taken from the wording the navigator
 * ratified at the 348-08 checkpoint, recorded verbatim in
 * `docs/SUPERSESSION-CONTRACT.md`'s "Ratified wording for 348-09" section -
 * this test does not invent a sentence and then write it into the canon to
 * match; that would make the test a mirror rather than a floor.
 *
 *   Test 1 (Part 9 placement proof): the Part 9 slice CONTAINS the narrowing
 *           paragraph's load-bearing tokens - the "Narrowing for `superseded`"
 *           heading phrase naming Phase 348 and Appendix D entry 41, the
 *           human-attributed-gate-answer requirement, the reason clause tying
 *           it to role 5's `confirmed` bar, the NOT-narrowed carve-out
 *           (`rejected` and `stale` stay agent-reachable, audit-node carve-out
 *           untouched), the chokepoint citation
 *           `lib/core/navigation/transitions.cjs::promoteNodeStatus`, and the
 *           pointer to `docs/SUPERSESSION-CONTRACT.md` - all INSIDE the Part 9
 *           slice, not merely somewhere in the file.
 *   Test 2 (structural absence - the silent-revert guard): the "Truth states
 *           (canonical)" subsection no longer ENDS immediately after "Status
 *           transitions are events in the memory log, never silent
 *           overwrites." - the narrowing paragraph must follow it inside the
 *           same subsection. A legitimate future rewording that keeps content
 *           after that sentence does not fail this; a silent revert that
 *           deletes the narrowing paragraph and restores the old ending DOES
 *           fail it.
 *   Test 3 (Part 9 non-regression): the closed eight-value status list, the
 *           "Brain may *propose* a status; only user confirmation or system
 *           rules can *promote* a status" sentence, and the audit-node
 *           carve-out subsection heading are all still byte-present - this
 *           wave EXTENDED Part 9, it did not rewrite it.
 *   Test 4 (entry 41 body isolation): the Appendix D entry 41 body, isolated
 *           via `sliceEntry`, is numbered 41, names Phase 348, carries the
 *           navigator-approval language, the entry-31 self-binding release
 *           language, the mints-nothing statement, the frozen-scalar
 *           restatement byte-identical, and the requirement id SUPER-15.
 *   Test 5 (prior entries preserved): loop n = 1..40 over the `## Appendix D`
 *           SLICE ONLY and assert each prior entry heading is still present
 *           per-number. Never asserts ordering, never asserts a raw count.
 *   Test 6 (frozen scalars byte-present): `MAX_K=3`, `DIAL_REACH_K=6`, and the
 *           `0.70` / `0.15` gate literals are byte-present in the canon.
 *   Test 7 (version bump): header `/^Version: 1\.28$/m` and footer
 *           `/_Mindrian Canon v1\.28 - MindrianOS Plugin_/`.
 *   Test 8 (CLAUDE.md sibling-edit lockstep): CLAUDE.md's Part 9 Canon
 *           Compliance Core bullet carries the identical narrowing clause
 *           ("only a human closes one as superseded (Appendix D entry 41)"),
 *           so the two surfaces cannot drift (340-RESEARCH.md Pitfall 3).
 *   Test 9 (CANON-PHASE-MAP lockstep): the reference line reads `v1.28` and a
 *           version-history row naming `v1.28` and `entry 41` exists.
 *
 * NEVER asserts a raw count of Appendix D entries.
 * Absence assertions are SLICE- and STRUCTURE-scoped, never a blind
 * whole-file substring ban.
 * House rule: hyphens only, no em-dashes. Canon Part 8: zero Brain / network.
 */

const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');

const REPO_ROOT = path.resolve(__dirname, '..');
const CANON_PATH = path.join(REPO_ROOT, 'docs', 'MINDRIAN-CANON.md');
const MAP_PATH = path.join(REPO_ROOT, 'docs', 'CANON-PHASE-MAP.md');
const CLAUDE_PATH = path.join(REPO_ROOT, 'CLAUDE.md');

let pass = 0;
function ok(name, cond) { assert.ok(cond, name); console.log('  ok - ' + name); pass++; }

const canon = fs.readFileSync(CANON_PATH, 'utf8');
const map = fs.readFileSync(MAP_PATH, 'utf8');
const claudeMd = fs.readFileSync(CLAUDE_PATH, 'utf8');

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
// Slice a `### ` subsection between a header and the NEXT `### ` (or `## `) header.
function sliceBySubHeader(text, headerRe) {
  const lines = text.split('\n');
  let start = -1;
  for (let i = 0; i < lines.length; i++) { if (headerRe.test(lines[i])) { start = i; break; } }
  if (start === -1) return '';
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) { if (/^#{2,3} /.test(lines[i])) { end = i; break; } }
  return lines.slice(start, end).join('\n');
}
const collapse = (s) => s.replace(/\s+/g, ' ');

const part9 = sliceByHeader(canon, /^## Part 9 - /);
const appendixD = sliceByHeader(canon, /^## Appendix D/);

ok('Part 9 slice is non-empty', part9.length > 0);
ok('Appendix D slice is non-empty', appendixD.length > 0);

const part9Flat = collapse(part9);
const appendixDFlat = collapse(appendixD);

// Isolate the entry-41 body so its assertions cannot false-pass against another entry.
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
const entry41 = sliceEntry(appendixDFlat, 41);

// ---------------------------------------------------------------------------
// Test 1: Part 9 placement proof - the narrowing lands INSIDE Part 9, not
// merely somewhere in the file.
// ---------------------------------------------------------------------------
ok('Part 9 slice carries the narrowing heading phrase naming Phase 348 and entry 41',
  /Narrowing for `superseded`.*Phase 348.*Appendix D entry 41/.test(part9Flat) ||
  /Narrowing for `superseded` \(Phase 348, Appendix D entry 41\)/.test(part9Flat));
ok('Part 9 slice carries the human-attributed-gate-answer requirement',
  /only a human-attributed gate answer may/.test(part9Flat));
ok('Part 9 slice ties the reason to role 5\'s confirmed bar',
  /same human bar role 5 already places on promoting a node to `confirmed`/.test(part9Flat));
ok('Part 9 slice states rejected and stale remain agent-reachable (NOT over-narrowed)',
  /`rejected` and `stale` remain agent-reachable/.test(part9Flat));
ok('Part 9 slice states the audit-node carve-out is untouched',
  /audit-node carve-out.{0,40}untouched/.test(part9Flat));
ok('Part 9 slice cites the chokepoint lib/core/navigation/transitions.cjs::promoteNodeStatus',
  /lib\/core\/navigation\/transitions\.cjs::promoteNodeStatus/.test(part9Flat));
ok('Part 9 slice points to docs/SUPERSESSION-CONTRACT.md',
  /docs\/SUPERSESSION-CONTRACT\.md/.test(part9Flat));

// ---------------------------------------------------------------------------
// Test 2: structural absence - the silent-revert guard. The Truth states
// (canonical) subsection must NOT end immediately after the pre-existing
// "never silent overwrites." sentence; the narrowing paragraph must follow it
// inside the same subsection.
// ---------------------------------------------------------------------------
const truthStates = sliceBySubHeader(canon, /^### Truth states \(canonical\)/);
ok('Truth states (canonical) subsection is non-empty', truthStates.length > 0);
const oldSentenceIdx = truthStates.indexOf('Status transitions are events in the memory log, never silent overwrites.');
ok('Truth states subsection still carries the pre-existing closing sentence', oldSentenceIdx >= 0);
const afterOldSentence = oldSentenceIdx >= 0
  ? truthStates.slice(oldSentenceIdx + 'Status transitions are events in the memory log, never silent overwrites.'.length).trim()
  : '';
ok('the subsection does NOT end right after the pre-existing sentence - a narrowing paragraph follows it (silent-revert guard)',
  afterOldSentence.length > 0);
ok('the content following the pre-existing sentence is the narrowing paragraph itself',
  /Narrowing for `superseded`/.test(afterOldSentence));

// ---------------------------------------------------------------------------
// Test 3: Part 9 non-regression - the wave EXTENDED Part 9, it did not
// rewrite it.
// ---------------------------------------------------------------------------
ok('Part 9 slice still carries the closed eight-value status list',
  /proposed \| confirmed \| rejected \| stale \| superseded \| needs_evidence \| validated \| invalidated/.test(part9Flat));
ok('Part 9 slice still carries the pre-existing propose/promote sentence byte-identical',
  /Brain may \*propose\* a status; only user confirmation or system rules can \*promote\* a status\./.test(part9Flat));
ok('Part 9 slice still carries the Audit-node carve-out subsection heading',
  /### Audit-node carve-out/.test(part9));

// ---------------------------------------------------------------------------
// Test 4: entry 41 body isolation.
// ---------------------------------------------------------------------------
ok('Appendix D entry 41 heading is present', /^41\.\s+\*\*/m.test(appendixD));
ok('entry 41 body names Phase 348', /Phase 348/.test(entry41));
ok('entry 41 body carries navigator-approval language',
  /navigator-APPROVED/.test(entry41) && /blocking checkpoint/.test(entry41));
ok('entry 41 body carries the entry-31 self-binding release language',
  /Entry 31.?s self-binding clause/.test(entry41) && /RELEASED/.test(entry41));
ok('entry 41 body carries the mints-nothing statement',
  /mints NO new reach/.test(entry41) && /NO new edge type/.test(entry41) && /NO new node type/.test(entry41) && /NO Brain wire/.test(entry41));
ok('entry 41 body restates the frozen scalars byte-identical',
  entry41.includes('MAX_K=3, DIAL_REACH_K=6, the 0.70/0.15 gate'));
ok('entry 41 body names requirement id SUPER-15', /SUPER-15/.test(entry41));

// ---------------------------------------------------------------------------
// Test 5: the full prior FLOOR (entries 1-40) is preserved, asserted against
// the `## Appendix D` SLICE ONLY. Per-number presence, NOT ordering.
// ---------------------------------------------------------------------------
for (let n = 1; n <= 40; n++) {
  const re = new RegExp('^' + n + '\\.\\s', 'm');
  ok('prior Appendix D entry ' + n + ' is still present in the Appendix D slice', re.test(appendixD));
}

// ---------------------------------------------------------------------------
// Test 6: the frozen Part 3 scalars are byte-present (the amendment mints no scalar).
// ---------------------------------------------------------------------------
ok('frozen scalar MAX_K=3 is byte-present', /MAX_K=3/.test(canon));
ok('frozen scalar DIAL_REACH_K=6 is byte-present', /DIAL_REACH_K=6/.test(canon));
ok('the frozen 0.70/0.15 gate is byte-present', /0\.70\/0\.15/.test(canon));

// ---------------------------------------------------------------------------
// Test 7: the header + footer version bump to 1.28.
// ---------------------------------------------------------------------------
ok('header carries Version: 1.28', /^Version: 1\.28$/m.test(canon));
ok('footer carries Mindrian Canon v1.28', /_Mindrian Canon v1\.28 - MindrianOS Plugin_/.test(canon));

// ---------------------------------------------------------------------------
// Test 8: CLAUDE.md same-commit lockstep - the sibling edit 340-RESEARCH.md
// Pitfall 3 exists to force.
// ---------------------------------------------------------------------------
ok('CLAUDE.md Part 9 bullet carries the identical narrowing clause',
  /only a human closes one as superseded \(Appendix D entry 41\)/.test(claudeMd));

// ---------------------------------------------------------------------------
// Test 9: the CANON-PHASE-MAP carries a v1.28 token + a v1.28 version-history
// row naming entry 41.
// ---------------------------------------------------------------------------
ok('CANON-PHASE-MAP reference line reads v1.28',
  /^Canon reference: docs\/MINDRIAN-CANON\.md \(v1\.28\)\s*$/m.test(map));
ok('CANON-PHASE-MAP has a v1.28 version-history row referencing entry 41',
  /\|\s*v1\.28\s*\|[^\n]*entry 41/.test(map));

console.log('');
console.log('PASS ' + pass + ' assertions');
console.log('>>> test-canon-entry-41-supersession-narrowing-floor.cjs: PASSED');
