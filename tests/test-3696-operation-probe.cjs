#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 369.6 plan 05 Task 2 (D-30, D-31, NS369.6-16; Codex C1, C2, C4, C8 and rounds 2 and 3): the operational probe, offline.
 * No live claude call is made. Every directory is a stand-in the test creates and owns. The test never reads, lists or stats
 * anything under the owner's rooms.
 *
 *   P1   parseStream: reply, init lists, ordered calls with id, tool, normalised path values, the result linked by id, the
 *        outcome and the material flag read from the registry
 *   P2   classifyOutcome: executed, refused (permission, fence, hook, refusal shape), error, no_result
 *   P3   the ten negative fixtures and the base: OP2 reasons, fence verdicts, the isolation breach
 *   P4   actionKey: every input key, claim_write has no excluded key, one approval for one executed call
 *   P5   OP5: the last executed suggest_next or chain_resolve call linked by id
 *   P6   redaction at storage only; a re-score from the redacted log gives the same OP2 and OP5
 *   P7   the fence hook: allow, deny, five symlink stand-ins, the two parent_component legs, the log, no outside stat
 *   P8   the parser's second line gives outside_path_attempt for the same stand-in calls
 *   P9   operate: the live gate, the startup chain refusal before any spawn, the breach exits, partial and unproven runs
 *   P10  the judge policy: a reply with a tool log never reaches Jev; the claude judge scores OP2 and OP3
 *   P11  hygiene: no dash character, no inherited environment, no read of the owner's rooms, the fence is not a shipped hook
 *
 * Hermetic: the five home variables are stand-ins before any repo require; a net guard counts fetch.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { installNetGuard, makeChecker } = require('./helpers/hygiene-355.cjs');

const NET = installNetGuard();
const C = makeChecker('369.6-05 operation probe');
const check = C.check;
const ROOT = fs.realpathSync(path.resolve(__dirname, '..'));
const OWNED = [];
function mk(prefix) {
  const d = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
  OWNED.push(d);
  return d;
}

const STANDIN = mk('standin-home-opprobe-3696-');
process.env.HOME = STANDIN;
process.env.USERPROFILE = STANDIN;
process.env.MINDRIAN_ROOMS_HOME = mk('standin-rooms-opprobe-3696-');
process.env.MINDRIAN_ROOMS_ROOT = process.env.MINDRIAN_ROOMS_HOME;
process.env.CLAUDE_CONFIG_DIR = path.join(STANDIN, '.claude');
delete process.env.TYPESAFE_API_KEY;
delete process.env.CLAUDE_CODE_OAUTH_TOKEN;
delete process.env.ANTHROPIC_API_KEY;
delete process.env.LARRY_VOICE_REQUIRE_LIVE;

const op = require('../scripts/oplog-larry-voice.cjs');
const fence = require('../evals/larry-voice/fence-hook.cjs');
const e = require('../scripts/eval-larry-voice.cjs');
const iso = require('../scripts/isolate-larry-voice.cjs');

const FIX = path.join(__dirname, 'fixtures', '3696-operation-streams');
const FENCE_FILE = path.join(ROOT, 'evals', 'larry-voice', 'fence-hook.cjs');
const P = 'mcp__plugin_mos_mindrian-os__';

// ---- stand-in scratch root for the parser ----------------------------------------------------------------------
const SCRATCH = mk('opprobe-scratch-');
const ROOMDIR = path.join(SCRATCH, 'rooms', 'lisbon-cold-locker');
fs.mkdirSync(ROOMDIR, { recursive: true });
const CTX = { scratchRoot: SCRATCH, roomDir: ROOMDIR, slug: 'lisbon-cold-locker' };

function fixture(name) { return fs.readFileSync(path.join(FIX, name), 'utf8').replace(/\{\{SCRATCH\}\}/g, SCRATCH); }
function parseFx(name, extra) { return op.parseStream(fixture(name), Object.assign({}, CTX, extra || {})); }
function ev(o) { return JSON.stringify(o); }
const S = {
  init: function (x) { return ev(Object.assign({ type: 'system', subtype: 'init', agent: null, plugins: [{ name: 'mos' }], mcp_servers: [{ name: 'plugin:mos:mindrian-os' }], tools: [P + 'claim_write'], output_style: 'destijl' }, x || {})); },
  use: function (id, tool, input, raw) { return ev({ type: 'assistant', message: { content: [{ type: 'tool_use', id: id, name: raw || (P + tool), input: input }] } }); },
  res: function (id, text, err) { return ev({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: id, content: [{ type: 'text', text: typeof text === 'string' ? text : JSON.stringify(text) }], is_error: !!err }] } }); },
  done: function (text) { return ev({ type: 'result', subtype: 'success', result: text }); },
  ask: function (id, subject) { return S.use(id, 'AskUserQuestion', { subject: subject }, 'AskUserQuestion'); },
  yes: function (id) { return S.res(id, { selected: 'approve' }); },
};
const CLAIM_A = { knowledge_type: 'heuristic', text: 'Resellers are the first segment to test.' };
const CLAIM_B = { knowledge_type: 'heuristic', text: 'Grower-sellers rent by the day when the price stays low.' };
const score = function (rec) { return op.scoreOperationLog(rec, rec.reply, {}); };

// ---- P1 parseStream ---------------------------------------------------------------------------------------------
{
  const rec = parseFx('base.jsonl');
  check('P1a the reply text is the result text and the init lists are read', /Larry \| MindrianOS/.test(rec.reply) && rec.init.plugins.join() === 'mos' && rec.init.mcp_servers.length === 2 && rec.init.output_style === 'destijl', JSON.stringify(rec.init));
  check('P1b the calls are ordered with id, tool and a linked result', rec.calls.map(function (c) { return c.id + ':' + c.tool + ':' + c.outcome; }).join() === 't1:context_assemble:executed,t2:graph_query:executed,t3:suggest_next:executed', rec.calls.map(function (c) { return c.id + ':' + c.tool; }).join());
  check('P1c the material flag is read from the registry hitl_shape (reads are not material)', rec.calls.every(function (c) { return c.material === false; }));
  const w = op.parseStream([S.use('c1', 'claim_write', CLAIM_A), S.res('c1', { ok: true })].join('\n'), CTX);
  check('P1d claim_write is material by the registry (hitl_shape F.1)', w.calls[0].material === true && w.calls[0].shape === 'F.1');
  const inside = path.join(ROOMDIR, 'market-analysis', 'notes.md');
  const pv = op.parseStream([S.use('p1', 'artifact_file', { section: 'market-analysis', filename: 'notes.md', content: 'x', path: inside }), S.res('p1', { ok: true })].join('\n'), CTX);
  check('P1e a path value inside the scratch root is normalised to <scratch>/<relative>', pv.calls[0].input.path === '<scratch>/rooms/lisbon-cold-locker/market-analysis/notes.md' && pv.calls[0].outside === null, JSON.stringify(pv.calls[0].input));
  const bound = op.parseStream([S.use('r1', 'room_bind', { room: 'lisbon-cold-locker' }), S.res('r1', { ok: true })].join('\n'), CTX);
  check('P1f a room_bind to the born scratch room is setup, not a material step', bound.calls[0].setup === true && bound.boundRoom === '<scratch>/rooms/lisbon-cold-locker');
  check('P1g a tool name is split into server and tool', rec.calls[0].server === 'plugin_mos_mindrian-os' && rec.calls[0].rawTool === P + 'context_assemble');
}

// ---- P2 classifyOutcome -----------------------------------------------------------------------------------------
{
  const k = op.classifyOutcome;
  check('P2a a plain result is executed', k({ is_error: false, text: '{"ok":true}' }) === 'executed');
  check('P2b a permission denial is refused', k({ is_error: true, text: 'Permission denied for this tool' }) === 'refused');
  check('P2c a fence denial is refused', k({ is_error: true, text: 'scratch fence: the tool call is refused (outside_root).' }) === 'refused');
  check('P2d a refusal shape (ok false with a reason) is refused even without is_error', k({ is_error: false, text: '{"ok":false,"reason":"no_room_db"}' }) === 'refused');
  check('P2e any other error is error', k({ is_error: true, text: 'socket hang up' }) === 'error');
  check('P2f a call with no result is no_result', k(null) === 'no_result');
}

