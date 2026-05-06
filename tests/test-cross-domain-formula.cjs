'use strict';
// Phase 117-00 Wave 0 stub for AUTOEXPLORE-117-14 (Brain §8.3 cross-domain formula).
// Per RESEARCH §8.3: surprise = similarity * domain_distance.
// Gate: cosine > threshold AND different_domains. Default threshold 0.85
// (matches Phase 89-07 dedup gate).
// Production assertions in Wave 1 (117-02) when cross-domain match composer lands:
//   - exact formula: surprise = similarity * domain_distance
//   - gate: cosine > threshold AND different_domains
//   - threshold default = 0.85
//   - same-domain pairs filtered out
//   - zero-similarity returns null
//   - commutative match (a*b == b*a)
//   - deterministic
//   - canonical-formula citation comment present in source

const test = require('node:test');
const assert = require('node:assert/strict');
const { EVENT_TYPES } = require('../lib/core/navigation/memory-events.cjs');

test('117-00 substrate: AUTOEXPLORE-117-14 cross-domain-formula Wave 0 placeholder', () => {
  assert.equal(EVENT_TYPES.has('auto_explore_fired'), true);
});
