#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 400 plan 11 (AX-01, AX-02): the flagged level wording and the wicked cut-off.
 * Legs W1 to W5: the level wording v2 ships behind MINDRIAN_LEVEL_WORDING=v2; the default v1 and the
 * Axis 1 table of references/methodology/problem-types.md stay unchanged; suggest_next carries
 * problem_level_test only with the flag on.
 * Legs W6 to W10: a wicked probability becomes yes or no only through a stored fitted cut-off (null with no
 * fit, never a raw 0.5 cut); scripts/derive-wicked-cutoff.cjs fits it on a synthetic sample and writes only
 * the value, counts and file hashes; a DO-NOT-OPEN path is refused by name.
 *
 * Bare node script; exits non-zero on any failure. Hyphens only.
 *
 * Run: node tests/test-400-problem-axes-wording.cjs
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const BASE = 'c1e496ae8';
const DATA_PATH = path.join(ROOT, 'data', 'problem-axes-wording.json');
const TYPES_REL = 'references/methodology/problem-types.md';

let passed = 0;
let failed = 0;
async function check(label, fn) {
  try {
    await fn();
    passed += 1;
    console.log('  ok - ' + label);
  } catch (e) {
    failed += 1;
    console.log('  FAIL - ' + label + '\n    ' + String(e && e.stack ? e.stack : e).split('\n').slice(0, 6).join('\n    '));
  }
}

function git(args) {
  const r = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  if (r.status !== 0) throw new Error('git ' + args.join(' ') + ' failed: ' + r.stderr);
  return r.stdout;
}

// The signal cell of the Well-defined row of the Axis 1 table.
function wellDefinedSignal(content) {
  const line = content.split('\n').find((l) => l.startsWith('| **Well-defined** |'));
  if (!line) return null;
  return line.split('|').map((c) => c.trim()).filter(Boolean)[1];
}

// The real parseRoutingTable source of lib/mcp/brain-router.cjs, run on given file content.
function routingTableOf(content) {
  const src = fs.readFileSync(path.join(ROOT, 'lib', 'mcp', 'brain-router.cjs'), 'utf8');
  const start = src.indexOf('function parseRoutingTable() {');
  const end = src.indexOf('/** @type {Map<string, string[]>|null} */', start);
  assert.ok(start !== -1 && end > start, 'parseRoutingTable source found');
  const { KNOWN_METHODOLOGIES } = require(path.join(ROOT, 'lib', 'mcp', 'brain-router.cjs'));
  // eslint-disable-next-line no-new-func
  const make = new Function('path', '__dirname', 'safeReadFile', 'KNOWN_METHODOLOGIES', src.slice(start, end) + '\nreturn parseRoutingTable;');
  const fn = make(path, path.join(ROOT, 'lib', 'mcp'), () => content, KNOWN_METHODOLOGIES);
  return JSON.stringify(Array.from(fn().entries()));
}

function makeServer() {
  const registered = [];
  return {
    registered,
    tool(name, _d, a, b) { registered.push({ name, handler: typeof b === 'function' ? b : a }); },
    registerTool(name, _c, handler) { registered.push({ name, handler }); },
    server: { getClientCapabilities() { return {}; } },
  };
}

