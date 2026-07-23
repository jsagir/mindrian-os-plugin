#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Quick 260723-ad9 -- statusline active room WRITE contract acceptance tests.
 * (Business Source License 1.1; SPDX BUSL-1.1; see LICENSE.)
 *
 * The missing half of the Phase 94-01 contract. Phase 94-01 shipped the READ
 * path (STATE.md frontmatter current_room -> getCurrentRoom() -> context-monitor
 * chip) with 8 green tests, but NOTHING wrote current_room. This suite proves
 * the two coordinated writers now populate AND preserve the canonical field:
 *
 *   scripts/room-registry create + set-active  -> event-driven write (Option B)
 *   scripts/compute-state (active room only)   -> truncation-safe re-derive
 *
 * Behaviors (one-to-one with the PLAN Task 3 <behavior> block):
 *   1. create-writes: room-registry create writes current_room into the new
 *      room's own STATE.md; getCurrentRoom() returns {slug, source:'state_md'}.
 *   2. switch-writes: room-registry set-active writes current_room into the
 *      switched room's STATE.md; getCurrentRoom() reflects the new slug.
 *   3. no-clobber: pre-existing frontmatter (venture_stage/status/version) is
 *      preserved through the write.
 *   4. absent-guard: when STATE.md did not pre-exist, the write creates a valid
 *      frontmatter block parseCurrentRoomField accepts.
 *   5. durability: after a compute-state > STATE.md regeneration of the active
 *      room, current_room survives (proves Task 2 closes the on-agent-complete
 *      wipe).
 *   6. no-backfill: compute-state on a NON-active room leaves its STATE.md
 *      without current_room.
 *   7. malicious-slug: a slug carrying a colon (or newline) never corrupts the
 *      frontmatter; the write is skipped and the file stays parseable
 *      (mitigates T-ad9-01).
 *
 * Registered in lib/memory/run-feynman-tests.cjs immediately after the
 * read-side suite (statusline-active-room.test.cjs). That read-side file is the
 * contract fence and MUST stay byte-for-byte green; this suite never touches it.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..', '..');
const SYNC_PATH = path.join(REPO, 'lib/core/folder-memory.cjs');
const REGISTRY = path.join(REPO, 'scripts/room-registry');
const COMPUTE_STATE = path.join(REPO, 'scripts/compute-state');

// ---------- Fixture helpers ----------

const TMP_ROOTS = [];
function mkTmp(prefix) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  TMP_ROOTS.push(d);
  return d;
}
process.on('exit', () => {
  for (const d of TMP_ROOTS) {
    try {
      fs.rmSync(d, { recursive: true, force: true });
    } catch (_e) { /* best effort */ }
  }
});

// Run scripts/room-registry with the tmp home as both the dir-override arg and
// MINDRIAN_ROOMS_HOME, so the room dir resolves under the fixture, never the
// real ~/MindrianRooms.
function registry(home, ...args) {
  return execFileSync('bash', [REGISTRY, home, ...args], {
    encoding: 'utf8',
    timeout: 15000,
    env: Object.assign({}, process.env, { MINDRIAN_ROOMS_HOME: home }),
  });
}

// Mimic scripts/on-agent-complete: `compute-state "$ROOM_DIR" > STATE.md`.
// The shell truncates STATE.md to zero BEFORE compute-state runs, so capturing
// stdout then overwriting the file is a faithful reproduction.
function regenerateStateMd(home, roomDir) {
  const out = execFileSync('bash', [COMPUTE_STATE, roomDir], {
    encoding: 'utf8',
    timeout: 15000,
    env: Object.assign({}, process.env, { MINDRIAN_ROOMS_HOME: home }),
  });
  fs.writeFileSync(path.join(roomDir, 'STATE.md'), out, 'utf8');
  return out;
}

function readState(roomDir) {
  return fs.readFileSync(path.join(roomDir, 'STATE.md'), 'utf8');
}

// ---------- Test 1: create writes current_room ----------

function test_1_createWrites(sync) {
  const home = mkTmp('statusline-write-t1-');
  registry(home, 'create', 'alpha-room', 'alpha-room');
  const roomDir = path.join(home, 'alpha-room');

  const r = sync.getCurrentRoom(roomDir);
  assert.ok(r !== null, 't1: create wrote a readable current_room');
  assert.strictEqual(r.slug, 'alpha-room', 't1: slug parsed from state_md');
  assert.strictEqual(r.source, 'state_md', 't1: canonical source, not fallback');
}

// ---------- Test 2: set-active writes the switched room ----------

function test_2_switchWrites(sync) {
  const home = mkTmp('statusline-write-t2-');
  registry(home, 'create', 'alpha-room', 'alpha-room');
  registry(home, 'create', 'beta-room', 'beta-room'); // beta now active
  // /mos:rooms open switch back to alpha.
  registry(home, 'set-active', 'alpha-room');

  const alpha = sync.getCurrentRoom(path.join(home, 'alpha-room'));
  assert.ok(alpha !== null, 't2: set-active wrote alpha current_room');
  assert.strictEqual(alpha.slug, 'alpha-room', 't2: reflects the switched slug');

  // The other room is untouched by the switch write.
  const beta = sync.getCurrentRoom(path.join(home, 'beta-room'));
  assert.ok(beta !== null && beta.slug === 'beta-room', 't2: beta unchanged');
}

