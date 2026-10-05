'use strict';
/*
 * Phase 369.25 plan 10 -- RFT-03 and RFT-04: failure tests 3 and 4 of the phase, plus the bound-set rule (RID-10).
 *
 * The ruling (navigator, 2026-10-06): birth, room_bind and openRoom all ADD the room to the session's bound set and
 * make it primary; a room leaves the set only by an explicit unbind. writeSessionBinding returns a result so a
 * persistence failure is observable (research Pitfall 10).
 *
 *   B1  writeSessionBinding returns {ok:true} / {ok:false, reason:'binding_write_failed'} / {ok:false, reason:'unsafe_session_id'}
 *   B2  failure test 3: sessions directory read-only -> birth session_bound false + binding_reason, openRoom
 *       session_bound false, room_bind effective false + binding_write_failed; writable again -> room_bind reads back
 *   B3  failure test 4: two sessions bind different rooms, each resolves its own room and its own room_id
 *   B4  the add rule: room_bind X then Y -> [X, Y] primary Y; openRoom(X) -> [X, Y] primary X; the other session untouched
 *   B5  unbindSessionRoom is the only removal verb
 *   B6  a birth with no session reports session_bound 'not_applicable'
 *   B7  session-binding.cjs stays hook-safe (no room.db, no navigation), dash guard
 *
 * RED first: committed before session-binding.cjs gains addSessionRoom / unbindSessionRoom and a write result.
 * Every room lives under an isolated mkdtemp HOME and rooms home (tests/helpers/isolated-home-36925.cjs).
 * Nothing is written under ~/MindrianRooms or ~/.mindrian. Zero network.
 */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const H = require('./helpers/isolated-home-36925.cjs');

