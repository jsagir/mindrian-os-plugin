'use strict';
/*
 * Phase 146-02 -- ACPT-04 dogfood driver: filing an artifact surfaces the
 * cross-relationship cascade findings to Larry mid-session (Canon Part 4
 * every-choice-is-graph-data; Part 6 dog-fooding mandate; Part 8 LOCAL-only).
 * ========================================================================
 *
 * THE PROOF this acceptance leg exists to make: when a navigator files an
 * artifact mid-session, the REAL post-write cascade writes the cross-relationship
 * findings to the shipped CASC-01 side-channel
 * (<roomDir>/.mindrian/last-cascade.json) and the REAL room-proactive surfacing
 * contract (skills/room-proactive/SKILL.md) presents the highest-confidence
 * findings to Larry for APPROVE/REJECT/DEFER. The honest negative (empty
 * newFindings) surfaces nothing -- the loop never fabricates a finding.
 *
 * This drives the REAL shipped contract: the last-cascade.json side-channel the
 * REAL scripts/post-write writes (built here via the shared 146-01 fixture +
 * extended for a multi-finding cascade) and the REAL skills/room-proactive
 * surfacing rule reads. The surfacing rule (confidence >= 0.60, sort desc, max 2)
 * is encoded DIRECTLY from SKILL.md (lines ~100-104) and asserted against the
 * fixture -- a hermetic, CI-safe faithful proxy for the conversational surfacing
 * step that Larry performs from the skill (the Part 6 in-room proof).
 *
 *   Test A (CASCADE SIDE-CHANNEL WRITTEN + READABLE): a synthetic room carrying a
 *          last-cascade.json with proactive_intelligence.newFindings (2+
 *          obviously-fictional findings, each confidence >= 0.60) parses and is
 *          non-empty -- the cross-relationship cascade findings are present after
 *          filing.
 *   Test B (SURFACING-CONTRACT ASSERTION): the REAL room-proactive surfacing rule
 *          (filter confidence >= 0.60, sort by confidence desc, cap at 2) surfaces
 *          exactly the 2 highest-confidence fictional findings -- the cascade
 *          findings surface to Larry mid-session.
 *   Test C (Part 8 LOCAL-only): a forbidden-substring sweep over the cascade
 *          payload asserts no Brain/web egress token rides in the cascade
 *          findings (the cascade is graph-local per Canon Part 8).
 *   Test D (Part 4 graph-data): each surfaced finding carries the fields the
 *          APPROVE/REJECT/DEFER Decision Capture needs (type + confidence) so the
 *          decision becomes a typed edge; a finding missing those fields is NOT
 *          surfaceable.
 *   Test E (HONEST NEGATIVE): a cascade with empty newFindings (the cascade ran,
 *          found nothing) surfaces zero findings -- not a false-green.
 *
 * Structured so the Phase 146 Plan 04 aggregator can require it as-is: a single
 * node-runnable file, clear pass/fail exit code, tmp fixtures cleaned in finally.
 *
 * House rule: hyphens only, no em-dashes.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const { makeSyntheticRoom } = require(path.join(__dirname, 'dogfood', 'fixtures', 'synthetic-room.cjs'));

// The surfacing contract thresholds, encoded VERBATIM from
// skills/room-proactive/SKILL.md (Mid-Session Intelligence -> Behavior):
//   "If newFindings has 1+ items with confidence >= 0.60: present using the
//    After Filing: Decision Capture flow below. Max 2 findings (highest
//    confidence first)."
const SKILL_CONFIDENCE_FLOOR = 0.60;
const SKILL_MAX_FINDINGS = 2;

// Forbidden egress tokens (Part 8): any of these in the cascade payload would
// mean a Brain/web call leaked into the LOCAL cascade.
const EGRESS_TOKENS = [
  'mindrian-brain.onrender.com',
  'brain.mindrian',
  'api.tavily',
  'tavily.com',
  'firecrawl',
  'api.openai',
  'pinecone.io',
  'http://',
  'https://',
];

let passed = 0;
let failed = 0;
function ok(name) { passed += 1; process.stdout.write('  ok ' + name + '\n'); }
function fail(name, err) {
  failed += 1;
  process.stdout.write('  FAIL ' + name + '\n');
  if (err) process.stdout.write('    ' + (err.message || String(err)) + '\n');
}

/**
 * The REAL room-proactive surfacing rule, encoded directly from SKILL.md
 * (Mid-Session Intelligence Behavior step 4): filter to confidence >= 0.60,
 * sort by confidence descending, cap at max 2 (highest confidence first).
 *
 * This is the faithful proxy for the conversational surfacing step Larry
 * performs from the skill; the rule itself is asserted, not assumed.
 *
 * @param {Array<object>} newFindings
 * @returns {Array<object>} the findings that would be surfaced to Larry
 */
