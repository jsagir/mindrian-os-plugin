#!/usr/bin/env node
'use strict';
/*
 * Phase 400.3 plan 05b: the Part 8 room lexicon is read from a cached file while the room is unchanged.
 *
 * Covered: OR-5 (the room-lexicon read moves to a cached file), OA-1 (the guard may rebuild a stale cache once
 * from room.db: read-only, no busy wait, fail closed on any error; the key read uses the same door), R7 of plan
 * 386-33 (only a successful build is cached), review B-d (an unreadable room.db still blocks through the hook).
 *
 * Canon Part 8: fixture rooms only, under one mkdtemp root; MINDRIAN_BRAIN_URL points at a closed loopback port;
 * no network. The test prints no entry text except the invented fixture names.
 * Native Windows is UNMEASURED.
 *
 * Groups:
 *   cache  L0-L11  the cache key, the read, the write and the fail-closed rules
 *          L15     wave 2 Goldfish W2-D-07: stale temp files of a killed writer are removed (older than 60 s)
 *   hook   L12-L14 the part8 hook with a bound session; the Linux timing
 * Usage: node tests/test-400-3-lexicon-cache.cjs [cache|hook|all]   (default all)
 *
 * Node built-ins only. Hyphens only.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const LEX = path.join(ROOT, 'lib', 'core', 'part8-room-lexicon.cjs');
const GUARD = path.join(ROOT, 'lib', 'core', 'part8-egress-guard.cjs');
const HOOK = path.join(ROOT, 'scripts', 'part8-egress-guard-hook.cjs');
const CACHE_NAME = 'part8-lexicon-cache.json';

const GROUP = process.argv[2] || 'all';
if (['cache', 'hook', 'all'].indexOf(GROUP) === -1) {
  console.error('usage: node tests/test-400-3-lexicon-cache.cjs [cache|hook|all]');
  process.exit(2);
}

let passed = 0;
let failed = 0;
let skipped = 0;
function check(label, cond, detail) {
  if (cond) { passed += 1; console.log('PASS: ' + label); }
  else { failed += 1; console.log('FAIL: ' + label + (detail !== undefined ? ' :: ' + detail : '')); }
}
function skip(label, why) { skipped += 1; console.log('SKIP: ' + label + ' :: ' + why); }

const T = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), '4003-05b-')));
process.on('exit', () => { try { fs.rmSync(T, { recursive: true, force: true }); } catch (_e) { /* best effort */ } });
const HOME = path.join(T, 'home');
const ROOMS = path.join(T, 'rooms');
fs.mkdirSync(HOME, { recursive: true });
fs.mkdirSync(path.join(ROOMS, '.rooms', 'sessions'), { recursive: true });
Object.assign(process.env, { HOME, USERPROFILE: HOME, MINDRIAN_ROOMS_HOME: ROOMS, MINDRIAN_BRAIN_URL: 'http://127.0.0.1:9' });
delete process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.CLAUDE_CODE_SESSION_ID;
delete process.env.MINDRIAN_PART8_DEBUG;

const IS_ROOT = typeof process.getuid === 'function' && process.getuid() === 0;
const J = (x) => JSON.stringify(x);
const QUESTION = 'how would silver orchard price its service';
const THEO_TOOL = 'mcp__theo__brain_ask';

function insertCompany(roomDir, id, name) {
  const { openRoomDb, closeRoomDb } = require(path.join(ROOT, 'lib', 'core', 'room-db.cjs'));
  const { insertNode } = require(path.join(ROOT, 'lib', 'core', 'node-insert.cjs'));
  const db = openRoomDb(roomDir);
  try { insertNode(db, id, 'company', JSON.stringify({ name: name }), { epistemic_type: 'observation' }); }
  finally { closeRoomDb(db); }
}
function makeRoom(slug, ventureName) {
  const roomDir = path.join(ROOMS, slug);
  fs.mkdirSync(roomDir, { recursive: true });
  fs.writeFileSync(path.join(roomDir, 'ROOM.md'), '---\nventure_name: ' + (ventureName || 'Quiet Lantern') + '\n---\n\n# Fixture room\n');
  insertCompany(roomDir, 'company:4003-05b:1', 'silver orchard');
  return roomDir;
}
const cacheFile = (roomDir) => path.join(roomDir, '.mindrian', CACHE_NAME);
function readCache(roomDir) { try { return JSON.parse(fs.readFileSync(cacheFile(roomDir), 'utf8')); } catch (_e) { return null; } }

