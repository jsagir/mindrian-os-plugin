#!/usr/bin/env node
'use strict';
/*
 * Phase 400.3 plan 05a: the 2 guard hooks that fail closed deny with a plain reason before their host budget.
 *
 * Covered: OR-5 (keep onFailure block; an internal deadline about 1 s under the 5 s host budget, with an explicit
 * deny and a plain reason; no hooks.json budget raise), V3 (a synchronous wait cannot be interrupted from
 * JavaScript, so the check runs in a child process), V9 (the 2 onFailure block guards), review B-a (the child
 * gets the node flags of the parent, so a --require preload reaches the check).
 *
 * Canon Part 8: no network (MINDRIAN_BRAIN_URL points at a closed loopback port); no payload byte reaches a log
 * (the outage line holds the tool class and the mode only).
 * Native Windows is UNMEASURED. Host handling of onFailure block on a timeout is UNVERIFIED.
 *
 * Groups:
 *   unit   D1-D8   lib/core/hook-deadline.cjs and the outage mode deadline_exceeded
 *   hooks  G1-G10  the parent and --inner modes of scripts/part8-egress-guard-hook.cjs and
 *                  scripts/web-credential-guard-hook.cjs
 * Usage: node tests/test-400-3-guard-deadline.cjs [unit|hooks|all]   (default all)
 *
 * Node built-ins only. Hyphens only.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync, execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const HD = path.join(ROOT, 'lib', 'core', 'hook-deadline.cjs');
const OUTAGE = path.join(ROOT, 'lib', 'core', 'part8-outage-log.cjs');
const P8 = path.join(ROOT, 'scripts', 'part8-egress-guard-hook.cjs');
const WEB = path.join(ROOT, 'scripts', 'web-credential-guard-hook.cjs');
const COUNT_PRELOAD = path.join(ROOT, 'tools', 'perf', 'count-modules-preload.cjs');

const GROUP = process.argv[2] || 'all';
if (['unit', 'hooks', 'all'].indexOf(GROUP) === -1) {
  console.error('usage: node tests/test-400-3-guard-deadline.cjs [unit|hooks|all]');
  process.exit(2);
}

let passed = 0;
let failed = 0;
function check(label, cond, detail) {
  if (cond) { passed += 1; console.log('PASS: ' + label); }
  else { failed += 1; console.log('FAIL: ' + label + (detail !== undefined ? ' :: ' + detail : '')); }
}

const T = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), '4003-05a-')));
process.on('exit', () => { try { fs.rmSync(T, { recursive: true, force: true }); } catch (_e) { /* best effort */ } });
const HOME = path.join(T, 'home');
fs.mkdirSync(HOME, { recursive: true });
Object.assign(process.env, { HOME, USERPROFILE: HOME, MINDRIAN_ROOMS_HOME: path.join(HOME, 'MindrianRooms'), MINDRIAN_BRAIN_URL: 'http://127.0.0.1:9' });
delete process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.CLAUDE_CODE_SESSION_ID;
delete process.env.MOS_HOOK_DEADLINE_TEST_MS;
delete process.env.MOS_HOOK_DEADLINE_TEST_STALL_MS;

const J = (x) => JSON.stringify(x);
const msNow = () => Number(process.hrtime.bigint()) / 1e6;
const P8_DEADLINE = 'Canon Part 8: the egress check did not finish in time (reason guard_deadline). Nothing was sent. Send the call again.';
const WEB_DEADLINE = 'Canon Part 8 (web lines): the credential check did not finish in time (reason web_credential_check_deadline). The request was blocked and nothing was sent. Send the request again.';
const P8_UNAVAILABLE = 'Canon Part 8: the egress guard could not run (reason guard_unavailable). Nothing was sent.';
const OUTAGE_LOG = path.join(HOME, '.mindrian', 'telemetry', 'part8-guard-outage.log');
const outageLines = () => { try { return fs.readFileSync(OUTAGE_LOG, 'utf8').split('\n').filter(Boolean); } catch (_e) { return []; } };
function pidAlive(pid) { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } }

