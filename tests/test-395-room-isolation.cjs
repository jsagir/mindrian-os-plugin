'use strict';
/*
 * Phase 395 plan 12 -- room isolation for the router tools.
 *
 * The fault (session jsagi-96, plugin 2.0.0-beta.83): a session bound to a new room called intelligence
 * find-connections and got the STATE of a different room. Root cause: eight router tools in
 * lib/mcp/tool-router.cjs read the boot-time closure roomDir (MINDRIAN_ROOM, else ./room under the server
 * cwd) on every call, and never asked the session binding. room_state already asked it.
 *
 * Fixtures: one boot directory A (the server default room, ./room under a fake cwd) and two born rooms B and C.
 * Session S-B is bound to B by room_bind. Session S-C is bound to C by its birth (the room_create plus
 * gate_answer path). Session S-U has no binding. Each STATE.md carries a marker word.
 *
 *   I1  control: room_state status reads the bound room (B for S-B, C for S-C)
 *   I2..I9  each swept tool, for S-B and S-C, shows only its own bound room's marker, never A, never the other room
 *   I10 room_graph visualize-room reads the bound room's sections, not the empty boot directory
 *   I11 methodology records its pipeline step in the bound room, not in the boot directory
 *   I12 an unbound session keeps the boot-time room (behavior unchanged when nothing is bound)
 *
 * Every room lives under an isolated mkdtemp HOME (tests/helpers/isolated-home-36925.cjs refuses a path under
 * the real ~/MindrianRooms or ~/.mindrian). Zero network: MINDRIAN_BRAIN_URL points at a closed local port.
 */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const H = require('./helpers/isolated-home-36925.cjs');

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

const iso = H.mkIsolatedHome('room-isolation');
process.env.HOME = iso.home;
process.env.USERPROFILE = iso.home;
process.env.MINDRIAN_ROOMS_HOME = iso.roomsHome;
process.env.MINDRIAN_BRAIN_URL = 'http://127.0.0.1:9';
delete process.env.MINDRIAN_BRAIN_KEY;
delete process.env.CLAUDE_CODE_SESSION_ID;
delete process.env.MINDRIAN_ACTIVE_SESSION_ID;
delete process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.MINDRIAN_ROOM;

const MARK = { A: 'ISO395-MARKER-ROOM-A', B: 'ISO395-MARKER-ROOM-B', C: 'ISO395-MARKER-ROOM-C' };

// Room A: the boot-time directory the server falls back to (./room under the server cwd). Not a born room.
const roomA = path.join(iso.home, 'server-cwd', 'room');
fs.mkdirSync(roomA, { recursive: true });
fs.writeFileSync(path.join(roomA, 'STATE.md'), 'venture_stage: ' + MARK.A + '\n');

function makeFakeServer() {
  const tools = {};
  return {
    tools,
    tool(name, _d, _s, handler) { tools[name] = handler; },
    registerTool(name, _c, handler) { tools[name] = handler; },
  };
}
function textOf(res) {
  return (res && res.content && res.content[0] && typeof res.content[0].text === 'string') ? res.content[0].text : '';
}
function marksIn(text) {
  return { A: text.includes(MARK.A), B: text.includes(MARK.B), C: text.includes(MARK.C) };
}
function expectOnly(text, want, label) {
  const m = marksIn(text);
  for (const k of ['A', 'B', 'C']) {
    if (k === want) check(m[k], label + ': the bound room ' + k + ' marker is missing');
    else check(!m[k], label + ': room ' + k + ' leaked into a session bound to room ' + want);
  }
}

const server = makeFakeServer();
const toolRouter = require(path.join(ROOT, 'lib', 'mcp', 'tool-router.cjs'));
toolRouter.registerRouterTools(server, roomA, ROOT, { compact: '' }, 'cli');

const SESSION = { B: 'iso395-session-b', C: 'iso395-session-c', U: 'iso395-session-unbound' };

