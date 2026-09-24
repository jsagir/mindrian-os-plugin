'use strict';
// Phase 359-03 -- test-359-mcp-declared.cjs: the MCP stop_gate_check renders
// declared labels and dedups per declared fork (FORK359-07, SPEC R7, D-10,
// N-3, RESEARCH Finding 5).
//
// Covers: M1 (the rendered card's options equal the declared labels in
// order, moonshot last, header unchanged), M2 (two distinct declared forks
// in one session both fire), M3 (the identical declared fork sent twice
// dedups on the second), M4 (undeclared turns keep today's behavior, cross-
// checked against the archived pre-359 handler), M5 (the yes/no exemption),
// M6 (the stop_gate_check zod schema carries no fork_declared/declared_labels
// field), M7 (every leg is hermetic and never touches a real room).
//
// Test hygiene: MINDRIAN_HOME / MINDRIAN_ROOMS_HOME / MINDRIAN_ROOMS_ROOT /
// CARD_FIRE_SIDECHANNEL_PATH all redirected into a fresh mkdtemp BEFORE the
// first require (every path helper in play resolves process.env at call
// time, so this isolates all of them); no network egress.
//
// No em-dashes anywhere (hyphens only, CLAUDE.md HARD RULE).

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

delete process.env.TYPESAFE_API_KEY;

const REPO = path.join(__dirname, '..');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-mcp-declared-359-'));
process.env.MINDRIAN_HOME = path.join(TMP, 'mindrian');
process.env.MINDRIAN_ROOMS_HOME = path.join(TMP, 'rooms');
process.env.MINDRIAN_ROOMS_ROOT = path.join(TMP, 'rooms-root');
process.env.CARD_FIRE_SIDECHANNEL_PATH = path.join(TMP, 'sidechannel.json');
delete process.env.CLAUDE_ACTIVE_ROOM;
fs.mkdirSync(process.env.MINDRIAN_HOME, { recursive: true });
fs.mkdirSync(process.env.MINDRIAN_ROOMS_HOME, { recursive: true });
fs.mkdirSync(process.env.MINDRIAN_ROOMS_ROOT, { recursive: true });

const handler = require(path.join(REPO, 'lib', 'mcp', 'stop-gate-handler.cjs'));
const STOP_GATE_TOOL_PATH = path.join(REPO, 'lib', 'mcp', 'tools', 'stop-gate.cjs');
const PRE_359_PATH = path.join(REPO, 'tests', 'fixtures', 'card-fire-replay', 'pre-359.json');
const PRE359 = JSON.parse(fs.readFileSync(PRE_359_PATH, 'utf8')).pre_359_sha;

console.log('test-359-mcp-declared');

let failures = 0;
let total = 0;
const pending = [];
function ok(desc, fn) {
  pending.push({ desc: desc, fn: fn });
}

async function run() {
  for (const t of pending) {
    total += 1;
    try {
      handler._resetForTest();
      await t.fn();
      console.log('  ok   ' + t.desc);
    } catch (e) {
      failures += 1;
      console.log('  FAIL ' + t.desc + ' -- ' + (e && e.message ? e.message : String(e)));
    }
  }
  console.log('');
  console.log('Passed: ' + (total - failures) + ' / ' + total);
  if (preDir) {
    try { fs.rmSync(preDir, { recursive: true, force: true }); } catch (_e) { /* best-effort */ }
  }
  process.exit(failures > 0 ? 1 : 0);
}

// ---------------------------------------------------------------------
// Pre-359 archive helper (M4): git archive the pre-359 sha's runtime files
// into a mkdtemp, symlink node_modules, require the archived
// lib/mcp/stop-gate-handler.cjs by absolute path.
// ---------------------------------------------------------------------
let preDir = null;
let preHandler = null;
function buildPre359Handler() {
  if (preHandler) return preHandler;
  preDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-declared-359-pre-'));
  const archivePath = path.join(preDir, 'a.tar');
  const arc = spawnSync('git', ['archive', '-o', archivePath, PRE359, 'scripts', 'lib', 'data', 'package.json', '.claude-plugin'], { cwd: REPO, stdio: ['ignore', 'ignore', 'pipe'] });
  if (arc.status !== 0) throw new Error('git archive ' + PRE359 + ' failed: ' + arc.stderr);
  const untar = spawnSync('tar', ['-xf', archivePath, '-C', preDir], { stdio: ['ignore', 'ignore', 'pipe'] });
  if (untar.status !== 0) throw new Error('tar -x failed: ' + untar.stderr);
  fs.rmSync(archivePath, { force: true });
  const nodeModulesSrc = path.join(REPO, 'node_modules');
  if (fs.existsSync(nodeModulesSrc)) {
    try { fs.symlinkSync(nodeModulesSrc, path.join(preDir, 'node_modules'), 'dir'); } catch (_e) { /* best-effort */ }
  }
  preHandler = require(path.join(preDir, 'lib', 'mcp', 'stop-gate-handler.cjs'));
  return preHandler;
}

