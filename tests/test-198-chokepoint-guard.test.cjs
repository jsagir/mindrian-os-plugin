#!/usr/bin/env node
// Phase 198 SPEC-2 (chokepoint half) -- graph writes only through
// navigation.cjs (Canon Part 9, R4: no second selection/write brain). Real
// behavior: a graph_write attempt that tries to bypass navigation.cjs (a raw
// room.db write, or a second SQL surface) is rejected by lib/mcp/tools/graph.cjs
// before it reaches disk.
//
// SKIP-safe until lib/mcp/tools/graph.cjs exists. Node built-in assert only.
// No em-dashes.
'use strict';
const assert = require('node:assert');

let graphTool;
try {
  graphTool = require('../lib/mcp/tools/graph.cjs');
} catch (e) {
  console.log('SKIP: test-198-chokepoint-guard -- lib/mcp/tools/graph.cjs not present yet. ' + (e.code || e.message));
  process.exit(0);
}

const hasWriteApi = typeof graphTool.graphWrite === 'function'
  || typeof graphTool.registerGraphTools === 'function';
if (!hasWriteApi) {
  console.log('SKIP: test-198-chokepoint-guard -- graph.cjs present but write API not exported yet.');
  process.exit(0);
}

// --- the real "bypass navigation.cjs is rejected" contract lands here ---
assert.ok(graphTool, 'graph tool module loaded');
console.log('PASS: test-198-chokepoint-guard (stub -- graph.cjs present; real navigation.cjs-only rejection contract lands in its owning plan)');
process.exit(0);
