#!/usr/bin/env node
// Phase 390 plan 03: self-test of tests/helpers/390-removal-check.cjs and of the removal-test template.
// Each arm plants data and shows that one failure kind of the helper can fire, so a later removal test cannot pass by accident.
// Needles are built by concatenation so this file never holds its own needle in one piece.
'use strict';
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert');

const root = path.resolve(__dirname, '..');
const SELF = 'tests/test-390-removal-helper.cjs';
const TEMPLATE = '.planning/phases/390-recalibrate-or-cut-stale-surfaces-keep-recalibrate-cut-table/390-removal-test.template.cjs';
let failed = 0;

function check(name, fn) {
  try {
    fn();
    console.log('ok   ' + name);
  } catch (e) {
    failed++;
    console.log('FAIL ' + name + ': ' + e.message);
  }
}

// The helper is loaded lazily so a missing helper fails every arm, not the whole file at load time.
function helper() {
  return require('./helpers/390-removal-check.cjs').checkRemoval;
}

const NEEDLE = 'zeta' + '-widget';
const NEEDLE_B = 'Make' + 'Widget';

function synth(files) {
  // files: { path: string | Buffer }
  const tracked = Object.keys(files);
  const read = (p) => {
    if (!(p in files)) return null;
    const v = files[p];
    return Buffer.isBuffer(v) ? v : Buffer.from(v, 'utf8');
  };
  return { tracked, read };
}

check('H1 a clean synthetic tree gives no failure', () => {
  const s = synth({ 'a.js': 'hello', 'keep.js': 'stay' });
  const r = helper()({ ...s, root: '/nowhere', paths: ['gone.js'], names: [NEEDLE], survivors: ['keep.js'], self: SELF });
  assert.deepStrictEqual(r.failures, []);
});

check('H2 a path that is still tracked gives TRACKED', () => {
  const s = synth({ 'gone.js': 'x', 'a.js': 'y' });
  const r = helper()({ ...s, root: '/nowhere', paths: ['gone.js'], names: [], survivors: [], self: SELF });
  assert.deepStrictEqual(r.failures, ['TRACKED gone.js']);
});

check('H3 a needle in a tracked file outside the allowed set gives NAMED', () => {
  const s = synth({ 'src/b.js': 'call ' + NEEDLE + ' now', 'c.js': 'clean' });
  const r = helper()({ ...s, root: '/nowhere', paths: [], names: [NEEDLE], survivors: [], self: SELF });
  assert.deepStrictEqual(r.failures, ['NAMED ' + NEEDLE + ' in src/b.js']);
});

check('H4 the needle only under .planning/ and in CHANGELOG.md gives no failure', () => {
  const s = synth({ '.planning/x/y.md': NEEDLE, 'CHANGELOG.md': NEEDLE + ' removed', 'a.js': 'clean' });
  const r = helper()({ ...s, root: '/nowhere', paths: [], names: [NEEDLE], survivors: [], self: SELF });
  assert.deepStrictEqual(r.failures, []);
});

check('H5 the needle only in the file named by self gives no failure', () => {
  const s = synth({ [SELF]: NEEDLE, 'a.js': 'clean' });
  const r = helper()({ ...s, root: '/nowhere', paths: [], names: [NEEDLE], survivors: [], self: SELF });
  assert.deepStrictEqual(r.failures, []);
});

check('H6 a survivor that is not tracked gives SURVIVOR-MISSING', () => {
  const s = synth({ 'a.js': 'clean' });
  const r = helper()({ ...s, root: '/nowhere', paths: ['gone.js'], names: [], survivors: ['keep.js'], self: SELF });
  assert.deepStrictEqual(r.failures, ['SURVIVOR-MISSING keep.js']);
});

check('H7 a survivorText entry whose text is not in the file gives SURVIVOR-TEXT-MISSING', () => {
  const s = synth({ 'keep.html': 'some page' });
  const ok = helper()({ ...s, root: '/nowhere', paths: ['gone.js'], names: [], survivors: [], survivorText: [{ path: 'keep.html', text: 'some page' }], self: SELF });
  assert.deepStrictEqual(ok.failures, []);
  const r = helper()({ ...s, root: '/nowhere', paths: ['gone.js'], names: [], survivors: [], survivorText: [{ path: 'keep.html', text: 'other text' }], self: SELF });
  assert.deepStrictEqual(r.failures, ['SURVIVOR-TEXT-MISSING keep.html']);
});

check('H8 empty paths and empty names give EMPTY-CHECK', () => {
  const s = synth({ 'a.js': 'clean' });
  const r = helper()({ ...s, root: '/nowhere', paths: [], names: [], survivors: ['a.js'], self: SELF });
  assert.deepStrictEqual(r.failures, ['EMPTY-CHECK']);
});

