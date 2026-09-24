'use strict';
/*
 * Phase 360 Plan 04 -- R2's call-spy preload (D-16, D-08, RESEARCH Finding 6).
 * ================================================================================
 * R2 pins a CALL COUNT, not a bind outcome: scripts/intent-classifier.cjs's
 * consumePriorBindingAnswer lazy-requires lib/hmi/f8-action-capture-cli.cjs by
 * absolute path at :3340. Node caches module.exports per resolved path (RESEARCH
 * Pattern 3), so this stub requires the SAME real module by the SAME absolute
 * path FIRST (before the classifier's own lazy require runs) and replaces its
 * captureCliActionSet export with a spy wrapper. The classifier's later require()
 * of the identical path hits the cache and sees this patched export.
 *
 * Every invocation appends the line 'captureCliActionSet' to
 * process.env.SPY_OUT_360 (when set) BEFORE delegating to the original
 * implementation, so a leg can prove the consumer was REACHED even when the
 * ultimate bind outcome is a no-op (a harness-shaped answer that does not
 * verbatim-match any option label still reaches this call today -- see
 * 360-04-PLAN.md Task 1). Any append fault is swallowed; a spy fault must never
 * change what the wrapped call returns.
 *
 * This file lives only under tests/fixtures/. No production env seam is added.
 *
 * No em-dashes.
 */

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const TARGET = path.join(REPO_ROOT, 'lib', 'hmi', 'f8-action-capture-cli.cjs');

const mod = require(TARGET);
const original = mod.captureCliActionSet;

if (typeof original === 'function') {
  mod.captureCliActionSet = function captureCliActionSetSpy() {
    try {
      const out = process.env.SPY_OUT_360;
      if (typeof out === 'string' && out.length > 0) {
        fs.appendFileSync(out, 'captureCliActionSet\n');
      }
    } catch (_e) {
      // Swallowed: a spy-write fault must never affect the wrapped call.
    }
    return original.apply(this, arguments);
  };
}

module.exports = mod;
