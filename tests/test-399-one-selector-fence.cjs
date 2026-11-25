#!/usr/bin/env node
'use strict';
// Phase 399-08: the one-selector fence (I-07). The decision advisor is data and a lookup. It is not a second
// selector, resolver, ranker or posture authority. Static legs O1 to O3 scan non-comment source; O4 proves that an
// absent table and an off switch are the same floor; O5 proves the O2 scan bites (mutation control).
// Node built-ins only. No network.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

delete process.env.MINDRIAN_DECISION_ADVISOR;
delete process.env.MINDRIAN_DECISION_ADVISOR_TABLE;

const ROOT = path.resolve(__dirname, '..');
const ADV_DIR = path.join(ROOT, 'lib', 'core', 'decision-advisor');
const SHORTLIST = path.join(ADV_DIR, 'shortlist.cjs');

let failed = 0;
let passed = 0;
function check(label, fn) {
  try { fn(); passed += 1; console.log('ok: ' + label); }
  catch (e) { failed += 1; console.log('FAIL: ' + label + ' -- ' + (e && e.message ? e.message : String(e))); }
}

// Comment stripping, the idiom of tests/test-237-one-authority-fence.cjs: full-line comments, then trailing // comments.
function stripComments(src) {
  const out = [];
  let inBlock = false;
  for (const raw of String(src).split('\n')) {
    let line = raw;
    if (inBlock) {
      const end = line.indexOf('*/');
      if (end === -1) continue;
      inBlock = false;
      line = line.slice(end + 2);
    }
    const t = line.trim();
    if (t.startsWith('//')) continue;
    if (t.startsWith('/*')) {
      if (t.indexOf('*/') === -1) inBlock = true;
      continue;
    }
    if (t.startsWith('*')) continue;
    out.push(line.replace(/\s\/\/.*$/, ''));
  }
  return out.join('\n');
}

