#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 369.2 Plan 32 (369.2-R25) -- the phase closure test, first half.
 * Phase 369.2 Plan 33 (369.2-R25 and the per-defect requirements) -- the second half: one leg per SEED-118 defect
 * on a room born from tests/fixtures/release-room-seed118, plus the ruling, finding and preservation legs.
 *
 *   X0    one real-room-run invocation with two --seed flags (tests/fixtures/release-room and
 *         tests/fixtures/release-room-seed118) exits 0 and writes ONE receipt for HEAD. The receipt keeps the
 *         four top-level perspective blocks (so the release gate reads it unchanged) and a rooms array of two
 *         entries {seed, slug, perspectives}; the second room gets its own slug; mos_real_room_gate accepts the
 *         receipt; the report holds Bottlenecks, HSI, Connections and Whitespace sections for each room.
 *   RD    the report prints the readiness counts for the seed118 room ('Confirmed claims: <n> of <total> typed
 *         claims; other confirmed nodes: <n> (<types>).', matching the JSON result, none of the seed's own
 *         claims confirmed) and the Eureka judge line (the plan 27 sentence), not the old '--judge none' note.
 *   R355  the ROADMAP card's measured bar (SEED-115 item 5): on each of the three Phase 355 fixture rooms a
 *         quick run through the canvas sends non-empty search strings that hold the room's own titles, returns
 *         evidence with a source URL, and no answer line carries the token not_enough_context.
 *
 *   D1-D12  one leg per SEED-118 defect, driven through the CLI doors (research-planner.cjs, real-room-run.cjs) and
 *           the lens engine, the guard hook and the Brain client where the defect lives there. D6 (369.5 CODE-08), the
 *           D9 flag alias (369.5 SW-18) and D12 (Theo network, 369.5 SW-22) print 'KNOWN <id> (<owner>): <signature>'.
 *   WL      the web lines carry Haifa, Orla Venn PhD and Nimbus Robotics unchanged (quick, deep, the eureka perspective)
 *   PF      the practice kind finds the two productive terms; the problem term comes back empty and named
 *   TV      the thin line counts 2 bearing records
 *   BL      the field scan demotes a limiter the field already overcame (the deep run's round 0)
 *   OK      the behaviors to preserve (OK-02 to OK-06)
 *   SC      the SEED-120 provider slice
 *   LINT    every answer line, card body and report line of the closure runs passes the jobs-and-moves lint
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

// -- the in-process hermetic world (369.2-33) -----------------------------------------------
// The lens engine, the Brain client and the legacy-db probe run in this process. HOME and the rooms home point at
// temp dirs and every vendor key is unset BEFORE any repo module loads (the real receipt dir was read above).
const VENDOR_KEYS_ALL = ['TAVILY_API_KEY', 'OPENALEX_API_KEY', 'OPENALEX_EMAIL', 'PATENTSVIEW_API_KEY', 'TYPESAFE_API_KEY'];

// -- the hermetic world ------------------------------------------------------------
const HOME = mk('home');
process.env.HOME = HOME;
process.env.USERPROFILE = HOME;
process.env.MINDRIAN_ROOMS_HOME = mk('rooms-inproc');
process.env.MINDRIAN_BRAIN_URL = 'http://127.0.0.1:9';
VENDOR_KEYS_ALL.concat(['CLAUDE_ACTIVE_ROOM', 'CLAUDE_CODE_SESSION_ID', 'MINDRIAN_ACTIVE_SESSION_ID', 'MINDRIAN_MCP_FIRST']).forEach(function (k) { delete process.env[k]; });
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
  VENDOR_KEYS_ALL.forEach(function (k) { delete env[k]; });
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

leg('RD', 'the report prints the readiness counts (claims apart from other confirmed nodes) and the Eureka judge line for the seed118 room', function () {
  const rp = report();
  check(rp.code === 0, 'the report run exited ' + rp.code + ': ' + tail(rp.stderr, 300));
  const block = roomBlock(rp.stdout, 2, 2);
  check(block !== null, 'no report block for room 2');
  const m = /Confirmed claims: (\d+) of (\d+) typed claims; other confirmed nodes: (\d+) \(([^)]*)\)\./.exec(block);
  check(m !== null, 'room 2 has no "Confirmed claims: <n> of <total> typed claims; other confirmed nodes: <n> (<types>)." line');
  const confirmed = Number(m[1]);
  const total = Number(m[2]);
  const other = Number(m[3]);
  const w = live();
  check(w.res && Array.isArray(w.res.rooms) && w.res.rooms.length === 2, 'the live result has no rooms array');
  const rd = w.res.rooms[1].readiness;
  check(rd && rd.claims_total === total && rd.confirmed_claim_count === confirmed && rd.confirmed_other_count === other, 'the JSON readiness ' + JSON.stringify(rd) + ' does not match the report line ' + m[0]);
  // the seed118 seed writes 5 typed claims, none confirmed. Birth files the venture question as ONE confirmed claim
  // (measured on HEAD: the report reads 1 of 6), so the claims the seed wrote are the total minus that one.
  const seeded = w.res.rooms[1].seeded.claims;
  check(seeded === 5, 'the seed118 seed wrote ' + seeded + ' claims, expected 5');
  check(total - confirmed === seeded, 'the unconfirmed claims are ' + (total - confirmed) + ', not the ' + seeded + ' the seed wrote: a seeded claim was confirmed');
  // the other confirmed nodes are named by type and never counted as claims
  check(other > 0 && /Section: \d+/.test(m[4]) && !/\bclaim: \d+/.test(m[4]), 'the other confirmed nodes are not named by type apart from the claims: ' + m[4]);
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

// =====================================================================================
// 369.2-33: the twelve-defects closure legs (D1-D12) and the ruling, finding and preservation legs
// =====================================================================================
const { lintLine } = require('./helpers/jobs-moves-lint-3692.cjs');
const SEED_JSON = readJson(path.join(SEED_B, 'seed.json'), {});
const QS_QUICK = readJson(path.join(SEED_B, 'question-set-quick.json'), {});
const QS_DEEP = readJson(path.join(SEED_B, 'question-set-deep.json'), {});
const BODIES = readJson(path.join(ROOT, 'tests', 'fixtures', '3692-openalex', 'seed118-bodies.json'), {});

const NO_KEY_LINE = 'No model judged these pairs: no Jev key is set on this machine. Read the pairs that passed and judge them yourself, or set TYPESAFE_API_KEY and run the Jev judge in Claude Code.';
const LIMITER_SENTENCE = 'Entanglement requires pre-positioned physical barriers';
const FENCED = 'Nimbus Robotics Orla Venn PhD Haifa';
const PV_TEST_KEY = 'pvtest-3692-33-not-a-real-key';
const TV_TEST_KEY = 'tvtest-3692-33-not-a-real-key';

function clone(v) { return JSON.parse(JSON.stringify(v)); }
function list(v) { return Array.isArray(v) ? v : []; }

// every card body, answer line and report line a closure run printed, for the LINT leg at the end
const LINT_TEXTS = [];
function lintAdd(source, text, complete) {
  if (typeof text === 'string' && text.length > 0) LINT_TEXTS.push({ source: source, text: text, complete: complete === true });
}

// a JSON file the CLI can read (the CLI takes file paths only)
const JSON_DIR = mk('json');
let jsonSeq = 0;
function jf(obj) {
  jsonSeq += 1;
  const p = path.join(JSON_DIR, 'in-' + jsonSeq + '.json');
  fs.writeFileSync(p, JSON.stringify(obj), 'utf8');
  return p;
}

// birth one fresh room from a seed offline (nothing is sent); the world carries what planner() needs
function birth(label, opts) {
  const o = opts || {};
  const preload = o.preload || PRELOAD_FILE;
  const w = roomRun(label, ['--seed', o.seed || SEED_B, '--offline', '--json'], { preload: preload });
  check(w.code === 0 && w.res && w.res.ok === true && w.res.room && w.res.room.dir, 'birth of ' + label + ' exited ' + w.code + ': ' + tail(w.stderr || w.stdout, 300));
  w.roomDir = w.res.room.dir;
  w.preload = preload;
  return w;
}

function runDirOf(w, id) { return path.join(w.roomDir, '.mindrian', 'research-runs', id); }
function runFiles(w, id) {
  const d = runDirOf(w, id);
  return {
    plan: readJson(path.join(d, 'plan.json'), null),
    run: readJson(path.join(d, 'run.json'), null),
    state: readJson(path.join(d, 'state.json'), null),
    ledger: list((readJson(path.join(d, 'operations.json'), {}) || {}).operations),
  };
}
function auditRows(w) {
  let text = '';
  try { text = fs.readFileSync(path.join(w.roomDir, '.mindrian', 'research-audit.jsonl'), 'utf8'); } catch (_e) { return []; }
  const out = [];
  text.split('\n').forEach(function (l) { if (l.trim()) { try { out.push(JSON.parse(l)); } catch (_e) { /* skip */ } } });
  return out;
}
function opsFor(ledger, dim) { return ledger.filter(function (o) { return o.plan_dimension === dim; }); }
function opLine(o) { return o.plan_dimension + ' ' + o.kind + ' ' + o.state + (o.reason ? ' ' + o.reason : ''); }
function wantStep(res, what) {
  check(res && res.json && res.json.ok !== false && (res.code === 0 || res.code === 2), what + ' answered ' + res.code + ' ' + tail(JSON.stringify(res.json), 240));
  return res.json;
}

// -- one quick run through the CLI doors ---------------------------------------------------
// mutate(qs) edits a copy of the seed118 quick set; opts.section sets the return target.
function quickRun(label, mutate, opts) {
  const o = opts || {};
  const w = birth(label);
  const qs = clone(QS_QUICK);
  if (mutate) mutate(qs);
  const args = ['plan', jf(qs), '--mode', 'quick'];
  if (o.section) args.push('--section', o.section);
  const mark = sentStrings(w.log).length;
  const plan = planner(w, args);
  check(plan.code === 0 && plan.json && plan.json.ok === true && plan.json.status === 'ready', label + ' quick plan: ' + tail(JSON.stringify(plan.json), 300));
  const id = plan.json.run_id;
  lintAdd(label + ' plan card', plan.json.card && plan.json.card.body_md);
  const appr = planner(w, ['review', 'approve', id, '--approved-via', 'cli']);
  check(appr.code === 0 && appr.json && appr.json.ok !== false, label + ' review approve: ' + tail(JSON.stringify(appr.json), 240));
  const ran = planner(w, ['run-quick', id]);
  check(ran.code === 0 && ran.json && ran.json.status === 'done', label + ' run-quick did not answer done: ' + tail(JSON.stringify(ran.json), 300));
  lintAdd(label + ' answer line', ran.json.answer_line, false);
  lintAdd(label + ' evidence card', ran.json.card && ran.json.card.body_md, false);
  const files = runFiles(w, id);
  return { w: w, id: id, mark: mark, planJson: plan.json, ran: ran.json, plan: files.plan, run: files.run, ledger: files.ledger, sent: sentStrings(w.log).slice(mark) };
}

// the quick set with only the named leaves left researchable (L5 stays: it is the question that is not a restatement)
function holdBack(qs, keep) {
  qs.leaves.forEach(function (l) {
    if (keep.indexOf(l.id) !== -1 || l.id === 'L5') return;
    l.researchable = false;
    l.not_researchable_reason = 'held back for this leg';
    l.slots = {};
    l.falsifier = { text: '' };
    delete l.query_kinds;
  });
}

// -- one deep run through the CLI doors ----------------------------------------------------
// The fixture's budget declaration (fixture_budget.max_searches) is applied with the set_budget edit: the planner reads
// the budget from the plan, not from the question set (369.2-31 key decision). A round-0 field scan lane (BL) is recorded
// with a contradicting row on the entanglement limiter's leaf when the field scan returned the deployed countermeasure.
function blRows(w, id, lane, plan) {
  const lm1 = list(plan && plan.perspective && plan.perspective.limiters).filter(function (l) { return l.id === 'LM1'; })[0];
  const recs = readJson(path.join(w.roomDir, String(lane.records_path || '')), {});
  const hit = list(recs.records).filter(function (r) { return /countermeasure/i.test(String(r.title || '')); })[0];
  if (!lm1 || !lm1.leaf_id || !hit) return { rows: [], hit: false };
  return { hit: true, rows: [{ leaf_id: lm1.leaf_id, record_id: hit.id, claim: 'A deployed passive countermeasure removes the need for pre-positioned barriers.', quote: hit.title, label: 'contradicts' }] };
}

function driveDeep(label, mutate, opts) {
  const o = opts || {};
  const w = birth(label);
  const qs = clone(QS_DEEP);
  if (mutate) mutate(qs);
  const mark = sentStrings(w.log).length;
  const plan = planner(w, ['plan', jf(qs), '--mode', 'deep']);
  check(plan.code === 0 && plan.json && plan.json.ok === true && plan.json.status === 'ready', label + ' deep plan: ' + tail(JSON.stringify(plan.json), 300));
  const id = plan.json.run_id;
  const out = { w: w, id: id, mark: mark, planCard: String(plan.json.card && plan.json.card.body_md || ''), steps: [], closedProbe: [], bl: { rows_recorded: 0, hit: null }, answer: null };
  lintAdd(label + ' plan card', out.planCard);
  const cap = qs.fixture_budget && qs.fixture_budget.max_searches;
  if (cap) {
    const rev = planner(w, ['revise', id, jf({ op: 'set_budget', budget: { max_searches: cap } })]);
    check(rev.code === 0 && rev.json && rev.json.ok === true, label + ' set_budget ' + cap + ' refused: ' + tail(JSON.stringify(rev.json), 240));
  }
  const appr = planner(w, ['review', 'approve', id, '--approved-via', 'cli']);
  check(appr.code === 0 && appr.json && appr.json.ok !== false, label + ' review approve: ' + tail(JSON.stringify(appr.json), 240));
  const empty = jf([]);
  const planFile = runFiles(w, id).plan;
  let finished = false;
  for (let g = 0; g < 80 && !finished; g += 1) {
    const n = planner(w, ['deep-next', id]);
    check(n.json && n.json.ok === true, label + ' deep-next: ' + tail(JSON.stringify(n.json), 240));
    const step = n.json.step;
    out.steps.push(step + ':' + n.json.round);
    const lanes = list(n.json.payload && n.json.payload.lanes);
    if (step === 'fetch_round') {
      const f = planner(w, ['deep-fetch', id]);
      check(f.json && f.json.ok === true, label + ' deep-fetch: ' + tail(JSON.stringify(f.json), 240));
      lanes.forEach(function (l) {
        if (l.lane !== 'mu-blind_spot') return;
        const r = planner(w, ['deep-record', id, 'mu-blind_spot', empty]);
        out.closedProbe.push({ round: n.json.round, code: r.code, json: r.json });
      });
    } else if (step === 'dispatch_lanes') {
      lanes.forEach(function (l) {
        let rows = [];
        if (l.lane === 'BL' && o.contradict) {
          const b = blRows(w, id, l, planFile);
          out.bl.hit = b.hit;
          rows = b.rows;
        }
        const r = planner(w, ['deep-record', id, l.lane, jf(rows)]);
        check(r.json && r.json.ok !== false, label + ' deep-record ' + l.lane + ': ' + tail(JSON.stringify(r.json), 240));
        out.bl.rows_recorded += l.lane === 'BL' ? rows.length : 0;
      });
    } else if (step === 'reflect') {
      wantStep(planner(w, ['deep-followups', id, empty]), label + ' deep-followups');
    } else if (step === 'extend_card') {
      const card = n.json.payload && n.json.payload.card;
      lintAdd(label + ' extend card', card && card.body_md);
      wantStep(planner(w, ['deep-extend', id, jf({ decision: 'extend' }), '--approved-via', 'cli']), label + ' deep-extend');
    } else if (step === 'counterevidence') {
      const c = planner(w, ['deep-counterevidence', id]);
      check(c.json && c.json.ok === true, label + ' deep-counterevidence: ' + tail(JSON.stringify(c.json), 240));
      if (c.json.lane_payload) wantStep(planner(w, ['deep-record', id, 'CE', empty]), label + ' deep-record CE');
    } else if (step === 'synthesize') {
      const s = planner(w, ['deep-synthesize', id]);
      check(s.json && s.json.ok === true, label + ' deep-synthesize: ' + tail(JSON.stringify(s.json), 300));
      out.syn = s.json;
      out.answer = s.json.answer_line;
      lintAdd(label + ' answer line', s.json.answer_line, false);
      finished = true;
    } else if (step === 'done') {
      finished = true;
    }
  }
  check(finished, label + ' deep run did not reach synthesize in 80 steps: ' + out.steps.join(' '));
  const files = runFiles(w, id);
  out.plan = files.plan;
  out.run = files.run;
  out.state = files.state;
  out.ledger = files.ledger;
  out.sent = sentStrings(w.log).slice(mark);
  return out;
}

let DEEP = null;
function deepRun() {
  if (!DEEP) DEEP = driveDeep('deep', null, { contradict: false });
  return DEEP;
}

// -- D1 ------------------------------------------------------------------------------------
// the lens engine, in this process, on the born seed118 room; a recording fetch stub is the only network there is
function jsonResponse(obj) { return new Response(JSON.stringify(obj), { status: 200, headers: { 'content-type': 'application/json' } }); }
function makeStub() {
  const calls = [];
  async function stub(url, init) {
    const u = String(url);
    const headers = {};
    const h = (init && init.headers) || {};
    Object.keys(h).forEach(function (k) { headers[k.toLowerCase()] = String(h[k]); });
    calls.push({ url: u, headers: headers, body: init && init.body ? String(init.body) : '' });
    if (u.indexOf('api.tavily.com') !== -1) return jsonResponse({ results: [{ url: 'https://patents.google.com/patent/US4902126A/en', title: 'synthetic patent hit', content: 'synthetic fixture text about thin line sensing' }] });
    if (u.indexOf('ncbi') !== -1) return jsonResponse({ esearchresult: { count: '0', idlist: [] } });
    return jsonResponse({ results: [], meta: { count: 0 } });
  }
  stub.calls = calls;
  return stub;
}
async function lensRun(roomDir, lenses, opts) {
  const driver = require(path.join(ROOT, 'lib', 'lens-engine', 'source-lens-driver.cjs'));
  const stub = makeStub();
  const prior = globalThis.fetch;
  const saved = { log: console.log, warn: console.warn, error: console.error };
  console.log = function () {};
  console.warn = console.log;
  console.error = console.log;
  globalThis.fetch = stub;
  let result = null;
  let thrown = null;
  try {
    result = await driver.runSourceLens(Object.assign({
      roomDir: roomDir,
      topic: SEED_JSON.patent_need && SEED_JSON.patent_need.term ? SEED_JSON.patent_need.term : 'fiber cable detection',
      lensSet: lenses.map(function (l) { return { lens: l, weight: 1 }; }),
      preflight: { evidence_gaps: [], prior_research: [], section: 'market-analysis' },
      stage: 'explore',
      db: null,
    }, opts || {}));
  } catch (e) { thrown = e; } finally {
    globalThis.fetch = prior;
    console.log = saved.log;
    console.warn = saved.warn;
    console.error = saved.error;
  }
  return { result: result, thrown: thrown, calls: stub.calls };
}
function lensOf(result, lens) {
  return list(result && result.providers).filter(function (p) { return p && p.lens === lens; })[0] || null;
}

leg('D1', 'the patent need: the patent lane is refused provider_unavailable:patent before dispatch, and no PubMed request goes out', async function () {
  const w = birth('d1');
  const out = await lensRun(w.roomDir, ['patent'], {});
  check(!out.thrown, 'runSourceLens threw: ' + (out.thrown && out.thrown.message));
  const lr = lensOf(out.result, 'patent');
  check(lr && lr.status === 'refused' && lr.reason === 'provider_unavailable:patent', 'patent lane: ' + JSON.stringify(lr && { status: lr.status, reason: lr.reason }));
  check(lr.operation && lr.operation.state === 'refused_before_fetch' && lr.operation.reason === 'provider_unavailable:patent', 'the patent operation is not refused_before_fetch: ' + JSON.stringify(lr.operation && { state: lr.operation.state, reason: lr.operation.reason }));
  const pubmed = out.calls.filter(function (c) { return c.url.indexOf('ncbi') !== -1; });
  check(out.calls.length === 0 && pubmed.length === 0, 'requests went out: ' + JSON.stringify(out.calls.map(function (c) { return c.url.slice(0, 60); })));
  process.stdout.write('  D1 measured: patent lane ' + lr.status + ' ' + lr.reason + ', requests ' + out.calls.length + ', PubMed requests ' + pubmed.length + '\n');
});

// -- D2, D3, D4, D5, D7, D8 ------------------------------------------------------------------
leg('D2', 'both mu.blind_spot leaves of the deep run have a query and a terminal operation', function () {
  const d = deepRun();
  const leaves = list(d.plan && d.plan.leaves).filter(function (l) { return l.lens === 'mu.blind_spot' && l.researchable && !(l.slots && l.slots.term2); });
  check(leaves.length === 2, 'expected 2 mu.blind_spot leaves with a term, found ' + leaves.map(function (l) { return l.id; }).join(','));
  const lines = [];
  leaves.forEach(function (l) {
    const withQuery = list(l.queries).filter(function (q) { return typeof q.q === 'string' && q.q.length > 0; });
    const ops = opsFor(d.ledger, l.id);
    const terminal = ops.filter(function (o) { return ['executed_with_results', 'executed_empty', 'refused_before_fetch', 'not_executed'].indexOf(o.state) !== -1; });
    check(withQuery.length >= 1, 'leaf ' + l.id + ' has no query in the plan');
    check(terminal.length >= 1 && terminal.length === ops.length, 'leaf ' + l.id + ' ops are not all terminal: ' + ops.map(opLine).join('; '));
    lines.push(l.id + ' queries ' + withQuery.length + ' ops ' + ops.map(function (o) { return o.state; }).join('/'));
  });
  process.stdout.write('  D2 measured: ' + lines.join(' | ') + '\n');
});

leg('D3', 'the marker term is sent; the extra term on the limiter leaf is a typed refusal unused_slot:term, never sent', function () {
  const d = deepRun();
  const alpha = d.sent.filter(function (q) { return q.indexOf('SEEDMARK_alpha') !== -1; });
  check(alpha.length >= 1, 'SEEDMARK_alpha was in none of the ' + d.sent.length + ' sent strings');
  check(d.sent.every(function (q) { return q.indexOf('SEEDMARK_beta') === -1; }), 'SEEDMARK_beta was sent');
  // the question set carries the extra term on L6 (fixture S3 pins it); the plan keeps the leaf with the typed refusal
  const set6 = list(QS_DEEP.leaves).filter(function (l) { return l.id === 'L6'; })[0];
  check(set6 && set6.slots && set6.slots.term === 'SEEDMARK_beta' && set6.slots.limiter, 'the question set no longer carries the extra term on L6');
  const l6 = list(d.plan && d.plan.leaves).filter(function (l) { return l.id === 'L6'; })[0];
  check(l6 && l6.refusal && l6.refusal.reason === 'unused_slot:term', 'the plan leaf L6 does not carry the typed refusal unused_slot:term: ' + JSON.stringify(l6 && l6.refusal));
  const refused = opsFor(d.ledger, 'L6').filter(function (o) { return o.state === 'refused_before_fetch' && o.reason === 'unused_slot:term'; });
  check(refused.length >= 1, 'no refused_before_fetch unused_slot:term op for the extra term: ' + opsFor(d.ledger, 'L6').map(opLine).join('; '));
  check(JSON.stringify(refused).indexOf('SEEDMARK_beta') === -1, 'the refusal echoed the extra term');
  process.stdout.write('  D3 measured: SEEDMARK_alpha in ' + alpha.length + ' sent strings; L6 refusal ' + refused[0].reason + ' (' + refused.length + ' op)\n');
});

leg('D4', 'the limiter sentence is never sent; the wall is refused bad_slot:limiter; the plan card asks for it in a few words', function () {
  const d = deepRun();
  const hasSentence = function (q) { return typeof q === 'string' && q.toLowerCase().indexOf('entanglement requires') !== -1; };
  const sentOut = d.sent.filter(hasSentence);
  const composed = d.ledger.filter(function (o) { return hasSentence(o.q); });
  check(sentOut.length === 0 && composed.length === 0, 'the entanglement sentence is in ' + sentOut.length + ' sent strings and ' + composed.length + ' composed operations: ' + composed.map(function (o) { return o.plan_dimension + ' ' + o.template_id + ' ' + o.state + (o.reason ? ' ' + o.reason : '') + ' ' + tail(o.q, 120); }).join('; '));
  const refused = d.ledger.filter(function (o) { return o.state === 'refused_before_fetch' && o.reason === 'bad_slot:limiter'; });
  check(refused.length >= 1, 'no refused_before_fetch bad_slot:limiter op: ' + d.ledger.map(opLine).join('; '));
  check(d.planCard.indexOf('name it in a few words') !== -1, 'the plan card does not ask for the wall in a few words');
  process.stdout.write('  D4 measured: bad_slot:limiter ops ' + refused.length + ' (' + refused.map(function (o) { return o.plan_dimension; }).join(',') + '); sentence in 0 strings\n');
});

leg('D5', 'the extra term on a term-only lens is refused unused_slot:term2 before any fetch', function () {
  const d = deepRun();
  const ops = opsFor(d.ledger, 'L5');
  const refused = ops.filter(function (o) { return o.state === 'refused_before_fetch' && o.reason === 'unused_slot:term2'; });
  check(refused.length >= 1, 'no refused_before_fetch unused_slot:term2 op for L5: ' + ops.map(opLine).join('; '));
  check(ops.every(function (o) { return o.q === null || o.q === undefined; }), 'L5 sent a query: ' + JSON.stringify(ops.map(function (o) { return o.q; })));
  check(d.sent.every(function (q) { return q.toLowerCase().indexOf('cable cutting') === -1; }), 'the L5 term was sent');
  process.stdout.write('  D5 measured: L5 ' + refused[0].reason + ' before fetch, queries sent for it 0\n');
});

leg('D7', 'a lane an empty fetch closed answers lane_already_closed with closed_reason empty_fetch', function () {
  const d = deepRun();
  check(d.closedProbe.length >= 1, 'the mu-blind_spot lane was never fetched (steps ' + d.steps.join(' ') + ')');
  const p = d.closedProbe[0];
  check(p.json && p.json.ok === false && p.json.reason === 'lane_already_closed' && p.json.closed_reason === 'empty_fetch', 'the record call answered ' + JSON.stringify(p.json));
  check(typeof p.json.closed_at === 'string', 'no closed_at in ' + JSON.stringify(p.json));
  process.stdout.write('  D7 measured: round ' + p.round + ' mu-blind_spot record call -> ' + p.json.reason + ' closed_reason ' + p.json.closed_reason + '\n');
});

leg('D8', 'at max_searches 8 the counterevidence pass still executes a search and reports its status', function () {
  const d = deepRun();
  const cap = d.plan && d.plan.budget && d.plan.budget.max_searches;
  check(cap === 8, 'the plan budget is ' + cap + ', not the 8 the fixture declares (set_budget did not apply)');
  const ce = d.run && d.run.counterevidence;
  check(ce && typeof ce.executed === 'number' && ce.executed >= 1, 'counterevidence executed ' + (ce && ce.executed));
  check(typeof ce.status === 'string' && ['complete', 'partial', 'not_run'].indexOf(ce.status) !== -1, 'counterevidence status is ' + (ce && ce.status));
  process.stdout.write('  D8 measured: max_searches ' + cap + ', counterevidence executed ' + ce.executed + ' of ' + ce.planned + ' planned, status ' + ce.status + ', reasons ' + JSON.stringify(ce.reasons) + '\n');
});

// -- D6, D12: known legs ---------------------------------------------------------------------
leg('D6', 'an edge to a missing endpoint on a legacy foreign-key db (369.5 CODE-08)', function () {
  const navigation = require(path.join(ROOT, 'lib', 'core', 'navigation.cjs'));
  const sqlite = require('node:sqlite');
  const db = new sqlite.DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys=ON; CREATE TABLE nodes(id TEXT PRIMARY KEY,type TEXT NOT NULL,properties TEXT DEFAULT \'{}\'); CREATE TABLE edges(source TEXT NOT NULL REFERENCES nodes(id), target TEXT NOT NULL REFERENCES nodes(id), type TEXT NOT NULL, properties TEXT DEFAULT \'{}\', PRIMARY KEY(source,target,type));');
  db.prepare("INSERT INTO nodes VALUES('s','Artifact','{}')").run();
  const missingTarget = navigation.writeEdge(db, { source_id: 's', target_id: 'zz', edge_type: 'INFORMS' });
  const missingSource = navigation.writeEdge(db, { source_id: 'zz', target_id: 's', edge_type: 'INFORMS' });
  try { db.close(); } catch (_e) { /* in memory */ }
  const failed = [missingTarget, missingSource].every(function (r) { return r && r.ok === false && r.reason === 'edge_write_failed' && /FOREIGN KEY/.test(String(r.detail)); });
  if (failed) return { known: { owner: '369.5 CODE-08', signature: 'writeEdge to a missing endpoint on a legacy db with REFERENCES nodes(id) returns edge_write_failed, detail ' + missingTarget.detail } };
  // the signature is gone: the fix landed, and the leg turns into a plain pass
  check(missingTarget && missingTarget.ok === true && missingSource && missingSource.ok === true, 'the legacy-db write answered neither the known failure nor a write: ' + JSON.stringify([missingTarget, missingSource]));
  return undefined;
});

leg('D12', 'a label-less brain_query against live Theo', function () {
  return { known: { owner: 'needs live Theo', signature: "a label-less brain_query is refused by Theo's read allow-list and cannot be checked offline" } };
});

// -- D9 --------------------------------------------------------------------------------------
let D9WORLD = null;
function d9world() {
  if (!D9WORLD) D9WORLD = birth('d9');
  return D9WORLD;
}

leg('D9', 'Eureka with no judge key: the report and the CLI JSON both carry the no-key sentence', function () {
  const rp = report();
  check(rp.code === 0, 'the report run exited ' + rp.code + ': ' + tail(rp.stderr, 300));
  const block = roomBlock(rp.stdout, 2, 2);
  check(block !== null, 'no report block for room 2');
  check(block.indexOf(NO_KEY_LINE) !== -1, 'the report block does not carry the no-key sentence (it reads: ' + tail((/No model judged[^\n]*/.exec(block) || [''])[0], 260) + ')');
  const w = d9world();
  const rec = planner(w, ['perspective-recall', '--perspective', 'eureka', '--mode', 'quick']);
  check(rec.code === 0 && rec.json && rec.json.ok === true && typeof rec.json.run_tag === 'string', 'eureka recall: ' + tail(JSON.stringify(rec.json), 240));
  const jd = planner(w, ['perspective-judge', '--perspective', 'eureka', '--tag', rec.json.run_tag, '--judge', 'none']);
  check(jd.code === 0 && jd.json && jd.json.ok === true, 'perspective-judge: ' + tail(JSON.stringify(jd.json), 240));
  check(jd.json.judge_state === 'no_key' && jd.json.line === NO_KEY_LINE, 'the CLI JSON judge_state ' + jd.json.judge_state + ' and line ' + tail(jd.json.line, 200));
  process.stdout.write('  D9 measured: judge_state ' + jd.json.judge_state + ' on the CLI; the report block carries the same sentence\n');
});

leg('D9 flags', 'the judge script takes --room and --tag only; --run-tag is not an alias yet (369.5 SW-18)', function () {
  const w = d9world();
  const r = cp.spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'eureka-jev-judge.cjs'), '--room', w.roomDir, '--run-tag', '20261006T000000Z'],
    { cwd: ROOT, env: envFor(PRELOAD_FILE, w.log, w.receipts, w.rooms), encoding: 'utf8', timeout: 60000 });
  const json = lastJson(String(r.stdout || ''));
  if (json && json.ok === false && json.reason === 'room_and_tag_required') {
    return { known: { owner: '369.5 SW-18', signature: json.reason } };
  }
  // the alias landed: the call must now get past the flag check
  check(!(json && json.reason === 'room_and_tag_required'), 'unexpected flag answer ' + tail(String(r.stdout || ''), 200));
  return undefined;
});

