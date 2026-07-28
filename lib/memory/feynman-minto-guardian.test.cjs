#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 88-13 -- Feynman-MINTO guardian tests
 * ============================================
 * 18 tests: 10 core + 3 registry + 3 lifecycle validators + 2 Phase 241 F-2
 * enqueue-reachability legs.
 *
 * Core (1-10):
 *   1. session-start: critical violation enqueues debouncer regen, exits 0.
 *   2. session-start: all-valid rooms produce no enqueue, exit 0.
 *   3. on-stop: invariant violations write .mindrian/invariant-report.json.
 *   4. pre-commit (Phase 241 F-3): advisory by default -- error/critical
 *      severity exits 0, stderr carries violation text + a counted WARN
 *      naming the restore path; --strict / MINTO_PRECOMMIT_STRICT=1 restores
 *      the pre-241 hard-fail contract, exit 2.
 *   5. pre-commit: valid MINTO exits 0.
 *   6. clean-tmp: stale tmp > 60s deleted, fresh tmp preserved.
 *   7. clean-tmp: no tmp files -> no-op exit 0.
 *   8. advisory-not-blocking at runtime: session-start + on-stop NEVER exit 2.
 *   9. performance: 50-section fixture in session-start mode under 2000ms.
 *  10. missing lib/core/feynman-minto-invariants.cjs (simulate via hidden
 *      validators dir) -> guardian exits 0, skips validation.
 *
 * Registry (11-13):
 *  11. Registry load: minto-invariants + fixture test-warning validator
 *      both register; aggregated violations tagged with validator ids.
 *  12. Registry fail-open: malformed validator (missing validate export)
 *      logged to stderr, skipped, other validators still run.
 *  13. Registry id collision: two validators same id -> first wins,
 *      second skipped, stderr warns.
 *
 * Lifecycle validators (14-16):
 *  14. snapshot-integrity: missing section -> warning; empty snapshot
 *      with sections on disk -> error; missing file -> no violation;
 *      full snapshot -> no violation.
 *  15. queue-health: <500 entries healthy; 500-999 warning; >=1000 error
 *      with exactly ONE aggregate violation per invocation.
 *  16. stale-lifecycle: ghost (stale.json lists valid MINTO) -> warning;
 *      real staleness -> no new violation; on-stop mode prunes ghosts
 *      atomically from stale.json.
 *
 * Phase 241 F-2 enqueue-reachability legs (17-18):
 *  17. missing MINTO.md aggregates to critical and reaches
 *      runSessionStart's enqueue gate, landing a real
 *      .mindrian/minto-queue.json entry with reason guardian:critical-repair.
 *  18. missing/empty governing_thought (MINTO.md otherwise valid) does the
 *      same, in a separate room so the debouncer's 10s coalesce window
 *      cannot merge the two enqueues.
 */

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const GUARDIAN = path.join(REPO_ROOT, 'scripts', 'feynman-minto-guardian.cjs');

const TMPDIRS = [];
function mkTmp(prefix) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  TMPDIRS.push(d);
  return d;
}
process.on('exit', () => {
  for (const d of TMPDIRS) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) {}
  }
});

/**
 * Seed a minimal room with .mindrian and zero+ sections each having ROOM.md.
 * Returns { roomDir }. Set writeMintoOpts[sectionName] = { stale: bool,
 * valid: bool, governing: string } to produce a MINTO.md per section.
 */
function seedRoom(tmp, sections, mintoOpts) {
  const roomDir = path.join(tmp, 'venture');
  fs.mkdirSync(roomDir, { recursive: true });
  fs.writeFileSync(path.join(roomDir, '.room-root'), '');
  fs.mkdirSync(path.join(roomDir, '.mindrian'), { recursive: true });
  for (const s of sections) {
    const dir = path.join(roomDir, s);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'ROOM.md'), '# ' + s + '\n\nIdentity.\n');
    if (mintoOpts && mintoOpts[s] === 'skip') continue;
    if (mintoOpts && typeof mintoOpts[s] === 'object') {
      writeMinto(dir, mintoOpts[s]);
    }
  }
  return { roomDir };
}

