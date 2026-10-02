#!/usr/bin/env node
'use strict';

/**
 * Phase 369-04 (TS369-07, D-18, D-19) -- smoke test for the Phase 369 test
 * infrastructure.
 *
 *   1. the writer inventory (tests/fixtures/369/writer-inventory.json) parses,
 *      every row has the required keys, ids are unique, the required ids are
 *      present, every file with a scan hit is covered by a row, and the
 *      per-file statement counts equal a live wide-regex scan taken now. A
 *      mismatch FAILs and names the drifted file: that is how a later plan
 *      learns a writer was added (D-18: coverage is proven against the
 *      inventory, never a list of chokepoint functions).
 *   2. buildRoom369 builds wide, mid and legacy rooms: the raw nodes table has
 *      the variant's column count (16, 12, 3, per fixture-room-347's DDL),
 *      and migrate:true leaves a room.db the write door accepts again.
 *   3. live arm: startDaemon with one migrated room, a legacyClient connects
 *      and room_bind on that room answers effective:true. A spawn that fails
 *      for a reason outside the repo (port bind refused by the OS) exits 77.
 *
 * `--print-counts` prints the live scan as JSON (used to regenerate
 * per_file_statement_counts when a writer is deliberately added).
 *
 * No em-dashes (hyphens only). CJS.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const REPO_ROOT = path.resolve(__dirname, '..');
const INVENTORY = path.join(__dirname, 'fixtures', '369', 'writer-inventory.json');

const REQUIRED_ROW_KEYS = ['id', 'class', 'file', 'function', 'statement_lines', 'tx_owner', 'exercise', 'how'];
const EXERCISES = ['call', 'script', 'python', 'migration', 'room-removal', 'external-note'];
const REQUIRED_IDS = [
  'N1', 'N2', 'N3', 'N4', 'N5',
  'U1', 'U2', 'U3', 'U4', 'U5', 'U6', 'U7', 'U8', 'U9',
  'E1', 'E2', 'E3', 'E4', 'E5', 'E6',
  'D1', 'D2', 'D3', 'D4',
  'P1', 'R1', 'M1', 'X1',
];

// ---------------------------------------------------------------------------
// The live scan. Wide regex (catches INSERT OR IGNORE / INSERT OR REPLACE,
// which scripts/check-substrate.cjs RE_RAW_WRITE misses), applied to the whole
// file content so a statement split across lines still counts. Pure comment
// lines are not statements. Known non-write literals (inventory
// `non_write_hits`) are subtracted by file plus text needle.
// ---------------------------------------------------------------------------
const SCAN_RE = /(INSERT( OR [A-Z]+)? INTO|UPDATE|DELETE FROM|REPLACE INTO)\s+"?(nodes|edges)\b/gi;
const SCAN_EXT = new Set(['.cjs', '.js', '.mjs', '.ts', '.py', '.sh']);

function walk(dirRel, out) {
  const abs = path.join(REPO_ROOT, dirRel);
  let entries;
  try { entries = fs.readdirSync(abs, { withFileTypes: true }); } catch (_e) { return; }
  for (const e of entries) {
    const rel = dirRel + '/' + e.name;
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === 'tests') continue;
      if (rel === 'lib/core/migrations') continue;
      walk(rel, out);
    } else if (SCAN_EXT.has(path.extname(e.name))) {
      // Test files are not production writers: *.test.* and test-*.
      if (/\.test\.(cjs|js|mjs|ts)$/.test(e.name) || /^test-/.test(e.name)) continue;
      out.push(rel);
    }
  }
}

function scanWriters(nonWrite) {
  const files = [];
  for (const root of ['lib', 'scripts', 'bin', 'hooks']) walk(root, files);
  const counts = {};
  for (const rel of files) {
    const src = fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');
    const lines = src.split('\n');
    SCAN_RE.lastIndex = 0;
    let m;
    while ((m = SCAN_RE.exec(src)) !== null) {
      const ln = src.slice(0, m.index).split('\n').length;
      const text = lines[ln - 1];
      if (/^\s*(\/\/|\*|\/\*|#)/.test(text)) continue;
      const skip = (nonWrite || []).some((n) => n.file === rel && text.indexOf(n.needle) !== -1);
      if (skip) continue;
      counts[rel] = (counts[rel] || 0) + 1;
    }
  }
  return counts;
}

let passed = 0;
let failed = 0;
async function test(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log('  ok ' + name);
  } catch (err) {
    if (err && err.skip === true) throw err;
    failed += 1;
    console.log('  FAIL ' + name);
    console.log('    ' + (err && err.message ? err.message : String(err)));
  }
}

function parseToolJson(result) {
  const text = result && result.content && result.content[0] && result.content[0].text;
  assert.ok(typeof text === 'string' && text.length > 0, 'tool call must return text content');
  const marker = text.indexOf('\n\n## Suggested Next');
  return JSON.parse(marker === -1 ? text : text.slice(0, marker));
}

function nodeColumns(dbPath) {
  const db = new DatabaseSync(dbPath, { readOnly: true });
  try {
    return db.prepare('PRAGMA table_info(nodes)').all().map((c) => c.name);
  } finally {
    db.close();
  }
}

const EXPECTED_COLUMNS = { wide: 16, mid: 12, legacy: 3 };

async function main() {
  if (process.argv.includes('--print-counts')) {
    const inv = JSON.parse(fs.readFileSync(INVENTORY, 'utf8'));
    console.log(JSON.stringify(scanWriters(inv.non_write_hits), null, 2));
    return;
  }

  // Hermetic, as the house rule: never touch a real room or session.
  delete process.env.CLAUDE_ACTIVE_ROOM;
  delete process.env.CLAUDE_CODE_SESSION_ID;

  console.log('writer inventory');
  let inv = null;
  await test('inventory parses; rows carry every required key; ids unique and complete', () => {
    inv = JSON.parse(fs.readFileSync(INVENTORY, 'utf8'));
    for (const k of ['generated_from', 'scan_regex', 'scan_roots', 'scan_excludes', 'rows', 'per_file_statement_counts', 'excluded_tables']) {
      assert.ok(k in inv, 'inventory missing key ' + k);
    }
    const ids = new Set();
    for (const r of inv.rows) {
      for (const k of REQUIRED_ROW_KEYS) assert.ok(k in r, 'row ' + r.id + ' missing key ' + k);
      assert.ok(!ids.has(r.id), 'duplicate row id ' + r.id);
      ids.add(r.id);
      assert.ok(EXERCISES.includes(r.exercise), 'row ' + r.id + ' has unknown exercise ' + r.exercise);
      assert.ok(Array.isArray(r.statement_lines), 'row ' + r.id + ' statement_lines must be an array');
      assert.ok(typeof r.how === 'string' && r.how.length > 0, 'row ' + r.id + ' needs a how');
    }
    for (const id of REQUIRED_IDS) assert.ok(ids.has(id), 'inventory missing required row ' + id);
  });

  await test('per-file counts equal a live scan now, and every counted file is covered by a row', () => {
    assert.ok(inv, 'inventory did not load');
    const live = scanWriters(inv.non_write_hits);
    const recorded = inv.per_file_statement_counts;
    const drift = [];
    for (const f of new Set([...Object.keys(live), ...Object.keys(recorded)])) {
      if ((live[f] || 0) !== (recorded[f] || 0)) {
        drift.push(f + ' (inventory ' + (recorded[f] || 0) + ', live scan ' + (live[f] || 0) + ')');
      }
    }
    assert.deepEqual(
      drift,
      [],
      'writer inventory drifted from the live scan; a writer was added or removed, update the inventory deliberately: ' + drift.join('; ')
    );
    const covered = new Set(inv.rows.map((r) => r.file));
    for (const f of Object.keys(live)) {
      assert.ok(covered.has(f), 'file with a scan hit is covered by no inventory row: ' + f);
    }
  });

  console.log('fixture rooms');
  const { buildRoom369, SCHEMA_VARIANTS } = require('./helpers/fixture-room-369.cjs');
  const { openRoomDb, closeRoomDb } = require('../lib/core/room-db.cjs');
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'test-369-infra-'));

  try {
    for (const variant of SCHEMA_VARIANTS) {
      await test('buildRoom369 ' + variant + ': raw nodes table has ' + EXPECTED_COLUMNS[variant] + ' columns', () => {
        const room = buildRoom369({ tmpDir: path.join(tmpRoot, 'raw-' + variant), slug: 'r-' + variant, variant, migrate: false });
        assert.ok(fs.existsSync(room.dbPath), 'room.db must exist at ' + room.dbPath);
        assert.equal(nodeColumns(room.dbPath).length, EXPECTED_COLUMNS[variant]);
      });
      await test('buildRoom369 ' + variant + ': migrate:true leaves a room.db the write door accepts twice', () => {
        const room = buildRoom369({ tmpDir: path.join(tmpRoot, 'mig-' + variant), slug: 'm-' + variant, variant, migrate: true });
        const cols = nodeColumns(room.dbPath);
        assert.ok(cols.includes('source_path'), 'a migrated nodes table carries source_path, got ' + cols.join(','));
        const db = openRoomDb(room.roomDir);
        closeRoomDb(db);
        const db2 = openRoomDb(room.roomDir);
        closeRoomDb(db2);
      });
    }
  } finally {
    try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  }

  console.log('live daemon');
  const { startDaemon, stopDaemon, legacyClient } = require('./helpers/mcp-daemon-369.cjs');
  let handle = null;
  let client = null;
  try {
    try {
      handle = await startDaemon({ rooms: [{ slug: 'room-x', variant: 'wide', migrate: true }] });
    } catch (err) {
      const msg = String(err && err.message ? err.message : err);
      if (/EPERM|EACCES|EADDRINUSE|bind/i.test(msg)) {
        console.log('SKIPPED (ENV GAP): the OS refused the loopback bind: ' + msg.slice(0, 200));
        process.exit(77);
      }
      throw err;
    }
    await test('legacyClient connects and room_bind on room-x answers effective:true', async () => {
      client = await legacyClient(handle.port, 'test-369-infra');
      const bind = parseToolJson(await client.client.callTool({ name: 'room_bind', arguments: { room: 'room-x' } }));
      assert.equal(bind.ok, true, 'room_bind ok: ' + JSON.stringify(bind));
      assert.equal(bind.effective, true, 'room_bind must read back effective: ' + JSON.stringify(bind));
    });
  } catch (err) {
    failed += 1;
    console.log('  FAIL harness: ' + (err && err.message ? err.message : String(err)));
  } finally {
    if (client) await client.close();
    if (handle) await stopDaemon(handle);
  }

  console.log('');
  console.log('RESULT: PASS=' + passed + ' FAIL=' + failed);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
