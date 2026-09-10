#!/usr/bin/env node
'use strict';

/*
 * tests/test-341-payload-ceiling.cjs -- Phase 341 Plan 04 (D-08).
 * The file named in data/harness-policies/release-payload-ceiling.json's
 * own `pinned_by`, so it must exist or the policy lies.
 *
 * Arms:
 *   1. The policy file validates: `run-harness.cjs --check` exits 0 and
 *      names release-payload-ceiling.
 *   2. check() PASSES on the real repo root (post-cut).
 *   3. check() FAILS on a synthetic tree whose files allowlist omits
 *      npm-shrinkwrap.json, naming it in a finding.
 *   4. check() FAILS on a synthetic tree whose payload contains
 *      scripts/release.sh, naming it in a finding.
 *   5. The policy actually fails the tier: spawning run-harness.cjs
 *      --tier pre-tag against the REAL repo root, with
 *      CHECK_PAYLOAD_CEILING_ROOT pointed at the violating synthetic tree
 *      (inherited down the spawn chain since spawnSync inherits
 *      process.env by default), reports a blocking failure.
 *   6. The runner makes no network call (source-level grep).
 *
 * Canon Part 8: every synthetic tree lives under os.tmpdir(); no network
 * call anywhere in this file; `npm pack --dry-run --json` is offline by
 * construction.
 *
 * House rule: hyphens only, no em-dashes.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const RUNNER_PATH = path.join(REPO_ROOT, 'scripts', 'check-release-payload-ceiling.cjs');
const RUN_HARNESS_PATH = path.join(REPO_ROOT, 'scripts', 'run-harness.cjs');
const runner = require(RUNNER_PATH);

let PASS = 0;
let FAIL = 0;

function check(name, cond, detail) {
  if (cond) {
    PASS++;
    console.log('  PASS: ' + name);
  } else {
    FAIL++;
    console.log('  FAIL: ' + name + (detail ? ' -- ' + detail : ''));
  }
}

function mkSyntheticTree(name) {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mos-341-payload-' + name + '-'));
}

// Builds a minimal, real npm package on disk so `npm pack --dry-run --json`
// produces a genuine payload. `filesList` is the package.json `files` array;
// `extraFiles` is a map of repo-relative path -> file content to write.
function buildSyntheticTree(name, filesList, extraFiles) {
  const dir = mkSyntheticTree(name);
  const pkg = {
    name: 'mos-341-payload-fixture-' + name,
    version: '1.0.0',
    files: filesList,
  };
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify(pkg, null, 2));
  for (const rel of Object.keys(extraFiles)) {
    const full = path.join(dir, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, extraFiles[rel]);
  }
  return dir;
}

function main() {
  console.log('test-341-payload-ceiling.cjs');

  // Arm 1: the policy file validates via run-harness --check.
  const harnessCheck = spawnSync('node', [RUN_HARNESS_PATH, '--check'], {
    encoding: 'utf8',
    cwd: REPO_ROOT,
    timeout: 120000,
  });
  check(
    'arm 1: run-harness.cjs --check exits 0 and names release-payload-ceiling',
    harnessCheck.status === 0 && (harnessCheck.stdout || '').includes('release-payload-ceiling'),
    'exit=' + harnessCheck.status + ' stdout=' + (harnessCheck.stdout || '').slice(0, 300)
  );

  // Arm 2: check() PASSES on the real repo root, post-cut.
  const realResult = runner.check(REPO_ROOT);
  check(
    'arm 2: check() PASSES on the real repo root',
    realResult.ok === true,
    JSON.stringify(realResult.findings)
  );

  // Arm 3: check() FAILS on a tree whose files allowlist omits
  // npm-shrinkwrap.json, naming it.
  const noShrinkwrapDir = buildSyntheticTree(
    'no-shrinkwrap',
    ['.claude-plugin', 'lib'],
    {
      '.claude-plugin/plugin.json': JSON.stringify({ name: 'fixture' }),
      'lib/index.js': 'module.exports = {};',
    }
  );
  const noShrinkwrapResult = runner.check(noShrinkwrapDir);
  check(
    'arm 3: check() FAILS on a tree missing npm-shrinkwrap.json from files',
    noShrinkwrapResult.ok === false &&
      noShrinkwrapResult.findings.some(function (f) { return f.indexOf('npm-shrinkwrap.json') !== -1; }),
    JSON.stringify(noShrinkwrapResult.findings)
  );

  // Arm 4: check() FAILS on a tree whose payload contains scripts/release.sh.
  const releaseShDir = buildSyntheticTree(
    'release-sh',
    ['.claude-plugin', 'npm-shrinkwrap.json', 'scripts'],
    {
      '.claude-plugin/plugin.json': JSON.stringify({ name: 'fixture' }),
      'npm-shrinkwrap.json': JSON.stringify({ name: 'fixture', lockfileVersion: 3, packages: {} }),
      'scripts/release.sh': '#!/bin/bash\necho hi\n',
    }
  );
  const releaseShResult = runner.check(releaseShDir);
  check(
    'arm 4: check() FAILS on a tree whose payload contains scripts/release.sh',
    releaseShResult.ok === false &&
      releaseShResult.findings.some(function (f) { return f.indexOf('scripts/release.sh') !== -1; }),
    JSON.stringify(releaseShResult.findings)
  );

  // Arm 5: the policy actually fails the tier. Spawn run-harness.cjs against
  // the REAL repo root (so the real, schema-valid policy file is loaded),
  // but with CHECK_PAYLOAD_CEILING_ROOT pointed at the violating synthetic
  // tree. spawnSync inherits process.env by default at every hop in the
  // chain (this test -> run-harness.cjs -> the policy's own runner spawn),
  // so the env var reaches the runner without needing --root support in
  // run-harness.cjs itself.
  const tierResult = spawnSync('node', [RUN_HARNESS_PATH, '--tier', 'pre-tag'], {
    encoding: 'utf8',
    cwd: REPO_ROOT,
    timeout: 120000,
    env: Object.assign({}, process.env, { CHECK_PAYLOAD_CEILING_ROOT: noShrinkwrapDir }),
  });
  check(
    'arm 5: run-harness.cjs --tier pre-tag fails when the payload policy is pointed at a violating tree',
    tierResult.status === 1 && (tierResult.stdout || '').includes('release-payload-ceiling'),
    'exit=' + tierResult.status + ' stdout=' + (tierResult.stdout || '').slice(0, 500)
  );

  // Arm 6: the runner makes no network call (source-level check).
  const runnerSource = fs.readFileSync(RUNNER_PATH, 'utf8');
  const nonCommentLines = runnerSource
    .split('\n')
    .filter(function (line) { return !/^\s*[*/]/.test(line); })
    .join('\n');
  check(
    'arm 6: the runner source makes no network call',
    !/npm publish|npm view|https?:\/\/|api\.github/.test(nonCommentLines),
    'a forbidden network-call-shaped substring was found in non-comment source'
  );

  console.log('RESULT: PASS=' + PASS + ' FAIL=' + FAIL);
  process.exit(FAIL === 0 ? 0 : 1);
}

if (require.main === module) {
  main();
}

module.exports = { main };
