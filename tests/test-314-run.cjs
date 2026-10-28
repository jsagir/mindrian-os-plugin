#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 314-02 Task 2 -- the bounded portfolio run (lib/core/eureka/portfolio-run.cjs).
 * Legs R1 to R13. Hermetic: temp HOME, USERPROFILE and MINDRIAN_ROOMS_HOME, the
 * deterministic stub encoder injected through the encodeFn seam, no network.
 * Run with: NODE_OPTIONS="--require ./tests/eureka-offline-preload.cjs" node tests/test-314-run.cjs
 */

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// Isolation FIRST, before any repo module loads.
const SANDBOX = fs.mkdtempSync(path.join(os.tmpdir(), 't314-run-home-'));
process.env.HOME = path.join(SANDBOX, 'home');
process.env.USERPROFILE = path.join(SANDBOX, 'home');
process.env.MINDRIAN_ROOMS_HOME = path.join(SANDBOX, 'rooms');
process.env.UV_OFFLINE = '1';
fs.mkdirSync(process.env.HOME, { recursive: true });
fs.mkdirSync(process.env.MINDRIAN_ROOMS_HOME, { recursive: true });
delete process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.CLAUDE_CODE_SESSION_ID;

const REPO = path.resolve(__dirname, '..');
const RUN_PATH = path.join(REPO, 'lib', 'core', 'eureka', 'portfolio-run.cjs');

const { openRoomDb, closeRoomDb } = require(path.join(REPO, 'lib/core/room-db.cjs'));
const navigation = require(path.join(REPO, 'lib/core/navigation.cjs'));
const { insertNode } = require(path.join(REPO, 'lib/core/node-insert.cjs'));
const snap = require(path.join(REPO, 'lib/core/eureka/portfolio-snapshot.cjs'));
const roomReport = require(path.join(REPO, 'scripts/eureka-room-report.cjs'));

const SECTIONS = ['competitive-analysis', 'technology-stack', 'market-analysis'];
const ADJ = ['Vantorix', 'Cryogenic', 'Maglev', 'Thermex', 'Orthodox', 'Solaris', 'Kelvin', 'Aurora', 'Basalt', 'Cobalt', 'Delta', 'Ember'];
const NOUN = ['Pump Array', 'Load Lock', 'Freight Market', 'Rail Group', 'Component Supplier', 'Heat Exchanger'];
const TYPES = ['company', 'technology', 'market'];
const NOW = function () { return new Date('2026-10-28T10:00:00.000Z'); };

let passed = 0;
let failed = 0;
const tempDirs = [];

function tmp() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 't314-run-'));
  tempDirs.push(d);
  return d;
}

function must(r, what) {
  if (!r || r.ok !== true) throw new Error('fixture: ' + what + ' failed: ' + JSON.stringify(r));
  return r;
}

/**
 * 36 entity things (12 per section) with typed edges between some of them.
 * opts.edges false -> the things keep only their DESCRIBES link to a section hub
 * (the hub is structural and drops out, so no pair remains).
 * opts.scaffold true -> one Artifact thing with a scaffold basename, linked to
 * two entities (candidate-exclusion must drop it).
 */
