#!/usr/bin/env node
'use strict';

/*
 * test-memory-lifecycle-stop-repeated.cjs
 *
 * Regression fence for debug session
 * stale-voice-log-session-summary-banner-frozen-after-first-stop
 * (.planning/debug/resolved/stale-voice-log-session-summary-banner-frozen-after-first-stop.md).
 *
 * Root cause: scripts/memory-lifecycle.cjs::cmdStop deleted the session
 * pointer unconditionally in its `finally` block on every successful run.
 * Claude Code's Stop hook fires after EVERY assistant turn, not once per
 * session, so the SECOND and every later Stop event in the same session
 * found no pointer and silently no-op'd -- no new voice_log row, no fresh
 * fragment ingest, ever again. The Stop-hook systemMessage banner (built
 * from the voice_log tail) froze at turn 1's content and timestamp forever.
 *
 * This suite simulates 2+ Stop events in ONE session (the exact cardinality
 * Claude Code produces) and asserts:
 *   Test 1: the session pointer SURVIVES a Stop event (the literal fix) and
 *           a SECOND Stop produces a distinct, fresher voice_log row.
 *   Test 2: N (>=3) Stop events each produce a distinct voice_log row whose
 *           answer_summary reflects THAT turn's transcript content (not
 *           frozen at turn 1), while the 'session-summary' fragment and the
 *           session pointer do NOT grow unboundedly (upsert / kept-alive,
 *           not appended).
 *
 * Constraints: no jest/mocha/vitest/ava. Node built-in assert only. CJS.
 * No new npm dependencies. No emojis. No em-dashes. parallel_safe: false
 * (writes to its own tmp fixture dirs, cleaned up per test).
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const MEMORY_LIFECYCLE = path.join(REPO_ROOT, 'scripts', 'memory-lifecycle.cjs');
const FIXTURES_ROOT = path.join(os.tmpdir(), 'stop-repeated-test-fixtures');
fs.mkdirSync(FIXTURES_ROOT, { recursive: true });

let pass = 0;
let fail = 0;
const failures = [];

function ok(name, cond, detail) {
  if (cond) {
    pass += 1;
    console.log('  ok - ' + name);
  } else {
    fail += 1;
    failures.push(name + (detail ? ' :: ' + detail : ''));
    console.log('  NOT OK - ' + name + (detail ? ' :: ' + detail : ''));
  }
}

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function mkFixtureDir(label) {
  const dir = path.join(FIXTURES_ROOT, (label || 'case') + '-' + crypto.randomUUID());
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function rmFixture(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) { /* ignore */ }
}

function pointerPath(roomDir) {
  return path.join(roomDir, '.mindrian', 'current-session.json');
}

function pointerExists(roomDir) {
  return fs.existsSync(pointerPath(roomDir));
}

// Open a room.db handle directly (bypassing memory-ops async wrappers) so
// tests can assert on raw table contents. Mirrors the { db: ... } shape
// memory-lifecycle.cjs itself constructs (room-db.cjs's openRoomDb returns
// the bare DatabaseSync synchronously).
function openRoomDb(roomDir) {
  const roomDb = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));
  return roomDb.openRoomDb(roomDir);
}

function closeRoomDb(db) {
  const roomDb = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));
  try { roomDb.closeRoomDb({ db: db }); } catch (_) { /* ignore */ }
}

// Runs `node scripts/memory-lifecycle.cjs <sub> <roomDir>` as a real
// subprocess (mirrors how the Stop/SessionStart hooks actually invoke it),
// with an optional transcript path exported so ingestTranscriptFragments
// has something to parse.
function runMemoryLifecycle(sub, roomDir, transcriptPath) {
  const env = Object.assign({}, process.env);
  if (transcriptPath) {
    env.MINDRIAN_TRANSCRIPT_PATH = transcriptPath;
  } else {
    delete env.MINDRIAN_TRANSCRIPT_PATH;
  }
  const res = spawnSync(process.execPath, [MEMORY_LIFECYCLE, sub, roomDir], {
    env: env,
    encoding: 'utf8',
    timeout: 10000,
  });
  return res;
}

