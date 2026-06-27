'use strict';
/*
 * Phase 183-01 METER-01 canonical FLOOR test for the EVENT_TYPES Set. Mirrors the
 * entry-31 floor idiom (tests/test-canon-entry-31-two-gauge-floor.cjs) and the
 * room-lineage floor idiom (tests/test-edges-room-lineage-floor.cjs): assert the new
 * additive member is present AND the full prior named FLOOR is preserved, and that
 * the Set stays frozen. NEVER assert a raw member count -- a future additive
 * member must not false-fail this floor (the additive-only contract).
 *
 * RED until Task 2 adds gate_reached; GREEN after.
 *
 * Canon Part 8: zero Brain / network. House rule: hyphens only, no em-dashes.
 */

const assert = require('node:assert');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const { EVENT_TYPES } = require(
  path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'memory-events.cjs')
);

let pass = 0;
function ok(name, cond) { assert.ok(cond, name); console.log('  ok - ' + name); pass++; }

// the new additive member (METER-01).
ok('gate_reached is present', EVENT_TYPES.has('gate_reached'));

// the full prior named FLOOR is preserved -- the closed-set members the meter is
// built on plus a representative cross-section of the long-standing taxonomy. Named
// membership only, never a raw count, so a future additive member is safe.
const FLOOR = [
  'reach_presented',
  'framework_invoked',
  'f_selector_decision',
  'status_promoted',
  'feynman_timeline_refreshed',
  'node_created',
  'focus_changed',
];
for (const t of FLOOR) {
  ok('prior floor member preserved: ' + t, EVENT_TYPES.has(t));
}

// the Set stays frozen (additive-only constitutional contract).
ok('EVENT_TYPES is frozen', Object.isFrozen(EVENT_TYPES));

// a made-up type is rejected by the closed allow-list (negative control).
ok('a fabricated event type is NOT a member', !EVENT_TYPES.has('gate_reached_totally_made_up'));

console.log('');
console.log('PASS ' + pass + ' assertions');
console.log('>>> test-meter-event-types-floor.cjs: PASSED');
