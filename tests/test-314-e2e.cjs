'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 314-04 Task 2 -- the chain from a run to the sensor and back.
 * Legs E1 to E9. This is the integration seam of plans 314-01, 02, 03 and 04:
 *   run -> store -> diff -> movement file -> SENS-13 (real) -> seen -> silent.
 * Hermetic: temp HOME, USERPROFILE and MINDRIAN_ROOMS_HOME, temp rooms, no
 * network. E1 to E7 and E9 inject the runner with hand-built snapshots so the
 * bands are exact. E8 runs the real runPortfolio once with the stub encoder.
 * No dash characters are typed in this file.
 * Run with: NODE_OPTIONS="--require ./tests/eureka-offline-preload.cjs" node tests/test-314-e2e.cjs
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const SANDBOX = fs.mkdtempSync(path.join(os.tmpdir(), 't314-e2e-home-'));
process.env.HOME = path.join(SANDBOX, 'home');
process.env.USERPROFILE = path.join(SANDBOX, 'home');
process.env.MINDRIAN_ROOMS_HOME = path.join(SANDBOX, 'rooms');
process.env.UV_OFFLINE = '1';
fs.mkdirSync(process.env.HOME, { recursive: true });
fs.mkdirSync(process.env.MINDRIAN_ROOMS_HOME, { recursive: true });
delete process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.CLAUDE_CODE_SESSION_ID;

const REPO = path.resolve(__dirname, '..');
const cli = require(path.join(REPO, 'scripts', 'eureka-portfolio.cjs'));
const store = require(path.join(REPO, 'lib', 'core', 'eureka', 'portfolio-snapshot.cjs'));
const { sensorEureka } = require(path.join(REPO, 'lib', 'core', 'sensors', 'sensor-eureka.cjs'));
const { openRoomDb, closeRoomDb } = require(path.join(REPO, 'lib', 'core', 'room-db.cjs'));
const navigation = require(path.join(REPO, 'lib', 'core', 'navigation.cjs'));

const STORE_REL = path.join('.mindrian', 'eureka-portfolio');
const LABELS = { h1: 'Alpha pump', h2: 'Beta market', h3: 'Gamma rail', h4: 'Delta tank' };

let PASS = 0;
let FAIL = 0;
const tempDirs = [];

async function leg(name, fn) {
  try {
    await fn();
    PASS += 1;
    console.log('ok   ' + name);
  } catch (e) {
    FAIL += 1;
    console.log('FAIL ' + name + ' -- ' + (e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e));
  }
}

