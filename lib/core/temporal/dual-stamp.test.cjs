'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 160-02 Task 2 -- dual-stamp + Larry-speaks-time unit tests (TDD RED-first).
 * ================================================================================
 *
 * R4 (160-SPEC.md). A real-world-event memory_event carries BOTH valid_at (the
 * resolved real-world date) and created_at (the filing moment), distinct, all
 * written through the Part 9 navigation.logMemoryEvent chokepoint. Logging from
 * "we met last Tuesday" against reference 2026-06-16 must land valid_at =
 * 2026-06-09 epoch ms AND created_at = the reference now, both present, distinct.
 *
 * R3 (160-SPEC.md / FLAG-03). Larry's greeting delta is produced by a CALLABLE
 * render function invoked DIRECTLY with a fixed node + reference -- NOT merely a
 * prose change in SKILL.md. The test asserts "3 days ago" against the function,
 * reusing humanDelta() (Part 7 reuse).
 *
 * House rule: hyphens only, no em-dashes. Pure CJS, node:test + node:sqlite.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

let DatabaseSync;
try {
  DatabaseSync = require('node:sqlite').DatabaseSync;
} catch (_e) {
  DatabaseSync = null;
}

const {
  logDualStampedEvent,
  renderTopicGreetingDelta,
} = require('./dual-stamp.cjs');

const DAY_MS = 24 * 60 * 60 * 1000;
const REF_2026_06_16 = Date.UTC(2026, 5, 16, 12, 0, 0, 0);
const EXPECTED_LAST_TUESDAY = Date.UTC(2026, 5, 9, 12, 0, 0, 0); // 2026-06-09

// Minimal nodes-table schema mirroring the production room.db nodes table.
function applySchema(db) {
  db.exec(
    "CREATE TABLE IF NOT EXISTS nodes (" +
    "  id TEXT PRIMARY KEY, type TEXT NOT NULL, properties TEXT DEFAULT '{}', " +
    "  source_path TEXT NOT NULL, source_section TEXT, " +
    "  created_by TEXT NOT NULL CHECK(created_by IN ('user','larry','import','brain','system')), " +
    "  confidence REAL, " +
    "  review_status TEXT NOT NULL DEFAULT 'proposed' " +
    "    CHECK(review_status IN ('proposed','confirmed','rejected','stale','superseded','needs_evidence','validated','invalidated')), " +
    "  created_at INTEGER NOT NULL, last_seen_at INTEGER NOT NULL" +
    ");"
  );
}

test('R4: "we met last Tuesday" memory_event carries distinct valid_at (2026-06-09) and created_at (reference now)', { skip: !DatabaseSync }, () => {
  const db = new DatabaseSync(':memory:');
  applySchema(db);

  // Fixed reference now via the options.now seam (D-01a). created_at = this.
  const nowMs = REF_2026_06_16;

  // eventType is event-type-agnostic and MUST be an existing frozen EVENT_TYPE
  // (dual-stamp adds valid_at additively; it never mints a new event type --
  // the EVENT_TYPES set is a frozen contract owned by memory-events.cjs). A
  // filed meeting node IS a node_created real-world event.
  const res = logDualStampedEvent(
    db,
    'node_created',
    { relative_time: 'we met last Tuesday', source_path: 'meetings/2026-06-16-kickoff' },
    { now: () => nowMs, referenceMs: nowMs }
  );

  assert.equal(res.ok, true, 'dual-stamp write should succeed: ' + JSON.stringify(res));
  assert.ok(res.eventId, 'an eventId is returned');
  assert.equal(typeof res.validAtMs, 'number', 'the resolved validAtMs is surfaced on the result');

  // Read the node back and inspect its properties JSON.
  const row = db.prepare(
    "SELECT properties, created_at FROM nodes WHERE id = ?"
  ).get(res.eventId);
  assert.ok(row, 'the memory_event node lands in the nodes table');

  const props = JSON.parse(row.properties);

  // created_at (the filing moment) = the reference now.
  assert.equal(row.created_at, nowMs, 'node created_at = filing moment (reference now)');

  // valid_at (the real-world moment) = resolved "last Tuesday" = 2026-06-09.
  assert.equal(typeof props.valid_at, 'number', 'valid_at is present on the properties JSON');
  assert.equal(
    new Date(props.valid_at).toISOString().slice(0, 10),
    '2026-06-09',
    'valid_at resolves to 2026-06-09'
  );
  assert.equal(props.valid_at, EXPECTED_LAST_TUESDAY, 'valid_at = 2026-06-09 noon-UTC epoch ms');

  // Both present AND distinct (R4 done-bar).
  assert.notEqual(props.valid_at, row.created_at, 'valid_at and created_at are DISTINCT');

  db.close();
});

