#!/usr/bin/env node
'use strict';

/*
 * Plan 386-30 (finding E-FAIL, owner decision option A plus the count-only
 * outage line, plan 386-29, 2026-11-06).
 *
 * THE DEFECT. When the Part 8 guard cannot load, or classify throws, the hook
 * (scripts/part8-egress-guard-hook.cjs) exits 0 and the in-process belts in
 * lib/core/brain-client.cjs (callTool, query) go on to send the payload. The
 * safeguard then depends on the guard loading, and nothing tells the user.
 *
 * THE RULE. A guard that cannot run blocks every payload-carrying call with a
 * typed reason: the hook exits 2 with guard_unavailable, the belts return
 * { error: 'egress_guard_unavailable', tool } with 0 network calls. A provably
 * empty payload (a plain object with no keys) still proceeds, because zero
 * bytes cannot leak. Every outage writes ONE count-only line to
 * ~/.mindrian/telemetry/part8-guard-outage.log: an ISO timestamp, the tool-name
 * class (brain, web, other) and the failure mode. Never a payload byte, a tool
 * argument or a question word. A failing log write never changes a verdict.
 *
 * TEST DOUBLES ONLY. The hook child process gets a node --require preload that
 * wraps Module._load. In-process code gets a require.cache replacement. No
 * module on disk is edited or broken.
 *
 * ARMS: FC1 to FC16 (see the labels below).
 *
 * Canon Part 8: synthetic strings only, a fake credential built at run time,
 * fetch replaced by a counter, a throwaway HOME for every arm that reads the
 * log. No body, marker or credential is printed.
 */

const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawnSync } = require('child_process');

const REPO = path.resolve(__dirname, '..');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 't386fc-'));
process.env.MINDRIAN_BRAIN_RETRY_MAX = '0';
process.env.MINDRIAN_BRAIN_KEY = 'fake-key-for-test-only-0000';
delete process.env.PART8_FORCE_BRAIN_AVAILABLE;

const HOOK = path.join(REPO, 'scripts', 'part8-egress-guard-hook.cjs');
const GUARD = path.join(REPO, 'lib', 'core', 'part8-egress-guard.cjs');
const BRAIN_CLIENT = path.join(REPO, 'lib', 'core', 'brain-client.cjs');

const MARKER_WORD = 'zzmarkerword';
const MARKER_KEY = 'zzmarkerkeyname';
const QUESTION = 'how do the ' + MARKER_WORD + ' pancake pricing sprout assemble';
// A fake credential built at run time, so no literal key shape sits in the file.
const FAKE_CRED = ['sk', 'ant', 'api03', 'Zq8Lm2Vx9Rt4Wc7Bn5Yd1Hf3'].join('-');
const LINE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z (brain|web|other) (guard_load_failed|sanitizer_load_failed|classify_threw|verdict_invalid|hook_uncaught)$/;

const TOOL = 'mcp__plugin_mos_mindrian-brain__brain_ask';
const TOOL_STATS = 'mcp__plugin_mos_mindrian-brain__brain_stats';
const PAYLOAD = { question: QUESTION, apiKey: FAKE_CRED };
PAYLOAD[MARKER_KEY] = 'x';

let failures = 0;
function check(label, cond, detail) {
  if (cond) {
    console.log('ok - ' + label);
  } else {
    failures++;
    console.log('FAIL - ' + label + (detail ? ' :: ' + detail : ''));
  }
}

let homeSeq = 0;
function freshHome() {
  const h = path.join(TMP, 'home' + (++homeSeq));
  fs.mkdirSync(h, { recursive: true });
  return h;
}
function logPath(home) { return path.join(home, '.mindrian', 'telemetry', 'part8-guard-outage.log'); }
function readLines(home) {
  try {
    const t = fs.readFileSync(logPath(home), 'utf8');
    return t.split('\n').filter((l) => l.length > 0);
  } catch (_) {
    return [];
  }
}
function readText(home) {
  try { return fs.readFileSync(logPath(home), 'utf8'); } catch (_) { return ''; }
}