// ---------- Test 3: no clobber of sibling frontmatter ----------

function test_3_noClobber() {
  const home = mkTmp('statusline-write-t3-');
  registry(home, 'create', 'gamma-room', 'gamma-room');
  const state = readState(path.join(home, 'gamma-room'));

  assert.ok(/^current_room: gamma-room$/m.test(state), 't3: current_room written');
  assert.ok(/^status: active$/m.test(state), 't3: status preserved');
  assert.ok(/^gsd_state_version: 1\.0$/m.test(state), 't3: version preserved');
  // Body survives the upsert.
  assert.ok(state.indexOf('## Decisions') !== -1, 't3: body preserved');
}

// ---------- Test 4: absent-guard writes a valid block ----------

function test_4_absentGuard(sync) {
  const home = mkTmp('statusline-write-t4-');
  registry(home, 'create', 'delta-room', 'delta-room');
  // Delete the seeded STATE.md so the next write hits the absent-file branch.
  const roomDir = path.join(home, 'delta-room');
  fs.rmSync(path.join(roomDir, 'STATE.md'));
  // Need set-active to fire the write; create another room, then switch back.
  registry(home, 'create', 'omega-room', 'omega-room');
  registry(home, 'set-active', 'delta-room');

  const r = sync.getCurrentRoom(roomDir);
  assert.ok(r !== null, 't4: absent STATE.md was created with a valid block');
  assert.strictEqual(r.slug, 'delta-room', 't4: slug parseable from fresh block');
}

// ---------- Test 5: durability across a compute-state regeneration ----------

function test_5_durability(sync) {
  const home = mkTmp('statusline-write-t5-');
  registry(home, 'create', 'epsilon-room', 'epsilon-room'); // active
  const roomDir = path.join(home, 'epsilon-room');

  // Regenerate STATE.md the way on-agent-complete does (truncate + rewrite).
  regenerateStateMd(home, roomDir);

  const r = sync.getCurrentRoom(roomDir);
  assert.ok(r !== null, 't5: current_room survived regeneration');
  assert.strictEqual(r.slug, 'epsilon-room', 't5: re-derived from registry');
}

// ---------- Test 6: no backfill of a non-active room ----------

function test_6_noBackfill() {
  const home = mkTmp('statusline-write-t6-');
  registry(home, 'create', 'zeta-room', 'zeta-room');
  registry(home, 'create', 'active-room', 'active-room'); // active flips here
  const parkedDir = path.join(home, 'zeta-room');

  const out = regenerateStateMd(home, parkedDir);
  assert.ok(
    !/current_room/.test(out),
    't6: a non-active room gains no current_room line'
  );
}

// ---------- Test 7: malicious slug never corrupts frontmatter ----------

function test_7_maliciousSlug(sync) {
  const home = mkTmp('statusline-write-t7-');
  // A room NAME carrying a colon is the injection vector: the sanitizer must
  // refuse to emit it (parseCurrentRoomField also rejects colons on read).
  registry(home, 'create', 'evil:injected', 'evil-room');
  const roomDir = path.join(home, 'evil-room');
  const state = readState(roomDir);

  // No current_room line was written (skipped by the sanitizer).
  assert.ok(!/^current_room:/m.test(state), 't7: colon slug write skipped');
  // The frontmatter is still intact and parseable (seeded block preserved).
  assert.ok(state.indexOf('---') === 0, 't7: frontmatter still opens the file');
  assert.ok(/^status: active$/m.test(state), 't7: block not corrupted');
  // getCurrentRoom degrades to null rather than reading a poisoned value.
  const r = sync.getCurrentRoom(roomDir);
  assert.strictEqual(r, null, 't7: no poisoned current_room is readable');
}

// ---------- Runner ----------

async function run() {
  assert.ok(fs.existsSync(SYNC_PATH), 'lib/core/folder-memory.cjs missing');
  assert.ok(fs.existsSync(REGISTRY), 'scripts/room-registry missing');
  assert.ok(fs.existsSync(COMPUTE_STATE), 'scripts/compute-state missing');

  // eslint-disable-next-line global-require
  const sync = require(SYNC_PATH);
  assert.ok(
    typeof sync.getCurrentRoom === 'function',
    'precondition: folder-memory.cjs must export getCurrentRoom'
  );

  const tests = [
    () => test_1_createWrites(sync),
    () => test_2_switchWrites(sync),
    () => test_3_noClobber(),
    () => test_4_absentGuard(sync),
    () => test_5_durability(sync),
    () => test_6_noBackfill(),
    () => test_7_maliciousSlug(sync),
  ];

  for (const t of tests) t();

  process.stdout.write(
    'statusline-active-room-write: ' + tests.length + '/' + tests.length +
    ' tests passed\n'
  );
  process.exit(0);
}

run().catch((e) => {
  process.stderr.write((e && e.stack) || String(e));
  process.stderr.write('\n');
  process.exit(1);
});
