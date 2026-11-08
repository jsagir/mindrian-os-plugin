#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 391 plan 03 (CC391-H): the ask-first changelog fetch script for /mos:radar.
 * scripts/radar-changelog-slice.cjs downloads the Claude Code changelog once,
 * parses it by version header (lib/core/radar/changelog-slice.cjs) and reports
 * its own coverage. It follows the Phase 386 web path rule: list first, approval
 * token, credential check, one audit record per request, no content scan.
 *
 * Canon Part 8 and the 386 rule: this test makes NO real network call. Every
 * script run loads a counter with node --require that replaces globalThis.fetch.
 * The only live-looking arm (F14) is behind MOS_RADAR_LIVE=1 and runs --list,
 * which sends nothing. Synthetic text only. Fake credentials are built at run
 * time. No em dash or en dash in this file.
 *
 * Arms:
 *   F1  --list prints url, host, after, token, note; 0 fetch calls; exit 0
 *   F2  no token: 0 fetch calls, exit 3, approval needed, token shown, "Nothing was sent"
 *   F3  wrong token: 0 fetch calls, exit 3
 *   F4  right token: exactly 1 call; fixed URL; no auth, cookie or env value; redirect manual
 *   F5  capped read: exit 4 with a reason; --allow-partial gives exit 0 and still says incomplete
 *   F6  redirect: exit 5 redirect_refused, 1 call, other host never requested, audit failed
 *   F7  500 answer: exit 5 http_status; size cap: exit 5 size_cap (text and stream paths)
 *   F8  hostile body reaches stdout only sanitised
 *   F9  audit record: provider claude_changelog, q equals the URL, outcome ok, no body byte
 *   F10 source order and shape: credentialCheck before the first fetch; 1 URL literal; no child_process
 *   F11 --file mode: no network, no token, --after, --max-chars, --ledger and default mark
 *   F12 hygiene: no mos-radar-changelog-* left unless --keep; no repo file written
 *   F13 provider lists hold claude_changelog
 *   F14 optional live arm (MOS_RADAR_LIVE=1): one real --list, which sends nothing
 *   F15 in-process run(argv, deps) with a stub fetch
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const SCRIPT = path.join(ROOT, 'scripts', 'radar-changelog-slice.cjs');
const GATE = path.join(ROOT, 'lib', 'core', 'web-path-gate.cjs');
const POLICY = path.join(ROOT, 'lib', 'core', 'research-planner', 'egress-policy.cjs');
const DATA_LEDGER = path.join(ROOT, 'data', 'capability-ledger.json');
const { buildChangelog, hostileBullets } = require('./helpers/changelog-fixture-391.cjs');

const FIXED_URL = 'https://raw.githubusercontent.com/anthropics/claude-code/main/CHANGELOG.md';
const FIXED_HOST = 'raw.githubusercontent.com';

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'mos391-f-'));

// ---- the fetch counter (loaded with node --require) -------------------------
const PRELOAD = path.join(TMP, 'fetch-counter.cjs');
fs.writeFileSync(PRELOAD, [
  "'use strict';",
  "const fs = require('node:fs');",
  'globalThis.fetch = async function counted(url, init) {',
  '  const o = init || {};',
  '  const h = {};',
  '  const src = o.headers || {};',
  "  if (typeof src.forEach === 'function') { src.forEach(function (v, k) { h[String(k).toLowerCase()] = String(v); }); }",
  '  else { Object.keys(src).forEach(function (k) { h[k.toLowerCase()] = String(src[k]); }); }',
  "  fs.appendFileSync(process.env.S391_COUNTER, JSON.stringify({ url: String(url), headers: h, redirect: o.redirect || null, hasSignal: !!o.signal }) + '\\n');",
  "  const mode = process.env.S391_MODE || 'ok';",
  "  if (mode === 'redirect') {",
  "    return { ok: false, status: 302, type: 'basic', headers: { get: function (n) { return String(n).toLowerCase() === 'location' ? 'https://evil.example.test/steal' : null; } }, text: async function () { return ''; } };",
  '  }',
  "  if (mode === 'status500') {",
  "    return { ok: false, status: 500, type: 'basic', headers: { get: function () { return null; } }, text: async function () { return 'server error'; } };",
  '  }',
  "  const body = fs.readFileSync(process.env.S391_BODY, 'utf8');",
  '  const res = {',
  '    ok: true, status: 200, type: "basic",',
  '    headers: { get: function () { return null; } },',
  '    text: async function () { return body; },',
  '  };',
  "  if (process.env.S391_STREAM === '1') {",
  "    res.text = async function () { throw new Error('text() must not be used when a reader is offered'); };",
  '    res.body = { getReader: function () {',
  "      const buf = Buffer.from(body, 'utf8'); let pos = 0;",
  '      return {',
  '        read: async function () { if (pos >= buf.length) return { done: true }; const c = buf.subarray(pos, pos + 4096); pos += 4096; return { done: false, value: new Uint8Array(c) }; },',
  "        cancel: async function () { fs.appendFileSync(process.env.S391_COUNTER + '.cancel', '1\\n'); },",
  '      };',
  '    } };',
  '  }',
  '  return res;',
  '};',
  '',
].join('\n'));

