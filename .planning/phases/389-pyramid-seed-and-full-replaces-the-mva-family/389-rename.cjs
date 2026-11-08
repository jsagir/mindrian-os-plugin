#!/usr/bin/env node
// Phase 389 plan 13 (owner card D9 APPROVE): rename tool for the five surviving modules.
// Node built-ins only. Hyphens only.
//
// Commands:
//   selftest                          run the self-test on synthetic git repos (exit 0 pass, 1 fail)
//   dry-run [--only M] [--root DIR]   print every file and every replacement count, write nothing
//   apply   [--only M] [--root DIR]   git mv the module files first, then rewrite the callers
//   M is one of: classifier, rule-linter, budget, agent-contract, dispatcher
//
// Rules:
//   - Only names change. A token is replaced only as a whole name: not glued to a longer
//     name on the left, not followed by a name character or by a hyphen and a name
//     character on the right. A longer name is printed as LONGER and not rewritten.
//   - Skipped by path: .planning/, CHANGELOG.md, r-and-d/, command-deprecations, docs files
//     whose base name starts with a date, and any path with eureka in it. A Eureka path that
//     holds an old token is printed as SKIPPED-EUREKA and the exit code is 1.
//   - Telemetry event names (mva_*) are never touched: they use an underscore, not these tokens.
'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

// Order of work (Task 2): budget and agent-contract before the dispatcher that requires them.
const MODULES = [
  { key: 'classifier', old: 'mva-classifier', neu: 'venture-sentence-classifier', dir: 'lib/core' },
  { key: 'rule-linter', old: 'mva-rule-linter', neu: 'reward-rule-linter', dir: 'lib/core' },
  { key: 'budget', old: 'mva-budget', neu: 'pyramid-seed-budget', dir: 'lib/core' },
  { key: 'agent-contract', old: 'mva-agent-contract', neu: 'pyramid-seed-agent-contract', dir: 'lib/core' },
  { key: 'dispatcher', old: 'mva-dispatcher', neu: 'pyramid-seed-dispatcher', dir: 'lib/core' },
];

function esc(s) {
  return s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
}
function wholeRe(token) {
  // Left side: not glued to a longer name. A backslash escape such as \n before the token
  // (source text 'x\nmva-budget') counts as a boundary, not as a letter of a longer name.
  return new RegExp('(?:(?<![A-Za-z0-9_-])|(?<=\\\\[nrt]))' + esc(token) + '(?![A-Za-z0-9_]|-[A-Za-z0-9])', 'g');
}
function rawRe(token) {
  return new RegExp(esc(token), 'g');
}

function git(root, args) {
  const r = spawnSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  if (r.status !== 0) throw new Error('git ' + args.join(' ') + ' failed: ' + (r.stderr || '').trim());
  return r.stdout;
}

function isSkippedPath(f) {
  if (f.startsWith('.planning/')) return true;
  if (f === 'CHANGELOG.md') return true;
  if (f.startsWith('r-and-d/')) return true;
  if (f.includes('command-deprecations')) return true;
  if (f.startsWith('docs/') && /^\d{4}-\d{2}-\d{2}/.test(path.basename(f))) return true;
  return false;
}
const isEureka = (f) => /eureka/i.test(f);

function selectModules(only) {
  if (!only) return MODULES;
  const m = MODULES.filter((x) => x.key === only);
  if (m.length === 0) {
    const err = new Error('unknown module: ' + only + ' (use ' + MODULES.map((x) => x.key).join(', ') + ')');
    err.code = 'UNKNOWN_MODULE';
    throw err;
  }
  return m;
}