let passed = 0;
let failed = 0;
let skipped = 0;
const failedNames = [];
async function arm(name, fn) {
  try {
    const r = await fn();
    if (r === 'SKIP') { skipped += 1; console.log('SKIP: ' + name); return; }
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

// One isolated home for the whole file. birthFixtureRoom points the in-process env at it.
const iso = H.mkIsolatedHome('rft-binding');
process.env.HOME = iso.home;
process.env.USERPROFILE = iso.home;
process.env.MINDRIAN_ROOMS_HOME = iso.roomsHome;
delete process.env.CLAUDE_CODE_SESSION_ID;
delete process.env.MINDRIAN_ACTIVE_SESSION_ID;
delete process.env.MINDRIAN_MCP_FIRST;
delete process.env.CLAUDE_ACTIVE_ROOM;

const sbPath = path.join(ROOT, 'lib', 'core', 'session-binding.cjs');
const sb = require(sbPath);
const sessionsDir = path.join(iso.roomsHome, '.rooms', 'sessions');
const identity = require(path.join(ROOT, 'lib', 'core', 'navigation', 'room-identity.cjs'));
const roomOpen = require(path.join(ROOT, 'lib', 'core', 'room-open.cjs'));

function makeFakeServer() {
  const tools = {};
  return {
    tools,
    tool(name, _d, _s, handler) { tools[name] = handler; },
    registerTool(name, _c, handler) { tools[name] = handler; },
  };
}
function parseJson(res) {
  const text = res && res.content && res.content[0] && res.content[0].text;
  check(text, 'room_bind returned no text');
  const marker = text.indexOf('\n\n## Suggested Next');
  return JSON.parse(marker === -1 ? text : text.slice(0, marker));
}

const server = makeFakeServer();
const fallback = path.join(iso.home, 'boot-fallback-dir');
fs.mkdirSync(fallback, { recursive: true });
const toolRouter = require(path.join(ROOT, 'lib', 'mcp', 'tool-router.cjs'));
toolRouter.registerRouterTools(server, fallback, ROOT, { compact: '' }, 'cli');
const sessionRoom = require(path.join(ROOT, 'lib', 'mcp', 'session-room.cjs'));

function roomIdOf(roomDir) {
  const r = identity.readRoomIdentity(roomDir, { roomsHome: iso.roomsHome });
  check(r.ok, 'fixture room identity not ready: ' + JSON.stringify(r));
  return r.room_id;
}
const canWriteProtect = typeof process.getuid === 'function' && process.getuid() !== 0 && process.platform !== 'win32';

(async () => {
  // Rooms: X and Y for the sessions, Z for the read-only case.
  const X = H.birthFixtureRoom({ iso, slug: 'rb-x', sessionId: 'seed-x' });
  const Y = H.birthFixtureRoom({ iso, slug: 'rb-y', sessionId: 'seed-y' });
  check(X.ok && Y.ok, 'fixture births failed: ' + JSON.stringify([X.ok, Y.ok, X.reason, Y.reason]));

  await arm('B1 writeSessionBinding returns a result: ok, binding_write_failed, unsafe_session_id', () => {
    const okRes = sb.writeSessionBinding('b1-ok', { primary: 'rb-x', bound: ['rb-x'] }, { home: iso.roomsHome });
    check(okRes && okRes.ok === true, 'normal write result: ' + JSON.stringify(okRes));
    const unsafe = sb.writeSessionBinding('../x', { primary: 'rb-x', bound: ['rb-x'] }, { home: iso.roomsHome });
    eq(unsafe && unsafe.ok, false, 'unsafe id ok');
    eq(unsafe && unsafe.reason, 'unsafe_session_id', 'unsafe id reason');
    if (!canWriteProtect) return;
    fs.chmodSync(sessionsDir, 0o500);
    try {
      const ro = sb.writeSessionBinding('b1-ro', { primary: 'rb-x', bound: ['rb-x'] }, { home: iso.roomsHome });
      eq(ro && ro.ok, false, 'read-only dir ok');
      eq(ro && ro.reason, 'binding_write_failed', 'read-only dir reason');
    } finally { fs.chmodSync(sessionsDir, 0o700); }
  });

  await arm('B2 failure test 3: a binding that cannot persist is never reported as effective', async () => {
    if (!canWriteProtect) return 'SKIP';
    fs.mkdirSync(sessionsDir, { recursive: true });
    fs.chmodSync(sessionsDir, 0o500);
    try {
      const Z = H.birthFixtureRoom({ iso, slug: 'rb-z', sessionId: 'b2-birth' });
      check(Z.ok === true, 'the room itself must still be born: ' + JSON.stringify(Z));
      eq(Z.session_bound, false, 'birth session_bound');
      eq(Z.binding_reason, 'binding_write_failed', 'birth binding_reason');

      const opened = roomOpen.openRoom({ room: 'rb-z', sessionId: 'b2-open', home: iso.roomsHome });
      check(opened.ok === true, 'openRoom itself should still verify: ' + JSON.stringify(opened));
      eq(opened.session_bound, false, 'openRoom session_bound');

      const bound = parseJson(await server.tools.room_bind({ room: 'rb-z', sessionId: 'b2-bind' }, {}));
      eq(bound.effective, false, 'room_bind effective');
      eq(bound.reason, 'binding_write_failed', 'room_bind reason');
    } finally { fs.chmodSync(sessionsDir, 0o700); }
    const again = parseJson(await server.tools.room_bind({ room: 'rb-z', sessionId: 'b2-bind' }, {}));
    eq(again.effective, true, 'room_bind effective once writable');
    const back = sb.readSessionBinding('b2-bind', { home: iso.roomsHome });
    eq(back.primary, 'rb-z', 'read back primary');
  });

  await arm('B3 failure test 4: two sessions bind different rooms, each resolves its own room and room_id', async () => {
    const p1 = parseJson(await server.tools.room_bind({ room: 'rb-x', sessionId: 'b3-s1' }, {}));
    const p2 = parseJson(await server.tools.room_bind({ room: 'rb-y', sessionId: 'b3-s2' }, {}));
    eq(p1.effective, true, 's1 effective');
    eq(p2.effective, true, 's2 effective');
    const r1 = sessionRoom.resolveMcpSessionRoom({ sessionId: 'b3-s1', ctx: { fallbackRoomDir: fallback, surface: 'cli' } });
    const r2 = sessionRoom.resolveMcpSessionRoom({ sessionId: 'b3-s2', ctx: { fallbackRoomDir: fallback, surface: 'cli' } });
    eq(r1.slug, 'rb-x', 's1 resolves its own room');
    eq(r2.slug, 'rb-y', 's2 resolves its own room');
    eq(p1.room_id, roomIdOf(X.roomDir), 's1 room_id');
    eq(p2.room_id, roomIdOf(Y.roomDir), 's2 room_id');
    check(p1.room_id !== p2.room_id, 'two rooms share a room_id');
  });

  await arm('B4 the add rule: room_bind and openRoom add and make primary; another session is untouched', async () => {
    await server.tools.room_bind({ room: 'rb-y', sessionId: 'b4-other' }, {});
    await server.tools.room_bind({ room: 'rb-x', sessionId: 'b4-s1' }, {});
    await server.tools.room_bind({ room: 'rb-y', sessionId: 'b4-s1' }, {});
    let b = sb.readSessionBinding('b4-s1', { home: iso.roomsHome });
    eq(b.bound, ['rb-x', 'rb-y'], 'after bind X then Y: bound');
    eq(b.primary, 'rb-y', 'after bind X then Y: primary');
    const opened = roomOpen.openRoom({ room: 'rb-x', sessionId: 'b4-s1', home: iso.roomsHome });
    check(opened.ok === true, 'openRoom: ' + JSON.stringify(opened));
    eq(opened.session_bound, true, 'openRoom session_bound');
    eq(opened.room_id, roomIdOf(X.roomDir), 'openRoom room_id');
    b = sb.readSessionBinding('b4-s1', { home: iso.roomsHome });
    eq(b.bound, ['rb-x', 'rb-y'], 'after open X: bound');
    eq(b.primary, 'rb-x', 'after open X: primary');
    const other = sb.readSessionBinding('b4-other', { home: iso.roomsHome });
    eq(other.bound, ['rb-y'], 'the other session set');
    eq(other.primary, 'rb-y', 'the other session primary');
  });

  await arm('B5 unbindSessionRoom is the only removal verb', () => {
    check(typeof sb.addSessionRoom === 'function', 'addSessionRoom missing');
    check(typeof sb.unbindSessionRoom === 'function', 'unbindSessionRoom missing');
    const o = { home: iso.roomsHome };
    sb.addSessionRoom('b5', 'rb-x', o);
    const add = sb.addSessionRoom('b5', 'rb-y', o);
    eq(add.ok, true, 'add ok');
    eq(add.effective, true, 'add effective');
    eq(add.bound, ['rb-x', 'rb-y'], 'add bound');
    eq(add.primary, 'rb-y', 'add primary');
    const u1 = sb.unbindSessionRoom('b5', 'rb-x', o);
    eq(u1.ok, true, 'unbind ok');
    eq(u1.changed, true, 'unbind changed');
    eq(u1.bound, ['rb-y'], 'unbind bound');
    eq(u1.primary, 'rb-y', 'unbind primary');
    const u0 = sb.unbindSessionRoom('b5', 'rb-x', o);
    eq(u0.ok, true, 'unbind absent ok');
    eq(u0.changed, false, 'unbind absent changed');
    const uLast = sb.unbindSessionRoom('b5', 'rb-y', o);
    eq(uLast.bound, [], 'last unbind bound');
    eq(uLast.primary, null, 'last unbind primary');
    const back = sb.readSessionBinding('b5', o);
    eq(back.bound, [], 'read back bound');
    eq(back.primary, null, 'read back primary');
  });

  await arm('B6 a birth with no session reports session_bound not_applicable', () => {
    const birth = require(path.join(ROOT, 'lib', 'core', 'navigation', 'room-birth.cjs')).birthRoom;
    const base = { approvedBy: 'test-36925', vstage: 'Pre-Opportunity', ventureText: 'A fixture venture for the binding tests' };
    const a = birth(Object.assign({ slug: 'rb-ns1', roomDir: path.join(iso.roomsHome, 'rb-ns1'), vname: 'rb-ns1' }, base));
    check(a.ok === true, 'birth without session: ' + JSON.stringify(a));
    eq(a.session_bound, 'not_applicable', 'no sessionId');
    const b = birth(Object.assign({ slug: 'rb-ns2', roomDir: path.join(iso.roomsHome, 'rb-ns2'), vname: 'rb-ns2', sessionId: 'nosession' }, base));
    check(b.ok === true, 'birth with nosession: ' + JSON.stringify(b));
    eq(b.session_bound, 'not_applicable', 'nosession');
    const c = H.birthFixtureRoom({ iso, slug: 'rb-ns3', sessionId: 'b6-real' });
    eq(c.session_bound, true, 'a real session binds');
  });

  await arm('B7 session-binding.cjs stays hook-safe; dash guard', () => {
    const src = fs.readFileSync(sbPath, 'utf8');
    ['room.db', './room-db', 'navigation'].forEach((tok) => {
      check(src.indexOf(tok) === -1, 'session-binding.cjs contains ' + tok);
    });
    const bad = H.dashGuard([__filename, sbPath, path.join(ROOT, 'lib', 'core', 'room-open.cjs')]);
    eq(bad, [], 'em or en dash in');
  });

  try { fs.chmodSync(sessionsDir, 0o700); } catch (_e) { /* ignore */ }
  console.log('\n' + passed + ' passed, ' + failed + ' failed, ' + skipped + ' skipped');
  if (failed) console.log('failed: ' + failedNames.join(', '));
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  try { fs.chmodSync(sessionsDir, 0o700); } catch (_e) { /* ignore */ }
  console.log('FATAL: ' + String((e && e.stack) || e));
  process.exit(2);
});