function writeMinto(sectionDir, opts) {
  const o = opts || {};
  const last = o.stale ? '1970-01-01T00:00:00Z' : new Date().toISOString();
  const gt = o.governing || 'Governing thought placeholder.';
  if (o.invalid === 'missing_frontmatter') {
    fs.writeFileSync(path.join(sectionDir, 'MINTO.md'), '# broken\n');
    return;
  }
  if (o.invalid === 'bad_schema') {
    // Missing governing_thought + schema_version (both critical/error)
    fs.writeFileSync(
      path.join(sectionDir, 'MINTO.md'),
      '---\nsome_field: "value"\n---\n\nbody\n'
    );
    return;
  }
  if (o.invalid === 'critical_tmp_marker') {
    // Orphan FEYNMINTO_TMP marker triggers atomicity/critical per 88-00-B.
    fs.writeFileSync(
      path.join(sectionDir, 'MINTO.md'),
      '---\nschema_version: "1.0"\ngoverning_thought: "placeholder"\n---\n# FEYNMINTO_TMP\nBody.\n'
    );
    return;
  }
  if (o.invalid === 'zero_bytes') {
    // Zero-byte file triggers existence/critical per 88-00-B.
    fs.writeFileSync(path.join(sectionDir, 'MINTO.md'), '');
    return;
  }
  const frontmatter = [
    '---',
    'schema_version: "1.0"',
    'governing_thought: "' + gt + '"',
    'last_generated_at: "' + last + '"',
    'last_artifact_write_seen_at: "' + last + '"',
    'reasoning_health_score: 0.75',
    '---',
    '',
    '# Body',
    '',
    'Content.',
    '',
  ].join('\n');
  fs.writeFileSync(path.join(sectionDir, 'MINTO.md'), frontmatter);
}

function runGuardian(mode, roomDir, extraEnv, extraArgs) {
  const args = [GUARDIAN, mode, roomDir];
  if (Array.isArray(extraArgs)) for (const a of extraArgs) args.push(a);
  return spawnSync(process.execPath, args, {
    env: Object.assign({}, process.env, extraEnv || {}),
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 10000,
  });
}

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

// ---------------------------------------------------------------------------
// Test 1: session-start critical -> enqueue regen
// ---------------------------------------------------------------------------
test('Test 1: session-start mode enqueues regen on critical violation', () => {
  const tmp = mkTmp('gm-t1-');
  const fx = seedRoom(tmp, ['market-analysis'], {
    'market-analysis': { invalid: 'critical_tmp_marker' },
  });
  const res = runGuardian('session-start', fx.roomDir);
  assert.equal(res.status, 0, 'session-start exits 0; stderr=' + res.stderr);
  const queuePath = path.join(fx.roomDir, '.mindrian', 'minto-queue.json');
  assert.ok(fs.existsSync(queuePath), 'queue file must exist after enqueue');
  const q = JSON.parse(fs.readFileSync(queuePath, 'utf8'));
  assert.ok(Array.isArray(q.entries), 'entries is array');
  const sections = q.entries.map(function (e) { return e.section; });
  assert.ok(
    sections.indexOf('market-analysis') !== -1,
    'market-analysis enqueued; got ' + JSON.stringify(sections)
  );
});

// ---------------------------------------------------------------------------
// Test 2: session-start all-valid -> no enqueue
// ---------------------------------------------------------------------------
test('Test 2: session-start with all-valid MINTOs produces no enqueue', () => {
  const tmp = mkTmp('gm-t2-');
  const fx = seedRoom(tmp, ['problem-definition'], {
    'problem-definition': { governing: 'All clear.' },
  });
  const res = runGuardian('session-start', fx.roomDir);
  assert.equal(res.status, 0, 'exit 0');
  const queuePath = path.join(fx.roomDir, '.mindrian', 'minto-queue.json');
  if (fs.existsSync(queuePath)) {
    const q = JSON.parse(fs.readFileSync(queuePath, 'utf8'));
    // queue may exist but should have zero entries for this section
    const names = (q.entries || []).map(function (e) { return e.section; });
    assert.ok(
      names.indexOf('problem-definition') === -1,
      'problem-definition NOT enqueued; got ' + JSON.stringify(names)
    );
  }
});

// ---------------------------------------------------------------------------
// Test 3: on-stop -> writes invariant-report.json
// ---------------------------------------------------------------------------
test('Test 3: on-stop writes .mindrian/invariant-report.json on violations', () => {
  const tmp = mkTmp('gm-t3-');
  const fx = seedRoom(tmp, ['solution-design'], {
    'solution-design': { invalid: 'missing_frontmatter' },
  });
  const res = runGuardian('on-stop', fx.roomDir);
  assert.equal(res.status, 0, 'on-stop exits 0 (advisory)');
  const reportPath = path.join(fx.roomDir, '.mindrian', 'invariant-report.json');
  assert.ok(
    fs.existsSync(reportPath),
    'invariant-report.json exists after on-stop'
  );
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  assert.equal(report.version, 1);
  assert.equal(report.kind, 'on-stop');
  assert.ok(report.sections && typeof report.sections === 'object');
  assert.ok(
    report.sections['solution-design'],
    'solution-design entry in report'
  );
  assert.ok(
    Array.isArray(report.sections['solution-design'].violations) &&
      report.sections['solution-design'].violations.length > 0,
    'violations non-empty'
  );
});

