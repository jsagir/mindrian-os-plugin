#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 386 plan 22 (E-GATE): the shared gate for the 3 older web paths
 * (Semantic Scholar, grants.gov, research-speaker).
 * Debug session: web-paths-no-approval-or-audit-record.
 *
 * Owner decision 2026-11-06: the 2026-10-05 ruling (room words go out as
 * written on web research lines; credential check only; an approval card as the
 * gate; the audit ledger as the record) extends to the 3 older paths. This
 * test pins the shared module lib/core/web-path-gate.cjs.
 *
 * Arms:
 *   GW1 approvalToken is order independent and list dependent
 *   GW2 checkApproval is true only for the exact token
 *   GW3 credentialCheck refuses credentials and runs no content scan
 *   GW4 recordSent writes one record per string for the 3 providers
 *   GW5 recordSent refuses an unknown provider and a key-shaped string
 *   GW6 no network call: source and run
 *   GW7 the CLI: token and credential
 *
 * Synthetic strings only. Fake credentials are built at run time. No em dash
 * or en dash.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const MODULE_PATH = path.join(ROOT, 'lib', 'core', 'web-path-gate.cjs');
const LEDGER_PATH = path.join(ROOT, 'lib', 'core', 'research-planner', 'audit-ledger.cjs');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'mos386-gw-'));
process.env.HOME = path.join(TMP, 'home');
process.env.USERPROFILE = process.env.HOME;
fs.mkdirSync(process.env.HOME, { recursive: true });
delete process.env.OPENALEX_API_KEY;
delete process.env.TAVILY_API_KEY;
delete process.env.PATENTSVIEW_API_KEY;

let fetchCalls = 0;
globalThis.fetch = function noNetwork() {
  fetchCalls += 1;
  throw new Error('web path gate test: network is not allowed');
};

let failures = 0;
function ok(label, detail) { console.log('ok - ' + label + (detail ? ' ' + detail : '')); }
function fail(label, detail) { failures += 1; console.log('FAIL - ' + label + (detail ? ': ' + detail : '')); }

let G = null;
let loadError = null;
try {
  G = require(MODULE_PATH);
  ['approvalToken', 'checkApproval', 'credentialCheck', 'recordSent'].forEach(function (n) {
    if (typeof G[n] !== 'function') throw new Error(n + ' is not a function');
  });
} catch (e) {
  loadError = e && e.message ? e.message : String(e);
}

function arm(label, fn) {
  if (loadError) { fail(label, 'module did not load: ' + loadError); return; }
  try { fn(); } catch (e) { fail(label, 'threw ' + (e && e.message ? e.message : String(e))); }
}

const rooms = [];
function mkRoom() {
  const d = fs.mkdtempSync(path.join(TMP, 'room-'));
  rooms.push(d);
  return d;
}

// fake credentials, built at run time (never a literal key in source)
const j = function () { return Array.prototype.join.call(arguments, ''); };
const FAKE_BEARER = j('Bearer ', 'abcdefghijkl', '0123456789');
const FAKE_APIKEY = j('api_', 'key=', 'abcd1234efgh5678');
const ORDINARY = ['Ilvane Trosk disruption theory', 'warehouse robotics Boston', 'Acme Robotics Ltd pricing'];
const PROVIDERS = ['semantic_scholar', 'grants_gov', 'google_search'];

function auditRead(roomDir) {
  return require(LEDGER_PATH).readAudit(roomDir);
}

// ---- GW1 ------------------------------------------------------------------
arm('GW1', function () {
  const a = ['lean startup pivot', 'seed saas runway', 'disruption theory'];
  const t1 = G.approvalToken(a);
  const t2 = G.approvalToken([a[2], a[0], a[1]]);
  const t3 = G.approvalToken(a.concat(['one more string']));
  const t4 = G.approvalToken([a[0], a[0], a[1], a[2]]);
  const problems = [];
  if (typeof t1 !== 'string' || t1.length < 16) problems.push('token is not a usable string');
  if (t1 !== t2) problems.push('order changes the token');
  if (t1 === t3) problems.push('a different list gives the same token');
  if (t1 !== t4) problems.push('a repeated string changes the token');
  if (problems.length) fail('GW1', problems.join('; '));
  else ok('GW1', 'order independent, list dependent');
});

// ---- GW2 ------------------------------------------------------------------
arm('GW2', function () {
  const a = ['lean startup pivot', 'seed saas runway'];
  const tok = G.approvalToken(a);
  const other = G.approvalToken(['something else']);
  const problems = [];
  if (G.checkApproval(a, tok) !== true) problems.push('exact token not accepted');
  if (G.checkApproval(a, undefined) !== false) problems.push('missing token accepted');
  if (G.checkApproval(a, '') !== false) problems.push('empty token accepted');
  if (G.checkApproval(a, other) !== false) problems.push('token of another list accepted');
  if (G.checkApproval(a, 42) !== false) problems.push('non-string token accepted');
  if (problems.length) fail('GW2', problems.join('; '));
  else ok('GW2', 'true only for the exact token');
});

// ---- GW3 ------------------------------------------------------------------
arm('GW3', function () {
  const problems = [];
  [FAKE_BEARER, FAKE_APIKEY].forEach(function (c, i) {
    const r = G.credentialCheck(['find papers on ' + c], 'semantic_scholar');
    if (!r || r.ok !== false || r.reason !== 'credential_shaped') problems.push('credential ' + i + ' not refused');
    else if (r.index !== 0) problems.push('credential ' + i + ' index is not 0');
    if (JSON.stringify(r).indexOf(c) !== -1) problems.push('credential ' + i + ' echoed in the result');
  });
  const r2 = G.credentialCheck(ORDINARY, 'semantic_scholar');
  if (!r2 || r2.ok !== true) problems.push('ordinary strings with a person name, a city and a company were refused');
  const r3 = G.credentialCheck(['fine words', 'more words ' + FAKE_BEARER], 'grants_gov');
  if (!r3 || r3.ok !== false || r3.index !== 1) problems.push('index of the second string is not 1');
  if (problems.length) fail('GW3', problems.join('; '));
  else ok('GW3', 'credentials refused, no content scan, no echo');
});

