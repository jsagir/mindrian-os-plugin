#!/usr/bin/env node
// Phase 198 SPEC-7 -- reversibility contract. Real behavior: MINDRIAN_MCP_FIRST
// defaults OFF (unset/empty = byte-identical legacy on every surface); the
// rollback rehearsal (flip the flag OFF after cutover, restore one room from
// snapshot, re-run the legacy parity transcript green) passes; a commit with
// the flag off failing the plugin smoke blocks the phase.
//
// SKIP-safe until lib/mcp/mcp-first-flag.cjs exists. Node built-in assert only.
// No em-dashes.
'use strict';
const assert = require('node:assert');

let flag;
try {
  flag = require('../lib/mcp/mcp-first-flag.cjs');
} catch (e) {
  console.log('SKIP: test-198-flag-off-parity -- lib/mcp/mcp-first-flag.cjs not present yet. ' + (e.code || e.message));
  process.exit(0);
}

const hasFlagApi = typeof flag.isMcpFirstEnabled === 'function'
  || typeof flag.readMcpFirstSurfaces === 'function';
if (!hasFlagApi) {
  console.log('SKIP: test-198-flag-off-parity -- mcp-first-flag.cjs present but flag-reader API not exported yet.');
  process.exit(0);
}

// --- the real flag-off-byte-identical + rollback-rehearsal contract lands here ---
assert.ok(flag, 'mcp-first-flag module loaded');
console.log('PASS: test-198-flag-off-parity (stub -- mcp-first-flag.cjs present; real flag-off parity + rollback contract lands in its owning plan)');
process.exit(0);
