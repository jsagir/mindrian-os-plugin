#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 213-06 -- the cross-surface Part-8 boundary sweep (EUREKA-07 closed).
 *
 * THE FENCE, PROVEN ACROSS EVERY 213 SURFACE
 *   Every surface Phase 213 minted crosses ONLY opaque node handles, closed-enum
 *   members, and quantized scalars -- never a byte of user prose. This suite is
 *   the fence. It REUSES the Phase 196 classify() guard
 *   (lib/core/part8-egress-guard.cjs) across all four surfaces; it NEVER declares
 *   a second auditor (PB8-02: a new pattern lands in the Canon source, not here).
 *
 * THE FOUR SURFACES (each arm hermetic: injected fns + temp dirs, no live model):
 *   (a) SIDE-CHANNEL  -- the plan-02 runEurekaScan writer, driven with a poisoned
 *       injected pair (sentinel prose in the text fields). The written
 *       last-eureka.json must contain NO sentinel byte anywhere: the closed-key
 *       writer carries only handles / enums / quantized scalars; content never
 *       crosses. classify() the written payload -> not blocked.
 *   (b) OFFER          -- composeEurekaOffer over opaque handles. classify() the
 *       offer.text AND the full offer object as if Brain-bound -> no violation,
 *       plus the token-whitelist re-check (every non-template token is a handle or
 *       a DIRECTION_ENUM member). A POISONED recommend seam proves prose from the
 *       Brain leg still never reaches the rendered text.
 *   (c) APO SIGNAL     -- the ctx.compression seam the plan-05 blend consumes
 *       carries ONLY { activated, scoreFor } and the blend consumes a SCALAR
 *       (shape-level assertion; the meter score is a number, never an object).
 *   (d) GRILL ANNOTATION -- the plan-05 armA eureka_signal attaches ONLY closed-
 *       enum members; re-drive the drop arm through classify(). A non-enum /
 *       prose-bearing signal drops the ENTIRE annotation (T-213-16).
 *
 * Pure CJS, node built-ins only. Bare node assert. No em-dashes.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');

// REUSE the Phase 196 guard -- never a second auditor.
const part8 = require(path.join(REPO, 'lib', 'core', 'part8-egress-guard.cjs'));
const { classify } = part8;

const runner = require(path.join(REPO, 'lib', 'core', 'eureka', 'eureka-reach-runner.cjs'));
const offerMod = require(path.join(REPO, 'lib', 'core', 'eureka', 'eureka-offer.cjs'));
const { composeEurekaOffer, DIRECTION_ENUM, OFFER_TEMPLATE } = offerMod;
const meter = require(path.join(REPO, 'lib', 'core', 'eureka', 'compression-meter.cjs'));
const apo = require(path.join(REPO, 'lab', 'apo', 'apo-loop.cjs'));
const grill = require(path.join(REPO, 'lib', 'core', 'grill-engine.cjs'));

// A distinctive user-prose SENTINEL. If any byte of this ever survives onto a 213
// surface, the fence has failed. Assembled from fragments so the string itself is
// unmistakably prose (never a handle or an enum member).
const SENTINEL = 'CONFIDENTIAL_ROOM_PROSE_' + 'do_not_egress_' + 'acme_secret_margin_47pct';

let PASS = 0;
let FAIL = 0;
function ok(label, fn) {
  Promise.resolve()
    .then(fn)
    .then(function () { console.log('ok   ' + label); PASS += 1; })
    .catch(function (e) { console.log('FAIL ' + label + ' -- ' + (e && e.message ? e.message : e)); FAIL += 1; });
}

// A hermetic STUB critic (the criticProbeFn seam): clears Stage A, rules high
// confidence, never touches a real model or the live 212 critic.
function stubCritic() {
  return {
    loadCriticTags: function () { return { schema_version: 1, verdicts: [], domain_tags: [] }; },
    stageA: async function () { return { pass: true }; },
    assembleCriticPayload: function () { return {}; },
    criticRule: function () { return { confidence: 'high', reasoning_tag: 'passes_all_gates' }; },
  };
}

// An injected scorer returning a passing, firing-band measured result (so the
// writer never invokes the real scoreMeasured / any model).
async function firingScoreFn() {
  return {
    passes: true,
    abs_diff: 0.57,
    band: 'breakthrough',
    direction: 'structural_transfer',
    semantic: 0.42,
    lexical: 0.11,
    provenance: { semantic_model: 'mdbr-leaf-ir' },
  };
}