// One new node process: load the lexicon of roomDir and print the source, the info, the fixture texts and a match.
function loadInNewProcess(roomDir) {
  const prog = [
    'const lex = require(' + J(LEX) + ');',
    'const r = lex.loadRoomLexicon(process.argv[1]);',
    'const texts = r.ok ? r.entries.map((e) => e.text) : [];',
    'const m = r.ok ? lex.matchLexicon(' + J(QUESTION) + ', r) : null;',
    'process.stdout.write(JSON.stringify({ ok: r.ok, reason: r.reason || null, source: r.source || null, info: lex._lastLoadInfo ? lex._lastLoadInfo() : null, texts: texts, match: m ? m.token_class : null }));',
  ].join('\n');
  const res = spawnSync(process.execPath, ['-e', prog, roomDir], { encoding: 'utf8', env: process.env, timeout: 30000 });
  try { return JSON.parse(res.stdout); } catch (_e) { return { parse_error: true, stdout: res.stdout, stderr: String(res.stderr || '').slice(0, 400) }; }
}
const FIXTURE_TEXTS = ['silver orchard', 'copper meadow', 'Quiet Lantern', 'Amber Fjord'];
const has = (r, t) => !!r && Array.isArray(r.texts) && r.texts.indexOf(t) !== -1;
const shown = (r) => J(Object.assign({}, r, { texts: (r && r.texts || []).filter((t) => FIXTURE_TEXTS.indexOf(t) !== -1 || /^l\d/.test(t)) }));

