#!/usr/bin/env node
'use strict';
/*
 * 369.25 plan 13 (HEAL-02, RFT-01, FCLOSE-07): readiness per operation, failure test 1 with its remediation, and
 * the heal net's two callers (before the first governed write, and at session start).
 *
 * Brief failure test 1: "Database missing, corrupt, or not writable: no ready-to-write result. A typed reason names
 * the failed requirement." The positive requirement (brief section 4): recovery, not only refusal.
 *
 * Arms:
 *   R1   born room, room.db removed: a governed write is refused room_not_ready / room_db_missing with the failed
 *        requirement in plain words, the recover_room_record remediation and a recovery card; the room tree is
 *        unchanged; a defer changes nothing; another session cannot answer the card; approve rebuilds the record
 *        (chain_result.recovered) and the same write then lands and names the room id
 *   R2   room.db overwritten with 64 zero bytes: room_db_unreadable; approve moves the 64 bytes aside and the retry lands
 *   R3   room.db read-only inside a read-only folder: room_db_not_writable, restore_write_permission, NO card; after
 *        the permissions are restored (by the test, standing in for the person) the same write lands (skipped as root)
 *   R4   legacy room (the seven room.* keys deleted): the write lands with room_identity not_ready identity_missing
 *        and one recovery card per session; approving it makes the next filing's room_identity ready
 *   R5   scripts/session-start inside a never-ready room prints the FeyMinto not-ready line naming the requirement
 *        and the recovery; the net call it makes writes nothing; inside a ready room the line is absent
 *   R6   the recovery card is named by its job: fixed header, no grant, no id, offers approve (recover) and defer
 *   R7   readinessFor: the per-operation table, requirement text from REQUIREMENT_LINES
 *   dash guard over the test and the two new modules
 *
 * Harness: in-process fake server (the tests/test-36925-rid-binding.cjs seam), fixture rooms born under an isolated
 * HOME and rooms home (tests/helpers/isolated-home-36925.cjs), the never-ready room from
 * tests/fixtures/never-ready-room/build-fixture.cjs. The process cwd is moved into the isolated home for the run.
 */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const H = require('./helpers/isolated-home-36925.cjs');
const { buildNeverReadyRoom } = require('./fixtures/never-ready-room/build-fixture.cjs');

let passed = 0;
let failed = 0;
let skipped = 0;
function check(label, cond, detail) {
  if (cond) { passed += 1; console.log('PASS: ' + label); }
  else { failed += 1; console.log('FAIL: ' + label + (detail !== undefined ? ' :: ' + detail : '')); }
}
function skip(label, why) { skipped += 1; console.log('SKIP: ' + label + ' :: ' + why); }
function safe(fn, fallback) { try { return fn(); } catch (_e) { return fallback; } }

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
function short(v) { return JSON.stringify(v, null, 0) && JSON.stringify(v).slice(0, 400); }

const iso = H.mkIsolatedHome('readiness-gate');
const SAVED = {};
for (const k of ['HOME', 'USERPROFILE', 'MINDRIAN_ROOMS_HOME', 'MINDRIAN_MCP_FIRST', 'CLAUDE_ACTIVE_ROOM', 'CLAUDE_CODE_SESSION_ID', 'MINDRIAN_ACTIVE_SESSION_ID']) SAVED[k] = process.env[k];
const SAVED_CWD = process.cwd();
function restoreEnv() {
  try { process.chdir(SAVED_CWD); } catch (_e) { /* best effort */ }
  for (const k of Object.keys(SAVED)) { if (SAVED[k] === undefined) delete process.env[k]; else process.env[k] = SAVED[k]; }
}

const dbFile = (roomDir) => path.join(roomDir, '.mindrian', 'room.db');
function removeDb(roomDir) {
  ['', '-wal', '-shm'].forEach((s) => { try { fs.rmSync(dbFile(roomDir) + s, { force: true }); } catch (_e) { /* ignore */ } });
}
function zeroDb(roomDir) {
  removeDb(roomDir);
  fs.writeFileSync(dbFile(roomDir), Buffer.alloc(64));
}
const isRoot = typeof process.getuid === 'function' && process.getuid() === 0;

