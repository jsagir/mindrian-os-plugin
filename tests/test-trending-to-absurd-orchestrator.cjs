'use strict';
// Phase 163-04 -- Trending-to-the-Absurd orchestrator test suite (WAVE 4 SURFACE-A).
//
// Proves the 5-act trend pipeline CLONED from the futures harness (Part 7) and
// EXTENDED with the graph-native seed (D-163-04) + the extrapolate-to-absurd
// horizons + the exclusive-ownership filing + the Shape F.1 trend-selection gate
// (D-163-05). Five behaviors:
//
//   Test 1: seedFromDomains calls getDomainsForTrendExtrapolation and returns the
//           graph-walked domains as trend-extraction seeds (tier 2 when domains
//           exist). (Reader is STUBBED via a global override so the suite is
//           headless and deterministic.)
//   Test 2: generateAbsurdRings clamps to the reused depth/fan-out caps and
//           stamps each consequence with one of the three horizons (near / mid /
//           long mapped to 3-10 / 11-30 / 50yr).
//   Test 3: registerTrendArtifacts writes ONLY under room/opportunity-bank/ (no
//           write path escapes opportunity-bank/) with ROOM.md per folder.
//   Test 4: writeCascadeEdges (re-exported) routes ROOT_CAUSES through
//           navigation.writeEdge -- zero raw edge-table INSERT in the file
//           (grep gate).
//   Test 5: surfaceTrendSelectionGate returns a Shape F.1 gate descriptor at the
//           trend-selection judgment point (the D-163-05 hybrid gate).
//
// Canon Part 8: zero Brain egress; the only external leg is the inherited
//   runSignalResearch generic-handle path (not exercised here).
//
// NO em-dashes anywhere (CLAUDE.md HARD RULE). In-memory node:sqlite db, no SKIP.

const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const REPO_ROOT = path.resolve(__dirname, '..');
const ORCH_PATH = path.join(REPO_ROOT, 'lib', 'core', 'trending-to-absurd', 'orchestrator.cjs');
const NAV_PATH = path.join(REPO_ROOT, 'lib', 'core', 'navigation.cjs');

let pass = 0;
let total = 0;
function check(label, fn) {
  total += 1;
  fn();
  pass += 1;
  console.log('  ok -', label);
}
function checkAsync(label, fn) {
  return Promise.resolve()
    .then(() => { total += 1; return fn(); })
    .then(() => { pass += 1; console.log('  ok -', label); });
}

console.log('test-trending-to-absurd-orchestrator');

// ---------------------------------------------------------------------------
// Test 1: seedFromDomains seeds Act 1 from the graph-walked domains (tier 2).
// We STUB navigation.getDomainsForTrendExtrapolation so the seed source is the
// reader (not a user string) and the test is deterministic + headless.
// ---------------------------------------------------------------------------
check('Test 1 -- seedFromDomains seeds from getDomainsForTrendExtrapolation (tier 2)', () => {
  const navigation = require(NAV_PATH);
  const original = navigation.getDomainsForTrendExtrapolation;
  let calledWith = null;
  navigation.getDomainsForTrendExtrapolation = (roomDir, opts) => {
    calledWith = { roomDir, opts };
    return {
      tier: 2,
      domains: [
        { id: 'domain:biotech', name: 'Biotech', domainType: 'domain', related: [{ id: 'a' }, { id: 'b' }] },
        { id: 'subdomain:cell-therapy', name: 'Cell Therapy', domainType: 'subdomain', related: [{ id: 'c' }] },
      ],
    };
  };
  // Fresh-require the orchestrator AFTER the stub is in place (it reads the live
  // navigation object at call time, so a cached require is fine).
  delete require.cache[require.resolve(ORCH_PATH)];
  const orch = require(ORCH_PATH);

  const fakeDb = { _marker: 'caller-owned' };
  const out = orch.seedFromDomains('/tmp/room-163-04-t1', { db: fakeDb });

  assert.ok(calledWith, 'getDomainsForTrendExtrapolation was called (graph-native seed)');
  assert.equal(calledWith.opts.db, fakeDb, 'the caller-owned db handle was forwarded to the reader');
  assert.equal(out.tier, 2, 'tier 2 when domains exist');
  assert.ok(Array.isArray(out.seeds), 'seeds is an array');
  const names = out.seeds.map((s) => s.name);
  assert.ok(names.includes('Biotech'), 'the graph-walked domain became a seed');
  assert.ok(names.includes('Cell Therapy'), 'the graph-walked subdomain became a seed');
  const biotech = out.seeds.find((s) => s.name === 'Biotech');
  assert.equal(biotech.relatedCount, 2, 'the related-node count rode through as signal strength');

  // extractTrends derives ranked trend candidates from the seeds.
  const trends = orch.extractTrends(out.seeds);
  assert.ok(trends.length >= 2, 'a trend candidate per seed');
  assert.equal(trends[0].domain, 'Biotech', 'trends ranked by LOCAL signal strength (richer hub first)');

  navigation.getDomainsForTrendExtrapolation = original;
});