let failures = 0;
function ok(label, detail) { console.log('ok - ' + label + (detail ? ' ' + detail : '')); }
function fail(label, detail) { failures += 1; console.log('FAIL - ' + label + (detail ? ': ' + detail : '')); }
function check(label, problems, detail) {
  if (problems.length === 0) ok(label, detail); else fail(label, problems.join('; '));
}

// ---- fixtures ----------------------------------------------------------------
const BODY_140K = buildChangelog({ top: '2.1.340', count: 40, entryChars: 3500 }).text;
const BODY_FILE = path.join(TMP, 'body-140k.md');
fs.writeFileSync(BODY_FILE, BODY_140K);
const SMALL = buildChangelog({ top: '2.1.340', count: 12, entryChars: 400 });
const SMALL_FILE = path.join(TMP, 'body-small.md');
fs.writeFileSync(SMALL_FILE, SMALL.text);
const HOSTILE_FILE = path.join(TMP, 'body-hostile.md');
fs.writeFileSync(HOSTILE_FILE,
  '# Changelog\n\n## 2.1.340\n\n' + hostileBullets().map(function (b) { return '- ' + b; }).join('\n') +
  '\n\n## 2.1.300\n\n- plain old line\n');
const MARK = '2.1.304';

let seq = 0;
function mkdir(name) {
  const d = path.join(TMP, name + '-' + seq);
  fs.mkdirSync(d, { recursive: true });
  return d;
}

// run(args, opts): one script run with scratch HOME, USERPROFILE, TMPDIR and audit folder.
function run(args, opts) {
  const o = opts || {};
  seq += 1;
  const home = mkdir('home');
  const tmpdir = mkdir('tmpdir');
  const auditDir = o.auditDir || mkdir('audit');
  const counter = path.join(TMP, 'counter-' + seq + '.txt');
  fs.writeFileSync(counter, '');
  const argv = (o.noPreload ? [] : ['--require', PRELOAD]).concat([SCRIPT], args);
  if (o.withAudit !== false && args.indexOf('--audit-dir') === -1) argv.push('--audit-dir', auditDir);
  const env = Object.assign({}, process.env, {
    HOME: home,
    USERPROFILE: home,
    TMPDIR: tmpdir,
    TMP: tmpdir,
    TEMP: tmpdir,
    S391_COUNTER: counter,
    S391_BODY: o.body || BODY_FILE,
    S391_MODE: o.mode || 'ok',
    S391_STREAM: o.stream ? '1' : '0',
  }, o.env || {});
  const r = spawnSync(process.execPath, argv, { encoding: 'utf8', timeout: 60000, env: env, cwd: ROOT });
  const calls = fs.readFileSync(counter, 'utf8').split('\n').filter(Boolean).map(function (l) { return JSON.parse(l); });
  const auditFile = path.join(auditDir, '.mindrian', 'research-audit.jsonl');
  let audit = [];
  try {
    audit = fs.readFileSync(auditFile, 'utf8').split('\n').filter(Boolean).map(function (l) { return JSON.parse(l); });
  } catch (_e) { audit = []; }
  return {
    status: r.status,
    stdout: r.stdout || '',
    stderr: r.stderr || '',
    out: (r.stdout || '') + (r.stderr || ''),
    calls: calls,
    cancelled: fs.existsSync(counter + '.cancel'),
    home: home,
    tmpdir: tmpdir,
    auditDir: auditDir,
    auditFile: auditFile,
    audit: audit,
  };
}

