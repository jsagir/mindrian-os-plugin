#!/usr/bin/env node
'use strict';

/*
 * Plan 386-04 (finding B2, owner decision option A, 2026-11-06).
 *
 * THE DEFECT. lib/core/part8-egress-guard.cjs classify() has no arm for the
 * tool brain_write. A payload that clears the deny-list falls to the terminal
 * ambiguous/unknown verdict. lib/core/brain-client.cjs callTool proceeds on
 * ambiguous (Phase 254 ruling, read tools). So a Cypher write built from
 * room-folder data reaches the wire. scripts/whitespace-to-brain.cjs also
 * counts a refused write (the egress_blocked sentinel object) as a success.
 *
 * THE RULE. A Brain write sends data to be stored, not a query sprout. It
 * stays blocked (PRD, owner principle for Part 8). classify() blocks every
 * brain_write payload with class write_blocked and has no allow rule for it.
 *
 * ARMS
 *   A1 classify() blocks brain_write (class write_blocked) on every scope name.
 *   A2 step 1 is unchanged: a synthetic email in the Cypher is still content_set.
 *   A3 the hook exits 2 for brain_write on the shim-backed scopes.
 *   A4 callTool('brain_write') returns egress_blocked with 0 fetch calls.
 *   A5 whitespace-to-brain main() makes 0 fetch calls and reports blocked.
 *   A6 buildZoneNodeCypher carries no hypothesis text and no hypothesis property.
 *   A7 regression pins: a generic brain_ask still allows; brain_stats {} allows.
 *
 * Canon Part 8: fixture room only, synthetic strings, fake key, fetch replaced
 * by a counter, throwaway HOME. No request body and no marker is printed.
 */

const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawnSync } = require('child_process');

const REPO = path.resolve(__dirname, '..');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 't386b2-'));
process.env.HOME = TMP;
process.env.USERPROFILE = TMP;
process.env.MINDRIAN_BRAIN_RETRY_MAX = '0';
process.env.MINDRIAN_BRAIN_KEY = 'fake-key-for-test-only-0000';
delete process.env.PART8_FORCE_BRAIN_AVAILABLE;

const MARKER = 'zzmarker-b2-synthetic';
const GUARD = path.join(REPO, 'lib', 'core', 'part8-egress-guard.cjs');
const HOOK = path.join(REPO, 'scripts', 'part8-egress-guard-hook.cjs');
const W2B = path.join(REPO, 'scripts', 'whitespace-to-brain.cjs');

let failures = 0;
function check(label, cond, detail) {
  if (cond) {
    console.log('ok - ' + label);
  } else {
    failures++;
    console.log('FAIL - ' + label + (detail ? ' :: ' + detail : ''));
  }
}

// fetch counter. Never records or prints a body, only booleans and counts.
const calls = [];
globalThis.fetch = async (url, init) => {
  const body = init && typeof init.body === 'string' ? init.body : '';
  let method = null;
  try { method = JSON.parse(body).method; } catch (_) { /* not json */ }
  calls.push({ method: method, hasMarker: body.indexOf(MARKER) !== -1 });
  const resp = (ok, status, text) => ({
    ok: ok, status: status, headers: { get: () => null },
    text: async () => text, arrayBuffer: async () => new ArrayBuffer(0),
  });
  if (method === 'initialize') return resp(true, 200, '');
  return resp(true, 200, 'data: ' + JSON.stringify({
    result: { content: [{ type: 'text', text: JSON.stringify({ ok: true }) }] },
  }));
};

const guard = require(GUARD);
const NEUTRAL_CYPHER =
  "MERGE (wz:WhitespaceZone {hash: 'abc123'}) SET wz.hypothesis = 'The " + MARKER + " text between alpha and beta'";

const SCOPES = [
  'brain_write',
  'mcp__plugin_mos_mindrian-brain__brain_write',
  'mcp__mindrian-brain__brain_write',
  'mcp__pws-brain-mcp__brain_write',
  'mcp__theo__brain_write',
];

function runHook(toolName, toolInput) {
  const res = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({ tool_name: toolName, tool_input: toolInput, session_id: 't386b2' }),
    env: Object.assign({}, process.env, { PART8_FORCE_BRAIN_AVAILABLE: '1', HOME: TMP }),
    cwd: TMP,
    encoding: 'utf8',
    timeout: 20000,
  });
  return { status: res.status, stderr: res.stderr || '' };
}

function armA1() {
  SCOPES.forEach(function (name) {
    const v = guard.classify({ cypher: NEUTRAL_CYPHER }, { toolName: name, roomDir: null });
    check('A1 classify blocks brain_write as write_blocked on ' + name.replace(/^mcp__/, ''),
      v.verdict === 'block' && v.class === 'write_blocked',
      'verdict=' + v.verdict + ' class=' + v.class);
    check('A1 reason carries no payload bytes on ' + name.replace(/^mcp__/, ''),
      typeof v.reason === 'string' && v.reason.indexOf(MARKER) === -1 && v.reason.indexOf('abc123') === -1);
  });
}

