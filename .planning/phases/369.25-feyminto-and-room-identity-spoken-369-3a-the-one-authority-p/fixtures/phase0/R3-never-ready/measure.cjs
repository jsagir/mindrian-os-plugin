'use strict';
// R3: the never-ready room (scaffold only, eleven artifacts by plain fs) and the chain a session would run.
// Isolated HOME and rooms home under a mkdtemp dir; the Brain URL points at a closed local port so nothing leaves
// the machine. Run from the repo root: node <this file> <outDir>
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');
const ROOT = process.cwd();
const OUT = path.resolve(process.argv[2]);
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'p0-r3-'));
// The rooms home IS <tmp>/rooms, so the never-ready room sits in the rooms home but has no registry entry.
const ROOMS = path.join(TMP, 'rooms');
fs.mkdirSync(ROOMS, { recursive: true });
const ENV = Object.assign({}, process.env, {
  HOME: TMP, USERPROFILE: TMP, MINDRIAN_ROOMS_HOME: ROOMS, MINDRIAN_BRAIN_URL: 'http://127.0.0.1:9',
  CLAUDE_PLUGIN_ROOT: ROOT, TAVILY_API_KEY: '', NODE_NO_WARNINGS: '1',
});
delete ENV.CLAUDE_CODE_SESSION_ID; delete ENV.MINDRIAN_ACTIVE_SESSION_ID; delete ENV.CLAUDE_ROOM_DIR; delete ENV.CLAUDE_ACTIVE_ROOM;
process.env.HOME = TMP; process.env.USERPROFILE = TMP; process.env.MINDRIAN_ROOMS_HOME = ROOMS; process.env.MINDRIAN_BRAIN_URL = 'http://127.0.0.1:9';
delete process.env.CLAUDE_CODE_SESSION_ID; delete process.env.MINDRIAN_ACTIVE_SESSION_ID;

const { buildNeverReadyRoom } = require(path.join(ROOT, 'tests/fixtures/never-ready-room/build-fixture.cjs'));
const built = buildNeverReadyRoom(TMP, { slug: 'never-ready-fixture' });
const ROOM = built.roomDir;
const nav = require(path.join(ROOT, 'lib/core/navigation.cjs'));

function state(label) {
  const dbPath = path.join(ROOM, '.mindrian', 'room.db');
  const s = { label, room_db_exists: fs.existsSync(dbPath), registry_exists: fs.existsSync(path.join(ROOMS, '.rooms', 'registry.json')), identity_keys: null, identity_naming_room: null, room_nodes: null, node_count: null, edge_count: null, nodes_by_type: null, eleven_notes_indexed: null };
  if (s.room_db_exists) {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'p0-r3-copy-'));
    fs.mkdirSync(path.join(tmp, '.mindrian'));
    for (const sfx of ['', '-wal', '-shm']) { const f = dbPath + sfx; if (fs.existsSync(f)) fs.copyFileSync(f, path.join(tmp, '.mindrian', 'room.db' + sfx)); }
    const db = nav.openRoomDbReadOnlyForCaller(tmp);
    try {
      const rows = db.prepare('SELECT key, value FROM identity').all();
      s.identity_keys = rows.map((r) => r.key);
      s.identity_naming_room = rows.filter((r) => String(r.key).includes('never-ready-fixture') || String(r.value).includes('never-ready-fixture')).length;
      s.room_nodes = db.prepare("SELECT id FROM nodes WHERE type='Room'").all().map((r) => r.id);
      s.node_count = db.prepare('SELECT COUNT(*) n FROM nodes').get().n;
      s.edge_count = db.prepare('SELECT COUNT(*) n FROM edges').get().n;
      const cols = db.prepare('PRAGMA table_info(nodes)').all().map((c) => c.name);
      const probe = ['id', 'source_path', 'label', 'name', 'title'].filter((c) => cols.includes(c));
      s.eleven_notes_indexed = db.prepare('SELECT COUNT(*) n FROM nodes WHERE ' + probe.map((c) => c + " LIKE '%phase0-%-note%'").join(' OR ')).get().n;
      s.nodes_by_type = Object.fromEntries(db.prepare('SELECT type, COUNT(*) n FROM nodes GROUP BY type ORDER BY type').all().map((r) => [r.type, r.n]));
    } catch (e) { s.read_error = String(e.message).slice(0, 200); } finally { nav.closeRoomDbForCaller(db); fs.rmSync(tmp, { recursive: true, force: true }); }
  }
  return s;
}
const timeline = [state('0-built (scaffold + eleven plain-fs artifacts)')];
function save(name, text) { fs.writeFileSync(path.join(OUT, name), text.split(String.fromCharCode(0x2014)).join('-').split(String.fromCharCode(0x2013)).join('-')); }
function runStep(id, cmd, args, opts) {
  const r = cp.spawnSync(cmd, args, Object.assign({ cwd: ROOM, env: ENV, encoding: 'utf8', timeout: 90000 }, opts || {}));
  save(id + '.txt', `# ${id}\n# command: ${[cmd].concat(args).map((a) => a.replace(ROOT, '<repo>').replace(TMP, '<tmp>')).join(' ')}\n# cwd: <tmp>/rooms/never-ready-fixture\n# exit: ${r.status} signal: ${r.signal || 'none'}\n## stdout\n${String(r.stdout || '').replace(new RegExp(TMP, 'g'), '<tmp>')}\n## stderr\n${String(r.stderr || '').replace(new RegExp(TMP, 'g'), '<tmp>')}\n`);
  timeline.push(Object.assign(state(id), { exit: r.status }));
}
const payload = (tool, fp) => JSON.stringify({ tool_name: tool, tool_input: { file_path: fp }, cwd: ROOM });

