#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 366-10 Task 2: the canon-backfill doctor module (D-16), hermetic.
 *   B1  check reports per room counts and writes nothing
 *   B2  fix mints framework nodes then edges for every resolvable thing
 *   B3  a second fix returns zero new nodes and zero new edges (idempotent)
 *   B4  an existing edge whose framework node row is missing gets its node
 *       minted when the slug maps to exactly one canon name, else unmapped
 *   B5  dryRun reports the same counts and writes nothing
 *   B6  a malformed registry entry and an unreadable room soft-fail alone
 *   B7  the registry row and the runner contract
 * Fully local: two fixture rooms under an isolated MINDRIAN_ROOMS_HOME. No network.
 */
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const TMP_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-366-bf-home-'));
process.env.HOME = TMP_HOME;
process.env.USERPROFILE = TMP_HOME;
const ROOMS_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-366-bf-roomshome-'));
process.env.MINDRIAN_ROOMS_HOME = ROOMS_HOME;
delete process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.CLAUDE_CODE_SESSION_ID;
delete process.env.MINDRIAN_MCP_FIRST;

const REPO_ROOT = path.resolve(__dirname, '..');
const hygiene = require(path.join(REPO_ROOT, 'tests/helpers/hygiene-355.cjs'));
hygiene.scrubVendorKey();
delete process.env.ANTHROPIC_API_KEY;
const net = hygiene.installNetGuard();
const C = hygiene.makeChecker('test-366-canon-backfill');

const { DatabaseSync } = require('node:sqlite');
const roomDb = require(path.join(REPO_ROOT, 'lib/core/room-db.cjs'));
const { insertNode } = require(path.join(REPO_ROOT, 'lib/core/node-insert.cjs'));
const translations = require(path.join(REPO_ROOT, 'lib/core/canon-translations.cjs'));

const RS = 'Reverse Salient Analysis';
const LENSES = 'Four Lenses of Innovation';
const ACKOFF = 'Ackoff Pyramid';
const ADAPTIVE = 'Adaptive Leadership';

function mkRoom(label) {
  const roomDir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mos-366-bf-' + label + '-')), 'room');
  fs.mkdirSync(roomDir, { recursive: true });
  fs.writeFileSync(path.join(roomDir, 'ROOM.md'), '---\nname: ' + label + '\n---\n');
  return roomDir;
}

function thing(db, id, section, props) {
  insertNode(db, id, 'Artifact', JSON.stringify(Object.assign({ section: section, body: 'Body text for ' + id + ' so the thing has content.' }, props)), { source_path: 'test:366-bf', epistemic_type: 'observation' });
}

// Room A: four resolvable things without an edge (framework, methodology, title,
// ratified translation), one unresolvable thing, one edge whose framework node
// row is missing and maps to canon, one edge that maps to nothing.
function buildRoomA() {
  const roomDir = mkRoom('a');
  const db = roomDb.openRoomDb(roomDir);
  try {
    thing(db, 'pd/T1', 'problem-definition', { title: 'Lagging subsystem note', framework: RS });
    thing(db, 'pd/T2', 'problem-definition', { title: 'Loops in the vendor ecosystem', methodology: 'analyze-systems' });
    thing(db, 'pd/T3', 'problem-definition', { title: LENSES });
    thing(db, 'pd/T4', 'problem-definition', { title: 'Pyramid of knowledge' });
    thing(db, 'pd/T5', 'problem-definition', { title: 'Plain note with no canon' });
    thing(db, 'pd/T6', 'problem-definition', { title: 'Carries an edge only' });
    thing(db, 'pd/T7', 'problem-definition', { title: 'Carries an unmappable edge' });
    const ins = db.prepare('INSERT INTO edges (source, target, type, properties) VALUES (?, ?, ?, ?)');
    ins.run('pd/T6', 'framework:' + 'ackoff-pyramid', 'USES_FRAMEWORK', '{}');
    ins.run('pd/T7', 'framework:no-such-canon', 'USES_FRAMEWORK', '{}');
  } finally {
    roomDb.closeRoomDb(db);
  }
  translations.proposeRow(roomDir, { term: 'Pyramid of knowledge', canon_name: ADAPTIVE });
  translations.ratifyRow(roomDir, 'Pyramid of knowledge', '2026-10-02');
  return roomDir;
}

