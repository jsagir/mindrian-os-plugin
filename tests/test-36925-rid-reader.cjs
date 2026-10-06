#!/usr/bin/env node
'use strict';
/*
 * 369.25 plan 14 (RID-09, amendment 4): a reader other than the writer confirms the room identity.
 *
 * The writer is lib/core/navigation/room-identity.cjs (birth commits the seven room.* keys through it). The reader
 * under test is `doctor --icm-walk` (lib/core/doctor/icm-walk-module.cjs): its own SQL on a throwaway copy, opened
 * through openRoomDbReadOnlyForCaller, never the writer's library. Before this plan the walk counted identity rows that
 * contained the slug as a substring, so after RID-01 it read "yes" for any room with a Room node (RESEARCH Pitfall 17).
 *
 * Arms:
 *   D1  a born room: the room block reports identity_keys_present 7, room_id equal to readRoomIdentity's, room_node
 *       true, identity_ready true; the nest block carries room_id_expected; the room tree hash is unchanged by the walk;
 *       a section MINTO.md whose room: value is the room id reads matches_room_id true, another value false, none null
 *   D2  a legacy room (born, then its seven room.* keys deleted): identity_keys_present 0, identity_ready false, the
 *       M3 line says no with "identity keys: 0 of 7" and "room_id: none"; Room node is still reported (not enough)
 *   D2b partial and mismatched identity: four keys present reads not ready (agrees with readRoomIdentity); seven keys
 *       with a different room.slug reads not ready
 *   D3  source check: icm-walk-module.cjs does not require room-identity.cjs, opens room.db only through
 *       openRoomDbReadOnlyForCaller, no longer counts rows naming the slug; dash guard
 *
 * Hermetic: fixture rooms are born under a mkdtemp HOME and rooms home (tests/helpers/isolated-home-36925.cjs).
 * Hyphens only. CJS.
 */
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const H = require('./helpers/isolated-home-36925.cjs');
const IDENTITY = require(path.join(ROOT, 'lib', 'core', 'navigation', 'room-identity.cjs'));
const WALK_SRC = path.join(ROOT, 'lib', 'core', 'doctor', 'icm-walk-module.cjs');

let passed = 0;
let failed = 0;
function check(label, cond, detail) {
  if (cond) { passed += 1; console.log('PASS: ' + label); }
  else { failed += 1; console.log('FAIL: ' + label + (detail !== undefined ? ' :: ' + detail : '')); }
}
function eq(label, got, want) {
  check(label, JSON.stringify(got) === JSON.stringify(want), 'got ' + JSON.stringify(got) + ' want ' + JSON.stringify(want));
}

const iso = H.mkIsolatedHome('rid-reader');

function walk(roomDir, json) {
  const args = [path.join(ROOT, 'scripts', 'doctor.cjs'), '--icm-walk', '--room', roomDir].concat(json ? ['--json'] : []);
  const r = cp.spawnSync(process.execPath, args, { env: iso.env, cwd: iso.home, encoding: 'utf8', timeout: 120000 });
  if (r.status !== 0) return { error: 'exit ' + r.status + ' ' + String(r.stderr).slice(0, 300) };
  if (!json) return { text: r.stdout };
  try { return { report: JSON.parse(r.stdout) }; } catch (e) { return { error: 'bad JSON: ' + String(e.message) + ' ' + r.stdout.slice(0, 120) }; }
}

function withWriteDb(roomDir, fn) {
  const db = require(path.join(ROOT, 'lib', 'core', 'room-db.cjs')).openRoomDb(roomDir);
  try { return fn(db); } finally { db.close(); }
}

function birth(slug) {
  process.env.MINDRIAN_ROOMS_HOME = iso.roomsHome;
  const b = H.birthFixtureRoom({ iso, slug });
  if (!b.ok) throw new Error('fixture birth failed for ' + slug + ': ' + JSON.stringify(b).slice(0, 200));
  return b;
}

const SEVEN = IDENTITY.IDENTITY_KEYS;

// ---- D1 ----------------------------------------------------------------------------------------------------------
(function d1() {
  const b = birth('rr-born');
  const id = IDENTITY.readRoomIdentity(b.roomDir);
  check('D1 fixture identity is ready (the writer side)', id.state === 'ready', JSON.stringify(id).slice(0, 200));

  // a section MINTO.md per case, written before the hash so the tree hash is of the final tree
  const sec = path.join(b.roomDir, 'problem-definition');
  fs.writeFileSync(path.join(sec, 'MINTO.md'), '---\nsection: problem-definition\nroom: ' + id.room_id + '\n---\n# Problem Definition -- Minto Reasoning\n');
  const sec2 = path.join(b.roomDir, 'market-analysis');
  fs.writeFileSync(path.join(sec2, 'MINTO.md'), '---\nsection: market-analysis\nroom: some-other-room\n---\n# Market -- Minto Reasoning\n');

  const before = H.treeHash(b.roomDir);
  const w = walk(b.roomDir, true);
  const after = H.treeHash(b.roomDir);
  check('D1 doctor --icm-walk --json ran', !!w.report, w.error);
  if (!w.report) return;
  const room = w.report.room;
  eq('D1 identity_keys_present', room.identity_keys_present, 7);
  eq('D1 room_id equals readRoomIdentity room_id', room.room_id, id.room_id);
  eq('D1 room_node', room.room_node, true);
  eq('D1 identity_ready', room.identity_ready, true);
  check('D1 the substring counters are gone from the room block', !('identity_rows_naming_room' in room) && !('slug_db_agreement' in room), Object.keys(room).join(','));
  eq('D1 the room tree hash is unchanged by the walk', after, before);
  const nest = (name) => w.report.nests.find((n) => n.nest === name);
  const root = w.report.nests[0];
  eq('D1 root I8b room_id_expected', root.I8b.room_id_expected, id.room_id);
  eq('D1 root I8b matches_room_id is null when the face has no room value', root.I8b.matches_room_id, null);
  const pd = nest('problem-definition');
  check('D1 problem-definition is a walked nest', !!pd, w.report.nests.map((n) => n.nest).join(','));
  if (pd) {
    eq('D1 face room value equal to the id: matches_room_id true', pd.I8b.matches_room_id, true);
    eq('D1 face room value equal to the id: legacy matches_slug stays (false)', pd.I8b.matches_slug, false);
  }
  const ma = nest('market-analysis');
  if (ma) eq('D1 face with another room value: matches_room_id false', ma.I8b.matches_room_id, false);
  else check('D1 market-analysis is a walked nest', false, w.report.nests.map((n) => n.nest).join(','));
  eq('D1 summary identity_in_room_db', w.report.summary.identity_in_room_db, true);

  const t = walk(b.roomDir, false);
  check('D1 text run ok', !!t.text, t.error);
  if (t.text) {
    check('D1 M3 line says yes with the seven keys and the room id',
      t.text.indexOf('room identity in room.db: yes (room.db: present, Room node: yes, identity keys: 7 of 7, room_id: ' + id.room_id + ')') !== -1,
      t.text.split('\n').filter((l) => l.indexOf('room identity in room.db') === 0).join(' | '));
  }
})();

