#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 94-01 -- statusline active room read contract acceptance tests.
 * (Business Source License 1.1; SPDX BUSL-1.1; see LICENSE.)
 *
 * Verifies the canonical read path for the statusline's active-room name:
 *
 *   STATE.md frontmatter current_room
 *     -> lib/core/folder-memory.cjs getCurrentRoom()
 *     -> scripts/context-monitor render
 *
 * Lawrence Aronhime reproducer: in his 2026-04-28 38-minute live test he
 * said "look at the bottom. It still says core power" four times. Root
 * cause was the statusline deriving the room name from a stale source
 * (cwd or its own cache) instead of STATE.md. This test fixture proves
 * the new canonical contract: switch rooms in fixture STATE.md, the very
 * next getCurrentRoom() call returns the new slug. No caching across
 * calls, no exceptions on every failure mode.
 *
 * Test map (8 cases, one-to-one with the PLAN <behavior> block):
 *   1. getCurrentRoom() returns null when STATE.md missing in canonical path
 *   2. getCurrentRoom() returns null when STATE.md exists but lacks frontmatter
 *   3. getCurrentRoom() returns null when frontmatter exists but current_room absent
 *   4. getCurrentRoom() returns {slug, path, source} on a happy frontmatter
 *   5. getCurrentRoom() returns null when YAML frontmatter is malformed
 *   6. Lawrence reproducer: switch room slug, next call reflects within one cycle
 *   7. getCurrentRoom() ignores quotes and trailing whitespace around slug
 *   8. End-to-end: spawn scripts/context-monitor with fixture STATE.md, stdout
 *      contains the new slug
 *
 * Registered in lib/memory/run-feynman-tests.cjs.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..', '..');
const SYNC_PATH = path.join(REPO, 'lib/core/folder-memory.cjs');
const CONTEXT_MONITOR = path.join(REPO, 'scripts/context-monitor');

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

function writeStateMdWithFrontmatter(dir, frontmatterLines, body) {
  const lines = ['---'];
  for (const fl of frontmatterLines) lines.push(fl);
  lines.push('---');
  lines.push('');
  lines.push(body || '# Room State');
  fs.writeFileSync(path.join(dir, 'STATE.md'), lines.join('\n'), 'utf8');
}

function writeRoomFixture(roomDir, currentRoomValue) {
  fs.mkdirSync(roomDir, { recursive: true });
  const frontmatter = [
    'venture_stage: Pre-Opportunity',
    'last_updated: 2026-04-28',
  ];
  if (currentRoomValue !== undefined) {
    frontmatter.push('current_room: ' + currentRoomValue);
  }
  writeStateMdWithFrontmatter(roomDir, frontmatter, '# Room State');
}

function writeRegistry(workDir, activeSlug, roomDirAbs) {
  const dotRooms = path.join(workDir, '.rooms');
  fs.mkdirSync(dotRooms, { recursive: true });
  const registry = {
    active: activeSlug,
    rooms: {},
  };
  registry.rooms[activeSlug] = {
    name: activeSlug,
    path: path.relative(workDir, roomDirAbs) || '.',
  };
  fs.writeFileSync(
    path.join(dotRooms, 'registry.json'),
    JSON.stringify(registry, null, 2),
    'utf8'
  );
}

// ---------- Module pre-condition ----------

function t0_moduleFileExists() {
  assert.ok(fs.existsSync(SYNC_PATH), 'lib/core/folder-memory.cjs missing');
}

// ---------- Test 1: missing STATE.md returns null ----------

function test_1_missingStateMdReturnsNull(sync) {
  const work = mkTmp('statusline-active-room-t1-');
  // No STATE.md anywhere; no .rooms registry; no room/ legacy dir.
  let r;
  assert.doesNotThrow(() => {
    r = sync.getCurrentRoom(work);
  }, 't1: no throws when STATE.md absent');
  assert.strictEqual(r, null, 't1: returns null on missing STATE.md');
}

// ---------- Test 2: STATE.md without frontmatter returns null ----------

function test_2_stateMdWithoutFrontmatterReturnsNull(sync) {
  const work = mkTmp('statusline-active-room-t2-');
  const room = path.join(work, 'room');
  fs.mkdirSync(room, { recursive: true });
  // No leading --- delimiter; just plain markdown.
  fs.writeFileSync(
    path.join(room, 'STATE.md'),
    '# Room State\n\nNo frontmatter here.\n',
    'utf8'
  );
  const r = sync.getCurrentRoom(work);
  assert.strictEqual(r, null, 't2: returns null when frontmatter absent');
}

// ---------- Test 3: frontmatter without current_room returns null ----------

function test_3_frontmatterWithoutCurrentRoomReturnsNull(sync) {
  const work = mkTmp('statusline-active-room-t3-');
  const room = path.join(work, 'room');
  fs.mkdirSync(room, { recursive: true });
  writeStateMdWithFrontmatter(room, [
    'venture_stage: Pre-Opportunity',
    'last_updated: 2026-04-28',
  ], '# Room State');
  const r = sync.getCurrentRoom(work);
  assert.strictEqual(r, null, 't3: returns null when current_room absent');
}

// ---------- Test 4: happy path ----------

function test_4_happyFrontmatterReturnsTriple(sync) {
  const work = mkTmp('statusline-active-room-t4-');
  const room = path.join(work, 'room');
  writeRoomFixture(room, 'core-power');

  const r = sync.getCurrentRoom(work);
  assert.ok(r !== null, 't4: returns non-null when current_room present');
  assert.strictEqual(r.slug, 'core-power', 't4: slug parsed');
  assert.strictEqual(r.source, 'state_md', 't4: source tag');
  assert.ok(typeof r.path === 'string' && r.path.length > 0, 't4: path string');
  assert.ok(path.isAbsolute(r.path), 't4: path is absolute');
  assert.ok(r.path.endsWith('STATE.md'), 't4: path points at STATE.md');
}

