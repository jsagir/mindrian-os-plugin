'use strict';
/*
 * Phase 369.25 plan 09 -- the heal-first net checks the room itself (RFT-09, HEAL-01; amendment 3 and the
 * 2026-10-06 ruling: "the ninth failure test proves recovery, not refusal; the Phase 0 fixture (eleven artifacts
 * against an unready room) stays as the RED half").
 *
 * Phase 0 finding, quoted from .planning/phases/369.25-.../369.25-PHASE0-STATUS.md (row R3, "why step 0 did not
 * fire"), fixture path tests/fixtures/never-ready-room/build-fixture.cjs, captured outputs under
 * .planning/phases/369.25-.../fixtures/phase0/R3-never-ready/:
 *
 *   "2. Step 0 inspects child folders only: reproduced. step5-detector-output.json lists 14 child folders and no
 *    entry for the room itself; nothing asks whether the room has a room.db, a registry entry or an identity.
 *    3. Approval required: reproduced. Step 5a returned 14 entries, all { ok: false, reason: 'no_approval' }.
 *    4. Scaffold false positives: reproduced. The detector flagged 14 of 14 child folders (the 11 core sections
 *    plus assets, references and team) on a room whose only authored content is 11 notes."
 *
 *   "'eleven artifacts indexed' is ALREADY true on the never-ready room once a session-start has run (11 notes
 *   indexed in step 4a). The RED assertion therefore cannot be indexing alone; it must also assert readiness
 *   (identity naming the room, a Room node, a registry entry), which is exactly what stays false."
 *
 * So every readiness assertion below is about READINESS (identity, Room node, registry entry); the index count
 * (N3) is the "no work lost" half of recovery, never the failing signal.
 *
 * Arms (run in order, each on its own isolated home):
 *   N1 never-ready, no approvedBy: readiness {not_ready, room_db_missing, repair_room_identity}; tree hash unchanged
 *   N2 never-ready, approvedBy: ready, registry lists the slug with room.db's room_id, recovered/created_db/registered
 *   N3 after N2: eleven artifact nodes whose ids are the eleven files; no section holds a .room-root
 *   N4 a born room: readiness agrees with the owner API (ready once the identity exists); detector finds 0 folders
 *   N5 a born room with a 64-zero-byte room.db, approvedBy: moved aside (bytes kept), new room.db reads ready
 *   N6 a hand-built non-section folder (field-notes) is still detected (the GDH-08 heal keeps working)
 *   N7 stopAfterReadiness returns the record on a ready and a never-ready room and writes nothing in either
 *   N8 dash guard on the files this plan owns
 *
 * The derive step is never reached by these arms (the sync deriveFn below returns no edges, and recovery returns
 * before deriving), so the local e5 encoder is never needed (Phase 0: both backfill calls ended
 * 'skipped: encoder_unavailable' in an isolated home). Nothing is written under ~/MindrianRooms or ~/.mindrian
 * (the isolated-home helper). Zero network. Hyphens only.
 */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const H = require('./helpers/isolated-home-36925.cjs');
const { buildNeverReadyRoom } = require('./fixtures/never-ready-room/build-fixture.cjs');

let passed = 0;
let failed = 0;
const failedNames = [];
async function arm(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log('PASS: ' + name);
  } catch (e) {
    failed += 1;
    failedNames.push(name);
    console.log('FAIL: ' + name + '\n    ' + String((e && e.message) || e).split('\n').join('\n    '));
  }
}
function check(cond, msg) { if (!cond) throw new Error(msg); }
function eq(a, b, msg) {
  const x = JSON.stringify(a);
  const y = JSON.stringify(b);
  if (x !== y) throw new Error(msg + ' (expected ' + y + ', got ' + x + ')');
}

const noEdges = () => [];

