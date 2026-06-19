'use strict';
// Phase 169-01 Wave 0 RED stub -- GDH-05 LOOP (runDerivation, Part 9 review_status-on-NODE).
//
// IFACE (169-01 shared_iface_contract): lib/core/graph-derivation.cjs
//   runDerivation({roomDir, runChain, selfCritiqueFn, deriveFn}) ->
//     {proposedNodes:[], edges:[], trace}
//   The runChain composer. deriveFn IS the LLM producer (defaults to
//   graph-candidate-producer.produceCandidates, injectable). Each runChain step
//   invokes deriveFn on an artifact pair and marks the step material:true so
//   fable-mode (167 selfCritiqueFn) critiques EACH candidate. Only critique-passed
//   candidates flow through candidateToFinding(candidate) and are written as a
//   PROPOSED truth-claim NODE (review_status='proposed' on the NODE, never on the
//   edge) plus a typed EDGE via findings-wirer through navigation.writeEdge.
//
// RED-by-require until Plan 04 ships graph-derivation.cjs. This stub drives
// runDerivation with a stub deriveFn returning one good + one unjustified
// candidate and a selfCritiqueFn that fails the unjustified one; it asserts the
// proposed-NODE-not-edge pattern (Part 9 Pitfall 1) and the fable-mode reject.
// No em-dashes.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
// RED until Plan 04 ships graph-derivation.cjs.
const { runDerivation, candidateToFinding } = require(
  path.join(REPO_ROOT, 'lib', 'core', 'graph-derivation.cjs')
);

let pass = 0;
function check(label, fn) { fn(); pass += 1; console.log('  ok -', label); }

console.log('test-graph-derivation-loop (GDH-05 loop)');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'derive-loop-169-'));
fs.writeFileSync(path.join(tmp, '.room-root'), JSON.stringify({ slug: 'loop-room' }));

// A stub deriveFn returns one good (justified) candidate and one unjustified
// CONTRADICTS that the fable-mode critic must reject.
function stubDeriveFn() {
  return [
    { source: 'artifact:a', target: 'section:b', edge_type: 'CONVERGES', reason: 'three sections share the theme', justified: true },
    { source: 'artifact:a', target: 'section:c', edge_type: 'CONTRADICTS', reason: '', justified: false },
  ];
}
// The fable-mode selfCritiqueFn rejects the unjustified candidate.
function stubSelfCritiqueFn(candidate) {
  const passed = candidate && candidate.justified === true && String(candidate.reason || '').length > 0;
  return { passed, quality: passed ? 'ok' : 'low' };
}

let result;
check('runDerivation returns {proposedNodes, edges, trace}', () => {
  result = runDerivation({ roomDir: tmp, deriveFn: stubDeriveFn, selfCritiqueFn: stubSelfCritiqueFn });
  assert.ok(result && typeof result === 'object');
  assert.ok(Array.isArray(result.proposedNodes), 'proposedNodes must be an array');
  assert.ok(Array.isArray(result.edges), 'edges must be an array');
});

check('only the critique-PASSED candidate lands (the unjustified CONTRADICTS is rejected)', () => {
  const landedTypes = result.edges.map(e => e.type || e.edge_type);
  assert.ok(landedTypes.includes('CONVERGES'), 'the justified CONVERGES must land');
  assert.ok(!landedTypes.includes('CONTRADICTS'), 'the unjustified CONTRADICTS must be rejected by fable-mode');
});

check('every derived edge lands as a PROPOSED truth-claim NODE (review_status on the NODE)', () => {
  assert.ok(result.proposedNodes.length >= 1, 'at least one proposed node must be written');
  for (const n of result.proposedNodes) {
    assert.equal(n.review_status, 'proposed', 'the NODE carries review_status=proposed (Part 9)');
  }
});

check('NO edge carries review_status (Part 9 Pitfall 1: never an edge column)', () => {
  for (const e of result.edges) {
    const props = e.properties || {};
    assert.ok(!('review_status' in props), 'edge.properties must NOT carry review_status');
  }
});

check('candidateToFinding bridges a candidate into a finding shape', () => {
  const finding = candidateToFinding({ source: 'artifact:a', target: 'section:b', edge_type: 'CONVERGES', reason: 'r' });
  assert.ok(finding && typeof finding === 'object', 'candidateToFinding must return a finding object');
});

console.log(`\nPASS (${pass}/5)`);