async function main() {
  delete process.env.MINDRIAN_MCP_FIRST;
  delete process.env.CLAUDE_ACTIVE_ROOM;
  process.env.HOME = iso.home;
  process.env.USERPROFILE = iso.home;
  process.env.MINDRIAN_ROOMS_HOME = iso.roomsHome;
  delete process.env.CLAUDE_CODE_SESSION_ID;
  delete process.env.MINDRIAN_ACTIVE_SESSION_ID;
  process.chdir(iso.home);

  const identityMod = require(path.join(ROOT, 'lib', 'core', 'navigation', 'room-identity.cjs'));
  const navigation = require(path.join(ROOT, 'lib', 'core', 'navigation.cjs'));
  const toolRouter = require(path.join(ROOT, 'lib', 'mcp', 'tool-router.cjs'));
  const views = require(path.join(ROOT, 'lib', 'mcp', 'tools', 'views.cjs'));
  const gateTools = require(path.join(ROOT, 'lib', 'mcp', 'tools', 'gate.cjs'));

  const ghostFallback = path.join(iso.home, 'no-such-boot-room');
  const ctx = { fallbackRoomDir: ghostFallback, surface: 'cli' };
  const server = makeFakeServer();
  toolRouter.registerRouterTools(server, ghostFallback, ROOT, { compact: '' }, 'cli');
  views.register(server, ctx);
  gateTools.register(server, ctx);
  check('room_bind, artifact_file, gate_answer registered', ['room_bind', 'artifact_file', 'gate_answer'].every((n) => typeof server.tools[n] === 'function'));

  const birth = (slug) => {
    const b = H.birthFixtureRoom({ iso, slug });
    check('fixture room ' + slug + ' born ready', b && b.ok === true && identityMod.readRoomIdentity(b.roomDir).state === 'ready', short(b));
    return b;
  };
  const bind = async (session, slug) => {
    const r = parse(await server.tools.room_bind({ room: slug }, { sessionId: session }));
    check('room_bind ' + slug + ' for ' + session + ' is effective', !!r && r.ok === true && r.effective === true, short(r));
  };
  let seq = 0;
  const file = async (session, tag) => {
    seq += 1;
    return parse(await server.tools.artifact_file({
      section: 'problem-definition', filename: 'rg-' + tag + '-' + seq, content: '---\ntitle: ' + tag + '\n---\n\nA governed filing (' + tag + ').\n',
    }, { sessionId: session }));
  };
  const answer = async (session, gateId, verdict) => parse(await server.tools.gate_answer({
    gate_id: gateId, chosen: [verdict === 'approve' ? 'recover' : 'defer'], verdict,
  }, { sessionId: session }));

  // ---- R1: room.db missing -------------------------------------------------------------------------------------
  const m = birth('rg-missing');
  await bind('s-missing', 'rg-missing');
  const idBefore = identityMod.readRoomIdentity(m.roomDir);
  removeDb(m.roomDir);
  const hashMissing = H.treeHash(m.roomDir);
  const r1 = await file('s-missing', 'r1');
  check('R1 a governed write with no room.db is refused room_not_ready', !!r1 && r1.ok === false && r1.reason === 'room_not_ready', short(r1));
  check('R1 the refusal carries not_ready_reason room_db_missing', !!r1 && r1.not_ready_reason === 'room_db_missing', short(r1));
  check('R1 the refusal names the failed requirement in plain words', !!r1 && typeof r1.requirement === 'string' && /room\.db is missing/.test(r1.requirement), short(r1));
  check('R1 the remediation is recover_room_record and a recovery gate id is offered', !!r1 && r1.remediation === 'recover_room_record' && typeof r1.recovery_gate_id === 'string' && r1.recovery_gate_id.length > 0, short(r1));
  check('R1 the message says nothing was written', !!r1 && typeof r1.message === 'string' && /Nothing was written/.test(r1.message), short(r1));
  check('R1 the refusal wrote nothing: tree hash unchanged and room.db still absent', H.treeHash(m.roomDir) === hashMissing && !fs.existsSync(dbFile(m.roomDir)));

  // R6 on this refusal's card
  const card = r1 && r1.recovery_card;
  const gateMod = safe(() => require(path.join(ROOT, 'lib', 'mcp', 'room-readiness-gate.cjs')), null);
  const header = (card && card.header) || '';
  const optIds = (card && Array.isArray(card.options)) ? card.options.map((o) => o.id) : [];
  const optText = (card && Array.isArray(card.options)) ? card.options.map((o) => o.label).join(' | ') : '';
  check('R6 the card header is RECOVERY_CARD_HEADER', !!gateMod && header === gateMod.RECOVERY_CARD_HEADER && header === "Recover this room's record so work can continue", header);
  check('R6 the card says neither grant nor an id', !!card && !/grant/i.test(header + ' ' + optText) && !/gate-[0-9a-f]{8}/i.test(header + ' ' + optText) && !/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}/i.test(header + ' ' + optText), header + ' | ' + optText);
  check('R6 the card offers recover (approve) and defer', optIds.indexOf('recover') !== -1 && optIds.indexOf('defer') !== -1, short(card));

  const gateA = r1 && r1.recovery_gate_id;
  const dfr = gateA ? await answer('s-missing', gateA, 'defer') : null;
  check('R1 a defer answers ok and executes nothing', !!dfr && dfr.ok === true && !!dfr.chain_result && dfr.chain_result.executed === false, short(dfr));
  check('R1 after the defer the room is unchanged', H.treeHash(m.roomDir) === hashMissing && !fs.existsSync(dbFile(m.roomDir)));
  const r1b = await file('s-missing', 'r1b');
  check('R1 after a defer the next write is refused again with a fresh card', !!r1b && r1b.reason === 'room_not_ready' && typeof r1b.recovery_gate_id === 'string' && r1b.recovery_gate_id !== gateA, short(r1b));
  const gateB = r1b && r1b.recovery_gate_id;
  const stranger = gateB ? await answer('s-other', gateB, 'approve') : null;
  check('R1 another session cannot answer the card (session_mismatch)', !!stranger && stranger.ok === false && stranger.reason === 'session_mismatch', short(stranger));
  check('R1 the stranger changed nothing', !fs.existsSync(dbFile(m.roomDir)));
  const ap = gateB ? await answer('s-missing', gateB, 'approve') : null;
  check('R1 approving the card rebuilds the record (chain_result.recovered true)', !!ap && !!ap.chain_result && ap.chain_result.recovered === true, short(ap));
  const idNow = identityMod.readRoomIdentity(m.roomDir);
  check('R1 the room reads ready after the recovery', idNow.state === 'ready' && idNow.ok === true, short(idNow));
  check('R1 the recovery kept the room id the projections held', idNow.state === 'ready' && !!idBefore && idBefore.room_id === idNow.room_id, short({ before: idBefore && idBefore.room_id, now: idNow.room_id }));
  const r1c = await file('s-missing', 'r1c');
  check('R1 the same write now lands and names the room id read from room.db', !!r1c && r1c.ok === true && r1c.room_id === idNow.room_id, short(r1c));

  // ---- R2: room.db corrupt -------------------------------------------------------------------------------------
  const c = birth('rg-corrupt');
  await bind('s-corrupt', 'rg-corrupt');
  zeroDb(c.roomDir);
  const hashCorrupt = H.treeHash(c.roomDir);
  const r2 = await file('s-corrupt', 'r2');
  check('R2 a governed write with a damaged room.db is refused room_not_ready / room_db_unreadable',
    !!r2 && r2.ok === false && r2.reason === 'room_not_ready' && r2.not_ready_reason === 'room_db_unreadable', short(r2));
  check('R2 the requirement says the file cannot be opened', !!r2 && typeof r2.requirement === 'string' && /cannot be opened/.test(r2.requirement), short(r2));
  check('R2 the refusal wrote nothing: tree hash unchanged', H.treeHash(c.roomDir) === hashCorrupt);
  const ap2 = r2 && r2.recovery_gate_id ? await answer('s-corrupt', r2.recovery_gate_id, 'approve') : null;
  check('R2 approving the card recovers the room', !!ap2 && !!ap2.chain_result && ap2.chain_result.recovered === true, short(ap2));
  const aside = safe(() => fs.readdirSync(path.join(c.roomDir, '.mindrian')).filter((f) => /^room\.db\.unreadable-/.test(f)), []);
  check('R2 the damaged file was moved aside with its 64 bytes, never deleted', aside.length === 1 && fs.statSync(path.join(c.roomDir, '.mindrian', aside[0])).size === 64, short(aside));
  const r2b = await file('s-corrupt', 'r2b');
  check('R2 the retry lands', !!r2b && r2b.ok === true, short(r2b));

  // ---- R3: room.db not writable --------------------------------------------------------------------------------
  const w = birth('rg-readonly');
  await bind('s-readonly', 'rg-readonly');
  if (isRoot) {
    skip('R3 not-writable arms', 'running as uid 0, where file modes do not refuse a write');
  } else {
    const mind = path.join(w.roomDir, '.mindrian');
    try {
      fs.chmodSync(dbFile(w.roomDir), 0o444);
      fs.chmodSync(mind, 0o555);
      const hashRo = H.treeHash(w.roomDir);
      const r3 = await file('s-readonly', 'r3');
      check('R3 a governed write to a read-only room.db is refused room_not_ready / room_db_not_writable',
        !!r3 && r3.ok === false && r3.reason === 'room_not_ready' && r3.not_ready_reason === 'room_db_not_writable', short(r3));
      check('R3 the remediation is restore_write_permission and there is no card', !!r3 && r3.remediation === 'restore_write_permission' && r3.recovery_gate_id === undefined && r3.recovery_card === undefined, short(r3));
      check('R3 the requirement names the permissions', !!r3 && typeof r3.requirement === 'string' && /cannot be written/.test(r3.requirement), short(r3));
      check('R3 the refusal wrote nothing: tree hash unchanged', H.treeHash(w.roomDir) === hashRo);
    } finally {
      try { fs.chmodSync(mind, 0o755); } catch (_e) { /* best effort */ }
      try { fs.chmodSync(dbFile(w.roomDir), 0o644); } catch (_e) { /* best effort */ }
    }
    const r3b = await file('s-readonly', 'r3b');
    check('R3 once a person restores the permissions the same write lands', !!r3b && r3b.ok === true, short(r3b));
  }

  // ---- R4: legacy room, identity missing -----------------------------------------------------------------------
  const l = birth('rg-legacy');
  await bind('s-legacy', 'rg-legacy');
  const ldb = navigation.openRoomDbForCaller(l.roomDir);
  try { ldb.prepare("DELETE FROM identity WHERE key LIKE 'room.%'").run(); } finally { navigation.closeRoomDbForCaller(ldb); }
  check('R4 setup: the legacy room reads identity_missing', identityMod.readRoomIdentity(l.roomDir).reason === 'identity_missing');
  const r4 = await file('s-legacy', 'r4');
  check('R4 a legacy room keeps working: the write lands', !!r4 && r4.ok === true, short(r4));
  check('R4 the result shows the gap: room_identity not_ready identity_missing with its requirement',
    !!r4 && !!r4.room_identity && r4.room_identity.state === 'not_ready' && r4.room_identity.reason === 'identity_missing' && /identity is not in room\.db/.test(r4.room_identity.requirement || ''), short(r4 && r4.room_identity));
  const gate4 = r4 && r4.room_identity && r4.room_identity.recovery_gate_id;
  check('R4 the result carries a recovery gate id', typeof gate4 === 'string' && gate4.length > 0, short(r4 && r4.room_identity));
  const r4b = await file('s-legacy', 'r4b');
  check('R4 a second filing in the same session carries the same card (one per session)', !!r4b && !!r4b.room_identity && r4b.room_identity.recovery_gate_id === gate4, short(r4b && r4b.room_identity));
  const ap4 = gate4 ? await answer('s-legacy', gate4, 'approve') : null;
  check('R4 approving the card recovers the record', !!ap4 && !!ap4.chain_result && ap4.chain_result.recovered === true, short(ap4));
  const r4c = await file('s-legacy', 'r4c');
  check('R4 the next filing reports room_identity ready', !!r4c && r4c.ok === true && !!r4c.room_identity && r4c.room_identity.state === 'ready', short(r4c && r4c.room_identity));

  // ---- R5: session start ---------------------------------------------------------------------------------------
  // session-start resolves its room through the machine registry first, so this arm gets its own isolated home
  // (a fresh registry): the never-ready room is found by its folder name, the ready room by its own registry entry
  const iso2 = H.mkIsolatedHome('readiness-gate-ss');
  const nr = buildNeverReadyRoom(iso2.home, { slug: 'rg-never-ready' });
  const backfill = require(path.join(ROOT, 'lib', 'core', 'graph-backfill.cjs'));
  const hashNr = H.treeHash(nr.roomDir);
  const netRes = await Promise.resolve(backfill.runDeriveBackfill({ roomDir: nr.roomDir, stopAfterReadiness: true }));
  check('R5 the net call the hook makes (stopAfterReadiness) reports not_ready and writes nothing',
    !!netRes && !!netRes.readiness && netRes.readiness.state === 'not_ready' && H.treeHash(nr.roomDir) === hashNr, short(netRes && netRes.readiness));
  const ss = spawnSync('bash', [path.join(ROOT, 'scripts', 'session-start')], { cwd: nr.roomDir, env: iso2.env, encoding: 'utf8', timeout: 180000 });
  const out = String(ss.stdout || '');
  check('R5 session-start exits 0 in the never-ready room', ss.status === 0, 'exit ' + ss.status + ' ' + String(ss.stderr || '').slice(-200));
  check('R5 session-start prints the FeyMinto not-ready line', out.indexOf('FeyMinto: this room is not ready') !== -1, out.slice(0, 200));
  check('R5 the line names the failed requirement and the recovery', /room\.db is missing/.test(out) && /recovery/.test(out) && /\/mos:graph --derive/.test(out));
  const readyRoom = H.birthFixtureRoom({ iso: iso2, slug: 'rg-ready-room' });
  const ss2 = spawnSync('bash', [path.join(ROOT, 'scripts', 'session-start')], { cwd: readyRoom.roomDir, env: iso2.env, encoding: 'utf8', timeout: 180000 });
  check('R5 inside a ready room session-start runs and the line is absent', ss2.status === 0 && String(ss2.stdout || '').length > 0 && String(ss2.stdout).indexOf('FeyMinto: this room is not ready') === -1, 'exit ' + ss2.status);
  // birthFixtureRoom pointed the in-process env at iso2; put it back for the arms below
  process.env.HOME = iso.home;
  process.env.USERPROFILE = iso.home;
  process.env.MINDRIAN_ROOMS_HOME = iso.roomsHome;
  iso2.cleanup();

  // ---- R7: readinessFor per operation --------------------------------------------------------------------------
  const rd = safe(() => require(path.join(ROOT, 'lib', 'core', 'room-readiness.cjs')), null);
  check('R7 room-readiness exports readinessFor, OPERATIONS, REQUIREMENT_LINES, BLOCKING',
    !!rd && typeof rd.readinessFor === 'function' && Array.isArray(rd.OPERATIONS) && !!rd.REQUIREMENT_LINES && !!rd.BLOCKING, rd ? Object.keys(rd).join(',') : 'module absent');
  if (rd) {
    check('R7 OPERATIONS is the four operations', JSON.stringify(rd.OPERATIONS.slice().sort()) === JSON.stringify(['feyminto_face', 'governed_write', 'research', 'status']), short(rd.OPERATIONS));
    check('R7 BLOCKING.feyminto_face is the owner module NOT_READY_REASONS plus room_db_not_writable (no drift)',
      JSON.stringify(rd.BLOCKING.feyminto_face.slice().sort()) === JSON.stringify(identityMod.NOT_READY_REASONS.concat(['room_db_not_writable']).sort()), short(rd.BLOCKING.feyminto_face));
    check('R7 BLOCKING: research blocks missing and unreadable only', JSON.stringify(rd.BLOCKING.research.slice().sort()) === JSON.stringify(['room_db_missing', 'room_db_unreadable']), short(rd.BLOCKING.research));
    check('R7 BLOCKING: governed_write adds room_db_not_writable', JSON.stringify(rd.BLOCKING.governed_write.slice().sort()) === JSON.stringify(['room_db_missing', 'room_db_not_writable', 'room_db_unreadable']), short(rd.BLOCKING.governed_write));
    check('R7 BLOCKING: status blocks nothing and the face blocks every not-ready reason',
      rd.BLOCKING.status.length === 0 && ['room_db_missing', 'room_db_unreadable', 'room_db_not_writable', 'identity_missing', 'identity_incomplete', 'identity_path_mismatch', 'registry_missing_room'].every((x) => rd.BLOCKING.feyminto_face.indexOf(x) !== -1), short(rd.BLOCKING));
    check('R7 REQUIREMENT_LINES has a line for every reason', ['room_db_missing', 'room_db_unreadable', 'room_db_not_writable', 'identity_missing', 'identity_incomplete', 'identity_path_mismatch', 'registry_missing_room'].every((x) => typeof rd.REQUIREMENT_LINES[x] === 'string' && rd.REQUIREMENT_LINES[x].length > 0));
    const ops = ['governed_write', 'research', 'feyminto_face', 'status'];
    const table = (dir) => ops.map((op) => rd.readinessFor(dir, op));
    const flags = (res) => res.map((x) => x.blocking === true).join(',');
    const ready = birth('rg7-ready');
    const tReady = table(ready.roomDir);
    check('R7 a ready room blocks nothing and carries its room_id', tReady.every((x) => x.ok === true && x.state === 'ready' && x.blocking === false && typeof x.room_id === 'string' && x.remediation === null), short(tReady));
    const miss = birth('rg7-missing'); removeDb(miss.roomDir);
    const tMiss = table(miss.roomDir);
    check('R7 missing room.db: blocks write, research and face; status answers (write,research,face,status = true,true,true,false)', flags(tMiss) === 'true,true,true,false' && tMiss[3].ok === true && tMiss[3].state === 'not_ready', flags(tMiss));
    check('R7 every not-ready result carries the REQUIREMENT_LINES text and a typed remediation', tMiss.every((x) => x.requirement === rd.REQUIREMENT_LINES.room_db_missing && x.reason === 'room_db_missing' && x.remediation === 'recover_room_record'), short(tMiss[0]));
    const cor = birth('rg7-corrupt'); zeroDb(cor.roomDir);
    const tCor = table(cor.roomDir);
    check('R7 corrupt room.db: true,true,true,false', flags(tCor) === 'true,true,true,false' && tCor[0].reason === 'room_db_unreadable', flags(tCor));
    const leg = birth('rg7-legacy');
    const legDb = navigation.openRoomDbForCaller(leg.roomDir);
    try { legDb.prepare("DELETE FROM identity WHERE key LIKE 'room.%'").run(); } finally { navigation.closeRoomDbForCaller(legDb); }
    const tLeg = table(leg.roomDir);
    check('R7 legacy identity_missing: write and research are NOT blocked, the face is (false,false,true,false)', flags(tLeg) === 'false,false,true,false' && tLeg[0].reason === 'identity_missing' && tLeg[0].ok === true && tLeg[0].state === 'not_ready', flags(tLeg));
    const plain = path.join(iso.home, 'plain-folder-no-room');
    fs.mkdirSync(path.join(plain, '.mindrian'), { recursive: true });
    const tPlain = table(plain);
    check('R7 a plain folder with no .room-root and no room.db is not a room with a missing record: write and research stay open, the face is refused (false,false,true,false)',
      flags(tPlain) === 'false,false,true,false' && tPlain[0].reason === 'room_db_missing' && tPlain[0].is_room === false && tPlain[0].ok === true, flags(tPlain));
    check('R7 the same folder with a .room-root and no room.db IS a room with a missing record (true,true,true,false)', (() => {
      fs.writeFileSync(path.join(plain, '.room-root'), '{}');
      const tRoom = table(plain);
      return flags(tRoom) === 'true,true,true,false' && tRoom[0].is_room === true;
    })());
    if (isRoot) {
      skip('R7 not-writable row', 'running as uid 0');
    } else {
      const ro = birth('rg7-readonly');
      // a room that has been used already holds its -wal and -shm files; without them a read-only folder cannot
      // even be opened, which is a different (and honest) reason, room_db_unreadable
      identityMod.readRoomIdentity(ro.roomDir, { door: 'in_place' });
      try {
        fs.chmodSync(dbFile(ro.roomDir), 0o444);
        fs.chmodSync(path.join(ro.roomDir, '.mindrian'), 0o555);
        const tRo = table(ro.roomDir);
        check('R7 read-only room.db: only the write is blocked (true,false,false,false); research and the face read an identity that is ready', flags(tRo) === 'true,false,false,false' && tRo[0].reason === 'room_db_not_writable' && tRo[0].remediation === 'restore_write_permission', flags(tRo));
      } finally {
        try { fs.chmodSync(path.join(ro.roomDir, '.mindrian'), 0o755); } catch (_e) { /* best effort */ }
        try { fs.chmodSync(dbFile(ro.roomDir), 0o644); } catch (_e) { /* best effort */ }
      }
    }
  }

  // ---- source greps and the dash guard -------------------------------------------------------------------------
  const newModules = [path.join(ROOT, 'lib', 'core', 'room-readiness.cjs'), path.join(ROOT, 'lib', 'mcp', 'room-readiness-gate.cjs')];
  check('R7 both new modules exist', newModules.every((f) => fs.existsSync(f)), newModules.filter((f) => !fs.existsSync(f)).join(','));
  const srcs = newModules.concat([path.join(ROOT, 'lib', 'mcp', 'session-room.cjs')]).filter((f) => fs.existsSync(f));
  check('R3 the plugin never changes permissions: no chmod in the readiness modules or session-room', srcs.every((f) => !/chmod/.test(fs.readFileSync(f, 'utf8'))), srcs.join(','));
  const gateSrc = newModules[1];
  const grantLines = fs.existsSync(gateSrc) ? fs.readFileSync(gateSrc, 'utf8').split('\n').filter((ln) => /grant/i.test(ln) && !/^\s*(\/\/|\*|\/\*)/.test(ln)) : ['module absent'];
  check('R6 "grant" appears in the gate module only on comment lines', grantLines.length === 0, grantLines.join(' | '));
  const dashHits = H.dashGuard([__filename].concat(newModules));
  check('dash guard: no em dash or en dash in the test or the two new modules', dashHits.length === 0, dashHits.join(','));
}

main().then(() => {
  restoreEnv();
  iso.cleanup();
  console.log('');
  console.log('PASS=' + passed + ' FAIL=' + failed + ' SKIP=' + skipped);
  process.exit(failed === 0 ? 0 : 1);
}).catch((e) => {
  restoreEnv();
  try { iso.cleanup(); } catch (_e) { /* best effort */ }
  console.log('FAIL: test crashed :: ' + String((e && e.stack) || e));
  process.exit(1);
});