function backfill() { return require(path.join(ROOT, 'lib', 'core', 'graph-backfill.cjs')); }
function selfHeal() { return require(path.join(ROOT, 'lib', 'core', 'graph-self-heal.cjs')); }
function identityMod() { return require(path.join(ROOT, 'lib', 'core', 'navigation', 'room-identity.cjs')); }
function spine() { return require(path.join(ROOT, 'lib', 'core', 'navigation', 'spine-events.cjs')); }

function useHome(iso) {
  process.env.HOME = iso.home;
  process.env.USERPROFILE = iso.home;
  process.env.MINDRIAN_ROOMS_HOME = iso.roomsHome;
  delete process.env.CLAUDE_CODE_SESSION_ID;
  delete process.env.MINDRIAN_ACTIVE_SESSION_ID;
}

function neverReady(tag, slug) {
  const iso = H.mkIsolatedHome(tag);
  useHome(iso);
  const built = buildNeverReadyRoom(iso.home, { slug });
  return { iso, slug, roomDir: fs.realpathSync(built.roomDir), artifacts: built.artifacts.map((f) => fs.realpathSync(f)) };
}

function bornRoom(tag, slug) {
  const iso = H.mkIsolatedHome(tag);
  useHome(iso);
  const b = H.birthFixtureRoom({ iso, slug });
  return { iso, slug, roomDir: fs.realpathSync(b.roomDir) };
}

function registry(iso) {
  try { return JSON.parse(fs.readFileSync(path.join(iso.roomsHome, '.rooms', 'registry.json'), 'utf8')); } catch (_e) { return null; }
}

// Count of Artifact nodes (id -> true) in a COPY of the room's db, read through the read-only door.
function artifactNodeIds(roomDir) {
  const os = require('node:os');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), '36925-n3-'));
  try {
    fs.mkdirSync(path.join(tmp, '.mindrian'));
    ['', '-wal', '-shm'].forEach((s) => {
      const src = path.join(roomDir, '.mindrian', 'room.db' + s);
      if (fs.existsSync(src)) fs.copyFileSync(src, path.join(tmp, '.mindrian', 'room.db' + s));
    });
    const db = spine().openRoomDbReadOnlyForCaller(tmp);
    check(db, 'read-only open returned no handle');
    try {
      return db.prepare("SELECT id FROM nodes WHERE type = 'Artifact'").all().map((r) => r.id);
    } finally { spine().closeRoomDbForCaller(db); }
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}

function sectionSentinels(roomDir) {
  const names = Object.keys(require(path.join(ROOT, 'lib', 'core', 'section-registry.cjs')).CORE_SECTIONS);
  return names.filter((n) => fs.existsSync(path.join(roomDir, n, '.room-root')));
}

