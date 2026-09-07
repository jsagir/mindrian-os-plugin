'use strict';
// Phase 109-11: Canon Part 9 ratification structural test (NAV-109-09).
// Asserts the Part 9 merge into docs/MINDRIAN-CANON.md + the docs/CANON-PHASE-MAP.md
// row flips landed correctly. Pure file-structure test - no DB. Pattern: direct-CJS
// (node:assert/strict, no Mocha/Jest, zero new npm deps), mirrors tests/test-cross-room-memory.cjs.
//
// The version assertions (t4, t8) are a MONOTONIC FLOOR plus an append-only
// provenance check, never a pin: a test that asserts the LIVE canon header equals
// the exact version Part 9 landed at (v1.4) is guaranteed to fail the moment any
// later amendment ships, which is exactly the doomsday-clock bug this repair fixes
// (quick task 260907-m2l, 2026-09-07).

const { ok } = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const CANON = path.join(REPO_ROOT, 'docs', 'MINDRIAN-CANON.md');
const MAP = path.join(REPO_ROOT, 'docs', 'CANON-PHASE-MAP.md');

function read(p) { return fs.readFileSync(p, 'utf8'); }

function idx(haystack, needle) {
  const i = haystack.indexOf(needle);
  ok(i >= 0, 'expected to find: ' + JSON.stringify(needle));
  return i;
}

