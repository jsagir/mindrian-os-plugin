#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 213-04 -- the LarryReacts eureka OFFER composer contract suite.
 *
 * Every arm is HERMETIC: the recommend + composeWorkflow seams are INJECTED so
 * no live Brain and no registry dependence is needed for the degrade arms. ONE
 * arm (Test 5) uses the REAL composeWorkflow against the live
 * data/command-registry.json to pin the integration -- guarded with
 * fs.existsSync + a SKIP log so wave order / a missing registry never breaks
 * the suite.
 *
 *   1 valid transferable payload -> exactly ONE offer, direction in the enum,
 *     confidence === the input guard band (passthrough, never recomputed)
 *   2 text names both handles + the direction enum + a hedged question mark
 *   3 verdict not 'transferable' / payload absent / stale-shaped -> null (abstain)
 *   4 Brain unavailable (injected seed-only chain) -> offer emits, next.chain len 1
 *   5 a framework with no registry command -> workflow step { command:null,
 *     optional:true }, offer survives (real composeWorkflow contract, guarded)
 *   6 module never requires the chain runner + never executes (pure composition)
 *   + token-whitelist arm: every non-fixed-template token in the text is a
 *     sentinel handle or a DIRECTION_ENUM member -- nothing else survives
 *   + voice arm: ends in '?', no em-dash, no grading vocabulary (Canon Part 12)
 *
 * Pure CJS, node built-ins only. Bare node assert.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const OFFER_MODULE_PATH = path.join(REPO, 'lib', 'core', 'eureka', 'eureka-offer.cjs');
const REGISTRY_PATH = path.join(REPO, 'data', 'command-registry.json');

const offerMod = require(OFFER_MODULE_PATH);
const { composeEurekaOffer, DIRECTION_ENUM, OFFER_TEMPLATE } = offerMod;

let PASS = 0;
let FAIL = 0;
function ok(label, fn) {
  try {
    fn();
    console.log('ok   ' + label);
    PASS += 1;
  } catch (e) {
    console.log('FAIL ' + label + ' -- ' + (e && e.message ? e.message : e));
    FAIL += 1;
  }
}

// ---------- helpers ----------

// A valid plan-02 closed-schema payload (transferable, breakthrough, handles).
function validPayload(overrides) {
  const p = {
    schema_version: 1,
    scanned_at: '2026-07-10T12:00:00.000Z',
    guard: { available: true, verdict: 'transferable', confidence: 'high', tags: ['passes_all_gates'] },
    bridge: {
      a_handle: 'n042', b_handle: 'n317', surprise_type: 'structural_transfer',
      band: 'breakthrough', differential_quantized: 0.57,
    },
    provenance: { model: 'mdbr-leaf-ir', method: 'scoreMeasured+stageA' },
  };
  if (overrides && typeof overrides === 'function') overrides(p);
  return p;
}

// A hermetic seed-only recommend seam (Brain unavailable / offline).
function seedOnlyRecommend(seed) {
  return function () { return [seed]; };
}

// A hermetic composeWorkflow seam that mirrors the registry contract shape
// without touching the registry: every framework degrades to a null command.
function fakeComposeWorkflow(chain) {
  return chain.map(function (fw, i) {
    return { step: i + 1, framework: fw, command: null, optional: true };
  });
}

// Tokenize on whitespace, stripping surrounding non-word punctuation but KEEPING
// underscores (so 'structural_transfer' stays one token). '\w' includes '_'.
function tokenize(s) {
  return s.split(/\s+/)
    .map(function (t) { return t.replace(/^[^\w]+/, '').replace(/[^\w]+$/, ''); })
    .filter(function (t) { return t.length > 0; });
}

// ---------- Test 1: single offer, passthrough confidence ----------

ok('1 valid transferable payload -> exactly one offer, enum direction, passthrough confidence', function () {
  const offer = composeEurekaOffer({
    payload: validPayload(),
    recommendFn: seedOnlyRecommend('Beautiful Question Framework'),
    composeWorkflowFn: fakeComposeWorkflow,
  });
  assert.ok(offer && typeof offer === 'object', 'must emit an offer object');
  assert.ok(!Array.isArray(offer), 'single object, never a list');
  assert.strictEqual(Object.keys(offer).sort().join(','), 'a_handle,b_handle,confidence,direction,next,text', 'offer key set');
  assert.ok(DIRECTION_ENUM.indexOf(offer.direction) !== -1, 'direction is a DIRECTION_ENUM member');
  assert.strictEqual(offer.direction, 'structural_transfer');
  assert.strictEqual(offer.a_handle, 'n042');
  assert.strictEqual(offer.b_handle, 'n317');
  // D-02 passthrough: confidence === the input guard band, never re-derived.
  assert.strictEqual(offer.confidence, 'high', 'confidence passthrough from guard band');
  assert.ok(offer.next && Array.isArray(offer.next.chain) && Array.isArray(offer.next.workflow), 'next.chain + next.workflow present');
});