// -- D10 -------------------------------------------------------------------------------------
leg('D10', 'analogies on the room: at least 1 structural pair through the spider-silk encoding', function () {
  const w = birth('d10');
  const rec = planner(w, ['perspective-recall', '--perspective', 'analogies', '--mode', 'quick']);
  check(rec.code === 0 && rec.json && rec.json.ok === true, 'analogies recall: ' + tail(JSON.stringify(rec.json), 240));
  const counts = rec.json.counts || {};
  const enc = 'strategy/spider-silk-encoding/spider-silk-encoding';
  const via = list(rec.json.top).filter(function (t) { return (t.a === enc || t.b === enc) && list(t.signal_sources).indexOf('encoding') !== -1; });
  const structural = list(rec.json.top).filter(function (t) { return list(t.lanes).indexOf('structural') !== -1; });
  process.stdout.write('  D10 measured: structural ' + counts.structural + ', structural_from_encoding ' + counts.structural_from_encoding + ', candidates ' + counts.candidates + ', pairs through the encoding ' + via.length + ', structural pairs listed ' + structural.length + '\n');
  check(counts.structural_from_encoding >= 1 && via.length >= 1, 'no structural pair goes through the spider-silk encoding (structural_from_encoding ' + counts.structural_from_encoding + ', pairs through it ' + via.length + ')');
});

