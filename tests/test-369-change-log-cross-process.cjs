#!/usr/bin/env node
'use strict';

/**
 * Phase 369-12 (CHG369-05, D-18) -- the change log captures writes made by
 * OTHER processes: a second Node process, the SessionStart hook script (U9),
 * the two bulk edge scripts (E5, E6) and the Python engine (P1), plus the
 * whole-room removal shape (R1).
 *
 * Why this is a test and not a claim: capture lives in six triggers at the
 * table (plan 05). Triggers cover a foreign writer only if the trigger bodies
 * actually run on that writer's SQLite build. Arm 4 prints python3's own
 * sqlite3.sqlite_version and proves the rows appear.
 *
 * Every arm uses a fresh migrated `wide` fixture room and one long-lived
 * read-only handle in THIS process (openRoomDbReadOnlyForCaller) on which it
 * reads PRAGMA data_version and the max change_seq before and after the child.
 *
 * Arms print PASS, FAIL or SKIP. Exit 1 on any FAIL, 77 if any arm SKIPped
 * (python3 absent), else 0.
 *
 * Canon Part 9: tests/ is allow-listed for raw SQL by the substrate guard;
 * every write under test goes through the real writers in child processes.
 * Canon Part 8: no network, no Brain. Children run with a hermetic HOME and
 * rooms home only; a post-run check proves ~/MindrianRooms and ~/.mindrian
 * were not touched. No em-dashes or en-dashes anywhere (CJS).
 */

const os = require('node:os');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');

// Capture the REAL home BEFORE the hermetic override, for the post-run check.
const REAL_HOME = os.homedir();
const START_MS = Date.now();

const HERMETIC = fs.mkdtempSync(path.join(os.tmpdir(), 'test-369-chg-xproc-'));
const ROOMS_HOME = path.join(HERMETIC, 'rooms');
fs.mkdirSync(ROOMS_HOME, { recursive: true });
process.env.HOME = HERMETIC;
process.env.USERPROFILE = HERMETIC;
process.env.MINDRIAN_ROOMS_HOME = ROOMS_HOME;
delete process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.CLAUDE_CODE_SESSION_ID;
delete process.env.MINDRIAN_ACTIVE_ROOM_DIR;

const REPO = path.resolve(__dirname, '..');
const navigation = require(path.join(REPO, 'lib', 'core', 'navigation.cjs'));
const { openRoomDb, closeRoomDb } = require(path.join(REPO, 'lib', 'core', 'room-db.cjs'));
const { buildRoom369 } = require('./helpers/fixture-room-369.cjs');

const SEP = String.fromCharCode(31);

let passed = 0;
let failed = 0;
let skipped = 0;
let roomCounter = 0;

function pass(name, extra) {
  passed += 1;
  process.stdout.write('PASS ' + name + (extra ? '  ' + extra : '') + '\n');
}
function fail(name, err) {
  failed += 1;
  process.stdout.write('FAIL ' + name + '\n');
  if (err) process.stdout.write('  ' + String(err.stack || err.message || err).split('\n').join('\n  ') + '\n');
}
function skip(name, why) {
  skipped += 1;
  process.stdout.write('SKIP ' + name + '  (' + why + ')\n');
}

function childEnv(extra) {
  const env = Object.assign({}, process.env, {
    HOME: HERMETIC,
    USERPROFILE: HERMETIC,
    MINDRIAN_ROOMS_HOME: ROOMS_HOME,
  }, extra || {});
  delete env.CLAUDE_ACTIVE_ROOM;
  delete env.CLAUDE_CODE_SESSION_ID;
  return env;
}

function freshRoom() {
  roomCounter += 1;
  return buildRoom369({
    tmpDir: path.join(HERMETIC, 'build', 'r' + roomCounter),
    slug: 'r' + roomCounter,
    variant: 'wide',
    migrate: true,
  });
}

function dataVersion(ro) {
  return Number(ro.prepare('PRAGMA data_version').get().data_version);
}
function maxSeq(ro) {
  return Number(ro.prepare('SELECT COALESCE(MAX(change_seq), 0) AS m FROM room_change_log').get().m);
}
function rowsAfter(ro, seq) {
  return ro.prepare('SELECT * FROM room_change_log WHERE change_seq > ? ORDER BY change_seq').all(seq);
}
function has(rows, entityType, operation, idPart) {
  return rows.some((r) => r.entity_type === entityType && r.operation === operation &&
    (idPart === undefined || String(r.entity_id).includes(idPart)));
}