// Passthrough is genuine (a different band flows straight through, not normalized).
ok('1b confidence passthrough holds for a different band (medium)', function () {
  const offer = composeEurekaOffer({
    payload: validPayload(function (p) { p.guard.confidence = 'medium'; }),
    recommendFn: seedOnlyRecommend('Beautiful Question Framework'),
    composeWorkflowFn: fakeComposeWorkflow,
  });
  assert.ok(offer, 'must emit');
  assert.strictEqual(offer.confidence, 'medium', 'guard band flows straight through');
});

// ---------- Test 2: text names both handles + direction + hedged question ----------

ok('2 text names both handles, the direction enum, and ends in a hedged question', function () {
  const offer = composeEurekaOffer({
    payload: validPayload(),
    recommendFn: seedOnlyRecommend('Beautiful Question Framework'),
    composeWorkflowFn: fakeComposeWorkflow,
  });
  assert.ok(offer.text.indexOf('n042') !== -1, 'names a_handle');
  assert.ok(offer.text.indexOf('n317') !== -1, 'names b_handle');
  assert.ok(offer.text.indexOf('structural_transfer') !== -1, 'contains the direction enum wording');
  assert.ok(/\?\s*$/.test(offer.text), 'ends in a question mark (hedged, Part 12)');
});

// ---------- token-whitelist arm (the Part-8 fence made mechanical) ----------

ok('2b token-whitelist: only fixed-template tokens + handles + direction survive into the text', function () {
  const SENT_A = 'ZZHANDLEALPHA';
  const SENT_B = 'ZZHANDLEBETA';
  const offer = composeEurekaOffer({
    payload: validPayload(function (p) {
      p.bridge.a_handle = SENT_A;
      p.bridge.b_handle = SENT_B;
      p.bridge.surprise_type = 'semantic_implementation';
    }),
    recommendFn: seedOnlyRecommend('Beautiful Question Framework'),
    composeWorkflowFn: fakeComposeWorkflow,
  });
  // The fixed vocabulary is the template with the three placeholders removed.
  const fixedText = OFFER_TEMPLATE.replace('{{A}}', '').replace('{{B}}', '').replace('{{DIR}}', '');
  const fixedTokens = new Set(tokenize(fixedText));
  const allowed = new Set(DIRECTION_ENUM);
  const rendered = tokenize(offer.text);
  assert.ok(rendered.length > 0, 'text tokenizes');
  rendered.forEach(function (tok) {
    const isFixed = fixedTokens.has(tok);
    const isHandle = (tok === SENT_A || tok === SENT_B);
    const isDirection = allowed.has(tok);
    assert.ok(isFixed || isHandle || isDirection,
      'token "' + tok + '" is not fixed-template, a handle, or a DIRECTION_ENUM member');
  });
  // And both sentinels + the direction DID make it in (the fence is not vacuous).
  assert.ok(rendered.indexOf(SENT_A) !== -1 && rendered.indexOf(SENT_B) !== -1, 'both handles present');
  assert.ok(rendered.indexOf('semantic_implementation') !== -1, 'direction enum present');
});

// ---------- voice arm (Canon Part 12: hedged, never grades) ----------

ok('2c voice: hedged question, no em-dash, no grading vocabulary', function () {
  const offer = composeEurekaOffer({
    payload: validPayload(),
    recommendFn: seedOnlyRecommend('Beautiful Question Framework'),
    composeWorkflowFn: fakeComposeWorkflow,
  });
  assert.ok(/\?\s*$/.test(offer.text), 'hedged: ends in a question');
  const EM_DASH = String.fromCharCode(0x2014); // reference by code point (no literal em-dash in source)
  assert.strictEqual(offer.text.indexOf(EM_DASH), -1, 'no em-dash character');
  assert.strictEqual(/\b(great|excellent|well done)\b/i.test(offer.text), false, 'no grading vocabulary (Part 12)');
  // No imperative forcing verb ("you must" / "do this now").
  assert.strictEqual(/\b(must|now|immediately)\b/i.test(offer.text), false, 'no forcing imperative');
});

// ---------- Test 3: abstention arms ----------

ok('3 non-transferable verdict / absent / stale-shaped -> null (abstain)', function () {
  // non-transferable verdicts
  ['restatement', 'pseudoscience', 'general_shallow'].forEach(function (v) {
    const off = composeEurekaOffer({ payload: validPayload(function (p) { p.guard.verdict = v; }) });
    assert.strictEqual(off, null, 'verdict ' + v + ' must abstain');
  });
  // absent payload / args
  assert.strictEqual(composeEurekaOffer({ payload: null }), null, 'null payload');
  assert.strictEqual(composeEurekaOffer({}), null, 'no payload key');
  assert.strictEqual(composeEurekaOffer(), null, 'no args at all');
  assert.strictEqual(composeEurekaOffer(null), null, 'null args');
  // stale/malformed shape: missing guard, missing bridge, empty handle, bad enum
  assert.strictEqual(composeEurekaOffer({ payload: validPayload(function (p) { delete p.guard; }) }), null, 'missing guard');
  assert.strictEqual(composeEurekaOffer({ payload: validPayload(function (p) { delete p.bridge; }) }), null, 'missing bridge');
  assert.strictEqual(composeEurekaOffer({ payload: validPayload(function (p) { p.bridge.a_handle = ''; }) }), null, 'empty handle');
  assert.strictEqual(composeEurekaOffer({ payload: validPayload(function (p) { p.bridge.surprise_type = 'wild_leap'; }) }), null, 'unknown direction');
  assert.strictEqual(composeEurekaOffer({ payload: validPayload(function (p) { p.guard.confidence = 5; }) }), null, 'non-string confidence');
});

