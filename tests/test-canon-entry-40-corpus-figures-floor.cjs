'use strict';
/*
 * Phase 340-04 - the Appendix D entry 40 CORPUS-FIGURES FLOOR test (Canon
 * Appendix C + Part 2 + Part 7 + Part 11; requirements CANON-05, CANON-06,
 * CANON-07, CANON-08, CANON-09; navigator-APPROVED 2026-09-05, the blocking
 * Task-1 checkpoint of Plan 04, with three named rulings: Ruling A = COMMANDS
 * (CLAUDE.md's Core Value "25 methodology bots" figure rewritten to "a growing
 * methodology-command surface enumerated from disk" since that sentence
 * describes the live plugin's product surface, not the separate MindrianV2
 * codebase's historical bot-prompt count), Ruling B = REMOVE ROW (CLAUDE.md's
 * dead docu-optimizer Project Skills row deleted, the file confirmed absent
 * from disk by 340-LIVE-VERIFICATION.md item 14), and Ruling C = state the
 * Part 2 corpus-size clause WITH the not-regenerated-against-Theo caveat
 * rather than omitting it, per the Sourced Claims Doctrine Wave A of this
 * same phase ratified).
 *
 * The canonical FLOOR test for entry 40. Mirrors
 * tests/test-canon-entry-36-shape-declaration-floor.cjs's FLOOR idiom (and its
 * siblings tests/test-canon-entry-38-sourced-claims-floor.cjs and
 * tests/test-canon-entry-39-graph-substrate-floor.cjs, written earlier in this
 * same phase): read docs/MINDRIAN-CANON.md, docs/CANON-PHASE-MAP.md, and
 * CLAUDE.md, SLICE the canon by `## Part 2 - ` / `## Part 7 - ` /
 * `## Part 11 - ` / `## Appendix C` / `## Appendix D` headers so each Part's
 * own presence-and-absence proof is PROVABLE independently - a retired name
 * that only disappeared from one Part while surviving in another would false-
 * pass a whole-file grep but fails this test loudly. Whitespace-collapse for
 * prose matches across line breaks; assert membership + absence in EACH
 * slice + the full prior FLOOR (entries 1-39) preserved + frozen scalars
 * byte-present + the version bump + the CLAUDE.md same-commit lockstep.
 *
 *   Test 1 (Appendix C, present and absent, CANON-05): the Appendix C slice
 *           CONTAINS `theo-mcp.onrender.com` and DOES NOT CONTAIN
 *           `pws-brain-mcp.onrender.com`. The boundary sentence
 *           "Never a store for user data." is still present in that slice.
 *   Test 2 (Part 2, present and absent, CANON-06): the Part 2 slice CONTAINS
 *           `multilingual-e5-large` and `embedded LOCALLY`, and DOES NOT
 *           CONTAIN `Pinecone`. The five command wrappers are still present
 *           in that slice by name.
 *   Test 3 (Part 7, present and absent, CANON-07): the Part 7 slice CONTAINS
 *           `enumerated from disk` and DOES NOT CONTAIN
 *           `25 methodology commands`. The obligation survives: "Reuse
 *           compounds the moat." is still byte-present in that slice.
 *   Test 4 (Part 11 doctrine unweakened, CANON-08): the Part 11 slice STILL
 *           CONTAINS all three self-disclaiming sentences byte-identical:
 *           `NEVER a frozen scalar`, `ALWAYS enumerated from disk at run
 *           time`, and `not a canon-frozen constant a future gate may
 *           hardcode`. It DOES NOT CONTAIN `126 as of this phase`. The FRAMING
 *           is pinned, never today's new number, mirroring entry-36's Test 5
 *           precedent, so a future refresh does not false-fail.
 *   Test 5 (historical record preserved): the Appendix D slice STILL CONTAINS
 *           `Pinecone` and the entry-16 phrase
 *           `Corpus figures corrected (2026-06-11)`, proving the absence
 *           assertions above were slice-scoped and the history was not
 *           scrubbed.
 *   Test 6 (CLAUDE.md same-commit lockstep, CANON-09): CLAUDE.md DOES NOT
 *           CONTAIN `25 methodology commands` and DOES NOT CONTAIN
 *           `126 declared + 5 skill-exempt`. Ruling B was REMOVE ROW, so
 *           CLAUDE.md also does not contain `docu-optimizer`. CLAUDE.md
 *           STILL CONTAINS `theo-mcp.onrender.com` and `multilingual-e5-large`
 *           (its stack table was already current and must stay so). This is
 *           what makes Pitfall 3 structurally impossible to repeat.
 *   Test 7 (entry 40 body isolation): the entry-40 body, isolated via
 *           `sliceEntry`, carries CANON-05, CANON-07, the navigator-approval
 *           language, and the byte-identical frozen-scalar restatement
 *           `MAX_K=3, DIAL_REACH_K=6, the 0.70/0.15 gate`.
 *   Test 8 (prior entries preserved): loop n = 1..39 over the `## Appendix D`
 *           SLICE ONLY and assert each prior entry heading is still present
 *           per-number. Never asserts ordering, never asserts a raw entry
 *           count.
 *   Test 9 (frozen scalars byte-present): `MAX_K=3`, `DIAL_REACH_K=6`,
 *           `0.70/0.15`.
 *   Test 10 (version bump): header `/^Version: 1\.27$/m` and footer
 *           `/_Mindrian Canon v1\.27 - MindrianOS Plugin_/`.
 *   Test 11 (map row, light): docs/CANON-PHASE-MAP.md carries a `v1.27`
 *           token, an `entry 40` reference, and the phase slug.
 *
 * NEVER asserts a raw count of Appendix D entries.
 * NEVER asserts a hardcoded surface or corpus count anywhere in this file -
 * pinning a number here would recreate the exact disease this entry cures.
 * Absence assertions are SLICE-SCOPED, never whole-file - the retired names
 * must survive in the Appendix D historical record and only disappear from
 * the live Parts.
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
const collapse = (s) => s.replace(/\s+/g, ' ');

const part2 = sliceByHeader(canon, /^## Part 2 - /);
const part7 = sliceByHeader(canon, /^## Part 7 - /);
const part11 = sliceByHeader(canon, /^## Part 11 - /);
const appendixC = sliceByHeader(canon, /^## Appendix C/);
const appendixD = sliceByHeader(canon, /^## Appendix D/);

ok('Part 2 slice is non-empty', part2.length > 0);
ok('Part 7 slice is non-empty', part7.length > 0);
ok('Part 11 slice is non-empty', part11.length > 0);
ok('Appendix C slice is non-empty', appendixC.length > 0);
ok('Appendix D slice is non-empty', appendixD.length > 0);

const part2Flat = collapse(part2);
const part7Flat = collapse(part7);
const part11Flat = collapse(part11);
const appendixCFlat = collapse(appendixC);
const appendixDFlat = collapse(appendixD);

// Isolate the entry-40 body so its assertions cannot false-pass against another entry.
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
const entry40 = sliceEntry(appendixDFlat, 40);

// ---------------------------------------------------------------------------
// Test 1: Appendix C, present and absent (CANON-05).
// ---------------------------------------------------------------------------
ok('Appendix C slice carries theo-mcp.onrender.com', /theo-mcp\.onrender\.com/.test(appendixCFlat));
ok('Appendix C slice does NOT carry pws-brain-mcp.onrender.com', !/pws-brain-mcp\.onrender\.com/.test(appendixCFlat));
ok('Appendix C slice still carries the boundary sentence byte-identical',
  /Never a store for user data\./.test(appendixC));

// ---------------------------------------------------------------------------
// Test 2: Part 2, present and absent (CANON-06).
// ---------------------------------------------------------------------------
ok('Part 2 slice carries multilingual-e5-large', /multilingual-e5-large/.test(part2Flat));
ok('Part 2 slice carries embedded LOCALLY', /embedded LOCALLY/.test(part2Flat));
ok('Part 2 slice does NOT carry Pinecone', !/Pinecone/.test(part2Flat));

const commandWrappers = ['/mos:whitespace', '/mos:find-bottlenecks', '/mos:find-connections', '/mos:find-analogies', '/mos:score-innovation'];
for (const wrapper of commandWrappers) {
  ok('Part 2 slice still carries command wrapper ' + wrapper, part2Flat.includes(wrapper));
}

// ---------------------------------------------------------------------------
// Test 3: Part 7, present and absent (CANON-07).
// ---------------------------------------------------------------------------
ok('Part 7 slice carries "enumerated from disk"', /enumerated from disk/.test(part7Flat));
ok('Part 7 slice does NOT carry "25 methodology commands"', !/25 methodology commands/.test(part7Flat));
ok('Part 7 slice still carries "Reuse compounds the moat." byte-identical',
  /Reuse compounds the moat\./.test(part7));

// ---------------------------------------------------------------------------
// Test 4: Part 11 doctrine unweakened (CANON-08).
// ---------------------------------------------------------------------------
ok('Part 11 slice still carries "NEVER a frozen scalar" byte-identical',
  /NEVER a frozen scalar/.test(part11Flat));
ok('Part 11 slice still carries "ALWAYS enumerated from disk at run time" byte-identical',
  /ALWAYS enumerated from disk at run time/.test(part11Flat));
ok('Part 11 slice still carries "not a canon-frozen constant a future gate may hardcode" byte-identical',
  /not a canon-frozen constant a future gate may hardcode/.test(part11Flat));
ok('Part 11 slice does NOT carry "126 as of this phase"', !/126 as of this phase/.test(part11Flat));

// ---------------------------------------------------------------------------
// Test 5: historical record preserved - the absence assertions above were
// slice-scoped, not whole-file; the Appendix D history was not scrubbed.
// ---------------------------------------------------------------------------
ok('Appendix D slice still carries Pinecone (historical record)', /Pinecone/.test(appendixDFlat));
ok('Appendix D slice still carries the entry-16 phrase "Corpus figures corrected (2026-06-11)"',
  /Corpus figures corrected \(2026-06-11\)/.test(appendixDFlat));

// ---------------------------------------------------------------------------
// Test 6: CLAUDE.md same-commit lockstep (CANON-09).
// ---------------------------------------------------------------------------
ok('CLAUDE.md does NOT carry "25 methodology commands"', !claudeMd.includes('25 methodology commands'));
ok('CLAUDE.md does NOT carry "126 declared + 5 skill-exempt"', !claudeMd.includes('126 declared + 5 skill-exempt'));
ok('CLAUDE.md does NOT carry "docu-optimizer" (Ruling B = REMOVE ROW)', !claudeMd.includes('docu-optimizer'));
ok('CLAUDE.md still carries theo-mcp.onrender.com', claudeMd.includes('theo-mcp.onrender.com'));
ok('CLAUDE.md still carries multilingual-e5-large', claudeMd.includes('multilingual-e5-large'));

// ---------------------------------------------------------------------------
// Test 7: entry 40 body isolation.
// ---------------------------------------------------------------------------
ok('Appendix D entry 40 heading is present', /^40\.\s+\*\*/m.test(appendixD));
ok('entry 40 body names CANON-05', /CANON-05/.test(entry40));
ok('entry 40 body names CANON-07', /CANON-07/.test(entry40));
ok('entry 40 body carries navigator-approval language',
  /navigator-APPROVED/.test(entry40) && /blocking checkpoint/.test(entry40));