check('H9 a FILL-ME value in paths, names or survivors gives TEMPLATE-NOT-FILLED', () => {
  const s = synth({ 'a.js': 'clean' });
  const fill = 'FILL' + '-ME';
  for (const opts of [
    { paths: [fill], names: [], survivors: [] },
    { paths: ['gone.js'], names: [fill], survivors: [] },
    { paths: ['gone.js'], names: [], survivors: [fill] },
  ]) {
    const r = helper()({ ...s, root: '/nowhere', ...opts, self: SELF });
    assert.ok(r.failures.includes('TEMPLATE-NOT-FILLED'), 'no TEMPLATE-NOT-FILLED for ' + JSON.stringify(opts));
    assert.strictEqual(r.failures.filter((f) => f === 'TEMPLATE-NOT-FILLED').length, 1, 'TEMPLATE-NOT-FILLED must appear once');
  }
});

check('H10 a file with a NUL byte and a file over 5 MB are not swept', () => {
  const bin = Buffer.concat([Buffer.from(NEEDLE_B), Buffer.from([0]), Buffer.from('tail')]);
  const big = Buffer.concat([Buffer.from(NEEDLE_B), Buffer.alloc(5242881, 0x61)]);
  const s = synth({ 'bin.dat': bin, 'big.txt': big, 'a.js': 'clean' });
  const r = helper()({ ...s, root: '/nowhere', paths: [], names: [NEEDLE_B], survivors: [], self: SELF });
  assert.deepStrictEqual(r.failures, []);
  assert.strictEqual(r.counts.swept, 1, 'only the plain text file is swept');
  // control: the same needle in a plain text file is flagged, so the skip is the reason for the pass above
  const s2 = synth({ 'plain.txt': NEEDLE_B });
  const r2 = helper()({ ...s2, root: '/nowhere', paths: [], names: [NEEDLE_B], survivors: [], self: SELF });
  assert.deepStrictEqual(r2.failures, ['NAMED ' + NEEDLE_B + ' in plain.txt']);
});

check('H11 real git: a path removed in Phase 385 passes, its survivor stays', () => {
  const r = helper()({ root, paths: ['lib/core/deep-links.cjs'], names: [], survivors: ['lib/core/navigation.cjs'], self: SELF });
  assert.deepStrictEqual(r.failures, []);
});

check('H12 real git: a path that is tracked gives TRACKED', () => {
  const r = helper()({ root, paths: ['lib/core/navigation.cjs'], names: [], survivors: [], self: SELF });
  assert.deepStrictEqual(r.failures, ['TRACKED lib/core/navigation.cjs']);
});

check('H13 the template file is valid JavaScript (node --check)', () => {
  const p = path.join(root, TEMPLATE);
  assert.ok(fs.existsSync(p), 'template is missing: ' + TEMPLATE);
  const res = spawnSync(process.execPath, ['--check', p], { encoding: 'utf8' });
  assert.strictEqual(res.status, 0, 'node --check failed: ' + (res.stderr || '').trim());
});

check('H14 the unfilled template exits non-zero and prints TEMPLATE-NOT-FILLED', () => {
  const p = path.join(root, TEMPLATE);
  assert.ok(fs.existsSync(p), 'template is missing: ' + TEMPLATE);
  const res = spawnSync(process.execPath, [p], { encoding: 'utf8', cwd: root });
  assert.notStrictEqual(res.status, 0, 'the unfilled template exited 0');
  assert.ok((res.stdout + res.stderr).includes('TEMPLATE-NOT-FILLED'), 'output has no TEMPLATE-NOT-FILLED: ' + res.stdout);
});

check('H15 the template header names the copy target and the proof gates', () => {
  const p = path.join(root, TEMPLATE);
  assert.ok(fs.existsSync(p), 'template is missing: ' + TEMPLATE);
  const text = fs.readFileSync(p, 'utf8');
  const head = text.slice(0, text.indexOf("'use strict'"));
  for (const need of [
    'tests/test-390-<group>-removed.cjs',
    'scripts/build-connector-registry.cjs --check',
    'scripts/build-orchestration-projection.cjs --check',
    'scripts/check-render-coverage.cjs',
    'tests/test-209-declared-implies-wired.cjs',
    'tests/test-384-s7-mcp-start.cjs',
    'tests/test-270-tool-schema-budget.cjs',
    'tests/test-387-eureka-installed-layout.cjs',
    'SPEED384_WRITE_GOLDEN=1',
    '390-DECISION.md',
  ]) {
    assert.ok(head.includes(need), 'template header lacks: ' + need);
  }
});

process.exit(failed ? 1 : 0);
