#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 384 Plan 15 (S7, PERF384-F04). MCP start loads the tool files.
 *
 * Two groups (first argument selects; no argument runs both):
 *   parity     P1 tools/list equals the golden (name, title, description, inputSchema, outputSchema, annotations),
 *              P2 initialize (serverInfo, capabilities) equals the golden,
 *              P3 the registration health equals the golden (complete, no failure, 37 registered file names).
 *              Passes on the code before the change and after it.
 *   mechanism  M1 the length of require.cache after registerCoreTools is at most BASELINE_MODULES minus REMOVED_MODULES
 *              in 3 of 3 fresh child processes,
 *              M2 each file of SELECTED_TOOL_FILES loads without its heavy module group.
 *
 * Golden: SPEED384_WRITE_GOLDEN=1 node tests/test-384-s7-mcp-start.cjs parity
 * writes tests/fixtures/384-s7-tools-list-golden.json from the code as it stands.
 * SPEED384_TREE_B=<dir> tests another tree (a pinned export) instead of the working tree.
 *
 * Part 8: fixture room only, sandbox HOME, sandbox rooms home, unreachable loopback as Brain URL (the harness makeCtx
 * environment). No network. No em-dashes. CJS only. Run it under the 384 lock (it starts a real server).
 */

const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const assert = require('node:assert');
const os = require('node:os');

const REPO = path.join(__dirname, '..');
const TREE_B = path.resolve(process.env.SPEED384_TREE_B || REPO);
const GOLDEN_PATH = path.join(__dirname, 'fixtures', '384-s7-tools-list-golden.json');
const WRITE_GOLDEN = process.env.SPEED384_WRITE_GOLDEN === '1';
const H = require(path.join(REPO, 'tools', 'perf', 'perf-harness.cjs'));

// BASELINE_MODULES: length of require.cache after registerCoreTools on the code before the change (zod required
// first), measured in 3 fresh child processes on the unchanged code: 479, 479, 479.
const BASELINE_MODULES = 479;
// REMOVED_MODULES: the modules that only the selected tool files reach (no other tool file loads them), taken from
// the attribution table (measurements/fix-s7-attribution.md). The table counted 100 exclusive modules; 4 of them are reached by
// requires that stay eager (perspectives/index, surfaced-offers, answer-route, session-verify-state), so the reachable number is 97,
// rounded down to a multiple of 5.
const REMOVED_MODULES = 95;
// The files that the change moves handler-only requires in, with the module path parts that must not be loaded when
// that one file is required alone.
const SELECTED_TOOL_FILES = {
  'research.cjs': ['research-planner/planner.cjs', 'research-planner/quick.cjs', 'research-planner/grants.cjs', 'research-planner/structure.cjs', 'research-planner/canon-release.cjs', 'perspectives/eureka-judge.cjs'],
  'sensors.cjs': ['workflow/reach-hedge-ranker.cjs', 'brain/chain-recommender.cjs', 'feyminto/next-move.cjs'],
  'gate.cjs': ['strategy/goal-gate.cjs', 'mcp/gate-raised.cjs'],
  'stop-gate.cjs': ['mcp/stop-gate-handler.cjs'],
};

let pass = 0;
let fail = 0;
function ok(id, cond, detail) {
  if (cond) {
    pass += 1;
    console.log('ok   ' + id);
  } else {
    fail += 1;
    console.log('FAIL ' + id + (detail ? ' (' + detail + ')' : ''));
  }
}

// ---------------------------------------------------------------------------
// a small line-framed JSON-RPC stdio client (copied in small form from the probe; this test must not require bench)
// ---------------------------------------------------------------------------
function startServer(script, cwd, env, hasTaskset) {
  const argv = [process.execPath, script];
  const full = hasTaskset ? ['taskset', '-c', '0-3'].concat(argv) : argv;
  const child = cp.spawn(full[0], full.slice(1), { cwd, env, detached: true, stdio: ['pipe', 'pipe', 'ignore'] });
  const pending = new Map();
  let nextId = 1;
  let buf = '';
  child.on('error', () => {});
  child.stdin.on('error', () => {});
  child.on('exit', () => { for (const [, fn] of pending) fn(null); pending.clear(); });
  child.stdout.on('data', (d) => {
    buf += String(d);
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const t = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!t || t[0] !== '{') continue;
      let msg;
      try { msg = JSON.parse(t); } catch (_e) { continue; }
      if (msg && msg.id !== undefined && msg.method === undefined && pending.has(msg.id)) {
        const fn = pending.get(msg.id);
        pending.delete(msg.id);
        fn(msg);
      }
    }
  });
  const write = (o) => { try { child.stdin.write(JSON.stringify(o) + '\n'); } catch (_e) { /* closed */ } };
  return {
    notify(method, params) { write({ jsonrpc: '2.0', method, params: params || {} }); },
    request(method, params, timeoutMs) {
      return new Promise((resolve, reject) => {
        const id = nextId;
        nextId += 1;
        const timer = setTimeout(() => { pending.delete(id); reject(new Error('timeout:' + method)); }, timeoutMs || 60000);
        pending.set(id, (msg) => { clearTimeout(timer); if (!msg) reject(new Error('exited:' + method)); else resolve(msg); });
        write({ jsonrpc: '2.0', id, method, params: params || {} });
      });
    },
    stop() { try { process.kill(-child.pid, 'SIGKILL'); } catch (_e) { /* gone */ } },
  };
}

