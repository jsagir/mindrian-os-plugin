#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 369.2 Plan 13 (369.2-R05, 369.2-R06) -- the research operation ledger,
 * one leg per execution-state invariant of the engineering brief (HARNESS-02).
 *
 *   I1  stable ids        the same six inputs mint one op with one id, across a disk round trip
 *   I2  one terminal      an op ends in exactly one of four states; sweep leaves none open
 *   I3  proof             executed_empty needs a counted zero; a failed call is never empty
 *   I4  travel            refused and not-executed ops are listed with their label and reason
 *   I5  counterevidence   falsifier ops count across ALL rounds (annex C17)
 *   I6  fallback          a fallback needs all four fields, or it is refused
 *   I7  complete          "complete" comes from completion() alone, never from a command return
 *   F1  file              operations.json beside the run, atomic write, no room.db
 *   F2  reasons           a closed vocabulary plus four prefix families
 *
 * Temp directories only; nothing under the real home or any real room is read or written.
 * The module is required inside a try: a missing module fails every leg with "module missing"
 * instead of crashing the file.
 *
 * Output: one `PASS: <leg>` or `FAIL: <leg> - <why>` line per leg, then `PASS: <n> FAIL: <n>`.
 * No em-dash or en-dash anywhere (CLAUDE.md HARD RULE). Exit 0 pass, 1 fail.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert');
const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '..');
const MODULE = path.join(ROOT, 'lib', 'core', 'research-planner', 'operations.cjs');

let ops = null;
let loadError = null;
try { ops = require(MODULE); } catch (e) { loadError = e; }

const TMP = [];
function mk(prefix) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 't3692-ledger-' + prefix + '-'));
  TMP.push(d);
  return d;
}
process.on('exit', function () {
  TMP.forEach(function (d) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_e) { /* best effort */ } });
});

let pass = 0;
let fail = 0;
function leg(label, fn) {
  try {
    if (!ops) throw new Error('module missing: ' + (loadError && loadError.message ? loadError.message : MODULE));
    fn();
    pass += 1;
    process.stdout.write('PASS: ' + label + '\n');
  } catch (e) {
    fail += 1;
    const msg = String(e && e.message ? e.message : e).replace(/\s+/g, ' ').slice(0, 400);
    process.stdout.write('FAIL: ' + label + ' - ' + msg + '\n');
  }
}

const NOW = '2026-10-06T10:00:00.000Z';
function fresh() { return ops.createLedger('run-A', 'plan-hash-1', NOW); }
function base(over) {
  return Object.assign({
    plan_dimension: 'L1', dimension_label: 'who already sells cold lockers', mandatory: true,
    kind: 'direct', template_id: 'ws.exact', round: 1, ordinal: 0, provider: 'tavily',
  }, over || {});
}
function finish(ledger, id, to, fields) {
  const r = ops.transition(ledger, id, to, fields || {});
  assert.strictEqual(r.ok, true, 'transition to ' + to + ' refused: ' + JSON.stringify(r));
  return r;
}
function ok(ledger, over) {
  const op = ops.mint(ledger, base(over));
  finish(ledger, op.operation_id, 'executed_with_results', { result_count: 4 });
  return op;
}