function buildRoom(opts) {
  const o = opts || {};
  const root = tmp();
  const roomDir = path.join(root, 'room');
  fs.mkdirSync(roomDir, { recursive: true });
  fs.writeFileSync(path.join(roomDir, 'ROOM.md'), '# Fixture 314\n');
  SECTIONS.forEach(function (s) {
    fs.mkdirSync(path.join(roomDir, s), { recursive: true });
    fs.writeFileSync(path.join(roomDir, s, 'ROOM.md'), '# ' + s + '\n');
  });
  const db = openRoomDb(roomDir, { allowExtension: true });
  const ids = { hubs: {}, entities: [], scaffold: null };
  try {
    SECTIONS.forEach(function (s) {
      const hub = must(navigation.writeMemoryArtifactNode(db, { section: s, kind: 'ROOM', path: s + '/ROOM.md', hash: '' }), 'hub ' + s);
      ids.hubs[s] = hub.node_id;
    });
    let n = 0;
    for (let si = 0; si < SECTIONS.length; si += 1) {
      for (let k = 0; k < 12; k += 1) {
        const name = ADJ[k] + ' ' + NOUN[(k + si) % NOUN.length] + ' ' + (si + 1);
        const r = must(navigation.writeEntityNode(db, { entityType: TYPES[n % 3], name: name, sessionId: 'fixture-314' }), 'entity ' + name);
        ids.entities.push({ id: r.node_id, name: name, section: SECTIONS[si] });
        must(navigation.writeEdge(db, {
          source_id: r.node_id, target_id: ids.hubs[SECTIONS[si]], edge_type: 'DESCRIBES',
          properties: { relation: 'describes', entity_node: r.node_id },
        }), 'describes ' + name);
        n += 1;
      }
    }
    if (o.edges !== false) {
      const seen = new Set();
      const total = ids.entities.length;
      for (let i = 0; i < total; i += 1) {
        const j = (i * 7 + 3) % total;
        if (i === j) continue;
        const key = i < j ? i + ':' + j : j + ':' + i;
        if (seen.has(key)) continue;
        seen.add(key);
        must(navigation.writeEdge(db, {
          source_id: ids.entities[i].id, target_id: ids.entities[j].id, edge_type: 'RELATED_TO',
          properties: { relation: 'related_to' },
        }), 'related ' + key);
      }
      ids.edgePairs = seen.size;
    }
    if (o.scaffold === true) {
      const sid = 'artifact:scaffold-ctx';
      insertNode(db, sid, 'Artifact', JSON.stringify({ title: 'Process contract', path: 'market-analysis/CONTEXT.md', section: 'market-analysis' }),
        { source_path: 'market-analysis/CONTEXT.md', epistemic_type: 'observation' });
      ids.scaffold = sid;
      must(navigation.writeEdge(db, { source_id: sid, target_id: ids.entities[0].id, edge_type: 'RELATED_TO', properties: { relation: 'related_to' } }), 'scaffold edge 1');
      must(navigation.writeEdge(db, { source_id: sid, target_id: ids.entities[13].id, edge_type: 'RELATED_TO', properties: { relation: 'related_to' } }), 'scaffold edge 2');
    }
  } finally {
    closeRoomDb(db);
  }
  return { roomDir: roomDir, ids: ids };
}

function rowCounts(roomDir) {
  const db = openRoomDb(roomDir, { allowExtension: true });
  try {
    const out = {
      nodes: db.prepare('SELECT COUNT(*) AS c FROM nodes').get().c,
      edges: db.prepare('SELECT COUNT(*) AS c FROM edges').get().c,
      memory_nodes: db.prepare("SELECT COUNT(*) AS c FROM nodes WHERE type = 'memory_event'").get().c,
    };
    try { out.memory_event = db.prepare('SELECT COUNT(*) AS c FROM memory_event').get().c; } catch (_e) { out.memory_event = null; }
    return out;
  } finally {
    closeRoomDb(db);
  }
}

function allKeys(v, acc) {
  const out = acc || [];
  if (Array.isArray(v)) { v.forEach(function (x) { allKeys(x, out); }); return out; }
  if (v && typeof v === 'object') {
    Object.keys(v).forEach(function (k) { out.push(k); allKeys(v[k], out); });
  }
  return out;
}

function pairKey(a, b) { return a < b ? a + '|' + b : b + '|' + a; }

async function leg(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log('  PASS ' + name);
  } catch (e) {
    failed += 1;
    console.log('  FAIL ' + name + ' :: ' + (e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e));
  }
}

function load() {
  return require(RUN_PATH);
}

function opts(roomDir, extra) {
  return Object.assign({ roomDir: roomDir, encodeFn: roomReport.stubEncode, now: NOW }, extra || {});
}

