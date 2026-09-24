#!/usr/bin/env node
'use strict';

// Phase 267 Plan 07 (MCPV2-07) -- RCA 3 fix pin: .planning/debug/gate-
// elicitation-premise-stale-comment.md. lib/mcp/tools/gate.cjs carries two
// comment blocks (a file-header block and detectClientCapabilities's own
// JSDoc) asserting Claude Code/Desktop/Cowork "do not declare" the MCP
// elicitation client capability. That premise is now stale: a live wire tee
// of Claude Code 2.1.280+ (267-RESEARCH.md, 2026-09-23; re-confirmed live at
// 2.1.281 in 267-TRIPOLAR-PROBES.md, 2026-09-24) shows the CLI declaring
// `elicitation: {}` at MCP initialize. detectClientCapabilities's own CODE
// was already correct (it reads real capabilities off
// server.server.getClientCapabilities() at call time) -- only the comment's
// factual premise needed correcting. This test has two arms:
//
//   Source arm (RED before Task 1 step 2, GREEN after): the gate.cjs source
//   text no longer contains the literal stale phrase "do not declare it",
//   and DOES mention "elicitation" together with "2.1.280" -- the version
//   the corrected comment must cite.
//
//   Behavior arm (already GREEN, pinned so the comment fix never drifts into
//   a code fix): detectClientCapabilities's actual ladder logic is
//   unchanged by the comment-only rewrite -- a fake server declaring
//   elicitation:{} reports elicitation:true; one whose
//   getClientCapabilities() returns undefined reports elicitation:false;
//   one whose getClientCapabilities() throws also reports elicitation:false
//   (caught, never propagated).
//
// Reaches detectClientCapabilities through gate.cjs's own pre-existing
// _internal export (module.exports._internal.detectClientCapabilities) --
// never a new export added just for this test, per CTX-TESTFIRST and the
// plan's own read_first instruction.
//
// Node built-in assert + fs only. No em-dashes. CJS only.

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const GATE_PATH = path.join(__dirname, '..', 'lib', 'mcp', 'tools', 'gate.cjs');
const gateTool = require(path.join(__dirname, '..', 'lib', 'mcp', 'tools', 'gate.cjs'));

let passCount = 0;
let failCount = 0;

function check(cond, label) {
  if (cond) {
    passCount += 1;
    console.log('PASS: ' + label);
  } else {
    failCount += 1;
    console.log('FAIL: ' + label);
  }
}

// -----------------------------------------------------------------------
// Source arm -- the corrected-premise pin.
// -----------------------------------------------------------------------
const source = fs.readFileSync(GATE_PATH, 'utf8');

check(
  source.indexOf('do not declare it') === -1 && source.indexOf('do not declare the elicitation') === -1,
  'gate.cjs comment text no longer asserts Claude hosts "do not declare" elicitation'
);
check(
  source.indexOf('elicitation') !== -1 && source.indexOf('2.1.280') !== -1,
  'gate.cjs comment text mentions elicitation together with the verified build 2.1.280'
);

// -----------------------------------------------------------------------
// Behavior arm -- detectClientCapabilities's ladder-detection logic, pinned
// unchanged. This arm was already green before the comment fix and must
// stay green after it: a comment-only rewrite must never touch behavior.
// -----------------------------------------------------------------------
assert.strictEqual(
  typeof gateTool._internal.detectClientCapabilities,
  'function',
  'gate.cjs exports _internal.detectClientCapabilities'
);
const detectClientCapabilities = gateTool._internal.detectClientCapabilities;

const fakeElicit = { server: { getClientCapabilities: () => ({ elicitation: {} }) } };
const r1 = detectClientCapabilities(fakeElicit, { surface: 'cli' });
check(r1.elicitation === true, 'a fake server declaring elicitation:{} reports elicitation:true');

const fakeUndefined = { server: { getClientCapabilities: () => undefined } };
const r2 = detectClientCapabilities(fakeUndefined, { surface: 'cli' });
check(r2.elicitation === false, 'a fake server whose getClientCapabilities() returns undefined reports elicitation:false');

const fakeThrow = { server: { getClientCapabilities: () => { throw new Error('boom'); } } };
const r3 = detectClientCapabilities(fakeThrow, { surface: 'cli' });
check(r3.elicitation === false, 'a fake server whose getClientCapabilities() throws reports elicitation:false (caught, not propagated)');

console.log('');
console.log('PASS=' + passCount + ' FAIL=' + failCount);
process.exit(failCount === 0 ? 0 : 1);