// ---------------------------------------------------------------------------------------
leg('I1 stable ids: same six inputs, same id, across a disk round trip', function () {
  const ledger = fresh();
  const a = ops.mint(ledger, base());
  const b = ops.mint(ledger, base());
  assert.strictEqual(a.operation_id, b.operation_id, 'same inputs, two ids');
  assert.strictEqual(ledger.operations.length, 1, 'duplicate op minted');
  const want = 'op-' + crypto.createHash('sha256').update(['run-A', 'L1', 'direct', 'ws.exact', 1, 0].join('|')).digest('hex').slice(0, 16);
  assert.strictEqual(a.operation_id, want, 'id is not op- + 16 hex of sha256 over run|dim|kind|template|round|ordinal');
  assert.strictEqual(ops.operationId('run-A', 'L1', 'direct', 'ws.exact', 1, 0), want, 'operationId disagrees with mint');
  assert.match(a.operation_id, /^op-[0-9a-f]{16}$/);
  const c = ops.mint(ledger, base({ ordinal: 1 }));
  assert.notStrictEqual(c.operation_id, a.operation_id, 'a different ordinal must be a different id');
  const room = mk('i1');
  ops.writeLedger(room, ledger);
  const back = ops.readLedger(room, 'run-A');
  assert.deepStrictEqual(back.operations.map(function (o) { return o.operation_id; }), ledger.operations.map(function (o) { return o.operation_id; }), 'ids changed across the disk');
  const again = ops.mint(back, base());
  assert.strictEqual(again.operation_id, a.operation_id, 'a re-read ledger minted a new id for the same op');
  assert.strictEqual(back.operations.length, 2, 're-read ledger grew on a re-mint');
});

leg('I1 fields: a minted op carries the whole row shape and starts planned', function () {
  const op = ops.mint(fresh(), base({ q: null }));
  ['operation_id', 'plan_dimension', 'dimension_label', 'mandatory', 'kind', 'template_id', 'round', 'ordinal', 'query_id', 'q',
    'provider', 'fallback', 'state', 'reason', 'result_count', 'cache_hit', 'attempted', 'started_at', 'finished_at', 'audit_ref']
    .forEach(function (k) { assert.ok(Object.prototype.hasOwnProperty.call(op, k), 'op lacks ' + k); });
  assert.strictEqual(op.state, 'planned');
  assert.strictEqual(op.attempted, false);
  assert.strictEqual(op.fallback, null);
});

leg('I2 one terminal state: order enforced, terminal is final, sweep leaves none open', function () {
  const ledger = fresh();
  const op = ops.mint(ledger, base());
  finish(ledger, op.operation_id, 'composed', { q: '"cold lockers"', query_id: 'qh1' });
  finish(ledger, op.operation_id, 'dispatched');
  finish(ledger, op.operation_id, 'executed_with_results', { result_count: 3 });
  ['planned', 'composed', 'dispatched', 'executed_with_results', 'executed_empty', 'refused_before_fetch', 'not_executed'].forEach(function (to) {
    const r = ops.transition(ledger, op.operation_id, to, { result_count: 0, count: 0, reason: 'search_cap' });
    assert.deepStrictEqual([r.ok, r.reason], [false, 'illegal_transition'], 'a terminal op moved to ' + to);
  });
  assert.strictEqual(op.state, 'executed_with_results', 'a refused transition changed the op');
  // going backwards is illegal too
  const op2 = ops.mint(ledger, base({ ordinal: 2 }));
  finish(ledger, op2.operation_id, 'dispatched');
  assert.strictEqual(ops.transition(ledger, op2.operation_id, 'composed', {}).reason, 'illegal_transition');
  assert.strictEqual(ops.transition(ledger, op2.operation_id, 'dispatched', {}).reason, 'illegal_transition');
  // skipping forward is allowed (a plan-time refusal goes planned -> refused_before_fetch)
  const op3 = ops.mint(ledger, base({ ordinal: 3 }));
  finish(ledger, op3.operation_id, 'refused_before_fetch', { reason: 'unknown_lens' });
  assert.strictEqual(ops.transition(ledger, 'op-0000000000000000', 'composed', {}).reason, 'unknown_operation');
  // sweep
  const op4 = ops.mint(ledger, base({ ordinal: 4 }));
  const op5 = ops.mint(ledger, base({ ordinal: 5 }));
  finish(ledger, op5.operation_id, 'dispatched');
  const sw = ops.sweep(ledger, 'search_cap');
  assert.strictEqual(sw.ok, true);
  assert.strictEqual(ledger.operations.filter(function (o) { return ops.TERMINAL_STATES.indexOf(o.state) === -1; }).length, 0, 'sweep left an open op');
  [op2, op4, op5].forEach(function (o) {
    assert.strictEqual(o.state, 'not_executed');
    assert.strictEqual(o.reason, 'search_cap');
    assert.ok(o.finished_at, 'swept op has no finished_at');
  });
  assert.strictEqual(op.state, 'executed_with_results', 'sweep touched a terminal op');
  assert.strictEqual(op3.state, 'refused_before_fetch', 'sweep rewrote a refusal');
  assert.strictEqual(op3.reason, 'unknown_lens');
  assert.strictEqual(ops.sweep(ledger, 'not a reason').reason, 'unknown_reason');
});

