#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * test-first-touch-drift-scanner.cjs
 * ----------------------------------
 * Hand-rolled test for scripts/check-first-touch-drift.cjs (SEED-007
 * scanner family; Phase 95.6 D-07).
 *
 * Three assertions:
 *   1. The scanner exits 0 against the repo (first-touch surfaces clean
 *      post-D-06).
 *   2. Against a temp fixture file that mislabels the license token as OSS
 *      (the pattern-3 drift), the scanner exits non-zero and emits a
 *      "pattern 3" message.
 *   3. Against a temp fixture file containing an em-dash (U+2014), the
 *      scanner exits non-zero and emits a "pattern 1" message.
 *
 * Pure CJS, node built-ins only. No emoji, no em-dashes in this file. The
 * pattern-3 fixture string is assembled from fragments at runtime so this
 * source file itself does not carry the contiguous mislabel token (mirrors
 * the string-fragment idiom in tests/test-92-rename-no-long-leaves.cjs); the
 * U+2014 byte for fixture 3 is built via String.fromCharCode for the same
 * reason.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const SCANNER = path.join(REPO_ROOT, 'scripts', 'check-first-touch-drift.cjs');

function runScanner(extraEnv) {
  return spawnSync(process.execPath, [SCANNER], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    env: Object.assign({}, process.env, extraEnv || {}),
  });
}

function makeFixtureDir(filename, contents) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-first-touch-drift-'));
  fs.writeFileSync(path.join(dir, filename), contents);
  return dir;
}

let passed = 0;

// --- Assertion 1: repo is clean -------------------------------------------
{
  const r = runScanner();
  assert.strictEqual(
    r.status, 0,
    `expected scanner to exit 0 on the repo, got ${r.status}.\nstdout:\n${r.stdout}\nstderr:\n${r.stderr}`,
  );
  assert.ok(/first-touch surfaces clean/.test(r.stdout), 'expected "first-touch surfaces clean" on stdout');
  console.log('PASS: scanner exits 0 on the repo (first-touch surfaces clean)');
  passed++;
}

// --- Assertion 2: license token mislabelled as OSS -> pattern 3 ----------
{
  // Assembled from fragments so this source file does not carry the
  // contiguous mislabel token (see header NOTE). The runtime fixture file
  // DOES carry it -- that is the whole point.
  const licenseToken = ['BSL', '1.1'].join('-');
  const ossWord = ['open', 'source'].join(' ');
  const fixtureLine = `MindrianOS is ${licenseToken} (${ossWord}) -- free for all uses.\n`;
  const dir = makeFixtureDir('license-blurb.md', fixtureLine);
  try {
    const r = runScanner({ MOS_TEST_SCAN_DIR: dir });
    assert.notStrictEqual(r.status, 0, `expected non-zero exit on the OSS-mislabel fixture, got ${r.status}`);
    assert.ok(/pattern 3/.test(r.stdout), `expected a "pattern 3" hit on stdout, got:\n${r.stdout}`);
    console.log('PASS: license-token-as-OSS fixture triggers a pattern-3 hit');
    passed++;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// --- Assertion 3: em-dash -> pattern 1 ------------------------------------
{
  const emDash = String.fromCharCode(0x2014); // U+2014 EM DASH
  const dir = makeFixtureDir('greeting.md', `Three ways to do this ${emDash} pick one.\n`);
  try {
    const r = runScanner({ MOS_TEST_SCAN_DIR: dir });
    assert.notStrictEqual(r.status, 0, `expected non-zero exit on em-dash fixture, got ${r.status}`);
    assert.ok(/pattern 1/.test(r.stdout), `expected a "pattern 1" hit on stdout, got:\n${r.stdout}`);
    console.log('PASS: em-dash (U+2014) fixture triggers a pattern-1 hit');
    passed++;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

console.log(`\nfirst-touch drift scanner test: ${passed}/3 passed`);
process.exit(0);
