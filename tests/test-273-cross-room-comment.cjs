'use strict';
// Phase 273 D-04 / D-04a -- M2 cross-room aggregation fence comment sweep.
//
// Requirements: CHOKE-05.
//
// RED BY DESIGN until plan 273-03 lands. edges.cjs currently repeats the
// misleading phrase "Cross-room aggregation forbidden" 11 times (lines 45,
// 64, 236, 269, 366, 419, 583, 629, 667, 705, 746 per 273-RESEARCH.md's
// citation-verification table), implying a checked runtime invariant that
// does not exist. The fence already holds structurally today -- via
// writeEdge(db, params)'s function signature, which only ever holds the one
// db handle its caller passed in and is physically incapable of opening a
// second room's db -- but the comment lies about the mechanism. This is a
// comment-only change with no other verification surface, hence this
// source-text assertion test.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.join(__dirname, '..');
const TARGET = path.join(REPO, 'lib', 'core', 'navigation', 'edges.cjs');

function main() {
  const src = fs.readFileSync(TARGET, 'utf8');
  const misleadingCount = (src.match(/Cross-room aggregation forbidden/g) || []).length;
  assert.equal(
    misleadingCount, 0,
    'D-04: every occurrence of the misleading "Cross-room aggregation forbidden" phrasing must be corrected to describe the structural mechanism'
  );
  const structuralCount = (src.match(/Cross-room aggregation is prevented structurally/g) || []).length;
  assert.ok(
    structuralCount >= 11,
    'D-04: the corrected structural-mechanism wording must appear at all 11 sites (found ' + structuralCount + ')'
  );
  console.log('PASS test-273-cross-room-comment');
}

main();
