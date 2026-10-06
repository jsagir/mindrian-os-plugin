#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 369.2 Plan 27 (369.2-R24; SW-17 one-line half; brief test 12 one-line half). A Eureka run that judged
 * nothing says in one sentence why and what to do next, on both surfaces. The flag names stay with 369.5.
 *
 *   JL1  no key (TYPESAFE_API_KEY unset, temp HOME, no secrets file): judgeState(room).state 'no_key' with the
 *        exact no-key sentence; the MCP perspective_judge next_step equals it and carries judge_state
 *   JL1b a key in the temp HOME secrets file counts as present (presence only); state line_off, never no_key
 *   JL2  TYPESAFE_API_KEY set and the room's judge_jev line off (shipped default false): state 'line_off' and
 *        the exact line-off sentence, on judgeState and on the MCP next_step
 *   JL2b an injected policy with the line on gives state 'available' and the MCP-surface sentence
 *   JL3  node scripts/eureka-jev-judge.cjs with no key -> JSON {ok:false, reason:'no_key', line:<no-key sentence>},
 *        exit 3 (unchanged code)
 *   JL4  research-planner.cjs perspective-judge --judge none: JSON carries judge_state and line (no key and key
 *        set); no key value appears in any output of any leg
 *   JL5  no em-dash or en-dash in this file; zero network attempts
 *
 * Hermetic: HOME, USERPROFILE and MINDRIAN_ROOMS_HOME are mkdtemp dirs before any repo module loads; the vendor
 * keys are deleted; a net guard counts any fetch that escapes. Output: one PASS or FAIL line per leg, then
 * PASS: n FAIL: n. Exit 0 pass, 1 fail. House rule: hyphens only.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const TMP_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-3692-27-jl-home-'));
process.env.HOME = TMP_HOME;
process.env.USERPROFILE = TMP_HOME;
process.env.MINDRIAN_ROOMS_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-3692-27-jl-rooms-'));
delete process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.CLAUDE_CODE_SESSION_ID;
delete process.env.MINDRIAN_MCP_FIRST;
delete process.env.TYPESAFE_API_KEY;

try { require('node:sqlite'); } catch (_e) {
  process.stdout.write('ENV GAP: node:sqlite unavailable (node ' + process.version + '); need node >= 22\n');
  process.exit(77);
}

const REPO_ROOT = path.resolve(__dirname, '..');
const hygiene = require(path.join(REPO_ROOT, 'tests/helpers/hygiene-355.cjs'));
hygiene.scrubVendorKey && hygiene.scrubVendorKey();
delete process.env.ANTHROPIC_API_KEY;
delete process.env.TYPESAFE_API_KEY;
const NET = hygiene.installNetGuard();
const C = hygiene.makeChecker('test-3692-judge-line');

const fixture = require(path.join(REPO_ROOT, 'tests/helpers/fixture-366.cjs'));
const eurekaJudge = require(path.join(REPO_ROOT, 'lib/core/research-planner/perspectives/eureka-judge.cjs'));
const { registerCoreTools } = require(path.join(REPO_ROOT, 'lib/mcp/register-core-tools.cjs'));

const FAKE_KEY = 'sk-test-3692-27-NOT-A-REAL-KEY-' + 'x'.repeat(24);
const NO_KEY_LINE = 'No model judged these pairs: no Jev key is set on this machine. Read the pairs that passed and judge them yourself, or set TYPESAFE_API_KEY and run the Jev judge in Claude Code.';
const LINE_OFF_LINE = "No model judged these pairs: the judge line is off by this room's policy. Read the pairs that passed and judge them yourself.";
const AVAILABLE_LINE = 'No model judged these pairs on this surface; the Jev judge runs in Claude Code.';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-3692-27-jl-'));
const room = fixture.buildPerspectiveRoom(root, { name: 'room' });
const R = room.roomDir;
const TAG = '20261006T270001Z';

const captured = new Map();
const stub = {
  tool: function (name, _d, _s, fn) { captured.set(name, fn); },
  registerTool: function (name, cfg, fn) { captured.set(name, fn); captured.set(name + ':cfg', cfg); },
};
registerCoreTools(stub, { fallbackRoomDir: R, pluginRoot: REPO_ROOT, surface: 'desktop' });
async function call(input) {
  const raw = await captured.get('research_run')(input, { sessionId: 'sess-3692-27' });
  return JSON.parse(raw.content[0].text);
}

const OUTPUTS = [];
function note(s) { OUTPUTS.push(String(s)); return s; }

function cli(script, args, extraEnv) {
  const env = Object.assign({}, process.env);
  delete env.TYPESAFE_API_KEY;
  delete env.OPENALEX_API_KEY;
  Object.assign(env, extraEnv || {});
  env.HOME = TMP_HOME;
  env.USERPROFILE = TMP_HOME;
  const res = spawnSync(process.execPath, [path.join(REPO_ROOT, script)].concat(args), { encoding: 'utf8', env: env, timeout: 90000 });
  note(res.stdout); note(res.stderr);
  let json = null;
  try { json = JSON.parse(String(res.stdout || '').trim().split('\n').pop()); } catch (_e) { json = null; }
  return { code: res.status, json: json, stdout: String(res.stdout || '') };
}

async function leg(name, fn) {
  try {
    const r = await fn();
    C.check(name, r === true, r === true ? '' : String(r));
  } catch (e) {
    C.check(name, false, 'threw: ' + String((e && e.stack) || e).replace(/\s+/g, ' ').slice(0, 500));
  }
}

const SECRETS = path.join(TMP_HOME, '.secrets', 'typesafe.env');

