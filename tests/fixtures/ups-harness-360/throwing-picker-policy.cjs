'use strict';
/*
 * Phase 360 Plan 05 -- R6 fault-injection preload for the not-yet-shipped
 * lib/core/room-bind-picker-policy.cjs (SPEC R6 applied to the new guard,
 * D-16 idiom, matches tests/fixtures/ups-harness-360/throwing-turn-text.cjs
 * from 360-04).
 *
 * Requires the target module by the SAME absolute path
 * scripts/intent-classifier.cjs's guard will lazy-require once 360-07 wires
 * it, inside try/catch: the module does not exist yet, so require() throws
 * MODULE_NOT_FOUND today and this stub becomes a no-op -- Node resolves the
 * filename before it ever consults the require cache, so a missing file
 * cannot be intercepted by this preload. That is exactly what keeps the
 * fault leg's RED meaningful before 360-07: the spy file records 0
 * invocations today (nothing calls the export, and this stub cannot
 * manufacture a call on its own), and exactly 1 once 360-07 lands and wires
 * the new guard through this same export.
 *
 * Once the module exists, the replacement unboundPickerSuppression appends
 * one line to process.env.SPY_OUT_360 (when set) recording the call, then
 * throws (SPEC R6, PSB-06 never-block: the production guard must swallow
 * this and fail toward today's behavior -- the picker still fires).
 *
 * This file lives only under tests/fixtures/. No production env seam is
 * added. No em-dashes.
 */

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const TARGET = path.join(REPO_ROOT, 'lib', 'core', 'room-bind-picker-policy.cjs');

try {
  const mod = require(TARGET);
  if (mod && typeof mod === 'object') {
    mod.unboundPickerSuppression = function unboundPickerSuppressionThrows() {
      try {
        const out = process.env.SPY_OUT_360;
        if (typeof out === 'string' && out.length > 0) {
          fs.appendFileSync(out, 'unboundPickerSuppression invoked\n');
        }
      } catch (_e) {
        // Swallowed: a spy-write fault must never change the injected fault's shape.
      }
      throw new Error('injected fault (R6, policy)');
    };
    module.exports = mod;
  }
} catch (_e) {
  // The module does not exist yet (RED until 360-07): there is nothing to
  // intercept. Node resolves the required filename before it ever consults
  // the require cache, so a missing file cannot be patched by this preload --
  // this is a deliberate no-op, not a bug.
}