// ---------------------------------------------------------------------------
// Group unit (D1-D8)
// ---------------------------------------------------------------------------
function stub(name, body) { const f = path.join(T, name); fs.writeFileSync(f, body); return f; }
function groupUnit() {
  console.log('\n-- group unit --');
  let hd = null;
  try { hd = require(HD); } catch (e) { check('D0 lib/core/hook-deadline.cjs loads', false, e.message); return; }

  check('D1 deadlineFor(5000) is 4000 and DEADLINE_MARGIN_MS is 1000', hd.deadlineFor(5000) === 4000 && hd.DEADLINE_MARGIN_MS === 1000, J([hd.deadlineFor(5000), hd.DEADLINE_MARGIN_MS]));

  {
    const vals = {};
    for (const v of ['1500', '60000', 'x', '-1']) { process.env.MOS_HOOK_DEADLINE_TEST_MS = v; vals[v] = hd.deadlineFor(5000); }
    delete process.env.MOS_HOOK_DEADLINE_TEST_MS;
    check('D2 the test seam lowers only: 1500 gives 1500; 60000, x and -1 give 4000', vals['1500'] === 1500 && vals['60000'] === 4000 && vals.x === 4000 && vals['-1'] === 4000, J(vals));
  }

  {
    const s = stub('d3.cjs', "process.stdout.write('out'); process.stderr.write('err'); process.exit(2);\n");
    const r = hd.runUnderDeadline({ script: s, args: [], input: '', timeoutMs: 5000 });
    check('D3 a child that exits 2: {kind: done, status: 2, stdout: out, stderr: err}', r.kind === 'done' && r.status === 2 && r.stdout === 'out' && r.stderr === 'err', J(r));
  }

  {
    const s = stub('d4.cjs', "process.stdout.write(require('fs').readFileSync(0, 'utf8'));\n");
    const unit = 'Zürich שלום 東京 مرحبا ';
    let input = '';
    while (Buffer.byteLength(input) < 100 * 1024) input += unit;
    const r = hd.runUnderDeadline({ script: s, args: [], input: input, timeoutMs: 5000 });
    check('D4 a 100 KB non-ASCII input comes back byte for byte', r.kind === 'done' && r.stdout === input, J({ kind: r.kind, len: r.stdout && r.stdout.length, want: input.length }));
  }

  {
    const s = stub('d5.cjs', 'Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10000);\n');
    const t0 = msNow();
    const r = hd.runUnderDeadline({ script: s, args: [], input: '', timeoutMs: 1200 });
    const ms = msNow() - t0;
    console.log('D5 measured: deadline after ' + ms.toFixed(0) + ' ms');
    check('D5 a child blocked in a synchronous wait: kind deadline in less than 2000 ms, and the child is gone',
      r.kind === 'deadline' && ms < 2000 && (typeof r.pid !== 'number' || !pidAlive(r.pid)), J({ r, ms: Math.round(ms) }));
  }

  {
    let r = null;
    let threw = false;
    try { r = hd.runUnderDeadline({ script: path.join(T, 'no-such-script.cjs'), args: [], input: '', timeoutMs: 5000 }); } catch (_e) { threw = true; }
    check('D6 a missing script: kind done with a non-zero status, or spawn_failed; no throw',
      !threw && !!r && ((r.kind === 'done' && r.status !== 0) || r.kind === 'spawn_failed'), J({ threw, r: r && { kind: r.kind, status: r.status } }));
  }

  {
    const s = stub('d7.cjs', "const b = 'x'.repeat(1024 * 1024); for (let i = 0; i < 6; i += 1) process.stderr.write(b);\n");
    let r = null;
    let threw = false;
    try { r = hd.runUnderDeadline({ script: s, args: [], input: '', timeoutMs: 10000 }); } catch (_e) { threw = true; }
    check('D7 a child that writes more than MAX_CHILD_OUTPUT_BYTES: spawn_failed ENOBUFS; no throw',
      !threw && !!r && r.kind === 'spawn_failed' && r.reason === 'ENOBUFS', J({ threw, kind: r && r.kind, reason: r && r.reason }));
  }

  {
    const before = outageLines().length;
    const prog = 'require(' + J(OUTAGE) + ").recordGuardOutage('mcp__theo__brain_ask', 'deadline_exceeded');";
    spawnSync(process.execPath, ['-e', prog], { env: process.env, encoding: 'utf8' });
    const lines = outageLines();
    const last = lines[lines.length - 1] || '';
    check('D8 recordGuardOutage(brain tool, deadline_exceeded) writes a line ending with brain deadline_exceeded', lines.length === before + 1 && / brain deadline_exceeded$/.test(last), J({ before, after: lines.length, last }));
  }
}

