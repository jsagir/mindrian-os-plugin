'use strict';
// Phase 155-02 Task 1 -- EVENT_TYPES birth floor driver.
//
// Asserts (FLOOR idiom -- never .size):
//   - EVENT_TYPES.has('room_created') === true
//   - EVENT_TYPES.has('birth_gate_answered') === true
//   - Representative prior members still pass EVENT_TYPES.has() (FLOOR)
//   - logEvent called with event_type='room_created' on an in-memory db does NOT
//     return/throw invalid_event_type
//   - logEvent called with event_type='birth_gate_answered' on an in-memory db does
//     NOT return/throw invalid_event_type
//   - logEvent called with event_type='room_destroyed' (made-up) DOES return
//     invalid_event_type (the negative guard)
//
// SKIP-77: when node:sqlite is unavailable the process exits 77 (treated as PASS
// in the run-all-155.sh aggregator and the phase gate).
//
// NO em-dashes anywhere in this file (CLAUDE.md HARD RULE).

const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');

// SKIP-77 probe: if node:sqlite is unavailable, skip cleanly.
try {
  require('node:sqlite');
} catch (_e) {
  process.stdout.write('SKIP-77: node:sqlite unavailable -- skipping birth floor test\n');
  process.exit(77);
}

const { EVENT_TYPES, logEvent } = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'memory-events.cjs'));

// Build an in-memory room.db fixture for logEvent calls.
// Uses the same applySchema approach as other test drivers: open an in-memory
// DatabaseSync handle and run the navigation schema against it.
const { DatabaseSync } = require('node:sqlite');
const lazygraph = require(path.join(REPO_ROOT, 'lib', 'core', 'lazygraph-ops.cjs'));
const memoryOps = require(path.join(REPO_ROOT, 'lib', 'core', 'memory-ops.cjs'));
const { runMigration: runPhase109SessionFocus } = require(path.join(REPO_ROOT, 'lib', 'core', 'migrations', 'phase-109-session-focus.cjs'));

function buildInMemoryDb() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  lazygraph.initSchema(db);
  memoryOps.initMemorySchema(db);
  try {
    const runProv = require(path.join(REPO_ROOT, 'lib', 'core', 'migrations', 'phase-109-nodes-provenance.cjs')).runMigration;
    runProv(db);
  } catch (_e) { /* not present in all environments */ }
  runPhase109SessionFocus(db);
  return db;
}

let checks = 0;
let passed = 0;

function check(label, condition, detail) {
  checks++;
  if (condition) {
    passed++;
    process.stdout.write('  PASS: ' + label + '\n');
  } else {
    process.stdout.write('  FAIL: ' + label + (detail ? ' -- ' + detail : '') + '\n');
  }
}

process.stdout.write('\n[test-memory-events-birth-floor] Phase 155-02 EVENT_TYPES birth floor\n\n');

// --- Section 1: Set membership for new types (FLOOR) ---
process.stdout.write('Section 1: new event type membership\n');

check(
  "EVENT_TYPES.has('room_created')",
  EVENT_TYPES.has('room_created')
);

check(
  "EVENT_TYPES.has('birth_gate_answered')",
  EVENT_TYPES.has('birth_gate_answered')
);

// --- Section 2: Representative prior members (FLOOR -- never .size) ---
process.stdout.write('\nSection 2: prior member FLOOR (representative sample)\n');

const FLOOR_MEMBERS = [
  'memory_synced',          // original set
  'focus_changed',          // Phase 109-02
  'operator_transitioned',  // Phase 129-01 spine repair
  'f_selector_decision',    // Phase 125-06
  'node_created',           // original set
  'brain_packet_rejected',  // Phase 110-02
  'feynman_timeline_refreshed', // Phase 124-02
  'room_auto_created',      // Phase 119-00
  'lens_finding_written',   // Phase 130-02
  'research_filed',         // Phase 131-01
  'dial_memory_refreshed',  // Phase 143.1-05
  'file_changed',           // 260517-dcw dogfood
  'spine_read',             // Phase 129-01
  'breakthrough_detected_soft', // Phase 120-00
];

// memory_synced may or may not be in the base set depending on version;
// fall through gracefully -- we check the ones we know are in the set.
// Focus on the known set of established members.
const KNOWN_FLOOR = [
  'focus_changed',
  'operator_transitioned',
  'f_selector_decision',
  'node_created',
  'brain_packet_rejected',
  'feynman_timeline_refreshed',
  'room_auto_created',
  'lens_finding_written',
  'research_filed',
  'dial_memory_refreshed',
  'file_changed',
  'spine_read',
  'breakthrough_detected_soft',
];

for (const member of KNOWN_FLOOR) {
  check(
    "EVENT_TYPES.has('" + member + "') [FLOOR]",
    EVENT_TYPES.has(member),
    member + ' must still be in the Set'
  );
}

// --- Section 3: logEvent accepts new types ---
process.stdout.write('\nSection 3: logEvent accepts new types (in-memory db)\n');

const db = buildInMemoryDb();

const rcCreated = logEvent(db, 'room_created', {
  slug: 'test-room',
  blueprint_family: 'venture',
  sessionId: 's1',
  created_by: 'system',
});
check(
  "logEvent('room_created') does not return invalid_event_type",
  rcCreated && rcCreated.ok === true,
  rcCreated ? JSON.stringify(rcCreated) : 'null result'
);

const rcAnswered = logEvent(db, 'birth_gate_answered', {
  gate_id: 'B2',
  canonical_verb: 'Approve',
  option_key: 'approve',
  created_by: 'system',
});
check(
  "logEvent('birth_gate_answered') does not return invalid_event_type",
  rcAnswered && rcAnswered.ok === true,
  rcAnswered ? JSON.stringify(rcAnswered) : 'null result'
);

// --- Section 4: negative guard (made-up type) ---
process.stdout.write('\nSection 4: negative guard -- made-up type is rejected\n');

const rcBad = logEvent(db, 'room_destroyed', { session: 'x' });
check(
  "logEvent('room_destroyed') returns invalid_event_type",
  rcBad && rcBad.ok === false && rcBad.reason === 'invalid_event_type',
  rcBad ? JSON.stringify(rcBad) : 'null result'
);

// --- Section 5: verify rows were actually written for accepted types ---
process.stdout.write('\nSection 5: verify rows written for accepted types\n');

const rowsCreated = db.prepare(
  "SELECT id FROM nodes WHERE type='memory_event' AND json_extract(properties,'$.event_type')='room_created'"
).all();
check(
  'at least one room_created memory_event row exists in nodes',
  rowsCreated.length >= 1
);

const rowsAnswered = db.prepare(
  "SELECT id FROM nodes WHERE type='memory_event' AND json_extract(properties,'$.event_type')='birth_gate_answered'"
).all();
check(
  'at least one birth_gate_answered memory_event row exists in nodes',
  rowsAnswered.length >= 1
);

db.close();

// --- Summary ---
process.stdout.write('\n');
process.stdout.write('[test-memory-events-birth-floor] ' + passed + '/' + checks + ' PASS\n');

if (passed < checks) {
  process.exit(1);
}
process.exit(0);
