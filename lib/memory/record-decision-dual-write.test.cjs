/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 88-11 -- record-decision dual-write test fixture.
 *
 * Proves that bin/mindrian-tools.cjs record-decision fires BOTH writes:
 *   1. proactive-intelligence.cjs recordDecision (primary; pre-88, unchanged)
 *   2. decision-capture.cjs recordDecision (additive; 88-11 dual-write)
 *
 * The primary write is authoritative; the dual-write is a read-optimized
 * convenience for session-start TRIPLE_CONTEXT injection (88-07) and is
 * never allowed to block the primary path. Failure in the dual-write
 * logs to .mindrian/decision-dual-write-errors.jsonl and exit 0.
 *
 * Section derivation: when --source-artifact is provided and resolves
 * inside --room, the first path segment under the room is the section.
 * When --source-artifact is absent OR resolves outside --room, the
 * dual-write is SKIPPED (not an error); primary write still fires.
 *
 * Test matrix (8 tests):
 *   Test 1: source-artifact inside market-analysis -> both writes fire.
 *   Test 2: no --source-artifact -> dual-write SKIPPED, no error log.
 *   Test 3: MINTO.md missing in derived section -> error log entry,
 *           primary write still succeeded, exit 0.
 *   Test 4: both succeed -> no error log, decision_log grew by 1.
 *   Test 5: idempotency -- same key+artifact+decision twice ->
 *           decision_log has TWO entries (no layer-level dedup).
 *   Test 6: error log format -- timestamp + reason + decision + violations.
 *   Test 7: source-artifact absolute path inside --room -> same section.
 *   Test 8: source-artifact outside --room -> skip + stderr warning.
 *
 * Fixture: tmpdir with .room-root, .mindrian/, pre-created section with
 * v88 MINTO.md. Direct exec of node bin/mindrian-tools.cjs via spawnSync.
 *
 * License: BSL 1.1.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const CLI = path.join(REPO_ROOT, 'bin', 'mindrian-tools.cjs');

// ---------- Fixture helpers ----------

const CLEANUP = [];
process.on('exit', () => {
  for (const d of CLEANUP) {
    try {
      fs.rmSync(d, { recursive: true, force: true });
    } catch (_e) {
      // best-effort cleanup
    }
  }
});

function mkTmp() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'rd-dualwrite-'));
  CLEANUP.push(d);
  return d;
}

function writeMinto(roomPath, section, existingLog) {
  const dir = path.join(roomPath, section);
  fs.mkdirSync(dir, { recursive: true });
  const mintoPath = path.join(dir, 'MINTO.md');
  let fm = '---\n';
  fm += 'schema_version: 1\n';
  fm += 'governing_thought: test thought\n';
  fm += 'last_generated_at: 2026-01-01T00:00:00Z\n';
  if (Array.isArray(existingLog) && existingLog.length > 0) {
    fm += 'decision_log:\n';
    for (const e of existingLog) {
      fm += '  - session_id: "' + e.session_id + '"\n';
      fm += '    timestamp: "' + e.timestamp + '"\n';
      fm += '    action: "' + e.action + '"\n';
      fm += '    user_response: "' + e.user_response + '"\n';
      fm += '    reason: "' + e.reason + '"\n';
    }
  } else {
    fm += 'decision_log: []\n';
  }
  fm += '---\n\nbody text\n';
  fs.writeFileSync(mintoPath, fm);
  return mintoPath;
}

function makeRoom({ withSection = 'market-analysis', withMinto = true } = {}) {
  const room = mkTmp();
  fs.writeFileSync(path.join(room, '.room-root'), '');
  fs.mkdirSync(path.join(room, '.mindrian'), { recursive: true });
  if (withSection && withMinto) {
    writeMinto(room, withSection, []);
  } else if (withSection && !withMinto) {
    // Create the section directory but deliberately skip MINTO.md so the
    // dual-write fails with no_minto.
    fs.mkdirSync(path.join(room, withSection), { recursive: true });
  }
  return room;
}

function runCli(args, extraEnv) {
  const env = Object.assign({}, process.env, extraEnv || {});
  // Silence BYO key path; proactive-intel file write does not need it.
  delete env.ANTHROPIC_API_KEY;
  const res = spawnSync(process.execPath, [CLI, ...args], {
    env,
    encoding: 'utf8',
    timeout: 15000,
  });
  return {
    status: res.status,
    stdout: res.stdout || '',
    stderr: res.stderr || '',
  };
}

