#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * lib/memory/stale-copy-scanner.test.cjs
 * --------------------------------------
 * Phase 121.5-05 Sub-plan F Task 2 acceptance tests.
 *
 * 8 test groups covering the stale-copy-scanner + class K wiring:
 *
 *   1. scanForStaleCopy() returns {violations: []} on a clean repo.
 *   2. Synthetic fixture: temp banner with "MindrianOS v1.12.0" hardcoded
 *      while current is v1.13.0 -> violations[].length >= 1 with kind
 *      === 'stale_version_hardcode'.
 *   3. Synthetic fixture: temp file with em-dash in greeting and
 *      em_dash_check: true -> violations[] with kind === 'em_dash_violation'.
 *   4. allowed_hardcoded_versions[] suppresses stale_version_hardcode hits.
 *   5. version_stamp_required: false skips stale_version_hardcode (but
 *      em_dash_check still applies if true).
 *   6. scanForStaleCopy({surfaces: [...]}) accepts an override.
 *   7. scripts/doctor.cjs --stale-first-touch invokes the scanner and the
 *      class K row appears in the human-readable output.
 *   8. scripts/doctor.cjs --all activates --stale-first-touch (class K
 *      participates in the cascade).
 *
 * Pure CJS, node built-ins only. No emoji. No em-dashes (the EM_DASH
 * literal used in Test 3 is written via the U+2014 escape sequence).
 */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const scanner = require(path.join(REPO_ROOT, 'lib', 'core', 'stale-copy-scanner.cjs'));

let passed = 0;
let failed = 0;
const failures = [];

function assert(name, cond, detail) {
  if (cond) {
    passed++;
    console.log('  PASS  ' + name);
  } else {
    failed++;
    failures.push({ name, detail });
    console.log('  FAIL  ' + name + (detail ? ' :: ' + detail : ''));
  }
}

function mkTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'stale-copy-scanner-'));
}

// EM DASH escape (U+2014). Used in synthetic fixtures to test the em-dash
// detector without putting a literal em-dash in this source file.
const EM_DASH = '\u2014';

// --- Test 1: clean repo -------------------------------------------------
{
  const result = scanner.scanForStaleCopy();
  assert(
    'Test 1: scanForStaleCopy() on live repo returns {valid: true, violations: []}',
    result.valid === true && Array.isArray(result.violations) && result.violations.length === 0,
    'violations=' + JSON.stringify(result.violations),
  );
}

// --- Test 2: stale version hardcode detected ----------------------------
{
  const tmp = mkTmpDir();
  const filePath = path.join(tmp, 'fake-banner');
  fs.writeFileSync(filePath, 'MindrianOS v1.12.0 welcome line\n', 'utf8');
  const fakeSurface = {
    id: 'banner',
    file: filePath,
    kind: 'shell_script',
    version_stamp_required: true,
    allowed_hardcoded_versions: [],
    em_dash_check: true,
  };
  const result = scanner.scanForStaleCopy({
    surfaces: [fakeSurface],
    currentVersion: '1.13.0',
    repoRoot: tmp,
  });
  const staleHits = result.violations.filter(v => v.kind === 'stale_version_hardcode');
  assert(
    'Test 2: stale v1.12.0 against current 1.13.0 fires stale_version_hardcode',
    staleHits.length >= 1 && staleHits[0].found === '1.12.0',
    'hits=' + JSON.stringify(staleHits),
  );
  fs.rmSync(tmp, { recursive: true, force: true });
}

// --- Test 3: em-dash violation detected ---------------------------------
{
  const tmp = mkTmpDir();
  const filePath = path.join(tmp, 'fake-greeting');
  fs.writeFileSync(filePath, 'MindrianOS v1.13.0 ' + EM_DASH + ' the surface\n', 'utf8');
  const fakeSurface = {
    id: 'splash',
    file: filePath,
    kind: 'command_md',
    version_stamp_required: true,
    allowed_hardcoded_versions: [],
    em_dash_check: true,
  };
  const result = scanner.scanForStaleCopy({
    surfaces: [fakeSurface],
    currentVersion: '1.13.0',
    repoRoot: tmp,
  });
  const emDashHits = result.violations.filter(v => v.kind === 'em_dash_violation');
  assert(
    'Test 3: U+2014 em-dash on em_dash_check surface fires em_dash_violation',
    emDashHits.length === 1 && emDashHits[0].surface === 'splash',
    'hits=' + JSON.stringify(emDashHits),
  );
  fs.rmSync(tmp, { recursive: true, force: true });
}

// --- Test 4: allowed_hardcoded_versions suppresses stale hits -----------
{
  const tmp = mkTmpDir();
  const filePath = path.join(tmp, 'fake-banner');
  // Two stale literals; only one is allowlisted.
  fs.writeFileSync(filePath, '# v1.4.0 and v1.5.1 are doc examples\n', 'utf8');
  const fakeSurface = {
    id: 'banner',
    file: filePath,
    kind: 'shell_script',
    version_stamp_required: true,
    allowed_hardcoded_versions: ['1.4.0', '1.5.1'],
    em_dash_check: false,
  };
  const result = scanner.scanForStaleCopy({
    surfaces: [fakeSurface],
    currentVersion: '1.13.0',
    repoRoot: tmp,
  });
  assert(
    'Test 4: allowlisted literals suppress stale_version_hardcode',
    result.valid === true && result.violations.length === 0,
    'violations=' + JSON.stringify(result.violations),
  );
  fs.rmSync(tmp, { recursive: true, force: true });
}

