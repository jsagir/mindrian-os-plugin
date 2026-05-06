'use strict';
// Phase 116-02 Wave 2 -- F.1 three-surface render determinism (AC-8 automated portion).
// Manual cross-surface smoke (CLI / Desktop / Cowork) per 116-VALIDATION.md.
//
// The shape-f1 renderer is pure CJS with zero surface-specific code paths;
// identical input produces byte-identical output regardless of CLI / Desktop /
// Cowork (D-08 verified via 88.2-05 selector-dispatcher tri-polar ship). We
// assert that property here by calling pickShape twice with identical inputs
// and comparing the rendered.zones.body for byte-equal output. Together with
// the pure-CJS / no-FS-read invariant of the renderer, this is sufficient to
// prove the AC-8 automated portion.

const test = require('node:test');
const assert = require('node:assert/strict');
const dispatcher = require('../lib/hmi/selector-dispatcher.cjs');
const { F1_VERBS, F1_HEADER } = require('../lib/agents/tension-hook-agent.cjs');

function basePayload() {
  return {
    verbs: F1_VERBS.slice(),
    header: F1_HEADER,
    recommendedVerb: null,
    emitTelemetry: false,
  };
}

// =====================================================================
// Test 1: byte-identical determinism -- the load-bearing assertion
// =====================================================================

test('116-02 rendering Test 1: byte-identical render on repeated pickShape calls (D-08 determinism)', () => {
  const r1 = dispatcher.pickShape({
    requestedShape: 'F.1',
    tier: 1,
    operator: null,
    payload: basePayload(),
  });
  const r2 = dispatcher.pickShape({
    requestedShape: 'F.1',
    tier: 1,
    operator: null,
    payload: basePayload(),
  });
  assert.equal(r1.shape, 'F.1');
  assert.equal(r2.shape, 'F.1');
  // body must be byte-identical -- this is the cross-surface determinism guarantee
  assert.equal(r1.rendered.zones.body, r2.rendered.zones.body);
});

// =====================================================================
// Test 2: contract.verbs cap + Free-Text auto-append
// =====================================================================

test('116-02 rendering Test 2: contract.verbs equals [Resolve, Later, Skip, Free-Text] (3 user verbs + Free-Text)', () => {
  const r = dispatcher.pickShape({
    requestedShape: 'F.1',
    tier: 1,
    operator: null,
    payload: basePayload(),
  });
  assert.equal(r.shape, 'F.1');
  assert.deepEqual(r.rendered.contract.verbs, ['Resolve', 'Later', 'Skip', 'Free-Text']);
});

// =====================================================================
// Test 3: contract.shape literal
// =====================================================================

test('116-02 rendering Test 3: contract.shape === "F.1"', () => {
  const r = dispatcher.pickShape({
    requestedShape: 'F.1',
    tier: 1,
    operator: null,
    payload: basePayload(),
  });
  assert.equal(r.rendered.contract.shape, 'F.1');
});

// =====================================================================
// Test 4: contract.keyboard binding to AskUserQuestion primitive
// =====================================================================

test('116-02 rendering Test 4: contract.keyboard === "askuserquestion" (Phase 88.2 invariant)', () => {
  const r = dispatcher.pickShape({
    requestedShape: 'F.1',
    tier: 1,
    operator: null,
    payload: basePayload(),
  });
  assert.equal(r.rendered.contract.keyboard, 'askuserquestion');
});

// =====================================================================
// Test 5: tier=1 (Mode B) -> recommended:null + zero recommendation markers
// =====================================================================

test('116-02 rendering Test 5: tier=1 (Mode B) -> recommended is null; body has no recommendation markers', () => {
  const r = dispatcher.pickShape({
    requestedShape: 'F.1',
    tier: 1,
    operator: null,
    payload: basePayload(),
  });
  assert.equal(r.rendered.contract.recommended, null);
  // ▷ rows yes; ▶ recommendation marker no (per Phase 116 D-02 neutral)
  const body = r.rendered.zones.body;
  assert.ok(body.indexOf('▷') !== -1, 'body should contain row marker ▷');
  assert.equal(body.indexOf('▶'), -1, 'body must not contain RECOMMENDED marker ▶ (D-02 neutral)');
});

// =====================================================================
// Test 6: tier=2 (Mode A) with recommendedVerb:null -> still recommended:null
// =====================================================================

test('116-02 rendering Test 6: tier=2 (Mode A) recommendedVerb:null -> recommended stays null (D-02)', () => {
  const r = dispatcher.pickShape({
    requestedShape: 'F.1',
    tier: 2,
    operator: null,
    payload: basePayload(),
  });
  // Phase 116 deliberately sends recommendedVerb:null even in Mode A.
  // The contract must NOT auto-recommend; recommended stays null.
  assert.equal(r.rendered.contract.recommended, null);
});

// =====================================================================
// Test 7: header carries the canonical De Stijl substring
// =====================================================================

test('116-02 rendering Test 7: rendered.zones.header contains "-- mindrianOS --"', () => {
  const r = dispatcher.pickShape({
    requestedShape: 'F.1',
    tier: 1,
    operator: null,
    payload: basePayload(),
  });
  assert.ok(r.rendered.zones.header.indexOf('-- mindrianOS --') !== -1);
});

// =====================================================================
// Test 8: caller-provided Free-Text de-duplicates (renderer auto-appends)
// =====================================================================

test('116-02 rendering Test 8: pickShape with verbs=[3 user] vs [3 user + Free-Text] -> identical output (de-dup)', () => {
  const a = dispatcher.pickShape({
    requestedShape: 'F.1',
    tier: 1,
    operator: null,
    payload: { verbs: ['Resolve', 'Later', 'Skip'], header: F1_HEADER, recommendedVerb: null, emitTelemetry: false },
  });
  const b = dispatcher.pickShape({
    requestedShape: 'F.1',
    tier: 1,
    operator: null,
    payload: { verbs: ['Resolve', 'Later', 'Skip', 'Free-Text'], header: F1_HEADER, recommendedVerb: null, emitTelemetry: false },
  });
  assert.deepEqual(a.rendered.contract.verbs, b.rendered.contract.verbs);
  assert.equal(a.rendered.zones.body, b.rendered.zones.body);
});

// =====================================================================
// Test 9: tier=0 -> error envelope (tier-0-refused short-circuit)
// =====================================================================

test('116-02 rendering Test 9: tier=0 -> {shape:error, rendered:{error:tier-0-refused}}', () => {
  const r = dispatcher.pickShape({
    requestedShape: 'F.1',
    tier: 0,
    operator: null,
    payload: basePayload(),
  });
  assert.equal(r.shape, 'error');
  assert.ok(r.rendered.error, 'tier=0 must surface an error code');
  assert.equal(r.rendered.error, 'tier-0-refused');
});

// =====================================================================
// Test 10: JUST_TALK at tier>=1 -> error envelope (compaction violation)
// =====================================================================

test('116-02 rendering Test 10: operator=JUST_TALK at tier=1 -> {shape:error, rendered:{error:render_v2_compaction_violation}}', () => {
  const r = dispatcher.pickShape({
    requestedShape: 'F.1',
    tier: 1,
    operator: 'JUST_TALK',
    payload: basePayload(),
  });
  assert.equal(r.shape, 'error');
  assert.ok(r.rendered.error, 'JUST_TALK must surface an error code');
  assert.equal(r.rendered.error, 'render_v2_compaction_violation');
});
