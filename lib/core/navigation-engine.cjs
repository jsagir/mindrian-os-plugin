#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 91-00 -- Navigation Engine (RED stub)
 *
 * This is a placeholder that satisfies require() so the test runner can
 * exercise tests 11-33 in their failing state. The GREEN implementation
 * lands in the next commit.
 *
 * License: BSL 1.1.
 */

const shared = require('./navigation-engine-shared.cjs');

function decide(_turn, _context) {
  return shared.emptyDecision();
}

module.exports = { decide: decide };
