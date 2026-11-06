#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 384 Plan 13 (S8, PERF384-F02). The stop_gate_check close-out must wait
 * for its three child steps without holding the MCP event loop.
 *
 * Two groups (first argument selects; no argument runs both):
 *   parity    P1 golden of closeOutRoom (result and written files),
 *             P2 handleStopEvent on a turn that is not material,
 *             M2 the order of the helper calls in the closeOutRoom body.
 *             Passes on the code before the change and after it.
 *   mechanism M1 event-loop gap with sleeping stub programs on PATH,
 *             M3 ceilings of 2000 ms and the soft fail of a failing child,
 *             M4 two close-outs of one room never overlap.
 *
 * Every call uses `await closeOutRoom(...)`, so this file is valid for the
 * synchronous code and for the asynchronous code.
 *
 * Golden: SPEED384_WRITE_GOLDEN=1 node tests/test-384-s8-stop-gate-async.cjs parity
 * writes tests/fixtures/384-s8-stop-gate-golden.json from the code as it stands.
 *
 * Part 8: fixture room only, in a temp folder; HOME and the Mindrian homes point
 * into the temp folder; no network (net guard from hygiene-355).
 * No em-dashes. CJS only.
 */

const hygiene = require('./helpers/hygiene-355.cjs');
hygiene.scrubVendorKey();
const netGuard = hygiene.installNetGuard();

try {
  require('node:sqlite');
} catch (_e) {
  process.stdout.write('SKIP test-384-s8-stop-gate-async.cjs (node:sqlite unavailable)\n');
  process.exit(77);
}

const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const crypto = require('node:crypto');

// Hermetic homes, set BEFORE any repo require.
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-384-s8-'));
process.env.HOME = path.join(TMP, 'home');
process.env.MINDRIAN_HOME = path.join(TMP, 'mindrian');
process.env.MINDRIAN_ROOMS_HOME = path.join(TMP, 'rooms');
process.env.CARD_FIRE_SIDECHANNEL_PATH = path.join(TMP, 'sidechannel.json');
delete process.env.CLAUDE_ACTIVE_ROOM;
fs.mkdirSync(process.env.HOME, { recursive: true });
fs.mkdirSync(process.env.MINDRIAN_HOME, { recursive: true });
fs.mkdirSync(process.env.MINDRIAN_ROOMS_HOME, { recursive: true });

const REPO = path.join(__dirname, '..');
const GOLDEN_PATH = path.join(__dirname, 'fixtures', '384-s8-stop-gate-golden.json');
const HANDLER_PATH = path.join(REPO, 'lib', 'mcp', 'stop-gate-handler.cjs');

const { buildDeltaRoom } = require('./helpers/fixture-room-3551.cjs');
const ambientTrigger = require(path.join(REPO, 'lib', 'core', 'ambient-trigger.cjs'));
const handler = require(HANDLER_PATH);

let pass = 0;
let fail = 0;
function ok(id, cond, detail) {
  if (cond) {
    pass += 1;
    console.log('ok   ' + id);
  } else {
    fail += 1;
    console.log('FAIL ' + id + (detail ? ' (' + detail + ')' : ''));
  }
}

const rooms = [];
function newRoom(label) {
  const room = buildDeltaRoom(label);
  rooms.push(room);
  return room;
}

// closeOutRoom with the ambient child spawn replaced by a stub, so the test
// never starts a detached child.
async function closeOut(roomDir, sessionId) {
  ambientTrigger._internal.setSpawnImpl(function () { return { unref: function () {} }; });
  try {
    return await handler.closeOutRoom(roomDir, sessionId);
  } finally {
    ambientTrigger._internal.resetSpawnImpl();
  }
}

// ---------------------------------------------------------------------------
// Normalization (golden). Removes only volatile values.
// ---------------------------------------------------------------------------
const NORMALIZATIONS = [
  'absolute fixture root path replaced by <ROOT>',
  'absolute room path replaced by <ROOM>',
  'session id replaced by <SID>',
  'ISO 8601 UTC timestamps replaced by <TS>',
  'the value of a key that ends in _created_at (epoch milliseconds) replaced by <EPOCH>',
  'the value of a delta_hash key (a sha256 of room facts that include random node ids) replaced by <HASH>',
];
const TS_RE = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z/g;

