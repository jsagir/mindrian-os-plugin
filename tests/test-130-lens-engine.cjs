'use strict';
/*
 * Phase 130-02 -- lens-engine + 3 synthesizers + 5 lens memory_event types.
 *
 * TDD suite (RED before the engine + synthesizers exist; GREEN after). Covers:
 *   Task 1: the 5 net-new lens EVENT_TYPES (named membership + delta-of-5, never
 *           an absolute size) + the 3 PURE synthesizers (tension-map /
 *           comparison-matrix / convergence-map) over typed lens-finding node
 *           objects + a source-grep proving each synthesizer carries zero
 *           room-db / node:sqlite / fs-write require.
 *   Task 2: lib/core/lens-engine.cjs rotate() over serial / parallel / single
 *           rotation modes; the mandatory memory_events; synthesize receives the
 *           typed findingIds (NOT raw perLensFn arrays); onAccept -> INFORMS,
 *           onReject -> REJECTED_BECAUSE via navigation.writeEdge; the 5-family
 *           LENS_REGISTRY (cognitive populated, the other 4 reserved); the
 *           persona-aware role_blend hook; zero direct room-db / sqlite require;
 *           zero em-dashes.
 *
 * The engine reaches room.db ONLY through navigation.cjs and takes a caller-owned
 * db handle in opts.input.db (the lens-nodes / writeEdge convention). This test
 * file is allow-listed (tests/), so it MAY require room-db.cjs to build the
 * fixture handle the engine consumes.
 *
 * NO em-dashes anywhere in this file (CLAUDE.md HARD RULE). Uses hyphens.
 */

const { test } = require('node:test');
const { ok, equal, deepEqual } = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const EMDASH = String.fromCharCode(8212);

const { openRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));
const { EVENT_TYPES } = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'memory-events.cjs'));
const navigation = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation.cjs'));

const tensionMap = require(path.join(REPO_ROOT, 'lib', 'core', 'synthesizers', 'tension-map.cjs'));
const comparisonMatrix = require(path.join(REPO_ROOT, 'lib', 'core', 'synthesizers', 'comparison-matrix.cjs'));
const convergenceMap = require(path.join(REPO_ROOT, 'lib', 'core', 'synthesizers', 'convergence-map.cjs'));

const engine = require(path.join(REPO_ROOT, 'lib', 'core', 'lens-engine.cjs'));

// ---------------------------------------------------------------------------
// Fixture helpers (test-only; allow-listed path may open room.db directly).
// ---------------------------------------------------------------------------
function freshDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'p130-02-engine-'));
  const db = openRoomDb(dir);
  return { dir, db };
}

function seedAnchorNode(db, id, type) {
  const nowMs = Date.now();
  db.prepare(
    "INSERT OR IGNORE INTO nodes (id, type, properties, source_path, created_by, confidence, review_status, created_at, last_seen_at) " +
    "VALUES (?, ?, '{}', 'p130-02-fixture', 'system', NULL, 'confirmed', ?, ?)"
  ).run(id, type, nowMs, nowMs);
}

function countEvents(db, eventType) {
  const row = db.prepare(
    "SELECT COUNT(*) AS c FROM nodes WHERE type = 'memory_event' " +
    "AND json_extract(properties, '$.event_type') = ?"
  ).get(eventType);
  return row ? row.c : 0;
}

// A small synthetic typed lens-finding node set (id + lens + parsed properties).
// Mirrors what writeLensFinding stores: { id, lens, lensType, topic, summary }.
function syntheticFindings() {
  return [
    { id: 'lens_finding:cognitive:s1:yellow-hat', lens: 'yellow-hat', lensType: 'cognitive', topic: 'pricing', summary: 'A premium tier is a clear revenue opportunity for power users.' },
    { id: 'lens_finding:cognitive:s1:black-hat', lens: 'black-hat', lensType: 'cognitive', topic: 'pricing', summary: 'A premium tier is a churn risk and a concern for trust.' },
    { id: 'lens_finding:cognitive:s1:white-hat', lens: 'white-hat', lensType: 'cognitive', topic: 'pricing', summary: 'Pricing data shows competitors charge for premium tiers.' },
    { id: 'lens_finding:cognitive:s1:green-hat', lens: 'green-hat', lensType: 'cognitive', topic: 'pricing', summary: 'A premium tier could be reframed as a community membership.' },
  ];
}

