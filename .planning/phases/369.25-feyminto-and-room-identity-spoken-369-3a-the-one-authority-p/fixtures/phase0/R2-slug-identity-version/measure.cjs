'use strict';
// R2: where the MINTO room: value comes from and what a born room's room.db holds, at HEAD, under an isolated HOME.
// Run from the repo root: node <this file> <outFile>
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ROOT = process.cwd();
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'p0-r2-'));
process.env.HOME = TMP;
process.env.USERPROFILE = TMP;
const ROOMS = path.join(TMP, 'rooms');
process.env.MINDRIAN_ROOMS_HOME = ROOMS;
fs.mkdirSync(ROOMS, { recursive: true });
delete process.env.CLAUDE_CODE_SESSION_ID;
delete process.env.MINDRIAN_ACTIVE_SESSION_ID;
const SLUG = 'p0-r2-room';
const DIR = path.join(ROOMS, SLUG);
const birth = require(path.join(ROOT, 'lib/core/navigation/room-birth.cjs')).birthRoom({
  slug: SLUG, roomDir: DIR, sessionId: 'p0-r2', ventureText: 'Phase 0 identity probe', jtbd: '',
  approvedBy: 'phase0', canonicalRole: 'founder', vname: 'P0 R2', vstage: 'Pre-Opportunity',
});
const nav = require(path.join(ROOT, 'lib/core/navigation.cjs'));
function readCopy(roomDir) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'p0-r2-copy-'));
  fs.mkdirSync(path.join(tmp, '.mindrian'));
  for (const sfx of ['', '-wal', '-shm']) {
    const s = path.join(roomDir, '.mindrian', 'room.db' + sfx);
    if (fs.existsSync(s)) fs.copyFileSync(s, path.join(tmp, '.mindrian', 'room.db' + sfx));
  }
  const db = nav.openRoomDbReadOnlyForCaller(tmp);
  try {
    return {
      identity: db.prepare('SELECT key, value FROM identity ORDER BY key').all(),
      room_nodes: db.prepare("SELECT id FROM nodes WHERE type='Room'").all().map((r) => r.id),
    };
  } finally { nav.closeRoomDbForCaller(db); fs.rmSync(tmp, { recursive: true, force: true }); }
}
const out = { head_birth_ok: birth && birth.ok, birth_keys: Object.keys(birth || {}) };
Object.assign(out, readCopy(DIR));
out.identity_keys = out.identity.map((r) => r.key);
out.identity_rows = out.identity.length;
out.identity_rows_naming_room = out.identity.filter((r) => String(r.key).includes(SLUG) || String(r.value).includes(SLUG)).length;
// room-scanner roomName for the room and for a renamed COPY (what a MINTO regeneration would write as room:)
const scan = require(path.join(ROOT, 'lib/vault/room-scanner.cjs'));
out.scanRoom_roomName = scan.scanRoom(DIR).roomName;
const COPY = path.join(ROOMS, 'p0-r2-renamed-copy');
fs.cpSync(DIR, COPY, { recursive: true });
out.scanRoom_roomName_of_renamed_copy = scan.scanRoom(COPY).roomName;
out.renamed_copy_room_db_identity_after_copy = readCopy(COPY).identity.map((r) => r.key);
fs.writeFileSync(process.argv[2], JSON.stringify(out, null, 2) + '\n');
fs.rmSync(TMP, { recursive: true, force: true });