// ---- D2 ----------------------------------------------------------------------------------------------------------
(function d2() {
  const b = birth('rr-legacy');
  withWriteDb(b.roomDir, (db) => { db.prepare("DELETE FROM identity WHERE key LIKE 'room.%'").run(); });
  const left = withWriteDb(b.roomDir, (db) => db.prepare("SELECT COUNT(*) AS n FROM identity WHERE key LIKE 'room.%'").get().n);
  eq('D2 fixture: room.* keys deleted', left, 0);
  const idState = IDENTITY.readRoomIdentity(b.roomDir);
  eq('D2 the writer-side library also reads not ready (identity_missing)', [idState.state, idState.reason], ['not_ready', 'identity_missing']);
  const w = walk(b.roomDir, true);
  check('D2 --json ran', !!w.report, w.error);
  if (w.report) {
    eq('D2 identity_keys_present', w.report.room.identity_keys_present, 0);
    eq('D2 identity_ready', w.report.room.identity_ready, false);
    eq('D2 room_id', w.report.room.room_id, null);
    eq('D2 the Room node row alone is still reported', w.report.room.room_node, true);
    eq('D2 summary identity_in_room_db is false', w.report.summary.identity_in_room_db, false);
  }
  const t = walk(b.roomDir, false);
  check('D2 text run ok', !!t.text, t.error);
  if (t.text) {
    const line = t.text.split('\n').filter((l) => l.indexOf('room identity in room.db') === 0).join(' | ');
    check('D2 M3 line says no with "identity keys: 0 of 7" and "room_id: none"',
      /^room identity in room\.db: no \(room\.db: present, Room node: yes, identity keys: 0 of 7, room_id: none\)/.test(line), line);
  }
})();

// ---- D2b ---------------------------------------------------------------------------------------------------------
(function d2b() {
  const p = birth('rr-partial');
  withWriteDb(p.roomDir, (db) => {
    ['room.parent', 'room.depth', 'room.created_at'].forEach((k) => db.prepare('DELETE FROM identity WHERE key = ?').run(k));
  });
  const idState = IDENTITY.readRoomIdentity(p.roomDir);
  eq('D2b writer-side library: identity_incomplete', [idState.state, idState.reason], ['not_ready', 'identity_incomplete']);
  const w = walk(p.roomDir, true);
  check('D2b partial --json ran', !!w.report, w.error);
  if (w.report) {
    eq('D2b partial: identity_keys_present', w.report.room.identity_keys_present, 4);
    eq('D2b partial: identity_ready false (agrees with the library)', w.report.room.identity_ready, false);
  }

  const m = birth('rr-slug-mismatch');
  withWriteDb(m.roomDir, (db) => { db.prepare("UPDATE identity SET value = 'a-different-slug' WHERE key = 'room.slug'").run(); });
  const w2 = walk(m.roomDir, true);
  check('D2b mismatch --json ran', !!w2.report, w2.error);
  if (w2.report) {
    eq('D2b mismatch: seven keys present', w2.report.room.identity_keys_present, 7);
    eq('D2b mismatch: identity_ready false (room.slug is not the walked slug)', w2.report.room.identity_ready, false);
  }
})();

// ---- D3 ----------------------------------------------------------------------------------------------------------
(function d3() {
  const src = fs.readFileSync(WALK_SRC, 'utf8');
  const code = src.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
  check('D3 icm-walk-module.cjs does not require room-identity.cjs', !/require\([^)]*room-identity/.test(code));
  check('D3 it opens room.db through openRoomDbReadOnlyForCaller', /openRoomDbReadOnlyForCaller\(/.test(code));
  check('D3 it never opens the write door or node:sqlite', !/openRoomDbForCaller\(/.test(code) && !/node:sqlite/.test(code) && !/require\([^)]*room-db\.cjs/.test(code));
  check('D3 identity_rows_naming_room is gone', src.indexOf('identity_rows_naming_room') === -1);
  eq('D3 dash guard (walk module, this test)', H.dashGuard([WALK_SRC, __filename]), []);
})();

console.log('\nPASS=' + passed + ' FAIL=' + failed);
process.exit(failed === 0 ? 0 : 1);