function parseJson(text) {
  const lines = String(text).split('\n').filter(function (l) { return l.trim().startsWith('{'); });
  if (!lines.length) return null;
  try { return JSON.parse(lines[lines.length - 1]); } catch (_e) { /* fall through */ }
  try { return JSON.parse(String(text).trim()); } catch (_e2) { return null; }
}

function listToken() {
  const r = run(['--list', '--after', MARK]);
  const j = parseJson(r.stdout);
  return { r: r, j: j, token: j && j.token };
}

function leftovers(dir) {
  return fs.readdirSync(dir).filter(function (n) { return n.indexOf('mos-radar-changelog-') === 0; });
}

// ---- F13 first: it does not need the script ------------------------------------
(function () {
  const p = [];
  try {
    const gate = require(GATE);
    if (gate.WEB_PATH_PROVIDERS.indexOf('claude_changelog') === -1) p.push('WEB_PATH_PROVIDERS lacks claude_changelog');
  } catch (e) { p.push('cannot load the gate: ' + e.message); }
  try {
    const pol = require(POLICY);
    if (pol.WEB_PROVIDERS.indexOf('claude_changelog') === -1) p.push('WEB_PROVIDERS lacks claude_changelog');
  } catch (e) { p.push('cannot load the policy: ' + e.message); }
  check('F13', p);
})();

// ---- F1 ------------------------------------------------------------------------
(function () {
  const r = run(['--list', '--after', MARK]);
  const j = parseJson(r.stdout);
  const p = [];
  if (r.calls.length !== 0) p.push(r.calls.length + ' fetch calls in list mode');
  if (r.status !== 0) p.push('exit ' + r.status + ' ' + r.stderr.slice(0, 200));
  if (!j) p.push('no JSON object on stdout');
  else {
    if (j.url !== FIXED_URL) p.push('url is ' + j.url);
    if (j.host !== FIXED_HOST) p.push('host is ' + j.host);
    if (j.after !== MARK) p.push('after is ' + j.after);
    if (typeof j.token !== 'string' || j.token.length < 16) p.push('no token');
    if (typeof j.note !== 'string' || !j.note) p.push('no note');
    try {
      const want = require(GATE).approvalToken([FIXED_URL]);
      if (j.token !== want) p.push('token is not the gate token for the fixed URL');
    } catch (_e) { /* F13 reports a missing gate */ }
  }
  if (r.audit.length !== 0) p.push('list mode wrote an audit record');
  check('F1', p);
})();

// ---- F2 ------------------------------------------------------------------------
(function () {
  const r = run(['--after', MARK]);
  const p = [];
  if (r.calls.length !== 0) p.push(r.calls.length + ' fetch calls without a token');
  if (r.status !== 3) p.push('exit ' + r.status + ' (want 3)');
  if (!/approval/i.test(r.out)) p.push('output does not say approval is needed');
  if (!/Nothing was sent/.test(r.out)) p.push('output lacks "Nothing was sent"');
  if (!/[0-9a-f]{64}/.test(r.out)) p.push('output does not show the token');
  if (r.audit.length !== 0) p.push('a refused run wrote an audit record');
  check('F2', p);
})();

// ---- F3 ------------------------------------------------------------------------
(function () {
  const r = run(['--approve', 'not-the-token', '--after', MARK]);
  const p = [];
  if (r.calls.length !== 0) p.push(r.calls.length + ' fetch calls with a wrong token');
  if (r.status !== 3) p.push('exit ' + r.status + ' (want 3)');
  if (!/Nothing was sent/.test(r.out)) p.push('output lacks "Nothing was sent"');
  check('F3', p);
})();

