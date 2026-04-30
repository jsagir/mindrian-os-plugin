#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 95.1 Plan 03 -- behavior fence for scripts/generate-section-intelligence.cjs.
 * Closes drift class E remediation path (DOCTOR-95.1-05 per .planning/REQUIREMENTS.md).
 *
 * This file is the RED skeleton from Plan 95.1-02 (auto-created by Plan 95.1-03
 * executor as a Rule 3 deviation when Plan 95.1-02 had not yet run). Plan 95.1-03
 * implements scripts/generate-section-intelligence.cjs and flips this suite from
 * RED -> GREEN.
 *
 * Generator contract per 95.1-CONTEXT.md decisions D-01..D-03:
 *   D-01  default scope = ONE directory; --recursive walks the subtree.
 *   D-02  skip-if-exists by default; --force overrides.
 *   D-03  hand-rolled minimal frontmatter (NOT imported from existing
 *         vault-section-{state,minto}-generator.cjs).
 *
 * Phase 87-01a guard contract: ROOM.md + MINTO.md frontmatter MUST include
 *   section, parent (ROOM only), created, license: BSL-1.1
 *   type: section-minto (MINTO only), governing_thought (MINTO only)
 *
 * Atomic-write contract per Phase 95-02: mktemp + fs.renameSync (no torn writes,
 * no leaked .tmp.<pid> files in target dirs).
 *
 * Five scenarios:
 *   1. default invocation, single-dir   -> creates ROOM.md + MINTO.md, both
 *                                          carrying BSL-1.1 frontmatter; exit 0.
 *   2. skip-if-exists (default)         -> existing ROOM.md is NOT touched.
 *   2b. --force overrides                -> existing ROOM.md IS overwritten.
 *   3. --recursive on 3 nested subdirs  -> creates 6 files; skips hidden dirs
 *                                          (.git, .mindrian, node_modules, etc.).
 *   4. non-existent dir                 -> exit non-zero with stderr error.
 *   5. atomic write                     -> no .tmp.<pid> leaks in target dir
 *                                          AND files actually arrive on disk.
 *
 * Registered in lib/memory/run-feynman-tests.cjs.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const GENERATOR = path.join(REPO, 'scripts', 'generate-section-intelligence.cjs');

let passed = 0;
let failed = 0;

function ok(name) {
  passed += 1;
  process.stdout.write('  ok ' + name + '\n');
}

function fail(name, err) {
  failed += 1;
  process.stdout.write('  FAIL ' + name + '\n');
  if (err) {
    process.stdout.write('    ' + (err.message || String(err)) + '\n');
  }
}

// ---------- Sandbox helpers ----------

function makeScratchDir(suffix) {
  const base = path.join(
    os.tmpdir(),
    'mos-gen-section-' + Date.now().toString(36) + '-' + suffix
  );
  fs.mkdirSync(base, { recursive: true });
  return base;
}

function rmrf(p) {
  try {
    fs.rmSync(p, { recursive: true, force: true });
  } catch (_) { /* best-effort */ }
}

// Run the generator with the given argv. Returns { stdout, stderr, status }.
function runGen(args, opts) {
  const o = opts || {};
  const res = spawnSync('node', [GENERATOR].concat(args || []), {
    encoding: 'utf8',
    timeout: o.timeoutMs || 5000,
    cwd: o.cwd || process.cwd(),
    env: Object.assign({}, process.env, o.env || {}),
  });
  return {
    stdout: res.stdout || '',
    stderr: res.stderr || '',
    status: typeof res.status === 'number' ? res.status : -1,
  };
}

function readFile(p) {
  return fs.readFileSync(p, 'utf8');
}

function listTmpLeaks(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((n) => /\.(?:ROOM|MINTO)\.md\.tmp\.\d+$/.test(n));
}

// ---------- Scenarios ----------

