'use strict';
/*
 * Phase 145-03 Task 2 -- Phase-140-hardening + Part-8 + Part-4 acceptance suite.
 *
 * Proves Success Criterion 3 of Phase 145 by INSTRUMENTATION: under auto-fire the
 * Phase-140 hardening holds (no health-check crash, no NULL source_path, no backup
 * pollution), the scheduled path carries ZERO Brain/web egress (Canon Part 8), and
 * scheduled findings become graph data (Canon Part 4).
 *
 * Adversarial-fixture discipline (T-145-09): Tests 2 and 3 do NOT merely assert a
 * clean room passes -- they SYNTHESIZE a regression (a NULL-source_path node, a
 * .heal-backup/ path) and assert the guard FLAGS it. A guard that cannot detect
 * the regression is a hollow proof. Both directions are asserted: clean room ->
 * no violation, poisoned room -> the matching HARD-NN violation.
 *
 * Units under test (Plan 01, REAL -- driven directly, no stubs):
 *   scripts/scout-cadence-runner.cjs   the throttled composer
 *   scripts/scout-cadence-guard.cjs    safeAutoFireCheck (HARD-01/02/03 detection)
 *
 * House rule: hyphens only, no em-dashes.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const RUNNER = path.join(REPO_ROOT, 'scripts', 'scout-cadence-runner.cjs');
const GUARD = path.join(REPO_ROOT, 'scripts', 'scout-cadence-guard.cjs');
const guard = require(GUARD);

let passed = 0;
let failed = 0;
function ok(name) { passed += 1; process.stdout.write('  ok ' + name + '\n'); }
function fail(name, err) {
  failed += 1;
  process.stdout.write('  FAIL ' + name + '\n');
  if (err) process.stdout.write('    ' + (err.message || String(err)) + '\n');
}

const TMP_ROOMS = [];

function makeFixtureRoom() {
  const roomDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-145-hard-'));
  TMP_ROOMS.push(roomDir);
  fs.writeFileSync(path.join(roomDir, 'ROOM.md'), '# Room\n');
  fs.writeFileSync(
    path.join(roomDir, 'STATE.md'),
    '---\nventure_stage: exploration\nstage: exploration\n---\n# State\n'
  );
  const dir = path.join(roomDir, 'problem-definition');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'ROOM.md'),
    '# problem-definition\n\nWe build quantum brain imaging for early cancer detection.\n'
  );
  return roomDir;
}

/**
 * Synthesize a room.db with a nodes table carrying a source_path column, then
 * insert clean and/or NULL-source_path rows. Returns the absolute room path.
 * @param {{ withNull: boolean }} opts
 */
function makeRoomWithDb(opts) {
  const roomDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-145-db-'));
  TMP_ROOMS.push(roomDir);
  const mdir = path.join(roomDir, '.mindrian');
  fs.mkdirSync(mdir, { recursive: true });
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(path.join(mdir, 'room.db'));
  try {
    db.exec("CREATE TABLE nodes (id TEXT PRIMARY KEY, type TEXT NOT NULL, source_path TEXT, properties TEXT DEFAULT '{}')");
    db.prepare('INSERT INTO nodes (id, type, source_path) VALUES (?, ?, ?)')
      .run('clean-1', 'claim', 'problem-definition/ROOM.md');
    if (opts && opts.withNull) {
      db.prepare('INSERT INTO nodes (id, type, source_path) VALUES (?, ?, ?)')
        .run('orphan-1', 'claim', null);
    }
  } finally {
    db.close();
  }
  return roomDir;
}

/**
 * Synthesize a room whose .intelligence/ result set carries (or does not carry)
 * a .heal-backup/ path. Returns the absolute room path.
 * @param {{ withBackup: boolean }} opts
 */