leg('I3 proof: empty needs a counted zero; a failed call is never empty', function () {
  const ledger = fresh();
  const a = ops.mint(ledger, base({ ordinal: 0 }));
  assert.deepStrictEqual(pick(ops.transition(ledger, a.operation_id, 'executed_empty', {})), [false, 'proof_missing'], 'empty without proof');
  assert.deepStrictEqual(pick(ops.transition(ledger, a.operation_id, 'executed_empty', { result_count: null })), [false, 'proof_missing'], 'empty with a null count');
  assert.deepStrictEqual(pick(ops.transition(ledger, a.operation_id, 'executed_empty', { result_count: '0' })), [false, 'proof_missing'], 'empty with a string count');
  assert.deepStrictEqual(pick(ops.transition(ledger, a.operation_id, 'executed_empty', { result_count: 3 })), [false, 'proof_missing'], 'empty with a positive count');
  assert.deepStrictEqual(pick(ops.transition(ledger, a.operation_id, 'executed_empty', { count: 0, reason: 'provider_failed:http_5xx' })), [false, 'proof_missing'], 'empty carrying a failure reason');
  assert.strictEqual(a.state, 'planned', 'a refused proof changed the op');
  assert.deepStrictEqual(pick(ops.transition(ledger, a.operation_id, 'executed_with_results', { result_count: 0 })), [false, 'proof_missing'], 'results with count 0');
  assert.deepStrictEqual(pick(ops.transition(ledger, a.operation_id, 'executed_with_results', {})), [false, 'proof_missing'], 'results without a count');
  const r = ops.transition(ledger, a.operation_id, 'executed_empty', { count: 0 });
  assert.strictEqual(r.ok, true, 'a counted zero was refused: ' + JSON.stringify(r));
  assert.strictEqual(a.state, 'executed_empty');
  assert.strictEqual(a.result_count, 0);
  const b = ops.mint(ledger, base({ ordinal: 1 }));
  assert.strictEqual(ops.transition(ledger, b.operation_id, 'executed_empty', { proof: { count: 0 } }).ok, true, 'proof {count:0} form refused');
  // a failed or blocked provider call
  const c = ops.mint(ledger, base({ ordinal: 2 }));
  const f = ops.transition(ledger, c.operation_id, 'not_executed', { attempted: true, reason: 'provider_failed:http_5xx' });
  assert.strictEqual(f.ok, true, 'failure not recorded: ' + JSON.stringify(f));
  assert.strictEqual(c.state, 'not_executed');
  assert.strictEqual(c.attempted, true);
  assert.strictEqual(c.reason, 'provider_failed:http_5xx');
  assert.ok(c.result_count === null, 'a failed call carries a result count');
  const d = ops.mint(ledger, base({ ordinal: 3 }));
  assert.strictEqual(ops.transition(ledger, d.operation_id, 'not_executed', { reason: 'provider_failed:network_timeout' }).ok, true);
  assert.strictEqual(d.attempted, true, 'provider_failed must read attempted true by construction');
  // a refusal before fetch is not a provider call
  const e = ops.mint(ledger, base({ ordinal: 4 }));
  assert.deepStrictEqual(pick(ops.transition(ledger, e.operation_id, 'refused_before_fetch', { reason: 'provider_failed:http_5xx' })), [false, 'proof_missing'], 'a refusal claimed a provider failure');
  assert.strictEqual(ops.transition(ledger, e.operation_id, 'refused_before_fetch', { reason: 'bad_slot:limiter' }).ok, true);
  assert.strictEqual(e.attempted, false);
});

