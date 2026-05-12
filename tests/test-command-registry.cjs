#!/usr/bin/env node
'use strict';

/**
 * Phase 122-02 -- bash-runner node entrypoint for the command-registry
 * generator + drift tripwire.
 *
 * This is the file tests/run-all-122.sh (the scoped 122 runner) targets. It
 * re-requires lib/memory/command-registry.test.cjs so the bash suite and the
 * Feynman suite (lib/memory/run-feynman-tests.cjs, which also registers that
 * file) stay in lockstep -- one implementation, two entry points, zero
 * duplication.
 *
 * Run: node tests/test-command-registry.cjs   ;   exit 0 on pass.
 */

require('../lib/memory/command-registry.test.cjs');