async function main() {
  const savedFlag = process.env.MINDRIAN_LEVEL_WORDING;
  delete process.env.MINDRIAN_LEVEL_WORDING;
  const typesNow = fs.readFileSync(path.join(ROOT, TYPES_REL), 'utf8');
  const typesBase = git(['show', BASE + ':' + TYPES_REL]);

  await check('W1 the data file holds the level wording block; v1 equals the Well-defined signal cell; v2 holds the F-07 wording', () => {
    assert.ok(fs.existsSync(DATA_PATH), 'data/problem-axes-wording.json exists');
    const d = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
    assert.equal(d.schema, 'mos.problem-axes-wording/1');
    const lw = d.level_wording;
    assert.equal(lw.flag_env, 'MINDRIAN_LEVEL_WORDING');
    assert.equal(lw.default_version, 'v1');
    assert.deepEqual(Object.keys(lw.versions), ['v1', 'v2']);
    assert.equal(lw.versions.v1.well_defined, wellDefinedSignal(typesNow));
    assert.equal(lw.versions.v1.well_defined, 'Clear parameters, specific constraints');
    assert.equal(lw.versions.v1.status, 'shipped');
    assert.equal(lw.versions.v2.well_defined, 'A specific measurable target, or a closed set of known options with known measures. This holds even when the parties dispute it. A general wish to improve does not count.');
    assert.equal(lw.versions.v2.wicked_note, 'A well-defined problem can also be wicked: when the target is disputed and each fix shifts the problem.');
    assert.equal(lw.versions.v2.status, 'provisional');
    assert.equal(lw.versions.v2.basis, 'F-07, fitted on the same cases; fresh cases deferred');
    assert.ok(/F-06/.test(d._note) && /F-07/.test(d._note) && /O-02/.test(d._note), '_note names F-06, F-07 and O-02');
    assert.equal(new RegExp('[\\u2013\\u2014]').test(fs.readFileSync(DATA_PATH, 'utf8')), false);
  });

  await check('W2 levelWording reads the env at call time: v1 by default and for any other value, v2 only for v2', () => {
    const A = require(path.join(ROOT, 'lib', 'core', 'problem-axes.cjs'));
    assert.equal(A.LEVEL_WORDING_FLAG, 'MINDRIAN_LEVEL_WORDING');
    const d = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8')).level_wording.versions;
    delete process.env.MINDRIAN_LEVEL_WORDING;
    assert.deepEqual(A.levelWording(), { version: 'v1', well_defined: d.v1.well_defined, wicked_note: null, status: 'shipped' });
    process.env.MINDRIAN_LEVEL_WORDING = 'v2';
    assert.deepEqual(A.levelWording(), { version: 'v2', well_defined: d.v2.well_defined, wicked_note: d.v2.wicked_note, status: 'provisional' });
    for (const other of ['', 'V2', 'v3', 'v1', ' v2', 'true']) {
      process.env.MINDRIAN_LEVEL_WORDING = other;
      assert.equal(A.levelWording().version, 'v1', 'value ' + JSON.stringify(other) + ' gives v1');
    }
    delete process.env.MINDRIAN_LEVEL_WORDING;
  });

  await check('W3 the Axis 1 table lines 11-18 are byte-identical to base and the routing table parse is unchanged', () => {
    const now = typesNow.split('\n').slice(10, 18).join('\n');
    const base = typesBase.split('\n').slice(10, 18).join('\n');
    assert.equal(now, base);
    assert.ok(now.indexOf('| **Well-defined** | Clear parameters, specific constraints |') !== -1);
    const mapNow = routingTableOf(typesNow);
    const mapBase = routingTableOf(typesBase);
    assert.equal(mapNow, mapBase);
    assert.ok(JSON.parse(mapNow).length >= 12, 'the parse sees the 12 routing cells');
    // Every line that starts with "|" is unchanged: the new paragraph adds no table row.
    const pipes = (c) => c.split('\n').filter((l) => l.startsWith('|')).join('\n');
    assert.equal(pipes(typesNow), pipes(typesBase));
    assert.ok(typesNow.indexOf('Flagged wording (Phase 400, provisional): with MINDRIAN_LEVEL_WORDING=v2 the suggest_next reply carries problem_level_test') !== -1, 'the flagged paragraph is present');
  });

  await check('W4 suggest_next has no problem_level_test by default; with v2 it carries the provisional test; no raw number', async () => {
    const H = require('./helpers/isolated-home-36925.cjs');
    const PR = require(path.join(ROOT, 'lib', 'core', 'decision-advisor', 'present.cjs'));
    const iso = H.mkIsolatedHome('400lw');
    const born = H.birthFixtureRoom({ iso, slug: 'lw-sug', vname: 'Quokka Labs', ventureText: 'Quokka Labs onboarding platform' });
    if (!born || born.ok !== true) throw new Error('fixture birth failed');
    const roomDir = fs.realpathSync(born.roomDir);
    delete process.env.CLAUDE_ACTIVE_ROOM;
    const SESSION = 'test-400-lw-' + Date.now() + '-' + Math.random().toString(36).slice(2);
    require(path.join(ROOT, 'lib', 'core', 'session-binding.cjs')).writeSessionBinding(SESSION, { bound: ['lw-sug'], primary: 'lw-sug', sticky: false }, { home: iso.roomsHome });
    const server = makeServer();
    require(path.join(ROOT, 'lib', 'mcp', 'tools', 'sensors.cjs')).register(server, { fallbackRoomDir: roomDir });
    const suggestNext = server.registered.find((r) => r.name === 'suggest_next').handler;
    const pull = async () => JSON.parse((await suggestNext({}, { sessionId: SESSION })).content[0].text);

    delete process.env.MINDRIAN_LEVEL_WORDING;
    const off = await pull();
    assert.equal(Object.prototype.hasOwnProperty.call(off, 'problem_level_test'), false);
    process.env.MINDRIAN_LEVEL_WORDING = 'v1';
    assert.equal(Object.prototype.hasOwnProperty.call(await pull(), 'problem_level_test'), false);
    process.env.MINDRIAN_LEVEL_WORDING = 'v2';
    const on = await pull();
    delete process.env.MINDRIAN_LEVEL_WORDING;
    const d = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8')).level_wording.versions.v2;
    assert.deepEqual(on.problem_level_test, { version: 'v2', well_defined: d.well_defined, wicked_note: d.wicked_note, status: 'provisional' });
    assert.equal(PR.hasRawNumber(on.problem_level_test), false);
    // The flag adds one key and changes no other key.
    const strip = (o) => { const c = Object.assign({}, o); delete c.problem_level_test; return Object.keys(c); };
    assert.deepEqual(strip(on), Object.keys(off));
  });

  await check('W5 lib/core/problem-axes.cjs has 0 deleted lines against base', () => {
    for (const f of ['lib/core/problem-axes.cjs', TYPES_REL]) {
      const out = git(['diff', '--numstat', BASE, '--', f]).trim();
      if (!out) continue;
      const del = Number(out.split(/\s+/)[1]);
      assert.equal(del, 0, f + ' deleted lines: ' + out);
    }
  });

  // ---------------------------------------------------------------------
  // Legs W6 to W10 (AX-02, F-06): the wicked cut-off accessor and its dev-time fit.
  const SCRIPT = path.join(ROOT, 'scripts', 'derive-wicked-cutoff.cjs');
  const FIX = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests', 'fixtures', '400', 'wicked-fit-sample.json'), 'utf8'));
  const os = require('node:os');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'test-400-wicked-'));
  const answersFile = path.join(tmp, 'answers-sample.json');
  const labelsFile = path.join(tmp, 'labels-sample.md');
  fs.writeFileSync(answersFile, JSON.stringify(FIX.answers));
  fs.writeFileSync(labelsFile, FIX.labels.join('\n') + '\n');
  const run = (args, env) => spawnSync(process.execPath, [SCRIPT].concat(args), {
    cwd: ROOT, encoding: 'utf8', env: Object.assign({}, process.env, env || {}),
  });
  const scratchRoot = (block) => {
    const r = fs.mkdtempSync(path.join(tmp, 'root-'));
    fs.mkdirSync(path.join(r, 'data'));
    const d = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
    if (block) d.wicked_cutoff = block;
    fs.writeFileSync(path.join(r, 'data', 'problem-axes-wording.json'), JSON.stringify(d, null, 2) + '\n');
    return r;
  };

  await check('W6 with the block not_fitted every probability gives null; a bad p gives null in every state', () => {
    const A = require(path.join(ROOT, 'lib', 'core', 'problem-axes.cjs'));
    const notFitted = { state: 'not_fitted', value: null };
    for (const p of [0, 0.49, 0.5, 0.51, 1]) {
      assert.equal(A.wickedFromProbability(p, { cutoff: notFitted }), null, 'p ' + p);
    }
    const shipped = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8')).wicked_cutoff;
    if (shipped.state !== 'fitted') {
      for (const p of [0, 0.49, 0.5, 0.51, 1]) assert.equal(A.wickedFromProbability(p), null, 'shipped block, p ' + p);
    }
    const fitted = { state: 'fitted', value: 0.83 };
    for (const bad of ['0.9', NaN, -0.01, 1.01, Infinity, null, undefined, {}, true]) {
      assert.equal(A.wickedFromProbability(bad, { cutoff: notFitted }), null);
      assert.equal(A.wickedFromProbability(bad, { cutoff: fitted }), null);
    }
    // A fitted block with a value outside 0..1 or a non-number is not a cut-off.
    for (const v of [null, 1.2, -0.1, '0.8', NaN]) {
      assert.equal(A.wickedFromProbability(0.9, { cutoff: { state: 'fitted', value: v } }), null);
    }
  });

  await check('W7 with a fitted cut-off 0.83, p at or above gives true and p below gives false', () => {
    const A = require(path.join(ROOT, 'lib', 'core', 'problem-axes.cjs'));
    const cutoff = { state: 'fitted', value: 0.83 };
    assert.equal(A.wickedFromProbability(0.83, { cutoff }), true);
    assert.equal(A.wickedFromProbability(0.9, { cutoff }), true);
    assert.equal(A.wickedFromProbability(0.8, { cutoff }), false);
    assert.equal(A.wickedFromProbability(0.5, { cutoff }), false);
  });

  await check('W8 --dry-run on the synthetic sample prints the hand-computed value and counts; tie rules hold', () => {
    const r = run(['--answers', answersFile, '--labels', labelsFile, '--dry-run']);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const e = FIX._expected;
    const line = 'wicked cut-off: value ' + e.value + ' cases ' + e.cases + ' wicked_yes ' + e.wicked_yes + ' false_yes ' + e.false_yes + ' missed ' + e.missed;
    assert.ok(r.stdout.indexOf(line) !== -1, r.stdout);
    // The dry run writes nothing.
    assert.equal(JSON.parse(fs.readFileSync(DATA_PATH, 'utf8')).wicked_cutoff.state, 'not_fitted');
    // The pure fit: ties take the widest gap, then the lower candidate.
    const S = require(SCRIPT);
    const wide = S.fitCutoff([{ p: 0.2, yes: false }, { p: 0.4, yes: true }, { p: 0.5, yes: false }, { p: 0.9, yes: true }]);
    // 0.3 (gap 0.2) and 0.7 (gap 0.4) give 1 error each; 0.7 sits in the wider gap.
    assert.deepEqual(wide, { value: 0.7, false_yes: 0, missed: 1 });
    const lower = S.fitCutoff([{ p: 0.2, yes: false }, { p: 0.4, yes: true }, { p: 0.6, yes: false }, { p: 0.8, yes: true }]);
    // 0.3 and 0.7 give 1 error each and the same gap 0.2; the lower candidate wins.
    assert.deepEqual(lower, { value: 0.3, false_yes: 1, missed: 0 });
    assert.equal(S.fitCutoff([{ p: 0.5, yes: true }]), null, 'one distinct value gives no candidate');
  });

  await check('W9 --write on a scratch root writes the fitted block with counts and file hashes only', () => {
    const r0 = scratchRoot(null);
    const r = run(['--answers', answersFile, '--labels', labelsFile, '--write'], { MINDRIAN_APPLY_ROOT: r0 });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const raw = fs.readFileSync(path.join(r0, 'data', 'problem-axes-wording.json'), 'utf8');
    const d = JSON.parse(raw);
    const b = d.wicked_cutoff;
    const e = FIX._expected;
    assert.deepEqual(Object.keys(b), ['state', 'value', 'fitted_on', 'sources', 'status', 'rule']);
    assert.equal(b.state, 'fitted');
    assert.equal(b.value, e.value);
    assert.deepEqual(b.fitted_on, { cases: e.cases, wicked_yes: e.wicked_yes, false_yes: e.false_yes, missed: e.missed });
    const sha = (f) => require('node:crypto').createHash('sha256').update(fs.readFileSync(f)).digest('hex');
    assert.deepEqual(b.sources, [{ name: 'answers-sample.json', sha256: sha(answersFile) }, { name: 'labels-sample.md', sha256: sha(labelsFile) }]);
    assert.equal(b.status, 'provisional');
    assert.equal(b.rule, JSON.parse(fs.readFileSync(DATA_PATH, 'utf8')).wicked_cutoff.rule);
    // The level wording block is kept.
    assert.deepEqual(d.level_wording, JSON.parse(fs.readFileSync(DATA_PATH, 'utf8')).level_wording);
    // No case id, text or probability is written.
    assert.equal(/Q\d+/.test(raw), false, 'no case id');
    assert.equal(raw.indexOf('fixture sentence alpha'), -1, 'no text');
    for (const id of Object.keys(FIX.answers.answers)) {
      const p = FIX.answers.answers[id].wicked_p;
      assert.equal(new RegExp('[^0-9.]' + String(p).replace('.', '\\.') + '[^0-9]').test(raw), false, 'no probability ' + p);
    }
    // The accessor reads a fitted block through the same rule.
    const A = require(path.join(ROOT, 'lib', 'core', 'problem-axes.cjs'));
    assert.equal(A.wickedFromProbability(0.7, { cutoff: b }), true);
    assert.equal(A.wickedFromProbability(0.6, { cutoff: b }), false);
    // --check passes on the fitted scratch block.
    assert.equal(run(['--check'], { MINDRIAN_APPLY_ROOT: r0 }).status, 0);
  });

  await check('W10 a DO-NOT-OPEN path exits 2 before any read; --check is 0 for both states and 1 for a bad fitted value', () => {
    const forbidden = path.join(tmp, 'labels-DO-NOT-OPEN.md');
    let r = run(['--answers', answersFile, '--labels', forbidden, '--dry-run']);
    assert.equal(r.status, 2, r.stdout + r.stderr);
    assert.equal(fs.existsSync(forbidden), false);
    r = run(['--answers', path.join(tmp, 'DO-NOT-OPEN', 'answers.json'), '--labels', labelsFile, '--dry-run']);
    assert.equal(r.status, 2, r.stdout + r.stderr);
    // The shipped repo block (not_fitted) passes.
    assert.equal(run(['--check']).status, 0);
    assert.equal(run(['--check'], { MINDRIAN_APPLY_ROOT: scratchRoot({ state: 'not_fitted', value: null, fitted_on: null, sources: null, status: 'provisional', rule: 'r' }) }).status, 0);
    const bad = { state: 'fitted', value: 1.5, fitted_on: { cases: 1, wicked_yes: 1, false_yes: 0, missed: 0 }, sources: [], status: 'provisional', rule: 'r' };
    assert.equal(run(['--check'], { MINDRIAN_APPLY_ROOT: scratchRoot(bad) }).status, 1);
    // A not_fitted block that still carries a value is not honest.
    assert.equal(run(['--check'], { MINDRIAN_APPLY_ROOT: scratchRoot({ state: 'not_fitted', value: 0.5, fitted_on: null, sources: null, status: 'provisional', rule: 'r' }) }).status, 1);
  });

  fs.rmSync(tmp, { recursive: true, force: true });

  if (savedFlag === undefined) delete process.env.MINDRIAN_LEVEL_WORDING; else process.env.MINDRIAN_LEVEL_WORDING = savedFlag;
  console.log('test-400-problem-axes-wording: ' + passed + ' passed, ' + failed + ' failed');
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error('FAIL: ' + (e && e.stack ? e.stack : e));
  process.exit(1);
});
