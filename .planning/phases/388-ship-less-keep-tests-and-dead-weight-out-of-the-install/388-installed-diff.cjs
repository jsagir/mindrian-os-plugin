#!/usr/bin/env node
// Phase 388 plan 02 task 2: installed-layout trace and differential run.
// Lays out the packed package like the Claude Code loader does (scratch HOME), runs probes with an fs trace,
// deletes the SAFE set from a copy, runs the same probes, and compares. Never touches the repo tree.
// Reuse (Canon Part 7): tests/helpers/eureka-installed-layout-387.cjs (layOutInstalledCopy, startServer),
// scripts/measure-hook-cold-start.cjs (parseHookCommands, makeSandbox, spawnHook, isNetworkCapable).
// Node built-ins plus the repo own @modelcontextprotocol/client. Hyphens only.
//
// Commands:
//   selftest
//   runall --safe FILE --out-full FILE --out-reduced FILE [--scratch DIR]
//        full install twice (second run only for the stability filter), then the reduced install once
//   compare --full FILE --reduced FILE
//   trace-check --full FILE --safe FILE
// Canon Part 8: scratch HOME, dead Brain URL, key variables removed, no real room, no Eureka engine.
'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const cp = require('node:child_process');

const REPO = path.resolve(__dirname, '..', '..', '..');
const PRELOAD = path.join(__dirname, '388-fs-trace-preload.cjs');
const TRACE_NOISE = /^node_modules(\/|$)/;

// ---------------------------------------------------------------- pure helpers

function readSafe(file) {
  const rows = fs.readFileSync(file, 'utf8').split('\n').slice(1).filter(Boolean).map((l) => l.split('\t'));
  return rows.filter((r) => r[2] === 'SAFE').map((r) => r[0]);
}

function parseTraceFile(file, procsOut) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    if (!line) continue;
    let j;
    try { j = JSON.parse(line); } catch (_) { continue; }
    if (TRACE_NOISE.test(j.p)) continue;
    const prev = out[j.p];
    out[j.p] = prev === 'T' || j.ok ? 'T' : 'F';
    if (procsOut) { (procsOut[j.p] = procsOut[j.p] || new Set()).add(j.a || '?'); }
  }
  return out;
}

// A packaging walk (npm pack --dry-run, run by the release-payload-ceiling policy) stats every file of the tree
// to build the file list. That is a count, not a use of the file. Touches by these processes are reported apart.
const WALK_PROCS = new Set(['npm-cli.js', 'npm']);

// split a trace file into the touches by real readers and the SAFE-agnostic walk-only set
function splitTrace(file) {
  const procs = {};
  const all = parseTraceFile(file, procs);
  const real = {};
  const walkOnly = [];
  for (const p of Object.keys(all)) {
    const ps = [...procs[p]];
    const nonWalk = ps.filter((x) => !WALK_PROCS.has(x));
    if (nonWalk.length) real[p] = all[p] + ':' + nonWalk.join('+'); else walkOnly.push(p);
  }
  return { real, walkOnly };
}

function mergeTrace(a, b) {
  const out = Object.assign({}, a);
  for (const k of Object.keys(b)) out[k] = out[k] === 'T' || b[k] === 'T' ? 'T' : 'F';
  return out;
}

// differences between two records of the same shape; probe keys that differ between two full runs are unstable
function diffMaps(full1, full2, other, label, out, unstable) {
  const keys = new Set([...Object.keys(full1 || {}), ...Object.keys(other || {})]);
  for (const k of keys) {
    const a = JSON.stringify((full1 || {})[k]);
    const a2 = JSON.stringify((full2 || {})[k]);
    if (full2 && a !== a2) { unstable.push(label + ':' + k); continue; }
    const b = JSON.stringify((other || {})[k]);
    if (a !== b) out.push({ probe: label + ':' + k, full: (full1 || {})[k], reduced: (other || {})[k] });
  }
}

function compareRecords(fullRec, reducedRec) {
  const diffs = [];
  const unstable = [];
  const f1 = fullRec.run1 || fullRec;
  const f2 = fullRec.run2 || null;
  const r = reducedRec.run1 || reducedRec;
  diffMaps(f1.hooks, f2 && f2.hooks, r.hooks, 'hook', diffs, unstable);
  diffMaps(f1.mcp_tools, f2 && f2.mcp_tools, r.mcp_tools, 'mcp-tools', diffs, unstable);
  diffMaps(f1.mcp_calls, f2 && f2.mcp_calls, r.mcp_calls, 'mcp-call', diffs, unstable);
  diffMaps(f1.doctor, f2 && f2.doctor, r.doctor, 'doctor', diffs, unstable);
  diffMaps(f1.syntax, f2 && f2.syntax, r.syntax, 'syntax', diffs, unstable);
  return { diffs, unstable };
}

