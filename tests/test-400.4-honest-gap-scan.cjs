#!/usr/bin/env node
'use strict';

/*
 * tests/test-400.4-honest-gap-scan.cjs -- Phase 400.4 plan 05 (QA-F8).
 *
 * Legs:
 *   H1 findUnsupportedClaims is unchanged (2 ratified rows); findUnratifiedUnsupportedClaims counts 30 proposed, 20 ids
 *   H2 a proposed claim with an inbound EVIDENCES or SUPPORTS edge is not counted
 *   H3 findIsolatedArtifacts counts Artifact nodes with no INFORMS, CONVERGES, SUPPORTS or EVIDENCES edge (either direction)
 *   H4 a node of type 'artifact' with no edge counts; a claim with no edge is not an isolated artifact
 *   H5 ids are sorted ascending and capped at GAP_ID_CAP (20); count is the full count
 *   H6 the whitespace_scan handler reports both fields apart; gap_count keeps its base meaning
 *   H7 empty room gives {count: 0, ids: []}; a throwing reader gives {count: null, ids: [], error: 'read_failed'}
 *
 * House rule: hyphens only, no em-dashes.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// Hermetic homes BEFORE any module loads: the MCP handler resolves the session room through the machine registry.
const HERMETIC_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-400-4-gap-home-'));
process.env.HOME = path.join(HERMETIC_HOME, 'home');
process.env.MINDRIAN_ROOMS_HOME = path.join(HERMETIC_HOME, 'rooms');
fs.mkdirSync(process.env.HOME, { recursive: true });
fs.mkdirSync(process.env.MINDRIAN_ROOMS_HOME, { recursive: true });
process.on('exit', () => { try { fs.rmSync(HERMETIC_HOME, { recursive: true, force: true }); } catch (_e) { /* best effort */ } });

const REPO_ROOT = path.resolve(__dirname, '..');
const { openRoomDb, closeRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));
const navigation = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation.cjs'));

let passed = 0;
function ok(label) {
  passed += 1;
  console.log('  ok - ' + label);
}

const NOW = 1717000000000;

function makeRoomDir(prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  fs.mkdirSync(path.join(dir, '.mindrian'), { recursive: true });
  return dir;
}

