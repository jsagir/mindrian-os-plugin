#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 369.2 Plan 03 -- the W1 (beta.61) bar, written RED on purpose.
 *
 * WHAT: a hermetic run of scripts/real-room-run.cjs on a COPY of tests/fixtures/release-room whose
 * quick question set was rewritten to name a fenced city (Haifa), an invented venture
 * (Nimbus Robotics) and an invented person with a degree (Orla Venn PhD). Every name here is
 * invented (HARD RULE: no real names in the repo). Each string trips a different CONTENT-SET
 * pattern of the egress guard today, so the guard refuses to let the room search for them.
 *
 * THE BAR (turns GREEN only when the whole of wave W1 has landed, plans 01 to 11):
 *   C1 quick     the quick run is sent after one grant with those strings unchanged; the replay log
 *                (what left) and the audit ledger (what was recorded) both hold them; no
 *                unknown_error in the quick run's audit records
 *   C2 deep      the deep run runs at least one lane and none of its audit records is unknown_error
 *   C3 perspective  a perspective plan (eureka, quick) reaches the web: a researchable openalex leaf,
 *                one approved review, run-quick answers done, and the replay log gains a string of
 *                that plan
 *   C4 card      the plan answer for the rewritten set carries a grant card whose body lists every
 *                composed search string of the plan, byte for byte
 *   C5 Theo      the Brain client still refuses the city: egress_blocked, content_set, zero requests
 *                on the wire
 *   C6 offline   the same run with --offline sends nothing: plan only, zero search strings in the
 *                replay log, no receipt
 *
 * Expected on HEAD today (plan 03 time): C1 FAIL, C4 FAIL, C5 PASS, C6 PASS; C2 and C3 are
 * measured and recorded in the plan SUMMARY.
 *
 * HERMETIC: HOME, USERPROFILE, MINDRIAN_ROOMS_HOME and the receipt dir are temp dirs; OpenAlex is
 * routed through the replay preload (tests/helpers/replay-route-3692.cjs) which logs every search
 * string to MOS_3692_REPLAY_LOG; the Brain URL points at a dead loopback port. No receipt is ever
 * written under ~/.mindrian/release-real-room (the run checks that listing is unchanged).
 *
 * Output: one `PASS: <leg>` or `FAIL: <leg> - <why>` line per leg, then `PASS: <n> FAIL: <n>`.
 * Exit 0 only when every leg passes. Hyphens only, no em-dash or en-dash.
 */

process.removeAllListeners('warning');

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const RUN_SCRIPT = path.join(ROOT, 'scripts', 'real-room-run.cjs');
const PLANNER_CLI = path.join(ROOT, 'scripts', 'research-planner.cjs');
const SEED_SRC = path.join(ROOT, 'tests', 'fixtures', 'release-room');
const ROUTE_MODULE = path.join(__dirname, 'helpers', 'replay-route-3692.cjs');

// the invented strings the bar sends (the composer renders ws.exact as a quoted phrase)
const TERM_CITY = 'Nimbus Robotics cold lockers Haifa';
const TERM_PERSON = 'Orla Venn PhD cold storage';
const LINE_CITY = '"' + TERM_CITY + '"';
const LINE_PERSON = '"' + TERM_PERSON + '"';
const THEO_QUESTION = 'How do I price my product for Haifa customers?';

// the real home, read before any override, only to prove the run left it alone
const REAL_HOME = os.homedir();
const REAL_RECEIPT_DIR = path.join(REAL_HOME, '.mindrian', 'release-real-room');

// -- tmp ------------------------------------------------------------------------
const TMP = [];
function mk(prefix) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 't3692-w1-' + prefix + '-'));
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

// -- the hermetic world ----------------------------------------------------------------
const HOME = mk('home');
const PRELOAD_DIR = mk('preload');
const { writeReplayPreload } = require('./helpers/openalex-replay-363.cjs');
let PRELOAD_FILE;
try {
  // plan 02's seam, when it is on disk; the plain replay preload otherwise (no dependency on plan 02)
  const seam = path.join(__dirname, 'helpers', 'real-corpus-3692.cjs');
  if (fs.existsSync(seam) && typeof require(seam).writePreload === 'function') {
    PRELOAD_FILE = require(seam).writePreload(PRELOAD_DIR, ROUTE_MODULE);
  }
} catch (_e) { PRELOAD_FILE = undefined; }
if (typeof PRELOAD_FILE !== 'string' || !fs.existsSync(PRELOAD_FILE)) {
  PRELOAD_FILE = writeReplayPreload(PRELOAD_DIR, { routeModulePath: ROUTE_MODULE });
}