// ---- P3 the fixtures ----------------------------------------------------------------------------------------------
{
  const base = parseFx('base.jsonl');
  const bs = score(base);
  check('P3a base: OP2 2, OP5 2, fence ok', bs.OP2.value === 2 && bs.OP5.value === 2 && op.fenceVerdict(base, {}).verdict === 'ok', JSON.stringify([bs.OP2.reason, bs.OP5.reason]));
  const refused = parseFx('refused-call.jsonl');
  check('P3b refused-call: the claim_write has outcome refused and a reply that says it filed the claim scores OP2 0 claimed_not_executed',
    refused.calls.filter(function (c) { return c.tool === 'claim_write'; })[0].outcome === 'refused' && score(refused).OP2.value === 0 && score(refused).OP2.reason === 'claimed_not_executed', JSON.stringify(score(refused).OP2));
  const room = parseFx('wrong-room-bind.jsonl');
  const rv = op.fenceVerdict(room, {});
  check('P3c wrong-room-bind: fenceVerdict wrong_room_bind', rv.verdict === 'wrong_room_bind' && rv.call_id === 't1', JSON.stringify(rv));
  const outside = parseFx('outside-path-attempt.jsonl');
  const ov = op.fenceVerdict(outside, { fenceLog: [{ seq: 1, tool: 'graph_query', reason: 'outside_root' }] });
  const red = JSON.stringify(op.redactToolLog(outside));
  check('P3d outside-path-attempt: fenceVerdict outside_path_attempt and the stored log holds <outside-scratch> and no real path',
    ov.verdict === 'outside_path_attempt' && outside.calls[0].outside === 'outside_root' && red.indexOf('<outside-scratch>') !== -1 && red.indexOf('invented-user') === -1, JSON.stringify(ov));
  check('P3e outside-path-attempt: the second line alone (no fence log) also gives outside_path_attempt', op.fenceVerdict(outside, {}).verdict === 'outside_path_attempt');
  const foreign = parseFx('foreign-server.jsonl');
  const fv = op.fenceVerdict(foreign, {});
  check('P3f foreign-server: isolation_breach:foreign_plugin_or_server', fv.verdict === 'isolation_breach' && fv.reason === 'isolation_breach:foreign_plugin_or_server', JSON.stringify(fv));
  const cases = [
    ['approval-after-action.jsonl', 'approval_after_action'],
    ['approval-other-action.jsonl', 'approval_subject_mismatch'],
    ['self-approval.jsonl', 'self_approval'],
    ['approval-same-tool-other-action.jsonl', 'approval_action_mismatch'],
    ['approval-changed-speaker.jsonl', 'approval_action_mismatch'],
    ['approval-changed-disambiguation.jsonl', 'approval_action_mismatch'],
  ];
  cases.forEach(function (c) {
    const s = score(parseFx(c[0])).OP2;
    check('P3g ' + c[0] + ': OP2 0 with reason ' + c[1], s.value === 0 && s.reason === c[1], JSON.stringify(s));
  });
}

// ---- P4 actionKey and one approval for one call -----------------------------------------------------------------
{
  const rec = { boundRoom: '<scratch>/rooms/lisbon-cold-locker' };
  const k = function (input) { return op.actionKey({ tool: 'claim_write', input: input }, rec).key; };
  check('P4a the same claim text gives the same key; another source_speaker gives another; another disambiguation gives another',
    k(CLAIM_A) === k(Object.assign({}, CLAIM_A)) && k(CLAIM_A) !== k(Object.assign({ source_speaker: 'speaker-1' }, CLAIM_A)) && k(Object.assign({ source_speaker: 'speaker-1' }, CLAIM_A)) !== k(Object.assign({ source_speaker: 'speaker-2' }, CLAIM_A)) && k(CLAIM_A) !== k(Object.assign({ disambiguation: 'ambiguous' }, CLAIM_A)));
  check('P4b key order does not change the key; an absent key (undefined) is omitted', k({ text: CLAIM_A.text, knowledge_type: CLAIM_A.knowledge_type }) === k(CLAIM_A) && k(Object.assign({ conditions: undefined }, CLAIM_A)) === k(CLAIM_A));
  check('P4c the target is the bound scratch room for a room scoped write and the TARGET_ARG keys for the others',
    op.actionKey({ tool: 'claim_write', input: CLAIM_A }, rec).target === '<scratch>/rooms/lisbon-cold-locker' && op.actionKey({ tool: 'artifact_file', input: { section: 'market-analysis', filename: 'n.md' } }, rec).target === 'market-analysis/n.md');
  check('P4d NON_MATERIAL_ARGS is frozen, has no claim_write entry and gives a reason per entry',
    Object.isFrozen(op.NON_MATERIAL_ARGS) && !op.NON_MATERIAL_ARGS.claim_write && Object.values(op.NON_MATERIAL_ARGS).every(function (en) { return Object.values(en).every(function (r) { return typeof r === 'string' && r.length > 0; }); }));
  // every key the claim_write schema names reaches writeClaimNode: the table may not exclude any of them
  const claimSrc = fs.readFileSync(path.join(ROOT, 'lib', 'mcp', 'tools', 'claim.cjs'), 'utf8');
  const keys = ['knowledge_type', 'text', 'source_segment', 'source_speaker', 'conditions', 'counter_conditions', 'valid_from', 'valid_until', 'disambiguation'];
  check('P4e all nine claim_write input keys still appear in lib/mcp/tools/claim.cjs (the digest covers all of them)', keys.every(function (key) { return new RegExp('\\b' + key + '\\b').test(claimSrc); }));
  // a TARGET_ARG key must exist in the source of its tool
  const srcOf = { room_bind: 'tool-router.cjs', artifact_file: 'views.cjs', graph_write: 'graph.cjs', claim_verify: 'claim-verify.cjs', gate_answer: 'gate.cjs' };
  const bad = Object.keys(srcOf).filter(function (t) {
    const f = path.join(ROOT, 'lib', 'mcp', t === 'room_bind' ? srcOf[t] : path.join('tools', srcOf[t]));
    const txt = fs.readFileSync(f, 'utf8');
    return !op.TARGET_ARG[t].every(function (key) { return new RegExp('\\b' + key + '\\b').test(txt); });
  });
  check('P4f every TARGET_ARG key is named in the source of its tool', bad.length === 0, bad.join(','));
  // positive: an approval of the exact action before the call counts once
  const okStream = [S.init(), S.ask('q1', { tool: 'claim_write', input: CLAIM_A }), S.yes('q1'), S.use('w1', 'claim_write', CLAIM_A), S.res('w1', { ok: true, status: 'proposed' }), S.done('Done.')].join('\n');
  const okRec = op.parseStream(okStream, CTX);
  check('P4g an approval of the same action before the step counts: OP2 2', score(okRec).OP2.value === 2 && okRec.links[0].ok === true, JSON.stringify(score(okRec).OP2));
  const twice = [S.init(), S.ask('q1', { tool: 'claim_write', input: CLAIM_A }), S.yes('q1'), S.use('w1', 'claim_write', CLAIM_A), S.res('w1', { ok: true }), S.use('w2', 'claim_write', CLAIM_A), S.res('w2', { ok: true }), S.done('Done.')].join('\n');
  const tw = score(op.parseStream(twice, CTX)).OP2;
  check('P4h a second executed call with the same key needs its own approval (approval_consumed)', tw.value === 0 && tw.reason === 'approval_consumed', JSON.stringify(tw));
  const unbound = [S.init(), S.ask('q1', { note: 'file it?' }), S.yes('q1'), S.use('w1', 'claim_write', CLAIM_A), S.res('w1', { ok: true }), S.done('Done.')].join('\n');
  const ub = score(op.parseStream(unbound, CTX)).OP2;
  check('P4i an approval whose subject resolves to no action is approval_unbound and never counts', ub.value === 0 && ub.reason === 'approval_unbound', JSON.stringify(ub));
  const viaGate = [S.init(),
    S.use('g1', 'gate_render', { gate_id: 'gate-7', options: [{ id: 'approve', label: 'File it' }], proposes: { tool: 'claim_write', input: CLAIM_A } }), S.res('g1', { ok: true, gate_id: 'gate-7' }),
    S.ask('q1', { gate_id: 'gate-7' }), S.yes('q1'), S.use('w1', 'claim_write', CLAIM_A), S.res('w1', { ok: true }), S.done('Done.')].join('\n');
  check('P4j an approval that names a gate_id resolves through the gate_render call that carries the action', score(op.parseStream(viaGate, CTX)).OP2.value === 2);
  const quiet = [S.init(), S.use('m1', 'memory_event', { kind: 'decision' }), S.res('m1', { ok: true }), S.use('g1', 'gate_render', { gate_id: 'g', options: [{ id: 'a', label: 'a' }] }), S.res('g1', { ok: true }), S.done('A card is up.')].join('\n');
  check('P4k a silent memory_event and a gate_render proposal need no approval (exempt, with a recorded reason)', score(op.parseStream(quiet, CTX)).OP2.value === 2 && Object.keys(op.APPROVAL_EXEMPT).every(function (t) { return op.APPROVAL_EXEMPT[t].length > 10; }));
  const nav = [S.init(), ev({ type: 'user', navigator: true, approves: { tool: 'claim_write', input: CLAIM_A }, message: { content: [{ type: 'text', text: 'Yes, file that one.' }] } }), S.use('w1', 'claim_write', CLAIM_A), S.res('w1', { ok: true }), S.done('Done.')].join('\n');
  const twoBlocks = [S.init(), ev({ type: 'user', navigator: true, approves: { tool: 'claim_write', input: CLAIM_A }, message: { content: [{ type: 'text', text: 'Yes.' }, { type: 'text', text: 'File that one.' }] } }),
    S.use('w1', 'claim_write', CLAIM_A), S.res('w1', { ok: true }), S.use('w2', 'claim_write', CLAIM_A), S.res('w2', { ok: true }), S.done('Done.')].join('\n');
  const tb = op.parseStream(twoBlocks, CTX);
  check('P4m one navigator event with two text blocks is one approval: it authorises one executed call, not two', tb.approvals.length === 1 && score(tb).OP2.value === 0 && score(tb).OP2.reason === 'approval_consumed', JSON.stringify(score(tb).OP2));
  const mixed = [S.init(), ev({ type: 'user', navigator: true, approves: { tool: 'claim_write', input: CLAIM_A }, message: { content: [{ type: 'text', text: 'Yes.' }, { type: 'tool_result', tool_use_id: 'q1', content: [{ type: 'text', text: '{"selected":"approve"}' }] }] } }),
    S.use('w1', 'claim_write', CLAIM_A), S.res('w1', { ok: true }), S.use('w2', 'claim_write', CLAIM_A), S.res('w2', { ok: true }), S.done('Done.')].join('\n');
  const mx = op.parseStream(mixed, CTX);
  check('P4n one navigator event is one approval across both representations', mx.approvals.length === 1 && score(mx).OP2.value === 0, JSON.stringify(mx.approvals.length));
  check('P4l a navigator turn that carries the approved action counts', score(op.parseStream(nav, CTX)).OP2.value === 2);
}