// -- D11 -------------------------------------------------------------------------------------
function spawnHook(verb, text, roomDir) {
  const keyByVerb = { ask: 'question', search: 'query', query: 'cypher' };
  const toolInput = {};
  toolInput[keyByVerb[verb]] = text;
  const env = Object.assign({}, process.env);
  env.CLAUDE_ACTIVE_ROOM = roomDir;
  const r = cp.spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'part8-egress-guard-hook.cjs')], {
    input: JSON.stringify({ tool_name: 'mcp__plugin_mos_mindrian-brain__brain_' + verb, tool_input: toolInput, session_id: 't3692-33', cwd: roomDir }),
    env: env, encoding: 'utf8', timeout: 20000,
  });
  return { status: r.status, text: String(r.stderr || '') + String(r.stdout || '') };
}

leg('D11', 'the three Theo probes: plain allows, the room term and the private sentence block, on ask, search, query and the hook', async function () {
  const probes = list(SEED_JSON.theo_probes);
  check(probes.length === 3, 'the seed records ' + probes.length + ' Theo probes, not 3');
  const w = birth('d11');
  const capture = require(path.join(__dirname, 'helpers', 'brain-capture-server.cjs'));
  const cap = await capture.startCaptureServer();
  const realFetch = globalThis.fetch;
  let stray = 0;
  const prevUrl = process.env.MINDRIAN_BRAIN_URL;
  const prevKey = process.env.MINDRIAN_BRAIN_KEY;
  try {
    process.env.MINDRIAN_BRAIN_URL = cap.url;
    process.env.MINDRIAN_BRAIN_KEY = 'synthetic-3692-33-key';
    process.env.MINDRIAN_BRAIN_TIMEOUT_MS = '4000';
    globalThis.fetch = function guarded(input, init) {
      const u = typeof input === 'string' ? input : (input && input.url) || String(input);
      if (u.indexOf(cap.url) !== 0) { stray += 1; throw new Error('closure D11 net guard: non-capture socket ' + u); }
      return realFetch(input, init);
    };
    const brainPath = path.join(ROOT, 'lib', 'core', 'brain-client.cjs');
    delete require.cache[brainPath];
    const brain = require(brainPath);
    process.env.CLAUDE_ACTIVE_ROOM = w.roomDir;
    try { require(path.join(ROOT, 'lib', 'core', 'part8-room-lexicon.cjs'))._resetLexiconCache(); } catch (_e) { /* no cache to reset */ }
    const lines = [];
    for (const p of probes) {
      const want = p.kind === 'plain_methodology' ? 'allow' : 'block';
      const wantToken = p.kind === 'room_term' ? 'name' : (p.kind === 'private_sentence' ? 'private_context' : null);
      const seen = [];
      for (const verb of ['ask', 'search', 'query']) {
        capture.resetCaptured();
        let result;
        try { result = verb === 'ask' ? await brain.ask(p.prompt) : (verb === 'search' ? await brain.search(p.prompt) : await brain.query(p.prompt)); } catch (e) { result = { threw: String(e && e.message) }; }
        const wire = capture.captured.length;
        const hook = spawnHook(verb, p.prompt, w.roomDir);
        const wireDisp = wire > 0 ? 'allow' : 'block';
        const hookDisp = hook.status === 2 ? 'block' : 'allow';
        seen.push(verb + ':' + wireDisp + '/' + hookDisp);
        check(wireDisp === want && hookDisp === want, p.kind + ' on ' + verb + ': wire ' + wireDisp + ' (' + wire + ' captured), hook ' + hookDisp + ', expected ' + want + '; result ' + tail(JSON.stringify(result), 160));
        if (want === 'block') {
          check(result && result.error === 'egress_blocked' && result.egress_class === 'room_content' && result.token_class === wantToken, p.kind + ' on ' + verb + ' sentinel ' + tail(JSON.stringify(result), 200) + ', expected room_content/' + wantToken);
          check(wire === 0, p.kind + ' on ' + verb + ' put ' + wire + ' requests on the wire');
        }
      }
      lines.push(p.kind + ' ' + want + (wantToken ? ' (' + wantToken + ')' : '') + ' [' + seen.join(' ') + ']');
    }
    check(stray === 0, stray + ' sockets reached something other than the capture server');
    process.stdout.write('  D11 measured: ' + lines.join(' | ') + '\n');
  } finally {
    globalThis.fetch = realFetch;
    delete process.env.CLAUDE_ACTIVE_ROOM;
    process.env.MINDRIAN_BRAIN_URL = prevUrl;
    if (prevKey === undefined) delete process.env.MINDRIAN_BRAIN_KEY; else process.env.MINDRIAN_BRAIN_KEY = prevKey;
    try { await capture.stopCaptureServer(); } catch (_e) { /* best effort */ }
  }
});

