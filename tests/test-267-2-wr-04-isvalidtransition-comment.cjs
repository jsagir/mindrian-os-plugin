'use strict';
// Phase 267.2 code review fix WR-04 -- isValidTransition is dead code (never
// called anywhere in main()'s dispatch chain), but a comment at the top of
// the investment leg credited "PHASES/isValidTransition" with enforcing that
// 'reward_delivered' can only be reached via the fire/drain legs. The real
// enforcement is provided by construction of main()'s own if/else dispatch
// chain, not by isValidTransition. Lower-risk fix chosen over wiring
// isValidTransition into main() as a live guard (main() legitimately writes
// several same-phase transitions, e.g. the drain retry loop re-persists
// phase: 'reward_pending' across turns, which isValidTransition's strict
// "toIdx === fromIdx + 1" rule would reject -- wiring it in as a blanket
// guard risks breaking those legitimate same-phase writes, a bigger and
// riskier change than correcting a misleading comment).
//
// This test pins the two facts the fix establishes: the misleading credit
// string is gone from the source, and isValidTransition's own behavior and
// export are unchanged (this was a documentation fix, not a behavior
// change).
//
// No em-dashes. Plain node:assert/strict.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROUTER_PATH = path.join(__dirname, '..', 'scripts', 'first-install-router.cjs');

let n = 0;
function ok(desc, fn) { fn(); n += 1; console.log('  ok   ' + desc); }

console.log('test-267-2-wr-04-isvalidtransition-comment');

ok('WR-04 FIXED: the router source no longer credits "PHASES/isValidTransition" with '
  + 'enforcing the reward_delivered reachability guarantee', function () {
  const src = fs.readFileSync(ROUTER_PATH, 'utf8');
  assert.equal(
    src.indexOf('PHASES/isValidTransition enforce'),
    -1,
    'WR-04 REGRESSED: the misleading "PHASES/isValidTransition enforce" phrase is back in '
      + 'scripts/first-install-router.cjs -- isValidTransition is still never called by '
      + "main()'s dispatch (see the next assertion), so this credit is false",
  );
});

ok('main()\'s dispatch still never calls isValidTransition( -- confirms the comment fix matches reality '
  + '(if this ever goes false because isValidTransition WAS wired in as a real guard, the comment '
  + 'fixed here should be revisited to credit it again, not just left stale)', function () {
  const src = fs.readFileSync(ROUTER_PATH, 'utf8');
  const mainStart = src.indexOf('function main()');
  assert.notEqual(mainStart, -1, 'sanity: function main() not found');
  const mainBody = src.slice(mainStart);
  assert.equal(
    mainBody.indexOf('isValidTransition('),
    -1,
    'main() now calls isValidTransition( -- if this is intentional (the "wire it in" branch '
      + 'of WR-04\'s fix options), the disclaimer comments this test also pins should be '
      + 'updated to credit it again instead of describing it as unused',
  );
});

ok('isValidTransition itself is unchanged behavior: true only for the single legal next phase', function () {
  delete require.cache[require.resolve(ROUTER_PATH)];
  // Requiring the router in-process attaches its own top-level uncaughtException handler to
  // THIS test process (documented hazard, see test-267-2-user-md-roundtrip.cjs's header) --
  // acceptable here ONLY because this is the last assertion in this file and it makes no
  // further assertions that a swallowed exception could hide.
  const router = require(ROUTER_PATH);
  assert.deepEqual(router.PHASES, [
    'armed', 'routed', 'reward_pending', 'reward_delivered', 'investment_asked', 'done',
  ]);
  assert.equal(router.isValidTransition('armed', 'routed'), true);
  assert.equal(router.isValidTransition('routed', 'reward_pending'), true);
  assert.equal(router.isValidTransition('armed', 'reward_pending'), false, 'skipping a phase must be invalid');
  assert.equal(router.isValidTransition('routed', 'routed'), false, 'a same-phase write is not a "transition"');
  assert.equal(router.isValidTransition('bogus', 'armed'), false, 'an unknown fromPhase must be invalid');
});

console.log('\nPASS test-267-2-wr-04-isvalidtransition-comment (' + n + ' assertions)');