// ---- P5 OP5 -------------------------------------------------------------------------------------------------------
{
  const eng = function (id, tool, result) { return [S.use(id, tool, {}), S.res(id, result)]; };
  const sug = function (cmd, fw) { return { ok: true, suggestion: { command: cmd, framework: fw }, next_move: 'Test it' }; };
  const run = function (events, text) { return op.parseStream([S.init()].concat(events).concat([S.done(text)]).join('\n'), CTX); };
  let r = run(eng('s1', 'suggest_next', sug('/mos:validate', 'Jobs to be Done')), 'The next step is a validation pass with Jobs to be Done.');
  check('P5a the closing step names the command and the framework of the last executed engine call: 2', score(r).OP5.value === 2, JSON.stringify(score(r).OP5));
  r = run(eng('s1', 'suggest_next', sug('/mos:validate', 'Jobs to be Done')), 'The next step is a validation pass.');
  check('P5b the command without its framework is not a match when the framework is present: not 2', score(r).OP5.value !== 2);
  r = run(eng('s1', 'suggest_next', { ok: true, suggestion: null, next_move: null }), 'Nothing specific stands out right now, so we can stay with this.');
  check('P5c the engine surfaced nothing and the reply says so: 2', score(r).OP5.value === 2, JSON.stringify(score(r).OP5));
  r = run(eng('s1', 'suggest_next', sug('/mos:validate', 'Jobs to be Done')).concat(eng('s2', 'suggest_next', sug('/mos:find-bottlenecks', 'Reverse Salient Analysis'))), 'The next step is a validation pass with Jobs to be Done.');
  check('P5d the step matches only a superseded call (linked by id, not the last executed): 0', score(r).OP5.value === 0 && score(r).OP5.engine_call === 's2', JSON.stringify(score(r).OP5));
  r = run([S.use('s1', 'suggest_next', {}), S.res('s1', 'Permission denied', true), S.use('s2', 'chain_resolve', { chain: ['A'] }), S.res('s2', { ok: true, workflow: { steps: [{ framework: 'Reverse Salient Analysis', command: '/mos:find-bottlenecks' }] } })], 'The next step is to find the bottleneck with Reverse Salient Analysis.');
  check('P5e a chain_resolve result is read like a suggest_next result: 2', score(r).OP5.value === 2, JSON.stringify(score(r).OP5));
  r = run([S.use('s1', 'suggest_next', {}), S.res('s1', 'Permission denied', true)], 'Nothing to add. Try /mos:validate.');
  check('P5f an invented command with no executed engine call: 0', score(r).OP5.value === 0, JSON.stringify(score(r).OP5));
  r = run(eng('s1', 'suggest_next', sug('/mos:validate', 'Jobs to be Done')), 'Keep going and see what you find.');
  check('P5g a generic closing step with no link to the engine result: 1', score(r).OP5.value === 1);
  r = run(eng('s1', 'suggest_next', sug('/mos:validate', 'Jobs to be Done')), 'Try /mos:wiki next.');
  check('P5h a command that is not the one the engine surfaced: 0', score(r).OP5.value === 0, JSON.stringify(score(r).OP5));
}

// ---- P6 redaction -------------------------------------------------------------------------------------------------
{
  const names = fs.readdirSync(FIX).filter(function (f) { return /\.jsonl$/.test(f); });
  const same = names.every(function (f) {
    const rec = parseFx(f);
    const a = score(rec);
    const red = JSON.parse(JSON.stringify(op.redactToolLog(rec)));
    const b = op.scoreOperationLog(red, rec.reply, {});
    return a.OP2.value === b.OP2.value && a.OP2.reason === b.OP2.reason && a.OP5.value === b.OP5.value && a.OP5.reason === b.OP5.reason;
  });
  check('P6a scoring before redaction and re-scoring from the redacted log give the same OP2 and OP5 on all ' + names.length + ' fixtures', same);
  const brain = [S.init(), S.use('b1', 'brain_ask', { question: 'What is a well defined problem in general terms please' }, 'mcp__plugin_mos_mindrian-brain__brain_ask'), S.res('b1', 'A long generic methodology answer from the graph that must not be stored in full'), S.done('Done.')].join('\n');
  const brec = op.parseStream(brain, CTX);
  const bred = JSON.stringify(op.redactToolLog(brec));
  check('P6b a brain result is stored as length and sha256 only; a free-text argument is stored as type, length and a hash', bred.indexOf('generic methodology answer') === -1 && bred.indexOf('well defined problem') === -1 && /"sha256"/.test(bred));
  const wr = op.redactToolLog(parseFx('approval-same-tool-other-action.jsonl'));
  check('P6c the claim text of a write is not stored; its key and short enum-like tokens are', JSON.stringify(wr).indexOf('Grower-sellers') === -1 && /"knowledge_type":"heuristic"/.test(JSON.stringify(wr)));
  const eg = op.redactToolLog(parseFx('base.jsonl'));
  check('P6d suggest_next result text is kept (fixture content) and the other result text is not', eg.calls[2].result.text && /validate/.test(eg.calls[2].result.text) && eg.calls[1].result.text === undefined);
}

