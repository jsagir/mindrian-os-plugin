#!/usr/bin/env node
// Phase 198 HARD FLOOR -- Part 8 (Graph Boundary) local-only source-grep.
//
// The constitution (CLAUDE.md Part 8): user room data NEVER egresses to Brain.
// The net-new 198 lib/mcp modules (session-registry, daemon-lifecycle,
// gate-render, contract-version, register-core-tools, the tools/*.cjs tool
// implementations, gate-dedup, the mcp-first-flag reader, and the daemon shim)
// carry room state and gate content -- they must never reach the Brain host.
//
// This is deliberately scoped to the NET-NEW 198 module surface, not a literal
// glob over every pre-existing file under lib/mcp/ -- lib/mcp/brain-router.cjs
// already ships today and legitimately talks to the Brain proxy (that is its
// whole job; Brain access is allowed for methodology/framework lookups, never
// for room-specific content). Cloning test-194-local-only.test.cjs's pattern
// (an explicit NEW_*_MODULES list, not a directory glob) keeps this floor
// honest: it flags a 198 module that starts reaching for the Brain host, not
// the pre-existing, already-audited Brain proxy surface.
//
// This floor greps every NEW 198 module that EXISTS for a Brain-egress token
// and FAILs the build if one appears. It is authorable and GREEN in Wave 0
// because zero 198 modules exist yet (nothing to flag), and it stays green as
// each module lands clean. This is the mitigation for threat T-198-05 in the
// plan's threat register.
//
// The local MCP daemon (D-01) legitimately serves HTTP on 127.0.0.1 -- so bare
// 'http'/'https'/'fetch'/'McpServer' tokens are NOT useful signals here (unlike
// the fully-local Phase 194 session files, several of these 198 modules ARE the
// MCP server itself). The real invariant is "must not reach the Brain host or
// its known aliases" -- that is what this token list checks.
//
// Node built-in assert only. No runner dep. No em-dashes.

'use strict';

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

// The NET-NEW 198 module surface (per 198-01-PLAN.md "Artifacts this phase
// produces" inventory). Files that do not yet exist are skipped from the grep
// (Wave 0 has none of these; the floor tightens as each lands).
const NEW_198_MODULES = [
  'lib/mcp/mcp-first-flag.cjs',
  'lib/mcp/session-registry.cjs',
  'lib/mcp/daemon-lifecycle.cjs',
  'lib/mcp/sse-event-bus.cjs',
  'lib/mcp/contract-version.cjs',
  'lib/mcp/register-core-tools.cjs',
  'lib/mcp/tools/room.cjs',
  'lib/mcp/tools/graph.cjs',
  'lib/mcp/tools/gate.cjs',
  'lib/mcp/tools/chain.cjs',
  'lib/mcp/tools/sensors.cjs',
  'lib/mcp/tools/views.cjs',
  'lib/mcp/tools/status.cjs',
  'lib/mcp/gate-render.cjs',
  'lib/mcp/gate-dedup.cjs',
  'lib/mcp/hook-adapter-audit.cjs',
  'bin/mindrian-mcp-shim.cjs',
  // Phase 198-09 (T-198-05, Task 1): the Stop-gate move's own net-new
  // modules. gate-dedup.cjs was already covered above (Wave 0 inventory);
  // stop-gate-handler.cjs and its MCP tool wrapper carry the SAME room/gate
  // state class and must clear the identical Brain-egress floor.
  'lib/mcp/stop-gate-handler.cjs',
  'lib/mcp/tools/stop-gate.cjs',
  // Phase 237-01 (Plan 07's net-new module): the chain-step dispatcher
  // resolves and spawns Tier 1 executables and reports Tier 2 methodology
  // steps honestly (quality: null). It carries the same room/chain state
  // class as chain.cjs and must clear the identical Brain-egress floor.
  // Absence-tolerant like every other target above: this floor is authored
  // in 237-01, before Plan 07 lands the file itself, so it is skipped from
  // the grep (not failed) until the module exists.
  'lib/core/chain-step-dispatcher.cjs',
];

// Brain-egress tokens. A 198 module carrying room/gate state must contain NONE
// of these. Deliberately precise: the token is the Brain HOST alias, not the
// bare word 'Brain' (a comment may legitimately say "ZERO Brain egress"), and
// not the local MCP SDK class name or the local daemon's own 'http' usage.
const FORBIDDEN_TOKENS = [
  'mindrian-brain',
  'onrender',
  'brain-router.cjs',
  'brain-client.cjs',
  'axios',
];

let scanned = 0;
const violations = [];

for (const rel of NEW_198_MODULES) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) continue; // not landed yet -> nothing to grep
  scanned += 1;
  const src = fs.readFileSync(abs, 'utf8');
  for (const token of FORBIDDEN_TOKENS) {
    if (src.includes(token)) {
      violations.push(`${rel}: forbidden token '${token}'`);
    }
  }
}

if (violations.length > 0) {
  console.error('FAIL: Part 8 local-only floor -- Brain-egress token(s) found in a 198 module:');
  for (const v of violations) console.error('  - ' + v);
  console.error('A 198 lib/mcp module carrying room/gate state must never reach the Brain host.');
  assert.fail('Part 8 local-only floor violated');
}

console.log(`PASS: test-198-local-only (Part 8 floor) -- ${scanned} of ${NEW_198_MODULES.length} 198 modules present, zero Brain-egress token`);
process.exit(0);
