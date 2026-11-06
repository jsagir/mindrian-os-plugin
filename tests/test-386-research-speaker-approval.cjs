#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 386 plan 24 (E-RS): scripts/research-speaker asks before it sends.
 * Debug session: research-speaker-sends-names-before-the-user-is-asked.
 *
 * Owner decision 2026-11-06 (card answer "Extend the ruling"): approval first
 * (the exact searches), then a credential check, plus an audit record. No
 * content scan runs on this line. research-speaker asks before it sends
 * anything.
 *
 * Arms:
 *   RS1 no token: 0 curl calls, exit 0, approval is needed
 *   RS2 --list-queries prints the 3 searches and a token, 0 curl calls, exit 0
 *   RS3 --approve with the listed token makes 3 curl calls equal to the listed searches
 *   RS4 a wrong token makes 0 curl calls
 *   RS5 a credential-shaped context is refused before any curl call, even with a matching token
 *   RS6 a name, a city and a company name are sent after approval (no content scan)
 *   RS7 an approved run leaves 3 audit records, provider google_search
 *   RS8 --apply needs the token: 0 curl calls and no write without it; with it PROFILE.md is updated
 *   RS9 the approval step in commands/file-meeting.md exists and has no word grant
 *
 * A stub curl first on PATH logs each URL and fails. Synthetic names only.
 * Fake credentials are built at run time. No em dash or en dash.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const SCRIPT = path.join(ROOT, 'scripts', 'research-speaker');
const COMMAND_MD = path.join(ROOT, 'commands', 'file-meeting.md');
const LEDGER = path.join(ROOT, 'lib', 'core', 'research-planner', 'audit-ledger.cjs');

const TMP = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'mos386-rs-')));
const HOME = path.join(TMP, 'home');
fs.mkdirSync(HOME, { recursive: true });
const STUB = path.join(TMP, 'stub');
fs.mkdirSync(STUB);
fs.writeFileSync(path.join(STUB, 'curl'), "#!/bin/sh\nfor a in \"$@\"; do case \"$a\" in https://*) printf '%s\\n' \"$a\" >> \"$CURL_STUB_LOG\" ;; esac; done\nexit 1\n", { mode: 0o755 });
const BASE_PATH = [STUB, path.dirname(process.execPath), '/usr/bin', '/bin'].join(':');

let failures = 0;
function ok(label, detail) { console.log('ok - ' + label + (detail ? ' ' + detail : '')); }
function fail(label, detail) { failures += 1; console.log('FAIL - ' + label + (detail ? ': ' + detail : '')); }
function check(label, problems, detail) {
  if (problems.length === 0) ok(label, detail); else fail(label, problems.join('; '));
}

const PROFILE = ['---', 'role: advisor', 'first_meeting: 2026-01-01', 'research_status: pending', '---', '# Speaker', '[To be filled after proactive research]'].join('\n') + '\n';

let seq = 0;
function mkRoom() {
  seq += 1;
  const room = path.join(TMP, 'room-' + seq);
  const dir = path.join(room, 'team', 'advisor', 'test-speaker');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'PROFILE.md'), PROFILE);
  return { room: room, profile: path.join(dir, 'PROFILE.md') };
}

function run(room, name, context, extra, pathOverride) {
  const log = path.join(TMP, 'curl-' + Date.now() + '-' + Math.random().toString(36).slice(2) + '.log');
  fs.writeFileSync(log, '');
  const r = spawnSync('bash', [SCRIPT, room, 'test-speaker', name, context].concat(extra || []), {
    encoding: 'utf8',
    timeout: 60000,
    cwd: TMP,
    env: {
      PATH: pathOverride || BASE_PATH,
      HOME: HOME,
      LANG: 'C',
      LC_ALL: 'C',
      TZ: 'UTC',
      CURL_STUB_LOG: log,
    },
  });
  const urls = fs.readFileSync(log, 'utf8').split('\n').filter(Boolean);
  const qs = urls.map(function (u) {
    const m = /[?&]q=([^&]*)/.exec(u);
    return m ? decodeURIComponent(m[1]) : null;
  });
  return { status: r.status, out: (r.stdout || '') + (r.stderr || ''), stdout: r.stdout || '', urls: urls, qs: qs };
}

function parseList(out) {
  const searches = [];
  let token = null;
  out.split('\n').forEach(function (l) {
    const m = /^\s*(\d+)\. (.*)$/.exec(l);
    if (m) searches.push(m[2]);
    const t = /^Approval token: ([0-9a-f]{16,})\s*$/.exec(l);
    if (t) token = t[1];
  });
  return { searches: searches, token: token };
}

function listOf(room, name, context) {
  const r = run(room, name, context, ['--list-queries']);
  return { r: r, list: parseList(r.stdout) };
}

const NAME = 'Ilvane Trosk';
const CTX = 'warehouse robotics adoption';

// ---- RS1 ---------------------------------------------------------------
(function () {
  const f = mkRoom();
  const r = run(f.room, NAME, CTX);
  const p = [];
  if (r.urls.length !== 0) p.push(r.urls.length + ' curl calls without a token');
  if (r.status !== 0) p.push('exit ' + r.status);
  if (!/approval/i.test(r.out)) p.push('output does not say approval is needed');
  check('RS1', p);
})();