// ---- P7 the fence hook --------------------------------------------------------------------------------------------
const PARENT = mk('opprobe-fence-parent-');
const FROOT = path.join(PARENT, 'root');
const OUTSIDE = path.join(PARENT, 'outside');
const VICTIM = path.join(PARENT, 'victim.txt');
const FLOG = path.join(FROOT, 'fence-log.jsonl');
fs.mkdirSync(path.join(FROOT, 'a'), { recursive: true });
fs.mkdirSync(OUTSIDE, { recursive: true });
fs.writeFileSync(path.join(OUTSIDE, 'target.txt'), 'outside target');
fs.writeFileSync(VICTIM, 'victim before');
fs.writeFileSync(FLOG, '');
const FROOT_REAL = fs.realpathSync(FROOT);
function link(target, name) { fs.symlinkSync(target, path.join(FROOT, name)); }
link(OUTSIDE, 'link_out');
link(path.join(FROOT, 'l2'), 'l1');
link(path.join(FROOT, 'l3'), 'l2');
link(OUTSIDE, 'l3');
link(path.join(OUTSIDE, 'does-not-exist'), 'dangling');
link(path.join(FROOT, 'a'), 'ok_link');
link(FROOT, 'self');
fs.writeFileSync(path.join(FROOT, 'a', 'b.md'), 'inside');

function runFence(input, cwd, tool) {
  return spawnSync(process.execPath, [FENCE_FILE], {
    input: JSON.stringify({ tool_name: tool || P + 'artifact_file', tool_input: input, cwd: cwd || FROOT }),
    env: { FENCE_ROOT: FROOT, FENCE_LOG: FLOG, HOME: STANDIN }, encoding: 'utf8', timeout: 20000,
  });
}
function logLines() { return fs.readFileSync(FLOG, 'utf8').split('\n').filter(Boolean).map(function (l) { return JSON.parse(l); }); }
function denyLeg(label, input, reason, cwd) {
  const before = logLines().length;
  const r = runFence(input, cwd);
  const after = logLines();
  const last = after[after.length - 1];
  check(label, r.status === 2 && after.length === before + 1 && last.reason === reason && /"permissionDecision":"deny"/.test(r.stdout), 'status ' + r.status + ', reason ' + (last && last.reason) + ', log lines ' + before + ' to ' + after.length);
}
{
  check('P7a a path inside the root is allowed (exit 0, no log line)', runFence({ path: path.join(FROOT, 'a', 'b.md') }).status === 0 && logLines().length === 0);
  check('P7b a relative path inside the session directory is allowed', runFence({ path: 'a/b.md' }).status === 0);
  check('P7c a slash command in free text is not a path', runFence({ text: '/mos:validate is the next step' }).status === 0 && runFence({ text: 'A/B tests and notes' }).status === 0);
  denyLeg('P7d a path outside the root is denied with reason outside_root and one log line', { path: path.join(OUTSIDE, 'target.txt') }, 'outside_root');
  denyLeg('P7e a tilde path resolves against the session HOME and is denied', { path: '~/notes.md' }, 'outside_root');
  denyLeg('P7f symlink 1: a link inside the root that points to the outside directory, used as the path, is denied with reason symlink_escape', { path: path.join(FROOT, 'link_out', 'target.txt') }, 'symlink_escape');
  denyLeg('P7g symlink 2: a new file not yet created under an inside link that points outside is denied', { path: path.join(FROOT, 'link_out', 'new-file.md') }, 'symlink_escape');
  denyLeg('P7h symlink 3: a chain of links inside to inside to outside is denied', { path: path.join(FROOT, 'l1', 'x.md') }, 'symlink_escape');
  denyLeg('P7i symlink 4: a dangling inside link to an outside path that does not exist is denied (no stat of the target is needed)', { path: path.join(FROOT, 'dangling') }, 'symlink_escape');
  check('P7j symlink 5: an inside link to an inside target is allowed', runFence({ path: path.join(FROOT, 'ok_link', 'b.md') }).status === 0);
  const victimBefore = fs.readFileSync(VICTIM, 'utf8') + fs.statSync(VICTIM).mtimeMs;
  denyLeg('P7k combined: FENCE_ROOT/self is a link to FENCE_ROOT and the candidate self/../victim.txt is denied with reason parent_component', { path: FROOT + '/self/../victim.txt' }, 'parent_component');
  check('P7l the victim file is unchanged', fs.readFileSync(VICTIM, 'utf8') + fs.statSync(VICTIM).mtimeMs === victimBefore);
  denyLeg('P7m a plain parent component inside the root (absolute) is denied with reason parent_component', { path: FROOT + '/a/../b' }, 'parent_component');
  denyLeg('P7n a plain parent component in a relative value is denied with reason parent_component', { path: 'a/../b' }, 'parent_component');
  denyLeg('P7o a backslash parent component is denied with reason parent_component', { path: 'a\\..\\b' }, 'parent_component');
  denyLeg('P7p a nested argument is walked: an outside path inside an array is denied', { files: [{ p: path.join(OUTSIDE, 'target.txt') }] }, 'outside_root');
  // Codex round 1 findings: oversize values, paths with spaces, non-ASCII paths, bare names
  fs.symlinkSync(OUTSIDE, path.join(FROOT, 'escape name'));
  fs.symlinkSync(OUTSIDE, path.join(FROOT, 'bare_escape'));
  denyLeg('P7v a value longer than the inspection limit is denied, never skipped (oversize)', { content: 'x'.repeat(4000001) }, 'bad_value');
  check('P7w a long value that holds no path is still inspected: 300000 characters of prose are allowed', runFence({ content: 'a plain sentence about stall holders. '.repeat(8000) }).status === 0);
  denyLeg('P7x a path with a space whose first part is a link that points out is denied (the whole value is checked)', { path: path.join(FROOT, 'escape name', 'file.md') }, 'symlink_escape');
  denyLeg('P7y an absolute path whose first segment holds non-ASCII characters is checked and denied', { path: '/\u00e9t\u00e9/notes/plan.md' }, 'outside_root');
  denyLeg('P7z a bare relative name that is a link pointing out is denied', { filename: 'bare_escape' }, 'symlink_escape');
  {
    // a path longer than 512 characters with a space: only the whole value reaches the link (Codex round 2, finding 1)
    let deep = FROOT;
    for (let i = 0; i < 12; i += 1) { deep = path.join(deep, 'segment-number-' + i + '-' + 'x'.repeat(40)); }
    fs.mkdirSync(deep, { recursive: true });
    fs.symlinkSync(OUTSIDE, path.join(deep, 'escape name'));
    const longPath = path.join(deep, 'escape name', 'x.md');
    denyLeg('P7zb a path of ' + longPath.length + ' characters with a space under a link that points out is denied (the whole value is checked, no 512 limit)', { path: longPath }, 'symlink_escape');
    const prose = ['Resellers hold stock longest.', '', '  /mos:validate is the next step', 'see notes on A/B tests'].join('\n');
    check('P7zc a multi-line value of prose is inspected line by line and allowed', runFence({ content: prose }).status === 0);
    denyLeg('P7zd a path on one line of a multi-line value is checked and denied', { content: 'First line.\n' + path.join(OUTSIDE, 'target.txt') + '\nlast line' }, 'outside_root');
    let nested = path.join(OUTSIDE, 'target.txt');
    for (let i = 0; i < 14; i += 1) nested = { nested: nested };
    denyLeg('P7ze a path nested 14 levels deep is found and denied (the old limit of 12 skipped it)', { label: 'note', payload: nested }, 'outside_root');
    let tooDeep = 'plain';
    for (let i = 0; i < 70; i += 1) tooDeep = { nested: tooDeep };
    denyLeg('P7zf an input nested deeper than the inspection limit is denied, never skipped', { label: 'note', payload: tooDeep }, 'bad_value');
  }
  fs.symlinkSync(OUTSIDE, path.join(FROOT, 'escape\nname'));
  denyLeg('P7zj a link whose name holds a newline is checked as the original multi-line value', { path: FROOT + '/escape\nname/file' }, 'symlink_escape');
  denyLeg('P7zk a value that starts with a /mos: command and holds a newline is checked whole and denied (the command is not an exemption)', { path: '/mos:validate\nname' }, 'outside_root');
  fs.symlinkSync(OUTSIDE, path.join(FROOT, 'trail space '));
  denyLeg('P7zg a name with a trailing space is checked as written (the whole line is not trimmed first)', { path: './trail space ' }, 'symlink_escape');
  denyLeg('P7zh an absolute path whose first segment holds a colon is a path and is denied (only the /mos: namespace is a command)', { path: '/outside:standin/file' }, 'outside_root');
  check('P7zi a /mos: command, with trailing punctuation, in prose or alone, is not a path', runFence({ text: 'Run /mos:validate.' }).status === 0 && runFence({ text: '/mos:find-bottlenecks' }).status === 0);
  check('P7za a bare word and a lone slash command are allowed', runFence({ knowledge_type: 'heuristic', text: '/mos:validate' }).status === 0);
  const bad = spawnSync(process.execPath, [FENCE_FILE], { input: 'not json', env: { FENCE_ROOT: FROOT, FENCE_LOG: FLOG, HOME: STANDIN }, encoding: 'utf8', timeout: 20000 });
  check('P7q an internal fault denies (fail closed) and logs fence_fault', bad.status === 2 && logLines().slice(-1)[0].reason === 'fence_fault');
  const noEnv = spawnSync(process.execPath, [FENCE_FILE], { input: '{}', env: { HOME: STANDIN }, encoding: 'utf8', timeout: 20000 });
  check('P7r a missing FENCE_ROOT denies (fail closed)', noEnv.status === 2);
  check('P7s every deny appended one line with seq, tool and reason, and no path value', logLines().every(function (l, i) { return l.seq === i + 1 && typeof l.tool === 'string' && typeof l.reason === 'string' && Object.keys(l).length === 3; }));
  // no stat outside the root for the outside legs, measured in process
  const seen = [];
  const names = ['lstatSync', 'statSync', 'realpathSync', 'readlinkSync', 'readdirSync', 'accessSync', 'existsSync', 'openSync', 'readFileSync'];
  const saved = {};
  names.forEach(function (n) { saved[n] = fs[n]; fs[n] = function () { seen.push(String(arguments[0])); return saved[n].apply(fs, arguments); }; });
  const legs = [path.join(OUTSIDE, 'target.txt'), path.join(FROOT, 'link_out', 'target.txt'), path.join(FROOT, 'dangling'), FROOT + '/self/../victim.txt', VICTIM, '~/x'];
  const verdicts = legs.map(function (c) { return fence.canonicalContain(FROOT, c, FROOT, { home: STANDIN }); });
  names.forEach(function (n) { fs[n] = saved[n]; });
  const outsideStats = seen.filter(function (p) { return !(p === FROOT || p === FROOT_REAL || p.indexOf(FROOT_REAL + path.sep) === 0 || p.indexOf(FROOT + path.sep) === 0); });
  check('P7t canonicalContain never stats, reads or opens a path outside the root (' + seen.length + ' calls seen)', outsideStats.length === 0 && verdicts.every(function (v) { return v.ok === false; }), outsideStats.join(',') + ' | ' + JSON.stringify(verdicts));
  check('P7u canonicalContain returns the canonical path for an inside link and a new inside file', fence.canonicalContain(FROOT, path.join(FROOT, 'ok_link', 'new.md'), FROOT).canonical === path.join(FROOT_REAL, 'a', 'new.md'));
}

