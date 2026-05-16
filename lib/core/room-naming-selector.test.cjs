'use strict';
// Phase 119-01 Task 3 tests for lib/core/room-naming-selector.cjs.
// Validates F1_OPTION_LABELS verbatim values, DECISION_PATHS enum, the four
// decision branches (llm-suggested / user-typed / kept-untitled / discarded),
// the rename ceremony preserving room.db row IDs, the thinness prepend,
// and the Canon Part 8/9/10 invariants.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const cp = require('node:child_process');

const selector = require('./room-naming-selector.cjs');
const { openRoomDb, closeRoomDb } = require('./room-db.cjs');

function _mkPlaceholderRoom(slug, opts) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'naming-selector-test-'));
  fs.mkdirSync(path.join(tmp, '.rooms'), { recursive: true });
  const roomDir = path.join(tmp, slug);
  fs.mkdirSync(path.join(roomDir, '.mindrian'), { recursive: true });
  fs.writeFileSync(path.join(roomDir, '.room-root'), '');
  const thinness = (opts && opts.thinness) ? 'true' : 'false';
  fs.writeFileSync(path.join(roomDir, 'STATE.md'),
    '---\nphase: scoping\nauto_explore_thin: ' + thinness + '\n---\n');
  const db = openRoomDb(roomDir);
  closeRoomDb(db);
  const reg = {
    version: 1,
    active: slug,
    rooms: {
      [slug]: {
        path: roomDir,
        venture_name: 'untitled',
        venture_stage: 'Pre-Opportunity',
        status: 'active',
        last_opened: Date.now(),
      },
    },
  };
  fs.writeFileSync(path.join(tmp, '.rooms', 'registry.json'), JSON.stringify(reg, null, 2), 'utf8');
  return { roomsHome: tmp, roomDir, slug };
}

function _cleanup(roomsHome) {
  try { fs.rmSync(roomsHome, { recursive: true, force: true }); } catch (_e) {}
}

// ---------------------------------------------------------------------------
// Static surface tests
// ---------------------------------------------------------------------------

test('Test 1: F1_OPTION_LABELS exposed verbatim per CONTEXT.md D-06', function () {
  assert.strictEqual(selector.F1_OPTION_LABELS.LLM_SUGGESTED, '[name this room: {{SUGGESTED}}]');
  assert.strictEqual(selector.F1_OPTION_LABELS.USER_TYPED, '[type your own name]');
  assert.strictEqual(selector.F1_OPTION_LABELS.KEEP_UNTITLED, '[keep as untitled]');
  assert.strictEqual(selector.F1_OPTION_LABELS.DISCARD, '[discard room]');
});

test('Test 2: DECISION_PATHS frozen enum -- four canonical values', function () {
  assert.deepStrictEqual(selector.DECISION_PATHS, ['llm-suggested', 'user-typed', 'kept-untitled', 'discarded']);
  assert.ok(Object.isFrozen(selector.DECISION_PATHS));
});

test('Test 2b: interpolateLlmSuggested produces verbatim label with interpolated suggestion', function () {
  assert.strictEqual(selector.interpolateLlmSuggested('acme-robotics'), '[name this room: acme-robotics]');
  assert.strictEqual(selector.interpolateLlmSuggested(null), '[name this room: untitled]');
});

// ---------------------------------------------------------------------------
// Decision-branch tests (via injected dispatcher + userInputChannel stubs)
// ---------------------------------------------------------------------------

function _stubDispatcher() {
  return {
    pickShape: function (args) {
      return { shape: 'F.1', rendered: { options: (args.payload && args.payload.verbs) || [] }, payload: args.payload };
    },
  };
}

function _stubChannel(choiceIndex, freeText) {
  return async function () {
    return { choice_index: choiceIndex, free_text: freeText };
  };
}

test('Test 3: llm-suggested branch -- rename + memory_event emission', async function () {
  const { roomsHome, roomDir, slug } = _mkPlaceholderRoom('untitled-2026-05-16-1845');
  try {
    const result = await selector.fireNamingSelector({
      roomDir: roomDir,
      mvaCompletionPayload: { sentence_sha256: 'deadbeef0123' },
      surface: 'cli',
      decidedBy: 'jsagi',
      dispatcher: _stubDispatcher(),
      userInputChannel: _stubChannel(0),
      llmClient: { complete: async function () { return { content: 'acme-robotics' }; } },
    });
    assert.strictEqual(result.decision_path, 'llm-suggested');
    assert.strictEqual(result.new_slug, 'acme-robotics');
    assert.ok(result.room_dir.endsWith('acme-robotics'));
    assert.ok(fs.existsSync(result.room_dir), 'renamed room dir must exist on disk');
    assert.ok(!fs.existsSync(roomDir), 'old placeholder dir must be gone');
  } finally { _cleanup(roomsHome); }
});

