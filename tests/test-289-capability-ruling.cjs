#!/usr/bin/env node
// Phase 289 plan 01 (CARD289-01, CARD289-06): the capability ruling as an
// executable definition. Written RED first: lib/mcp/gate-render.cjs exports no
// detectGateCapabilities today, and five tool modules still carry their own
// byte-identical copy that PREFERS a declared elicitation on a Claude surface.
//
// THE RULING (D-02, D-03, navigator 2026-10-03): every Claude host surface
// (cli, desktop, cowork; the server cannot tell CLI from Desktop,
// lib/mcp/surface-detect.cjs:61-64) gets the AskUserQuestion card on BOTH
// protocol eras even when the client declares elicitation. A recognized
// non-Claude host (detectHostTier host vscode or cursor) that declares
// elicitation keeps rung (a), the inline elicitation round trip. Elicitation
// stays reachable and tested; it never fires for the same decision as a card.
//
// One shared function, detectGateCapabilities(server, ctx), lives in
// lib/mcp/gate-render.cjs and returns exactly
//   { elicitation, elicitation_declared, claudeCode }
// where elicitation = declared && !claudeHost. The five tool modules
// (gate, research, chain, sensors, stop-gate) delegate to it in one line each.
// pickRenderer is unchanged: elicitation > claudeCode > text.
//
// Arms: ruling-matrix, delegates, source. `--arm <id>` (repeatable) runs a
// subset; no flag runs all three. Exit 1 on any FAIL, else 0. This test has no
// environment dependency and never exits 77. Hyphens only.
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');

// Hermetic before any lib require: the tool modules may read rooms state.
const TMP_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 't289-cap-'));
const TMP_ROOMS = fs.mkdtempSync(path.join(os.tmpdir(), 't289-cap-'));
process.env.HOME = TMP_HOME;
process.env.MINDRIAN_ROOMS_HOME = TMP_ROOMS;
process.env.MINDRIAN_BRAIN_URL = 'http://127.0.0.1:9';
delete process.env.MINDRIAN_BRAIN_KEY;
delete process.env.CLAUDE_CODE_SESSION_ID;
process.on('exit', () => {
  for (const d of [TMP_HOME, TMP_ROOMS]) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  }
});

const ROOT = path.resolve(__dirname, '..');
const KEY_ORDER = ['claudeCode', 'elicitation', 'elicitation_declared'];

let passCount = 0;
let failCount = 0;
function pass(arm, name) { passCount += 1; console.log('PASS: ' + arm + ' ' + name); }
function fail(arm, name, reason) { failCount += 1; console.log('FAIL: ' + arm + ' ' + name + ' -- ' + reason); }
function check(arm, name, fn) {
  try { fn(); pass(arm, name); } catch (e) { fail(arm, name, (e && e.message ? e.message : String(e)).split('\n')[0]); }
}

// --- argument parsing -------------------------------------------------------
const argv = process.argv.slice(2);
const wantedArms = [];
for (let i = 0; i < argv.length; i += 1) {
  if (argv[i] === '--arm' && argv[i + 1]) { wantedArms.push(argv[i + 1]); i += 1; }
}
const ALL_ARMS = ['ruling-matrix', 'delegates', 'source'];
const arms = wantedArms.length > 0 ? wantedArms : ALL_ARMS;
for (const a of arms) {
  if (ALL_ARMS.indexOf(a) === -1) { console.log('FAIL: args unknown arm ' + a); process.exit(1); }
}

// --- fake servers -----------------------------------------------------------
// Both methods live on the INNER server object, where the capability read looks.
// caps: object | undefined | 'throw'; clientInfo: object | undefined | 'throw'.
function fake(caps, clientInfo) {
  return {
    server: {
      getClientCapabilities: () => {
        if (caps === 'throw') throw new Error('boom caps');
        return caps;
      },
      getClientVersion: () => {
        if (clientInfo === 'throw') throw new Error('boom version');
        return clientInfo;
      },
    },
  };
}

const DECLARED = { elicitation: {} };
const EXP_CARD = { elicitation: false, elicitation_declared: true, claudeCode: true };
const EXP_DIALOG = { elicitation: true, elicitation_declared: true, claudeCode: false };
const EXP_CARD_UNDECLARED = { elicitation: false, elicitation_declared: false, claudeCode: true };
const EXP_NONE = { elicitation: false, elicitation_declared: false, claudeCode: false };