function makeRoom() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 't314-e2e-room-'));
  tempDirs.push(dir);
  fs.mkdirSync(path.join(dir, '.mindrian'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.mindrian', 'room.db'), '');
  return dir;
}

/** pairs: [[a, b, band, score], ...] ordered by rank. */
function snapshot(o) {
  const scope = o.scope || 'room';
  return {
    schema_version: 1,
    ran_at: o.ran_at,
    scope: scope === 'room' ? 'room' : 'subset',
    scope_id: scope === 'room' ? 'room' : store.scopeId(scope),
    encoder_kind: o.encoder_kind || 'live',
    provenance: { run_mode: o.encoder_kind === 'stub' ? 'offline-stub' : 'live', encoder_model: 'test-model', pairs_scored: o.pairs.length },
    pairs: o.pairs.map(function (p, i) { return { a: p[0], b: p[1], band: p[2], score: p[3], rank: i + 1 }; }),
    tail: { composition: 'mixed', insufficient_structure: false, suspect_noise: false, items: (o.tail || []).map(function (id) { return { id: id }; }) },
    labels: LABELS
  };
}

function okResult(snap) {
  return {
    status: 'ok',
    snapshot: snap,
    display: {
      rows: snap.pairs.map(function (p) {
        return { rank: p.rank, a: p.a, b: p.b, a_label: LABELS[p.a] || '', b_label: LABELS[p.b] || '', score: p.score, band: p.band,
          dims: { strategic_fit: 0.5, validated_demand: 0.5, tech_econ_feasibility: 0.5 }, weak_a: [], weak_b: [], complementary: false, tail_flag: false };
      }),
      tail: { count: snap.tail.items.length, items: snap.tail.items.map(function (t) { return { id: t.id, label: LABELS[t.id] || '' }; }),
        insufficient_structure: false, suspect_noise: false, composition: 'mixed', growth_proxy: 'x' },
      counts: { things: 4, pairs_scored: snap.pairs.length, pairs_candidates: snap.pairs.length, structural_excluded: 0 },
      labelOf: function (h) { return Object.prototype.hasOwnProperty.call(LABELS, h) ? LABELS[h] : ''; }
    }
  };
}

/** One CLI call, in process. at = the clock the CLI sees. */
async function call(argv, extra) {
  const out = [];
  const deps = Object.assign({ out: function (s) { out.push(String(s)); } }, extra || {});
  const code = await cli.main(argv, deps);
  const raw = out.join('');
  let json = null;
  try { json = JSON.parse(raw); } catch (_e) { json = null; }
  return { code: code, json: json, raw: raw };
}

function runWith(room, snap, at, extraArgs) {
  return call(['run', '--room', room].concat(extraArgs || []), {
    runPortfolio: async function () { return okResult(snap); },
    now: function () { return new Date(at); }
  });
}

function fire(room) {
  return sensorEureka({}, {}, { roomDir: room });
}

function files(room) {
  const dir = path.join(room, STORE_REL);
  const acc = [];
  (function walk(d, rel) {
    let names = [];
    try { names = fs.readdirSync(d).sort(); } catch (_e) { return; }
    names.forEach(function (n) {
      const full = path.join(d, n);
      if (fs.statSync(full).isDirectory()) walk(full, rel + n + '/');
      else acc.push(rel + n + ':' + fs.readFileSync(full, 'utf8'));
    });
  })(dir, '');
  return acc;
}

function hasMovementFile(room, sid) {
  return fs.existsSync(path.join(room, STORE_REL, 'movement-' + sid + '.json'));
}

const BASE_PAIRS = [['h1', 'h2', 'moderate', 0.5], ['h3', 'h4', 'low', 0.2]];
const MOVED_PAIRS = [['h1', 'h2', 'high', 0.8], ['h3', 'h4', 'low', 0.2]];
const MOVED_MORE = [['h1', 'h2', 'high', 0.8], ['h3', 'h4', 'high', 0.7]];

// ---- E8 helper: a small real room ----

function must(r, what) {
  if (!r || r.ok !== true) throw new Error('fixture: ' + what + ' failed: ' + JSON.stringify(r));
  return r;
}

function buildRealRoom() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 't314-e2e-real-'));
  tempDirs.push(root);
  const roomDir = path.join(root, 'room');
  const sections = ['competitive-analysis', 'technology-stack', 'market-analysis'];
  const adj = ['Vantorix', 'Cryogenic', 'Maglev', 'Thermex', 'Orthodox', 'Solaris', 'Kelvin', 'Aurora', 'Basalt', 'Cobalt', 'Delta', 'Ember'];
  const noun = ['Pump Array', 'Load Lock', 'Freight Market', 'Rail Group', 'Component Supplier', 'Heat Exchanger'];
  const types = ['company', 'technology', 'market'];
  fs.mkdirSync(roomDir, { recursive: true });
  fs.writeFileSync(path.join(roomDir, 'ROOM.md'), '# Fixture 314 e2e\n');
  sections.forEach(function (s) {
    fs.mkdirSync(path.join(roomDir, s), { recursive: true });
    fs.writeFileSync(path.join(roomDir, s, 'ROOM.md'), '# ' + s + '\n');
  });
  const db = openRoomDb(roomDir, { allowExtension: true });
  try {
    const hubs = {};
    sections.forEach(function (s) {
      hubs[s] = must(navigation.writeMemoryArtifactNode(db, { section: s, kind: 'ROOM', path: s + '/ROOM.md', hash: '' }), 'hub ' + s).node_id;
    });
    const ents = [];
    let n = 0;
    for (let si = 0; si < sections.length; si += 1) {
      for (let k = 0; k < 12; k += 1) {
        const name = adj[k] + ' ' + noun[(k + si) % noun.length] + ' ' + (si + 1);
        const r = must(navigation.writeEntityNode(db, { entityType: types[n % 3], name: name, sessionId: 'fixture-314-e2e' }), 'entity ' + name);
        ents.push(r.node_id);
        must(navigation.writeEdge(db, { source_id: r.node_id, target_id: hubs[sections[si]], edge_type: 'DESCRIBES', properties: { relation: 'describes', entity_node: r.node_id } }), 'describes ' + name);
        n += 1;
      }
    }
    const seen = new Set();
    for (let i = 0; i < ents.length; i += 1) {
      const j = (i * 7 + 3) % ents.length;
      if (i === j) continue;
      const key = i < j ? i + ':' + j : j + ':' + i;
      if (seen.has(key)) continue;
      seen.add(key);
      must(navigation.writeEdge(db, { source_id: ents[i], target_id: ents[j], edge_type: 'RELATED_TO', properties: { relation: 'related_to' } }), 'related ' + key);
    }
  } finally {
    closeRoomDb(db);
  }
  return roomDir;
}

