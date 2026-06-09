'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 148-03 Task 3 -- IRW-03 falsifiable test for the always-open standing trio.
 * =============================================================================
 * File + Brain review are ALWAYS-OPEN standing options the F.1 render host
 * appends OUTSIDE the MAX_K=3 chooser cap, with Free-Text always last. They are
 * NOT ranker candidates: they never enter reachScores and so can NEVER rank out
 * (the exact bug IRW-03 forbids -- brain_consult could previously rank out).
 *
 * Behaviors (148-VALIDATION.md IRW-03 row):
 *   - for each tier in {mode_a, mode_b, tier_0, cold-room} the rendered verb
 *     list contains "File"/"Brain review"/"Free-Text"
 *   - Free-Text is the LAST entry
 *   - with all reachScores zeroed the trio is still present (presence is
 *     independent of ranking)
 *   - the trio rides OUTSIDE the cap (a full USER_VERB_CAP=5 chooser set plus
 *     the 2 standing rows plus Free-Text -> 8 rows, the standing rows are not
 *     dropped by the cap)
 *
 * Tier mapping (shape-f1-renderer): tier >= 2 -> Mode A; tier < 2 -> Mode B.
 *   mode_a -> tier 2; mode_b -> tier 1; tier_0 -> tier 0; cold-room -> no verbs.
 *
 * No em-dashes anywhere (CLAUDE.md / project hard rule). Hyphens only.
 */

const assert = require('node:assert/strict');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const renderer = require(path.join(REPO_ROOT, 'lib', 'hmi', 'shape-f1-renderer.cjs'));

assert.equal(
  typeof renderer.normalizeVerbs,
  'function',
  'IRW-03: shape-f1-renderer must export normalizeVerbs'
);
assert.equal(
  typeof renderer.renderShapeF1,
  'function',
  'IRW-03: shape-f1-renderer must export renderShapeF1'
);

const FILE_ROW = renderer.STANDING_FILE;
const BRAIN_ROW = renderer.STANDING_BRAIN_REVIEW;
const FREE_TEXT = renderer.FREE_TEXT;

assert.ok(FILE_ROW && BRAIN_ROW && FREE_TEXT, 'IRW-03: standing-row constants must be exported');

function containsFile(verbs) {
  return verbs.some(function (v) { return v.indexOf('File') !== -1; });
}
function containsBrainReview(verbs) {
  return verbs.some(function (v) { return v === BRAIN_ROW || v.indexOf('Brain review') !== -1; });
}

// ---------------------------------------------------------------------------
// 1. Trio present at every tier; Free-Text always last.
// ---------------------------------------------------------------------------
// Each tier carries a representative ranked verb set; the standing trio rides
// OUTSIDE that set. cold-room supplies no caller verbs (canonical fallback).
const TIERS = [
  { name: 'mode_a', tier: 2, verbs: ['Run Methodology', 'Reformulate', 'Navigate Graph'] },
  { name: 'mode_b', tier: 1, verbs: ['Run Methodology', 'Reformulate', 'Navigate Graph'] },
  { name: 'tier_0', tier: 0, verbs: ['Run Methodology', 'Reformulate'] },
  { name: 'cold-room', tier: 0, verbs: undefined },
];

for (const t of TIERS) {
  const out = renderer.renderShapeF1({
    tier: t.tier,
    verbs: t.verbs,
    standingOptions: true,
  });
  const verbs = out.contract.verbs;
  assert.ok(Array.isArray(verbs) && verbs.length > 0, 'IRW-03[' + t.name + ']: verbs array present');
  assert.ok(containsFile(verbs), 'IRW-03[' + t.name + ']: File standing row present');
  assert.ok(containsBrainReview(verbs), 'IRW-03[' + t.name + ']: Brain review standing row present');
  assert.equal(
    verbs[verbs.length - 1],
    FREE_TEXT,
    'IRW-03[' + t.name + ']: Free-Text is the LAST entry'
  );
  assert.equal(out.contract.standingOptions, true, 'IRW-03[' + t.name + ']: contract flags standingOptions');
}

// ---------------------------------------------------------------------------
// 2. Presence is independent of ranking: zero out all "scores" (omit caller
//    verbs entirely so nothing ranks in) and the trio is STILL present.
// ---------------------------------------------------------------------------
const zeroScored = renderer.renderShapeF1({ tier: 2, verbs: [], standingOptions: true });
const zsVerbs = zeroScored.contract.verbs;
assert.ok(containsFile(zsVerbs), 'IRW-03: File present even with zero ranked verbs (independent of ranking)');
assert.ok(containsBrainReview(zsVerbs), 'IRW-03: Brain review present even with zero ranked verbs');
assert.equal(zsVerbs[zsVerbs.length - 1], FREE_TEXT, 'IRW-03: Free-Text still last with zero ranked verbs');

// ---------------------------------------------------------------------------
// 3. The trio rides OUTSIDE the cap: a full 5-verb chooser set (USER_VERB_CAP)
//    plus the 2 standing rows plus Free-Text -> 8 rows; the standing rows are
//    not dropped by the cap, and the 6th chooser verb IS dropped by the cap.
// ---------------------------------------------------------------------------
const capped = renderer.renderShapeF1({
  tier: 2,
  verbs: ['v1', 'v2', 'v3', 'v4', 'v5', 'v6-over-cap'],
  standingOptions: true,
});
const capVerbs = capped.contract.verbs;
assert.equal(capVerbs.indexOf('v6-over-cap'), -1, 'IRW-03: the 6th chooser verb is dropped by USER_VERB_CAP=5');
assert.ok(containsFile(capVerbs), 'IRW-03: File survives outside the cap');
assert.ok(containsBrainReview(capVerbs), 'IRW-03: Brain review survives outside the cap');
assert.equal(capVerbs[capVerbs.length - 1], FREE_TEXT, 'IRW-03: Free-Text last even past the cap');
// 5 chooser + File + Brain review + Free-Text = 8.
assert.equal(capVerbs.length, 8, 'IRW-03: 5 capped chooser verbs + 2 standing rows + Free-Text = 8');

process.stdout.write(
  'PASS test-148-standing-options.cjs (IRW-03: File + Brain review + Free-Text-last ' +
    'at every tier, outside the MAX_K cap, presence independent of ranking)\n'
);
process.exit(0);
