#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 355 (Hidden in Plain Sight: Jev-through-Theo cross-connection
 * engines) Plan 21 Task 2 (HIPS-10, AI-SPEC Section 5). In-process proof of
 * scripts/check-cross-connection-honesty.cjs's pass / degrade / fail paths,
 * driven with an injected spawnImpl (never a real child process for the
 * hermetic legs) and tmp copies of the rule-table provenance files, plus one
 * leg that spawns the real doctor --acceptance point end to end.
 *
 * Test hygiene contract (every 355 test): scrub TYPESAFE_API_KEY and install
 * the net guard via tests/helpers/hygiene-355.cjs BEFORE requiring any repo
 * module; assert attempts() === 0 as the last check.
 *
 * No em-dashes (CLAUDE.md HARD RULE). Hyphens only.
 */

'use strict';

const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const hygiene = require('./helpers/hygiene-355.cjs');

const hadKey = hygiene.scrubVendorKey();
const netGuard = hygiene.installNetGuard();

const REPO = path.join(__dirname, '..');
const checker = hygiene.makeChecker('test-355-doctor-point');
const { check } = checker;

const { checkCrossConnectionHonesty } = require(path.join(REPO, 'scripts', 'check-cross-connection-honesty.cjs'));

// ---------------------------------------------------------------------------
// Source-hygiene leg: never requires brain-client, never reads a vendor key,
// on a non-comment line (defense in depth, mirrors the Part 8 sweep idiom).
// ---------------------------------------------------------------------------
function checkSourceHygiene() {
  console.log('--- source hygiene: no brain-client, no vendor key ---');
  const abs = path.join(REPO, 'scripts', 'check-cross-connection-honesty.cjs');
  const lines = hygiene.nonCommentLines(abs);
  const brainClientHit = lines.some((l) => l.indexOf('brain-client') !== -1);
  const vendorKeyHit = lines.some((l) => l.indexOf('TYPESAFE_API_KEY') !== -1 || l.indexOf('MINDRIAN_BRAIN_KEY') !== -1);
  const fetchHit = lines.some((l) => /fetch\(/.test(l));
  check('check-cross-connection-honesty.cjs: no non-comment reference to brain-client', !brainClientHit);
  check('check-cross-connection-honesty.cjs: no non-comment reference to a vendor key', !vendorKeyHit);
  check('check-cross-connection-honesty.cjs: no fetch( call on a non-comment line', !fetchHit);
}

// ---------------------------------------------------------------------------
// In-process legs against the REAL repo, spawnImpl injected so no real child
// process ever runs. scripts/measure-hsi-thinking-mode.cjs exists in this
// repo; scripts/calibrate-citation-check.cjs does not (355-26 has not
// landed) -- exercising the "missing script -> not_run" degrade for free.
// data/hsi-thinking-mode-rules.json does not exist in this repo either --
// exercising the "no rule table -> not_run" degrade for free.
// ---------------------------------------------------------------------------
function makeSpawnImpl(status) {
  const calls = [];
  function spawnImpl(cmd, args, opts) {
    calls.push({ cmd, args, opts });
    return { status };
  }
  spawnImpl.calls = calls;
  return spawnImpl;
}

async function runRealRepoLegs() {
  console.log('--- in-process legs against the real repo (injected spawnImpl) ---');

  // exit 0: the one existing replay script passes; the absent one and the
  // absent rule table both degrade to not_run. Overall ok: true.
  {
    const spawnImpl = makeSpawnImpl(0);
    const result = await checkCrossConnectionHonesty({ repoRoot: REPO, spawnImpl });
    check('exit 0: overall ok true', result.ok === true, JSON.stringify(result));
    check('exit 0: finding null', result.finding === null, JSON.stringify(result.finding));
    check('exit 0: spawnImpl was invoked exactly once (only the one existing script)', spawnImpl.calls.length === 1, 'got ' + spawnImpl.calls.length);
    check('exit 0: the invoked script is measure-hsi-thinking-mode.cjs --check', spawnImpl.calls[0].args.some((a) => String(a).indexOf('measure-hsi-thinking-mode.cjs') !== -1) && spawnImpl.calls[0].args.indexOf('--check') !== -1);
    check('exit 0: detail.replays names calibrate-citation-check.cjs as not_run (missing script)', result.detail && result.detail.replays && result.detail.replays['calibrate-citation-check.cjs'] && result.detail.replays['calibrate-citation-check.cjs'].status === 'not_run');
    check('exit 0: detail.rule_table is not_run (no data/hsi-thinking-mode-rules.json in this repo)', result.detail && result.detail.rule_table && result.detail.rule_table.status === 'not_run');
  }

  // exit 77: the existing replay script reports "no record on this machine
  // yet" -- an honest not_run, not a failure.
  {
    const spawnImpl = makeSpawnImpl(77);
    const result = await checkCrossConnectionHonesty({ repoRoot: REPO, spawnImpl });
    check('exit 77: overall ok true (a missing record is an honest not_run, never a failure)', result.ok === true, JSON.stringify(result));
    check('exit 77: detail.replays names the existing script as not_run', result.detail && result.detail.replays && result.detail.replays['measure-hsi-thinking-mode.cjs'] && result.detail.replays['measure-hsi-thinking-mode.cjs'].status === 'not_run');
  }

  // exit 1: a genuine replay mismatch fails the whole point, and the
  // finding names which check failed.
  {
    const spawnImpl = makeSpawnImpl(1);
    const result = await checkCrossConnectionHonesty({ repoRoot: REPO, spawnImpl });
    check('exit 1: overall ok false', result.ok === false, JSON.stringify(result));
    check("exit 1: finding is a scalar string starting 'cross-connection-honesty: '", typeof result.finding === 'string' && result.finding.indexOf('cross-connection-honesty:') === 0, result.finding);
    check('exit 1: finding names the failing check', result.finding.indexOf('measure-hsi-thinking-mode.cjs') !== -1, result.finding);
  }
}

// ---------------------------------------------------------------------------
// Tmp-copy legs for the rule-table provenance cases: a scratch repoRoot
// carrying ONLY data/hsi-thinking-mode-rules.json and
// tests/fixtures/355-hsi-measurement-record.json (no scripts/ dir at all,
// so the replay-check leg degrades to not_run x2 automatically and cannot
// interfere with the provenance assertion).
// ---------------------------------------------------------------------------
function makeProvenanceScratchRoot(rulesShape, recordShape) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-355-21-provenance-'));
  fs.mkdirSync(path.join(root, 'data'), { recursive: true });
  fs.mkdirSync(path.join(root, 'tests', 'fixtures'), { recursive: true });
  fs.writeFileSync(path.join(root, 'data', 'hsi-thinking-mode-rules.json'), JSON.stringify(rulesShape));
  fs.writeFileSync(path.join(root, 'tests', 'fixtures', '355-hsi-measurement-record.json'), JSON.stringify(recordShape));
  return {
    root,
    cleanup() {
      try { fs.rmSync(root, { recursive: true, force: true }); } catch (_e) { /* best-effort */ }
    },
  };
}

