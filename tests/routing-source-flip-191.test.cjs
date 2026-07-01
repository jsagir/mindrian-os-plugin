'use strict';
/*
 * Phase 191 Plan 05 (191-05, D-06) -- the router-flip integration assertion.
 * Drives the REAL decide() (lib/core/navigation-engine.cjs) with an injected
 * projection fixture (via ctx.projectionOverride, decide-projection-reader's
 * documented injection seam, the same fixture shape tests/decide-lift-wire-
 * 191.test.cjs already proves) so a canonical-verb fire_skill is emitted from
 * the Wave 2/3a lift wire, then feeds decide()'s REAL output into the REAL
 * routeActivation (lib/core/skill-activation-router.cjs) and asserts the
 * legacy -> engine flip happens at the router.
 *
 * D-06: the flip is NOT re-implemented here. routeActivation is imported and
 * called as-is; this suite is a read-only consumer of the router. The final
 * assertion below diffs skill-activation-router.cjs against HEAD and fails
 * closed if this suite (or anything else in this wave) touched it.
 *
 * Canon Part 8: every fixture is a synthetic enum/scalar shape; zero live
 * Brain / network / room bytes. House rule: hyphens only, no em-dashes.
 */

const assert = require('node:assert');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const navigationEngine = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation-engine.cjs'));
const router = require(path.join(REPO_ROOT, 'lib', 'core', 'skill-activation-router.cjs'));

const decide = navigationEngine.decide;
const routeActivation = router.routeActivation;

let pass = 0;
function ok(name, cond) {
  assert.ok(cond, name);
  console.log('  ok - ' + name);
  pass += 1;
}

// The identical fixture shape tests/decide-lift-wire-191.test.cjs already
// proves lifts /mos:causal (brain_consult -> 'Run Methodology') to fire_skill
// at 0.90 confidence, and stays advisory-only at 0.60 (below the frozen 0.70
// gate). Reused here unmodified so this suite is a router-side companion of
// that wire proof, not a re-derivation of it.
const FIXTURE_COMMAND = '/mos:causal';
const FIXTURE_FRAMEWORK = 'Root Cause Analysis';
const FIXTURE_REACH_ID = 'brain_consult';
const EXPECTED_VERB = 'Run Methodology';

function fixtureProjection() {
  return {
    nodes: [
      {
        id: 'proj-node-causal',
        kind: 'command',
        methodology_tier: 'pws',
        ranking: {},
        name: FIXTURE_COMMAND,
        reach_id: FIXTURE_REACH_ID,
        sub_mode: 'test-fixture',
        framework: FIXTURE_FRAMEWORK,
        hierarchy_rank: 1,
        posture: 'push_forward',
      },
    ],
  };
}

function packetOptionalWithConfidence(confidence) {
  return {
    local_graph_summary: {
      framework_chain_hint: {
        edges: [
          { from: FIXTURE_FRAMEWORK, to: 'Synthesis', confidence: confidence },
        ],
      },
    },
  };
}

function baseContext(confidence) {
  return {
    projectionOverride: fixtureProjection(),
    packetOptional: packetOptionalWithConfidence(confidence),
    roomState: {},
  };
}

const LEGACY_ACTIVATION = ['Devil\'s Advocate'];

// =====================================================================
// Above-gate: decide() lifts a canonical-verb fire_skill -> the router
// flips routing_source legacy -> engine (D-06, the wire proof).
// =====================================================================
(function () {
  const decision = decide({}, baseContext(0.90));
  ok('precondition: decide() lifted the canonical verb', decision.fire_skill === EXPECTED_VERB);

  const routed = routeActivation(decision, LEGACY_ACTIVATION);
  ok('router flip: source === "engine" when decide() emits the lifted canonical verb',
    routed.source === 'engine');
  ok('router flip: reason === "engine_fire_skill_set" (Precedence Rule 1)',
    routed.reason === 'engine_fire_skill_set');
  ok('router flip: activated_skills carries the canonical-cased verb',
    Array.isArray(routed.activated_skills) && routed.activated_skills.indexOf(EXPECTED_VERB) !== -1);
})();

// =====================================================================
// Below-gate: fire_skill stays null (the lift never crossed the frozen 0.70
// gate) -> the router does NOT flip to engine from the projection path.
// With no suppress_skills either, Precedence Rule 3 applies: full legacy
// fallback.
// =====================================================================
(function () {
  const decision = decide({}, baseContext(0.60));
  ok('precondition: decide() stayed advisory-only below the gate', decision.fire_skill === null);

  const routed = routeActivation(decision, LEGACY_ACTIVATION);
  ok('router NOT flipped: source is NOT "engine" when the lift stayed below-gate',
    routed.source !== 'engine');
  ok('router NOT flipped: source is "legacy" or "mixed" (Precedence Rule 2/3)',
    routed.source === 'legacy' || routed.source === 'mixed');
  ok('router NOT flipped: legacy activation passes through unmodified',
    JSON.stringify(routed.activated_skills) === JSON.stringify(LEGACY_ACTIVATION));
})();

// =====================================================================
// D-06 assert-not-reimplement: skill-activation-router.cjs is byte-unchanged
// on disk relative to the git index/HEAD. Wave 4 (and this suite) is a
// read-only consumer of routeActivation; it never edits the router.
// =====================================================================
(function () {
  let diffStat = '';
  try {
    diffStat = execFileSync('git', ['diff', '--stat', '--', 'lib/core/skill-activation-router.cjs'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    }).trim();
  } catch (_e) {
    diffStat = '(git diff unavailable)';
  }
  ok('D-06: lib/core/skill-activation-router.cjs is byte-unchanged (git diff --stat empty)',
    diffStat === '');
})();

console.log('');
console.log('PASS ' + pass + ' assertions');
console.log('>>> routing-source-flip-191.test.cjs: PASSED');
process.exit(0);