// Build the plan: renames (existing files only), edits (new text per file), longer-word
// reports and Eureka reports. Reads the tracked file list from git. Writes nothing.
function buildPlan(root, only) {
  const mods = selectModules(only);
  const tracked = git(root, ['ls-files']).split('\n').filter(Boolean);
  const trackedSet = new Set(tracked);
  const renames = [];
  const renameMap = new Map();
  for (const m of mods) {
    for (const suffix of ['.cjs', '.test.cjs']) {
      const from = m.dir + '/' + m.old + suffix;
      const to = m.dir + '/' + m.neu + suffix;
      if (trackedSet.has(from)) {
        renames.push({ from, to, module: m.key });
        renameMap.set(from, to);
      }
    }
  }
  const edits = [];
  const longer = [];
  const eureka = [];
  const nonUtf8 = [];
  for (const f of tracked) {
    if (isSkippedPath(f)) continue;
    let buf;
    try {
      buf = fs.readFileSync(path.join(root, f));
    } catch (_) {
      continue;
    }
    if (buf.includes(0)) continue;
    const text = buf.toString('utf8');
    let hasRaw = false;
    for (const m of mods) if (text.includes(m.old)) hasRaw = true;
    if (!hasRaw) continue;
    if (isEureka(f)) {
      eureka.push(f);
      continue;
    }
    if (!Buffer.from(text, 'utf8').equals(buf)) {
      nonUtf8.push(f);
      continue;
    }
    let out = text;
    const counts = {};
    for (const m of mods) {
      const w = wholeRe(m.old);
      let n = 0;
      out = out.replace(w, () => {
        n += 1;
        return m.neu;
      });
      if (n) counts[m.key] = n;
      // longer-word report: raw occurrences that the whole-name rule did not take
      const lines = text.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const raw = (lines[i].match(rawRe(m.old)) || []).length;
        const whole = (lines[i].match(wholeRe(m.old)) || []).length;
        if (raw > whole) longer.push({ file: f, line: i + 1, token: m.old, text: lines[i].trim().slice(0, 120) });
      }
    }
    if (out !== text) edits.push({ file: f, to: renameMap.get(f) || f, counts, text: out });
  }
  return { renames, edits, longer, eureka, nonUtf8 };
}

function printPlan(plan, label) {
  const lines = [];
  lines.push('rename-tool ' + label);
  for (const r of plan.renames) lines.push('  RENAME [' + r.module + '] ' + r.from + ' -> ' + r.to);
  const perModule = {};
  let total = 0;
  for (const e of plan.edits) {
    const parts = Object.keys(e.counts).map((k) => k + '=' + e.counts[k]);
    for (const k of Object.keys(e.counts)) {
      perModule[k] = perModule[k] || { files: 0, hits: 0 };
      perModule[k].files += 1;
      perModule[k].hits += e.counts[k];
      total += e.counts[k];
    }
    lines.push('  EDIT ' + e.file + (e.to !== e.file ? ' (becomes ' + e.to + ')' : '') + ' ' + parts.join(' '));
  }
  for (const l of plan.longer) lines.push('  LONGER ' + l.file + ':' + l.line + ' ' + l.token + ' :: ' + l.text);
  for (const f of plan.eureka) lines.push('  SKIPPED-EUREKA ' + f);
  for (const f of plan.nonUtf8) lines.push('  SKIPPED-NON-UTF8 ' + f);
  for (const k of Object.keys(perModule)) {
    lines.push('  MODULE ' + k + ' files=' + perModule[k].files + ' hits=' + perModule[k].hits);
  }
  lines.push('  TOTAL files=' + plan.edits.length + ' hits=' + total + ' renames=' + plan.renames.length);
  return lines.join('\n') + '\n';
}

function applyPlan(root, plan) {
  // git mv first (so history follows), then rewrite the new paths.
  for (const r of plan.renames) git(root, ['mv', r.from, r.to]);
  for (const e of plan.edits) fs.writeFileSync(path.join(root, e.to), e.text);
}

function parseArgs(argv) {
  const o = { cmd: argv[0], only: null, root: null };
  for (let i = 1; i < argv.length; i++) {
    if (argv[i] === '--only') o.only = argv[++i];
    else if (argv[i] === '--root') o.root = argv[++i];
    else throw new Error('unknown argument: ' + argv[i]);
  }
  return o;
}