// -- WL ----------------------------------------------------------------------------------------
// the fenced words leave as written after one grant: from a quick run, a deep run and the eureka perspective
function fencedProof(label, w, sent, phrase) {
  const holds = sent.filter(function (q) { return q.indexOf(phrase) !== -1; });
  check(holds.length >= 1, label + ': no sent string holds "' + phrase + '" as written; sent ' + tail(JSON.stringify(sent), 260));
  const audit = auditRows(w).filter(function (a) { return typeof a.q === 'string' && a.q.indexOf(phrase) !== -1; });
  check(audit.length >= 1 && audit.every(function (a) { return a.part8_verdict === 'not_applicable'; }), label + ': the audit ledger holds ' + audit.length + ' records with the phrase, verdicts ' + JSON.stringify(audit.map(function (a) { return a.part8_verdict; })));
  return label + ' sent ' + holds.length + ' string(s), audit ' + audit.length;
}

leg('WL', 'Haifa, Orla Venn PhD and Nimbus Robotics leave unchanged after one grant, from quick, deep and the eureka perspective', function () {
  const parts = [];
  ['Haifa', 'Orla Venn PhD', 'Nimbus Robotics'].forEach(function (name) { check(FENCED.indexOf(name) !== -1, 'the test phrase lost ' + name); });
  // quick
  const q = quickRun('wl-quick', function (qs) {
    holdBack(qs, ['L1', 'L2']);
    const l1 = qs.leaves.filter(function (l) { return l.id === 'L1'; })[0];
    l1.slots = { term: FENCED };
    delete l1.query_kinds;
  });
  check(q.planJson.card.body_md.indexOf(FENCED) !== -1, 'the quick grant card does not list the phrase');
  parts.push(fencedProof('quick', q.w, q.sent, FENCED));
  // deep
  const d = driveDeep('wl-deep', function (qs) {
    qs.leaves.filter(function (l) { return l.id === 'L1'; })[0].slots = { term: FENCED };
  }, { contradict: false });
  check(d.planCard.indexOf(FENCED) !== -1, 'the deep grant card does not list the phrase');
  parts.push(fencedProof('deep', d.w, d.sent, FENCED));
  // the eureka perspective: a seed copy whose two artifact titles carry the fenced words
  const seed = path.join(mk('seed-wl'), 'release-room-seed118');
  fs.cpSync(SEED_B, seed, { recursive: true });
  const retitle = function (rel, from, to) {
    const f = path.join(seed, 'sections', rel);
    const t = fs.readFileSync(f, 'utf8').split('# ' + from).join('# ' + to).replace(/^title:.*$/m, 'title: ' + to);
    fs.writeFileSync(f, t, 'utf8');
  };
  retitle('solution-design/mast-sensor/mast-sensor.md', 'Mast sensor', 'Nimbus Robotics mast in Haifa');
  retitle('market-analysis/port-operators/port-operators.md', 'Port operators', 'Orla Venn PhD trial site');
  const w = birth('wl-eureka', { seed: seed });
  const mark = sentStrings(w.log).length;
  const rec = planner(w, ['perspective-recall', '--perspective', 'eureka', '--mode', 'quick']);
  check(rec.code === 0 && rec.json && rec.json.ok === true && rec.json.plan && rec.json.plan.run_id, 'eureka recall built no plan: ' + tail(JSON.stringify(rec.json), 240));
  const id = rec.json.plan.run_id;
  const appr = planner(w, ['review', 'approve', id, '--approved-via', 'cli']);
  check(appr.code === 0 && appr.json && appr.json.ok !== false, 'eureka review approve: ' + tail(JSON.stringify(appr.json), 240));
  const ran = planner(w, ['run-quick', id]);
  check(ran.code === 0 && ran.json && ran.json.status === 'done', 'eureka run-quick: ' + tail(JSON.stringify(ran.json), 240));
  lintAdd('wl-eureka answer line', ran.json.answer_line, false);
  lintAdd('wl-eureka evidence card', ran.json.card && ran.json.card.body_md, false);
  const sent = sentStrings(w.log).slice(mark);
  ['Nimbus Robotics mast in Haifa', 'Orla Venn PhD trial site'].forEach(function (phrase) { parts.push(fencedProof('eureka ' + phrase, w, sent, phrase)); });
  process.stdout.write('  WL measured: ' + parts.join(' | ') + '\n');
});

