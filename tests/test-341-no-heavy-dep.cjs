#!/usr/bin/env node
'use strict';

/*
 * Phase 341, D-03 -- the heavy-dependency tripwire.
 *
 * WHAT: @huggingface/transformers, and its transitive stack (onnxruntime-node,
 * onnxruntime-web, sharp, @img/*), must be absent from dependencies,
 * optionalDependencies, peerDependencies AND devDependencies, and absent from
 * the published lockfile's packages map.
 *
 * WHY (341-FINDINGS.md, measured on tag v2.0.0-beta.29 via git ls-tree -r -l):
 * @huggingface/transformers plus its transitive stack is 392.6 MB
 * (onnxruntime-node 210.1 MB + onnxruntime-web 128.2 MB + @img/sharp-libvips-*
 * 32.3 MB + @huggingface/transformers itself 9.1 MB) of the 410.3 MB / 8,880
 * files that release.sh Step 6.7 force-vendored into every release tag, and
 * 23 native binaries for every platform shipped to every user, every release.
 *
 * The pre-cut range literal read from package.json (recorded here so plan
 * 341-02 can carry it forward as EUREKA_DEP_SPEC): ^4.2.0
 *
 * TDD posture: this file lands RED on today's package.json/package-lock.json
 * (the dependency is still present) and can only be made green by plan
 * 341-04's real dependency cut.
 *
 * Canon Part 8 (Graph Boundary): pure filesystem reads of package.json and
 * the lockfile. No spawn, no network, ever.
 *
 * House rule: hyphens only, no em-dashes, no emoji.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const PKG_PATH = path.join(REPO_ROOT, 'package.json');
const SHRINKWRAP_PATH = path.join(REPO_ROOT, 'npm-shrinkwrap.json');
const PACKAGE_LOCK_PATH = path.join(REPO_ROOT, 'package-lock.json');

const HEAVY_DEP = '@huggingface/transformers';
const TRANSITIVE_SUBSTRINGS = [
  '@huggingface/transformers',
  'onnxruntime-node',
  'onnxruntime-web',
  'node_modules/sharp',
  '@img/sharp',
];

let PASS = 0;
let FAIL = 0;

function ok(label) {
  console.log('ok   ' + label);
  PASS += 1;
}

function fail(label, detail) {
  console.log('FAIL ' + label + (detail ? ' -- ' + detail : ''));
  FAIL += 1;
}

const pkg = JSON.parse(fs.readFileSync(PKG_PATH, 'utf8'));

// ARM 1 -- absent from dependencies.
try {
  const deps = pkg.dependencies || {};
  assert.ok(
    !Object.prototype.hasOwnProperty.call(deps, HEAVY_DEP),
    HEAVY_DEP + ' still present in dependencies (' + JSON.stringify(deps[HEAVY_DEP]) + ')'
  );
  ok('arm 1: ' + HEAVY_DEP + ' absent from dependencies');
} catch (e) {
  fail('arm 1: ' + HEAVY_DEP + ' absent from dependencies', e && e.message);
}

// ARM 2 -- absent from optionalDependencies AND peerDependencies. Optional is
// NOT a hiding place: the loader runs `npm ci --ignore-scripts` with no
// --omit flag (verified against `npm config ls -l`, omit = []), so optional
// dependencies install by default on every user machine.
try {
  const optionalDeps = pkg.optionalDependencies || {};
  const peerDeps = pkg.peerDependencies || {};
  const inOptional = Object.prototype.hasOwnProperty.call(optionalDeps, HEAVY_DEP);
  const inPeer = Object.prototype.hasOwnProperty.call(peerDeps, HEAVY_DEP);
  assert.ok(
    !inOptional && !inPeer,
    HEAVY_DEP + ' present in optionalDependencies=' + inOptional + ' or peerDependencies=' + inPeer +
      '; the loader\'s npm ci --ignore-scripts passes no --omit flag (omit = [] measured against ' +
      'npm config ls -l), so optionalDependencies install by default on every user machine -- optional is ' +
      'not a hiding place'
  );
  ok('arm 2: ' + HEAVY_DEP + ' absent from optionalDependencies and peerDependencies');
} catch (e) {
  fail('arm 2: ' + HEAVY_DEP + ' absent from optionalDependencies and peerDependencies', e && e.message);
}

// ARM 3 -- devDependencies is either absent or an empty object. The loader
// passes no --omit, so a dev entry would be installed on every user machine.
try {
  const devDeps = pkg.devDependencies;
  const isAbsentOrEmpty = devDeps === undefined || (typeof devDeps === 'object' && devDeps !== null && Object.keys(devDeps).length === 0);
  assert.ok(
    isAbsentOrEmpty,
    'devDependencies is present and non-empty (' + JSON.stringify(devDeps) + '); the loader passes no --omit ' +
      'flag, so a devDependencies entry would be installed on every user machine'
  );
  ok('arm 3: devDependencies is absent or empty');
} catch (e) {
  fail('arm 3: devDependencies is absent or empty', e && e.message);
}

// ARM 4 -- the transitive stack is gone from the lockfile. When
// npm-shrinkwrap.json exists, inspect it (the published lockfile). When it
// does not exist yet, inspect package-lock.json instead and label the arm
// PRE-CUT so the reader knows which file was inspected.
try {
  let lockfilePath;
  let lockfileLabel;
  if (fs.existsSync(SHRINKWRAP_PATH)) {
    lockfilePath = SHRINKWRAP_PATH;
    lockfileLabel = 'npm-shrinkwrap.json';
  } else {
    lockfilePath = PACKAGE_LOCK_PATH;
    lockfileLabel = 'PRE-CUT (lockfile: package-lock.json)';
  }
  const lockfile = JSON.parse(fs.readFileSync(lockfilePath, 'utf8'));
  const packages = lockfile.packages || {};
  const offendingKeys = Object.keys(packages).filter(function (key) {
    return TRANSITIVE_SUBSTRINGS.some(function (substr) { return key.indexOf(substr) !== -1; });
  });
  assert.strictEqual(
    offendingKeys.length,
    0,
    lockfileLabel + ': transitive stack still present -- offending package keys: ' + offendingKeys.join(', ')
  );
  ok('arm 4 [' + lockfileLabel + ']: no transitive-stack key in packages');
} catch (e) {
  fail('arm 4: no transitive-stack key in the inspected lockfile', e && e.message);
}

console.log('PASS=' + PASS + ' FAIL=' + FAIL);
process.exit(FAIL > 0 ? 1 : 0);
