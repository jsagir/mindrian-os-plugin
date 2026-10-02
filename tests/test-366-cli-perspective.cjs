#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 366 Plan 12 Task 2 (EPV366-04, D-07): the CLI door reaches every perspective through one
 * subcommand family, perspective-recall and perspective-judge, with --perspective validated against
 * the same frozen list as the MCP enum. eureka-recall and eureka-judge stay and call the same
 * handlers with 'eureka'.
 *
 *   L1  perspective-recall --perspective eureka prints ok JSON with the same candidates as eureka-recall
 *   L2  a missing --perspective refuses perspective_required (not room_required), exit 2
 *   L3  --perspective bogus refuses, exit 2
 *   L4  free text on argv refuses free_text_argv_refused, exit 2, the token is never echoed
 *   L5  eureka-recall and eureka-judge produce the same output as the perspective subcommands
 *   L6  perspective-judge --judge none writes verdicts
 *
 * Hermetic: spawnSync node, HOME and MINDRIAN_ROOMS_HOME temp dirs, no network keys.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const TMP_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-366-cli-home-'));
const TMP_ROOMS = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-366-cli-roomshome-'));
process.env.HOME = TMP_HOME;
process.env.USERPROFILE = TMP_HOME;
process.env.MINDRIAN_ROOMS_HOME = TMP_ROOMS;
delete process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.CLAUDE_CODE_SESSION_ID;
delete process.env.MINDRIAN_MCP_FIRST;

try { require('node:sqlite'); } catch (_e) {
  process.stdout.write('ENV GAP: node:sqlite unavailable (node ' + process.version + '); need node >= 22\n');
  process.exit(77);
}

const REPO_ROOT = path.resolve(__dirname, '..');
const hygiene = require(path.join(REPO_ROOT, 'tests/helpers/hygiene-355.cjs'));
hygiene.scrubVendorKey && hygiene.scrubVendorKey();
const C = hygiene.makeChecker('test-366-cli-perspective');
const fixture = require(path.join(REPO_ROOT, 'tests/helpers/fixture-366.cjs'));
const registry = require(path.join(REPO_ROOT, 'lib/core/research-planner/perspectives/index.cjs'));

const CLI = path.join(REPO_ROOT, 'scripts', 'research-planner.cjs');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-366-cli-'));
const room = fixture.buildPerspectiveRoom(root, { name: 'room' });
const R = room.roomDir;

function cli(args) {
  const env = Object.assign({}, process.env, { HOME: TMP_HOME, USERPROFILE: TMP_HOME, MINDRIAN_ROOMS_HOME: TMP_ROOMS });
  delete env.CLAUDE_ACTIVE_ROOM;
  delete env.CLAUDE_CODE_SESSION_ID;
  delete env.ANTHROPIC_API_KEY;
  delete env.OPENALEX_API_KEY;
  delete env.TYPESAFE_API_KEY;
  const res = spawnSync(process.execPath, [CLI].concat(args), { encoding: 'utf8', env: env, timeout: 90000 });
  let json = null;
  try { json = JSON.parse(String(res.stdout || '').trim()); } catch (_e) { json = null; }
  return { code: res.status, stdout: String(res.stdout || ''), stderr: String(res.stderr || ''), json: json };
}
function leg(name, fn) {
  let ok;
  try { ok = fn(); } catch (e) { ok = 'threw: ' + String(e && e.stack ? e.stack : e).slice(0, 400); }
  C.check(name, ok === true, ok === true ? '' : String(ok));
}
// the run-specific parts of a recall body: the plan run_id is minted fresh on every call
function stable(j) {
  const c = JSON.parse(JSON.stringify(j));
  if (c && c.plan) c.plan.run_id = c.plan.run_id ? 'RUN' : null;
  return JSON.stringify(c);
}

const TAG1 = '20261002T000101Z';
const TAG2 = '20261002T000102Z';

const p1 = cli(['perspective-recall', '--room', R, '--perspective', 'eureka', '--tag', TAG1]);
const e1 = cli(['eureka-recall', '--room', R, '--tag', TAG2]);

leg('L1 perspective-recall eureka prints ok JSON with the same candidates as eureka-recall', function () {
  const ok = p1.code === 0 && p1.json && p1.json.ok === true && p1.json.perspective === 'eureka' && p1.json.run_tag === TAG1
    && Array.isArray(p1.json.top) && p1.json.top.length >= 1
    && e1.code === 0 && e1.json && e1.json.ok === true
    && JSON.stringify(p1.json.top) === JSON.stringify(e1.json.top)
    && JSON.stringify(p1.json.counts) === JSON.stringify(e1.json.counts);
  return ok || JSON.stringify({ p1: p1.code, e1: e1.code, out: p1.stdout.slice(0, 200), err: p1.stderr.slice(0, 120) });
});

