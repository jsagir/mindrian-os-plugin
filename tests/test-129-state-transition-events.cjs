'use strict';
// Phase 129-03 -- state-transition event emission behavior suite (RED-first).
//
// Covers Task 1 (/mos:jtbd set + clear + override emit jtbd_transitioned;
// jtbd-state.json cache still updates; emission only on confirmed transitions)
// and Task 2 (/mos:operator set + reset emit operator_transitioned exactly once;
// the lib/conversation/operator.cjs node:sqlite OPERATOR_TRANSITION bypass is
// retired and routes through navigation.cjs; the OPERATOR_TRANSITION edge still
// lands; both scripts + operator.cjs pass the substrate guard).
//
// Hermetic: each fixture gets its own tmpdir room with a canonical
// .mindrian/room.db (via openRoomDb). The two command scripts are exercised as
// child processes with MINDRIAN_ACTIVE_ROOM pointed at the fixture room so the
// resolve-active-room chokepoint picks it up.
//
// Canon Part 8 / Part 9: every room.db touch is through navigation surfaces.
// NO em-dashes in this file (CLAUDE.md HARD RULE).

const { ok, equal } = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const { openRoomDb, closeRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));
const memoryEvents = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'memory-events.cjs'));
const edges = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'edges.cjs'));
const checkSubstrate = require(path.join(REPO_ROOT, 'scripts', 'check-substrate.cjs'));

const JTBD_CMD = path.join(REPO_ROOT, 'scripts', 'jtbd-command.cjs');
const OPERATOR_CMD = path.join(REPO_ROOT, 'scripts', 'operator-command.cjs');

// ---------------------------------------------------------------------------
// fixtures + helpers
// ---------------------------------------------------------------------------

function makeRoom() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'phase-129-03-'));
  fs.mkdirSync(path.join(tmp, '.mindrian'), { recursive: true });
  // Materialize the canonical room.db so the spine helpers have a real target.
  const db = openRoomDb(tmp);
  closeRoomDb(db);
  return tmp;
}

function cleanup(tmp) {
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) { /* ignore */ }
}

// Run a command script as a child with the active room pinned to roomDir.
function runCmd(scriptPath, args, roomDir) {
  const env = Object.assign({}, process.env, {
    // resolve-active-room.cjs honors CLAUDE_ACTIVE_ROOM as an explicit absolute
    // room path (highest-precedence override). slug is derived from basename.
    CLAUDE_ACTIVE_ROOM: roomDir,
  });
  const res = spawnSync(process.execPath, [scriptPath].concat(args), {
    cwd: roomDir, env, encoding: 'utf8',
  });
  return res;
}

// Read all memory_events of a given type from the room.db, newest first.
function readEvents(roomDir, eventType) {
  const db = openRoomDb(roomDir);
  try {
    const rows = db.prepare(
      "SELECT id, properties, created_at FROM nodes " +
      "WHERE type = 'memory_event' " +
      "AND json_extract(properties, '$.event_type') = ? " +
      "ORDER BY created_at DESC, id DESC"
    ).all(eventType);
    return rows.map((r) => ({
      id: r.id,
      props: JSON.parse(r.properties || '{}'),
      created_at: r.created_at,
    }));
  } finally {
    closeRoomDb(db);
  }
}

function countEdges(roomDir, edgeType) {
  const db = openRoomDb(roomDir);
  try {
    const row = db.prepare('SELECT COUNT(*) AS n FROM edges WHERE type = ?').get(edgeType);
    return row ? row.n : 0;
  } finally {
    closeRoomDb(db);
  }
}

let passed = 0;
let failed = 0;
function run(name, fn) {
  const room = makeRoom();
  try {
    fn(room);
    passed += 1;
    process.stdout.write('  ok   ' + name + '\n');
  } catch (e) {
    failed += 1;
    process.stdout.write('  FAIL ' + name + '\n');
    process.stdout.write('       ' + (e && e.message ? e.message : String(e)) + '\n');
  } finally {
    cleanup(room);
  }
}

// ---------------------------------------------------------------------------
// Task 1 -- /mos:jtbd transition events
// ---------------------------------------------------------------------------

function jtbdStatePath(roomDir) {
  return path.join(roomDir, '.mindrian', 'jtbd-state.json');
}