function readMintoDecisionLog(mintoPath) {
  const text = fs.readFileSync(mintoPath, 'utf8');
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return [];
  const fm = m[1];
  const out = [];
  const lines = fm.split(/\r?\n/);
  let inLog = false;
  let cur = null;
  for (const line of lines) {
    if (/^decision_log:\s*\[\s*\]\s*$/.test(line)) {
      return [];
    }
    if (/^decision_log:\s*$/.test(line)) {
      inLog = true;
      continue;
    }
    if (!inLog) continue;
    if (/^[A-Za-z_-][A-Za-z0-9_-]*:/.test(line)) {
      // hit next top-level key
      break;
    }
    const dashM = line.match(/^\s*-\s+([A-Za-z_][A-Za-z0-9_]*):\s*(.*)$/);
    if (dashM) {
      if (cur) out.push(cur);
      cur = {};
      cur[dashM[1]] = stripQuote(dashM[2]);
      continue;
    }
    const kvM = line.match(/^\s{4,}([A-Za-z_][A-Za-z0-9_]*):\s*(.*)$/);
    if (kvM && cur) {
      cur[kvM[1]] = stripQuote(kvM[2]);
    }
  }
  if (cur) out.push(cur);
  return out;
}

function stripQuote(s) {
  const t = (s || '').trim();
  if ((t.startsWith('"') && t.endsWith('"')) ||
      (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1);
  }
  return t;
}

function readErrorLog(roomPath) {
  const p = path.join(roomPath, '.mindrian', 'decision-dual-write-errors.jsonl');
  if (!fs.existsSync(p)) return null;
  const text = fs.readFileSync(p, 'utf8');
  return text
    .split('\n')
    .filter((l) => l.length > 0)
    .map((l) => {
      try {
        return JSON.parse(l);
      } catch (_e) {
        return { parse_failed: true, raw: l };
      }
    });
}

function proactiveIntelPath(room) {
  return path.join(path.resolve(room), '.proactive-intelligence.json');
}

// ---------- Tests ----------

function test1_dualWriteWithDerivableSection() {
  const room = makeRoom({ withSection: 'market-analysis', withMinto: true });
  const mintoPath = path.join(room, 'market-analysis', 'MINTO.md');

  const res = runCli(
    [
      'record-decision',
      '--room', room,
      '--key', 'market-analysis.tam-stale',
      '--decision', 'approve',
      '--reason', 'Q4 data confirms',
      '--source-artifact', 'market-analysis/tam-bottom-up.md',
    ],
    { CLAUDE_SESSION_ID: 'sess-test1' }
  );
  assert.strictEqual(res.status, 0, 'Test 1: CLI exit 0 expected, got ' + res.status + ' stderr=' + res.stderr);

  // Primary write: .proactive-intelligence.json exists and has the decision.
  assert.ok(fs.existsSync(proactiveIntelPath(room)), 'Test 1: .proactive-intelligence.json missing after primary write');

  // Dual write: MINTO decision_log grew by exactly one entry.
  const log = readMintoDecisionLog(mintoPath);
  assert.strictEqual(log.length, 1, 'Test 1: decision_log length=1 expected, got ' + log.length);
  assert.strictEqual(log[0].action, 'market-analysis.tam-stale', 'Test 1: action mismatch');
  assert.strictEqual(log[0].user_response, 'approve', 'Test 1: user_response mismatch');
  assert.strictEqual(log[0].session_id, 'sess-test1', 'Test 1: session_id mismatch');

  // No error log on a clean happy path.
  assert.strictEqual(readErrorLog(room), null, 'Test 1: error log should not exist on happy path');
  return 'Test 1 PASS (dual-write with derivable section)';
}

function test2_noSourceArtifactSkipsDualWrite() {
  const room = makeRoom({ withSection: 'market-analysis', withMinto: true });
  const mintoPath = path.join(room, 'market-analysis', 'MINTO.md');

  const res = runCli(
    [
      'record-decision',
      '--room', room,
      '--key', 'market-analysis.tam-stale',
      '--decision', 'defer',
      '--reason', 'awaiting refresh',
    ],
    { CLAUDE_SESSION_ID: 'sess-test2' }
  );
  assert.strictEqual(res.status, 0, 'Test 2: CLI exit 0 expected, got ' + res.status);

  // Primary write: still fires (.proactive-intelligence.json present).
  assert.ok(fs.existsSync(proactiveIntelPath(room)), 'Test 2: primary write missing');

  // Dual write: skipped (no derivable section).
  const log = readMintoDecisionLog(mintoPath);
  assert.strictEqual(log.length, 0, 'Test 2: decision_log should remain empty, got length=' + log.length);

  // Error log: must NOT exist (skip is documented, not an error).
  assert.strictEqual(readErrorLog(room), null, 'Test 2: error log should NOT exist for skipped dual-write');
  return 'Test 2 PASS (no source-artifact skips dual-write, no error log)';
}