/** Open the long-lived observer, run mutate(), return what the observer saw. */
function observe(room, mutate) {
  const ro = navigation.openRoomDbReadOnlyForCaller(room.roomDir);
  assert.ok(ro, 'observer could not open the room read-only');
  try {
    const dvBefore = dataVersion(ro);
    const seqBefore = maxSeq(ro);
    mutate();
    const dvAfter = dataVersion(ro);
    const rows = rowsAfter(ro, seqBefore);
    return { dvBefore, dvAfter, seqBefore, rows };
  } finally {
    try { ro.close(); } catch (_e) { /* ignore */ }
  }
}

function run(cmd, args, opts) {
  const o = opts || {};
  const res = spawnSync(cmd, args, {
    cwd: o.cwd || REPO,
    env: childEnv(o.env),
    input: o.input,
    encoding: 'utf8',
    timeout: o.timeout || 120000,
  });
  if (res.error) throw res.error;
  return res;
}

function writeFile(file, body) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, body);
}

const LONG_BODY_A = 'Alpha explores the market structure and pricing pressure across early adopter segments in depth.';
const LONG_BODY_B = 'Beta covers the delivery pipeline, staffing constraints and the operational bottlenecks that follow.';

// --- arm 1: a second Node process through the write door --------------------
function arm1() {
  const name = '1. second Node process (openRoomDb + insertNode) is captured';
  try {
    const room = freshRoom();
    const code =
      "const {openRoomDb,closeRoomDb}=require(" + JSON.stringify(path.join(REPO, 'lib', 'core', 'room-db.cjs')) + ");" +
      "const {insertNode}=require(" + JSON.stringify(path.join(REPO, 'lib', 'core', 'node-insert.cjs')) + ");" +
      "const db=openRoomDb(" + JSON.stringify(room.roomDir) + ");" +
      "insertNode(db,'claim:child-369','claim',JSON.stringify({text:'from another process'}),{epistemic_type:'observation'});" +
      "closeRoomDb(db);";
    let res;
    const seen = observe(room, () => { res = run(process.execPath, ['-e', code]); });
    assert.equal(res.status, 0, 'child exited ' + res.status + ': ' + res.stderr);
    assert.notEqual(seen.dvAfter, seen.dvBefore, 'data_version did not change');
    const nodeRows = seen.rows.filter((r) => r.entity_type === 'node' && r.entity_id === 'claim:child-369');
    assert.equal(nodeRows.length, 1, 'expected exactly one node row, got ' + nodeRows.length);
    assert.equal(nodeRows[0].operation, 'upsert');
    pass(name, 'data_version changed (' + seen.dvBefore + ' -> ' + seen.dvAfter + '), new seq ' + nodeRows[0].change_seq);
    process.stdout.write('     data_version changed\n');
  } catch (e) { fail(name, e); }
}

// --- arm 2: U9 SessionStart hook script -------------------------------------
function arm2() {
  const name = '2. U9 hook script check-pending-ambiguous.cjs update is captured';
  try {
    const room = freshRoom();
    // Seed one ambiguous, still-proposed claim through the write door, then set
    // the review state with a raw handle (tests/ may). Seeding is complete
    // before the observer baseline is taken.
    const db = openRoomDb(room.roomDir);
    try {
      const { insertNode } = require(path.join(REPO, 'lib', 'core', 'node-insert.cjs'));
      insertNode(db, 'claim:ambiguous-369', 'claim',
        JSON.stringify({ text: 'ambiguous segment', disambiguation: 'ambiguous', surfacing_count: 0 }),
        { epistemic_type: 'observation' });
      db.prepare("UPDATE nodes SET review_status = 'proposed' WHERE id = ?").run('claim:ambiguous-369');
    } finally { closeRoomDb(db); }

    let res;
    const seen = observe(room, () => {
      res = run(process.execPath, [path.join(REPO, 'scripts', 'check-pending-ambiguous.cjs')], {
        env: { MINDRIAN_ACTIVE_ROOM_DIR: room.roomDir },
        input: JSON.stringify({ hook_event_name: 'SessionStart', source: 'startup', session_id: 'xproc-369' }),
      });
    });
    assert.equal(res.status, 0, 'hook exited ' + res.status + ': ' + res.stderr);
    assert.match(res.stdout, /"continue":true/, 'hook did not answer continue: ' + res.stdout);
    assert.notEqual(seen.dvAfter, seen.dvBefore, 'data_version did not change');
    assert.ok(has(seen.rows, 'node', 'upsert', 'claim:ambiguous-369'), 'hook UPDATE was not logged: ' + JSON.stringify(seen.rows));
    pass(name, seen.rows.length + ' log row(s)');
  } catch (e) { fail(name, e); }
}

