#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 369.2 Plan 27 (369.2-R20; HARNESS-11 counting half; annex C16; brief test 22).
 *
 * The session review counted 137 "confirmed nodes" that were auto-generated whitespace zones while zero claims
 * were confirmed. navigation.readReadinessCounts(db) counts claims apart from every other confirmed node type.
 * The field names are the contract plan 369.4's export banner reads.
 *
 *   RC1  (brief test 22) the h11 room: 2 confirmed WhitespaceZone nodes, 0 claims -> confirmed_claim_count 0,
 *        confirmed_other_by_type {WhitespaceZone: 2}, confirmed_other_count 2, claims_total 0
 *   RC2  one confirmed 'claim' and one proposed 'CausalClaim' -> confirmed_claim_count 1, claims_total 2
 *   RC3  a confirmed EvidenceClaim and a confirmed decision count under confirmed_other_by_type, never as claims
 *   RC4  a nodes table without review_status -> all zeros and schema_note 'no_review_status'; the call never
 *        writes (a read-only handle over a file db, file bytes unchanged)
 *   RC5  no em-dash or en-dash in this file
 *
 * Hermetic: HOME, USERPROFILE and MINDRIAN_ROOMS_HOME are mkdtemp dirs before any repo module loads; the db is
 * in memory or a temp file. Output: one PASS or FAIL line per leg, then PASS: n FAIL: n. Exit 0 pass, 1 fail.
 * House rule: hyphens only.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-3692-27-rc-'));
process.env.HOME = TMP;
process.env.USERPROFILE = TMP;
process.env.MINDRIAN_ROOMS_HOME = path.join(TMP, 'rooms');
delete process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.CLAUDE_CODE_SESSION_ID;

try { require('node:sqlite'); } catch (_e) {
  process.stdout.write('ENV GAP: node:sqlite unavailable (node ' + process.version + '); need node >= 22\n');
  process.exit(77);
}
const { DatabaseSync } = require('node:sqlite');

const ROOT = path.resolve(__dirname, '..');
const { makeChecker } = require(path.join(ROOT, 'tests/helpers/hygiene-355.cjs'));
const { check, summary } = makeChecker('test-3692-readiness');
const navigation = require(path.join(ROOT, 'lib/core/navigation.cjs'));

// the same node table the h11 phase-0 builder uses (fixtures/phase0/HARNESS-11/h11.cjs.txt)
const NODES_DDL = "CREATE TABLE nodes (id TEXT PRIMARY KEY, type TEXT NOT NULL, properties TEXT DEFAULT '{}', source_path TEXT NOT NULL, created_by TEXT NOT NULL CHECK(created_by IN ('user','larry','import','brain','system')), confidence REAL, review_status TEXT NOT NULL DEFAULT 'proposed', created_at INTEGER NOT NULL, last_seen_at INTEGER NOT NULL)";

function h11Room() {
  const d = new DatabaseSync(':memory:');
  d.exec(NODES_DDL);
  return d;
}
function put(d, id, type, status) {
  d.prepare('INSERT INTO nodes (id,type,properties,source_path,created_by,review_status,created_at,last_seen_at) VALUES (?,?,?,?,?,?,?,?)')
    .run(id, type, '{}', 'p', 'system', status, 1, 1);
}
function counts(d) {
  if (typeof navigation.readReadinessCounts !== 'function') throw new Error('navigation.readReadinessCounts is not exported');
  return navigation.readReadinessCounts(d);
}

const LEGS = [];
function leg(name, fn) { LEGS.push([name, fn]); }

leg('RC1 brief test 22: confirmed whitespace zones never count as confirmed claims', function () {
  const d = h11Room();
  put(d, 'ws:zone-1', 'WhitespaceZone', 'confirmed');
  put(d, 'ws:zone-2', 'WhitespaceZone', 'confirmed');
  const c = counts(d);
  console.log('RC1 measured: ' + JSON.stringify(c));
  return c.confirmed_claim_count === 0 && c.claims_total === 0 && c.confirmed_other_count === 2
    && c.confirmed_other_by_type && c.confirmed_other_by_type.WhitespaceZone === 2
    && Object.keys(c.confirmed_other_by_type).length === 1 && c.schema_note === undefined
    || JSON.stringify(c);
});

leg('RC2 a confirmed claim counts, a proposed CausalClaim only adds to the total', function () {
  const d = h11Room();
  put(d, 'ws:zone-1', 'WhitespaceZone', 'confirmed');
  put(d, 'claim:a', 'claim', 'confirmed');
  put(d, 'claim:b', 'CausalClaim', 'proposed');
  const c = counts(d);
  console.log('RC2 measured: ' + JSON.stringify(c));
  return c.confirmed_claim_count === 1 && c.claims_total === 2 && c.confirmed_other_count === 1
    && c.confirmed_other_by_type.WhitespaceZone === 1 || JSON.stringify(c);
});

leg('RC3 a confirmed EvidenceClaim and a confirmed decision are other nodes, never claims', function () {
  const d = h11Room();
  put(d, 'ev:1', 'EvidenceClaim', 'confirmed');
  put(d, 'dec:1', 'decision', 'confirmed');
  put(d, 'asm:1', 'assumption', 'confirmed');
  put(d, 'claim:a', 'claim', 'rejected');
  const c = counts(d);
  console.log('RC3 measured: ' + JSON.stringify(c));
  return c.confirmed_claim_count === 0 && c.claims_total === 1 && c.confirmed_other_count === 3
    && c.confirmed_other_by_type.EvidenceClaim === 1 && c.confirmed_other_by_type.decision === 1
    && c.confirmed_other_by_type.assumption === 1 || JSON.stringify(c);
});

leg('RC4 a legacy nodes table without review_status answers zeros with a schema note, and nothing is written', function () {
  const file = path.join(TMP, 'legacy.db');
  const w = new DatabaseSync(file);
  w.exec("CREATE TABLE nodes (id TEXT PRIMARY KEY, type TEXT NOT NULL, properties TEXT DEFAULT '{}', source_path TEXT NOT NULL, created_by TEXT NOT NULL, created_at INTEGER NOT NULL, last_seen_at INTEGER NOT NULL)");
  w.prepare('INSERT INTO nodes (id,type,properties,source_path,created_by,created_at,last_seen_at) VALUES (?,?,?,?,?,?,?)').run('claim:a', 'claim', '{}', 'p', 'user', 1, 1);
  w.close();
  const before = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  const ro = new DatabaseSync(file, { readOnly: true });
  let c;
  try { c = counts(ro); } finally { ro.close(); }
  const after = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  console.log('RC4 measured: ' + JSON.stringify(c));
  return c.claims_total === 0 && c.confirmed_claim_count === 0 && c.confirmed_other_count === 0
    && Object.keys(c.confirmed_other_by_type).length === 0 && c.schema_note === 'no_review_status' && before === after
    || JSON.stringify({ c: c, same: before === after });
});

leg('RC5 no em-dash or en-dash in this file', function () {
  const src = fs.readFileSync(__filename, 'utf8');
  return (src.indexOf(String.fromCharCode(0x2014)) === -1 && src.indexOf(String.fromCharCode(0x2013)) === -1) || 'a dash is present';
});

for (const [name, fn] of LEGS) {
  let r;
  try { r = fn(); } catch (e) { r = 'threw: ' + String((e && e.message) || e).slice(0, 300); }
  check(name, r === true, r === true ? '' : String(r));
}
process.exit(summary());