// ---------------------------------------------------------------------------
// Test 4: pre-commit (Phase 241 F-3) -- advisory by default, --strict /
// MINTO_PRECOMMIT_STRICT=1 restores the pre-241 hard-fail contract
// ---------------------------------------------------------------------------
test('Test 4: pre-commit is advisory by default; --strict / env restores exit 2', () => {
  // 4a: default (no strict flag, no env) -- exit 0, stderr enumerates the
  // violation AND carries a counted WARN naming the restore path. An exit 0
  // with empty stderr would be the silent no-op this phase's threat model
  // (T-241-15) explicitly rejects.
  {
    const tmp = mkTmp('gm-t4a-');
    const fx = seedRoom(tmp, ['market-analysis'], {
      'market-analysis': { invalid: 'bad_schema' },
    });
    // pre-commit reads `git diff --cached --name-only`. We simulate by
    // setting GUARDIAN_PRECOMMIT_STAGED env var (fallback used when no
    // git). Guardian must honor this env for testability -- see spec step 5
    // (pre-commit).
    const res = runGuardian('pre-commit', fx.roomDir, {
      GUARDIAN_PRECOMMIT_STAGED: 'market-analysis/artifact-01.md',
    });
    assert.equal(res.status, 0, 'pre-commit advisory default exits 0; stderr=' + res.stderr);
    const stderr = (res.stderr || '').toString();
    assert.ok(stderr.length > 0, 'stderr carries violation message (got empty)');
    assert.match(stderr, /\d+ violation/, 'stderr carries a counted WARN line');
    assert.match(stderr, /MINTO_PRECOMMIT_STRICT/, 'stderr names the env restore path');
    assert.match(stderr, /--strict/, 'stderr names the --strict restore path');
  }
  // 4b: MINTO_PRECOMMIT_STRICT=1 -- exit 2, the pre-241 hard-fail contract.
  {
    const tmp = mkTmp('gm-t4b-');
    const fx = seedRoom(tmp, ['market-analysis'], {
      'market-analysis': { invalid: 'bad_schema' },
    });
    const res = runGuardian('pre-commit', fx.roomDir, {
      GUARDIAN_PRECOMMIT_STAGED: 'market-analysis/artifact-01.md',
      MINTO_PRECOMMIT_STRICT: '1',
    });
    assert.equal(res.status, 2, 'MINTO_PRECOMMIT_STRICT=1 restores exit 2; stderr=' + res.stderr);
    const stderr = (res.stderr || '').toString();
    assert.ok(stderr.length > 0, 'strict stderr carries violation message (got empty)');
  }
  // 4c: --strict argv flag -- same restore path, exit 2.
  {
    const tmp = mkTmp('gm-t4c-');
    const fx = seedRoom(tmp, ['market-analysis'], {
      'market-analysis': { invalid: 'bad_schema' },
    });
    const res = runGuardian('pre-commit', fx.roomDir, {
      GUARDIAN_PRECOMMIT_STAGED: 'market-analysis/artifact-01.md',
    }, ['--strict']);
    assert.equal(res.status, 2, '--strict restores exit 2; stderr=' + res.stderr);
  }
});

// ---------------------------------------------------------------------------
// Test 5: pre-commit valid MINTO -> exit 0
// ---------------------------------------------------------------------------
test('Test 5: pre-commit exits 0 when MINTO is valid', () => {
  const tmp = mkTmp('gm-t5-');
  const fx = seedRoom(tmp, ['market-analysis'], {
    'market-analysis': { governing: 'Clean.' },
  });
  const res = runGuardian('pre-commit', fx.roomDir, {
    GUARDIAN_PRECOMMIT_STAGED: 'market-analysis/artifact-01.md',
  });
  assert.equal(res.status, 0, 'pre-commit exits 0; stderr=' + res.stderr);
});

// ---------------------------------------------------------------------------
// Test 6: clean-tmp removes stale > 60s tmp files, preserves fresh ones
// ---------------------------------------------------------------------------
test('Test 6: clean-tmp removes stale tmp > 60s, preserves fresh tmp', () => {
  const tmp = mkTmp('gm-t6-');
  const fx = seedRoom(tmp, ['competitive-analysis'], {
    'competitive-analysis': { governing: 'Competitive.' },
  });
  const secDir = path.join(fx.roomDir, 'competitive-analysis');
  const stale = path.join(secDir, 'MINTO.md.tmp.12345.minto');
  const fresh = path.join(secDir, 'MINTO.md.tmp.67890.minto');
  fs.writeFileSync(stale, 'stale content');
  fs.writeFileSync(fresh, 'fresh content');
  // Backdate stale to 120s ago
  const past = Date.now() - 120 * 1000;
  fs.utimesSync(stale, past / 1000, past / 1000);
  // fresh stays now
  const res = runGuardian('clean-tmp', fx.roomDir);
  assert.equal(res.status, 0, 'clean-tmp exits 0');
  assert.ok(!fs.existsSync(stale), 'stale tmp deleted');
  assert.ok(fs.existsSync(fresh), 'fresh tmp preserved');
});

