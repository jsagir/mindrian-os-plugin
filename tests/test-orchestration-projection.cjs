#!/usr/bin/env node
/**
 * MindrianOS Plugin -- Phase 157-02 test entry point.
 * ===================================================
 * Re-requires the generator unit suite at
 * lib/memory/orchestration-projection.test.cjs (the connector test split idiom:
 * tests/ is the runnable entry, lib/memory/ holds the assertions). Keeps the
 * Phase 157 generator tests discoverable by the tests/ runner conventions.
 *
 * License: BSL 1.1 (Business Source License 1.1) -- see LICENSE.
 */

'use strict';

const path = require('node:path');

const suite = require(
  path.join(__dirname, '..', 'lib', 'memory', 'orchestration-projection.test.cjs')
);

if (require.main === module) {
  suite.run();
}
