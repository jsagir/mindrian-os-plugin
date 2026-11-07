#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 384 plan 14 (S1): attribute the node starts of scripts/session-start to call sites.
 *
 * It runs `bash scripts/session-start` of a tree on a fixture room with bash xtrace written to a separate
 * file descriptor (BASH_XTRACEFD) and a PS4 that holds the line number. It counts, per line number, the simple
 * commands whose program is node (also after `env VAR=value ... node`). A PATH shim named node counts every
 * node start that goes through PATH, including starts made by child scripts that xtrace does not follow.
 *
 * Usage:
 *   node session-start-sites.cjs --tree <dir> [--repeats N (default 3)] [--source startup|compact] [--no-change]
 *   node session-start-sites.cjs --selftest
 *
 * Output: a table of line number and count, sorted by line, the total, the shim total and the repeats.
 * Canon Part 8: line numbers and counts only. No command text and no path is printed. Hyphens only.
 * Run the real mode under the 384 lock (it builds a fixture room and runs the script).
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');

const REPO = path.resolve(__dirname, '..', '..', '..', '..');

// ---------------------------------------------------------------------------
// parsing of an xtrace file
// ---------------------------------------------------------------------------

// Split a trace command text into words. Single quotes group (xtrace quotes with single quotes); a word
// that starts with a dollar sign and a single quote ($'..') is read the same way. Only the first words matter.
function words(text, limit) {
  const out = [];
  let i = 0;
  const n = text.length;
  while (i < n && out.length < limit) {
    while (i < n && /\s/.test(text[i])) i += 1;
    if (i >= n) break;
    let w = '';
    while (i < n && !/\s/.test(text[i])) {
      if (text[i] === "'") {
        i += 1;
        while (i < n && text[i] !== "'") { w += text[i]; i += 1; }
        i += 1;
      } else if (text[i] === '\\' && i + 1 < n) {
        w += text[i + 1]; i += 2;
      } else { w += text[i]; i += 1; }
    }
    out.push(w);
  }
  return out;
}

// true when the command text starts a node program: `node ...`, `/x/node ...` or `env [-opts] [VAR=v ...] node ...`
function isNodeCommand(text) {
  const w = words(text, 40);
  if (!w.length) return false;
  let k = 0;
  const base = (s) => path.basename(s);
  if (base(w[0]) === 'env') {
    k = 1;
    while (k < w.length && (/^[A-Za-z_][A-Za-z0-9_]*=/.test(w[k]) || /^-/.test(w[k]))) k += 1;
    if (k >= w.length) return false;
  }
  return base(w[k]) === 'node' || base(w[k]) === 'node.exe';
}

// parse(text): trace records start with a PS4 prefix: one or more plus signs, then @LINE@ and a space.
function parseTrace(text) {
  const re = /^\++@(\d+)@ /gm;
  const marks = [];
  let m;
  while ((m = re.exec(text)) !== null) marks.push({ line: Number(m[1]), start: m.index + m[0].length, at: m.index });
  const counts = new Map();
  for (let i = 0; i < marks.length; i += 1) {
    const end = i + 1 < marks.length ? marks[i + 1].at : text.length;
    const body = text.slice(marks[i].start, end);
    if (isNodeCommand(body)) counts.set(marks[i].line, (counts.get(marks[i].line) || 0) + 1);
  }
  return counts;
}

// ---------------------------------------------------------------------------
// running one script under xtrace and the node shim
// ---------------------------------------------------------------------------

function makeShim(dir) {
  const real = process.execPath;
  const log = path.join(dir, 'node-starts.log');
  fs.writeFileSync(log, '');
  const shimDir = path.join(dir, 'shim');
  fs.mkdirSync(shimDir, { recursive: true });
  const shim = path.join(shimDir, 'node');
  fs.writeFileSync(shim, '#!/bin/sh\nprintf \'x\\n\' >> "$MOS_NODE_SHIM_LOG"\nexec "$MOS_NODE_SHIM_REAL" "$@"\n', { mode: 0o755 });
  return { shimDir, log, real };
}

function runTraced(scriptPath, opts) {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-384-sites-'));
  const traceFile = path.join(work, 'trace.log');
  const shim = makeShim(work);
  const fd = fs.openSync(traceFile, 'w');
  const env = Object.assign({}, opts.env || process.env);
  env.PATH = shim.shimDir + path.delimiter + (env.PATH || '');
  env.MOS_NODE_SHIM_LOG = shim.log;
  env.MOS_NODE_SHIM_REAL = shim.real;
  env.BASH_XTRACEFD = '3';
  env.PS4 = '+@${LINENO}@ ';
  const argv = ['-x', scriptPath].concat(opts.args || []);
  return new Promise((resolve) => {
    const child = cp.spawn('bash', argv, { cwd: opts.cwd || process.cwd(), env, stdio: ['pipe', 'pipe', 'ignore', fd] });
    child.stdout.on('data', () => {});
    child.stdin.on('error', () => {});
    child.stdin.end(opts.stdin || '');
    const timer = setTimeout(() => { try { process.kill(-child.pid, 'SIGKILL'); } catch (_e) { try { child.kill('SIGKILL'); } catch (_e2) { /* gone */ } } }, opts.timeoutMs || 300000);
    child.on('close', () => {
      clearTimeout(timer);
      fs.closeSync(fd);
      // background work started by the script may still write; wait for it to go quiet
      setTimeout(() => {
        let traced;
        let shimTotal;
        try {
          traced = parseTrace(fs.readFileSync(traceFile, 'utf8'));
          shimTotal = fs.readFileSync(shim.log, 'utf8').split('\n').filter(Boolean).length;
        } finally { fs.rmSync(work, { recursive: true, force: true }); }
        resolve({ counts: traced, shimTotal });
      }, opts.settleMs === undefined ? 1500 : opts.settleMs);
    });
  });
}

