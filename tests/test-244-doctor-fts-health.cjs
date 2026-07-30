'use strict';
/*
 * tests/test-244-doctor-fts-health.cjs -- Phase 244 Plan 06 Task 3.
 *
 * Fences every line of Task 1's <behavior> block against a temp registry with
 * four rooms (no room.db, room.db with no eureka_fts, a built and current
 * index, a deliberately stale index), plus the acceptance point added in
 * Task 2. Hermeticity is the first-class concern of this file (Phase 240's
 * MEM-03 rationale): MINDRIAN_ROOMS_HOME is pointed at an fs.mkdtempSync dir
 * for the WHOLE run, restored in a finally, and the module's output is
 * additionally scanned for the real ~/MindrianRooms path so the env var alone
 * is never the only fence.
 *
 * The stale fixture inserts an eureka_fts row whose node_id has no matching
 * nodes.id -- the SAME construction tests/test-244-fts-index-lifecycle.cjs
 * uses (Plan 02), so the two fences agree on what "stale" means.
 *
 * The acceptance point (Task 2) is driven by spawning
 * `node scripts/doctor.cjs --acceptance --pre-tag --json` with the standard
 * DOCTOR_TEST_MODE=1 env seams: scripts/doctor.cjs does not export
 * buildAcceptanceChecklist, so a spawn is the smallest supported entry point
 * (mirrors tests/test-doctor-acceptance.cjs's own runDoctorAcceptance shape).
 *
 * No em-dashes anywhere (CLAUDE.md hard rule).
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const DOCTOR = path.join(REPO, 'scripts', 'doctor.cjs');
const HEALTH_MODULE_PATH = path.join(REPO, 'lib', 'core', 'doctor', 'eureka-fts-health-module.cjs');

const tri = require(path.join(REPO, 'lib', 'core', 'eureka', 'tri-modal-index.cjs'));
const healthMod = require(HEALTH_MODULE_PATH);

let PASS = 0;
let FAIL = 0;
const FAILURES = [];

async function test(name, fn) {
  try {
    await fn();
    PASS += 1;
    console.log('  PASS: ' + name);
  } catch (err) {
    FAIL += 1;
    FAILURES.push({ name: name, err: err });
    console.log('  FAIL: ' + name + ' -- ' + (err && err.message));
  }
}

// ---------- Deterministic stub encoder (offline, no model) ----------
// Copied verbatim in shape from tests/test-244-fts-index-lifecycle.cjs:55-66
// / tests/test-219-fts5-degrade.cjs:69-80.
function stubEncode(texts) {
  return texts.map(function (t) {
    const v = new Array(16).fill(0);
    const s = String(t);
    for (let i = 0; i < s.length; i += 1) {
      v[s.charCodeAt(i) % 16] += 1;
    }
    let norm = Math.sqrt(v.reduce(function (a, x) { return a + x * x; }, 0));
    if (norm === 0) norm = 1;
    return v.map(function (x) { return x / norm; });
  });
}

// ---------- Sandbox helpers ----------

const REAL_ROOMS_HOME = path.join(os.homedir(), 'MindrianRooms');

function makeScratchDir(suffix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mos-244-06-' + suffix + '-'));
}

function rmrf(p) {
  try { fs.rmSync(p, { recursive: true, force: true }); } catch (_e) { /* best-effort */ }
}

function roomDbPath(roomDir) {
  return path.join(roomDir, '.mindrian', 'room.db');
}

// A room with a `nodes` table and NO eureka_fts (Task 1's "room.db exists,
// index never built" scenario).
function seedNodesOnly(roomDir, nodeCount) {
  fs.mkdirSync(path.join(roomDir, '.mindrian'), { recursive: true });
  const db = new DatabaseSync(roomDbPath(roomDir));
  db.exec('CREATE TABLE nodes (id TEXT PRIMARY KEY, type TEXT, properties TEXT)');
  const ins = db.prepare('INSERT INTO nodes(id, type, properties) VALUES (?, ?, ?)');
  for (let i = 0; i < nodeCount; i += 1) {
    ins.run('n' + i, 'claim', JSON.stringify({ text: 'fixture text number ' + i + ' about the reverse salient' }));
  }
  db.close();
}