// ---------------------------------------------------------------------------
// Test 7: clean-tmp no tmp files -> exit 0 no-op
// ---------------------------------------------------------------------------
test('Test 7: clean-tmp no-op when no tmp files present', () => {
  const tmp = mkTmp('gm-t7-');
  const fx = seedRoom(tmp, ['team-execution'], {
    'team-execution': { governing: 'Team clean.' },
  });
  const res = runGuardian('clean-tmp', fx.roomDir);
  assert.equal(res.status, 0, 'clean-tmp no-op exits 0');
});

// ---------------------------------------------------------------------------
// Test 8: advisory-not-blocking at runtime (session-start + on-stop never 2)
// ---------------------------------------------------------------------------
test('Test 8: session-start + on-stop never exit 2 on critical violations', () => {
  const tmp = mkTmp('gm-t8-');
  const fx = seedRoom(tmp, ['a', 'b', 'c'], {
    a: { invalid: 'bad_schema' },
    b: { invalid: 'missing_frontmatter' },
    c: { invalid: 'missing_frontmatter' },
  });
  const r1 = runGuardian('session-start', fx.roomDir);
  assert.ok(r1.status === 0, 'session-start exits 0 despite criticals; got ' + r1.status);
  const r2 = runGuardian('on-stop', fx.roomDir);
  assert.ok(r2.status === 0, 'on-stop exits 0 despite criticals; got ' + r2.status);
});

// ---------------------------------------------------------------------------
// Test 9: 50-section fixture session-start under 2000ms
// ---------------------------------------------------------------------------
test('Test 9: 50-section fixture session-start completes under 2000ms', () => {
  const tmp = mkTmp('gm-t9-');
  const sections = [];
  const opts = {};
  for (let i = 0; i < 50; i++) {
    const s = 'sec-' + String(i).padStart(2, '0');
    sections.push(s);
    opts[s] = { governing: 'All good ' + i + '.' };
  }
  const fx = seedRoom(tmp, sections, opts);
  const t0 = Date.now();
  const res = runGuardian('session-start', fx.roomDir);
  const elapsed = Date.now() - t0;
  assert.equal(res.status, 0, 'exit 0');
  assert.ok(
    elapsed < 2000,
    '50-section session-start under 2000ms; got ' + elapsed + 'ms'
  );
});

// ---------------------------------------------------------------------------
// Test 10: missing invariants module (simulated via override env) -> exit 0
// ---------------------------------------------------------------------------
test('Test 10: missing invariants module: guardian logs + exits 0', () => {
  const tmp = mkTmp('gm-t10-');
  const fx = seedRoom(tmp, ['problem-definition'], {
    'problem-definition': { governing: 'Clean.' },
  });
  // Point validator registry at an empty directory so minto-invariants does
  // not load. Guardian should still exit 0 (no validators = no violations).
  const emptyDir = path.join(tmp, 'empty-validators');
  fs.mkdirSync(emptyDir);
  const res = runGuardian('session-start', fx.roomDir, {
    GUARDIAN_VALIDATORS_DIR: emptyDir,
  });
  assert.equal(res.status, 0, 'guardian exits 0 when invariants absent');
});

// ---------------------------------------------------------------------------
// Test 11: registry loads seed validators + fixture test-warning
// ---------------------------------------------------------------------------
test('Test 11: registry aggregates violations from multiple validators', () => {
  const tmp = mkTmp('gm-t11-');
  const fx = seedRoom(tmp, ['market-analysis'], {
    'market-analysis': { invalid: 'bad_schema' },
  });
  // Create a fixture validators dir containing the real minto-invariants
  // plus a test-warning validator. Guardian aggregates both.
  const vdir = path.join(tmp, 'validators');
  fs.mkdirSync(vdir);
  // Seed validator 1: copy minto-invariants.cjs content (point at absolute
  // invariants path so the copy can resolve it).
  const MIV = path.join(REPO_ROOT, 'lib', 'memory', 'validators', 'minto-invariants.cjs');
  // Test assumes guardian ships minto-invariants.cjs in the real validators
  // dir. We load it here via absolute path so the test fixture uses the
  // same code.
  fs.writeFileSync(
    path.join(vdir, '01-minto-invariants.cjs'),
    "module.exports = require(" + JSON.stringify(MIV) + ");\n"
  );
  fs.writeFileSync(
    path.join(vdir, '02-test-warning.cjs'),
    "'use strict';\n" +
    "module.exports = {\n" +
    "  id: 'test-warning',\n" +
    "  severity_map: { critical:3, error:2, warning:1, info:0 },\n" +
    "  validate: function(sectionDir) {\n" +
    "    return { severity: 'warning', violations: [{\n" +
    "      validator: 'test-warning',\n" +
    "      category: 'test',\n" +
    "      severity: 'warning',\n" +
    "      message: 'synthetic test warning for section ' + require('path').basename(sectionDir)\n" +
    "    }] };\n" +
    "  }\n" +
    "};\n"
  );
  const res = runGuardian('on-stop', fx.roomDir, {
    GUARDIAN_VALIDATORS_DIR: vdir,
  });
  assert.equal(res.status, 0, 'on-stop exits 0');
  const reportPath = path.join(fx.roomDir, '.mindrian', 'invariant-report.json');
  assert.ok(fs.existsSync(reportPath), 'report exists');
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  const viol = report.sections['market-analysis'].violations;
  const ids = viol.map(function (v) { return v.validator; });
  assert.ok(
    ids.indexOf('minto-invariants') !== -1,
    'minto-invariants present; got ' + JSON.stringify(ids)
  );
  assert.ok(
    ids.indexOf('test-warning') !== -1,
    'test-warning present; got ' + JSON.stringify(ids)
  );
});