function test3_mintoMissingLogsMismatch() {
  // Derived section exists but has no MINTO.md -> decision-capture returns
  // {success:false, violations:[{existence, no_minto}]}. Error log appended,
  // primary write succeeded, exit 0.
  const room = makeRoom({ withSection: 'solution-design', withMinto: false });

  const res = runCli(
    [
      'record-decision',
      '--room', room,
      '--key', 'solution-design.viability',
      '--decision', 'reject',
      '--reason', 'cost prohibitive',
      '--source-artifact', 'solution-design/option-a.md',
    ],
    { CLAUDE_SESSION_ID: 'sess-test3' }
  );
  assert.strictEqual(res.status, 0, 'Test 3: CLI exit 0 expected even on dual-write failure, got ' + res.status);

  // Primary write still happened.
  assert.ok(fs.existsSync(proactiveIntelPath(room)), 'Test 3: primary write should still fire');

  // Error log has one line describing the failure.
  const errors = readErrorLog(room);
  assert.ok(errors, 'Test 3: error log file should exist');
  assert.strictEqual(errors.length, 1, 'Test 3: error log should have exactly 1 line, got ' + errors.length);
  const e = errors[0];
  assert.strictEqual(e.reason, 'decision_log_failed', 'Test 3: error reason mismatch');
  assert.ok(e.timestamp, 'Test 3: error timestamp missing');
  assert.ok(e.decision, 'Test 3: error decision payload missing');
  assert.strictEqual(e.decision.action, 'solution-design.viability', 'Test 3: error decision.action mismatch');
  assert.ok(Array.isArray(e.violations), 'Test 3: violations must be array');
  return 'Test 3 PASS (MINTO missing -> error logged, primary write preserved)';
}

function test4_bothSucceedCleanExit() {
  const room = makeRoom({ withSection: 'problem-definition', withMinto: true });
  const mintoPath = path.join(room, 'problem-definition', 'MINTO.md');

  const res = runCli(
    [
      'record-decision',
      '--room', room,
      '--key', 'problem-definition.scope',
      '--decision', 'approve',
      '--source-artifact', 'problem-definition/scope.md',
    ],
    { CLAUDE_SESSION_ID: 'sess-test4' }
  );
  assert.strictEqual(res.status, 0, 'Test 4: CLI exit 0 expected');
  const log = readMintoDecisionLog(mintoPath);
  assert.strictEqual(log.length, 1, 'Test 4: decision_log length grew by 1');
  assert.strictEqual(readErrorLog(room), null, 'Test 4: no error log on happy path');
  return 'Test 4 PASS (both writes succeed, clean exit)';
}

function test5_idempotencyTwoInvocationsTwoEntries() {
  const room = makeRoom({ withSection: 'market-analysis', withMinto: true });
  const mintoPath = path.join(room, 'market-analysis', 'MINTO.md');

  const args = [
    'record-decision',
    '--room', room,
    '--key', 'market-analysis.dup-test',
    '--decision', 'defer',
    '--reason', 'idempotency probe',
    '--source-artifact', 'market-analysis/probe.md',
  ];

  const r1 = runCli(args, { CLAUDE_SESSION_ID: 'sess-test5-a' });
  const r2 = runCli(args, { CLAUDE_SESSION_ID: 'sess-test5-b' });
  assert.strictEqual(r1.status, 0, 'Test 5: first invocation exit 0');
  assert.strictEqual(r2.status, 0, 'Test 5: second invocation exit 0');

  const log = readMintoDecisionLog(mintoPath);
  assert.strictEqual(log.length, 2, 'Test 5: decision_log has TWO entries (no layer-level dedup), got ' + log.length);
  return 'Test 5 PASS (idempotency: per-call append, no dedup)';
}