function formatTable(counts) {
  const rows = Array.from(counts.entries()).sort((a, b) => a[0] - b[0]);
  const lines = ['line\tnode starts'];
  let total = 0;
  for (const [line, c] of rows) { lines.push(line + '\t' + c); total += c; }
  lines.push('traced total\t' + total);
  return { text: lines.join('\n'), total };
}

// ---------------------------------------------------------------------------
// selftest
// ---------------------------------------------------------------------------

async function selftest() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-384-sites-self-'));
  try {
    const script = path.join(dir, 'synthetic.sh');
    // node lines: 3 (one start), 5 (two starts in a loop), 8 (one start after env VAR=value). Line 4, 6, 7 start no node.
    fs.writeFileSync(script, [
      '#!/bin/bash',
      'x=1',
      'node -e 0',
      'echo node',
      'for i in 1 2; do node -e 0; done',
      'echo "node is a word"',
      'false || true',
      'y=$(env FOO=1 BAR="a b" node -e 0)',
      '',
    ].join('\n'));
    const r = await runTraced(script, { cwd: dir, settleMs: 100 });
    const want = new Map([[3, 1], [5, 2], [8, 1]]);
    const got = r.counts;
    let ok = got.size === want.size && r.shimTotal === 4;
    for (const [k, v] of want) if (got.get(k) !== v) ok = false;
    // parser unit checks
    const unit = isNodeCommand("env A=1 B='x y' /usr/bin/node -e 0") && !isNodeCommand('echo node') && !isNodeCommand('env A=1 sh -c node') && isNodeCommand('node') && !isNodeCommand('nodemon x');
    if (!unit) ok = false;
    if (!ok) {
      process.stderr.write('selftest FAIL: got ' + JSON.stringify(Array.from(got.entries())) + ' shim ' + r.shimTotal + ' unit ' + unit + '\n');
      return 1;
    }
    process.stdout.write('selftest ok\n');
    return 0;
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

// ---------------------------------------------------------------------------
// real mode
// ---------------------------------------------------------------------------

function parseFlags(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--selftest' || a === '--no-change') { o[a.slice(2)] = true; continue; }
    if (!a.startsWith('--')) throw new Error('unexpected argument: ' + a);
    i += 1;
    if (argv[i] === undefined) throw new Error('missing value for ' + a);
    o[a.slice(2)] = argv[i];
  }
  return o;
}

async function main(argv) {
  const f = parseFlags(argv);
  if (f.selftest) return selftest();
  if (!f.tree) { process.stderr.write('usage: --tree <dir> [--repeats N] [--source startup|compact] [--no-change] | --selftest\n'); return 2; }
  const H = require(path.join(REPO, 'tools', 'perf', 'perf-harness.cjs'));
  if (!H.requireLock({ lockFile: H.defaultLockFile() })) { process.stderr.write('lock not held: run under flock -w 7200 "$HOME/.cache/mos-perf-384.lock"\n'); return 1; }
  const tree = path.resolve(f.tree);
  const repeats = parseInt(f.repeats || '3', 10);
  const source = f.source || 'startup';
  const results = [];
  for (let k = 0; k < repeats; k += 1) {
    const prep = H.prepareRoom('fixture', { trees: [tree], baseSha: 'unknown' });
    try {
      const ctx = H.makeCtx('A', tree, prep, 4, false);
      const def = H.targetDef('event:SessionStart:' + (source === 'compact' ? 'compact' : 'changed'));
      if (def.change === 'changed' && !f['no-change'] && ctx.touchTarget) {
        await new Promise((r) => setTimeout(r, 1100));
        const now = new Date();
        fs.utimesSync(ctx.touchTarget, now, now);
      }
      const stdin = JSON.stringify(H.buildEventPayload(def, ctx));
      const r = await runTraced(path.join(tree, 'scripts', 'session-start'), { cwd: prep.roomDir, env: ctx.env({}), stdin });
      results.push(r);
    } finally { prep.sandbox.cleanup(); }
  }
  const first = formatTable(results[0].counts);
  const agree = results.every((r) => formatTable(r.counts).text === first.text);
  process.stdout.write(first.text + '\n');
  process.stdout.write('shim total per repeat\t' + results.map((r) => r.shimTotal).join(',') + '\n');
  process.stdout.write('repeats\t' + repeats + '\n');
  process.stdout.write('repeats agree\t' + (agree ? 'yes' : 'no') + '\n');
  if (!agree) results.forEach((r, i) => process.stdout.write('repeat ' + (i + 1) + '\t' + formatTable(r.counts).text.replace(/\n/g, ' | ') + '\n'));
  return 0;
}

if (require.main === module) {
  main(process.argv.slice(2)).then((c) => process.exit(c), (e) => { process.stderr.write(String(e && e.message) + '\n'); process.exit(e && e.exitCode ? e.exitCode : 1); });
}

module.exports = { parseTrace, isNodeCommand, runTraced, formatTable, words };
