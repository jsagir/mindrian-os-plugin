'use strict';
// Phase 128.1 Plan 01 (Wave 0) -- RED unit-test scaffold for session-binding.cjs.
//
// This file is RED BY DESIGN until Plan 02 ships lib/core/session-binding.cjs.
// The `require('./session-binding.cjs')` below throws MODULE_NOT_FOUND; the
// banner printed on that throw lets the executor and the run-all aggregator
// tell a scaffold-RED (expected) from a real test failure.
//
// It encodes the resolver/migration contract from the plan's <interfaces>
// block as EXECUTABLE test bodies so Plan 02's session-binding.cjs has a fixed
// target. Covers SESSION-ISO-128.1-01, -02, -03, -07.
//
// Style: node:test + node:assert/strict (matches the lib/ *.test.cjs idiom).
// Run: node lib/core/session-binding.test.cjs  -- exits NON-ZERO until Plan 02.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SCAFFOLD_BANNER =
  '\n========================================================================\n' +
  ' SCAFFOLD-RED (EXPECTED): lib/core/session-binding.cjs does not exist yet.\n' +
  ' Phase 128.1 Plan 01 ships this test RED on purpose. Plan 02 ships the\n' +
  ' module and turns it GREEN. A non-zero exit here is the de-risking signal,\n' +
  ' not a regression.\n' +
  '========================================================================\n';

const V2_FIXTURE = path.join(
  __dirname, '..', '..', 'tests', 'fixtures', 'session-isolation', 'registry-v2-legacy.json'
);

// Load the module under test. Until Plan 02 ships it, this throws -- print the
// banner, then re-throw so the process exits non-zero (RED).
let sessionBinding;
try {
  sessionBinding = require('./session-binding.cjs');
} catch (err) {
  process.stderr.write(SCAFFOLD_BANNER);
  process.stderr.write('  require error: ' + err.message + '\n\n');
  throw err;
}

// Deep clone helper so a test never mutates the shared fixture object.
function loadV2Fixture() {
  return JSON.parse(fs.readFileSync(V2_FIXTURE, 'utf8'));
}

// ---------------------------------------------------------------------------
// SESSION-ISO-128.1-02 -- the one canonical session-id resolver (D-05, D-06)
// ---------------------------------------------------------------------------

test('resolveSessionId: CLAUDE_SESSION_ID and lowercase session_id resolve identically', () => {
  const original = { upper: process.env.CLAUDE_SESSION_ID, lower: process.env.session_id };
  try {
    delete process.env.session_id;
    process.env.CLAUDE_SESSION_ID = 'sess-fixture-upper';
    const fromUpper = sessionBinding.resolveSessionId();
    assert.equal(typeof fromUpper, 'string');
    assert.ok(fromUpper.length > 0, 'resolveSessionId returns a non-empty string');
    assert.equal(fromUpper, 'sess-fixture-upper');

    delete process.env.CLAUDE_SESSION_ID;
    process.env.session_id = 'sess-fixture-lower';
    const fromLower = sessionBinding.resolveSessionId();
    assert.equal(fromLower, 'sess-fixture-lower',
      'lowercase session_id (statusline env) is also honored (Pitfall 3)');
  } finally {
    if (original.upper === undefined) delete process.env.CLAUDE_SESSION_ID;
    else process.env.CLAUDE_SESSION_ID = original.upper;
    if (original.lower === undefined) delete process.env.session_id;
    else process.env.session_id = original.lower;
  }
});

test('resolveSessionId: cold-start fallback is stable across calls in one process (Pitfall 4)', () => {
  const original = { upper: process.env.CLAUDE_SESSION_ID, lower: process.env.session_id };
  try {
    delete process.env.CLAUDE_SESSION_ID;
    delete process.env.session_id;
    const first = sessionBinding.resolveSessionId();
    const second = sessionBinding.resolveSessionId();
    assert.equal(typeof first, 'string');
    assert.ok(first.length > 0, 'cold-start id is a non-empty string, never null');
    assert.ok(first.startsWith('sess-'), 'cold-start id uses the sess- prefix (D-06 precedent)');
    assert.equal(first, second,
      'the SAME cold-start id is returned on a second call in the same process');
  } finally {
    if (original.upper === undefined) delete process.env.CLAUDE_SESSION_ID;
    else process.env.CLAUDE_SESSION_ID = original.upper;
    if (original.lower === undefined) delete process.env.session_id;
    else process.env.session_id = original.lower;
  }
});

// ---------------------------------------------------------------------------
// SESSION-ISO-128.1-03 -- v2 -> v3 migration (D-04)
// ---------------------------------------------------------------------------

test('migrateRegistryIfNeeded: v2 fixture migrates to v3 additively', () => {
  const v2 = loadV2Fixture();
  const roomsBefore = JSON.stringify(v2.rooms);

  const result = sessionBinding.migrateRegistryIfNeeded(v2);
  assert.ok(result, 'migrateRegistryIfNeeded returns a result object');
  assert.equal(result.migrated, true, 'a v2 registry reports migrated: true');

  const reg = result.reg;
  assert.equal(reg.version, 3, 'version is bumped to 3');
  assert.ok(reg.sessions && typeof reg.sessions === 'object',
    'an empty sessions map is added');
  assert.equal(Object.keys(reg.sessions).length, 0,
    'the new sessions map starts empty');
  assert.equal(reg.last_active, 'room-a',
    'last_active is seeded from the old active string');
  assert.equal(reg.active, 'room-a',
    'active is left unchanged as the legacy mirror (D-04)');
  assert.equal(JSON.stringify(reg.rooms), roomsBefore,
    'the rooms map is byte-identical after migration');
});

test('migrateRegistryIfNeeded: a version-4 registry is NOT mutated (future-version guard)', () => {
  const future = { version: 4, root: '~/MindrianRooms', active: 'room-a', sessions: {}, rooms: {} };
  const snapshot = JSON.stringify(future);

  const result = sessionBinding.migrateRegistryIfNeeded(future);
  assert.ok(result, 'migrateRegistryIfNeeded returns a result object');
  assert.equal(result.migrated, false,
    'a future-version registry reports migrated: false');
  assert.equal(JSON.stringify(result.reg), snapshot,
    'a version-4 registry is never downgraded or mutated');
});

// ---------------------------------------------------------------------------
// SESSION-ISO-128.1-01 / -07 -- session-scoped resolution + tripwire signal
// ---------------------------------------------------------------------------

test('resolveActiveRoom: a fresh session with no sessions entry falls back to last_active/active', () => {
  // resolveActiveRoom lazy-migrates the v2 fixture, sees no sessions[id] entry
  // for a brand-new session, and falls back to last_active (then active).
  const result = sessionBinding.resolveActiveRoom('sess-brand-new', { reg: loadV2Fixture() });
  assert.ok(result, 'resolveActiveRoom returns a result object');
  assert.equal(result.room, 'room-a',
    'a fresh session resolves the fallback room (room-a) via last_active/active');
  assert.ok(typeof result.path === 'string' && result.path.length > 0,
    'resolveActiveRoom returns a path string');
  assert.ok(result.path.endsWith('room-a'),
    'the resolved path ends with the room-a slug');
  assert.ok(result.tripwire && typeof result.tripwire === 'object',
    'resolveActiveRoom returns a tripwire signal object');
  assert.equal(result.tripwire.fired, false,
    'a first resolution with no prior expectation does not fire the tripwire');
});
