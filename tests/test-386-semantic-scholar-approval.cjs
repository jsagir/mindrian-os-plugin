#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 386 plan 05 (S2): the Semantic Scholar path sits behind the shared web
 * path gate (lib/core/web-path-gate.cjs).
 * Debug session: whitespace-external-semantic-scholar-ungated-egress.
 *
 * Owner decision 2026-11-06 (card answer "Extend the ruling"): approval card
 * first (the exact strings), then a credential check, plus an audit record.
 * No content scan runs on this line.
 *
 * Arms:
 *   S1  no token: 0 fetch calls, non-zero exit, approval is needed
 *   S2  --list-queries prints queries and token, 0 fetch calls, exit 0
 *   S3  --approve with the listed token sends; each URL query equals a listed query
 *   S4  --approve with a wrong token: 0 fetch calls, non-zero exit
 *   S5  a credential-shaped query is refused before any fetch, even with a matching token
 *   S6  a warm cache needs no token and sends nothing
 *   S7  the dispatcher "external" without a token: 0 fetch calls, list and approval line shown
 *   S7b the dispatcher with the token sends only the listed queries
 *   S8  an approved run leaves one audit record per sent query, provider semantic_scholar
 *   S9  a title with a person name, a city and a company name is sent after approval
 *   S10 the approval step in commands/whitespace.md exists and has no word grant
 *
 * The network is a counter loaded with node --require. Synthetic strings only.
 * Fake credentials are built at run time. No em dash or en dash.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const SCRIPT = path.join(ROOT, 'scripts', 'query-semantic-scholar.cjs');
const DISPATCH = path.join(ROOT, 'scripts', 'whitespace-command.cjs');
const COMMAND_MD = path.join(ROOT, 'commands', 'whitespace.md');
const LEDGER = path.join(ROOT, 'lib', 'core', 'research-planner', 'audit-ledger.cjs');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'mos386-s2-'));
const HOME = path.join(TMP, 'home');
fs.mkdirSync(HOME, { recursive: true });

const PRELOAD = path.join(TMP, 'fetch-counter.cjs');
fs.writeFileSync(PRELOAD, [
  "'use strict';",
  "const fs = require('node:fs');",
  'globalThis.fetch = async function counted(url) {',
  '  let q = null;',
  "  try { q = new URL(String(url)).searchParams.get('query'); } catch (_e) { q = null; }",
  "  fs.appendFileSync(process.env.S386_COUNTER, (q === null ? '(no query)' : q) + '\\n');",
  '  return { ok: false, status: 500, json: async function () { return {}; } };',
  '};',
  '',
].join('\n'));

let failures = 0;
function ok(label, detail) { console.log('ok - ' + label + (detail ? ' ' + detail : '')); }
function fail(label, detail) { failures += 1; console.log('FAIL - ' + label + (detail ? ': ' + detail : '')); }
function check(label, problems, detail) {
  if (problems.length === 0) ok(label, detail); else fail(label, problems.join('; '));
}

let roomSeq = 0;
function mkRoom(titles, extra) {
  roomSeq += 1;
  const dir = path.join(TMP, 'room-' + roomSeq);
  const md = path.join(dir, '.mindrian');
  fs.mkdirSync(md, { recursive: true });
  fs.writeFileSync(path.join(md, 'whitespace-embeddings.json'), JSON.stringify({
    embeddings: titles.map(function (t, i) { return { title: t, section: 'sec' + i }; }),
  }));
  // stub baseline so the dispatcher never fetches the Brain baseline
  fs.writeFileSync(path.join(md, 'brain-baseline.json'), '{}');
  if (extra) extra(md);
  return dir;
}

const ORDINARY = ['Warehouse robotics adoption', 'Cold chain logistics sensors', 'Autonomous picking arms'];