// ---------------------------------------------------------------------------
// Test 12: registry fail-open on malformed validator
// ---------------------------------------------------------------------------
test('Test 12: malformed validator logged + skipped, guardian exits 0', () => {
  const tmp = mkTmp('gm-t12-');
  const fx = seedRoom(tmp, ['market-analysis'], {
    'market-analysis': { governing: 'Clean.' },
  });
  const vdir = path.join(tmp, 'validators');
  fs.mkdirSync(vdir);
  const MIV = path.join(REPO_ROOT, 'lib', 'memory', 'validators', 'minto-invariants.cjs');
  fs.writeFileSync(
    path.join(vdir, '01-minto-invariants.cjs'),
    "module.exports = require(" + JSON.stringify(MIV) + ");\n"
  );
  // Missing validate export
  fs.writeFileSync(
    path.join(vdir, '02-bad-missing-validate.cjs'),
    "module.exports = { id: 'bad-missing-validate', severity_map: {} };\n"
  );
  // Throws at require time
  fs.writeFileSync(
    path.join(vdir, '03-bad-throws-at-require.cjs'),
    "throw new Error('boom at require time');\n"
  );
  const res = runGuardian('session-start', fx.roomDir, {
    GUARDIAN_VALIDATORS_DIR: vdir,
  });
  assert.equal(res.status, 0, 'exits 0 despite malformed validators');
  const stderr = (res.stderr || '').toString();
  assert.ok(
    stderr.indexOf('bad-missing-validate') !== -1 ||
      stderr.indexOf('02-bad-missing-validate') !== -1,
    'stderr warns about missing validate; got: ' + stderr
  );
  assert.ok(
    stderr.indexOf('bad-throws-at-require') !== -1 ||
      stderr.indexOf('03-bad-throws-at-require') !== -1,
    'stderr warns about require-time throw; got: ' + stderr
  );
});

// ---------------------------------------------------------------------------
// Test 13: id collision -> first wins, second skipped, stderr warns
// ---------------------------------------------------------------------------
test('Test 13: id collision: first-loaded wins, duplicate skipped + warned', () => {
  const tmp = mkTmp('gm-t13-');
  const fx = seedRoom(tmp, ['market-analysis'], {
    'market-analysis': { governing: 'Clean.' },
  });
  const vdir = path.join(tmp, 'validators');
  fs.mkdirSync(vdir);
  fs.writeFileSync(
    path.join(vdir, '01-a.cjs'),
    "module.exports = { id: 'dup', severity_map: {}, validate: function(){ return {severity:null, violations:[]}; } };\n"
  );
  fs.writeFileSync(
    path.join(vdir, '02-b.cjs'),
    "module.exports = { id: 'dup', severity_map: {}, validate: function(){ return {severity:null, violations:[]}; } };\n"
  );
  const res = runGuardian('session-start', fx.roomDir, {
    GUARDIAN_VALIDATORS_DIR: vdir,
  });
  assert.equal(res.status, 0, 'exits 0 despite id collision');
  const stderr = (res.stderr || '').toString();
  assert.ok(
    stderr.indexOf('dup') !== -1 || stderr.indexOf('collision') !== -1,
    'stderr warns about id collision; got: ' + stderr
  );
});

