#!/usr/bin/env node
'use strict';

/**
 * Phase 374 plan 03: contract test of the shared approval gate minter,
 * lib/mcp/approval-gate.cjs (decision D-04, Canon Part 3 and Part 7).
 *
 * The minter was moved out of lib/mcp/tools/research.cjs. This test pins the
 * behaviour that moved and the one new behaviour: spec.resolve receives its own
 * gate id as a third argument { gate_id }.
 *
 * Arms (one line each, "ok - A<n> ..." or "FAIL - A<n> ..." at column 1):
 *   A1  approve with an approving id runs resolve once; resolve gets (chosen, answer, { gate_id })
 *   A2  reject and defer never call resolve and report executed false
 *   A3  approve that names no approving id is chosen_not_approving; resolve is never called
 *   A4  a resolve that throws is approval_failed
 *   A5  an inline elicitation answer consumes the gate in the same call, runs resolve once,
 *       and passes a gate_id even when the inline answer has none
 *   A6  a second gate_answer for the same gate never runs resolve a second time
 *   A7  the gate is minted as kind material_step with the approving list; a title that ends in a
 *       sentence mark leads the question without a colon
 *   A8  source proof: the module defines mintApprovalGate, requires nothing under lib/mcp/tools/,
 *       and holds no Brain, Theo or network require
 *   A9  source proof: research.cjs no longer defines mintApprovalGate and requires ../approval-gate.cjs
 *
 * Hermetic: temp HOME and rooms home, Brain URL unreachable, env restored and
 * dirs removed at the end. In-process, no network. CJS. Hyphens only.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const MODULE_PATH = path.join(REPO, 'lib', 'mcp', 'approval-gate.cjs');
const RESEARCH_PATH = path.join(REPO, 'lib', 'mcp', 'tools', 'research.cjs');

const TMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 't374-approval-gate-'));
const ENV_KEYS = ['HOME', 'MINDRIAN_ROOMS_HOME', 'MINDRIAN_BRAIN_URL', 'MINDRIAN_BRAIN_KEY',
  'CLAUDE_CODE_SESSION_ID', 'CLAUDE_ACTIVE_ROOM', 'MINDRIAN_ROOM'];
const SAVED_ENV = {};
for (const k of ENV_KEYS) SAVED_ENV[k] = Object.prototype.hasOwnProperty.call(process.env, k) ? process.env[k] : undefined;
const ROOMS_HOME = path.join(TMP_ROOT, 'rooms');
fs.mkdirSync(path.join(TMP_ROOT, 'home'), { recursive: true });
fs.mkdirSync(ROOMS_HOME, { recursive: true });
process.env.HOME = path.join(TMP_ROOT, 'home');
process.env.MINDRIAN_ROOMS_HOME = ROOMS_HOME;
process.env.MINDRIAN_BRAIN_URL = 'http://127.0.0.1:9';
delete process.env.MINDRIAN_BRAIN_KEY;
delete process.env.CLAUDE_CODE_SESSION_ID;
delete process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.MINDRIAN_ROOM;

function cleanup() {
  for (const k of ENV_KEYS) {
    if (SAVED_ENV[k] === undefined) delete process.env[k];
    else process.env[k] = SAVED_ENV[k];
  }
  try { fs.rmSync(TMP_ROOT, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
}

let passed = 0;
let failed = 0;
async function arm(id, label, fn) {
  try {
    await fn();
    passed += 1;
    process.stdout.write('ok - ' + id + ' ' + label + '\n');
  } catch (err) {
    failed += 1;
    const msg = (err && err.message) ? String(err.message).split('\n')[0] : String(err);
    process.stdout.write('FAIL - ' + id + ' ' + label + ' :: ' + msg + '\n');
  }
}

function makeFakeServer(opts) {
  const o = opts || {};
  const registered = [];
  return {
    registerTool(name, config, handler) {
      const cfg = config || {};
      registered.push({ name: name, description: cfg.description, inputSchema: cfg.inputSchema, handler: handler });
    },
    _registered: registered,
    server: o.server || { getClientCapabilities() { return {}; } },
  };
}

// Strip block comments and whole-line comments before a source match
// (grep gate hygiene: a comment line never counts).
function codeOf(file) {
  let src = fs.readFileSync(file, 'utf8');
  src = src.replace(/\/\*[\s\S]*?\*\//g, '');
  return src.split('\n').filter((l) => !/^\s*(\/\/|\*|#)/.test(l)).join('\n');
}

let _fx = null;
function fixture() {
  if (_fx) return _fx;
  const gateModule = require(path.join(REPO, 'lib', 'mcp', 'tools', 'gate.cjs'));
  const gateLedger = require(path.join(REPO, 'lib', 'mcp', 'gate-ledger.cjs'));
  const roomDb = require(path.join(REPO, 'lib', 'core', 'room-db.cjs'));
  const sessionBinding = require(path.join(REPO, 'lib', 'core', 'session-binding.cjs'));
  const { mintApprovalGate } = require(MODULE_PATH);

  const roomDir = path.join(ROOMS_HOME, 'room-x');
  fs.mkdirSync(roomDir, { recursive: true });
  roomDb.closeRoomDb(roomDb.openRoomDb(roomDir));
  fs.mkdirSync(path.join(ROOMS_HOME, '.rooms'), { recursive: true });
  fs.writeFileSync(path.join(ROOMS_HOME, '.rooms', 'registry.json'), JSON.stringify({
    active: 'room-x',
    rooms: { 'room-x': { slug: 'room-x', abs_path: roomDir } },
  }, null, 2));
  sessionBinding.writeSessionBinding('S1', { bound: ['room-x'], primary: 'room-x' });

  const fake = makeFakeServer();
  gateModule.register(fake, { surface: 'cli' });
  const answerHandler = fake._registered.find((r) => r.name === 'gate_answer').handler;
  const answer = async (sessionId, gateId, chosen, verdict) => {
    const res = await answerHandler({ gate_id: gateId, chosen: chosen, verdict: verdict }, { sessionId: sessionId });
    const p = JSON.parse(res.content[0].text);
    p._isError = !!res.isError;
    return p;
  };
  _fx = { gateLedger, mintApprovalGate, answer };
  return _fx;
}

function baseSpec(resolve) {
  return {
    card: { title: 'Grant', question: 'Allow the run?' },
    options: [{ id: 'grant', label: 'Grant' }, { id: 'later', label: 'Later' }, { id: 'no', label: 'No' }],
    approving: ['grant'],
    rejecting: ['no'],
    resolve: resolve,
  };
}

async function main() {
  // The module must load. If it does not, every behaviour arm fails with the reason.
  let loadError = null;
  try { fixture(); } catch (e) { loadError = e; }
  const need = () => { if (loadError) throw loadError; return fixture(); };

  await arm('A1', 'approve with an approving id runs resolve once with (chosen, answer, { gate_id })', async () => {
    const f = need();
    const calls = [];
    const out = await f.mintApprovalGate(makeFakeServer(), { surface: 'cli' }, 'S1', baseSpec(async function () {
      calls.push(Array.prototype.slice.call(arguments));
      return { ok: true, executed: true, tag: 'ran' };
    }));
    assert.equal(typeof out.gate_id, 'string');
    const r = await f.answer('S1', out.gate_id, ['grant'], 'approve');
    assert.equal(calls.length, 1, 'resolve must run exactly once, ran ' + calls.length);
    assert.deepEqual(calls[0][0], ['grant']);
    assert.equal(calls[0][1].verdict, 'approve');
    assert.deepEqual(calls[0][2], { gate_id: out.gate_id });
    assert.ok(r.chain_result && r.chain_result.tag === 'ran', 'got ' + JSON.stringify(r));
  });

  await arm('A2', 'reject and defer never call resolve and report executed false', async () => {
    const f = need();
    const n = { c: 0 };
    const spec = baseSpec(async () => { n.c += 1; return { ok: true }; });
    const rej = await f.mintApprovalGate(makeFakeServer(), { surface: 'cli' }, 'S1', spec);
    const r1 = await f.answer('S1', rej.gate_id, ['no'], 'reject');
    const dfr = await f.mintApprovalGate(makeFakeServer(), { surface: 'cli' }, 'S1', spec);
    const r2 = await f.answer('S1', dfr.gate_id, ['later'], 'defer');
    assert.equal(n.c, 0, 'resolve must not run');
    assert.equal(r1.chain_result.executed, false);
    assert.equal(r1.chain_result.verdict, 'reject');
    assert.equal(r2.chain_result.executed, false);
    assert.equal(r2.chain_result.verdict, 'defer');
  });

  await arm('A3', 'approve that names no approving id is chosen_not_approving and resolve never runs', async () => {
    const f = need();
    const n = { c: 0 };
    const out = await f.mintApprovalGate(makeFakeServer(), { surface: 'cli' }, 'S1', baseSpec(async () => { n.c += 1; return { ok: true }; }));
    // gate_answer refuses before the consume; the direct resumeFn call is the second line of defense.
    const r = await f.answer('S1', out.gate_id, ['no'], 'approve');
    assert.equal(r.reason, 'chosen_not_approving');
    const e = f.gateLedger.peekGate(out.gate_id, 'S1');
    assert.ok(e && e.ok !== false, 'the gate survives the refusal');
    const direct = await e.resumeFn({ gate_id: out.gate_id, chosen: ['no'], verdict: 'approve' });
    assert.equal(direct.ok, false);
    assert.equal(direct.reason, 'chosen_not_approving');
    assert.equal(direct.executed, false);
    assert.equal(n.c, 0, 'resolve must not run');
    f.gateLedger._internal._ledger.delete(out.gate_id);
  });

  await arm('A4', 'a resolve that throws is approval_failed', async () => {
    const f = need();
    const out = await f.mintApprovalGate(makeFakeServer(), { surface: 'cli' }, 'S1', baseSpec(async () => { throw new Error('boom'); }));
    const r = await f.answer('S1', out.gate_id, ['grant'], 'approve');
    assert.equal(r.ok, false);
    assert.ok(r.chain_result && r.chain_result.reason === 'approval_failed' && r.chain_result.executed === false, 'got ' + JSON.stringify(r.chain_result));
  });

  await arm('A5', 'an inline elicitation answer consumes the gate once and resolve gets a gate_id', async () => {
    const f = need();
    const calls = [];
    const server = makeFakeServer({
      server: {
        getClientCapabilities() { return { elicitation: {} }; },
        getClientVersion() { return { name: 'Visual Studio Code', version: '1.0.0' }; },
        async elicitInput() { return { action: 'accept', content: { choice: 'grant' } }; },
      },
    });
    const out = await f.mintApprovalGate(server, { surface: 'vscode' }, 'S1', baseSpec(async function () {
      calls.push(Array.prototype.slice.call(arguments));
      return { ok: true, executed: true };
    }));
    assert.equal(out.renderer, 'elicitation', 'got renderer ' + out.renderer);
    assert.equal(calls.length, 1, 'resolve must run once in the same call');
    assert.equal(out.resumed.executed, true);
    assert.deepEqual(calls[0][2], { gate_id: out.gate_id });
    assert.equal(f.gateLedger.peekGate(out.gate_id, 'S1'), null, 'the inline gate is consumed');
    // The same path when the inline answer object carries no gate_id: the minted id fills in.
    const bare = makeFakeServer({
      server: {
        getClientCapabilities() { return { elicitation: {} }; },
        getClientVersion() { return { name: 'Visual Studio Code', version: '1.0.0' }; },
        async elicitInput() { return { action: 'accept', content: { choice: 'grant' } }; },
      },
    });
    const seen = [];
    const gateRender = require(path.join(REPO, 'lib', 'mcp', 'gate-render.cjs'));
    const orig = gateRender.renderGate;
    gateRender.renderGate = async function () {
      const r = await orig.apply(this, arguments);
      if (r.answer) delete r.answer.gate_id;
      return r;
    };
    try {
      const out2 = await f.mintApprovalGate(bare, { surface: 'vscode' }, 'S1', baseSpec(async function () {
        seen.push(Array.prototype.slice.call(arguments));
        return { ok: true };
      }));
      assert.equal(seen.length, 1);
      assert.equal(seen[0][2].gate_id, out2.gate_id, 'the minted id must fill in for a missing answer id');
    } finally {
      gateRender.renderGate = orig;
    }
  });

  await arm('A6', 'a second gate_answer for the same gate never runs resolve again', async () => {
    const f = need();
    const n = { c: 0 };
    const out = await f.mintApprovalGate(makeFakeServer(), { surface: 'cli' }, 'S1', baseSpec(async () => { n.c += 1; return { ok: true, executed: true }; }));
    await f.answer('S1', out.gate_id, ['grant'], 'approve');
    assert.equal(n.c, 1);
    assert.equal(f.gateLedger.peekGate(out.gate_id, 'S1'), null, 'the ledger no longer holds the gate');
    const second = await f.answer('S1', out.gate_id, ['grant'], 'approve');
    assert.equal(n.c, 1, 'resolve must not run twice, got ' + JSON.stringify(second));
    // The ledger no longer holds the spent gate: a consume returns nothing usable, so no resumeFn can run again.
    const again = f.gateLedger.consumeGate(out.gate_id, 'S1');
    assert.ok(!again || again.ok === false || typeof again.resumeFn !== 'function', 'consume of a spent gate must hand out no resumeFn');
    // gate_answer saves the answer in the room, so a repeat is a recorded replay (replayed true) or unknown_gate; never a second run.
    assert.ok(second.replayed === true || second.reason === 'unknown_gate', 'got ' + JSON.stringify(second));
  });

  await arm('A7', 'minted as material_step with the approving list; a sentence-mark title leads without a colon', async () => {
    const f = need();
    const spec = baseSpec(async () => ({ ok: true }));
    const a = await f.mintApprovalGate(makeFakeServer(), { surface: 'cli' }, 'S1', spec);
    const ea = f.gateLedger.peekGate(a.gate_id, 'S1');
    assert.ok(ea && ea.ok !== false);
    assert.equal(ea.kind, 'material_step');
    assert.deepEqual(ea.approving, ['grant']);
    assert.equal(ea.card.header, 'Grant: Allow the run?');
    const spec2 = baseSpec(async () => ({ ok: true }));
    spec2.card = { title: 'Run the screen?', question: 'Nothing leaves this machine.' };
    const b = await f.mintApprovalGate(makeFakeServer(), { surface: 'cli' }, 'S1', spec2);
    const eb = f.gateLedger.peekGate(b.gate_id, 'S1');
    assert.equal(eb.card.header, 'Run the screen? Nothing leaves this machine.');
    f.gateLedger._internal._ledger.delete(a.gate_id);
    f.gateLedger._internal._ledger.delete(b.gate_id);
  });

  await arm('A8', 'source: module defines mintApprovalGate, requires nothing under tools/, no Brain, Theo or network require', async () => {
    assert.ok(fs.existsSync(MODULE_PATH), 'lib/mcp/approval-gate.cjs must exist');
    const code = codeOf(MODULE_PATH);
    assert.ok(/^async function mintApprovalGate\(/m.test(code), 'must define mintApprovalGate');
    assert.ok(!/require\(\s*['"][^'"]*\/tools\/[^'"]*['"]\s*\)/.test(code), 'must not require a tools module');
    assert.ok(!/require\(\s*['"][^'"]*(brain-client|mindrian-brain|theo-)[^'"]*['"]\s*\)/.test(code), 'must not require a Brain or Theo module');
    assert.ok(!/require\(\s*['"](node:)?(http|https|net|dns|child_process)['"]\s*\)/.test(code), 'must not require a network or process module');
    assert.ok(!/\bfetch\s*\(/.test(code), 'must not call fetch(');
    const mod = require(MODULE_PATH);
    assert.deepEqual(Object.keys(mod), ['mintApprovalGate']);
  });

  await arm('A9', 'source: research.cjs has no local mintApprovalGate and requires ../approval-gate.cjs', async () => {
    const code = codeOf(RESEARCH_PATH);
    assert.ok(!/^\s*(async\s+)?function\s+mintApprovalGate\b/m.test(code), 'research.cjs must not define mintApprovalGate');
    assert.ok(/require\(\s*['"]\.\.\/approval-gate\.cjs['"]\s*\)/.test(code), 'research.cjs must require ../approval-gate.cjs');
    const research = require(RESEARCH_PATH);
    assert.equal(research._internal.mintApprovalGate, require(MODULE_PATH).mintApprovalGate, '_internal re-exports the same function');
  });

  process.stdout.write('test-374-approval-gate: ' + passed + ' passed, ' + failed + ' failed\n');
  cleanup();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  process.stdout.write('FAIL - fatal ' + String((e && e.stack) || e) + '\n');
  cleanup();
  process.exit(1);
});