function test6_errorLogFormat() {
  // Same shape as Test 3 but asserts structure more strictly.
  const room = makeRoom({ withSection: 'team-execution', withMinto: false });

  runCli(
    [
      'record-decision',
      '--room', room,
      '--key', 'team-execution.hire',
      '--decision', 'defer',
      '--reason', 'budget review',
      '--source-artifact', 'team-execution/plan.md',
    ],
    { CLAUDE_SESSION_ID: 'sess-test6' }
  );
  const errors = readErrorLog(room);
  assert.ok(errors, 'Test 6: error log exists');
  assert.strictEqual(errors.length, 1, 'Test 6: single error line');
  const e = errors[0];
  // Strict structural assertions.
  assert.strictEqual(typeof e.timestamp, 'string', 'Test 6: timestamp is string');
  assert.match(e.timestamp, /^\d{4}-\d{2}-\d{2}T/, 'Test 6: timestamp ISO-like');
  assert.strictEqual(e.reason, 'decision_log_failed', 'Test 6: reason literal');
  assert.strictEqual(typeof e.decision, 'object', 'Test 6: decision is object');
  assert.strictEqual(e.decision.session_id, 'sess-test6', 'Test 6: session_id carried');
  assert.strictEqual(e.decision.action, 'team-execution.hire', 'Test 6: action carried');
  assert.strictEqual(e.decision.user_response, 'defer', 'Test 6: user_response carried');
  assert.strictEqual(e.decision.reason, 'budget review', 'Test 6: reason carried');
  assert.ok(Array.isArray(e.violations), 'Test 6: violations is array');
  return 'Test 6 PASS (error log format enforced)';
}

function test7_absoluteSourceArtifactInsideRoom() {
  const room = makeRoom({ withSection: 'business-model', withMinto: true });
  const mintoPath = path.join(room, 'business-model', 'MINTO.md');
  const absArtifact = path.join(path.resolve(room), 'business-model', 'revenue.md');

  const res = runCli(
    [
      'record-decision',
      '--room', room,
      '--key', 'business-model.pricing',
      '--decision', 'approve',
      '--source-artifact', absArtifact,
    ],
    { CLAUDE_SESSION_ID: 'sess-test7' }
  );
  assert.strictEqual(res.status, 0, 'Test 7: CLI exit 0');

  const log = readMintoDecisionLog(mintoPath);
  assert.strictEqual(log.length, 1, 'Test 7: absolute-path source-artifact produces same section derivation');
  assert.strictEqual(log[0].action, 'business-model.pricing');
  return 'Test 7 PASS (absolute source-artifact inside room derives section)';
}

function test8_sourceArtifactOutsideRoomSkips() {
  const room = makeRoom({ withSection: 'market-analysis', withMinto: true });
  const mintoPath = path.join(room, 'market-analysis', 'MINTO.md');

  // Deliberately point outside the room (absolute path in /tmp but not under room).
  const outsideArtifact = path.join(os.tmpdir(), 'not-in-room.md');

  const res = runCli(
    [
      'record-decision',
      '--room', room,
      '--key', 'market-analysis.external',
      '--decision', 'defer',
      '--reason', 'boundary test',
      '--source-artifact', outsideArtifact,
    ],
    { CLAUDE_SESSION_ID: 'sess-test8' }
  );
  assert.strictEqual(res.status, 0, 'Test 8: CLI exit 0 even when artifact outside room');

  // Primary write succeeded.
  assert.ok(fs.existsSync(proactiveIntelPath(room)), 'Test 8: primary write fired');

  // Dual write: skipped.
  const log = readMintoDecisionLog(mintoPath);
  assert.strictEqual(log.length, 0, 'Test 8: decision_log empty (skipped)');

  // No error log (outside-room is a documented skip, not a failure).
  assert.strictEqual(readErrorLog(room), null, 'Test 8: outside-room skip must not write error log');

  // stderr must carry a one-line warning.
  assert.ok(
    /outside\s+--room.*dual-write skipped/i.test(res.stderr),
    'Test 8: stderr should warn about outside-room skip; got: ' + res.stderr
  );
  return 'Test 8 PASS (outside-room artifact skipped with stderr warning)';
}

// ---------- Runner ----------

function run() {
  const tests = [
    test1_dualWriteWithDerivableSection,
    test2_noSourceArtifactSkipsDualWrite,
    test3_mintoMissingLogsMismatch,
    test4_bothSucceedCleanExit,
    test5_idempotencyTwoInvocationsTwoEntries,
    test6_errorLogFormat,
    test7_absoluteSourceArtifactInsideRoom,
    test8_sourceArtifactOutsideRoomSkips,
  ];
  let failed = 0;
  for (const t of tests) {
    try {
      const msg = t();
      process.stdout.write(msg + '\n');
    } catch (e) {
      failed += 1;
      process.stderr.write('FAIL ' + t.name + ': ' + (e && e.message ? e.message : e) + '\n');
      if (e && e.stack) process.stderr.write(e.stack + '\n');
    }
  }
  process.stdout.write(
    '\nrecord-decision-dual-write: ' + (tests.length - failed) + '/' + tests.length + ' passed\n'
  );
  process.exit(failed === 0 ? 0 : 1);
}

run();
