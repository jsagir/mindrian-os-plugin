#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 240 Plan 05 -- MEM-02 SC2 as REVISED on 2026-07-30.
 *
 * WHAT IT ANSWERS. It proves the promote, park and complete lifecycle each
 * reach the Phase 150 memory cortex (a real jtbd_transitioned memory_event
 * row in room.db, written through lib/hmi/across-session-memory.cjs and
 * lib/core/navigation.cjs's logJtbdTransition chokepoint) and that those
 * specific rows SURVIVE a real rebuildGraph, identical node id and
 * byte-identical properties blob.
 *
 * WHY IT EXISTS WHEN TWO SUITES ALREADY PASS. tests/test-jtbd-transition-
 * graph-wiring.cjs proves the WRITE (promote / park / complete each produce
 * a jtbd_transitioned row) but never runs a rebuild. tests/test-236-rebuild-
 * preserves-journal.cjs proves GENERIC survival, but its fixture seeds a
 * node_created memory_event, never a jtbd_transitioned one. Nothing joins
 * them: the specific row an across-session promote actually writes has
 * never been put through a rebuild. 240-VALIDATION.md row 240-04-01 records
 * this gap in its own words. This file is that join, and nothing else.
 *
 * THE MUTATION, VERBATIM IN INTENT -- READ THIS BEFORE TOUCHING A SINGLE
 * ASSERTION. ROADMAP SC2 says the rows survive "riding Phase 236's
 * transaction wrap", which invites the mutation "remove the transaction
 * wrap". That mutation ships GREEN with the bug intact. The correct
 * mutation is: add 'memory_event' to INDEXER_OWNED_NODE_TYPES at
 * lib/core/lazygraph-ops.cjs:81. That widening turns scenario 3 (THE JOIN)
 * red, because the scoped DELETE FROM nodes WHERE type IN (...) would then
 * be able to reach a row it must never touch. Removing the BEGIN / COMMIT /
 * ROLLBACK wrap around rebuildGraph does NOT turn this red: STATE.md
 * records the live Phase 236 Plan 02 result that "the WAL test's scenario 3
 * stayed GREEN, because 236-01's scoped DELETE means the irreplaceable rows
 * are never touched even when atomicity is gone." This file therefore pins
 * DELETE SCOPE, not atomicity. The transaction wrap itself is pinned by
 * tests/test-236-rebuild-preserves-journal.cjs scenario 2, not by this file.
 *
 * WHAT IS DELIBERATELY NOT HERE. No drainer, and no assertion that
 * graph-edge-pending.log shrinks. writeGraphEdge and GRAPH_EDGE_LOG were
 * deleted in commit 3c9afa2e (the RCA's human-approved Option B); the RCA's
 * Option A drainer was analysed, explicitly rejected, and human-approved
 * against on 2026-07-28 (locked navigator decision D-1). The 13 orphan
 * lines already on disk are frozen historical residue with no live producer
 * or consumer; a plan that asserts the log shrinks reverses that decision.
 * Scenario 5 below asserts only that the file is never RE-CREATED, which is
 * a WEAK signal by itself (that is exactly why scenarios 1 and 3 exist).
 *
 * THE THREE TRAPS THIS FILE CLOSES.
 *   Trap A (registry, T-240-32). tests/helpers/fixture-room-236.cjs writes a
 *     .room-root sentinel but NOT .rooms/registry.json. Without a registry
 *     entry, resolveRoomDirForSlug returns null and logGraphTransition is a
 *     graceful no-op, so every scenario below would pass over zero rows.
 *     withJoinedFixture() writes the registry entry itself and then asserts
 *     resolveRoomDirForSlug('fixture-236') resolves to the real room dir,
 *     throwing a labelled FIXTURE error otherwise.
 *   Trap B (dedupe, T-240-33). logJtbdTransition derives a dedupe_key from
 *     [type, kind, from, to] (spine-events.cjs:182-189, DEDUPE_TTL_MS =
 *     60000 at memory-events.cjs:673); a second identical call inside that
 *     window returns {ok:true, deduped:true} with NO INSERT. Scenario 1
 *     asserts EXACTLY one row per kind (not at-least-one); scenario 2 proves
 *     the dedupe window is real by re-promoting and re-asserting the count
 *     is still 1, so the exact-one counts in scenario 1 are meaningful
 *     rather than an artifact of only calling each writer once.
 *   Trap C (hand-fed state, T-240-35). tests/test-jtbd-transition-graph-
 *     wiring.cjs hand-feeds turn_count and manual_set literals that,
 *     before plan 240-03 landed, existed nowhere in production. Scenario 1's
 *     promote leg goes through a real jtbdState.setCurrent then getCurrent
 *     round trip and asserts manual_set === true FIRST, naming plan 240-03
 *     in the failure message, before ever calling promoteIfEligible.
 *
 * SEEDED THROUGH PRODUCTION WRITERS ONLY. Reuses tests/helpers/fixture-
 * room-236.cjs (Canon Part 7: no new fixture helper). The lifecycle calls go
 * through the real lib/hmi/across-session-memory.cjs / lib/hmi/jtbd-
 * state.cjs public API, never a hand-rolled INSERT.
 *
 * MUTATIONS RUN (Task 2, executed live 2026-07-30, both fully reverted).
 *
 *   MUTATION A, THE CORRECT ONE: changed INDEXER_OWNED_NODE_TYPES at
 *   lib/core/lazygraph-ops.cjs:81 from Object.freeze(['Artifact', 'Section'])
 *   to Object.freeze(['Artifact', 'Section', 'memory_event']). RESULT:
 *   scenario 3 (THE JOIN) turned RED, failing on "promote jtbd_transitioned
 *   row memory_event:jtbd_transitioned:... was DESTROYED by the rebuild".
 *   tests/test-236-rebuild-preserves-journal.cjs ALSO reddened under the same
 *   mutation (its own scenario 1, the node_created memory_event), confirming
 *   both files guard the same allowlist from different rows. Reverted;
 *   git diff --quiet lib/core/lazygraph-ops.cjs confirmed clean, both suites
 *   re-confirmed green.
 *
 *   MUTATION B, THE WRONG ONE, run deliberately as a counter-demonstration
 *   and NOT as proof of anything: commented out rebuildGraph's BEGIN
 *   (lib/core/lazygraph-ops.cjs:668) and its COMMIT (:743), leaving the
 *   ROLLBACK path syntactically valid. RESULT: this file stayed GREEN, all
 *   6 scenarios passing with zero changes. This EMPIRICALLY CONFIRMS that
 *   ROADMAP SC2's "riding Phase 236's transaction wrap" phrasing does NOT
 *   describe what protects these rows (240-RESEARCH.md Pitfall 4; STATE.md's
 *   live Phase 236 Plan 02 result: "the WAL test's scenario 3 stayed GREEN,
 *   because 236-01's scoped DELETE means the irreplaceable rows are never
 *   touched even when atomicity is gone"). Reverted; git diff --quiet
 *   lib/core/lazygraph-ops.cjs confirmed clean.
 *
 *   CONCLUSION: this file pins DELETE SCOPE, not atomicity. The transaction
 *   wrap itself is pinned by tests/test-236-rebuild-preserves-journal.cjs
 *   scenario 2, not by this file.
 *
 * DETERMINISTIC: no randomness in any asserted value, no network, no LLM.
 * Hermetic: MINDRIAN_ROOMS_HOME points at an fs.mkdtempSync scratch root for
 * the whole run, restored in finally, scratch removed in finally. NO
 * em-dashes anywhere (CLAUDE.md HARD RULE).
 *
 * Harness: the ok/fail/async scenario pass-counter from
 * tests/test-236-rebuild-preserves-journal.cjs, exiting nonzero when
 * failed > 0. No jest, no vitest.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const roomDb = require(path.join(REPO, 'lib', 'core', 'room-db.cjs'));
const lazygraph = require(path.join(REPO, 'lib', 'core', 'lazygraph-ops.cjs'));
const memoryEvents = require(path.join(REPO, 'lib', 'core', 'navigation', 'memory-events.cjs'));
const jtbdState = require(path.join(REPO, 'lib', 'hmi', 'jtbd-state.cjs'));

const {
  buildFixtureRoom236,
  countPopulations,
  readStageHistory,
  readNodeRow,
} = require(path.join(REPO, 'tests', 'helpers', 'fixture-room-236.cjs'));

const MEM_MODULE_PATH = path.join(REPO, 'lib', 'hmi', 'across-session-memory.cjs');

let passed = 0;
let failed = 0;

function ok(name) {
  passed += 1;
  process.stdout.write('  ok ' + name + '\n');
}

function fail(name, err) {
  failed += 1;
  process.stdout.write('  FAIL ' + name + '\n');
  if (err) process.stdout.write('    ' + (err.stack || err.message || String(err)) + '\n');
}

async function scenario(name, fn) {
  try { await fn(); ok(name); } catch (e) { fail(name, e); }
}

function makeScratchDir(suffix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mos-240-' + suffix + '-'));
}

function rmrf(p) {
  try { fs.rmSync(p, { recursive: true, force: true }); } catch (_) { /* best-effort */ }
}

// rebuildGraph is `async function rebuildGraph(conn, roomDir, _visited)` and
// takes an OPEN DatabaseSync conn as its FIRST argument. Do NOT call
// rebuildGraph(roomDir).
async function runRebuild(roomDir) {
  const db = roomDb.openRoomDb(roomDir);
  try {
    return await lazygraph.rebuildGraph(db, roomDir);
  } finally {
    roomDb.closeRoomDb(db);
  }
}

function withOpenRoom(roomDir, fn) {
  const db = roomDb.openRoomDb(roomDir);
  try { return fn(db); } finally { roomDb.closeRoomDb(db); }
}

function loadFreshModule() {
  delete require.cache[MEM_MODULE_PATH];
  return require(MEM_MODULE_PATH);
}

function readTransitions(roomDir, kind) {
  return withOpenRoom(roomDir, (db) => {
    const rows = memoryEvents.findRecentChanges(db, 0, { eventType: 'jtbd_transitioned', limit: 100 });
    return rows.filter((r) => r.properties && r.properties.kind === kind);
  });
}

// A recognisable prose marker, unique to this file, seeded into the fixture
// room's own ROOM.md BEFORE any lifecycle call so scenario 6 can prove no
// production write path serializes room content into a memory_event payload.
const CANARY = 'CANARY-240-05-9F2E1C-ROOM-PROSE-MUST-NOT-EGRESS';

// withJoinedFixture(fn) -- the piece that closes Trap A. Builds the shared
// Phase 236 fixture, registers it under a scratch MINDRIAN_ROOMS_HOME (the
// fixture writes .room-root but NOT .rooms/registry.json), asserts the
// registration actually resolves, seeds the Canon Part 8 canary, then hands
// (mem, fx, scratch) to fn. Restores the prior env var and removes the
// scratch root in finally regardless of outcome.
async function withJoinedFixture(fn) {
  const scratch = makeScratchDir('survive');
  const priorEnv = process.env.MINDRIAN_ROOMS_HOME;
  try {
    const fx = await buildFixtureRoom236(scratch, { artifactCount: 3, indexArtifacts: true });

    fs.mkdirSync(path.join(scratch, '.rooms'), { recursive: true });
    fs.writeFileSync(
      path.join(scratch, '.rooms', 'registry.json'),
      JSON.stringify({
        version: 1,
        rooms: [{ slug: 'fixture-236', abs_path: fx.roomDir, path: 'room' }],
      })
    );

    process.env.MINDRIAN_ROOMS_HOME = scratch;
    const mem = loadFreshModule();

    // FIXTURE SELF-CHECK, non-negotiable (Trap A / T-240-32). Without this,
    // every scenario below would pass over zero rows: resolveRoomDirForSlug
    // would return null and logGraphTransition would be a graceful no-op.
    const resolved = mem._internal.resolveRoomDirForSlug('fixture-236');
    if (resolved !== fx.roomDir) {
      throw new Error(
        'FIXTURE ERROR (Trap A, T-240-32): resolveRoomDirForSlug(\'fixture-236\') '
          + 'returned ' + JSON.stringify(resolved) + ', expected '
          + JSON.stringify(fx.roomDir) + '. The .rooms/registry.json write is '
          + 'missing or wrong, so every scenario below would silently pass over '
          + 'zero jtbd_transitioned rows because logGraphTransition degrades to a '
          + 'graceful no-op on an unregistered room. Fix the registry entry '
          + 'written by withJoinedFixture before trusting any scenario result.'
      );
    }

    // Canon Part 8 canary seed (T-240-36), written BEFORE any lifecycle call.
    fs.appendFileSync(
      path.join(fx.roomDir, 'ROOM.md'),
      '\n\nCANARY PROSE MARKER: ' + CANARY + ' must never appear in a '
        + 'memory_event payload emitted by this room.\n'
    );

    return await fn(mem, fx, scratch);
  } finally {
    if (priorEnv === undefined) delete process.env.MINDRIAN_ROOMS_HOME;
    else process.env.MINDRIAN_ROOMS_HOME = priorEnv;
    rmrf(scratch);
  }
}

// ---------------------------------------------------------------------------
// Runner. All six scenarios share ONE fixture room and run in sequence
// inside a single withJoinedFixture call, because scenario 3 (THE JOIN)
// depends on the exact node ids and raw properties scenario 1 wrote, and
// scenario 4 depends on the exact rebuild result scenario 3 produced.
// ---------------------------------------------------------------------------

(async () => {
  process.stdout.write(
    '\nPhase 240-05: MEM-02 SC2 join test '
      + '(promote/park/complete path -> rebuild-survival path)\n\n'
  );

  const captured = {};
  let rebuildResult = null;
  let countsAfterRebuild = null;

  await withJoinedFixture(async (mem, fx, scratch) => {
    await scenario(
      '1. promote, park and complete each write exactly one real jtbd_transitioned row',
      async () => {
        // Trap C: the promote leg goes through a real setCurrent -> getCurrent
        // round trip, never a hand-constructed literal.
        jtbdState.setCurrent(fx.roomDir, {
          jtbd: 'decide-pursue',
          confidence: 0.9,
          evidence: ['fixture-240'],
          trigger: 'manual_set',
          manual: true,
        });
        const cur = jtbdState.getCurrent(fx.roomDir);
        assert.ok(cur, 'jtbdState.getCurrent must return a real current object after setCurrent');
        assert.equal(
          cur.manual_set, true,
          'cur.manual_set must be true (plan 240-03 persists manual_set onto '
            + 'newCurrent in jtbd-state.cjs::setCurrent). If this assertion is '
            + 'red, plan 240-03 did not land and the rest of this scenario is '
            + 'meaningless.'
        );

        const promoteResult = mem.promoteIfEligible('fixture-236', {
          current: cur,
          history: jtbdState.history(fx.roomDir, 50),
        });
        assert.deepEqual(
          promoteResult, { action: 'promoted', jtbd: 'decide-pursue' },
          'promoteIfEligible must return {action:"promoted", jtbd:"decide-pursue"}, got '
            + JSON.stringify(promoteResult)
        );

        const parkResult = mem.parkJtbd('fixture-236', 'decide-pursue', 'fixture-240 park');
        assert.deepEqual(
          parkResult, { action: 'parked', jtbd: 'decide-pursue' },
          'parkJtbd must return {action:"parked", jtbd:"decide-pursue"}, got '
            + JSON.stringify(parkResult)
        );

        const completeResult = mem.completeJtbd(
          'fixture-236', 'decide-pursue', 'fixture-240 completion shape', []
        );
        assert.ok(
          completeResult && completeResult.action === 'completed',
          'completeJtbd must return a non-null completed result, got '
            + JSON.stringify(completeResult)
        );

        // Exactly one, not at-least-one (Trap B setup): zero means the write
        // never happened (Trap A), more than one means something double-wrote.
        const promoteRows = readTransitions(fx.roomDir, 'promote');
        const parkRows = readTransitions(fx.roomDir, 'park');
        const completeRows = readTransitions(fx.roomDir, 'complete');
        assert.equal(promoteRows.length, 1, 'exactly one kind:promote row, got ' + promoteRows.length);
        assert.equal(parkRows.length, 1, 'exactly one kind:park row, got ' + parkRows.length);
        assert.equal(completeRows.length, 1, 'exactly one kind:complete row, got ' + completeRows.length);

        captured.promoteId = promoteRows[0].id;
        captured.parkId = parkRows[0].id;
        captured.completeId = completeRows[0].id;

        const raws = withOpenRoom(fx.roomDir, (db) => ({
          promote: readNodeRow(db, captured.promoteId),
          park: readNodeRow(db, captured.parkId),
          complete: readNodeRow(db, captured.completeId),
        }));
        captured.promoteRaw = raws.promote;
        captured.parkRaw = raws.park;
        captured.completeRaw = raws.complete;

        assert.ok(captured.promoteRaw && captured.promoteRaw.type === 'memory_event', 'promote row must be type memory_event');
        assert.ok(captured.parkRaw && captured.parkRaw.type === 'memory_event', 'park row must be type memory_event');
        assert.ok(captured.completeRaw && captured.completeRaw.type === 'memory_event', 'complete row must be type memory_event');
      }
    );

    await scenario(
      '2. the 60 second dedupe window is real, converting Trap B into a pinned property',
      async () => {
        const cur = jtbdState.getCurrent(fx.roomDir);
        const repeatResult = mem.promoteIfEligible('fixture-236', {
          current: cur,
          history: jtbdState.history(fx.roomDir, 50),
        });
        assert.ok(
          repeatResult,
          'a repeat promoteIfEligible must still return a result (the primary '
            + 'Layer 2 jtbd-history.json write is an idempotent in-place update, '
            + 'not gated by the graph-side dedupe window)'
        );
        const promoteRows = readTransitions(fx.roomDir, 'promote');
        assert.equal(
          promoteRows.length, 1,
          'promote rows must STILL be 1 after an immediate repeat call: '
            + 'logJtbdTransition derives a dedupe_key from [type, kind, from, to] '
            + '(spine-events.cjs:182-189) and returns {ok:true, deduped:true} with '
            + 'NO INSERT inside the 60 second window (DEDUPE_TTL_MS = 60000, '
            + 'memory-events.cjs:673), so a test expecting two rows here would '
            + 'fail for the wrong reason. Got ' + promoteRows.length
        );
      }
    );

    await scenario(
      '3. THE JOIN: all three rows and the whole irreplaceable population survive a real rebuildGraph',
      async () => {
        const beforeCounts = withOpenRoom(fx.roomDir, (db) => countPopulations(db));

        rebuildResult = await runRebuild(fx.roomDir);
        countsAfterRebuild = withOpenRoom(fx.roomDir, (db) => countPopulations(db));

        const after = withOpenRoom(fx.roomDir, (db) => ({
          promote: readNodeRow(db, captured.promoteId),
          park: readNodeRow(db, captured.parkId),
          complete: readNodeRow(db, captured.completeId),
          memEvent: readNodeRow(db, fx.memoryEventId),
          claim: readNodeRow(db, fx.claimId),
        }));

        assert.ok(after.promote, 'promote jtbd_transitioned row ' + captured.promoteId + ' was DESTROYED by the rebuild');
        assert.ok(after.park, 'park jtbd_transitioned row ' + captured.parkId + ' was DESTROYED by the rebuild');
        assert.ok(after.complete, 'complete jtbd_transitioned row ' + captured.completeId + ' was DESTROYED by the rebuild');

        assert.equal(after.promote.id, captured.promoteRaw.id, 'promote row id must be unchanged across the rebuild');
        assert.equal(after.park.id, captured.parkRaw.id, 'park row id must be unchanged across the rebuild');
        assert.equal(after.complete.id, captured.completeRaw.id, 'complete row id must be unchanged across the rebuild');

        assert.equal(
          after.promote.properties, captured.promoteRaw.properties,
          'promote row properties must be BYTE-IDENTICAL across the rebuild (raw strings compared, never re-parsed)'
        );
        assert.equal(
          after.park.properties, captured.parkRaw.properties,
          'park row properties must be BYTE-IDENTICAL across the rebuild'
        );
        assert.equal(
          after.complete.properties, captured.completeRaw.properties,
          'complete row properties must be BYTE-IDENTICAL across the rebuild'
        );

        assert.equal(after.promote.type, 'memory_event', 'promote row type must still be memory_event');
        assert.equal(after.park.type, 'memory_event', 'park row type must still be memory_event');
        assert.equal(after.complete.type, 'memory_event', 'complete row type must still be memory_event');

        // The 236 fixture's own irreplaceable population must ALSO survive, so
        // this scenario measures the whole irreplaceable population, not only
        // the new rows this plan's lifecycle calls wrote.
        assert.ok(after.memEvent, '236 fixture memory_event ' + fx.memoryEventId + ' was destroyed by the rebuild');
        assert.ok(after.claim, '236 fixture claim ' + fx.claimId + ' was destroyed by the rebuild');
        assert.equal(after.claim.review_status, 'confirmed', '236 fixture claim must still be review_status:confirmed after the rebuild');
        const stageHistoryAfter = withOpenRoom(fx.roomDir, (db) => readStageHistory(db, fx.opportunityId));
        assert.ok(
          Array.isArray(stageHistoryAfter) && stageHistoryAfter.length >= 2,
          '236 fixture opportunity stage_history must survive with length unchanged, got '
            + JSON.stringify(stageHistoryAfter)
        );

        assert.equal(
          countsAfterRebuild.memory_event, beforeCounts.memory_event,
          'total memory_event population count must be unchanged across the rebuild: before '
            + beforeCounts.memory_event + ', after ' + countsAfterRebuild.memory_event
        );
      }
    );

    await scenario(
      '4. NON-VACUITY: the rebuild in scenario 3 did real work, so survival is not survival-by-doing-nothing',
      async () => {
        assert.ok(rebuildResult, 'scenario 3 must have run runRebuild before this scenario can assert on its result');
        assert.equal(
          rebuildResult.success, true,
          'rebuildGraph must report success:true, got ' + JSON.stringify(rebuildResult)
        );
        assert.ok(
          rebuildResult.artifacts > 0,
          'rebuildGraph must report artifacts greater than 0 (a change that made '
            + 'rebuildGraph delete nothing at all would otherwise pass scenario 3 '
            + 'vacuously), got ' + rebuildResult.artifacts
        );
        assert.ok(
          countsAfterRebuild && countsAfterRebuild.Artifact > 0,
          'post-rebuild Artifact node count must be greater than 0, got '
            + JSON.stringify(countsAfterRebuild)
        );
      }
    );

    await scenario(
      '5. the retired graph-edge-pending.log dead-letter file is never re-created; jtbd-history.json IS written',
      async () => {
        const deadLetterPath = path.join(scratch, '.memory', 'graph-edge-pending.log');
        assert.ok(
          !fs.existsSync(deadLetterPath),
          'graph-edge-pending.log must never be re-created. Its producer '
            + '(writeGraphEdge) was deleted in commit 3c9afa2e and the RCA\'s '
            + 'Option A drainer was human-approved against (locked decision '
            + 'D-1). This mirrors tests/test-jtbd-transition-graph-wiring.cjs '
            + 'test 6 and is a WEAK signal alone, which is exactly why '
            + 'scenarios 1 and 3 above are the load-bearing ones.'
        );
        const historyPath = path.join(scratch, '.memory', 'jtbd-history.json');
        assert.ok(
          fs.existsSync(historyPath),
          'jtbd-history.json must exist, confirming the Layer 2 store write '
            + 'happened alongside the graph write'
        );
      }
    );

    await scenario(
      '6. Canon Part 8: the three payloads carry only scalars and enum handles, and the ROOM.md canary never leaks',
      async () => {
        const rows = [captured.promoteRaw, captured.parkRaw, captured.completeRaw];
        const allowedKinds = ['promote', 'park', 'complete'];
        for (const row of rows) {
          assert.ok(
            row.properties.indexOf(CANARY) === -1,
            'CANARY LEAK: the ROOM.md prose marker (' + CANARY + ') appears in a '
              + 'jtbd_transitioned payload, meaning some write path serialized room '
              + 'content into the memory cortex. Raw blob: ' + row.properties
          );
          const props = JSON.parse(row.properties);
          assert.ok(
            allowedKinds.indexOf(props.kind) !== -1,
            'kind must be one of promote/park/complete, got ' + props.kind
          );
          assert.equal(props.to, 'decide-pursue', 'to must be the jtbd slug string');
          assert.equal(props.roomSlug, 'fixture-236', 'roomSlug must be the slug');
          assert.equal(props.created_by, 'system', 'created_by must be "system"');
          assert.ok(
            typeof props.source_path === 'string' && props.source_path.indexOf('across-session:') === 0,
            'source_path must start with "across-session:", got ' + props.source_path
          );
          for (const key of Object.keys(props)) {
            const value = props[key];
            if (typeof value !== 'string') continue;
            // A crude, deliberately conservative multi-sentence detector:
            // sentence-ending punctuation followed by whitespace and a
            // capital letter. None of the scalar/enum values this plan's
            // lifecycle calls pass (kind, to, roomSlug, created_by,
            // source_path, state, reason, completion_shape,
            // completion_evidence, dedupe_key, event_type, ts) match this
            // shape; a multi-sentence prose string would.
            const sentenceEnders = (value.match(/[.!?]\s+[A-Z]/g) || []).length;
            assert.equal(
              sentenceEnders, 0,
              'field "' + key + '" looks like multi-sentence prose (Canon Part 8 '
                + 'violation): ' + JSON.stringify(value)
            );
          }
        }
      }
    );
  });

  process.stdout.write('\n  passed: ' + passed + '  failed: ' + failed + '\n\n');
  if (failed > 0) process.exit(1);
})();
