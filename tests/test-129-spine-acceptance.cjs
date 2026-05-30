'use strict';
// Phase 129-05 -- the load-bearing instrumented acceptance test (the phase
// release gate). Mirrors tests/test-navigation-acceptance.cjs (Phase 109) EXACTLY:
// direct-CJS (node:assert/strict, no Mocha/Jest, zero new npm deps),
// setupRoom / cleanup / run, and the fs-instrument zero-reads gate spanning the
// flow.
//
// What it proves (per 129-CONTEXT + the Phase 109 precedent): the FULL proactive
// loop driven ONLY through the lib/core/navigation.cjs chokepoint
//   status -> suggest-next -> act(entered) -> act(completed) -> next status
// produces the EXACT memory_event count + sequence, with ZERO non-SQLite
// filesystem reads outside the two named cache files, and the next status render
// READS the just-emitted events (the backward arc is closed).
//
// The three LOAD-BEARING assertions:
//   (a) fsInstrument.install BEFORE the loop, uninstall AFTER; the leaked reads
//       filtered to EXCLUDE the two allow-listed cache filenames
//       (jtbd-state.json, conversation-operator.json) is empty -- zero non-SQLite
//       reads outside the cache files during the loop.
//   (b) the EXACT memory_event count for one loop pass via findRecentChanges: 4
//       new rows (spine_read + suggestion_surfaced + workflow_stage entered +
//       workflow_stage completed); the repeated status spine_read with an
//       unchanged dedupe_key dedupes inside the 60s TTL, so the second status
//       emits 0 new rows -- asserted numerically.
//   (c) the next status render READS the just-emitted events: after the loop,
//       findRecentChanges (and getCurrentJTBD / getCurrentOperator, which read
//       the event log first) returns the events the loop just wrote.
//
// Plus: a FOLLOWS_FROM edge landed between the act entered + completed events.
//
// Canon Part 4 (every transition is a typed memory_event in the local graph).
// Canon Part 8 (the spine reaches room.db only through navigation; no folder scan).
// Canon Part 9 (SQL is the local mind, proven by instrumentation -- zero non-SQLite
//   filesystem reads outside the two named cache files during the loop).
//
// NO em-dashes anywhere in this file (CLAUDE.md HARD RULE).

const { ok, equal } = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const REPO_ROOT = path.resolve(__dirname, '..');
const { openRoomDb, closeRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));
const navigation = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation.cjs'));
const memoryEvents = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'memory-events.cjs'));
const fsInstrument = require(path.join(__dirname, 'helpers', 'fs-instrument.cjs'));

const SEED_SQL = path.join(REPO_ROOT, 'tests', 'fixtures', 'phase-129', 'sample-room', 'seed.sql');
const FOCUS_NODE = 'decision:mcp-app-first';

// The two cache files the spine getCurrent* fallback path is ALLOWED to read.
// The fs-instrument allow-list only permits room.db (+ WAL/SHM/journal); these
// two filenames are the EXPECTED cache reads, so the test filters them out of
// fsInstrument.calls() and asserts zero OTHER non-SQLite reads.
const ALLOWED_CACHE_FILENAMES = ['jtbd-state.json', 'conversation-operator.json'];

// Loop state held constant across the two status passes so the second status
// spine_read carries the SAME derived dedupe_key (surface + section + jtbd +
// operator) and dedupes inside the 60s TTL.
const SECTION = 'solution-design';
const JTBD = 'validate-market';
// OPERATOR must be a valid operator enum value (lib/conversation/operator.cjs
// OPERATORS) so the conversation-operator.json cache fallback returns it rather
// than falling back to the JUST_TALK default.
const OPERATOR = 'EXPLORE_CAPTURE';

function isCacheRead(call) {
  const t = typeof call.target === 'string' ? call.target : String(call.target);
  return ALLOWED_CACHE_FILENAMES.some((name) => t.endsWith(name));
}

