/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Quick 261002-e9v (RCA desktop-session-binding-fallback follow-up): research_run
 * resolves its room through resolveMcpWriteRoom, the write-authority gate every
 * other room-writing MCP tool shares. An unbound session that has an id must be
 * refused up front with no_bound_room, never start a research flow in the
 * registry active room.
 *
 * Legs (in-process, through the register seam, no network):
 *   R1  unbound session with an id: every op refuses no_bound_room (message names
 *       room_bind), nothing is written under the registry room
 *   R2  naming the registry room does not authorize an unbound session
 *   R3  a bound session plans into its bound room, registry room untouched
 *   R4  the wanted-room check is kept (room_not_bound, own room succeeds)
 *   R5  a CLAUDE_ACTIVE_ROOM operator pin still writes
 *   R6  boot-fallback: existing room writes (6a), missing path refuses (6b),
 *       cwd floor refuses (6c)
 *   R7  session-less carve-out still writes and leaves the stderr trace (runs last)
 *   R8  no em-dash or en-dash in this file or lib/mcp/tools/research.cjs; zero network
 *
 * Hermetic: HOME, USERPROFILE and MINDRIAN_ROOMS_HOME are temp dirs, and the
 * session and MOS_366_* env are cleared BEFORE any repo module loads. Hyphens only.
 */
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const TMP_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-rrsb-home-'));
const ROOMS_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-rrsb-rooms-'));
process.env.HOME = TMP_HOME;
process.env.USERPROFILE = TMP_HOME;
process.env.MINDRIAN_ROOMS_HOME = ROOMS_HOME;
for (const k of [
  'CLAUDE_ACTIVE_ROOM', 'CLAUDE_CODE_SESSION_ID', 'MINDRIAN_SESSION_ID', 'MINDRIAN_ROOM',
  'MINDRIAN_MCP_FIRST', 'MOS_366_LIVE', 'MOS_366_THEO_REPLAY', 'OPENALEX_API_KEY', 'OPENALEX_EMAIL',
]) {
  delete process.env[k];
}

try { require('node:sqlite'); } catch (_e) {
  process.stdout.write('ENV GAP: node:sqlite unavailable (node ' + process.version + '); need node >= 22\n');
  process.exit(77);
}

const REPO_ROOT = path.resolve(__dirname, '..');
const hygiene = require(path.join(REPO_ROOT, 'tests/helpers/hygiene-355.cjs'));
hygiene.scrubVendorKey();
delete process.env.ANTHROPIC_API_KEY;
const net = hygiene.installNetGuard();
const C = hygiene.makeChecker('test-research-run-session-binding');

const { openRoomDb } = require(path.join(REPO_ROOT, 'lib/core/room-db.cjs'));
const { writeSessionBinding, getStdioProcessSessionKey } = require(path.join(REPO_ROOT, 'lib/core/session-binding.cjs'));
const { MCP_FIRST_DEPRECATED_ACTIVE_WRITE } = require(path.join(REPO_ROOT, 'lib/mcp/session-room.cjs'));
const { registerCoreTools } = require(path.join(REPO_ROOT, 'lib/mcp/register-core-tools.cjs'));

const QS = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'tests/fixtures/363-question-sets/whitespace-quick.json'), 'utf8'));

const roots = [TMP_HOME, ROOMS_HOME];

function mkRoom(dir, slug) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'STATE.md'), '# ' + slug + ' state marker\n\nSynthetic fixture room.\n');
  fs.writeFileSync(path.join(dir, 'ROOM.md'), '# ' + slug + '\n');
  const db = openRoomDb(dir);
  db.close();
}

function mindrianEntries(dir) {
  try { return fs.readdirSync(path.join(dir, '.mindrian')).sort(); } catch (_e) { return []; }
}

// ---- the world ------------------------------------------------------------
const roomA = path.join(ROOMS_HOME, 'room-a');
const roomB = path.join(ROOMS_HOME, 'room-b');
mkRoom(roomA, 'room-a');
mkRoom(roomB, 'room-b');
fs.mkdirSync(path.join(ROOMS_HOME, '.rooms'), { recursive: true });
fs.writeFileSync(
  path.join(ROOMS_HOME, '.rooms', 'registry.json'),
  JSON.stringify({
    version: 1,
    active: 'room-a',
    rooms: {
      'room-a': { slug: 'room-a', name: 'room-a', path: 'room-a', status: 'active' },
      'room-b': { slug: 'room-b', name: 'room-b', path: 'room-b', status: 'active' },
    },
  }, null, 2)
);