// ---------- Test 4: offline-full-function (Brain unavailable) ----------

ok('4 Brain unavailable (injected seed-only chain) -> offer emits, next.chain length 1', function () {
  const offer = composeEurekaOffer({
    payload: validPayload(),
    recommendFn: seedOnlyRecommend('Osborn-Parnes CPS'),
    composeWorkflowFn: fakeComposeWorkflow,
  });
  assert.ok(offer, 'offer still emits fully offline');
  assert.strictEqual(offer.next.chain.length, 1, 'seed-only chain of length 1');
  assert.strictEqual(offer.next.chain[0], 'Osborn-Parnes CPS');
  assert.strictEqual(offer.next.workflow.length, 1, 'one workflow step for the seed');
});

// A throwing recommend seam still yields a usable offline offer (degrade to seed).
ok('4b a throwing recommend seam degrades to the fallback seed, offer survives', function () {
  const offer = composeEurekaOffer({
    payload: validPayload(),
    recommendFn: function () { throw new Error('brain down'); },
    composeWorkflowFn: fakeComposeWorkflow,
  });
  assert.ok(offer, 'offer survives a recommend fault');
  assert.strictEqual(offer.next.chain.length, 1, 'degrades to a single fallback seed');
  assert.strictEqual(offer.next.chain[0], offerMod.FALLBACK_SEED);
});

// ---------- Test 5: real composeWorkflow contract (guarded integration pin) ----------

ok('5 a framework with no registry command -> { command:null, optional:true }, offer survives', function () {
  if (!fs.existsSync(REGISTRY_PATH)) {
    console.log('     SKIP 5 -- data/command-registry.json absent (integration pin skipped)');
    return;
  }
  const resolver = require(path.join(REPO, 'lib', 'workflow', 'command-resolver.cjs'));
  const BOGUS = 'NonexistentFrameworkZZZ-213-04';
  const offer = composeEurekaOffer({
    payload: validPayload(),
    recommendFn: seedOnlyRecommend(BOGUS),
    // real composeWorkflow against the live registry (the integration pin)
    composeWorkflowFn: resolver.composeWorkflow,
  });
  assert.ok(offer, 'offer survives a no-command framework');
  assert.strictEqual(offer.next.workflow.length, 1, 'one step');
  const step = offer.next.workflow[0];
  assert.strictEqual(step.framework, BOGUS);
  assert.strictEqual(step.command, null, 'degrades to a null command (composeWorkflow contract)');
  assert.strictEqual(step.optional, true, 'optional true for a manual-only step');
});

// ---------- Test 6: pure composition, never executes ----------

ok('6 module never requires the chain runner and never executes a command', function () {
  const src = fs.readFileSync(OFFER_MODULE_PATH, 'utf8');
  // Strip block + line comments so the fence is on CODE, not house-comments.
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/[^\n]*/g, '');
  assert.strictEqual(/require\([^)]*chain-executor/.test(code), false, 'no chain-executor require in code');
  assert.strictEqual(/require\([^)]*run-chain/.test(code), false, 'no run-chain require in code');
  assert.strictEqual(/\brunChain\s*\(/.test(code), false, 'never calls runChain');
  // Behavioral: the composeWorkflow seam is called with a framework-name array
  // (data), never invoked to execute anything. Prove the seam sees only strings.
  let sawArray = null;
  const offer = composeEurekaOffer({
    payload: validPayload(),
    recommendFn: seedOnlyRecommend('Beautiful Question Framework'),
    composeWorkflowFn: function (chain) {
      sawArray = chain;
      return fakeComposeWorkflow(chain);
    },
  });
  assert.ok(offer, 'offer emitted');
  assert.ok(Array.isArray(sawArray) && sawArray.every(function (x) { return typeof x === 'string'; }),
    'composeWorkflow seam received framework NAMES only (composition, not execution)');
  // The returned workflow is inert data (no function-typed fields to trigger).
  offer.next.workflow.forEach(function (step) {
    Object.keys(step).forEach(function (k) {
      assert.notStrictEqual(typeof step[k], 'function', 'no executable field on a workflow step');
    });
  });
});

// ---------- run ----------

console.log('\nPASS=' + PASS + ' FAIL=' + FAIL);
process.exit(FAIL === 0 ? 0 : 1);
