#!/usr/bin/env node
// PSB-04/05 -- the F.8 gate WRITES the binding: consumeSessionBinding captures the
// confirmed toggle set + primary + sticky and writes the session file; the
// dev-repo/no-room option is a first-class selectable.
//
// The original stub SKIPped "until Wave 3" and carried a TODO for the bind-time
// job. Both are now live: the consumer shipped, and RCA
// statusline-room-health-chip-never-updates replaced _bindTimeJob's permanently-dead
// `typeof doctor.bindTimeCheck === 'function'` guard with the real in-process
// room-health job. The module-presence guards below are therefore a HARD FAIL now,
// not a skip - a missing consumer is a regression, not an unfinished wave.
//
// HOME is isolated to a temp dir because the bind-time job writes the room-health
// cache to HOME/.mindrian/room-health.json. Without the override this test would
// overwrite the developer's real statusline health cache.
//
// Node built-in assert only. No em-dashes.
'use strict';
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const mod = require('../lib/workflow/session-binding-consumer.cjs');
assert.strictEqual(typeof mod.consumeSessionBinding, 'function',
  'consumeSessionBinding must be exported (Wave 3 shipped)');

// --- live contract ---
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'psb-consumer-'));
const fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), 'psb-consumer-home-'));
const savedHome = process.env.HOME;
process.env.HOME = fakeHome;
const sid = 'sess-consume-1';

try {
  // (1) the confirmed set is written to the session binding file
  const res = mod.consumeSessionBinding({
    picks: ['alpha', 'beta'],
    primaryPick: 'alpha',
    sticky: false,
    sessionId: sid,
    home,
  });
  assert.ok(res && typeof res === 'object', 'consumer returns a result object');

  const binding = require('../lib/core/session-binding.cjs').readSessionBinding(sid, { home });
  assert.deepStrictEqual(binding.bound, ['alpha', 'beta'], 'confirmed picks land in bound');
  assert.strictEqual(binding.primary, 'alpha', 'primaryPick lands in primary');

  // (2) the dev-repo/no-room reserved slug is a first-class pick (D-03/D-04) and is
  // skipped by the room-scoped bind-time job because it names no room directory.
  const noRoomRes = mod.consumeSessionBinding({
    picks: [mod.NO_ROOM],
    primaryPick: null,
    sticky: false,
    sessionId: 'sess-consume-noroom',
    home,
  });
  assert.strictEqual(noRoomRes.ok, true, 'the no-room sentinel is a valid pick');
  assert.deepStrictEqual(noRoomRes.newlyBound, [],
    'the no-room sentinel is excluded from the room-scoped bind-time job');

  // (3) RCA statusline-room-health-chip-never-updates: per newly-bound room the
  // bind-time job now runs a REAL in-process room-health check and persists the
  // status the statusline reads. Before the fix this branch was dead code behind a
  // permanently-false guard, so this file was never written.
  const healthPath = path.join(fakeHome, '.mindrian', 'room-health.json');
  assert.ok(fs.existsSync(healthPath),
    'the bind-time job must write the room-health cache the statusline reads: ' + healthPath);
  const rec = JSON.parse(fs.readFileSync(healthPath, 'utf8'));
  assert.ok(['sound', 'drift', 'broken'].indexOf(rec.status) !== -1,
    'the persisted status must be a valid health enum, got: ' + JSON.stringify(rec.status));
  // The fixture rooms are bare temp names with no .room-root and no room.db, so an
  // honest structural read reports drift. A 'sound' here would mean the status was
  // fabricated rather than derived.
  assert.strictEqual(rec.status, 'drift',
    'a bound room with no .room-root and no room.db must read as drift, not sound');
} finally {
  if (savedHome === undefined) delete process.env.HOME; else process.env.HOME = savedHome;
  fs.rmSync(home, { recursive: true, force: true });
  fs.rmSync(fakeHome, { recursive: true, force: true });
}

console.log('PASS: test-session-binding-consumer');
process.exit(0);
