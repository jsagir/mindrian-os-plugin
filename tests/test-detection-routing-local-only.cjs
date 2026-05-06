'use strict';
// Phase 117-00 Wave 0 stub for AUTOEXPLORE-117-17 (Brain §8.7 LOCAL-only detection routing).
// Per RESEARCH §8.7: detection rules are LOCAL-only. Zero ADDRESSES_PROBLEM_TYPE
// Brain calls in lib/agents/auto-explore-agent.cjs.
// Production assertions in Wave 2 (117-04) when sanitizer + auto-explore-agent land:
//   - zero ADDRESSES_PROBLEM_TYPE strings in lib/agents/auto-explore-agent.cjs
//   - detection rules entirely in LOCAL code
//   - Brain reachability check does NOT gate detection
//   - Mode A fallback does NOT delegate is-domain-analyzable to Brain
//   - Canon Part 8 substring scan on detection module returns 0

const test = require('node:test');
const assert = require('node:assert/strict');
const { EVENT_TYPES } = require('../lib/core/navigation/memory-events.cjs');

test('117-00 substrate: AUTOEXPLORE-117-17 LOCAL-only-routing Wave 0 placeholder', () => {
  assert.equal(EVENT_TYPES.has('auto_explore_fired'), true);
});