// A room with nodes AND a real, CURRENT eureka_fts index (via the real
// openIndex + indexNodes, never a hand-rolled shortcut).
async function seedBuiltIndex(roomDir, nodeCount) {
  fs.mkdirSync(path.join(roomDir, '.mindrian'), { recursive: true });
  const db = new DatabaseSync(roomDbPath(roomDir));
  db.exec('CREATE TABLE nodes (id TEXT PRIMARY KEY, type TEXT, properties TEXT)');
  const ins = db.prepare('INSERT INTO nodes(id, type, properties) VALUES (?, ?, ?)');
  for (let i = 0; i < nodeCount; i += 1) {
    ins.run('n' + i, 'claim', JSON.stringify({ text: 'fixture text number ' + i + ' about opportunity bank reasoning' }));
  }
  await tri.indexNodes(db, { encodeFn: stubEncode });
  db.close();
}

// A room with a real, current index PLUS a ghost orphan row (node_id with no
// matching nodes.id) -- the same construction Plan 02's own lifecycle test
// uses, so the two fences agree on what "stale" means.
async function seedStaleIndex(roomDir, nodeCount) {
  fs.mkdirSync(path.join(roomDir, '.mindrian'), { recursive: true });
  const db = new DatabaseSync(roomDbPath(roomDir));
  db.exec('CREATE TABLE nodes (id TEXT PRIMARY KEY, type TEXT, properties TEXT)');
  const ins = db.prepare('INSERT INTO nodes(id, type, properties) VALUES (?, ?, ?)');
  for (let i = 0; i < nodeCount; i += 1) {
    ins.run('n' + i, 'claim', JSON.stringify({ text: 'fixture text number ' + i + ' about the graph derivation pipeline' }));
  }
  await tri.indexNodes(db, { encodeFn: stubEncode });
  db.exec("INSERT INTO eureka_fts(node_id, text) VALUES ('ghost-node-244-06', 'ghost orphan text')");
  db.close();
}

function makeRegistry(scratch, roomNames) {
  const registryDir = path.join(scratch, '.rooms');
  fs.mkdirSync(registryDir, { recursive: true });
  const registry = { active: roomNames[0] || null, rooms: {} };
  for (const name of roomNames) {
    registry.rooms[name] = { path: name };
  }
  fs.writeFileSync(path.join(registryDir, 'registry.json'), JSON.stringify(registry, null, 2));
}

function writeRegistry(scratch, registry) {
  fs.writeFileSync(path.join(scratch, '.rooms', 'registry.json'), JSON.stringify(registry, null, 2));
}

// Independent-means hermeticity fence #2: the real ~/MindrianRooms path must
// never appear ANYWHERE in the module's output, not just "the env var was
// set" (fence #1).
function assertNoRealRoomsHomeLeak(value, label) {
  const s = JSON.stringify(value);
  assert.equal(s.includes(REAL_ROOMS_HOME), false,
    label + ': the real ~/MindrianRooms path must never appear in module output; got: ' + s.slice(0, 300));
}

// ---------- Acceptance-point driver ----------
// buildAcceptanceChecklist is NOT exported from scripts/doctor.cjs, so a spawn
// with the standard test-mode env seams is the smallest supported entry point
// (mirrors tests/test-doctor-acceptance.cjs's runDoctorAcceptance shape).

function makeScratchPluginHome(scratch) {
  const version = JSON.parse(
    fs.readFileSync(path.join(REPO, '.claude-plugin', 'plugin.json'), 'utf8')
  ).version;
  const home = path.join(scratch, '.scratch-home');
  const stamp = JSON.stringify({ name: 'mindrian-os', version: version });
  const installDir = path.join(home, '.claude', 'plugins', 'mindrian-os', '.claude-plugin');
  const cacheDir = path.join(
    home, '.claude', 'plugins', 'cache', 'mindrian-marketplace', 'mos', version, '.claude-plugin'
  );
  fs.mkdirSync(installDir, { recursive: true });
  fs.mkdirSync(cacheDir, { recursive: true });
  fs.writeFileSync(path.join(installDir, 'plugin.json'), stamp);
  fs.writeFileSync(path.join(cacheDir, 'plugin.json'), stamp);
  return home;
}