test('Test 4: user-typed branch with reserved-prefix rejection -> re-prompt', async function () {
  const { roomsHome, roomDir, slug } = _mkPlaceholderRoom('untitled-2026-05-16-1846');
  try {
    // First channel response: option 1 = user-typed with reserved-prefix free_text
    // Second channel response (after re-prompt): option 1 = user-typed with valid free_text
    let callCount = 0;
    const channel = async function () {
      callCount++;
      if (callCount === 1) return { choice_index: 1, free_text: 'untitled-mine' };
      return { choice_index: 0, free_text: 'acme-robotics' };
    };
    const result = await selector.fireNamingSelector({
      roomDir: roomDir,
      mvaCompletionPayload: { sentence_sha256: 'deadbeef0123' },
      surface: 'cli',
      decidedBy: 'jsagi',
      dispatcher: _stubDispatcher(),
      userInputChannel: channel,
      llmClient: { complete: async function () { return { content: 'biotech' }; } },
    });
    assert.ok(callCount >= 2, 'expected the channel to be called >= 2 times (re-prompt path); got ' + callCount);
    assert.strictEqual(result.decision_path, 'user-typed');
    assert.strictEqual(result.new_slug, 'acme-robotics');
  } finally { _cleanup(roomsHome); }
});

test('Test 5: kept-untitled branch -- no rename, memory_event with previous_slug == new_slug', async function () {
  const { roomsHome, roomDir, slug } = _mkPlaceholderRoom('untitled-2026-05-16-1847');
  try {
    const result = await selector.fireNamingSelector({
      roomDir: roomDir,
      mvaCompletionPayload: { sentence_sha256: 'deadbeef0123' },
      surface: 'cli',
      decidedBy: 'jsagi',
      dispatcher: _stubDispatcher(),
      userInputChannel: _stubChannel(2),
      llmClient: { complete: async function () { return { content: 'foo' }; } },
    });
    assert.strictEqual(result.decision_path, 'kept-untitled');
    assert.strictEqual(result.new_slug, slug);
    assert.strictEqual(result.room_dir, roomDir);
    assert.ok(fs.existsSync(roomDir), 'roomDir must remain unchanged');
  } finally { _cleanup(roomsHome); }
});

test('Test 6: discarded branch -- cascade fires + decision_envelope returned', async function () {
  const { roomsHome, roomDir, slug } = _mkPlaceholderRoom('untitled-2026-05-16-1848');
  try {
    const result = await selector.fireNamingSelector({
      roomDir: roomDir,
      mvaCompletionPayload: { sentence_sha256: 'deadbeef0123' },
      surface: 'cli',
      decidedBy: 'jsagi',
      dispatcher: _stubDispatcher(),
      userInputChannel: _stubChannel(3),
      llmClient: { complete: async function () { return { content: 'foo' }; } },
    });
    assert.strictEqual(result.decision_path, 'discarded');
    assert.strictEqual(result.new_slug, null);
    assert.strictEqual(result.room_dir, null);
    assert.ok(!fs.existsSync(roomDir), 'placeholder room must be removed by cascade');
  } finally { _cleanup(roomsHome); }
});

test('Test 7: rename ceremony preserves room.db existence (row-IDs preserved by atomic rename)', async function () {
  const { roomsHome, roomDir, slug } = _mkPlaceholderRoom('untitled-2026-05-16-1849');
  try {
    // Insert a marker memory_event via navigation.cjs (the chokepoint).
    const dbBefore = openRoomDb(roomDir);
    try {
      const nav = require('./navigation.cjs');
      nav.logMemoryEvent(dbBefore, 'room_auto_created', {
        slug: slug,
        source_path: 'system:test',
        created_by: 'system',
      });
    } finally {
      closeRoomDb(dbBefore);
    }
    const result = await selector.fireNamingSelector({
      roomDir: roomDir,
      mvaCompletionPayload: { sentence_sha256: 'deadbeef0123' },
      surface: 'cli',
      decidedBy: 'jsagi',
      dispatcher: _stubDispatcher(),
      userInputChannel: _stubChannel(0),
      llmClient: { complete: async function () { return { content: 'preserved-name' }; } },
    });
    assert.strictEqual(result.decision_path, 'llm-suggested');
    // The renamed db file must exist; the row count must include both the original
    // room_auto_created AND the newly emitted room_naming_decided.
    const dbAfter = openRoomDb(result.room_dir);
    try {
      const rows = dbAfter.prepare("SELECT COUNT(*) AS c FROM nodes WHERE type='memory_event'").get();
      assert.ok(rows.c >= 2, 'expected >= 2 memory_events; got ' + rows.c);
    } finally {
      closeRoomDb(dbAfter);
    }
  } finally { _cleanup(roomsHome); }
});

