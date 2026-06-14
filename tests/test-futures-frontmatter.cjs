#!/usr/bin/env node
/**
 * Phase 156 Plan 01 -- unit test for validateConsequenceFrontmatter (FW-04).
 *
 * Asserts (node built-in assert, no framework):
 *   - accepts a valid object { horizon:'mid', confidence:0.7, domain:'Economic' }
 *   - rejects an out-of-enum horizon
 *   - rejects confidence 1.5 (above range) AND confidence -0.1 (below range)
 *     -- BOTH bounds, proving range not just enum
 *   - rejects an out-of-enum domain
 *   - exports the frozen HORIZON_ENUM + PESTEL_DOMAIN_ENUM + the caps
 *
 * Mirrors the run-all-150.10.sh per-suite convention: prints a PASS/FAIL line,
 * exits non-zero on failure. Single run only, no external test framework.
 * No em-dashes (hyphens only).
 */

'use strict';

const assert = require('node:assert');
const path = require('node:path');

const SUITE = 'test-futures-frontmatter';
const orch = require(path.join(__dirname, '..', 'lib', 'core', 'futures', 'orchestrator.cjs'));
const {
  validateConsequenceFrontmatter,
  HORIZON_ENUM,
  PESTEL_DOMAIN_ENUM,
  FUTURES_DEPTH_CAP,
  FUTURES_FANOUT_CAP,
} = orch;

try {
  // 1. valid object accepted
  const ok = validateConsequenceFrontmatter({ horizon: 'mid', confidence: 0.7, domain: 'Economic' });
  assert.strictEqual(ok.valid, true, 'a fully-valid frontmatter object must validate');
  assert.ok(Array.isArray(ok.errors) && ok.errors.length === 0, 'valid object must carry zero errors');

  // 2. out-of-enum horizon rejected
  const badHorizon = validateConsequenceFrontmatter({ horizon: 'eventually', confidence: 0.5, domain: 'Social' });
  assert.strictEqual(badHorizon.valid, false, 'out-of-enum horizon must be rejected');

  // 3a. confidence above 1.0 rejected (range, not enum)
  const tooHigh = validateConsequenceFrontmatter({ horizon: 'near', confidence: 1.5, domain: 'Legal' });
  assert.strictEqual(tooHigh.valid, false, 'confidence 1.5 (above 1.0) must be rejected');

  // 3b. confidence below 0.0 rejected (range, not enum)
  const tooLow = validateConsequenceFrontmatter({ horizon: 'long', confidence: -0.1, domain: 'Political' });
  assert.strictEqual(tooLow.valid, false, 'confidence -0.1 (below 0.0) must be rejected');

  // 4. out-of-enum domain rejected
  const badDomain = validateConsequenceFrontmatter({ horizon: 'mid', confidence: 0.6, domain: 'Cultural' });
  assert.strictEqual(badDomain.valid, false, 'out-of-enum domain must be rejected');

  // 5. enums are the exact frozen sets
  assert.deepStrictEqual(HORIZON_ENUM, ['near', 'mid', 'long'], 'HORIZON_ENUM must be the exact set');
  assert.deepStrictEqual(
    PESTEL_DOMAIN_ENUM,
    ['Political', 'Economic', 'Social', 'Technological', 'Environmental', 'Legal'],
    'PESTEL_DOMAIN_ENUM must be the exact set'
  );
  assert.ok(Object.isFrozen(HORIZON_ENUM), 'HORIZON_ENUM must be frozen');
  assert.ok(Object.isFrozen(PESTEL_DOMAIN_ENUM), 'PESTEL_DOMAIN_ENUM must be frozen');

  // 6. caps are the documented defaults
  assert.strictEqual(FUTURES_DEPTH_CAP, 3, 'FUTURES_DEPTH_CAP default must be 3');
  assert.strictEqual(FUTURES_FANOUT_CAP, 5, 'FUTURES_FANOUT_CAP default must be 5');

  console.log('PASS ' + SUITE);
  process.exit(0);
} catch (e) {
  console.error('FAIL ' + SUITE + ': ' + (e && e.message ? e.message : String(e)));
  process.exit(1);
}