async function readSurface() {
  const avail = typeof os.availableParallelism === 'function' ? os.availableParallelism() : os.cpus().length;
  const hasTaskset = os.platform() === 'linux' && avail >= 4 && cp.spawnSync('taskset', ['--version'], { stdio: 'ignore' }).status === 0;
  const prep = H.prepareRoom('fixture', { trees: [TREE_B], baseSha: 'unknown' });
  const ctx = H.makeCtx('B', TREE_B, prep, 4, hasTaskset);
  const srv = startServer(path.join(TREE_B, 'scripts', 'mindrian-mcp-server.cjs'), ctx.roomDir, ctx.env({}), hasTaskset);
  try {
    const init = await srv.request('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'test-384-s7', version: '1' } }, 90000);
    srv.notify('notifications/initialized');
    const tools = [];
    let cursor;
    for (let page = 0; page < 20; page += 1) {
      const list = await srv.request('tools/list', cursor ? { cursor } : {}, 90000);
      for (const t of (list.result && list.result.tools) || []) tools.push(t);
      cursor = list.result && list.result.nextCursor;
      if (!cursor) break;
    }
    const r = (init && init.result) || {};
    const info = Object.assign({}, r.serverInfo || {});
    info.version = '<VERSION>';
    return {
      ctx,
      initialize: { serverInfo: info, capabilities: r.capabilities || null },
      tools: tools.map((t) => ({ name: t.name, title: t.title === undefined ? null : t.title, description: t.description === undefined ? null : t.description, inputSchema: t.inputSchema === undefined ? null : t.inputSchema, outputSchema: t.outputSchema === undefined ? null : t.outputSchema, annotations: t.annotations === undefined ? null : t.annotations })).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)),
      cleanup: () => { srv.stop(); try { prep.sandbox.cleanup(); } catch (_e) { /* best effort */ } },
    };
  } catch (e) {
    srv.stop();
    try { prep.sandbox.cleanup(); } catch (_e) { /* best effort */ }
    throw e;
  }
}

// ---------------------------------------------------------------------------
// fresh child programs
// ---------------------------------------------------------------------------
const STUB = [
  "const names=[];const quiet=new Proxy(function(){},{get:(t,k)=>k==='then'?undefined:quiet,apply:()=>undefined});",
  "const stub={registerTool:(n)=>{names.push(n);return {update(){},enable(){},disable(){},remove(){}};},tool:(n)=>{names.push(n);},server:quiet,registerResource:()=>({}),registerPrompt:()=>({})};",
].join('');

function childRun(code, ctx, extraArgs) {
  const r = cp.spawnSync(process.execPath, ['-e', code, TREE_B].concat(extraArgs || []), { cwd: TREE_B, env: ctx.env({}), encoding: 'utf8', timeout: 120000 });
  if (r.status !== 0) return { error: 'exit ' + r.status + ' ' + String(r.stderr || '').slice(0, 200) };
  const line = String(r.stdout).trim().split('\n').filter(Boolean).pop();
  try { return JSON.parse(line); } catch (_e) { return { error: 'no json' }; }
}

const HEALTH_CHILD = [
  "const root=process.argv[1];require(require.resolve('zod',{paths:[root]}));",
  STUB,
  "const R=require(root+'/lib/mcp/register-core-tools.cjs');",
  "R.registerCoreTools(stub,{fallbackRoomDir:process.env.MINDRIAN_ROOM||root,pluginRoot:root,surface:'cli'});",
  "const h=R.getRegistrationHealth();",
  "process.stdout.write(JSON.stringify({complete:h.complete,failed:h.failed.map(f=>f.module),registered:h.registered,cache:Object.keys(require.cache).length})+'\\n');",
].join('');

