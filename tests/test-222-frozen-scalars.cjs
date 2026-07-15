'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 222-01 -- the Req 5 frozen-scalar byte-diff guard, landed in Wave 1.
 * =========================================================================
 * The Phase 222 ranking unification MUST NOT drift the four frozen constitutional
 * scalars. Landing this tripwire BEFORE any Phase 222 behavior code exists means
 * every later Wave 2/3 diff runs against a live guard: if a careless edit ever
 * nudges MAX_K / DIAL_REACH_K / RECOMMEND_FLOOR / MARGIN_THRESHOLD, this suite
 * goes red.
 *
 * This file requires ONLY the two shipped frozen modules. It must NOT require the
 * new reach-hedge-ranker module (Plan 02) or anything else this phase creates --
 * its whole job is proving the new code never touched these four constants. A
 * fifth self-guard check reads this test's OWN source and asserts the new ranker
 * module name appears exactly once (the guard string literal), never as a require.
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

console.log('test-222-frozen-scalars.cjs (Req 5): the four frozen scalars + the new-module self-guard');

check('ranker.MAX_K === 3 (the chooser-row budget is FROZEN)', () => {
  assert.strictEqual(ranker.MAX_K, 3, 'MAX_K must stay 3; got ' + ranker.MAX_K);
});

check('orchestrator.DIAL_REACH_K === 6 (the dial-preview cap is FROZEN)', () => {
  assert.strictEqual(orchestrator.DIAL_REACH_K, 6,
    'DIAL_REACH_K must stay 6; got ' + orchestrator.DIAL_REACH_K);
});

check('orchestrator.RECOMMEND_FLOOR === 0.70 (the recommend gate is FROZEN)', () => {
  assert.strictEqual(orchestrator.RECOMMEND_FLOOR, 0.70,
    'RECOMMEND_FLOOR must stay 0.70; got ' + orchestrator.RECOMMEND_FLOOR);
});

check('orchestrator.MARGIN_THRESHOLD === 0.15 (the margin gate is FROZEN)', () => {
  assert.strictEqual(orchestrator.MARGIN_THRESHOLD, 0.15,
    'MARGIN_THRESHOLD must stay 0.15; got ' + orchestrator.MARGIN_THRESHOLD);
});

check('self-guard: this test never requires the new Phase 222 ranker module', () => {
  const NEW_MODULE = 'reach-hedge-ranker'; // the ONE guard string literal (Plan 02 module basename)
  const selfSrc = fs.readFileSync(__filename, 'utf8');
  const requirePattern = new RegExp('require\\([^)]*' + NEW_MODULE);
  assert.ok(!requirePattern.test(selfSrc),
    'this frozen-scalar guard must never import the new ranker module (Req 5 isolation)');
});

console.log('');
console.log('PASS test-222-frozen-scalars.cjs (' + passed + ' assertions)');
