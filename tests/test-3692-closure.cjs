#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 369.2 Plan 32 (369.2-R25) -- the phase closure test, first half.
 * Plan 33 appends the per-defect legs to the LEGS list below.
 *
 *   X0    one real-room-run invocation with two --seed flags (tests/fixtures/release-room and
 *         tests/fixtures/release-room-seed118) exits 0 and writes ONE receipt for HEAD. The receipt keeps the
 *         four top-level perspective blocks (so the release gate reads it unchanged) and a rooms array of two
 *         entries {seed, slug, perspectives}; the second room gets its own slug; mos_real_room_gate accepts the
 *         receipt; the report holds Bottlenecks, HSI, Connections and Whitespace sections for each room.
 *   RD    the report prints the readiness counts for the seed118 room ('Confirmed claims: 0 of <n> typed
 *         claims') and the Eureka judge line (the plan 27 sentence), not the old '--judge none' note.
 *   R355  the ROADMAP card's measured bar (SEED-115 item 5): on each of the three Phase 355 fixture rooms a
 *         quick run through the canvas sends non-empty search strings that hold the room's own titles, returns
 *         evidence with a source URL, and no answer line carries the token not_enough_context.
 *
 * HERMETIC: HOME, USERPROFILE, MINDRIAN_ROOMS_HOME and every receipt dir are temp dirs; OpenAlex is served by
 * the replay preload (tests/helpers/replay-route-3692.cjs, merged bodies through tests/helpers/real-corpus-3692.cjs);
 * the Brain URL points at a dead loopback port. No receipt is ever written under ~/.mindrian/release-real-room.
 *
 * Output: one PASS or FAIL line per leg, 'KNOWN <id> (<owner>): <signature>' for a recorded known limitation
 * (never fails the file), then 'PASS: <n> FAIL: <n> KNOWN: <n>'. Exit 1 on any FAIL. Hyphens only.
 */

process.removeAllListeners('warning');

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const RUN_SCRIPT = path.join(ROOT, 'scripts', 'real-room-run.cjs');
const PLANNER_CLI = path.join(ROOT, 'scripts', 'research-planner.cjs');
const GATE_LIB = path.join(ROOT, 'scripts', 'release-lib', 'real-room-gate.sh');
const SEED_A = path.join(ROOT, 'tests', 'fixtures', 'release-room');
const SEED_B = path.join(ROOT, 'tests', 'fixtures', 'release-room-seed118');
const ROOMS_355 = path.join(ROOT, 'tests', 'fixtures', '355-rooms');
const ROUTE_MODULE = path.join(__dirname, 'helpers', 'replay-route-3692.cjs');
const realCorpus = require('./helpers/real-corpus-3692.cjs');

const REAL_RECEIPT_DIR = path.join(os.homedir(), '.mindrian', 'release-real-room');

// -- tmp -------------------------------------------------------------------------
const TMP = [];
function mk(prefix) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 't3692-clo-' + prefix + '-'));
  TMP.push(d);
  return d;
}
process.on('exit', function () {
  TMP.forEach(function (d) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_e) { /* best effort */ } });
});
function listing(dir) {
  try { return fs.readdirSync(dir).sort().join('|'); } catch (_e) { return '<absent>'; }
}
const REAL_RECEIPTS_BEFORE = listing(REAL_RECEIPT_DIR);

// -- the hermetic world ------------------------------------------------------------
const HOME = mk('home');
const PRELOAD_DIR = mk('preload');
const PRELOAD_FILE = realCorpus.writePreload(PRELOAD_DIR, ROUTE_MODULE);

// A route for the 355 rooms: the room terms are not in the 3692 route table, so every search string is
// answered with the recorded synonym_hits body (synthetic records with DOIs). The string is still logged.
const ROUTE_ANY_DIR = mk('route-any');
const ROUTE_ANY = path.join(ROUTE_ANY_DIR, 'route-any.cjs');
fs.writeFileSync(ROUTE_ANY, '\'use strict\';\n'
  + 'const base = require(' + JSON.stringify(ROUTE_MODULE) + ');\n'
  + 'module.exports = { route: function (q, url) { base.route(q, url); return \'synonym_hits\'; }, bodies: base.bodies };\n', 'utf8');
const PRELOAD_ANY = realCorpus.writePreload(mk('preload-any'), ROUTE_ANY);

