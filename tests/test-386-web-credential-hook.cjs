#!/usr/bin/env node
'use strict';

/*
 * Plan 386-36 (finding E-WEBHOOK): a credential-only PreToolUse hook for the
 * native WebSearch and WebFetch tools and the Tavily tools.
 *
 * THE RULE (owner principle for Part 8, 2026-11-06): the web lines get a
 * credential check only. Room words continue through the normal approval flow;
 * credentials do not. The hook scans every string in tool_input for credential
 * shapes (lib/core/web-path-gate.cjs credentialCheck) and runs no other scan.
 *
 * ARMS WH1 to WH10 (see the labels below). Before the script exists, WH1 to
 * WH9 print FAIL and WH10 prints FAIL (or SKIP when plan 386-30 was skipped).
 *
 * Canon Part 8: fixture HOME folders, synthetic strings, a fake credential
 * built at run time, a node preload that counts every network attempt. No
 * network call is made, and no fake key byte is printed.
 */

const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawnSync } = require('child_process');

const REPO = path.resolve(__dirname, '..');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 't386wh-'));
const HOOK = path.join(REPO, 'scripts', 'web-credential-guard-hook.cjs');
const HOOKS_JSON = path.join(REPO, 'hooks', 'hooks.json');
const OUTAGE_MODULE = path.join(REPO, 'lib', 'core', 'part8-outage-log.cjs');
const RCA_29 = (require('node:fs').existsSync(path.join(REPO, '.planning', 'debug', 'part8-guard-fails-open-on-load-or-throw.md')) ? path.join(REPO, '.planning', 'debug', 'part8-guard-fails-open-on-load-or-throw.md') : path.join(REPO, '.planning', 'debug', 'resolved', 'part8-guard-fails-open-on-load-or-throw.md'));

// Fake credentials built at run time, so no secret-shaped literal sits in this file.
const FAKE_CRED = ['sk', 'ant', 'api03', 'Zq8Lm2Vx9Rt4Wc7Bn5Yd1Hf3'].join('-');
const FAKE_PARAM_VALUE = ['Qw7Er5Ty3', 'Ui1Op9As'].join('');
const FAKE_URL = 'https://example.test/search?' + ['api', 'key'].join('_') + '=' + FAKE_PARAM_VALUE;
const LINE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z web (guard_load_failed|classify_threw|hook_uncaught)$/;

// Every Tavily name shape the RCA records, plus the two native tools.
const TAVILY_TOOLS = [
  'mcp__tavily__tavily-search',
  'mcp__tavily-mcp__tavily-search',
  'mcp__tavily-mcp__tavily-extract',
  'mcp__plugin_demo_tavily__tavily-search',
  'mcp__claude_ai_Tavily__tavily_search',
];
const MATCH_NAMES = ['WebSearch', 'WebFetch'].concat(TAVILY_TOOLS);
const NO_MATCH_NAMES = [
  'mcp__plugin_mos_mindrian-brain__brain_ask',
  'mcp__plugin_mos_mindrian-brain__brain_search',
  'mcp__mindrian-brain__brain_ask',
  'mcp__pws-brain-mcp__brain_ask',
  'mcp__plugin_mos_mindrian-os__gate_answer',
  'mcp__mindrian-os__gate_answer',
  'mcp__other-server__tavily-notes',
  'Write', 'Edit', 'Bash', 'WebSearchExtra', 'MyWebFetch',
];

const ORDINARY = [
  'Jane Doe',
  'Lisbon',
  'Acme Widgets Inc',
  'two million dollars',
  '40%',
  'the bearer of bad news',
  'key',
];

let failures = 0;
function check(label, cond, detail) {
  if (cond) {
    console.log('ok - ' + label);
  } else {
    failures++;
    console.log('FAIL - ' + label + (detail ? ' :: ' + detail : ''));
  }
}

let seq = 0;
function freshDir(tag) {
  const d = path.join(TMP, tag + (++seq));
  fs.mkdirSync(d, { recursive: true });
  return d;
}
function outageLog(home) { return path.join(home, '.mindrian', 'telemetry', 'part8-guard-outage.log'); }
function outageLines(home) {
  try {
    return fs.readFileSync(outageLog(home), 'utf8').split('\n').filter((l) => l.length > 0);
  } catch (_) {
    return [];
  }
}

