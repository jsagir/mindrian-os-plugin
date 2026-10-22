#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 379.1 gap closure plan 08: the decision validator, the table printer and the gate reader for
 * the drain peak RSS fix. A human chooses the fix after reading the measured numbers of plan 07
 * (tests/fixtures/379.1/probe-drain-rss.json). The choice is recorded in
 * tests/fixtures/379.1/rss-decision.json. Plan 09 reads the record and applies only that fix.
 *
 * Modes:
 *   (no argument)   hermetic cases on synthetic objects, then the real record if it exists
 *                   (absence prints PENDING and exits 0)
 *   --table         print the probe numbers as plain text rows (reads the probe file only)
 *   --print         print the record as one JSON line
 *   --require <id>  exit 0 valid record with that decision, 3 valid record with another decision,
 *                   4 no record, 5 invalid record
 * Canon Part 8: no network, no room text. Hyphens only.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const PROBE_REL = 'tests/fixtures/379.1/probe-drain-rss.json';
const PROBE_FILE = path.join(REPO, PROBE_REL);
const RECORD_FILE = path.join(REPO, 'tests', 'fixtures', '379.1', 'rss-decision.json');
const DECISIONS = ['a-batch', 'a-arena', 'b-limit', 'c-stop'];
const ALLOWED_KEYS = ['decision', 'decided_by', 'decided_at', 'reason', 'source', 'source_probed_at', 'batch', 'new_limit_mb', 'measured_ceiling_mb'];
const DASHES = /[—–]/;

function isInt(v) { return typeof v === 'number' && Number.isInteger(v); }

function armOk(probe, name) {
  const a = probe && probe.arms && probe.arms[name];
  return !!(a && isInt(a.reps_ok) && a.reps_ok >= 1);
}

/** validateDecision(record, probe) -> [problem]. Empty means valid. */
function validateDecision(record, probe) {
  const bad = [];
  if (!record || typeof record !== 'object' || Array.isArray(record)) return ['record is not an object'];
  const p = probe || {};
  Object.keys(record).forEach((k) => { if (ALLOWED_KEYS.indexOf(k) === -1) bad.push('unknown key ' + k); });
  if (DECISIONS.indexOf(record.decision) === -1) bad.push('unknown decision');
  if (typeof record.decided_by !== 'string' || record.decided_by.length === 0 || record.decided_by.length > 80) bad.push('decided_by must be a string of 1 to 80 characters');
  if (typeof record.decided_at !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(record.decided_at)) bad.push('decided_at must be YYYY-MM-DD');
  if (typeof record.reason !== 'string' || record.reason.length < 20) bad.push('reason must have at least 20 characters');
  if (record.source !== PROBE_REL) bad.push('source must be ' + PROBE_REL);
  if (record.source_probed_at !== p.probed_at) bad.push('source_probed_at differs from the probe probed_at');

  const text = JSON.stringify(record);
  if (DASHES.test(text)) bad.push('holds an em-dash or en-dash');
  const home = os.homedir();
  if (home && home !== '/' && text.indexOf(home) !== -1) bad.push('holds a home path');
  if (/[A-Za-z]:\\\\/.test(text)) bad.push('holds a drive-letter path');

  const d = record.decision;
  const extra = ['batch', 'new_limit_mb', 'measured_ceiling_mb'].filter((k) => k in record);
  if (d === 'a-batch') {
    if (!isInt(record.batch)) bad.push('a-batch needs an integer batch');
    else if (record.batch >= 32) bad.push('a-batch batch must be below 32');
    else if (!armOk(p, 'D' + record.batch)) bad.push('batch ' + record.batch + ' was not measured');
    if ('new_limit_mb' in record || 'measured_ceiling_mb' in record) bad.push('a-batch holds no limit fields');
  } else if (d === 'a-arena') {
    if (!armOk(p, 'E32_ARENA_OFF')) bad.push('a-arena needs a measured E32_ARENA_OFF arm');
    if (extra.length > 0) bad.push('a-arena holds no option fields');
  } else if (d === 'b-limit') {
    if (!isInt(record.new_limit_mb) || !isInt(record.measured_ceiling_mb)) bad.push('b-limit needs integer new_limit_mb and measured_ceiling_mb');
    else {
      const d32 = p.arms && p.arms.D32 && p.arms.D32.rss_mb_max;
      if (typeof d32 !== 'number' || record.measured_ceiling_mb < Math.floor(d32)) bad.push('measured_ceiling_mb is below the measured D32 peak');
      if (record.new_limit_mb < record.measured_ceiling_mb) bad.push('new_limit_mb is below measured_ceiling_mb');
    }
    if (typeof record.reason !== 'string' || record.reason.length < 40) bad.push('b-limit reason must have at least 40 characters');
    if ('batch' in record) bad.push('b-limit holds no batch');
  } else if (d === 'c-stop') {
    if (extra.length > 0) bad.push('c-stop holds no option fields');
  }
  return bad;
}

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_e) { return null; }
}