function traceCheck(fullRec, safePaths) {
  const safe = new Set(safePaths);
  const hits = [];
  const runs = [fullRec.run1, fullRec.run2].filter(Boolean);
  for (const run of runs) {
    for (const probe of Object.keys(run.trace || {})) {
      for (const p of Object.keys(run.trace[probe])) if (safe.has(p)) hits.push({ path: p, probe, flag: String(run.trace[probe][p]).charAt(0), procs: String(run.trace[probe][p]).slice(2) });
    }
  }
  return hits;
}

// SAFE paths touched only by a packaging walk (reported, never counted as a use)
function walkOnlyReport(fullRec, safePaths) {
  const safe = new Set(safePaths);
  const out = new Set();
  for (const run of [fullRec.run1, fullRec.run2].filter(Boolean)) {
    for (const probe of Object.keys(run.walk_only_safe || {})) for (const p of run.walk_only_safe[probe]) if (safe.has(p)) out.add(p);
  }
  return [...out].sort();
}

// SAFE rows that a real reader touched in the full run become UNCERTAIN with trace evidence
function reclassify(safeFile, fullRec) {
  const lines = fs.readFileSync(safeFile, 'utf8').split('\n');
  const header = lines[0];
  const rows = lines.slice(1).filter(Boolean).map((l) => l.split('\t'));
  const safe = rows.filter((r) => r[2] === 'SAFE').map((r) => r[0]);
  const byPath = new Map();
  for (const h of traceCheck(fullRec, safe)) {
    if (!byPath.has(h.path)) byPath.set(h.path, []);
    byPath.get(h.path).push(h);
  }
  let moved = 0;
  const out = rows.map((r) => {
    const hs = byPath.get(r[0]);
    if (r[2] !== 'SAFE' || !hs) return r;
    moved += 1;
    const procs = [...new Set(hs.map((h) => h.procs))].join(',');
    const probes = [...new Set(hs.map((h) => h.probe))];
    return [r[0], r[1], 'UNCERTAIN', r[3], String(probes.length), 'E5 TRACE ' + probes[0] + ' by ' + procs + (r[5] && r[5] !== '-' ? ' | was: ' + r[5] : '')];
  });
  return { text: [header].concat(out.map((r) => r.join('\t'))).join('\n') + '\n', moved };
}

// ---------------------------------------------------------------- environment

const STRIP_ENV = [
  'CLAUDE_CODE_SESSION_ID', 'MINDRIAN_ACTIVE_SESSION_ID', 'MINDRIAN_SESSION_ID', 'CLAUDE_ACTIVE_ROOM', 'MINDRIAN_ROOM',
  'MINDRIAN_BRAIN_KEY', 'MINDRIAN_MCP_FIRST', 'MINDRIAN_MCP_DAEMON', 'CLAUDE_SURFACE', 'COWORK_SESSION_ID', 'NODE_OPTIONS',
  'CLAUDE_PROJECT_DIR',
];

function cleanEnv(world, installed, traceOut) {
  const env = Object.assign({}, process.env);
  for (const k of Object.keys(env)) {
    if (k.startsWith('MINDRIAN_EUREKA_') || /(KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL)/i.test(k)) delete env[k];
  }
  for (const k of STRIP_ENV) delete env[k];
  env.HOME = world.home;
  env.USERPROFILE = world.home;
  env.MINDRIAN_ROOMS_HOME = world.roomsHome;
  env.MINDRIAN_TRANSPORT = 'stdio';
  env.MINDRIAN_BRAIN_URL = 'http://127.0.0.1:9';
  env.TMPDIR = world.tmpdir;
  env.CLAUDE_PLUGIN_ROOT = installed;
  env.npm_config_cache = path.join(world.tmp, 'npm-cache');
  env.PYTHONDONTWRITEBYTECODE = '1';
  if (traceOut) {
    env.MOS388_TRACE_ROOT = installed;
    env.MOS388_TRACE_OUT = traceOut;
    env.NODE_OPTIONS = '--require ' + PRELOAD;
  }
  return env;
}

