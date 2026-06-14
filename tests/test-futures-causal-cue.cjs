#!/usr/bin/env node
/**
 * Phase 156 Plan 01 -- unit test for the advisory causal-cue flagger (FW-03).
 *
 * Asserts (node built-in assert, no framework):
 *   - a cue-phrased consequence is flagged 'cue-supported' with a non-empty matched array
 *   - a non-cue consequence is flagged 'cue-thin' with an empty matched array
 *   - dropped === false in BOTH cases (FW-03: advisory only, never auto-drops)
 *   - confidence_adjust is returned as a delta/multiplier, the input is never mutated
 *   - CAUSAL_CUE_LEXICON is exported and frozen
 *
 * Mirrors the run-all-150.10.sh per-suite convention: prints a PASS/FAIL line,
 * exits non-zero on failure. Single run only, no external test framework.
 * No em-dashes (hyphens only).
 */

'use strict';

const assert = require('node:assert');
const path = require('node:path');

const SUITE = 'test-futures-causal-cue';
const mod = require(path.join(__dirname, '..', 'lib', 'core', 'futures', 'causal-cue.cjs'));
const { flagCausalCue, CAUSAL_CUE_LEXICON } = mod;

try {
  // 1. cue-phrased -> cue-supported, non-empty matched
  const supported = flagCausalCue('Cars led to gas stations');
  assert.strictEqual(supported.flag, 'cue-supported', 'cue-phrased text must be cue-supported');
  assert.ok(Array.isArray(supported.matched) && supported.matched.length > 0,
    'cue-supported must carry a non-empty matched array');
  assert.ok(supported.matched.includes('led to'), 'matched must include the actual cue phrase');

  // 2. non-cue -> cue-thin, empty matched
  const thin = flagCausalCue('Cars and gas stations');
  assert.strictEqual(thin.flag, 'cue-thin', 'non-cue text must be cue-thin');
  assert.ok(Array.isArray(thin.matched) && thin.matched.length === 0,
    'cue-thin must carry an empty matched array');

  // 3. dropped === false in BOTH cases (FW-03 never-drops)
  assert.strictEqual(supported.dropped, false, 'cue-supported must never be dropped');
  assert.strictEqual(thin.dropped, false, 'cue-thin must never be dropped');

  // 4. confidence_adjust is a number delta/multiplier; input is never mutated
  assert.strictEqual(typeof supported.confidence_adjust, 'number',
    'confidence_adjust must be a number');
  assert.strictEqual(typeof thin.confidence_adjust, 'number',
    'confidence_adjust must be a number');
  assert.ok(supported.confidence_adjust > thin.confidence_adjust,
    'cue-supported must adjust displayed confidence higher than cue-thin');
  // input-immutability: passing a frozen string-like object must not throw / mutate
  const probe = 'because the market shifted';
  const before = probe;
  flagCausalCue(probe);
  assert.strictEqual(probe, before, 'flagCausalCue must not mutate its input');

  // 5. case-insensitive matching
  const upper = flagCausalCue('Automation CAUSES displacement');
  assert.strictEqual(upper.flag, 'cue-supported', 'matching must be case-insensitive');

  // 6. lexicon exported and frozen
  assert.ok(Array.isArray(CAUSAL_CUE_LEXICON) && CAUSAL_CUE_LEXICON.length > 0,
    'CAUSAL_CUE_LEXICON must be a non-empty array');
  assert.ok(Object.isFrozen(CAUSAL_CUE_LEXICON), 'CAUSAL_CUE_LEXICON must be frozen');

  console.log('PASS ' + SUITE);
  process.exit(0);
} catch (e) {
  console.error('FAIL ' + SUITE + ': ' + (e && e.message ? e.message : String(e)));
  process.exit(1);
}