// One row per swept tool: [label, tool name, arguments]. Each command echoes the room's STATE.md.
const SWEPT = [
  ['I2 intelligence find-connections', 'intelligence', { command: 'find-connections' }],
  ['I3 methodology lean-canvas', 'methodology', { command: 'lean-canvas' }],
  ['I4 analysis analyze-systems', 'analysis', { command: 'analyze-systems' }],
  ['I5 export dashboard', 'export', { command: 'dashboard' }],
  ['I6 orchestration scout', 'orchestration', { command: 'scout' }],
  ['I7 room_content help', 'room_content', { command: 'help' }],
  ['I8 meeting pipeline', 'meeting', { command: 'pipeline' }],
  ['I9 intelligence grade', 'intelligence', { command: 'grade' }],
];

(async () => {
  const B = H.birthFixtureRoom({ iso, slug: 'iso395-b', sessionId: 'iso395-birth-b' });
  const C = H.birthFixtureRoom({ iso, slug: 'iso395-c', sessionId: SESSION.C });
  check(B.ok && C.ok, 'fixture births failed: ' + JSON.stringify([B.ok, C.ok, B.reason, C.reason]));
  fs.writeFileSync(path.join(B.roomDir, 'STATE.md'), 'venture_stage: ' + MARK.B + '\n');
  fs.writeFileSync(path.join(C.roomDir, 'STATE.md'), 'venture_stage: ' + MARK.C + '\n');

  const bindText = textOf(await server.tools.room_bind({ room: 'iso395-b', sessionId: SESSION.B }, { sessionId: SESSION.B }));
  check(/"effective":\s*true/.test(bindText), 'room_bind to room B was not effective: ' + bindText.slice(0, 300));

  await arm('I1 control: room_state status reads the bound room', async () => {
    expectOnly(textOf(await server.tools.room_state({ command: 'status' }, { sessionId: SESSION.B })), 'B', 'S-B room_state');
    expectOnly(textOf(await server.tools.room_state({ command: 'status' }, { sessionId: SESSION.C })), 'C', 'S-C room_state');
  });

  for (const [label, name, args] of SWEPT) {
    await arm(label + ' reads only the bound room', async () => {
      const tb = textOf(await server.tools[name](Object.assign({}, args), { sessionId: SESSION.B }));
      expectOnly(tb, 'B', 'S-B ' + name);
      const tc = textOf(await server.tools[name](Object.assign({}, args), { sessionId: SESSION.C }));
      expectOnly(tc, 'C', 'S-C ' + name);
    });
  }

  await arm('I10 room_graph visualize-room reads the bound room, not the empty boot directory', async () => {
    const fromBoot = textOf(await server.tools.room_graph({ command: 'visualize-room' }, { sessionId: SESSION.U }));
    check(fromBoot.includes('No room data'), 'the unbound call should draw the empty boot directory: ' + fromBoot.slice(0, 200));
    const fromB = textOf(await server.tools.room_graph({ command: 'visualize-room' }, { sessionId: SESSION.B }));
    check(!fromB.includes('No room data'), 'S-B visualize-room drew the empty boot directory, not room B');
  });

  await arm('I11 methodology records its pipeline step in the bound room only', async () => {
    const rel = path.join('.mindrian', 'pipeline-state.json');
    for (const d of [roomA, B.roomDir, C.roomDir]) { try { fs.rmSync(path.join(d, rel), { force: true }); } catch (_e) { /* none */ } }
    await server.tools.methodology({ command: 'beautiful-question' }, { sessionId: SESSION.B });
    check(fs.existsSync(path.join(B.roomDir, rel)), 'room B has no pipeline-state.json after the S-B methodology call');
    check(fs.readFileSync(path.join(B.roomDir, rel), 'utf8').includes('beautiful-question'), 'room B pipeline state does not record the step');
    check(!fs.existsSync(path.join(roomA, rel)), 'the boot directory received the S-B pipeline step');
    check(!fs.existsSync(path.join(C.roomDir, rel)), 'room C received the S-B pipeline step');
  });

  await arm('I12 an unbound session keeps the boot-time room (unchanged behavior)', async () => {
    const t = textOf(await server.tools.intelligence({ command: 'find-connections' }, { sessionId: SESSION.U }));
    expectOnly(t, 'A', 'S-U intelligence');
  });

  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  if (failed > 0) { console.log('Failed: ' + failedNames.join(', ')); process.exit(1); }
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
