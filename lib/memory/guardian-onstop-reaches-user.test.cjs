#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 241-01 -- guardian on-stop reaches the user (SC1, both legs)
 * ====================================================================
 * Closes finding F-1: the Feynman-MINTO guardian's on-stop invariant
 * report was produced and then thrown away twice over (the /dev/null
 * discard, and the 1-second hard kill). SC1 is compound and this file
 * proves its two independently-testable legs separately, per
 * 241-RESEARCH.md Pitfall 1. A test that collapses both into one would
 * satisfy neither claim on its own.
 *
 * Test map (4 tests):
 *
 *   Test 1 (LEG A, reaches-final-stdout): a seeded violation's guardian
 *     systemMessage appears in the LAST stdout line scripts/on-stop
 *     emits (the one JSON line Claude Code actually reads), not merely
 *     somewhere in the process's combined stdout.
 *   Test 2 (LEG A mutation proof): a tmp copy of scripts/on-stop with
 *     the >/dev/null 2>&1 discard restored on the guardian invocation
 *     must turn Test 1's claim red -- the final line's systemMessage
 *     must NOT contain "guardian:".
 *   Test 3 (LEG B, slow-write-survives): an injected ~1250ms validator
 *     delay (past the old 1000ms kill) still lands
 *     .mindrian/invariant-report.json on disk, still prunes a ghost
 *     entry from .mindrian/minto-stale.json, and the report's
 *     `truncated` field is present -- all inside the 3000ms Stop-hook
 *     budget.
 *   Test 4 (LEG B mutation proof): a tmp copy of scripts/on-stop with
 *     `timeout 1` restored on the guardian invocation must turn Test 3's
 *     write claim red -- invariant-report.json must NOT exist after the
 *     run (the guardian gets SIGTERM-killed mid-walk before it ever
 *     writes).
 *
 * Harness: spawnSync('bash', [onStopPath]) with a MINDRIAN_ROOMS_HOME
 * tmpdir fixture, the exact analog lib/memory/on-stop-snapshot.test.cjs
 * already uses to drive scripts/on-stop end to end. Every test owns its
 * own tmpdir and never writes inside the repo tree -- validators dirs
 * reuse the REAL production validators via require(ABSOLUTE_PATH)
 * wrapper files (the same idiom lib/memory/feynman-minto-guardian.test.cjs
 * Test 11 already uses), so relative requires inside those validator
 * modules keep resolving against their real on-disk location.
 *
 * BSL 1.1. Zero npm deps. Node built-ins only.
 */

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const ON_STOP = path.join(REPO_ROOT, 'scripts', 'on-stop');
const REAL_VALIDATORS_DIR = path.join(REPO_ROOT, 'lib', 'memory', 'validators');

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

// ---------------------------------------------------------------------------
// Fixture builders (mirrors lib/memory/on-stop-snapshot.test.cjs's seedRoom
// so scripts/resolve-room's Strategy 0b, MINDRIAN_ROOMS_HOME directory scan,
// finds the room).
// ---------------------------------------------------------------------------

function seedRoom(tmp, sections) {
  const roomsHome = path.join(tmp, 'rooms-home');
  const roomBase = 'venture';
  const roomDir = path.join(roomsHome, roomBase);
  fs.mkdirSync(roomDir, { recursive: true });
  fs.writeFileSync(path.join(roomDir, '.room-root'), '');
  fs.mkdirSync(path.join(roomDir, '.mindrian'), { recursive: true });

  const workDir = path.join(tmp, 'work', roomBase);
  fs.mkdirSync(workDir, { recursive: true });

  for (const s of sections) {
    const dir = path.join(roomDir, s);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'ROOM.md'),
      '# ' + s + '\n\nIdentity text for ' + s + '.\n'
    );
  }
  return { roomDir, roomsHome, workDir };
}

/** Writes a MINTO.md that lib/core/feynman-minto-invariants.cjs's
 * validate() returns zero violations for (confirmed live during
 * execution of this plan). */