function requireTargets(src) {
  const code = stripComments(src);
  const out = [];
  const re = /require\(\s*(['"`])([^'"`]+)\1\s*\)/g;
  let m;
  while ((m = re.exec(code)) !== null) out.push(m[2]);
  return out;
}

function listFiles(dir, exts, acc) {
  const out = acc || [];
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (_e) { return out; }
  for (const e of entries) {
    if (e.name === 'node_modules' || e.name === '.git') continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) listFiles(full, exts, out);
    else if (exts.indexOf(path.extname(e.name)) !== -1) out.push(full);
  }
  return out;
}

const SCAN_EXTS = ['.cjs', '.js', '.mjs', '.ts'];
const rel = (f) => path.relative(ROOT, f).split(path.sep).join('/');

// O1: who requires shortlist.cjs.
const O1_ALLOWED = new Set([
  'lib/core/feyminto/next-move.cjs',
  'lib/workflow/command-resolver.cjs',
  'lib/core/decision-advisor/present.cjs',
  'lib/core/navigation/selection-log.cjs', // plan 399-09, allowed in advance
]);

function shortlistReaders(files) {
  const hits = [];
  for (const f of files) {
    let src;
    try { src = fs.readFileSync(f, 'utf8'); } catch (_e) { continue; }
    if (src.indexOf('shortlist') === -1) continue;
    for (const target of requireTargets(src)) {
      if (!target.startsWith('.')) continue;
      const resolved = path.resolve(path.dirname(f), target);
      if (resolved === SHORTLIST) { hits.push(rel(f)); break; }
    }
  }
  return hits.sort();
}

check('O1 only the selector, the resolver, the presenter and the logger require shortlist.cjs (lib/, hooks/, bin/)', () => {
  const files = ['lib', 'hooks', 'bin'].flatMap((d) => listFiles(path.join(ROOT, d), SCAN_EXTS));
  assert.ok(files.length > 200, 'fixture: the scan covers the tree (' + files.length + ' files)');
  const hits = shortlistReaders(files);
  assert.ok(hits.indexOf('lib/core/feyminto/next-move.cjs') !== -1, 'positive control: the selector is found');
  assert.ok(hits.indexOf('lib/workflow/command-resolver.cjs') !== -1, 'positive control: the resolver is found');
  const extra = hits.filter((h) => !O1_ALLOWED.has(h));
  assert.deepEqual(extra, [], 'unexpected readers of the advisor table: ' + extra.join(', '));
});

// O2: the advisor modules import no selector input and no other authority.
const FORBIDDEN_BASENAMES = [
  'capability.cjs', 'command-sources.cjs', 'section-ruling-candidates.cjs', 'f-selector-ranker.cjs',
  'navigation-engine.cjs', 'navigation-engine-offer.cjs', 'recipe-maps.cjs', 'arbitration.cjs', 'command-resolver.cjs',
];
function forbiddenImports(src) {
  return requireTargets(src).filter((t) => FORBIDDEN_BASENAMES.indexOf(path.basename(t)) !== -1);
}
function advisorFiles() { return listFiles(ADV_DIR, ['.cjs', '.js', '.mjs', '.ts']); }

check('O2 no advisor module requires a selector input, a posture authority or the resolver', () => {
  const files = advisorFiles();
  assert.ok(files.length >= 5, 'fixture: the advisor modules exist (' + files.length + ')');
  for (const f of files) {
    assert.deepEqual(forbiddenImports(fs.readFileSync(f, 'utf8')), [], rel(f));
  }
});

// O3: no exported name is a decision verb.
check('O3 no export of an advisor module is named decide, compose*, select*, pick* or resolve*', () => {
  const bad = /^(decide|compose.*|select.*|pick.*|resolve.*)$/i;
  let seen = 0;
  for (const f of advisorFiles()) {
    let mod;
    try { mod = require(f); } catch (_e) { continue; } // a provider with no key still has to load; skip only a hard failure
    seen += 1;
    const names = mod && (typeof mod === 'object' || typeof mod === 'function') ? Object.keys(mod) : [];
    for (const n of names) assert.equal(bad.test(n), false, rel(f) + ' exports ' + n);
  }
  assert.ok(seen >= 4, 'fixture: at least 4 advisor modules loaded (' + seen + ')');
});

// O4: absence and off are the same floor for the selector output.
const NM = require(path.join(ROOT, 'lib', 'core', 'feyminto', 'next-move.cjs'));
const REG = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'command-registry.json'), 'utf8')).commands.filter((c) => c && typeof c.command === 'string');
const strip = (n) => String(n).replace(/^\/mos:/, '');
const JOB = 'validate-idea';
const serves = (name) => { const e = REG.find((c) => strip(c.command) === name); return !!(e && Array.isArray(e.serves_jtbd) && e.serves_jtbd.indexOf(JOB) !== -1); };
const ALL = REG.map((c) => strip(c.command));
const SERVING = ALL.filter(serves);
const [A, B, C, X] = SERVING;
const D = ALL.filter((n) => !serves(n))[0];
const capabilityFor = () => ({ known: true, cli: 'runnable', mcp: 'runnable', label: 'runnable (test)' });
const src = (contract, table) => ({ contract: { names: contract || [] }, navigator_table: { names: table || [] } });
const face = (names) => ({ asked: true, commands: names.map((n) => ({ name: n, cli: 'runnable', mcp: 'runnable' })) });
function compose(extra) {
  return NM.composeNextMove(Object.assign({ surface: 'mcp', face: { asked: false, commands: [] }, ledgerCandidates: null, attempted: [], need: {}, capabilityFor }, extra));
}
function withEnv(env, fn) {
  const saved = {};
  Object.keys(env).forEach((k) => { saved[k] = process.env[k]; if (env[k] === null) delete process.env[k]; else process.env[k] = env[k]; });
  try { return fn(); } finally { Object.keys(saved).forEach((k) => { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }); }
}
const sansAdvisor = (m) => { const o = Object.assign({}, m); delete o.advisor; return JSON.stringify(o); };
const MISSING = path.join(os.tmpdir(), 'no-such-advisor-table-399-08.json');