// ---------- Test 5: malformed YAML returns null ----------

function test_5_malformedYamlReturnsNull(sync) {
  const work = mkTmp('statusline-active-room-t5-');
  const room = path.join(work, 'room');
  fs.mkdirSync(room, { recursive: true });
  // Frontmatter open delimiter but never closes; malformed key syntax.
  fs.writeFileSync(
    path.join(room, 'STATE.md'),
    '---\nthis is not valid yaml because : : : :\nmore garbage\n',
    'utf8'
  );
  let r;
  assert.doesNotThrow(() => {
    r = sync.getCurrentRoom(work);
  }, 't5: no throws on malformed YAML');
  assert.strictEqual(r, null, 't5: returns null on malformed YAML');
}

// ---------- Test 6: Lawrence reproducer (no caching across calls) ----------

function test_6_lawrenceReproducerNoCaching(sync) {
  const work = mkTmp('statusline-active-room-t6-');
  const room = path.join(work, 'room');

  writeRoomFixture(room, 'core-power');
  const first = sync.getCurrentRoom(work);
  assert.ok(first !== null, 't6a: first read returns object');
  assert.strictEqual(first.slug, 'core-power', 't6a: first slug = core-power');

  // Lawrence's reproducer step: /mos:rooms switches to a new room.
  // STATE.md is rewritten with the new current_room.
  writeRoomFixture(room, 'curriculum-redesign-fall-2026');

  const second = sync.getCurrentRoom(work);
  assert.ok(second !== null, 't6b: second read returns object');
  assert.strictEqual(
    second.slug,
    'curriculum-redesign-fall-2026',
    't6b: second slug = curriculum-redesign-fall-2026 (no stale cache)'
  );
}

// ---------- Test 7: quotes and whitespace stripped ----------

function test_7_quotesAndWhitespaceStripped(sync) {
  const variants = [
    { raw: 'core-power', expected: 'core-power' },
    { raw: '"core-power"', expected: 'core-power' },
    { raw: "'core-power'", expected: 'core-power' },
    { raw: '  core-power  ', expected: 'core-power' },
    { raw: '"  core-power  "', expected: 'core-power' },
  ];
  for (const v of variants) {
    const work = mkTmp('statusline-active-room-t7-');
    const room = path.join(work, 'room');
    writeRoomFixture(room, v.raw);
    const r = sync.getCurrentRoom(work);
    assert.ok(r !== null, 't7: non-null for variant ' + JSON.stringify(v.raw));
    assert.strictEqual(
      r.slug,
      v.expected,
      't7: variant ' + JSON.stringify(v.raw) + ' -> ' + v.expected
    );
  }
}

// ---------- Test 8: end-to-end context-monitor render ----------

function test_8_endToEndContextMonitorRender(sync) {
  const work = mkTmp('statusline-active-room-t8-');
  const room = path.join(work, 'room');
  writeRoomFixture(room, 'switched-room-name-94-01');

  // Also seed a registry entry pointing at our fixture room so the
  // existing context-monitor room-resolution path can find it. The
  // registry's active slug stays aligned with current_room for the
  // happy-path test.
  writeRegistry(work, 'switched-room-name-94-01', room);

  // Prepare the JSON payload Claude Code feeds the statusline on stdin.
  const stdinPayload = JSON.stringify({
    model: { id: 'claude-3-5-sonnet', display_name: 'Sonnet' },
    workspace: { current_dir: work },
    context_window: {
      remaining_percentage: 80,
      used_percentage: 20,
      context_window_size: 200000,
    },
  });

  let stdout = '';
  try {
    stdout = execFileSync(process.execPath, [CONTEXT_MONITOR], {
      input: stdinPayload,
      encoding: 'utf8',
      timeout: 5000,
      env: Object.assign({}, process.env, {
        MINDRIAN_OS_ROOT: REPO,
      }),
    });
  } catch (e) {
    // Surface the captured streams for diagnostic clarity.
    const detail = e && e.stdout ? String(e.stdout) : '(no stdout)';
    const errDetail = e && e.stderr ? String(e.stderr) : '(no stderr)';
    throw new Error(
      't8: context-monitor exec failed -- stdout=' + detail +
      ' stderr=' + errDetail
    );
  }

  assert.ok(
    stdout.indexOf('switched-room-name-94-01') !== -1,
    't8: context-monitor stdout contains switched-room-name-94-01 ' +
    '(got: ' + stdout.replace(/\x1b\[[0-9;]*m/g, '').slice(0, 300) + ')'
  );
}

// ---------- Runner ----------

async function run() {
  t0_moduleFileExists();

  // eslint-disable-next-line global-require
  const sync = require(SYNC_PATH);

  assert.ok(
    typeof sync.getCurrentRoom === 'function',
    'precondition: folder-memory.cjs must export getCurrentRoom function'
  );

  test_1_missingStateMdReturnsNull(sync);
  test_2_stateMdWithoutFrontmatterReturnsNull(sync);
  test_3_frontmatterWithoutCurrentRoomReturnsNull(sync);
  test_4_happyFrontmatterReturnsTriple(sync);
  test_5_malformedYamlReturnsNull(sync);
  test_6_lawrenceReproducerNoCaching(sync);
  test_7_quotesAndWhitespaceStripped(sync);
  test_8_endToEndContextMonitorRender(sync);

  process.stdout.write('statusline-active-room: 8/8 tests passed\n');
  process.exit(0);
}

run().catch((e) => {
  process.stderr.write((e && e.stack) || String(e));
  process.stderr.write('\n');
  process.exit(1);
});
