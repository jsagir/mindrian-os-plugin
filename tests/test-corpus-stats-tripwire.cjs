#!/usr/bin/env node
'use strict';

/*
 * Phase 186-02 (CORPUS-02) - the tripwire, BOTH directions (the D4 crux).
 *
 * Drives the EXPORTED pure surface of scripts/build-corpus-stats.cjs
 * (STALE_PATTERNS, excludedRegion, scanLiveSurfaces) directly on fixture strings
 * - no real file is mutated, no subprocess is spawned.
 *
 * Proves:
 *   FIRE  - a stale literal in MAGNITUDE context on a LIVE-style line is detected.
 *   PASS  - the SAME stale literal inside an EXCLUDED historical region
 *           (a line at/after "## Appendix D" in a canon-shaped fixture) is NOT
 *           detected (Canon D4 historical provenance is frozen).
 *   PASS  - the SAME literal in a directional/substrate context (12,401 as the
 *           MethodologyChunk substrate label) is NOT detected (Canon D2).
 *
 * Plain assertion-script idiom: process.exit(1) on any failure. No emoji, no
 * em-dashes.
 */

const gen = require('../scripts/build-corpus-stats.cjs');

let failed = 0;
function ok(cond, msg) {
  if (cond) {
    console.log('  PASS: ' + msg);
  } else {
    console.error('  FAIL: ' + msg);
    failed++;
  }
}

// matchStale(line) - mirror the scanLiveSurfaces inner loop on a single line:
// skip a rule whose suppress context matches, else apply its anchored regex.
// Returns the array of matched kinds (empty = the tripwire would NOT fire).
function matchStale(line) {
  const kinds = [];
  for (const rule of gen.STALE_PATTERNS) {
    if (rule.suppress && rule.suppress.test(line)) continue;
    if (rule.re.exec(line)) kinds.push(rule.kind);
  }
  return kinds;
}

console.log('test-corpus-stats-tripwire');

// --- FIRE: stale magnitude literals on LIVE-style lines ---
ok(
  matchStale('### Layer 1: The Framework Graph (Neo4j -- 27,804 nodes, 19,987 relationships)').includes('node'),
  'FIRE: 27,804 nodes detected as a stale node literal'
);
ok(
  matchStale('the index now covers all 748 :Framework nodes').includes('framework'),
  'FIRE: 748 :Framework detected as a stale framework literal'
);
ok(
  matchStale('Layer 2: The Semantic Embeddings (Pinecone pws-brain -- 12,413 vectors)').includes('vector'),
  'FIRE: 12,413 vectors detected as a stale vector literal'
);
ok(
  matchStale('Neo4j Aura with 21K nodes, 65K relationships').includes('node'),
  'FIRE: 21K nodes detected as a stale node literal'
);
ok(
  matchStale('Pinecone pws-brain currently holds 12,401 vectors').includes('vector'),
  'FIRE: 12,401 in a pure vector context (no substrate) detected'
);

// --- PASS (D2 substrate carve-out): 12,401 as the MethodologyChunk substrate ---
ok(
  matchStale('the 27,804-node total includes 12,401 MethodologyChunk substrate nodes').filter((k) => k === 'vector').length === 0,
  'PASS: 12,401 MethodologyChunk substrate does NOT fire as a vector (D2)'
);
ok(
  matchStale('Node types: MethodologyChunk (12,401), Concept (9,131), Framework (748)').length === 0,
  'PASS: per-label breakdown (Framework (748), MethodologyChunk (12,401)) does NOT fire'
);
ok(
  matchStale('FEEDS_INTO: 163 Framework->Framework edges; 19,987 relationships').length === 0,
  'PASS: directional relationship/edge counts do NOT fire'
);

// --- PASS (D4 historical exclusion): the SAME literal fires in LIVE prose but is
// SKIPPED inside the Appendix D region of a canon-shaped fixture. ---
const canonFixture = [
  '## Part 2 - The Team Around the Navigator', // 0  LIVE
  'Engine 1 runs against the graph (Neo4j -- 27,804 nodes).', // 1  LIVE (stale)
  '## Appendix D - Canonization Provenance', // 2  boundary
  '16. Corpus figures corrected: Neo4j 27,804 nodes / 19,987 relationships.', // 3  FROZEN history
];
const liveIdx = 1;
const histIdx = 3;
const file = 'docs/MINDRIAN-CANON.md';

ok(
  gen.excludedRegion(file, liveIdx, canonFixture) === false,
  'PASS: the Part 2 LIVE line is NOT in an excluded region'
);
ok(
  matchStale(canonFixture[liveIdx]).includes('node'),
  'FIRE: the same 27,804 literal fires on the Part 2 LIVE line'
);
ok(
  gen.excludedRegion(file, histIdx, canonFixture) === true,
  'PASS: the Appendix D line IS in the excluded (frozen) region (D4)'
);
// The scanner SKIPS excluded lines, so the literal there never becomes a hit even
// though the bare pattern would match it.
ok(
  matchStale(canonFixture[histIdx]).includes('node') &&
    gen.excludedRegion(file, histIdx, canonFixture) === true,
  'PASS: the Appendix D literal would match the pattern but is excluded -> no hit'
);

// --- Live end-to-end: the repointed repo is clean (no LIVE-surface stale hit). ---
const liveHits = gen.scanLiveSurfaces();
ok(
  Array.isArray(liveHits) && liveHits.length === 0,
  'PASS: scanLiveSurfaces() returns zero hits on the repointed repo'
);

if (failed > 0) {
  console.error('test-corpus-stats-tripwire: ' + failed + ' assertion(s) FAILED');
  process.exit(1);
}
console.log('test-corpus-stats-tripwire: all assertions passed');