function setupRoom() {
  // openRoomDb bootstraps the lazygraph + memory schema (filesystem writes +
  // schema reads). This MUST happen BEFORE the fs proxy installs; the proxy only
  // wraps reads, and the seed.sql readFileSync below also happens pre-proxy.
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'phase-129-acceptance-'));
  const roomDir = tmp;
  fs.mkdirSync(path.join(roomDir, '.mindrian'), { recursive: true });
  const db = openRoomDb(roomDir);
  // Apply the phase-129 fixture seed (single db.exec into node:sqlite; the
  // seed.sql readFileSync is pre-proxy).
  db.exec(fs.readFileSync(SEED_SQL, 'utf8'));
  closeRoomDb(db);

  // Seed the two cache files so the getCurrent* fallback path has something to
  // read. These reads are EXPECTED and allow-listed by the test filter. Pre-proxy.
  const nowIso = new Date().toISOString();
  // jtbd-state.json shape: { current: { jtbd, ... }, history: [] } per
  // lib/hmi/jtbd-state.cjs getCurrent (returns state.current).
  fs.writeFileSync(
    path.join(roomDir, '.mindrian', 'jtbd-state.json'),
    JSON.stringify({ current: { jtbd: JTBD, confidence: 0.6, entered_at: nowIso }, history: [] })
  );
  // conversation-operator.json shape: { schema_version, current, previous, ... }
  // per lib/conversation/operator.cjs getCurrent (schema_version + valid enum).
  fs.writeFileSync(
    path.join(roomDir, '.mindrian', 'conversation-operator.json'),
    JSON.stringify({ schema_version: '1.0.0', current: OPERATOR, previous: null, entered_at: nowIso })
  );
  return { tmp, roomDir };
}

function cleanup(tmp) {
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) { /* ignore */ }
}

// Drive the full proactive loop ONLY through the navigation.cjs chokepoint. Each
// helper takes a roomDir (never a db handle), opens room.db internally, logs the
// right memory_event, and closes. Returns the per-step log results so the test
// can assert the entered->completed FOLLOWS_FROM linkage.
function runProactiveLoop(roomDir) {
  const out = {};
  // 1. /mos:status surface -- spine_read (pass 1).
  out.status1 = navigation.logSpineRead(roomDir, {
    surface: 'status', section: SECTION, jtbd: JTBD, operator: OPERATOR,
  });
  // 2. /mos:suggest-next surface -- suggestion_surfaced.
  out.suggest = navigation.logSuggestionSurfaced(roomDir, {
    surface: 'suggest-next',
    commands: ['mos:explore-domains', 'mos:challenge-assumptions'],
    top_score: 0.82,
  });
  // 3. /mos:act surface -- workflow_stage entered, then completed (with
  //    follows_from pointing at the entered event id; the helper writes a
  //    FOLLOWS_FROM edge new-event -> prior-event).
  out.actEntered = navigation.logWorkflowStage(roomDir, {
    surface: 'act', phase: 'entered', stage: 'run', command: 'mos:explore-domains',
  });
  out.actCompleted = navigation.logWorkflowStage(roomDir, {
    surface: 'act', phase: 'completed', stage: 'run', command: 'mos:explore-domains',
    follows_from: out.actEntered && out.actEntered.eventId,
  });
  // 4. next /mos:status -- spine_read (pass 2). SAME derived dedupe_key as pass 1
  //    (surface + section + jtbd + operator unchanged) so it dedupes inside 60s.
  out.status2 = navigation.logSpineRead(roomDir, {
    surface: 'status', section: SECTION, jtbd: JTBD, operator: OPERATOR,
  });
  return out;
}

