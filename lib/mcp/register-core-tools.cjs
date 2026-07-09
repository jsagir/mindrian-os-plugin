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

function registerCoreTools(server, ctx) {
  const safeCtx = ctx && typeof ctx === 'object' ? ctx : {};

  // 1. contract_version -- explicit (not part of the tools/ auto-discovery
  //    seam; it is the contract's own version surface).
  try {
    const contractVersion = require('./contract-version.cjs');
    if (typeof contractVersion.registerContractVersion === 'function') {
      contractVersion.registerContractVersion(server);
    }
  } catch (_e) {
    // never blocks the rest of the seam
  }

  // 2. lib/mcp/tools/*.cjs -- sorted, deterministic, disjoint-file seam.
  let files = [];
  try {
    files = fs.readdirSync(TOOLS_DIR).filter((f) => f.endsWith('.cjs')).sort();
  } catch (_e) {
    return; // tools/ dir not present yet -- nothing to register (Wave-safe)
  }

  for (const f of files) {
    let mod;
    try {
      mod = require(path.join(TOOLS_DIR, f));
    } catch (_e) {
      continue; // a broken module never blocks its siblings
    }
    if (mod && typeof mod.register === 'function') {
      try {
        mod.register(server, safeCtx);
      } catch (_e) {
        // a single tool module's registration failure never blocks its siblings
      }
    }
  }
}

module.exports = { registerCoreTools };