function scrubText(text, world, installed) {
  let s = String(text);
  const roots = [installed, world.tmp];
  try { roots.push(fs.realpathSync(installed)); } catch (_) { /* ignore */ }
  for (const r of roots) if (r) s = s.split(r).join('<ROOT>');
  s = s.split(os.tmpdir()).join('<TMP>');
  const homes = new Set([os.homedir()]);
  for (const h of homes) if (h && h.length > 1) s = s.split(h).join('<HOME>');
  s = s.replace(/\d{4}-\d\d-\d\dT[\d:.]+Z?/g, '<TS>').replace(/\b\d{9,}\b/g, '<N>');
  return s;
}

function hash(s) { return crypto.createHash('sha1').update(String(s)).digest('hex').slice(0, 12); }

async function stopServer(conn) {
  if (!conn) return;
  try { await conn.client.close(); } catch (_) { /* best effort */ }
  if (conn.transport && typeof conn.transport.pid === 'number') { try { process.kill(conn.transport.pid, 'SIGKILL'); } catch (_) { /* gone */ } }
}

// ---------------------------------------------------------------- one run of all probes

const BIRTH = [
  "'use strict';",
  'const path = require("node:path");',
  'const repo = process.argv[2], home = process.argv[3], roomsHome = process.argv[4], slug = process.argv[5];',
  'process.env.HOME = home; process.env.USERPROFILE = home; process.env.MINDRIAN_ROOMS_HOME = roomsHome;',
  'delete process.env.CLAUDE_CODE_SESSION_ID; delete process.env.MINDRIAN_ACTIVE_SESSION_ID;',
  'const iso = require(path.join(repo, "tests/helpers/isolated-home-36925.cjs"));',
  'const born = iso.birthFixtureRoom({ iso: { home: home, roomsHome: roomsHome }, slug: slug, sessionId: "fixture-birth-388", ventureText: "A synthetic venture for the Phase 388 probe" });',
  'if (!born || born.ok === false) { process.stderr.write("birth failed"); process.exit(3); }',
  'process.stdout.write("BIRTH_OK " + slug + "\\n");',
].join('\n');
const FIXTURE_SLUG = 'ship388-fixture';

function makeWorld(base, name) {
  const tmp = fs.mkdtempSync(path.join(base, 'w388-' + name + '-'));
  const home = path.join(tmp, 'home');
  const roomsHome = path.join(home, 'rooms');
  const cwd = path.join(tmp, 'cwd');
  const tmpdir = path.join(tmp, 'tmpdir');
  for (const d of [home, roomsHome, cwd, tmpdir]) fs.mkdirSync(d, { recursive: true });
  const script = path.join(tmp, 'birth.cjs');
  fs.writeFileSync(script, BIRTH);
  const env = Object.assign({}, process.env, { HOME: home, USERPROFILE: home, MINDRIAN_ROOMS_HOME: roomsHome });
  for (const k of STRIP_ENV) delete env[k];
  const r = cp.spawnSync(process.execPath, [script, REPO, home, roomsHome, FIXTURE_SLUG], { cwd, env, encoding: 'utf8', timeout: 120000 });
  const born = r.status === 0 && String(r.stdout).includes('BIRTH_OK');
  return { tmp, home, roomsHome, cwd, tmpdir, fixtureBorn: born, birthNote: born ? 'ok' : 'status ' + r.status + ' ' + String(r.stderr).slice(0, 200) };
}

