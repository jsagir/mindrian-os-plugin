#!/usr/bin/env node
'use strict';
// Phase 386 plan 19 (B11): a gate returned by the framework_run halt path must be
// answerable by gate_answer. The halt path rendered a card and returned its id but
// never minted the id in the gate ledger, so gate_answer said unknown_gate.
// Drives the REGISTERED handlers (fake MCP server capture seam, as in
// tests/test-238-chosen-validation.cjs). Fixture room, no network, no Brain call.
// Arms: H1 not unknown_gate, H2 answer recorded and no step run, H3 forged id still
// unknown_gate, H4 replay of an answered id writes nothing new and runs nothing.
// Node built-ins only.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const gateModule = require(path.join(REPO, 'lib', 'mcp', 'tools', 'gate.cjs'));
const sensorsModule = require(path.join(REPO, 'lib', 'mcp', 'tools', 'sensors.cjs'));
const roomDb = require(path.join(REPO, 'lib', 'core', 'room-db.cjs'));
const navigation = require(path.join(REPO, 'lib', 'core', 'navigation.cjs'));

let failed = 0;
function ok(label, cond, extra) {
  if (cond) console.log('ok - ' + label);
  else { failed++; console.log('FAIL - ' + label + (extra ? ' :: ' + extra : '')); }
}

function makeFakeServer() {
  const registered = [];
  return {
    registerTool(name, config, handler) { registered.push({ name, handler }); },
    tool() { /* v1 arm unused */ },
    _registered: registered,
    server: { getClientCapabilities() { return {}; } },
  };
}

// First framework in the registry whose command is not autonomous_safe: a chain of it halts.
function pickMaterialFramework() {
  const reg = JSON.parse(fs.readFileSync(path.join(REPO, 'data', 'command-registry.json'), 'utf8'));
  for (const [fw, cmds] of Object.entries(reg.framework_index || {})) {
    const row = (reg.commands || []).find((c) => c && c.command === cmds[0]);
    if (row && row.autonomous_safe !== true) return fw;
  }
  return null;
}

function countDecisionRows(roomDir) {
  const db = navigation.openRoomDbForCaller(roomDir);
  try {
    return db.prepare("SELECT COUNT(*) AS c FROM nodes WHERE type = 'memory_event'").get().c;
  } finally { navigation.closeRoomDbForCaller(db); }
}

(async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'test-386-19-'));
  const roomDir = path.join(home, 'room');
  fs.mkdirSync(roomDir, { recursive: true });
  roomDb.closeRoomDb(roomDb.openRoomDb(roomDir));
  const prevRoom = process.env.CLAUDE_ACTIVE_ROOM;
  const prevSession = process.env.CLAUDE_CODE_SESSION_ID;
  process.env.CLAUDE_ACTIVE_ROOM = roomDir;
  delete process.env.CLAUDE_CODE_SESSION_ID;

  try {
    const server = makeFakeServer();
    const ctx = { fallbackRoomDir: roomDir, surface: 'cli' };
    gateModule.register(server, ctx);
    sensorsModule.register(server, ctx);
    const handler = (name) => server._registered.find((r) => r.name === name).handler;
    const call = async (name, args) => {
      const res = await handler(name)(args, {});
      const body = JSON.parse(res.content[0].text);
      body._isError = !!res.isError;
      return body;
    };

    const fw = pickMaterialFramework();
    ok('fixture: the registry has a framework with a material command', typeof fw === 'string' && fw.length > 0);

    const halt = await call('framework_run', { chain: [fw] });
    ok('fixture: framework_run halts and returns a gate id',
      halt.ok === true && halt.runnable === false && halt.gate && typeof halt.gate.gate_id === 'string',
      JSON.stringify(Object.keys(halt)));
    const gateId = halt.gate && halt.gate.gate_id;

    const before = countDecisionRows(roomDir);
    const a1 = await call('gate_answer', { gate_id: gateId, chosen: ['skip'], verdict: 'reject' });
    ok('H1 gate_answer on the halt gate id is not unknown_gate',
      a1.reason !== 'unknown_gate' && a1.ok === true, JSON.stringify(a1).slice(0, 200));

    ok('H2 the answer is recorded and no step ran',
      a1.ok === true && Array.isArray(a1.chosen) && a1.chosen[0] === 'skip' && a1.verdict === 'reject'
        && a1.chain_result === undefined && a1.trace === undefined,
      JSON.stringify(a1).slice(0, 200));

    const forged = await call('gate_answer', { gate_id: 'gate-never-minted-386-19', chosen: ['approve'], verdict: 'approve' });
    ok('H3 an id the process never minted still answers unknown_gate',
      forged.ok === false && forged.reason === 'unknown_gate', JSON.stringify(forged).slice(0, 200));

    const afterFirst = countDecisionRows(roomDir);
    const a2 = await call('gate_answer', { gate_id: gateId, chosen: ['skip'], verdict: 'reject' });
    const afterSecond = countDecisionRows(roomDir);
    ok('H4 a second answer of the same id writes nothing new and runs no step',
      afterSecond === afterFirst && a2.chain_result === undefined && a2.trace === undefined
        && (a2.replayed === true || a2.ok === false),
      'rows ' + afterFirst + ' -> ' + afterSecond + ' ' + JSON.stringify(a2).slice(0, 200));
    ok('fixture: the first answer wrote at least one row (anti-vacuity)', afterFirst > before, before + ' -> ' + afterFirst);
  } finally {
    if (prevRoom === undefined) delete process.env.CLAUDE_ACTIVE_ROOM; else process.env.CLAUDE_ACTIVE_ROOM = prevRoom;
    if (prevSession !== undefined) process.env.CLAUDE_CODE_SESSION_ID = prevSession;
    try { fs.rmSync(home, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  }
  if (failed) { console.log(failed + ' arm(s) failed'); process.exit(1); }
  console.log('all arms passed');
})().catch((e) => { console.log('FAIL - harness :: ' + (e && e.stack || e)); process.exit(1); });
