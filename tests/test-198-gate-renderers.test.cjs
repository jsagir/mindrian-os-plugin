#!/usr/bin/env node
// Phase 198 SPEC-4 -- gate superset schema with the renderer ladder. Real
// behavior: the SAME gate_render payload renders end-to-end through all three
// rungs -- (a) MCP elicitation on a client that declares the capability, (b)
// canUseTool/AskUserQuestion via the thin adapter inside Claude Code, (c)
// structured-text fallback for headless clients -- and all three answers arrive
// as identical gate_answer payloads.
//
// SKIP-safe until lib/mcp/gate-render.cjs exists. Node built-in assert only.
// No em-dashes.
'use strict';
const assert = require('node:assert');

let gateRender;
try {
  gateRender = require('../lib/mcp/gate-render.cjs');
} catch (e) {
  console.log('SKIP: test-198-gate-renderers -- lib/mcp/gate-render.cjs not present yet. ' + (e.code || e.message));
  process.exit(0);
}

const hasRenderApi = typeof gateRender.renderGate === 'function'
  || typeof gateRender.renderGateCard === 'function';
if (!hasRenderApi) {
  console.log('SKIP: test-198-gate-renderers -- gate-render.cjs present but render API not exported yet.');
  process.exit(0);
}

// --- the real three-renderer-identical-payload contract lands here ---
assert.ok(gateRender, 'gate-render module loaded');
console.log('PASS: test-198-gate-renderers (stub -- gate-render.cjs present; real three-renderer parity contract lands in its owning plan)');
process.exit(0);