function buildRoomB() {
  const roomDir = mkRoom('b');
  const db = roomDb.openRoomDb(roomDir);
  try {
    thing(db, 'ma/M1', 'market-analysis', { title: 'Market lens note', framework: LENSES });
    thing(db, 'ma/M2', 'market-analysis', { title: 'Plain market note' });
  } finally {
    roomDb.closeRoomDb(db);
  }
  return roomDir;
}

const roomA = buildRoomA();
const roomB = buildRoomB();
const roomBad = mkRoom('bad');
fs.mkdirSync(path.join(roomBad, '.mindrian'), { recursive: true });
fs.writeFileSync(path.join(roomBad, '.mindrian', 'room.db'), 'this is not a sqlite database');

fs.mkdirSync(path.join(ROOMS_HOME, '.rooms'), { recursive: true });
fs.writeFileSync(path.join(ROOMS_HOME, '.rooms', 'registry.json'), JSON.stringify({
  active: 'alpha',
  rooms: { alpha: { abs_path: roomA }, beta: { abs_path: roomB }, broken: { abs_path: roomBad }, malformed: {}, nothing: null },
}));

function snap(roomDir) {
  const db = new DatabaseSync(path.join(roomDir, '.mindrian', 'room.db'), { readOnly: true });
  try {
    return {
      nodes: db.prepare('SELECT count(*) AS c FROM nodes').get().c,
      edges: db.prepare('SELECT count(*) AS c FROM edges').get().c,
      fw: db.prepare("SELECT count(*) AS c FROM nodes WHERE type = 'framework'").get().c,
      uf: db.prepare("SELECT count(*) AS c FROM edges WHERE type = 'USES_FRAMEWORK'").get().c,
    };
  } finally { db.close(); }
}
function sha(roomDir) {
  return crypto.createHash('sha256').update(fs.readFileSync(path.join(roomDir, '.mindrian', 'room.db'))).digest('hex');
}

const mod = require(path.join(REPO_ROOT, 'lib/core/doctor/canon-backfill-module.cjs'));
C.check('B7 runner exports check and fix', typeof mod.check === 'function' && typeof mod.fix === 'function');

// ---- B1 ----------------------------------------------------------------
const beforeA = snap(roomA), beforeB = snap(roomB);
const hashA = sha(roomA), hashB = sha(roomB);
const chk = mod.check({ flags: {} });
const byRoom = {};
(chk.rooms || []).forEach(function (r) { byRoom[r.room] = r; });
C.check('B1 check walks every registered room regardless of the active flag', !!byRoom.alpha && !!byRoom.beta, Object.keys(byRoom).join(','));
C.check('B1 alpha: 4 resolvable things without an edge', byRoom.alpha && byRoom.alpha.resolvable_without_edge === 4, JSON.stringify(byRoom.alpha));
C.check('B1 alpha: 1 unmapped edge target', byRoom.alpha && byRoom.alpha.unmapped_targets === 1, JSON.stringify(byRoom.alpha));
C.check('B1 beta: 1 resolvable thing without an edge', byRoom.beta && byRoom.beta.resolvable_without_edge === 1, JSON.stringify(byRoom.beta));
C.check('B1 check status is warn when the fix has work, never error', chk.status === 'warn', chk.status);
C.check('B1 check wrote nothing (row counts and file bytes unchanged)',
  JSON.stringify(snap(roomA)) === JSON.stringify(beforeA) && JSON.stringify(snap(roomB)) === JSON.stringify(beforeB) && sha(roomA) === hashA && sha(roomB) === hashB);
const BANNED = /\b(orphan|orphaned|dangling|broken|corrupt|stale|unhealthy|degraded|dense|sparse|density|risk|healthy)\b/i;
C.check('B1 detail is counts only, no banned adjective', !BANNED.test(chk.detail), chk.detail);