ok('entry 40 body restates the frozen scalars byte-identical',
  entry40.includes('MAX_K=3, DIAL_REACH_K=6, the 0.70/0.15 gate'));

// ---------------------------------------------------------------------------
// Test 8: the full prior FLOOR (entries 1-39) is preserved, asserted against
// the `## Appendix D` SLICE ONLY. Per-number presence, NOT ordering.
// ---------------------------------------------------------------------------
for (let n = 1; n <= 39; n++) {
  const re = new RegExp('^' + n + '\\.\\s', 'm');
  ok('prior Appendix D entry ' + n + ' is still present in the Appendix D slice', re.test(appendixD));
}

// ---------------------------------------------------------------------------
// Test 9: the frozen Part 3 scalars are byte-present (the amendment mints no scalar).
// ---------------------------------------------------------------------------
ok('frozen scalar MAX_K=3 is byte-present', /MAX_K=3/.test(canon));
ok('frozen scalar DIAL_REACH_K=6 is byte-present', /DIAL_REACH_K=6/.test(canon));
ok('the frozen 0.70/0.15 gate is byte-present', /0\.70\/0\.15/.test(canon));

// ---------------------------------------------------------------------------
// Test 10: the header + footer version bump to 1.27.
// ---------------------------------------------------------------------------
ok('header carries Version: 1.27', /^Version: 1\.27$/m.test(canon));
ok('footer carries Mindrian Canon v1.27', /_Mindrian Canon v1\.27 - MindrianOS Plugin_/.test(canon));

// ---------------------------------------------------------------------------
// Test 11: the CANON-PHASE-MAP carries a v1.27 token + an entry-40 reference +
// the phase slug.
// ---------------------------------------------------------------------------
ok('CANON-PHASE-MAP carries a "v1.27" token', /v1\.27/.test(map));
ok('CANON-PHASE-MAP references entry 40', /entry 40/.test(map));
ok('CANON-PHASE-MAP names the phase slug',
  /340-canon-currency-audit-and-amendment-v1-24-to-next-close-the-d/.test(map));

console.log('');
console.log('PASS ' + pass + ' assertions');
console.log('>>> test-canon-entry-40-corpus-figures-floor.cjs: PASSED');
