#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 369.2 Plan 29 (R22): the four canvas commands that used to stop at a plan template run
 * through the research planner end to end.
 *
 * Plain English: /mos:find-bottlenecks, /mos:find-analogies, /mos:find-connections and
 * /mos:scout hsi each have a perspective module that can recall a plan from the room, but the
 * command bodies never said to call it. Each body now carries a "Plan-run route" section that
 * follows the eureka pattern: recall, plan review card, run, evidence card, basket card.
 *
 *   FC1  each of the four command files has the heading "Plan-run route", the exact recall line for
 *        its perspective (rs, analogies, connections, hsi), and the words review approve, run-quick
 *        and basket; every approval step names AskUserQuestion; frontmatter is unchanged
 *   FC2  through the CLI on a fixture room, perspective-recall for rs, analogies, connections and hsi
 *        answers ok with a READY plan (one the navigator can approve) holding at least one researchable
 *        leaf on openalex
 *   FC3  one full route (rs) reaches run-quick status done through the replay, and the replay log
 *        holds the plan's strings
 *   FC4  the born-wired and render gates exit 0 (mirrors, connector registry, orchestration
 *        projection, render coverage, shape declaration)
 *   FC5  no em or en dash in the four command bodies' new section, nor in this file; zero real
 *        network attempts from this process
 *
 * Hermetic: HOME, USERPROFILE and MINDRIAN_ROOMS_HOME are mkdtemp dirs before any repo module loads;
 * vendor keys are deleted; OpenAlex goes through the replay preload and logs every search string.
 * Exit 77 when node:sqlite is missing. Hyphens only.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const real = require('./helpers/real-corpus-3692.cjs');
const hermetic = real.hermeticEnv();
['HOME', 'USERPROFILE', 'MINDRIAN_ROOMS_HOME', 'MINDRIAN_BRAIN_URL'].forEach(function (k) {
  process.env[k] = hermetic[k];
});
real.VENDOR_KEYS.forEach(function (k) { delete process.env[k]; });
delete process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.CLAUDE_CODE_SESSION_ID;
delete process.env.MINDRIAN_MCP_FIRST;

try { require('node:sqlite'); } catch (_e) {
  process.stdout.write('ENV GAP: node:sqlite unavailable (node ' + process.version + '); need node >= 22\n');
  process.exit(77);
}

const { installNetGuard, makeChecker } = require('./helpers/hygiene-355.cjs');
const NET = installNetGuard();
const C = makeChecker('test-3692-four-commands');

const ROOT = path.resolve(__dirname, '..');
const CLI = path.join(ROOT, 'scripts', 'research-planner.cjs');
const ROUTE_MODULE = path.join(__dirname, 'helpers', 'replay-route-3692.cjs');
const fixture = require('./helpers/fixture-366.cjs');

const FOUR = Object.freeze([
  { id: 'rs', file: 'commands/find-bottlenecks.md', skill: 'skills/find-bottlenecks/SKILL.md' },
  { id: 'analogies', file: 'commands/find-analogies.md', skill: 'skills/find-analogies/SKILL.md' },
  { id: 'connections', file: 'commands/find-connections.md', skill: 'skills/find-connections/SKILL.md' },
  { id: 'hsi', file: 'commands/scout.md', skill: 'skills/scout/SKILL.md' },
]);
const HEADING = '## Plan-run route (search the literature for what this found)';
const DASH = new RegExp('[\\u2013\\u2014]');