leg('I4 travel: refused and not-executed ops reach completion().incomplete with label and reason', function () {
  const ledger = fresh();
  ok(ledger, { plan_dimension: 'L1', ordinal: 0 });
  const e = ops.mint(ledger, base({ plan_dimension: 'L2', dimension_label: 'what a cold chain costs', ordinal: 1 }));
  finish(ledger, e.operation_id, 'executed_empty', { count: 0 });
  const r = ops.mint(ledger, base({ plan_dimension: 'L3', dimension_label: 'who regulates cold storage', ordinal: 2 }));
  finish(ledger, r.operation_id, 'refused_before_fetch', { reason: 'provider_unavailable:patent' });
  const n = ops.mint(ledger, base({ plan_dimension: 'L4', dimension_label: 'how long a harvest keeps', ordinal: 3 }));
  finish(ledger, n.operation_id, 'not_executed', { reason: 'quick_cap' });
  const c = ops.completion(ledger, { counterevidence_needed: false });
  assert.deepStrictEqual(c.by_state, { executed_with_results: 1, executed_empty: 1, refused_before_fetch: 1, not_executed: 1 });
  assert.strictEqual(c.incomplete.length, 2);
  const byDim = {};
  c.incomplete.forEach(function (x) { byDim[x.plan_dimension] = x; });
  assert.deepStrictEqual([byDim.L3.dimension_label, byDim.L3.state, byDim.L3.reason], ['who regulates cold storage', 'refused_before_fetch', 'provider_unavailable:patent']);
  assert.deepStrictEqual([byDim.L4.dimension_label, byDim.L4.state, byDim.L4.reason], ['how long a harvest keeps', 'not_executed', 'quick_cap']);
  assert.ok(!byDim.L1 && !byDim.L2, 'an executed op is listed as incomplete');
});

leg('I5 counterevidence (C17): falsifiers that ran in round one count as performed', function () {
  // round-one falsifier executed, the extra pass planned nothing new -> complete, not "not run"
  const l1 = fresh();
  ok(l1, { plan_dimension: 'CE:b1', kind: 'falsifier', template_id: 'ce.counter', round: 1, ordinal: 0 });
  let s = ops.counterevidenceStatus(l1, { needed: true });
  assert.strictEqual(s.status, 'complete');
  assert.strictEqual(s.executed, 1);
  assert.strictEqual(s.planned, 1);
  // an extra pass that added zero searches changes nothing
  s = ops.counterevidenceStatus(l1, { needed: true });
  assert.strictEqual(s.status, 'complete', 'round one falsifiers were lost');
  // needed with no falsifier ops anywhere
  const l2 = fresh();
  ok(l2, { plan_dimension: 'L1', kind: 'direct' });
  s = ops.counterevidenceStatus(l2, { needed: true });
  assert.strictEqual(s.status, 'not_run');
  assert.strictEqual(s.planned, 0);
  // some executed, some not
  const l3 = fresh();
  ok(l3, { plan_dimension: 'CE:b1', kind: 'falsifier', template_id: 'ce.counter', round: 1, ordinal: 0 });
  const miss = ops.mint(l3, base({ plan_dimension: 'CE:b2', kind: 'falsifier', template_id: 'cl.break', round: 2, ordinal: 0 }));
  finish(l3, miss.operation_id, 'not_executed', { reason: 'ce_reserve_exhausted' });
  s = ops.counterevidenceStatus(l3, { needed: true });
  assert.strictEqual(s.status, 'partial');
  assert.deepStrictEqual([s.planned, s.executed, s.failed], [2, 1, 1]);
  assert.ok(s.reasons.indexOf('ce_reserve_exhausted') !== -1, 'partial lost its reason');
  // planned falsifiers, none executed
  const l4 = fresh();
  const only = ops.mint(l4, base({ plan_dimension: 'CE:b1', kind: 'falsifier', template_id: 'ce.counter' }));
  finish(l4, only.operation_id, 'not_executed', { reason: 'search_cap' });
  assert.strictEqual(ops.counterevidenceStatus(l4, { needed: true }).status, 'not_run');
  // an executed falsifier that found nothing still ran
  const l5 = fresh();
  const emp = ops.mint(l5, base({ plan_dimension: 'CE:b1', kind: 'falsifier', template_id: 'ce.counter' }));
  finish(l5, emp.operation_id, 'executed_empty', { count: 0 });
  assert.strictEqual(ops.counterevidenceStatus(l5, { needed: true }).status, 'complete');
  // needed false
  assert.strictEqual(ops.counterevidenceStatus(l2, { needed: false }).status, 'not_needed');
  // isFalsifier recognises kind, the five templates, and a role carried on the op
  assert.strictEqual(ops.isFalsifier({ kind: 'falsifier' }), true);
  ['ce.counter', 'cl.break', 'ci.retest', 'ws.synonym_cover', 'ws.prior_attempts'].forEach(function (t) {
    assert.strictEqual(ops.isFalsifier({ kind: 'direct', template_id: t }), true, t);
    assert.ok(ops.FALSIFIER_TEMPLATES.indexOf(t) !== -1, t + ' missing from FALSIFIER_TEMPLATES');
  });
  assert.strictEqual(ops.isFalsifier({ kind: 'direct', role: 'falsifier_tried_before' }), true);
  assert.strictEqual(ops.isFalsifier({ kind: 'direct', template_id: 'ws.exact' }), false);
  assert.strictEqual(ops.isFalsifier({ kind: 'direct', role: 'primary' }), false);
});