// --- arm 3: E5 and E6 bulk edge scripts -------------------------------------
function arm3() {
  const name = '3. E5 build-ecosystem-graph and E6 hsi-to-graph are captured (edge upsert and delete)';
  try {
    // E5: two artifacts in one section with a wikilink; run twice so the second
    // run's indexer-owned wipe logs delete rows.
    const e5 = freshRoom();
    writeFile(path.join(e5.roomDir, 'market', 'alpha.md'), '# Alpha\n\n' + LONG_BODY_A + '\n\nSee [[market/beta]].\n');
    writeFile(path.join(e5.roomDir, 'market', 'beta.md'), '# Beta\n\n' + LONG_BODY_B + '\n');
    let r1;
    let r2;
    const seen5 = observe(e5, () => {
      r1 = run(process.execPath, [path.join(REPO, 'scripts', 'build-ecosystem-graph.cjs'), e5.roomDir]);
      r2 = run(process.execPath, [path.join(REPO, 'scripts', 'build-ecosystem-graph.cjs'), e5.roomDir]);
    });
    assert.equal(r1.status, 0, 'E5 run 1: ' + r1.stderr + r1.stdout);
    assert.equal(r2.status, 0, 'E5 run 2: ' + r2.stderr + r2.stdout);
    assert.notEqual(seen5.dvAfter, seen5.dvBefore, 'E5 data_version did not change');
    assert.ok(has(seen5.rows, 'edge', 'upsert', 'BELONGS_TO'), 'E5 BELONGS_TO upsert missing');
    assert.ok(has(seen5.rows, 'edge', 'upsert', 'INFORMS'), 'E5 INFORMS upsert missing');
    assert.ok(has(seen5.rows, 'edge', 'delete', 'BELONGS_TO'), 'E5 BELONGS_TO delete missing (second run wipe)');
    assert.ok(has(seen5.rows, 'node', 'upsert', 'market/alpha'), 'E5 artifact node upsert missing');

    // E6: .hsi-results.json with one reverse salient; second run deletes the
    // first run's REVERSE_SALIENT edge before rewriting it (hsi-to-graph 197-198).
    const e6 = freshRoom();
    writeFile(path.join(e6.roomDir, '.hsi-results.json'), JSON.stringify({
      metadata: { tier: 1 },
      hsi_pairs: [],
      reverse_salients: [{
        source_section: 'market',
        target_section: 'team',
        differential_score: 0.5,
        innovation_type: 'structural_transfer',
        source_artifact: 'market/alpha',
        target_artifact: 'team/beta',
        innovation_thesis: 'fixture thesis',
      }],
    }));
    let h1;
    let h2;
    const seen6 = observe(e6, () => {
      h1 = run(process.execPath, [path.join(REPO, 'scripts', 'hsi-to-graph.cjs'), e6.roomDir]);
      h2 = run(process.execPath, [path.join(REPO, 'scripts', 'hsi-to-graph.cjs'), e6.roomDir]);
    });
    assert.equal(h1.status, 0, 'E6 run 1: ' + h1.stderr);
    assert.equal(h2.status, 0, 'E6 run 2: ' + h2.stderr);
    assert.notEqual(seen6.dvAfter, seen6.dvBefore, 'E6 data_version did not change');
    assert.ok(has(seen6.rows, 'edge', 'upsert', 'REVERSE_SALIENT'), 'E6 REVERSE_SALIENT upsert missing');
    assert.ok(has(seen6.rows, 'edge', 'delete', 'REVERSE_SALIENT'), 'E6 REVERSE_SALIENT delete missing');
    assert.ok(has(seen6.rows, 'node', 'upsert', 'market'), 'E6 Section node upsert missing');
    pass(name, 'E5 ' + seen5.rows.length + ' rows, E6 ' + seen6.rows.length + ' rows');
  } catch (e) { fail(name, e); }
}