// Appends one user+assistant turn pair to a transcript JSONL fixture file,
// in the shape scripts/transcript-ingest.cjs's parseTranscript expects:
// { type: 'user', message: { content: <string> } }
// { type: 'assistant', message: { content: [{ type: 'text', text: <string> }] } }
function appendTranscriptTurn(transcriptPath, userText, assistantText) {
  const userLine = JSON.stringify({ type: 'user', message: { content: userText } });
  const assistantLine = JSON.stringify({
    type: 'assistant',
    message: { content: [{ type: 'text', text: assistantText }] },
  });
  fs.appendFileSync(transcriptPath, userLine + '\n' + assistantLine + '\n');
}

function readVoiceLogRows(roomDir) {
  const db = openRoomDb(roomDir);
  try {
    return db.prepare('SELECT id, timestamp, answer_summary FROM voice_log ORDER BY id ASC').all();
  } finally {
    closeRoomDb(db);
  }
}

function countFragmentsByExactRole(roomDir, role) {
  const db = openRoomDb(roomDir);
  try {
    const row = db.prepare('SELECT COUNT(*) AS n FROM fragments WHERE role = ?').get(role);
    return (row && row.n) || 0;
  } finally {
    closeRoomDb(db);
  }
}

function countConvoFragments(roomDir) {
  const db = openRoomDb(roomDir);
  try {
    const row = db.prepare(
      "SELECT COUNT(*) AS n FROM fragments WHERE role IN ('user','assistant')"
    ).get();
    return (row && row.n) || 0;
  } finally {
    closeRoomDb(db);
  }
}

// ---------------------------------------------------------------------------
// Test 1: two Stop events in one session -- pointer survives, second Stop
// produces a distinct, fresher voice_log row.
// ---------------------------------------------------------------------------

function test1() {
  const dir = mkFixtureDir('test1');
  const roomDir = path.join(dir, 'room');
  fs.mkdirSync(roomDir, { recursive: true });
  const transcriptPath = path.join(dir, 'transcript.jsonl');
  fs.writeFileSync(transcriptPath, '');

  try {
    const start = runMemoryLifecycle('session-start', roomDir, null);
    ok('test1: session-start exits 0', start.status === 0, JSON.stringify(start.stderr));
    ok('test1: pointer exists after session-start', pointerExists(roomDir));

    // Turn 1's Stop event.
    appendTranscriptTurn(transcriptPath, 'turn one question', 'turn one answer');
    const stop1 = runMemoryLifecycle('stop', roomDir, transcriptPath);
    ok('test1: first stop exits 0', stop1.status === 0, JSON.stringify(stop1.stderr));
    ok(
      'test1: pointer SURVIVES the first Stop event (the root-cause fix)',
      pointerExists(roomDir)
    );

    const rowsAfterFirst = readVoiceLogRows(roomDir);
    ok('test1: exactly one voice_log row after first stop', rowsAfterFirst.length === 1);

    // Turn 2's Stop event -- this is the event that used to be a silent
    // no-op because the pointer was gone.
    appendTranscriptTurn(transcriptPath, 'turn two question', 'turn two answer');
    const stop2 = runMemoryLifecycle('stop', roomDir, transcriptPath);
    ok('test1: second stop exits 0', stop2.status === 0, JSON.stringify(stop2.stderr));
    ok('test1: pointer SURVIVES the second Stop event too', pointerExists(roomDir));

    const rowsAfterSecond = readVoiceLogRows(roomDir);
    ok(
      'test1: a SECOND, distinct voice_log row exists after the second stop',
      rowsAfterSecond.length === 2
    );
    ok(
      'test1: second row has a different id than the first',
      rowsAfterSecond.length === 2 && rowsAfterSecond[1].id !== rowsAfterFirst[0].id
    );
    ok(
      'test1: second row reflects turn 2 content, not the frozen turn-1 row',
      rowsAfterSecond.length === 2 &&
        rowsAfterSecond[1].answer_summary === 'turn two answer' &&
        rowsAfterSecond[1].answer_summary !== rowsAfterSecond[0].answer_summary
    );
  } finally {
    rmFixture(dir);
  }
}