leg('I6 fallback: all four fields or refused', function () {
  const ledger = fresh();
  const op = ops.mint(ledger, base());
  const full = { original_provider: 'patents', fallback_provider: 'tavily', reason: 'provider_unavailable:patent', authorized_by: 'grant:g-7' };
  ['original_provider', 'fallback_provider', 'reason', 'authorized_by'].forEach(function (k) {
    const part = Object.assign({}, full);
    delete part[k];
    assert.deepStrictEqual(pick(ops.recordFallback(ledger, op.operation_id, part)), [false, 'fallback_incomplete'], 'missing ' + k);
    const blank = Object.assign({}, full);
    blank[k] = '';
    assert.deepStrictEqual(pick(ops.recordFallback(ledger, op.operation_id, blank)), [false, 'fallback_incomplete'], 'blank ' + k);
  });
  assert.strictEqual(op.fallback, null, 'a refused fallback was stored');
  assert.deepStrictEqual(pick(ops.recordFallback(ledger, 'op-0000000000000000', full)), [false, 'unknown_operation']);
  const r = ops.recordFallback(ledger, op.operation_id, full);
  assert.strictEqual(r.ok, true);
  assert.deepStrictEqual(op.fallback, full);
});

leg('I7 complete comes from the ledger: mandatory ops and counterevidence decide', function () {
  // all mandatory executed, counterevidence not needed
  let ledger = fresh();
  ok(ledger, { ordinal: 0 });
  const emp = ops.mint(ledger, base({ ordinal: 1 }));
  finish(ledger, emp.operation_id, 'executed_empty', { count: 0 });
  assert.strictEqual(ops.completion(ledger, { counterevidence_needed: false }).complete, true);
  // one mandatory not_executed beats any number of successes
  const miss = ops.mint(ledger, base({ plan_dimension: 'L9', ordinal: 2 }));
  finish(ledger, miss.operation_id, 'not_executed', { reason: 'time' });
  ok(ledger, { plan_dimension: 'L10', ordinal: 3 });
  assert.strictEqual(ops.completion(ledger, { counterevidence_needed: false }).complete, false);
  // a non-mandatory not_executed does not block
  ledger = fresh();
  ok(ledger, { ordinal: 0 });
  const opt = ops.mint(ledger, base({ plan_dimension: 'L5', mandatory: false, ordinal: 1 }));
  finish(ledger, opt.operation_id, 'not_executed', { reason: 'lane_cap' });
  const c = ops.completion(ledger, { counterevidence_needed: false });
  assert.strictEqual(c.complete, true);
  assert.strictEqual(c.incomplete.length, 1, 'the non-mandatory miss must still travel (I4)');
  // an open mandatory op blocks
  ledger = fresh();
  ok(ledger, { ordinal: 0 });
  ops.mint(ledger, base({ plan_dimension: 'L6', ordinal: 1 }));
  assert.strictEqual(ops.completion(ledger, { counterevidence_needed: false }).complete, false, 'an op still planned read as complete');
  // counterevidence gates complete
  ledger = fresh();
  ok(ledger, { ordinal: 0 });
  assert.strictEqual(ops.completion(ledger, { counterevidence_needed: true }).complete, false, 'needed with no falsifier ran, read as complete');
  assert.strictEqual(ops.completion(ledger, { counterevidence_needed: true }).counterevidence.status, 'not_run');
  ok(ledger, { plan_dimension: 'CE:b1', kind: 'falsifier', template_id: 'ce.counter', ordinal: 1 });
  assert.strictEqual(ops.completion(ledger, { counterevidence_needed: true }).complete, true);
  // fail closed: no option means counterevidence is needed; an empty ledger is never complete
  const failClosed = fresh();
  ok(failClosed, { ordinal: 0 });
  assert.strictEqual(ops.completion(failClosed).complete, false, 'default must be fail closed');
  assert.strictEqual(ops.completion(fresh(), { counterevidence_needed: false }).complete, false, 'an empty ledger read as complete');
});