// -- PF ----------------------------------------------------------------------------------------
leg('PF', 'the practice kind finds optical time domain reflectometry and powerline detection; the problem term comes back empty and named', function () {
  const r = quickRun('pf', function (qs) {
    holdBack(qs, ['L1', 'L2']);
    const l1 = qs.leaves.filter(function (l) { return l.id === 'L1'; })[0];
    l1.slots = { term: 'thin wire detection' };
  });
  const l1ops = opsFor(r.ledger, 'L1');
  const practice = l1ops.filter(function (o) { return o.kind === 'practice' && /optical time domain reflectometry/.test(String(o.q)) && o.state === 'executed_with_results'; });
  const adjacent = l1ops.filter(function (o) { return o.kind === 'adjacent' && /powerline detection/.test(String(o.q)) && o.state === 'executed_with_results'; });
  const problem = l1ops.filter(function (o) { return o.kind === 'direct' && /thin wire detection/.test(String(o.q)) && o.state === 'executed_empty'; });
  check(practice.length === 1, 'practice operation executed_with_results: ' + l1ops.map(opLine).join('; '));
  check(adjacent.length === 1, 'adjacent operation executed_with_results: ' + l1ops.map(opLine).join('; '));
  check(problem.length === 1, 'problem-term operation executed_empty: ' + l1ops.map(opLine).join('; '));
  const line = String(r.ran.answer_line || '');
  check(line.indexOf('These searches ran and returned no records:') !== -1 && line.indexOf('thin wire detection') !== -1, 'the answer line does not name the empty problem term: ' + tail(line, 300));
  check(line.indexOf('not proof the literature is silent') !== -1, 'the answer line lacks the not-proof clause');
  process.stdout.write('  PF measured: practice ' + practice[0].result_count + ' records, adjacent ' + adjacent[0].result_count + ' records, problem term ' + problem[0].result_count + ' records and named in the answer line\n');
});