// ---------------------------------------------------------------------------
// Group hooks (G1-G10)
// ---------------------------------------------------------------------------
const P8_PAYLOAD = { tool_name: 'mcp__plugin_mos_mindrian-brain__brain_ask', tool_input: { question: 'explain dominant design' }, session_id: 'g1' };
const WEB_PAYLOAD = { tool_name: 'WebSearch', tool_input: { query: 'dominant design' } };
// The credential-shaped payload of tests/test-386-web-credential-hook.cjs (a fake key, built at run time).
const FAKE_KEY = ['sk', 'ant', 'api03', 'Zq8Lm2Vx9Rt4Wc7Bn5Yd1Hf3'].join('-');
const WEB_CRED = { tool_name: 'WebSearch', tool_input: { query: 'topic ' + FAKE_KEY } };

function hookEnv(extra) {
  const env = Object.assign({}, process.env, extra || {});
  for (const k of Object.keys(env)) if (env[k] === null) delete env[k];
  return env;
}
function runHook(script, input, extra, nodeArgs) {
  const t0 = msNow();
  const res = spawnSync(process.execPath, (nodeArgs || []).concat([script]), { input: typeof input === 'string' ? input : J(input), encoding: 'utf8', env: hookEnv(extra), timeout: 60000 });
  return { code: res.status, stdout: res.stdout || '', stderr: res.stderr || '', ms: msNow() - t0 };
}
function stats(a) { const s = a.slice().sort((x, y) => x - y); return { p50: s[Math.floor((s.length - 1) / 2)], max: s[s.length - 1] }; }

