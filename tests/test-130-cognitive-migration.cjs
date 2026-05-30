#!/usr/bin/env node
'use strict';

/*
 * Phase 130-03 -- cognitive-family migration behavior suite.
 *
 * Covers:
 *   Task 1: hat-persistence.cjs room.db rewrite (no STATE.md fs writes, no direct
 *           room-db/sqlite require, 7 signatures preserved) + the one-shot
 *           idempotent backfill (migrate-hats-to-roomdb.cjs).
 *   Task 2: the 4 cognitive commands carry thin lens-engine client frontmatter;
 *           persona-ops delegates its rotation loop; the duplicated tension-map
 *           is gone (only synthesizers/tension-map.cjs remains).
 *
 * Pure Node.js built-ins. NO em-dashes. Exit non-zero on any failure.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');

const REPO = path.resolve(__dirname, '..');
let PASS = 0;
let FAIL = 0;
const FAILS = [];

function test(name, fn) {
  try {
    fn();
    PASS++;
    console.log('  ok - ' + name);
  } catch (e) {
    FAIL++;
    FAILS.push(name + ': ' + (e && e.message ? e.message : String(e)));
    console.log('  NOT ok - ' + name + ' -- ' + (e && e.message ? e.message : String(e)));
  }
}

function mkRoomWithDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hat-mig-'));
  const mindrian = path.join(dir, '.mindrian');
  fs.mkdirSync(mindrian, { recursive: true });
  const roomDbMod = require(path.join(REPO, 'lib/core/room-db.cjs'));
  const db = roomDbMod.openRoomDb(dir);
  roomDbMod.closeRoomDb(db);
  return dir;
}

// ---------------------------------------------------------------------------
// Task 1: hat-persistence source invariants
// ---------------------------------------------------------------------------

test('hat-persistence: no STATE.md fs.writeFileSync', () => {
  const src = fs.readFileSync(path.join(REPO, 'lib/core/hat-persistence.cjs'), 'utf8');
  const flat = src.replace(/\s+/g, ' ');
  assert(!/writeFileSync\([^)]*\.mindrian[^)]*hats[^)]*STATE\.md/i.test(flat),
    'still writes a .mindrian/hats/{color}/STATE.md file');
});

test('hat-persistence: no direct room-db or sqlite require', () => {
  const src = fs.readFileSync(path.join(REPO, 'lib/core/hat-persistence.cjs'), 'utf8');
  assert(!/require\(['"][^'"]*room-db\.cjs['"]\)/.test(src), 'direct room-db.cjs require');
  assert(!/require\(['"](?:node:sqlite|better-sqlite3)['"]\)/.test(src), 'direct sqlite require');
});

test('hat-persistence: routes through navigation.cjs', () => {
  const src = fs.readFileSync(path.join(REPO, 'lib/core/hat-persistence.cjs'), 'utf8');
  assert(/require\(['"]\.\/navigation\.cjs['"]\)/.test(src), 'does not require navigation.cjs');
  assert(/navigation\.(writeHatStateByRoomDir|readHatStateByRoomDir|readAllHatStatesByRoomDir)/.test(src),
    'does not call the navigation HatState wrappers');
});

test('hat-persistence: 7 export signatures preserved', () => {
  const h = require(path.join(REPO, 'lib/core/hat-persistence.cjs'));
  for (const f of ['HAT_COLORS', 'HAT_LABELS', 'loadHatState', 'saveHatState', 'logSession', 'loadAllHatStates', 'getRecentLogs']) {
    assert(h[f] !== undefined, 'missing export: ' + f);
  }
});

test('hat-persistence: zero em-dashes', () => {
  const src = fs.readFileSync(path.join(REPO, 'lib/core/hat-persistence.cjs'), 'utf8');
  assert(!src.includes(String.fromCharCode(8212)), 'contains an em-dash');
});

// ---------------------------------------------------------------------------
// Task 1: hat-persistence round-trip via room.db
// ---------------------------------------------------------------------------

test('hat-persistence: save/load round-trip via room.db node', () => {
  const room = mkRoomWithDb();
  const h = require(path.join(REPO, 'lib/core/hat-persistence.cjs'));
  const saved = h.saveHatState(room, 'black', {
    current_focus: 'risk audit',
    top_concerns: ['regulatory exposure'],
    session_count: 3,
  });
  assert(saved && saved.saved === true, 'save did not report saved');
  const loaded = h.loadHatState(room, 'black');
  assert.strictEqual(loaded.current_focus, 'risk audit');
  assert.strictEqual(loaded.session_count, 3);
  assert(loaded.top_concerns.includes('regulatory exposure'), 'concern not persisted');
  // Prove the legacy STATE.md file was NOT written.
  const legacy = path.join(room, '.mindrian', 'hats', 'black', 'STATE.md');
  assert(!fs.existsSync(legacy), 'a legacy STATE.md was written');
});

test('hat-persistence: loadAllHatStates returns all 6 colors', () => {
  const room = mkRoomWithDb();
  const h = require(path.join(REPO, 'lib/core/hat-persistence.cjs'));
  const all = h.loadAllHatStates(room);
  assert.deepStrictEqual(Object.keys(all).sort(), ['black', 'blue', 'green', 'red', 'white', 'yellow']);
});

test('hat-persistence: logSession bumps session_count in the node + writes archive', () => {
  const room = mkRoomWithDb();
  const h = require(path.join(REPO, 'lib/core/hat-persistence.cjs'));
  const r = h.logSession(room, 'yellow', { focus: 'upside', concerns: [], opportunities: ['new market'] });
  assert(r && r.logged === true, 'logSession did not log');
  const loaded = h.loadHatState(room, 'yellow');
  assert.strictEqual(loaded.session_count, 1);
  // The daily markdown archive should exist (read-only archive path stays).
  assert(fs.existsSync(r.path), 'session-log archive not written');
});

// ---------------------------------------------------------------------------
// Task 1: migrate-hats-to-roomdb backfill
// ---------------------------------------------------------------------------

test('migrate-hats-to-roomdb: exports migrateHatsToRoomDb', () => {
  const m = require(path.join(REPO, 'scripts/migrate-hats-to-roomdb.cjs'));
  assert.strictEqual(typeof m.migrateHatsToRoomDb, 'function');
});

test('migrate-hats-to-roomdb: backfills legacy STATE.md, leaves markdown in place, idempotent', () => {
  const room = mkRoomWithDb();
  // Seed a legacy STATE.md for one color.
  const blackDir = path.join(room, '.mindrian', 'hats', 'black');
  fs.mkdirSync(blackDir, { recursive: true });
  const legacy = path.join(blackDir, 'STATE.md');
  fs.writeFileSync(legacy, [
    '---',
    'hat: black',
    'current_focus: legacy risk focus',
    'session_count: 5',
    '---',
    '',
    '# Black Hat',
    '',
    '## Top Concerns',
    '- legacy concern one',
    '',
    '## Top Opportunities',
    '- None yet',
    '',
    '## Methodology Notes',
    '- None yet',
  ].join('\n'), 'utf8');

  const m = require(path.join(REPO, 'scripts/migrate-hats-to-roomdb.cjs'));
  const r1 = m.migrateHatsToRoomDb(room);
  assert(r1.ok === true, 'first migration not ok');
  assert(r1.migrated.includes('black'), 'black not migrated');

  // The node now carries the legacy content.
  const h = require(path.join(REPO, 'lib/core/hat-persistence.cjs'));
  const loaded = h.loadHatState(room, 'black');
  assert.strictEqual(loaded.current_focus, 'legacy risk focus');
  assert.strictEqual(loaded.session_count, 5);
  assert(loaded.top_concerns.includes('legacy concern one'), 'legacy concern not migrated');

  // The markdown archive is LEFT IN PLACE.
  assert(fs.existsSync(legacy), 'migration deleted the legacy markdown');

  // A second run is a no-op (idempotency sentinel).
  const r2 = m.migrateHatsToRoomDb(room);
  assert(r2.skipped === true, 'second run was not skipped (not idempotent)');
});

// ---------------------------------------------------------------------------
// Task 2: thin lens-engine client frontmatter on the 4 commands
// ---------------------------------------------------------------------------

test('think-hats.md: lens_set six-hats + rotation_mode serial', () => {
  const th = fs.readFileSync(path.join(REPO, 'commands/think-hats.md'), 'utf8');
  assert(/lens_set:\s*six-hats/.test(th), 'missing lens_set: six-hats');
  assert(/rotation_mode:\s*serial/.test(th), 'missing rotation_mode: serial');
  assert(/synthesizer:\s*tension-map/.test(th), 'missing synthesizer: tension-map');
});

test('persona.md: lens_set six-hats + rotation_mode parallel + persistence memory_event', () => {
  const pe = fs.readFileSync(path.join(REPO, 'commands/persona.md'), 'utf8');
  assert(/lens_set:\s*six-hats/.test(pe), 'missing lens_set: six-hats');
  assert(/rotation_mode:\s*parallel/.test(pe), 'missing rotation_mode: parallel');
  assert(/persistence:\s*memory_event/.test(pe), 'missing persistence: memory_event');
});

test('hat-briefing.md: rotation_mode consume (reader)', () => {
  const hb = fs.readFileSync(path.join(REPO, 'commands/hat-briefing.md'), 'utf8');
  assert(/lens_set:\s*six-hats/.test(hb), 'missing lens_set: six-hats');
  assert(/rotation_mode:\s*consume/.test(hb), 'missing rotation_mode: consume');
});

test('challenge-assumptions.md: lens_set black-hat + rotation_mode single', () => {
  const ca = fs.readFileSync(path.join(REPO, 'commands/challenge-assumptions.md'), 'utf8');
  assert(/lens_set:\s*\[?'?black-hat'?\]?/.test(ca), 'missing lens_set black-hat');
  assert(/rotation_mode:\s*single/.test(ca), 'missing rotation_mode: single');
  assert(/synthesizer:\s*tension-map/.test(ca), 'missing synthesizer: tension-map');
});

test('all 4 commands preserve Phase 122 frontmatter (kind/produces/autonomous_safe)', () => {
  for (const f of ['think-hats.md', 'persona.md', 'hat-briefing.md']) {
    const src = fs.readFileSync(path.join(REPO, 'commands', f), 'utf8');
    assert(/kind:\s*methodology/.test(src), f + ' lost kind: methodology');
    assert(/produces:/.test(src), f + ' lost produces');
    assert(/autonomous_safe:/.test(src), f + ' lost autonomous_safe');
  }
});

test('no em-dashes across the 4 commands + persona-ops', () => {
  for (const f of ['commands/think-hats.md', 'commands/persona.md', 'commands/hat-briefing.md', 'commands/challenge-assumptions.md', 'lib/core/persona-ops.cjs']) {
    const src = fs.readFileSync(path.join(REPO, f), 'utf8');
    assert(!src.includes(String.fromCharCode(8212)), 'em-dash in ' + f);
  }
});

// ---------------------------------------------------------------------------
// Task 2: persona-ops delegates the rotation loop + tension-map dedup
// ---------------------------------------------------------------------------

test('persona-ops: delegates analyzeAllPerspectives to lens-engine.rotate', () => {
  const src = fs.readFileSync(path.join(REPO, 'lib/core/persona-ops.cjs'), 'utf8');
  assert(/lens-engine\.cjs/.test(src), 'persona-ops does not require lens-engine.cjs');
  assert(/\.rotate\(/.test(src), 'persona-ops does not call lens-engine.rotate');
});

test('persona-ops: inline tension computation replaced by synthesizeTensionMap', () => {
  const src = fs.readFileSync(path.join(REPO, 'lib/core/persona-ops.cjs'), 'utf8');
  assert(/synthesizeTensionMap|synthesizers\/tension-map\.cjs/.test(src),
    'persona-ops does not reference the single tension-map synthesizer');
});

test('only one tension-map synthesizer file exists', () => {
  assert(fs.existsSync(path.join(REPO, 'lib/core/synthesizers/tension-map.cjs')),
    'the canonical synthesizers/tension-map.cjs is missing');
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log('');
console.log('test-130-cognitive-migration: ' + PASS + ' passed, ' + FAIL + ' failed');
if (FAIL > 0) {
  for (const f of FAILS) console.log('  FAIL: ' + f);
  process.exit(1);
}
process.exit(0);