const EXTRA_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-rrsb-extra-'));
roots.push(EXTRA_ROOT);
const bootRoom = path.join(EXTRA_ROOT, 'boot-room');
mkRoom(bootRoom, 'boot-room');
const emptyRoomsHome = path.join(EXTRA_ROOT, 'empty-rooms-home');
fs.mkdirSync(emptyRoomsHome, { recursive: true });
const missingBoot = path.join(EXTRA_ROOT, 'never-created-boot');
const emptyCwd = path.join(EXTRA_ROOT, 'empty-cwd');
fs.mkdirSync(emptyCwd, { recursive: true });

const baseA = mindrianEntries(roomA);
const baseB = mindrianEntries(roomB);

writeSessionBinding('sess-bound', { bound: ['room-b'], primary: 'room-b' }, { home: ROOMS_HOME });

// ---- the register seam ----------------------------------------------------
function boot(ctx) {
  const captured = new Map();
  const stub = {
    tool: function (name, description, schema, handler) { captured.set(name, { handler: handler }); },
    registerTool: function (name, config, handler) { captured.set(name, { handler: handler }); },
  };
  registerCoreTools(stub, Object.assign({ pluginRoot: REPO_ROOT, surface: 'desktop' }, ctx));
  return captured;
}

function parse(raw) {
  const text = raw && raw.content && raw.content[0] && raw.content[0].text;
  try { return JSON.parse(text); } catch (_e) { return { _unparsed: String(text).slice(0, 300) }; }
}

function client(ctx, extra) {
  const reg = boot(ctx).get('research_run');
  return {
    call: async function (input) {
      if (!reg) throw new Error('research_run is not registered');
      const raw = await reg.handler(input, extra);
      return { isError: raw && raw.isError === true, body: parse(raw) };
    },
  };
}

function runsIn(dir) {
  try { return fs.readdirSync(path.join(dir, '.mindrian', 'research-runs')).sort(); } catch (_e) { return []; }
}

function planInput(room) {
  const i = { op: 'plan', question_set: QS, mode: 'quick' };
  if (room) i.room = room;
  return i;
}

function refusedNoBound(r) {
  return r.isError === true && r.body.ok === false && r.body.reason === 'no_bound_room';
}

async function leg(name, fn) {
  try { await fn(); } catch (e) { C.check(name + ' (threw)', false, String(e && e.message).slice(0, 200)); }
}