function printTable(probe) {
  const rows = [];
  rows.push('arm            batch  runs_ok  rss_min  rss_median  rss_max  clock_median_ms  cpu_median_ms');
  ['D8', 'D16', 'D32', 'E0', 'E32', 'E32_ARENA_OFF'].forEach((n) => {
    const a = (probe.arms || {})[n] || {};
    rows.push([n.padEnd(14), String(a.batch).padEnd(6), String(a.reps_ok).padEnd(8), String(a.rss_mb_min).padEnd(8), String(a.rss_mb_median).padEnd(11), String(a.rss_mb_max).padEnd(8), String(a.clock_ms_median).padEnd(16), String(a.cpu_ms_median)].join(' '));
  });
  const d = probe.derived || {};
  rows.push('RSS values are peak MB. Limit: ' + d.limit_mb + ' MB.');
  rows.push('control_reproduced_breach: ' + d.control_reproduced_breach);
  rows.push('largest_batch_under_limit: ' + d.largest_batch_under_limit);
  rows.push('encoder_floor_mb: ' + d.encoder_floor_mb);
  rows.push('encoder_share_of_control: ' + d.encoder_share_of_control);
  rows.push('arena_off_change_pct_vs_embed_only: ' + d.arena_off_change_pct_vs_embed_only);
  console.log(rows.join('\n'));
}

let pass = 0;
let fail = 0;
function t(label, fn) {
  try {
    fn();
    pass += 1;
    console.log('  ok - ' + label);
  } catch (e) {
    fail += 1;
    process.exitCode = 1;
    console.log('  FAIL - ' + label + ': ' + (e && e.message ? e.message : e));
  }
}

function synthProbe() {
  const arm = (b, ok, max) => ({ batch: b, reps_ok: ok, rss_mb_max: max });
  return {
    probed_at: '2026-01-01T00:00:00.000Z',
    arms: { D8: arm(8, 2, 700), D16: arm(16, 2, 900), D32: arm(32, 2, 1800.4), E32_ARENA_OFF: arm(32, 1, 500) },
  };
}
function rec(over) {
  return Object.assign({
    decision: 'a-batch', decided_by: 'navigator', decided_at: '2026-10-22', reason: 'Chosen from the card after the table.',
    source: PROBE_REL, source_probed_at: '2026-01-01T00:00:00.000Z', batch: 16,
  }, over || {});
}