// ---------------------------------------------------------------------------
// (a) SIDE-CHANNEL: the writer with a poisoned pair; content must never cross.
// ---------------------------------------------------------------------------

ok('(a) side-channel: poisoned pair -> no sentinel byte in last-eureka.json', async function () {
  const roomDir = fs.mkdtempSync(path.join(os.tmpdir(), 'eureka-boundary-a-'));
  try {
    const poisonedPair = [
      { handle: 'n042', text: SENTINEL + ' arterial territories atlas full mechanism narrative' },
      { handle: 'n317', text: SENTINEL + ' embolic gel delivery divergent secret prose' },
    ];
    const res = await runner.runEurekaScan({
      roomDir: roomDir,
      pair: poisonedPair,
      scoreFn: firingScoreFn,
      criticProbeFn: async function () { return stubCritic(); },
      now: Date.parse('2026-07-10T12:00:00.000Z'),
    });
    assert.strictEqual(res.fired, true, 'writer should fire on a passing pair: ' + res.reason);
    const raw = fs.readFileSync(res.sideChannelPath, 'utf8');
    assert.strictEqual(raw.indexOf(SENTINEL), -1, 'sentinel prose leaked into the side-channel file');
    // Only handles / enums / quantized scalars survived.
    const written = JSON.parse(raw);
    assert.strictEqual(written.bridge.a_handle, 'n042');
    assert.strictEqual(written.bridge.b_handle, 'n317');
    assert.ok(runner.validateClosedSchema(written), 'written payload must satisfy the closed schema');
    // classify() the written payload as if Brain-bound -> not blocked (no content set).
    const v = classify(written, { toolName: 'brain_ask' });
    assert.notStrictEqual(v.verdict, 'block', 'side-channel payload must not trip the content-set guard');
  } finally {
    fs.rmSync(roomDir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// (b) OFFER: the composed offer text + object cross clean; prose never leaks.
// ---------------------------------------------------------------------------

function validOfferPayload() {
  return {
    schema_version: 1,
    scanned_at: '2026-07-10T12:00:00.000Z',
    guard: { available: true, verdict: 'transferable', confidence: 'high', tags: ['passes_all_gates'] },
    bridge: {
      a_handle: 'n042', b_handle: 'n317', surprise_type: 'structural_transfer',
      band: 'breakthrough', differential_quantized: 0.57,
    },
    provenance: { model: 'mdbr-leaf-ir', method: 'scoreMeasured+stageA' },
  };
}

ok('(b) offer: text + full object classify clean; token-whitelist holds', function () {
  // Clean, generic-framework seams (no prose smuggling).
  const offer = composeEurekaOffer({
    payload: validOfferPayload(),
    recommendFn: function () { return ['Beautiful Question Framework']; },
    composeWorkflowFn: function (chain) { return chain.map(function (f) { return { framework: f, command: null, optional: true }; }); },
  });
  assert.ok(offer && typeof offer === 'object', 'offer should compose');

  // classify() the offer.text as if Brain-bound (free-form) -> not blocked.
  const vText = classify({ question: offer.text }, { toolName: 'brain_ask' });
  assert.notStrictEqual(vText.verdict, 'block', 'offer text must not trip the content-set guard');
  // classify() the FULL offer object -> not blocked.
  const vObj = classify(offer, { toolName: 'brain_ask' });
  assert.notStrictEqual(vObj.verdict, 'block', 'full offer object must not trip the content-set guard');

  // Token-whitelist re-check: every non-template token in the rendered text is a
  // known handle or a DIRECTION_ENUM member -- nothing else survives.
  const handles = [offer.a_handle, offer.b_handle];
  const templateTokens = new Set(
    OFFER_TEMPLATE
      .replace('{{A}}', ' ').replace('{{B}}', ' ').replace('{{DIR}}', ' ')
      .toLowerCase().replace(/[^a-z0-9_?]+/g, ' ').split(/\s+/).filter(Boolean)
  );
  const textTokens = offer.text.toLowerCase().replace(/[^a-z0-9_?]+/g, ' ').split(/\s+/).filter(Boolean);
  const allowed = new Set(templateTokens);
  handles.forEach(function (h) { allowed.add(String(h).toLowerCase()); });
  DIRECTION_ENUM.forEach(function (d) { d.toLowerCase().split(/[^a-z0-9_]+/).forEach(function (p) { if (p) allowed.add(p); }); });
  textTokens.forEach(function (tok) {
    assert.ok(allowed.has(tok), 'unexpected token in offer text (not template/handle/enum): ' + tok);
  });
});

ok('(b) offer: a POISONED recommend seam still never leaks prose into the text', function () {
  const offer = composeEurekaOffer({
    payload: validOfferPayload(),
    // The Brain leg tries to smuggle sentinel prose through the chain names.
    recommendFn: function () { return [SENTINEL + ' framework']; },
    composeWorkflowFn: function (chain) { return chain.map(function (f) { return { framework: f, command: null, optional: true }; }); },
  });
  assert.ok(offer && typeof offer === 'object', 'offer should still compose');
  assert.strictEqual(offer.text.indexOf(SENTINEL), -1, 'poisoned Brain prose leaked into the rendered offer text');
});

// ---------------------------------------------------------------------------
// (c) APO SIGNAL: the compression seam carries only { activated, scoreFor } and
// the blend consumes a SCALAR (shape-level assertion).
// ---------------------------------------------------------------------------

ok('(c) apo signal: ctx.compression seam is { activated, scoreFor } and yields a scalar', function () {
  const candidate = { id: 'c1', quality: 0.8 };
  // The seam the plan-05 blend consumes -- exactly two keys, scoreFor a function
  // returning the meter's numeric score (never an object, never prose).
  const seam = {
    activated: true,
    scoreFor: function (cand) {
      return meter.compressionScore({ compressionDelta: 0.5, guardEvents: [], statusQuoEvents: [], arrival: null });
    },
  };
  assert.deepStrictEqual(Object.keys(seam).sort(), ['activated', 'scoreFor'], 'seam must carry ONLY activated + scoreFor');
  const raw = seam.scoreFor(candidate);
  assert.strictEqual(typeof raw, 'number', 'scoreFor must yield a scalar number, never an object/prose');
  assert.ok(Number.isFinite(raw), 'the compression score must be finite');
  // The blend consumes it as a bounded scalar in [0,1] -- no object crosses.
  const term = apo.compressionTerm(candidate, seam);
  assert.strictEqual(typeof term, 'number', 'the blend term must be a scalar');
  assert.ok(term >= 0 && term <= 1, 'the blend term is bounded to [0,1]');
});

// ---------------------------------------------------------------------------
// (d) GRILL ANNOTATION: eureka_signal attaches only closed-enum members.
// ---------------------------------------------------------------------------

ok('(d) grill: valid eureka_signal attaches ONLY the three enum members; classify clean', function () {
  const claim = 'The device reduces recovery time by roughly 40 percent versus the incumbent.';
  const result = grill.armA(claim, {
    eurekaSignal: {
      guard_verdict: 'transferable',
      band: 'breakthrough',
      surprise_type: 'structural_transfer',
      // an extra prose field the attacker hopes rides along:
      leaked_note: SENTINEL,
    },
  });
  assert.ok(result.eureka_signal, 'a fully enum-valid signal should attach');
  assert.deepStrictEqual(
    Object.keys(result.eureka_signal).sort(),
    ['band', 'guard_verdict', 'surprise_type'],
    'only the three closed-enum members may attach -- no extra prose key'
  );
  const v = classify(result.eureka_signal, { toolName: 'brain_ask' });
  assert.notStrictEqual(v.verdict, 'block', 'the enum-only annotation must not trip the content-set guard');
});

ok('(d) grill: a prose-bearing / non-enum signal drops the ENTIRE annotation (T-213-16)', function () {
  const claim = 'The device reduces recovery time by roughly 40 percent versus the incumbent.';
  const result = grill.armA(claim, {
    eurekaSignal: { guard_verdict: 'transferable', band: SENTINEL, surprise_type: 'structural_transfer' },
  });
  assert.strictEqual(result.eureka_signal, undefined, 'a non-enum band must drop the whole annotation');
});

// ---------------------------------------------------------------------------
// Summary (deferred a tick so the async arms settle).
// ---------------------------------------------------------------------------
setTimeout(function () {
  console.log('');
  console.log('test-213-part8-boundary: PASS=' + PASS + ' FAIL=' + FAIL);
  process.exit(FAIL === 0 ? 0 : 1);
}, 250);