(async function main() {
  const missingCtx = { fallbackRoomDir: path.join(EXTRA_ROOT, 'missing-fallback-for-r1') };

  // R1
  await leg('R1', async function () {
    const c = client(missingCtx, { sessionId: 'sess-unbound' });
    const calls = [
      ['planners', { op: 'planners' }],
      ['grant_status', { op: 'grant_status' }],
      ['pending', { op: 'pending' }],
      ['plan', planInput()],
      ['grant_request', { op: 'grant_request', terms: ['whitespace'] }],
    ];
    for (const [name, input] of calls) {
      const r = await c.call(input);
      C.check('R1 ' + name + ' refused no_bound_room', refusedNoBound(r), JSON.stringify(r.body).slice(0, 160));
      C.check('R1 ' + name + ' message names room_bind', /room_bind/.test(String(r.body.message || '')));
      C.check('R1 ' + name + ' mints no gate', !Object.prototype.hasOwnProperty.call(r.body, 'gate'));
    }
    C.check('R1 room-a .mindrian equals baseline', JSON.stringify(mindrianEntries(roomA)) === JSON.stringify(baseA), JSON.stringify(mindrianEntries(roomA)));
    C.check('R1 room-b .mindrian equals baseline', JSON.stringify(mindrianEntries(roomB)) === JSON.stringify(baseB));
    C.check('R1 room-a has no research-runs', !fs.existsSync(path.join(roomA, '.mindrian', 'research-runs')));
    C.check('R1 room-a has no research-grants.json', !fs.existsSync(path.join(roomA, '.mindrian', 'research-grants.json')));
  });

  // R2
  await leg('R2', async function () {
    const c = client(missingCtx, { sessionId: 'sess-unbound' });
    const r = await c.call(planInput('room-a'));
    C.check('R2 naming the registry room does not authorize an unbound session', refusedNoBound(r), JSON.stringify(r.body).slice(0, 160));
    C.check('R2 room-a unchanged', JSON.stringify(mindrianEntries(roomA)) === JSON.stringify(baseA) && !fs.existsSync(path.join(roomA, '.mindrian', 'research-runs')));
  });

  // R3
  await leg('R3', async function () {
    const runsABefore = JSON.stringify(runsIn(roomA));
    const c = client(missingCtx, { sessionId: 'sess-bound' });
    const r = await c.call(planInput());
    C.check('R3 bound session plans ok with an rp- run id', r.isError !== true && r.body.ok === true && /^rp-/.test(String(r.body.run_id)), JSON.stringify(r.body).slice(0, 160));
    const planFile = path.join(roomB, '.mindrian', 'research-runs', String(r.body.run_id), 'plan.json');
    C.check('R3 plan.json landed in room-b', fs.existsSync(planFile));
    C.check('R3 room-a gained no research-runs', JSON.stringify(runsIn(roomA)) === runsABefore);
  });

  // R4
  await leg('R4', async function () {
    const c = client(missingCtx, { sessionId: 'sess-bound' });
    const other = await c.call({ op: 'grant_status', room: 'room-a' });
    C.check('R4 bound session naming another room gets room_not_bound', other.isError === true && other.body.reason === 'room_not_bound', JSON.stringify(other.body).slice(0, 160));
    const own = await c.call({ op: 'grant_status', room: 'room-b' });
    C.check('R4 bound session naming its own room succeeds', own.isError !== true && own.body.ok === true, JSON.stringify(own.body).slice(0, 160));
  });

  // R5
  await leg('R5', async function () {
    process.env.CLAUDE_ACTIVE_ROOM = roomB;
    const runsABefore = JSON.stringify(runsIn(roomA));
    try {
      const c = client(missingCtx, { sessionId: 'sess-pinned' });
      const r = await c.call(planInput());
      C.check('R5 operator pin plans ok', r.isError !== true && r.body.ok === true, JSON.stringify(r.body).slice(0, 160));
      C.check('R5 plan.json landed in the pinned room-b', fs.existsSync(path.join(roomB, '.mindrian', 'research-runs', String(r.body.run_id), 'plan.json')));
      C.check('R5 room-a gained no research-runs', JSON.stringify(runsIn(roomA)) === runsABefore);
    } finally {
      delete process.env.CLAUDE_ACTIVE_ROOM;
    }
  });

  // R6
  await leg('R6', async function () {
    process.env.MINDRIAN_ROOMS_HOME = emptyRoomsHome;
    const savedCwd = process.cwd();
    try {
      const a = await client({ fallbackRoomDir: bootRoom }, { sessionId: 'sess-boot' }).call(planInput());
      C.check('R6a existing boot-fallback room plans ok', a.isError !== true && a.body.ok === true, JSON.stringify(a.body).slice(0, 160));
      C.check('R6a plan.json landed in the boot room', fs.existsSync(path.join(bootRoom, '.mindrian', 'research-runs', String(a.body.run_id), 'plan.json')));

      const b = await client({ fallbackRoomDir: missingBoot }, { sessionId: 'sess-boot' }).call(planInput());
      C.check('R6b missing boot-fallback refuses no_bound_room', refusedNoBound(b), JSON.stringify(b.body).slice(0, 160));
      C.check('R6b the missing path was not created', !fs.existsSync(missingBoot));

      process.chdir(emptyCwd);
      try {
        const c = await client({}, { sessionId: 'sess-boot' }).call(planInput());
        C.check('R6c cwd floor refuses no_bound_room', refusedNoBound(c), JSON.stringify(c.body).slice(0, 160));
      } finally {
        process.chdir(savedCwd);
      }
    } finally {
      try { process.chdir(savedCwd); } catch (_e) { /* best effort */ }
      process.env.MINDRIAN_ROOMS_HOME = ROOMS_HOME;
    }
  });

  // R7 (last: the carve-out is allowed to touch room-a)
  await leg('R7', async function () {
    C.check('R7 precondition: no stdio process session key', getStdioProcessSessionKey() === null);
    const captured = [];
    const realWrite = process.stderr.write;
    process.stderr.write = function (chunk) { captured.push(String(chunk)); return true; };
    let r;
    try {
      r = await client(missingCtx, {}).call({ op: 'grant_status' });
    } finally {
      process.stderr.write = realWrite;
    }
    const err = captured.join('');
    C.check('R7 session-less caller on the registry room is allowed', r.isError !== true && r.body.ok === true, JSON.stringify(r.body).slice(0, 160));
    C.check('R7 stderr carries the deprecated-active-write trace', err.indexOf(MCP_FIRST_DEPRECATED_ACTIVE_WRITE) !== -1 && err.indexOf('room=room-a') !== -1, err.slice(0, 160));
  });

  // R8
  await leg('R8', async function () {
    const dashes = new RegExp('[' + String.fromCharCode(0x2014) + String.fromCharCode(0x2013) + ']');
    for (const f of ['tests/test-research-run-session-binding.cjs', 'lib/mcp/tools/research.cjs']) {
      C.check('R8 no em-dash or en-dash in ' + f, !dashes.test(fs.readFileSync(path.join(REPO_ROOT, f), 'utf8')));
    }
    C.check('R8 zero network attempts', net.attempts() === 0, String(net.attempts()));
  });

  for (const d of roots) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  }
  process.exit(C.summary());
})().catch(function (e) {
  console.log('FAIL: harness threw (' + String(e && e.stack).slice(0, 400) + ')');
  process.exit(1);
});