(async function main() {
  const rec = await call({ op: 'perspective_recall', perspective: 'eureka', max_candidates: 5, run_tag: TAG });
  note(JSON.stringify(rec));
  if (rec.ok !== true) { C.check('setup: perspective_recall made the candidates', false, JSON.stringify(rec).slice(0, 300)); process.exit(C.summary()); }

  await leg('JL1 no key: judgeState says no_key with the exact sentence, and the MCP next_step is that sentence', async function () {
    delete process.env.TYPESAFE_API_KEY;
    if (typeof eurekaJudge.judgeState !== 'function') return 'eurekaJudge.judgeState is not exported';
    const st = eurekaJudge.judgeState(R);
    const j = await call({ op: 'perspective_judge', perspective: 'eureka', run_tag: TAG });
    note(JSON.stringify(j));
    console.log('JL1 measured: state=' + st.state + ' next_step=' + j.next_step);
    return (st.state === 'no_key' && st.line === NO_KEY_LINE && j.ok === true && j.judge_state === 'no_key' && j.next_step === NO_KEY_LINE)
      || JSON.stringify({ st: st, next: j.next_step, judge_state: j.judge_state });
  });

  await leg('JL1b a key in the secrets file counts as present: line_off, never no_key; the value is not returned', function () {
    fs.mkdirSync(path.dirname(SECRETS), { recursive: true });
    fs.writeFileSync(SECRETS, 'TYPESAFE_API_KEY=' + FAKE_KEY + '\n');
    try {
      delete process.env.TYPESAFE_API_KEY;
      const st = eurekaJudge.judgeState(R);
      note(JSON.stringify(st));
      return (st.state === 'line_off' && st.line === LINE_OFF_LINE && JSON.stringify(st).indexOf(FAKE_KEY) === -1) || JSON.stringify(st);
    } finally { fs.rmSync(path.dirname(SECRETS), { recursive: true, force: true }); }
  });

  await leg('JL2 key set, the judge_jev line off (shipped default): line_off with the exact sentence on both', async function () {
    process.env.TYPESAFE_API_KEY = FAKE_KEY;
    try {
      const st = eurekaJudge.judgeState(R);
      const j = await call({ op: 'perspective_judge', perspective: 'eureka', run_tag: TAG });
      note(JSON.stringify(st)); note(JSON.stringify(j));
      console.log('JL2 measured: state=' + st.state + ' next_step=' + j.next_step);
      return (st.state === 'line_off' && st.line === LINE_OFF_LINE && j.judge_state === 'line_off' && j.next_step === LINE_OFF_LINE)
        || JSON.stringify({ st: st, next: j.next_step });
    } finally { delete process.env.TYPESAFE_API_KEY; }
  });

  await leg('JL2b a policy with the judge_jev line on gives available and the MCP-surface sentence', function () {
    process.env.TYPESAFE_API_KEY = FAKE_KEY;
    try {
      const policy = { schema: 'mos.egress-policy/1', offline: false, lines: { judge_jev: { default: true, allowed: true } }, ignored: [] };
      const st = eurekaJudge.judgeState(R, { policy: policy });
      note(JSON.stringify(st));
      return (st.state === 'available' && st.line === AVAILABLE_LINE) || JSON.stringify(st);
    } finally { delete process.env.TYPESAFE_API_KEY; }
  });

  await leg('JL3 eureka-jev-judge with no key: {ok:false, reason:no_key, line}, exit 3', function () {
    const r = cli('scripts/eureka-jev-judge.cjs', ['--room', R, '--tag', TAG]);
    console.log('JL3 measured: exit=' + r.code + ' ' + r.stdout.trim().slice(0, 300));
    return (r.code === 3 && r.json && r.json.ok === false && r.json.reason === 'no_key' && r.json.line === NO_KEY_LINE) || JSON.stringify({ code: r.code, json: r.json });
  });

  await leg('JL4 research-planner perspective-judge carries judge_state and line; no key value in any output', function () {
    const a = cli('scripts/research-planner.cjs', ['perspective-judge', '--room', R, '--perspective', 'eureka', '--tag', TAG, '--judge', 'none']);
    const b = cli('scripts/research-planner.cjs', ['perspective-judge', '--room', R, '--perspective', 'eureka', '--tag', TAG, '--judge', 'none'], { TYPESAFE_API_KEY: FAKE_KEY });
    console.log('JL4 measured: a=' + (a.json && a.json.judge_state) + ' b=' + (b.json && b.json.judge_state));
    const okA = a.code === 0 && a.json && a.json.ok === true && a.json.judge_state === 'no_key' && a.json.line === NO_KEY_LINE;
    const okB = b.code === 0 && b.json && b.json.ok === true && b.json.judge_state === 'line_off' && b.json.line === LINE_OFF_LINE;
    const leaked = OUTPUTS.some(function (s) { return s.indexOf(FAKE_KEY) !== -1; });
    return (okA && okB && !leaked) || JSON.stringify({ okA: okA, okB: okB, leaked: leaked, a: a.json, b: b.json });
  });

  await leg('JL5 no em-dash or en-dash in this file', function () {
    const src = fs.readFileSync(__filename, 'utf8');
    return (src.indexOf(String.fromCharCode(0x2014)) === -1 && src.indexOf(String.fromCharCode(0x2013)) === -1) || 'a dash is present';
  });

  C.check('net guard: zero network attempts', NET.attempts() === 0, String(NET.attempts()));
  process.exit(C.summary());
})().catch(function (e) {
  console.log('FAIL: harness (' + String((e && e.stack) || e).slice(0, 500) + ')');
  process.exit(1);
});