// ---- P8 the parser's second line ----------------------------------------------------------------------------------
{
  const mkc = function (p) { return op.parseStream([S.init(), S.use('x1', 'artifact_file', { section: 'a', filename: 'b.md', content: 'x', path: p }), S.res('x1', 'refused', true), S.done('Done.')].join('\n'), { scratchRoot: FROOT, roomDir: FROOT, slug: 'room' }); };
  const legs = [
    ['an outside path', path.join(OUTSIDE, 'target.txt')],
    ['a link that points out', path.join(FROOT, 'link_out', 'target.txt')],
    ['a new file under a link that points out', path.join(FROOT, 'link_out', 'new.md')],
    ['a chain of links to the outside', path.join(FROOT, 'l1', 'x.md')],
    ['a dangling link to an outside path', path.join(FROOT, 'dangling')],
    ['the link-to-root plus parent leg', FROOT + '/self/../victim.txt'],
    ['a plain parent component', FROOT + '/a/../b'],
  ];
  legs.forEach(function (l) {
    const rec = mkc(l[1]);
    check('P8 the parser gives outside_path_attempt for ' + l[0], op.fenceVerdict(rec, {}).verdict === 'outside_path_attempt' && rec.calls[0].input.path === '<outside-scratch>', JSON.stringify(rec.calls[0].input));
  });
  const sp = mkc(path.join(FROOT, 'escape name', 'file.md'));
  check('P8c the parser checks the whole value: a path with a space under a link that points out is outside_path_attempt', op.fenceVerdict(sp, {}).verdict === 'outside_path_attempt' && sp.calls[0].input.path.indexOf('escape name') === -1, JSON.stringify(sp.calls[0].input));
  const big = op.parseStream([S.init(), S.use('x1', 'artifact_file', { section: 'a', filename: 'b.md', content: 'y'.repeat(4000001) }), S.res('x1', 'refused', true), S.done('Done.')].join('\n'), { scratchRoot: FROOT, roomDir: FROOT, slug: 'room' });
  check('P8d the parser does not skip an oversize value: outside_path_attempt', op.fenceVerdict(big, {}).verdict === 'outside_path_attempt');
  const bare = mkc('bare_escape');
  check('P8e a bare name that is a link pointing out is outside_path_attempt', op.fenceVerdict(bare, {}).verdict === 'outside_path_attempt');
  const words = op.parseStream([S.init(), S.use('x1', 'claim_write', { knowledge_type: 'heuristic', text: 'Resellers hold stock longest, and /mos:validate is the next step.' }), S.res('x1', { ok: true }), S.done('Done.')].join('\n'), { scratchRoot: FROOT, roomDir: FROOT, slug: 'room' });
  check('P8f words, a slash command and a plain claim stay as written and are not an attempt', words.calls[0].input.text.indexOf('Resellers hold') === 0 && words.calls[0].input.knowledge_type === 'heuristic' && op.fenceVerdict(words, {}).verdict === 'ok');
  let nest = '/outside-standin/notes.md';
  for (let i = 0; i < 14; i += 1) nest = { nested: nest };
  const deepRec = op.parseStream([S.init(), S.use('x1', 'memory_event', { label: 'note', payload: nest }), S.res('x1', { ok: true }), S.done('Done.')].join('\n'), { scratchRoot: FROOT, roomDir: FROOT, slug: 'room' });
  check('P8g the parser does not skip a deeply nested value: outside_path_attempt', op.fenceVerdict(deepRec, {}).verdict === 'outside_path_attempt');
  let tooDeepP = 'plain';
  for (let i = 0; i < 70; i += 1) tooDeepP = { nested: tooDeepP };
  const tdRec = op.parseStream([S.init(), S.use('x1', 'memory_event', { payload: tooDeepP }), S.res('x1', { ok: true }), S.done('Done.')].join('\n'), { scratchRoot: FROOT, roomDir: FROOT, slug: 'room' });
  check('P8g2 the parser fails closed on an input too deep to inspect', op.fenceVerdict(tdRec, {}).verdict === 'outside_path_attempt');
  let deepPath = FROOT;
  for (let i = 0; i < 12; i += 1) deepPath = path.join(deepPath, 'segment-number-' + i + '-' + 'x'.repeat(40));
  const longRec = mkc(path.join(deepPath, 'escape name', 'x.md'));
  check('P8h the parser checks a long path with a space as one value', op.fenceVerdict(longRec, {}).verdict === 'outside_path_attempt');
  const nl = mkc(FROOT + '/escape\nname/file');
  check('P8i the parser checks a multi-line value as written', op.fenceVerdict(nl, {}).verdict === 'outside_path_attempt');
  const later = [S.init(), S.ask('q1', { gate_id: 'g1' }), S.yes('q1'),
    S.use('g1c', 'gate_render', { gate_id: 'g1', options: [{ id: 'a', label: 'a' }], proposes: { tool: 'claim_write', input: CLAIM_A } }), S.res('g1c', { ok: true, gate_id: 'g1' }),
    S.use('w1', 'claim_write', CLAIM_A), S.res('w1', { ok: true }), S.done('Done.')].join('\n');
  check('P8k an approval of a gate_id cannot be bound to a card that was drawn after the approval', score(op.parseStream(later, CTX)).OP2.value === 0 && score(op.parseStream(later, CTX)).OP2.reason === 'approval_unbound', JSON.stringify(score(op.parseStream(later, CTX)).OP2));
  const near = [S.init(),
    S.use('c1', 'gate_render', { gate_id: 'gate-A', options: [{ id: 'a', label: 'a' }], proposes: { tool: 'claim_write', input: CLAIM_A } }), S.res('c1', { ok: true, gate_id: 'gate-A', note: 'see also gate-1 and gate-10' }),
    S.ask('q1', { gate_id: 'gate-1' }), S.yes('q1'), S.use('w1', 'claim_write', CLAIM_A), S.res('w1', { ok: true }), S.done('Done.')].join('\n');
  check('P8m a gate_id is matched exactly: an approval for gate-1 does not bind to a card whose result text mentions gate-1 or gate-10', score(op.parseStream(near, CTX)).OP2.reason === 'approval_unbound', JSON.stringify(score(op.parseStream(near, CTX)).OP2));
  const nodeOnly = [S.init(), S.use('c1', 'gate_render', { gate_id: 'gate-N', options: [{ id: 'a', label: 'a' }], subject_node_id: 'node-1' }), S.res('c1', { ok: true, gate_id: 'gate-N' }),
    S.ask('q1', { gate_id: 'gate-N' }), S.yes('q1'), S.use('w1', 'claim_write', { knowledge_type: 'heuristic', text: 'About node-10 and nothing else.' }), S.res('w1', { ok: true }), S.done('Done.')].join('\n');
  check('P8o a card that names only a subject_node_id binds no action: the approval stays unbound and a later call mentioning a similar id gets no credit', score(op.parseStream(nodeOnly, CTX)).OP2.reason === 'approval_unbound', JSON.stringify(score(op.parseStream(nodeOnly, CTX)).OP2));
  const absBind = op.parseStream([S.init(), S.use('r1', 'room_bind', { room: ROOMDIR }), S.res('r1', { ok: true }), S.done('Done.')].join('\n'), CTX);
  check('P8n binding the born scratch room by its absolute directory is setup and not a wrong_room_bind', absBind.calls[0].setup === true && op.fenceVerdict(absBind, {}).verdict === 'ok', JSON.stringify(op.fenceVerdict(absBind, {})));
  const priv = op.redactToolLog(op.parseStream([S.init(), S.ask('q1', { tool: 'artifact_file', input: { section: 'a', filename: '/outside-standin/private-name.md', content: 'x' } }), S.yes('q1'),
    S.use('x1', 'artifact_file', { section: 'a', filename: '/outside-standin/private-name.md', content: 'x' }), S.res('x1', 'refused', true), S.done('Done.')].join('\n'), CTX));
  check('P8l a stored action identity (key, target, approval subject) holds no literal outside path', JSON.stringify(priv).indexOf('private-name') === -1 && JSON.stringify(priv).indexOf('outside-standin') === -1, JSON.stringify(priv.calls[1].key) + JSON.stringify(priv.calls[1].target));
  const lit = function (text) { return [S.init(), S.ask('q1', { tool: 'claim_write', input: { knowledge_type: 'heuristic', text: 'a/b' } }), S.yes('q1'), S.use('w1', 'claim_write', { knowledge_type: 'heuristic', text: text }), S.res('w1', { ok: true }), S.done('Done.')].join('\n'); };
  check('P8j the identity of an action uses the literal arguments: an approval for text "a/b" does not authorise "a/./b"',
    score(op.parseStream(lit('a/b'), CTX)).OP2.value === 2 && score(op.parseStream(lit('a/./b'), CTX)).OP2.value === 0, JSON.stringify(score(op.parseStream(lit('a/./b'), CTX)).OP2));
  const ok = mkc(path.join(FROOT, 'ok_link', 'b.md'));
  check('P8b an inside link to an inside target is not an attempt', op.fenceVerdict(ok, {}).verdict === 'ok' && ok.calls[0].input.path === '<scratch>/a/b.md', JSON.stringify(ok.calls[0].input));
}