// The preload for every hook child. It counts every network attempt (fetch,
// net sockets, http, https) and writes the count at exit. In T386_FAIL mode it
// also breaks the credential module for one run (a double; no file on disk is
// edited).
const PRELOAD = path.join(TMP, 'preload.cjs');
fs.writeFileSync(PRELOAD, [
  "'use strict';",
  "const fs = require('fs');",
  "const net = require('net');",
  "const http = require('http');",
  "const https = require('https');",
  "const Module = require('module');",
  'let n = 0;',
  'const bump = () => { n += 1; };',
  "globalThis.fetch = function () { bump(); return Promise.reject(new Error('counter: no network')); };",
  'const oc = net.Socket.prototype.connect;',
  'net.Socket.prototype.connect = function () { bump(); return oc.apply(this, arguments); };',
  "for (const m of [http, https]) for (const k of ['request', 'get']) { const o = m[k]; m[k] = function () { bump(); return o.apply(this, arguments); }; }",
  "process.on('exit', () => { try { fs.writeFileSync(process.env.T386_COUNT_FILE, String(n)); } catch (_) { /* best effort */ } });",
  'const orig = Module._load;',
  'const mode = process.env.T386_FAIL;',
  'Module._load = function (request) {',
  '  const isGate = /web-path-gate(\\.cjs)?$/.test(String(request));',
  "  if (mode === 'load' && isGate) throw new Error('double: credential module load');",
  '  const out = orig.apply(this, arguments);',
  "  if (mode === 'throw' && isGate) return Object.assign({}, out, { credentialCheck() { throw new Error('double: credentialCheck'); } });",
  "  if (mode === 'uncaught' && isGate) return Object.assign({}, out, { credentialCheck() { return { get ok() { throw new Error('double: getter'); } }; } });",
  '  return out;',
  '};',
  '',
].join('\n'));

const runs = [];
function runHook(toolName, toolInput, opts) {
  const o = opts || {};
  const home = o.home || freshDir('home');
  const countFile = path.join(freshDir('cnt'), 'count.txt');
  const env = Object.assign({}, process.env, { HOME: home, USERPROFILE: home, T386_COUNT_FILE: countFile });
  if (o.fail) env.T386_FAIL = o.fail; else delete env.T386_FAIL;
  const stdin = o.rawStdin !== undefined ? o.rawStdin
    : JSON.stringify({ hook_event_name: 'PreToolUse', tool_name: toolName, tool_input: toolInput, session_id: 't386wh' });
  const res = spawnSync(process.execPath, ['--require', PRELOAD, HOOK], {
    input: stdin, encoding: 'utf8', env: env, timeout: 20000,
  });
  let count = null;
  try { count = parseInt(fs.readFileSync(countFile, 'utf8'), 10); } catch (_) { count = null; }
  const r = { code: res.status, stderr: res.stderr || '', stdout: res.stdout || '', count: count, home: home };
  runs.push(r);
  return r;
}

// True when the text holds the whole key or any run of 8 or more of its characters.
function leaks(text, secret) {
  for (let i = 0; i + 8 <= secret.length; i++) {
    if (text.indexOf(secret.slice(i, i + 8)) !== -1) return true;
  }
  return false;
}

function failPosture() {
  let t = '';
  try { t = fs.readFileSync(RCA_29, 'utf8'); } catch (_) { return null; }
  const m = /^decision:\s*(option-[abc])\s*$/m.exec(t);
  return m ? m[1] : null;
}

function inputFor(tool, secret) {
  if (tool === 'WebSearch') return { query: 'market sizing ' + secret, allowed_domains: ['example.test'] };
  if (tool === 'WebFetch') return { url: 'https://example.test/page', prompt: 'summarize ' + secret };
  return { query: 'topic', options: { nested: [{ deep: 'x ' + secret }] }, urls: ['https://example.test/a'] };
}