function groupHooks() {
  console.log('\n-- group hooks --');
  const STALL = { MOS_HOOK_DEADLINE_TEST_STALL_MS: '10000', MOS_HOOK_DEADLINE_TEST_MS: '1500' };

  // G1
  {
    const before = outageLines().length;
    const r = runHook(P8, P8_PAYLOAD, STALL);
    const lines = outageLines();
    console.log('G1 measured: ' + r.ms.toFixed(0) + ' ms');
    check('G1 part8 hook with a stall and a 1500 ms deadline: exit 2, the guard_deadline sentence, under 2500 ms, 1 outage line brain deadline_exceeded',
      r.code === 2 && r.stderr.trim() === P8_DEADLINE && r.ms < 2500 && lines.length === before + 1 && / brain deadline_exceeded$/.test(lines[lines.length - 1]),
      J({ code: r.code, stderr: r.stderr.slice(0, 200), ms: Math.round(r.ms), lines: lines.length - before }));
  }
  // G2
  {
    const r = runHook(P8, P8_PAYLOAD, { MOS_HOOK_DEADLINE_TEST_STALL_MS: '10000' });
    console.log('G2 measured: ' + r.ms.toFixed(0) + ' ms');
    check('G2 part8 hook with a stall and the real deadline: exit 2, the same sentence, 3800 ms or more and less than 4800 ms',
      r.code === 2 && r.stderr.trim() === P8_DEADLINE && r.ms >= 3800 && r.ms < 4800, J({ code: r.code, stderr: r.stderr.slice(0, 200), ms: Math.round(r.ms) }));
  }
  // G3
  {
    const before = outageLines().length;
    const r = runHook(WEB, WEB_PAYLOAD, STALL);
    const lines = outageLines();
    console.log('G3 measured: ' + r.ms.toFixed(0) + ' ms');
    check('G3 web hook with a stall and a 1500 ms deadline: exit 2, the web_credential_check_deadline sentence, under 2500 ms, 1 outage line web deadline_exceeded',
      r.code === 2 && r.stderr.trim() === WEB_DEADLINE && r.ms < 2500 && lines.length === before + 1 && / web deadline_exceeded$/.test(lines[lines.length - 1]),
      J({ code: r.code, stderr: r.stderr.slice(0, 200), ms: Math.round(r.ms), lines: lines.length - before }));
  }
  // G4
  const g4 = runHook(P8, P8_PAYLOAD, {});
  check('G4 part8 hook on the G1 payload with no seam: exit 0, empty stdout and stderr', g4.code === 0 && g4.stdout === '' && g4.stderr === '', J({ code: g4.code, stdout: g4.stdout.slice(0, 100), stderr: g4.stderr.slice(0, 200) }));
  // G5
  let credSentence = null;
  try {
    const base = fs.readFileSync(path.join(ROOT, '.planning', 'phases', '400.3-timeouts-that-lie-hook-budgets-room-db-contention-and-filing', '400.3-05a-BASE.txt'), 'utf8').trim();
    const src = execFileSync('git', ['show', base + ':scripts/web-credential-guard-hook.cjs'], { cwd: ROOT, encoding: 'utf8' });
    const m = src.match(/block\('(Canon Part 8 \(web lines\): a credential-shaped value[^']*)'\)/);
    credSentence = m ? m[1] : null;
  } catch (_e) { credSentence = null; }
  const g5 = runHook(WEB, WEB_CRED, {});
  check('G5 web hook with a credential-shaped query: exit 2 and the BASE credential_shaped sentence', !!credSentence && g5.code === 2 && g5.stderr === credSentence + '\n', J({ code: g5.code, stderr: g5.stderr.slice(0, 240), base: !!credSentence }));
  // G6
  for (const [name, script] of [['part8', P8], ['web', WEB]]) {
    for (const [label, input] of [['empty stdin', ''], ['not json', 'not json']]) {
      const log = path.join(T, 'g6-' + name + '-' + label.replace(/ /g, '-') + '.log');
      const r = runHook(script, input, { NODE_OPTIONS: '--require ' + COUNT_PRELOAD, MOS_PERF_COUNT_LOG: log });
      let n = -1;
      try { n = fs.readFileSync(log, 'utf8').split('\n').filter(Boolean).length; } catch (_e) { n = 0; }
      check('G6 ' + name + ' hook with ' + label + ': exit 0, empty stderr, 1 node process', r.code === 0 && r.stderr === '' && n === 1, J({ code: r.code, stderr: r.stderr.slice(0, 120), processes: n }));
    }
  }
  // G7
  {
    const i4 = runHook(P8, P8_PAYLOAD, {}, []);
    const inner4 = spawnSync(process.execPath, [P8, '--inner'], { input: J(P8_PAYLOAD), encoding: 'utf8', env: hookEnv({}) });
    const inner5 = spawnSync(process.execPath, [WEB, '--inner'], { input: J(WEB_CRED), encoding: 'utf8', env: hookEnv({}) });
    check('G7 --inner gives the same exit code and stderr as the parent run (G4 and G5 payloads)',
      inner4.status === i4.code && (inner4.stderr || '') === i4.stderr && inner5.status === g5.code && (inner5.stderr || '') === g5.stderr,
      J({ p8: [inner4.status, i4.code], web: [inner5.status, g5.code] }));
  }
  // G8
  {
    const hooks = JSON.parse(fs.readFileSync(path.join(ROOT, 'hooks', 'hooks.json'), 'utf8'));
    const found = {};
    (function walk(n) {
      if (Array.isArray(n)) { n.forEach(walk); return; }
      if (n && typeof n === 'object') {
        if (typeof n.command === 'string') {
          if (n.command.indexOf('part8-egress-guard-hook.cjs') !== -1) found.part8 = n;
          if (n.command.indexOf('web-credential-guard-hook.cjs') !== -1) found.web = n;
        }
        Object.keys(n).forEach((k) => walk(n[k]));
      }
    })(hooks);
    const budget = (f) => { const m = fs.readFileSync(f, 'utf8').match(/const HOST_BUDGET_MS = (\d+);/); return m ? parseInt(m[1], 10) : null; };
    const b8 = budget(P8);
    const bw = budget(WEB);
    check('G8 hooks.json timeouts times 1000 equal HOST_BUDGET_MS of the 2 hooks, and both keep onFailure block',
      !!found.part8 && !!found.web && found.part8.timeout * 1000 === b8 && found.web.timeout * 1000 === bw && found.part8.onFailure === 'block' && found.web.onFailure === 'block',
      J({ part8: found.part8 && [found.part8.timeout, found.part8.onFailure], web: found.web && [found.web.timeout, found.web.onFailure], b8, bw }));
  }
  // G9
  {
    const p = [];
    const w = [];
    const codes = [];
    for (let i = 0; i < 10; i += 1) { const r = runHook(P8, P8_PAYLOAD, {}); p.push(r.ms); codes.push(r.code); }
    for (let i = 0; i < 10; i += 1) { const r = runHook(WEB, WEB_PAYLOAD, {}); w.push(r.ms); codes.push(r.code); }
    const a = stats(p);
    const b = stats(w);
    console.log('400.3-05a guard wall ms (Linux, n=10): part8 p50=' + a.p50.toFixed(0) + ' max=' + a.max.toFixed(0) + '; web p50=' + b.p50.toFixed(0) + ' max=' + b.max.toFixed(0) + ' (load average ' + os.loadavg().map((x) => x.toFixed(2)).join(' ') + ')');
    check('G9 each max is less than 1000 ms and every run exits 0', a.max < 1000 && b.max < 1000 && codes.every((c) => c === 0), J({ a, b, codes }));
  }
  // G10
  {
    const marker = path.join(T, 'g10-marker.txt');
    const pre = path.join(T, 'g10-preload.cjs');
    fs.writeFileSync(pre, [
      "'use strict';",
      "const fs = require('fs');",
      "const Module = require('module');",
      'fs.appendFileSync(' + J(marker) + ", 'loaded ' + process.pid + '\\n');",
      'const orig = Module._load;',
      'Module._load = function (request) {',
      '  const out = orig.apply(this, arguments);',
      "  if (/part8-egress-guard(\\.cjs)?$/.test(String(request))) return Object.assign({}, out, { classify() { throw new Error('double: classify'); } });",
      '  return out;',
      '};',
      '',
    ].join('\n'));
    const r = runHook(P8, P8_PAYLOAD, {}, ['--require', pre]);
    let pids = [];
    try { pids = Array.from(new Set(fs.readFileSync(marker, 'utf8').split('\n').filter(Boolean))); } catch (_e) { pids = []; }
    check('G10 a --require preload reaches the check: exit 2 with the guard_unavailable sentence, and 2 different pids loaded the preload',
      r.code === 2 && r.stderr.trim() === P8_UNAVAILABLE && pids.length === 2, J({ code: r.code, stderr: r.stderr.slice(0, 200), pids: pids.length }));
  }
}

function main() {
  if (GROUP === 'unit' || GROUP === 'all') groupUnit();
  if (GROUP === 'hooks' || GROUP === 'all') groupHooks();
  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed === 0 ? 0 : 1);
}
try { main(); } catch (e) { console.log('FAIL: harness error ' + (e && e.stack || e)); process.exit(1); }