const FILE_CHILD = [
  "const root=process.argv[1];const file=process.argv[2];require(require.resolve('zod',{paths:[root]}));",
  "require(root+'/lib/mcp/tools/'+file);",
  "process.stdout.write(JSON.stringify({keys:Object.keys(require.cache).map(k=>k.replace(root+'/',''))})+'\\n');",
].join('');

async function main() {
  const group = process.argv[2] || 'both';
  if (!['parity', 'mechanism', 'both'].includes(group)) {
    console.log('usage: test-384-s7-mcp-start.cjs [parity|mechanism]');
    process.exit(2);
  }
  const runParity = group === 'parity' || group === 'both';
  const runMech = group === 'mechanism' || group === 'both';

  if (runParity) {
    const cur = await readSurface();
    let health;
    try {
      health = childRun(HEALTH_CHILD, cur.ctx);
    } finally {
      cur.cleanup();
    }
    if (WRITE_GOLDEN) {
      const golden = { count: cur.tools.length, initialize: cur.initialize, tools: cur.tools, health: { complete: health.complete, failed: health.failed, registered: health.registered } };
      fs.mkdirSync(path.dirname(GOLDEN_PATH), { recursive: true });
      fs.writeFileSync(GOLDEN_PATH, JSON.stringify(golden, null, 1) + '\n');
      console.log('golden written: ' + golden.count + ' tools, ' + (golden.health.registered || []).length + ' registered files');
    }
    const golden = JSON.parse(fs.readFileSync(GOLDEN_PATH, 'utf8'));
    let same;
    const eq = (a, b) => { try { assert.deepStrictEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b))); return null; } catch (e) { return String(e.message).split('\n')[0]; } };

    ok('P1 tool count is 72', cur.tools.length === 72 && golden.count === 72, 'got ' + cur.tools.length);
    const gNames = golden.tools.map((t) => t.name);
    const cNames = cur.tools.map((t) => t.name);
    same = eq(cNames, gNames);
    ok('P1 tool names equal the golden', same === null, same);
    const diffTools = cur.tools.filter((t, i) => eq(t, golden.tools[i]) !== null).map((t) => t.name);
    ok('P1 tools/list equals the golden (name, title, description, inputSchema, outputSchema, annotations)', diffTools.length === 0, 'differs: ' + diffTools.slice(0, 5).join(','));
    same = eq(cur.initialize, golden.initialize);
    ok('P2 initialize serverInfo and capabilities equal the golden', same === null, same);
    ok('P3 registration is complete', health && health.complete === true && !health.error, health && health.error);
    ok('P3 registration has no failure', health && Array.isArray(health.failed) && health.failed.length === 0, JSON.stringify(health && health.failed));
    ok('P3 registered file list equals the golden (37 names)', health && (health.registered || []).length === 37 && eq(health.registered, golden.health.registered) === null, 'got ' + ((health && health.registered) || []).length);
  }

  if (runMech) {
    const prep = H.prepareRoom('fixture', { trees: [TREE_B], baseSha: 'unknown' });
    const ctx = H.makeCtx('B', TREE_B, prep, 4, false);
    try {
      const counts = [];
      for (let i = 0; i < 3; i += 1) {
        const r = childRun(HEALTH_CHILD, ctx);
        counts.push(r.error ? -1 : r.cache);
      }
      const limit = BASELINE_MODULES - REMOVED_MODULES;
      console.log('     module counts after registration (3 repeats): ' + counts.join(', ') + ', limit ' + limit);
      ok('M1 require.cache after registerCoreTools is at most ' + limit + ' in 3 of 3 repeats', counts.every((c) => c > 0 && c <= limit), 'counts ' + counts.join(','));

      const files = Object.keys(SELECTED_TOOL_FILES);
      for (const f of files) {
        const r = childRun(FILE_CHILD, ctx, [f]);
        const keys = r.error ? [] : r.keys;
        const loaded = SELECTED_TOOL_FILES[f].filter((part) => keys.some((k) => k.includes(part)));
        ok('M2 ' + f + ' loads without its handler-only modules', !r.error && loaded.length === 0, r.error || ('loaded at start: ' + loaded.join(',')));
      }
    } finally {
      try { prep.sandbox.cleanup(); } catch (_e) { /* best effort */ }
    }
  }

  console.log(fail === 0 ? 's7-mcp-start: ALL PASS' : 's7-mcp-start: ' + fail + ' FAILED');
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.log('FAIL harness error (' + String(e && e.message).slice(0, 200) + ')');
  console.log('s7-mcp-start: 1 FAILED');
  process.exit(1);
});