function test_proactiveLoop_instrumented() {
  const { tmp, roomDir } = setupRoom();
  try {
    let loop;
    fsInstrument.install({ throwOnViolation: false });
    try { loop = runProactiveLoop(roomDir); }
    finally { fsInstrument.uninstall(); }

    // ---- LOAD-BEARING (a): zero non-SQLite reads outside the two cache files.
    const allLeaks = fsInstrument.calls();
    const nonCacheLeaks = allLeaks.filter((c) => !isCacheRead(c));
    ok(
      nonCacheLeaks.length === 0,
      'LOAD-BEARING (a): zero non-SQLite filesystem reads outside the two cache files during the loop; leaked: '
        + JSON.stringify(nonCacheLeaks.map((c) => ({ method: c.method, target: c.target })))
    );

    // Every spine log call must have succeeded (room.db was present).
    ok(loop.status1 && loop.status1.ok === true, 'status pass 1 logged (got ' + JSON.stringify(loop.status1) + ')');
    ok(loop.suggest && loop.suggest.ok === true, 'suggestion_surfaced logged');
    ok(loop.actEntered && loop.actEntered.ok === true, 'workflow_stage entered logged');
    ok(loop.actCompleted && loop.actCompleted.ok === true, 'workflow_stage completed logged');
    ok(loop.status2 && loop.status2.ok === true, 'status pass 2 returned ok');

    // The repeated status (pass 2) carried the SAME dedupe_key and dedupes inside
    // the 60s TTL -- it must be marked deduped and NOT add a new row.
    ok(loop.status2.deduped === true, 'LOAD-BEARING (b): the second status spine_read dedupes (deduped marker present)');

    // ---- LOAD-BEARING (b): the EXACT memory_event count + sequence for one pass.
    // 4 NEW rows: spine_read + suggestion_surfaced + workflow_stage(entered) +
    // workflow_stage(completed). The pass-2 status dedupes -> 0 new rows.
    const db = openRoomDb(roomDir);
    try {
      const all = memoryEvents.findRecentChanges(db, 0, { limit: 100 });
      // The seed writes no memory_event rows; only the loop does. The exact count
      // is 4 (the pass-2 status deduped).
      const loopEvents = all.filter((e) => typeof e.eventType === 'string'
        && ['spine_read', 'suggestion_surfaced', 'workflow_stage'].includes(e.eventType));
      equal(loopEvents.length, 4, 'LOAD-BEARING (b): exactly 4 memory_event rows from one loop pass (got ' + loopEvents.length + ')');

      // The sequence by type: exactly 1 spine_read (pass 2 deduped), 1
      // suggestion_surfaced, 2 workflow_stage (entered + completed).
      const byType = {};
      for (const e of loopEvents) { byType[e.eventType] = (byType[e.eventType] || 0) + 1; }
      equal(byType.spine_read, 1, 'exactly 1 spine_read row (the deduped pass-2 status added none; got ' + byType.spine_read + ')');
      equal(byType.suggestion_surfaced, 1, 'exactly 1 suggestion_surfaced row');
      equal(byType.workflow_stage, 2, 'exactly 2 workflow_stage rows (entered + completed; got ' + byType.workflow_stage + ')');

      // The act workflow_stage rows carry the expected phase enums.
      const stages = loopEvents
        .filter((e) => e.eventType === 'workflow_stage')
        .map((e) => e.properties && e.properties.phase)
        .sort();
      equal(JSON.stringify(stages), JSON.stringify(['completed', 'entered']), 'workflow_stage phases are entered + completed');

      // ---- the FOLLOWS_FROM edge landed between the act entered + completed events.
      const edgeRow = db.prepare(
        "SELECT COUNT(*) AS c FROM edges WHERE type = 'FOLLOWS_FROM' AND source = ? AND target = ?"
      ).get(loop.actCompleted.eventId, loop.actEntered.eventId);
      ok(edgeRow && edgeRow.c >= 1, 'a FOLLOWS_FROM edge links the completed event to the entered event (got ' + (edgeRow && edgeRow.c) + ')');

      // ---- LOAD-BEARING (c): the next status render READS the just-emitted events.
      // findRecentChanges (the read the next /mos:status performs) returns the
      // events the loop just wrote -- the backward arc is closed.
      const seenIds = new Set(all.map((e) => e.id));
      ok(seenIds.has(loop.status1.eventId), 'next render reads the pass-1 spine_read event');
      ok(seenIds.has(loop.suggest.eventId), 'next render reads the suggestion_surfaced event');
      ok(seenIds.has(loop.actEntered.eventId), 'next render reads the act-entered event');
      ok(seenIds.has(loop.actCompleted.eventId), 'next render reads the act-completed event');
    } finally {
      try { closeRoomDb(db); } catch (_) { /* ignore */ }
    }

    // getCurrentJTBD / getCurrentOperator read the event log first, cache second.
    // No jtbd_transitioned / operator_transitioned events were written this loop,
    // so they resolve via the allow-listed cache fallback -- proving the next
    // look sees consistent working memory.
    const curJtbd = navigation.getCurrentJTBD(roomDir);
    ok(curJtbd && curJtbd.jtbd === JTBD, 'getCurrentJTBD resolves the seeded jtbd (got ' + JSON.stringify(curJtbd) + ')');
    equal(curJtbd.source, 'cache_fallback', 'getCurrentJTBD used the allow-listed cache fallback (no jtbd_transitioned event this loop)');
    const curOp = navigation.getCurrentOperator(roomDir);
    ok(curOp && curOp.current === OPERATOR, 'getCurrentOperator resolves the seeded operator (got ' + JSON.stringify(curOp) + ')');
    equal(curOp.source, 'cache_fallback', 'getCurrentOperator used the allow-listed cache fallback');
  } finally {
    cleanup(tmp);
  }
}

function run() {
  const tests = [test_proactiveLoop_instrumented];
  let pass = 0;
  let fail = 0;
  for (const t of tests) {
    try {
      t();
      pass++;
      process.stdout.write('PASS ' + t.name + '\n');
    } catch (err) {
      fail++;
      process.stderr.write('FAIL ' + t.name + ': ' + err.message + '\n' + (err.stack || '') + '\n');
    }
  }
  process.stdout.write('test-129-spine-acceptance: ' + pass + '/' + tests.length + ' passed\n');
  process.exit(fail === 0 ? 0 : 1);
}

run();