// --- the matrix -------------------------------------------------------------
// Each row: { name, server, ctx, expect }.
const MATRIX = [];
const CLAUDE_SURFACES = ['cli', 'desktop', 'cowork'];
const CLAUDE_CLIENTS = [
  ['clientInfo undefined', undefined],
  ['claude-code', { name: 'claude-code' }],
  ['claude-ai', { name: 'claude-ai' }],
  ['some-new-client (unknown)', { name: 'some-new-client' }],
];
const NON_CLAUDE_CLIENTS = [
  ['Visual Studio Code', { name: 'Visual Studio Code' }],
  ['cursor', { name: 'cursor' }],
];
for (const s of CLAUDE_SURFACES) {
  for (const c of CLAUDE_CLIENTS) {
    MATRIX.push({ name: s + ' surface, declared, ' + c[0] + ' gets the card', server: fake(DECLARED, c[1]), ctx: { surface: s }, expect: EXP_CARD });
  }
  for (const c of NON_CLAUDE_CLIENTS) {
    MATRIX.push({ name: s + ' surface, declared, ' + c[0] + ' keeps rung (a)', server: fake(DECLARED, c[1]), ctx: { surface: s }, expect: EXP_DIALOG });
  }
}
MATRIX.push({ name: 'cli surface, NOT declared, Visual Studio Code', server: fake(undefined, { name: 'Visual Studio Code' }), ctx: { surface: 'cli' }, expect: EXP_CARD_UNDECLARED });
MATRIX.push({ name: 'cli surface, NOT declared, claude-code', server: fake(undefined, { name: 'claude-code' }), ctx: { surface: 'cli' }, expect: EXP_CARD_UNDECLARED });
MATRIX.push({ name: 'cli surface, caps object without elicitation', server: fake({ sampling: {} }, { name: 'claude-code' }), ctx: { surface: 'cli' }, expect: EXP_CARD_UNDECLARED });
MATRIX.push({ name: 'null surface, declared', server: fake(DECLARED, undefined), ctx: { surface: null }, expect: EXP_DIALOG });
MATRIX.push({ name: 'no ctx at all, declared', server: fake(DECLARED, { name: 'claude-code' }), ctx: undefined, expect: EXP_DIALOG });
MATRIX.push({ name: 'non-Claude surface string headless-289, declared', server: fake(DECLARED, undefined), ctx: { surface: 'headless-289' }, expect: EXP_DIALOG });
MATRIX.push({ name: 'null surface, NOT declared', server: fake(undefined, undefined), ctx: { surface: null }, expect: EXP_NONE });
MATRIX.push({ name: 'headless-289 surface, NOT declared', server: fake(undefined, undefined), ctx: { surface: 'headless-289' }, expect: EXP_NONE });
MATRIX.push({ name: 'getClientCapabilities throws, null surface', server: fake('throw', undefined), ctx: { surface: null }, expect: EXP_NONE });
MATRIX.push({ name: 'getClientCapabilities throws, cli surface', server: fake('throw', { name: 'claude-code' }), ctx: { surface: 'cli' }, expect: EXP_CARD_UNDECLARED });
MATRIX.push({ name: 'getClientVersion throws on a Claude surface with declared caps (unknown, card)', server: fake(DECLARED, 'throw'), ctx: { surface: 'cli' }, expect: EXP_CARD });
MATRIX.push({ name: 'server null, no ctx', server: null, ctx: undefined, expect: EXP_NONE });
MATRIX.push({ name: 'server without inner server, no ctx', server: {}, ctx: null, expect: EXP_NONE });

function sorted(o) {
  const out = {};
  for (const k of Object.keys(o).sort()) out[k] = o[k];
  return out;
}

// --- arm: ruling-matrix -----------------------------------------------------
function armRulingMatrix() {
  const arm = 'ruling-matrix';
  let gateRender = null;
  try { gateRender = require(path.join(ROOT, 'lib/mcp/gate-render.cjs')); } catch (e) {
    fail(arm, 'require lib/mcp/gate-render.cjs', e.message);
    return;
  }
  const fn = gateRender.detectGateCapabilities;
  check(arm, 'gate-render.cjs exports detectGateCapabilities as a function', () => {
    assert.equal(typeof fn, 'function', 'lib/mcp/gate-render.cjs exports no detectGateCapabilities (typeof ' + typeof fn + ')');
  });
  if (typeof fn === 'function') {
    for (const row of MATRIX) {
      check(arm, row.name, () => {
        const got = fn(row.server, row.ctx);
        assert.deepStrictEqual(sorted(got), sorted(row.expect), 'got ' + JSON.stringify(got) + ' expected ' + JSON.stringify(row.expect));
        assert.deepStrictEqual(Object.keys(got).sort(), KEY_ORDER, 'extra or missing keys: ' + Object.keys(got).join(','));
      });
    }
  }
  // pickRenderer stays unchanged (D-03).
  check(arm, 'pickRenderer({ elicitation: true, claudeCode: true }) is elicitation (unchanged)', () => {
    assert.equal(typeof gateRender.pickRenderer, 'function', 'pickRenderer missing');
    assert.equal(gateRender.pickRenderer({ elicitation: true, claudeCode: true }), 'elicitation');
    assert.equal(gateRender.pickRenderer({ elicitation: false, claudeCode: true }), 'askuserquestion');
    assert.equal(gateRender.pickRenderer({ elicitation: false, claudeCode: false }), 'text');
  });
  check(arm, 'pickRenderer(detectGateCapabilities(declared, unknown client, cli)) is askuserquestion', () => {
    assert.equal(typeof fn, 'function', 'detectGateCapabilities missing (cannot feed pickRenderer)');
    const caps = fn(fake(DECLARED, { name: 'some-new-client' }), { surface: 'cli' });
    assert.equal(gateRender.pickRenderer(caps), 'askuserquestion');
  });
  check(arm, 'pickRenderer(detectGateCapabilities(declared, Visual Studio Code, cli)) is elicitation', () => {
    assert.equal(typeof fn, 'function', 'detectGateCapabilities missing (cannot feed pickRenderer)');
    const caps = fn(fake(DECLARED, { name: 'Visual Studio Code' }), { surface: 'cli' });
    assert.equal(gateRender.pickRenderer(caps), 'elicitation');
  });
}