test('Test 8: rename ceremony updates registry -- new key + active flips', async function () {
  const { roomsHome, roomDir, slug } = _mkPlaceholderRoom('untitled-2026-05-16-1850');
  try {
    await selector.fireNamingSelector({
      roomDir: roomDir,
      mvaCompletionPayload: { sentence_sha256: 'deadbeef0123' },
      surface: 'cli',
      decidedBy: 'jsagi',
      dispatcher: _stubDispatcher(),
      userInputChannel: _stubChannel(0),
      llmClient: { complete: async function () { return { content: 'new-venture' }; } },
    });
    const reg = JSON.parse(fs.readFileSync(path.join(roomsHome, '.rooms', 'registry.json'), 'utf8'));
    assert.ok(reg.rooms['new-venture'], 'new-venture key must exist after rename');
    assert.ok(!reg.rooms[slug], 'old placeholder key must be removed');
    assert.strictEqual(reg.active, 'new-venture');
  } finally { _cleanup(roomsHome); }
});

test('Test 9: thinness voice line is prepended when auto_explore_thin: true', function () {
  const { roomsHome, roomDir } = _mkPlaceholderRoom('untitled-2026-05-16-1851', { thinness: true });
  try {
    assert.strictEqual(selector.readThinnessFromState(roomDir), true);
    const { voiceLine } = require('./larry-thinness-acknowledgment.cjs');
    assert.ok(typeof voiceLine === 'function');
    const line = voiceLine();
    assert.ok(typeof line === 'string' && line.length > 0, 'thinness voice line must be a non-empty string');
  } finally { _cleanup(roomsHome); }
});

test('Test 10: Canon Part 8 LOCAL invariant -- no Brain coupling in module + shim', function () {
  const srcModule = fs.readFileSync(require.resolve('./room-naming-selector.cjs'), 'utf8');
  const srcShim = fs.readFileSync(path.resolve(__dirname, '..', '..', 'scripts', 'room-naming-selector.cjs'), 'utf8');
  for (const src of [srcModule, srcShim]) {
    assert.ok(src.indexOf('brain.mindrian') === -1, 'brain.mindrian substring present (Canon Part 8 breach)');
    assert.ok(!/require\([^)]*brain-client[^)]*\)/.test(src), 'brain-client require (Canon Part 8 breach)');
    assert.ok(!/fetch\([^)]*['\"][^'\"]*brain[^'\"]*['\"]/.test(src), 'fetch to brain.* host (Canon Part 8 breach)');
  }
});

test('Test 11: CLAUDE.md tri-polar header -- CLI / Desktop / Cowork mentioned in shim', function () {
  const srcShim = fs.readFileSync(path.resolve(__dirname, '..', '..', 'scripts', 'room-naming-selector.cjs'), 'utf8');
  assert.ok(srcShim.indexOf('CLI') !== -1, 'CLI must be acknowledged in shim header');
  assert.ok(srcShim.indexOf('Desktop') !== -1, 'Desktop must be acknowledged in shim header');
  assert.ok(srcShim.indexOf('Cowork') !== -1, 'Cowork must be acknowledged in shim header');
});

test('Test 12: em-dash invariant across orchestrator + shim + test file', function () {
  const EMDASH = String.fromCharCode(0x2014);
  const srcModule = fs.readFileSync(require.resolve('./room-naming-selector.cjs'), 'utf8');
  const srcShim = fs.readFileSync(path.resolve(__dirname, '..', '..', 'scripts', 'room-naming-selector.cjs'), 'utf8');
  const srcTest = fs.readFileSync(__filename, 'utf8');
  for (const [name, src] of [['module', srcModule], ['shim', srcShim], ['test', srcTest]]) {
    assert.ok(src.indexOf(EMDASH) === -1, 'em-dash present in ' + name + ' (HARD RULE)');
  }
});

test('Test 13: CLI shim exits 0 on missing room with structured JSON error', function () {
  const shimPath = path.resolve(__dirname, '..', '..', 'scripts', 'room-naming-selector.cjs');
  const out = cp.spawnSync('node', [shimPath, '--room-dir', '/tmp/nonexistent-119-01-test-' + Date.now()], {
    encoding: 'utf8',
  });
  assert.strictEqual(out.status, 0);
  const parsed = JSON.parse(out.stdout.trim().split('\n').filter(Boolean).pop());
  assert.strictEqual(parsed.shape, 'F.1');
  assert.strictEqual(parsed.surface, false);
  assert.strictEqual(parsed.reason, 'room_dir_not_found');
});
