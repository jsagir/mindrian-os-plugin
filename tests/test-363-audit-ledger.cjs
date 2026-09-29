'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 363 Plan 09 -- append-only research audit ledger. Legs A1-A5.
 *
 * No em-dash or en-dash characters in this file. Exit 0 pass, 1 fail.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');

const hygiene = require('./helpers/hygiene-355.cjs');
hygiene.scrubVendorKey();
delete process.env.OPENALEX_API_KEY;
const guard = hygiene.installNetGuard();
const { check, summary } = hygiene.makeChecker('363-09 audit ledger');

const ROOT = path.resolve(__dirname, '..');
const AUDIT_FILE = path.join(ROOT, 'lib', 'core', 'research-planner', 'audit-ledger.cjs');

let A = null;
let loadError = null;
try { A = require(AUDIT_FILE); } catch (e) { loadError = e; }

function leg(name, fn) {
  try {
    if (loadError) throw new Error('module load failed: ' + String(loadError.message).slice(0, 120));
    fn();
    check(name, true);
  } catch (e) {
    check(name, false, String(e && e.message ? e.message : e).slice(0, 220));
  }
}

const rooms = [];
function mkRoom() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'a363-'));
  rooms.push(d);
  return d;
}
function rec(over) {
  return Object.assign({
    ts: '2026-09-29T12:00:00.000Z', run_id: 'r-1', grant_id: 'g-0a0b0c0d', grant_version: 1,
    q: '"acoustic biofilm disruption"', q_hash: 'sha256:' + 'a'.repeat(64), template_id: 'ws.exact',
    family: 'whitespace-gap/v1', part8_verdict: 'pass', provider: 'openalex', filters: { type: 'article' },
    pagination: { per_page: 5, page: 1 }, fallback_used: false, origin_ref: 'leaf-1',
    result_ids: ['W1', 'W2'], content_hashes: ['sha256:' + 'b'.repeat(64)], outcome: 'ok', failure_class: null,
    count: 2, cost_usd: 0, remaining_usd: 1, x_query: null, latency_ms: 120,
  }, over || {});
}
function ledgerPath(room) { return path.join(room, '.mindrian', 'research-audit.jsonl'); }

leg('A1 appendAudit writes one JSON line with exactly AUDIT_KEYS; missing or extra key refused', function () {
  const room = mkRoom();
  assert.equal(A.AUDIT_KEYS.length, 23);
  const r = A.appendAudit(room, rec());
  assert.equal(r.ok, true, JSON.stringify(r));
  const lines = fs.readFileSync(ledgerPath(room), 'utf8').split('\n').filter(Boolean);
  assert.equal(lines.length, 1);
  assert.deepEqual(Object.keys(JSON.parse(lines[0])).sort(), A.AUDIT_KEYS.slice().sort());
  const missing = rec();
  delete missing.q_hash;
  assert.equal(A.appendAudit(room, missing).ok, false);
  assert.equal(A.appendAudit(room, rec({ surprise: 1 })).ok, false);
  assert.equal(A.appendAudit(room, rec({ outcome: 'weird' })).ok, false);
  assert.equal(A.appendAudit(room, rec({ part8_verdict: 'maybe' })).ok, false);
  assert.equal(fs.readFileSync(ledgerPath(room), 'utf8').split('\n').filter(Boolean).length, 1);
});

leg('A2 append-only: earlier lines are byte-identical after further appends', function () {
  const room = mkRoom();
  A.appendAudit(room, rec({ run_id: 'r-a' }));
  A.appendAudit(room, rec({ run_id: 'r-b' }));
  const before = fs.readFileSync(ledgerPath(room), 'utf8');
  A.appendAudit(room, rec({ run_id: 'r-c' }));
  const after = fs.readFileSync(ledgerPath(room), 'utf8');
  assert.equal(after.startsWith(before), true);
  assert.equal(after.split('\n').filter(Boolean).length, 3);
});

leg('A3 key-shaped values are refused and the key never reaches the file', function () {
  const room = mkRoom();
  process.env.OPENALEX_API_KEY = 'fake-key-363';
  try {
    assert.equal(A.appendAudit(room, rec({ x_query: 'sent fake-key-363 here' })).ok, false);
    assert.equal(A.appendAudit(room, rec({ origin_ref: 'Bearer abc' })).ok, false);
    assert.equal(A.appendAudit(room, rec({ q: 'x api_key=zzz' })).ok, false);
    assert.equal(A.appendAudit(room, rec({ filters: { note: 'fake-key-363' } })).ok, false);
    assert.equal(A.appendAudit(room, rec()).ok, true);
  } finally {
    delete process.env.OPENALEX_API_KEY;
  }
  const raw = fs.existsSync(ledgerPath(room)) ? fs.readFileSync(ledgerPath(room), 'utf8') : '';
  assert.equal(raw.indexOf('fake-key-363'), -1);
  assert.equal(raw.split('\n').filter(Boolean).length, 1);
});

leg('A4 readAudit filters by run_id; sliceForRun keeps order and skips torn lines', function () {
  const room = mkRoom();
  A.appendAudit(room, rec({ run_id: 'r-x', origin_ref: 'one' }));
  A.appendAudit(room, rec({ run_id: 'r-y', origin_ref: 'two' }));
  A.appendAudit(room, rec({ run_id: 'r-x', origin_ref: 'three' }));
  fs.appendFileSync(ledgerPath(room), '{torn\n');
  assert.equal(A.readAudit(room).length, 3);
  assert.equal(A.readAudit(room, { run_id: 'r-x' }).length, 2);
  assert.deepEqual(A.sliceForRun(room, 'r-x').map(function (r) { return r.origin_ref; }), ['one', 'three']);
  assert.deepEqual(A.sliceForRun(room, 'r-none'), []);
  assert.deepEqual(A.readAudit(mkRoom()), []);
});

leg('A5 ledger path is under .mindrian and audit-ledger.cjs performs no network I/O', function () {
  const room = mkRoom();
  A.appendAudit(room, rec());
  assert.equal(fs.existsSync(path.join(room, '.mindrian', 'research-audit.jsonl')), true);
  const src = fs.readFileSync(AUDIT_FILE, 'utf8');
  assert.equal(/fetch\(|https?:\/\/|require\('node:https?'\)|require\('https?'\)|node:net|node:dns/.test(src), false);
  assert.equal(/[\u2014\u2013]/.test(src), false);
  assert.equal(guard.attempts(), 0);
});

rooms.forEach(function (d) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_e) { /* ignore */ } });
process.exit(summary());