// ---- WH1: WebSearch with a credential --------------------------------------
const wh1 = runHook('WebSearch', inputFor('WebSearch', FAKE_CRED));
check('WH1: WebSearch with a credential exits 2 with reason credential_shaped and no key fragment',
  wh1.code === 2 && wh1.stderr.indexOf('credential_shaped') !== -1 && !leaks(wh1.stderr + wh1.stdout, FAKE_CRED),
  'exit=' + wh1.code);

// ---- WH2: WebFetch with an api_key= parameter ------------------------------
const wh2 = runHook('WebFetch', { url: FAKE_URL, prompt: 'read the page' });
check('WH2: WebFetch with an api_key parameter in the url exits 2',
  wh2.code === 2 && wh2.stderr.indexOf('credential_shaped') !== -1 && !leaks(wh2.stderr + wh2.stdout, FAKE_PARAM_VALUE),
  'exit=' + wh2.code);

// ---- WH3: every Tavily shape, credential in a nested field -----------------
const wh3 = TAVILY_TOOLS.map((t) => ({ t: t, r: runHook(t, inputFor(t, FAKE_CRED)) }));
check('WH3: each Tavily tool shape with a nested credential exits 2',
  wh3.every((x) => x.r.code === 2 && x.r.stderr.indexOf('credential_shaped') !== -1),
  wh3.map((x) => x.t + '=' + x.r.code).join(' '));

// ---- WH4: ordinary room terms pass on every tool family --------------------
{
  const bad = [];
  for (const tool of MATCH_NAMES) {
    for (const term of ORDINARY) {
      const input = tool === 'WebFetch' ? { url: 'https://example.test/p', prompt: term } : { query: term, extra: [term] };
      const r = runHook(tool, input);
      if (r.code !== 0) bad.push(tool + ':' + term + '=' + r.code);
    }
  }
  check('WH4: person name, city, company, money, percent, "bearer of bad news" and "key" pass on every tool family',
    bad.length === 0, bad.slice(0, 4).join(' '));
}

// ---- WH5: hooks.json matcher ----------------------------------------------
{
  let ok = false;
  let detail = '';
  try {
    const doc = JSON.parse(fs.readFileSync(HOOKS_JSON, 'utf8'));
    const groups = (doc.hooks && doc.hooks.PreToolUse) || [];
    const webGroups = groups.filter((g) => (g.hooks || []).some((h) => typeof h.command === 'string' && h.command.indexOf('web-credential-guard-hook') !== -1));
    detail = 'web groups=' + webGroups.length;
    if (webGroups.length === 1) {
      const g = webGroups[0];
      const re = new RegExp(g.matcher);
      const h = g.hooks.find((x) => x.command.indexOf('web-credential-guard-hook') !== -1);
      const matchesAll = MATCH_NAMES.every((n) => re.test(n));
      const matchesNone = NO_MATCH_NAMES.every((n) => !re.test(n));
      const timeoutOk = Number.isInteger(h.timeout) && h.timeout >= 1 && h.timeout <= 5;
      const brain = groups.filter((x) => (x.hooks || []).some((y) => typeof y.command === 'string' && y.command.indexOf('part8-egress-guard-hook') !== -1));
      const brainOk = brain.length === 1 && brain[0].hooks.length === 1 && brain[0].hooks[0].timeout === 5 &&
        brain[0].hooks[0].onFailure === 'block' && !new RegExp(brain[0].matcher).test('WebSearch');
      const noOnFailure = !Object.prototype.hasOwnProperty.call(h, 'onFailure');
      ok = matchesAll && matchesNone && timeoutOk && brainOk && noOnFailure;
      detail += ' matchesAll=' + matchesAll + ' matchesNone=' + matchesNone + ' timeout=' + h.timeout + ' brainOk=' + brainOk + ' noOnFailure=' + noOnFailure;
    }
  } catch (e) {
    detail = String(e && e.message);
  }
  check('WH5: one PreToolUse group matches the web tools and every Tavily shape, no Brain, gate_answer or lookalike tool; timeout <= 5; Brain group unchanged', ok, detail);
}

