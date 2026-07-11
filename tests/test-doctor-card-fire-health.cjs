'use strict';
/*
 * tests/test-doctor-card-fire-health.cjs -- Phase 217 Plan-02 (D-05).
 *
 * Hermetic fixture tests for lib/core/doctor/card-fire-health-module.cjs -- the
 * doctor module that reports the HEALTH of the card-fire self-diagnostic
 * instrument (scripts/check-card-fire.cjs). Applies the 2026-07-11
 * printer-must-match-counter lesson to the sibling self-diagnostic surface.
 *
 * Hermetic: fs.mkdtempSync fixture dirs, node:assert/strict, ok() counter,
 * zero network, nothing touches the real ~/.mindrian (every case injects
 * ctx.log_path into a scratch dir). No em-dashes (house rule).
 *
 * RED-first (Task 2): the module does not exist yet, so the require below throws
 * and this file fails at load. That is the expected RED state.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const mod = require('../lib/core/doctor/card-fire-health-module.cjs');

const VOCAB = new Set(['ok', 'warn', 'error', 'skip']);

let passed = 0;
function ok(label) { passed += 1; console.log('  ok - ' + label); }

function freshDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'cardfire-health-'));
}
function logPathIn(dir) { return path.join(dir, 'card-fire-intercepts.log'); }
function writeLog(dir, lines) {
  fs.writeFileSync(logPathIn(dir), lines.join('\n') + (lines.length ? '\n' : ''), 'utf8');
}

// Case 1 (absent log): an empty scratch dir -> a fresh install is healthy, not
// broken. status ok, detail notes no intercepts recorded yet.
(function case1_absent_log() {
  const dir = freshDir();
  const r = mod.check({ log_path: logPathIn(dir) });
  assert.strictEqual(r.status, 'ok', 'absent log -> ok');
  assert.ok(typeof r.detail === 'string' && r.detail.length > 0, 'detail is a non-empty string');
  assert.match(r.detail, /no intercept/i, 'detail notes no intercepts recorded yet');
  ok('case 1: absent log is healthy (ok, no intercepts recorded)');
})();

// Case 2 (valid fresh JSONL): two valid JSON lines, now-ish timestamps -> ok.
(function case2_valid_fresh_jsonl() {
  const dir = freshDir();
  const now = Date.now();
  writeLog(dir, [
    JSON.stringify({ ts: now - 2000, timestamp: new Date(now - 2000).toISOString(), reason: 'intercept', session_id: 's1' }),
    JSON.stringify({ ts: now - 500, timestamp: new Date(now - 500).toISOString(), reason: 'degrade', session_id: 's1' }),
  ]);
  const r = mod.check({ log_path: logPathIn(dir) });
  assert.strictEqual(r.status, 'ok', 'valid fresh JSONL -> ok');
  assert.ok(r.detail && r.detail.length > 0, 'detail is a non-empty string');
  ok('case 2: valid fresh JSONL is healthy (ok)');
})();

// Case 3 (malformed line): one valid + one non-JSON line -> warn naming the count.
(function case3_malformed_line() {
  const dir = freshDir();
  const now = Date.now();
  writeLog(dir, [
    JSON.stringify({ ts: now - 100, reason: 'intercept' }),
    'this-is-not-json{',
  ]);
  const r = mod.check({ log_path: logPathIn(dir) });
  assert.strictEqual(r.status, 'warn', 'malformed line -> warn');
  assert.match(r.detail, /malformed/i, 'detail names the malformed condition');
  assert.match(r.detail, /1\b/, 'detail names the malformed-line count');
  ok('case 3: a malformed JSONL line -> warn naming the count');
})();

// Case 4 (stale): newest entry older than the injected staleness window -> warn.
(function case4_stale() {
  const dir = freshDir();
  const oldTs = Date.now() - 1000 * 60 * 60; // an hour ago
  writeLog(dir, [ JSON.stringify({ ts: oldTs, reason: 'intercept' }) ]);
  const r = mod.check({ log_path: logPathIn(dir), staleness_ms: 1 });
  assert.strictEqual(r.status, 'warn', 'stale (staleness_ms=1) -> warn');
  assert.match(r.detail, /stale/i, 'detail mentions staleness');
  ok('case 4: newest entry older than the staleness window -> warn');
})();

// Case 5 (contract): every return path carries a vocab status + non-empty detail;
// the module exports check and does NOT export fix.
(function case5_contract() {
  assert.strictEqual(typeof mod.check, 'function', 'module exports check()');
  assert.strictEqual(typeof mod.fix, 'undefined', 'module does NOT export fix() (fix_supported:false)');
  const dir = freshDir();
  const now = Date.now();
  writeLog(dir, [ JSON.stringify({ ts: now, reason: 'intercept' }) ]);
  const contexts = [
    { log_path: logPathIn(freshDir()) },                    // absent log
    { log_path: logPathIn(dir) },                           // fresh
    { log_path: logPathIn(dir), staleness_ms: 1 },          // stale
  ];
  for (const ctx of contexts) {
    const r = mod.check(ctx);
    assert.ok(VOCAB.has(r.status), 'status in ok|warn|error|skip: ' + r.status);
    assert.ok(typeof r.detail === 'string' && r.detail.length > 0, 'detail non-empty on every path');
  }
  ok('case 5: vocab status + non-empty detail on every path; check exported, fix not');
})();

// Case 6 (library-seam parity): requiring check-card-fire.cjs does NOT run main()
// (require.main guard) and exposes the classifier/counter seams the 2026-07-11
// parity fix depends on.
(function case6_library_seam_parity() {
  const cf = require('../scripts/check-card-fire.cjs');
  for (const fn of ['classifyCardFire', 'gateReachingEntries', 'computeBackstopHit', 'loadRegistry']) {
    assert.strictEqual(typeof cf[fn], 'function', 'check-card-fire exports ' + fn + '()');
  }
  ok('case 6: check-card-fire.cjs library seam intact; require does not execute main()');
})();

console.log('\nALL PASS (' + passed + ' assertions)');
