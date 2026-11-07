#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 384 plan 15 (S7). Load attribution per MCP tool file.
 *
 * For each file of lib/mcp/tools (sorted), N fresh node child processes (under taskset -c 0-3 when it exists).
 * Each child requires zod first (the schema library every tool file needs), reads the length of require.cache,
 * starts the clock, requires the one tool file, stops the clock, reads the length again and prints one JSON line:
 * { added, ms }. The tool prints a table: file, modules added, load median, load p95, n.
 *
 * Usage:
 *   s7-load-attribution.cjs --tree DIR --runs N [--json]
 *   s7-load-attribution.cjs --tree DIR --exclusive
 *   s7-load-attribution.cjs --selftest
 *
 * Output holds file names of lib/mcp/tools, counts and milliseconds only (Canon Part 8). It prints no path.
 * Run it under the 384 lock. Hyphens only. CJS only.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');

const CHILD = [
  "const path=require('path');",
  "const root=process.argv[1];const file=process.argv[2];",
  "try{require(require.resolve('zod',{paths:[root]}));}catch(e){}",
  "const before=Object.keys(require.cache).length;",
  "const t0=process.hrtime.bigint();",
  "let ok=true;try{require(file);}catch(e){ok=false;}",
  "const t1=process.hrtime.bigint();",
  "const after=Object.keys(require.cache).length;",
  "process.stdout.write(JSON.stringify({added:after-before-1,ms:Number(t1-t0)/1e6,ok:ok})+'\\n');",
].join('');

function median(a) {
  const s = a.slice().sort((x, y) => x - y);
  const n = s.length;
  if (!n) return null;
  return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
}
function p95(a) {
  const s = a.slice().sort((x, y) => x - y);
  if (!s.length) return null;
  return s[Math.floor(0.95 * (s.length - 1))];
}
function round1(x) { return x === null ? null : Math.round(x * 10) / 10; }

const HAS_TASKSET = os.platform() === 'linux' && cp.spawnSync('taskset', ['--version'], { stdio: 'ignore' }).status === 0;

function runOne(root, toolsDir, file, home) {
  const argv = [process.execPath, '-e', CHILD, root, path.join(toolsDir, file)];
  const full = HAS_TASKSET ? ['taskset', '-c', '0-3'].concat(argv) : argv;
  const r = cp.spawnSync(full[0], full.slice(1), {
    cwd: root, encoding: 'utf8', timeout: 60000,
    env: { PATH: process.env.PATH, HOME: home, MINDRIAN_HOME: path.join(home, 'm'), MINDRIAN_ROOMS_HOME: path.join(home, 'r'), MINDRIAN_BRAIN_URL: 'http://127.0.0.1:9' },
  });
  if (r.status !== 0) return null;
  const line = String(r.stdout).trim().split('\n').filter(Boolean).pop();
  try { return JSON.parse(line); } catch (_e) { return null; }
}

function attribute(root, toolsDir, runs) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-384-s7-attr-'));
  const rows = [];
  try {
    const files = fs.readdirSync(toolsDir).filter((f) => f.endsWith('.cjs')).sort();
    for (const f of files) {
      const added = [];
      const ms = [];
      let bad = 0;
      for (let i = 0; i < runs; i += 1) {
        const r = runOne(root, toolsDir, f, home);
        if (!r || !r.ok) { bad += 1; continue; }
        added.push(r.added);
        ms.push(r.ms);
      }
      rows.push({ file: f, added: median(added), ms_median: round1(median(ms)), ms_p95: round1(p95(ms)), n: ms.length, failed: bad });
    }
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
  return rows;
}

// --exclusive: one fresh child per tool file lists the modules that the file adds; a module is exclusive to a file when
// no other tool file adds it. Exclusive modules are the ones that a lazy require in that file can remove from the start.
const SET_CHILD = [
  "const root=process.argv[1];const file=process.argv[2];",
  "try{require(require.resolve('zod',{paths:[root]}));}catch(e){}",
  "const b=new Set(Object.keys(require.cache));",
  "try{require(file);}catch(e){}",
  "process.stdout.write(JSON.stringify(Object.keys(require.cache).filter(k=>!b.has(k)&&k!==file).map(k=>k.replace(root+'/',''))));",
].join('');