function run(file, args) {
  const counter = path.join(TMP, 'counter-' + Date.now() + '-' + Math.random().toString(36).slice(2) + '.txt');
  fs.writeFileSync(counter, '');
  const r = spawnSync(process.execPath, ['--require', PRELOAD, file].concat(args), {
    encoding: 'utf8',
    timeout: 60000,
    env: Object.assign({}, process.env, {
      HOME: HOME,
      USERPROFILE: HOME,
      MINDRIAN_ROOMS_HOME: path.join(TMP, 'rooms-home'),
      S386_COUNTER: counter,
      NODE_OPTIONS: '--require ' + PRELOAD,
      OPENALEX_API_KEY: '',
      TAVILY_API_KEY: '',
      PATENTSVIEW_API_KEY: '',
    }),
  });
  const calls = fs.readFileSync(counter, 'utf8').split('\n').filter(Boolean);
  return { status: r.status, out: (r.stdout || '') + (r.stderr || ''), stdout: r.stdout || '', calls: calls };
}

function listOf(room) {
  const r = run(SCRIPT, [room, '--list-queries']);
  let j = null;
  try { j = JSON.parse(r.stdout.trim().split('\n').filter(function (l) { return l.trim().startsWith('{'); }).pop()); } catch (_e) { j = null; }
  return { r: r, json: j };
}

// ---- S1 ----------------------------------------------------------------
(function () {
  const room = mkRoom(ORDINARY);
  const r = run(SCRIPT, [room]);
  const p = [];
  if (r.calls.length !== 0) p.push(r.calls.length + ' fetch calls without a token');
  if (r.status === 0) p.push('exit 0 without a token');
  if (!/approval/i.test(r.out)) p.push('output does not say approval is needed');
  check('S1', p);
})();

// ---- S2 ----------------------------------------------------------------
let s2Json = null;
(function () {
  const room = mkRoom(ORDINARY);
  const l = listOf(room);
  s2Json = l.json;
  const p = [];
  if (l.r.calls.length !== 0) p.push(l.r.calls.length + ' fetch calls in list mode');
  if (l.r.status !== 0) p.push('exit ' + l.r.status);
  if (!l.json || !Array.isArray(l.json.queries) || l.json.queries.length === 0) p.push('no queries in the list');
  if (!l.json || typeof l.json.token !== 'string' || l.json.token.length < 16) p.push('no token in the list');
  check('S2', p);
})();

// ---- S3 and S8 (one approved run) --------------------------------------
(function () {
  const room = mkRoom(ORDINARY);
  const l = listOf(room);
  const p = [];
  if (!l.json || !l.json.token) { fail('S3', 'no token to approve with'); fail('S8', 'no approved run'); return; }
  const r = run(SCRIPT, [room, '--approve', l.json.token]);
  if (r.calls.length === 0) p.push('no fetch call after approval');
  r.calls.forEach(function (c) { if (l.json.queries.indexOf(c) === -1) p.push('a request query is not in the list'); });
  check('S3', p, '(' + r.calls.length + ' calls)');

  const p8 = [];
  let recs = [];
  try { recs = require(LEDGER).readAudit(room); } catch (e) { p8.push('ledger read threw ' + e.message); }
  const ss = recs.filter(function (x) { return x.provider === 'semantic_scholar'; });
  if (ss.length !== r.calls.length) p8.push(ss.length + ' records for ' + r.calls.length + ' sent queries');
  check('S8', p8, '(' + ss.length + ' records)');
})();

// ---- S4 ----------------------------------------------------------------
(function () {
  const room = mkRoom(ORDINARY);
  const r = run(SCRIPT, [room, '--approve', 'not-the-token']);
  const p = [];
  if (r.calls.length !== 0) p.push(r.calls.length + ' fetch calls with a wrong token');
  if (r.status === 0) p.push('exit 0 with a wrong token');
  check('S4', p);
})();

