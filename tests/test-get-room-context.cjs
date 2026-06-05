'use strict';
// RETR-01 (Phase 141) -- getRoomContext 3-leg fusion shape + raw-prose assertion.
//
// RED now: lib/core/navigation.cjs does NOT yet export getRoomContext, so the
// require resolves to undefined and this suite fails. Once Wave-1 lands
// lib/core/navigation/room-context.cjs (re-exported through navigation.cjs),
// this suite asserts:
//   - the return is { summary, recentMessages, relevantNodes, _meta }
//   - relevantNodes is non-empty (Leg C / graph rank fired against the fixture)
//   - recentMessages carry RAW prose (not a sha256 hash) -- Canon Part 8 / RETR-03
//
// Caller-owned fixture db (tests/fixtures/room-141-fixture.cjs). Never opens a
// real room.db. House rule: hyphens only, no em-dashes.

const assert = require('node:assert/strict');
const path = require('node:path');

let buildFixtureDb;
try {
  ({ buildFixtureDb } = require(path.join(__dirname, 'fixtures', 'room-141-fixture.cjs')));
} catch (e) {
  process.stdout.write('SKIP test-get-room-context.cjs (fixture unavailable: ' + e.message + ')\n');
  process.exit(77);
}

const navigation = require(path.join(__dirname, '..', 'lib', 'core', 'navigation.cjs'));

// A sha256 hex digest is 64 lowercase hex chars. Raw prose must NOT look like that.
function looksHashed(s) {
  return typeof s === 'string' && /^[0-9a-f]{64}$/.test(s.trim());
}

async function main() {
  assert.equal(
    typeof navigation.getRoomContext, 'function',
    'navigation.getRoomContext must be exported (RED until Wave-1 room-context.cjs lands)'
  );

  const db = buildFixtureDb();
  try {
    const ctx = await navigation.getRoomContext(db, 'fixture', { topK: 10, fragmentWindow: 6, maxDepth: 2 });

    assert.ok(ctx && typeof ctx === 'object', 'getRoomContext returns an object');
    for (const key of ['summary', 'recentMessages', 'relevantNodes', '_meta']) {
      assert.ok(Object.prototype.hasOwnProperty.call(ctx, key), 'result has key: ' + key);
    }

    assert.ok(Array.isArray(ctx.relevantNodes), 'relevantNodes is an array');
    assert.ok(ctx.relevantNodes.length > 0, 'relevantNodes is non-empty (Leg C fired on the fixture)');

    assert.ok(Array.isArray(ctx.recentMessages), 'recentMessages is an array');
    assert.ok(ctx.recentMessages.length > 0, 'recentMessages is non-empty (Leg B windowed the session)');
    for (const m of ctx.recentMessages) {
      const body = typeof m === 'string' ? m : (m && (m.content || m.text || ''));
      assert.equal(looksHashed(body), false, 'recentMessages carry RAW prose, never a sha256 hash');
    }
  } finally {
    db.close();
  }

  process.stdout.write('PASS test-get-room-context.cjs (RETR-01 fusion shape + raw prose)\n');
}

main().catch((err) => {
  process.stderr.write('FAIL test-get-room-context.cjs: ' + (err && err.message ? err.message : String(err)) + '\n');
  process.exit(1);
});
