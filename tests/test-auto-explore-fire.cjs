'use strict';
// Phase 117-00 Wave 0 stub for AUTOEXPLORE-117-04 (auto-invocation detached spawn).
// Production assertions in Wave 1 (117-02) when lib/agents/auto-explore-agent.cjs lands:
//   - detached spawn from PostToolUse hook
//   - parent unref's child (no zombie)
//   - child writes results to room/.mindrian/auto-explore-*.json
//   - timeout handling (kill child after N seconds)
//   - partial-pipeline graceful degradation (one of 3 sources empty)
//   - brain-baseline gating (Mode A vs Mode B vs Tier 0)

const test = require('node:test');
const assert = require('node:assert/strict');
const { EVENT_TYPES } = require('../lib/core/navigation/memory-events.cjs');

test('117-00 substrate: auto_explore_fired registered for detached-spawn telemetry', () => {
  assert.equal(EVENT_TYPES.has('auto_explore_fired'), true);
});