// -- TV ----------------------------------------------------------------------------------------
leg('TV', 'the quick lane-B leg: the thin line counts 2 bearing records', function () {
  const r = quickRun('tv', function (qs) { holdBack(qs, ['L6']); });
  check(r.run.verdict === 'thin', 'verdict ' + r.run.verdict + ', not thin: ' + tail(r.ran.answer_line, 240));
  check(r.run.bearing_records && r.run.bearing_records.count === 2, 'bearing_records ' + JSON.stringify(r.run.bearing_records));
  check(String(r.ran.answer_line).indexOf('2 records match the question, and none were read for or against it') !== -1, 'the thin line does not count 2 records: ' + tail(r.ran.answer_line, 300));
  process.stdout.write('  TV measured: ' + r.ran.answer_line + '\n');
});

// -- BL ----------------------------------------------------------------------------------------
function limiterBaseline(d, id) {
  const fromRun = list(d.run && d.run.perspective && d.run.perspective.limiters).filter(function (l) { return l.id === id; })[0];
  if (fromRun && fromRun.baseline) return fromRun.baseline;
  const fromState = d.state && d.state.perspective_baseline;
  if (fromState && typeof fromState === 'object' && fromState[id]) return typeof fromState[id] === 'string' ? fromState[id] : (fromState[id].baseline || fromState[id].status || null);
  return fromRun ? (fromRun.baseline || null) : null;
}