async function runProvenanceLegs() {
  console.log('--- rule-table provenance legs (tmp copies) ---');

  // Matching provenance: overall ok true.
  {
    const scratch = makeProvenanceScratchRoot(
      { jev_model: 'jev-1.13.0', fixture_sha256: 'abc123' },
      { jev_model: 'jev-1.13.0', fixture_sha256: 'abc123' }
    );
    try {
      const spawnImpl = makeSpawnImpl(0);
      const result = await checkCrossConnectionHonesty({ repoRoot: scratch.root, spawnImpl });
      check('provenance match: overall ok true', result.ok === true, JSON.stringify(result));
      check('provenance match: detail.rule_table status ok', result.detail && result.detail.rule_table && result.detail.rule_table.status === 'ok');
      check('provenance match: zero spawnImpl calls (no scripts/ dir in the scratch root)', spawnImpl.calls.length === 0, 'got ' + spawnImpl.calls.length);
    } finally {
      scratch.cleanup();
    }
  }

  // Mismatching provenance (fixture_sha256 drift): overall ok false, finding
  // names the mismatch.
  {
    const scratch = makeProvenanceScratchRoot(
      { jev_model: 'jev-1.13.0', fixture_sha256: 'abc123' },
      { jev_model: 'jev-1.13.0', fixture_sha256: 'DIFFERENT' }
    );
    try {
      const spawnImpl = makeSpawnImpl(0);
      const result = await checkCrossConnectionHonesty({ repoRoot: scratch.root, spawnImpl });
      check('provenance mismatch (fixture_sha256): overall ok false', result.ok === false, JSON.stringify(result));
      check('provenance mismatch (fixture_sha256): finding names the provenance mismatch', /provenance/i.test(result.finding), result.finding);
    } finally {
      scratch.cleanup();
    }
  }

  // Mismatching provenance (jev_model drift): overall ok false.
  {
    const scratch = makeProvenanceScratchRoot(
      { jev_model: 'jev-1.13.0', fixture_sha256: 'abc123' },
      { jev_model: 'jev-1.14.0', fixture_sha256: 'abc123' }
    );
    try {
      const spawnImpl = makeSpawnImpl(0);
      const result = await checkCrossConnectionHonesty({ repoRoot: scratch.root, spawnImpl });
      check('provenance mismatch (jev_model): overall ok false', result.ok === false, JSON.stringify(result));
    } finally {
      scratch.cleanup();
    }
  }
}

