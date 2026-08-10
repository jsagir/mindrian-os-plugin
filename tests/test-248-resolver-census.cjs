#!/usr/bin/env node
'use strict';

/*
 * Phase 248-01 Task 1 -- the source-grep census tripwire (CTX-01).
 * ===================================================================
 * Precedent: tests/test-resolve-active-room-canonical.cjs rar.11/rar.12
 * (Canon Part 8/9 source-grep tripwires). Comment-stripping helper pattern:
 * tests/test-224-resolver-fallback.cjs:39 (stripComments) -- grep gate
 * hygiene, NEVER grep raw source, a header prose mention self-invalidates
 * the gate.
 *
 * Three rules, all scoped to lib/mcp/ (recursive, *.cjs):
 *
 *   census.1  `function resolveSessionRoomDir` appears in exactly ONE file:
 *             lib/mcp/session-room.cjs. Reintroducing an independent copy
 *             anywhere else turns this rule red.
 *   census.2  zero executable-line `isMcpFirst(` occurrences EXCEPT inside
 *             lib/mcp/mcp-first-flag.cjs itself (its own definition + the
 *             internal isWritePathEnabled call).
 *   census.3  zero executable-line `resolveWriteRoom(` or `resolveActiveRoom(`
 *             occurrences EXCEPT inside lib/mcp/session-room.cjs.
 *
 * Seam-liveness leg (phase constraint: use the Phase 235-02 helper,
 * lib/core/seam-liveness.cjs, where it fits): claims = the nine former
 * call-site files; isLive = comment-stripped source contains a require of
 * session-room.cjs. The helper's checkClaimedModuleLiveness wrapper fits
 * this shape cleanly (each claim's liveness was ALREADY probed by this test
 * via source-grep before being handed to the helper), so it is used, not
 * bypassed -- the plain grep still does the actual probing; the helper only
 * owns the verdict aggregation and dead-list reporting.
 *
 * Not copies -- deliberately NOT touched or counted: lib/mcp/tools/stop-gate.cjs
 * (delegates to stop-gate-handler.cjs, has no independent copy of its own) and
 * scripts/intent-classifier.cjs (out of the lib/mcp/ scope this census walks;
 * it already composes the core chokepoint correctly, hook-side).
 *
 * No em-dashes. CJS only. Node built-in assert only.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { checkClaimedModuleLiveness } = require('../lib/core/seam-liveness.cjs');

const REPO_ROOT = path.resolve(__dirname, '..');
const MCP_DIR = path.join(REPO_ROOT, 'lib', 'mcp');
const SESSION_ROOM = path.join(MCP_DIR, 'session-room.cjs');
const MCP_FIRST_FLAG = path.join(MCP_DIR, 'mcp-first-flag.cjs');

let pass = 0;
let fail = 0;
function check(label, cond) {
  if (cond) {
    pass += 1;
    console.log('  ok -', label);
  } else {
    fail += 1;
    console.log('  FAIL -', label);
  }
}

function stripComments(src) {
  const noBlock = src.replace(/\/\*[\s\S]*?\*\//g, '');
  return noBlock
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/, ''))
    .join('\n');
}

function walk(dir) {
  const out = [];
  let entries = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (_e) {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(full));
    } else if (entry.isFile() && entry.name.endsWith('.cjs')) {
      out.push(full);
    }
  }
  return out;
}

// The nine former independent call-site files (research census, verified at
// plan time 2026-08-10). Used for the seam-liveness leg below.
const NINE_FORMER_COPIES = [
  path.join(MCP_DIR, 'tools', 'room.cjs'),
  path.join(MCP_DIR, 'tools', 'gate.cjs'),
  path.join(MCP_DIR, 'tools', 'sensors.cjs'),
  path.join(MCP_DIR, 'tools', 'status.cjs'),
  path.join(MCP_DIR, 'tools', 'graph.cjs'),
  path.join(MCP_DIR, 'tools', 'views.cjs'),
  path.join(MCP_DIR, 'tools', 'chain.cjs'),
  path.join(MCP_DIR, 'stop-gate-handler.cjs'),
  path.join(MCP_DIR, 'tool-router.cjs'),
];

function main() {
  console.log('test-248-resolver-census (CTX-01 source-grep tripwire)');

  const allFiles = walk(MCP_DIR);
  assert.ok(allFiles.length > 0, 'sanity: lib/mcp/ has *.cjs files to scan');

  const stripped = new Map();
  for (const f of allFiles) {
    stripped.set(f, stripComments(fs.readFileSync(f, 'utf8')));
  }

  // census.1 -- exactly one definition site.
  const defSites = [];
  for (const [f, body] of stripped) {
    if (/function\s+resolveSessionRoomDir\s*\(/.test(body)) defSites.push(f);
  }
  check(
    'census.1: exactly one `function resolveSessionRoomDir` under lib/mcp/, and it is session-room.cjs',
    defSites.length === 1 && defSites[0] === SESSION_ROOM
  );
  if (defSites.length !== 1 || defSites[0] !== SESSION_ROOM) {
    console.log('    found def sites:', defSites.map((f) => path.relative(REPO_ROOT, f)));
  }

  // census.2 -- zero executable isMcpFirst( occurrences outside mcp-first-flag.cjs.
  const isMcpFirstLeaks = [];
  for (const [f, body] of stripped) {
    if (f === MCP_FIRST_FLAG) continue;
    if (/isMcpFirst\(/.test(body)) isMcpFirstLeaks.push(f);
  }
  check(
    'census.2: zero executable isMcpFirst( occurrences under lib/mcp/ outside mcp-first-flag.cjs',
    isMcpFirstLeaks.length === 0
  );
  if (isMcpFirstLeaks.length > 0) {
    console.log('    leaks:', isMcpFirstLeaks.map((f) => path.relative(REPO_ROOT, f)));
  }

  // census.3 -- zero executable resolveWriteRoom(/resolveActiveRoom( occurrences
  // outside session-room.cjs.
  const coreResolverLeaks = [];
  for (const [f, body] of stripped) {
    if (f === SESSION_ROOM) continue;
    if (/resolveWriteRoom\(/.test(body) || /resolveActiveRoom\(/.test(body)) coreResolverLeaks.push(f);
  }
  check(
    'census.3: zero executable resolveWriteRoom(/resolveActiveRoom( occurrences under lib/mcp/ outside session-room.cjs',
    coreResolverLeaks.length === 0
  );
  if (coreResolverLeaks.length > 0) {
    console.log('    leaks:', coreResolverLeaks.map((f) => path.relative(REPO_ROOT, f)));
  }

  // Seam-liveness leg (Phase 235-02 helper): each of the nine former copy
  // files must now require session-room.cjs on an executable line.
  const REQUIRE_SESSION_ROOM_RE = /require\(\s*['"][^'"]*session-room\.cjs['"]\s*\)/;
  const claimedModules = NINE_FORMER_COPIES.map((f) => {
    const body = stripped.get(f) || (fs.existsSync(f) ? stripComments(fs.readFileSync(f, 'utf8')) : '');
    return { id: path.relative(REPO_ROOT, f), live: REQUIRE_SESSION_ROOM_RE.test(body) };
  });
  const seamResult = checkClaimedModuleLiveness(claimedModules);
  check(
    'seam-liveness: all nine former call-site files require session-room.cjs',
    seamResult.ok === true
  );
  if (!seamResult.ok) {
    console.log('    dead seams:', seamResult.dead);
  }

  console.log('');
  console.log('---');
  console.log(pass + '/' + (pass + fail) + ' green');
  process.exit(fail === 0 ? 0 : 1);
}

main();
