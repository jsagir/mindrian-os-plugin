'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 363.1 Plan 06 Task 1 (D-04, B51-03) -- the Eureka tail must say
 * something real.
 *
 * WHY: in the beta.51 rooms every room-native node had growth 0.5. The
 * substrate's epochSeconds ran Date.parse on created_at, but room.db stores
 * created_at as integer epoch MILLISECONDS (lib/core/node-insert.cjs writes
 * Date.now()). Date.parse(1790697557789) is NaN, so every cnumber was '0',
 * every node passed the growth cut, and the "tail" was just the bottom-degree
 * tie. The growth_proxy label also disagreed between provenance and the tail
 * block, and a cohort with a flat axis still printed a quadrant.
 *
 * Legs:
 *   U1  epochSeconds over every created_at shape (ms, s, numeric string, ISO,
 *       and the garbage set that must be 0)
 *   U2  a substrate built from insertNode rows (integer-ms created_at) has
 *       positive, distinct cnumbers
 *   U3  classifyTail stamps opts.growthProxy on every return, default kept
 *   U4  a flat growth (or attention) axis reports insufficient_structure
 *       with an empty tail and axis_distinct on every return path
 *   E1  offline room-mode run: one growth_proxy label, axis_distinct >= 2,
 *       tail sufficient, the JSON tail block keeps exactly six keys
 *   E2  renderReport without tail_axis_distinct renders '-', never undefined
 *
 * created_at has SECOND resolution on the growth axis (epochSeconds floors to
 * seconds), so the end to end fixture spaces its batches by minutes via an
 * UPDATE of created_at (integer ms, the real column shape) instead of a
 * millisecond busy-wait, which would land every node in the same second.
 *
 * Zero network, zero deps, mkdtemp only. NO em-dashes (hyphens only; dash
 * characters are spelled with \u escapes where a test needs one).
 */

require('./eureka-offline-preload.cjs');

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const roomNative = require(path.join(ROOT, 'lib/core/eureka/room-native-substrate.cjs'));
const tailmod = require(path.join(ROOT, 'lib/core/eureka/tail-quadrant.cjs'));
const { openRoomDb, closeRoomDb } = require(path.join(ROOT, 'lib/core/room-db.cjs'));
const { insertNode } = require(path.join(ROOT, 'lib/core/node-insert.cjs'));

const ROOM_PROXY = 'created_at-recency (room-native)';

let failures = 0;
const pending = [];
function leg(name, fn) {
  pending.push({ name, fn });
}

const tmpRoots = [];
function mkTmp(label) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'test-363.1-tail-' + label + '-'));
  tmpRoots.push(d);
  return d;
}
function busyWait(ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) { /* spin: created_at needs a real clock gap */ }
}

// ---------------------------------------------------------------------------
// UNIT LEGS
// ---------------------------------------------------------------------------

leg('U1 epochSeconds reads integer ms, seconds, numeric strings and ISO; garbage is 0', () => {
  const ep = roomNative._test.epochSeconds;
  assert.equal(ep(1790697557789), 1790697557, 'integer ms');
  assert.equal(ep(1790697557), 1790697557, 'integer seconds');
  assert.equal(ep('1790697557789'), 1790697557, 'numeric string ms');
  assert.equal(ep('1790697557'), 1790697557, 'numeric string seconds');
  const iso = '2026-07-01T00:00:00.000Z';
  assert.equal(ep(iso), Math.floor(Date.parse(iso) / 1000), 'ISO string still works');
  for (const bad of [null, undefined, 'garbage', NaN, Infinity, -Infinity, 0, -5, '', '-5', {}]) {
    assert.equal(ep(bad), 0, 'must be 0 for ' + String(bad));
  }
});

leg('U2 a substrate over insertNode rows has positive, distinct cnumbers', () => {
  const dir = mkTmp('u2');
  const db = openRoomDb(dir, { allowExtension: true });
  for (let i = 0; i < 3; i += 1) {
    insertNode(db, 'early:' + i, 'Claim', JSON.stringify({ title: 'early ' + i, section: 'alpha' }), {
      source_path: 'alpha/early-' + i, created_by: 'system', epistemic_type: 'observation',
    });
  }
  busyWait(1100); // growth is second-resolution: cross a second boundary
  for (let i = 0; i < 3; i += 1) {
    insertNode(db, 'late:' + i, 'Claim', JSON.stringify({ title: 'late ' + i, section: 'beta' }), {
      source_path: 'beta/late-' + i, created_by: 'system', epistemic_type: 'observation',
    });
  }
  let sub;
  try {
    sub = roomNative.buildRoomNativeSubstrate(db, {});
  } finally {
    closeRoomDb(db);
  }
  const cn = Array.from(sub.techMap.values()).map((t) => Number(t.cnumber));
  assert.equal(cn.length, 6);
  assert.ok(cn.every((n) => n > 0), 'every cnumber must be positive, got ' + JSON.stringify(cn));
  assert.ok(new Set(cn).size >= 2, 'nodes born a second apart must differ, got ' + JSON.stringify(cn));
});