async function runProbes(opts) {
  const { installed, base, label, deadline } = opts;
  const safeSet = new Set(opts.safe || []);
  const H = require(path.join(REPO, 'tests', 'helpers', 'eureka-installed-layout-387.cjs'));
  const hookMod = require(path.join(REPO, 'scripts', 'measure-hook-cold-start.cjs'));
  const rec = { label, hooks: {}, mcp_tools: {}, mcp_calls: {}, doctor: {}, syntax: {}, trace: {}, walk_only_safe: {}, walk_only_count: {}, notes: [], skipped: [] };
  const putTrace = (key, file) => { const t = splitTrace(file); rec.trace[key] = t.real; rec.walk_only_count[key] = t.walkOnly.length; const ws = t.walkOnly.filter((p) => safeSet.has(p)); if (ws.length) rec.walk_only_safe[key] = ws; };
  const left = () => Math.max(0, deadline - Date.now());

  // P1 hooks
  const entries = hookMod.parseHookCommands(path.join(installed, 'hooks', 'hooks.json'));
  let n = 0;
  for (const e of entries) {
    n += 1;
    const key = e.event + '|' + (e.matcher || '') + '|' + e.command.replace('${CLAUDE_PLUGIN_ROOT}', '<PLUGIN_ROOT>');
    if (hookMod.isNetworkCapable(e)) { rec.skipped.push('hook ' + key + ' (network capable, not run)'); continue; }
    if (left() < 5000) { rec.skipped.push('hook ' + key + ' (time cap)'); continue; }
    const sbx = hookMod.makeSandbox('mos388-hook-');
    const world = { tmp: sbx.root, home: sbx.home, roomsHome: sbx.roomsHome, tmpdir: sbx.tmp };
    const traceOut = path.join(sbx.root, 'trace.jsonl');
    try {
      const extra = cleanEnv(world, installed, traceOut);
      const res = await hookMod.spawnHook(e, sbx, installed, extra);
      rec.hooks[key] = {
        status: res.status, timedOut: !!res.timedOut,
        missing_module: /Cannot find module|ENOENT|ERR_REQUIRE|MODULE_NOT_FOUND/.test(res.stderr || ''),
        stdout: hash(scrubText(res.stdout || '', world, installed)),
      };
      putTrace('hook:' + n, traceOut);
    } finally { sbx.cleanup(); }
  }

  // P2 MCP: tools/list for both identities, read-only calls unbound and bound
  const world = makeWorld(base, label);
  if (!world.fixtureBorn) rec.notes.push('fixture room not born: ' + world.birthNote + ' (bound calls skipped)');
  const layout = { installed };
  for (const identity of ['claude-ai', 'claude-code']) {
    if (left() < 10000) { rec.skipped.push('mcp ' + identity + ' (time cap)'); continue; }
    const traceOut = path.join(world.tmp, 'trace-mcp-' + identity + '.jsonl');
    const env = cleanEnv(world, installed, traceOut);
    let conn;
    try {
      conn = await H.startServer(layout, world, env, { identity });
      const all = [];
      let cursor;
      for (let i = 0; i < 20; i += 1) {
        const page = await conn.client.listTools(cursor ? { cursor } : {});
        for (const t of page.tools || []) all.push(t);
        if (!page.nextCursor) break;
        cursor = page.nextCursor;
      }
      rec.mcp_tools[identity] = all.map((t) => t.name).sort();
      if (identity === 'claude-code') {
        const ro = all.filter((t) => t.annotations && t.annotations.readOnlyHint === true && !/^eureka/.test(t.name)).map((t) => t.name).sort();
        rec.notes.push('read-only tools called: ' + ro.length + ' of ' + all.length + ' (eureka tools and tools without readOnlyHint are not called)');
        const callAll = async (bound) => {
          for (const name of ro) {
            if (left() < 4000) { rec.skipped.push('mcp call ' + (bound ? 'bound:' : 'unbound:') + name + ' (time cap)'); continue; }
            let text; let isError = null;
            try {
              const r = await conn.client.callTool({ name, arguments: {} }, { timeout: 20000 });
              isError = r.isError === true;
              const t = r.content && r.content.find((c) => c.type === 'text');
              text = t ? t.text : '';
            } catch (err) { isError = true; text = 'thrown: ' + String(err && err.message || err); }
            rec.mcp_calls[(bound ? 'bound:' : 'unbound:') + name] = { isError, text: scrubText(text, world, installed).slice(0, 120) };
          }
        };
        await callAll(false);
        if (world.fixtureBorn) {
          try {
            await conn.client.callTool({ name: 'room_bind', arguments: { room: FIXTURE_SLUG } }, { timeout: 30000 });
            await callAll(true);
          } catch (err) { rec.notes.push('room_bind failed: ' + String(err && err.message || err).slice(0, 120)); }
        }
      }
    } catch (err) {
      rec.notes.push('mcp ' + identity + ' did not run: ' + String(err && err.message || err).slice(0, 160));
      rec.skipped.push('mcp ' + identity + ' (' + String(err && err.message || err).slice(0, 80) + ')');
    } finally { await stopServer(conn); }
    putTrace('mcp:' + identity, traceOut);
  }

  // P3 doctor
  for (const mode of ['json', 'acceptance']) {
    if (left() < 20000) { rec.skipped.push('doctor ' + mode + ' (time cap)'); continue; }
    const traceOut = path.join(world.tmp, 'trace-doctor-' + mode + '.jsonl');
    const env = cleanEnv(world, installed, traceOut);
    env.MINDRIAN_ACTIVE_ROOM = '';
    const args = mode === 'json' ? ['--json'] : ['--acceptance', '--json'];
    const r = cp.spawnSync(process.execPath, [path.join(installed, 'scripts', 'doctor.cjs')].concat(args), {
      cwd: world.cwd, env, encoding: 'utf8', timeout: Math.min(240000, left()), maxBuffer: 64 * 1024 * 1024, input: '',
    });
    putTrace('doctor:' + mode, traceOut);
    let parsed = null;
    try { parsed = JSON.parse(r.stdout); } catch (_) { parsed = null; }
    if (!parsed) {
      rec.doctor[mode + ':exit'] = { status: r.status, signal: r.signal || null, parsed: false };
      rec.notes.push('doctor ' + mode + ' output is not JSON (status ' + r.status + ')');
      continue;
    }
    rec.doctor[mode + ':exit'] = { status: r.status, parsed: true };
    const points = collectPoints(parsed);
    for (const k of Object.keys(points)) rec.doctor[mode + ':' + k] = points[k];
  }

  // P4 syntax check of the scripts that commands, skills, agents and pipelines name after CLAUDE_PLUGIN_ROOT
  const hookScripts = new Set(entries.map((e) => (e.command.match(/scripts\/[\w.\-]+/g) || [])).flat());
  const named = new Set();
  const walkMd = (dir) => {
    for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, d.name);
      if (d.isDirectory()) walkMd(abs);
      else if (d.name.endsWith('.md')) {
        const t = fs.readFileSync(abs, 'utf8');
        const re = /(?:CLAUDE_PLUGIN_ROOT|MINDRIAN_OS_ROOT)\}?\/((?:scripts|lib|bin)\/[A-Za-z0-9_.\-/]+)/g;
        let m;
        while ((m = re.exec(t))) named.add(m[1].replace(/[.,;:)`'"]+$/, ''));
      }
    }
  };
  for (const d of ['commands', 'skills', 'agents', 'pipelines']) if (fs.existsSync(path.join(installed, d))) walkMd(path.join(installed, d));
  const traceOut = path.join(world.tmp, 'trace-syntax.jsonl');
  for (const rel of [...named].sort()) {
    if (hookScripts.has(rel)) continue;
    const abs = path.join(installed, rel);
    if (!fs.existsSync(abs) || fs.statSync(abs).isDirectory()) { rec.syntax[rel] = 'missing-or-dir'; continue; }
    let r;
    if (/\.(cjs|js|mjs)$/.test(rel)) r = cp.spawnSync(process.execPath, ['--check', abs], { encoding: 'utf8', timeout: 30000 });
    else if (/\.py$/.test(rel)) r = cp.spawnSync('python3', ['-I', '-c', 'import ast,sys;ast.parse(open(sys.argv[1]).read())', abs], { encoding: 'utf8', timeout: 30000 });
    else if (/\.(sh)$/.test(rel) || path.basename(rel).indexOf('.') === -1) r = cp.spawnSync('bash', ['-n', abs], { encoding: 'utf8', timeout: 30000 });
    else { rec.syntax[rel] = 'present'; continue; }
    rec.syntax[rel] = r.status === 0 ? 'ok' : 'error ' + r.status;
  }
  void traceOut;
  try { fs.rmSync(world.tmp, { recursive: true, force: true }); } catch (_) { /* best effort */ }
  return rec;
}

// doctor JSON shape differs by flag; collect id to status for every object that has an id-like field and a status-like field
function collectPoints(doc) {
  const out = {};
  const seen = new Set();
  const walk = (v) => {
    if (!v || typeof v !== 'object' || seen.has(v)) return;
    seen.add(v);
    if (Array.isArray(v)) { for (const x of v) walk(x); return; }
    const id = v.id || v.point || v.name || v.check;
    const st = v.status !== undefined ? v.status : v.ok !== undefined ? v.ok : v.result;
    if (typeof id === 'string' && (typeof st === 'string' || typeof st === 'boolean' || typeof st === 'number')) out[id] = String(st);
    for (const k of Object.keys(v)) walk(v[k]);
  };
  walk(doc);
  return out;
}

// ---------------------------------------------------------------- orchestration

function removeSafe(installed, safePaths) {
  let removed = 0;
  for (const p of safePaths) {
    const abs = path.join(installed, p);
    try { fs.rmSync(abs, { force: true }); removed += 1; } catch (_) { /* gone */ }
    let d = path.dirname(abs);
    while (d.startsWith(installed + path.sep)) {
      try { if (fs.readdirSync(d).length === 0) fs.rmdirSync(d); else break; } catch (_) { break; }
      d = path.dirname(d);
    }
  }
  return removed;
}

async function runAll(opts) {
  const H = require(path.join(REPO, 'tests', 'helpers', 'eureka-installed-layout-387.cjs'));
  const base = fs.mkdtempSync(path.join(opts.scratch, 'ship388-'));
  process.env.TMPDIR = base;
  const safe = readSafe(opts.safe);
  const tmp = path.join(base, 'layout');
  const home = path.join(tmp, 'home');
  fs.mkdirSync(home, { recursive: true });
  const t0 = Date.now();
  try {
    const layout = H.layOutInstalledCopy({ tmp, home, npmCi: false });
    const missingSafe = safe.filter((p) => !fs.existsSync(path.join(layout.installed, p)));
    const reducedRoot = path.join(base, 'reduced-copy', path.basename(layout.installed));
    fs.mkdirSync(path.dirname(reducedRoot), { recursive: true });
    fs.cpSync(layout.installed, reducedRoot, { recursive: true, verbatimSymlinks: true });
    const removed = removeSafe(reducedRoot, safe);
    const meta = {
      head: cp.spawnSync('git', ['rev-parse', 'HEAD'], { cwd: REPO, encoding: 'utf8' }).stdout.trim(),
      version: layout.version, node: process.version, layout_mode: layout.layoutMode,
      safe_paths: safe.length, safe_missing_in_pack: missingSafe, removed_in_reduced: removed,
    };
    const cap = 10 * 60 * 1000;
    const deadlineFull1 = Date.now() + cap * 0.25;
    const run1 = await runProbes({ installed: layout.installed, base, label: 'full1', deadline: deadlineFull1, safe });
    const run2 = await runProbes({ installed: layout.installed, base, label: 'full2', deadline: Date.now() + cap * 0.25, safe });
    const reduced = await runProbes({ installed: reducedRoot, base, label: 'reduced', deadline: Date.now() + cap * 0.25, safe });
    const norm = (rec) => JSON.parse(scrubText(JSON.stringify(rec), { tmp: base }, rec.label === 'reduced' ? reducedRoot : layout.installed).split(home).join('<HOME>'));
    const fullRec = { meta, run1: norm(run1), run2: norm(run2) };
    const redRec = { meta, run1: norm(reduced) };
    fs.writeFileSync(opts.outFull, JSON.stringify(fullRec, null, 1) + '\n');
    fs.writeFileSync(opts.outReduced, JSON.stringify(redRec, null, 1) + '\n');
    return { fullRec, redRec, seconds: Math.round((Date.now() - t0) / 1000) };
  } finally {
    try { fs.rmSync(base, { recursive: true, force: true }); } catch (_) { /* best effort */ }
  }
}

// ---------------------------------------------------------------- selftest

function selftest() {
  const failures = [];
  const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) failures.push(m + ': got ' + JSON.stringify(a) + ' expected ' + JSON.stringify(b)); };
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mos388-trace-'));
  try {
    // trace test 1
    const root = path.join(tmp, 'install');
    fs.mkdirSync(path.join(root, 'lib'), { recursive: true });
    fs.writeFileSync(path.join(root, 'a.txt'), 'A');
    fs.writeFileSync(path.join(root, 'lib', 'c.cjs'), 'module.exports = 1;\n');
    const script = path.join(tmp, 'probe.cjs');
    fs.writeFileSync(script, [
      "const fs = require('fs'); const path = require('path');",
      'const root = process.argv[2];',
      "fs.readFileSync(path.join(root, 'a.txt'));",
      "fs.existsSync(path.join(root, 'b.txt'));",
      "require(path.join(root, 'lib', 'c.cjs'));",
      "try { require(path.join(root, 'lib', 'd-missing.cjs')); } catch (e) { /* expected */ }",
      "if (process.argv[3] === 'child') require('child_process').spawnSync(process.execPath, ['-e', \"require('fs').readFileSync(require('path').join(process.argv[1], 'a.txt'))\", root], { stdio: 'ignore' });",
    ].join('\n'));
    const out1 = path.join(tmp, 'trace1.jsonl');
    cp.spawnSync(process.execPath, [script, root], { env: Object.assign({}, process.env, { NODE_OPTIONS: '--require ' + PRELOAD, MOS388_TRACE_ROOT: root, MOS388_TRACE_OUT: out1 }), encoding: 'utf8' });
    const t1 = parseTraceFile(out1);
    eq([t1['a.txt'], t1['b.txt'], t1['lib/c.cjs'], t1['lib/d-missing.cjs']], ['T', 'F', 'T', 'F'], 'trace test 1 flags (A ok, B absent, C required, D missing)');
    // trace test 2: child process inherits the preload through NODE_OPTIONS
    const out2 = path.join(tmp, 'trace2.jsonl');
    fs.writeFileSync(path.join(root, 'only-child.txt'), 'X');
    const script2 = path.join(tmp, 'probe2.cjs');
    fs.writeFileSync(script2, "require('child_process').spawnSync(process.execPath, ['-e', \"require('fs').readFileSync(process.argv[1])\", process.argv[3]], { stdio: 'ignore' });\n");
    cp.spawnSync(process.execPath, [script2, 'x', path.join(root, 'only-child.txt')], { env: Object.assign({}, process.env, { NODE_OPTIONS: '--require ' + PRELOAD, MOS388_TRACE_ROOT: root, MOS388_TRACE_OUT: out2 }), encoding: 'utf8' });
    eq(parseTraceFile(out2)['only-child.txt'], 'T', 'trace test 2 child inherits the preload');
    // trace test 3: a touch by a packaging walk process is split from a real reader
    const walkRoot = path.join(tmp, 'walk-install');
    fs.mkdirSync(walkRoot, { recursive: true });
    fs.writeFileSync(path.join(walkRoot, 'walked.txt'), 'w');
    fs.writeFileSync(path.join(walkRoot, 'used.txt'), 'u');
    const npmLike = path.join(tmp, 'npm-cli.js');
    fs.writeFileSync(npmLike, "require('fs').statSync(process.argv[2] + '/walked.txt'); require('fs').statSync(process.argv[2] + '/used.txt');\n");
    const reader = path.join(tmp, 'reader.cjs');
    fs.writeFileSync(reader, "require('fs').readFileSync(process.argv[2] + '/used.txt');\n");
    const out3 = path.join(tmp, 'trace3.jsonl');
    const env3 = Object.assign({}, process.env, { NODE_OPTIONS: '--require ' + PRELOAD, MOS388_TRACE_ROOT: walkRoot, MOS388_TRACE_OUT: out3 });
    cp.spawnSync(process.execPath, [npmLike, walkRoot], { env: env3 });
    cp.spawnSync(process.execPath, [reader, walkRoot], { env: env3 });
    const sp3 = splitTrace(out3);
    eq([Object.keys(sp3.real).sort(), sp3.walkOnly], [['used.txt'], ['walked.txt']], 'trace test 3 walk-only split');
    // diff test 1 mutation: one hook exit code differs
    const hookA = { 'Stop||x': { status: 0, timedOut: false, missing_module: false, stdout: 'aa' }, 'Stop||y': { status: 0, timedOut: false, missing_module: false, stdout: 'bb' } };
    const hookB = JSON.parse(JSON.stringify(hookA)); hookB['Stop||y'].status = 1;
    const full = { run1: { hooks: hookA, doctor: { 'json:p1': 'ok', 'json:p2': 'ok' } }, run2: { hooks: hookA, doctor: { 'json:p1': 'ok', 'json:p2': 'warn' } } };
    const red = { run1: { hooks: hookB, doctor: { 'json:p1': 'ok', 'json:p2': 'fail' } } };
    const c1 = compareRecords(full, red);
    eq(c1.diffs.map((d) => d.probe), ['hook:Stop||y'], 'diff test 1 names the hook and only the hook');
    // diff test 2: a doctor point that differs between two full runs is unstable and not compared
    eq(c1.unstable, ['doctor:json:p2'], 'diff test 2 unstable doctor point');
    const same = compareRecords(full, { run1: { hooks: hookA, doctor: { 'json:p1': 'ok', 'json:p2': 'fail' } } });
    eq(same.diffs.length, 0, 'diff test 2b no difference when only the unstable point changes');
    // diff test 3: a SAFE path in the full trace
    const hits = traceCheck({ run1: { trace: { 'hook:1': { 'lib/a.test.cjs': 'T:x', 'lib/keep.cjs': 'T:x' } } } }, ['lib/a.test.cjs']);
    eq(hits.map((h) => h.path + '@' + h.probe), ['lib/a.test.cjs@hook:1'], 'diff test 3 trace-check names path and probe');
    eq(traceCheck({ run1: { trace: { 'hook:1': { 'lib/keep.cjs': 'T:x' } } } }, ['lib/a.test.cjs']).length, 0, 'diff test 3b no hit when the SAFE path is not touched');
    // reclassify: a touched SAFE row becomes UNCERTAIN, an untouched one stays SAFE
    const sf = path.join(tmp, 'safe.tsv');
    fs.writeFileSync(sf, 'path\tclass\tverdict\tflags\tevidence-count\tfirst-evidence\nlib/a.test.cjs\tT1\tSAFE\t-\t0\t-\nlib/b.cjs\tT7\tSAFE\t-\t0\t-\n');
    const rc = reclassify(sf, { run1: { trace: { 'doctor:acceptance': { 'lib/a.test.cjs': 'T:doctor.cjs' } } } });
    eq(rc.text.split('\n').slice(1, 3).map((l) => l.split('\t')[2]), ['UNCERTAIN', 'SAFE'], 'reclassify moves only the touched SAFE row');
  } catch (e) {
    failures.push('selftest crashed: ' + e.stack);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  if (failures.length) { for (const f of failures) console.error('FAIL ' + f); return 1; }
  console.log('installed-diff selftest: 5 groups passed (trace flags, child inheritance, hook mutation, unstable point, trace-check)');
  return 0;
}

// ---------------------------------------------------------------- cli

function arg(name) { const i = process.argv.indexOf(name); return i === -1 ? null : process.argv[i + 1]; }

async function main() {
  const cmd = process.argv[2];
  if (cmd === 'selftest') process.exit(selftest());
  if (cmd === 'runall') {
    const scratch = path.resolve(arg('--scratch') || os.tmpdir());
    fs.mkdirSync(scratch, { recursive: true });
    const res = await runAll({ safe: path.resolve(arg('--safe')), outFull: path.resolve(arg('--out-full')), outReduced: path.resolve(arg('--out-reduced')), scratch });
    console.log('runall done in ' + res.seconds + ' s');
    for (const [k, r] of [['full1', res.fullRec.run1], ['full2', res.fullRec.run2], ['reduced', res.redRec.run1]]) {
      console.log(k + ': hooks ' + Object.keys(r.hooks).length + ', tools ' + JSON.stringify(Object.fromEntries(Object.entries(r.mcp_tools).map(([a, b]) => [a, b.length]))) + ', calls ' + Object.keys(r.mcp_calls).length + ', doctor points ' + Object.keys(r.doctor).length + ', syntax ' + Object.keys(r.syntax).length + ', skipped ' + r.skipped.length);
      for (const n of r.notes) console.log('  note: ' + n);
      for (const n of r.skipped) console.log('  skipped: ' + n);
    }
    return;
  }
  if (cmd === 'compare') {
    const full = JSON.parse(fs.readFileSync(arg('--full'), 'utf8'));
    const red = JSON.parse(fs.readFileSync(arg('--reduced'), 'utf8'));
    const { diffs, unstable } = compareRecords(full, red);
    console.log('unstable (differ between two full runs, not compared): ' + unstable.length);
    for (const u of unstable) console.log('  UNSTABLE ' + u);
    for (const d of diffs) console.log('DIFF ' + d.probe + ' full=' + JSON.stringify(d.full) + ' reduced=' + JSON.stringify(d.reduced));
    if (diffs.length) { console.log('compare: ' + diffs.length + ' difference(s)'); process.exit(1); }
    console.log('compare: no difference in any stable probe');
    return;
  }
  if (cmd === 'trace-check') {
    const full = JSON.parse(fs.readFileSync(arg('--full'), 'utf8'));
    const hits = traceCheck(full, readSafe(arg('--safe')));
    const wo = walkOnlyReport(full, readSafe(arg('--safe')));
    console.log('SAFE paths touched only by a packaging walk (npm pack --dry-run counting files, not using them): ' + wo.length);
    for (const h of hits) console.log('TOUCHED ' + h.path + ' by ' + h.probe + ' [' + h.procs + '] (' + (h.flag === 'T' ? 'opened or found' : 'looked up, absent') + ')');
    if (hits.length) { console.log('trace-check: ' + hits.length + ' SAFE path(s) touched in the full run'); process.exit(1); }
    console.log('trace-check: no SAFE path touched in the full run');
    return;
  }
  if (cmd === 'reclassify') {
    const full = JSON.parse(fs.readFileSync(arg('--full'), 'utf8'));
    const res = reclassify(arg('--safe'), full);
    fs.writeFileSync(arg('--out'), res.text);
    console.log('reclassify: ' + res.moved + ' SAFE row(s) moved to UNCERTAIN because a real reader touched them in the full run');
    return;
  }
  console.error('usage: 388-installed-diff.cjs selftest | runall --safe FILE --out-full FILE --out-reduced FILE [--scratch DIR] | compare --full FILE --reduced FILE | reclassify --full FILE --safe FILE --out FILE | trace-check --full FILE --safe FILE');
  process.exit(2);
}

if (require.main === module) main().catch((e) => { console.error(e && e.stack || e); process.exit(1); });
module.exports = { reclassify, splitTrace, walkOnlyReport, compareRecords, traceCheck, parseTraceFile, readSafe, collectPoints };