function insertNode(db, id, type, reviewStatus) {
  db.prepare(
    'INSERT INTO nodes (id, type, properties, source_path, created_by, confidence, review_status, ' +
    'created_at, last_seen_at, source_section) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(id, type, '{}', 'gap-400-4', 'system', null, reviewStatus || 'proposed', NOW, NOW, 'gap-400-4');
}

function insertEdge(db, source, target, type) {
  db.prepare("INSERT INTO edges (source, target, type, properties) VALUES (?, ?, ?, '{}')").run(source, target, type);
}

const pad = (i) => String(i).padStart(3, '0');

// The H1 plus H3 room: 30 proposed claims, 2 confirmed unsupported, 1 confirmed supported; 10 isolated Artifacts
// plus 6 linked ones.
function fillGapRoom(db) {
  for (let i = 0; i < 30; i++) insertNode(db, 'claim:prop-' + pad(i), 'claim', 'proposed');
  insertNode(db, 'claim:conf-unsup-a', 'claim', 'confirmed');
  insertNode(db, 'claim:conf-unsup-b', 'CausalClaim', 'needs_evidence');
  insertNode(db, 'claim:conf-sup', 'claim', 'confirmed');
  insertNode(db, 'evidence:e1', 'evidence', 'confirmed');
  insertEdge(db, 'evidence:e1', 'claim:conf-sup', 'SUPPORTS');
  for (let i = 0; i < 10; i++) {
    const id = 'note-iso-' + pad(i);
    insertNode(db, id, 'Artifact', 'proposed');
    insertNode(db, 'section:' + id, 'Section', 'proposed');
    insertEdge(db, id, 'section:' + id, 'BELONGS_TO');
  }
  for (let i = 0; i < 3; i++) {
    insertNode(db, 'note-out-informs-' + i, 'Artifact', 'proposed');
    insertEdge(db, 'note-out-informs-' + i, 'claim:conf-sup', 'INFORMS');
  }
  for (let i = 0; i < 2; i++) {
    insertNode(db, 'note-in-converges-' + i, 'Artifact', 'proposed');
    insertEdge(db, 'claim:conf-sup', 'note-in-converges-' + i, 'CONVERGES');
  }
  insertNode(db, 'note-out-supports', 'Artifact', 'proposed');
  insertEdge(db, 'note-out-supports', 'claim:conf-sup', 'SUPPORTS');
}

async function main() {
  const roomDir = makeRoomDir('mos-400-4-gap-');
  const roomId = path.basename(roomDir);
  let db = openRoomDb(roomDir);
  try { fillGapRoom(db); } finally { closeRoomDb(db); }
  db = openRoomDb(roomDir);
  try {
    // H1
    const ratified = navigation.findUnsupportedClaims(db, roomId);
    assert.deepEqual(ratified.map((r) => r.claim.id).sort(), ['claim:conf-unsup-a', 'claim:conf-unsup-b'],
      'H1: findUnsupportedClaims is the same 2 ratified rows');
    assert.equal(typeof navigation.findUnratifiedUnsupportedClaims, 'function', 'H1: reader is exported');
    assert.equal(navigation.GAP_ID_CAP, 20, 'H1: GAP_ID_CAP is 20');
    const unr = navigation.findUnratifiedUnsupportedClaims(db, roomId);
    assert.equal(unr.count, 30, 'H1: 30 proposed unsupported claims');
    assert.equal(unr.ids.length, 20, 'H1: 20 ids');
    ok('H1: ratified list unchanged; unratified count 30 with 20 ids');

    // H2
    insertEdge(db, 'evidence:e1', 'claim:prop-000', 'EVIDENCES');
    insertEdge(db, 'evidence:e1', 'claim:prop-001', 'SUPPORTS');
    const unr2 = navigation.findUnratifiedUnsupportedClaims(db, roomId);
    assert.equal(unr2.count, 28, 'H2: two supported proposed claims leave the count');
    assert.equal(unr2.ids.includes('claim:prop-000'), false);
    assert.equal(unr2.ids.includes('claim:prop-001'), false);
    ok('H2: an inbound EVIDENCES or SUPPORTS edge removes a proposed claim from the count');

    // H3
    assert.equal(typeof navigation.findIsolatedArtifacts, 'function', 'H3: reader is exported');
    const iso = navigation.findIsolatedArtifacts(db, roomId);
    assert.equal(iso.count, 10, 'H3: 10 isolated artifacts');
    const want = [];
    for (let i = 0; i < 10; i++) want.push('note-iso-' + pad(i));
    assert.deepEqual(iso.ids, want, 'H3: the 10 ids');
    ok('H3: only artifacts with no INFORMS, CONVERGES, SUPPORTS or EVIDENCES edge in either direction count');

    // H4
    insertNode(db, 'bridge-art-lone', 'artifact', 'proposed');
    insertNode(db, 'claim:lone-claim', 'claim', 'confirmed');
    const iso2 = navigation.findIsolatedArtifacts(db, roomId);
    assert.equal(iso2.count, 11, "H4: a lone 'artifact' node counts");
    assert.equal(iso2.ids.includes('bridge-art-lone'), true);
    assert.equal(iso2.ids.includes('claim:lone-claim'), false, 'H4: a claim is not an artifact');
    ok("H4: type 'artifact' counts; a claim with no edge does not");

    // H5
    for (let i = 0; i < 25; i++) insertNode(db, 'zz-extra-' + pad(i), 'Artifact', 'proposed');
    const iso3 = navigation.findIsolatedArtifacts(db, roomId);
    assert.equal(iso3.count, 36, 'H5: count is the full count');
    assert.equal(iso3.ids.length, 20, 'H5: ids capped at 20');
    assert.deepEqual(iso3.ids, iso3.ids.slice().sort(), 'H5: ids sorted ascending');
    const unr3 = navigation.findUnratifiedUnsupportedClaims(db, roomId);
    assert.deepEqual(unr3.ids, unr3.ids.slice().sort(), 'H5: unratified ids sorted ascending');
    ok('H5: ids sorted and capped at GAP_ID_CAP, count is the full count');
  } finally {
    try { closeRoomDb(db); } catch (_e) { /* already closed */ }
  }

  await legsH6H7(roomDir);
  console.log(passed + ' checks passed.');
  try { fs.rmSync(roomDir, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  process.exit(0);
}

function registerSensors(dir) {
  const sensors = require(path.join(REPO_ROOT, 'lib', 'mcp', 'tools', 'sensors.cjs'));
  const stub = {
    tools: new Map(),
    registerTool(name, config, cb) { this.tools.set(name, { description: (config || {}).description, cb }); },
  };
  sensors.register(stub, { fallbackRoomDir: dir, pluginRoot: REPO_ROOT, surface: 'cli' });
  const reg = stub.tools.get('whitespace_scan');
  assert.ok(reg, 'whitespace_scan registered');
  return reg;
}

async function legsH6H7(gapRoomDir) {
  // H6: the handler on a fresh H1 plus H3 room (the earlier room has extra rows from H2 to H5).
  const dir6 = makeRoomDir('mos-400-4-gap6-');
  const db6 = openRoomDb(dir6);
  try { fillGapRoom(db6); } finally { closeRoomDb(db6); }
  const reg6 = registerSensors(dir6);
  const res6 = await reg6.cb({}, { sessionId: 'sess-400-4-gap-6' });
  const body6 = JSON.parse(res6.content[0].text);
  assert.equal(body6.ok, true);
  assert.equal(fs.realpathSync(body6.room_dir), fs.realpathSync(dir6), 'H6: the handler resolved the fixture room');
  assert.equal(body6.unratified_unsupported.count, 30);
  assert.equal(body6.unratified_unsupported.ids.length, 20);
  assert.equal(body6.isolated_artifacts.count, 10);
  assert.equal(body6.isolated_artifacts.ids.length, 10);
  assert.equal(body6.unsupported_claims.length, 2, 'H6: unsupported_claims holds the 2 ratified rows');
  assert.equal(body6.unsupported_claims.every((r) => r.claim.reviewStatus !== 'proposed'), true,
    'H6: no unratified claim in unsupported_claims');
  assert.equal(body6.gap_count, body6.open_questions.length + 2, 'H6: gap_count keeps its base meaning');
  const keys = Object.keys(body6);
  assert.ok(keys.indexOf('unsupported_claims') < keys.indexOf('unratified_unsupported'));
  assert.ok(keys.indexOf('isolated_artifacts') < keys.indexOf('gap_count'));
  ok('H6: handler reports both fields apart; gap_count unchanged');

  // H7a: empty room.
  const dir7 = makeRoomDir('mos-400-4-gap7-');
  closeRoomDb(openRoomDb(dir7));
  const reg7 = registerSensors(dir7);
  const body7 = JSON.parse((await reg7.cb({}, { sessionId: 'sess-400-4-gap-7' })).content[0].text);
  assert.equal(body7.ok, true);
  assert.deepEqual(body7.unratified_unsupported, { count: 0, ids: [] });
  assert.deepEqual(body7.isolated_artifacts, { count: 0, ids: [] });
  assert.equal(body7.gap_count, 0);

  // H7b: a reader throws. The handler calls through the navigation object, so a stubbed export is what it sees.
  const realA = navigation.findUnratifiedUnsupportedClaims;
  const realB = navigation.findIsolatedArtifacts;
  navigation.findUnratifiedUnsupportedClaims = () => { throw new Error('stub failure'); };
  navigation.findIsolatedArtifacts = () => { throw new Error('stub failure'); };
  try {
    const body7b = JSON.parse((await reg7.cb({}, { sessionId: 'sess-400-4-gap-7b' })).content[0].text);
    assert.equal(body7b.ok, true, 'H7: the reply is still ok');
    assert.deepEqual(body7b.unratified_unsupported, { count: null, ids: [], error: 'read_failed' });
    assert.deepEqual(body7b.isolated_artifacts, { count: null, ids: [], error: 'read_failed' });
  } finally {
    navigation.findUnratifiedUnsupportedClaims = realA;
    navigation.findIsolatedArtifacts = realB;
  }
  ok('H7: empty room gives zero counts; a failed reader gives read_failed and the reply stays ok');
  for (const d of [dir6, dir7]) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_e) { /* best effort */ } }
}

main().catch((e) => { console.error('FAIL: ' + (e && e.stack ? e.stack : e)); process.exit(1); });