(function test1_defaultSingleDir() {
  const label = 'generate: default invocation creates ROOM.md + MINTO.md in one dir';
  const scratch = makeScratchDir('s1');
  try {
    const target = path.join(scratch, 'problem-definition');
    fs.mkdirSync(target, { recursive: true });

    const { status, stderr } = runGen([target]);
    assert.equal(status, 0, label + ': must exit 0. stderr=' + stderr);

    const roomPath = path.join(target, 'ROOM.md');
    const mintoPath = path.join(target, 'MINTO.md');
    assert.ok(fs.existsSync(roomPath), label + ': ROOM.md must exist at ' + roomPath);
    assert.ok(fs.existsSync(mintoPath), label + ': MINTO.md must exist at ' + mintoPath);

    const room = readFile(roomPath);
    const minto = readFile(mintoPath);

    // Frontmatter: BSL 1.1 license required by Phase 87-01a guard expectation.
    assert.ok(/license:\s*BSL-1\.1/.test(room), label + ': ROOM.md frontmatter must include license: BSL-1.1');
    assert.ok(/license:\s*BSL-1\.1/.test(minto), label + ': MINTO.md frontmatter must include license: BSL-1.1');

    // ROOM.md required keys (D-03 hand-rolled minimal frontmatter).
    assert.ok(/section:\s*problem-definition/.test(room), label + ': ROOM.md must carry section name');
    assert.ok(/parent:\s*/.test(room), label + ': ROOM.md must carry parent');
    assert.ok(/created:\s*\d{4}-\d{2}-\d{2}/.test(room), label + ': ROOM.md must carry ISO created date');

    // MINTO.md required keys.
    assert.ok(/type:\s*section-minto/.test(minto), label + ': MINTO.md must carry type: section-minto');
    assert.ok(/section:\s*problem-definition/.test(minto), label + ': MINTO.md must carry section name');
    assert.ok(/governing_thought:/.test(minto), label + ': MINTO.md must carry governing_thought field');
    assert.ok(/created:\s*\d{4}-\d{2}-\d{2}/.test(minto), label + ': MINTO.md must carry ISO created date');

    ok(label);
  } catch (e) {
    fail(label, e);
  } finally {
    rmrf(scratch);
  }
})();

(function test2_skipIfExists() {
  const label = 'generate: skip-if-exists preserves existing ROOM.md';
  const scratch = makeScratchDir('s2');
  try {
    const target = path.join(scratch, 'problem-definition');
    fs.mkdirSync(target, { recursive: true });

    // Pre-seed ROOM.md with custom user content.
    const customRoom = '---\nsection: problem-definition\ncustom: user-edit\nlicense: BSL-1.1\n---\n\n# Custom user identity\n';
    const roomPath = path.join(target, 'ROOM.md');
    fs.writeFileSync(roomPath, customRoom);

    const { status, stdout, stderr } = runGen([target]);
    assert.equal(status, 0, label + ': must exit 0. stderr=' + stderr);

    // ROOM.md content unchanged.
    assert.equal(readFile(roomPath), customRoom, label + ': existing ROOM.md must NOT be modified');

    // MINTO.md still gets generated (only ROOM.md was pre-existing).
    assert.ok(fs.existsSync(path.join(target, 'MINTO.md')), label + ': MINTO.md must still be generated');

    // Stdout must announce the skip somehow.
    assert.ok(
      /skip/i.test(stdout) || /exists/i.test(stdout),
      label + ': stdout should mention skip/exists. Got: ' + JSON.stringify(stdout)
    );

    ok(label);
  } catch (e) {
    fail(label, e);
  } finally {
    rmrf(scratch);
  }
})();

(function test2b_forceOverrides() {
  const label = 'generate: --force overwrites existing ROOM.md';
  const scratch = makeScratchDir('s2b');
  try {
    const target = path.join(scratch, 'problem-definition');
    fs.mkdirSync(target, { recursive: true });

    const customRoom = '---\ncustom: user-edit\n---\n\n# Custom\n';
    const roomPath = path.join(target, 'ROOM.md');
    fs.writeFileSync(roomPath, customRoom);

    const { status, stderr } = runGen([target, '--force']);
    assert.equal(status, 0, label + ': must exit 0. stderr=' + stderr);

    const after = readFile(roomPath);
    assert.notEqual(after, customRoom, label + ': --force must overwrite existing ROOM.md');
    assert.ok(/license:\s*BSL-1\.1/.test(after), label + ': overwritten ROOM.md must carry BSL-1.1 frontmatter');
    assert.ok(/section:\s*problem-definition/.test(after), label + ': overwritten ROOM.md must carry section');

    ok(label);
  } catch (e) {
    fail(label, e);
  } finally {
    rmrf(scratch);
  }
})();