function runCli(argv, io) {
  const out = (s) => io.out(s);
  let o;
  try {
    o = parseArgs(argv);
  } catch (e) {
    io.err(e.message + '\n');
    return 1;
  }
  const root = path.resolve(o.root || git(process.cwd(), ['rev-parse', '--show-toplevel']).trim());
  let plan;
  try {
    plan = buildPlan(root, o.only);
  } catch (e) {
    io.err(e.message + '\n');
    return 1;
  }
  if (o.cmd === 'dry-run') {
    out(printPlan(plan, 'dry-run'));
    return plan.eureka.length ? 1 : 0;
  }
  if (o.cmd === 'apply') {
    out(printPlan(plan, 'apply'));
    if (plan.eureka.length) return 1;
    applyPlan(root, plan);
    return 0;
  }
  io.err('usage: selftest | dry-run [--only M] [--root DIR] | apply [--only M] [--root DIR]\n');
  return 1;
}

// ---- self-test ----
function sh(cwd, args) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (r.status !== 0) throw new Error('git ' + args.join(' ') + ': ' + r.stderr);
  return r.stdout;
}
function treeHash(root) {
  const h = crypto.createHash('sha256');
  const files = sh(root, ['ls-files', '--cached', '--others', '--exclude-standard']).split('\n').filter(Boolean).sort();
  for (const f of files) {
    if (!fs.existsSync(path.join(root, f))) continue;
    h.update(f + '\0');
    h.update(fs.readFileSync(path.join(root, f)));
    h.update('\0');
  }
  return h.digest('hex');
}
function write(root, f, t) {
  const p = path.join(root, f);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, t);
}
function makeRepo(extra) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rename389-'));
  sh(root, ['init', '-q']);
  sh(root, ['config', 'user.email', 't@t']);
  sh(root, ['config', 'user.name', 't']);
  sh(root, ['config', 'commit.gpgsign', 'false']);
  write(root, 'lib/core/mva-classifier.cjs', '// mva-classifier.cjs header\nmodule.exports = { classify() {} };\n');
  write(root, 'lib/core/mva-classifier.test.cjs', "require('./mva-classifier.cjs'); // mva-classifier test\n");
  write(root, 'lib/core/mva-budget.cjs', '// mva-budget.cjs\nmodule.exports = {};\n');
  write(root, 'lib/core/mva-budget.test.cjs', "require('./mva-budget.cjs');\n");
  write(root, 'scripts/caller-a.cjs', "const c = require('../lib/core/mva-classifier.cjs');\nconst p = path.join(root, 'lib', 'core', 'mva-budget.cjs');\n");
  write(root, 'scripts/caller-b.cjs', "// uses mva-classifier\nprocess.stdout.write('mva-budget: scanning ' + n + ' items\\n');\n");
  write(root, 'scripts/verify', "sed -n 's/^mva-budget: scanning \\([0-9]*\\) items$/\\1/p'\n");
  write(root, 'scripts/outside.cjs', 'nothing here\n');
  write(root, 'CHANGELOG.md', 'old mva-classifier entry\n');
  write(root, 'docs/2026-01-01-history.md', 'mva-classifier history\n');
  write(root, '.planning/x.md', 'mva-classifier plan text\n');
  if (extra) extra(root);
  sh(root, ['add', '-A']);
  sh(root, ['commit', '-q', '-m', 'init']);
  return root;
}
function capture() {
  const buf = { o: '', e: '' };
  return { buf, io: { out: (s) => (buf.o += s), err: (s) => (buf.e += s) } };
}