function envFor(logFile, receiptDir, roomsHome) {
  const env = Object.assign({}, process.env, {
    HOME: HOME,
    USERPROFILE: HOME,
    MINDRIAN_ROOMS_HOME: roomsHome,
    MINDRIAN_REAL_ROOM_RECEIPT_DIR: receiptDir,
    MINDRIAN_BRAIN_URL: 'http://127.0.0.1:9',
    MINDRIAN_BRAIN_KEY: 'test-key-not-real',
    NODE_OPTIONS: '--require ' + PRELOAD_FILE,
    MOS_3692_REPLAY_LOG: logFile,
  });
  delete env.CLAUDE_CODE_SESSION_ID;
  delete env.MINDRIAN_ACTIVE_SESSION_ID;
  delete env.TAVILY_API_KEY;
  return env;
}

// a copy of the release room whose quick question set names the city, the venture and the person
function rewrittenSeed(label) {
  const dir = path.join(mk('seed-' + label), 'release-room');
  fs.cpSync(SEED_SRC, dir, { recursive: true });
  const file = path.join(dir, 'question-set-quick.json');
  const qs = JSON.parse(fs.readFileSync(file, 'utf8'));
  qs.leaves[0].slots.term = TERM_CITY;
  qs.leaves[1].slots.term = TERM_PERSON;
  fs.writeFileSync(file, JSON.stringify(qs, null, 2) + '\n', 'utf8');
  return { dir: dir, quickSet: file };
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

// one hermetic real-room-run; never touches a real receipt dir or ~/MindrianRooms
function roomRun(label, flags) {
  const world = { label: label, log: path.join(mk('log-' + label), 'replay.jsonl'), receipts: mk('rcpt-' + label), rooms: mk('rooms-' + label), seed: rewrittenSeed(label) };
  fs.writeFileSync(world.log, '', 'utf8');
  const args = [RUN_SCRIPT, '--seed', world.seed.dir, '--json', '--receipt-dir', world.receipts, '--rooms-home', world.rooms].concat(flags);
  const r = cp.spawnSync(process.execPath, args, { cwd: ROOT, env: envFor(world.log, world.receipts, world.rooms), encoding: 'utf8', timeout: 300000, maxBuffer: 64 * 1024 * 1024 });
  world.code = r.status;
  world.stderr = String(r.stderr || '');
  world.res = lastJson(r.stdout);
  world.roomDir = world.res && world.res.room ? world.res.room.dir : null;
  return world;
}

function planner(world, args) {
  const r = cp.spawnSync(process.execPath, [PLANNER_CLI].concat(args).concat(['--room', world.roomDir]), { cwd: ROOT, env: envFor(world.log, world.receipts, world.rooms), encoding: 'utf8', timeout: 300000, maxBuffer: 32 * 1024 * 1024 });
  let json = null;
  try { json = JSON.parse(String(r.stdout || '').trim()); } catch (_e) { json = null; }
  return { code: r.status, json: json, stderr: String(r.stderr || '') };
}

// every search string that reached the replay fetch (the OpenAlex reachability HEAD has q null, skipped)
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

function auditRecords(roomDir) {
  let text = '';
  try { text = fs.readFileSync(path.join(roomDir, '.mindrian', 'research-audit.jsonl'), 'utf8'); } catch (_e) { return []; }
  const out = [];
  text.split('\n').forEach(function (l) {
    if (!l.trim()) return;
    try { out.push(JSON.parse(l)); } catch (_e) { /* skip */ }
  });
  return out;
}

function planQueries(roomDir, runId) {
  let plan = null;
  try { plan = JSON.parse(fs.readFileSync(path.join(roomDir, '.mindrian', 'research-runs', runId, 'plan.json'), 'utf8')); } catch (_e) { return { plan: null, qs: [] }; }
  const seen = {};
  const qs = [];
  (Array.isArray(plan.leaves) ? plan.leaves : []).forEach(function (leaf) {
    (Array.isArray(leaf.queries) ? leaf.queries : []).forEach(function (q) {
      if (typeof q.q === 'string' && !seen[q.q]) { seen[q.q] = true; qs.push(q.q); }
    });
  });
  return { plan: plan, qs: qs };
}

// -- arms --------------------------------------------------------------------------------
let pass = 0;
let fail = 0;
function check(cond, msg) { if (!cond) throw new Error(msg); }
async function arm(label, fn) {
  try {
    await fn();
    pass += 1;
    process.stdout.write('PASS: ' + label + '\n');
  } catch (e) {
    fail += 1;
    process.stdout.write('FAIL: ' + label + ' - ' + tail(e && e.message ? e.message : e, 700) + '\n');
  }
}

function needRun(world) {
  check(world.res && world.res.ok === true, world.label + ' run did not answer ok (exit ' + world.code + '): ' + tail(world.stderr, 400));
  check(typeof world.roomDir === 'string' && fs.existsSync(world.roomDir), world.label + ' run did not birth a room');
}

async function main() {
  process.stdout.write('Phase 369.2-03 W1 closure bar (beta.61), RED until plans 01 to 11 land\n');
  const live = roomRun('live', ['--read-by', 'test-3692']);
  const offline = roomRun('offline', ['--offline']);

  await arm('C1 quick: Haifa, the venture and the named person are sent unchanged after one grant, logged and audited', function () {
    needRun(live);
    check(live.code === 0, 'exit ' + live.code);
    const q = live.res.jobs.quick;
    check(q.status === 'ran', 'jobs.quick.status is ' + JSON.stringify(q.status) + ' (' + tail(q.reason, 160) + '), not ran');
    [LINE_CITY, LINE_PERSON].forEach(function (s) {
      check(q.lines.indexOf(s) !== -1, 'jobs.quick.lines lacks ' + s + '; has ' + JSON.stringify(q.lines));
    });
    const sent = sentStrings(live.log);
    [LINE_CITY, LINE_PERSON].forEach(function (s) {
      check(sent.indexOf(s) !== -1, 'the replay log (what left) lacks ' + s + '; it holds ' + sent.length + ' strings');
    });
    const audit = auditRecords(live.roomDir).filter(function (r) { return r.run_id === q.run_id; });
    [LINE_CITY, LINE_PERSON].forEach(function (s) {
      check(audit.some(function (r) { return r.q === s; }), 'the audit ledger lacks a record with q ' + s);
    });
    const bad = audit.filter(function (r) { return r.failure_class === 'unknown_error'; });
    check(bad.length === 0, bad.length + ' quick audit record(s) carry failure_class unknown_error');
  });

  await arm('C2 deep: at least one lane ran and no audit record of the deep run is unknown_error', function () {
    needRun(live);
    const d = live.res.jobs.deep;
    check(d.lanes_ran >= 1, 'jobs.deep.lanes_ran is ' + d.lanes_ran + ' (status ' + d.status + ', ' + tail(d.reason, 160) + ')');
    const audit = auditRecords(live.roomDir).filter(function (r) { return r.run_id === d.run_id; });
    check(audit.length > 0, 'no audit record for the deep run ' + d.run_id);
    const bad = audit.filter(function (r) { return r.failure_class === 'unknown_error'; });
    check(bad.length === 0, bad.length + ' deep audit record(s) carry failure_class unknown_error');
  });

  await arm('C3 perspective: an eureka quick plan reaches the web (researchable openalex leaf, approved, run-quick done, replay log gains a plan string)', function () {
    needRun(live);
    const before = sentStrings(live.log).length;
    const rec = planner(live, ['perspective-recall', '--perspective', 'eureka', '--mode', 'quick']);
    check(rec.code === 0 && rec.json && rec.json.ok === true, 'perspective-recall failed (exit ' + rec.code + '): ' + tail(rec.stderr, 300));
    const runId = rec.json.plan && rec.json.plan.run_id;
    check(typeof runId === 'string', 'perspective-recall returned no plan run id');
    const pq = planQueries(live.roomDir, runId);
    check(pq.plan !== null, 'plan.json for ' + runId + ' not on disk');
    const web = (Array.isArray(pq.plan.leaves) ? pq.plan.leaves : []).filter(function (l) { return l.researchable === true && l.corpus === 'openalex'; });
    check(web.length >= 1, 'no leaf with researchable true and corpus openalex');
    const appr = planner(live, ['review', 'approve', runId, '--approved-via', 'cli']);
    check(appr.code === 0 && appr.json && appr.json.ok !== false, 'review approve refused: ' + tail(JSON.stringify(appr.json), 300));
    const ran = planner(live, ['run-quick', runId]);
    check(ran.code === 0 && ran.json && ran.json.status === 'done', 'run-quick did not answer done: ' + tail(JSON.stringify(ran.json), 300));
    const gained = sentStrings(live.log).slice(before);
    check(gained.some(function (s) { return pq.qs.indexOf(s) !== -1; }), 'the replay log gained no string of the plan (plan strings ' + pq.qs.length + ', gained ' + gained.length + ')');
  });

  await arm('C4 card: the plan answer lists every composed search string in its grant card, byte for byte', function () {
    needRun(offline);
    const plan = planner(offline, ['plan', offline.seed.quickSet, '--mode', 'quick']);
    check(plan.code === 0 && plan.json && plan.json.ok === true, 'plan failed (exit ' + plan.code + '): ' + tail(plan.stderr, 300));
    const j = plan.json;
    const pq = planQueries(offline.roomDir, j.run_id);
    check(pq.qs.length > 0, 'the plan composed no search string (status ' + j.status + ', next ' + j.next + ', local_only_leaves ' + JSON.stringify(j.local_only_leaves || []) + ')');
    [LINE_CITY, LINE_PERSON].forEach(function (s) {
      check(pq.qs.indexOf(s) !== -1, 'the plan did not compose ' + s);
    });
    const card = j.card;
    check(card && typeof card.body_md === 'string', 'the plan answer carries no card body');
    const missing = pq.qs.filter(function (s) { return card.body_md.indexOf(s) === -1; });
    check(missing.length === 0, 'the card body (' + card.title + ') does not list ' + missing.length + ' of ' + pq.qs.length + ' composed strings, first: ' + missing[0]);
  });

  await arm('C5 Theo: the Brain client still refuses the city (egress_blocked, content_set, zero requests on the wire)', async function () {
    process.env.HOME = HOME;
    process.env.USERPROFILE = HOME;
    const capture = require('./helpers/brain-capture-server.cjs');
    const started = await capture.startCaptureServer();
    try {
      process.env.MINDRIAN_BRAIN_URL = started.url;
      process.env.MINDRIAN_BRAIN_KEY = 'test-key-not-real';
      const clientPath = path.join(ROOT, 'lib', 'core', 'brain-client.cjs');
      delete require.cache[require.resolve(clientPath)];
      const brain = require(clientPath);
      capture.resetCaptured();
      const out = await brain.ask(THEO_QUESTION);
      check(out && out.error === 'egress_blocked', 'ask did not answer egress_blocked: ' + tail(JSON.stringify(out), 300));
      check(out.egress_class === 'content_set', 'egress_class is ' + JSON.stringify(out.egress_class) + ', not content_set');
      check(capture.captured.length === 0, 'the wire saw ' + capture.captured.length + ' request(s): ' + tail(JSON.stringify(capture.captured), 300));
    } finally {
      await capture.stopCaptureServer(started.server);
    }
  });

  await arm('C6 offline: --offline sends nothing (plan only, zero search strings in the replay log, no receipt)', function () {
    needRun(offline);
    check(offline.code === 0, 'exit ' + offline.code);
    check(offline.res.jobs.quick.status === 'plan only', 'jobs.quick.status is ' + JSON.stringify(offline.res.jobs.quick.status) + ', not plan only');
    const sent = sentStrings(offline.log);
    check(sent.length === 0, 'the replay log holds ' + sent.length + ' search string(s): ' + tail(JSON.stringify(sent), 300));
    const receipts = fs.existsSync(offline.receipts) ? fs.readdirSync(offline.receipts).filter(function (f) { return /\.json$/.test(f); }) : [];
    check(receipts.length === 0, 'an offline run wrote a receipt: ' + receipts.join(', '));
  });

  // isolation guard: the run must never have written a receipt under the real home
  const after = listing(REAL_RECEIPT_DIR);
  if (after !== REAL_RECEIPTS_BEFORE) {
    fail += 1;
    process.stdout.write('FAIL: ISO - ~/.mindrian/release-real-room changed during the run (before: ' + REAL_RECEIPTS_BEFORE + ', after: ' + after + ')\n');
  }

  process.stdout.write('PASS: ' + pass + ' FAIL: ' + fail + '\n');
  process.exitCode = fail > 0 ? 1 : 0;
}

main().catch(function (e) {
  process.stdout.write('FAIL: harness - ' + tail(e && e.stack ? e.stack : e, 600) + '\n');
  process.stdout.write('PASS: ' + pass + ' FAIL: ' + (fail + 1) + '\n');
  process.exitCode = 1;
});
