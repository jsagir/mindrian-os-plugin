#!/usr/bin/env node
'use strict';

/**
 * Phase 143.3-01 -- bash-runner node entrypoint for the connector-registry
 * generator + drift tripwire.
 *
 * Re-requires lib/memory/connector-registry.test.cjs so the bash suite and the
 * Feynman suite stay in lockstep -- one implementation, two entry points, zero
 * duplication (mirrors tests/test-command-registry.cjs).
 *
 * Run: node tests/test-connector-registry.cjs   ;   exit 0 on pass.
 */

require('../lib/memory/connector-registry.test.cjs');