function test_jtbd_set_emits_event_and_updates_cache(room) {
  const res = runCmd(JTBD_CMD, ['set', 'explore', '--json'], room);
  equal(res.status, 0, 'jtbd set should exit 0; stderr=' + res.stderr);
  // Cache still updates (unchanged behavior).
  ok(fs.existsSync(jtbdStatePath(room)), 'jtbd-state.json cache must be written');
  const cache = JSON.parse(fs.readFileSync(jtbdStatePath(room), 'utf8'));
  // jtbd-state.json nests the live value under `current`.
  equal(cache.current && cache.current.jtbd, 'explore', 'cache jtbd must equal the set value');
  // Exactly ONE jtbd_transitioned event with kind=set, to=explore.
  const events = readEvents(room, 'jtbd_transitioned');
  equal(events.length, 1, 'exactly one jtbd_transitioned event after set');
  equal(events[0].props.kind, 'set', "kind must be 'set' on a first set");
  equal(events[0].props.to, 'explore', 'to must be the set jtbd');
  equal(events[0].props.trigger, 'manual_set', 'trigger must be manual_set');
}

function test_jtbd_clear_emits_event(room) {
  // Seed a value first.
  runCmd(JTBD_CMD, ['set', 'explore', '--json'], room);
  const res = runCmd(JTBD_CMD, ['clear', '--json'], room);
  equal(res.status, 0, 'jtbd clear should exit 0; stderr=' + res.stderr);
  const events = readEvents(room, 'jtbd_transitioned');
  const clears = events.filter((e) => e.props.kind === 'clear');
  equal(clears.length, 1, 'exactly one clear event');
  equal(clears[0].props.to, null, 'clear emits to=null');
  equal(clears[0].props.trigger, 'manual_clear', 'clear trigger is manual_clear');
}

function test_jtbd_override_emits_override_kind(room) {
  // First manual set creates a sticky override (expires_at in the future).
  runCmd(JTBD_CMD, ['set', 'explore', '--json'], room);
  // Second set while the sticky override is active -> kind='override'.
  const res = runCmd(JTBD_CMD, ['set', 'validate-idea', '--json'], room);
  equal(res.status, 0, 'second jtbd set should exit 0; stderr=' + res.stderr);
  const events = readEvents(room, 'jtbd_transitioned');
  const overrides = events.filter((e) => e.props.kind === 'override');
  equal(overrides.length, 1, 'exactly one override-kind event on a re-set over a sticky override');
  equal(overrides[0].props.to, 'validate-idea', 'override to must be the new jtbd');
  equal(overrides[0].props.from, 'explore', 'override from must be the prior jtbd');
}

function test_jtbd_no_event_on_rejected(room) {
  const res = runCmd(JTBD_CMD, ['set', 'not-a-real-jtbd', '--json'], room);
  ok(res.status !== 0, 'unknown jtbd must be rejected (non-zero exit)');
  const events = readEvents(room, 'jtbd_transitioned');
  equal(events.length, 0, 'no jtbd_transitioned event on a rejected transition');
}

function test_jtbd_substrate_clean() {
  const v = checkSubstrate.scanFiles(['scripts/jtbd-command.cjs'], (p) => fs.readFileSync(path.join(REPO_ROOT, p), 'utf8'));
  equal(v.length, 0, 'jtbd-command.cjs must have zero direct room.db access: ' + JSON.stringify(v));
}

// ---------------------------------------------------------------------------
// Task 2 -- /mos:operator transition events + bypass retirement
// ---------------------------------------------------------------------------

function test_operator_set_emits_event(room) {
  const res = runCmd(OPERATOR_CMD, ['set', 'EXPLORE_CAPTURE', '--json'], room);
  equal(res.status, 0, 'operator set should exit 0; stderr=' + res.stderr);
  const events = readEvents(room, 'operator_transitioned');
  equal(events.length, 1, 'exactly one operator_transitioned event after set');
  equal(events[0].props.to, 'EXPLORE_CAPTURE', 'to must be the set operator');
  equal(events[0].props.from, 'JUST_TALK', 'from must be the prior operator');
  equal(events[0].props.trigger, 'manual_set', 'trigger must be manual_set');
}

function test_operator_reset_emits_event(room) {
  // Move off JUST_TALK first so reset has somewhere to come from.
  runCmd(OPERATOR_CMD, ['set', 'EXPLORE_CAPTURE', '--json'], room);
  const res = runCmd(OPERATOR_CMD, ['reset', '--confirm', '--json'], room);
  equal(res.status, 0, 'operator reset should exit 0; stderr=' + res.stderr);
  const events = readEvents(room, 'operator_transitioned');
  const resets = events.filter((e) => e.props.trigger === 'manual_reset');
  equal(resets.length, 1, 'exactly one operator_transitioned event with trigger manual_reset');
  equal(resets[0].props.to, 'JUST_TALK', 'reset target is JUST_TALK');
}