// ---- F4 and F9 (one approved run, complete read) ---------------------------------
(function () {
  const l = listToken();
  const fakeEnv = {
    ANTHROPIC_API_KEY: 'fake-' + crypto.randomBytes(12).toString('hex'),
    GITHUB_TOKEN: 'fake-' + crypto.randomBytes(12).toString('hex'),
    OPENAI_API_KEY: 'fake-' + crypto.randomBytes(12).toString('hex'),
  };
  const r = run(['--approve', String(l.token), '--after', '2.1.320'], { env: fakeEnv });
  const j = parseJson(r.stdout);
  const p = [];
  if (r.calls.length !== 1) p.push(r.calls.length + ' fetch calls (want 1)');
  const c = r.calls[0];
  if (c) {
    if (c.url !== FIXED_URL) p.push('url is ' + c.url);
    if (c.redirect !== 'manual') p.push('redirect option is ' + c.redirect);
    if (!c.hasSignal) p.push('no abort signal (timeout)');
    const names = Object.keys(c.headers);
    ['authorization', 'cookie', 'proxy-authorization'].forEach(function (n) {
      if (names.indexOf(n) !== -1) p.push('header ' + n + ' present');
    });
    names.forEach(function (n) {
      if (n !== 'user-agent' && n !== 'accept') p.push('unexpected header ' + n);
    });
    const blob = JSON.stringify(c);
    Object.keys(fakeEnv).forEach(function (k) {
      if (blob.indexOf(fakeEnv[k]) !== -1) p.push('value of ' + k + ' reached the request');
    });
  }
  if (r.status !== 0) p.push('exit ' + r.status + ' ' + r.stderr.slice(0, 300));
  if (!j || !Array.isArray(j.entries) || !j.coverage) p.push('stdout is not an object with entries and coverage');
  else if (j.coverage.complete !== true) p.push('coverage not complete: ' + j.coverage.reason);
  else if (j.entries.length !== 20 || j.entries[0].version !== '2.1.340') p.push('unexpected entries: ' + j.entries.length);
  check('F4', p);

  const q = [];
  if (r.audit.length !== 1) q.push(r.audit.length + ' audit records (want 1)');
  else {
    const a = r.audit[0];
    if (a.provider !== 'claude_changelog') q.push('provider is ' + a.provider);
    if (a.q !== FIXED_URL) q.push('q is not the fixed URL');
    if (a.outcome !== 'ok') q.push('outcome is ' + a.outcome);
  }
  let auditText = '';
  try { auditText = fs.readFileSync(r.auditFile, 'utf8'); } catch (_e) { q.push('no audit file at ' + r.auditFile); }
  const firstBullet = BODY_140K.split('\n').filter(function (x) { return x.indexOf('- ') === 0; })[0];
  if (firstBullet && auditText.indexOf(firstBullet.slice(2, 40)) !== -1) q.push('audit text holds a body byte');
  Object.keys(fakeEnv).forEach(function (k) {
    if (auditText.indexOf(fakeEnv[k]) !== -1) q.push('audit text holds ' + k);
  });
  check('F9', q);

  // default audit folder: HOME/.mindrian/radar-audit
  const d = run(['--approve', String(l.token), '--after', '2.1.320'], { withAudit: false });
  const defFile = path.join(d.home, '.mindrian', 'radar-audit', '.mindrian', 'research-audit.jsonl');
  const s = [];
  if (!fs.existsSync(defFile)) s.push('no audit file at the default folder ' + defFile);
  else {
    const n = fs.readFileSync(defFile, 'utf8').split('\n').filter(Boolean).length;
    if (n !== 1) s.push(n + ' records in the default audit file');
  }
  check('F9b default audit folder', s);
})();

// ---- F5 ------------------------------------------------------------------------
(function () {
  const l = listToken();
  const r = run(['--approve', String(l.token), '--after', MARK, '--max-chars', '100000']);
  const j = parseJson(r.stdout);
  const p = [];
  if (r.status !== 4) p.push('exit ' + r.status + ' (want 4)');
  if (!j || !j.coverage) p.push('no coverage object on stdout');
  else {
    if (j.coverage.complete !== false) p.push('complete is not false');
    if (j.coverage.truncated !== true) p.push('truncated is not true');
    if (!/not read/.test(String(j.coverage.reason))) p.push('reason lacks "not read": ' + j.coverage.reason);
    const cmp = require(path.join(ROOT, 'lib', 'core', 'radar', 'changelog-slice.cjs')).compareDotted;
    const low = (j.entries || []).filter(function (e) { return cmp(e.version, '2.1.312') <= 0; });
    if (low.length) p.push('an entry at or below 2.1.312 is printed');
  }
  check('F5', p);

  const a = run(['--approve', String(l.token), '--after', MARK, '--max-chars', '100000', '--allow-partial']);
  const ja = parseJson(a.stdout);
  const q = [];
  if (a.status !== 0) q.push('exit ' + a.status + ' with --allow-partial (want 0)');
  if (!ja || !ja.coverage || ja.coverage.complete !== false) q.push('--allow-partial hid complete false');
  check('F5b allow-partial', q);
})();