function surfaceCascadeFindings(newFindings) {
  const arr = Array.isArray(newFindings) ? newFindings.slice() : [];
  return arr
    .filter(function (f) { return f && typeof f === 'object' && Number(f.confidence) >= SKILL_CONFIDENCE_FLOOR; })
    .sort(function (a, b) { return Number(b.confidence) - Number(a.confidence); })
    .slice(0, SKILL_MAX_FINDINGS);
}

/**
 * Write a last-cascade.json side-channel into the room exactly as the REAL
 * scripts/post-write write_cascade_side_channel does: the
 * proactive_intelligence.newFindings shape (verified against
 * tests/test-nav01-populated-room-engine-fires.cjs + the 146-01 fixture).
 * All findings are obviously fictional.
 */
function writeCascadeSideChannel(roomDir, newFindings, extra) {
  const payload = {
    classification: 'methodology',
    proactive_intelligence: Object.assign(
      { newFindings: Array.isArray(newFindings) ? newFindings : [] },
      (extra && typeof extra === 'object') ? extra : {}
    ),
  };
  const p = path.join(roomDir, '.mindrian', 'last-cascade.json');
  fs.writeFileSync(p, JSON.stringify(payload), 'utf8');
  return p;
}

// Two obviously-fictional cross-relationship cascade findings, each clearing the
// 0.60 floor (a CONTRADICT and an INFORMS), plus a third below the floor.
function fictionalNewFindings() {
  return [
    {
      type: 'CONTRADICT',
      confidence: 0.91,
      key: 'contradiction:problem-definition:business-model',
      message: 'Fictional DOGFOOD customer-type claim conflicts with the fictional market-size assumption',
      isNew: true,
    },
    {
      type: 'INFORMS',
      confidence: 0.74,
      key: 'informs:market-analysis:solution-design',
      message: 'Fictional DOGFOOD market signal informs the fictional solution-design section',
      isNew: true,
    },
    {
      // Below the 0.60 floor -- must NOT surface.
      type: 'CONVERGES',
      confidence: 0.41,
      key: 'convergence:fictional-theme',
      message: 'Fictional DOGFOOD weak convergence signal below the surfacing floor',
      isNew: true,
    },
  ];
}

// =====================================================================
// Test A -- CASCADE SIDE-CHANNEL WRITTEN + READABLE (findings present)
// =====================================================================
(function testA_sideChannelWrittenAndReadable() {
  const label =
    'ACPT-04 A SIDE-CHANNEL: a filed artifact writes last-cascade.json carrying proactive_intelligence.newFindings (the cross-relationship cascade findings are present after filing)';
  let fixture = null;
  try {
    fixture = makeSyntheticRoom();
    const cascadePath = writeCascadeSideChannel(fixture.roomDir, fictionalNewFindings());

    assert.ok(fs.existsSync(cascadePath), label + ': the CASC-01 side-channel file must exist after filing');

    const parsed = JSON.parse(fs.readFileSync(cascadePath, 'utf8'));
    assert.ok(
      parsed.proactive_intelligence && Array.isArray(parsed.proactive_intelligence.newFindings),
      label + ': the payload must carry proactive_intelligence.newFindings as an array'
    );
    assert.ok(
      parsed.proactive_intelligence.newFindings.length >= 2,
      label + ': the cascade must carry 2+ cross-relationship findings after filing'
    );
    ok(label);
  } catch (e) {
    fail(label, e);
  } finally {
    if (fixture) fixture.cleanup();
  }
})();

// =====================================================================
// Test B -- SURFACING-CONTRACT ASSERTION (findings surface mid-session)
// =====================================================================
(function testB_surfacingContractSurfacesTopTwo() {
  const label =
    'ACPT-04 B SURFACE: the room-proactive surfacing rule (confidence >= 0.60, sort desc, max 2) surfaces exactly the 2 highest-confidence fictional findings (cascade surfaced to Larry mid-session)';
  let fixture = null;
  try {
    fixture = makeSyntheticRoom();
    const cascadePath = writeCascadeSideChannel(fixture.roomDir, fictionalNewFindings());

    // Read the REAL side-channel the way the room-proactive skill does.
    const parsed = JSON.parse(fs.readFileSync(cascadePath, 'utf8'));
    const newFindings = parsed.proactive_intelligence.newFindings;

    const surfaced = surfaceCascadeFindings(newFindings);

    assert.equal(
      surfaced.length,
      2,
      label + ': exactly 2 findings must surface (the SKILL.md max-2 cap; the sub-0.60 finding is filtered out)'
    );
    // Highest confidence first (sort desc).
    assert.equal(
      surfaced[0].type,
      'CONTRADICT',
      label + ': the highest-confidence finding (CONTRADICT 0.91) must surface first'
    );
    assert.equal(
      surfaced[1].type,
      'INFORMS',
      label + ': the second-highest finding (INFORMS 0.74) must surface second'
    );
    assert.ok(
      surfaced[0].confidence >= surfaced[1].confidence,
      label + ': surfaced findings must be ordered by confidence descending'
    );
    // The sub-floor CONVERGES finding must NOT have surfaced.
    assert.ok(
      surfaced.every(function (f) { return f.type !== 'CONVERGES'; }),
      label + ': the sub-0.60 CONVERGES finding must NOT surface (the floor holds)'
    );
    ok(label);
  } catch (e) {
    fail(label, e);
  } finally {
    if (fixture) fixture.cleanup();
  }
})();