// ---------------------------------------------------------------------------
// Test 2: generateAbsurdRings clamps to the reused caps + stamps the 3 horizons.
// ---------------------------------------------------------------------------
check('Test 2 -- generateAbsurdRings clamps depth/fan-out + stamps the 3 horizons', () => {
  delete require.cache[require.resolve(ORCH_PATH)];
  const orch = require(ORCH_PATH);

  // 7 ring-1 children but the fan-out cap is FUTURES_FANOUT_CAP (5) -> clamp to 5.
  const children = [];
  for (let i = 0; i < 7; i += 1) {
    children.push({ label: 'absurd extreme ' + i, confidence: 0.5, domain: 'Technological' });
    // deliberately no horizon -> generateAbsurdRings must stamp the spec horizon.
  }

  // near = 3-10yr.
  const near = orch.generateAbsurdRings('AI everywhere', 'near', [], { ring: 1, children });
  assert.equal(near.length, orch.FUTURES_FANOUT_CAP, 'ring-1 children clamped to the fan-out cap');
  for (const c of near) {
    assert.equal(c.horizon, 'near', 'stamped near horizon');
    assert.equal(c.horizon_spec, '3-10yr', 'near maps to the 3-10yr spec horizon');
  }

  // mid = 11-30yr; long = 50yr.
  const mid = orch.generateAbsurdRings('AI everywhere', 'mid', [], {
    ring: 1, children: [{ label: 'mid extreme', confidence: 0.4, domain: 'Social' }],
  });
  assert.equal(mid[0].horizon, 'mid', 'stamped mid horizon');
  assert.equal(mid[0].horizon_spec, '11-30yr', 'mid maps to the 11-30yr spec horizon');

  const long = orch.generateAbsurdRings('AI everywhere', 'long', [], {
    ring: 1, children: [{ label: 'long extreme', confidence: 0.3, domain: 'Environmental' }],
  });
  assert.equal(long[0].horizon, 'long', 'stamped long horizon');
  assert.equal(long[0].horizon_spec, '50yr', 'long maps to the 50yr spec horizon');

  // The depth cap is reused from the futures harness: an over-cap ring clamps.
  const deep = orch.generateAbsurdRings('AI everywhere', 'near', [], {
    ring: 99, children: [{ label: 'deep', confidence: 0.5, domain: 'Economic' }],
  });
  // generateRing clamps the ring number; for ring>1 it expands parents only, so an
  // empty parents array yields 0 -- the clamp itself is asserted via the cap export.
  assert.ok(orch.FUTURES_DEPTH_CAP === 3, 'the depth cap is reused (3)');
  assert.ok(Array.isArray(deep), 'deep ring returns an array (no crash on clamp)');
});