// ---------------------------------------------------------------------------
// Group cache (L0-L11)
// ---------------------------------------------------------------------------
function groupCache() {
  console.log('\n-- group cache --');
  const lex = require(LEX);

  // L0 (control): the lexicon holds the term, and only the lexicon makes the guard block it.
  {
    const room = makeRoom('l0room');
    lex._resetLexiconCache();
    const r = lex.loadRoomLexicon(room);
    const guard = require(GUARD);
    const free = guard.classify({ question: QUESTION }, { toolName: THEO_TOOL, roomDir: null });
    const bound = guard.classify({ question: QUESTION }, { toolName: THEO_TOOL, roomDir: room });
    check('L0 the lexicon holds silver orchard', !!r && r.ok === true && r.entries.some((e) => e.text === 'silver orchard'), J({ ok: r && r.ok }));
    check('L0 with no room bound the question is not a block (else pick another lexicon-only term)', !!free && free.verdict !== 'block', J({ verdict: free && free.verdict, cls: free && free.class }));
    check('L0 with the room bound the question blocks with class room_content', !!bound && bound.verdict === 'block' && bound.class === 'room_content', J({ verdict: bound && bound.verdict, cls: bound && bound.class }));
  }

  // L1, L2: the cache file and its use in a new process.
  const room = makeRoom('l1room');
  lex._resetLexiconCache();
  lex.loadRoomLexicon(room);
  {
    const c = readCache(room);
    let mode = null;
    try { mode = fs.statSync(cacheFile(room)).mode & 0o777; } catch (_e) { mode = null; }
    check('L1 the cache file exists, parses, has schema 1 and holds silver orchard',
      !!c && c.schema === 1 && Array.isArray(c.entries) && c.entries.some((e) => e.text === 'silver orchard'), J({ exists: fs.existsSync(cacheFile(room)), schema: c && c.schema }));
    if (process.platform === 'win32') skip('L1 mode 0600', 'win32');
    else check('L1 the cache file mode is 0600', mode === 0o600, mode === null ? 'none' : mode.toString(8));
  }
  {
    const r = loadInNewProcess(room);
    check('L2 a new process on the unchanged room: source cache, _lastLoadInfo {source: cache, rowsRead: 0}, match room_term',
      r.ok === true && r.source === 'cache' && J(r.info) === J({ source: 'cache', rowsRead: 0 }) && r.match === 'room_term', shown(r));
  }

  // L3: a new node changes the room.
  {
    insertCompany(room, 'company:4003-05b:2', 'copper meadow');
    const r = loadInNewProcess(room);
    const c = readCache(room);
    check('L3 after a new node: source room.db, copper meadow is an entry, and the cache file holds it',
      r.ok === true && r.source === 'room.db' && has(r, 'copper meadow') && !!c && c.entries.some((e) => e.text === 'copper meadow'), shown(r));
  }

  // L4: the ROOM.md frontmatter changes.
  {
    fs.writeFileSync(path.join(room, 'ROOM.md'), '---\nventure_name: Amber Fjord\n---\n\n# Fixture room\n');
    const r = loadInNewProcess(room);
    check('L4 after a ROOM.md change: source room.db and the new venture name is an entry', r.ok === true && r.source === 'room.db' && has(r, 'Amber Fjord'), shown(r));
  }

  // L5: the room folder is renamed.
  let moved = path.join(ROOMS, 'l5moved');
  {
    loadInNewProcess(room); // a fresh cache for the old path
    fs.renameSync(room, moved);
    const r = loadInNewProcess(moved);
    check('L5 after a rename: source room.db and the room_name entry is the new folder name', r.ok === true && r.source === 'room.db' && has(r, 'l5moved'), shown(r));
  }

  // L6: a cache that is not JSON, one with schema 2, one with another key.
  {
    const bad = [
      ['not JSON', '{ this is not json'],
      ['schema 2', null],
      ['another key', null],
    ];
    const good = readCache(moved);
    bad[1][1] = J(Object.assign({}, good, { schema: 2, entries: [] }));
    bad[2][1] = J(Object.assign({}, good, { key: good && good.key + 'x', entries: [] }));
    for (const [name, text] of bad) {
      fs.writeFileSync(cacheFile(moved), text, { mode: 0o600 });
      const r = loadInNewProcess(moved);
      check('L6 a cache with ' + name + ' is not used: source room.db and silver orchard is an entry', r.ok === true && r.source === 'room.db' && has(r, 'silver orchard'), shown(r));
    }
  }

  // L7: a dropped change-log trigger disables the cache.
  {
    loadInNewProcess(moved);
    const before = fs.statSync(cacheFile(moved)).mtimeMs;
    const { DatabaseSync } = require('node:sqlite');
    const raw = new DatabaseSync(path.join(moved, '.mindrian', 'room.db'));
    raw.exec('DROP TRIGGER IF EXISTS rcl_nodes_ai');
    raw.close();
    sleep(30);
    const r = loadInNewProcess(moved);
    const after = fs.statSync(cacheFile(moved)).mtimeMs;
    check('L7 a missing trigger: source room.db and the cache file is not rewritten', r.ok === true && r.source === 'room.db' && after === before, shown(r) + ' mtime ' + before + ' to ' + after);
  }

  // L8: a 0-byte room.db.
  {
    const r8 = path.join(ROOMS, 'l8room');
    fs.mkdirSync(path.join(r8, '.mindrian'), { recursive: true });
    fs.writeFileSync(path.join(r8, '.mindrian', 'room.db'), '');
    const r = loadInNewProcess(r8);
    check('L8 a 0-byte room.db: ok false, room_check_unavailable, no cache file', r.ok === false && r.reason === 'room_check_unavailable' && !fs.existsSync(cacheFile(r8)), shown(r));
  }

  // L9: a room.db of 4096 bytes of 0x41.
  {
    const r9 = path.join(ROOMS, 'l9room');
    fs.mkdirSync(path.join(r9, '.mindrian'), { recursive: true });
    fs.writeFileSync(path.join(r9, '.mindrian', 'room.db'), Buffer.alloc(4096, 0x41));
    const r = loadInNewProcess(r9);
    check('L9 a garbage room.db: ok false, room_check_unavailable, no cache file', r.ok === false && r.reason === 'room_check_unavailable' && !fs.existsSync(cacheFile(r9)), shown(r));
  }

  // L10: a room with no room.db.
  {
    const r10 = path.join(ROOMS, 'l10room');
    fs.mkdirSync(r10, { recursive: true });
    const r = loadInNewProcess(r10);
    check('L10 no room.db: ok true, source names, no cache file', r.ok === true && r.source === 'names' && !fs.existsSync(cacheFile(r10)), shown(r));
  }

  // L11: the key holds the builder stamp and the realpath of the room.
  {
    const r11 = makeRoom('l11room');
    loadInNewProcess(r11);
    const c = readCache(r11);
    let key = null;
    try { key = JSON.parse(c.key); } catch (_e) { key = null; }
    const version = JSON.parse(fs.readFileSync(path.join(ROOT, '.claude-plugin', 'plugin.json'), 'utf8')).version;
    const files = ['lib/core/part8-room-lexicon.cjs', 'lib/core/part8-egress-guard.cjs', 'lib/core/section-registry.cjs', 'data/command-registry.json', 'data/framework-names.json'];
    const bad = [];
    if (!key || !key.builder || key.builder.version !== version) bad.push('version');
    for (const f of files) {
      const h = crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, f))).digest('hex');
      if (!key || !key.builder || !key.builder.files || key.builder.files[f] !== h) bad.push(f);
    }
    if (!key || key.room !== fs.realpathSync(r11)) bad.push('room');
    check('L11 the key holds the plugin version, the sha256 of the 5 vocabulary files and the realpath of the room', bad.length === 0, J(bad));
  }

  // L15 (wave 2 Goldfish W2-D-07): a cache write removes the temp files of a killed writer that are older than 60 s.
  {
    const r15 = makeRoom('l15room');
    const dir = path.join(r15, '.mindrian');
    const stale = path.join(dir, CACHE_NAME + '.99999.a1b2c3d4e5f6.tmp');
    const fresh = path.join(dir, CACHE_NAME + '.99998.0a0b0c0d0e0f.tmp');
    const other = path.join(dir, CACHE_NAME + '.notes');
    for (const f of [stale, fresh, other]) fs.writeFileSync(f, '{"entries":["room words"]}');
    const old = (Date.now() - 120000) / 1000;
    fs.utimesSync(stale, old, old);
    fs.utimesSync(other, old, old);
    try { fs.unlinkSync(cacheFile(r15)); } catch (_e) { /* none yet */ }
    lex._resetLexiconCache();
    lex.loadRoomLexicon(r15);
    check('L15 a cache write removes a temp file older than 60 s and keeps a fresh temp file and other files',
      !fs.existsSync(stale) && fs.existsSync(fresh) && fs.existsSync(other) && !!readCache(r15),
      J({ stale: fs.existsSync(stale), fresh: fs.existsSync(fresh), other: fs.existsSync(other), cache: !!readCache(r15) }));
  }
}
function sleep(ms) { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); }

