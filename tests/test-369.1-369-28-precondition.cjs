#!/usr/bin/env node
'use strict';
/**
 * tests/test-369.1-369-28-precondition.cjs  (Phase 369.1, plan 08, D-01)
 *
 * Behaviour probe: did Phase 369 plan 28 land? Plan 369.1-08 edits two 369-28 files
 * (docs/RELEASE-CEREMONY-RULING-SYSTEM.md and the payload ceiling gate's neighbours), so it proves the
 * predecessor by behaviour before any edit. Reused by plan 369.1-14.
 *
 *   1  lib/ui-shell/dist/manifest.json carries a sourceHash
 *   2  node scripts/build-ui-shell.cjs --check exits 0
 *   3  release.sh carries the UI freshness gate (build-ui-shell.cjs" --check) in the Step 2.4 block
 *   4  RULE 5 and RULE 8 carry the 369-28 sentences ("not a lockstep place", "or code the bundler inlined")
 *   5  package.json "files" negates scripts/build-ui-shell.cjs
 *   6  369-28-SUMMARY.md exists
 *
 * Exit 0 only when all six hold. Read-only: nothing is written anywhere.
 */

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
let failures = 0;

function check(name, fn) {
  try {
    const detail = fn();
    process.stdout.write('PASS: ' + name + (detail ? ' (' + detail + ')' : '') + '\n');
  } catch (e) {
    failures++;
    process.stdout.write('FAIL: ' + name + '\n  ' + (e && e.message ? e.message : String(e)) + '\n');
  }
}

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

check('1 dist manifest has a sourceHash', function () {
  const m = JSON.parse(read('lib/ui-shell/dist/manifest.json'));
  if (typeof m.sourceHash !== 'string' || m.sourceHash.length < 8) throw new Error('no sourceHash in lib/ui-shell/dist/manifest.json');
  return m.sourceHash.slice(0, 12);
});

check('2 build-ui-shell.cjs --check exits 0', function () {
  const r = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'build-ui-shell.cjs'), '--check'], { encoding: 'utf8', timeout: 120000 });
  if (r.status !== 0) throw new Error('exit ' + r.status + ': ' + String(r.stdout || '') + String(r.stderr || ''));
});

check('3 release.sh Step 2.4 carries the UI freshness gate', function () {
  const sh = read('scripts/release.sh');
  const idx = sh.indexOf('Step 2.4');
  if (idx === -1) throw new Error('no Step 2.4 in release.sh');
  if (sh.indexOf('build-ui-shell.cjs" --check', idx) === -1) throw new Error('no build-ui-shell.cjs" --check after Step 2.4');
});

check('4 RULE 5 and RULE 8 carry the 369-28 sentences', function () {
  const doc = read('docs/RELEASE-CEREMONY-RULING-SYSTEM.md');
  if (doc.indexOf('not a lockstep place') === -1) throw new Error('"not a lockstep place" missing');
  if (doc.indexOf('or code the bundler inlined') === -1) throw new Error('"or code the bundler inlined" missing');
});

check('5 package.json files negates the dev-only UI build script', function () {
  const pkg = JSON.parse(read('package.json'));
  if (!Array.isArray(pkg.files) || pkg.files.indexOf('!scripts/build-ui-shell.cjs') === -1) throw new Error('"!scripts/build-ui-shell.cjs" missing from files');
});

check('6 369-28-SUMMARY.md exists', function () {
  const dir = path.join(ROOT, '.planning', 'phases');
  const phase = fs.readdirSync(dir).find(function (d) { return d.indexOf('369-ui-shell') === 0; });
  if (!phase) throw new Error('no 369-ui-shell phase directory');
  if (!fs.existsSync(path.join(dir, phase, '369-28-SUMMARY.md'))) throw new Error('369-28-SUMMARY.md missing');
});

process.stdout.write('RESULT: ' + (failures === 0 ? 'ALL PASS' : failures + ' FAIL') + '\n');
process.exit(failures === 0 ? 0 : 1);