// --- arm: delegates ---------------------------------------------------------
const TOOLS = ['gate', 'research', 'chain', 'sensors', 'stop-gate'];
function armDelegates() {
  const arm = 'delegates';
  let shared = null;
  try { shared = require(path.join(ROOT, 'lib/mcp/gate-render.cjs')).detectGateCapabilities; } catch (_e) { shared = null; }
  for (const tool of TOOLS) {
    let mod = null;
    try { mod = require(path.join(ROOT, 'lib/mcp/tools', tool + '.cjs')); } catch (e) {
      fail(arm, tool + ' loads', e.message);
      continue;
    }
    const d = mod && mod._internal && mod._internal.detectClientCapabilities;
    if (typeof d !== 'function') {
      fail(arm, tool + ' exports _internal.detectClientCapabilities', 'typeof ' + typeof d);
      continue;
    }
    for (const row of MATRIX) {
      check(arm, tool + ': ' + row.name, () => {
        const got = d(row.server, row.ctx);
        assert.deepStrictEqual(sorted(got), sorted(row.expect), 'delegate returned ' + JSON.stringify(got) + ' but the ruling says ' + JSON.stringify(row.expect));
        assert.equal(typeof shared, 'function', 'detectGateCapabilities is not exported by lib/mcp/gate-render.cjs');
        assert.deepStrictEqual(got, shared(row.server, row.ctx), 'delegate disagrees with detectGateCapabilities');
      });
    }
  }
}

// --- arm: source ------------------------------------------------------------
function stripComments(src) {
  return src.split('\n').filter((line) => {
    const t = line.trim();
    return !(t.startsWith('//') || t.startsWith('*') || t.startsWith('/*'));
  }).join('\n');
}
function armSource() {
  const arm = 'source';
  for (const tool of TOOLS) {
    const rel = 'lib/mcp/tools/' + tool + '.cjs';
    let raw = '';
    try { raw = fs.readFileSync(path.join(ROOT, rel), 'utf8'); } catch (e) { fail(arm, rel + ' readable', e.message); continue; }
    const code = stripComments(raw);
    check(arm, rel + ' makes no getClientCapabilities call (one-line delegate)', () => {
      assert.ok(code.indexOf('getClientCapabilities') === -1, 'code still contains getClientCapabilities');
    });
    check(arm, rel + ' carries no CLAUDE_HOST_SURFACES = [ literal', () => {
      assert.ok(!/CLAUDE_HOST_SURFACES\s*=\s*\[/.test(code), 'code still carries its own CLAUDE_HOST_SURFACES list');
    });
  }
  check(arm, 'lib/mcp/tools/gate.cjs still carries the literal 2.1.280 (267 premise source arm)', () => {
    const raw = fs.readFileSync(path.join(ROOT, 'lib/mcp/tools/gate.cjs'), 'utf8');
    assert.ok(raw.indexOf('2.1.280') !== -1, 'the literal 2.1.280 is gone from gate.cjs');
  });
}

// --- run --------------------------------------------------------------------
const RUNNERS = { 'ruling-matrix': armRulingMatrix, delegates: armDelegates, source: armSource };
for (const a of arms) {
  try { RUNNERS[a](); } catch (e) { fail(a, 'arm threw', e && e.message ? e.message : String(e)); }
}
console.log('RESULT: PASS=' + passCount + ' FAIL=' + failCount);
process.exit(failCount === 0 ? 0 : 1);