(async function main() {
  const run = load().runPortfolio;
  assert.strictEqual(typeof run, 'function', 'runPortfolio is exported');

  await leg('R1 fixture room run is ok and the snapshot passes the closed schema', async function () {
    const room = buildRoom({});
    const r = await run(opts(room.roomDir));
    assert.strictEqual(r.status, 'ok', JSON.stringify(r).slice(0, 300));
    assert.strictEqual(snap.validateSnapshot(r.snapshot), true, 'validateSnapshot');
    assert.strictEqual(r.snapshot.encoder_kind, 'stub');
    assert.strictEqual(r.snapshot.scope, 'room');
    assert.strictEqual(r.snapshot.scope_id, 'room');
    assert.ok(r.snapshot.pairs.length > 0, 'some pairs scored');
    assert.strictEqual(r.snapshot.pairs[0].rank, 1);
    assert.ok(Array.isArray(r.display.rows) && r.display.rows.length > 0);
    assert.strictEqual(typeof r.display.labelOf, 'function');
    assert.strictEqual(r.snapshot.provenance.run_mode, 'offline-stub');
    assert.strictEqual(r.snapshot.provenance.pairs_scored, r.snapshot.pairs.length);
    assert.strictEqual(r.snapshot.ran_at, '2026-10-28T10:00:00.000Z');
  });

  await leg('R2 things with no edges degrade to no_pairs and never fall back to all pairs', async function () {
    const room = buildRoom({ edges: false });
    const r = await run(opts(room.roomDir));
    assert.strictEqual(r.status, 'degraded');
    assert.strictEqual(r.reason, 'no_pairs');
    assert.strictEqual(r.degrade, 'qualitative-only');
    assert.ok(r.qualitative && r.qualitative.counts, 'qualitative block');
    assert.strictEqual(r.snapshot, undefined, 'no snapshot on a degrade');
  });

  await leg('R3 pairs never exceed the typed-edge pairs among kept things', async function () {
    const room = buildRoom({});
    const r = await run(opts(room.roomDir));
    assert.strictEqual(r.status, 'ok');
    assert.ok(r.snapshot.pairs.length <= room.ids.edgePairs, 'pairs ' + r.snapshot.pairs.length + ' <= edges ' + room.ids.edgePairs);
    // Every pair is a typed-edge pair: build the allowed key set from the db.
    const db = openRoomDb(room.roomDir, { allowExtension: true });
    let allowed;
    try {
      allowed = new Set(db.prepare('SELECT source, target FROM edges').all().map(function (e) { return pairKey(e.source, e.target); }));
    } finally { closeRoomDb(db); }
    r.snapshot.pairs.forEach(function (p) {
      assert.ok(allowed.has(pairKey(p.a, p.b)), 'pair ' + p.a + ' ' + p.b + ' is a typed edge');
    });
    // 36 things would give 630 all-pairs; the run must be far below that.
    assert.ok(r.snapshot.pairs.length < 100);
  });

  await leg('R4 a named section limits the run and hides the readable name', async function () {
    const room = buildRoom({});
    const all = await run(opts(room.roomDir));
    const sec = 'technology-stack';
    const r = await run(opts(room.roomDir, { section: sec }));
    assert.strictEqual(r.status, 'ok', JSON.stringify(r).slice(0, 300));
    assert.strictEqual(r.snapshot.scope, 'subset');
    assert.strictEqual(r.snapshot.scope_id, snap.scopeId(sec));
    assert.ok(r.snapshot.pairs.length <= all.snapshot.pairs.length);
    const inSection = new Set(room.ids.entities.filter(function (e) { return e.section === sec; }).map(function (e) { return e.id; }));
    assert.ok(r.snapshot.pairs.length > 0, 'the section keeps some pairs');
    r.snapshot.pairs.forEach(function (p) {
      assert.ok(inSection.has(p.a) && inSection.has(p.b), 'both ends inside the section');
    });
    assert.strictEqual(r.snapshot.provenance.section_scoped, true);
    assert.ok(JSON.stringify(r.snapshot).indexOf(sec) === -1, 'readable section name absent from the snapshot');
    assert.strictEqual(all.snapshot.scope, 'room');
    assert.strictEqual(all.snapshot.scope_id, 'room');
    assert.strictEqual(all.snapshot.provenance.section_scoped, false);
    const bad = await run(opts(room.roomDir, { section: '../x' }));
    assert.strictEqual(bad.status, 'error');
    assert.strictEqual(bad.reason, 'bad_section');
    const bad2 = await run(opts(room.roomDir, { section: 'A/B' }));
    assert.strictEqual(bad2.reason, 'bad_section');
  });

  await leg('R5 an unavailable encoder degrades with no number anywhere', async function () {
    const room = buildRoom({});
    const r = await run(opts(room.roomDir, { forceUnavailable: true }));
    assert.strictEqual(r.status, 'degraded');
    assert.strictEqual(r.reason, 'encoder_unavailable');
    assert.strictEqual(r.degrade, 'qualitative-only');
    const q = r.qualitative;
    assert.ok(q && Array.isArray(q.most_connected) && q.most_connected.length > 0 && q.most_connected.length <= 10);
    q.most_connected.forEach(function (m) {
      assert.strictEqual(typeof m.label, 'string');
      assert.ok(Number.isInteger(m.connections) && m.connections >= 1);
    });
    assert.ok(q.tail && typeof q.tail === 'object', 'tail block present');
    const bad = allKeys(r).filter(function (k) { return /score|band|fitness/i.test(k); });
    assert.deepStrictEqual(bad, [], 'no score, band or fitness key: ' + bad.join(','));
    assert.strictEqual(r.snapshot, undefined);
  });

  await leg('R6 an inconsistent AHP matrix is an error, not a skewed ranking', async function () {
    const room = buildRoom({});
    const dir = tmp();
    const cfg = path.join(dir, 'bad-matrix.json');
    fs.writeFileSync(cfg, JSON.stringify({
      criteria: ['strategic_fit', 'validated_demand', 'tech_econ_feasibility'],
      matrix: [[1, 9, 1 / 9], [1 / 9, 1, 9], [9, 1 / 9, 1]],
    }));
    const r = await run(opts(room.roomDir, { ahpConfigPath: cfg }));
    assert.strictEqual(r.status, 'error');
    assert.strictEqual(r.reason, 'ahp_inconsistent');
    assert.strictEqual(r.snapshot, undefined);
  });

  await leg('R7 two runs on an unchanged room are identical', async function () {
    const room = buildRoom({});
    const a = await run(opts(room.roomDir));
    const b = await run(opts(room.roomDir));
    assert.strictEqual(a.status, 'ok');
    assert.strictEqual(b.status, 'ok');
    assert.deepStrictEqual(a.snapshot.pairs, b.snapshot.pairs);
    assert.deepStrictEqual(a.snapshot.tail, b.snapshot.tail);
    assert.deepStrictEqual(a.snapshot.labels, b.snapshot.labels);
  });

  await leg('R8 maxPairs keeps the first pairs by sorted key and says so', async function () {
    const room = buildRoom({});
    const full = await run(opts(room.roomDir));
    assert.ok(full.snapshot.pairs.length > 5);
    assert.strictEqual(full.snapshot.provenance.pairs_capped, false);
    const r = await run(opts(room.roomDir, { maxPairs: 5 }));
    assert.strictEqual(r.status, 'ok');
    assert.strictEqual(r.snapshot.pairs.length, 5);
    assert.strictEqual(r.snapshot.provenance.pairs_capped, true);
    const keys = full.snapshot.pairs.map(function (p) { return pairKey(p.a, p.b); }).sort();
    const want = keys.slice(0, 5);
    const got = r.snapshot.pairs.map(function (p) { return pairKey(p.a, p.b); }).sort();
    assert.deepStrictEqual(got, want);
    const again = await run(opts(room.roomDir, { maxPairs: 5 }));
    assert.deepStrictEqual(again.snapshot.pairs, r.snapshot.pairs);
  });

  await leg('R9 a structural thing never appears as a pair end and is counted', async function () {
    const room = buildRoom({ scaffold: true });
    const r = await run(opts(room.roomDir));
    assert.strictEqual(r.status, 'ok');
    const ends = new Set();
    r.snapshot.pairs.forEach(function (p) { ends.add(p.a); ends.add(p.b); });
    assert.ok(!ends.has(room.ids.scaffold), 'scaffold thing not a pair end');
    Object.keys(room.ids.hubs).forEach(function (s) { assert.ok(!ends.has(room.ids.hubs[s]), 'hub not a pair end'); });
    // 3 section hubs plus the seeded scaffold basename thing.
    assert.strictEqual(r.snapshot.provenance.structural_excluded, 4);
    const plain = await run(opts(buildRoom({}).roomDir));
    assert.strictEqual(plain.snapshot.provenance.structural_excluded, 3);
  });

  await leg('R10 the run changes no node, edge or memory event', async function () {
    const room = buildRoom({});
    const before = rowCounts(room.roomDir);
    const r = await run(opts(room.roomDir));
    assert.strictEqual(r.status, 'ok');
    const after = rowCounts(room.roomDir);
    assert.deepStrictEqual(after, before);
    const r2 = await run(opts(room.roomDir, { forceUnavailable: true }));
    assert.strictEqual(r2.status, 'degraded');
    assert.deepStrictEqual(rowCounts(room.roomDir), before);
  });

  await leg('R11 the module source has no network require and no Brain client', async function () {
    const src = fs.readFileSync(RUN_PATH, 'utf8');
    const lines = src.split('\n').filter(function (l) { return !/^\s*(\/\/|\*|\/\*)/.test(l); });
    const code = lines.join('\n');
    assert.ok(!/http/i.test(code), 'no http on a code line');
    assert.ok(!/brain-client|mindrian-brain|\bfetch\s*\(|node:net|node:dns|child_process/.test(code), 'no network or process module');
    assert.ok(!new RegExp(String.fromCharCode(0x2014) + '|' + String.fromCharCode(0x2013)).test(src), 'no em-dash or en-dash');
    assert.ok(!/portfolio-report/.test(code), 'no name of the retired runner');
    assert.ok(src.split('\n').length >= 250, 'module is at least 250 lines');
  });

  await leg('R12 labelOf maps run handles to labels and the stored snapshot holds no function', async function () {
    const room = buildRoom({});
    const r = await run(opts(room.roomDir));
    assert.strictEqual(r.status, 'ok');
    const first = r.snapshot.pairs[0];
    const names = room.ids.entities.reduce(function (m, e) { m[e.id] = e.name; return m; }, {});
    const la = r.display.labelOf(first.a);
    assert.strictEqual(la, names[first.a].slice(0, 80));
    assert.ok(la.length > 0 && la.length <= 80);
    assert.strictEqual(r.display.labelOf('no-such-handle'), '');
    assert.strictEqual(r.display.labelOf(''), '');
    assert.strictEqual(r.display.labelOf(undefined), '');
    const text = JSON.stringify(r.snapshot);
    assert.ok(text.indexOf('labelOf') === -1 && text.indexOf('function') === -1);
    assert.strictEqual(typeof r.snapshot.labels, 'object');
    Object.keys(r.snapshot.labels).forEach(function (h) { assert.ok(r.snapshot.labels[h].length <= 80); });
    // display rows carry labels for their ends
    const row = r.display.rows[0];
    assert.strictEqual(row.a_label, r.display.labelOf(row.a));
    assert.strictEqual(row.b_label, r.display.labelOf(row.b));
    assert.strictEqual(row.rank, 1);
    assert.ok(typeof row.score === 'number' && typeof row.band === 'string');
    assert.ok(row.dims && typeof row.dims.strategic_fit === 'number');
  });

  await leg('R13 a node id outside the handle pattern gets a stable opaque handle', async function () {
    const hf = load()._test.handleFor;
    assert.strictEqual(hf('entity:s:abc123'), 'entity:s:abc123');
    const h = hf('pd/P1 with space');
    assert.ok(snap.HANDLE_RE.test(h) && h.indexOf('h_') === 0, h);
    assert.strictEqual(hf('pd/P1 with space'), h);
    assert.notStrictEqual(hf('pd/P2 with space'), h);
    assert.ok(hf('x'.repeat(300)).length <= 128);
  });

  tempDirs.forEach(function (d) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_e) { /* ignore */ } });
  try { fs.rmSync(SANDBOX, { recursive: true, force: true }); } catch (_e) { /* ignore */ }
  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
})().catch(function (e) {
  console.log('FATAL ' + (e && e.stack ? e.stack : e));
  process.exit(1);
});