// ---------------------------------------------------------------------------
// Test 14: snapshot-integrity validator (partial + empty + healthy + missing)
// ---------------------------------------------------------------------------
test('Test 14: snapshot-integrity detects partial/empty/healthy/missing', () => {
  // Test 14a: missing snapshot -> no violation
  {
    const tmp = mkTmp('gm-t14a-');
    const fx = seedRoom(tmp, ['a'], { a: { governing: 'clean' } });
    const res = runGuardian('on-stop', fx.roomDir);
    assert.equal(res.status, 0);
    const reportPath = path.join(fx.roomDir, '.mindrian', 'invariant-report.json');
    // Missing snapshot file is healthy first-session; no violations from
    // snapshot-integrity. Report may or may not exist depending on other
    // validators' output (likely none for a clean MINTO).
    if (fs.existsSync(reportPath)) {
      const r = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
      const all = Object.values(r.sections || {}).flatMap(function (s) { return s.violations || []; });
      const snap = all.filter(function (v) { return v.validator === 'snapshot-integrity'; });
      assert.equal(snap.length, 0, 'no snapshot-integrity violations for missing snapshot');
    }
  }
  // Test 14b: partial snapshot -> warning per missing section
  {
    const tmp = mkTmp('gm-t14b-');
    const fx = seedRoom(tmp, ['a', 'b', 'c'], {
      a: { governing: 'a' }, b: { governing: 'b' }, c: { governing: 'c' },
    });
    const snap = {
      version: 1,
      sections: { a: {}, b: {} }, // c missing
    };
    fs.writeFileSync(
      path.join(fx.roomDir, '.mindrian', 'session-snapshot.json'),
      JSON.stringify(snap)
    );
    const res = runGuardian('on-stop', fx.roomDir);
    assert.equal(res.status, 0);
    const reportPath = path.join(fx.roomDir, '.mindrian', 'invariant-report.json');
    assert.ok(fs.existsSync(reportPath), 'report written');
    const r = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    const all = Object.values(r.sections || {}).flatMap(function (s) { return s.violations || []; });
    const snapV = all.filter(function (v) { return v.validator === 'snapshot-integrity'; });
    assert.ok(
      snapV.length >= 1,
      'at least one snapshot-integrity violation; got ' + snapV.length
    );
    assert.ok(
      snapV.some(function (v) { return v.action_hint === 'partial_snapshot_detected'; }),
      'action_hint includes partial_snapshot_detected'
    );
  }
  // Test 14c: empty snapshot with non-empty room -> error
  {
    const tmp = mkTmp('gm-t14c-');
    const fx = seedRoom(tmp, ['a', 'b'], {
      a: { governing: 'a' }, b: { governing: 'b' },
    });
    fs.writeFileSync(
      path.join(fx.roomDir, '.mindrian', 'session-snapshot.json'),
      JSON.stringify({ version: 1, sections: {} })
    );
    const res = runGuardian('on-stop', fx.roomDir);
    assert.equal(res.status, 0);
    const reportPath = path.join(fx.roomDir, '.mindrian', 'invariant-report.json');
    assert.ok(fs.existsSync(reportPath));
    const r = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    const all = Object.values(r.sections || {}).flatMap(function (s) { return s.violations || []; });
    const errs = all.filter(function (v) {
      return v.validator === 'snapshot-integrity' && v.severity === 'error';
    });
    assert.ok(errs.length >= 1, 'error-severity snapshot violation emitted');
  }
  // Test 14d: full snapshot -> no snapshot-integrity violation
  {
    const tmp = mkTmp('gm-t14d-');
    const fx = seedRoom(tmp, ['a', 'b'], {
      a: { governing: 'a' }, b: { governing: 'b' },
    });
    fs.writeFileSync(
      path.join(fx.roomDir, '.mindrian', 'session-snapshot.json'),
      JSON.stringify({ version: 1, sections: { a: {}, b: {} } })
    );
    const res = runGuardian('on-stop', fx.roomDir);
    assert.equal(res.status, 0);
    const reportPath = path.join(fx.roomDir, '.mindrian', 'invariant-report.json');
    if (fs.existsSync(reportPath)) {
      const r = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
      const all = Object.values(r.sections || {}).flatMap(function (s) { return s.violations || []; });
      const snap = all.filter(function (v) { return v.validator === 'snapshot-integrity'; });
      assert.equal(snap.length, 0, 'no snapshot-integrity violation on full snapshot');
    }
  }
});