leg('F1 file: operations.json beside the run, atomic write, never room.db', function () {
  const room = mk('f1');
  const want = path.join(room, '.mindrian', 'research-runs', 'run-A', 'operations.json');
  assert.strictEqual(ops.ledgerPath(room, 'run-A'), want);
  assert.strictEqual(ops.readLedger(room, 'run-A'), null, 'a missing file must read null');
  const ledger = fresh();
  ok(ledger, {});
  const written = ops.writeLedger(room, ledger);
  assert.strictEqual(written, want);
  assert.ok(fs.existsSync(want));
  assert.deepStrictEqual(fs.readdirSync(path.dirname(want)), ['operations.json'], 'a temp file was left behind');
  assert.ok(!fs.existsSync(path.join(room, 'room.db')), 'writeLedger created room.db');
  const disk = JSON.parse(fs.readFileSync(want, 'utf8'));
  assert.strictEqual(disk.schema, 'mos.research-operations/1');
  assert.strictEqual(disk.run_id, 'run-A');
  assert.strictEqual(disk.plan_hash, 'plan-hash-1');
  assert.strictEqual(disk.operations.length, 1);
  assert.strictEqual(ops.OPS_SCHEMA, 'mos.research-operations/1');
  // a second write replaces atomically and bumps updated_at
  ledger.updated_at = NOW;
  ops.writeLedger(room, ledger);
  assert.ok(ops.readLedger(room, 'run-A').updated_at >= NOW);
  // a run id cannot climb out of the runs directory
  const evil = ops.ledgerPath(room, '../../escape');
  assert.ok(evil.indexOf(path.join(room, '.mindrian', 'research-runs') + path.sep) === 0, 'run id escaped: ' + evil);
  // a corrupt file is loud, not a silent empty ledger
  fs.writeFileSync(want, '{ torn', 'utf8');
  assert.throws(function () { ops.readLedger(room, 'run-A'); }, /ledger_corrupt/);
  fs.writeFileSync(want, JSON.stringify({ schema: 'other/1', operations: [] }), 'utf8');
  assert.throws(function () { ops.readLedger(room, 'run-A'); }, /ledger_corrupt/);
  // the module never reaches for the room database
  const src = fs.readFileSync(MODULE, 'utf8');
  assert.ok(!/DatabaseSync|openRoomDb|room\.db/.test(src), 'operations.cjs names the room database');
});

