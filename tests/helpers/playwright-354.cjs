'use strict';
/*
 * tests/helpers/playwright-354.cjs -- Phase 354-01 Task 2: shared Playwright
 * resolver for every Phase 354 browser test.
 *
 * resolvePlaywright() tries, in order:
 *   1. require('playwright')                            -- a normal local dep
 *   2. process.env.MINDRIAN_PLAYWRIGHT_PATH               -- explicit override
 *   3. path.join(os.homedir(), 'node_modules', 'playwright') -- this box's
 *      known install location (the same hard-coded path
 *      docs/reviews/phase-354-probes/browser.cjs used directly; this
 *      resolver replaces that hard-code with a fallback chain)
 *
 * Returns the resolved module, or null if none of the three resolve. NEVER
 * installs anything: no `npm`, no `npx`, no child_process spawn of any
 * installer. A null return means the calling browser test must print
 * `ENV GAP: playwright unavailable` and exit SKIP_EXIT_CODE (77), never
 * silently pass and never silently fail.
 *
 * CJS, no third-party dependencies of its own. Hyphens only, no em-dashes.
 */

const os = require('node:os');
const path = require('node:path');

function resolvePlaywright() {
  try {
    return require('playwright');
  } catch (_e) {
    // fall through to the next resolution strategy
  }

  const envPath = process.env.MINDRIAN_PLAYWRIGHT_PATH;
  if (typeof envPath === 'string' && envPath.length > 0) {
    try {
      return require(envPath);
    } catch (_e) {
      // fall through to the last resolution strategy
    }
  }

  const homePath = path.join(os.homedir(), 'node_modules', 'playwright');
  try {
    return require(homePath);
  } catch (_e) {
    return null;
  }
}

module.exports = { resolvePlaywright };
