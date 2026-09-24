'use strict';
/*
 * Phase 360 Plan 04 -- R6 fault-injection preload: the classifier's export
 * THROWS (D-16, D-06, SPEC R6, PSB-06 never-block).
 * ================================================================================
 * Requires lib/hmi/turn-text.cjs by the SAME absolute path
 * scripts/intent-classifier.cjs will lazy-require once D-06's harnessVerdict
 * helper lands (360-07), and replaces classifyUserPromptText with a function
 * that records the call (one line appended to process.env.SPY_OUT_360, when
 * set) and then throws. The replacement is installed even when the real export
 * does not exist yet on the required module object, so the 360-04 RED leg is
 * meaningful before 360-06 ships the export: the assignment itself never
 * throws, only the call does, once something calls it.
 *
 * D-06 requires harnessVerdict to swallow ANY throw and return false (fail
 * toward today's non-harness behavior, never a block). This stub is what
 * proves that contract holds under a real thrown fault, not just a missing
 * module.
 *
 * This file lives only under tests/fixtures/. No production env seam is added.
 *
 * No em-dashes.
 */

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const TARGET = path.join(REPO_ROOT, 'lib', 'hmi', 'turn-text.cjs');

const mod = require(TARGET);

mod.classifyUserPromptText = function classifyUserPromptTextThrows() {
  try {
    const out = process.env.SPY_OUT_360;
    if (typeof out === 'string' && out.length > 0) {
      fs.appendFileSync(out, 'classifyUserPromptText invoked\n');
    }
  } catch (_e) {
    // Swallowed: a spy-write fault must never change the injected fault's shape.
  }
  throw new Error('injected fault (R6)');
};

module.exports = mod;
