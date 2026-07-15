'use strict';
/*
 * Phase 224-03 Task 1 -- backfill deriver swap (D-03 amended) + D-04 disclosure.
 * ============================================================================
 * Proves runDeriveBackfill's DEFAULT deriver is now the SCORE-BASED producer
 * (graph-derive-classifier.scoreBasedDeriveFn driving the untouched Phase-169
 * runDerivation composer over full-pairwise buildAllPairs), not the keyword-cue
 * regex that emitted zero edges on normal prose:
 *
 *   Test 1: the b2-journey fixture (0 typed edges) moves 0 -> N with a
 *     deterministic injected high-cosine encodeFn; every derived cascade edge
 *     carries review_status 'proposed' (Req 2 + Req 4).
 *   Test 2 (Ralph invariant): a second identical backfill leaves the count
 *     UNCHANGED (writeEdge ON CONFLICT no-op + GDH-07 node guard).
 *   Test 3 (D-04): a forced encoder-unavailable backfill performs ZERO scoring,
 *     leaves the count unchanged, sets result.skipped 'encoder_unavailable', and
 *     logs exactly one derivation_skipped disclosure marker.
 *   Test 4: with NO deriveFn injected the default resolves to the score-based
 *     producer (source assertion: the default path requires graph-derive-classifier);
 *     the score path connects two SEMANTICALLY related framings that share no
 *     cascade cue verb -- the exact keyword-regex failure mode, inverted.
 *
 * DETERMINISTIC: the injected encodeFn maps the two related framings to a shared
 * unit vector (cosine 1.0 -> CONVERGES) and every other artifact to a distinct
 * orthogonal basis vector (cosine 0 -> null), so NO real encoder is needed in CI
 * and there are zero false positives. No em-dashes (CLAUDE.md HARD RULE).
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const { runDeriveBackfill } = require(path.join(REPO_ROOT, 'lib', 'core', 'graph-backfill.cjs'));
const classifier = require(path.join(REPO_ROOT, 'lib', 'core', 'graph-derive-classifier.cjs'));
const { buildFixtureRoom224 } = require(path.join(REPO_ROOT, 'tests', 'helpers', 'fixture-room-224.cjs'));
const { openRoomDb, closeRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));

const CASCADE = ['CONVERGES', 'INFORMS', 'CONTRADICTS', 'INVALIDATES', 'ENABLES', 'REFINES', 'ROOT_CAUSES'];

let pass = 0;
function check(label, cond) {
  assert.ok(cond, label);
  pass += 1;
  console.log('  ok -', label);
}

// A deterministic, encoder-free deriveFn: wraps the SHIPPED scoreBasedDeriveFn
// with an injected encodeFn so the classifier + scorer path runs for real but the
// cosine is fully determined by the text. The two related framings share a unit
// vector (cosine 1.0 -> CONVERGES); every other artifact gets its own orthogonal
// basis vector (cosine 0 -> null). Declared ASYNC so the backfill takes the
// score-based (Promise-returning) path, exactly like the production default.
function makeDeterministicDeriveFn() {
  const seen = new Map();
  let nextIdx = 2;
  const DIM = 48;
  function vecFor(text) {
    const v = new Array(DIM).fill(0);
    const t = String(text || '');
    const related = t.indexOf('Meal-Kit Subscription Venture') !== -1
      || t.indexOf('Home Cooking Delivery Concept') !== -1;
    if (related) { v[0] = 1; return v; }
    if (!seen.has(t)) { seen.set(t, nextIdx); nextIdx += 1; }
    v[seen.get(t) % DIM] = 1;
    return v;
  }
  const encodeFn = (texts) => texts.map(vecFor);
  return async function derive(step) {
    return classifier.scoreBasedDeriveFn(step, { scoreOpts: { encodeFn: encodeFn } });
  };
}

function selectCascadeEdges(roomDir) {
  const db = openRoomDb(roomDir);
  try {
    return db.prepare(
      'SELECT source, target, type, review_status FROM edges WHERE type IN (' +
      CASCADE.map(() => '?').join(',') + ')'
    ).all(...CASCADE);
  } finally {
    closeRoomDb(db);
  }
}

function selectSkipMarkers(roomDir) {
  const db = openRoomDb(roomDir);
  try {
    return db.prepare(
      "SELECT properties FROM nodes WHERE type = 'memory_event' " +
      "AND json_extract(properties, '$.event_type') = 'derivation_skipped'"
    ).all();
  } finally {
    closeRoomDb(db);
  }
}

async function main() {
  console.log('test-224-backfill-idempotent (D-03 deriver swap + D-04 disclosure)');

  // --- Test 1: 0 -> N + proposed-only (Req 2 + Req 4). ---
  const tmp1 = fs.mkdtempSync(path.join(os.tmpdir(), 'backfill-224-'));
  const fx1 = await buildFixtureRoom224(tmp1);
  const res1 = await runDeriveBackfill({
    roomDir: fx1.roomDir,
    approvedBy: 'test-navigator',
    deriveFn: makeDeterministicDeriveFn(),
  });
  check('the backfill returns a result object', res1 && typeof res1 === 'object');
  check('typedEdgesBefore is 0 on the untouched b2-journey fixture', res1.typedEdgesBefore === 0);
  check('typedEdgesAfter is N > 0 (the score-based default derived real edges)', res1.typedEdgesAfter > 0);

  const edges1 = selectCascadeEdges(fx1.roomDir);
  check('at least one cascade edge landed', edges1.length > 0);
  check("EVERY derived cascade edge carries review_status 'proposed' (Req 4)",
    edges1.every((e) => e.review_status === 'proposed'));

  // --- Test 2: Ralph invariant (second run does not grow the count). ---
  const res2 = await runDeriveBackfill({
    roomDir: fx1.roomDir,
    approvedBy: 'test-navigator',
    deriveFn: makeDeterministicDeriveFn(),
  });
  check('a second identical backfill leaves typedEdgesAfter unchanged (Ralph invariant)',
    res2.typedEdgesAfter === res1.typedEdgesAfter);
  check('the cascade-edge row count did NOT grow on the re-run',
    selectCascadeEdges(fx1.roomDir).length === edges1.length);

  // --- Test 3: D-04 encoder-unavailable skip + disclosure (default path). ---
  const tmp3 = fs.mkdtempSync(path.join(os.tmpdir(), 'backfill-224-skip-'));
  const fx3 = await buildFixtureRoom224(tmp3, { artifactCount: 5 });
  const before3 = res3TypedBefore(fx3.roomDir);
  const res3 = await runDeriveBackfill({
    roomDir: fx3.roomDir,
    approvedBy: 'test-navigator',
    probeOpts: { _forceUnavailable: true },
  });
  check("result.skipped names 'encoder_unavailable' (D-04)", res3.skipped === 'encoder_unavailable');
  check('the typed-edge count is unchanged after an encoder skip',
    res3.typedEdgesAfter === res3.typedEdgesBefore && res3.typedEdgesAfter === before3);
  check('ZERO cascade edges were written on the skip', selectCascadeEdges(fx3.roomDir).length === 0);

  const markers = selectSkipMarkers(fx3.roomDir);
  // Tolerant per the plan: the derivation_skipped EVENT_TYPES member shipped in
  // Plan 02, so the real row is expected; a pre-Plan-02 tree would swallow the
  // invalid_event_type envelope and write zero.
  check('exactly one derivation_skipped disclosure marker was logged', markers.length === 1);
  const payload = JSON.parse(markers[0].properties);
  check("the marker reason is 'encoder_unavailable'", payload.reason === 'encoder_unavailable');

  // --- Test 4a: source assertion -- the default path requires the classifier. ---
  const src = fs.readFileSync(path.join(REPO_ROOT, 'lib', 'core', 'graph-backfill.cjs'), 'utf8');
  const stripped = stripComments(src);
  check('the backfill source requires graph-derive-classifier on an executable line',
    /require\(\s*['"]\.\/graph-derive-classifier\.cjs['"]\s*\)/.test(stripped));
  check('the deriveFn default line no longer names _localCueDeriveFn',
    !/deriveFn[^\n]*=[^\n]*_localCueDeriveFn/.test(stripped));

  // --- Test 4b: score path connects two semantically related framings. ---
  const tmp4 = fs.mkdtempSync(path.join(os.tmpdir(), 'backfill-224-inv-'));
  const fx4 = await buildFixtureRoom224(tmp4, { artifactCount: 6 });
  await runDeriveBackfill({
    roomDir: fx4.roomDir,
    approvedBy: 'test-navigator',
    deriveFn: makeDeterministicDeriveFn(),
  });
  const aId = classifier._test.artifactId(fx4.roomDir, fx4.relatedPair.a);
  const bId = classifier._test.artifactId(fx4.roomDir, fx4.relatedPair.b);
  const edges4 = selectCascadeEdges(fx4.roomDir);
  const relatedEdge = edges4.find((e) =>
    (e.source === aId && e.target === bId) || (e.source === bId && e.target === aId));
  check('the score-based producer derived an edge between the two related framings (keyword-regex failure inverted)',
    !!relatedEdge);
  check('that derived edge is CONVERGES and proposed',
    relatedEdge && relatedEdge.type === 'CONVERGES' && relatedEdge.review_status === 'proposed');

  console.log(`\nPASS (${pass}/${pass})`);
}

// Count typed edges before a run (mirrors the backfill's own before-count so the
// test can assert the skip left the moat untouched).
function res3TypedBefore(roomDir) {
  return selectCascadeEdges(roomDir).length;
}

// A minimal comment stripper: removes /* ... */ block comments and // ... line
// comments so a source assertion runs over executable lines only.
function stripComments(src) {
  const noBlock = src.replace(/\/\*[\s\S]*?\*\//g, '');
  return noBlock
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/, ''))
    .join('\n');
}

main().catch((e) => {
  console.error('FAIL', e && e.stack ? e.stack : e);
  process.exit(1);
});
