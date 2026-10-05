#!/usr/bin/env node
'use strict';

/**
 * Quick 261005-mux -- a yes is a card, never prose (critical path item 4, the basket and grant half;
 * 369.2-INPUT defect 4, SEED-120 P0; Canon Part 3 the one governed gate path, Part 9 only a human
 * confirms a truth claim).
 * ==========================================================================
 * The defect: a model read a typed "i accept" and called gate_answer itself, so the card was never
 * fired. Two structural cures, one per surface family:
 *   CLI (a transcript exists): a PreToolUse hook, scripts/card-before-answer-hook.cjs, refuses a
 *     gate_answer whose gate was never shown as an AskUserQuestion card since its gate_render, or whose
 *     chosen does not match what the card answered. It fails OPEN on anything it cannot judge.
 *   Elicitation rung (Desktop, Cowork, non-Claude hosts: no transcript): the ledger entry stores the
 *     renderer; a relayed gate_answer on an open elicitation-rendered gate (the navigator dismissed the
 *     dialog) is refused card_pending and consumes nothing. An accepted dialog is consumed inline.
 *
 * Arms:
 *   H1  card shown, answer matches            -> allow (exit 0, no deny)
 *   H2  card missing (typed "i accept")       -> deny, reason "never shown as a card"
 *   H3  card shown, answer is another option  -> deny, reason "does not match the card"
 *   H4  no transcript_path                    -> allow, stderr surface_degraded
 *   H5  gate id absent from the transcript    -> allow, stderr gate_not_in_transcript
 *   H6  the hooks.json matcher: gate_answer on both server scopes, never gate_render
 *   H7  cold start on a 5 MB transcript stays inside the hooks.json budget (2000 ms, the spike 003
 *       PreToolUse budget scripts/measure-hook-cold-start.cjs enforces)
 *   H8  garbage or empty stdin, a foreign tool name -> allow, exit 0, never throws
 *   H9  a card shown BEFORE the gate_render does not count (order matters) -> deny
 *   S1  run approval gate, elicitation dialog cancelled -> gate_answer card_pending, ledger entry open
 *   S1b the same through gate_render
 *   S2  run card (approve_run), elicitation accepted -> consumed inline; a later relayed gate_answer is unknown_gate and writes nothing (pins today)
 *   B1  F.8 basket on the CLI rung, no card fired since the render, a typed "i accept" -> the hook denies; a fired card allows (369.2-11, R26)
 *   B2  basket dialog cancelled -> the gate stays open, a relayed gate_answer is card_pending, nothing filed
 *   B3  basket dialog accepted -> approved once, op file writes once; a second answer is unknown_gate, a second file is no_approved_basket
 *   S4  an elicitation entry whose dialog was accepted but not consumed inline (chain_run) passes exactly that choice
 *   S3  every gateLedger.mintGate( call site names a renderer
 *   D1  the doctrine sentence in larry-extended, research.md, larry-personality; the research mirror is fresh
 *   D2  dash guard over touched files; CHANGELOG entry present
 *
 * Exit 0 all PASS, 1 any FAIL. Hyphens only. CJS.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const FIX = path.join(__dirname, 'fixtures', 'mux');
const HOOK = path.join(ROOT, 'scripts', 'card-before-answer-hook.cjs');
// the HEAD this quick started from: the dash guard reads what the quick ADDED against it
const MUX_BASE = '465178e79';
const GATE_ANSWER_TOOL = 'mcp__plugin_mos_mindrian-os__gate_answer';

const TMP_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mux-home-'));
process.env.HOME = TMP_HOME;
process.env.USERPROFILE = TMP_HOME;
process.env.MINDRIAN_ROOMS_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mux-roomshome-'));
delete process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.CLAUDE_CODE_SESSION_ID;

const EM = String.fromCharCode(0x2014);
const EN = String.fromCharCode(0x2013);

let passed = 0;
let failed = 0;
async function arm(name, fn) {
  try {
    const r = await fn();
    if (r === true || r === undefined) {
      passed += 1;
      console.log('  PASS ' + name);
    } else {
      failed += 1;
      console.log('  FAIL ' + name);
      console.log('    ' + String(r).split('\n').slice(0, 6).join('\n    '));
    }
  } catch (err) {
    failed += 1;
    console.log('  FAIL ' + name);
    console.log('    ' + String((err && err.stack) || err).split('\n').slice(0, 6).join('\n    '));
  }
}

// -- hook driver -----------------------------------------------------------------------------
function envelope(over) {
  return Object.assign({
    hook_event_name: 'PreToolUse',
    tool_name: GATE_ANSWER_TOOL,
    tool_input: { gate_id: 'g-mux-1', chosen: ['approve_run'], verdict: 'approve' },
    transcript_path: path.join(FIX, 'card-shown.jsonl'),
    session_id: 'mux-session-0001',
  }, over || {});
}
function runHook(env, rawStdin) {
  const t0 = process.hrtime.bigint();
  const r = spawnSync(process.execPath, [HOOK], {
    input: rawStdin !== undefined ? rawStdin : JSON.stringify(env),
    encoding: 'utf8',
    timeout: 10000,
    env: Object.assign({}, process.env, { HOME: TMP_HOME, USERPROFILE: TMP_HOME }),
  });
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  let out = null;
  try { out = r.stdout && r.stdout.trim() ? JSON.parse(r.stdout) : null; } catch (_e) { out = { __unparsed: r.stdout }; }
  return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '', out: out, ms: ms };
}
function denyOf(res) {
  const h = res.out && res.out.hookSpecificOutput;
  return h && h.permissionDecision === 'deny' ? String(h.permissionDecisionReason || '') : null;
}
function isAllow(res) { return res.status === 0 && denyOf(res) === null; }

// -- the hook arms ---------------------------------------------------------------------------
async function hookArms() {
  await arm('H1 card shown and the answer matches: allow', function () {
    const r = runHook(envelope());
    if (!isAllow(r)) return 'expected allow, got status ' + r.status + ' stdout ' + r.stdout.slice(0, 300) + ' stderr ' + r.stderr.slice(0, 200);
    return true;
  });

  await arm('H2 card missing (typed "i accept"): deny with "never shown as a card"', function () {
    const r = runHook(envelope({ transcript_path: path.join(FIX, 'card-missing.jsonl') }));
    const reason = denyOf(r);
    if (r.status !== 0) return 'exit ' + r.status + ' stderr ' + r.stderr.slice(0, 200);
    if (reason === null) return 'expected deny, got stdout ' + r.stdout.slice(0, 300);
    if (!/never shown as a card/.test(reason)) return 'reason ' + reason;
    if (r.out.hookSpecificOutput.hookEventName !== 'PreToolUse') return 'hookEventName ' + r.out.hookSpecificOutput.hookEventName;
    return true;
  });

  await arm('H3 card shown, answer is another option: deny with "does not match the card"', function () {
    const r = runHook(envelope({ transcript_path: path.join(FIX, 'card-mismatch.jsonl') }));
    const reason = denyOf(r);
    if (r.status !== 0) return 'exit ' + r.status + ' stderr ' + r.stderr.slice(0, 200);
    if (reason === null) return 'expected deny, got stdout ' + r.stdout.slice(0, 300);
    if (!/does not match the card/.test(reason)) return 'reason ' + reason;
    return true;
  });

  await arm('H4 no transcript_path: allow and log surface_degraded', function () {
    const env = envelope();
    delete env.transcript_path;
    const r = runHook(env);
    if (!isAllow(r)) return 'expected allow, got status ' + r.status + ' stdout ' + r.stdout.slice(0, 200);
    if (!/surface_degraded/.test(r.stderr)) return 'stderr ' + r.stderr.slice(0, 200);
    return true;
  });

  await arm('H5 gate id absent from the transcript: allow and log gate_not_in_transcript', function () {
    const r = runHook(envelope({ tool_input: { gate_id: 'g-not-here', chosen: ['approve_run'], verdict: 'approve' } }));
    if (!isAllow(r)) return 'expected allow, got status ' + r.status + ' stdout ' + r.stdout.slice(0, 200);
    if (!/gate_not_in_transcript/.test(r.stderr)) return 'stderr ' + r.stderr.slice(0, 200);
    return true;
  });

  await arm('H6 the hooks.json matcher fires on gate_answer (both server scopes), never on gate_render', function () {
    const doc = JSON.parse(fs.readFileSync(path.join(ROOT, 'hooks', 'hooks.json'), 'utf8'));
    const groups = (doc.hooks && doc.hooks.PreToolUse) || [];
    const group = groups.find(function (g) {
      return (g.hooks || []).some(function (h) { return typeof h.command === 'string' && h.command.indexOf('card-before-answer-hook.cjs') !== -1; });
    });
    if (!group) return 'no PreToolUse entry runs card-before-answer-hook.cjs';
    const hit = (name) => [new RegExp('^(?:' + group.matcher + ')$'), new RegExp(group.matcher)].map(function (re) { return re.test(name); });
    const yes = ['mcp__plugin_mos_mindrian-os__gate_answer', 'mcp__mindrian-os__gate_answer'];
    const no = ['mcp__plugin_mos_mindrian-os__gate_render', 'mcp__mindrian-os__gate_render', 'mcp__plugin_mos_mindrian-os__gate_list'];
    for (const n of yes) if (hit(n).some(function (x) { return !x; })) return 'matcher misses ' + n;
    for (const n of no) if (hit(n).some(function (x) { return x; })) return 'matcher wrongly fires on ' + n;
    return true;
  });

  await arm('H7 cold start on a 5 MB transcript stays inside the hooks.json PreToolUse budget (2000 ms)', function () {
    // The budget is the hooks.json timeout of the hook's own entry, the number scripts/measure-hook-cold-start.cjs
    // compares every hook against (parseHookCommands -> timeout_ms); 2000 ms is the spike 003 PreToolUse budget
    // recorded in 369-HOOK-COLD-START.md.
    const measure = require(path.join(ROOT, 'scripts', 'measure-hook-cold-start.cjs'));
    const entry = measure.parseHookCommands(measure.HOOKS_JSON).find(function (e) { return e.command.indexOf('card-before-answer-hook.cjs') !== -1; });
    if (!entry) return 'hooks.json has no entry for the hook';
    const BUDGET_MS = 2000;
    if (entry.timeout_ms !== BUDGET_MS) return 'declared budget ' + entry.timeout_ms + ' is not the 2000 ms PreToolUse budget';
    const shown = fs.readFileSync(path.join(FIX, 'card-shown.jsonl'), 'utf8').split('\n').filter(Boolean);
    const filler = JSON.stringify({ parentUuid: null, isSidechain: false, type: 'assistant', uuid: 'filler', sessionId: 'mux-session-0001', message: { role: 'assistant', content: [{ type: 'text', text: 'x'.repeat(900) }] } });
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mux-5mb-'));
    const big = path.join(dir, 'transcript.jsonl');
    try {
      const target = 5 * 1024 * 1024;
      const chunks = [];
      let size = 0;
      while (size < target) { chunks.push(filler); size += filler.length + 1; }
      fs.writeFileSync(big, chunks.join('\n') + '\n' + shown.join('\n') + '\n');
      const bytes = fs.statSync(big).size;
      if (bytes < target) return 'fixture is only ' + bytes + ' bytes';
      const samples = [];
      for (let i = 0; i < 5; i += 1) {
        const r = runHook(envelope({ transcript_path: big }));
        if (!isAllow(r)) return 'the 5 MB transcript was not allowed: status ' + r.status + ' stdout ' + r.stdout.slice(0, 200) + ' stderr ' + r.stderr.slice(0, 200);
        samples.push(r.ms);
      }
      samples.sort(function (a, b) { return a - b; });
      console.log('    5 MB cold start (n=5): min ' + samples[0].toFixed(1) + ' ms, median ' + samples[2].toFixed(1) + ' ms, max ' + samples[4].toFixed(1) + ' ms, budget ' + BUDGET_MS + ' ms');
      if (samples[4] >= BUDGET_MS) return 'slowest run ' + samples[4].toFixed(1) + ' ms is not under ' + BUDGET_MS;
      return true;
    } finally {
      try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
    }
  });

  await arm('H8 garbage stdin, empty stdin and a foreign tool name all allow with exit 0', function () {
    for (const raw of ['', 'not json at all {{{', '[]', 'null', '{"tool_name":"mcp__plugin_mos_mindrian-os__gate_answer"}']) {
      const r = runHook(null, raw);
      if (!isAllow(r)) return 'stdin ' + JSON.stringify(raw) + ' -> status ' + r.status + ' stdout ' + r.stdout.slice(0, 120);
    }
    const foreign = runHook(envelope({ tool_name: 'Write', transcript_path: path.join(FIX, 'card-missing.jsonl') }));
    if (!isAllow(foreign)) return 'a foreign tool name was not allowed: ' + foreign.stdout.slice(0, 200);
    const missingFile = runHook(envelope({ transcript_path: path.join(FIX, 'no-such-file.jsonl') }));
    if (!isAllow(missingFile)) return 'a missing transcript file was not allowed: ' + missingFile.stdout.slice(0, 200);
    if (!/surface_degraded/.test(missingFile.stderr)) return 'a missing transcript file logged no surface_degraded: ' + missingFile.stderr.slice(0, 200);
    return true;
  });

  await arm('H9 a card shown BEFORE the gate_render does not count: deny', function () {
    const lines = fs.readFileSync(path.join(FIX, 'card-shown.jsonl'), 'utf8').split('\n').filter(Boolean);
    // records 0-3 are the plan and the gate result; 4-5 are the AskUserQuestion pair. Swap them.
    const reordered = lines.slice(4).concat(lines.slice(0, 4));
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mux-order-'));
    const file = path.join(dir, 't.jsonl');
    try {
      fs.writeFileSync(file, reordered.join('\n') + '\n');
      const r = runHook(envelope({ transcript_path: file }));
      const reason = denyOf(r);
      if (reason === null) return 'expected deny, got stdout ' + r.stdout.slice(0, 200);
      if (!/never shown as a card/.test(reason)) return 'reason ' + reason;
      return true;
    } finally {
      try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
    }
  });
}

// -- the server arms (in process, the way tests/test-363-mcp-tool.cjs drives the tools) -------------
async function serverArms() {
  let buildRoom363 = null;
  try {
    buildRoom363 = require(path.join(__dirname, 'helpers', 'fixture-room-363.cjs')).buildRoom363;
  } catch (_e) {
    await arm('S1/S1b/S2 need tests/helpers/fixture-room-363.cjs', function () { return 'helper absent'; });
    return;
  }
  const { registerCoreTools } = require(path.join(ROOT, 'lib', 'mcp', 'register-core-tools.cjs'));
  const gateLedger = require(path.join(ROOT, 'lib', 'mcp', 'gate-ledger.cjs'));
  const grants = require(path.join(ROOT, 'lib', 'core', 'research-planner', 'grants.cjs'));
  const QS = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests', 'fixtures', '363-question-sets', 'whitespace-quick.json'), 'utf8'));
  const rooms = [];

  // A stub server whose client declares elicitation and answers the dialog with state.next. No surface is
  // given in ctx, so detectGateCapabilities keeps rung (a): the dialog is the surface.
  function boot(room, state) {
    const captured = new Map();
    const stub = {
      tool: function (name, description, schema, handler) { captured.set(name, { handler: handler }); },
      registerTool: function (name, config, handler) { captured.set(name, { handler: handler }); },
      server: {
        getClientCapabilities: function () { return state.cli === true ? {} : { elicitation: {} }; },
        getClientVersion: function () { return { name: state.cli === true ? 'claude-code' : 'vscode', version: '1.0.0' }; },
        elicitInput: async function (params) { state.calls += 1; return typeof state.next === 'function' ? state.next(params) : state.next; },
      },
    };
    registerCoreTools(stub, state.cli === true ? { fallbackRoomDir: room.roomDir, pluginRoot: ROOT, surface: 'cli' } : { fallbackRoomDir: room.roomDir, pluginRoot: ROOT });
    return captured;
  }
  function parse(raw) {
    const text = raw && raw.content && raw.content[0] && raw.content[0].text;
    try { return JSON.parse(text); } catch (_e) { return { _unparsed: String(text).slice(0, 300) }; }
  }
  function client(room, sessionId, state) {
    const cap = boot(room, state);
    const extra = { sessionId: sessionId };
    return {
      research: async (input) => parse(await cap.get('research_run').handler(input, extra)),
      render: async (input) => parse(await cap.get('gate_render').handler(input, extra)),
      answer: async (gateId, chosen, verdict) => parse(await cap.get('gate_answer').handler({ gate_id: gateId, chosen: chosen, verdict: verdict }, extra)),
    };
  }
  async function plan(c) {
    const planned = await c.research({ op: 'plan', question_set: QS, mode: 'quick' });
    if (!planned || !planned.run_id) throw new Error('plan failed: ' + JSON.stringify(planned).slice(0, 300));
    return planned;
  }

  await arm('S1 research grant, dialog cancelled: the gate stays open and a relayed gate_answer is card_pending', async function () {
    const room = buildRoom363({ role: 'founder' });
    rooms.push(room);
    const state = { calls: 0, next: { action: 'cancel' } };
    const c = client(room, 'sess-mux-s1', state);
    const planned = await plan(c);
    const req = await c.research({ op: 'grant_request', run_id: planned.run_id });
    if (req.ok !== true || !req.gate || !req.gate.gate_id) return 'no gate ' + JSON.stringify(req).slice(0, 300);
    if (req.gate.renderer !== 'elicitation') return 'renderer ' + req.gate.renderer + ' (the stub must reach rung a)';
    if (state.calls !== 1) return 'elicitInput calls ' + state.calls;
    const id = req.gate.gate_id;
    const ans = await c.answer(id, ['approve_run'], 'approve');
    if (!(ans.ok === false && ans.reason === 'card_pending')) return 'expected card_pending, got ' + JSON.stringify(ans).slice(0, 300);
    if (!gateLedger._internal._ledger.has(id)) return 'the ledger entry was consumed by the refusal';
    if (grants.findActiveGrant(room.roomDir, { lifetime: 'run', run_id: planned.run_id })) return 'a run grant was written';
    return true;
  });

  await arm('S1b gate_render, dialog cancelled: the gate stays open and a relayed gate_answer is card_pending', async function () {
    const room = buildRoom363({ role: 'founder' });
    rooms.push(room);
    const state = { calls: 0, next: { action: 'cancel' } };
    const c = client(room, 'sess-mux-s1b', state);
    const out = await c.render({ header: 'Proceed with the mux probe?', kind: 'general', select_mode: 'single', options: [{ id: 'approve', label: 'Approve' }, { id: 'reject', label: 'Reject' }, { id: 'defer', label: 'Defer' }] });
    if (out.ok !== true || !out.gate_id) return 'no gate ' + JSON.stringify(out).slice(0, 300);
    if (out.renderer !== 'elicitation') return 'renderer ' + out.renderer;
    if (out.answer) return 'a cancelled dialog produced an answer';
    const ans = await c.answer(out.gate_id, ['approve'], 'approve');
    if (!(ans.ok === false && ans.reason === 'card_pending')) return 'expected card_pending, got ' + JSON.stringify(ans).slice(0, 300);
    if (!gateLedger._internal._ledger.has(out.gate_id)) return 'the ledger entry was consumed by the refusal';
    return true;
  });

  await arm('S2 run card, dialog accepted: consumed inline, a later relayed gate_answer is unknown_gate (pins today)', async function () {
    // 369.2-11 (R02): the web grant card offers approve_run
    const room = buildRoom363({ role: 'founder' });
    rooms.push(room);
    const state = { calls: 0, next: { action: 'accept', content: { choice: 'approve_run' } } };
    const c = client(room, 'sess-mux-s2', state);
    const planned = await plan(c);
    const req = await c.research({ op: 'grant_request', run_id: planned.run_id });
    if (req.ok !== true || !req.gate || !req.gate.gate_id) return 'no gate ' + JSON.stringify(req).slice(0, 300);
    if (req.gate.renderer !== 'elicitation') return 'renderer ' + req.gate.renderer;
    if (!req.gate.answer || !req.gate.resumed || req.gate.resumed.ok !== true) return 'not consumed inline: ' + JSON.stringify(req.gate).slice(0, 300);
    const first = grants.findActiveGrant(room.roomDir, { lifetime: 'run', run_id: planned.run_id });
    if (!first) return 'the inline accept wrote no run grant';
    if (grants.readGrants(room.roomDir, {}).grants.filter(function (g) { return g.lifetime !== 'run'; }).length !== 0) return 'the inline accept wrote a standing grant';
    if (gateLedger._internal._ledger.has(req.gate.gate_id)) return 'the inline accept left the entry open';
    // Measured on HEAD 465178e79 (the plan assumed replayed:true, but the inline consume writes no gate_answer
    // anchor in the room, so the entry is simply gone): a later relayed answer is refused unknown_gate, writes
    // nothing, and the one grant stands.
    const again = await c.answer(req.gate.gate_id, ['approve_run'], 'approve');
    if (!(again.ok === false && again.reason === 'unknown_gate')) return 'a later answer was not refused unknown_gate: ' + JSON.stringify(again).slice(0, 300);
    const after = grants.findActiveGrant(room.roomDir, { lifetime: 'run', run_id: planned.run_id });
    if (!after || after.grant_id !== first.grant_id) return 'the later answer changed the run grant';
    return true;
  });

  // 369.2-11 (R26): the F.8 filing basket. A finished quick run is built hermetically: the plan is saved through
  // research_run, its run is approved the way approvePlanReview writes it (the run grant), and run_quick drives the
  // recorded OpenAlex replay as globalThis.fetch for the length of that one call.
  const { makeReplayFetch } = require(path.join(__dirname, 'helpers', 'openalex-replay-363.cjs'));
  async function finishedRun(c, room) {
    const planned = await plan(c);
    const approved = require(path.join(ROOT, 'lib', 'core', 'research-planner', 'planner.cjs')).approvePlanReview(room.roomDir, planned.run_id, { approvedVia: 'mcp' });
    if (!approved.ok) throw new Error('approvePlanReview refused: ' + JSON.stringify(approved).slice(0, 300));
    const replay = makeReplayFetch({ route: function () { return 'gap_primary_zero'; } });
    const prior = globalThis.fetch;
    globalThis.fetch = replay;
    let done;
    try { done = await c.research({ op: 'run_quick', run_id: planned.run_id }); } finally { globalThis.fetch = prior; }
    if (done.ok !== true || done.status !== 'done') throw new Error('run_quick did not finish: ' + JSON.stringify(done).slice(0, 300));
    return planned.run_id;
  }
  // an elicitation reply that selects every option the dialog preselects (the basket's default-on items)
  function acceptDefaults(params) {
    const choices = params && params.requestedSchema && params.requestedSchema.properties && params.requestedSchema.properties.choices;
    const ids = choices && Array.isArray(choices.default) ? choices.default : [];
    return { action: 'accept', content: { choices: ids } };
  }
  function filedPath(room, runId) { return path.join(room.roomDir, '.mindrian', 'research-runs', runId, 'filing.json'); }

  await arm('B1 basket gate_render with no card fired since: the hook denies a typed "i accept" (never shown as a card), a fired card allows', async function () {
    const room = buildRoom363({ role: 'founder' });
    rooms.push(room);
    const state = { calls: 0, cli: true, next: { action: 'cancel' } };
    const c = client(room, 'sess-mux-b1', state);
    // the CLI rung: the host fires the card itself, so the result carries rendered.contract.superset_options
    const runId = await finishedRun(c, room);
    const b = await c.research({ op: 'basket', run_id: runId });
    if (b.ok !== true || !b.gate || !b.gate.gate_id) return 'no basket gate ' + JSON.stringify(b).slice(0, 300);
    const defaults = b.items.filter(function (i) { return i.default_on; });
    if (defaults.length === 0) return 'no default-on items to file';
    const gateId = b.gate.gate_id;
    const ids = defaults.map(function (i) { return i.id; });
    // the transcript the CLI would hold: the basket tool result carrying the gate, then prose, then "i accept"
    function rec(type, message, extra) { return JSON.stringify(Object.assign({ parentUuid: null, isSidechain: false, type: type, message: message, sessionId: 'mux-session-b1', userType: 'external', cwd: room.roomDir }, extra || {})); }
    const head = [
      rec('user', { role: 'user', content: 'review what the research found and ask me what to file' }),
      rec('assistant', { role: 'assistant', content: [{ type: 'tool_use', id: 'toolu_b1_01', name: 'mcp__plugin_mos_mindrian-os__research_run', input: { op: 'basket', run_id: runId } }] }),
      rec('user', { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'toolu_b1_01', content: [{ type: 'text', text: JSON.stringify(b, null, 2) }] }] }),
    ];
    const prose = [
      rec('assistant', { role: 'assistant', content: [{ type: 'text', text: 'The basket is ready. Shall I file the usual items?' }] }),
      rec('user', { role: 'user', content: 'i accept' }),
    ];
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mux-b1-'));
    try {
      const missing = path.join(dir, 'missing.jsonl');
      fs.writeFileSync(missing, head.concat(prose).join('\n') + '\n');
      const env = { tool_input: { gate_id: gateId, chosen: ids, verdict: 'approve' }, transcript_path: missing, session_id: 'mux-session-b1' };
      const denied = runHook(envelope(env));
      const reason = denyOf(denied);
      if (reason === null) return 'expected deny on prose, got stdout ' + denied.stdout.slice(0, 300) + ' stderr ' + denied.stderr.slice(0, 200);
      if (!/never shown as a card/.test(reason)) return 'reason ' + reason;
      // positive control: the same basket with its card fired and answered is allowed
      // the options the host fires are the gate's own (rendered.contract.superset_options): the basket items and "File nothing"
      if (b.gate.renderer !== 'askuserquestion') return 'renderer ' + b.gate.renderer + ' (the stub must reach the CLI rung)';
      const gateOptions = b.gate.rendered.contract.superset_options.map(function (o) { return { id: o.id, label: o.label }; });
      const shownLabels = gateOptions.map(function (o) { return o.label; });
      const labels = gateOptions.filter(function (o) { return ids.indexOf(o.id) !== -1; }).map(function (o) { return o.label; });
      if (labels.length === 0) return 'the basket gate carries no labels for the default items: ' + JSON.stringify(gateOptions).slice(0, 300);
      const asked = head.concat([
        rec('assistant', { role: 'assistant', content: [{ type: 'tool_use', id: 'toolu_b1_02', name: 'AskUserQuestion', input: { questions: [{ question: 'File these?', header: 'Filing', multiSelect: true, options: shownLabels.map(function (l) { return { label: l, description: 'file' }; }) }] } }] }),
        rec('user', { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'toolu_b1_02', content: 'Your questions have been answered: "File these?"="' + labels.join(', ') + '". You can now continue with these answers in mind.' }] }),
      ]);
      const fired = path.join(dir, 'fired.jsonl');
      fs.writeFileSync(fired, asked.join('\n') + '\n');
      const allowed = runHook(envelope(Object.assign({}, env, { transcript_path: fired })));
      if (!isAllow(allowed)) return 'a fired basket card was not allowed: ' + allowed.stdout.slice(0, 300) + ' stderr ' + allowed.stderr.slice(0, 200);
      if (fs.existsSync(filedPath(room, runId))) return 'something was filed';
      return true;
    } finally {
      try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
    }
  });

  await arm('B2 basket dialog cancelled: the gate stays open, a relayed gate_answer is card_pending, nothing is filed', async function () {
    const room = buildRoom363({ role: 'founder' });
    rooms.push(room);
    const state = { calls: 0, next: { action: 'cancel' } };
    const c = client(room, 'sess-mux-b2', state);
    const runId = await finishedRun(c, room);
    const callsBefore = state.calls;
    const b = await c.research({ op: 'basket', run_id: runId });
    if (b.ok !== true || !b.gate || !b.gate.gate_id) return 'no basket gate ' + JSON.stringify(b).slice(0, 300);
    if (b.gate.renderer !== 'elicitation') return 'renderer ' + b.gate.renderer + ' (the stub must reach rung a)';
    if (state.calls !== callsBefore + 1) return 'the basket dialog was not put to the navigator once: ' + (state.calls - callsBefore);
    if (b.gate.answer) return 'a cancelled dialog produced an answer';
    const ids = b.items.filter(function (i) { return i.default_on; }).map(function (i) { return i.id; });
    if (ids.length === 0) return 'no default-on items';
    const ans = await c.answer(b.gate.gate_id, ids, 'approve');
    if (!(ans.ok === false && ans.reason === 'card_pending')) return 'expected card_pending, got ' + JSON.stringify(ans).slice(0, 300);
    if (!gateLedger._internal._ledger.has(b.gate.gate_id)) return 'the ledger entry was consumed by the refusal';
    const filed = await c.research({ op: 'file', gate_id: b.gate.gate_id });
    if (filed.ok !== false) return 'op file accepted a basket that was never approved: ' + JSON.stringify(filed).slice(0, 200);
    if (fs.existsSync(filedPath(room, runId))) return 'something was filed';
    return true;
  });

  await arm('B3 basket dialog accepted with a selection: filed once through op file, a second answer and a second file are refused', async function () {
    const room = buildRoom363({ role: 'founder' });
    rooms.push(room);
    const state = { calls: 0, next: { action: 'cancel' } };
    const c = client(room, 'sess-mux-b3', state);
    const runId = await finishedRun(c, room);
    state.next = acceptDefaults;
    const b = await c.research({ op: 'basket', run_id: runId });
    if (b.ok !== true || !b.gate || !b.gate.gate_id) return 'no basket gate ' + JSON.stringify(b).slice(0, 300);
    if (!b.gate.answer || !b.gate.resumed || b.gate.resumed.ok !== true || b.gate.resumed.approved_for_filing !== true) return 'not consumed inline: ' + JSON.stringify(b.gate).slice(0, 300);
    if (gateLedger._internal._ledger.has(b.gate.gate_id)) return 'the inline accept left the entry open';
    if (fs.existsSync(filedPath(room, runId))) return 'the basket answer alone filed something';
    const ids = b.items.filter(function (i) { return i.default_on; }).map(function (i) { return i.id; });
    const again = await c.answer(b.gate.gate_id, ids, 'approve');
    if (!(again.ok === false && again.reason === 'unknown_gate')) return 'a second answer was not refused unknown_gate: ' + JSON.stringify(again).slice(0, 300);
    const filed = await c.research({ op: 'file', gate_id: b.gate.gate_id });
    if (filed.ok !== true) return 'file after the accepted basket ' + JSON.stringify(filed).slice(0, 400);
    if (!fs.existsSync(filedPath(room, runId))) return 'filing.json not written';
    const firstBytes = fs.readFileSync(filedPath(room, runId), 'utf8');
    const twice = await c.research({ op: 'file', gate_id: b.gate.gate_id });
    if (!(twice.ok === false && twice.reason === 'no_approved_basket')) return 'the approval was used twice: ' + JSON.stringify(twice).slice(0, 300);
    if (fs.readFileSync(filedPath(room, runId), 'utf8') !== firstBytes) return 'the second file changed what was filed';
    return true;
  });

  await arm('S4 an elicitation entry whose dialog was ACCEPTED but not consumed inline (chain_run) lets exactly that choice through', async function () {
    const gateRender = require(path.join(ROOT, 'lib', 'mcp', 'gate-render.cjs'));
    const room = buildRoom363({ role: 'founder' });
    rooms.push(room);
    const c = client(room, 'sess-mux-s4', { calls: 0, next: { action: 'cancel' } });
    const opts = [{ id: 'approve', label: 'Approve' }, { id: 'reject', label: 'Reject' }, { id: 'defer', label: 'Defer' }];
    function mintEntry(id, accepted) {
      const card = gateRender.normalizeCard({ gate_id: id, header: 'S4 probe', options: opts });
      gateLedger.mintGate(id, { card: card, sessionId: 'sess-mux-s4', kind: 'general', renderer: 'elicitation', elicited_answer: accepted });
    }
    mintEntry('g-mux-s4-dismissed', null);
    mintEntry('g-mux-s4-other', ['reject']);
    mintEntry('g-mux-s4-same', ['approve']);
    const dismissed = await c.answer('g-mux-s4-dismissed', ['approve'], 'approve');
    if (!(dismissed.ok === false && dismissed.reason === 'card_pending')) return 'dismissed: ' + JSON.stringify(dismissed).slice(0, 200);
    const other = await c.answer('g-mux-s4-other', ['approve'], 'approve');
    if (!(other.ok === false && other.reason === 'card_pending')) return 'a relay naming another choice than the accepted one: ' + JSON.stringify(other).slice(0, 200);
    const same = await c.answer('g-mux-s4-same', ['approve'], 'approve');
    if (same.ok !== true) return 'the accepted choice was refused: ' + JSON.stringify(same).slice(0, 200);
    if (!gateLedger._internal._ledger.has('g-mux-s4-dismissed') || !gateLedger._internal._ledger.has('g-mux-s4-other')) return 'a refusal consumed an entry';
    return true;
  });

  rooms.forEach(function (r) { try { r.cleanup(); } catch (_e) { /* ignore */ } });
}