// ---------------------------------------------------------------------------
// Test 2: N (>=3) Stop events -- N distinct fresh voice_log rows, no
// runaway session-summary fragment growth, no runaway pointer churn.
// ---------------------------------------------------------------------------

function test2() {
  const N = 4;
  const dir = mkFixtureDir('test2');
  const roomDir = path.join(dir, 'room');
  fs.mkdirSync(roomDir, { recursive: true });
  const transcriptPath = path.join(dir, 'transcript.jsonl');
  fs.writeFileSync(transcriptPath, '');

  try {
    const start = runMemoryLifecycle('session-start', roomDir, null);
    ok('test2: session-start exits 0', start.status === 0, JSON.stringify(start.stderr));

    for (let i = 1; i <= N; i++) {
      appendTranscriptTurn(transcriptPath, 'turn ' + i + ' question', 'turn ' + i + ' answer');
      const stopRes = runMemoryLifecycle('stop', roomDir, transcriptPath);
      ok('test2: stop event ' + i + ' exits 0', stopRes.status === 0, JSON.stringify(stopRes.stderr));
      ok('test2: pointer survives stop event ' + i, pointerExists(roomDir));
    }

    const rows = readVoiceLogRows(roomDir);
    ok('test2: voice_log has exactly ' + N + ' rows, none silently skipped', rows.length === N,
      'got ' + rows.length);

    // ids strictly increasing (every event wrote a genuinely NEW row).
    let strictlyIncreasing = true;
    for (let i = 1; i < rows.length; i++) {
      if (!(rows[i].id > rows[i - 1].id)) strictlyIncreasing = false;
    }
    ok('test2: voice_log row ids are strictly increasing across all ' + N + ' events', strictlyIncreasing);

    // Each row's content reflects its own turn, not a frozen repeat.
    let contentMatchesTurn = true;
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].answer_summary !== 'turn ' + (i + 1) + ' answer') contentMatchesTurn = false;
    }
    ok('test2: each voice_log row content matches its own turn (no freezing)', contentMatchesTurn,
      JSON.stringify(rows.map((r) => r.answer_summary)));

    // No duplicate/runaway session-summary fragment growth: exactly ONE
    // 'session-summary' fragment row exists no matter how many Stop events fired.
    const summaryFragCount = countFragmentsByExactRole(roomDir, 'session-summary');
    ok(
      'test2: exactly one session-summary fragment exists after ' + N + ' stop events (upsert, not append)',
      summaryFragCount === 1,
      'got ' + summaryFragCount
    );

    // Conversation fragments ingested exactly once per turn (2 per turn:
    // one user + one assistant), never duplicated by re-ingestion.
    const convoFragCount = countConvoFragments(roomDir);
    ok(
      'test2: exactly ' + (N * 2) + ' user/assistant fragments ingested (2/turn, no duplication)',
      convoFragCount === N * 2,
      'got ' + convoFragCount
    );
  } finally {
    rmFixture(dir);
  }
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

console.log('--- test-memory-lifecycle-stop-repeated.cjs ---');
console.log('Test 1: two Stop events in one session');
test1();
console.log('Test 2: N=4 Stop events in one session');
test2();

console.log('');
console.log('PASS ' + pass + ' / FAIL ' + fail);
if (fail > 0) {
  console.log('');
  console.log('Failures:');
  for (const f of failures) console.log('  - ' + f);
  console.log('>>> test-memory-lifecycle-stop-repeated.cjs: FAILED');
  process.exit(1);
}
console.log('>>> test-memory-lifecycle-stop-repeated.cjs: PASSED');
process.exit(0);