function runAcceptance(roomsHomeScratch, extraEnv) {
  const home = makeScratchPluginHome(roomsHomeScratch);
  const env = Object.assign({}, process.env, {
    MINDRIAN_ROOMS_HOME: roomsHomeScratch,
    HOME: home,
    USERPROFILE: home,
    MINDRIAN_PLUGIN_HOME: path.join(home, '.claude', 'plugins'),
    DOCTOR_TEST_MODE: '1',
  }, extraEnv || {});
  const r = spawnSync('node', [DOCTOR, '--acceptance', '--pre-tag', '--json'], {
    env: env, encoding: 'utf8', timeout: 60000,
  });
  let json = null;
  if (r.stdout) {
    const start = r.stdout.indexOf('{');
    if (start !== -1) {
      try { json = JSON.parse(r.stdout.slice(start)); } catch (_e) { /* leave null */ }
    }
  }
  return { r: r, json: json };
}

function findPoint(json, id) {
  const pts = (json && json.points) || [];
  return pts.find(function (p) { return p.id === id; });
}

// ---------- Main ----------

async function main() {
  console.log('Phase 244-06 doctor fts-health tests');

  const SAVED_ROOMS_HOME = process.env.MINDRIAN_ROOMS_HOME;
  let scratch4 = null;
  let sweep = null;

  try {
    // ===== The four-room sweep (Task 1's full <behavior> block) =====
    scratch4 = makeScratchDir('four-room');
    process.env.MINDRIAN_ROOMS_HOME = scratch4;

    makeRegistry(scratch4, ['cold-room', 'no-index-room', 'built-room', 'stale-room']);
    // cold-room: intentionally NO room.db at all -- the normal Tier 0 case.
    seedNodesOnly(path.join(scratch4, 'no-index-room'), 3);
    await seedBuiltIndex(path.join(scratch4, 'built-room'), 3);
    await seedStaleIndex(path.join(scratch4, 'stale-room'), 3);

    await test('four-room sweep: status is warn and each room classifies correctly', function () {
      sweep = healthMod.check({});
      assert.equal(sweep.status, 'warn', 'status must be warn when a stale room is present');

      const byName = {};
      for (const r of sweep.rooms) byName[r.room] = r;

      assert.equal(byName['cold-room'].has_db, false, 'cold-room: has_db must be false');
      assert.equal(byName['cold-room'].state, 'index_absent', 'cold-room: state must be index_absent');

      assert.equal(byName['no-index-room'].has_db, true, 'no-index-room: has_db must be true');
      assert.equal(byName['no-index-room'].state, 'index_absent',
        'no-index-room: state must be index_absent (room.db exists, eureka_fts never built)');

      assert.equal(byName['built-room'].has_db, true, 'built-room: has_db must be true');
      assert.equal(byName['built-room'].state, 'ok', 'built-room: state must be ok');
      assert.ok(byName['built-room'].fts_rows > 0, 'built-room: fts_rows must be > 0');
      assert.equal(byName['built-room'].orphan_rows, 0, 'built-room: orphan_rows must be 0');

      assert.equal(byName['stale-room'].has_db, true, 'stale-room: has_db must be true');
      assert.equal(byName['stale-room'].state, 'index_stale', 'stale-room: state must be index_stale');
      assert.ok(byName['stale-room'].orphan_rows > 0, 'stale-room: orphan_rows must be > 0');

      assert.deepEqual(
        sweep.totals,
        { rooms: 4, with_index: 1, absent: 2, empty: 0, stale: 1 },
        'totals must tally all four rooms correctly; got ' + JSON.stringify(sweep.totals)
      );

      assertNoRealRoomsHomeLeak(sweep, 'four-room sweep');
    });

    await test('four-room sweep: the stale room is named specifically in detail', function () {
      assert.ok(sweep.detail.includes('stale-room'),
        'detail must name the stale room; got: ' + sweep.detail);
    });

    // ===== Removing the stale room flips status to ok (attributable warn) =====
    await test('removing the stale room from the registry flips status to ok', function () {
      makeRegistry(scratch4, ['cold-room', 'no-index-room', 'built-room']);
      const noStale = healthMod.check({});
      assert.equal(noStale.status, 'ok', 'status must flip to ok once the stale room is removed from the registry');
      // Restore the four-room registry for the tests that follow.
      makeRegistry(scratch4, ['cold-room', 'no-index-room', 'built-room', 'stale-room']);
    });

    // ===== Hermeticity, re-asserted by independent means (fence #2) =====
    await test('hermeticity: the sweep never touches the real ~/MindrianRooms', function () {
      assert.equal(process.env.MINDRIAN_ROOMS_HOME, scratch4,
        'precondition: MINDRIAN_ROOMS_HOME must be the scratch dir');
      const r = healthMod.check({});
      assertNoRealRoomsHomeLeak(r, 'hermeticity check');
    });

    // ===== The read-only proof, re-asserted here as a PERMANENT fence =====
    //
    // Uses a DEDICATED scratch room + registry, seeded and swept for the
    // FIRST time inside this one test only. A room already opened by an
    // earlier scenario in this file would already carry the writable door's
    // full migrated schema (the CREATE-TABLE-IF-NOT-EXISTS migration clauses
    // are idempotent, so re-running them a second time changes nothing),
    // which would make a wrong-door mutation invisible to a before/after
    // diff taken AFTER that first open already happened. Isolating the
    // fixture is what makes this fence a real regression pin (mutation-
    // verified below: this exact isolation is what MUTATION PROOF 2 depends
    // on to fail red).
    await test('permanent fence: check() never mutates sqlite_master, mtime or size of any room it opens', function () {
      const fenceScratch = makeScratchDir('fence');
      const savedHome = process.env.MINDRIAN_ROOMS_HOME;
      try {
        makeRegistry(fenceScratch, ['fence-room']);
        seedNodesOnly(path.join(fenceScratch, 'fence-room'), 2);
        process.env.MINDRIAN_ROOMS_HOME = fenceScratch;

        const dbPath = roomDbPath(path.join(fenceScratch, 'fence-room'));
        function snapshotOf() {
          const db = new DatabaseSync('file:' + dbPath + '?mode=ro');
          const tables = db.prepare('SELECT name, sql FROM sqlite_master ORDER BY name').all();
          db.close();
          const stat = fs.statSync(dbPath);
          return { tables: tables, mtimeMs: stat.mtimeMs, size: stat.size };
        }
        const before = snapshotOf();
        healthMod.check({});
        const after = snapshotOf();
        assert.deepEqual(before.tables, after.tables,
          'sqlite_master (name, sql) must be byte-identical before and after check()');
        assert.equal(before.mtimeMs, after.mtimeMs, 'room.db mtimeMs must be unchanged by check()');
        assert.equal(before.size, after.size, 'room.db size must be unchanged by check()');
      } finally {
        process.env.MINDRIAN_ROOMS_HOME = savedHome;
        rmrf(fenceScratch);
      }
    });

    // ===== T-244-24 / T-217-01 self-DoS guard: a malformed entry soft-fails
    // that ONE room only; the sweep completes. =====
    await test('a malformed registry entry soft-fails that one room; the sweep completes', function () {
      writeRegistry(scratch4, {
        active: 'built-room',
        rooms: {
          'built-room': { path: 'built-room' },
          'corrupt-room': { path: 5 }, // path.isAbsolute(5) throws
        },
      });
      const r = healthMod.check({});
      const byName = {};
      for (const x of r.rooms) byName[x.room] = x;
      assert.equal(byName['corrupt-room'].unreadable, true, 'corrupt-room must be marked unreadable');
      assert.equal(byName['built-room'].state, 'ok', 'built-room counts must be unaffected by the corrupt sibling entry');
      // Restore the four-room registry.
      makeRegistry(scratch4, ['cold-room', 'no-index-room', 'built-room', 'stale-room']);
    });

    // ===== No registry -> status skip =====
    await test('no registry -> status skip', function () {
      const emptyScratch = makeScratchDir('no-registry');
      const savedHome = process.env.MINDRIAN_ROOMS_HOME;
      process.env.MINDRIAN_ROOMS_HOME = emptyScratch;
      try {
        const r = healthMod.check({});
        assert.equal(r.status, 'skip', 'status must be skip when no registry exists');
      } finally {
        process.env.MINDRIAN_ROOMS_HOME = savedHome;
        rmrf(emptyScratch);
      }
    });
  } finally {
    if (scratch4) rmrf(scratch4);
    if (SAVED_ROOMS_HOME === undefined) delete process.env.MINDRIAN_ROOMS_HOME;
    else process.env.MINDRIAN_ROOMS_HOME = SAVED_ROOMS_HOME;
  }

  // ===== The acceptance point (Task 2) =====
  let scratchAbsent = null;
  let scratchStale = null;
  try {
    scratchAbsent = makeScratchDir('acc-absent');
    makeRegistry(scratchAbsent, ['abs-room']);

    await test('acceptance point: ok:true with a populated detail census when the only finding is absence', function () {
      const { json } = runAcceptance(scratchAbsent);
      assert.ok(json, 'JSON output must parse');
      const p = findPoint(json, 'eureka-fts-index-visible');
      assert.ok(p, 'eureka-fts-index-visible must be present in points[]');
      assert.equal(p.ok, true, 'must pass when every room is absent; got finding=' + p.finding);
      assert.ok(p.detail && p.detail.totals, 'detail must carry the per-room totals census on the passing path');
      assert.equal(p.detail.totals.absent, 1, 'detail totals must report the one absent room');
    });

    scratchStale = makeScratchDir('acc-stale');
    makeRegistry(scratchStale, ['fine-room', 'broken-room']);
    await seedBuiltIndex(path.join(scratchStale, 'fine-room'), 2);
    await seedStaleIndex(path.join(scratchStale, 'broken-room'), 2);

    await test('acceptance point: ok:false naming the first stale room', function () {
      const { json } = runAcceptance(scratchStale);
      assert.ok(json, 'JSON output must parse');
      const p = findPoint(json, 'eureka-fts-index-visible');
      assert.ok(p, 'eureka-fts-index-visible must be present in points[]');
      assert.equal(p.ok, false, 'must fail when a stale room is present');
      assert.ok(p.finding && p.finding.includes('broken-room'),
        'finding must name the stale room specifically; got: ' + p.finding);
    });

    await test('DOCTOR_TEST_FAIL_POINT=eureka-fts-index-visible synthesizes a failure', function () {
      const { json } = runAcceptance(scratchAbsent, { DOCTOR_TEST_FAIL_POINT: 'eureka-fts-index-visible' });
      assert.ok(json, 'JSON output must parse');
      const p = findPoint(json, 'eureka-fts-index-visible');
      assert.ok(p, 'point must be present');
      assert.equal(p.ok, false, 'synthesized failure must report ok:false');
      assert.match(p.finding || '', /synthesized failure/, 'finding must name the synthesized failure');
    });

    await test('DOCTOR_SKIP_EUREKA_FTS_HEALTH=1 reports ok:true with detail.skipped', function () {
      const { json } = runAcceptance(scratchStale, { DOCTOR_SKIP_EUREKA_FTS_HEALTH: '1' });
      assert.ok(json, 'JSON output must parse');
      const p = findPoint(json, 'eureka-fts-index-visible');
      assert.ok(p, 'point must be present');
      assert.equal(p.ok, true, 'DOCTOR_SKIP_EUREKA_FTS_HEALTH=1 must report ok:true even with a stale room present');
      assert.equal(p.detail && p.detail.skipped, true, 'detail.skipped must be true');
    });
  } finally {
    if (scratchAbsent) rmrf(scratchAbsent);
    if (scratchStale) rmrf(scratchStale);
  }

  console.log('');
  console.log('Phase 244-06 doctor-fts-health: PASS=' + PASS + ' FAIL=' + FAIL);
  process.exit(FAIL === 0 ? 0 : 1);
}

main();