// ---- GW4 ------------------------------------------------------------------
arm('GW4', function () {
  const problems = [];
  PROVIDERS.forEach(function (p) {
    const room = mkRoom();
    const strings = ['first request for ' + p, 'second request for ' + p];
    const r = G.recordSent(room, p, strings, { outcome: 'ok' });
    if (!r || r.ok !== true || r.written !== 2) problems.push(p + ' recordSent did not write 2 (' + JSON.stringify(r) + ')');
    const recs = auditRead(room);
    if (recs.length !== 2) problems.push(p + ' ledger holds ' + recs.length + ' records');
    else {
      if (recs.some(function (x) { return x.provider !== p; })) problems.push(p + ' provider field wrong');
      if (recs.map(function (x) { return x.q; }).join('|') !== strings.join('|')) problems.push(p + ' q fields differ from the sent strings');
      if (recs.some(function (x) { return x.outcome !== 'ok' || x.part8_verdict !== 'not_applicable'; })) problems.push(p + ' outcome or verdict wrong');
    }
  });
  if (problems.length) fail('GW4', problems.join('; '));
  else ok('GW4', 'one record per string for 3 providers');
});

// ---- GW5 ------------------------------------------------------------------
arm('GW5', function () {
  const problems = [];
  const roomA = mkRoom();
  const rA = G.recordSent(roomA, 'unknown_provider', ['some words'], { outcome: 'ok' });
  if (!rA || rA.ok !== false || !rA.reason) problems.push('unknown provider not refused');
  if (auditRead(roomA).length !== 0) problems.push('unknown provider wrote a record');
  const roomB = mkRoom();
  const rB = G.recordSent(roomB, 'semantic_scholar', ['words ' + FAKE_BEARER], { outcome: 'ok' });
  if (!rB || rB.ok !== false || rB.reason !== 'key_shaped_value') problems.push('key-shaped string not refused (' + JSON.stringify(rB) + ')');
  if (auditRead(roomB).length !== 0) problems.push('key-shaped string wrote a record');
  const file = path.join(roomB, '.mindrian', 'research-audit.jsonl');
  if (fs.existsSync(file) && fs.readFileSync(file, 'utf8').indexOf(FAKE_BEARER) !== -1) problems.push('credential bytes reached the ledger');
  if (problems.length) fail('GW5', problems.join('; '));
  else ok('GW5', 'unknown provider and key-shaped string write nothing');
});

// ---- GW6 ------------------------------------------------------------------
arm('GW6', function () {
  const src = fs.readFileSync(MODULE_PATH, 'utf8');
  const problems = [];
  if (/\bfetch\s*\(|require\(\s*['"](?:node:)?https?['"]\s*\)|XMLHttpRequest|WebSocket/.test(src)) problems.push('network call in source');
  if (new RegExp('[' + String.fromCharCode(0x2013) + String.fromCharCode(0x2014) + ']').test(src)) problems.push('dash in source');
  if (fetchCalls !== 0) problems.push('fetch counter is ' + fetchCalls);
  if (problems.length) fail('GW6', problems.join('; '));
  else ok('GW6', 'no network call, fetch counter 0');
});

// ---- GW7 ------------------------------------------------------------------
arm('GW7', function () {
  const problems = [];
  function run(args, input) {
    return spawnSync(process.execPath, [MODULE_PATH].concat(args), {
      input: input,
      encoding: 'utf8',
      env: Object.assign({}, process.env, { HOME: process.env.HOME }),
    });
  }
  const lines = ['lean startup pivot', 'seed saas runway'];
  const tok = G.approvalToken(lines);
  const t = run(['token'], lines.join('\n') + '\n');
  if (t.status !== 0) problems.push('token exit ' + t.status);
  if (String(t.stdout).trim() !== tok) problems.push('CLI token differs from approvalToken');
  const c1 = run(['credential'], 'fine words\n' + FAKE_BEARER + '\n');
  if (c1.status !== 3) problems.push('credential exit ' + c1.status + ' for a fake key line (want 3)');
  if ((String(c1.stdout) + String(c1.stderr)).indexOf(FAKE_BEARER) !== -1) problems.push('CLI echoed the credential');
  const c2 = run(['credential'], ORDINARY.join('\n') + '\n');
  if (c2.status !== 0) problems.push('credential exit ' + c2.status + ' for ordinary lines (want 0)');
  const u = run(['nonsense'], '');
  if (u.status !== 2) problems.push('bad usage exit ' + u.status + ' (want 2)');
  const room = mkRoom();
  const rec = run(['record', '--room', room, '--provider', 'grants_gov', '--outcome', 'ok'], lines.join('\n') + '\n');
  if (rec.status !== 0) problems.push('record exit ' + rec.status);
  if (auditRead(room).length !== 2) problems.push('record wrote ' + auditRead(room).length + ' records (want 2)');
  if (problems.length) fail('GW7', problems.join('; '));
  else ok('GW7', 'CLI token, credential and record');
});

try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_e) { /* best-effort */ }

if (failures > 0) {
  console.log('\n' + failures + ' arm(s) failed');
  process.exit(1);
}
console.log('\nAll web path gate arms passed');