// ---- WH6: unparsable stdin and empty tool_input ----------------------------
{
  const a = runHook('WebSearch', null, { rawStdin: '{not json' });
  const b = runHook('WebSearch', {});
  const c = runHook('WebSearch', null, { rawStdin: '' });
  check('WH6: unparsable stdin, empty stdin and an empty tool_input exit 0',
    a.code === 0 && b.code === 0 && c.code === 0, 'codes=' + [a.code, b.code, c.code].join(','));
}

// ---- WH7: the credential module fails to load ------------------------------
const posture = failPosture();
const wantCode = posture === 'option-a' ? 2 : 0;
const wh7 = runHook('WebSearch', { query: 'topic ' + FAKE_CRED }, { fail: 'load' });
{
  const reasonOk = wantCode === 2 ? wh7.stderr.indexOf('web_credential_check_unavailable') !== -1 : true;
  check('WH7: a failed credential module load follows the plan 386-29 decision (' + posture + ')',
    posture !== null && wh7.code === wantCode && reasonOk && !leaks(wh7.stderr + wh7.stdout, FAKE_CRED),
    'exit=' + wh7.code + ' want=' + wantCode);
}

// ---- WH8: the network stays untouched --------------------------------------
{
  let src = '';
  try { src = fs.readFileSync(HOOK, 'utf8'); } catch (_) { src = null; }
  const scriptExists = src !== null;
  const noNetApi = scriptExists && !/\bfetch\s*\(|require\(\s*['"](node:)?(http|https|net)['"]\s*\)|from\s+['"](node:)?(http|https|net)['"]/.test(src);
  const countsZero = runs.length > 0 && runs.every((r) => r.count === 0);
  check('WH8: every hook run shows a network count of 0, and the script holds no fetch, http, https or net call',
    scriptExists && noNetApi && countsZero,
    'script=' + scriptExists + ' noNetApi=' + noNetApi + ' runs=' + runs.length + ' counts=' + runs.map((r) => r.count).slice(0, 6).join(','));
}

// ---- WH9: no refusal holds key bytes ---------------------------------------
{
  const refusals = [wh1, wh2].concat(wh3.map((x) => x.r)).concat(wantCode === 2 ? [wh7] : []);
  const secrets = [FAKE_CRED, FAKE_PARAM_VALUE];
  const allRefused = refusals.every((r) => r.code === 2);
  const clean = refusals.every((r) => !secrets.some((s) => leaks(r.stderr + r.stdout, s)));
  const reasonOk = refusals.every((r) => /credential_shaped|web_credential_check_unavailable/.test(r.stderr));
  check('WH9: every refusal prints a typed reason and no run of 8 or more key characters',
    allRefused && clean && reasonOk, 'allRefused=' + allRefused + ' clean=' + clean + ' reasonOk=' + reasonOk);
}

// ---- WH10: the outage line -------------------------------------------------
if (!fs.existsSync(OUTAGE_MODULE)) {
  console.log('SKIP - WH10: lib/core/part8-outage-log.cjs does not exist (plan 386-30 was skipped)');
} else {
  const cases = [['load', 'guard_load_failed'], ['throw', 'classify_threw'], ['uncaught', 'hook_uncaught']];
  const bad = [];
  for (const [fail, mode] of cases) {
    const home = freshDir('outhome');
    const r = runHook('WebSearch', { query: 'topic ' + FAKE_CRED }, { fail: fail, home: home });
    const lines = outageLines(home);
    const text = lines.join('\n');
    const lineOk = lines.length === 1 && LINE_RE.test(lines[0]) && lines[0].endsWith(' ' + mode);
    const exitOk = r.code === wantCode;
    if (!(lineOk && exitOk && !leaks(text, FAKE_CRED))) bad.push(fail + ':exit=' + r.code + ',lines=' + lines.length);
  }
  check('WH10: each outage branch writes exactly 1 count-only line (class web), in every posture, with no key byte',
    posture !== null && bad.length === 0, bad.join(' '));
}

fs.rmSync(TMP, { recursive: true, force: true });
if (failures > 0) {
  console.log(failures + ' arm(s) failed');
  process.exit(1);
}
console.log('all arms passed');