function normalize(text, room, sessionId) {
  let t = String(text);
  t = t.split(room.roomDir).join('<ROOM>');
  t = t.split(room.root).join('<ROOT>');
  if (sessionId) t = t.split(sessionId).join('<SID>');
  t = t.replace(TS_RE, '<TS>');
  t = t.replace(/("[a-z_]+_created_at":\s*)\d{12,}/g, '$1<EPOCH>');
  t = t.replace(/("delta_hash":\s*")[0-9a-f]{64}(")/g, '$1<HASH>$2');
  return t;
}

function sha(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function listFiles(dir, base, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) listFiles(abs, base, out);
    else out.push(path.relative(base, abs));
  }
  return out;
}

function fileHashes(room, sessionId) {
  const files = listFiles(room.roomDir, room.roomDir, [])
    .filter((f) => !/(^|\/)room\.db(-shm|-wal)?$/.test(f))
    .sort();
  const out = {};
  for (const f of files) {
    out[f] = sha(normalize(fs.readFileSync(path.join(room.roomDir, f), 'utf8'), room, sessionId));
  }
  return out;
}

function normalizeObject(obj, room, sessionId) {
  return JSON.parse(normalize(JSON.stringify(obj), room, sessionId));
}

function buildFixtureRoom(label) {
  const room = newRoom(label);
  room.addClaims(3);
  room.addArtifact();
  return room;
}