(async function main() {
  await leg('E1 first run: first_run true, latest saved, no movement file, sensor silent', async function () {
    const room = makeRoom();
    const r = await runWith(room, snapshot({ ran_at: '2026-10-28T10:00:00.000Z', pairs: BASE_PAIRS }), '2026-10-28T10:00:00.000Z');
    assert.equal(r.code, 0);
    assert.equal(r.json.movement.first_run, true);
    assert.equal(r.json.movement.comparable, false);
    assert.ok(fs.existsSync(path.join(room, STORE_REL, 'room', 'latest.json')), 'latest saved');
    assert.equal(hasMovementFile(room, 'room'), false);
    assert.equal(fire(room), null);
  });

  await leg('E2 second run: band cross event, movement file (live), sensor fires', async function () {
    const room = makeRoom();
    await runWith(room, snapshot({ ran_at: '2026-10-28T10:00:00.000Z', pairs: BASE_PAIRS }), '2026-10-28T10:00:00.000Z');
    const r = await runWith(room, snapshot({ ran_at: '2026-10-28T11:00:00.000Z', pairs: MOVED_PAIRS }), '2026-10-28T11:00:00.000Z');
    assert.equal(r.json.store.rotated, true);
    assert.equal(r.json.movement.comparable, true);
    assert.equal(r.json.movement.events.length, 1);
    const ev = r.json.movement.events[0];
    assert.equal(ev.kind, 'band_cross');
    assert.equal(ev.a_label, 'Alpha pump');
    assert.equal(ev.b_label, 'Beta market');
    assert.equal(ev.from_band, 'moderate');
    assert.equal(ev.to_band, 'high');
    const env = store.readMovement(room, 'room');
    assert.ok(env, 'movement file valid');
    assert.equal(env.encoder_kind, 'live');
    const reach = fire(room);
    assert.ok(reach, 'sensor fires');
    assert.equal(reach.signal, 'eureka_portfolio_movement');
    assert.equal(reach.evidence.movement_id, env.movement_id);
  });

  await leg('E3 seen silences the sensor; a further change makes a new id and it fires again', async function () {
    const room = makeRoom();
    await runWith(room, snapshot({ ran_at: '2026-10-28T10:00:00.000Z', pairs: BASE_PAIRS }), '2026-10-28T10:00:00.000Z');
    const r2 = await runWith(room, snapshot({ ran_at: '2026-10-28T11:00:00.000Z', pairs: MOVED_PAIRS }), '2026-10-28T11:00:00.000Z');
    const id2 = r2.json.movement.movement_id;
    assert.ok(fire(room));
    const s = await call(['seen', '--room', room, '--id', id2]);
    assert.equal(s.code, 0);
    assert.equal(fire(room), null, 'silent after seen');
    const r3 = await runWith(room, snapshot({ ran_at: '2026-10-28T12:00:00.000Z', pairs: MOVED_MORE }), '2026-10-28T12:00:00.000Z');
    const id3 = r3.json.movement.movement_id;
    assert.ok(id3 && id3 !== id2, 'a new movement id');
    const reach = fire(room);
    assert.ok(reach, 'fires again');
    assert.equal(reach.evidence.movement_id, id3);
  });

  await leg('E4 movement is kept per scope; an unseen movement is never lost', async function () {
    const room = makeRoom();
    const roomSid = 'room';
    const secSid = store.scopeId('opportunity-bank');
    await runWith(room, snapshot({ ran_at: '2026-10-28T10:00:00.000Z', pairs: BASE_PAIRS }), '2026-10-28T10:00:00.000Z');
    await runWith(room, snapshot({ ran_at: '2026-10-28T11:00:00.000Z', pairs: MOVED_PAIRS }), '2026-10-28T11:00:00.000Z');
    assert.equal(hasMovementFile(room, roomSid), true);
    // First section run has no previous run, so no movement. The room file stays.
    const s1 = await runWith(room, snapshot({ scope: 'opportunity-bank', ran_at: '2026-10-28T11:10:00.000Z', pairs: BASE_PAIRS }), '2026-10-28T11:10:00.000Z', ['--section', 'opportunity-bank']);
    assert.equal(s1.json.movement.first_run, true);
    assert.equal(hasMovementFile(room, roomSid), true, 'room movement survives a section run with no movement');
    assert.ok(fire(room), 'sensor still fires for the room movement');
    // The section gets its own movement.
    await runWith(room, snapshot({ scope: 'opportunity-bank', ran_at: '2026-10-28T11:20:00.000Z', pairs: MOVED_PAIRS }), '2026-10-28T11:20:00.000Z', ['--section', 'opportunity-bank']);
    assert.equal(hasMovementFile(room, secSid), true);
    assert.equal(hasMovementFile(room, roomSid), true);
    // An unchanged room run clears the room file only.
    const r = await runWith(room, snapshot({ ran_at: '2026-10-28T12:00:00.000Z', pairs: MOVED_PAIRS }), '2026-10-28T12:00:00.000Z');
    assert.equal(r.json.movement.events.length, 0);
    assert.equal(hasMovementFile(room, roomSid), false, 'room file cleared');
    assert.equal(hasMovementFile(room, secSid), true, 'section file stays');
    const reach = fire(room);
    assert.ok(reach, 'sensor fires for the section movement');
    assert.equal(reach.evidence.scope, 'subset');
    // Clear the section too: silent.
    await runWith(room, snapshot({ scope: 'opportunity-bank', ran_at: '2026-10-28T12:10:00.000Z', pairs: MOVED_PAIRS }), '2026-10-28T12:10:00.000Z', ['--section', 'opportunity-bank']);
    assert.equal(hasMovementFile(room, secSid), false);
    assert.equal(fire(room), null);
  });

  await leg('E5 stub encoder runs print events and write a stub movement file; the sensor stays silent', async function () {
    const room = makeRoom();
    await runWith(room, snapshot({ encoder_kind: 'stub', ran_at: '2026-10-28T10:00:00.000Z', pairs: BASE_PAIRS }), '2026-10-28T10:00:00.000Z', ['--offline']);
    const r = await runWith(room, snapshot({ encoder_kind: 'stub', ran_at: '2026-10-28T11:00:00.000Z', pairs: MOVED_PAIRS }), '2026-10-28T11:00:00.000Z', ['--offline']);
    assert.equal(r.json.movement.events.length, 1);
    assert.equal(r.json.encoder_kind, 'stub');
    const env = store.readMovement(room, 'room');
    assert.ok(env);
    assert.equal(env.encoder_kind, 'stub');
    assert.equal(fire(room), null);
  });

  await leg('E6 a degraded run between two good runs changes nothing on disk', async function () {
    const room = makeRoom();
    await runWith(room, snapshot({ ran_at: '2026-10-28T10:00:00.000Z', pairs: BASE_PAIRS }), '2026-10-28T10:00:00.000Z');
    await runWith(room, snapshot({ ran_at: '2026-10-28T11:00:00.000Z', pairs: MOVED_PAIRS }), '2026-10-28T11:00:00.000Z');
    const before = files(room);
    const d = await call(['run', '--room', room], {
      runPortfolio: async function () { return { status: 'degraded', degrade: 'qualitative-only', reason: 'no_pairs', qualitative: { counts: {}, most_connected: [], tail: { count: 0, items: [] } } }; },
      now: function () { return new Date('2026-10-28T11:30:00.000Z'); }
    });
    assert.equal(d.json.status, 'degraded');
    assert.deepEqual(files(room), before);
    const e = await call(['run', '--room', room], { runPortfolio: async function () { return { status: 'error', reason: 'room_unreadable' }; } });
    assert.equal(e.code, 1);
    assert.deepEqual(files(room), before);
    assert.ok(fire(room), 'the unseen movement is still offerable');
  });

  await leg('E7 show prints the movement, marks it seen, and the sensor goes silent', async function () {
    const room = makeRoom();
    await runWith(room, snapshot({ ran_at: '2026-10-28T10:00:00.000Z', pairs: BASE_PAIRS }), '2026-10-28T10:00:00.000Z');
    const r2 = await runWith(room, snapshot({ ran_at: '2026-10-28T11:00:00.000Z', pairs: MOVED_PAIRS }), '2026-10-28T11:00:00.000Z');
    assert.ok(fire(room));
    const s = await call(['show', '--room', room]);
    assert.equal(s.code, 0);
    assert.equal(s.json.movement.movement_id, r2.json.movement.movement_id);
    assert.equal(s.json.movement.events[0].a_label, 'Alpha pump');
    assert.equal(s.json.marked_seen, true);
    assert.equal(fire(room), null);
  });

  await leg('E8 the real runPortfolio end to end with the stub encoder: valid snapshot, then zero events', async function () {
    const room = buildRealRoom();
    const at = function () { return new Date('2026-10-28T10:00:00.000Z'); };
    const r1 = await call(['run', '--room', room, '--offline'], { now: at });
    assert.equal(r1.code, 0, r1.raw.slice(0, 300));
    assert.equal(r1.json.status, 'ok', r1.raw.slice(0, 300));
    assert.equal(r1.json.encoder_kind, 'stub');
    assert.ok(r1.json.ranked.length > 0);
    const latest = store.readLatest(room, 'room');
    assert.ok(latest, 'latest passes validateSnapshot on read');
    assert.equal(store.validateSnapshot(latest), true);
    assert.equal(r1.json.movement.first_run, true);
    const later = function () { return new Date('2026-10-28T11:00:00.000Z'); };
    const r2 = await call(['run', '--room', room, '--offline'], { now: later });
    assert.equal(r2.json.status, 'ok');
    assert.equal(r2.json.movement.comparable, true);
    assert.equal(r2.json.movement.events.length, 0, 'noise floor is zero');
    assert.equal(hasMovementFile(room, 'room'), false);
    assert.equal(fire(room), null);
  });

  await leg('E9 two scopes with unseen movement: the sensor offers each in turn', async function () {
    const room = makeRoom();
    const secSid = store.scopeId('opportunity-bank');
    await runWith(room, snapshot({ ran_at: '2026-10-28T10:00:00.000Z', pairs: BASE_PAIRS }), '2026-10-28T10:00:00.000Z');
    const rr = await runWith(room, snapshot({ ran_at: '2026-10-28T11:00:00.000Z', pairs: MOVED_PAIRS }), '2026-10-28T11:00:00.000Z');
    await runWith(room, snapshot({ scope: 'opportunity-bank', ran_at: '2026-10-28T11:10:00.000Z', pairs: BASE_PAIRS }), '2026-10-28T11:10:00.000Z', ['--section', 'opportunity-bank']);
    const rs = await runWith(room, snapshot({ scope: 'opportunity-bank', ran_at: '2026-10-28T11:20:00.000Z', pairs: MOVED_PAIRS }), '2026-10-28T11:20:00.000Z', ['--section', 'opportunity-bank']);
    const roomId = rr.json.movement.movement_id;
    const secId = rs.json.movement.movement_id;
    assert.notEqual(roomId, secId);
    assert.equal(hasMovementFile(room, 'room'), true);
    assert.equal(hasMovementFile(room, secSid), true);
    assert.match(secSid, /^s_[0-9a-f]{8}$/);
    const names = fs.readdirSync(path.join(room, STORE_REL)).filter(function (n) { return n.indexOf('movement-') === 0; });
    assert.equal(names.length, 2, 'two movement files');
    names.forEach(function (n) { assert.ok(n.indexOf('opportunity') === -1, 'no section name in file name ' + n); });
    assert.equal(fire(room).evidence.movement_id, secId, 'the newer one first');
    await call(['seen', '--room', room, '--id', secId]);
    assert.equal(fire(room).evidence.movement_id, roomId, 'then the other');
    await call(['seen', '--room', room, '--id', secId]);
    assert.equal(fire(room).evidence.movement_id, roomId, 'a repeated seen does not un-see the other');
    await call(['seen', '--room', room, '--id', roomId]);
    assert.equal(fire(room), null, 'silent when both are seen');
  });

  tempDirs.forEach(function (d) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_e) { /* ignore */ } });
  try { fs.rmSync(SANDBOX, { recursive: true, force: true }); } catch (_e) { /* ignore */ }
  console.log('\n' + PASS + ' passed, ' + FAIL + ' failed');
  process.exitCode = FAIL === 0 ? 0 : 1;
})();