// ---- F6 ------------------------------------------------------------------------
(function () {
  const l = listToken();
  const r = run(['--approve', String(l.token), '--after', MARK], { mode: 'redirect' });
  const p = [];
  if (r.status !== 5) p.push('exit ' + r.status + ' (want 5)');
  if (!/redirect_refused/.test(r.out)) p.push('typed reason redirect_refused missing');
  if (r.calls.length !== 1) p.push(r.calls.length + ' calls (want 1)');
  r.calls.forEach(function (c) { if (c.url !== FIXED_URL) p.push('requested ' + c.url); });
  if (r.audit.length !== 1 || r.audit[0].outcome !== 'failed') p.push('audit is not one record with outcome failed');
  check('F6', p);
})();

// ---- F7 ------------------------------------------------------------------------
(function () {
  const l = listToken();
  const a = run(['--approve', String(l.token), '--after', MARK], { mode: 'status500' });
  const p = [];
  if (a.status !== 5) p.push('500: exit ' + a.status + ' (want 5)');
  if (!/http_status/.test(a.out)) p.push('500: typed reason http_status missing');
  if (a.audit.length !== 1 || a.audit[0].outcome !== 'failed') p.push('500: audit is not one failed record');

  const b = run(['--approve', String(l.token), '--after', MARK, '--max-bytes', '5000']);
  if (b.status !== 5) p.push('size (text): exit ' + b.status + ' (want 5)');
  if (!/size_cap/.test(b.out)) p.push('size (text): typed reason size_cap missing');
  if (b.audit.length !== 1 || b.audit[0].outcome !== 'failed') p.push('size (text): audit is not one failed record');

  const c = run(['--approve', String(l.token), '--after', MARK, '--max-bytes', '5000'], { stream: true });
  if (c.status !== 5) p.push('size (stream): exit ' + c.status + ' (want 5)');
  if (!/size_cap/.test(c.out)) p.push('size (stream): typed reason size_cap missing');
  if (!c.cancelled) p.push('size (stream): the reader was not cancelled');

  const d = run(['--approve', String(l.token), '--after', '2.1.320'], { stream: true });
  const jd = parseJson(d.stdout);
  if (d.status !== 0 || !jd || !jd.coverage || jd.coverage.complete !== true) p.push('stream read under the cap did not finish complete (exit ' + d.status + ')');
  check('F7', p);
})();