// ---- B5 (dryRun before the real run) -----------------------------------
const dry = mod.fix({ dryRun: true, check_result: chk });
const dryA = (dry.rooms || []).find(function (r) { return r.room === 'alpha'; });
const dryB = (dry.rooms || []).find(function (r) { return r.room === 'beta'; });
C.check('B5 dryRun alpha projects 5 nodes (4 thing frameworks + the edge target) and 4 edges', dryA && dryA.minted_nodes === 5 && dryA.written_edges === 4, JSON.stringify(dryA));
C.check('B5 dryRun beta projects 1 node and 1 edge', dryB && dryB.minted_nodes === 1 && dryB.written_edges === 1, JSON.stringify(dryB));
C.check('B5 dryRun wrote nothing', sha(roomA) === hashA && sha(roomB) === hashB);

// ---- B2 ----------------------------------------------------------------
const run1 = mod.fix({ dryRun: false, check_result: chk });
const r1A = (run1.rooms || []).find(function (r) { return r.room === 'alpha'; });
const r1B = (run1.rooms || []).find(function (r) { return r.room === 'beta'; });
C.check('B2 alpha minted 5 nodes and wrote 4 edges', r1A && r1A.minted_nodes === 5 && r1A.written_edges === 4, JSON.stringify(r1A));
C.check('B2 beta minted 1 node and wrote 1 edge', r1B && r1B.minted_nodes === 1 && r1B.written_edges === 1, JSON.stringify(r1B));
const afterA = snap(roomA);
C.check('B2 alpha framework nodes and USES_FRAMEWORK edges landed', afterA.fw === beforeA.fw + 5 && afterA.uf === beforeA.uf + 4, JSON.stringify([beforeA, afterA]));
{
  const db = new DatabaseSync(path.join(roomA, '.mindrian', 'room.db'), { readOnly: true });
  const missing = db.prepare("SELECT count(*) AS c FROM edges e WHERE e.type = 'USES_FRAMEWORK' AND NOT EXISTS (SELECT 1 FROM nodes n WHERE n.id = e.target)").get().c;
  db.close();
  C.check('B2 only the unmappable edge target still lacks a node (edges never precede nodes)', missing === 1, String(missing));
}

// ---- B4 ----------------------------------------------------------------
{
  const db = new DatabaseSync(path.join(roomA, '.mindrian', 'room.db'), { readOnly: true });
  const ack = db.prepare("SELECT type FROM nodes WHERE id = 'framework:ackoff-pyramid'").get();
  const none = db.prepare("SELECT 1 FROM nodes WHERE id = 'framework:no-such-canon'").get();
  db.close();
  C.check('B4 an edge target mapping to exactly one canon name got its node', ack && ack.type === 'framework');
  C.check('B4 an unmappable target is left alone', !none);
}

// ---- B3 ----------------------------------------------------------------
const chk2 = mod.check({});
const midA = snap(roomA), midB = snap(roomB);
const run2 = mod.fix({ dryRun: false, check_result: chk2 });
const r2 = (run2.rooms || []).filter(function (r) { return r.room === 'alpha' || r.room === 'beta'; });
C.check('B3 second check has no fix work (status ok)', chk2.status === 'ok', chk2.status + ' ' + chk2.detail);
C.check('B3 second fix: zero new nodes, zero new edges', r2.every(function (r) { return r.minted_nodes === 0 && r.written_edges === 0; }), JSON.stringify(r2));
C.check('B3 graph counts identical after the second fix', JSON.stringify(snap(roomA)) === JSON.stringify(midA) && JSON.stringify(snap(roomB)) === JSON.stringify(midB));

// ---- B6 ----------------------------------------------------------------
const brk = byRoom.broken;
C.check('B6 an unreadable room soft-fails alone and is named', !!brk && brk.unreadable === true, JSON.stringify(brk));
C.check('B6 the sweep did not abort (alpha and beta still reported)', !!byRoom.alpha && !!byRoom.beta);
C.check('B6 a malformed registry entry is skipped without a throw', !byRoom.malformed && !byRoom.nothing);
C.check('B6 fix survives the unreadable room', run1 && (run1.errors || []).length === 0 && run1.status !== 'error', run1 && run1.status);

C.check('no network attempted', net.attempts() === 0);
net.restore();
process.exit(C.summary());
