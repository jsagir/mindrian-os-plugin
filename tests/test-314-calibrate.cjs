#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 314-07 Task 1 -- the calibration harness (scripts/eureka-portfolio-calibrate.cjs).
 * Legs CL1 to CL8 and CL10. CL9 lives in tests/test-314-calibration-record.cjs.
 * Hermetic: temp HOME, USERPROFILE and MINDRIAN_ROOMS_HOME, the deterministic stub
 * encoder, no network, no real room.
 * Run with: NODE_OPTIONS="--require ./tests/eureka-offline-preload.cjs" node tests/test-314-calibrate.cjs
 */

const assert = require('node:assert');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

// Isolation FIRST, before any repo module loads.
const SANDBOX = fs.mkdtempSync(path.join(os.tmpdir(), 't314-cal-home-'));
process.env.HOME = path.join(SANDBOX, 'home');
process.env.USERPROFILE = path.join(SANDBOX, 'home');
process.env.MINDRIAN_ROOMS_HOME = path.join(SANDBOX, 'rooms');
process.env.UV_OFFLINE = '1';
fs.mkdirSync(process.env.HOME, { recursive: true });
fs.mkdirSync(process.env.MINDRIAN_ROOMS_HOME, { recursive: true });
delete process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.CLAUDE_CODE_SESSION_ID;

const REPO = path.resolve(__dirname, '..');
const SCRIPT = path.join(REPO, 'scripts', 'eureka-portfolio-calibrate.cjs');
const DATA_FILE = path.join(REPO, 'data', 'eureka-portfolio-thresholds.json');

const { openRoomDb, closeRoomDb } = require(path.join(REPO, 'lib/core/room-db.cjs'));
const navigation = require(path.join(REPO, 'lib/core/navigation.cjs'));

const SECTIONS = ['competitive-analysis', 'technology-stack', 'market-analysis'];
const ADJ = ['Vantorix', 'Cryogenic', 'Maglev', 'Thermex', 'Orthodox', 'Solaris', 'Kelvin', 'Aurora', 'Basalt', 'Cobalt', 'Delta', 'Ember'];
const NOUN = ['Pump Array', 'Load Lock', 'Freight Market', 'Rail Group', 'Component Supplier', 'Heat Exchanger'];
const TYPES = ['company', 'technology', 'market'];

let passed = 0;
let failed = 0;
const tempDirs = [];

function tmp() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 't314-cal-'));
  tempDirs.push(d);
  return d;
}

function must(r, what) {
  if (!r || r.ok !== true) throw new Error('fixture: ' + what + ' failed: ' + JSON.stringify(r));
  return r;
}

function sha(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

// A listing hash: every file path and size under the folder, plus the room.db bytes.
function roomFingerprint(roomDir) {
  const lines = [];
  (function walk(d) {
    fs.readdirSync(d, { withFileTypes: true }).sort(function (a, b) { return a.name < b.name ? -1 : 1; }).forEach(function (e) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { walk(p); return; }
      lines.push(path.relative(roomDir, p) + ':' + fs.statSync(p).size);
    });
  })(roomDir);
  const dbFile = path.join(roomDir, '.mindrian', 'room.db');
  return crypto.createHash('sha256').update(lines.join('\n') + '|' + sha(dbFile)).digest('hex');
}