leg('L1b every registered perspective is reachable through perspective-recall', function () {
  const bad = [];
  registry.PERSPECTIVE_IDS.forEach(function (id, n) {
    const r = cli(['perspective-recall', '--room', R, '--perspective', id, '--tag', '2026100200' + (20 + n) + 'Z']);
    if (!(r.code === 0 && r.json && r.json.ok === true && r.json.perspective === id)) bad.push(id + ':' + r.code + ':' + r.stdout.slice(0, 100));
  });
  return bad.length === 0 || bad.join(' | ');
});

leg('L2 a missing --perspective refuses perspective_required (not room_required), exit 2', function () {
  const r = cli(['perspective-recall', '--room', R]);
  const j = cli(['perspective-judge', '--room', R, '--tag', TAG1]);
  const ok = r.code === 2 && r.json && r.json.ok === false && r.json.reason === 'perspective_required'
    && j.code === 2 && j.json && j.json.reason === 'perspective_required';
  return ok || JSON.stringify({ r: r.stdout.slice(0, 160), j: j.stdout.slice(0, 160) });
});

leg('L3 --perspective bogus refuses with exit 2 and never echoes the value', function () {
  const r = cli(['perspective-recall', '--room', R, '--perspective', 'bogus-perspective-zz']);
  const ok = r.code === 2 && r.json && r.json.ok === false && r.json.reason === 'free_text_argv_refused'
    && (r.stdout + r.stderr).indexOf('bogus-perspective-zz') === -1;
  return ok || JSON.stringify({ code: r.code, out: r.stdout.slice(0, 160) });
});

leg('L4 free text on argv refuses free_text_argv_refused with exit 2 and the token is not echoed', function () {
  const r = cli(['perspective-recall', '--room', R, '--perspective', 'eureka', 'my idea']);
  const r2 = cli(['perspective-recall', 'my secret idea', '--room', R, '--perspective', 'eureka']);
  const ok = r.code === 2 && r.json && r.json.reason === 'free_text_argv_refused' && r2.code === 2 && r2.json && r2.json.reason === 'free_text_argv_refused'
    && (r.stdout + r.stderr + r2.stdout + r2.stderr).indexOf('idea') === -1;
  return ok || JSON.stringify({ r: r.stdout.slice(0, 160), r2: r2.stdout.slice(0, 160) });
});

leg('L5 eureka-recall and eureka-judge produce the same output as the perspective subcommands', function () {
  const TAG = '20261002T000103Z';
  const a = cli(['perspective-recall', '--room', R, '--perspective', 'eureka', '--tag', TAG]);
  const b = cli(['eureka-recall', '--room', R, '--tag', TAG]);
  const ja = cli(['perspective-judge', '--room', R, '--perspective', 'eureka', '--tag', TAG, '--judge', 'none']);
  const jb = cli(['eureka-judge', '--room', R, '--tag', TAG, '--judge', 'none']);
  const ok = a.code === 0 && b.code === 0 && stable(a.json) === stable(b.json)
    && ja.code === 0 && jb.code === 0 && JSON.stringify(ja.json) === JSON.stringify(jb.json);
  return ok || JSON.stringify({ a: a.stdout.slice(0, 200), b: b.stdout.slice(0, 200), ja: ja.stdout.slice(0, 160), jb: jb.stdout.slice(0, 160) });
});

leg('L6 perspective-judge --judge none writes verdicts', function () {
  const j = cli(['perspective-judge', '--room', R, '--perspective', 'eureka', '--tag', TAG1, '--judge', 'none']);
  const file = j.json && j.json.file;
  const ok = j.code === 0 && j.json && j.json.ok === true && j.json.perspective === 'eureka' && j.json.summary && j.json.summary.judge === 'none'
    && typeof file === 'string' && fs.existsSync(file) && fs.readFileSync(file, 'utf8').trim().length > 0;
  const miss = cli(['perspective-judge', '--room', R, '--perspective', 'eureka', '--tag', '20990101T000000Z']);
  const okMiss = miss.code === 2 && miss.json && miss.json.reason === 'candidates_missing';
  return (ok && okMiss) || JSON.stringify({ j: j.stdout.slice(0, 200), miss: miss.stdout.slice(0, 120) });
});

try { fs.rmSync(root, { recursive: true, force: true }); } catch (_e) { /* tmp */ }
process.exit(C.summary());