// --- arm 4: P1 Python writer -------------------------------------------------
const PY_SEED_CACHE = [
  'import importlib.util, sys',
  'from pathlib import Path',
  'spec = importlib.util.spec_from_file_location("rs_engine", sys.argv[1])',
  'm = importlib.util.module_from_spec(spec)',
  'spec.loader.exec_module(m)',
  'room = Path(sys.argv[2])',
  'arts = m.discover_artifacts(room)',
  'cache = {}',
  'for i, a in enumerate(arts):',
  '    vec = [0.0] * 8',
  '    vec[0] = 1.0',
  '    vec[1 + (i % 7)] = 0.5',
  '    cache[a["id"]] = {"hash": m._content_hash(a["text"]), "model": "all-MiniLM-L6-v2", "vector": vec}',
  'm._save_embedding_cache(room, cache, "all-MiniLM-L6-v2")',
  'print(len(arts))',
].join('\n');

function arm4() {
  const name = '4. P1 Python writer scripts/rs-engine.py is captured on the interpreter\'s own SQLite';
  const probe = spawnSync('python3', ['-c', 'import sqlite3,sys;print(sqlite3.sqlite_version)'], { encoding: 'utf8', env: childEnv() });
  if (probe.error || probe.status !== 0) { skip(name, 'python3 not available'); return; }
  const pyVersion = probe.stdout.trim();
  process.stdout.write('     python3 sqlite3.sqlite_version = ' + pyVersion + '\n');
  // The hermetic HOME hides the user site-packages where numpy lives, and the
  // engine would otherwise try to pip install it. Point PYTHONPATH at the REAL
  // user site (read-only use), and SKIP, never auto-install, if the engine's
  // imports still do not resolve.
  const realSite = spawnSync('python3', ['-c', 'import site;print(site.getusersitepackages())'], {
    encoding: 'utf8', env: Object.assign({}, process.env, { HOME: REAL_HOME, USERPROFILE: REAL_HOME }),
  });
  const pyPath = realSite.status === 0 ? realSite.stdout.trim() : '';
  const depEnv = pyPath ? { PYTHONPATH: pyPath } : {};
  const deps = spawnSync('python3', ['-c', 'import numpy, requests, sklearn'], { encoding: 'utf8', env: childEnv(depEnv) });
  if (deps.status !== 0) { skip(name, 'numpy/requests/scikit-learn not importable (ENV GAP)'); return; }
  try {
    const room = freshRoom();
    writeFile(path.join(room.roomDir, 'market', 'alpha.md'), '# Alpha\n\n' + LONG_BODY_A + '\n');
    writeFile(path.join(room.roomDir, 'team', 'beta.md'), '# Beta\n\n' + LONG_BODY_B + '\n');
    const engine = path.join(REPO, 'scripts', 'rs-engine.py');

    // Hermetic embeddings: seed the engine's own cache through its own helpers
    // so no model download or network is needed (Canon Part 8).
    const seed = spawnSync('python3', ['-c', PY_SEED_CACHE, engine, room.roomDir], {
      cwd: REPO, env: childEnv(Object.assign({ RS_EMBEDDING_MODEL: 'minilm' }, depEnv)), encoding: 'utf8', timeout: 120000,
    });
    assert.equal(seed.status, 0, 'cache seed failed: ' + seed.stderr);
    assert.equal(seed.stdout.trim(), '2', 'expected two discovered artifacts, got ' + seed.stdout);

    const args = [engine, '--mode', 'internal', '--room', room.roomDir, '--topk', '10', '--threshold', '0.0', '--no-thesis'];
    const pyEnv = Object.assign({ RS_EMBEDDING_MODEL: 'minilm', HF_HUB_OFFLINE: '1', TRANSFORMERS_OFFLINE: '1' }, depEnv);
    let p1;
    let p2;
    const seen = observe(room, () => {
      p1 = run('python3', args, { env: pyEnv });
      p2 = run('python3', args, { env: pyEnv });
    });
    assert.equal(p1.status, 0, 'rs-engine run 1: ' + p1.stderr);
    assert.equal(p2.status, 0, 'rs-engine run 2: ' + p2.stderr);
    assert.notEqual(seen.dvAfter, seen.dvBefore, 'data_version did not change');
    assert.ok(has(seen.rows, 'node', 'upsert', 'market/alpha'), 'P1 node upsert (460/477) missing: ' + JSON.stringify(seen.rows));
    assert.ok(has(seen.rows, 'node', 'upsert', 'team/beta'), 'P1 second node upsert missing');
    assert.ok(has(seen.rows, 'edge', 'upsert', 'REVERSE_SALIENT'), 'P1 edge upsert (539) missing');
    assert.ok(has(seen.rows, 'edge', 'delete', 'REVERSE_SALIENT'), 'P1 edge delete (534) missing after the second run');
    pass(name, 'python sqlite ' + pyVersion + ', ' + seen.rows.length + ' log rows');
  } catch (e) { fail(name, e); }
}

