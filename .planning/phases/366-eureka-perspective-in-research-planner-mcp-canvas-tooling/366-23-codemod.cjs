#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 366 Plan 23 (EPV366-29, ADR-E12): the semantic-index split codemod.
 * A planning artifact, never shipped. It moves the shared semantic-index
 * modules out of lib/core/eureka/ into lib/core/semantic-index/, batch by
 * batch, and rewrites every reference to them.
 *
 * CLI (run from anywhere; the repo root is three folders up):
 *   --map                 print the importer map of lib/core/eureka/*.cjs
 *                         (code references only; the deleted runner is gone)
 *   --list-batches        print the batch numbers, one per line
 *   --batch N [--dry-run] print, per importer, every old -> new string for
 *                         batch N and touch nothing (the default)
 *   --batch N --apply     git mv the batch's modules and write the rewrites
 *
 * WHAT IT REWRITES (in every .cjs/.js/.mjs file under lib/, scripts/, hooks/,
 * bin/ and tests/, plus .sh and .json files there for the repo-root form):
 *   K1  a relative string literal ('./x', '../eureka/x.cjs') that resolves from
 *       its file's folder to a module whose location changes in this batch, or
 *       that sits in a module that moves in this batch: the new value is
 *       path.relative from the importer's post-move folder to the target's
 *       post-move path, keeping the original's extension style. Never a
 *       string guess.
 *   K2  the repo-root form lib/core/eureka/<moved> (strings, lists, comments,
 *       shell path lists): lib/core/semantic-index/<moved>.
 *   K3  a path.join / path.resolve argument list holding the literal pair
 *       'eureka', '<moved>.cjs': the 'eureka' segment becomes
 *       'semantic-index'.
 * Every string literal is located by the lexer of
 * scripts/check-require-integrity.cjs (mask().spans), so text inside a
 * comment is only touched by K2. Dynamic references (a template or a
 * concatenation naming eureka/) are printed under UNMATCHED for a by-hand
 * look and never rewritten. No shims, no behavior change.
 *
 * Hyphens only. CJS, no deps beyond node: builtins and git.
 */

const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');

const REPO = path.resolve(__dirname, '..', '..', '..');
const gate = require(path.join(REPO, 'scripts', 'check-require-integrity.cjs'));
const EU_REL = 'lib/core/eureka';
const SI_REL = 'lib/core/semantic-index';
const EU = path.join(REPO, EU_REL);
const SI = path.join(REPO, SI_REL);
const SCAN_DIRS = ['lib', 'scripts', 'hooks', 'bin', 'tests'];
const SKIP_DIRS = new Set(['node_modules', '.git']);

// The batch table (366-23-SUMMARY.md, Task 2): the modules with importers
// outside lib/core/eureka/, leaves first, at most four per batch. Frozen from
// the --map output so later batches do not change the set as modules move.
const BATCHES = Object.freeze([
  /* BATCHES-START */
  // 1: leaves (no require into lib/core/eureka/)
  Object.freeze(['embedding-spine', 'lexical-overlap', 'entity-extractor', 'entity-classifier']),
  // 2: leaves, and modules that need only embedding-spine (batch 1)
  Object.freeze(['scaffold-template-index', 'online-pattern-query', 'vector-store', 'analogy-fitness']),
  // 3: tri-modal-index (spine + vector-store), embedding-classifier (spine + entity-extractor)
  Object.freeze(['tri-modal-index', 'embedding-classifier']),
  // 4: the tri-modal-index consumers
  Object.freeze(['fts-index-lifecycle', 'hybrid-retrieve', 'research-filing']),
  /* BATCHES-END */
]);

function moduleName(file) { return file.replace(/\.cjs$/, ''); }

function walk(dir, out, exts) {
  let ents;
  try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch (_e) { return out; }
  ents.forEach(function (e) {
    if (SKIP_DIRS.has(e.name)) return;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out, exts);
    else if (e.isFile() && exts.test(e.name)) out.push(p);
  });
  return out;
}

function allFiles() {
  const out = [];
  SCAN_DIRS.forEach(function (d) { walk(path.join(REPO, d), out, /\.(cjs|js|mjs|sh|json)$/); });
  return out.sort();
}

