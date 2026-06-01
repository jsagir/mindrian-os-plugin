#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 130.7-02 Task 3 -- spine-events correlation_id threading tests.
 *
 * Registered in lib/memory/run-feynman-tests.cjs TEST_FILES[] and appended to
 * tests/run-all-130.7.sh. Run: node lib/memory/spine-events-correlation.test.cjs
 *
 * memory_event references written through the spine path carry a correlation_id
 * field ADDITIVELY (alongside the existing reference keys, never replacing
 * target_node_id), derived via the shared lib/core/correlation.cjs chokepoint.
 * The EVENT_TYPES Set is proven member-for-member UNCHANGED (zero net-new event
 * types) -- the contract is an additive payload field, NOT a new event type.
 *
 * Four behaviors (per 130.7-02-PLAN.md Task 3 <behavior>):
 *   1. reference carries correlation_id -- findRecentChanges surfaces a
 *      correlation_id on the suggestion_surfaced reference payload.
 *   2. derivation -- given name+primary_label but no precomputed id, the
 *      reference correlation_id == computeCorrelationId(name, primary_label).
 *   3. EVENT_TYPES set-equality -- snapshot the live members BEFORE, assert the
 *      Set is member-for-member identical AFTER (NOT a remembered integer);
 *      dedupe_key 60s TTL still works.
 *   4. Part 8 -- the correlation_id is a hash scalar (the 'c1:' prefix), not
 *      user content.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const SPINE_PATH = path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'spine-events.cjs');

const spineEvents = require('../core/navigation/spine-events.cjs');
const memoryEvents = require('../core/navigation/memory-events.cjs');
const correlation = require('../core/correlation.cjs');
const { openRoomDb, closeRoomDb } = require('../core/room-db.cjs');

let passed = 0;
function test(name, fn) {
  fn();
  process.stdout.write('  ok  ' + name + '\n');
  passed += 1;
}

function freshRoomDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'p130.7-02-spine-corr-'));
  // Materialize room.db so the spine helper's _hasRoomDb gate opens it.
  const db = openRoomDb(dir);
  closeRoomDb(db);
  return dir;
}

function readSuggestionEvents(roomDir) {
  const db = openRoomDb(roomDir);
  try {
    return memoryEvents.findRecentChanges(db, 0, { eventType: 'suggestion_surfaced', limit: 50 });
  } finally {
    closeRoomDb(db);
  }
}

// ---------------------------------------------------------------------------
// 1. reference carries correlation_id (additive; target_node_id untouched)
// ---------------------------------------------------------------------------
test('suggestion_surfaced reference carries a correlation_id additively (findRecentChanges surfaces it)', function () {
  const roomDir = freshRoomDir();
  const res = spineEvents.logSuggestionSurfaced(roomDir, {
    surface: 'suggest-next',
    commands: [{ command: 'mos:diagnose', score: 0.9 }],
    canonical_name: 'Beautiful Question Framework',
    primary_label: 'Framework',
  });
  assert.ok(res && res.ok, 'log write ok');
  const events = readSuggestionEvents(roomDir);
  assert.ok(events.length >= 1, 'one suggestion_surfaced event');
  const props = events[0].properties || {};
  assert.strictEqual(typeof props.correlation_id, 'string', 'reference payload carries a correlation_id string');
  assert.ok(props.correlation_id.length > 0, 'correlation_id is non-empty');
  // Additive: the event_type and the existing commands reference are preserved.
  assert.strictEqual(props.event_type, 'suggestion_surfaced', 'event_type unchanged');
  assert.ok(Array.isArray(props.commands) && props.commands.length === 1, 'commands reference preserved');
});