const INPUTS = [
  { sources: src([A], [A, B]), face: face([B, A]) },
  { sources: src([B], [A]), face: face([A]) },
  { sources: src([A, B], [C]), face: face([C, B, A]) },
  { sources: src([], [A, B, C]), face: face([]) },
  { sources: src([A, X], [D]), face: face([X]) },
  { sources: src([A], []), face: face([A, D]) },
];

check('O4 an absent table gives the selector output of the advisor-off floor, with and without a job', () => {
  assert.ok(A && B && C && X && D, 'fixture: enough commands');
  INPUTS.forEach((base, i) => {
    for (const withJob of [false, true]) {
      const inputs = Object.assign({}, base, withJob ? { jobId: JOB, jobFit: {} } : {});
      const off = withEnv({ MINDRIAN_DECISION_ADVISOR: 'off' }, () => compose(inputs));
      const absent = withEnv({ MINDRIAN_DECISION_ADVISOR: 'on', MINDRIAN_DECISION_ADVISOR_TABLE: MISSING }, () => compose(inputs));
      assert.equal(sansAdvisor(absent), sansAdvisor(off), 'input ' + i + (withJob ? ' with a job' : ' no job'));
      assert.equal(Object.prototype.hasOwnProperty.call(off, 'advisor'), false, 'off carries no advisor key');
      if (!withJob) assert.equal(JSON.stringify(absent), JSON.stringify(off), 'no job: whole output equal, input ' + i);
    }
    // The switch wins over the test seam: off with a missing table equals off with the default table.
    const inputs = Object.assign({ jobId: JOB, jobFit: {} }, base);
    const offMissing = withEnv({ MINDRIAN_DECISION_ADVISOR: 'off', MINDRIAN_DECISION_ADVISOR_TABLE: MISSING }, () => compose(inputs));
    const offDefault = withEnv({ MINDRIAN_DECISION_ADVISOR: 'off', MINDRIAN_DECISION_ADVISOR_TABLE: null }, () => compose(inputs));
    assert.equal(JSON.stringify(offMissing), JSON.stringify(offDefault), 'off ignores the table, input ' + i);
  });
});

// O5: mutation control. A scratch copy of present.cjs with one injected require of a ranker must be caught by the O2 scan.
check('O5 mutation control: an injected require of the ranker in a copy of present.cjs is caught; a comment mention is not', () => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'test-399-08-fence-'));
  try {
    const original = fs.readFileSync(path.join(ADV_DIR, 'present.cjs'), 'utf8');
    assert.deepEqual(forbiddenImports(original), [], 'control: the real file is clean');
    const mutated = path.join(scratch, 'present.cjs');
    fs.writeFileSync(mutated, original + "\nconst injectedRanker = require('../../workflow/f-selector-ranker.cjs');\n");
    assert.deepEqual(forbiddenImports(fs.readFileSync(mutated, 'utf8')), ['../../workflow/f-selector-ranker.cjs']);
    const commented = path.join(scratch, 'present-comment.cjs');
    fs.writeFileSync(commented, original + "\n// const x = require('../../workflow/f-selector-ranker.cjs');\n");
    assert.deepEqual(forbiddenImports(fs.readFileSync(commented, 'utf8')), []);
    // The O1 reader scan bites too: a scratch file that requires shortlist.cjs is reported.
    const reader = path.join(scratch, 'reader.cjs');
    fs.writeFileSync(reader, "const s = require(" + JSON.stringify(path.relative(scratch, SHORTLIST)) + ");\n");
    assert.deepEqual(shortlistReaders([reader]).length, 1);
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
});

console.log(passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
