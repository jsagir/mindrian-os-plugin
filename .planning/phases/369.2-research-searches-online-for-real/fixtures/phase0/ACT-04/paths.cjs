// usage: node paths.cjs <path-id>   (env HOME + MINDRIAN_ROOMS_HOME isolated)
const fs = require('fs'), path = require('path'), cp = require('child_process');
const R = '/home/jsagi/dev/MindrianOS-Plugin';
const home = process.env.MINDRIAN_ROOMS_HOME; const id = process.argv[2];
let ret, roomDir;
if (id === 'registry-create') {
  roomDir = path.join(home, 'r1'); fs.mkdirSync(roomDir, { recursive: true });
  const r = cp.spawnSync('bash', [R + '/scripts/room-registry', 'create', 'r1', roomDir, 'R1', 'idea'], { encoding: 'utf8' });
  ret = { exit: r.status, stdout_head: (r.stdout||'').slice(0,60), stderr: (r.stderr||'').slice(0,300) };
} else if (id === 'scaffold-skeleton') {
  roomDir = path.join(home, 'r2'); fs.mkdirSync(roomDir, { recursive: true });
  const s = require(R + '/lib/core/room-skeleton-scaffold.cjs').scaffoldRoomSkeleton(roomDir, { blueprintFamily: 'venture' });
  ret = { ok: s.ok, errors: s.errors, sections_created: s.sections_created.length };
} else if (id === 'auto-create') {
  const a = require(R + '/lib/core/room-auto-create.cjs').autoCreatePlaceholderRoom(home, {});
  ret = a; roomDir = a.room_dir;
} else if (id === 'birth-room') {
  roomDir = path.join(home, 'r4');
  const nav = require(R + '/lib/core/navigation.cjs');
  ret = nav.birthRoom({ slug: 'r4', roomDir, approvedBy: 'phase0', ventureText: 'generic venture', jtbd: 'generic', blueprintFamily: 'venture', sessionId: 'phase0-sess' });
}
console.log('PATH=' + id + ' RETURNED=' + JSON.stringify(ret));
const dbCands = roomDir ? [path.join(roomDir, '.mindrian', 'room.db'), path.join(roomDir, 'room.db')] : [];
for (const p of dbCands) console.log('exists ' + p.replace(home, '$HOME') + ' = ' + fs.existsSync(p));
if (roomDir) {
  const nav = require(R + '/lib/core/navigation.cjs');
  const db = nav.openRoomDbForCaller(roomDir);
  if (!db) console.log('GOVERNED_WRITE=' + JSON.stringify({ ok: false, reason: 'no_room_db', room_dir: roomDir.replace(home, '$HOME') }) + '  (openRoomDbForCaller returned null; same branch as lib/mcp/tools/graph.cjs memory_event handler)');
  else { try { console.log('GOVERNED_WRITE=' + JSON.stringify(nav.logMemoryEvent(db, 'node_created', { label: 'phase0-probe' }))); } finally { nav.closeRoomDbForCaller(db); } }
  console.log('find .mindrian: ' + JSON.stringify(fs.existsSync(path.join(roomDir,'.mindrian')) ? fs.readdirSync(path.join(roomDir,'.mindrian')) : 'no .mindrian dir'));
}