// 1. the post-write hook (shell entry), then the cortex hook with the artifact and with a memory-file payload
runStep('step1-post-write', 'bash', [path.join(ROOT, 'scripts/post-write')], { input: payload('Write', built.artifacts[0]) });
runStep('step2a-memory-hook-artifact', 'node', [path.join(ROOT, 'scripts/memory-artifact-graph-hook.cjs')], { input: payload('Write', built.artifacts[0]), env: Object.assign({}, ENV, { ROOM_DIR: ROOM }) });
runStep('step2b-memory-hook-minto', 'node', [path.join(ROOT, 'scripts/memory-artifact-graph-hook.cjs')], { input: payload('Write', path.join(ROOM, 'problem-definition', 'MINTO.md')), env: Object.assign({}, ENV, { ROOM_DIR: ROOM }) });
// 3. the Stop hook
runStep('step3-on-stop', 'bash', [path.join(ROOT, 'scripts/on-stop')], { input: JSON.stringify({ cwd: ROOM, hook_event_name: 'Stop' }), env: Object.assign({}, ENV, { ROOM_DIR: ROOM }) });
// 4. the SessionStart hook and the derive drain
runStep('step4a-session-start', 'bash', [path.join(ROOT, 'scripts/session-start')], { input: JSON.stringify({ cwd: ROOM, hook_event_name: 'SessionStart', source: 'startup' }), env: Object.assign({}, ENV, { ROOM_DIR: ROOM }) });
runStep('step4b-derive-drain', 'node', [path.join(ROOT, 'scripts/gsd-graph-derive-drain.cjs')], { input: JSON.stringify({ cwd: ROOM, hook_event_name: 'SessionStart' }), env: Object.assign({}, ENV, { ROOM_DIR: ROOM }) });

(async () => {
  // 5. runDeriveBackfill with no approval, then with approval and an empty allow-list
  const heal = require(path.join(ROOT, 'lib/core/graph-self-heal.cjs'));
  const detected = heal.detectUnsentineledArtifactFolder(ROOM);
  save('step5-detector-output.json', JSON.stringify({ detector: 'detectUnsentineledArtifactFolder(roomDir)', count: detected.length, folders: detected.map((d) => Object.assign({}, d, { folder: path.basename(d.folder) })) }, null, 2) + '\n');
  const { runDeriveBackfill } = require(path.join(ROOT, 'lib/core/graph-backfill.cjs'));
  const scrub = (o) => JSON.parse(JSON.stringify(o).split(TMP).join('<tmp>'));
  const a = await runDeriveBackfill({ roomDir: ROOM });
  save('step5a-backfill-no-approval.json', JSON.stringify(scrub(a), null, 2) + '\n');
  timeline.push(state('step5a-backfill-no-approval'));
  const b = await runDeriveBackfill({ roomDir: ROOM, approvedBy: 'phase0', approveFolders: [] });
  save('step5b-backfill-approved-empty-allowlist.json', JSON.stringify(scrub(b), null, 2) + '\n');
  timeline.push(state('step5b-backfill-approved-empty-allowlist'));
  save('timeline.json', JSON.stringify(timeline, null, 2) + '\n');
  console.log(JSON.stringify(timeline.map((t) => ({ label: t.label, room_db: t.room_db_exists, by_type: t.nodes_by_type, notes_indexed: t.eleven_notes_indexed, registry: t.registry_exists, identity_keys: t.identity_keys && t.identity_keys.length, naming_room: t.identity_naming_room, room_nodes: t.room_nodes && t.room_nodes.length, nodes: t.node_count, edges: t.edge_count })), null, 1));
  // 6. which sub-process of the post-write hook creates room.db: each one alone on a fresh never-ready room
  const probes = [];
  const sub = [
    ['minto-debouncer enqueue', (r) => ['node', [path.join(ROOT, 'scripts/minto-debouncer.cjs'), 'enqueue', r, 'problem-definition', 'post-write:probe']]],
    ['stamp-artifact-write', (r) => ['node', [path.join(ROOT, 'scripts/stamp-artifact-write.cjs'), path.join(r, 'problem-definition')]]],
    ['recompile-room-references', (r) => ['node', [path.join(ROOT, 'scripts/recompile-room-references.cjs'), path.join(r, 'problem-definition')]]],
    ['scripts/mindrian-tools.cjs cascade', (r) => ['node', [path.join(ROOT, 'scripts/mindrian-tools.cjs'), 'cascade', r, path.join(r, 'problem-definition', 'phase0-problem-definition-note.md'), '--raw']]],
  ];
  for (const [name, mk] of sub) {
    const t2 = fs.mkdtempSync(path.join(os.tmpdir(), 'p0-r3p-'));
    const env2 = Object.assign({}, ENV, { HOME: t2, USERPROFILE: t2, MINDRIAN_ROOMS_HOME: path.join(t2, 'rooms') });
    const b2 = buildNeverReadyRoom(t2, { slug: 'never-ready-fixture' });
    const [c, a] = mk(b2.roomDir);
    const r = cp.spawnSync(c, a, { cwd: b2.roomDir, env: env2, encoding: 'utf8', timeout: 60000 });
    probes.push({ sub_process: name, exit: r.status, room_db_created: fs.existsSync(path.join(b2.roomDir, '.mindrian', 'room.db')) });
    fs.rmSync(t2, { recursive: true, force: true });
  }
  save('step6-room-db-creator-probes.json', JSON.stringify(probes, null, 2) + '\n');
  console.log(JSON.stringify(probes));
  fs.rmSync(TMP, { recursive: true, force: true });
})().catch((e) => { console.error('R3 FAILED', e); process.exit(1); });