(function test3_recursive() {
  const label = 'generate: --recursive walks subtree, creates 6 files across 3 nested dirs';
  const scratch = makeScratchDir('s3');
  try {
    // a/, a/b/, a/b/c/  -> 3 dirs, 6 expected files (3 ROOM + 3 MINTO).
    const a = path.join(scratch, 'a');
    const ab = path.join(a, 'b');
    const abc = path.join(ab, 'c');
    fs.mkdirSync(abc, { recursive: true });

    // Skipped-dir control: hidden dirs MUST NOT receive ROOM.md/MINTO.md.
    fs.mkdirSync(path.join(scratch, '.git'), { recursive: true });
    fs.mkdirSync(path.join(scratch, 'node_modules', 'foo'), { recursive: true });
    fs.mkdirSync(path.join(scratch, '.mindrian'), { recursive: true });

    const { status, stderr } = runGen([scratch, '--recursive']);
    assert.equal(status, 0, label + ': must exit 0. stderr=' + stderr);

    // The 3 nested dirs MUST each have ROOM.md + MINTO.md (= 6 files).
    for (const d of [a, ab, abc]) {
      assert.ok(fs.existsSync(path.join(d, 'ROOM.md')), label + ': ROOM.md missing under ' + d);
      assert.ok(fs.existsSync(path.join(d, 'MINTO.md')), label + ': MINTO.md missing under ' + d);
    }

    // Hidden / blacklisted dirs MUST NOT have ROOM.md/MINTO.md.
    assert.ok(!fs.existsSync(path.join(scratch, '.git', 'ROOM.md')), label + ': must skip .git');
    assert.ok(!fs.existsSync(path.join(scratch, '.mindrian', 'ROOM.md')), label + ': must skip .mindrian');
    assert.ok(!fs.existsSync(path.join(scratch, 'node_modules', 'foo', 'ROOM.md')), label + ': must skip node_modules');

    ok(label);
  } catch (e) {
    fail(label, e);
  } finally {
    rmrf(scratch);
  }
})();

(function test4_nonExistentDir() {
  const label = 'generate: non-existent directory exits non-zero with clear error';
  const scratch = makeScratchDir('s4');
  try {
    const ghost = path.join(scratch, 'no-such-dir');

    const { status, stderr } = runGen([ghost]);
    assert.notEqual(status, 0, label + ': must exit non-zero on missing dir. status=' + status);
    assert.ok(stderr.length > 0, label + ': stderr must explain the failure');
    assert.ok(
      /not found|does not exist|cannot/i.test(stderr),
      label + ': stderr must contain a clear "not found" / "does not exist" message. Got: ' + JSON.stringify(stderr)
    );

    ok(label);
  } catch (e) {
    fail(label, e);
  } finally {
    rmrf(scratch);
  }
})();

(function test5_atomicWrite() {
  const label = 'generate: atomic write leaves no .tmp.<pid> leaks';
  const scratch = makeScratchDir('s5');
  try {
    const target = path.join(scratch, 'problem-definition');
    fs.mkdirSync(target, { recursive: true });

    const { status, stderr } = runGen([target]);
    assert.equal(status, 0, label + ': must exit 0. stderr=' + stderr);

    // No .tmp.<pid> files matching ROOM.md / MINTO.md must remain.
    const leaks = listTmpLeaks(target);
    assert.equal(leaks.length, 0, label + ': no .tmp.<pid> leaks expected. Got: ' + JSON.stringify(leaks));

    // Final files must be present (atomic rename(2) landed).
    assert.ok(fs.existsSync(path.join(target, 'ROOM.md')), label + ': ROOM.md must exist after atomic rename');
    assert.ok(fs.existsSync(path.join(target, 'MINTO.md')), label + ': MINTO.md must exist after atomic rename');

    ok(label);
  } catch (e) {
    fail(label, e);
  } finally {
    rmrf(scratch);
  }
})();

// ---------- Tally ----------

process.stdout.write('\n' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed === 0 ? 0 : 1);