// ---------------------------------------------------------------------------
// Test 15: queue-health ceilings
// ---------------------------------------------------------------------------
test('Test 15: queue-health: under/500/1001 threshold emits single violation', () => {
  function makeEntries(n) {
    const out = [];
    for (let i = 0; i < n; i++) {
      out.push({
        section: 'section-' + i,
        enqueued_at: new Date().toISOString(),
        reason: 'test',
        attempts: 0,
      });
    }
    return out;
  }
  function getQueueHealthViolations(fx) {
    const reportPath = path.join(fx.roomDir, '.mindrian', 'invariant-report.json');
    if (!fs.existsSync(reportPath)) return [];
    const r = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    const all = Object.values(r.sections || {}).flatMap(function (s) { return s.violations || []; });
    return all.filter(function (v) { return v.validator === 'queue-health'; });
  }
  // Under 500 -> healthy
  {
    const tmp = mkTmp('gm-t15a-');
    const fx = seedRoom(tmp, ['a'], { a: { governing: 'a' } });
    fs.writeFileSync(
      path.join(fx.roomDir, '.mindrian', 'minto-queue.json'),
      JSON.stringify({ version: 1, entries: makeEntries(10) })
    );
    const res = runGuardian('on-stop', fx.roomDir);
    assert.equal(res.status, 0);
    const v = getQueueHealthViolations(fx);
    assert.equal(v.length, 0, 'under 500: no queue-health violation');
  }
  // 500 -> warning
  {
    const tmp = mkTmp('gm-t15b-');
    const fx = seedRoom(tmp, ['a'], { a: { governing: 'a' } });
    fs.writeFileSync(
      path.join(fx.roomDir, '.mindrian', 'minto-queue.json'),
      JSON.stringify({ version: 1, entries: makeEntries(500) })
    );
    const res = runGuardian('on-stop', fx.roomDir);
    assert.equal(res.status, 0);
    const v = getQueueHealthViolations(fx);
    assert.equal(v.length, 1, 'exactly one aggregate violation at 500');
    assert.equal(v[0].severity, 'warning');
  }
  // 1001 -> error with action_hint halt_enqueue_until_drained
  {
    const tmp = mkTmp('gm-t15c-');
    const fx = seedRoom(tmp, ['a'], { a: { governing: 'a' } });
    fs.writeFileSync(
      path.join(fx.roomDir, '.mindrian', 'minto-queue.json'),
      JSON.stringify({ version: 1, entries: makeEntries(1001) })
    );
    const res = runGuardian('on-stop', fx.roomDir);
    assert.equal(res.status, 0);
    const v = getQueueHealthViolations(fx);
    assert.equal(v.length, 1, 'exactly one aggregate violation at 1001');
    assert.equal(v[0].severity, 'error');
    assert.equal(v[0].action_hint, 'halt_enqueue_until_drained');
  }
});

// ---------------------------------------------------------------------------
// Test 16: stale-lifecycle ghost pruning
// ---------------------------------------------------------------------------
test('Test 16: stale-lifecycle flags ghosts + on-stop prunes stale.json', () => {
  // Test 16a: MINTO valid but listed as stale -> ghost warning
  {
    const tmp = mkTmp('gm-t16a-');
    const fx = seedRoom(tmp, ['market-analysis'], {
      'market-analysis': { governing: 'Valid now.' },
    });
    fs.writeFileSync(
      path.join(fx.roomDir, '.mindrian', 'minto-stale.json'),
      JSON.stringify({
        version: 1,
        at: new Date().toISOString(),
        // Use invariant_violation as reason -- that is an invariants-owned
        // reason, so the stale-lifecycle validator re-validates and detects
        // the ghost. Reasons owned by folder-memory (never_generated,
        // missing_timestamps, artifacts_newer_than_minto) are intentionally
        // NOT candidates for ghost detection via re-validation, see the
        // validator source.
        sections: [{ section: 'market-analysis', reason: 'invariant_violation' }],
      })
    );
    const res = runGuardian('on-stop', fx.roomDir);
    assert.equal(res.status, 0);
    const reportPath = path.join(fx.roomDir, '.mindrian', 'invariant-report.json');
    const r = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    const all = Object.values(r.sections || {}).flatMap(function (s) { return s.violations || []; });
    const sl = all.filter(function (v) { return v.validator === 'stale-lifecycle'; });
    assert.ok(sl.length >= 1, 'stale-lifecycle emits ghost warning');
    assert.ok(
      sl.some(function (v) { return v.category === 'stale_ghost'; }),
      'category is stale_ghost'
    );
    // After on-stop run, stale.json should have market-analysis pruned
    const stalePath = path.join(fx.roomDir, '.mindrian', 'minto-stale.json');
    const s = JSON.parse(fs.readFileSync(stalePath, 'utf8'));
    const sections = (s.sections || []).map(function (e) { return e.section; });
    assert.ok(
      sections.indexOf('market-analysis') === -1,
      'ghost section pruned from stale.json; remaining=' + JSON.stringify(sections)
    );
  }
  // Test 16b: MINTO actually stale -> no new violation (real staleness)
  {
    const tmp = mkTmp('gm-t16b-');
    const fx = seedRoom(tmp, ['x'], {
      'x': { invalid: 'missing_frontmatter' }, // actually invalid
    });
    fs.writeFileSync(
      path.join(fx.roomDir, '.mindrian', 'minto-stale.json'),
      JSON.stringify({
        version: 1,
        at: new Date().toISOString(),
        sections: [{ section: 'x', reason: 'parse_failed' }],
      })
    );
    const res = runGuardian('on-stop', fx.roomDir);
    assert.equal(res.status, 0);
    const reportPath = path.join(fx.roomDir, '.mindrian', 'invariant-report.json');
    const r = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    const all = Object.values(r.sections || {}).flatMap(function (s) { return s.violations || []; });
    const sl = all.filter(function (v) {
      return v.validator === 'stale-lifecycle' && v.category === 'stale_ghost';
    });
    assert.equal(sl.length, 0, 'no ghost violation when MINTO really is invalid');
  }
  // Test 16c: missing stale.json -> no violation
  {
    const tmp = mkTmp('gm-t16c-');
    const fx = seedRoom(tmp, ['a'], { a: { governing: 'a' } });
    const res = runGuardian('on-stop', fx.roomDir);
    assert.equal(res.status, 0);
    const reportPath = path.join(fx.roomDir, '.mindrian', 'invariant-report.json');
    if (fs.existsSync(reportPath)) {
      const r = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
      const all = Object.values(r.sections || {}).flatMap(function (s) { return s.violations || []; });
      const sl = all.filter(function (v) { return v.validator === 'stale-lifecycle'; });
      assert.equal(sl.length, 0, 'no stale-lifecycle violation when stale.json missing');
    }
  }
});