// ---------------------------------------------------------------------------
// Parity group
// ---------------------------------------------------------------------------
async function groupParity() {
  console.log('--- parity group ---');
  const writeGolden = process.env.SPEED384_WRITE_GOLDEN === '1';

  // P1: closeOutRoom result and written files.
  const sid1 = 'sess-384-s8-golden';
  const room1 = buildFixtureRoom('s8-p1');
  const result = await closeOut(room1.roomDir, sid1);
  const p1 = {
    result: normalizeObject(result, room1, sid1),
    files: fileHashes(room1, sid1),
  };

  // P2: handleStopEvent on a turn that is not material.
  const sid2 = 'sess-384-s8-stop';
  const room2 = buildFixtureRoom('s8-p2');
  room2.bindSession(sid2);
  process.env.MINDRIAN_ROOMS_HOME = room2.roomsHome;
  ambientTrigger._internal.setSpawnImpl(function () { return { unref: function () {} }; });
  let stop;
  try {
    stop = await handler.handleStopEvent(sid2, {
      output_text: 'Plain note with no choices and no gate.',
      ran_entries: [],
      preceding_user_text: 'hello',
      preceding_user_text_source: 'typed',
      askuserquestion_fired: false,
    });
  } finally {
    ambientTrigger._internal.resetSpawnImpl();
  }
  const p2 = {
    keys: Object.keys(stop).sort(),
    fire: stop.fire,
    reason: stop.reason,
    business: normalizeObject(stop.business, room2, sid2),
    files: fileHashes(room2, sid2),
  };

  if (writeGolden) {
    const golden = {
      note: 'Recorded from the code before the 384-13 change (SPEED384_WRITE_GOLDEN=1).',
      normalizations: NORMALIZATIONS,
      p1: p1,
      p2: p2,
    };
    fs.mkdirSync(path.dirname(GOLDEN_PATH), { recursive: true });
    fs.writeFileSync(GOLDEN_PATH, JSON.stringify(golden, null, 2) + '\n');
    console.log('golden written: tests/fixtures/384-s8-stop-gate-golden.json');
  }

  const golden = JSON.parse(fs.readFileSync(GOLDEN_PATH, 'utf8'));
  ok('P1 closeOutRoom result equals golden',
    JSON.stringify(p1.result) === JSON.stringify(golden.p1.result), JSON.stringify(p1.result));
  const f1 = Object.keys(golden.p1.files);
  const diff1 = f1.filter((f) => p1.files[f] !== golden.p1.files[f]);
  ok('P1 written files equal golden (same names, same normalized sha256)',
    diff1.length === 0 && Object.keys(p1.files).length === f1.length,
    'differs: ' + diff1.join(',') + ' names: ' + Object.keys(p1.files).join(','));

  ok('P2 handleStopEvent returns exactly fire, reason, business',
    JSON.stringify(p2.keys) === JSON.stringify(['business', 'fire', 'reason']), JSON.stringify(p2.keys));
  ok('P2 fire is false and the reason equals golden',
    p2.fire === false && p2.reason === golden.p2.reason, String(p2.reason));
  ok('P2 business equals golden after normalization',
    JSON.stringify(p2.business) === JSON.stringify(golden.p2.business), JSON.stringify(p2.business));
  const f2 = Object.keys(golden.p2.files);
  const diff2 = f2.filter((f) => p2.files[f] !== golden.p2.files[f]);
  ok('P2 files written by the close-out equal golden',
    diff2.length === 0 && Object.keys(p2.files).length === f2.length, 'differs: ' + diff2.join(','));

  // M2: order of the helper calls inside the body of closeOutRoom.
  const src = fs.readFileSync(HANDLER_PATH, 'utf8');
  const start = src.search(/(?:async\s+)?function closeOutRoom\(/);
  const end = src.indexOf('\n}\n', start);
  const body = start >= 0 && end > start ? src.slice(start, end) : '';
  const names = [
    '_closeOutMintoDrain', '_closeOutRecompile', '_closeOutFolderMemorySnapshot',
    '_closeOutGuardianOnStop', '_closeOutStateMd', '_closeOutAmbientTrigger',
    '_closeOutEurekaFireOnce', '_closeOutMemoryLifecycle',
  ];
  let last = -1;
  let inOrder = body.length > 0;
  for (const n of names) {
    const code = body.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
    const i = code.indexOf(n + '(');
    const j = code.indexOf('await ' + n + '(');
    const at = j >= 0 ? j : i;
    if (at < 0 || at <= last) { inOrder = false; break; }
    last = at;
  }
  ok('M2 helper calls in closeOutRoom run in the fixed order', inOrder);
}

// ---------------------------------------------------------------------------
// Mechanism group
// ---------------------------------------------------------------------------
function makeStubs(dir, programs) {
  fs.mkdirSync(dir, { recursive: true });
  for (const name of Object.keys(programs)) {
    const p = path.join(dir, name);
    fs.writeFileSync(p, '#!/bin/sh\n' + programs[name] + '\n');
    fs.chmodSync(p, 0o755);
  }
}

// A stub node that acts only for scripts/memory-lifecycle.cjs; every other call
// (for example the node calls inside scripts/compute-state) runs the real node.
function nodeStub(onLifecycle) {
  return 'case "$1" in\n  *memory-lifecycle.cjs)\n' + onLifecycle + '\n  ;;\nesac\nexec "' + process.execPath + '" "$@"';
}

async function withPath(stubDir, fn) {
  const saved = process.env.PATH;
  process.env.PATH = stubDir + path.delimiter + saved;
  try {
    return await fn();
  } finally {
    process.env.PATH = saved;
  }
}

async function timed(fn) {
  const t0 = process.hrtime.bigint();
  const value = await fn();
  return { ms: Number(process.hrtime.bigint() - t0) / 1e6, value: value };
}

async function groupMechanism() {
  console.log('--- mechanism group ---');

  // M1: event-loop gap with two stubs that sleep 0.5 s each.
  {
    const dir = path.join(TMP, 'stubs-m1');
    makeStubs(dir, { bash: 'sleep 0.5', node: 'sleep 0.5' });
    const room = buildFixtureRoom('s8-m1');
    await closeOut(room.roomDir, 'sess-m1-warm'); // warm the modules with the real programs
    let maxGap = 0;
    await withPath(dir, async () => {
      let lastTick = Date.now();
      const iv = setInterval(() => {
        const now = Date.now();
        if (now - lastTick > maxGap) maxGap = now - lastTick;
        lastTick = now;
      }, 10);
      lastTick = Date.now();
      try {
        await closeOut(room.roomDir, 'sess-m1');
        // Let one timer tick run, so a blocked loop records its gap.
        await new Promise((resolve) => setTimeout(resolve, 30));
      } finally {
        clearInterval(iv);
      }
    });
    ok('M1 largest event-loop gap during the close-out is below 400 ms', maxGap < 400, 'gap ' + maxGap + ' ms');
  }

  // M3: ceilings and soft fail.
  {
    const room = buildFixtureRoom('s8-m3');
    await closeOut(room.roomDir, 'sess-m3-warm');
    const fast = path.join(TMP, 'stubs-m3-fast');
    makeStubs(fast, { node: nodeStub('exit 0') });
    const slow = path.join(TMP, 'stubs-m3-slow');
    makeStubs(slow, { node: nodeStub('exec sleep 3') });
    const base = await withPath(fast, () => timed(() => closeOut(room.roomDir, 'sess-m3-a')));
    const long = await withPath(slow, () => timed(() => closeOut(room.roomDir, 'sess-m3-b')));
    const extra = long.ms - base.ms;
    ok('M3 memory-lifecycle step stops at its 2000 ms ceiling (extra time 1700 to 2500 ms)',
      extra > 1700 && extra < 2500, 'extra ' + Math.round(extra) + ' ms');

    const slowBash = path.join(TMP, 'stubs-m3-bash-slow');
    makeStubs(slowBash, { bash: 'exec sleep 3' });
    const longBash = await withPath(slowBash, () => timed(() => closeOut(room.roomDir, 'sess-m3-c')));
    const extraBash = longBash.ms - base.ms;
    ok('M3 STATE.md step stops at its 2000 ms ceiling (extra time 1700 to 2500 ms)',
      extraBash > 1700 && extraBash < 2500, 'extra ' + Math.round(extraBash) + ' ms');

    // A child that exits 1: the STATE.md step returns false, STATE.md stays as it was, nothing throws.
    const failing = path.join(TMP, 'stubs-m3-fail');
    makeStubs(failing, { bash: 'exit 1' });
    const room2 = buildFixtureRoom('s8-m3b');
    const stateBefore = fs.readFileSync(path.join(room2.roomDir, 'STATE.md'), 'utf8');
    let threw = false;
    let res = null;
    try {
      res = await withPath(failing, () => closeOut(room2.roomDir, 'sess-m3-d'));
    } catch (_e) {
      threw = true;
    }
    const stateAfter = fs.readFileSync(path.join(room2.roomDir, 'STATE.md'), 'utf8');
    ok('M3 a failing bash child gives a soft fail: no throw, STATE.md not written, result shape kept',
      !threw && stateAfter === stateBefore && res && res.room_dir === room2.roomDir
        && Object.keys(res).sort().join(',') === 'guardian_sm,minto_pending,room_dir,sections,stale');
  }

  // M4: two close-outs of one room do not overlap.
  {
    const log = path.join(TMP, 'm4.log');
    fs.writeFileSync(log, '');
    const dir = path.join(TMP, 'stubs-m4');
    makeStubs(dir, {
      node: nodeStub('echo start >> "' + log + '"\nsleep 0.3\necho end >> "' + log + '"\nexit 0'),
    });
    const room = buildFixtureRoom('s8-m4');
    await closeOut(room.roomDir, 'sess-m4-warm');
    fs.writeFileSync(log, '');
    await withPath(dir, async () => {
      const a = closeOut(room.roomDir, 'sess-m4-a');
      const b = closeOut(room.roomDir, 'sess-m4-b');
      await Promise.all([a, b]);
    });
    const lines = fs.readFileSync(log, 'utf8').split('\n').filter(Boolean);
    ok('M4 two close-outs of one room run start, end, start, end',
      lines.join(',') === 'start,end,start,end', lines.join(','));
  }
}

async function main() {
  const group = process.argv[2] || 'all';
  if (group !== 'all' && group !== 'parity' && group !== 'mechanism') {
    console.error('usage: test-384-s8-stop-gate-async.cjs [parity|mechanism]');
    process.exit(2);
  }
  try {
    if (group === 'all' || group === 'parity') await groupParity();
    if (group === 'all' || group === 'mechanism') await groupMechanism();
  } finally {
    for (const r of rooms) { try { r.cleanup(); } catch (_e) { /* best effort */ } }
  }
  ok('no network call was attempted', netGuard.attempts() === 0);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  console.log(fail === 0 ? 's8-stop-gate: ALL PASS' : 's8-stop-gate: ' + fail + ' FAILED');
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.log('FAIL unexpected error ' + (e && e.stack ? e.stack : e));
  console.log('s8-stop-gate: 1 FAILED');
  process.exit(1);
});