// 36 entity things in 3 sections with typed edges (same shape as the 314-02 fixture).
function buildRoom() {
  const root = tmp();
  const roomDir = path.join(root, 'fixture-room');
  fs.mkdirSync(roomDir, { recursive: true });
  fs.writeFileSync(path.join(roomDir, 'ROOM.md'), '# Fixture 314-07\n');
  SECTIONS.forEach(function (s) {
    fs.mkdirSync(path.join(roomDir, s), { recursive: true });
    fs.writeFileSync(path.join(roomDir, s, 'ROOM.md'), '# ' + s + '\n');
  });
  const db = openRoomDb(roomDir, { allowExtension: true });
  try {
    const hubs = {};
    SECTIONS.forEach(function (s) {
      hubs[s] = must(navigation.writeMemoryArtifactNode(db, { section: s, kind: 'ROOM', path: s + '/ROOM.md', hash: '' }), 'hub ' + s).node_id;
    });
    const ents = [];
    let n = 0;
    for (let si = 0; si < SECTIONS.length; si += 1) {
      for (let k = 0; k < 12; k += 1) {
        const name = ADJ[k] + ' ' + NOUN[(k + si) % NOUN.length] + ' ' + (si + 1);
        const r = must(navigation.writeEntityNode(db, { entityType: TYPES[n % 3], name: name, sessionId: 'fixture-314-07' }), 'entity ' + name);
        ents.push(r.node_id);
        must(navigation.writeEdge(db, {
          source_id: r.node_id, target_id: hubs[SECTIONS[si]], edge_type: 'DESCRIBES',
          properties: { relation: 'describes', entity_node: r.node_id },
        }), 'describes ' + name);
        n += 1;
      }
    }
    const seen = new Set();
    for (let i = 0; i < ents.length; i += 1) {
      for (const j of [(i * 7 + 3) % ents.length, (i * 5 + 11) % ents.length]) {
        if (i === j) continue;
        const key = i < j ? i + ':' + j : j + ':' + i;
        if (seen.has(key)) continue;
        seen.add(key);
        must(navigation.writeEdge(db, { source_id: ents[i], target_id: ents[j], edge_type: 'RELATED_TO', properties: { relation: 'related_to' } }), 'related ' + key);
      }
    }
  } finally {
    closeRoomDb(db);
  }
  return roomDir;
}

// A synthetic table for deriveThresholds. wobble/change are [entered+left, max_shift] per N.
function perN(moved, shift) {
  return { entered: Math.ceil(moved / 2), left: Math.floor(moved / 2), max_shift: shift };
}

function syntheticTable(over) {
  const o = over || {};
  const trials = [];
  [0.01, 0.02, 0.05, 0.10].forEach(function (share) {
    for (let s = 0; s < 4; s += 1) {
      let m5; let m10; let m25; let m50;
      if (share === 0.01) { m5 = perN(s === 0 ? 0 : 1, 1); m10 = perN(s === 0 ? 0 : 1, 1); m25 = perN(2, 2); m50 = perN(4, 3); }
      else if (share === 0.10) { m5 = perN(1, 1); m10 = perN(6 + s, 4); m25 = perN(10, 8); m50 = perN(14, 12); }
      else { m5 = perN(1, 1); m10 = perN(3, 2); m25 = perN(5, 4); m50 = perN(8, 6); }
      trials.push({
        share: share, kind: s === 0 ? 'newest' : 'random', seed: s === 0 ? null : s,
        perN: { '5': m5, '10': m10, '25': m25, '50': m50 }, band_cross: 0, tail_enter: 0,
      });
    }
  });
  return Object.assign({
    run_date: '2026-10-28',
    baseline: {
      encoder_kind: 'live', encoder_model: 'fixture-model', encoder_dtype: 'q8',
      room_id_hash: 'abcdef012345', scope: 'room', node_count: 500, edge_count: 900,
      cohort_techs: 300, pairs_scored: 700, ranked: 700,
    },
    noise: { events: 0 },
    shares: [0.01, 0.02, 0.05, 0.10],
    seeds: [1, 2, 3],
    trials: trials,
    elapsed_seconds: 12,
  }, o);
}

function fileHash(p) { return fs.existsSync(p) ? sha(p) : 'missing'; }

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

