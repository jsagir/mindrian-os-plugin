#!/usr/bin/env node
'use strict';
/*
 * 369.25 plan 11 (RID-06, RFT-05, RFT-06, RFT-07, AN-01 second half): the MCP read and write adapters name the room
 * by the id room.db holds, and the chain anchor follows the identity slug.
 *
 * Brief failure tests 5 to 7 (BRIEF.md section 4):
 *   5  parent and child rooms resolve the actual target (the write from inside a child lands in the child, by id)
 *   6  status asked from outside the room dir shows the resolution or a labeled fallback, never invented emptiness
 *   7  a refused governed write has no silent filesystem substitute represented as a governed filing; after
 *      binding the same write lands in the identified room and names its id
 *
 * Arms:
 *   P1  resolveMcpWriteRoom from inside a born-wired child: child dir, room_id = the child's identity room_id;
 *       the child identity reads parent = parent slug, depth '1'
 *   P1b a child born under a parent whose identity depth is 'unknown' reads depth 'unknown' (never '1')
 *   P2  describeRoomBinding: bound / registry fallback (names the room and its id) / no room; the status_read
 *       payload room_binding carries the same fields
 *   P3  refused artifact_file writes nothing (tree hash, memory_event count); after room_bind the same call lands,
 *       names the room id, and the SOURCED_FROM anchor edge properties include room_id
 *   P4  a room whose folder is renamed after birth: a chain-state write anchors to room:<identity slug>
 *   P5  the census test and rar.12 stay green (child processes); dash guard
 *
 * Harness: in-process fake server (the tests/test-36925-an01.cjs seam), fixture rooms born by the isolated-home
 * helper (HOME and MINDRIAN_ROOMS_HOME under a mkdtemp directory). The process cwd is moved into the isolated home
 * for the whole run so no resolver floor can ever point at the repository.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const H = require('./helpers/isolated-home-36925.cjs');

let passed = 0;
let failed = 0;
function check(label, cond, detail) {
  if (cond) { passed += 1; console.log('PASS: ' + label); }
  else { failed += 1; console.log('FAIL: ' + label + (detail !== undefined ? ' :: ' + detail : '')); }
}

function makeFakeServer() {
  const tools = {};
  return {
    tools,
    tool(name, _d, _s, handler) { tools[name] = handler; },
    registerTool(name, _config, handler) { tools[name] = handler; },
    server: { getClientVersion() { return { name: 'claude-code', version: '2.1.0' }; }, getClientCapabilities() { return {}; } },
  };
}
function parse(res) {
  const text = res && res.content && res.content[0] && res.content[0].text;
  if (!text) return null;
  const marker = text.indexOf('\n\n## Suggested Next');
  try { return JSON.parse(marker === -1 ? text : text.slice(0, marker)); } catch (_e) { return null; }
}

const iso = H.mkIsolatedHome('rid-binding');
const SAVED = {};
for (const k of ['HOME', 'USERPROFILE', 'MINDRIAN_ROOMS_HOME', 'MINDRIAN_MCP_FIRST', 'CLAUDE_ACTIVE_ROOM', 'CLAUDE_CODE_SESSION_ID', 'MINDRIAN_ACTIVE_SESSION_ID']) SAVED[k] = process.env[k];
const SAVED_CWD = process.cwd();
function restoreEnv() {
  try { process.chdir(SAVED_CWD); } catch (_e) { /* best effort */ }
  for (const k of Object.keys(SAVED)) { if (SAVED[k] === undefined) delete process.env[k]; else process.env[k] = SAVED[k]; }
}

function birth(slug, extra) {
  const dir = path.join(iso.roomsHome, slug);
  return Object.assign({ roomDir: dir }, require(path.join(ROOT, 'lib', 'core', 'navigation', 'room-birth.cjs')).birthRoom(Object.assign({
    slug,
    roomDir: dir,
    sessionId: 'birth-' + slug,
    ventureText: 'Fixture venture ' + slug,
    approvedBy: 'test-36925',
    vname: slug,
    vstage: 'Pre-Opportunity',
  }, extra || {})));
}