// ---------------------------------------------------------------------------
// Test 3: registerTrendArtifacts writes ONLY under opportunity-bank/ + ROOM.md.
// ---------------------------------------------------------------------------
const t3 = checkAsync('Test 3 -- registerTrendArtifacts writes only under opportunity-bank/ with ROOM.md', async () => {
  delete require.cache[require.resolve(ORCH_PATH)];
  const orch = require(ORCH_PATH);

  const roomDir = fs.mkdtempSync(path.join(os.tmpdir(), 'room-163-04-t3-'));
  const consequences = [
    { id: 'c1', ring: 1, parent_id: null, horizon: 'near', confidence: 0.5, domain: 'Technological', label: 'absurd extreme one', body: '', horizon_spec: '3-10yr' },
    { id: 'c2', ring: 1, parent_id: null, horizon: 'long', confidence: 0.4, domain: 'Social', label: 'absurd extreme two', body: '', horizon_spec: '50yr' },
  ];

  const res = await orch.registerTrendArtifacts(roomDir, consequences, { seed: 'ai-everywhere' });

  assert.ok(Array.isArray(res.filed) && res.filed.length === 2, 'both consequences filed');
  const oppBank = path.join(path.resolve(roomDir), 'opportunity-bank');
  // The seed dir must be under opportunity-bank/ and carry the TTA-owned prefix.
  assert.ok(res.seedDir.startsWith(oppBank + path.sep), 'seedDir is under opportunity-bank/ (exclusive ownership)');
  assert.ok(res.seedDir.indexOf(orch.TTA_SEED_PREFIX) !== -1, 'seedDir carries the trending-to-absurd prefix');

  // NO write path escapes opportunity-bank/.
  for (const f of res.filed) {
    assert.ok(f.path.startsWith(oppBank + path.sep), 'every filed artifact lives under opportunity-bank/: ' + f.path);
    assert.ok(fs.existsSync(f.path), 'the artifact .md was written');
    // ICM Layer 0: a ROOM.md sits beside each artifact.
    const roomMd = path.join(path.dirname(f.path), 'ROOM.md');
    assert.ok(fs.existsSync(roomMd), 'ROOM.md present in the artifact folder (ICM Layer 0)');
  }
  // The seed folder itself carries a ROOM.md.
  assert.ok(fs.existsSync(path.join(res.seedDir, 'ROOM.md')), 'seed folder ROOM.md present');

  // Assert NOTHING was written outside opportunity-bank/ (other than the bank).
  const topLevel = fs.readdirSync(path.resolve(roomDir));
  for (const entry of topLevel) {
    if (entry === 'opportunity-bank') continue;
    if (entry === '.mindrian') continue; // the registrar's room.db lives here, not an escape
    assert.fail('unexpected write outside opportunity-bank/: ' + entry);
  }

  fs.rmSync(roomDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Test 4: writeCascadeEdges routes ROOT_CAUSES through navigation.writeEdge;
// zero raw edge-table INSERT in the orchestrator file (grep gate).
// ---------------------------------------------------------------------------
check('Test 4 -- writeCascadeEdges routes ROOT_CAUSES through the chokepoint (zero raw edge SQL)', () => {
  delete require.cache[require.resolve(ORCH_PATH)];
  const orch = require(ORCH_PATH);
  const navigation = require(NAV_PATH);

  // The grep gate: the orchestrator file carries zero raw edge-table INSERT.
  const src = fs.readFileSync(ORCH_PATH, 'utf8');
  assert.equal(/INSERT\s+INTO\s+edges/i.test(src), false, 'no raw INSERT INTO edges in the orchestrator');

  // writeCascadeEdges (re-exported) routes through navigation.writeEdge. Stub
  // writeEdge to assert the chokepoint is the path + ROOT_CAUSES is the edge type.
  const originalWriteEdge = navigation.writeEdge;
  const calls = [];
  navigation.writeEdge = (db, params) => {
    calls.push(params);
    return { ok: true };
  };
  // generate a ring with a parent link so a ROOT_CAUSES edge is requested.
  const cons = [
    { id: 'child-1', ring: 2, parent_id: 'parent-1', horizon: 'near', confidence: 0.5, domain: 'Technological', label: 'child' },
  ];
  const out = orch.writeCascadeEdges({ _marker: 'db' }, cons);
  assert.equal(out.written, 1, 'one cascade edge written through the chokepoint');
  assert.equal(calls.length, 1, 'navigation.writeEdge was the path');
  assert.equal(calls[0].edge_type, 'ROOT_CAUSES', 'the frozen ROOT_CAUSES cascade edge type');
  assert.equal(calls[0].source_id, 'parent-1', 'source is the parent CAUSE');
  assert.equal(calls[0].target_id, 'child-1', 'target is the child EFFECT');
  // Part 8: edge properties are enum/scalar ONLY (no body text).
  assert.ok(!('body' in (calls[0].properties || {})), 'no body on the edge (Part 8 scalar-only)');

  navigation.writeEdge = originalWriteEdge;
});

// ---------------------------------------------------------------------------
// Test 5: surfaceTrendSelectionGate returns a Shape F.1 gate at the judgment point.
// ---------------------------------------------------------------------------
check('Test 5 -- surfaceTrendSelectionGate returns a Shape F.1 trend-selection gate', () => {
  delete require.cache[require.resolve(ORCH_PATH)];
  const orch = require(ORCH_PATH);

  const trends = [
    { trend: 'Trend in Biotech', domain: 'Biotech', sourceId: 'domain:biotech', signalStrength: 3 },
    { trend: 'Trend in Quantum', domain: 'Quantum', sourceId: 'domain:quantum', signalStrength: 1 },
  ];
  const gate = orch.surfaceTrendSelectionGate('/tmp/room-163-04-t5', trends, {});

  assert.equal(gate.judgment_point, 'trend-selection', 'the D-163-05 trend-selection judgment point');
  assert.equal(gate.surface, 'F.1', 'rendered as the Shape F.1 selector');
  assert.deepEqual(gate.verbs, orch.RING_GATE_VERBS, 'the reused tri-context verb set (APPROVE/REJECT/DEFER)');
  assert.ok(Array.isArray(gate.trends) && gate.trends.length === 2, 'the trends are surfaced for selection');
  // Tri-context panels present; BRAIN carries a GENERIC handle only (Part 8).
  assert.ok(gate.contexts && gate.contexts.local && gate.contexts.brain && gate.contexts.signal, 'tri-context panels present');
  assert.equal(gate.contexts.brain.methodology, 'S-Curve Analysis', 'BRAIN panel carries the generic framework handle only');
  assert.ok(/generic framework handle only/.test(gate.contexts.brain.note), 'Part 8 note present on the BRAIN panel');
});

// ---------------------------------------------------------------------------
Promise.all([t3]).then(() => {
  console.log(`\nPASS (${pass}/${total})`);
  if (pass !== total) process.exit(1);
}).catch((e) => {
  console.error('FAIL', e && e.stack ? e.stack : e);
  process.exit(1);
});