// ---- F8 ------------------------------------------------------------------------
(function () {
  const l = listToken();
  const r = run(['--approve', String(l.token), '--after', '2.1.300'], { body: HOSTILE_FILE });
  const j = parseJson(r.stdout);
  const p = [];
  if (r.status !== 0) p.push('exit ' + r.status + ' ' + r.stderr.slice(0, 200));
  if (!j || !Array.isArray(j.entries)) p.push('no entries');
  else {
    const text = JSON.stringify(j.entries);
    if (text.indexOf('`') !== -1) p.push('a backtick reached stdout');
    if (/\]\(/.test(text)) p.push('a markdown link reached stdout');
    if (/<\/?[a-zA-Z]/.test(text)) p.push('an HTML tag reached stdout');
    if (/https?:\/\//.test(text)) p.push('a URL reached stdout');
    if (text.indexOf(String.fromCharCode(0x200b)) !== -1 || text.indexOf(String.fromCharCode(0x202e)) !== -1) p.push('an invisible mark reached stdout');
    if (!/PWNED/.test(text)) p.push('the sentence text was dropped (it should only lose its markup)');
  }
  check('F8', p);
})();

// ---- F10 -----------------------------------------------------------------------
(function () {
  const p = [];
  let src = '';
  try { src = fs.readFileSync(SCRIPT, 'utf8'); } catch (_e) { p.push('script is missing'); }
  if (src) {
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');
    const cred = code.indexOf('credentialCheck(');
    const f = code.search(/\bfetch\b/);
    if (cred === -1) p.push('no credentialCheck call');
    if (f === -1) p.push('no fetch call');
    if (cred !== -1 && f !== -1 && cred > f) p.push('credentialCheck comes after the first fetch');
    const urls = code.match(/https:\/\/[^\s'"`]+/g) || [];
    if (urls.length !== 1) p.push(urls.length + ' https URL literals (want 1)');
    if (/child_process/.test(code)) p.push('requires child_process');
    if (!/web-path-gate/.test(code)) p.push('does not use web-path-gate');
    if (!/changelog-slice/.test(code)) p.push('does not use changelog-slice');
    if (src.indexOf(String.fromCharCode(0x2013)) !== -1 || src.indexOf(String.fromCharCode(0x2014)) !== -1) p.push('holds an em dash or en dash');
  }
  check('F10', p);
})();

// ---- F11 -----------------------------------------------------------------------
(function () {
  const p = [];
  const a = run(['--file', SMALL_FILE, '--after', '2.1.331']);
  const ja = parseJson(a.stdout);
  if (a.calls.length !== 0) p.push('file mode made ' + a.calls.length + ' fetch calls');
  if (a.status !== 0) p.push('file mode exit ' + a.status + ' ' + a.stderr.slice(0, 200));
  if (!ja || !ja.coverage || ja.coverage.complete !== true || ja.entries.length !== 9) p.push('file mode entries: ' + (ja && ja.entries ? ja.entries.length : 'none'));

  const b = run(['--file', SMALL_FILE, '--after', '2.1.331', '--max-chars', '1500']);
  const jb = parseJson(b.stdout);
  if (b.status !== 4) p.push('file mode with a cap: exit ' + b.status + ' (want 4)');
  if (!jb || !jb.coverage || jb.coverage.complete !== false) p.push('file mode with a cap: complete is not false');

  // mark from --ledger
  const ledgerFile = path.join(TMP, 'scratch-ledger.json');
  fs.writeFileSync(ledgerFile, JSON.stringify({ ledger_covers: { from: '2.1.100', to: '2.1.335' } }));
  const c = run(['--file', SMALL_FILE, '--ledger', ledgerFile]);
  const jc = parseJson(c.stdout);
  if (c.status !== 0 || !jc || !jc.coverage || jc.coverage.after !== '2.1.335' || jc.entries.length !== 5) {
    p.push('--ledger mark: exit ' + c.status + ' after ' + (jc && jc.coverage ? jc.coverage.after : 'none'));
  }

  // default mark from data/capability-ledger.json
  let defMark = null;
  try { defMark = JSON.parse(fs.readFileSync(DATA_LEDGER, 'utf8')).ledger_covers.to; } catch (_e) { defMark = null; }
  if (!defMark) p.push('cannot read ledger_covers.to from data/capability-ledger.json');
  else {
    const patch = Number(defMark.split('.')[2]);
    const fx = buildChangelog({ top: '2.1.340', count: Math.max(2, 340 - patch + 4), entryChars: 200 });
    const fxFile = path.join(TMP, 'body-default-mark.md');
    fs.writeFileSync(fxFile, fx.text);
    const d = run(['--file', fxFile]);
    const jd = parseJson(d.stdout);
    if (d.status !== 0 || !jd || !jd.coverage || jd.coverage.after !== defMark || jd.coverage.complete !== true) {
      p.push('default mark: exit ' + d.status + ' after ' + (jd && jd.coverage ? jd.coverage.after : 'none') + ' want ' + defMark);
    }
  }

  // no mark at all: exit 2
  const emptyLedger = path.join(TMP, 'empty-ledger.json');
  fs.writeFileSync(emptyLedger, '{}');
  const e = run(['--file', SMALL_FILE, '--ledger', emptyLedger]);
  if (e.status !== 2) p.push('no mark: exit ' + e.status + ' (want 2)');
  check('F11', p);
})();

// ---- F12 -----------------------------------------------------------------------
(function () {
  const p = [];
  function repoState() {
    const r = spawnSync('git', ['status', '--porcelain', '--untracked-files=all', '--', 'data', 'lib', 'scripts', 'commands'], { encoding: 'utf8', cwd: ROOT });
    return String(r.stdout || '').split('\n').filter(function (l) {
      return l && l.indexOf('data/capability-ledger.json') === -1;
    }).sort().join('\n');
  }
  const before = repoState();
  const l = listToken();
  const runs = [
    run(['--approve', String(l.token), '--after', '2.1.320']),
    run(['--approve', String(l.token), '--after', MARK, '--max-chars', '100000']),
    run(['--approve', String(l.token), '--after', MARK], { mode: 'redirect' }),
    run(['--approve', String(l.token), '--after', MARK], { mode: 'status500' }),
    run(['--approve', String(l.token), '--after', MARK, '--max-bytes', '5000']),
    run(['--file', SMALL_FILE, '--after', '2.1.331']),
  ];
  runs.forEach(function (r, i) {
    const left = leftovers(r.tmpdir);
    if (left.length) p.push('run ' + i + ' left ' + left.join(','));
  });
  const k = run(['--approve', String(l.token), '--after', '2.1.320', '--keep']);
  const kept = leftovers(k.tmpdir);
  if (kept.length !== 1) p.push('--keep left ' + kept.length + ' files (want 1)');
  else {
    const m = /(\/[^\s]*mos-radar-changelog-[^\s]*\.md)/.exec(k.stderr + '\n' + k.stdout);
    if (!m) p.push('--keep did not print the file path');
    else if (!fs.existsSync(m[1])) p.push('the printed path does not exist: ' + m[1]);
    else if (fs.readFileSync(m[1], 'utf8') !== BODY_140K) p.push('the kept file does not hold the body');
  }
  const after = repoState();
  if (before !== after) p.push('tracked or untracked repo paths changed during the runs');
  check('F12', p);
})();

// ---- F14 -----------------------------------------------------------------------
(function () {
  if (process.env.MOS_RADAR_LIVE !== '1') { console.log('SKIP - F14 (set MOS_RADAR_LIVE=1 for the list-only arm)'); return; }
  const r = run(['--list', '--after', MARK], { noPreload: true });
  const j = parseJson(r.stdout);
  const p = [];
  if (r.status !== 0) p.push('exit ' + r.status);
  if (!j || j.url !== FIXED_URL) p.push('list did not show the fixed URL');
  check('F14', p);
})();

// ---- F15 (in process) ------------------------------------------------------------
(async function () {
  const p = [];
  let mod = null;
  try { mod = require(SCRIPT); } catch (e) { p.push('cannot load script: ' + e.message); }
  if (mod && typeof mod.run === 'function') {
    const outBuf = [];
    const errBuf = [];
    let calls = 0;
    const deps = {
      stdout: function (s) { outBuf.push(s); },
      stderr: function (s) { errBuf.push(s); },
      auditDir: mkdir('audit-inproc'),
      tmpDir: mkdir('tmp-inproc'),
      fetchImpl: async function (url) {
        calls += 1;
        return { ok: true, status: 200, type: 'basic', headers: { get: function () { return null; } }, text: async function () { return SMALL.text; } };
      },
    };
    const code1 = await mod.run(['--list', '--after', '2.1.331'], deps);
    if (code1 !== 0 || calls !== 0) p.push('in-process list: code ' + code1 + ', calls ' + calls);
    const tok = parseJson(outBuf.join(''));
    outBuf.length = 0;
    const code2 = await mod.run(['--approve', String(tok && tok.token), '--after', '2.1.331'], deps);
    const jr = parseJson(outBuf.join(''));
    if (code2 !== 0 || calls !== 1 || !jr || !jr.coverage || jr.coverage.complete !== true) p.push('in-process approve: code ' + code2 + ', calls ' + calls);
    const code3 = await mod.run(['--bogus-flag'], deps);
    if (code3 !== 2) p.push('unknown flag: code ' + code3 + ' (want 2)');
  } else if (mod) {
    p.push('script does not export run');
  }
  check('F15', p);
  finish();
})();

function finish() {
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_e) { /* scratch only */ }
  if (failures > 0) {
    console.log('\n' + failures + ' failure(s)');
    process.exit(1);
  }
  console.log('\nall arms passed');
}