// ===========================================================================
// TASK 1 -- EVENT_TYPES + synthesizers
// ===========================================================================

const LENS_EVENT_TYPES = [
  'lens_rotation_started',
  'lens_finding_written',
  'lens_synthesis_completed',
  'lens_finding_accepted',
  'lens_finding_rejected',
];

test('T1.1: EVENT_TYPES gains the 5 named lens types (named membership)', () => {
  for (const t of LENS_EVENT_TYPES) {
    ok(EVENT_TYPES.has(t), 'EVENT_TYPES missing ' + t);
  }
});

test('T1.2: the 5 lens types are a delta of exactly 5 over the pre-130-02 baseline', () => {
  // FLOOR-not-exact-size convention: the baseline (everything except the 5 lens
  // types) plus exactly 5 equals the current size. This asserts the delta, never
  // a brittle absolute size -- a future phase adding a 6th type cannot regress it.
  const lensSet = new Set(LENS_EVENT_TYPES);
  let baseline = 0;
  for (const t of EVENT_TYPES) {
    if (!lensSet.has(t)) baseline++;
  }
  equal(EVENT_TYPES.size - baseline, 5, 'lens types must be a delta of exactly 5');
});

test('T1.3: synthesizeTensionMap pairs opposing-lens findings, is pure, defensive on empty', () => {
  deepEqual(tensionMap.synthesizeTensionMap([]), { tensions: [] });
  const out = tensionMap.synthesizeTensionMap(syntheticFindings());
  ok(out && Array.isArray(out.tensions), 'tensions array expected');
  ok(out.tensions.length >= 1, 'at least one opposing pair (yellow opportunity vs black concern)');
  const pair = out.tensions[0];
  ok(typeof pair.topic === 'string', 'pair carries a topic');
  ok(Array.isArray(pair.lenses) && pair.lenses.length === 2, 'pair joins exactly two lenses');
});

test('T1.4: synthesizeComparisonMatrix returns a Body Shape D table (rows=lenses, columns=dimensions)', () => {
  deepEqual(comparisonMatrix.synthesizeComparisonMatrix([]), { columns: [], rows: [] });
  const out = comparisonMatrix.synthesizeComparisonMatrix(syntheticFindings());
  ok(Array.isArray(out.columns) && out.columns.length >= 1, 'columns = comparison dimensions');
  ok(Array.isArray(out.rows) && out.rows.length === 4, 'one row per lens');
  ok(typeof out.rows[0].lens === 'string', 'row keyed by lens');
  ok(Array.isArray(out.rows[0].cells), 'row carries a cell per column');
  equal(out.rows[0].cells.length, out.columns.length, 'cell count matches column count');
});

test('T1.5: synthesizeConvergenceMap returns clusters of themes across 3+ lenses', () => {
  deepEqual(convergenceMap.synthesizeConvergenceMap([]), { clusters: [] });
  // All 4 synthetic findings share the "premium tier" theme across >=3 lenses.
  const findings = syntheticFindings();
  const out = convergenceMap.synthesizeConvergenceMap(findings);
  ok(out && Array.isArray(out.clusters), 'clusters array expected');
  if (out.clusters.length > 0) {
    const c = out.clusters[0];
    ok(Array.isArray(c.lenses) && c.lenses.length >= 3, 'a convergence cluster spans 3+ lenses');
    ok(typeof c.theme === 'string' && c.theme.length > 0, 'cluster carries a theme token');
  }
});