function exclusive(root, toolsDir) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-384-s7-excl-'));
  const sets = {};
  try {
    for (const f of fs.readdirSync(toolsDir).filter((x) => x.endsWith('.cjs')).sort()) {
      const argv = [process.execPath, '-e', SET_CHILD, root, path.join(toolsDir, f)];
      const full = HAS_TASKSET ? ['taskset', '-c', '0-3'].concat(argv) : argv;
      const r = cp.spawnSync(full[0], full.slice(1), { cwd: root, encoding: 'utf8', timeout: 60000, env: { PATH: process.env.PATH, HOME: home, MINDRIAN_BRAIN_URL: 'http://127.0.0.1:9' } });
      try { sets[f] = JSON.parse(r.stdout); } catch (_e) { sets[f] = []; }
    }
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
  const names = Object.keys(sets);
  const count = {};
  for (const f of names) for (const m of sets[f]) count[m] = (count[m] || 0) + 1;
  const rows = names.map((f) => ({ file: f, added: sets[f].length, exclusive: sets[f].filter((m) => count[m] === 1 && !m.startsWith('lib/mcp/tools/')).length }));
  const shared = Object.keys(count).filter((m) => count[m] >= Math.ceil(names.length * 0.8)).length;
  return { rows, distinct: Object.keys(count).length, shared80: shared };
}

function exclusiveTable(res) {
  const sorted = res.rows.slice().sort((a, b) => b.exclusive - a.exclusive || (a.file < b.file ? -1 : 1));
  const out = ['distinct modules over all tool files: ' + res.distinct + '; modules that at least 80 percent of the files add: ' + res.shared80, '', '| file | modules added | exclusive modules |', '|---|---|---|'];
  for (const r of sorted) out.push('| ' + r.file + ' | ' + r.added + ' | ' + r.exclusive + ' |');
  return out.join('\n');
}

function table(rows) {
  const sorted = rows.slice().sort((a, b) => (b.ms_median || 0) - (a.ms_median || 0));
  const out = ['| file | modules added | load median ms | load p95 ms | n |', '|---|---|---|---|---|'];
  for (const r of sorted) out.push('| ' + r.file + ' | ' + r.added + ' | ' + r.ms_median + ' | ' + r.ms_p95 + ' | ' + r.n + (r.failed ? ' (failed ' + r.failed + ')' : '') + ' |');
  return out.join('\n');
}

function selftest() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-384-s7-self-'));
  let code = 1;
  try {
    const tools = path.join(dir, 'tools');
    fs.mkdirSync(tools);
    fs.writeFileSync(path.join(dir, 'm1.cjs'), 'module.exports = 1;\n');
    for (let i = 1; i <= 3; i += 1) fs.writeFileSync(path.join(dir, 'x' + i + '.cjs'), 'module.exports = ' + i + ';\n');
    fs.writeFileSync(path.join(tools, 'a-zero.cjs'), 'module.exports = {};\n');
    fs.writeFileSync(path.join(tools, 'b-one.cjs'), "require('../m1.cjs');\nmodule.exports = {};\n");
    fs.writeFileSync(path.join(tools, 'c-four.cjs'), "require('../x1.cjs');require('../x2.cjs');require('../x3.cjs');require('../m1.cjs');\nmodule.exports = {};\n");
    // added counts the modules that the tool file pulls in, without the tool file itself
    const rows = attribute(dir, tools, 2);
    const want = { 'a-zero.cjs': 0, 'b-one.cjs': 1, 'c-four.cjs': 4 };
    const bad = rows.filter((r) => want[r.file] !== r.added);
    if (rows.length === 3 && bad.length === 0) { process.stdout.write('selftest ok: ' + rows.map((r) => r.file + '=' + r.added).join(' ') + '\n'); code = 0; }
    else process.stdout.write('selftest FAIL: ' + JSON.stringify(rows.map((r) => [r.file, r.added])) + '\n');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  return code;
}

function main(argv) {
  if (argv.includes('--selftest')) return selftest();
  if (argv.includes('--exclusive')) {
    const t = argv[argv.indexOf('--tree') + 1];
    if (!t || t.startsWith('--')) { process.stderr.write('usage: --tree DIR --exclusive\n'); return 2; }
    const root0 = path.resolve(t);
    process.stdout.write(exclusiveTable(exclusive(root0, path.join(root0, 'lib', 'mcp', 'tools'))) + '\n');
    return 0;
  }
  const get = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
  const tree = get('--tree');
  const runs = Number(get('--runs') || 7);
  if (!tree || !Number.isFinite(runs) || runs < 1) { process.stderr.write('usage: --tree DIR --runs N | --selftest\n'); return 2; }
  const root = path.resolve(tree);
  const rows = attribute(root, path.join(root, 'lib', 'mcp', 'tools'), runs);
  if (argv.includes('--json')) process.stdout.write(JSON.stringify(rows) + '\n');
  else process.stdout.write(table(rows) + '\n');
  return rows.some((r) => r.failed) ? 1 : 0;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));
module.exports = { attribute, table, exclusive, exclusiveTable, median, p95 };