function armA2() {
  const v = guard.classify(
    { cypher: "MERGE (n:X {note: 'reach person@example.com now'})" },
    { toolName: 'brain_write', roomDir: null });
  check('A2 step 1 still wins: a synthetic email is content_set',
    v.verdict === 'block' && v.class === 'content_set',
    'verdict=' + v.verdict + ' class=' + v.class);
}

function armA3() {
  ['mcp__plugin_mos_mindrian-brain__brain_write', 'mcp__mindrian-brain__brain_write'].forEach(function (name) {
    const r = runHook(name, { cypher: NEUTRAL_CYPHER });
    check('A3 hook exits 2 for ' + name.replace(/^mcp__/, ''), r.status === 2, 'exit=' + r.status);
    check('A3 hook message names the write block and holds no payload bytes (' + name.replace(/^mcp__/, '') + ')',
      /Brain writes/.test(r.stderr) && r.stderr.indexOf(MARKER) === -1 && !/CONTENT-SET/.test(r.stderr),
      'stderr_bytes=' + Buffer.byteLength(r.stderr));
  });
}

async function armA4() {
  const bc = require(path.join(REPO, 'lib', 'core', 'brain-client.cjs'));
  calls.length = 0;
  let r;
  try { r = await bc.callTool('brain_write', { cypher: NEUTRAL_CYPHER }); } catch (e) { r = { threw: true }; }
  check('A4 callTool returns the egress_blocked sentinel for brain_write',
    !!r && r.error === 'egress_blocked' && r.egress_class === 'write_blocked',
    'error=' + (r && r.error) + ' class=' + (r && r.egress_class));
  check('A4 callTool made 0 fetch calls', calls.length === 0, 'fetch_calls=' + calls.length);
  calls.length = 0;
  let w;
  try { w = await bc.write(NEUTRAL_CYPHER); } catch (e) { w = { threw: true }; }
  check('A4 write() wrapper is blocked with 0 fetch calls',
    !!w && w.error === 'egress_blocked' && calls.length === 0, 'fetch_calls=' + calls.length);
}

async function armA5() {
  const w2b = require(W2B);
  const room = fs.mkdtempSync(path.join(TMP, 'room-'));
  fs.mkdirSync(path.join(room, '.mindrian'));
  fs.writeFileSync(path.join(room, '.mindrian', 'interpretation-results.json'), JSON.stringify({
    gaps: [{
      validated: true,
      problem_type: 'Ill-Defined',
      density_score: 0.5,
      strategic_rank: 1,
      framework_chain: ['SWOT', 'Lean Canvas'],
      hypothesis: 'The connection between alpha and beta ' + MARKER,
    }],
  }));
  calls.length = 0;
  const realLog = console.log;
  let summary;
  console.log = function () { /* silence the script summary line */ };
  try { summary = await w2b.main(room, {}); } finally { console.log = realLog; }
  const toolCalls = calls.filter(function (c) { return c.method === 'tools/call'; });
  check('A5 whitespace-to-brain makes 0 fetch calls', calls.length === 0, 'fetch_calls=' + calls.length);
  check('A5 no request body held the marker', !calls.some(function (c) { return c.hasMarker; }));
  check('A5 summary reports zones_written 0 and a blocked count above 0',
    !!summary && summary.zones_written === 0 && summary.blocked > 0,
    'zones_written=' + (summary && summary.zones_written) + ' blocked=' + (summary && summary.blocked) +
    ' tools_call=' + toolCalls.length);
  check('A5 summary shows no edges, no aggregation, no errors for a block',
    !!summary && summary.edges_created === 0 && summary.aggregation_ran === false && summary.errors === 0,
    JSON.stringify(summary && { e: summary.edges_created, a: summary.aggregation_ran, x: summary.errors }));
}

function armA6() {
  const w2b = require(W2B);
  const cy = w2b.buildZoneNodeCypher({
    problem_type: 'Ill-Defined',
    density_score: 0.5,
    strategic_rank: 1,
    framework_chain: ['SWOT'],
    hypothesis: 'free text with ' + MARKER,
  });
  check('A6 zone Cypher does not hold the hypothesis marker', cy.indexOf(MARKER) === -1);
  check('A6 zone Cypher has no hypothesis property', !/hypothesis/i.test(cy));
}

function armA7() {
  const ask = guard.classify(
    { question: 'what comes after customer interviews when the market is unproven' },
    { toolName: 'brain_ask', roomDir: null });
  check('A7 a generic brain_ask question still allows', ask.verdict === 'allow', 'verdict=' + ask.verdict);
  const stats = guard.classify({}, { toolName: 'brain_stats', roomDir: null });
  check('A7 brain_stats with {} still allows as empty_payload',
    stats.verdict === 'allow' && stats.class === 'empty_payload',
    'verdict=' + stats.verdict + ' class=' + stats.class);
}

(async function main() {
  try {
    armA1();
    armA2();
    armA3();
    await armA4();
    await armA5();
    armA6();
    armA7();
  } catch (e) {
    failures++;
    console.log('FAIL - harness error :: ' + (e && e.message));
  } finally {
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_) { /* best effort */ }
  }
  console.log(failures === 0 ? '\nAll B2 arms passed' : '\n' + failures + ' check(s) failed');
  process.exit(failures === 0 ? 0 : 1);
})();