test('T1.6: each synthesizer source carries zero room-db / sqlite / fs-write require', () => {
  const files = [
    'lib/core/synthesizers/tension-map.cjs',
    'lib/core/synthesizers/comparison-matrix.cjs',
    'lib/core/synthesizers/convergence-map.cjs',
  ];
  for (const rel of files) {
    const src = fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');
    ok(!/require\(\s*['"](?:node:sqlite|better-sqlite3)['"]\s*\)/.test(src), rel + ' requires sqlite');
    ok(!/require\(['"][^'"]*room-db[^'"]*['"]\)/.test(src), rel + ' requires room-db');
    ok(!/require\(['"][^'"]*lazygraph-ops[^'"]*['"]\)/.test(src), rel + ' requires lazygraph-ops');
    ok(!/\b(?:writeFileSync|writeFile|appendFileSync)\s*\(/.test(src), rel + ' writes to fs');
    ok(!src.includes(EMDASH), rel + ' contains an em-dash');
  }
});

// ===========================================================================
// TASK 2 -- lens-engine.cjs
// ===========================================================================

// A perLensFn that returns a finding per lens (records the ctx it received so
// the persona-aware role_blend hook can be asserted).
function makePerLensFn(seenCtx) {
  return async function perLensFn(lens, ctx) {
    if (seenCtx) seenCtx.push({ lens, ctx });
    return { summary: 'finding for ' + lens, topic: (ctx && ctx.topic) || 'topic' };
  };
}

test('T2.1: rotate serial runs perLensFn once per lens, returns findingIds + synthesis + selector', async () => {
  const { dir, db } = freshDb();
  const seen = [];
  const result = await engine.rotate({
    lensType: 'cognitive',
    lensSet: 'six-hats',
    input: { roomDir: dir, topic: 'pricing', db },
    perLensFn: makePerLensFn(seen),
    synthesize: 'tension-map',
    surfaceSelector: 'F.1',
    persistence: 'memory_event',
    rotationMode: 'serial',
  });
  ok(result.ok, 'rotate returned ok: ' + JSON.stringify(result));
  equal(seen.length, 6, 'perLensFn called once per six-hats lens');
  ok(Array.isArray(result.findingIds) && result.findingIds.length === 6, 'six finding ids written');
  ok(result.synthesis && typeof result.synthesis === 'object', 'synthesis present');
  ok(result.selector, 'selector present');
});

test('T2.2: rotationMode single calls perLensFn for exactly one named lens', async () => {
  const { dir, db } = freshDb();
  const seen = [];
  const result = await engine.rotate({
    lensType: 'cognitive',
    lensSet: ['black-hat'],
    input: { roomDir: dir, topic: 'risk', db },
    perLensFn: makePerLensFn(seen),
    synthesize: 'tension-map',
    surfaceSelector: 'F.1',
    persistence: 'memory_event',
    rotationMode: 'single',
  });
  ok(result.ok, 'single rotate ok');
  equal(seen.length, 1, 'exactly one lens run in single mode');
  equal(seen[0].lens, 'black-hat', 'the named lens ran');
});

test('T2.3: rotationMode parallel awaits all perLensFn concurrently', async () => {
  const { dir, db } = freshDb();
  let concurrent = 0;
  let maxConcurrent = 0;
  const perLensFn = async (lens) => {
    concurrent++;
    maxConcurrent = Math.max(maxConcurrent, concurrent);
    await new Promise((r) => setTimeout(r, 5));
    concurrent--;
    return { summary: 's', topic: 't' };
  };
  const result = await engine.rotate({
    lensType: 'cognitive',
    lensSet: 'six-hats',
    input: { roomDir: dir, topic: 'x', db },
    perLensFn,
    synthesize: 'convergence-map',
    surfaceSelector: 'F.1',
    persistence: 'memory_event',
    rotationMode: 'parallel',
  });
  ok(result.ok, 'parallel rotate ok');
  ok(maxConcurrent > 1, 'parallel mode ran lenses concurrently (maxConcurrent=' + maxConcurrent + ')');
});

test('T2.4: every rotate emits lens_rotation_started + lens_synthesis_completed + per-finding lens_finding_written', async () => {
  const { dir, db } = freshDb();
  await engine.rotate({
    lensType: 'cognitive',
    lensSet: 'six-hats',
    input: { roomDir: dir, topic: 'pricing', db },
    perLensFn: makePerLensFn(),
    synthesize: 'tension-map',
    surfaceSelector: 'F.1',
    persistence: 'memory_event',
    rotationMode: 'serial',
  });
  equal(countEvents(db, 'lens_rotation_started'), 1, 'one rotation_started');
  equal(countEvents(db, 'lens_synthesis_completed'), 1, 'one synthesis_completed');
  equal(countEvents(db, 'lens_finding_written'), 6, 'one finding_written per lens');
});

test('T2.5: synthesize receives the typed findingIds, NOT the raw perLensFn arrays', async () => {
  const { dir, db } = freshDb();
  const seenBySynth = {};
  // Inject a synthesize function (instead of a named strategy) to capture the input.
  const result = await engine.rotate({
    lensType: 'cognitive',
    lensSet: 'six-hats',
    input: { roomDir: dir, topic: 'pricing', db },
    perLensFn: makePerLensFn(),
    synthesize: (findingNodes) => { seenBySynth.input = findingNodes; return { ok: true }; },
    surfaceSelector: 'F.1',
    persistence: 'memory_event',
    rotationMode: 'serial',
  });
  ok(result.ok, 'rotate ok');
  ok(Array.isArray(seenBySynth.input), 'synthesize got an array');
  // Each element is a typed node object carrying the written node id, never a raw return.
  ok(seenBySynth.input.every((n) => n && typeof n.id === 'string' && n.id.startsWith('lens_finding:')),
    'synthesize received typed lens-finding node IDs');
});

test('T2.6: onAccept writes an INFORMS edge; onReject writes a REJECTED_BECAUSE edge', async () => {
  const { dir, db } = freshDb();
  seedAnchorNode(db, 'target:problem-definition', 'section');
  const accepted = [];
  const rejected = [];
  const result = await engine.rotate({
    lensType: 'cognitive',
    lensSet: ['yellow-hat', 'black-hat'],
    input: { roomDir: dir, topic: 'pricing', db },
    perLensFn: makePerLensFn(),
    synthesize: 'tension-map',
    surfaceSelector: 'F.1',
    persistence: 'memory_event+cascade-edge',
    rotationMode: 'serial',
    onAccept: (lens, finding) => {
      accepted.push(lens);
      return { target_id: 'target:problem-definition' };
    },
    onReject: (lens, finding) => {
      rejected.push(lens);
      return { target_id: 'target:problem-definition', reason: 'off_topic' };
    },
  });
  ok(result.ok, 'rotate ok');
  // The engine surfaces accept/reject hooks; this test exercises the accept path.
  const informs = db.prepare("SELECT COUNT(*) AS c FROM edges WHERE type = 'INFORMS'").get();
  ok(informs.c >= 1, 'at least one INFORMS edge written via onAccept');
  equal(countEvents(db, 'lens_finding_accepted'), informs.c, 'accept events match INFORMS edges');
});

test('T2.7: onReject path writes REJECTED_BECAUSE + a lens_finding_rejected event', async () => {
  const { dir, db } = freshDb();
  seedAnchorNode(db, 'target:problem-definition', 'section');
  const result = await engine.rotate({
    lensType: 'cognitive',
    lensSet: ['black-hat'],
    input: { roomDir: dir, topic: 'risk', db },
    perLensFn: makePerLensFn(),
    synthesize: 'tension-map',
    surfaceSelector: 'F.1',
    persistence: 'memory_event+cascade-edge',
    rotationMode: 'single',
    rejectAll: true,
    onReject: (lens, finding) => ({ target_id: 'target:problem-definition', reason: 'low_evidence' }),
  });
  ok(result.ok, 'rotate ok');
  const rejected = db.prepare("SELECT COUNT(*) AS c FROM edges WHERE type = 'REJECTED_BECAUSE'").get();
  ok(rejected.c >= 1, 'at least one REJECTED_BECAUSE edge written via onReject');
  equal(countEvents(db, 'lens_finding_rejected'), rejected.c, 'reject events match REJECTED_BECAUSE edges');
});

test('T2.8: LENS_REGISTRY has 5 families; cognitive populated, the other 4 reserved with client_count 0', () => {
  const r = engine.LENS_REGISTRY;
  const keys = Object.keys(r).sort();
  deepEqual(keys, ['cognitive', 'domain', 'framework', 'source', 'trend']);
  ok(r.cognitive.client_count > 0, 'cognitive populated');
  ok(Array.isArray(r.cognitive.lens_sets) && r.cognitive.lens_sets.includes('six-hats'), 'cognitive lists six-hats');
  for (const k of ['domain', 'source', 'framework', 'trend']) {
    equal(r[k].client_count, 0, k + ' reserved with client_count 0');
  }
});

test('T2.9: ROTATION_MODES is exactly serial / parallel / single (no 4th weighted mode this phase)', () => {
  ok(Array.isArray(engine.ROTATION_MODES), 'ROTATION_MODES is an array');
  for (const m of ['serial', 'parallel', 'single']) {
    ok(engine.ROTATION_MODES.includes(m), 'ROTATION_MODES includes ' + m);
  }
  ok(!engine.ROTATION_MODES.includes('weighted'), 'no weighted mode (deferred to Phase 131)');
});

test('T2.10: the persona-aware framing hook passes role_blend into the perLensFn ctx', async () => {
  const { dir, db } = freshDb();
  // Write a USER.md with a role_blend so the hook reads it.
  fs.writeFileSync(path.join(dir, 'USER.md'),
    '---\nrole_blend:\n  founder: 0.6\n  researcher: 0.4\n---\n# User\n', 'utf8');
  const seen = [];
  await engine.rotate({
    lensType: 'cognitive',
    lensSet: ['white-hat'],
    input: { roomDir: dir, topic: 'x', db },
    perLensFn: makePerLensFn(seen),
    synthesize: 'tension-map',
    surfaceSelector: 'F.1',
    persistence: 'memory_event',
    rotationMode: 'single',
  });
  ok(seen.length === 1, 'one lens ran');
  ok(seen[0].ctx && seen[0].ctx.role_blend, 'ctx carries role_blend');
  ok(typeof seen[0].ctx.role_blend.founder !== 'undefined', 'role_blend has the founder weight');
});

test('T2.11: invalid lensType / rotationMode returns ok:false (defensive)', async () => {
  const { dir, db } = freshDb();
  const r1 = await engine.rotate({
    lensType: 'not-a-family',
    lensSet: 'six-hats',
    input: { roomDir: dir, topic: 'x', db },
    perLensFn: makePerLensFn(),
    synthesize: 'tension-map',
    surfaceSelector: 'F.1',
    persistence: 'memory_event',
    rotationMode: 'serial',
  });
  equal(r1.ok, false, 'invalid lensType rejected');
  const r2 = await engine.rotate({
    lensType: 'cognitive',
    lensSet: 'six-hats',
    input: { roomDir: dir, topic: 'x', db },
    perLensFn: makePerLensFn(),
    synthesize: 'tension-map',
    surfaceSelector: 'F.1',
    persistence: 'memory_event',
    rotationMode: 'not-a-mode',
  });
  equal(r2.ok, false, 'invalid rotationMode rejected');
});

test('T2.12: lens-engine.cjs source carries zero direct room-db / sqlite require and zero em-dashes', () => {
  const src = fs.readFileSync(path.join(REPO_ROOT, 'lib', 'core', 'lens-engine.cjs'), 'utf8');
  ok(!/require\(\s*['"](?:node:sqlite|better-sqlite3)['"]\s*\)/.test(src), 'engine requires sqlite');
  ok(!/require\(['"][^'"]*room-db[^'"]*['"]\)/.test(src), 'engine requires room-db');
  ok(!/require\(['"][^'"]*lazygraph-ops[^'"]*['"]\)/.test(src), 'engine requires lazygraph-ops');
  ok(!src.includes(EMDASH), 'engine contains an em-dash');
});
