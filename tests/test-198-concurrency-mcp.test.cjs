#!/usr/bin/env node
// Phase 198 SPEC-1 -- two-session concurrency guard, driven through the MCP
// tool surface. Clones the shape of the shipped
// tests/test-194-concurrency-integration.test.cjs: two sessions bound to
// different rooms perform interleaved writes; each write must land in its OWN
// room, proving the 2026-07-08 stale-write defect (frozen roomDir + global
// reg.active race, reproduced live) is impossible once
// lib/mcp/session-registry.cjs lands.
//
// D-01/D-02 design pin: the MCP connection sessionId IS the Phase-194 binding
// key (one namespace, no second store). The owning plan (198-02, SEED-039 MCP
// consumption) fills the real two-session assertions by driving
// lib/mcp/session-registry.cjs through the shipped Phase 194 primitives
// (session-binding.cjs, session-presence.cjs,
// resolve-active-room.cjs::resolveWriteRoom), mirroring the full-SQL-spine
// section of test-194-concurrency-integration.test.cjs.
//
// SKIP-safe until lib/mcp/session-registry.cjs exists (Wave 0 has none of
// these yet). Node built-in assert only. No em-dashes.
'use strict';
const assert = require('node:assert');

let registry;
try {
  registry = require('../lib/mcp/session-registry.cjs');
} catch (e) {
  console.log('SKIP: test-198-concurrency-mcp -- lib/mcp/session-registry.cjs not present yet (198-02). ' + (e.code || e.message));
  process.exit(0);
}

// Defense-in-depth guard alongside the aggregator's file-existence run_if: the
// module may land before its session<->room resolution API is exported.
const hasResolutionApi = typeof registry.resolveSessionRoom === 'function'
  || typeof registry.bindConnection === 'function';
if (!hasResolutionApi) {
  console.log('SKIP: test-198-concurrency-mcp -- session-registry.cjs present but session<->room API not exported yet.');
  process.exit(0);
}

// --- the real two-session interleaved-write contract lands here in 198-02 ---
// Placeholder assertion only: proves the module loaded and exposes a
// resolution surface. The owning plan replaces this block with the live
// two-session interleaved-write proof (sess-A / sess-B, distinct rooms,
// interleaved writes, each lands in its own room).
assert.ok(registry, 'session-registry module loaded');
console.log('PASS: test-198-concurrency-mcp (stub -- session-registry present; real two-session contract lands in 198-02)');
process.exit(0);