function envFor(preload, logFile, receiptDir, roomsHome) {
  const env = Object.assign({}, process.env, {
    HOME: HOME,
    USERPROFILE: HOME,
    MINDRIAN_ROOMS_HOME: roomsHome,
    MINDRIAN_REAL_ROOM_RECEIPT_DIR: receiptDir,
    MINDRIAN_BRAIN_URL: 'http://127.0.0.1:9',
    MINDRIAN_BRAIN_KEY: 'test-key-not-real',
    NODE_OPTIONS: '--require ' + preload,
    MOS_3692_REPLAY_LOG: logFile,
  });
  delete env.CLAUDE_CODE_SESSION_ID;
  delete env.MINDRIAN_ACTIVE_SESSION_ID;
  delete env.TAVILY_API_KEY;
  return env;
}

function lastJson(text) {
  const lines = String(text || '').split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    if (lines[i][0] === '{') {
      try { return JSON.parse(lines[i]); } catch (_e) { /* keep looking */ }
    }
  }
  return null;
}
function tail(s, n) { return String(s || '').slice(-n).replace(/\s+/g, ' '); }
function check(cond, msg) { if (!cond) throw new Error(msg); }

// one hermetic real-room-run; flags carry every --seed
function roomRun(label, flags, opts) {
  const o = opts || {};
  const w = { label: label, log: path.join(mk('log-' + label), 'replay.jsonl'), receipts: mk('rcpt-' + label), rooms: mk('rooms-' + label) };
  fs.writeFileSync(w.log, '', 'utf8');
  const args = [RUN_SCRIPT, '--receipt-dir', w.receipts, '--rooms-home', w.rooms].concat(flags);
  const r = cp.spawnSync(process.execPath, args, { cwd: ROOT, env: envFor(o.preload || PRELOAD_FILE, w.log, w.receipts, w.rooms), encoding: 'utf8', timeout: 900000, maxBuffer: 128 * 1024 * 1024 });
  w.code = r.status;
  w.stdout = String(r.stdout || '');
  w.stderr = String(r.stderr || '');
  w.res = lastJson(w.stdout);
  return w;
}

function planner(world, args) {
  const r = cp.spawnSync(process.execPath, [PLANNER_CLI].concat(args).concat(['--room', world.roomDir]), { cwd: ROOT, env: envFor(world.preload, world.log, world.receipts, world.rooms), encoding: 'utf8', timeout: 300000, maxBuffer: 32 * 1024 * 1024 });
  let json = null;
  try { json = JSON.parse(String(r.stdout || '').trim()); } catch (_e) { json = null; }
  return { code: r.status, json: json, stderr: String(r.stderr || '') };
}

function sentStrings(logFile) {
  let text = '';
  try { text = fs.readFileSync(logFile, 'utf8'); } catch (_e) { return []; }
  const out = [];
  text.split('\n').forEach(function (l) {
    if (!l.trim()) return;
    try { const j = JSON.parse(l); if (typeof j.q === 'string') out.push(j.q); } catch (_e) { /* skip */ }
  });
  return out;
}

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_e) { return fallback; }
}