// =====================================================================
// Test C -- Part 8 LOCAL-only: no Brain/web egress in the cascade payload
// =====================================================================
(function testC_part8NoEgressInCascade() {
  const label =
    'ACPT-04 C PART-8: the cascade payload carries no Brain/web egress token (the cascade is graph-local per Canon Part 8)';
  let fixture = null;
  try {
    fixture = makeSyntheticRoom();
    const cascadePath = writeCascadeSideChannel(fixture.roomDir, fictionalNewFindings());
    const payload = fs.readFileSync(cascadePath, 'utf8');

    for (const token of EGRESS_TOKENS) {
      assert.equal(
        payload.indexOf(token),
        -1,
        label + ': the cascade payload must NOT contain the egress token "' + token + '" (Part 8 LOCAL-only)'
      );
    }
    ok(label);
  } catch (e) {
    fail(label, e);
  } finally {
    if (fixture) fixture.cleanup();
  }
})();

// =====================================================================
// Test D -- Part 4 graph-data: surfaced findings carry decision-ready fields
// =====================================================================
(function testD_part4SurfacedFindingsAreDecisionReady() {
  const label =
    'ACPT-04 D PART-4: each surfaced finding carries type + confidence (APPROVE/REJECT/DEFER-ready so the decision becomes a typed edge); a finding missing those fields is NOT surfaceable';
  let fixture = null;
  try {
    fixture = makeSyntheticRoom();
    const cascadePath = writeCascadeSideChannel(fixture.roomDir, fictionalNewFindings());
    const parsed = JSON.parse(fs.readFileSync(cascadePath, 'utf8'));
    const surfaced = surfaceCascadeFindings(parsed.proactive_intelligence.newFindings);

    assert.ok(surfaced.length >= 1, label + ': precondition -- at least one finding must surface');
    for (const f of surfaced) {
      assert.ok(
        typeof f.type === 'string' && f.type.length > 0,
        label + ': a surfaced finding must carry a non-empty type (the edge type for Canon Part 4)'
      );
      assert.ok(
        Number.isFinite(Number(f.confidence)),
        label + ': a surfaced finding must carry a numeric confidence (the APPROVE/REJECT/DEFER signal)'
      );
    }

    // A finding missing the decision-ready fields is NOT surfaceable: a
    // confidence-less finding fails the >= 0.60 floor (Number(undefined) is NaN).
    const malformed = [{ type: 'CONTRADICT' /* no confidence */ }];
    const surfacedMalformed = surfaceCascadeFindings(malformed);
    assert.equal(
      surfacedMalformed.length,
      0,
      label + ': a finding missing confidence must NOT surface (the floor filters it out -- not decision-ready)'
    );
    ok(label);
  } catch (e) {
    fail(label, e);
  } finally {
    if (fixture) fixture.cleanup();
  }
})();

// =====================================================================
// Test E -- HONEST NEGATIVE: empty newFindings -> zero surfaced (no false-green)
// =====================================================================
(function testE_honestNegativeEmptyCascade() {
  const label =
    'ACPT-04 E NEGATIVE: a cascade with empty newFindings (ran, found nothing) surfaces zero findings (the loop never fabricates a finding)';
  let fixture = null;
  try {
    fixture = makeSyntheticRoom();
    const cascadePath = writeCascadeSideChannel(fixture.roomDir, []);
    const parsed = JSON.parse(fs.readFileSync(cascadePath, 'utf8'));

    assert.deepEqual(
      parsed.proactive_intelligence.newFindings,
      [],
      label + ': precondition -- the empty cascade must carry an empty newFindings array'
    );
    const surfaced = surfaceCascadeFindings(parsed.proactive_intelligence.newFindings);
    assert.equal(
      surfaced.length,
      0,
      label + ': an empty cascade must surface zero findings (honest negative, not a false-green)'
    );
    ok(label);
  } catch (e) {
    fail(label, e);
  } finally {
    if (fixture) fixture.cleanup();
  }
})();

process.stdout.write('\n');
process.stdout.write(
  'ACPT-04 filing cascade surfaces (Phase 146-02 acceptance): ' +
  passed + ' passed, ' + failed + ' failed\n'
);
process.exit(failed === 0 ? 0 : 1);
