'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 384 plan 05: the probe preload. Use: NODE_OPTIONS="--require <this file>" with
 *   MOS_PROBE_LOG   a file; one JSON line per process is appended to it (no log variable: the preload does nothing)
 *   MOS_PROBE_CATS  a JSON object that maps a category name to an absolute path prefix; a path belongs to the
 *                   category with the longest matching prefix, else to `other`
 * It counts calls of these fs functions by category: readFileSync, openSync, statSync, lstatSync, readdirSync,
 * existsSync, accessSync, readFile, open, stat, readdir, and the fs.promises forms of readFile, open, stat, readdir.
 * A call that a wrapped function makes inside a wrapped function (readFileSync calls openSync) is not counted twice.
 * It also counts node:sqlite use: DatabaseSync constructions (attempts), exec calls and prepare calls.
 * The line: pid, ppid, argv1 (a script base name, or `eval` for node -e, or `stdin`), snapshot (false for the
 * final line), modules (count of require.cache keys without this file), fs [{cat, fn, count}], sqlite {constructed, exec, prepare}.
 * SIGTERM: flush the final line and exit 0. SIGUSR2: append a snapshot line (snapshot true), reset the counters,
 * keep running (plan 384-06 counts database opens per MCP tool call with it).
 * Canon Part 8 (P4): only counts, category names, function names and a script base name are written. Never a path
 * and never an argument. The counting slows a run, so counting runs are kept apart from timing runs.
 * Hyphens only.
 */
const fs = require('node:fs');
const path = require('node:path');
const url = require('node:url');
const Module = require('node:module');

const LOG = process.env.MOS_PROBE_LOG;

if (LOG) {
  const appendLine = fs.appendFileSync.bind(fs); // captured before any wrapping
  const statOriginal = fs.statSync.bind(fs);

  let prefixes = [];
  try {
    const cats = JSON.parse(process.env.MOS_PROBE_CATS || '{}');
    prefixes = Object.keys(cats)
      .filter((k) => typeof cats[k] === 'string' && cats[k])
      .map((k) => ({ cat: k, prefix: path.resolve(cats[k]).replace(/\/+$/, '') }))
      .sort((a, b) => b.prefix.length - a.prefix.length);
  } catch (_e) { prefixes = []; }

  let fsCounts = new Map();
  let sq = { constructed: 0, exec: 0, prepare: 0 };
  let depth = 0;

  const categoryOf = (arg) => {
    try {
      let p = null;
      if (typeof arg === 'string') p = arg;
      else if (Buffer.isBuffer(arg)) p = arg.toString();
      else if (arg && typeof arg === 'object' && typeof arg.href === 'string') p = url.fileURLToPath(arg);
      if (p === null) return 'other';
      const abs = path.resolve(p);
      for (const c of prefixes) {
        if (abs === c.prefix || abs.startsWith(c.prefix + '/')) return c.cat;
      }
    } catch (_e) { /* fall through */ }
    return 'other';
  };

  const record = (arg, fn) => {
    const key = categoryOf(arg) + '\t' + fn;
    fsCounts.set(key, (fsCounts.get(key) || 0) + 1);
  };

  const wrap = (obj, name, label) => {
    const orig = obj[name];
    if (typeof orig !== 'function') return;
    obj[name] = function probed(...args) {
      if (depth === 0) record(args[0], label);
      depth += 1;
      try { return orig.apply(this, args); } finally { depth -= 1; }
    };
  };

  ['readFileSync', 'openSync', 'statSync', 'lstatSync', 'readdirSync', 'existsSync', 'accessSync',
    'readFile', 'open', 'stat', 'readdir'].forEach((n) => wrap(fs, n, n));
  try {
    const fsp = fs.promises;
    ['readFile', 'open', 'stat', 'readdir'].forEach((n) => wrap(fsp, n, 'promises.' + n));
  } catch (_e) { /* no promises API */ }

  // node:sqlite: a transparent subclass that counts constructions, exec and prepare.
  try {
    const origLoad = Module._load;
    let probedExports = null;
    let sourceExports = null;
    Module._load = function probedLoad(request, parent, isMain) {
      const m = origLoad.apply(this, arguments);
      if (request !== 'node:sqlite' || !m || typeof m.DatabaseSync !== 'function') return m;
      if (probedExports && sourceExports === m) return probedExports;
      const Base = m.DatabaseSync;
      class ProbedDatabaseSync extends Base {
        constructor(...a) {
          sq.constructed += 1; // counts the attempt: an open that throws is still an open
          super(...a);
        }
        exec(...a) { sq.exec += 1; return super.exec(...a); }
        prepare(...a) { sq.prepare += 1; return super.prepare(...a); }
      }
      sourceExports = m;
      probedExports = Object.assign({}, m, { DatabaseSync: ProbedDatabaseSync });
      return probedExports;
    };
  } catch (_e) { /* sqlite not counted */ }

  const labelOfScript = () => {
    if (process._eval !== undefined) return 'eval';
    const a = process.argv[1];
    if (!a) return 'stdin';
    const b = path.basename(String(a));
    // only a base name of an existing file counts as a script name; an argument of another form is not written
    try {
      if (/^[A-Za-z0-9._-]{1,64}$/.test(b) && statOriginal(path.resolve(String(a))).isFile()) return b;
    } catch (_e) { /* not a file */ }
    return 'other';
  };

  const buildLine = (snapshot) => {
    const rows = [];
    for (const [key, count] of fsCounts) {
      const [cat, fn] = key.split('\t');
      rows.push({ cat, fn, count });
    }
    rows.sort((a, b) => (a.cat + a.fn < b.cat + b.fn ? -1 : 1));
    return {
      pid: process.pid,
      ppid: process.ppid,
      argv1: labelOfScript(),
      snapshot,
      modules: Math.max(0, Object.keys(require.cache).filter((k) => k !== __filename).length),
      fs: rows,
      sqlite: { constructed: sq.constructed, exec: sq.exec, prepare: sq.prepare },
    };
  };

  const writeLine = (snapshot) => {
    try { appendLine(LOG, JSON.stringify(buildLine(snapshot)) + '\n'); } catch (_e) { /* best effort */ }
  };

  let finalDone = false;
  process.on('exit', () => {
    if (finalDone) return;
    finalDone = true;
    writeLine(false);
  });
  // a long-lived process that is stopped still reports: exit 0 runs the exit handler above
  process.on('SIGTERM', () => process.exit(0));
  process.on('SIGUSR2', () => {
    writeLine(true);
    fsCounts = new Map();
    sq = { constructed: 0, exec: 0, prepare: 0 };
  });
}
