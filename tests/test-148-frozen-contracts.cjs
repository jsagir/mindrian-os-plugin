'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 148-04 -- IRW-07 frozen-contracts + no-bespoke-widget audit.
 * =================================================================
 * The selector re-wire MUST NOT drift the frozen constitutional constants and
 * MUST NOT build a bespoke AskUserQuestion payload outside the single sanctioned
 * door (selector-dispatcher.cjs, SEED-020). This suite is the IRW-07 fence:
 *
 *   Constants:
 *     f-selector-ranker.MAX_K            === 3     (the chooser-row budget; FROZEN)
 *     dial-reach-orchestrator.RECOMMEND_FLOOR === 0.70 (the recommend gate; FROZEN)
 *     dial-reach-orchestrator.MARGIN_THRESHOLD === 0.15 (the margin gate; FROZEN)
 *     dial-reach-orchestrator.DIAL_REACH_K   === 6     (the ONLY moved constant,
 *                                                       5 -> 6 when hats joined)
 *
 *   No-bespoke-widget audit:
 *     The AskUserQuestion-payload-construction marker (the dispatcher's
 *     `askuserquestion_marker` assignment / `[AskUserQuestion contract:` trailer)
 *     appears ONLY in lib/hmi/selector-dispatcher.cjs -- never in the
 *     Phase-148-edited files (dial-close-reach.cjs, shape-f1-renderer.cjs,
 *     reach-component-map.json, dial-reach-orchestrator.cjs). A mere doc-comment
 *     MENTION of the words "AskUserQuestion" is allowed (the orchestrator
 *     references the clamp in prose); only a CONSTRUCTION of the payload is
 *     forbidden outside the dispatcher.
 *
 * Plain CJS node:assert/strict; PASS line + non-zero exit on failure.
 *
 * NO em-dashes anywhere in this file (CLAUDE.md HARD RULE).
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const ranker = require(path.join(REPO_ROOT, 'lib', 'workflow', 'f-selector-ranker.cjs'));
const orchestrator = require(path.join(REPO_ROOT, 'lib', 'hmi', 'dial-reach-orchestrator.cjs'));

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log('  ok - ' + name);
}

console.log('test-148-frozen-contracts.cjs (IRW-07): frozen constants + no bespoke widget outside the dispatcher');

// ---------------------------------------------------------------------------
// Frozen constants.
// ---------------------------------------------------------------------------
check('ranker.MAX_K === 3 (the chooser-row budget is FROZEN)', () => {
  assert.strictEqual(ranker.MAX_K, 3, 'MAX_K must stay 3; got ' + ranker.MAX_K);
});

check('orchestrator.RECOMMEND_FLOOR === 0.70 (the recommend gate is FROZEN)', () => {
  assert.strictEqual(orchestrator.RECOMMEND_FLOOR, 0.70,
    'RECOMMEND_FLOOR must stay 0.70; got ' + orchestrator.RECOMMEND_FLOOR);
});

check('orchestrator.MARGIN_THRESHOLD === 0.15 (the margin gate is FROZEN)', () => {
  assert.strictEqual(orchestrator.MARGIN_THRESHOLD, 0.15,
    'MARGIN_THRESHOLD must stay 0.15; got ' + orchestrator.MARGIN_THRESHOLD);
});

check('orchestrator.DIAL_REACH_K === 6 (the ONLY moved constant: 5 -> 6)', () => {
  assert.strictEqual(orchestrator.DIAL_REACH_K, 6,
    'DIAL_REACH_K must be 6 (hats is the 6th reach); got ' + orchestrator.DIAL_REACH_K);
});

check('the two caps stay DISTINCT (DIAL_REACH_K=6 != MAX_K=3)', () => {
  assert.notStrictEqual(orchestrator.DIAL_REACH_K, ranker.MAX_K,
    'the dial-preview cap and the chooser cap must remain distinct');
});

// ---------------------------------------------------------------------------
// No-bespoke-widget audit (SEED-020): the AskUserQuestion-payload-construction
// marker appears ONLY in the dispatcher.
// ---------------------------------------------------------------------------
const DISPATCHER = path.join(REPO_ROOT, 'lib', 'hmi', 'selector-dispatcher.cjs');

// The Phase-148-edited / Phase-148-new files that must NOT construct a payload.
const PHASE_148_FILES = [
  path.join(REPO_ROOT, 'lib', 'workflow', 'dial-close-reach.cjs'),
  path.join(REPO_ROOT, 'lib', 'hmi', 'shape-f1-renderer.cjs'),
  path.join(REPO_ROOT, 'lib', 'hmi', 'dial-reach-orchestrator.cjs'),
  path.join(REPO_ROOT, 'lib', 'hmi', 'reach-component-map.json'),
];

// A CONSTRUCTION marker is the dispatcher's payload-build signature: the
// askuserquestion_marker assignment or the `[AskUserQuestion contract:` trailer
// string, or a direct `new AskUserQuestion` / `AskUserQuestion(` call. Prose
// mentions of the bare word "AskUserQuestion" in a comment are NOT construction.
const CONSTRUCTION_MARKER = /askuserquestion_marker\s*=|\[AskUserQuestion contract:|new\s+AskUserQuestion|AskUserQuestion\s*\(/;

check('the AskUserQuestion construction marker IS present in selector-dispatcher.cjs', () => {
  const src = fs.readFileSync(DISPATCHER, 'utf8');
  assert.ok(CONSTRUCTION_MARKER.test(src),
    'the dispatcher must be the construction site (sanity anchor for the audit)');
});

check('NO AskUserQuestion construction marker in any Phase-148-edited file', () => {
  for (const f of PHASE_148_FILES) {
    if (!fs.existsSync(f)) continue; // a file a sibling plan owns may not exist yet
    const src = fs.readFileSync(f, 'utf8');
    assert.ok(!CONSTRUCTION_MARKER.test(src),
      'bespoke AskUserQuestion construction found outside the dispatcher in ' + path.basename(f));
  }
});

console.log('');
console.log('PASS test-148-frozen-contracts.cjs (' + passed + ' assertions)');
