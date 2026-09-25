#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 355.1 Plan 06 Task 1 (RED) -- test-3551-one-spawner: proves the
 * Phase 117 fire child (scripts/auto-explore-fire.cjs) has exactly ONE
 * pinned spawner set (T-3551-25 / AMB-03) -- the existing PostToolUse
 * fingerprint hook plus lib/core/ambient-trigger.cjs -- and that a planted
 * second spawner is caught by the same scan (the negative control).
 *
 * Scan design: a FILE is a "spawner reference" only when it BOTH (a)
 * contains a quote- or slash-bounded reference to the literal filename
 * auto-explore-fire.cjs (never a log tag like [auto-explore-fire], never a
 * test-file name like test-auto-explore-fire.cjs, both of which lack that
 * exact bounded token) on a non-comment line, AND (b) contains a
 * spawn( / fork( / exec( / execFile( call on a non-comment line anywhere in
 * the same file. Both legs use hygiene-355's own nonCommentLines /
 * isPureLineComment so a doc-comment naming the file in prose never counts.
 *
 * hygiene-355 preamble (scrubVendorKey + installNetGuard BEFORE any repo
 * require, attempts() === 0 last -- Pitfall 16). House rule: hyphens only,
 * no em-dashes.
 */

const hygiene = require('./helpers/hygiene-355.cjs');
hygiene.scrubVendorKey();
const netGuard = hygiene.installNetGuard();

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

let checks = 0;
function ok(label) {
  checks += 1;
  console.log('  ok - ' + label);
}

console.log('test-3551-one-spawner:');

const REPO_ROOT = path.join(__dirname, '..');

// The pinned spawner set, sorted. lib/core/ambient-trigger.cjs is plan
// 355.1-06's own target file; it must exist and be pinned once shipped.
const PINNED_SPAWNER_SET = [
  'lib/core/ambient-trigger.cjs',
  'scripts/auto-explore-fingerprint.cjs',
].sort();

// A quote- or slash-bounded reference to the exact filename: excludes a log
// tag ([auto-explore-fire], no .cjs suffix) and a test-file name
// (test-auto-explore-fire.cjs, whose token is immediately preceded by a
// hyphen rather than a quote or a slash).
const FILENAME_REF_RE = /['"/]auto-explore-fire\.cjs['")]/;
// (Impl|Sync)? catches the module-level spawn seam idiom
// (spawnImpl(...) -- lib/core/ambient-trigger.cjs's own _internal test
// double swap point) alongside a direct spawn(/fork(/exec(/execFile( call,
// without loosening to a bare \w* that would also catch an unrelated
// execute(/executor( false positive.
const SPAWN_CALL_RE = /\b(spawn|fork|exec|execFile)(Impl|Sync)?\s*\(/;

function fileReferencesSpawner(fileAbs) {
  const lines = hygiene.nonCommentLines(fileAbs);
  const hasFilenameRef = lines.some(function (l) { return FILENAME_REF_RE.test(l); });
  const hasSpawnCall = lines.some(function (l) { return SPAWN_CALL_RE.test(l); });
  return hasFilenameRef && hasSpawnCall;
}

function scanDirs(dirs) {
  const found = [];
  for (const rel of dirs) {
    const abs = path.join(REPO_ROOT, rel);
    if (!fs.existsSync(abs)) continue;
    const files = hygiene.listFilesRecursive(abs).filter(function (f) {
      return f.endsWith('.cjs') || f.endsWith('.js');
    });
    for (const fileAbs of files) {
      if (fileReferencesSpawner(fileAbs)) {
        found.push(path.relative(REPO_ROOT, fileAbs));
      }
    }
  }
  return found;
}

try {
  // ---------------------------------------------------------------------
  // Leg: the pinned spawner set, exactly, across lib/, scripts/, hooks/, bin/
  // ---------------------------------------------------------------------
  (function test_pinnedSet() {
    const found = scanDirs(['lib', 'scripts', 'hooks', 'bin']).sort();
    assert.deepStrictEqual(found, PINNED_SPAWNER_SET,
      'the pinned spawner set must be exactly ' + JSON.stringify(PINNED_SPAWNER_SET) + ', found ' + JSON.stringify(found));
    ok('scanning lib/, scripts/, hooks/ and bin/ finds exactly the pinned spawner set: ' + PINNED_SPAWNER_SET.join(', '));
  })();

  // ---------------------------------------------------------------------
  // Leg: lib/core/ambient-trigger.cjs spawns nothing else (no cadence
  // runner, no discovery cycle, no python)
  // ---------------------------------------------------------------------
  (function test_ambientTriggerSpawnsNothingElse() {
    const abs = path.join(REPO_ROOT, 'lib', 'core', 'ambient-trigger.cjs');
    assert.ok(fs.existsSync(abs), 'lib/core/ambient-trigger.cjs must exist');
    const lines = hygiene.nonCommentLines(abs);
    const spawnLines = lines.filter(function (l) { return SPAWN_CALL_RE.test(l); });
    const forbidden = ['scout-cadence-runner', 'discovery-cycle', 'python'];
    for (const line of spawnLines) {
      for (const token of forbidden) {
        assert.strictEqual(line.indexOf(token), -1, 'lib/core/ambient-trigger.cjs must never spawn ' + token + ': ' + line.trim());
      }
    }
    assert.ok(spawnLines.length >= 1, 'lib/core/ambient-trigger.cjs must carry at least one spawn call (the one fire child)');
    ok('lib/core/ambient-trigger.cjs spawns nothing but the one fire child: no scout-cadence-runner, no discovery-cycle, no python');
  })();

  // ---------------------------------------------------------------------
  // Negative control: a scratch file under os.tmpdir() planting a second
  // spawner must be caught by the SAME scan when added to the file list.
  // ---------------------------------------------------------------------
  (function test_negativeControl() {
    const scratchDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-3551-one-spawner-negctrl-'));
    const scratchFile = path.join(scratchDir, 'planted-second-spawner.cjs');
    try {
      fs.writeFileSync(
        scratchFile,
        "'use strict';\nconst { spawn } = require('node:child_process');\nfunction fireAgain() {\n"
          + "  return spawn(process.execPath, [require.resolve('../scripts/auto-explore-fire.cjs')]);\n}\n"
          + 'module.exports = { fireAgain };\n',
        'utf8'
      );
      const caught = fileReferencesSpawner(scratchFile);
      assert.strictEqual(caught, true, 'a planted second spawner referencing auto-explore-fire.cjs plus a spawn( call must be caught by the scan');
      ok('a planted second-spawner negative control is caught by the same scan (PASS when caught)');
    } finally {
      fs.rmSync(scratchDir, { recursive: true, force: true });
    }
  })();
} finally {
  /* no room fixtures in this test; nothing to clean up beyond the scratch dir above */
}

console.log('');
console.log('PASS test-3551-one-spawner.cjs (' + checks + ' checks)');

assert.strictEqual(netGuard.attempts(), 0, 'installNetGuard must record zero fetch attempts (Pitfall 16)');
netGuard.restore();
