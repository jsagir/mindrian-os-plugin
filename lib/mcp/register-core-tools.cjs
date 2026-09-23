'use strict';
// Phase 198-04 (SPEC-2, Task 1) -- the tools/ registration seam.
//
// registerCoreTools(server, ctx) is the ONE place later plans add a new
// lib/mcp/tools/*.cjs module without ever touching this file or
// lib/mcp/tool-router.cjs again (Canon Part 7 reuse; the "disjoint files"
// contract named in 198-04-PLAN.md). It:
//   1. registers contract_version explicitly (lib/mcp/contract-version.cjs is
//      NOT under lib/mcp/tools/ -- it is the contract's own version surface,
//      not a room/graph tool module);
//   2. reads lib/mcp/tools/ at load, requires each *.cjs module (sorted, so
//      registration order is deterministic across machines), and calls the
//      module's exported register(server, ctx).
//
// Each tools/*.cjs module ALSO exports a `connectors` array -- the born-wired
// SOURCE of truth scripts/build-connector-registry.cjs discovers to generate
// data/mcp-tool-connectors.json (Task 1's other half). This file does not read
// that array; it only drives registration.
//
// ctx carries { fallbackRoomDir, pluginRoot, surface } -- the boot-time
// closure state every tool module needs. A tool's own handler receives the
// LIVE per-call sessionId via the MCP SDK's `extra.sessionId` second handler
// argument (the extract_shallow / room_bind precedent, RESEARCH.md); ctx never
// carries a session id itself because ctx is built ONCE at boot, before any
// connection exists.
//
// A single broken tool module (missing file, throwing register()) never
// blocks its siblings -- this seam degrades additively, same discipline as
// the dep-heal boot in bin/mindrian-mcp-server.cjs.
//
// Canon Part 8: this module opens no Brain/network wire itself; it is pure
// filesystem discovery + delegation.

const fs = require('node:fs');
const path = require('node:path');

const TOOLS_DIR = path.join(__dirname, 'tools');

// Phase 354-14 (SYS-04, CTX-REG): the registration loop's per-module
// try/catch isolation is correct and unchanged -- a broken tool module must
// never take down its healthy siblings. What was missing is a health
// surface: the loop silently dropped failures with a bare `continue`, so a
// partial tool surface (fewer tools than the code on disk provides) started
// with no diagnostic anywhere. This module now builds a report of what it
// registered and what it dropped, writes exactly one stderr line per
// failure (never stdout -- the MCP stdio protocol carries the JSON-RPC
// stream and any stray byte corrupts it), and exposes the last report via
// getRegistrationHealth() for status_read to read lazily at call time.
let _lastReport = { complete: null, registered: [], failed: [], reason: 'not_run' };

function truncatedMessage(err) {
  const raw = (err && err.message) || err;
  return String(raw).slice(0, 200);
}

function recordFailure(report, module_, phase, err) {
  const message = truncatedMessage(err);
  report.failed.push({ module: module_, phase, message });
  process.stderr.write('[mindrian-os] tool registration failed: ' + module_ + ' (' + phase + '): ' + message + '\n');
}

function registerCoreTools(server, ctx) {
  const safeCtx = ctx && typeof ctx === 'object' ? ctx : {};
  const report = { complete: true, registered: [], failed: [], at: new Date().toISOString() };

  // 1. contract_version -- explicit (not part of the tools/ auto-discovery
  //    seam; it is the contract's own version surface).
  try {
    const contractVersion = require('./contract-version.cjs');
    if (typeof contractVersion.registerContractVersion === 'function') {
      contractVersion.registerContractVersion(server);
    }
  } catch (_e) {
    recordFailure(report, 'contract-version.cjs', 'contract_version', _e);
  }

  // 2. lib/mcp/tools/*.cjs -- sorted, deterministic, disjoint-file seam.
  let files = [];
  try {
    files = fs.readdirSync(TOOLS_DIR).filter((f) => f.endsWith('.cjs')).sort();
  } catch (_e) {
    recordFailure(report, 'tools/', 'discover', _e);
    report.complete = report.failed.length === 0;
    _lastReport = report;
    return report; // tools/ dir not present yet -- nothing to register (Wave-safe)
  }

  for (const f of files) {
    let mod;
    try {
      mod = require(path.join(TOOLS_DIR, f));
    } catch (_e) {
      recordFailure(report, f, 'require', _e);
      continue; // a broken module never blocks its siblings
    }
    if (mod && typeof mod.register === 'function') {
      try {
        mod.register(server, safeCtx);
        report.registered.push(f);
      } catch (_e) {
        recordFailure(report, f, 'register', _e);
      }
    } else {
      recordFailure(report, f, 'no_register_export', new Error('module exports no register()'));
    }
  }

  report.complete = report.failed.length === 0;
  _lastReport = report;
  return report;
}

/**
 * getRegistrationHealth() -- the last registerCoreTools() report, as a
 * structured clone (callers never mutate the shared module-level state).
 * Before any run: { complete: null, registered: [], failed: [], reason:
 * 'not_run' } -- never fabricated as complete or failed.
 */
function getRegistrationHealth() {
  return JSON.parse(JSON.stringify(_lastReport));
}

module.exports = { registerCoreTools, getRegistrationHealth };