// --- arm 5: R1 whole-room removal --------------------------------------------
function arm5() {
  const name = '5. R1 room-discard-cascade leaves no database for the read door (room_unavailable shape)';
  try {
    const slug = 'untitled-2026-10-03-1200';
    const built = buildRoom369({
      tmpDir: path.join(HERMETIC, 'build', 'r1-discard'),
      slug,
      variant: 'wide',
      migrate: true,
    });
    const roomDir = path.join(ROOMS_HOME, slug);
    fs.renameSync(built.roomDir, roomDir);
    const room = { roomDir };

    const ro = navigation.openRoomDbReadOnlyForCaller(roomDir);
    assert.ok(ro, 'observer could not open the room before discard');
    const seqBefore = maxSeq(ro);

    const { discardPlaceholderRoom } = require(path.join(REPO, 'lib', 'core', 'room-discard-cascade.cjs'));
    const result = discardPlaceholderRoom(ROOMS_HOME, slug, { decided_by: 'xproc-369' });
    assert.equal(result.ok, true, 'cascade did not complete: ' + JSON.stringify(result));
    try { ro.close(); } catch (_e) { /* ignore */ }

    assert.equal(fs.existsSync(roomDir), false, 'room directory still present');
    assert.equal(navigation.openRoomDbReadOnlyForCaller(roomDir), null, 'read door must return null for a removed room');
    assert.equal(seqBefore >= 0, true);
    pass(name, 'directory gone, openRoomDbReadOnlyForCaller returned null');
    void room;
  } catch (e) { fail(name, e); }
}

// --- post-run hygiene: nothing this test did leaked into the real home --------
// A shared machine runs other Claude sessions whose hooks legitimately rewrite
// files under ~/MindrianRooms during this test, so "any file newer than the
// start" would be flaky. The check is attributable instead: a file under the
// real home that changed during the run FAILS only if its path or (for files
// under 2 MB) its text carries a marker unique to this run's fixtures.
function realHomeLeaks() {
  const markers = [path.basename(HERMETIC), 'xproc-369', 'claim:child-369', 'claim:ambiguous-369', 'untitled-2026-10-03-1200'];
  const leaks = [];
  let changed = 0;
  const roots = [path.join(REAL_HOME, 'MindrianRooms'), path.join(REAL_HOME, '.mindrian')];
  function walk(dir, depth) {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (_e) { return; }
    for (const ent of entries) {
      const p = path.join(dir, ent.name);
      let st;
      try { st = fs.lstatSync(p); } catch (_e) { continue; }
      if (st.mtimeMs > START_MS) {
        changed += 1;
        if (markers.some((m) => p.includes(m))) leaks.push(p);
        else if (st.isFile() && st.size < 2 * 1024 * 1024) {
          try {
            const text = fs.readFileSync(p, 'latin1');
            if (markers.some((m) => text.includes(m))) leaks.push(p);
          } catch (_e) { /* unreadable, skip */ }
        }
      }
      if (ent.isDirectory() && depth < 3) walk(p, depth + 1);
    }
  }
  for (const r of roots) walk(r, 1);
  return { leaks, changed };
}

arm1();
arm2();
arm3();
arm4();
arm5();

(function hygiene() {
  const name = '6. nothing from this run reached ~/MindrianRooms or ~/.mindrian';
  const r = realHomeLeaks();
  if (r.leaks.length === 0) pass(name, r.changed + ' unrelated change(s) by other sessions ignored');
  else fail(name, new Error('fixture markers found in: ' + r.leaks.slice(0, 10).join(', ')));
})();

try { fs.rmSync(HERMETIC, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
void SEP;

process.stdout.write('\nPASS=' + passed + ' FAIL=' + failed + ' SKIP=' + skipped + '\n');
if (failed > 0) process.exit(1);
if (skipped > 0) process.exit(77);
process.exit(0);