function selfTest() {
  const assert = require('node:assert/strict');
  const probe = synthProbe();
  console.log('379.1 rss decision validator (plan 08)');
  t('1 a-batch accepts a measured batch, rejects 32, 4 and a missing batch', () => {
    assert.deepEqual(validateDecision(rec(), probe), []);
    assert.ok(validateDecision(rec({ batch: 32 }), probe).length > 0);
    assert.ok(validateDecision(rec({ batch: 4 }), probe).length > 0);
    const m = rec(); delete m.batch;
    assert.ok(validateDecision(m, probe).length > 0);
  });
  t('2 a-arena needs a measured arena-off arm', () => {
    const a = rec({ decision: 'a-arena' }); delete a.batch;
    assert.deepEqual(validateDecision(a, probe), []);
    const p2 = synthProbe(); p2.arms.E32_ARENA_OFF.reps_ok = 0;
    assert.ok(validateDecision(a, p2).length > 0);
  });
  t('3 b-limit needs integers, ceiling at or above the D32 floor, limit at or above ceiling, reason of 40 characters', () => {
    const base = rec({ decision: 'b-limit', new_limit_mb: 2000, measured_ceiling_mb: 1800, reason: 'x'.repeat(40) }); delete base.batch;
    assert.deepEqual(validateDecision(base, probe), []);
    assert.ok(validateDecision(Object.assign({}, base, { measured_ceiling_mb: 1799 }), probe).length > 0);
    assert.ok(validateDecision(Object.assign({}, base, { new_limit_mb: 1799 }), probe).length > 0);
    assert.ok(validateDecision(Object.assign({}, base, { reason: 'x'.repeat(39) }), probe).length > 0);
    assert.ok(validateDecision(Object.assign({}, base, { new_limit_mb: 2000.5 }), probe).length > 0);
  });
  t('4 c-stop accepts a reason and no option fields', () => {
    const c = rec({ decision: 'c-stop' }); delete c.batch;
    assert.deepEqual(validateDecision(c, probe), []);
    assert.ok(validateDecision(Object.assign({}, c, { batch: 8 }), probe).length > 0);
  });
  t('5 rejects unknown id, key, short reason, dash, path, wrong source and stale stamp', () => {
    assert.ok(validateDecision(rec({ decision: 'z' }), probe).length > 0);
    assert.ok(validateDecision(rec({ extra: 1 }), probe).length > 0);
    assert.ok(validateDecision(rec({ reason: 'short' }), probe).length > 0);
    assert.ok(validateDecision(rec({ reason: 'a reason with a dash ' + String.fromCharCode(0x2014) + ' inside it' }), probe).length > 0);
    assert.ok(validateDecision(rec({ reason: 'see ' + path.join(os.homedir(), 'x') + ' for detail text' }), probe).length > 0);
    assert.ok(validateDecision(rec({ source: 'other.json' }), probe).length > 0);
    assert.ok(validateDecision(rec({ source_probed_at: 'old' }), probe).length > 0);
  });
  t('6 the real record, when present, is valid against the real probe', () => {
    if (!fs.existsSync(RECORD_FILE)) { console.log('  PENDING - no rss-decision.json yet'); return; }
    const probeReal = readJson(PROBE_FILE);
    const r = readJson(RECORD_FILE);
    assert.ok(probeReal && r, 'record or probe unreadable');
    assert.deepEqual(validateDecision(r, probeReal), []);
  });
  console.log('rss-decision: PASS ' + pass + ' FAIL ' + fail);
  if (fail > 0) process.exit(1);
}

if (require.main === module) {
  const argv = process.argv.slice(2);
  if (argv[0] === '--table') {
    const probe = readJson(PROBE_FILE);
    if (!probe) { console.error('probe file unreadable'); process.exit(1); }
    printTable(probe);
  } else if (argv[0] === '--print') {
    const r = readJson(RECORD_FILE);
    if (!r) { console.error('no record'); process.exit(4); }
    console.log(JSON.stringify(r));
  } else if (argv[0] === '--require') {
    const id = argv[1];
    if (!fs.existsSync(RECORD_FILE)) process.exit(4);
    const r = readJson(RECORD_FILE);
    const probe = readJson(PROBE_FILE);
    const problems = r && probe ? validateDecision(r, probe) : ['unreadable'];
    if (problems.length > 0) { console.error(problems.join('\n')); process.exit(5); }
    process.exit(r.decision === id ? 0 : 3);
  } else {
    selfTest();
  }
}

module.exports = { validateDecision, DECISIONS };