leg('BL', 'the field scan runs first and demotes the entanglement limiter the field already overcame', function () {
  const d = driveDeep('bl', null, { contradict: true });
  check(/^fetch_round:0$/.test(d.steps[0] || ''), 'the first step is ' + d.steps[0] + ', not a round 0 fetch (owner 369.2-24); steps ' + d.steps.join(' '));
  check(d.bl.hit === true && d.bl.rows_recorded === 1, 'the field scan returned no countermeasure record to read (hit ' + d.bl.hit + ', rows ' + d.bl.rows_recorded + '); the replay route gave the baseline strings a body only if the baseline row matches them');
  const lm1 = limiterBaseline(d, 'LM1');
  check(lm1 === 'contradicted', 'LM1 baseline is ' + lm1 + ', not contradicted (owner 369.2-24)');
  const ranking = list(d.run && d.run.perspective && d.run.perspective.ranking).map(function (r) { return typeof r === 'string' ? r : r && r.limiter_id; });
  check(ranking.length >= 1 && ranking[0] !== 'LM1', 'LM1 ranks first: ' + JSON.stringify(ranking));
  check(!(d.syn && d.syn.next_binding_constraint === 'LM1'), 'LM1 is the next binding constraint');
  process.stdout.write('  BL measured: LM1 baseline ' + lm1 + ', ranking ' + JSON.stringify(ranking) + ', next binding constraint ' + (d.syn && d.syn.next_binding_constraint) + ', steps ' + d.steps.join(' ') + '\n');
});

leg('BL0', 'the baseline replay route matches the field-scan strings the planner really composes for the seed118 deep set', function () {
  const d = deepRun();
  const qs = list(d.plan && d.plan.baseline && d.plan.baseline.queries);
  check(qs.length === 4, 'the deep plan carries ' + qs.length + ' baseline queries, not 4 (plan 23)');
  const route = require(ROUTE_MODULE);
  const lines = [];
  qs.forEach(function (q) {
    const body = route.route(q.q, '');
    lines.push(q.facet + ' -> ' + body);
    check(body !== 'gap_primary_zero', 'the baseline string "' + q.q + '" falls through to gap_primary_zero');
    // the review facet is answered by the earlier review row (rows are first match and frozen); the other three
    // carry the deployed countermeasure the field scan exists to find
    if (q.facet !== 'recent_state_of_the_art') check(body === 'seed118_baseline_countermeasure', 'the baseline string "' + q.q + '" routes to ' + body);
  });
  check(route.bodies.seed118_baseline_countermeasure && list(route.bodies.seed118_baseline_countermeasure.results).length === 1, 'the countermeasure body is missing from the merged bodies');
  process.stdout.write('  BL0 measured: ' + lines.join(' | ') + '\n');
});

// -- OK: the behaviors to preserve -----------------------------------------------------------
let OKRUN = null;
function okRun() {
  if (!OKRUN) OKRUN = quickRun('ok', function (qs) { holdBack(qs, ['L6']); });
  return OKRUN;
}

leg('OK-02', 'a deep plan with no nameable limiter is still a wish with no deep run', function () {
  const r = okRun();
  const qs = clone(QS_QUICK);
  qs.perspective.limiters = [];
  qs.leaves.forEach(function (l) { delete l.limiter_id; });
  const p = planner(r.w, ['plan', jf(qs), '--mode', 'deep']);
  check(p.code === 0 && p.json && p.json.status === 'wish' && list(p.json.errors).indexOf('no_nameable_limiter') !== -1, 'plan answered ' + tail(JSON.stringify({ status: p.json && p.json.status, errors: p.json && p.json.errors }), 240));
  check(p.json.next !== 'deep_run' && p.json.next !== 'review', 'the card offered ' + p.json.next);
  const files = runFiles(r.w, p.json.run_id);
  check(!files.state && !files.run, 'a deep run state or run record exists for a wish');
  process.stdout.write('  OK-02 measured: status ' + p.json.status + ', errors ' + JSON.stringify(p.json.errors) + ', next ' + p.json.next + '\n');
});

leg('OK-03', 'a handwritten query string in an edit is still refused', function () {
  const r = okRun();
  const p = planner(r.w, ['plan', jf(QS_QUICK), '--mode', 'quick']);
  check(p.code === 0 && p.json && p.json.run_id, 'plan: ' + tail(JSON.stringify(p.json), 200));
  const rev = planner(r.w, ['revise', p.json.run_id, jf({ op: 'reword_leaf', leaf_id: 'L6', question: 'a new question', q: '"x" AND y' })]);
  check(rev.code === 2 && rev.json && rev.json.ok === false && rev.json.reason === 'raw_query_refused', 'revise answered ' + rev.code + ' ' + tail(JSON.stringify(rev.json), 200));
  process.stdout.write('  OK-03 measured: ' + rev.json.reason + ' (exit ' + rev.code + ')\n');
});

leg('OK-04', 'a grant never files: the basket is its own card and filing needs its own approved selection', function () {
  const r = okRun();
  const st = planner(r.w, ['status', r.id]);
  check(st.json && st.json.filed === false && r.run.filed === false, 'the run is marked filed after a grant and a run: ' + tail(JSON.stringify(st.json), 200));
  const b = planner(r.w, ['basket', r.id]);
  check(b.code === 0 && b.json && b.json.ok === true && b.json.card && b.json.card.shape === 'F.8', 'basket: ' + tail(JSON.stringify(b.json), 240));
  lintAdd('ok basket card', b.json.card.body_md, false);
  check(/Nothing has been written to the room yet/.test(String(b.json.card.body_md)), 'the basket card does not say nothing is written yet');
  check(list(b.json.card.options).some(function (o) { return o.id === 'file_nothing'; }), 'the basket card has no file nothing option');
  const none = planner(r.w, ['file-run', r.id, jf({}), '--approved-via', 'cli']);
  check(none.code === 2 && none.json && none.json.reason === 'no_approved_selection', 'file-run with no approved selection answered ' + none.code + ' ' + tail(JSON.stringify(none.json), 200));
  const after = planner(r.w, ['status', r.id]);
  check(after.json && after.json.filed === false, 'the run is filed after a refused selection');
  process.stdout.write('  OK-04 measured: filed false after the grant and the run; basket card F.8; file-run with no selection ' + none.json.reason + '\n');
});

leg('OK-05', 'a paraphrase drops unverified_quote and an unknown record drops unknown_record', function () {
  const r = okRun();
  const recs = readJson(path.join(r.w.roomDir, '.mindrian', 'research-runs', r.id, 'records.json'), {}).records;
  const rec = list(recs)[0];
  check(rec && rec.id && rec.title, 'the run kept no record to quote');
  const rows = [
    { leaf_id: 'L6', record_id: rec.id, claim: 'A sensor reads the thin line.', quote: 'a sensor head reads a thin line by shake alone', label: 'supports' },
    { leaf_id: 'L6', record_id: 'https://openalex.org/W0000000', claim: 'An unknown record.', quote: 'nothing', label: 'supports' },
    { leaf_id: 'L6', record_id: rec.id, claim: 'The record asks the question.', quote: rec.title, label: 'supports' },
  ];
  const v = planner(r.w, ['validate-rows', r.id, jf(rows)]);
  check(v.code === 0 && v.json && v.json.ok === true, 'validate-rows: ' + tail(JSON.stringify(v.json), 240));
  check(v.json.dropped && v.json.dropped.unverified_quote === 1 && v.json.dropped.unknown_record === 1 && v.json.kept === 1, 'dropped ' + JSON.stringify(v.json.dropped) + ' kept ' + v.json.kept);
  process.stdout.write('  OK-05 measured: kept ' + v.json.kept + ', dropped ' + JSON.stringify(v.json.dropped) + '\n');
});

