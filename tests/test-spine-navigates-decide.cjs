'use strict';
// CASC-02 (Phase 142) -- loop-fires acceptance: the Phase 109 spine NAVIGATES
// the local graph for routing, not merely stores it.
//
// This asserts decide() reflects the NAVIGATED neighborhood (a trace field
// populated from getRoomContext / getNeighborhood ranking), NOT just that an
// edge is present in storage. Plan 02 adds the context.roomContext leg + the
// decision_trace field that mirrors it.
//
// HARD boundary with Phase 144: CASC-02 navigates but does NOT flip
// routing_source. The trace's routing_source MUST stay 'legacy' (or absent ->
// treated as legacy). Flipping legacy -> engine is Phase 144 (NAV-01) and is
// out of scope here. This suite fences that: it asserts routing_source is NOT
// 'engine'.
//
// The read path goes through the navigation.cjs chokepoint (Canon Part 9): the
// caller owns the fixture db and passes the getRoomContext output into decide()
// via context. decide() must surface a navigated-neighborhood trace field.
//
// RED now: the decision_trace has no neighborhood field and decide() ignores a
// roomContext leg, so the navigated-neighborhood assertion fails. Once Plan 02
// wires getRoomContext -> decide(), the field populates and this goes GREEN.
//
// House rule: hyphens only, no em-dashes.

const assert = require('node:assert/strict');
const path = require('node:path');

let buildFixtureDb;
try {
  ({ buildFixtureDb } = require(path.join(__dirname, 'fixtures', 'room-142-fixture.cjs')));
} catch (e) {
  process.stdout.write('SKIP test-spine-navigates-decide.cjs (fixture unavailable: ' + e.message + ')\n');
  process.exit(77);
}

let navigation;
let engine;
try {
  navigation = require(path.join(__dirname, '..', 'lib', 'core', 'navigation.cjs'));
  engine = require(path.join(__dirname, '..', 'lib', 'core', 'navigation-engine.cjs'));
} catch (e) {
  process.stdout.write('SKIP test-spine-navigates-decide.cjs (module load failed: ' + e.message + ')\n');
  process.exit(77);
}

let passed = 0;
let failed = 0;
function ok(name) { passed += 1; process.stdout.write('  ok ' + name + '\n'); }
function fail(name, err) {
  failed += 1;
  process.stdout.write('  FAIL ' + name + '\n');
  if (err) process.stdout.write('    ' + (err.message || String(err)) + '\n');
}

async function test_spineNavigates() {
  const label = 'CASC-02: decide() reflects the navigated neighborhood (getRoomContext leg)';
  const db = buildFixtureDb();
  try {
    // Build the navigated neighborhood via the Phase 141 chokepoint (caller owns
    // the db handle). getRoomContext fuses home-view RAW + windowed session
    // history + getNeighborhood graph-ranking. getRoomContext is ASYNC (Leg B
    // windows the stored session history via an awaited getSessionHistory), so the
    // caller awaits the RESOLVED fusion object before threading it onto context --
    // exactly the Task-1 contract in runNavigationEngine (the getRoomContext await
    // lives inside the deriveConversationSeed().then() race envelope). decide() is
    // synchronous and consumes the resolved object, never a bare Promise.
    assert.equal(typeof navigation.getRoomContext, 'function',
      label + ': navigation.getRoomContext must be exported (Phase 141 chokepoint)');

    const roomContext = await navigation.getRoomContext(db, 'room:fixture-room', {
      focusNodeId: 'section:market-analysis',
      section: 'market-analysis',
    });
    assert.ok(roomContext && typeof roomContext === 'object',
      label + ': getRoomContext must return a fusion object');

    // The turn + context the per-turn hook would assemble. context.roomContext
    // is the new leg Plan 02 threads into decide().
    const turn = { userText: 'What do we know about the market?', sectionPath: 'market-analysis', sessionId: 'casc02-test' };
    const context = {
      brainAvailable: false,
      roomContext: roomContext,
      userPersona: { archetype: 'Founder', problem_type: 'IDP', venture_stage: 'exploration' },
      intentSignal: { intent: 'navigate_graph', confidence: 0.5 },
    };

    const decision = engine.decide(turn, context);
    assert.ok(decision && decision.decision_trace, label + ': decide() must return a decision with a trace');
    const trace = decision.decision_trace;

    // FENCE (Phase 144 boundary): routing_source must NOT be flipped to 'engine'.
    assert.notEqual(trace.routing_source, 'engine',
      label + ': routing_source must stay legacy (the legacy->engine flip is Phase 144, NOT CASC-02)');

    // THE LOOP-FIRES ASSERTION: a navigated-neighborhood trace field, populated
    // from getNeighborhood ranking (not just stored-edge presence). Plan 02 adds
    // trace.navigated_neighborhood (a ranked, non-empty neighborhood reflecting
    // the CONTRADICTS edge between the two seeded claims).
    assert.ok(
      Object.prototype.hasOwnProperty.call(trace, 'navigated_neighborhood'),
      label + ': decision_trace must carry a navigated_neighborhood field ' +
      '(RED until Plan 02 wires getRoomContext -> decide())'
    );
    const nn = trace.navigated_neighborhood;
    assert.ok(nn && typeof nn === 'object',
      label + ': navigated_neighborhood must be an object reflecting the ranked graph walk');
    assert.ok(Array.isArray(nn.ranked) && nn.ranked.length > 0,
      label + ': navigated_neighborhood.ranked must be NON-EMPTY (the seeded CONTRADICTS neighborhood navigated, not just stored)');

    ok(label);
  } catch (e) {
    fail(label, e);
  } finally {
    db.close();
  }
}

test_spineNavigates().then(function () {
  process.stdout.write('\n');
  process.stdout.write('CASC-02 loop-fires (spine navigates): ' + passed + ' passed, ' + failed + ' failed\n');
  process.exit(failed === 0 ? 0 : 1);
}).catch(function (e) {
  process.stdout.write('\nUNCAUGHT: ' + (e && e.message ? e.message : String(e)) + '\n');
  process.exit(1);
});