const SUFFIXES = ['', '.cjs', '.js', '.json', '/index.cjs', '/index.js'];
function resolveFile(abs) {
  for (let i = 0; i < SUFFIXES.length; i += 1) {
    const c = abs + SUFFIXES[i];
    try { if (fs.statSync(c).isFile()) return c; } catch (_e) { /* next */ }
  }
  return null;
}

function rel(p) { return path.relative(REPO, p).split(path.sep).join('/'); }

// location(absPath, movedSet) -> the post-move absolute path of a file.
function location(abs, movedNow) {
  if (path.dirname(abs) === EU && movedNow.has(path.basename(abs))) return path.join(SI, path.basename(abs));
  return abs;
}

function relSpec(fromDir, toAbs, original) {
  let r = path.relative(fromDir, toAbs).split(path.sep).join('/');
  if (!/\.(cjs|js|json)$/.test(original)) r = r.replace(/\.cjs$/, '');
  if (r.indexOf('../') !== 0 && r.indexOf('./') !== 0) r = './' + r;
  return r;
}

// planFile(abs, movedNow, allMoved) -> { edits:[{start,end,old,new,kind}], text, unmatched:[] }
//   movedNow: the basenames moving in THIS batch; allMoved: every basename that
//   has moved by the end of this batch (earlier batches included).
function planFile(abs, movedNow, allMoved) {
  const text = fs.readFileSync(abs, 'utf8');
  const isJs = /\.(cjs|js|mjs)$/.test(abs);
  const edits = [];
  const unmatched = [];
  const fileMoves = path.dirname(abs) === EU && movedNow.has(path.basename(abs));
  const fromDirNew = path.dirname(location(abs, movedNow));
  if (isJs) {
    let m0;
    try { m0 = gate.mask(text.charCodeAt(0) === 0x23 ? text.replace(/^#![^\n]*/, function (s) { return s.replace(/[^\n]/g, ' '); }) : text); } catch (_e) { m0 = null; }
    if (m0) {
      const strs = m0.strs;
      const spans = m0.spans;
      for (let i = 0; i < strs.length; i += 1) {
        const v = strs[i];
        if (v === null) {
          const raw = text.slice(spans[i].start, spans[i].end);
          if (/eureka\//.test(raw)) unmatched.push(raw.slice(0, 120));
          continue;
        }
        const sp = spans[i];
        // the literal must be a plain single-line literal we can re-quote safely
        if (v.indexOf('\n') !== -1) continue;
        // K1
        if (v.indexOf('./') === 0 || v.indexOf('../') === 0) {
          const target = resolveFile(path.resolve(path.dirname(abs), v));
          if (target && path.dirname(target) === EU && /\.cjs$/.test(target)) {
            const newTarget = location(target, movedNow);
            if (newTarget !== target || fileMoves) {
              const nv = relSpec(fromDirNew, newTarget, v);
              if (nv !== v) edits.push({ start: sp.start, end: sp.end, old: v, new: nv, kind: 'K1', q: sp.quote });
            }
            continue;
          }
          if (target && path.dirname(target) === SI && fileMoves) {
            const nv = relSpec(fromDirNew, target, v);
            if (nv !== v) edits.push({ start: sp.start, end: sp.end, old: v, new: nv, kind: 'K1', q: sp.quote });
            continue;
          }
        }
        // K3: the literal 'eureka' followed by a moved module literal
        if (v === 'eureka' && i + 1 < strs.length && typeof strs[i + 1] === 'string') {
          const between = text.slice(sp.end, spans[i + 1].start);
          const nextName = strs[i + 1].replace(/\.cjs$/, '') + '.cjs';
          if (/^\s*,\s*$/.test(between) && movedNow.has(nextName)) {
            edits.push({ start: sp.start, end: sp.end, old: v, new: 'semantic-index', kind: 'K3', q: sp.quote });
            continue;
          }
        }
        if (/eureka\//.test(v) && !/lib\/core\/eureka\//.test(v) && v.indexOf('./') !== 0 && v.indexOf('../') !== 0) {
          // a bare 'eureka/x' fragment (a concatenation part): by hand
          const frag = v.match(/eureka\/([a-z0-9-]+)/);
          if (frag && movedNow.has(frag[1] + '.cjs')) unmatched.push(v.slice(0, 120));
        }
      }
    }
  }
  // apply span edits back to front
  let out = text;
  edits.slice().sort(function (a, b) { return b.start - a.start; }).forEach(function (e) {
    out = out.slice(0, e.start) + e.q + e.new + e.q + out.slice(e.end);
  });
  // K2: repo-root form, anywhere in the file (strings, lists, comments).
  // Frozen JSON records under tests/fixtures/ (a spike's bar.json) keep the
  // path they were written with.
  const k2 = [];
  const frozenRecord = /\.json$/.test(abs) && rel(abs).indexOf('tests/fixtures/') === 0;
  if (!frozenRecord) movedNow.forEach(function (base) {
    const name = moduleName(base);
    const re = new RegExp('lib/core/eureka/' + name.replace(/[-.]/g, '\\$&') + '(?![\\w-])', 'g');
    out = out.replace(re, function (hit) {
      k2.push({ old: hit, new: hit.replace('lib/core/eureka/', 'lib/core/semantic-index/'), kind: 'K2' });
      return hit.replace('lib/core/eureka/', 'lib/core/semantic-index/');
    });
  });
  return { text: text, out: out, edits: edits.concat(k2), unmatched: unmatched, fileMoves: fileMoves };
}

function batchSets(n) {
  const idx = n - 1;
  if (idx < 0 || idx >= BATCHES.length) return null;
  const movedNow = new Set(BATCHES[idx].map(function (b) { return b + '.cjs'; }));
  const allMoved = new Set();
  for (let i = 0; i <= idx; i += 1) BATCHES[i].forEach(function (b) { allMoved.add(b + '.cjs'); });
  return { movedNow: movedNow, allMoved: allMoved };
}

function runBatch(n, apply) {
  const sets = batchSets(n);
  if (!sets) { process.stderr.write('366-23-codemod: no batch ' + n + '\n'); return 2; }
  const missing = Array.from(sets.movedNow).filter(function (b) { return !fs.existsSync(path.join(EU, b)); });
  if (missing.length) { process.stderr.write('366-23-codemod: batch ' + n + ' modules not in lib/core/eureka/: ' + missing.join(', ') + '\n'); return 2; }
  const plans = [];
  allFiles().forEach(function (abs) {
    const p = planFile(abs, sets.movedNow, sets.allMoved);
    if (p.edits.length || p.unmatched.length) plans.push({ abs: abs, plan: p });
  });
  process.stdout.write('batch ' + n + ': ' + Array.from(sets.movedNow).join(', ') + (apply ? ' (APPLY)' : ' (dry-run)') + '\n');
  let count = 0;
  plans.forEach(function (x) {
    if (!x.plan.edits.length) return;
    const where = rel(x.abs) + (x.plan.fileMoves ? ' (moves to ' + SI_REL + '/)' : '');
    process.stdout.write('  ' + where + '\n');
    x.plan.edits.forEach(function (e) {
      count += 1;
      process.stdout.write('    ' + e.kind + ' ' + JSON.stringify(e.old) + ' -> ' + JSON.stringify(e.new) + '\n');
    });
  });
  const unmatched = plans.filter(function (x) { return x.plan.unmatched.length; });
  if (unmatched.length) {
    process.stdout.write('  UNMATCHED (dynamic, by hand):\n');
    unmatched.forEach(function (x) { x.plan.unmatched.forEach(function (u) { process.stdout.write('    ' + rel(x.abs) + ': ' + u + '\n'); }); });
  }
  process.stdout.write('  ' + count + ' rewrite(s) in ' + plans.filter(function (x) { return x.plan.edits.length; }).length + ' file(s)\n');
  if (!apply) return 0;
  fs.mkdirSync(SI, { recursive: true });
  // write the rewrites first (paths are pre-move), then git mv
  plans.forEach(function (x) {
    if (x.plan.out !== x.plan.text) fs.writeFileSync(x.abs, x.plan.out);
  });
  Array.from(sets.movedNow).sort().forEach(function (b) {
    const r = cp.spawnSync('git', ['mv', path.join(EU_REL, b), path.join(SI_REL, b)], { cwd: REPO, encoding: 'utf8' });
    if (r.status !== 0) throw new Error('git mv failed for ' + b + ': ' + String(r.stderr).slice(0, 200));
  });
  process.stdout.write('  applied: ' + sets.movedNow.size + ' module(s) moved\n');
  return 0;
}

// --map: importers of each lib/core/eureka module, code references only.
function importerMap() {
  const mods = fs.readdirSync(EU).filter(function (f) { return /\.cjs$/.test(f); }).sort();
  const modSet = new Set(mods);
  const map = {};
  const inner = {};
  mods.forEach(function (m) { map[m] = new Set(); inner[m] = new Set(); });
  allFiles().forEach(function (abs) {
    const r = rel(abs);
    const insideEu = path.dirname(abs) === EU;
    const text = fs.readFileSync(abs, 'utf8');
    const hits = new Set();
    if (/\.(cjs|js|mjs)$/.test(abs)) {
      let m0;
      try { m0 = gate.mask(text.charCodeAt(0) === 0x23 ? text.replace(/^#![^\n]*/, function (s) { return s.replace(/[^\n]/g, ' '); }) : text); } catch (_e) { m0 = null; }
      if (!m0) return;
      m0.strs.forEach(function (v, i) {
        if (v === null) return;
        if (v.indexOf('./') === 0 || v.indexOf('../') === 0) {
          const t = resolveFile(path.resolve(path.dirname(abs), v));
          if (t && path.dirname(t) === EU && modSet.has(path.basename(t))) hits.add(path.basename(t));
        }
        const mm = v.match(/lib\/core\/eureka\/([a-z0-9-]+)(?:\.cjs)?/);
        if (mm && modSet.has(mm[1] + '.cjs')) hits.add(mm[1] + '.cjs');
        if (v === 'eureka' && typeof m0.strs[i + 1] === 'string') {
          const nx = m0.strs[i + 1].replace(/\.cjs$/, '') + '.cjs';
          if (modSet.has(nx)) hits.add(nx);
        }
      });
    } else {
      const re = /lib\/core\/eureka\/([a-z0-9-]+)/g;
      let mm;
      while ((mm = re.exec(text)) !== null) if (modSet.has(mm[1] + '.cjs')) hits.add(mm[1] + '.cjs');
    }
    hits.forEach(function (h) {
      if (insideEu) { if (path.basename(abs) !== h) inner[h].add(path.basename(abs)); }
      else map[h].add(r);
    });
  });
  return { mods: mods, outside: map, inner: inner };
}

function printMap() {
  const r = importerMap();
  r.mods.forEach(function (m) {
    const out = Array.from(r.outside[m]).sort();
    const inn = Array.from(r.inner[m]).sort();
    process.stdout.write(m + '\toutside=' + out.length + '\tinner=' + inn.length + '\n');
    out.forEach(function (f) { process.stdout.write('    ' + f + '\n'); });
    if (inn.length) process.stdout.write('    (inside eureka/: ' + inn.join(', ') + ')\n');
  });
  // each module's own requires into lib/core/eureka (for the leaves-first order)
  process.stdout.write('\nDEPS (module -> eureka modules it references)\n');
  r.mods.forEach(function (m) {
    const deps = r.mods.filter(function (o) { return r.inner[o].has(m); });
    process.stdout.write('  ' + m + ' -> ' + (deps.join(', ') || '(none)') + '\n');
  });
  return 0;
}

function main(argv) {
  if (argv.indexOf('--map') !== -1) return printMap();
  if (argv.indexOf('--list-batches') !== -1) {
    BATCHES.forEach(function (_b, i) { process.stdout.write(String(i + 1) + '\n'); });
    return 0;
  }
  const bi = argv.indexOf('--batch');
  if (bi !== -1) {
    const n = Number(argv[bi + 1]);
    if (!Number.isInteger(n)) { process.stderr.write('366-23-codemod: --batch needs a number\n'); return 2; }
    return runBatch(n, argv.indexOf('--apply') !== -1);
  }
  process.stdout.write('usage: 366-23-codemod.cjs --map | --list-batches | --batch N [--dry-run|--apply]\n');
  return 2;
}

if (require.main === module) {
  try { process.exitCode = main(process.argv.slice(2)); } catch (e) { process.stderr.write('366-23-codemod: ' + String(e && e.message) + '\n'); process.exitCode = 1; }
}

module.exports = { BATCHES, planFile, importerMap };