// -- S3 and the doctrine arms (static) -------------------------------------------------------
function walk(dir, out) {
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, name.name);
    if (name.isDirectory()) {
      if (name.name === 'node_modules' || name.name === '.git' || name.name === 'dist') continue;
      walk(p, out);
    } else if (/\.cjs$/.test(name.name)) {
      out.push(p);
    }
  }
  return out;
}

// the text of one call expression: from the opening paren to its balanced close
function callText(src, openIdx) {
  let depth = 0;
  let inStr = null;
  for (let i = openIdx; i < src.length; i += 1) {
    const ch = src[i];
    if (inStr) {
      if (ch === '\\') { i += 1; continue; }
      if (ch === inStr) inStr = null;
      continue;
    }
    if (ch === '\'' || ch === '"' || ch === '`') { inStr = ch; continue; }
    if (ch === '(') depth += 1;
    if (ch === ')') { depth -= 1; if (depth === 0) return src.slice(openIdx, i + 1); }
  }
  return src.slice(openIdx);
}

async function staticArms() {
  await arm('S3 every gateLedger.mintGate( call site stores a renderer', function () {
    const files = [].concat(walk(path.join(ROOT, 'lib'), []), walk(path.join(ROOT, 'scripts'), []), walk(path.join(ROOT, 'bin'), []));
    const sites = [];
    for (const f of files) {
      if (f.endsWith(path.join('lib', 'mcp', 'gate-ledger.cjs'))) continue;
      const src = fs.readFileSync(f, 'utf8');
      const re = /gateLedger\.mintGate\(/g;
      let m;
      while ((m = re.exec(src)) !== null) {
        const lineStart = src.lastIndexOf('\n', m.index) + 1;
        const prefix = src.slice(lineStart, m.index).trim();
        if (prefix.startsWith('//') || prefix.startsWith('*')) continue;
        sites.push({ file: path.relative(ROOT, f), withRenderer: /\brenderer\b/.test(callText(src, m.index + m[0].length - 1)) });
      }
    }
    const naming = sites.filter(function (s) { return s.withRenderer; }).length;
    console.log('    mintGate sites: ' + sites.length + ', naming a renderer: ' + naming);
    if (sites.length < 7) return 'found only ' + sites.length + ' mintGate sites (expected at least the seven known callers)';
    if (naming !== sites.length) return 'sites without a renderer: ' + sites.filter(function (s) { return !s.withRenderer; }).map(function (s) { return s.file; }).join(', ');
    return true;
  });

  await arm('D1 the doctrine sentence is in larry-extended, research.md and larry-personality; the research mirror is fresh', function () {
    const files = ['agents/larry-extended.md', 'commands/research.md', 'skills/larry-personality/SKILL.md'];
    for (const rel of files) {
      const txt = fs.readFileSync(path.join(ROOT, rel), 'utf8').toLowerCase();
      if (txt.indexOf('answered only from the card') === -1) return rel + ' lacks "answered only from the card"';
      if (txt.indexOf('never answer a gate') === -1) return rel + ' lacks "never answer a gate"';
    }
    const mirror = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'build-skill-mirrors.cjs'), '--check'], { cwd: ROOT, encoding: 'utf8' });
    if (mirror.status !== 0) return 'build-skill-mirrors --check failed: ' + (mirror.stdout + mirror.stderr).slice(-300);
    const sk = fs.readFileSync(path.join(ROOT, 'skills', 'research', 'SKILL.md'), 'utf8').toLowerCase();
    if (sk.indexOf('answered only from the card') === -1) return 'skills/research/SKILL.md mirror lacks the sentence';
    return true;
  });

  await arm('D2 dash guard over the touched files; CHANGELOG entry present', function () {
    const files = [
      'scripts/card-before-answer-hook.cjs', 'hooks/hooks.json', 'lib/mcp/gate-ledger.cjs', 'lib/mcp/tools/gate.cjs',
      'lib/mcp/tools/research.cjs', 'lib/mcp/tools/chain.cjs', 'lib/mcp/tools/sensors.cjs', 'lib/mcp/never-do-gate.cjs', 'lib/mcp/tool-router.cjs',
      'lib/core/research-planner/canon-release.cjs', 'scripts/operator-command.cjs',
      'agents/larry-extended.md', 'commands/research.md', 'skills/research/SKILL.md', 'skills/larry-personality/SKILL.md',
      'tests/test-mux-card-before-answer.cjs', 'tests/fixtures/mux/card-shown.jsonl', 'tests/fixtures/mux/card-missing.jsonl', 'tests/fixtures/mux/card-mismatch.jsonl',
    ];
    const dirty = [];
    for (const rel of files) {
      const abs = path.join(ROOT, rel);
      if (!fs.existsSync(abs)) { dirty.push(rel + ' (missing)'); continue; }
      const txt = fs.readFileSync(abs, 'utf8');
      // lines this quick did not add may carry old long dashes; the guard is on the files it OWNS outright
      const owned = /card-before-answer-hook|test-mux|fixtures\/mux/.test(rel);
      if (owned && (txt.indexOf(EM) !== -1 || txt.indexOf(EN) !== -1)) dirty.push(rel);
    }
    if (dirty.length) return 'dash or missing: ' + dirty.join(', ');
    const baseRef = spawnSync('git', ['cat-file', '-e', MUX_BASE + '^{commit}'], { cwd: ROOT }).status === 0 ? MUX_BASE : 'HEAD';
    const added = spawnSync('git', ['diff', '-U0', baseRef, '--'].concat(files.filter(function (f) { return fs.existsSync(path.join(ROOT, f)); })), { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).stdout || '';
    const badAdded = added.split('\n').filter(function (l) { return l.startsWith('+') && !l.startsWith('+++') && (l.indexOf(EM) !== -1 || l.indexOf(EN) !== -1); });
    if (badAdded.length) return 'added lines carry a long dash: ' + badAdded[0].slice(0, 120);
    const cl = fs.readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf8');
    const unreleased = cl.slice(cl.indexOf('## [Unreleased]'), cl.indexOf('## [2.0.0-beta.57]'));
    if (unreleased.indexOf('A yes is a card, never prose') === -1) return 'CHANGELOG [Unreleased] lacks the entry';
    return true;
  });
}

async function main() {
  console.log('quick 261005-mux: a yes is a card, never prose');
  await hookArms();
  await serverArms();
  await staticArms();
  try { fs.rmSync(TMP_HOME, { recursive: true, force: true }); } catch (_e) { /* ignore */ }
  console.log('PASS=' + passed + ' FAIL=' + failed);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(function (e) {
  console.error(e && e.stack ? e.stack : e);
  process.exit(1);
});