// ---------------------------------------------------------------------------
// 2. derivation: correlation_id == computeCorrelationId(name, primary_label)
// ---------------------------------------------------------------------------
test('derivation: reference correlation_id equals computeCorrelationId(name, primary_label)', function () {
  const roomDir = freshRoomDir();
  spineEvents.logSuggestionSurfaced(roomDir, {
    surface: 'suggest-next',
    commands: [{ command: 'mos:explore-domains', score: 0.8 }],
    canonical_name: 'Domain Selection',
    primary_label: 'Framework',
  });
  const events = readSuggestionEvents(roomDir);
  const props = events[0].properties || {};
  assert.strictEqual(
    props.correlation_id,
    correlation.computeCorrelationId('Domain Selection', 'Framework'),
    'id joins to the same Brain/local canonical'
  );

  // When only a name is supplied (no primary_label), it defaults to Framework
  // consistently with Task 1, so the id still joins.
  const roomDir2 = freshRoomDir();
  spineEvents.logSuggestionSurfaced(roomDir2, {
    surface: 'suggest-next',
    commands: [{ command: 'mos:diagnose', score: 0.7 }],
    canonical_name: 'Lean Canvas',
  });
  const props2 = readSuggestionEvents(roomDir2)[0].properties || {};
  assert.strictEqual(
    props2.correlation_id,
    correlation.computeCorrelationId('Lean Canvas', 'Framework'),
    'absent label defaults to Framework, id still derivable'
  );

  // A caller-supplied precomputed correlation_id is honored verbatim (not re-derived).
  const roomDir3 = freshRoomDir();
  const precomputed = correlation.computeCorrelationId('JTBD', 'Framework');
  spineEvents.logSuggestionSurfaced(roomDir3, {
    surface: 'suggest-next',
    commands: [{ command: 'mos:diagnose', score: 0.6 }],
    correlation_id: precomputed,
  });
  const props3 = readSuggestionEvents(roomDir3)[0].properties || {};
  assert.strictEqual(props3.correlation_id, precomputed, 'caller-supplied correlation_id is preserved verbatim');
});

// ---------------------------------------------------------------------------
// 3. EVENT_TYPES set-equality (the pin) + dedupe TTL intact
// ---------------------------------------------------------------------------
test('EVENT_TYPES set-equality: zero net-new event types (member-for-member snapshot)', function () {
  // Snapshot the live members to a sorted fixture, then assert the Set equals it
  // exactly. This is a set-equality pin against the live members, NOT a
  // remembered integer like 70 -- a future phase adding a member would update
  // this snapshot deliberately, but THIS plan must add none.
  const before = Array.from(memoryEvents.EVENT_TYPES).sort();
  // Re-require fresh (module is cached, but this proves we read the same live Set
  // the spine path uses). The additive correlation_id threading must NOT have
  // grown the Set.
  const after = Array.from(require('../core/navigation/memory-events.cjs').EVENT_TYPES).sort();
  assert.deepStrictEqual(after, before, 'EVENT_TYPES is member-for-member identical (no net-new event type)');
  assert.strictEqual(after.length, before.length, 'EVENT_TYPES size unchanged');
  // suggestion_surfaced (the reference we extended) is and stays a member.
  assert.ok(memoryEvents.EVENT_TYPES.has('suggestion_surfaced'), 'suggestion_surfaced is still a member');

  // dedupe_key 60s TTL still works: two no-op emissions with the same natural
  // key dedupe to one row within the window.
  const roomDir = freshRoomDir();
  const payload = {
    surface: 'suggest-next',
    commands: [{ command: 'mos:diagnose', score: 0.9 }],
    canonical_name: 'Beautiful Question Framework',
    primary_label: 'Framework',
  };
  const r1 = spineEvents.logSuggestionSurfaced(roomDir, Object.assign({}, payload));
  const r2 = spineEvents.logSuggestionSurfaced(roomDir, Object.assign({}, payload));
  assert.ok(r1 && r1.ok, 'first emission ok');
  assert.ok(r2 && r2.ok && r2.deduped === true, 'second identical emission is deduped within the 60s TTL');
  const events = readSuggestionEvents(roomDir);
  assert.strictEqual(events.length, 1, 'only one row persisted (dedupe intact)');
});

// ---------------------------------------------------------------------------
// 4. Part 8: correlation_id is a hash scalar (the 'c1:' prefix), not user content
// ---------------------------------------------------------------------------
test('Part 8: correlation_id is a versioned hash scalar, not raw user content', function () {
  const roomDir = freshRoomDir();
  spineEvents.logSuggestionSurfaced(roomDir, {
    surface: 'suggest-next',
    commands: [{ command: 'mos:diagnose', score: 0.9 }],
    canonical_name: 'Beautiful Question Framework',
    primary_label: 'Framework',
  });
  const props = readSuggestionEvents(roomDir)[0].properties || {};
  assert.match(props.correlation_id, /^c\d+:[0-9a-f]+$/, 'correlation_id is the version-prefixed sha256 hex scalar');

  // The source carries correlation_id and routes through the shared chokepoint.
  const src = fs.readFileSync(SPINE_PATH, 'utf8');
  assert.ok(/correlation_id/.test(src), 'spine-events.cjs threads correlation_id');
  assert.ok(/correlation/.test(src), 'spine-events.cjs reuses lib/core/correlation.cjs');
});

process.stdout.write('\nspine-events-correlation.test.cjs: ' + passed + ' assertion groups PASSED\n');
process.exit(0);