// ---------------------------------------------------------------------------
// Group hook (L12-L14): the part8 hook with a session bound through the idiom of
// tests/test-396-session-owned-lexicon.cjs (a registry and a session binding file under the rooms home).
// ---------------------------------------------------------------------------
const BOUND = {};
function bindSession(sessionId, slug) {
  BOUND[slug] = { path: slug };
  fs.writeFileSync(path.join(ROOMS, '.rooms', 'registry.json'), J({ active: null, rooms: BOUND }, null, 2));
  fs.writeFileSync(path.join(ROOMS, '.rooms', 'sessions', sessionId + '.json'), J({ bound: [slug], primary: slug, sticky: false, updated: new Date().toISOString() }));
}
function hookEnv() {
  const env = Object.assign({}, process.env, { HOME, USERPROFILE: HOME, MINDRIAN_ROOMS_HOME: ROOMS, MINDRIAN_BRAIN_URL: 'http://127.0.0.1:9' });
  delete env.CLAUDE_ACTIVE_ROOM;
  delete env.CLAUDE_CODE_SESSION_ID;
  delete env.MINDRIAN_PART8_DEBUG;
  return env;
}
function runHook(question, sessionId) {
  const payload = { tool_name: THEO_TOOL, tool_input: { question: question }, session_id: sessionId };
  const t0 = process.hrtime.bigint();
  const res = spawnSync(process.execPath, [HOOK], { input: J(payload), encoding: 'utf8', env: hookEnv(), timeout: 20000 });
  return { code: res.status, stderr: res.stderr || '', ms: Number(process.hrtime.bigint() - t0) / 1e6 };
}
// The timing room: the gate-lexgen synthetic room plus 2000 company rows.
function buildTimingRoom(slug) {
  const roomDir = path.join(ROOMS, slug);
  require(path.join(ROOT, 'tests', 'helpers', 'synthetic-room-db.cjs')).buildRoom(roomDir, 'gate-lexgen');
  const { openRoomDb, closeRoomDb } = require(path.join(ROOT, 'lib', 'core', 'room-db.cjs'));
  const { insertNode } = require(path.join(ROOT, 'lib', 'core', 'node-insert.cjs'));
  const db = openRoomDb(roomDir);
  try {
    db.exec('BEGIN');
    for (let i = 0; i < 2000; i += 1) insertNode(db, 'company:4003-05b-t:' + i, 'company', J({ name: 'tarnwick ' + i }), { epistemic_type: 'observation' });
    db.exec('COMMIT');
  } finally { closeRoomDb(db); }
  return roomDir;
}
function stats(a) { const s = a.slice().sort((x, y) => x - y); return { p50: s[Math.floor((s.length - 1) / 2)], max: s[s.length - 1] }; }

