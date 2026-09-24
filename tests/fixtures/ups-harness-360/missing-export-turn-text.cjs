'use strict';
/*
 * Phase 360 Plan 04 -- R6 fault-injection preload: the classifier's export is
 * MISSING (D-16, D-06, SPEC R6, PSB-06 never-block).
 * ================================================================================
 * Requires lib/hmi/turn-text.cjs by the SAME absolute path
 * scripts/intent-classifier.cjs will lazy-require once D-06's harnessVerdict
 * helper lands (360-07), then defines classifyUserPromptText as an accessor
 * that records every ACCESS (one line appended to process.env.SPY_OUT_360,
 * when set) and always returns undefined -- simulating a shipped module that
 * silently dropped the export (as opposed to throwing-turn-text.cjs's throw).
 * D-06's harnessVerdict must treat an "unrecognized shape" (not exactly the
 * string 'harness') identically to a throw: fail toward false (never a block).
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

Object.defineProperty(mod, 'classifyUserPromptText', {
  configurable: true,
  enumerable: true,
  get() {
    try {
      const out = process.env.SPY_OUT_360;
      if (typeof out === 'string' && out.length > 0) {
        fs.appendFileSync(out, 'classifyUserPromptText accessed\n');
      }
    } catch (_e) {
      // Swallowed: a spy-write fault must never change the missing-export shape.
    }
    return undefined;
  },
});

module.exports = mod;