async function main() {
  // ---- N1 --------------------------------------------------------------------------------------------------------
  await arm('N1 never-ready room, no approvedBy: not_ready room_db_missing with the offered remediation, and nothing written', async () => {
    const r = neverReady('n1', 'never-ready-n1');
    const before = H.treeHash(r.roomDir);
    const res = await backfill().runDeriveBackfill({ roomDir: r.roomDir, deriveFn: noEdges, roomsHome: r.iso.roomsHome });
    check(res && res.readiness, 'result.readiness is absent (step 0 never asked about the room itself)');
    eq(res.readiness.state, 'not_ready', 'readiness.state');
    eq(res.readiness.reason, 'room_db_missing', 'readiness.reason');
    eq(res.readiness.remediation, 'repair_room_identity', 'readiness.remediation');
    eq(H.treeHash(r.roomDir), before, 'room tree hash after an unapproved call');
    check(!fs.existsSync(path.join(r.roomDir, '.mindrian', 'room.db')), 'an unapproved call created room.db');
    check(registry(r.iso) === null, 'an unapproved call wrote a registry');
  });

  // ---- N2 + N3 (same room: recovery, then no work lost) ---------------------------------------------------------
  const rec = neverReady('n2', 'never-ready-n2');
  await arm('N2 never-ready room, approvedBy: the room reads ready, registered with room.db\'s room_id; recovered, created_db, registered', async () => {
    const res = await backfill().runDeriveBackfill({
      roomDir: rec.roomDir, approvedBy: 'test-36925', deriveFn: noEdges, roomsHome: rec.iso.roomsHome,
    });
    check(res && res.readiness, 'result.readiness is absent');
    eq(res.readiness.recovered, true, 'readiness.recovered');
    eq(res.readiness.created_db, true, 'readiness.created_db');
    eq(res.readiness.registered, true, 'readiness.registered');
    const id = identityMod().readRoomIdentity(rec.roomDir, { roomsHome: rec.iso.roomsHome });
    eq(id.state, 'ready', 'readRoomIdentity state after recovery (reason ' + id.reason + ')');
    eq(id.slug, 'never-ready-n2', 'identity slug');
    check(id.room_node === true, 'no Room node after recovery');
    const reg = registry(rec.iso);
    const entry = reg && reg.rooms && reg.rooms['never-ready-n2'];
    check(entry, 'registry does not list the slug');
    eq(entry.room_id, id.room_id, 'registry room_id vs room.db room_id');
  });

  await arm('N3 after recovery: the eleven artifacts are indexed (no work lost) and no section became a child room', async () => {
    const ids = artifactNodeIds(rec.roomDir).sort();
    const want = rec.artifacts.map((f) => path.relative(rec.roomDir, f).split(path.sep).join('/')).sort();
    const missing = want.filter((w) => ids.indexOf(w) === -1);
    eq(missing, [], 'artifact files with no Artifact node (nodes: ' + JSON.stringify(ids) + ')');
    eq(sectionSentinels(rec.roomDir), [], 'sections that hold a .room-root (a wrong repair)');
  });

  // ---- N4 --------------------------------------------------------------------------------------------------------
  await arm('N4 a born room: readiness agrees with the owner API and the detector finds 0 folders (measured 14 before plan 09)', async () => {
    const r = bornRoom('n4', 'born-n4');
    const own = identityMod().readRoomIdentity(r.roomDir, { door: 'copy', roomsHome: r.iso.roomsHome });
    if (own.state !== 'ready') {
      // Birth does not write the identity until plan 07; bring the room to ready through the approved owner repair
      // so this arm measures the net, not the birth.
      const rep = identityMod().repairRoomIdentity(r.roomDir, { approvedBy: 'test-36925', roomsHome: r.iso.roomsHome });
      check(rep.ok === true, 'owner repair of the born room failed: ' + JSON.stringify(rep.readback || rep));
    }
    const res = await backfill().runDeriveBackfill({
      roomDir: r.roomDir, deriveFn: noEdges, stopAfterReadiness: true, roomsHome: r.iso.roomsHome,
    });
    check(res && res.readiness, 'result.readiness is absent');
    eq(res.readiness.state, 'ready', 'readiness.state of a born, identified room');
    const found = selfHeal().detectUnsentineledArtifactFolder(r.roomDir);
    eq(found.map((f) => path.basename(f.folder)), [], 'folders the detector flags on a freshly born room');
  });

  // ---- N5 --------------------------------------------------------------------------------------------------------
  await arm('N5 a born room with a 64-zero-byte room.db, approvedBy: moved aside with its bytes, the new room.db reads ready', async () => {
    const r = bornRoom('n5', 'born-n5');
    const dbp = path.join(r.roomDir, '.mindrian', 'room.db');
    ['-wal', '-shm'].forEach((s) => { try { fs.rmSync(dbp + s, { force: true }); } catch (_e) { /* none */ } });
    const zeros = Buffer.alloc(64, 0);
    fs.writeFileSync(dbp, zeros);
    const res = await backfill().runDeriveBackfill({
      roomDir: r.roomDir, approvedBy: 'test-36925', deriveFn: noEdges, roomsHome: r.iso.roomsHome,
    });
    check(res && res.readiness, 'result.readiness is absent');
    const moved = fs.readdirSync(path.join(r.roomDir, '.mindrian')).filter((n) => n.indexOf('room.db.unreadable-') === 0 && !/-(wal|shm)$/.test(n));
    eq(moved.length, 1, 'moved-aside files ' + JSON.stringify(moved));
    check(fs.readFileSync(path.join(r.roomDir, '.mindrian', moved[0])).equals(zeros), 'the moved-aside bytes are not the original 64 zero bytes');
    const id = identityMod().readRoomIdentity(r.roomDir, { roomsHome: r.iso.roomsHome });
    eq(id.state, 'ready', 'readRoomIdentity after the rebuild (reason ' + id.reason + ')');
  });

  // ---- N6 --------------------------------------------------------------------------------------------------------
  await arm('N6 a hand-built non-section folder (field-notes, two user notes, no .room-root) is still detected', async () => {
    const r = bornRoom('n6', 'born-n6');
    const dir = path.join(r.roomDir, 'field-notes');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'visit-1.md'), '# Visit 1\n\nWhat we saw on the first visit.\n', 'utf8');
    fs.writeFileSync(path.join(dir, 'visit-2.md'), '# Visit 2\n\nWhat we saw on the second visit.\n', 'utf8');
    const found = selfHeal().detectUnsentineledArtifactFolder(r.roomDir);
    const hit = found.find((f) => path.basename(f.folder) === 'field-notes');
    check(hit && hit.artifactCount === 2, 'field-notes not detected with 2 artifacts: ' + JSON.stringify(found.map((f) => [path.basename(f.folder), f.artifactCount])));
  });

  // ---- N7 --------------------------------------------------------------------------------------------------------
  await arm('N7 stopAfterReadiness returns the record on a ready and a never-ready room and leaves both trees unchanged', async () => {
    const nr = neverReady('n7a', 'never-ready-n7');
    const nrBefore = H.treeHash(nr.roomDir);
    const nrRes = await backfill().runDeriveBackfill({ roomDir: nr.roomDir, deriveFn: noEdges, stopAfterReadiness: true, roomsHome: nr.iso.roomsHome });
    check(nrRes && nrRes.readiness, 'never-ready: result.readiness is absent');
    eq(nrRes.readiness.state, 'not_ready', 'never-ready readiness.state');
    eq(H.treeHash(nr.roomDir), nrBefore, 'never-ready tree hash');

    const ok = bornRoom('n7b', 'born-n7');
    const rep = identityMod().repairRoomIdentity(ok.roomDir, { approvedBy: 'test-36925', roomsHome: ok.iso.roomsHome });
    check(rep.ok === true, 'owner repair of the ready room failed: ' + JSON.stringify(rep.readback || rep));
    const okBefore = H.treeHash(ok.roomDir);
    const okRes = await backfill().runDeriveBackfill({ roomDir: ok.roomDir, deriveFn: noEdges, stopAfterReadiness: true, roomsHome: ok.iso.roomsHome });
    check(okRes && okRes.readiness, 'ready: result.readiness is absent');
    eq(okRes.readiness.state, 'ready', 'ready readiness.state');
    eq(H.treeHash(ok.roomDir), okBefore, 'ready tree hash');
  });

  // ---- N8 --------------------------------------------------------------------------------------------------------
  await arm('N8 dash guard: no em or en dash in the files this plan owns', async () => {
    const files = [
      path.join(ROOT, 'tests', 'test-36925-never-ready.cjs'),
      path.join(ROOT, 'lib', 'core', 'graph-backfill.cjs'),
      path.join(ROOT, 'lib', 'core', 'graph-self-heal.cjs'),
    ];
    eq(H.dashGuard(files), [], 'files with a dash character');
  });

  console.log('\n' + (failed === 0 ? 'PASS' : 'FAIL') + ' test-36925-never-ready: ' + passed + ' passed, ' + failed + ' failed');
  if (failed) console.log('failed arms: ' + failedNames.map((n) => n.split(' ')[0]).join(', '));
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => { console.log('FATAL: ' + String((e && e.stack) || e)); process.exit(2); });
