'use strict';
/*
 * Phase 160-06 Task 1 test -- the ONE shared tri-polar date+sync gate (R11, D-02).
 * ==============================================================================
 *
 * Asserts the single enforcement chokepoint requireValidAt(filingNode, opts):
 *   1. a meeting with no valid_at returns GATE_BLOCK with a Shape F.1 selector
 *      spec ("when?" + multi-select "relates to?") -- SPEC R11 acceptance 1.
 *   2. a meeting given "last Tuesday" resolves valid_at against an injected
 *      reference (getReferenceNow seam) -- SPEC R11 acceptance 2.
 *   3. a multi-selected relation writes a sync edge AND emits
 *      f_selector_sync_confirmed -- SPEC R11 acceptance 3.
 *   4. a pure idea (not a real-world event) stamps valid_at = filing time
 *      silently -- GATE_PASS, no selector, no block.
 *   5. an explicit numeric valid_at on a meeting passes (the human already owns
 *      the date) and created_at stays the filing moment.
 *
 * House rule: hyphens only, no em-dashes. node --test driver. SKIP when
 * node:sqlite is unavailable (the multi-select sync-edge legs need a real db).
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

let DatabaseSync;
try {
  DatabaseSync = require('node:sqlite').DatabaseSync;
} catch (_e) {
  DatabaseSync = null;
}

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const {
  requireValidAt,
  GATE_BLOCK,
  GATE_PASS,
} = require('./date-sync-gate.cjs');

const REF_2026_06_16 = Date.UTC(2026, 5, 16, 12, 0, 0, 0);
const EXPECTED_LAST_TUESDAY = Date.UTC(2026, 5, 9, 12, 0, 0, 0); // 2026-06-09 noon UTC

// ---- a real room.db for the sync-edge legs (production openRoomDb composition) ----
function openRoom() {
  const { openRoomDb, closeRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'phase-160-gate-'));
  const db = openRoomDb(tmp);
  return { tmp, db, closeRoomDb };
}
function cleanup(tmp, db, closeRoomDb) {
  try { closeRoomDb(db); } catch (_) { /* ignore */ }
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) { /* ignore */ }
}

// ---------------------------------------------------------------------------
// 1. meeting with no date -> GATE_BLOCK + Shape F.1 selector spec
// ---------------------------------------------------------------------------
test('R11.1: a meeting with no valid_at returns GATE_BLOCK with a Shape F.1 selector spec', () => {
  const res = requireValidAt(
    { type: 'meeting', source_path: 'meetings/2026-06-16-kickoff' },
    { now: () => REF_2026_06_16, referenceMs: REF_2026_06_16 }
  );

  assert.equal(res.verdict, GATE_BLOCK, 'undated meeting BLOCKS: ' + JSON.stringify(res));
  assert.ok(res.selector, 'a selector spec is returned on block');
  // Shape F.1: a "when?" date question + a multi-select "relates to?" question.
  assert.equal(res.selector.shape, 'F.1', 'selector is Shape F.1');
  assert.ok(Array.isArray(res.selector.questions), 'selector carries questions');
  const ids = res.selector.questions.map((q) => q.id);
  assert.ok(ids.includes('when'), 'selector asks "when?" (sets valid_at)');
  assert.ok(ids.includes('relates_to'), 'selector asks multi-select "relates to?"');
  const relates = res.selector.questions.find((q) => q.id === 'relates_to');
  assert.equal(relates.multi_select, true, '"relates to?" is multi-select');
  // It is a SPEC, not a rendered prompt: no surface-specific render bytes.
  assert.equal(typeof res.selector.rendered, 'undefined', 'returns a spec, not a rendered prompt');
});

// ---------------------------------------------------------------------------
// 2. meeting given "last Tuesday" resolves valid_at against the reference
// ---------------------------------------------------------------------------
test('R11.2: a meeting given "last Tuesday" resolves valid_at to 2026-06-09 against getReferenceNow', () => {
  const res = requireValidAt(
    { type: 'meeting', source_path: 'meetings/2026-06-16-kickoff' },
    {
      now: () => REF_2026_06_16,
      referenceMs: REF_2026_06_16,
      // The selector "when?" answer the human supplied (free-typed relative).
      whenAnswer: 'last Tuesday',
    }
  );

  assert.equal(res.verdict, GATE_PASS, 'a resolved date PASSES: ' + JSON.stringify(res));
  assert.equal(typeof res.valid_at, 'number', 'valid_at is set');
  assert.equal(res.valid_at, EXPECTED_LAST_TUESDAY, 'valid_at = 2026-06-09 noon-UTC epoch ms');
  assert.equal(
    new Date(res.valid_at).toISOString().slice(0, 10),
    '2026-06-09',
    'valid_at resolves to 2026-06-09'
  );
  // created_at stays the filing moment (the reference now), distinct from valid_at.
  assert.equal(res.created_at, REF_2026_06_16, 'created_at stays the filing moment');
  assert.notEqual(res.valid_at, res.created_at, 'valid_at and created_at are distinct');
});