// ---- RS2 ---------------------------------------------------------------
(function () {
  const f = mkRoom();
  const l = listOf(f.room, NAME, CTX);
  const p = [];
  if (l.r.urls.length !== 0) p.push(l.r.urls.length + ' curl calls in list mode');
  if (l.r.status !== 0) p.push('exit ' + l.r.status);
  if (l.list.searches.length !== 3) p.push(l.list.searches.length + ' searches listed, expected 3');
  if (!l.list.token) p.push('no token listed');
  check('RS2', p);
})();

// ---- RS3 and RS7 (one approved run) ------------------------------------
(function () {
  const f = mkRoom();
  const l = listOf(f.room, NAME, CTX);
  if (!l.list.token) { fail('RS3', 'no token to approve with'); fail('RS7', 'no approved run'); return; }
  const r = run(f.room, NAME, CTX, ['--approve', l.list.token]);
  const p = [];
  if (r.urls.length !== 3) p.push(r.urls.length + ' curl calls after approval, expected 3');
  r.qs.forEach(function (q, i) {
    if ((q || '').trim() !== (l.list.searches[i] || '').trim()) p.push('request ' + (i + 1) + ' differs from the listed search');
  });
  check('RS3', p);

  const p7 = [];
  let recs = [];
  try { recs = require(LEDGER).readAudit(f.room); } catch (e) { p7.push('ledger read threw ' + e.message); }
  const gs = recs.filter(function (x) { return x.provider === 'google_search'; });
  if (gs.length !== 3) p7.push(gs.length + ' records, expected 3');
  check('RS7', p7);
})();

// ---- RS4 ---------------------------------------------------------------
(function () {
  const f = mkRoom();
  const r = run(f.room, NAME, CTX, ['--approve', 'not-the-token']);
  const p = [];
  if (r.urls.length !== 0) p.push(r.urls.length + ' curl calls with a wrong token');
  check('RS4', p);
})();

// ---- RS5 ---------------------------------------------------------------
(function () {
  const fakeKey = ['api_', 'key=', 'abcd1234efgh5678'].join('');
  const f = mkRoom();
  const ctx = 'robotics ' + fakeKey;
  const gate = require(path.join(ROOT, 'lib', 'core', 'web-path-gate.cjs'));
  // the 3 strings the script builds for this context (C locale sort, trailing space on the third)
  const strings = [
    '"' + NAME + '" ' + ctx,
    '"' + NAME + '" advisor linkedin OR crunchbase OR twitter',
    '"' + NAME + '" ' + [fakeKey, 'robotics'].sort().join(' ') + ' ',
  ];
  const tokens = [gate.approvalToken(strings)];
  const l = listOf(f.room, NAME, ctx);
  if (l.list.token) tokens.push(l.list.token);
  const p = [];
  tokens.forEach(function (t) {
    const r = run(f.room, NAME, ctx, ['--approve', t]);
    if (r.urls.length !== 0) p.push(r.urls.length + ' curl calls with a credential-shaped context');
    if (r.out.indexOf('abcd1234efgh5678') !== -1) p.push('output echoes the credential bytes');
  });
  if (l.r.urls.length !== 0) p.push('list mode sent');
  if (l.r.out.indexOf('abcd1234efgh5678') !== -1) p.push('list mode echoes the credential bytes');
  if (l.list.token) p.push('list mode printed a token for a credential-shaped context');
  check('RS5', p);
})();

// ---- RS6 ---------------------------------------------------------------
(function () {
  const f = mkRoom();
  const ctx = 'Lisbon Quorvex Robotics';
  const l = listOf(f.room, NAME, ctx);
  if (!l.list.token) { fail('RS6', 'no token'); return; }
  const r = run(f.room, NAME, ctx, ['--approve', l.list.token]);
  const p = [];
  if (r.urls.length !== 3) p.push(r.urls.length + ' curl calls after approval');
  const joined = r.qs.join(' ');
  if (joined.indexOf('Ilvane') === -1 || joined.indexOf('Lisbon') === -1 || joined.indexOf('Quorvex') === -1) p.push('a name, a city or a company word was held back');
  check('RS6', p);
})();

// ---- RS8 ---------------------------------------------------------------
(function () {
  const f = mkRoom();
  const noTok = run(f.room, NAME, CTX, ['--apply']);
  const p = [];
  if (noTok.urls.length !== 0) p.push(noTok.urls.length + ' curl calls on --apply without a token');
  if (/research_status: complete/.test(fs.readFileSync(f.profile, 'utf8'))) p.push('PROFILE.md written without a token');
  const l = listOf(f.room, NAME, CTX);
  if (!l.list.token) { p.push('no token'); check('RS8', p); return; }
  const withTok = run(f.room, NAME, CTX, ['--apply', '--approve', l.list.token]);
  if (withTok.status !== 0) p.push('--apply with the token exit ' + withTok.status);
  if (!/research_status: complete/.test(fs.readFileSync(f.profile, 'utf8'))) p.push('PROFILE.md not updated with the token');
  check('RS8', p);
})();

// ---- RS9 ---------------------------------------------------------------
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
    if (!/--list-queries/.test(block) || !/--approve/.test(block)) p.push('the step does not name --list-queries and --approve');
  }
  check('RS9', p);
})();

try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_e) { /* ignore */ }
process.exit(failures === 0 ? 0 : 1);