function selftest() {
  let pass = 0;
  let fail = 0;
  const ck = (name, cond, detail) => {
    if (cond) {
      pass += 1;
      console.log('ok   selftest ' + name);
    } else {
      fail += 1;
      console.log('FAIL selftest ' + name + (detail ? ' :: ' + detail : ''));
    }
  };
  const cleanup = [];
  try {
    // 1 apply
    const r1 = makeRepo();
    cleanup.push(r1);
    const outsideBefore = fs.readFileSync(path.join(r1, 'scripts/outside.cjs'));
    const c1 = capture();
    const rc1 = runCli(['apply', '--root', r1], c1.io);
    ck('1 apply exit 0', rc1 === 0, c1.buf.e);
    ck('1 files moved by git mv', fs.existsSync(path.join(r1, 'lib/core/venture-sentence-classifier.cjs')) &&
      fs.existsSync(path.join(r1, 'lib/core/venture-sentence-classifier.test.cjs')) &&
      fs.existsSync(path.join(r1, 'lib/core/pyramid-seed-budget.cjs')) &&
      !fs.existsSync(path.join(r1, 'lib/core/mva-classifier.cjs')));
    ck('1 git sees renames', /^R/m.test(sh(r1, ['status', '--porcelain'])));
    const a = fs.readFileSync(path.join(r1, 'scripts/caller-a.cjs'), 'utf8');
    ck('1 require path and path join rewritten',
      a.includes("../lib/core/venture-sentence-classifier.cjs") && a.includes("'pyramid-seed-budget.cjs'"), a);
    const b = fs.readFileSync(path.join(r1, 'scripts/caller-b.cjs'), 'utf8');
    ck('1 comment and output label rewritten',
      b.includes('// uses venture-sentence-classifier') && b.includes("'pyramid-seed-budget: scanning '"), b);
    const v = fs.readFileSync(path.join(r1, 'scripts/verify'), 'utf8');
    ck('1 sed pattern rewritten', v.includes('^pyramid-seed-budget: scanning'), v);
    ck('1 outside file byte equal', outsideBefore.equals(fs.readFileSync(path.join(r1, 'scripts/outside.cjs'))));
    ck('1 excluded files byte equal',
      fs.readFileSync(path.join(r1, 'CHANGELOG.md'), 'utf8') === 'old mva-classifier entry\n' &&
      fs.readFileSync(path.join(r1, 'docs/2026-01-01-history.md'), 'utf8') === 'mva-classifier history\n' &&
      fs.readFileSync(path.join(r1, '.planning/x.md'), 'utf8') === 'mva-classifier plan text\n');

    // 2 dry-run
    const r2 = makeRepo();
    cleanup.push(r2);
    const h0 = treeHash(r2);
    const c2 = capture();
    const rc2 = runCli(['dry-run', '--root', r2], c2.io);
    ck('2 dry-run exit 0', rc2 === 0, c2.buf.e);
    ck('2 tree hash equal after dry-run', treeHash(r2) === h0);
    ck('2 dry-run lists files and counts',
      c2.buf.o.includes('EDIT scripts/caller-a.cjs') && c2.buf.o.includes('classifier=1') &&
      c2.buf.o.includes('RENAME [budget] lib/core/mva-budget.cjs -> lib/core/pyramid-seed-budget.cjs') &&
      /TOTAL files=\d+ hits=\d+ renames=4/.test(c2.buf.o), c2.buf.o);
    ck('2 apply output lists the same EDIT lines as dry-run', (() => {
      const r2b = makeRepo();
      cleanup.push(r2b);
      const ca = capture();
      runCli(['apply', '--root', r2b], ca.io);
      const norm = (s) => s.replace(/^rename-tool .*\n/, '');
      return norm(ca.buf.o) === norm(c2.buf.o);
    })());

    // 3 eureka
    const r3 = makeRepo((root) => write(root, 'lib/eureka-thing.cjs', "require('./mva-classifier.cjs');\n"));
    cleanup.push(r3);
    const e0 = fs.readFileSync(path.join(r3, 'lib/eureka-thing.cjs'));
    const c3 = capture();
    const rc3 = runCli(['apply', '--root', r3], c3.io);
    ck('3 eureka file reported SKIPPED-EUREKA', c3.buf.o.includes('SKIPPED-EUREKA lib/eureka-thing.cjs'), c3.buf.o);
    ck('3 exit 1 when a eureka file holds a token', rc3 === 1);
    ck('3 eureka file byte equal and nothing else written', e0.equals(fs.readFileSync(path.join(r3, 'lib/eureka-thing.cjs'))) &&
      fs.existsSync(path.join(r3, 'lib/core/mva-classifier.cjs')));
    const r3b = makeRepo((root) => write(root, 'lib/eureka-thing.cjs', 'no token here\n'));
    cleanup.push(r3b);
    ck('3 eureka file without a token is fine (exit 0)', runCli(['dry-run', '--root', r3b], capture().io) === 0);

    // 4 longer word
    const r4 = makeRepo((root) => write(root, 'scripts/longer.cjs', "const x = 'mva-classifier-extra';\nconst y = 'xmva-classifier';\nconst z = 'mva-classifier_v2';\nconst ok = 'mva-classifier';\nconst esc = 'a\\nmva-classifier tests';\n"));
    cleanup.push(r4);
    const c4 = capture();
    runCli(['apply', '--root', r4], c4.io);
    const l4 = fs.readFileSync(path.join(r4, 'scripts/longer.cjs'), 'utf8');
    ck('4 longer words reported', (c4.buf.o.match(/LONGER scripts\/longer\.cjs:[123] /g) || []).length === 3, c4.buf.o);
    ck('4 longer words not rewritten, the plain one is',
      l4.includes("'mva-classifier-extra'") && l4.includes("'xmva-classifier'") && l4.includes("'mva-classifier_v2'") &&
      l4.includes("'venture-sentence-classifier'") && l4.includes('a\\nventure-sentence-classifier tests'), l4);

    // 5 --only
    const r5 = makeRepo();
    cleanup.push(r5);
    const budgetCallerBefore = fs.readFileSync(path.join(r5, 'scripts/caller-b.cjs'), 'utf8');
    const c5 = capture();
    const rc5 = runCli(['apply', '--only', 'classifier', '--root', r5], c5.io);
    ck('5 only classifier exit 0', rc5 === 0, c5.buf.e);
    ck('5 classifier renamed, budget not',
      fs.existsSync(path.join(r5, 'lib/core/venture-sentence-classifier.cjs')) && fs.existsSync(path.join(r5, 'lib/core/mva-budget.cjs')));
    const b5 = fs.readFileSync(path.join(r5, 'scripts/caller-b.cjs'), 'utf8');
    ck('5 other module callers keep their tokens', b5.includes("'mva-budget: scanning '") && b5.includes('// uses venture-sentence-classifier'));
    ck('5 budget-only file part byte equal', budgetCallerBefore.split('\n')[1] === b5.split('\n')[1]);
    const r5b = makeRepo();
    cleanup.push(r5b);
    // single applies in the order of Task 2, committing between them (the tool reads tracked files)
    for (const k of ['classifier', 'rule-linter', 'budget', 'agent-contract', 'dispatcher']) {
      const rc = runCli(['apply', '--only', k, '--root', r5b], capture().io);
      if (rc !== 0) ck('5 single apply ' + k, false);
      sh(r5b, ['add', '-A']);
      sh(r5b, ['commit', '-q', '-m', k, '--allow-empty']);
    }
    const r5c = makeRepo();
    cleanup.push(r5c);
    runCli(['apply', '--root', r5c], capture().io);
    ck('5 five single applies equal one full apply', treeHash(r5b) === treeHash(r5c));
    const c5u = capture();
    const rc5u = runCli(['apply', '--only', 'nonsense', '--root', r5c], c5u.io);
    ck('5 unknown module exits 1', rc5u === 1 && /unknown module/.test(c5u.buf.e));
  } catch (e) {
    fail += 1;
    console.log('FAIL selftest threw :: ' + (e && e.stack ? e.stack : e));
  } finally {
    for (const d of cleanup) {
      try {
        fs.rmSync(d, { recursive: true, force: true });
      } catch (_) {
        /* ignore */
      }
    }
  }
  console.log('rename-tool selftest: ' + pass + ' passed, ' + fail + ' failed');
  return fail === 0 ? 0 : 1;
}

module.exports = { MODULES, buildPlan, runCli, isSkippedPath, isEureka, wholeRe };

if (require.main === module) {
  const argv = process.argv.slice(2);
  if (argv[0] === 'selftest') {
    process.exit(selftest());
  }
  const rc = runCli(argv, { out: (s) => process.stdout.write(s), err: (s) => process.stderr.write(s) });
  process.exit(rc);
}