function items(n, fnAttn, fnGrowth) {
  const out = [];
  for (let i = 0; i < n; i += 1) out.push({ id: 'n' + i, attention: fnAttn(i), growth: fnGrowth(i) });
  return out;
}

leg('U3 classifyTail stamps opts.growthProxy on every return; the default label is kept', () => {
  const varied = items(36, (i) => i / 35, (i) => (35 - i) / 35);
  assert.equal(tailmod.classifyTail(varied).growth_proxy, 'cnumber-recency');
  assert.equal(tailmod.classifyTail(varied, { growthProxy: ROOM_PROXY }).growth_proxy, ROOM_PROXY);
  // The sparse-cohort return path carries the label too.
  assert.equal(tailmod.classifyTail(varied.slice(0, 5), { growthProxy: ROOM_PROXY }).growth_proxy, ROOM_PROXY);
  // An empty or non-string label falls back to the default.
  assert.equal(tailmod.classifyTail(varied, { growthProxy: '' }).growth_proxy, 'cnumber-recency');
  assert.equal(tailmod.classifyTail(varied, { growthProxy: 7 }).growth_proxy, 'cnumber-recency');
});

leg('U4 a flat axis reports insufficient_structure with an empty tail and axis_distinct', () => {
  const flatGrowth = items(36, (i) => i / 35, () => 0.5);
  const r = tailmod.classifyTail(flatGrowth);
  assert.equal(r.insufficient_structure, true);
  assert.deepEqual(r.tail, []);
  assert.equal(r.suspect_noise, false);
  assert.deepEqual(r.thresholds, { attnCut: null, growthCut: null });
  assert.equal(r.axis_distinct.growth, 1);
  assert.equal(r.axis_distinct.attention, 36);

  const flatAttn = items(36, () => 0.5, (i) => i / 35);
  const r2 = tailmod.classifyTail(flatAttn);
  assert.equal(r2.insufficient_structure, true);
  assert.deepEqual(r2.tail, []);
  assert.equal(r2.axis_distinct.attention, 1);
  assert.equal(r2.axis_distinct.growth, 36);

  // Every return path carries axis_distinct (sparse cohort, flat axis, sufficient).
  const sparse = tailmod.classifyTail(items(4, (i) => i / 3, (i) => i / 3));
  assert.deepEqual(sparse.axis_distinct, { attention: 4, growth: 4 });
  const ok = tailmod.classifyTail(items(36, (i) => i / 35, (i) => (35 - i) / 35));
  assert.equal(ok.insufficient_structure, false);
  assert.deepEqual(ok.axis_distinct, { attention: 36, growth: 36 });
});

// ---------------------------------------------------------------------------
// END TO END (offline room mode)
// ---------------------------------------------------------------------------