leg('F2 reasons: closed vocabulary plus four prefix families', function () {
  const ledger = fresh();
  const closed = ['quick_cap', 'search_cap', 'lane_cap', 'ce_reserve_exhausted', 'time', 'budget_usd', 'offline', 'theo_line_off', 'run_aborted',
    'stopped_by_navigator', 'no_query_composed', 'hash_not_approved', 'term_not_composed', 'grant_expired', 'unknown_lens'];
  closed.forEach(function (r) { assert.ok(ops.REASONS.indexOf(r) !== -1, r + ' missing from REASONS'); });
  assert.strictEqual(ops.REASONS.length, closed.length, 'REASONS holds a string the plan does not name');
  assert.ok(Object.isFrozen(ops.REASONS), 'REASONS is not frozen');
  let n = 0;
  function try1(reason) {
    const op = ops.mint(ledger, base({ ordinal: n += 1 }));
    return ops.transition(ledger, op.operation_id, 'not_executed', { reason: reason });
  }
  closed.forEach(function (r) { assert.strictEqual(try1(r).ok, true, r); });
  ['provider_failed:http_5xx', 'provider_unavailable:tavily', 'bad_slot:limiter', 'unused_slot:term2'].forEach(function (r) {
    assert.strictEqual(try1(r).ok, true, r);
  });
  ['made_up', 'provider_failed:', 'provider_failed', 'Quick_Cap', '', null, undefined, 'bad_slot'].forEach(function (r) {
    assert.deepStrictEqual(pick(try1(r)), [false, 'unknown_reason'], 'accepted reason ' + String(r));
  });
  // a refused reason leaves the op open
  assert.strictEqual(ledger.operations[ledger.operations.length - 1].state, 'planned');
});

leg('F3 exports and constants match the plan', function () {
  ['OPS_SCHEMA', 'STATES', 'TERMINAL_STATES', 'REASONS', 'FALSIFIER_TEMPLATES', 'operationId', 'createLedger', 'mint', 'transition',
    'recordFallback', 'sweep', 'completion', 'counterevidenceStatus', 'ledgerPath', 'readLedger', 'writeLedger', 'isFalsifier']
    .forEach(function (k) { assert.ok(k in ops, 'export missing: ' + k); });
  assert.deepStrictEqual(ops.STATES, ['planned', 'composed', 'dispatched', 'executed_with_results', 'executed_empty', 'refused_before_fetch', 'not_executed']);
  assert.deepStrictEqual(ops.TERMINAL_STATES, ['executed_with_results', 'executed_empty', 'refused_before_fetch', 'not_executed']);
  const l = fresh();
  assert.deepStrictEqual([l.schema, l.run_id, l.plan_hash, l.created_at, l.updated_at, l.operations.length], ['mos.research-operations/1', 'run-A', 'plan-hash-1', NOW, NOW, 0]);
  assert.throws(function () { ops.mint(l, base({ kind: 'nonsense' })); }, /kind/);
  assert.throws(function () { ops.mint(l, base({ plan_dimension: '' })); }, /plan_dimension/);
});

leg('DASH no em-dash or en-dash in the test or the module', function () {
  [__filename, MODULE].forEach(function (f) {
    const s = fs.readFileSync(f, 'utf8');
    assert.ok(s.indexOf(String.fromCharCode(0x2014)) === -1 && s.indexOf(String.fromCharCode(0x2013)) === -1, 'dash found in ' + path.basename(f));
  });
});

function pick(r) { return [r.ok, r.reason]; }

process.stdout.write('PASS: ' + pass + ' FAIL: ' + fail + '\n');
process.exitCode = fail > 0 ? 1 : 0;