function memoryEventCount(roomDir, spine) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), '36925-rid-binding-copy-'));
  try {
    fs.mkdirSync(path.join(tmp, '.mindrian'));
    ['', '-wal', '-shm'].forEach((suffix) => {
      const src = path.join(roomDir, '.mindrian', 'room.db' + suffix);
      if (fs.existsSync(src)) fs.copyFileSync(src, path.join(tmp, '.mindrian', 'room.db' + suffix));
    });
    const db = spine.openRoomDbReadOnlyForCaller(tmp);
    try { return db.prepare("SELECT COUNT(*) AS n FROM nodes WHERE type = 'memory_event'").get().n; }
    finally { spine.closeRoomDbForCaller(db); }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

async function main() {
  delete process.env.MINDRIAN_MCP_FIRST;
  delete process.env.CLAUDE_ACTIVE_ROOM;
  process.env.HOME = iso.home;
  process.env.USERPROFILE = iso.home;
  process.env.MINDRIAN_ROOMS_HOME = iso.roomsHome;
  delete process.env.CLAUDE_CODE_SESSION_ID;
  delete process.env.MINDRIAN_ACTIVE_SESSION_ID;
  process.chdir(iso.home); // outside every room, and never the repository

  const sessionRoom = require(path.join(ROOT, 'lib', 'mcp', 'session-room.cjs'));
  const identityMod = require(path.join(ROOT, 'lib', 'core', 'navigation', 'room-identity.cjs'));
  const spine = require(path.join(ROOT, 'lib', 'core', 'navigation', 'spine-events.cjs'));
  const navigation = require(path.join(ROOT, 'lib', 'core', 'navigation.cjs'));
  const chainExecutor = require(path.join(ROOT, 'lib', 'core', 'chain-executor.cjs'));
  const toolRouter = require(path.join(ROOT, 'lib', 'mcp', 'tool-router.cjs'));
  const views = require(path.join(ROOT, 'lib', 'mcp', 'tools', 'views.cjs'));
  const statusMod = require(path.join(ROOT, 'lib', 'mcp', 'tools', 'status.cjs'));

  const ghostFallback = path.join(iso.home, 'no-such-boot-room');
  const ctx = { fallbackRoomDir: ghostFallback, surface: 'cli' };

  // ---- fixture: a parent and a born-wired child ---------------------------------------------------------------
  const parent = birth('rid-parent');
  check('fixture parent born', parent && parent.ok === true, JSON.stringify(parent));
  const child = birth('rid-child', {
    parent: 'rid-parent', parentRoomDir: parent.roomDir, bornWired: true,
    birthGate: { approved: true, canonical_verb: 'Approve' },
  });
  check('fixture born-wired child born', child && child.ok === true && child.born_wired === true, JSON.stringify(child));
  const parentId = identityMod.readRoomIdentity(parent.roomDir);
  const childId = identityMod.readRoomIdentity(child.roomDir);
  check('fixture identities are ready and distinct', parentId.state === 'ready' && childId.state === 'ready' && parentId.room_id !== childId.room_id,
    JSON.stringify({ p: parentId.state, c: childId.state }));

  // ---- P1 -----------------------------------------------------------------------------------------------------
  process.chdir(child.roomDir);
  let w1;
  try { w1 = sessionRoom.resolveMcpWriteRoom({ sessionId: 'p1-sess', ctx: ctx, walkUp: true }); }
  finally { process.chdir(iso.home); }
  check('P1 the write from inside the child resolves to the child dir (room-root)', w1 && w1.ok === true && fs.realpathSync(w1.dir) === fs.realpathSync(child.roomDir) && w1.source === 'room-root', JSON.stringify(w1));
  check('P1 the resolution names the child room_id read from room.db', !!w1 && w1.room_id === childId.room_id && w1.room_id !== parentId.room_id, JSON.stringify(w1 && { room_id: w1.room_id, want: childId.room_id }));
  check('P1 the resolution carries room_identity state ready', !!w1 && !!w1.room_identity && w1.room_identity.state === 'ready', JSON.stringify(w1 && w1.room_identity));
  check('P1 the child identity records parent = the parent slug and depth 1',
    childId.state === 'ready' && childId.parent === 'rid-parent' && String(childId.depth) === '1', JSON.stringify(childId));

  // ---- P1b ----------------------------------------------------------------------------------------------------
  const parent2 = birth('rid-parent-unk');
  check('P1b fixture parent born', parent2 && parent2.ok === true);
  const pdb = navigation.openRoomDbForCaller(parent2.roomDir);
  try { pdb.prepare("UPDATE identity SET value = 'unknown' WHERE key = 'room.depth'").run(); }
  finally { navigation.closeRoomDbForCaller(pdb); }
  const parent2Id = identityMod.readRoomIdentity(parent2.roomDir);
  check('P1b the parent identity depth reads unknown', parent2Id.state === 'ready' && String(parent2Id.depth) === 'unknown', JSON.stringify(parent2Id));
  const child2 = birth('rid-child-unk', {
    parent: 'rid-parent-unk', parentRoomDir: parent2.roomDir, bornWired: true,
    birthGate: { approved: true, canonical_verb: 'Approve' },
  });
  const child2Id = identityMod.readRoomIdentity(child2.roomDir);
  check('P1b a child under an unknown-depth parent reads depth unknown, never 1', child2.ok === true && child2Id.state === 'ready' && String(child2Id.depth) === 'unknown', JSON.stringify(child2Id));

  // ---- shared server for P2, P3 -------------------------------------------------------------------------------
  const server = makeFakeServer();
  toolRouter.registerRouterTools(server, ghostFallback, ROOT, { compact: '' }, 'cli');
  views.register(server, ctx);
  statusMod.register(server, ctx);
  check('room_bind, artifact_file, status_read registered', ['room_bind', 'artifact_file', 'status_read'].every((n) => typeof server.tools[n] === 'function'));

  // ---- P2 -----------------------------------------------------------------------------------------------------
  // the registry active room is the fallback an unbound session sees
  const unbound = sessionRoom.resolveMcpSessionRoom({ sessionId: 'p2-unbound', ctx: ctx });
  const fbIdentity = unbound.dir ? identityMod.readRoomIdentity(unbound.dir) : null;
  check('P2 setup: an unbound session resolves through the registry fallback', unbound.source === 'reg.active' && !!fbIdentity && fbIdentity.state === 'ready', JSON.stringify({ unbound, fb: fbIdentity && fbIdentity.state }));
  const bUnbound = sessionRoom.describeRoomBinding(unbound);
  check('P2 unbound: bound false, registry_fallback true', bUnbound.bound === false && bUnbound.registry_fallback === true, JSON.stringify(bUnbound));
  check('P2 unbound: room_id is the fallback room id', !!fbIdentity && bUnbound.room_id === fbIdentity.room_id, JSON.stringify({ got: bUnbound.room_id, want: fbIdentity && fbIdentity.room_id }));
  check('P2 unbound: identity state ready is reported', !!bUnbound.identity && bUnbound.identity.state === 'ready', JSON.stringify(bUnbound.identity));
  check('P2 unbound: the note names the fallback room slug and its id',
    typeof bUnbound.note === 'string' && !!fbIdentity && bUnbound.note.indexOf(fbIdentity.slug) !== -1 && bUnbound.note.indexOf(fbIdentity.room_id) !== -1, bUnbound.note);

  const bound = parse(await server.tools.room_bind({ room: 'rid-child' }, { sessionId: 'p2-bound' }));
  check('P2 setup: room_bind binds the session to the child (effective)', !!bound && bound.ok === true && bound.effective === true, JSON.stringify(bound));
  const boundRes = sessionRoom.resolveMcpSessionRoom({ sessionId: 'p2-bound', ctx: ctx });
  const bBound = sessionRoom.describeRoomBinding(boundRes);
  check('P2 bound: bound true, source session.primary, room_id the child id', bBound.bound === true && bBound.source === 'session.primary' && bBound.room_id === childId.room_id, JSON.stringify(bBound));

  const noneRes = sessionRoom.describeRoomBinding({ dir: null, slug: null, source: 'none' });
  check('P2 no room: source none, room_id null, note says no room', noneRes.source === 'none' && noneRes.room_id === null && typeof noneRes.note === 'string' && /no room/i.test(noneRes.note), JSON.stringify(noneRes));

  const stBound = parse(await server.tools.status_read({}, { sessionId: 'p2-bound' }));
  const rbB = stBound && stBound.segments && stBound.segments.room_binding;
  check('P2 status_read (bound, asked from outside the room dir) carries bound true and the child room_id', !!rbB && rbB.bound === true && rbB.room_id === childId.room_id, JSON.stringify(rbB));
  const stUn = parse(await server.tools.status_read({}, { sessionId: 'p2-unbound' }));
  const rbU = stUn && stUn.segments && stUn.segments.room_binding;
  check('P2 status_read (unbound) carries bound false, the fallback room_id and a note naming it',
    !!rbU && rbU.bound === false && !!fbIdentity && rbU.room_id === fbIdentity.room_id && typeof rbU.note === 'string' && rbU.note.indexOf(fbIdentity.slug) !== -1, JSON.stringify(rbU));

  // ---- P3 -----------------------------------------------------------------------------------------------------
  // The refused write targets nothing: the unbound session resolves to the registry fallback, which is refused.
  const targetDir = unbound.dir;
  const beforeHash = H.treeHash(targetDir);
  const beforeEvents = memoryEventCount(targetDir, spine);
  const beforeIso = H.treeHash(iso.roomsHome);
  const content = '---\ntitle: p3\n---\n\nA governed filing.\n';
  const refused = parse(await server.tools.artifact_file({ section: 'problem-definition', filename: 'p3-note', content }, { sessionId: 'p3-sess' }));
  check('P3 an unbound artifact_file is refused with no_bound_room', !!refused && refused.ok === false && refused.reason === 'no_bound_room', JSON.stringify(refused));
  check('P3 the refusal wrote nothing: the target room tree hash is unchanged', H.treeHash(targetDir) === beforeHash);
  check('P3 the refusal wrote nothing anywhere under the rooms home', H.treeHash(iso.roomsHome) === beforeIso);
  check('P3 the refusal filed nothing: memory_event count unchanged (' + beforeEvents + ')', memoryEventCount(targetDir, spine) === beforeEvents);
  check('P3 no filed file exists in the target section', !fs.existsSync(path.join(targetDir, 'problem-definition', 'p3-note.md')) && !fs.existsSync(path.join(targetDir, 'problem-definition', 'p3-note')));

  const bind3 = parse(await server.tools.room_bind({ room: path.basename(targetDir) }, { sessionId: 'p3-sess' }));
  check('P3 room_bind binds p3-sess to the room that would have been written', !!bind3 && bind3.ok === true && bind3.effective === true, JSON.stringify(bind3));
  const filed = parse(await server.tools.artifact_file({ section: 'problem-definition', filename: 'p3-note', content }, { sessionId: 'p3-sess' }));
  check('P3 after binding the same call lands (ok true)', !!filed && filed.ok === true, JSON.stringify(filed));
  check('P3 the result names the room id of the identified room', !!filed && filed.room_id === fbIdentity.room_id, JSON.stringify(filed && { room_id: filed.room_id, want: fbIdentity.room_id }));
  check('P3 the result carries room_identity state ready', !!filed && !!filed.room_identity && filed.room_identity.state === 'ready', JSON.stringify(filed && filed.room_identity));
  check('P3 the file exists in that room section', !!filed && fs.existsSync(path.join(targetDir, filed.file_path || 'missing')), JSON.stringify(filed && filed.file_path));
  check('P3 the anchor edge was written (ok true)', !!filed && !!filed.anchor_edge && filed.anchor_edge.ok === true, JSON.stringify(filed && filed.anchor_edge));
  const tdb = navigation.openRoomDbForCaller(targetDir);
  try {
    const nodeId = navigation.REASONING_NODE_ID('claim:artifact', filed && filed.artifact_id);
    const edge = tdb.prepare("SELECT properties FROM edges WHERE source = ? AND type = 'SOURCED_FROM'").get(nodeId);
    let props = {};
    try { props = JSON.parse((edge && edge.properties) || '{}'); } catch (_e) { props = {}; }
    check('P3 the SOURCED_FROM anchor edge properties include room_id', !!edge && props.room_id === fbIdentity.room_id, JSON.stringify(edge));
  } finally {
    navigation.closeRoomDbForCaller(tdb);
  }

  // ---- P4 -----------------------------------------------------------------------------------------------------
  const ctrl = birth('rid-control');
  const stepInput = (roomDir, runId) => ({
    roomDir, runId, stepIndex: 0, step: { step: 1, command: '/mos:a' },
    chainOutput: { marker: 'p4', executed: true, tier: 'executable' }, quality: 'high',
  });
  const ctrlWrite = chainExecutor.writeApprovedStepRecord(stepInput(ctrl.roomDir, 'run:p4:control'));
  check('P4 control: an unrenamed room anchors a chain-state record', !!ctrlWrite && typeof ctrlWrite.node_id === 'string', JSON.stringify(ctrlWrite));

  const ren = birth('rid-rename');
  const renamedDir = path.join(iso.roomsHome, 'rid-renamed-folder');
  fs.renameSync(ren.roomDir, renamedDir);
  const afterRename = identityMod.readRoomIdentity(renamedDir);
  check('P4 setup: the renamed room reads not_ready but still names its original slug', afterRename.state === 'not_ready' && !!afterRename.stored && afterRename.stored['room.slug'] === 'rid-rename', JSON.stringify(afterRename));
  const renWrite = chainExecutor.writeApprovedStepRecord(stepInput(renamedDir, 'run:p4:renamed'));
  check('P4 a chain-state write in the renamed room still anchors (not null)', !!renWrite && typeof renWrite.node_id === 'string', JSON.stringify(renWrite));
  if (renWrite && renWrite.node_id) {
    const rdb = navigation.openRoomDbForCaller(renamedDir);
    try {
      const edge = rdb.prepare("SELECT target FROM edges WHERE source = ? AND type = 'SOURCED_FROM'").get(renWrite.node_id);
      check('P4 the anchor is room:<original identity slug>, not the new folder name', !!edge && edge.target === 'room:rid-rename', JSON.stringify(edge));
    } finally {
      navigation.closeRoomDbForCaller(rdb);
    }
  } else {
    check('P4 the anchor is room:<original identity slug>, not the new folder name', false, 'no record was written');
  }

  // ---- P5 -----------------------------------------------------------------------------------------------------
  for (const t of ['test-248-resolver-census.cjs', 'test-resolve-active-room-canonical.cjs']) {
    const r = spawnSync(process.execPath, [path.join(ROOT, 'tests', t)], { encoding: 'utf8', timeout: 240000, env: iso.env, cwd: ROOT });
    check('P5 ' + t + ' stays green (exit 0)', r.status === 0, 'exit ' + r.status + ' ' + String(r.stdout || '').slice(-300));
  }
  const guarded = [
    __filename,
    path.join(ROOT, 'lib', 'mcp', 'session-room.cjs'),
    path.join(ROOT, 'lib', 'core', 'chain-executor.cjs'),
    path.join(ROOT, 'lib', 'mcp', 'tools', 'views.cjs'),
  ];
  const dashHits = H.dashGuard(guarded);
  check('P5 dash guard: no em dash or en dash in the test or the three edited files', dashHits.length === 0, dashHits.join(','));
}

main().then(() => {
  restoreEnv();
  iso.cleanup();
  console.log('');
  console.log('PASS=' + passed + ' FAIL=' + failed);
  process.exit(failed === 0 ? 0 : 1);
}).catch((e) => {
  restoreEnv();
  try { iso.cleanup(); } catch (_e) { /* best effort */ }
  console.log('FAIL: test crashed :: ' + String((e && e.stack) || e));
  process.exit(1);
});
