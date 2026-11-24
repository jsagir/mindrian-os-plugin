#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 400 plan 11 (AX-01, AX-02): the flagged level wording and the wicked cut-off.
 * Legs W1 to W5: the level wording v2 ships behind MINDRIAN_LEVEL_WORDING=v2; the default v1 and the
 * Axis 1 table of references/methodology/problem-types.md stay unchanged; suggest_next carries
 * problem_level_test only with the flag on.
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

  if (savedFlag === undefined) delete process.env.MINDRIAN_LEVEL_WORDING; else process.env.MINDRIAN_LEVEL_WORDING = savedFlag;
  console.log('test-400-problem-axes-wording: ' + passed + ' passed, ' + failed + ' failed');
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error('FAIL: ' + (e && e.stack ? e.stack : e));
  process.exit(1);
});