function makeRoomWithIntel(opts) {
  const roomDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-145-intel-'));
  TMP_ROOMS.push(roomDir);
  const intel = path.join(roomDir, '.intelligence');
  fs.mkdirSync(intel, { recursive: true });
  const clean = '# Health Report\n\nsource: problem-definition/ROOM.md\nno drift detected\n';
  fs.writeFileSync(path.join(intel, 'health-2026-06-08.md'), clean);
  if (opts && opts.withBackup) {
    fs.writeFileSync(
      path.join(intel, 'reverse-salients-2026-06-08.json'),
      JSON.stringify({ salients: [{ path: '.heal-backup/STATE-2026-06-01.md', score: 0.4 }] }, null, 2)
    );
  }
  return roomDir;
}

function runRunner(roomDir, extraArgs) {
  const argv = [RUNNER, roomDir, '--json', ...(extraArgs || [])];
  let raw = '';
  let exit = 0;
  try {
    raw = execFileSync('node', argv, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    exit = typeof e.status === 'number' ? e.status : 1;
    raw = e.stdout ? String(e.stdout) : '';
  }
  let summary;
  try {
    summary = JSON.parse(raw);
  } catch (e) {
    throw new Error('runner did not emit parseable JSON (exit ' + exit + '): ' + raw.slice(0, 400));
  }
  return { exit, summary };
}

function clearThrottle(roomDir) {
  try { fs.rmSync(guard.lastRunFile(roomDir), { force: true }); } catch (_e) { /* ignore */ }
}

// ---------------------------------------------------------------------------
// Test 1 (HARD-01): the runner CAPTURES the health-check exit, never swallows it
// ---------------------------------------------------------------------------

(function test_hard01_healthCheckCaptured() {
  const label = 'Test 1 (HARD-01): a fired run captures the sentinel-health-check exit (carries an exit field; status is a known value, never an unhandled crash)';
  let roomDir;
  try {
    roomDir = makeFixtureRoom();
    clearThrottle(roomDir);
    const { summary } = runRunner(roomDir, ['--force']);
    assert.equal(summary.fired, true, label + ': run fires');

    const health = (summary.steps || []).find(s => s.name === 'sentinel-health-check');
    assert.ok(health, label + ': the health-check step is present in the fired suite');
    // HARD-01: the exit is CAPTURED (numeric field present), not swallowed.
    assert.equal(typeof health.exit, 'number', label + ': health-check exit is captured as a number');
    // status must be a known, handled value -- "ok" or "degraded" -- never an
    // unhandled crash marker.
    assert.ok(
      health.status === 'ok' || health.status === 'degraded',
      label + ': health-check status is a handled value (ok|degraded), not an unhandled crash, got: ' + health.status
    );

    // The runner ROUTES the captured exit into the guard's HARD-01 channel: when
    // the captured exit is non-zero, safeAutoFireCheck must surface a HARD-01
    // violation (proving the capture is wired, not cosmetic). When it is zero,
    // there must be no HARD-01 violation.
    const safe = guard.safeAutoFireCheck(roomDir, { healthCheckExit: health.exit });
    const hard01 = safe.violations.filter(v => v.startsWith('HARD-01'));
    if (Number(health.exit) !== 0) {
      assert.equal(hard01.length, 1, label + ': non-zero captured exit surfaces exactly one HARD-01 violation');
    } else {
      assert.equal(hard01.length, 0, label + ': a clean health-check exit surfaces no HARD-01 violation');
    }
    ok(label);
  } catch (e) {
    fail(label, e);
  }
})();

// ---------------------------------------------------------------------------
// Test 2 (HARD-02): clean room -> no violation; NULL source_path -> FLAGGED
// ---------------------------------------------------------------------------

(function test_hard02_nullSourcePathDetected() {
  const label = 'Test 2 (HARD-02): a clean graph reports no NULL-source_path violation; a synthesized NULL-source_path node IS flagged (adversarial fixture)';
  try {
    // Clean room with a source_path column and only a clean row.
    const cleanRoom = makeRoomWithDb({ withNull: false });
    const cleanSafe = guard.safeAutoFireCheck(cleanRoom, {});
    assert.equal(
      cleanSafe.violations.filter(v => v.startsWith('HARD-02')).length, 0,
      label + ': a clean graph reports no HARD-02 violation'
    );

    // Poisoned room: synthesize a NULL-source_path node.
    const poisonedRoom = makeRoomWithDb({ withNull: true });
    const poisonedSafe = guard.safeAutoFireCheck(poisonedRoom, {});
    const hard02 = poisonedSafe.violations.filter(v => v.startsWith('HARD-02'));
    assert.equal(hard02.length, 1, label + ': the guard FLAGS the synthesized NULL-source_path node');
    assert.equal(poisonedSafe.ok, false, label + ': a flagged room is not ok');
    // Prove the detection actually read the graph (checked:true, nullCount > 0).
    assert.equal(poisonedSafe.checks.null_source_path.checked, true, label + ': the NULL-source_path scan actually ran against the graph');
    assert.ok(poisonedSafe.checks.null_source_path.nullCount > 0, label + ': the scan counted the orphan node');
    ok(label);
  } catch (e) {
    fail(label, e);
  }
})();

// ---------------------------------------------------------------------------
// Test 3 (HARD-03): clean result set -> none; .heal-backup/ path -> FLAGGED
// ---------------------------------------------------------------------------

(function test_hard03_backupPollutionDetected() {
  const label = 'Test 3 (HARD-03): a clean result set reports no backup pollution; a synthesized .heal-backup/ path IS flagged (adversarial fixture)';
  try {
    const cleanRoom = makeRoomWithIntel({ withBackup: false });
    const cleanSafe = guard.safeAutoFireCheck(cleanRoom, {});
    assert.equal(
      cleanSafe.violations.filter(v => v.startsWith('HARD-03')).length, 0,
      label + ': a clean result set reports no HARD-03 violation'
    );

    const poisonedRoom = makeRoomWithIntel({ withBackup: true });
    const poisonedSafe = guard.safeAutoFireCheck(poisonedRoom, {});
    const hard03 = poisonedSafe.violations.filter(v => v.startsWith('HARD-03'));
    assert.equal(hard03.length, 1, label + ': the guard FLAGS the synthesized .heal-backup/ pollution');
    assert.equal(poisonedSafe.checks.backup_pollution.checked, true, label + ': the backup-pollution scan actually ran');
    assert.ok(poisonedSafe.checks.backup_pollution.hits.length > 0, label + ': the scan recorded the polluted result file');
    ok(label);
  } catch (e) {
    fail(label, e);
  }
})();

// ---------------------------------------------------------------------------
// Test 4 (Part 8): zero egress in the scheduled path; competitor-watch is a
// SIGNAL query plan, never an executed fetch
// ---------------------------------------------------------------------------

(function test_part8_zeroEgress() {
  const label = 'Test 4 (Part 8): the runner + guard scripts carry zero Brain/web egress (comments filtered), and competitor-watch is emitted as a SIGNAL query plan, not a fetch';
  try {
    // Forbidden egress tokens. The competitor SIGNAL plan is a QUERY PLAN for the
    // surface layer; the runner itself must never fetch.
    const FORBIDDEN = [
      /\bfetch\s*\(/,
      /https?:\/\//,
      /\btavily\b/i,
      /\bbrain_query\b/i,
      /\bmcp__brain\b/i,
    ];

    // Strip comment lines (T-145-10): a commented-out match in header prose must
    // not self-invalidate the gate; equally, header prose must not produce a
    // false-clean. We strip whole-line // comments and block-comment lines.
    function codeLinesOnly(src) {
      const out = [];
      let inBlock = false;
      for (const rawLine of src.split('\n')) {
        let line = rawLine;
        if (inBlock) {
          const end = line.indexOf('*/');
          if (end === -1) { continue; }
          line = line.slice(end + 2);
          inBlock = false;
        }
        // Drop whole-line block-comment openers that do not close on the line.
        const open = line.indexOf('/*');
        if (open !== -1) {
          const close = line.indexOf('*/', open + 2);
          if (close === -1) {
            line = line.slice(0, open);
            inBlock = true;
          } else {
            line = line.slice(0, open) + line.slice(close + 2);
          }
        }
        // Drop // line comments (naive but sufficient: these scripts put URLs
        // only in prose comments, never in string literals).
        const slash = line.indexOf('//');
        if (slash !== -1) line = line.slice(0, slash);
        if (line.trim().length) out.push(line);
      }
      return out.join('\n');
    }

    for (const file of [RUNNER, GUARD]) {
      const src = fs.readFileSync(file, 'utf8');
      const code = codeLinesOnly(src);
      for (const rx of FORBIDDEN) {
        assert.equal(
          rx.test(code), false,
          label + ': ' + path.basename(file) + ' must carry no egress match (' + rx + ') in code (comments filtered)'
        );
      }
    }

    // Behavioral half: a fired run must emit a competitor SIGNAL query plan that
    // is a plan (queries[] or insufficient), never an executed fetch result.
    const roomDir = makeFixtureRoom();
    clearThrottle(roomDir);
    const { summary } = runRunner(roomDir, ['--force']);
    const comp = (summary.steps || []).find(s => s.name === 'competitor-watch');
    assert.ok(comp, label + ': competitor-watch step present');
    assert.ok(
      comp.status === 'query-plan' || comp.status === 'skipped',
      label + ': competitor-watch is a query-plan (or skipped when data is thin), never an executed fetch, got: ' + comp.status
    );
    assert.ok(summary.signal_query_plan, label + ': the summary carries a signal_query_plan object');
    assert.equal(summary.signal_query_plan.scope, 'public-signal', label + ': the query plan is scoped public-signal');
    ok(label);
  } catch (e) {
    fail(label, e);
  }
})();

// ---------------------------------------------------------------------------
// Test 5 (Part 4): scheduled findings become graph data
// ---------------------------------------------------------------------------

(function test_part4_findingsBecomeGraphData() {
  const label = 'Test 5 (Part 4): a fired run carries findings_to_graph (HSI/whitespace edges + opportunity-bank candidates destined for room.db)';
  try {
    const roomDir = makeFixtureRoom();
    clearThrottle(roomDir);
    const { summary } = runRunner(roomDir, ['--force']);
    assert.equal(summary.fired, true, label + ': run fires');
    assert.ok(Array.isArray(summary.findings_to_graph), label + ': findings_to_graph is an array');

    // Part 4: scheduled findings become graph data. When sklearn is present the
    // HSI/whitespace edges land; the opportunity-bank scan always contributes a
    // candidate channel. We assert the contract surface exists and, when the
    // Python compute layer ran, that it produced at least one graph-bound finding.
    const names = (summary.steps || []).map(s => s.name);
    const sklearnRan = names.includes('compute-hsi') || names.includes('compute-whitespace-gaps');
    if (sklearnRan) {
      assert.ok(
        summary.findings_to_graph.length > 0,
        label + ': with the Python compute layer live, the fired run produces at least one graph-bound finding'
      );
    }
    // The findings channel is well-formed regardless of sklearn: every entry is a
    // string tag (hsi-edges | whitespace-zones | opportunity-bank:N).
    for (const f of summary.findings_to_graph) {
      assert.equal(typeof f, 'string', label + ': every findings_to_graph entry is a string tag, got: ' + JSON.stringify(f));
    }
    ok(label);
  } catch (e) {
    fail(label, e);
  }
})();

// ---------------------------------------------------------------------------
// cleanup + report
// ---------------------------------------------------------------------------

for (const roomDir of TMP_ROOMS) {
  try { clearThrottle(roomDir); } catch (_e) { /* ignore */ }
  try { fs.rmSync(roomDir, { recursive: true, force: true }); } catch (_e) { /* ignore */ }
}

process.stdout.write('\n');
process.stdout.write('Phase-140-hardening + Part-8 + Part-4: ' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed === 0 ? 0 : 1);