// The preload double for the hook child process. Wraps Module._load only.
const PRELOAD = path.join(TMP, 'preload-double.cjs');
fs.writeFileSync(PRELOAD, [
  "'use strict';",
  "const Module = require('module');",
  'const orig = Module._load;',
  'const mode = process.env.T386_FAIL;',
  'Module._load = function (request) {',
  '  const isGuard = /part8-egress-guard\\.cjs$/.test(String(request));',
  '  const isSan = /brain-response-sanitize\\.cjs$/.test(String(request));',
  "  if (mode === 'guard_load' && isGuard) throw new Error('double: guard load');",
  "  if (mode === 'sanitizer_load' && isSan) throw new Error('double: sanitizer load');",
  '  const out = orig.apply(this, arguments);',
  "  if (mode === 'classify' && isGuard) return Object.assign({}, out, { classify() { throw new Error('double: classify'); } });",
  "  if (mode === 'verdict' && isGuard) return Object.assign({}, out, { classify() { return null; } });",
  "  if (mode === 'uncaught' && isGuard) return Object.assign({}, out, { classify() { return { get verdict() { throw new Error('double: getter'); } }; } });",
  '  return out;',
  '};',
  '',
].join('\n'));

function runHook(mode, toolName, toolInput, home) {
  const args = [];
  if (mode) args.push('--require', PRELOAD);
  args.push(HOOK);
  const env = Object.assign({}, process.env, { HOME: home, USERPROFILE: home });
  delete env.PART8_FORCE_BRAIN_AVAILABLE;
  if (mode) env.T386_FAIL = mode; else delete env.T386_FAIL;
  const res = spawnSync(process.execPath, args, {
    input: JSON.stringify({ tool_name: toolName, tool_input: toolInput, session_id: 't386fc' }),
    encoding: 'utf8',
    env: env,
    timeout: 20000,
  });
  return { code: res.status, stderr: res.stderr || '', stdout: res.stdout || '' };
}

function noLeak(text) {
  return text.indexOf(MARKER_WORD) === -1 && text.indexOf(MARKER_KEY) === -1 &&
    text.indexOf(FAKE_CRED) === -1 && text.indexOf('pancake') === -1 && text.indexOf('pricing') === -1;
}

// ---- in-process helpers: fetch counter and a require.cache double ---------
let fetchCalls = 0;
globalThis.fetch = async function (url, init) {
  fetchCalls++;
  const body = init && typeof init.body === 'string' ? init.body : '';
  let method = null;
  try { method = JSON.parse(body).method; } catch (_) { /* not json */ }
  const resp = (ok, status, text) => ({
    ok: ok, status: status, headers: { get: () => null },
    text: async () => text, arrayBuffer: async () => new ArrayBuffer(0),
  });
  if (method === 'initialize') return resp(true, 200, '');
  return resp(true, 200, 'data: ' + JSON.stringify({
    result: { content: [{ type: 'text', text: JSON.stringify({ ok: true }) }] },
  }));
};

function freshBrainClient(guardDouble) {
  delete require.cache[BRAIN_CLIENT];
  delete require.cache[GUARD];
  if (guardDouble) {
    require.cache[GUARD] = { id: GUARD, filename: GUARD, loaded: true, exports: guardDouble, children: [], paths: [] };
  }
  return require(BRAIN_CLIENT);
}
const THROWING_GUARD = {
  classify() { throw new Error('double: classify'); },
  _isFreeFormTool() { return false; },
};
function restoreGuard() {
  delete require.cache[BRAIN_CLIENT];
  delete require.cache[GUARD];
}

function isTyped(r, tool) {
  return !!r && typeof r === 'object' && r.error === 'egress_guard_unavailable' && r.tool === tool;
}