function sectionBlock(text, startHeading) {
  const start = text.indexOf(startHeading);
  ok(start >= 0, 'expected section heading: ' + startHeading);
  const after = text.slice(start + startHeading.length);
  const nextHeadingRel = after.search(/\n#{1,3} /);
  return nextHeadingRel < 0 ? after : after.slice(0, nextHeadingRel);
}

// Semver-style tuple comparison, NOT float comparison: 1.4 is greater than 1.13 as
// a float and lower as a version, so every comparison here compares major and minor
// as integers, major first, minor only on a major tie.
function parseVersionTuple(text, label) {
  const m = /^Version:\s*(\d+)\.(\d+)\s*$/m.exec(text);
  ok(m, (label || 'text') + ' has a parseable "Version: X.Y" header line');
  return { major: Number(m[1]), minor: Number(m[2]) };
}

function atLeast(tuple, major, minor) {
  if (tuple.major !== major) return tuple.major > major;
  return tuple.minor >= minor;
}

function t1_part9HeaderPresent() {
  const c = read(CANON);
  ok(c.includes('## Part 9 - Memory Locality and Interpretation'), 'canon contains "## Part 9 - Memory Locality and Interpretation"');
}

function t2_fiveRoleInvariant() {
  const c = read(CANON);
  for (const phrase of ['Files preserve meaning', 'SQL remembers and navigates', 'Brain reasons over structured packets', 'Larry explains and acts', 'The human confirms truth']) {
    ok(c.includes(phrase), 'canon contains five-role phrase: ' + phrase);
  }
}

function t3_part9BetweenPart8AndAppendixA() {
  const c = read(CANON);
  const p8 = idx(c, '## Part 8 - The Graph Boundary');
  const p9 = idx(c, '## Part 9 - Memory Locality and Interpretation');
  const aa = idx(c, '## Appendix A - Relationship to MWP');
  ok(p8 < p9, 'Part 8 precedes Part 9 (offsets ' + p8 + ' < ' + p9 + ')');
  ok(p9 < aa, 'Part 9 precedes Appendix A (offsets ' + p9 + ' < ' + aa + ')');
}

function t4_part9AmendmentRecordedAndFloorHeld() {
  const c = read(CANON);
  const m = read(MAP);
  // The amendment's own permanent provenance record: the map's Version history
  // table carries an append-only v1.4 row naming Part 9 and its ratification.
  // This row never changes, so it survives every later amendment (unlike a live
  // header equality check).
  //
  // Monotonic FLOOR (grep-discoverable per the Amendment cascade rule in
  // docs/CANON-PHASE-MAP.md): Version: 1.4 minimum, never a pin -- a future
  // amendment does not need to touch this floor, only confirm it still holds.
  const vh = sectionBlock(m, '## Version history');
  const v14Line = vh.split('\n').find((l) => /^\|\s*v1\.4\s/.test(l));
  ok(v14Line, 'map Version history table has a v1.4 row');
  ok(v14Line.includes('Part 9'), 'the v1.4 Version history row names Part 9');
  ok(v14Line.includes('ratified'), 'the v1.4 Version history row records ratification');
  // The monotonic floor: the live canon never regressed below where Part 9 landed.
  const tuple = parseVersionTuple(c, 'canon header');
  ok(atLeast(tuple, 1, 4), 'live canon header is at or above v1.4 (Part 9 floor holds)');
}

function t5_appendixDEntry12() {
  const c = read(CANON);
  const apxD = sectionBlock(c, '## Appendix D - Canonization Provenance');
  ok(/(^|\n)12\. /.test(apxD), 'Appendix D has a numbered entry 12');
  ok(apxD.includes('Codex'), 'Appendix D entry 12 mentions Codex');
  ok(apxD.includes('Part 9'), 'Appendix D entry 12 mentions Part 9');
}

function t6_mapPart9HeadingDeQualified() {
  const m = read(MAP);
  ok(m.includes('### Part 9 - Memory Locality and Interpretation'), 'map has "### Part 9 - Memory Locality and Interpretation"');
  ok(!m.includes('### Part 9 (proposed)'), 'map no longer has "### Part 9 (proposed)"');
}

function t7_mapPart9RowsShipped() {
  const m = read(MAP);
  const block = sectionBlock(m, '### Part 9 - Memory Locality and Interpretation');
  // The Phase 108 + Phase 109 rows must say shipped; Phase 110 stays planned.
  const lines108 = block.split('\n').filter((l) => l.includes('Phase 108 graph-memory-schema-reconciliation'));
  const lines109 = block.split('\n').filter((l) => l.includes('Phase 109 sql-context-memory-navigation-spine'));
  ok(lines108.length >= 1 && lines108.every((l) => l.includes('shipped') && !l.includes('proposed')), 'Phase 108 Part 9 row says shipped');
  ok(lines109.length >= 1 && lines109.every((l) => l.includes('shipped') && !l.includes('proposed')), 'Phase 109 Part 9 row says shipped');
}

function t8_mapCanonReferenceTracksLiveCanon() {
  // The old assertion pinned the map's "Canon reference" header to the exact
  // version Part 9 landed at (v1.4); the live map header now reads (v1.27), the
  // same doomed pattern one document over. The durable, STRICTER replacement:
  // the map's reference token must LOCKSTEP the canon's own header version. A
  // future amendment that bumps the canon and forgets the map now goes red
  // here, a real drift the old assertion could never catch.
  //
  // Monotonic FLOOR (grep-discoverable per the Amendment cascade rule in
  // docs/CANON-PHASE-MAP.md): Version: 1.4 minimum, never a pin.
  const m = read(MAP);
  const c = read(CANON);
  const refMatch = /^Canon reference: docs\/MINDRIAN-CANON\.md \(v(\d+)\.(\d+)\)\s*$/m.exec(m);
  ok(refMatch, 'map "Canon reference" header line exists and parses a (vX.Y) token');
  const mapTuple = { major: Number(refMatch[1]), minor: Number(refMatch[2]) };
  const canonTuple = parseVersionTuple(c, 'canon header');
  ok(mapTuple.major === canonTuple.major && mapTuple.minor === canonTuple.minor,
    'map Canon reference version (' + refMatch[1] + '.' + refMatch[2] + ') is byte-equal to the live canon header version (' + canonTuple.major + '.' + canonTuple.minor + ')');
  ok(atLeast(mapTuple, 1, 4), 'the shared Canon reference version is at or above v1.4');
}

function t9_mapVersionHistoryHasV14() {
  const m = read(MAP);
  const vh = sectionBlock(m, '## Version history');
  ok(/\|\s*v1\.4\s*\|/.test(vh), 'map Version history table has a v1.4 row');
}

function run() {
  const tests = [t1_part9HeaderPresent, t2_fiveRoleInvariant, t3_part9BetweenPart8AndAppendixA, t4_part9AmendmentRecordedAndFloorHeld, t5_appendixDEntry12, t6_mapPart9HeadingDeQualified, t7_mapPart9RowsShipped, t8_mapCanonReferenceTracksLiveCanon, t9_mapVersionHistoryHasV14];
  let pass = 0; let fail = 0;
  for (const t of tests) {
    try { t(); pass++; process.stdout.write('PASS ' + t.name + '\n'); }
    catch (err) { fail++; process.stderr.write('FAIL ' + t.name + ': ' + err.message + '\n'); }
  }
  process.stdout.write('test-canon-part-9-ratification: ' + pass + '/' + tests.length + ' passed\n');
  process.exit(fail === 0 ? 0 : 1);
}

run();