async function runE2E() {
  const RUNNER = require(path.join(ROOT, 'scripts/eureka-portfolio-report.cjs'));
  const roomDir = mkTmp('e2e');
  const db = openRoomDb(roomDir, { allowExtension: true });
  const sections = ['market-analysis', 'problem-definition', 'business-model'];
  const words = ['drivetrain', 'battery', 'warehouse', 'sensor', 'housing', 'route', 'payload', 'charging',
    'fleet', 'lidar', 'gripper', 'conveyor'];
  const ids = [];
  for (let i = 0; i < 39; i += 1) {
    const sec = sections[i % 3];
    const id = 'claim:' + sec + ':' + i;
    ids.push(id);
    const text = 'Operators of ' + words[i % words.length] + ' systems report ' + words[(i * 5 + 3) % words.length]
      + ' limits number ' + i + ' in ' + sec + ' work.';
    insertNode(db, id, 'Claim', JSON.stringify({ title: 'Claim ' + i, text, section: sec }), {
      source_path: sec + '/claim-' + i, created_by: 'system', epistemic_type: 'observation',
    });
  }
  // Three birth batches, minutes apart, stored as integer epoch ms (the real column shape).
  const base = 1790000000000;
  const upd = db.prepare('UPDATE nodes SET created_at = ?, last_seen_at = ? WHERE id = ?');
  for (let i = 0; i < ids.length; i += 1) {
    const t = base + (i % 3) * 3600000 + i * 1000;
    upd.run(t, t, ids[i]);
  }
  // Varied degree: node i links to the next (i % 4) nodes.
  const ei = db.prepare('INSERT INTO edges(source,target,type,properties) VALUES (?,?,?,?)');
  for (let i = 0; i < ids.length; i += 1) {
    for (let k = 1; k <= (i % 4); k += 1) {
      if (i + k < ids.length) ei.run(ids[i], ids[i + k], 'CONVERGES', '{}');
    }
  }
  closeRoomDb(db);

  const outMd = path.join(roomDir, '.mindrian', 'eureka', 'portfolio-report.md');
  const outJson = path.join(roomDir, '.mindrian', 'eureka', 'portfolio-report.json');
  const code = await RUNNER.main(['--db', roomDir, '--pairs', 'room', '--offline', '--top', '25', '--out', outMd, '--json', outJson]);
  assert.equal(code, 0, 'runner should exit 0');
  return { report: JSON.parse(fs.readFileSync(outJson, 'utf8')), md: fs.readFileSync(outMd, 'utf8'), RUNNER };
}

let e2e = null;
async function e2eOnce() {
  if (!e2e) e2e = await runE2E();
  return e2e;
}

leg('E1 one growth_proxy label, real axes, sufficient structure, six-key tail block', async () => {
  const { report } = await e2eOnce();
  assert.equal(report.provenance.growth_proxy, ROOM_PROXY);
  assert.equal(report.tail.growth_proxy, ROOM_PROXY, 'tail block must carry the same label');
  assert.equal(report.provenance.growth_proxy, report.tail.growth_proxy);
  const d = report.provenance.tail_axis_distinct;
  assert.ok(d && d.growth >= 2, 'growth axis must have >= 2 distinct values, got ' + JSON.stringify(d));
  assert.ok(d.attention >= 2, 'attention axis must have >= 2 distinct values, got ' + JSON.stringify(d));
  assert.equal(report.tail.insufficient_structure, false);
  assert.deepEqual(Object.keys(report.tail).sort(),
    ['composition', 'growth_proxy', 'insufficient_structure', 'items', 'suspect_noise', 'thresholds']);
});

leg('E2 the md row shows axis_distinct; renderReport without it renders "-", never undefined', async () => {
  const { report, md, RUNNER } = await e2eOnce();
  assert.ok(md.includes('Tail axis distinct values (attention / growth)'), 'md provenance row missing');
  const prov = Object.assign({}, report.provenance);
  delete prov.tail_axis_distinct;
  const out = RUNNER.renderReport({
    provenance: prov, roomDir: 'fixture-room', graphRel: '(room-native: no idea-graph)', offline: true, top: 0,
    ranked: [], tailIds: new Set(), tail: { insufficient_structure: true, suspect_noise: false, tail: [] },
    tailPairs: [], statements: [], techFor: () => ({ title: 'unused' }),
  });
  const line = out.split('\n').find((l) => l.includes('Tail axis distinct values'));
  assert.ok(line, 'row must render even when the key is absent');
  assert.ok(!/undefined|NaN/.test(line), line);
  assert.ok(/\| - \|/.test(line), 'absent value renders "-": ' + line);
});

// ---------------------------------------------------------------------------
// runner
// ---------------------------------------------------------------------------

(async function main() {
  for (const { name, fn } of pending) {
    try {
      await fn();
      console.log('ok - ' + name);
    } catch (err) {
      failures += 1;
      console.log('not ok - ' + name);
      console.log('    ' + String(err && err.message ? err.message : err).split('\n').join('\n    '));
    }
  }
  for (const d of tmpRoots) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  }
  if (failures > 0) {
    console.log('test-363.1-eureka-tail: ' + failures + ' leg(s) FAILED');
    process.exit(1);
  }
  console.log('test-363.1-eureka-tail: ' + pending.length + '/' + pending.length + ' legs PASSED');
  process.exit(0);
})();