const DECL_LINE_4 = 'Your call: A | B | C | What if D';

ok('M1 a declared turn fires; the rendered card options equal the declared labels in order, moonshot last; header unchanged', async function () {
  const res = await handler.handleStopEvent('sess-m1', { session_id: 'sess-m1', output_text: DECL_LINE_4 });
  assert.equal(res.fire, true);
  assert.ok(res.card, 'a fired verdict must carry a rendered card');
  assert.deepEqual(res.card.options.map(function (o) { return o.label; }), ['A', 'B', 'C', 'What if D']);
  assert.equal(res.card.header, 'This turn reached a Decision Gate that has not been answered yet.');
});

ok('M2 two distinct declared forks in one session (no _resetForTest between them) both fire', async function () {
  const sid = 'sess-m2';
  const r1 = await handler.handleStopEvent(sid, { session_id: sid, output_text: 'Your call: Ship it now | Hold for review | What if we ask early testers first' });
  assert.equal(r1.fire, true);
  const r2 = await handler.handleStopEvent(sid, { session_id: sid, output_text: 'Your call: Launch in EMEA | Launch in APAC | What if we launch everywhere at once' });
  assert.equal(r2.fire, true);
});

ok('M3 the identical declared fork sent twice in one session dedups on the second', async function () {
  const sid = 'sess-m3';
  const declText = 'Your call: Ship it now | Hold for review | What if we ask early testers first';
  const r1 = await handler.handleStopEvent(sid, { session_id: sid, output_text: declText });
  assert.equal(r1.fire, true);
  const r2 = await handler.handleStopEvent(sid, { session_id: sid, output_text: declText });
  assert.equal(r2.fire, false);
  assert.equal(r2.reason, 'dedup-already-fired-this-session');
});

ok('M4 undeclared turns keep today behavior: plain prose -> no-gate-signal; a bracket-box card matches the pre-359 archived handler', async function () {
  const r1 = await handler.handleStopEvent('sess-m4a', { session_id: 'sess-m4a', output_text: 'just chatting, nothing gate-shaped here' });
  assert.equal(r1.fire, false);
  assert.equal(r1.reason, 'no-gate-signal');

  const bracketTurn = { output_text: '[1] Build the plan\n[2] File the evidence' };
  const headCard = handler.buildStopGateCard(bracketTurn);
  const pre = buildPre359Handler();
  const preCard = pre.buildStopGateCard(bracketTurn);
  assert.deepEqual(headCard.options, preCard.options);
});

ok('M5 a declared yes/no practical pair -> fire false gate-is-simple-binary', async function () {
  const res = await handler.handleStopEvent('sess-m5', {
    session_id: 'sess-m5',
    output_text: 'Your call: Yes, ship it | No, hold it | What if we let the users ship it',
  });
  assert.equal(res.fire, false);
  assert.equal(res.reason, 'gate-is-simple-binary');
});

ok('M6 the stop_gate_check zod input schema declares no fork_declared or declared_labels field', function () {
  const source = fs.readFileSync(STOP_GATE_TOOL_PATH, 'utf8');
  assert.equal(source.indexOf('fork_declared'), -1);
  assert.equal(source.indexOf('declared_labels'), -1);
});

ok('M7 every leg runs hermetic; every result business room_dir is null/undefined', async function () {
  const r1 = await handler.handleStopEvent('sess-m7', { session_id: 'sess-m7', output_text: DECL_LINE_4 });
  assert.ok(r1.business === undefined || r1.business.room_dir === null || r1.business.room_dir === undefined);
  const r2 = await handler.handleStopEvent('sess-m7b', { session_id: 'sess-m7b', output_text: 'plain prose' });
  assert.ok(r2.business === undefined || r2.business.room_dir === null || r2.business.room_dir === undefined);
  // Env sanity: every one of the four hermetic vars points under the mkdtemp TMP dir.
  for (const v of ['MINDRIAN_HOME', 'MINDRIAN_ROOMS_HOME', 'MINDRIAN_ROOMS_ROOT', 'CARD_FIRE_SIDECHANNEL_PATH']) {
    assert.ok(process.env[v] && process.env[v].indexOf(TMP) === 0, v + ' must be redirected under the test mkdtemp');
  }
});

run();