// ---------------------------------------------------------------------------
// The real doctor --acceptance point, spawned end to end. Hermetic HOME per
// the self-coverage test's own envelope; DOCTOR_TEST_ONLY_POINTS scopes the
// run to exactly this one point so no unrelated install-state seeding is
// needed.
// ---------------------------------------------------------------------------
function runDoctorAcceptance(extraEnv) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-355-21-doctor-home-'));
  try {
    const env = Object.assign({}, process.env, {
      HOME: home,
      USERPROFILE: home,
      MINDRIAN_PLUGIN_HOME: path.join(home, '.claude', 'plugins'),
      DOCTOR_TEST_MODE: '1',
      DOCTOR_TEST_ONLY_POINTS: 'cross-connection-honesty',
    }, extraEnv || {});
    delete env.CLAUDE_DESKTOP;
    delete env.MINDRIAN_OS_ROOT;
    const args = [path.join(REPO, 'scripts', 'doctor.cjs'), '--acceptance', '--pre-tag', '--json'];
    const r = spawnSync('node', args, { env, encoding: 'utf8', timeout: 300000 });
    let json = null;
    if (r.stdout) {
      const start = r.stdout.indexOf('{');
      if (start !== -1) {
        try { json = JSON.parse(r.stdout.slice(start)); } catch (_e) { /* leave null */ }
      }
    }
    return { r, json };
  } finally {
    try { fs.rmSync(home, { recursive: true, force: true }); } catch (_e) { /* best-effort */ }
  }
}

function findPoint(json, id) {
  const pts = json && json.points;
  if (!Array.isArray(pts)) return null;
  return pts.find((p) => p.id === id);
}

function runDoctorAcceptanceLegs() {
  console.log('--- the real doctor --acceptance point, spawned end to end ---');

  {
    const { r, json } = runDoctorAcceptance({ DOCTOR_TEST_FAIL_POINT: 'cross-connection-honesty' });
    check('DOCTOR_TEST_FAIL_POINT=cross-connection-honesty: doctor --acceptance --json produced parseable JSON', !!json, 'stdout: ' + String(r.stdout || '').slice(0, 300) + ' stderr: ' + String(r.stderr || '').slice(0, 300));
    const point = findPoint(json, 'cross-connection-honesty');
    check('DOCTOR_TEST_FAIL_POINT=cross-connection-honesty: the checklist carries a cross-connection-honesty entry', !!point, JSON.stringify(json && json.points));
    check('DOCTOR_TEST_FAIL_POINT=cross-connection-honesty: that entry has ok false', !!point && point.ok === false, JSON.stringify(point));
  }

  {
    const { r, json } = runDoctorAcceptance({ DOCTOR_SKIP_CROSS_CONNECTION: '1' });
    check('DOCTOR_SKIP_CROSS_CONNECTION=1: doctor --acceptance --json produced parseable JSON', !!json, 'stdout: ' + String(r.stdout || '').slice(0, 300) + ' stderr: ' + String(r.stderr || '').slice(0, 300));
    const point = findPoint(json, 'cross-connection-honesty');
    check('DOCTOR_SKIP_CROSS_CONNECTION=1: that entry has ok true', !!point && point.ok === true, JSON.stringify(point));
    check('DOCTOR_SKIP_CROSS_CONNECTION=1: that entry\'s detail is skipped', !!point && point.detail && point.detail.skipped === true, JSON.stringify(point));
  }
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

(async () => {
  try {
    checkSourceHygiene();
    await runRealRepoLegs();
    await runProvenanceLegs();
    runDoctorAcceptanceLegs();
  } finally {
    check('installNetGuard: zero fetch attempts', netGuard.attempts() === 0);
    netGuard.restore();
    console.log('scrubVendorKey found a pre-set TYPESAFE_API_KEY: ' + hadKey);
    process.exit(checker.summary());
  }
})();