const scratch = [];
function mkScratch(prefix) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  scratch.push(d);
  return d;
}
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function leg(name, fn) {
  let ok;
  try { ok = fn(); } catch (e) { ok = 'threw: ' + String((e && e.stack) || e).slice(0, 400); }
  C.check(name, ok === true, ok === true ? '' : String(ok));
}
function frontmatter(text) {
  const m = /^---\n([\s\S]*?)\n---\n/.exec(text);
  return m ? m[1] : null;
}
// the Plan-run route section: from its heading to the next level-two heading or the end of the file
function section(text) {
  const at = text.indexOf(HEADING);
  if (at === -1) return null;
  const rest = text.slice(at + HEADING.length);
  const next = rest.search(/\n## /);
  return text.slice(at, next === -1 ? text.length : at + HEADING.length + next);
}

function envFor(extra) {
  const env = Object.assign({}, process.env, {
    HOME: hermetic.HOME,
    USERPROFILE: hermetic.USERPROFILE,
    MINDRIAN_ROOMS_HOME: hermetic.MINDRIAN_ROOMS_HOME,
    MINDRIAN_BRAIN_URL: 'http://127.0.0.1:9',
  }, extra || {});
  delete env.CLAUDE_ACTIVE_ROOM;
  delete env.CLAUDE_CODE_SESSION_ID;
  real.VENDOR_KEYS.forEach(function (k) { delete env[k]; });
  return env;
}
function cli(args, extra) {
  const res = spawnSync(process.execPath, [CLI].concat(args), { encoding: 'utf8', env: envFor(extra), timeout: 120000, maxBuffer: 32 * 1024 * 1024 });
  let json = null;
  const lines = String(res.stdout || '').split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
  for (let i = lines.length - 1; i >= 0 && !json; i -= 1) {
    if (lines[i][0] === '{') { try { json = JSON.parse(lines[i]); } catch (_e) { json = null; } }
  }
  if (!json) { try { json = JSON.parse(String(res.stdout || '').trim()); } catch (_e) { json = null; } }
  return { code: res.status, json: json, stdout: String(res.stdout || ''), stderr: String(res.stderr || '') };
}

const room = fixture.buildPerspectiveRoom(mkScratch('mos-3692-29-room-'), { name: 'room' });
const R = room.roomDir;

// ---- FC1 ----
leg('FC1 each command body carries the Plan-run route with its perspective, the card steps and the file step', function () {
  const problems = [];
  FOUR.forEach(function (c) {
    const text = read(c.file);
    const sec = section(text);
    if (sec === null) { problems.push(c.file + ': no heading'); return; }
    const recall = 'perspective-recall --room ROOM_DIR --perspective ' + c.id;
    if (sec.indexOf(recall) === -1) problems.push(c.file + ': no "' + recall + '"');
    ['review approve', 'run-quick', 'basket', 'file-run', 'AskUserQuestion', '--approved-via cli'].forEach(function (w) {
      if (sec.indexOf(w) === -1) problems.push(c.file + ': no "' + w + '"');
    });
    if (c.id === 'analogies' && sec.indexOf('perspective-judge --room ROOM_DIR --perspective analogies') === -1) {
      problems.push(c.file + ': no perspective-judge line');
    }
    if (c.id === 'hsi' && !/\/mos:scout hsi/.test(sec)) problems.push(c.file + ': section does not name /mos:scout hsi');
    if (frontmatter(text) === null) problems.push(c.file + ': no frontmatter');
  });
  console.log('FC1 measured: ' + FOUR.filter(function (c) { return section(read(c.file)) !== null; }).length + ' of 4 command files have the heading');
  return problems.length === 0 || problems.join('; ');
});

leg('FC1b the frontmatter of the four commands is byte-identical to HEAD', function () {
  const problems = [];
  FOUR.forEach(function (c) {
    const head = spawnSync('git', ['show', 'HEAD:' + c.file], { cwd: ROOT, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
    if (head.status !== 0) { problems.push(c.file + ': git show failed'); return; }
    if (frontmatter(head.stdout) !== frontmatter(read(c.file))) problems.push(c.file + ': frontmatter moved');
  });
  return problems.length === 0 || problems.join('; ');
});

// ---- FC2 ----
const TAGS = { rs: '20261006T000001Z', analogies: '20261006T000002Z', connections: '20261006T000003Z', hsi: '20261006T000004Z' };
const recalls = {};
FOUR.forEach(function (c) {
  leg('FC2 perspective-recall ' + c.id + ' answers ok with a researchable openalex leaf', function () {
    const r = cli(['perspective-recall', '--room', R, '--perspective', c.id, '--tag', TAGS[c.id], '--mode', 'quick']);
    recalls[c.id] = r;
    const j = r.json;
    if (r.code !== 0 || !j || j.ok !== true) return 'recall ' + r.code + ' ' + r.stdout.slice(0, 200) + ' ' + r.stderr.slice(0, 120);
    const plan = j.plan;
    if (!plan || plan.ok === false || !plan.run_id) return 'no plan: ' + JSON.stringify(plan).slice(0, 200);
    // a plan the navigator cannot approve is no route: review approve refuses anything but ready
    if (plan.status !== 'ready') return 'plan status ' + plan.status + ' (' + JSON.stringify(plan.errors).slice(0, 160) + ')';
    const loaded = JSON.parse(fs.readFileSync(path.join(R, '.mindrian', 'research-runs', plan.run_id, 'plan.json'), 'utf8'));
    const leaves = Array.isArray(loaded.leaves) ? loaded.leaves : [];
    const web = leaves.filter(function (l) { return l && l.researchable === true && l.corpus === 'openalex'; });
    console.log('FC2 measured: ' + c.id + ' leaves=' + leaves.length + ' researchable openalex=' + web.length);
    return web.length >= 1 || ('no researchable openalex leaf among ' + leaves.length);
  });
});

// ---- FC3 ----
leg('FC3 one full route (rs): review approve, then run-quick answers done; the replay log holds the plan strings', function () {
  const rec = recalls.rs;
  if (!rec || !rec.json || !rec.json.plan || !rec.json.plan.run_id) return 'no rs plan from FC2';
  const runId = rec.json.plan.run_id;
  const dir = mkScratch('mos-3692-29-replay-');
  const preload = real.writePreload(path.join(dir, 'preload'), ROUTE_MODULE);
  const logFile = path.join(dir, 'replay.jsonl');
  fs.writeFileSync(logFile, '', 'utf8');
  const extra = { NODE_OPTIONS: '--require ' + preload, MOS_3692_REPLAY_LOG: logFile };
  const approved = cli(['review', 'approve', runId, '--room', R, '--approved-via', 'cli'], extra);
  console.log('FC3 measured: review approve code=' + approved.code + ' ok=' + (approved.json && approved.json.ok));
  if (!(approved.json && approved.json.ok === true)) return 'review approve ' + JSON.stringify(approved.json).slice(0, 300) + ' ' + approved.stderr.slice(0, 120);
  const ran = cli(['run-quick', runId, '--room', R], extra);
  const logged = real.readReplayLog(logFile).map(function (x) { return x.q; }).filter(function (q) { return typeof q === 'string'; });
  const plan = JSON.parse(fs.readFileSync(path.join(R, '.mindrian', 'research-runs', runId, 'plan.json'), 'utf8'));
  const planned = {};
  (plan.leaves || []).forEach(function (leaf) {
    (leaf.queries || []).forEach(function (q) { if (typeof q.q === 'string') planned[q.q] = true; });
  });
  const plannedList = Object.keys(planned);
  const outside = logged.filter(function (q) { return !planned[q]; });
  console.log('FC3 measured: run-quick code=' + ran.code + ' status=' + (ran.json && ran.json.status) + ' logged=' + logged.length + ' planned strings=' + plannedList.length + ' outside plan=' + outside.length);
  if (!(ran.json && ran.json.status === 'done')) return 'run-quick ' + JSON.stringify(ran.json).slice(0, 300) + ' ' + ran.stderr.slice(0, 120);
  if (logged.length === 0) return 'the replay log is empty';
  return outside.length === 0 || ('searches left that are not in the plan: ' + outside.slice(0, 2).join(' | '));
});

// ---- FC4 ----
const GATES = Object.freeze([
  ['build-skill-mirrors', ['scripts/build-skill-mirrors.cjs', '--check']],
  ['build-connector-registry', ['scripts/build-connector-registry.cjs', '--check']],
  ['build-orchestration-projection', ['scripts/build-orchestration-projection.cjs', '--check']],
  ['check-render-coverage', ['scripts/check-render-coverage.cjs']],
  ['check-shape-declaration', ['scripts/check-shape-declaration.cjs', '--check']],
]);
GATES.forEach(function (g) {
  leg('FC4 ' + g[0] + ' exits 0', function () {
    const r = spawnSync(process.execPath, g[1].map(function (a, i) { return i === 0 ? path.join(ROOT, a) : a; }), { cwd: ROOT, encoding: 'utf8', env: envFor(), timeout: 240000, maxBuffer: 32 * 1024 * 1024 });
    console.log('FC4 measured: ' + g[0] + ' exit=' + r.status);
    return r.status === 0 || ('exit ' + r.status + ' ' + String(r.stdout || r.stderr).slice(-300).replace(/\s+/g, ' '));
  });
});

// ---- FC5 ----
leg('FC5 no em or en dash in the new sections, the four mirrors, or this test; zero network attempts', function () {
  const problems = [];
  FOUR.forEach(function (c) {
    const sec = section(read(c.file));
    if (sec !== null && DASH.test(sec)) problems.push(c.file + ': dash in the section');
    const msec = section(read(c.skill));
    if (msec === null) problems.push(c.skill + ': mirror has no section');
    else if (DASH.test(msec)) problems.push(c.skill + ': dash in the mirror section');
  });
  if (DASH.test(fs.readFileSync(__filename, 'utf8'))) problems.push('this test file carries a dash');
  if (NET.attempts() !== 0) problems.push('network attempts ' + NET.attempts());
  return problems.length === 0 || problems.join('; ');
});

scratch.forEach(function (d) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_e) { /* best effort */ } });
process.exit(C.summary());