test('R4: an explicit payload.valid_at is honored when no relative_time is present', { skip: !DatabaseSync }, () => {
  const db = new DatabaseSync(':memory:');
  applySchema(db);
  const nowMs = REF_2026_06_16;
  const explicitValidAt = Date.UTC(2026, 0, 15, 0, 0, 0, 0); // 2026-01-15

  const res = logDualStampedEvent(
    db,
    'node_created',
    { valid_at: explicitValidAt, source_path: 'meetings/x' },
    { now: () => nowMs }
  );
  assert.equal(res.ok, true);
  const row = db.prepare("SELECT properties, created_at FROM nodes WHERE id = ?").get(res.eventId);
  const props = JSON.parse(row.properties);
  assert.equal(props.valid_at, explicitValidAt, 'explicit valid_at preserved');
  assert.equal(row.created_at, nowMs);
  assert.notEqual(props.valid_at, row.created_at);
  db.close();
});

test('R4: dual-stamp routes through the Part 9 chokepoint (no side-door INSERT in the source)', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const src = fs.readFileSync(path.join(__dirname, 'dual-stamp.cjs'), 'utf8');
  // The module must NOT carry its own INSERT INTO nodes -- it writes only via
  // navigation.logMemoryEvent (the Part 9 chokepoint).
  assert.ok(
    /INSERT\s+INTO\s+nodes/i.test(src) === false,
    'dual-stamp.cjs must NOT contain a direct INSERT INTO nodes (Part 9: chokepoint only)'
  );
  assert.ok(
    /logMemoryEvent/.test(src),
    'dual-stamp.cjs must write through navigation.logMemoryEvent'
  );
});

test('R3: renderTopicGreetingDelta() is a CALLABLE function producing the humanDelta delta', () => {
  // A topic node created 3 days before reference-now must render "3 days ago".
  const nowMs = REF_2026_06_16;
  const node = { topic: 'CAR-T moat', created_at: nowMs - 3 * DAY_MS };

  const out = renderTopicGreetingDelta(node, { referenceMs: nowMs });
  assert.equal(typeof out, 'string', 'the render fn returns a string');
  assert.ok(out.includes('3 days ago'), 'greeting delta contains the humanDelta "3 days ago" string (got: ' + out + ')');
});

test('R3: the delta tracks the injected reference, not the system clock', () => {
  const nowMs = REF_2026_06_16;
  // 10 days old against this reference -> "10 days ago".
  const node = { topic: 'thesis', created_at: nowMs - 10 * DAY_MS };
  const out = renderTopicGreetingDelta(node, { referenceMs: nowMs });
  assert.ok(out.includes('10 days ago'), 'delta is computed against the injected reference (got: ' + out + ')');
});

test('R3: renderTopicGreetingDelta degrades gracefully on a missing created_at', () => {
  const out = renderTopicGreetingDelta({ topic: 'x' }, { referenceMs: REF_2026_06_16 });
  // No throw; returns a string (may omit the delta clause).
  assert.equal(typeof out, 'string');
});

test('R3: the rendered delta reuses humanDelta() (Part 7), not a re-implementation', () => {
  const { humanDelta } = require('../feynman/timeline-renderer.cjs');
  const nowMs = REF_2026_06_16;
  const node = { topic: 'y', created_at: nowMs - 3 * DAY_MS };
  const out = renderTopicGreetingDelta(node, { referenceMs: nowMs });
  // The exact humanDelta string for a 3-day delta must appear verbatim.
  assert.ok(out.includes(humanDelta(3 * DAY_MS)), 'render output contains the verbatim humanDelta string');
});
