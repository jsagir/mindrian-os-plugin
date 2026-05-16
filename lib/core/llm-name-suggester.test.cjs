'use strict';
// Phase 119-01 Task 1 tests for lib/core/llm-name-suggester.cjs.
// Validates HAIKU_MODEL_ID + FALLBACK_SUGGESTION + suggestRoomName happy path +
// graceful degradation + Canon Part 8 LOCAL invariant (zero brain.mindrian
// substrings in module source) + EVENT_TYPES floor + room_discard_partial_failure
// membership.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');

const suggester = require('./llm-name-suggester.cjs');
const memoryEvents = require('./navigation/memory-events.cjs');

// ---------------------------------------------------------------------------
// EVENT_TYPES tests (floor + named membership)
// ---------------------------------------------------------------------------

test('Test 1: EVENT_TYPES Set size grows by at least 1 above the Plan 119-00 baseline (floor >= 42)', function () {
  assert.ok(memoryEvents.EVENT_TYPES.size >= 42,
    'EVENT_TYPES.size must be >= 42 (38 baseline + 3 from Plan 119-00 + 1 from this plan); got ' + memoryEvents.EVENT_TYPES.size);
});

test('Test 2: room_discard_partial_failure is in EVENT_TYPES; regression check on Plan 119-00 strings preserved', function () {
  assert.ok(memoryEvents.EVENT_TYPES.has('room_discard_partial_failure'), 'room_discard_partial_failure missing');
  assert.ok(memoryEvents.EVENT_TYPES.has('room_auto_created'), 'Plan 119-00 string room_auto_created regressed');
  assert.ok(memoryEvents.EVENT_TYPES.has('room_naming_decided'), 'Plan 119-00 string room_naming_decided regressed');
  assert.ok(memoryEvents.EVENT_TYPES.has('room_discarded'), 'Plan 119-00 string room_discarded regressed');
});

test('Test 3: EVENT_TYPES object is Object.frozen (own-properties invariant)', function () {
  assert.ok(Object.isFrozen(memoryEvents.EVENT_TYPES),
    'EVENT_TYPES Set must be Object.frozen (own-properties; the internal Set slot is documentation-only frozen per ECMAScript spec)');
});

test('Test 4: logEvent acceptance round-trip for room_discard_partial_failure', function () {
  // Use a real tmp room.db via room-db.cjs::openRoomDb (the canonical opener).
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lln-suggester-test-'));
  try {
    const { openRoomDb, closeRoomDb } = require('./room-db.cjs');
    const db = openRoomDb(tmpRoot);
    try {
      const result = memoryEvents.logEvent(db, 'room_discard_partial_failure', {
        previous_slug: 'untitled-2026-05-16-1845',
        partial_state: { fs_removed: true, registry_purged: false },
        error_short: 'EBUSY',
        source_path: 'system:room-discard-cascade',
        created_by: 'system',
      });
      assert.strictEqual(result.ok, true, 'logEvent must accept room_discard_partial_failure as a valid event_type');
      assert.match(result.eventId, /^memory_event:room_discard_partial_failure:\d+:[0-9a-f]{8}$/);
    } finally {
      closeRoomDb(db);
    }
  } finally {
    try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch (_e) {}
  }
});

// ---------------------------------------------------------------------------
// suggestRoomName tests
// ---------------------------------------------------------------------------

test('Test 5: HAIKU_MODEL_ID constant equals claude-haiku-4-5 (mirrors lib/core/mva-classifier.cjs:53)', function () {
  assert.strictEqual(suggester.HAIKU_MODEL_ID, 'claude-haiku-4-5');
});

test('Test 6: FALLBACK_SUGGESTION constant equals untitled (verbatim)', function () {
  assert.strictEqual(suggester.FALLBACK_SUGGESTION, 'untitled');
});

test('Test 7: suggestRoomName happy path returns normalized slug', async function () {
  const stub = { complete: async function () { return { content: 'acme-robotics' }; } };
  const r = await suggester.suggestRoomName({
    auto_explore_finding: { findings: [{ source_pipeline: 'whitespace', hsi_score: 0.83 }] },
    mva_brief_sentence: 'Robotic precision for industrial automation.',
    llmClient: stub,
  });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.suggested_name, 'acme-robotics');
  assert.strictEqual(r.model_used, 'claude-haiku-4-5');
  assert.ok(typeof r.latency_ms === 'number' && r.latency_ms >= 0);
});

test('Test 8: suggestRoomName graceful degradation on LLM error -> FALLBACK_SUGGESTION', async function () {
  const stub = { complete: async function () { throw new Error('timeout'); } };
  const r = await suggester.suggestRoomName({
    auto_explore_finding: null,
    mva_brief_sentence: '',
    llmClient: stub,
  });
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.suggested_name, 'untitled');
  assert.strictEqual(r.model_used, 'claude-haiku-4-5');
  assert.ok(typeof r.latency_ms === 'number' && r.latency_ms >= 0);
  assert.ok(typeof r.error_short === 'string' && r.error_short.length > 0);
});

test('Test 9: Canon Part 8 LOCAL invariant -- grep tripwire on llm-name-suggester source', function () {
  const src = fs.readFileSync(require.resolve('./llm-name-suggester.cjs'), 'utf8');
  // The forbidden Brain coupling regex (from the plan scaffold harness Gate 3):
  // brain.mindrian | require.+brain-client | fetch.+brain
  assert.ok(!/brain\.mindrian/.test(src), 'source contains brain.mindrian substring (Canon Part 8 breach)');
  assert.ok(!/require\([^)]*brain-client[^)]*\)/.test(src), 'source requires a brain-client module (Canon Part 8 breach)');
  // The fetch.+brain regex would match commentary about "brain" near a fetch
  // discussion; we narrow to actual fetch() invocations to brain.* hosts:
  assert.ok(!/fetch\([^)]*['\"][^'\"]*brain[^'\"]*['\"]/.test(src), 'source fetches a brain.* URL (Canon Part 8 breach)');
});

test('Test 10: Canon Part 8 LOCAL invariant -- payload audit (constructed prompt contains no Brain handle)', function () {
  const prompt = suggester._buildLocalPrompt({
    findings: [{ source_pipeline: 'whitespace', hsi_score: 0.5 }],
  }, 'AI-assisted protein folding for drug discovery.');
  const serialized = JSON.stringify(prompt);
  assert.ok(serialized.indexOf('brain.mindrian') === -1, 'prompt must not contain brain.mindrian');
  assert.ok(serialized.indexOf('brain-client') === -1, 'prompt must not contain brain-client handle');
});

// ---------------------------------------------------------------------------
// Em-dash invariant on the test file itself + module source
// ---------------------------------------------------------------------------

test('Test 11: zero em-dashes in llm-name-suggester source + this test file', function () {
  const EMDASH = String.fromCharCode(0x2014);
  const src = fs.readFileSync(require.resolve('./llm-name-suggester.cjs'), 'utf8');
  const testSrc = fs.readFileSync(__filename, 'utf8');
  assert.ok(src.indexOf(EMDASH) === -1, 'em-dash present in llm-name-suggester.cjs (HARD RULE)');
  assert.ok(testSrc.indexOf(EMDASH) === -1, 'em-dash present in llm-name-suggester.test.cjs (HARD RULE)');
});