function groupHook() {
  console.log('\n-- group hook --');
  // L12
  const room = makeRoom('l12room');
  bindSession('sess-4003-05b-l12', 'l12room');
  loadInNewProcess(room); // a fresh cache
  {
    const freshCache = fs.existsSync(cacheFile(room));
    const r = runHook(QUESTION, 'sess-4003-05b-l12');
    check('L12 a fresh cache and a bound session: exit 2 and stderr holds room_content', freshCache && r.code === 2 && r.stderr.indexOf('room_content') !== -1, J({ freshCache, code: r.code, stderr: r.stderr.slice(0, 200) }));
    const u = runHook(QUESTION, 'sess-4003-05b-unbound');
    check('L12 the same payload with an unbound session: exit 0', u.code === 0, J({ code: u.code, stderr: u.stderr.slice(0, 200) }));
  }
  // L13
  if (process.platform === 'win32' || IS_ROOT) skip('L13 an unreadable room.db blocks', 'win32 or root');
  else {
    const db = path.join(room, '.mindrian', 'room.db');
    loadInNewProcess(room);
    const freshCache = fs.existsSync(cacheFile(room));
    fs.chmodSync(db, 0);
    let r = null;
    try { r = runHook(QUESTION, 'sess-4003-05b-l12'); } finally { fs.chmodSync(db, 0o644); }
    check('L13 room.db chmod 000 with a fresh cache: exit 2 and stderr holds room_check_unavailable', freshCache && r.code === 2 && r.stderr.indexOf('room_check_unavailable') !== -1, J({ freshCache, code: r.code, stderr: r.stderr.slice(0, 200) }));
  }
  // L14
  {
    const troom = buildTimingRoom('l14timing');
    bindSession('sess-4003-05b-l14', 'l14timing');
    loadInNewProcess(troom);
    const fresh = [];
    for (let i = 0; i < 10; i += 1) fresh.push(runHook('explain dominant design', 'sess-4003-05b-l14').ms);
    const changed = [];
    const codes = [];
    for (let i = 0; i < 10; i += 1) {
      insertCompany(troom, 'company:4003-05b-c:' + i, 'brindle ' + i);
      const r = runHook('explain dominant design', 'sess-4003-05b-l14');
      changed.push(r.ms);
      codes.push(r.code);
    }
    const f = stats(fresh);
    const c = stats(changed);
    console.log('400.3-05b guard wall ms (Linux, n=10): fresh p50=' + f.p50.toFixed(0) + ' max=' + f.max.toFixed(0) + '; changed p50=' + c.p50.toFixed(0) + ' max=' + c.max.toFixed(0) + ' (load average ' + os.loadavg().map((x) => x.toFixed(2)).join(' ') + ')');
    check('L14 the timing runs gave exit 0 (a generic question)', codes.every((x) => x === 0), J(codes));
  }
}

function main() {
  if (GROUP === 'cache' || GROUP === 'all') groupCache();
  if (GROUP === 'hook' || GROUP === 'all') groupHook();
  console.log('\n' + passed + ' passed, ' + failed + ' failed, ' + skipped + ' skipped');
  process.exit(failed === 0 ? 0 : 1);
}
try { main(); } catch (e) { console.log('FAIL: harness error ' + (e && e.stack || e)); process.exit(1); }