// --- Test 5: version_stamp_required: false skips stale-version-check ----
{
  const tmp = mkTmpDir();
  const filePath = path.join(tmp, 'fake-persona');
  // Both a stale version literal AND an em-dash. Surface declares
  // version_stamp_required: false (e.g. larry-extended persona file) and
  // em_dash_check: true. Only the em-dash should fire.
  fs.writeFileSync(filePath, 'v1.0.0 baseline ' + EM_DASH + ' persona\n', 'utf8');
  const fakeSurface = {
    id: 'larry-extended',
    file: filePath,
    kind: 'agent_md',
    version_stamp_required: false,
    allowed_hardcoded_versions: [],
    em_dash_check: true,
  };
  const result = scanner.scanForStaleCopy({
    surfaces: [fakeSurface],
    currentVersion: '1.13.0',
    repoRoot: tmp,
  });
  const staleHits = result.violations.filter(v => v.kind === 'stale_version_hardcode');
  const emDashHits = result.violations.filter(v => v.kind === 'em_dash_violation');
  assert(
    'Test 5a: version_stamp_required: false skips stale-version check',
    staleHits.length === 0,
    'staleHits=' + JSON.stringify(staleHits),
  );
  assert(
    'Test 5b: em_dash_check: true still fires when version_stamp_required: false',
    emDashHits.length === 1,
    'emDashHits=' + JSON.stringify(emDashHits),
  );
  fs.rmSync(tmp, { recursive: true, force: true });
}

// --- Test 6: opts.surfaces override accepted ----------------------------
{
  // Pass an empty surfaces[] and verify scanned_count reflects the override.
  const result = scanner.scanForStaleCopy({ surfaces: [], currentVersion: '1.13.0' });
  assert(
    'Test 6: opts.surfaces override accepted (empty list -> scanned_count 0)',
    result.scanned_count === 0 && result.valid === true,
    'result=' + JSON.stringify(result),
  );
}

// --- Test 7: doctor.cjs --stale-first-touch surfaces class K ------------
{
  let out = '';
  let err = null;
  try {
    out = execSync('node ' + JSON.stringify(path.join(REPO_ROOT, 'scripts', 'doctor.cjs')) + ' --stale-first-touch', {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      env: Object.assign({}, process.env, { COLUMNS: '120' }),
    });
  } catch (e) {
    err = e.message;
  }
  assert(
    'Test 7a: doctor.cjs --stale-first-touch runs without error',
    err === null,
    err || '',
  );
  assert(
    'Test 7b: output contains "class K stale-first-touch" row',
    /class K stale-first-touch/.test(out),
    'first 300 chars: ' + out.slice(0, 300),
  );
}

// --- Test 8: doctor.cjs --all activates class K -------------------------
{
  let out = '';
  let err = null;
  try {
    out = execSync('node ' + JSON.stringify(path.join(REPO_ROOT, 'scripts', 'doctor.cjs')) + ' --all --json', {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      env: Object.assign({}, process.env, { COLUMNS: '120' }),
    });
  } catch (e) {
    err = e.message;
  }
  let report;
  let parseErr = null;
  try { report = JSON.parse(out); } catch (e) { parseErr = e.message; }
  assert(
    'Test 8a: doctor.cjs --all --json parses',
    err === null && parseErr === null && report && typeof report === 'object',
    'err=' + err + ' parseErr=' + parseErr,
  );
  assert(
    'Test 8b: report.checks["stale-first-touch-copy"] present under --all',
    report && report.checks && report.checks['stale-first-touch-copy']
      && report.checks['stale-first-touch-copy'].class === 'K',
    'checks keys: ' + (report && report.checks ? Object.keys(report.checks).join(',') : 'n/a'),
  );
}

// --- Test 9 (Canon Part 8 check): scanner has no network / Brain surface ---
// Strip C-style block comments + line comments before scanning. The forbidden
// patterns should not appear in EXECUTABLE source -- doc strings that mention
// "no fetch / no Brain" are exactly what we want documented and must not
// trigger the audit.
{
  let scannerSource = fs.readFileSync(path.join(REPO_ROOT, 'lib', 'core', 'stale-copy-scanner.cjs'), 'utf8');
  scannerSource = scannerSource.replace(/\/\*[\s\S]*?\*\//g, ''); // strip /* ... */
  scannerSource = scannerSource.replace(/(^|[^:])\/\/[^\n]*/g, '$1'); // strip // ... (preserve :// in URLs, though we have none)
  const forbiddenPatterns = [
    { name: 'fetch(', re: /\bfetch\s*\(/ },
    { name: 'require https', re: /require\(['"]https?['"]\)/ },
    { name: 'brain client', re: /brain[._-]client/i },
    { name: 'brain url', re: /brain\.mindrian\.ai/i },
    { name: 'telemetry', re: /telemetry/i },
  ];
  let bad = null;
  for (const p of forbiddenPatterns) {
    if (p.re.test(scannerSource)) { bad = p.name; break; }
  }
  assert(
    'Test 9: scanner executable source has no fetch / http / Brain / telemetry surface (Canon Part 8 audit)',
    bad === null,
    'forbidden pattern matched: ' + bad,
  );
}

// --- Summary ------------------------------------------------------------
console.log('');
console.log('stale-copy-scanner.test.cjs: ' + passed + ' passed, ' + failed + ' failed');
if (failed > 0) {
  for (const f of failures) {
    console.log('  - ' + f.name + (f.detail ? ' :: ' + f.detail : ''));
  }
  process.exit(1);
}
process.exit(0);