function test_operator_no_event_on_noop(room) {
  // set to the current operator (JUST_TALK) is a no-op; no event should fire.
  const res = runCmd(OPERATOR_CMD, ['set', 'JUST_TALK', '--json'], room);
  equal(res.status, 0, 'no-op set exits 0');
  const events = readEvents(room, 'operator_transitioned');
  equal(events.length, 0, 'no operator_transitioned event on an already-in-target no-op');
}

function test_operator_transition_edge_lands(room) {
  const res = runCmd(OPERATOR_CMD, ['set', 'EXPLORE_CAPTURE', '--json'], room);
  equal(res.status, 0, 'operator set should exit 0; stderr=' + res.stderr);
  const n = countEdges(room, 'OPERATOR_TRANSITION');
  ok(n >= 1, 'OPERATOR_TRANSITION edge must land in room.db after a successful transition (got ' + n + ')');
}

function test_operator_transitioned_exactly_once_no_double_emit(room) {
  const res = runCmd(OPERATOR_CMD, ['set', 'EXPLORE_CAPTURE', '--json'], room);
  equal(res.status, 0, 'operator set should exit 0; stderr=' + res.stderr);
  const events = readEvents(room, 'operator_transitioned');
  equal(events.length, 1, 'single emission site: exactly one operator_transitioned per transition');
}

function test_operator_module_substrate_clean() {
  const files = ['scripts/operator-command.cjs', 'lib/conversation/operator.cjs'];
  const v = checkSubstrate.scanFiles(files, (p) => fs.readFileSync(path.join(REPO_ROOT, p), 'utf8'));
  equal(v.length, 0, 'operator-command.cjs + operator.cjs must pass the substrate guard: ' + JSON.stringify(v));
}

function test_operator_cjs_bypass_gone() {
  const src = fs.readFileSync(path.join(REPO_ROOT, 'lib', 'conversation', 'operator.cjs'), 'utf8');
  ok(!/require\(\s*['"]node:sqlite['"]\s*\)/.test(src), 'operator.cjs must not require node:sqlite');
  ok(!/INSERT\s+OR\s+IGNORE\s+INTO\s+edges/.test(src), 'operator.cjs must not run raw INSERT into edges');
  ok(/navigation/.test(src), 'operator.cjs must route through navigation.cjs');
}

function test_operator_transition_allowed_edge_type() {
  ok(edges.ALLOWED_EDGE_TYPES.has('OPERATOR_TRANSITION'), 'OPERATOR_TRANSITION must be in ALLOWED_EDGE_TYPES');
}

// ---------------------------------------------------------------------------
// runner
// ---------------------------------------------------------------------------

process.stdout.write('Phase 129-03 state-transition event suite\n');

// Task 1
run('jtbd set emits jtbd_transitioned + updates cache', test_jtbd_set_emits_event_and_updates_cache);
run('jtbd clear emits jtbd_transitioned kind=clear to=null', test_jtbd_clear_emits_event);
run('jtbd override emits kind=override', test_jtbd_override_emits_override_kind);
run('jtbd no event on rejected transition', test_jtbd_no_event_on_rejected);
run('jtbd-command.cjs substrate clean', () => test_jtbd_substrate_clean());

// Task 2
run('operator set emits operator_transitioned', test_operator_set_emits_event);
run('operator reset emits operator_transitioned trigger=manual_reset', test_operator_reset_emits_event);
run('operator no event on no-op', test_operator_no_event_on_noop);
run('OPERATOR_TRANSITION edge lands after transition', test_operator_transition_edge_lands);
run('operator_transitioned exactly once (no double-emit)', test_operator_transitioned_exactly_once_no_double_emit);
run('operator-command.cjs + operator.cjs substrate clean', () => test_operator_module_substrate_clean());
run('operator.cjs node:sqlite bypass retired', () => test_operator_cjs_bypass_gone());
run('OPERATOR_TRANSITION in ALLOWED_EDGE_TYPES', () => test_operator_transition_allowed_edge_type());

process.stdout.write('\n' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed === 0 ? 0 : 1);
