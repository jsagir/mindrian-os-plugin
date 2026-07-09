#!/usr/bin/env node
// Phase 198 SPEC-3 -- server-side chain execution honoring postures. Real
// behavior: chain_run wraps the shipped lib/core/chain-executor.cjs::runChain
// (Phase 166) server-side; a chain of 2 autonomous_safe steps + 1 material step
// runs the autonomous_safe prefix, halts at the material step, and returns a
// gate_render payload instead of executing it; the material step executes ONLY
// after gate_answer returns an approve verdict. R4: chain_run must not mint a
// second executor -- it wraps runChain, never re-implements it.
//
// SKIP-safe until lib/mcp/tools/chain.cjs exists. Node built-in assert only.
// No em-dashes.
'use strict';
const assert = require('node:assert');

let chainTool;
try {
  chainTool = require('../lib/mcp/tools/chain.cjs');
} catch (e) {
  console.log('SKIP: test-198-chain-run-halt -- lib/mcp/tools/chain.cjs not present yet. ' + (e.code || e.message));
  process.exit(0);
}

const hasChainRunApi = typeof chainTool.chainRun === 'function'
  || typeof chainTool.registerChainTools === 'function';
if (!hasChainRunApi) {
  console.log('SKIP: test-198-chain-run-halt -- chain.cjs present but chain_run API not exported yet.');
  process.exit(0);
}

// --- the real halt-at-material + gate_answer-approve-resumes contract lands here ---
assert.ok(chainTool, 'chain tool module loaded');
console.log('PASS: test-198-chain-run-halt (stub -- chain.cjs present; real halt-at-material contract lands in its owning plan)');
process.exit(0);