async function main() {
  // ---- hook arms ----------------------------------------------------------
  const hFC = {};
  for (const [label, mode] of [['FC1', 'guard_load'], ['FC2', 'classify'], ['FC3', 'sanitizer_load']]) {
    const home = freshHome();
    const r = runHook(mode, TOOL, PAYLOAD, home);
    hFC[label] = { r: r, home: home };
    check(label + ': hook exits 2 and names guard_unavailable, no payload bytes (' + mode + ')',
      r.code === 2 && r.stderr.indexOf('guard_unavailable') !== -1 && noLeak(r.stderr + r.stdout),
      'exit=' + r.code);
  }

  // FC4: real guard, generic question allows, content hit blocks.
  {
    const a = runHook(null, TOOL, { question: 'framework chain analysis sequence' }, freshHome());
    const b = runHook(null, TOOL, { question: 'contact me at jane@startup.com' }, freshHome());
    check('FC4: real guard exits 0 for a generic question and 2 for a content hit',
      a.code === 0 && b.code === 2, 'generic=' + a.code + ' content=' + b.code);
  }

  // FC5: callTool with a throwing double and a payload returns the typed result.
  {
    const home = freshHome();
    process.env.HOME = home; process.env.USERPROFILE = home;
    fetchCalls = 0;
    const bc = freshBrainClient(THROWING_GUARD);
    const r = await bc.callTool('brain_ask', { question: QUESTION });
    check('FC5: callTool with a throwing guard returns egress_guard_unavailable and makes 0 fetch calls',
      isTyped(r, 'brain_ask') && fetchCalls === 0, 'fetch=' + fetchCalls);
    restoreGuard();
  }

  // FC6 and FC13: the empty payload proceeds, and writes exactly 1 line.
  {
    const home = freshHome();
    process.env.HOME = home; process.env.USERPROFILE = home;
    fetchCalls = 0;
    const bc = freshBrainClient(THROWING_GUARD);
    const r = await bc.callTool('brain_stats', {});
    check('FC6: callTool with a throwing guard and the empty payload {} proceeds',
      !isTyped(r, 'brain_stats') && fetchCalls > 0, 'fetch=' + fetchCalls);
    const lines = readLines(home);
    check('FC13: the empty payload proceed appends exactly 1 outage line',
      lines.length === 1 && LINE_RE.test(lines[0]) && / brain classify_threw$/.test(lines[0]),
      'lines=' + lines.length);
    restoreGuard();
  }

  // FC7: query() with a throwing guard double.
  {
    const home = freshHome();
    process.env.HOME = home; process.env.USERPROFILE = home;
    fetchCalls = 0;
    const bc = freshBrainClient(THROWING_GUARD);
    const r = await bc.query('MATCH (f:Framework) RETURN f.name', {});
    check('FC7: query() with a throwing guard returns the typed result and makes 0 fetch calls',
      isTyped(r, 'brain_query') && fetchCalls === 0, 'fetch=' + fetchCalls);
    restoreGuard();
  }

  // FC8: real guard verdicts unchanged.
  {
    const home = freshHome();
    process.env.HOME = home; process.env.USERPROFILE = home;
    fetchCalls = 0;
    const bc = freshBrainClient(null);
    const a = await bc.callTool('brain_stats', {});
    const sent = fetchCalls;
    fetchCalls = 0;
    const b = await bc.callTool('brain_ask', { question: 'contact me at jane@startup.com' });
    const blockedCalls = fetchCalls;
    fetchCalls = 0;
    const q = await bc.query('MATCH (f:Framework) RETURN f.name', {});
    check('FC8: with the real guard callTool and query() keep their verdicts',
      sent > 0 && !(a && a.error) && b && b.error === 'egress_blocked' && blockedCalls === 0 &&
      !(q && q.error === 'egress_guard_unavailable') && fetchCalls > 0,
      'sent=' + sent + ' blocked=' + blockedCalls + ' query=' + fetchCalls);
    restoreGuard();
  }

  // FC9: the hook with the guard require throwing leaves exactly 1 strict line.
  {
    const h = hFC.FC1.home;
    const lines = readLines(h);
    check('FC9: guard_load_failed leaves exactly 1 strict line in the outage log',
      lines.length === 1 && LINE_RE.test(lines[0]) && / guard_load_failed$/.test(lines[0]),
      'lines=' + lines.length);
  }

  // FC10: classify throw and sanitizer throw: 1 line each.
  {
    const l2 = readLines(hFC.FC2.home);
    const l3 = readLines(hFC.FC3.home);
    check('FC10: classify_threw and sanitizer_load_failed leave 1 strict line each',
      l2.length === 1 && LINE_RE.test(l2[0]) && / classify_threw$/.test(l2[0]) &&
      l3.length === 1 && LINE_RE.test(l3[0]) && / sanitizer_load_failed$/.test(l3[0]),
      'classify=' + l2.length + ' sanitizer=' + l3.length);
  }

  // FC11: the line holds no payload content. One shared HOME, 4 outages.
  {
    const home = freshHome();
    runHook('guard_load', TOOL, PAYLOAD, home);
    runHook('classify', TOOL, PAYLOAD, home);
    runHook('sanitizer_load', TOOL, PAYLOAD, home);
    process.env.HOME = home; process.env.USERPROFILE = home;
    const bc = freshBrainClient(THROWING_GUARD);
    await bc.callTool('brain_ask', PAYLOAD);
    restoreGuard();
    const text = readText(home);
    const lines = readLines(home);
    check('FC11: the outage log holds no payload word, key name or credential; 4 lines, all strict',
      lines.length === 4 && lines.every((l) => LINE_RE.test(l)) && noLeak(text),
      'lines=' + lines.length);
  }

  // FC12: callTool and query() each append exactly 1 line, class brain.
  {
    const homeA = freshHome();
    process.env.HOME = homeA; process.env.USERPROFILE = homeA;
    fetchCalls = 0;
    let bc = freshBrainClient(THROWING_GUARD);
    await bc.callTool('brain_ask', { question: QUESTION });
    const la = readLines(homeA);
    restoreGuard();
    const homeB = freshHome();
    process.env.HOME = homeB; process.env.USERPROFILE = homeB;
    bc = freshBrainClient(THROWING_GUARD);
    await bc.query('MATCH (f:Framework) RETURN f.name', {});
    const lb = readLines(homeB);
    restoreGuard();
    check('FC12: callTool and query() each append exactly 1 line (brain classify_threw) and make 0 fetch calls',
      la.length === 1 && / brain classify_threw$/.test(la[0]) && LINE_RE.test(la[0]) &&
      lb.length === 1 && / brain classify_threw$/.test(lb[0]) && LINE_RE.test(lb[0]) && fetchCalls === 0,
      'callTool=' + la.length + ' query=' + lb.length + ' fetch=' + fetchCalls);
  }

  // FC14: the log cannot be written; verdicts do not change.
  {
    const blocker = path.join(TMP, 'regular-file');
    fs.writeFileSync(blocker, 'x');
    const home = path.join(blocker, 'sub');
    const r = runHook('guard_load', TOOL, PAYLOAD, home);
    process.env.HOME = home; process.env.USERPROFILE = home;
    fetchCalls = 0;
    const bc = freshBrainClient(THROWING_GUARD);
    const t = await bc.callTool('brain_ask', { question: QUESTION });
    restoreGuard();
    check('FC14: with an unwritable log the hook still exits 2 and callTool still returns the typed result',
      r.code === 2 && isTyped(t, 'brain_ask') && fetchCalls === 0,
      'exit=' + r.code + ' fetch=' + fetchCalls);
  }

  // FC15: healthy run leaves no outage line and no telemetry folder.
  {
    const home = freshHome();
    const r = runHook(null, TOOL, { question: 'framework chain analysis sequence' }, home);
    check('FC15: a healthy run writes no outage line and creates no telemetry folder',
      r.code === 0 && !fs.existsSync(logPath(home)) && !fs.existsSync(path.join(home, '.mindrian', 'telemetry')),
      'exit=' + r.code);
  }

  // FC16: an invalid verdict and an uncaught error after the input was read.
  {
    const hv = freshHome();
    const rv = runHook('verdict', TOOL, PAYLOAD, hv);
    const lv = readLines(hv);
    const hu = freshHome();
    const ru = runHook('uncaught', TOOL, PAYLOAD, hu);
    const lu = readLines(hu);
    check('FC16: an invalid verdict and an uncaught error exit 2 with 1 strict line each',
      rv.code === 2 && lv.length === 1 && / verdict_invalid$/.test(lv[0]) && LINE_RE.test(lv[0]) &&
      ru.code === 2 && lu.length === 1 && / hook_uncaught$/.test(lu[0]) && LINE_RE.test(lu[0]),
      'verdict exit=' + rv.code + ' lines=' + lv.length + '; uncaught exit=' + ru.code + ' lines=' + lu.length);
  }

  // FC17: the hook keeps exit 0 for the empty payload (and writes the line), for garbage stdin and for a non-Brain tool.
  {
    const he = freshHome();
    const re = runHook('guard_load', TOOL_STATS, {}, he);
    const le = readLines(he);
    const hg = freshHome();
    const g = spawnSync(process.execPath, ['--require', PRELOAD, HOOK], {
      input: 'not json {', encoding: 'utf8',
      env: Object.assign({}, process.env, { HOME: hg, USERPROFILE: hg, T386_FAIL: 'guard_load' }),
    });
    check('FC17: the empty payload and garbage stdin still exit 0 when the guard cannot load; the empty payload writes 1 line',
      re.code === 0 && le.length === 1 && LINE_RE.test(le[0]) && g.status === 0 && readLines(hg).length === 0,
      'empty exit=' + re.code + ' lines=' + le.length + ' garbage exit=' + g.status);
  }

  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_) { /* ignore */ }
  if (failures > 0) {
    console.log('\nFAILED: ' + failures + ' arm(s)');
    process.exit(1);
  }
  console.log('\ntest-386-guard-fails-closed: ALL PASS');
}

main().catch((e) => {
  console.log('FAIL - uncaught test error: ' + (e && e.message));
  process.exit(1);
});