// ---- S5 ----------------------------------------------------------------
(function () {
  const fakeKey = ['api_', 'key=', 'abcd1234efgh5678'].join('');
  const room = mkRoom(ORDINARY, function (md) {
    fs.writeFileSync(path.join(md, 'topic-forest.json'), JSON.stringify({ topics: [{ label: 'sensor fusion ' + fakeKey }] }));
  });
  // The token for this list: take it from the module itself, so the arm tests the credential check, not the token.
  const gate = require(path.join(ROOT, 'lib', 'core', 'web-path-gate.cjs'));
  const l = listOf(room);
  const tokens = [];
  if (l.json && l.json.token) tokens.push(l.json.token);
  // a token over the list including the credential line (the shape of an attacker with a matching token)
  tokens.push(gate.approvalToken(['sensor fusion ' + fakeKey, 'warehouse robotics adoption', 'cold chain logistics']));
  const p = [];
  tokens.forEach(function (t) {
    const r = run(SCRIPT, [room, '--approve', t]);
    if (r.calls.length !== 0) p.push(r.calls.length + ' fetch calls with a credential-shaped query');
    if (r.status === 0) p.push('exit 0 with a credential-shaped query');
    if (r.out.indexOf('abcd1234efgh5678') !== -1) p.push('output echoes the credential bytes');
  });
  const lr = run(SCRIPT, [room, '--list-queries']);
  if (lr.calls.length !== 0) p.push('list mode fetched');
  if (lr.status === 0) p.push('list mode exit 0 with a credential-shaped query');
  if (lr.out.indexOf('abcd1234efgh5678') !== -1) p.push('list mode echoes the credential bytes');
  check('S5', p);
})();

// ---- S6 ----------------------------------------------------------------
(function () {
  const room = mkRoom(ORDINARY, function (md) {
    fs.writeFileSync(path.join(md, 'external-corpus-cache.json'), JSON.stringify({
      timestamp: new Date().toISOString(),
      queries: ['warehouse robotics adoption'],
      papers: [],
    }));
  });
  const r = run(SCRIPT, [room]);
  const p = [];
  if (r.calls.length !== 0) p.push(r.calls.length + ' fetch calls on a warm cache');
  if (r.status !== 0) p.push('exit ' + r.status + ' on a warm cache');
  check('S6', p);
})();

// ---- S7 and S7b --------------------------------------------------------
(function () {
  const room = mkRoom(ORDINARY);
  const r = run(DISPATCH, [room, 'external']);
  const p = [];
  if (r.calls.length !== 0) p.push(r.calls.length + ' fetch calls from the dispatcher without a token');
  if (!/1\./.test(r.out) || !/warehouse|cold|autonomous/i.test(r.out)) p.push('the query list is not printed');
  if (!/--approve/.test(r.out)) p.push('no approval line');
  if (/grant/i.test(r.out)) p.push('the word grant reaches the user');
  check('S7', p);

  const l = listOf(room);
  if (!l.json || !l.json.token) { fail('S7b', 'no token'); return; }
  const r2 = run(DISPATCH, [room, 'external', '--approve', l.json.token]);
  const p2 = [];
  if (r2.calls.length === 0) p2.push('no fetch call with the token');
  r2.calls.forEach(function (c) { if (l.json.queries.indexOf(c) === -1) p2.push('a request query is not in the list'); });
  if (/grant/i.test(r2.out)) p2.push('the word grant reaches the user');
  check('S7b', p2, '(' + r2.calls.length + ' calls)');
})();

// ---- S9 ----------------------------------------------------------------
(function () {
  const room = mkRoom(['Ilvane Trosk Lisbon Quorvex Robotics', 'Ilvane Trosk Lisbon Quorvex Robotics pricing', 'Lisbon warehouse Quorvex']);
  const l = listOf(room);
  const p = [];
  if (!l.json || !l.json.token) { fail('S9', 'no token'); return; }
  const r = run(SCRIPT, [room, '--approve', l.json.token]);
  if (r.calls.length === 0) p.push('nothing was sent after approval');
  const joined = r.calls.join(' ').toLowerCase();
  if (joined.indexOf('ilvane') === -1 || joined.indexOf('lisbon') === -1 || joined.indexOf('quorvex') === -1) p.push('a name, a city or a company word was held back');
  check('S9', p);
})();

// ---- S10 ---------------------------------------------------------------
(function () {
  const p = [];
  const md = fs.readFileSync(COMMAND_MD, 'utf8');
  const a = md.indexOf('<!-- approval-step-begin -->');
  const b = md.indexOf('<!-- approval-step-end -->');
  if (a === -1 || b === -1 || b < a) {
    p.push('markers are absent');
  } else {
    const block = md.slice(a, b);
    if (block.length < 80) p.push('the approval step is empty');
    if (/grants?\b/i.test(block)) p.push('the word grant appears between the markers');
    if (!/--approve/.test(block)) p.push('the step does not name --approve');
  }
  check('S10', p);
})();

try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_e) { /* ignore */ }
process.exit(failures === 0 ? 0 : 1);