// ---------------------------------------------------------------------------
// Test 17: missing MINTO.md reaches the critical-repair enqueue gate (F-2)
// ---------------------------------------------------------------------------
// Phase 241 F-2: validateSection's existence-check synthetic violation is
// now 'critical', so a section with no MINTO.md at all must reach
// runSessionStart's enqueue gate and land a real .mindrian/minto-queue.json
// entry, not merely carry a higher severity label in the report. Asserting
// the queue FILE (not a returned value) proves the escalation is RECORDED
// per SC2 / T-241-11.
test('Test 17: missing MINTO.md reaches the critical-repair enqueue gate', () => {
  const tmp = mkTmp('gm-t17-');
  const fx = seedRoom(tmp, ['no-minto-section'], {
    'no-minto-section': 'skip', // ROOM.md present, MINTO.md never written
  });
  const res = runGuardian('session-start', fx.roomDir);
  assert.equal(res.status, 0, 'session-start exits 0; stderr=' + res.stderr);
  const queuePath = path.join(fx.roomDir, '.mindrian', 'minto-queue.json');
  assert.ok(fs.existsSync(queuePath), 'queue file must exist after enqueue');
  const q = JSON.parse(fs.readFileSync(queuePath, 'utf8'));
  const entry = (q.entries || []).find(function (e) {
    return e.section === 'no-minto-section';
  });
  assert.ok(
    entry,
    'no-minto-section enqueued; got ' + JSON.stringify(q.entries)
  );
  assert.equal(
    entry.reason,
    'guardian:critical-repair',
    'reason is guardian:critical-repair; got ' + entry.reason
  );
});

// ---------------------------------------------------------------------------
// Test 18: missing governing_thought reaches the critical-repair enqueue
// gate (F-2)
// ---------------------------------------------------------------------------
// Phase 241 F-2: lib/core/feynman-minto-invariants.cjs's governing_thought
// check is now SEVERITY.CRITICAL. A section with a MINTO.md whose
// frontmatter is otherwise valid (schema_version present) but omits
// governing_thought must ALSO reach the enqueue gate, in a SEPARATE room
// from Test 17 so the debouncer's 10-second coalesce window cannot merge
// the two enqueues and mask one.
test('Test 18: missing governing_thought reaches the critical-repair enqueue gate', () => {
  const tmp = mkTmp('gm-t18-');
  const fx = seedRoom(tmp, ['no-gt-section'], { 'no-gt-section': 'skip' });
  const sectionDir = path.join(fx.roomDir, 'no-gt-section');
  fs.writeFileSync(
    path.join(sectionDir, 'MINTO.md'),
    [
      '---',
      'schema_version: "1.0"',
      'last_generated_at: "' + new Date().toISOString() + '"',
      'last_artifact_write_seen_at: "' + new Date().toISOString() + '"',
      'reasoning_health_score: 0.75',
      '---',
      '',
      '# Body',
      '',
      'Content.',
      '',
    ].join('\n')
  );
  const res = runGuardian('session-start', fx.roomDir);
  assert.equal(res.status, 0, 'session-start exits 0; stderr=' + res.stderr);
  const queuePath = path.join(fx.roomDir, '.mindrian', 'minto-queue.json');
  assert.ok(fs.existsSync(queuePath), 'queue file must exist after enqueue');
  const q = JSON.parse(fs.readFileSync(queuePath, 'utf8'));
  const entry = (q.entries || []).find(function (e) {
    return e.section === 'no-gt-section';
  });
  assert.ok(
    entry,
    'no-gt-section enqueued; got ' + JSON.stringify(q.entries)
  );
  assert.equal(
    entry.reason,
    'guardian:critical-repair',
    'reason is guardian:critical-repair; got ' + entry.reason
  );
});

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

let failed = 0;
for (const t of tests) {
  try {
    t.fn();
    process.stdout.write('PASS ' + t.name + '\n');
  } catch (e) {
    failed += 1;
    process.stderr.write('FAIL ' + t.name + '\n  ' + (e && e.stack || e) + '\n');
  }
}
process.stdout.write(
  '\nguardian tests: ' + (tests.length - failed) + '/' + tests.length + ' passed\n'
);
process.exit(failed === 0 ? 0 : 1);
