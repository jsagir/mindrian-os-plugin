#!/usr/bin/env node
'use strict';

/**
 * Phase 262 Plan 02 (D-04, "The Theo Flip" tripwire) -- the hermetic proof
 * this suite exists to write.
 * ==========================================================================
 * This suite proves that a probe whose HTTP call SUCCEEDED but whose payload
 * check-flagship-floor.cjs cannot read produces a loud VOID (exit 3), never
 * a silent false MISS -- both at the pure evaluateFloor layer (Layer A) and
 * at the probeFramework layer fed Theo's real response shapes over a
 * loopback capture server (Layer B). The two Theo payload shapes below are
 * quoted verbatim from Theo/src/mcp/content/normalize-framework-name.ts and
 * Theo/src/mcp/content/orchestration-readiness.ts as read on 2026-09-02. The
 * capture server is loopback-only (127.0.0.1, ephemeral port); Canon Part 8
 * holds because nothing leaves this machine and the only argument this
 * suite ever sends is the generic framework name "Scenario Planning". This
 * suite is the hermetic discharge of 262-RESEARCH.md's assumption A6 (the
 * silent-false-RED composed outcome), proven here without theo-mcp.onrender.com
 * needing to serve traffic at all.
 *
 * No em-dashes.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  evaluateFloor,
  renderVoidDetailLines,
  renderFloorSummaryLines,
} = require('../scripts/check-flagship-floor.cjs');

// ---------------------------------------------------------------------------
// Fixture builders (duplicated from tests/test-259-floor-void.cjs per that
// suite's own header -- the existing repo norm for these three-line
// builders, Canon Part 7 duplication exception already called out there).
// ---------------------------------------------------------------------------
function fw(name, uses) {
  return { name, uses };
}

function probe(matches, score) {
  return { normalizeMatches: matches, readinessScore: score, normalizeOk: true, readinessOk: true };
}

function failing(kind, httpStatus, detail, whichProbe) {
  return {
    ...probe(null, null),
    failures: [{ probe: whichProbe || 'readiness', kind, httpStatus, detail }],
  };
}

const ALL_GREEN_FRAMEWORKS = [fw('Beautiful Question Framework', 5), fw('Problem Definition Transformation', 3), fw("Usher's Model", 2)];
const ALL_GREEN_PROBES = {
  'Beautiful Question Framework': probe(1, 4),
  'Problem Definition Transformation': probe(1, 4),
  "Usher's Model": probe(1, 3),
};

// ===========================================================================
// Layer A: pure, zero-I/O, against evaluateFloor directly.
// ===========================================================================

test('A1: a row with a failures[] entry of kind unrecognized_shape is VOID, not MISS', () => {
  const probes = {
    ...ALL_GREEN_PROBES,
    "Usher's Model": failing('unrecognized_shape', 200, 'normalize_framework_name payload carried no numeric canonical_matches length', 'normalize'),
  };
  const r = evaluateFloor(ALL_GREEN_FRAMEWORKS, probes);
  const row = r.rows.find((x) => x.name === "Usher's Model");
  assert.equal(row.verdict, 'VOID', 'an unrecognized_shape failure must VOID the row, never MISS');
});

test('A2: that result has voidCount=1, exitCode=3, and missCount does NOT include the row', () => {
  const probes = {
    ...ALL_GREEN_PROBES,
    "Usher's Model": failing('unrecognized_shape', 200, 'unreadable payload', 'readiness'),
  };
  const r = evaluateFloor(ALL_GREEN_FRAMEWORKS, probes);
  assert.equal(r.voidCount, 1);
  assert.equal(r.exitCode, 3);
  assert.equal(r.missCount, 0, 'the unrecognized_shape row must not be counted as a MISS');
});

test('A3: renderVoidDetailLines emits a line naming the row, the probe, and "unrecognized-shape" (hyphenated), never the raw token', () => {
  const rows = [
    {
      name: 'Scenario Planning', uses: 4, matches: null, score: null, verdict: 'VOID',
      failures: [{ probe: 'normalize', kind: 'unrecognized_shape', httpStatus: 200, detail: 'no numeric canonical_matches length' }],
    },
  ];
  const lines = renderVoidDetailLines(rows);
  assert.equal(lines.length, 1);
  assert.match(lines[0], /Scenario Planning/);
  assert.match(lines[0], /normalize/);
  assert.match(lines[0], /unrecognized-shape/, 'must render the hyphenated word from _KIND_WORD');
  assert.doesNotMatch(lines[0], /unrecognized_shape/, 'must never print the raw snake_case token');
});

test('A4: renderFloorSummaryLines emits the VOID banner, not the RED banner, when unrecognized_shape is present', () => {
  const probes = {
    ...ALL_GREEN_PROBES,
    "Usher's Model": failing('unrecognized_shape', 200, 'unreadable payload', 'normalize'),
  };
  const r = evaluateFloor(ALL_GREEN_FRAMEWORKS, probes);
  const lines = renderFloorSummaryLines(r);
  assert.equal(lines[lines.length - 1], '=== FLOOR RUN VOID (probe failures present, re-run required, this is NOT a floor verdict) ===');
  assert.notEqual(lines[lines.length - 1], '=== FLOOR DOES NOT HOLD (SWEEP-02 gate RED) ===');
});

test('A5 (no-regression): the three pre-existing kinds still VOID, and an all-clean fixture is exitCode=0 GREEN', () => {
  for (const kind of ['hard_error', 'timeout', 'malformed']) {
    const probes = { ...ALL_GREEN_PROBES, "Usher's Model": failing(kind, 429, 'x') };
    const r = evaluateFloor(ALL_GREEN_FRAMEWORKS, probes);
    assert.equal(r.rows.find((x) => x.name === "Usher's Model").verdict, 'VOID', `${kind} must still VOID`);
  }
  const clean = evaluateFloor(ALL_GREEN_FRAMEWORKS, ALL_GREEN_PROBES);
  assert.equal(clean.exitCode, 0);
  const lines = renderFloorSummaryLines(clean);
  assert.equal(lines[lines.length - 1], '=== FLOOR HOLDS (SWEEP-02 gate GREEN) ===');
});

// ===========================================================================
// Layer B: probeFramework against the loopback capture server serving
// Theo's real response shapes (and, for the misfire guard, the incumbent
// Brain's real shapes).
// ===========================================================================

const cap = require('./helpers/brain-capture-server.cjs');

// Envelope builder: an SSE `data: ` line wrapping the exact JSON-RPC result
// shape brainCall's parser expects (result.content[0].text is the payload,
// itself a JSON string -- double JSON.stringify, never hand-escaped quotes).
function sseEnvelope(payloadObj) {
  return (
    'data: ' +
    JSON.stringify({
      jsonrpc: '2.0',
      id: 2,
      result: { content: [{ type: 'text', text: JSON.stringify(payloadObj) }] },
    }) +
    '\n'
  );
}

function scriptEntry(payloadObj) {
  return { status: 200, body: sseEnvelope(payloadObj) };
}

// Theo's normalize_framework_name shape (Theo/src/mcp/content/normalize-framework-name.ts,
// read 2026-09-02): {canonical, matched_via, coverage}. No canonical_matches key at all.
const THEO_NORMALIZE_PAYLOAD = { canonical: 'Scenario Planning', matched_via: 'exact', coverage: 0.9 };

// Theo's orchestration_readiness shape (Theo/src/mcp/content/orchestration-readiness.ts,
// read 2026-09-02): {framework, score, ...}. No readiness wrapper.
const THEO_READINESS_PAYLOAD = {
  framework: 'Scenario Planning',
  score: 3,
  inputs: [],
  evidence: [],
  unsynced_inputs: ['pattern_known'],
  coverage: 0.75,
  diagnostics: [],
};

// Incumbent Brain's real shapes (measured live this session per 262-RESEARCH.md).
const INCUMBENT_NORMALIZE_PAYLOAD = { tool: 'normalize_framework_name', canonical_matches: ['Shell Scenario Planning Method'] };
const INCUMBENT_READINESS_PAYLOAD = {
  tool: 'orchestration_readiness',
  readiness: { name: 'Scenario Planning', readiness_score: 4, orchestration_status: 'ready', dimensions: {} },
};

// Edge case: canonical_matches present but empty, readiness_score present as 0.
// Zero is a measurement; a missing key is not.
const HONEST_MISS_NORMALIZE_PAYLOAD = { tool: 'normalize_framework_name', canonical_matches: [] };
const HONEST_MISS_READINESS_PAYLOAD = {
  tool: 'orchestration_readiness',
  readiness: { name: 'Scenario Planning', readiness_score: 0, orchestration_status: 'not_ready', dimensions: {} },
};

const DUMMY_KEY = 'test-key-not-a-real-secret';

test('Layer B: probeFramework against loopback capture server', async (t) => {
  const { server, url } = await cap.startCaptureServer();
  process.env.MINDRIAN_BRAIN_URL = url;
  delete require.cache[require.resolve('../scripts/build-brain-census.cjs')];
  delete require.cache[require.resolve('../scripts/check-flagship-floor.cjs')];
  const floor = require('../scripts/check-flagship-floor.cjs');

  t.after(async () => {
    await cap.stopCaptureServer(server);
  });

  await t.test('B1: Theo-shaped payloads (no canonical_matches key, no readiness wrapper) produce two unrecognized_shape failures', async () => {
    cap.resetToolScript();
    cap.resetCaptured();
    cap.setToolScript([scriptEntry(THEO_NORMALIZE_PAYLOAD), scriptEntry(THEO_READINESS_PAYLOAD)]);
    const result = await floor.probeFramework('Scenario Planning', DUMMY_KEY);
    assert.equal(result.failures.length, 2, 'both legs must degrade to unrecognized_shape, not silently to null with zero failures');
    assert.ok(result.failures.every((f) => f.kind === 'unrecognized_shape'));
    assert.ok(result.failures.some((f) => f.probe === 'normalize'));
    assert.ok(result.failures.some((f) => f.probe === 'readiness'));
  });

  await t.test('B2: feeding the B1 probe result into evaluateFloor yields VOID / exit 3, not the MISS-everything false RED', async () => {
    cap.resetToolScript();
    cap.resetCaptured();
    cap.setToolScript([scriptEntry(THEO_NORMALIZE_PAYLOAD), scriptEntry(THEO_READINESS_PAYLOAD)]);
    const probeResult = await floor.probeFramework('Scenario Planning', DUMMY_KEY);
    const frameworks = [fw('Scenario Planning', 4)];
    const r = floor.evaluateFloor(frameworks, { 'Scenario Planning': probeResult });
    assert.equal(r.rows[0].verdict, 'VOID');
    assert.equal(r.exitCode, 3);
    assert.notEqual(r.exitCode, 1, 'this must never be the silent false RED the flip would otherwise produce');
  });

  await t.test('B3 (misfire guard): the incumbent Brain shapes still produce failures: [] and evaluateFloor verdicts PASS', async () => {
    cap.resetToolScript();
    cap.resetCaptured();
    cap.setToolScript([scriptEntry(INCUMBENT_NORMALIZE_PAYLOAD), scriptEntry(INCUMBENT_READINESS_PAYLOAD)]);
    const probeResult = await floor.probeFramework('Scenario Planning', DUMMY_KEY);
    assert.deepStrictEqual(probeResult.failures, [], 'the tripwire must not misfire on the incumbent shape');
    assert.equal(probeResult.normalizeMatches, 1);
    assert.equal(probeResult.readinessScore, 4);
    const frameworks = [fw('Scenario Planning', 4)];
    const r = floor.evaluateFloor(frameworks, { 'Scenario Planning': probeResult });
    assert.equal(r.rows[0].verdict, 'PASS', 'the tripwire must not corrupt the live 20/28 measurement');
  });

  await t.test('B4 (honest-MISS guard): empty canonical_matches array and readiness_score=0 produce failures: [] and verdict MISS, not VOID', async () => {
    cap.resetToolScript();
    cap.resetCaptured();
    cap.setToolScript([scriptEntry(HONEST_MISS_NORMALIZE_PAYLOAD), scriptEntry(HONEST_MISS_READINESS_PAYLOAD)]);
    const probeResult = await floor.probeFramework('Scenario Planning', DUMMY_KEY);
    assert.deepStrictEqual(probeResult.failures, [], 'an empty array and a zero score are readable numeric values, not unrecognized shapes');
    assert.equal(probeResult.normalizeMatches, 0);
    assert.equal(probeResult.readinessScore, 0);
    const frameworks = [fw('Scenario Planning', 4)];
    const r = floor.evaluateFloor(frameworks, { 'Scenario Planning': probeResult });
    assert.equal(r.rows[0].verdict, 'MISS', 'zero is a measurement; a missing key is not');
  });
});