function writeCleanMinto(sectionDir, governingThought) {
  const now = new Date().toISOString();
  const frontmatter = [
    '---',
    'schema_version: "1.0"',
    'governing_thought: "' + governingThought + '"',
    'last_generated_at: "' + now + '"',
    'last_artifact_write_seen_at: "' + now + '"',
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

function invokeOnStop(onStopPath, fixture, extraEnv) {
  const env = Object.assign({}, process.env, {
    PWD: fixture.workDir,
    MINDRIAN_ROOMS_HOME: fixture.roomsHome,
    CLAUDE_PLUGIN_ROOT: REPO_ROOT,
  }, extraEnv || {});
  return spawnSync('bash', [onStopPath], {
    cwd: fixture.workDir,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 10000,
  });
}

/** Returns the last non-empty line of a stdout Buffer/string. This is the
 * point of Tests 1/2: the guardian prints its own JSON mid-script, and
 * only the FINAL line is the Stop-hook contract Claude Code reads. */
function lastNonEmptyLine(stdout) {
  const lines = (stdout || '').toString().split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
  return lines.length > 0 ? lines[lines.length - 1] : '';
}

/**
 * Pins SCRIPT_DIR/PLUGIN_ROOT to the REAL repo location. Harness plumbing
 * only, not part of any mutation under test: scripts/on-stop computes
 * both from "$(dirname "$0")", which is correct when the file lives in
 * the real scripts/ directory but breaks the moment a copy runs from a
 * tmp path (resolve-room and every other sibling script/module reference
 * would silently fail to resolve, short-circuiting ROOM_DIR to empty and
 * skipping the ENTIRE guarded block the guardian invocation lives in --
 * discovered live during this plan's hand mutation-verification, where a
 * neutered "mutation" was passing for the wrong reason: not because the
 * fix held, but because the guardian call never ran at all).
 */
function pinScriptDirToRealRepo(src) {
  const needle = 'SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"\nPLUGIN_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"';
  const replacement = 'SCRIPT_DIR=' + JSON.stringify(path.join(REPO_ROOT, 'scripts')) +
    '\nPLUGIN_ROOT=' + JSON.stringify(REPO_ROOT);
  assert.ok(src.indexOf(needle) !== -1, 'SCRIPT_DIR/PLUGIN_ROOT computation not found in scripts/on-stop; harness pin target drifted');
  return src.split(needle).join(replacement);
}

/**
 * Copies scripts/on-stop to a tmp path with a scripted textual mutation
 * applied, PLUS the SCRIPT_DIR/PLUGIN_ROOT harness pin above so sibling
 * scripts keep resolving from the tmp copy. Never edits production
 * source. Returns the tmp copy's path.
 */
function buildMutatedOnStop(tmp, name, mutateFn) {
  const src = fs.readFileSync(ON_STOP, 'utf8');
  const mutated = pinScriptDirToRealRepo(mutateFn(src));
  assert.notEqual(mutated, src, 'mutation "' + name + '" must actually change the source');
  const dest = path.join(tmp, name);
  fs.writeFileSync(dest, mutated);
  return dest;
}

/** LEG A mutation: restore the >/dev/null 2>&1 discard on the guardian's
 * captured invocation, so GUARDIAN_OUT is always empty. */
function mutateRestoreDiscard(src) {
  const needle = 'on-stop "${ROOM_DIR}" 2>/dev/null || true)';
  const replacement = 'on-stop "${ROOM_DIR}" >/dev/null 2>&1 || true)';
  assert.ok(src.indexOf(needle) !== -1, 'expected discard-mutation target string not found in scripts/on-stop');
  return src.split(needle).join(replacement);
}

/** LEG B mutation: restore the hard 1-second kill on the guardian
 * invocation, replacing the 241-01 3-second ceiling. */
function mutateRestoreHardKill(src) {
  const needle = 'timeout "${GUARDIAN_TIMEOUT_S}"';
  const replacement = 'timeout 1';
  assert.ok(src.indexOf(needle) !== -1, 'expected timeout-mutation target string not found in scripts/on-stop');
  return src.split(needle).join(replacement);
}

/**
 * Builds a validators dir carrying every REAL production validator
 * (reused via require(ABSOLUTE_PATH) wrapper files, so their own
 * relative requires keep resolving against the real on-disk location)
 * PLUS one fixture validator whose validate() busy-waits ~1250ms -- past
 * both the retired 1000ms hard kill and the default 1200ms soft walk
 * budget, so it forces exactly one truncated walk. 1250ms (not the
 * larger ~1500ms first tried during this plan's execution) was chosen
 * empirically: scripts/on-stop's own non-guardian pipeline
 * (memory-lifecycle, the Phase 88-06 snapshot, per-section recompiles)
 * already costs roughly 1.6-1.7s wall-clock on this dev machine before
 * the guardian ever runs, so a full 1500ms validator delay pushed the
 * whole run past the 3000ms Stop-hook budget this same test asserts
 * against. 1250ms clears both floors with margin while leaving headroom
 * under 3000ms total.
 */
function buildValidatorsDirWithSlowValidator(tmp) {
  const vdir = path.join(tmp, 'validators');
  fs.mkdirSync(vdir, { recursive: true });
  const entries = fs.readdirSync(REAL_VALIDATORS_DIR).filter((n) => n.endsWith('.cjs'));
  for (const fname of entries) {
    const absOriginal = path.join(REAL_VALIDATORS_DIR, fname);
    fs.writeFileSync(
      path.join(vdir, fname),
      'module.exports = require(' + JSON.stringify(absOriginal) + ');\n'
    );
  }
  fs.writeFileSync(
    path.join(vdir, 'zz-fixture-slow-validator.cjs'),
    [
      "'use strict';",
      '// Phase 241-01 fixture-only validator: forces every section it runs',
      '// against to take ~1250ms, past the retired 1000ms hard kill and',
      '// past the default 1200ms soft walk budget. Never shipped, tmp-dir only.',
      'module.exports = {',
      "  id: 'fixture-slow-validator',",
      '  severity_map: { critical: 3, error: 2, warning: 1, info: 0 },',
      "  scope: 'section',",
      '  validate: function (sectionDir) {',
      '    const start = Date.now();',
      '    while (Date.now() - start < 1250) { /* busy-wait */ }',
      '    return { severity: null, violations: [] };',
      '  },',
      '};',
      '',
    ].join('\n')
  );
  return vdir;
}

/**
 * LEG B fixture: one section with a real violation (missing MINTO.md,
 * the existence-check synthetic violation), one section with a clean
 * MINTO.md that a seeded .mindrian/minto-stale.json flags as a ghost
 * (stale-lifecycle re-validates it as invariant-clean and should prune
 * it during on-stop).
 */
function seedLegBFixture(tmp) {
  const fx = seedRoom(tmp, ['section-violation', 'section-ghost']);
  writeCleanMinto(path.join(fx.roomDir, 'section-ghost'), 'Ghost section is clean now.');
  const stalePath = path.join(fx.roomDir, '.mindrian', 'minto-stale.json');
  fs.writeFileSync(stalePath, JSON.stringify({
    version: 1,
    at: new Date().toISOString(),
    sections: [
      {
        section: 'section-ghost',
        reason: 'invariant_violation',
        last_generated_at: new Date().toISOString(),
      },
    ],
  }, null, 2));
  return fx;
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

// ---------------------------------------------------------------------------
// Test 1 (LEG A): systemMessage reaches the FINAL stdout line
// ---------------------------------------------------------------------------
test('LEG A: seeded violation systemMessage appears in the final stdout line', () => {
  const tmp = mkTmp('reaches-user-t1-');
  const fx = seedRoom(tmp, ['market-analysis']); // no MINTO.md -> existence-check violation
  const res = invokeOnStop(ON_STOP, fx);
  assert.equal(res.status, 0, 'on-stop exits 0: stderr=' + (res.stderr || ''));

  const last = lastNonEmptyLine(res.stdout);
  assert.ok(last.length > 0, 'stdout must have at least one non-empty line');
  const parsed = JSON.parse(last);
  assert.ok(
    typeof parsed.systemMessage === 'string' && parsed.systemMessage.indexOf('guardian:') !== -1,
    'final stdout line systemMessage must contain "guardian:"; got: ' + JSON.stringify(parsed)
  );
});

// ---------------------------------------------------------------------------
// Test 2 (LEG A mutation proof): restoring the /dev/null discard turns
// the claim red
// ---------------------------------------------------------------------------
test('LEG A mutation proof: restoring the >/dev/null discard drops the guardian message', () => {
  const tmp = mkTmp('reaches-user-t2-');
  const fx = seedRoom(tmp, ['market-analysis']); // same fixture shape as Test 1
  const mutatedOnStop = buildMutatedOnStop(tmp, 'on-stop-mutated-discard', mutateRestoreDiscard);

  const res = invokeOnStop(mutatedOnStop, fx);
  assert.equal(res.status, 0, 'mutated on-stop still exits 0: stderr=' + (res.stderr || ''));

  const last = lastNonEmptyLine(res.stdout);
  assert.ok(last.length > 0, 'stdout must have at least one non-empty line');
  const parsed = JSON.parse(last);
  const msg = typeof parsed.systemMessage === 'string' ? parsed.systemMessage : '';
  assert.ok(
    msg.indexOf('guardian:') === -1,
    'restoring the discard must remove "guardian:" from the final line; got: ' + JSON.stringify(parsed)
  );
});

// ---------------------------------------------------------------------------
// Test 3 (LEG B): a slow validator still lands the write + the prune
// ---------------------------------------------------------------------------
test('LEG B: an injected ~1250ms validator delay still writes the report and prunes the ghost', () => {
  const tmp = mkTmp('reaches-user-t3-');
  const fx = seedLegBFixture(tmp);
  const vdir = buildValidatorsDirWithSlowValidator(tmp);

  const t0 = Date.now();
  const res = invokeOnStop(ON_STOP, fx, { GUARDIAN_VALIDATORS_DIR: vdir });
  const elapsed = Date.now() - t0;
  assert.equal(res.status, 0, 'on-stop exits 0: stderr=' + (res.stderr || ''));
  assert.ok(elapsed < 3000, 'on-stop must stay under the 3000ms Stop-hook budget; elapsed=' + elapsed + 'ms');

  const reportPath = path.join(fx.roomDir, '.mindrian', 'invariant-report.json');
  assert.ok(fs.existsSync(reportPath), '.mindrian/invariant-report.json must exist after a slow walk');
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  assert.ok(
    Object.prototype.hasOwnProperty.call(report, 'truncated'),
    'report must carry a truncated field'
  );
  assert.equal(report.truncated, true, 'this fixture deliberately trips the soft deadline; truncated must be true');

  const stalePath = path.join(fx.roomDir, '.mindrian', 'minto-stale.json');
  assert.ok(fs.existsSync(stalePath), 'minto-stale.json should still exist after prune');
  const stale = JSON.parse(fs.readFileSync(stalePath, 'utf8'));
  const staleSections = (stale.sections || []).map((e) => e.section);
  assert.ok(
    staleSections.indexOf('section-ghost') === -1,
    'section-ghost must be pruned from minto-stale.json; got: ' + JSON.stringify(staleSections)
  );
});

// ---------------------------------------------------------------------------
// Test 4 (LEG B mutation proof): restoring `timeout 1` turns the write
// claim red
// ---------------------------------------------------------------------------
test('LEG B mutation proof: restoring timeout 1 drops the report write entirely', () => {
  const tmp = mkTmp('reaches-user-t4-');
  const fx = seedLegBFixture(tmp);
  const vdir = buildValidatorsDirWithSlowValidator(tmp);
  const mutatedOnStop = buildMutatedOnStop(tmp, 'on-stop-mutated-timeout', mutateRestoreHardKill);

  const reportPath = path.join(fx.roomDir, '.mindrian', 'invariant-report.json');
  // Explicit per Task 3 spec: delete before the run so the assertion is
  // about THIS run, not a leftover.
  try { fs.rmSync(reportPath, { force: true }); } catch (_) {}

  const res = invokeOnStop(mutatedOnStop, fx, { GUARDIAN_VALIDATORS_DIR: vdir });
  assert.equal(res.status, 0, 'mutated on-stop still exits 0 (Stop-hook || true contract): stderr=' + (res.stderr || ''));

  assert.ok(
    !fs.existsSync(reportPath),
    'restoring timeout 1 must prevent invariant-report.json from being written'
  );
});

// ---------------------------------------------------------------------------
// Epilogue
// ---------------------------------------------------------------------------

(async () => {
  let passed = 0;
  let failed = 0;
  for (const t of tests) {
    try {
      const r = t.fn();
      if (r && typeof r.then === 'function') await r;
      process.stdout.write('PASS ' + t.name + '\n');
      passed += 1;
    } catch (e) {
      process.stderr.write('FAIL ' + t.name + '\n' + (e && e.stack ? e.stack : e) + '\n');
      failed += 1;
    }
  }
  process.stdout.write('\nguardian-onstop-reaches-user.test.cjs: ' + passed + '/' + tests.length + ' passed\n');
  process.exit(failed === 0 ? 0 : 1);
})();