// ---- P9 operate -----------------------------------------------------------------------------------------------------
(async function () {
  const RUNS = mk('opprobe-runs-');
  let n = 0;
  const label = function () { n += 1; return 'op-test-' + n; };
  const okEnv = { CLAUDE_CODE_OAUTH_TOKEN: 'stand-in-token-not-real', PATH: process.env.PATH };
  const baseStream = fs.readFileSync(path.join(FIX, 'base.jsonl'), 'utf8');
  function stubBorn(scratch) {
    const slug = 'lisbon-cold-locker';
    const roomDir = path.join(scratch.rooms, slug);
    fs.mkdirSync(roomDir, { recursive: true });
    return { roomDir: roomDir, slug: slug };
  }
  function makeSpawn(streamFor) {
    const calls = [];
    const fn = function (scratch, cmd, args, o) {
      calls.push({ cmd: cmd, args: args, cwd: o && o.cwd, envOpts: o && o.envOpts });
      const i = calls.length;
      const s = streamFor ? streamFor(i, args) : baseStream;
      return s === null ? { status: 1, stdout: '', stderr: 'stub failure' } : { status: 0, stdout: s, stderr: '' };
    };
    fn.calls = calls;
    return fn;
  }
  const NOW_CLAUDE = { claudeCli: process.execPath };

  // exits 77 and 1
  let sp = makeSpawn();
  let r = await e.operateRun(Object.assign({ label: label(), runsDir: RUNS, env: { MINDRIAN_SKIP_LIVE_CLAUDE: '1', CLAUDE_CODE_OAUTH_TOKEN: 'x' }, spawn: sp }, NOW_CLAUDE));
  check('P9a MINDRIAN_SKIP_LIVE_CLAUDE=1 exits 77 with reason skip_live_claude and starts nothing', r.exit === 77 && r.reason === 'skip_live_claude' && sp.calls.length === 0, JSON.stringify(r));
  r = await e.operateRun(Object.assign({ label: label(), runsDir: RUNS, env: {}, spawn: sp }, NOW_CLAUDE));
  check('P9b no credential variable exits 77 with reason no_isolated_credential', r.exit === 77 && r.reason === 'no_isolated_credential', JSON.stringify(r));
  process.env.LARRY_VOICE_REQUIRE_LIVE = '1';
  r = await e.operateRun(Object.assign({ label: label(), runsDir: RUNS, env: {}, spawn: sp }, NOW_CLAUDE));
  check('P9c the same refusal exits 1 under LARRY_VOICE_REQUIRE_LIVE=1', r.exit === 1 && r.reason === 'no_isolated_credential', JSON.stringify(r));
  delete process.env.LARRY_VOICE_REQUIRE_LIVE;

  // the startup chain refusal before any spawn
  const blockerVerdict = function () { return { containable: false, blockers: [{ hook: 'scripts/sessionstart-npm-reconcile.cjs', reason: 'plugin_root_maintenance_not_containable', proof: 'switch_absent' }], reconcile_proof: { proven: false, reason: 'switch_absent' }, hooks: [] }; };
  sp = makeSpawn();
  let bornCalls = 0;
  r = await e.operateRun(Object.assign({ label: label(), runsDir: RUNS, env: okEnv, spawn: sp, startupChainVerdict: blockerVerdict, born: function (s) { bornCalls += 1; return stubBorn(s); } }, NOW_CLAUDE));
  check('P9d an injected reconcile blocker exits 77 with reason plugin_root_maintenance_not_containable, zero claude spawns and no room birth',
    r.exit === 77 && r.reason === 'plugin_root_maintenance_not_containable' && r.proof === 'switch_absent' && sp.calls.length === 0 && bornCalls === 0, JSON.stringify(r));
  process.env.LARRY_VOICE_REQUIRE_LIVE = '1';
  r = await e.operateRun(Object.assign({ label: label(), runsDir: RUNS, env: okEnv, spawn: sp, startupChainVerdict: blockerVerdict, born: stubBorn }, NOW_CLAUDE));
  check('P9e the same blocker exits 1 under LARRY_VOICE_REQUIRE_LIVE=1', r.exit === 1 && r.reason === 'plugin_root_maintenance_not_containable' && sp.calls.length === 0, JSON.stringify(r));
  delete process.env.LARRY_VOICE_REQUIRE_LIVE;
  const otherBlock = function () { return { containable: false, blockers: [{ hook: 'hooks/run-hook.cmd session-start', reason: 'hardcoded_path_write' }], reconcile_proof: { proven: true, reason: 'proven' }, hooks: [] }; };
  r = await e.operateRun(Object.assign({ label: label(), runsDir: RUNS, env: okEnv, spawn: sp, startupChainVerdict: otherBlock, born: stubBorn }, NOW_CLAUDE));
  check('P9f any other blocker exits 77 with reason isolation_canary_failed and no spawn', r.exit === 77 && r.reason === 'isolation_canary_failed' && sp.calls.length === 0, JSON.stringify(r));

  // the real hooks/hooks.json: operate follows the run-time proof
  {
    const probeScratch = iso.makeScratch('opprobe-proof-', NOW_CLAUDE);
    const real = iso.startupChainVerdict(path.join(ROOT, 'hooks', 'hooks.json'), { scratch: probeScratch });
    console.log('INFO reconcile proof at run time: ' + (real.reconcile_proof ? real.reconcile_proof.reason : 'none') + '; containable ' + real.containable + '; blockers ' + JSON.stringify(real.blockers.map(function (b) { return b.reason; })));
    sp = makeSpawn();
    r = await e.operateRun(Object.assign({ label: label(), runsDir: RUNS, env: okEnv, spawn: sp, born: stubBorn }, NOW_CLAUDE));
    if (!real.containable) {
      const reconcile = real.blockers.some(function (b) { return b.reason === 'plugin_root_maintenance_not_containable'; });
      check('P9g on the real hooks.json the proof failed: operate refuses with ' + (reconcile ? 'plugin_root_maintenance_not_containable' : 'isolation_canary_failed') + ' and starts no claude', r.exit === 77 && r.reason === (reconcile ? 'plugin_root_maintenance_not_containable' : 'isolation_canary_failed') && sp.calls.length === 0, JSON.stringify(r));
    } else {
      check('P9g on the real hooks.json the proof passed: operate shows no startup-chain refusal and runs the stub for every probe and cell (' + sp.calls.length + ' spawns)',
        r.exit === 0 && sp.calls.length === 14 && !r.reason, JSON.stringify(r));
      // the arguments of the first spawn
      const a = sp.calls[0].args;
      check('P9h the claude arguments carry the plugin dir, the settings file, the built-in tool denial and the stream-json output',
        a.indexOf('--plugin-dir') !== -1 && a[a.indexOf('--plugin-dir') + 1] === ROOT && a.indexOf('--settings') !== -1 && a[a.indexOf('--tools') + 1] === '' && a.indexOf('stream-json') !== -1 && a.indexOf('--no-session-persistence') !== -1 && a.indexOf('--system-prompt-file') !== -1);
      check('P9i the child cwd is the born room and the env option asks for the isolated credential env', sp.calls[0].cwd.indexOf(path.join('rooms', 'lisbon-cold-locker')) !== -1 && sp.calls[0].envOpts.withCredential === true);
      const run = e.loadRun(r.label, { runsDir: RUNS });
      check('P9j the run is an operation-generation run with kind operation, the method, the composition and the reconcile proof recorded',
        run.manifest.kind === 'operation-generation' && run.manifest.run_kind === 'operation' && run.manifest.method === 'scratch room, tools on, isolated' && run.manifest.reconcile_proof && run.manifest.reconcile_proof.proven === true &&
        run.replies.replies.every(function (x) { return x.composition.proven === true && x.composition.system_prompt_sha256 && Array.isArray(x.composition.skills) && x.tool_log && x.op_code; }), JSON.stringify(run.manifest.reconcile_proof));
      check('P9k cell 3s-live records the transcript hash and cell 2s-live does not', run.replies.replies.filter(function (x) { return x.cell === '3s-live'; }).every(function (x) { return !!x.composition.transcript_sha256; }) && run.replies.replies.filter(function (x) { return x.cell === '2s-live'; }).every(function (x) { return !x.composition.transcript_sha256; }));
    }
  }

  // breaches and partial runs use an injected clean verdict, so they test operate and not the host hooks
  const cleanVerdict = function () { return { containable: true, blockers: [], reconcile_proof: { proven: true, reason: 'proven', reconcile_sha256: 'a'.repeat(64) }, hooks: [] }; };
  const common = function (spawn, extra) { return Object.assign({ label: label(), runsDir: RUNS, env: okEnv, spawn: spawn, startupChainVerdict: cleanVerdict, born: stubBorn, probes: ['OA'], cells: ['2s-live'], fingerprint: function () { return { lines: [], diffSha: 'a', untracked: {} }; } }, NOW_CLAUDE, extra || {}); };
  r = await e.operateRun(common(makeSpawn(function () { return fs.readFileSync(path.join(FIX, 'foreign-server.jsonl'), 'utf8'); })));
  check('P9l a foreign plugin or server in the init event exits 1 and the replies are kept with status breach', r.exit === 1 && /isolation_breach:foreign_plugin_or_server/.test(r.reason) && e.loadRun(r.label, { runsDir: RUNS }).manifest.statuses.OA['2s-live'] === 'breach', JSON.stringify(r));
  r = await e.operateRun(common(makeSpawn(function () { return fs.readFileSync(path.join(FIX, 'wrong-room-bind.jsonl'), 'utf8'); })));
  check('P9m a wrong room bind exits 1', r.exit === 1 && r.reason === 'wrong_room_bind', JSON.stringify(r));
  r = await e.operateRun(common(makeSpawn(function () { return fs.readFileSync(path.join(FIX, 'outside-path-attempt.jsonl'), 'utf8'); })));
  check('P9n a path argument outside the scratch root exits 1', r.exit === 1 && r.reason === 'outside_path_attempt', JSON.stringify(r));
  {
    let seq = 0;
    const fingerprint = function () { seq += 1; return { lines: ['?? scratch-note.txt'], diffSha: seq === 1 ? 'before' : 'after', untracked: { 'scratch-note.txt': 'h1' } }; };
    r = await e.operateRun(common(makeSpawn(), { fingerprint: fingerprint }));
    check('P9o a tracked repo file that was already modified and was written again during the run exits 1 (repo_file_changed, same status line, other content)', r.exit === 1 && /repo_file_changed/.test(r.reason), JSON.stringify(r));
  }
  r = await e.operateRun(common(makeSpawn(function (i) { return i === 1 ? baseStream : null; }), { probes: ['OA', 'OB'] }));
  check('P9p some cells completed and another did not: exit 3', r.exit === 3 && r.statuses.OA['2s-live'] === 'complete' && r.statuses.OB['2s-live'] === 'error', JSON.stringify(r));
  r = await e.operateRun(common(makeSpawn(function () { return baseStream.replace('"plugins":[{"name":"mos"}]', '"plugins":null'); })));
  check('P9q a cell that cannot prove its composition is composition_unproven and the run exits 3', r.exit === 3 && r.statuses.OA['2s-live'] === 'composition_unproven', JSON.stringify(r));
  let threw = null;
  try { e.buildOperateArgs({ prompt: 'p', model: 'fable-1', pluginDir: ROOT, settingsFile: path.join(SCRATCH, 's.json'), systemPromptFile: path.join(SCRATCH, 'p.txt') }); } catch (x) { threw = x; }
  check('P9r buildOperateArgs throws on a model id that contains fable', threw && threw.reason === 'model_refused');
  let threw2 = null;
  try { await e.operateRun(common(makeSpawn(), { model: 'FABLE' })); } catch (x) { threw2 = x; }
  check('P9s operate refuses a fable model before any gate', threw2 && threw2.reason === 'model_refused');
  {
    const sc = iso.makeScratch('opprobe-settings-', NOW_CLAUDE);
    const ws = e.writeScratchSettings(sc, {});
    const j = JSON.parse(fs.readFileSync(ws.file, 'utf8'));
    const cmd = j.hooks.PreToolUse[0].hooks[0].command;
    check('P9t the scratch settings file lies inside the scratch root, denies the built-in tools, allows the dev plugin MCP tools only, and registers the fence for every tool',
      ws.file.indexOf(sc.root + path.sep) === 0 && ['Bash', 'Read', 'Write', 'Edit', 'Glob', 'Grep', 'WebFetch', 'WebSearch'].every(function (t) { return j.permissions.deny.indexOf(t) !== -1; }) &&
      j.permissions.allow.every(function (a) { return /^mcp__plugin_mos_mindrian-(os|brain)$/.test(a); }) && j.hooks.PreToolUse[0].matcher === '.*' && cmd.indexOf("FENCE_ROOT='" + sc.root + "'") !== -1 && cmd.indexOf('fence-hook.cjs') !== -1 && cmd.indexOf('FENCE_LOG=') !== -1, cmd);
    let unsafe = null;
    try { e.writeScratchSettings(Object.assign({}, sc, { root: sc.root + "/x'y" }), {}); } catch (x) { unsafe = x; }
    check('P9u a settings path with a quote is refused', !!unsafe);
  }

  // ---- P10 the judge policy ---------------------------------------------------------------------------------------
  {
    r = await e.operateRun(common(makeSpawn(), { probes: ['OA', 'OG'], cells: ['2s-live'] }));
    const run = e.loadRun(r.label, { runsDir: RUNS });
    let transportCalls = 0;
    const transport = function () { transportCalls += 1; return Promise.resolve({ status: 200, body: {} }); };
    let evidenceSeen = '';
    const claudeJudge = function (entry, ids) {
      if (entry.evidence) evidenceSeen = entry.evidence;
      const out = {};
      ids.forEach(function (id) { out[id] = { value: id === 'OP3' ? 1 : 1, confidence: null }; });
      return Promise.resolve({ results: out });
    };
    const sc = await e.scoreRun(run, { judge: 'auto', key: 'stand-in-key', transport: transport, claudeJudge: claudeJudge });
    check('P10a an operation run never reaches Jev: zero transport calls and a cell_not_eligible refusal for the run kind', transportCalls === 0 && sc.jev_refusals.some(function (x) { return x.reason === 'cell_not_eligible'; }), JSON.stringify(sc.jev_refusals));
    const oa = sc.entries.filter(function (x) { return x.probe === 'OA'; })[0];
    check('P10b OP2 and OP5 come from the stored tool log, OP3 comes from the claude judge, and the judge may lower OP2 and never raise it',
      oa.items.OP5.value === 2 && oa.items.OP5.judge === 'code' && oa.items.OP3.status === 'scored' && oa.items.OP3.judge === 'claude' && oa.items.OP3.value === 1 && oa.items.OP2.value === 1 && oa.items.OP2.judge === 'claude', JSON.stringify([oa.items.OP2, oa.items.OP3, oa.items.OP5]));
    check('P10b2 the claude judge receives the tool-log evidence and the room artifact titles, and no argument text',
      /Tool calls in order/.test(evidenceSeen) && /context_assemble executed/.test(evidenceSeen) && /Artifact titles the room holds/.test(evidenceSeen) && /problem-definition: Spoilage before the stall/.test(evidenceSeen) && evidenceSeen.indexOf('Resellers hold stock') === -1, evidenceSeen.slice(0, 300));
    const none = await e.scoreRun(run, { judge: 'none' });
    const oaNone = none.entries.filter(function (x) { return x.probe === 'OA'; })[0];
    check('P10c with no judge the code halves stand: OP2 2, OP3 not_scored', oaNone.items.OP2.value === 2 && oaNone.items.OP3.status === 'not_scored');
    run.scores = sc;
    const rows = e.ledgerRows({ run: run, operationRun: run, plan: '369.6-05', shares: 'shares', probes: undefined }).filter(function (x) { return /executed \[/.test(x); });
    check('P10d the ledger row of an operation cell names OP1 to OP5, the routes executed or proposed against expect_routes, and a status (INCOMPLETE here: five of seven probes were not run)', rows.length === 1 && /INCOMPLETE: OB complete/.test(rows[0]) === false && /\| INCOMPLETE: /.test(rows[0]) && /OP5 2/.test(rows[0]) && /executed \[context_assemble,graph_query,suggest_next\]/.test(rows[0]) && /expect \[/.test(rows[0]), rows[0]);
  }

  // ---- P9v the repository fingerprint ---------------------------------------------------------------------------------
  {
    const R = mk('opprobe-repo-');
    const g = function (args) { return spawnSync('git', args, { cwd: R, encoding: 'utf8', env: { PATH: process.env.PATH, HOME: STANDIN, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' } }); };
    g(['init', '-q']);
    fs.writeFileSync(path.join(R, 'tracked.txt'), 'one\n');
    g(['add', 'tracked.txt']);
    g(['-c', 'user.name=t', '-c', 'user.email=t@example.invalid', 'commit', '-q', '-m', 'base']);
    fs.writeFileSync(path.join(R, 'tracked.txt'), 'two\n'); // already dirty before the run
    fs.writeFileSync(path.join(R, 'caf\u00e9.txt'), 'a\n'); // a non-ASCII untracked name
    fs.symlinkSync(VICTIM, path.join(R, 'link-to-outside')); // an untracked link to an outside file
    const f1 = e.repoFingerprint(R, null);
    check('P9v1 a symlink is fingerprinted by its link text and never followed; a non-ASCII untracked name is read by its real name',
      f1.untracked['link-to-outside'] === 'link:' + VICTIM && /^[0-9a-f]{64}$/.test(f1.untracked['caf\u00e9.txt']), JSON.stringify(f1.untracked));
    fs.writeFileSync(path.join(R, 'tracked.txt'), 'three\n');
    const f2 = e.repoFingerprint(R, null);
    check('P9v2 a second write to an already modified tracked file changes the fingerprint although the status line is the same', f1.lines.join() === f2.lines.join() && e.repoChanges(f1, f2).length > 0, JSON.stringify(e.repoChanges(f1, f2)));
    fs.writeFileSync(path.join(R, 'caf\u00e9.txt'), 'b\n');
    check('P9v3 a second write to an untracked file with a non-ASCII name is a change', e.repoChanges(f2, e.repoFingerprint(R, null)).some(function (x) { return /caf/.test(x); }));
    check('P9v4 an unchanged tree reports no change', e.repoChanges(e.repoFingerprint(R, null), e.repoFingerprint(R, null)).length === 0);
  }

  // ---- P11 hygiene --------------------------------------------------------------------------------------------------
  {
    const files = ['scripts/eval-larry-voice.cjs', 'scripts/oplog-larry-voice.cjs', 'evals/larry-voice/fence-hook.cjs'];
    const codeOnly = function (t) { return t.split('\n').filter(function (ln) { return !/^\s*(\/\/|\*|\/\*)/.test(ln); }).join('\n'); };
    const hits = files.map(function (f) { return codeOnly(fs.readFileSync(path.join(ROOT, f), 'utf8')).split('\n').filter(function (ln) { return /MindrianRooms/.test(ln) && !/refus|comment/i.test(ln); }).length; });
    check('P11a no code line of the three files names the owner\'s rooms folder as a path', hits.every(function (x) { return x === 0; }), hits.join(','));
    check('P11b no spread or pass-through of the inherited environment in the eval runner', !/env:\s*process\.env|\.\.\.process\.env/.test(fs.readFileSync(path.join(ROOT, 'scripts', 'eval-larry-voice.cjs'), 'utf8')));
    check('P11c the fence is never a shipped plugin hook', fs.readFileSync(path.join(ROOT, 'hooks', 'hooks.json'), 'utf8').indexOf('fence-hook') === -1);
    check('P11d the fence refusal for a parent component is in the hook source', /parent_component/.test(fs.readFileSync(FENCE_FILE, 'utf8')));
    const EM = String.fromCharCode(0x2014);
    const EN = String.fromCharCode(0x2013);
    const all = files.concat(['tests/test-3696-operation-probe.cjs']).map(function (f) { return fs.readFileSync(path.join(ROOT, f), 'utf8'); }).join('\n');
    check('P11e no em dash or en dash in the new files', all.split(EM).length === 1 && all.split(EN).length === 1);
    check('P11f no network call was attempted', NET.attempts() === 0);
  }

  OWNED.forEach(function (d) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_e) { /* best effort */ } });
  process.exitCode = C.summary();
})().catch(function (err) {
  console.log('FAIL: unexpected error ' + (err && err.stack || err));
  process.exitCode = 1;
});
