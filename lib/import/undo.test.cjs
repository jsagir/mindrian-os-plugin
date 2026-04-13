'use strict';

/**
 * Phase 80 Plan 80-05 -- undo roundtrip end-to-end.
 *
 * Runs scripts/vault-import.cjs as a subprocess against tiny-vault, captures
 * routed files, then runs --undo and asserts:
 *   1. Routed files are moved to imports/{id}/undone/ (not deleted, not
 *      restored to source)
 *   2. Running --undo again is idempotent (exit 0, no errors, no changes)
 *   3. IMPORT-REPORT.md gains UNDONE: true in its frontmatter after undo
 *   4. The source vault is untouched
 *   5. --undo against a missing import id exits non-zero
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const pluginRoot = path.resolve(__dirname, '../..');
const script = path.join(pluginRoot, 'scripts/vault-import.cjs');
const tinyVault = path.join(pluginRoot, 'lib/import/test-fixtures/tiny-vault');

function tmpDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'vi-undo-' + prefix + '-' + crypto.randomBytes(4).toString('hex') + '-'));
}

function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dst, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else if (entry.isFile()) fs.copyFileSync(s, d);
  }
}

function scaffoldMinimalRoom(dir) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'STATE.md'), '---\ngsd_state_version: 1.0\nstatus: executing\n---\n\n# Room\n');
}

function run(args) {
  const res = spawnSync(process.execPath, [script].concat(args), {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });
  return { code: res.status, stdout: res.stdout || '', stderr: res.stderr || '' };
}

function cleanup(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { /* soft */ }
}

function snapshotSourceVault(dir) {
  const out = {};
  function walk(d, rel) {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      const r = path.join(rel, entry.name);
      if (entry.isDirectory()) walk(full, r);
      else if (entry.isFile()) out[r] = fs.readFileSync(full, 'utf8');
    }
  }
  walk(dir, '');
  return out;
}

let passed = 0, failed = 0;
function test(name, fn) {
  try {
    fn();
    process.stdout.write('ok ' + name + '\n');
    passed++;
  } catch (e) {
    process.stderr.write('FAIL ' + name + '\n  ' + (e.stack || e.message) + '\n');
    failed++;
  }
}

// ---------------------------------------------------------------------------
// Test 1: roundtrip -- import then undo
// ---------------------------------------------------------------------------
test('undo moves routed files to imports/{id}/undone/ and marks report', function () {
  const src = tmpDir('rt-src');
  const dst = tmpDir('rt-dst');
  try {
    copyDir(tinyVault, src);
    scaffoldMinimalRoom(dst);
    const sourceBefore = snapshotSourceVault(src);

    // Run full pipeline
    let r = run(['--path', src, '--room', dst, '--yes']);
    assert.equal(r.code, 0, 'import exit 0 (stderr=' + r.stderr + ')');

    const importsRoot = path.join(dst, 'imports');
    const importIds = fs.readdirSync(importsRoot);
    assert.equal(importIds.length, 1, 'one import dir');
    const importId = importIds[0];
    const importDir = path.join(importsRoot, importId);
    const manifestPath = path.join(importDir, '01-ingest/output/MANIFEST.json');
    const m = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    // Capture routed destinations that actually exist on disk
    const routedExisting = [];
    for (const f of m.files) {
      if (f.destination_abs_path && fs.existsSync(f.destination_abs_path)) {
        routedExisting.push(f.destination_abs_path);
      }
    }
    assert.ok(routedExisting.length > 0, 'at least one routed file exists pre-undo');

    // Run undo
    r = run(['--undo', importId, '--room', dst]);
    assert.equal(r.code, 0, 'undo exit 0 (stderr=' + r.stderr + ')');

    // Every previously routed file must now be gone from its destination
    for (const abs of routedExisting) {
      assert.ok(!fs.existsSync(abs), 'routed file removed from destination: ' + abs);
    }

    // All moved files must be present somewhere under imports/{id}/undone/
    const undoneRoot = path.join(importDir, 'undone');
    assert.ok(fs.existsSync(undoneRoot), 'undone/ exists');
    const undoneFiles = [];
    (function walk(d) {
      for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, entry.name);
        if (entry.isDirectory()) walk(p);
        else if (entry.isFile()) undoneFiles.push(p);
      }
    })(undoneRoot);
    assert.ok(undoneFiles.length >= routedExisting.length, 'undone/ holds at least routed count (got ' + undoneFiles.length + ', expected >= ' + routedExisting.length + ')');

    // Manifest marked undone
    const mAfter = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    assert.equal(mAfter.undo.is_undone, true, 'manifest.undo.is_undone');
    assert.ok(mAfter.undo.undone_at, 'undone_at set');

    // Report has UNDONE: true
    const report = fs.readFileSync(path.join(importDir, 'IMPORT-REPORT.md'), 'utf8');
    assert.ok(/^---\nUNDONE: true\n/.test(report), 'IMPORT-REPORT.md has UNDONE: true');

    // Source vault untouched
    const sourceAfter = snapshotSourceVault(src);
    assert.deepEqual(sourceAfter, sourceBefore, 'source vault unchanged by undo');
  } finally {
    cleanup(src);
    cleanup(dst);
  }
});

// ---------------------------------------------------------------------------
// Test 2: idempotent -- running undo twice is a no-op exit 0
// ---------------------------------------------------------------------------
test('undo is idempotent (second run exits 0)', function () {
  const src = tmpDir('idem-src');
  const dst = tmpDir('idem-dst');
  try {
    copyDir(tinyVault, src);
    scaffoldMinimalRoom(dst);

    let r = run(['--path', src, '--room', dst, '--yes']);
    assert.equal(r.code, 0, 'import exit 0');

    const importId = fs.readdirSync(path.join(dst, 'imports'))[0];

    r = run(['--undo', importId, '--room', dst]);
    assert.equal(r.code, 0, 'first undo exit 0');

    r = run(['--undo', importId, '--room', dst]);
    assert.equal(r.code, 0, 'second undo exit 0');
    assert.ok(/already undone/.test(r.stdout), 'second undo reports already undone');
  } finally {
    cleanup(src);
    cleanup(dst);
  }
});

// ---------------------------------------------------------------------------
// Test 3: missing import id -> non-zero exit
// ---------------------------------------------------------------------------
test('undo against missing import id exits non-zero', function () {
  const dst = tmpDir('miss-dst');
  try {
    scaffoldMinimalRoom(dst);
    const r = run(['--undo', '9999-99-99-nothing', '--room', dst]);
    assert.notEqual(r.code, 0, 'non-zero exit for missing id');
    assert.ok(/manifest not found/.test(r.stderr), 'stderr mentions manifest not found');
  } finally {
    cleanup(dst);
  }
});

process.stdout.write('\n' + passed + ' passed, ' + failed + ' failed\n');
if (failed > 0) process.exit(1);