// ---------------------------------------------------------------------------
// 2b. an explicit numeric valid_at on a meeting passes (human owns the date)
// ---------------------------------------------------------------------------
test('R11.2b: a meeting with an explicit numeric valid_at PASSES (human-owned date)', () => {
  const res = requireValidAt(
    { type: 'meeting', valid_at: EXPECTED_LAST_TUESDAY, source_path: 'meetings/x' },
    { now: () => REF_2026_06_16, referenceMs: REF_2026_06_16 }
  );
  assert.equal(res.verdict, GATE_PASS, 'explicit valid_at PASSES');
  assert.equal(res.valid_at, EXPECTED_LAST_TUESDAY, 'the explicit valid_at is honored');
  assert.equal(res.created_at, REF_2026_06_16, 'created_at stays the filing moment');
});

// ---------------------------------------------------------------------------
// 3. multi-select relation -> sync edge + f_selector_sync_confirmed event
// ---------------------------------------------------------------------------
test('R11.3: a multi-selected relation writes a sync edge and emits f_selector_sync_confirmed', { skip: !DatabaseSync }, () => {
  const { tmp, db, closeRoomDb } = openRoom();
  try {
    // Seed the meeting node + a related node the human will sync it to.
    const insert = db.prepare(
      "INSERT INTO nodes (id, type, properties, source_path, created_by, review_status, created_at, last_seen_at) " +
      "VALUES (?, ?, '{}', ?, 'user', 'confirmed', ?, ?)"
    );
    insert.run('meeting:kickoff', 'meeting', 'meetings/2026-06-16-kickoff', REF_2026_06_16, REF_2026_06_16);
    insert.run('claim:tam', 'claim', 'market-analysis/tam', REF_2026_06_16, REF_2026_06_16);

    const res = requireValidAt(
      { id: 'meeting:kickoff', type: 'meeting', source_path: 'meetings/2026-06-16-kickoff' },
      {
        db,
        now: () => REF_2026_06_16,
        referenceMs: REF_2026_06_16,
        whenAnswer: 'last Tuesday',
        // The multi-select "relates to?" answer: the related node ids.
        relatesTo: ['claim:tam'],
      }
    );

    assert.equal(res.verdict, GATE_PASS, 'gate passes once dated: ' + JSON.stringify(res));
    assert.ok(Array.isArray(res.sync_edges), 'sync_edges array is returned');
    assert.equal(res.sync_edges.length, 1, 'one sync edge written for one related node');

    // The sync edge landed in the edges table (meeting -> related node).
    const edgeRow = db.prepare(
      "SELECT source, target, type FROM edges WHERE source = ? AND target = ?"
    ).get('meeting:kickoff', 'claim:tam');
    assert.ok(edgeRow, 'a sync edge meeting -> claim:tam exists');

    // f_selector_sync_confirmed memory_event was emitted (reusing the dial idiom).
    const evRow = db.prepare(
      "SELECT id FROM nodes WHERE type = 'memory_event' " +
      "AND json_extract(properties, '$.event_type') = 'f_selector_sync_confirmed' LIMIT 1"
    ).get();
    assert.ok(evRow, 'an f_selector_sync_confirmed memory_event was emitted');
  } finally {
    cleanup(tmp, db, closeRoomDb);
  }
});

// ---------------------------------------------------------------------------
// 4. pure idea -> GATE_PASS with valid_at = filing time, silently (no selector)
// ---------------------------------------------------------------------------
test('R11.4: a pure idea stamps valid_at = filing time silently (GATE_PASS, no selector)', () => {
  const res = requireValidAt(
    { type: 'assumption', has_event_date: false, source_path: 'problem-definition/idea' },
    { now: () => REF_2026_06_16, referenceMs: REF_2026_06_16 }
  );
  assert.equal(res.verdict, GATE_PASS, 'a pure idea PASSES silently');
  assert.equal(res.valid_at, REF_2026_06_16, 'valid_at defaults to the filing moment');
  assert.equal(res.created_at, REF_2026_06_16, 'created_at = filing moment');
  assert.equal(typeof res.selector, 'undefined', 'no selector is surfaced for a pure idea');
});

// ---------------------------------------------------------------------------
// 4b. a non-meeting node flagged has_event_date=true is gated like a meeting
// ---------------------------------------------------------------------------
test('R11.4b: a decision flagged has_event_date=true with no date BLOCKS (D-04 explicit flag)', () => {
  const res = requireValidAt(
    { type: 'decision', has_event_date: true, source_path: 'team-execution/decision' },
    { now: () => REF_2026_06_16, referenceMs: REF_2026_06_16 }
  );
  assert.equal(res.verdict, GATE_BLOCK, 'a has_event_date decision with no date BLOCKS');
  assert.ok(res.selector, 'the selector is surfaced');
});