leg('OK-06', 'a roll-up into a section the room does not have is an honest partial', function () {
  const r = quickRun('ok6', function (qs) { holdBack(qs, ['L6']); }, { section: 'pedagogy-notes' });
  const f = planner(r.w, ['file-run', r.id, jf({ approved: true, items: ['run_home', 'rollup'] }), '--approved-via', 'cli']);
  check(f.code === 0 && f.json && f.json.ok === true && f.json.report, 'file-run: ' + tail(JSON.stringify(f.json), 300));
  const rep = f.json.report;
  check(rep.partial === true, 'the filing report is not marked partial');
  check(list(rep.not_landed).some(function (n) { return n.reason === 'no_reasoning_file'; }), 'no_reasoning_file is not in not_landed: ' + JSON.stringify(rep.not_landed));
  check(rep.rollup && rep.rollup.ok === false && /No section named pedagogy-notes exists in this room, so nothing was rolled up\./.test(String(rep.rollup.note)), 'the roll-up note: ' + tail(JSON.stringify(rep.rollup), 240));
  check(!fs.existsSync(path.join(r.w.roomDir, 'pedagogy-notes')), 'a section directory was created for a section the room does not have');
  process.stdout.write('  OK-06 measured: partial ' + rep.partial + ', roll-up ' + rep.rollup.reason + '\n');
});

// -- SC: the SEED-120 provider slice -----------------------------------------------------------
leg('SC', 'no Tavily key: the industry lane is named unavailable before the run; with a fallback grant the patent fallback records its four fields', async function () {
  const w = birth('sc');
  const out = await lensRun(w.roomDir, ['scholarly', 'industry', 'patent'], {});
  check(!out.thrown, 'runSourceLens threw: ' + (out.thrown && out.thrown.message));
  const pre = (out.result && out.result.preflight) || {};
  const ind = list(pre.unavailable).filter(function (u) { return u && u.lens === 'industry'; })[0];
  check(ind && ind.provider === 'tavily' && ind.reason === 'no_key', 'preflight does not name the industry lane as tavily with no_key: ' + JSON.stringify(pre.unavailable));
  check(list(pre.available).indexOf('industry') === -1, 'industry is listed as available');
  check(out.calls.filter(function (c) { return c.url.indexOf('api.tavily.com') !== -1 || c.url.indexOf('patentsview') !== -1; }).length === 0, 'a Tavily or PatentsView request went out');
  const li = lensOf(out.result, 'industry');
  check(li && li.operation && li.operation.state === 'refused_before_fetch' && li.operation.reason === 'provider_unavailable:tavily', 'the industry operation: ' + JSON.stringify(li && li.operation && { state: li.operation.state, reason: li.operation.reason }));
  process.env.TAVILY_API_KEY = TV_TEST_KEY;
  let fb = null;
  let tv = [];
  let blob = '';
  try {
    const out2 = await lensRun(w.roomDir, ['patent'], { allowFallback: { patent: 'tavily' } });
    check(!out2.thrown, 'runSourceLens (fallback) threw: ' + (out2.thrown && out2.thrown.message));
    const lp = lensOf(out2.result, 'patent');
    fb = lp && lp.operation && lp.operation.fallback;
    tv = out2.calls.filter(function (c) { return c.url.indexOf('api.tavily.com') !== -1; });
    blob = JSON.stringify(out2.result);
  } finally { delete process.env.TAVILY_API_KEY; }
  check(fb && fb.original_provider === 'patents' && fb.fallback_provider === 'tavily' && fb.reason === 'no_patent_key' && fb.authorized_by === 'navigator', 'the patent fallback fields: ' + JSON.stringify(fb));
  let body = {};
  try { body = JSON.parse(tv[0].body); } catch (_e) { body = {}; }
  check(tv.length === 1 && list(body.include_domains).join(',') === 'patents.google.com', 'the fallback sent ' + tv.length + ' Tavily requests, include_domains ' + JSON.stringify(body.include_domains));
  check(blob.indexOf(TV_TEST_KEY) === -1, 'the Tavily key value is in the result');
  process.stdout.write('  SC measured: industry ' + ind.provider + '/' + ind.reason + ' before the run; fallback fields ' + Object.keys(fb).sort().join(',') + '\n');
});

// -- LINT --------------------------------------------------------------------------------------
leg('LINT', 'every answer line, card body and report line of the closure runs passes the jobs-and-moves lint', function () {
  const texts = LINT_TEXTS.slice();
  const rp = report();
  const block = rp.code === 0 ? roomBlock(rp.stdout, 2, 2) : null;
  check(block !== null, 'no report block for room 2 to lint');
  // the readiness line names the canonical state count (the RD leg pins its words); it is the one place that must say confirmed
  texts.push({ source: 'report room 2', text: block.split('\n').filter(function (l) { return !/^\s*Confirmed claims:/.test(l); }).join('\n'), complete: false });
  const w = live();
  list(w.res && w.res.rooms && w.res.rooms[1] && w.res.rooms[1].jobs && Object.keys(w.res.rooms[1].jobs)).forEach(function (k) {
    const j = w.res.rooms[1].jobs[k];
    if (j && typeof j.answer_line === 'string') texts.push({ source: 'live ' + k + ' answer line', text: j.answer_line, complete: false });
  });
  const bad = [];
  const byKind = {};
  let lines = 0;
  texts.forEach(function (t) {
    t.text.split('\n').forEach(function (raw) {
      const line = raw.replace(/\[[^\]]*\]/g, '');
      if (!line.trim()) return;
      lines += 1;
      lintLine(line, { complete: t.complete }).forEach(function (v) {
        bad.push(t.source + ': ' + v.rule + '=' + v.match + ' in "' + tail(raw, 90) + '"');
        const kind = t.source.replace(/^[a-z0-9-]+ /, '') + ' ' + v.rule;
        byKind[kind] = (byKind[kind] || 0) + 1;
      });
    });
  });
  const kinds = Object.keys(byKind).sort().map(function (k) { return k + '=' + byKind[k]; }).join(', ');
  process.stdout.write('  LINT measured: ' + texts.length + ' texts, ' + lines + ' lines, violations ' + bad.length + (bad.length ? ' by kind: ' + kinds : '') + '\n');
  check(bad.length === 0, bad.length + ' violations (' + kinds + '), first: ' + bad.slice(0, 2).join(' || '));
});

// -- run -------------------------------------------------------------------------------------
let pass = 0;
let fail = 0;
let known = 0;
async function main() {
  process.stdout.write('Phase 369.2-32 and 369.2-33 closure test (X0, RD, R355, D1-D12, WL, PF, TV, BL, OK, SC, LINT)\n');
  for (const l of LEGS) {
    try {
      const out = await l.fn();
      if (out && out.known) {
        known += 1;
        process.stdout.write('KNOWN ' + l.id + ' (' + out.known.owner + '): ' + out.known.signature + '\n');
        continue;
      }
      pass += 1;
      process.stdout.write('PASS: ' + l.id + ' ' + l.title + '\n');
    } catch (e) {
      fail += 1;
      process.stdout.write('FAIL: ' + l.id + ' - ' + tail(e && e.message ? e.message : e, 900) + '\n');
    }
  }
  const after = listing(REAL_RECEIPT_DIR);
  if (after !== REAL_RECEIPTS_BEFORE) {
    fail += 1;
    process.stdout.write('FAIL: ISO - ~/.mindrian/release-real-room changed during the run (before: ' + REAL_RECEIPTS_BEFORE + ', after: ' + after + ')\n');
  }
  process.stdout.write('PASS: ' + pass + ' FAIL: ' + fail + ' KNOWN: ' + known + '\n');
  process.exitCode = fail > 0 ? 1 : 0;
}

main().then(function () { process.exit(process.exitCode || 0); }, function (e) {
  process.stdout.write('FAIL: harness - ' + tail(e && e.stack ? e.stack : e, 600) + '\n');
  process.exit(1);
});
