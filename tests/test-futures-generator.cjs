#!/usr/bin/env node
/**
 * Phase 156 Plan 02 -- unit test for generateRing (FW-02).
 *
 * Asserts (node built-in assert, no framework):
 *   - ring 1 from a seed returns at most FUTURES_FANOUT_CAP children
 *   - a request for ring 4 or 7 is CLAMPED to FUTURES_DEPTH_CAP (caps clamp, not error)
 *   - per-parent children clamp to FUTURES_FANOUT_CAP on ring N>1
 *   - a ring-2 consequence carries parent_id pointing at a ring-1 consequence id
 *   - each consequence carries ring / horizon / confidence / domain / causal_cue
 *   - an invalid-domain child is skipped (advisory, never throws)
 *
 * Single run only, no external test framework. No em-dashes (hyphens only).
 */

'use strict';

const assert = require('node:assert');
const path = require('node:path');

const SUITE = 'test-futures-generator';
const orch = require(path.join(__dirname, '..', 'lib', 'core', 'futures', 'orchestrator.cjs'));
const { generateRing, FUTURES_DEPTH_CAP, FUTURES_FANOUT_CAP } = orch;

try {
  // 1. ring 1 from seed: clamp children to FUTURES_FANOUT_CAP (supply 7, expect 5)
  const sevenChildren = [];
  for (let i = 0; i < 7; i++) {
    sevenChildren.push({ label: 'consequence ' + i, horizon: 'mid', confidence: 0.6, domain: 'Economic' });
  }
  const ring1 = generateRing('AI tutoring seed', 1, [], { children: sevenChildren });
  assert.strictEqual(ring1.length, FUTURES_FANOUT_CAP, 'ring 1 must clamp children to FUTURES_FANOUT_CAP');
  for (const c of ring1) {
    assert.strictEqual(c.ring, 1, 'ring-1 consequence carries ring=1');
    assert.strictEqual(c.parent_id, null, 'ring-1 consequence has null parent_id');
    assert.ok(['near', 'mid', 'long'].includes(c.horizon), 'horizon present');
    assert.ok(typeof c.confidence === 'number', 'confidence present');
    assert.ok(typeof c.domain === 'string' && c.domain.length > 0, 'domain present');
    assert.ok(typeof c.causal_cue === 'string', 'causal_cue annotation present');
  }

  // 2. ring depth clamp: request ring 4 and ring 7 -> stamped FUTURES_DEPTH_CAP
  const parent = {
    id: 'p1', children: [{ label: 'child a leads to growth', horizon: 'long', confidence: 0.5, domain: 'Social' }],
  };
  const ring4 = generateRing('seed', 4, [parent], {});
  assert.ok(ring4.length >= 1, 'ring 4 (clamped) still expands the parent');
  assert.strictEqual(ring4[0].ring, FUTURES_DEPTH_CAP, 'ring 4 is clamped to FUTURES_DEPTH_CAP');
  const ring7 = generateRing('seed', 7, [parent], {});
  assert.strictEqual(ring7[0].ring, FUTURES_DEPTH_CAP, 'ring 7 is clamped to FUTURES_DEPTH_CAP');

  // 3. per-parent fan-out clamp on ring N>1 (supply 8 children, expect 5)
  const bigParent = { id: 'pbig', children: [] };
  for (let i = 0; i < 8; i++) {
    bigParent.children.push({ label: 'effect ' + i, horizon: 'near', confidence: 0.4, domain: 'Technological' });
  }
  const ring2big = generateRing('seed', 2, [bigParent], {});
  assert.strictEqual(ring2big.length, FUTURES_FANOUT_CAP, 'ring N>1 clamps per-parent children to FUTURES_FANOUT_CAP');

  // 4. ring-2 child carries parent_id pointing at the ring-1 parent id
  const r1 = generateRing('seed', 1, [], {
    children: [{ id: 'cause-1', label: 'a primary cause', horizon: 'mid', confidence: 0.7, domain: 'Political' }],
  });
  assert.strictEqual(r1.length, 1);
  const r1id = r1[0].id;
  const r2 = generateRing('seed', 2, [{ id: r1id, children: [
    { label: 'a secondary effect', horizon: 'long', confidence: 0.6, domain: 'Legal' },
  ] }], {});
  assert.strictEqual(r2.length, 1, 'ring-2 expands the approved parent');
  assert.strictEqual(r2[0].ring, 2, 'ring-2 consequence carries ring=2');
  assert.strictEqual(r2[0].parent_id, r1id, 'ring-2 parent_id points at the ring-1 consequence id');

  // 5. invalid-domain child is skipped (advisory, never throws)
  const mixed = generateRing('seed', 1, [], {
    children: [
      { label: 'valid one', horizon: 'mid', confidence: 0.5, domain: 'Economic' },
      { label: 'bad domain', horizon: 'mid', confidence: 0.5, domain: 'Astrological' },
      { label: 'bad confidence', horizon: 'mid', confidence: 1.7, domain: 'Social' },
    ],
  });
  assert.strictEqual(mixed.length, 1, 'invalid-domain and out-of-range children are skipped, valid kept');
  assert.strictEqual(mixed[0].label, 'valid one');

  console.log('PASS ' + SUITE);
  process.exit(0);
} catch (e) {
  console.error('FAIL ' + SUITE + ': ' + (e && e.message));
  console.error(e && e.stack);
  process.exit(1);
}
