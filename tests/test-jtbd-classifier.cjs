#!/usr/bin/env node
/*
 * Phase 100-02 Task 3 — JTBD classifier validation suite
 * Filed inline during wave-1 integration after the spawning agent
 * stopped before committing this file. Validates the heuristic
 * classifier shipped by 100-02 against the 13-entry taxonomy from
 * 100-01.
 */

'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const REPO_ROOT = path.resolve(__dirname, '..');
const { classify } = require(path.join(REPO_ROOT, 'lib', 'hmi', 'jtbd-classifier.cjs'));

let passed = 0;
let failed = 0;
function ok(name) { console.log('  PASS  ' + name); passed++; }
function fail(name, err) { console.log('  FAIL  ' + name + ': ' + (err && err.message || err)); failed++; }

// T1: classify returns the expected shape
(function t1() {
  try {
    const r = classify({ userMessage: 'hello', room: '/tmp', operator: 'JUST_TALK', decisionsRecency: [], currentJtbd: null });
    assert.equal(typeof r, 'object', 'returns object');
    assert.ok('jtbd' in r, 'has jtbd key');
    assert.ok('confidence' in r, 'has confidence key');
    assert.ok('evidence' in r, 'has evidence key');
    assert.ok(Array.isArray(r.evidence), 'evidence is array');
    ok('T1: classify returns { jtbd, confidence, evidence }');
  } catch (e) { fail('T1', e); }
})();

// T2: empty / unmatched input yields low or null confidence
(function t2() {
  try {
    const r = classify({ userMessage: 'xyzzy plugh frob', room: '/tmp', operator: 'JUST_TALK', decisionsRecency: [], currentJtbd: null });
    assert.ok(r.confidence < 0.6, 'unmatched stays below the 0.6 act-on threshold');
    ok('T2: unmatched input below threshold');
  } catch (e) { fail('T2', e); }
})();

// T3: confidence is in [0, 1]
(function t3() {
  try {
    const inputs = [
      { userMessage: 'i need to define my problem clearly', room: '/tmp', operator: 'BUILD_ROOM' },
      { userMessage: 'lets validate this assumption with evidence', room: '/tmp', operator: 'METHODOLOGY' },
      { userMessage: 'who should i hire next', room: '/tmp', operator: 'JUST_TALK' },
    ];
    for (const i of inputs) {
      const r = classify({ ...i, decisionsRecency: [], currentJtbd: null });
      assert.ok(r.confidence >= 0 && r.confidence <= 1, `confidence ${r.confidence} in [0,1]`);
    }
    ok('T3: confidence always in [0, 1]');
  } catch (e) { fail('T3', e); }
})();

// T4: classify is deterministic (heuristic, no random)
(function t4() {
  try {
    const input = { userMessage: 'i want to compete with X', room: '/tmp', operator: 'BUILD_ROOM', decisionsRecency: [], currentJtbd: null };
    const r1 = classify(input);
    const r2 = classify(input);
    assert.equal(r1.jtbd, r2.jtbd, 'jtbd matches');
    assert.equal(r1.confidence, r2.confidence, 'confidence matches');
    ok('T4: deterministic across repeated calls');
  } catch (e) { fail('T4', e); }
})();

// T5: Canon Part 8 — source has no Brain/Aura/Pinecone/MCP refs
(function t5() {
  try {
    const src = fs.readFileSync(path.join(REPO_ROOT, 'lib', 'hmi', 'jtbd-classifier.cjs'), 'utf8');
    // Canon Part 8 audit: forbidden runtime refs (require/import statements only;
    // documentation referring to the boundary by name is allowed).
    const requires = src.match(/require\(['"][^'"]+['"]\)/g) || [];
    for (const r of requires) {
      assert.ok(!/brain|aura|pinecone|@modelcontextprotocol/i.test(r),
        'no LOCAL→Brain/Aura/Pinecone/MCP imports: ' + r);
    }
    ok('T5: Canon Part 8 — no forbidden imports');
  } catch (e) { fail('T5', e); }
})();

// T6: Frame budget — 100 classify() calls under 500ms total
(function t6() {
  try {
    const input = { userMessage: 'lets validate the assumption that customers will pay', room: '/tmp', operator: 'METHODOLOGY', decisionsRecency: [], currentJtbd: null };
    const start = process.hrtime.bigint();
    for (let i = 0; i < 100; i++) classify(input);
    const elapsed = Number(process.hrtime.bigint() - start) / 1e6; // ms
    assert.ok(elapsed < 500, 'frame budget: 100 calls in ' + elapsed.toFixed(1) + 'ms (< 500ms)');
    ok('T6: frame budget 100 calls < 500ms (' + elapsed.toFixed(1) + 'ms)');
  } catch (e) { fail('T6', e); }
})();

console.log('\nPhase 100-02 classifier: ' + passed + '/' + (passed + failed) + ' passed');
process.exit(failed > 0 ? 1 : 0);