(async function main() {
  const dataBefore = fileHash(DATA_FILE);
  const mod = require(SCRIPT);
  assert.strictEqual(typeof mod.deriveThresholds, 'function', 'deriveThresholds exported');
  assert.strictEqual(typeof mod.main, 'function', 'main exported');
  const derive = mod.deriveThresholds;

  await leg('CL1 deriveThresholds on a separating table returns calibrated true with the rule', function () {
    const t = derive(syntheticTable());
    assert.strictEqual(t.calibrated, true, JSON.stringify(t).slice(0, 300));
    assert.strictEqual(t.top_n, 10);
    assert.strictEqual(t.reshuffle_min_moved, 2);
    assert.ok(t.reshuffle_min_displacement >= 2);
    assert.ok(t.calibration && typeof t.calibration.rule === 'string' && t.calibration.rule.length > 20, 'rule string');
    assert.strictEqual(t.calibration.room_id_hash, 'abcdef012345');
    assert.strictEqual(t.calibration.encoder_model, 'fixture-model');
    assert.strictEqual(typeof t.calibration.displacement_separates, 'boolean');
    assert.ok(t.calibration.per_n && t.calibration.per_n['10'], 'per N numbers recorded');
    // Pure: the same input gives the same output and the input is not changed.
    const tbl = syntheticTable();
    const a = JSON.stringify(derive(tbl));
    const b = JSON.stringify(derive(tbl));
    assert.strictEqual(a, b);
    assert.strictEqual(JSON.stringify(tbl), JSON.stringify(syntheticTable()));
  });

  await leg('CL2 the rule is exact: 90th percentile wobble, median change, floors of 2, N bounded by ranked pairs', function () {
    // N = 5 fails (change not above wobble). N = 10 wins. Limit ranked to 8: only N = 5 is a candidate, so no N.
    const small = syntheticTable();
    small.baseline.ranked = 8;
    const r = derive(small);
    assert.strictEqual(r.calibrated, false);
    assert.strictEqual(r.calibration.reason, 'no_separating_n');
    // Wobble numbers: 1 percent trials for N = 10 are 0,1,1,1 moved (+ the same again for the newest trial group): nearest-rank p90 is 1.
    const ok = derive(syntheticTable());
    assert.strictEqual(ok.calibration.per_n['10'].wobble_moved, 1);
    assert.strictEqual(ok.calibration.per_n['10'].wobble_shift, 1);
    // Change numbers: 10 percent trials for N = 10 are 6,7,8,9 moved: median 7.5.
    assert.strictEqual(ok.calibration.per_n['10'].change_moved, 7.5);
    // Floors: wobble 0 gives min moved 2 (never below 2).
    const quiet = syntheticTable();
    quiet.trials.forEach(function (tr) { if (tr.share === 0.01) tr.perN['10'] = perN(0, 0); });
    const q = derive(quiet);
    assert.strictEqual(q.calibrated, true);
    assert.strictEqual(q.reshuffle_min_moved, 2);
    assert.strictEqual(q.reshuffle_min_displacement, 2);
    // A wobble of 2 pairs at N = 10 (floor(10 / 4) = 2) gives min moved 3.
    const w2 = syntheticTable();
    w2.trials.forEach(function (tr) { if (tr.share === 0.01) tr.perN['10'] = perN(2, 3); });
    const w = derive(w2);
    assert.strictEqual(w.top_n, 10);
    assert.strictEqual(w.reshuffle_min_moved, 3);
    assert.strictEqual(w.reshuffle_min_displacement, 4);
  });

  await leg('CL3 no separating N gives calibrated false with a reason and no invented number', function () {
    const t = syntheticTable();
    t.trials.forEach(function (tr) {
      Object.keys(tr.perN).forEach(function (k) { tr.perN[k] = perN(Number(k), 5); }); // everything moves always
    });
    const r = derive(t);
    assert.strictEqual(r.calibrated, false);
    assert.strictEqual(r.top_n, null);
    assert.strictEqual(r.reshuffle_min_moved, null);
    assert.strictEqual(r.reshuffle_min_displacement, null);
    assert.strictEqual(r.calibration.reason, 'no_separating_n');
  });

  await leg('CL4 a stub baseline can never set thresholds', function () {
    const t = syntheticTable();
    t.baseline.encoder_kind = 'stub';
    const r = derive(t);
    assert.strictEqual(r.calibrated, false);
    assert.strictEqual(r.calibration.reason, 'stub_encoder');
    assert.strictEqual(r.top_n, null);
  });

  await leg('CL4b a no_qualifying_room record gives calibrated false with the probe list and no number', function () {
    const r = derive({
      run_date: '2026-10-28', blocker: 'no_qualifying_room',
      bar: { pairs_scored: 200, ranked: 50, cohort_techs: 100 },
      probes: [{ room_id_hash: 'abcdef012345', node_count: 10, edge_count: 5, cohort_techs: 3, pairs_scored: 2, ranked: 2 }],
    });
    assert.strictEqual(r.calibrated, false);
    assert.strictEqual(r.top_n, null);
    assert.strictEqual(r.calibration.reason, 'no_qualifying_room');
    assert.strictEqual(r.calibration.probes.length, 1);
    assert.strictEqual(r.calibration.bar.pairs_scored, 200);
  });

  await leg('CL5 a nonzero noise floor gives calibrated false', function () {
    const t = syntheticTable();
    t.noise = { events: 2 };
    const r = derive(t);
    assert.strictEqual(r.calibrated, false);
    assert.strictEqual(r.calibration.reason, 'noise_floor_nonzero');
  });

  await leg('CL6 measure on a fixture room builds the table and leaves the original room untouched', async function () {
    const roomDir = buildRoom();
    const before = roomFingerprint(roomDir);
    const table = await mod.measureRoom({ room: roomDir, seeds: 2, offline: true });
    assert.strictEqual(table.baseline.encoder_kind, 'stub');
    assert.strictEqual(table.noise.events, 0, 'unchanged room has zero movement events');
    assert.deepStrictEqual(table.shares, [0.01, 0.02, 0.05, 0.10]);
    assert.strictEqual(table.baseline.room_id_hash, crypto.createHash('sha256').update(path.basename(roomDir)).digest('hex').slice(0, 12));
    assert.ok(table.baseline.node_count > 30 && table.baseline.pairs_scored > 0 && table.baseline.ranked > 0);
    // 4 shares x (1 newest trial + 2 random trials)
    assert.strictEqual(table.trials.length, 12);
    table.trials.forEach(function (tr) {
      assert.ok(['newest', 'random'].includes(tr.kind));
      [5, 10, 25, 50].filter(function (n) { return n <= table.baseline.ranked; }).forEach(function (n) {
        const m = tr.perN[String(n)];
        assert.ok(m && Number.isInteger(m.entered) && Number.isInteger(m.left) && Number.isInteger(m.max_shift), 'perN ' + n);
      });
      assert.ok(Number.isInteger(tr.band_cross) && Number.isInteger(tr.tail_enter));
    });
    if (process.env.T314_DEBUG) console.log(JSON.stringify(table.trials.map(function (t) { return [t.share, t.kind, t.seed, t.held_out, t.skipped || '', JSON.stringify(t.perN['10']), t.band_cross, t.tail_enter]; })));
    table.trials.forEach(function (tr) { assert.ok(!tr.skipped, 'trial ran: ' + tr.skipped); assert.ok(tr.held_out >= 1, 'something held out'); });
    const big = table.trials.filter(function (tr) { return tr.share === 0.10; });
    assert.ok(big.some(function (tr) { return Object.keys(tr.perN).some(function (k) { const m = tr.perN[k]; return m.entered + m.left + m.max_shift > 0; }); }), 'a 10 percent holdout moves the top of the list');
    assert.strictEqual(roomFingerprint(roomDir), before, 'original room is byte-identical');
    // No room name or text in the table: only the hash.
    const text = JSON.stringify(table);
    assert.ok(!text.includes('fixture-room'), 'folder name not in the table');
    assert.ok(!text.includes('Vantorix'), 'room text not in the table');
    // The scratch folder is gone.
    assert.ok(!table.scratch || !fs.existsSync(table.scratch), 'scratch folder cleaned up');
  });

  await leg('CL6c probe reports counts and the qualify verdict without trials', async function () {
    const roomDir = buildRoom();
    const before = roomFingerprint(roomDir);
    const r = await mod.measureRoom({ room: roomDir, probe: true, offline: true });
    assert.strictEqual(r.probe, true);
    assert.strictEqual(r.qualifies, false, 'the 36-thing fixture is below the bar');
    assert.ok(r.baseline.pairs_scored > 0 && r.baseline.cohort_techs > 0 && r.baseline.node_count > 0);
    assert.strictEqual(r.trials, undefined);
    assert.strictEqual(roomFingerprint(roomDir), before);
  });

  await leg('CL6b a room inside the plugin cache and a sealed room are refused', async function () {
    const cacheRoom = path.join(process.env.HOME, '.claude', 'plugins', 'x', 'room');
    fs.mkdirSync(path.join(cacheRoom, '.mindrian'), { recursive: true });
    await assert.rejects(function () { return mod.measureRoom({ room: cacheRoom, seeds: 1, offline: true }); }, /plugin/i);
    const sealed = buildRoom();
    fs.writeFileSync(path.join(sealed, 'GUARDRAIL.md'), '# sealed\n');
    await assert.rejects(function () { return mod.measureRoom({ room: sealed, seeds: 1, offline: true }); }, /sealed/i);
  });

  await leg('CL7 the random holdout is reproducible for the same seed', function () {
    const ids = [];
    for (let i = 0; i < 200; i += 1) ids.push('n' + i);
    const a = mod._test.randomHoldout(ids, 10, 3);
    const b = mod._test.randomHoldout(ids.slice(), 10, 3);
    const c = mod._test.randomHoldout(ids, 10, 4);
    assert.deepStrictEqual(a, b);
    assert.notDeepStrictEqual(a, c);
    assert.strictEqual(a.length, 10);
    assert.strictEqual(new Set(a).size, 10);
  });

  await leg('CL8 derive writes the data file only with --write', function () {
    const dir = tmp();
    const inFile = path.join(dir, 'table.json');
    const outFile = path.join(dir, 'thresholds.json');
    fs.writeFileSync(inFile, JSON.stringify(syntheticTable()));
    const env = Object.assign({}, process.env);
    const run = function (extra) {
      return spawnSync(process.execPath, [SCRIPT, 'derive', '--in', inFile, '--thresholds-file', outFile].concat(extra), { env: env, encoding: 'utf8' });
    };
    const dry = run([]);
    assert.strictEqual(dry.status, 0, dry.stderr);
    assert.ok(!fs.existsSync(outFile), 'no write without --write');
    assert.strictEqual(JSON.parse(dry.stdout).calibrated, true);
    const wr = run(['--write']);
    assert.strictEqual(wr.status, 0, wr.stderr);
    const doc = JSON.parse(fs.readFileSync(outFile, 'utf8'));
    assert.deepStrictEqual(Object.keys(doc), ['schema_version', 'calibrated', 'top_n', 'reshuffle_min_moved', 'reshuffle_min_displacement', 'calibration']);
    assert.strictEqual(doc.calibrated, true);
    // A not-calibrated table with a reason is also written (so the reason is recorded).
    const stubTable = syntheticTable();
    stubTable.baseline.encoder_kind = 'stub';
    fs.writeFileSync(inFile, JSON.stringify(stubTable));
    const wr2 = run(['--write']);
    assert.strictEqual(wr2.status, 0, wr2.stderr);
    const doc2 = JSON.parse(fs.readFileSync(outFile, 'utf8'));
    assert.strictEqual(doc2.calibrated, false);
    assert.strictEqual(doc2.calibration.reason, 'stub_encoder');
    // The shipped file was never touched by these runs.
    assert.strictEqual(fileHash(DATA_FILE), dataBefore, 'shipped thresholds file unchanged');
  });

  await leg('CL10 the harness has no http and no Brain client require', function () {
    const src = fs.readFileSync(SCRIPT, 'utf8');
    const reqs = src.split('\n').filter(function (l) { return /require\(/.test(l) && !/^\s*(\/\/|\*)/.test(l); }).join('\n');
    assert.ok(!/node:https?['"]|require\(\s*['"]https?['"]/.test(reqs), 'no http or https require');
    assert.ok(!/brain-client|mindrian-brain|fetch\(/i.test(src.replace(/^\s*(\/\/|\*).*$/gm, '')), 'no Brain client or fetch');
    assert.ok(!src.includes(String.fromCharCode(0x2013)) && !src.includes(String.fromCharCode(0x2014)), 'no em-dash or en-dash');
    assert.ok(/^#!\/usr\/bin\/env node/.test(src), 'shebang');
  });

  tempDirs.forEach(function (d) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_e) { /* ignore */ } });
  try { fs.rmSync(SANDBOX, { recursive: true, force: true }); } catch (_e) { /* ignore */ }
  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed === 0 ? 0 : 1);
})();
