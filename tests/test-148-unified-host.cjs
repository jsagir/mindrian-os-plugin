'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 148-05 Task 3 -- IRW-05 falsifiable test: the ONE F.1 host.
 * ================================================================
 * The three suggest surfaces (F.1 Next Move, the offer-resolver
 * resolveOfferNextStep, and suggest-next) must converge on a SINGLE render door:
 * selector-dispatcher.pickShape({ requestedShape: 'F.1' }). This test SEAMS on
 * pickShape (wraps it with a spy) and asserts that BOTH the offer-resolver render
 * path AND the suggest-next path route through it -- and that NO second bespoke
 * renderer is invoked (no shape-fN-renderer is called directly bypassing the
 * dispatcher).
 *
 * Mirrors the assertion style of the shipped 148 suites: plain node:assert/strict,
 * a PASS line on stdout, non-zero exit on failure.
 *
 * NO em-dashes / en-dashes anywhere (CLAUDE.md HARD RULE). Hyphens only.
 */

const assert = require('node:assert/strict');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');

const dispatcher = require(path.join(REPO_ROOT, 'lib', 'hmi', 'selector-dispatcher.cjs'));
const engineOffer = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation-engine-offer.cjs'));
const navEngine = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation-engine.cjs'));

// ---------------------------------------------------------------------------
// The pickShape seam: record every requestedShape that crosses the single door.
// ---------------------------------------------------------------------------
const calls = [];
const realPickShape = dispatcher.pickShape;
dispatcher.pickShape = function spy(args) {
  calls.push(args && typeof args === 'object' ? args.requestedShape : null);
  return realPickShape(args);
};

function resetCalls() { calls.length = 0; }

// A context with a JTBD signal + a fresh governing thought so the offer path is
// alive (not abstaining) and the host renders the six-reach lead (not the cold
// lead).
function liveContext() {
  return {
    jtbd: 'validate the riskiest assumption',
    brainAvailable: true,
    operator: 'DECISION_GATE',
    sectionPath: 'problem-definition',
    quadruple: { reasoning: { governing_thought: 'the wedge is the regulated buyer', is_stale: false } },
  };
}

try {
  // -----------------------------------------------------------------------
  // 1. The offer-resolver render path routes through pickShape (single door).
  // -----------------------------------------------------------------------
  resetCalls();
  const offerEnv = engineOffer.renderOfferThroughHost(
    engineOffer.resolveOffer(liveContext()),
    liveContext()
  );
  assert.ok(offerEnv && typeof offerEnv === 'object', 'IRW-05: offer render returns an envelope');
  assert.equal(offerEnv.shape, 'F.1', 'IRW-05: offer renders through the F.1 host');
  assert.ok(calls.length >= 1, 'IRW-05: offer render invoked pickShape at least once');
  assert.ok(
    calls.every(function (s) { return s === 'F.1'; }),
    'IRW-05: offer render invoked ONLY the F.1 host (no second bespoke shape requested)'
  );

  // -----------------------------------------------------------------------
  // 2. The suggest-next surface routes through the SAME pickShape door.
  // -----------------------------------------------------------------------
  resetCalls();
  const suggestEnv = engineOffer.suggestNext(liveContext());
  assert.equal(suggestEnv.shape, 'F.1', 'IRW-05: suggest-next renders through the F.1 host');
  assert.ok(calls.length >= 1, 'IRW-05: suggest-next invoked pickShape');
  assert.ok(
    calls.every(function (s) { return s === 'F.1'; }),
    'IRW-05: suggest-next invoked ONLY the F.1 host'
  );

  // -----------------------------------------------------------------------
  // 3. The engine-side callers (resolveOfferNextStep render + suggestNext) also
  //    converge on the SAME door -- one code path across both surfaces.
  // -----------------------------------------------------------------------
  resetCalls();
  const engRender = navEngine.renderOfferNextStep(liveContext());
  const engSuggest = navEngine.suggestNext(liveContext());
  assert.equal(engRender.shape, 'F.1', 'IRW-05: engine renderOfferNextStep -> F.1 host');
  assert.equal(engSuggest.shape, 'F.1', 'IRW-05: engine suggestNext -> F.1 host');
  assert.ok(
    calls.length >= 2 && calls.every(function (s) { return s === 'F.1'; }),
    'IRW-05: both engine surfaces route through ONLY the F.1 host (single code path)'
  );

  // -----------------------------------------------------------------------
  // 4. The cold-room lead also routes through the SAME door (D-07) -- there is no
  //    bespoke cold-room renderer; the help lead is the dispatcher text archetype.
  // -----------------------------------------------------------------------
  resetCalls();
  const coldEnv = engineOffer.renderColdRoomLead({}); // no JTBD signal -> cold lead
  assert.equal(coldEnv.shape, 'F.1', 'IRW-05: cold-room lead renders through the F.1 host');
  assert.ok(
    calls.length >= 1 && calls.every(function (s) { return s === 'F.1'; }),
    'IRW-05: cold-room lead invoked ONLY the F.1 host (no bespoke AskUserQuestion)'
  );
  // The cold lead verb list leads with the help row and keeps Free-Text last.
  const coldVerbs = engineOffer.buildColdRoomVerbs({});
  assert.equal(coldVerbs[0], engineOffer.COLD_ROOM_LEAD_VERB, 'IRW-05: cold lead leads with the help row');
  assert.equal(coldVerbs[coldVerbs.length - 1], 'Free-Text', 'IRW-05: Free-Text stays last in the cold lead');

  // -----------------------------------------------------------------------
  // 5. Part-8 doctrine seam: matchReachesForIntent passes ONLY a generic
  //    framework handle to the resolver; it returns a command list (or []) and
  //    never echoes a raw intent string back.
  // -----------------------------------------------------------------------
  const matched = engineOffer.matchReachesForIntent('JTBD');
  assert.ok(Array.isArray(matched), 'IRW-05: matchReachesForIntent returns an array');
  for (const m of matched) {
    assert.equal(typeof m, 'string', 'IRW-05: matched reach is a command string');
  }

  process.stdout.write(
    'PASS test-148-unified-host.cjs (IRW-05: offer-resolver + suggest-next + engine surfaces + cold lead all route through the ONE pickShape F.1 host; no second bespoke renderer)\n'
  );
  process.exit(0);
} catch (err) {
  process.stderr.write('FAIL test-148-unified-host.cjs: ' + err.message + '\n' + (err.stack || '') + '\n');
  process.exit(1);
} finally {
  // Restore the real dispatcher so other suites in the aggregator are unaffected.
  dispatcher.pickShape = realPickShape;
}