function headSha() {
  return cp.spawnSync('git', ['-C', ROOT, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim();
}

// the gate, sourced the way release.sh sources it
function runGate(receiptDir) {
  const r = cp.spawnSync('bash', ['-c', '. "$LIB" && mos_real_room_gate "$ROOT" 0 0'], {
    env: Object.assign({}, process.env, { HOME: HOME, USERPROFILE: HOME, LIB: GATE_LIB, ROOT: ROOT, MINDRIAN_REAL_ROOM_RECEIPT_DIR: receiptDir }),
    encoding: 'utf8', timeout: 60000,
  });
  return { code: r.status, out: String(r.stdout || '') + String(r.stderr || '') };
}

// -- the shared runs ------------------------------------------------------------------
// live: two seeds, approved by a reader, JSON result and receipt. offline: the same two seeds, the report text.
let LIVE = null;
let REPORT = null;
function live() {
  if (!LIVE) LIVE = roomRun('live', ['--seed', SEED_A, '--seed', SEED_B, '--read-by', 'test-3692', '--json']);
  return LIVE;
}
function report() {
  if (!REPORT) REPORT = roomRun('report', ['--seed', SEED_A, '--seed', SEED_B, '--offline']);
  return REPORT;
}

// the text of the report for room number i (1-based) of n: from its ROOM header to the next one (or the end)
function roomBlock(text, i, n) {
  const start = text.indexOf('ROOM ' + i + ' of ' + n + ':');
  if (start === -1) return null;
  const next = text.indexOf('ROOM ' + (i + 1) + ' of ' + n + ':', start + 1);
  const negative = text.indexOf('== FeyMinto ==', start + 1);
  let end = next === -1 ? text.length : next;
  if (next === -1 && negative !== -1) end = negative;
  return text.slice(start, end);
}

// -- legs --------------------------------------------------------------------------------
const LEGS = [];
function leg(id, title, fn) { LEGS.push({ id: id, title: title, fn: fn }); }

leg('X0', 'two --seed flags run both rooms into ONE receipt (top-level blocks kept, rooms array of two), the gate accepts it, every room has the four new sections', function () {
  const w = live();
  check(w.code === 0, 'the two-seed run exited ' + w.code + ': ' + tail(w.stderr, 300));
  check(w.res && w.res.ok === true, 'the run did not answer ok: ' + tail(w.stdout, 300));
  const sha = w.res.sha;
  const files = fs.readdirSync(w.receipts).filter(function (f) { return /\.json$/.test(f); });
  check(files.length === 1 && files[0] === sha + '.json', 'expected exactly one receipt named for HEAD, found ' + JSON.stringify(files));
  const rec = readJson(path.join(w.receipts, files[0]), null);
  check(rec && rec.perspectives, 'the receipt carries no perspectives');
  ['quick', 'deep', 'eureka', 'analogies'].forEach(function (k) {
    const b = rec.perspectives[k];
    check(b && b.counts && typeof b.counts === 'object', 'top-level ' + k + ' block has no counts');
    const vals = Object.keys(b.counts).map(function (c) { return b.counts[c]; });
    check(vals.length > 0 && vals.every(function (v) { return typeof v === 'number' && Number.isFinite(v); }), k + ' counts are not all numbers');
  });
  check(Array.isArray(rec.rooms) && rec.rooms.length === 2, 'the receipt rooms array has ' + (Array.isArray(rec.rooms) ? rec.rooms.length : 'no') + ' entries, not 2 (the second --seed ran no room)');
  ['bottlenecks', 'hsi', 'connections', 'whitespace'].forEach(function (k) {
    const b = rec.perspectives[k];
    check(b && b.counts && typeof b.counts === 'object', 'top-level ' + k + ' block has no counts');
    const vals = Object.keys(b.counts).map(function (c) { return b.counts[c]; });
    check(vals.length > 0 && vals.every(function (v) { return typeof v === 'number' && Number.isFinite(v); }), k + ' counts are not all numbers');
  });
  const sha8 = sha.slice(0, 8);
  check(rec.rooms[0].slug === 'release-fixture-' + sha8, 'room 1 slug is ' + rec.rooms[0].slug);
  check(rec.rooms[1].slug === 'release-fixture-' + sha8 + '-release-room-seed118', 'room 2 slug is ' + rec.rooms[1].slug);
  check(rec.rooms[0].slug !== rec.rooms[1].slug, 'the two rooms share a slug');
  rec.rooms.forEach(function (r, i) {
    check(typeof r.seed === 'string' && r.seed.length > 0, 'room ' + (i + 1) + ' has no seed');
    check(r.perspectives && r.perspectives.eureka && r.perspectives.bottlenecks && r.perspectives.whitespace, 'room ' + (i + 1) + ' perspectives lack the eight blocks');
  });
  check(JSON.stringify(rec.rooms[0].perspectives) === JSON.stringify(rec.perspectives), 'the top-level perspectives are not the first room\'s');
  const res = w.res;
  check(Array.isArray(res.rooms) && res.rooms.length === 2, 'the result rooms array is not 2 long');
  res.rooms.forEach(function (r) { check(fs.existsSync(path.join(r.dir, '.mindrian', 'room.db')), 'room.db missing for ' + r.slug); });
  // the gate reads the receipt for the checked-out HEAD; when a peer committed since the run, point the copy at it
  let gateDir = w.receipts;
  const head = headSha();
  if (head !== sha) {
    gateDir = mk('gate');
    rec.sha = head;
    fs.writeFileSync(path.join(gateDir, head + '.json'), JSON.stringify(rec, null, 2));
  }
  const g = runGate(gateDir);
  check(g.code === 0 && /PASS/.test(g.out), 'mos_real_room_gate did not accept the two-seed receipt (code ' + g.code + '): ' + tail(g.out, 400));
  // the report: every room carries the four new sections
  const rp = report();
  check(rp.code === 0, 'the report run exited ' + rp.code + ': ' + tail(rp.stderr, 300));
  check(/ROOM 1 of 2:/.test(rp.stdout) && /ROOM 2 of 2:/.test(rp.stdout), 'the report has no ROOM i of n headers');
  [1, 2].forEach(function (i) {
    const block = roomBlock(rp.stdout, i, 2);
    check(block !== null, 'no report block for room ' + i);
    ['Bottlenecks', 'HSI', 'Connections', 'Whitespace', 'Quick research', 'Deep research', 'Eureka', 'Analogies'].forEach(function (h) {
      check(new RegExp('^== ' + h + ' ==', 'm').test(block), 'room ' + i + ' has no == ' + h + ' == section');
    });
    ['Bottlenecks', 'HSI', 'Connections', 'Whitespace'].forEach(function (h) {
      const at = block.indexOf('== ' + h + ' ==');
      const rest = block.slice(at + 1);
      const nx = rest.search(/^== /m);
      const sec = nx === -1 ? rest : rest.slice(0, nx);
      check(/It tried:/.test(sec) && /It got:/.test(sec) && /It could not:/.test(sec), 'room ' + i + ' ' + h + ' lacks It tried / It got / It could not');
      const lanes = sec.split('\n').filter(function (l) { return /^\s*lane /.test(l); });
      check(lanes.length >= 1 && lanes.every(function (l) { return /\b(ran|empty|provider absent)\b/.test(l); }), 'room ' + i + ' ' + h + ' lane lines are not ran, empty or provider absent: ' + lanes.join(' | '));
    });
  });
});

leg('RD', 'the report prints the readiness counts and the Eureka judge line for the seed118 room', function () {
  const rp = report();
  check(rp.code === 0, 'the report run exited ' + rp.code + ': ' + tail(rp.stderr, 300));
  const block = roomBlock(rp.stdout, 2, 2);
  check(block !== null, 'no report block for room 2');
  const m = /Confirmed claims: 0 of (\d+) typed claims; other confirmed nodes: (\d+)/.exec(block);
  check(m !== null, 'room 2 has no "Confirmed claims: 0 of <n> typed claims" line');
  check(Number(m[1]) >= 1, 'the typed claim total is ' + m[1] + ', the seed118 room seeds claims');
  const w = live();
  check(w.res && Array.isArray(w.res.rooms) && w.res.rooms.length === 2, 'the live result has no rooms array');
  const rd = w.res.rooms[1].readiness;
  check(rd && rd.claims_total === Number(m[1]) && rd.confirmed_claim_count === 0, 'the JSON readiness ' + JSON.stringify(rd) + ' does not match the report line');
  check(/No model judged these pairs/.test(block), 'the report holds no judge line (No model judged these pairs)');
  check(block.indexOf('--judge none') === -1, 'the old "--judge none" note is still in the report');
});

// R355: one leg per Phase 355 fixture room
function titlesOf(roomDir) {
  const out = [];
  (function walk(dir) {
    fs.readdirSync(dir, { withFileTypes: true }).forEach(function (ent) {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) { walk(p); return; }
      if (!/\.md$/i.test(ent.name) || /^(ROOM|MINTO)\.md$/.test(ent.name)) return;
      const m = /^# (.+)$/m.exec(fs.readFileSync(p, 'utf8'));
      if (m) out.push(m[1].trim());
    });
  })(roomDir);
  return out;
}

function seedFrom355(name) {
  const src = path.join(ROOMS_355, name);
  const seed = path.join(mk('seed355-' + name), name);
  fs.mkdirSync(path.join(seed, 'sections'), { recursive: true });
  fs.copyFileSync(path.join(src, 'ROOM.md'), path.join(seed, 'ROOM.md'));
  fs.readdirSync(src, { withFileTypes: true }).forEach(function (ent) {
    if (ent.isDirectory()) fs.cpSync(path.join(src, ent.name), path.join(seed, 'sections', ent.name), { recursive: true });
  });
  fs.writeFileSync(path.join(seed, 'seed.json'), '{}\n', 'utf8');
  return seed;
}

['room-control', 'room-extend', 'room-ill-defined'].forEach(function (name) {
  leg('R355:' + name, 'a quick run through the canvas on ' + name + ' sends the room\'s own terms and returns evidence with sources', function () {
    const seed = seedFrom355(name);
    const w = roomRun('r355-' + name, ['--seed', seed, '--offline', '--json'], { preload: PRELOAD_ANY });
    check(w.code === 0 && w.res && w.res.ok === true, 'birth and index exited ' + w.code + ': ' + tail(w.stderr, 300));
    w.roomDir = w.res.room.dir;
    w.preload = PRELOAD_ANY;
    check(w.res.room.indexed >= 3, 'the room indexed ' + w.res.room.indexed + ' artifacts');
    const before = sentStrings(w.log).length;
    const rec = planner(w, ['perspective-recall', '--perspective', 'eureka', '--mode', 'quick']);
    check(rec.code === 0 && rec.json && rec.json.ok === true, 'perspective-recall failed (exit ' + rec.code + '): ' + tail(rec.stderr || JSON.stringify(rec.json), 300));
    const runId = rec.json.plan && rec.json.plan.run_id;
    check(typeof runId === 'string', 'perspective-recall built no plan (counts ' + JSON.stringify(rec.json.counts) + ')');
    const appr = planner(w, ['review', 'approve', runId, '--approved-via', 'cli']);
    check(appr.code === 0 && appr.json && appr.json.ok !== false, 'review approve refused: ' + tail(JSON.stringify(appr.json), 300));
    const ran = planner(w, ['run-quick', runId]);
    check(ran.code === 0 && ran.json && ran.json.status === 'done', 'run-quick did not answer done: ' + tail(JSON.stringify(ran.json), 300));
    const sent = sentStrings(w.log).slice(before);
    check(sent.length >= 1 && sent.every(function (s) { return s.trim().length > 0; }), 'the run sent ' + sent.length + ' strings, or an empty one');
    const titles = titlesOf(path.join(ROOMS_355, name));
    check(titles.length >= 1, 'no titles found in the room');
    const holds = sent.filter(function (s) { return titles.some(function (t) { return s.toLowerCase().indexOf(t.toLowerCase()) !== -1; }); });
    check(holds.length >= 1, 'no sent string holds a title of the room; sent: ' + tail(JSON.stringify(sent), 300));
    const run = readJson(path.join(w.roomDir, '.mindrian', 'research-runs', runId, 'run.json'), {});
    const recs = readJson(path.join(w.roomDir, run.records_path || ''), {}).records;
    const evidence = (Array.isArray(run.rows) ? run.rows : []).concat(Array.isArray(recs) ? recs : []);
    const withSource = evidence.filter(function (e) {
      return e && [e.id, e.doi, e.url, e.source_url].some(function (u) { return typeof u === 'string' && /^https?:\/\//.test(u); });
    });
    check(withSource.length >= 1, 'no evidence row carries a source URL (rows ' + evidence.length + ')');
    const answers = [ran.json.answer_line, run.answer_line].filter(function (a) { return typeof a === 'string'; });
    check(answers.every(function (a) { return a.indexOf('not_enough_context') === -1; }), 'an answer line carries the token not_enough_context');
    process.stdout.write('  ' + name + ': sent ' + sent.length + ' strings, ' + holds.length + ' hold a room title, evidence with a source ' + withSource.length + '\n');
  });
});

// -- run -------------------------------------------------------------------------------------
let pass = 0;
let fail = 0;
let known = 0;
function main() {
  process.stdout.write('Phase 369.2-32 closure test, first half (X0, RD, R355)\n');
  LEGS.forEach(function (l) {
    try {
      const out = l.fn();
      if (out && out.known) {
        known += 1;
        process.stdout.write('KNOWN ' + l.id + ' (' + out.known.owner + '): ' + out.known.signature + '\n');
        return;
      }
      pass += 1;
      process.stdout.write('PASS: ' + l.id + ' ' + l.title + '\n');
    } catch (e) {
      fail += 1;
      process.stdout.write('FAIL: ' + l.id + ' - ' + tail(e && e.message ? e.message : e, 900) + '\n');
    }
  });
  const after = listing(REAL_RECEIPT_DIR);
  if (after !== REAL_RECEIPTS_BEFORE) {
    fail += 1;
    process.stdout.write('FAIL: ISO - ~/.mindrian/release-real-room changed during the run (before: ' + REAL_RECEIPTS_BEFORE + ', after: ' + after + ')\n');
  }
  process.stdout.write('PASS: ' + pass + ' FAIL: ' + fail + ' KNOWN: ' + known + '\n');
  process.exitCode = fail > 0 ? 1 : 0;
}

main();
