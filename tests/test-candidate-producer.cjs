'use strict';
// Phase 169-01 Wave 0 RED stub -- GDH-05 PRODUCER (produceCandidates, D-169-06).
//
// IFACE (169-01 shared_iface_contract): lib/core/graph-candidate-producer.cjs
//   produceCandidates({roomDir, artifactPair, llm}) -> [{source, target, edge_type, reason}]
//   THE candidate-edge PRODUCER -- the LLM DERIVATION step. It reads the
//   artifact-pair text and PROPOSES candidate tuples whose edge_type is drawn
//   ONLY from the frozen cascade subset of ALLOWED_EDGE_TYPES (CONTRADICTS,
//   CONVERGES, INFORMS, INVALIDATES, ENABLES, REFINES, ROOT_CAUSES). It MUST be
//   able to emit BOTH CONTRADICTS AND CONVERGES (D-169-06: not CONTRADICTS-only).
//   `llm` is an injectable function (a deterministic stub in tests). Part 8: the
//   producer reads LOCAL text and returns LOCAL tuples; it NEVER calls the Brain.
//
// RED-by-require until Plan 04 ships graph-candidate-producer.cjs. No em-dashes.

const assert = require('node:assert/strict');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
// RED until Plan 04 ships the producer.
const { produceCandidates } = require(
  path.join(REPO_ROOT, 'lib', 'core', 'graph-candidate-producer.cjs')
);

// The frozen cascade subset the producer may draw from (IFACE).
const CASCADE_SUBSET = new Set([
  'CONTRADICTS', 'CONVERGES', 'INFORMS', 'INVALIDATES', 'ENABLES', 'REFINES', 'ROOT_CAUSES',
]);

let pass = 0;
function check(label, fn) { fn(); pass += 1; console.log('  ok -', label); }

console.log('test-candidate-producer (GDH-05 producer, D-169-06)');

// A deterministic stub LLM: the ONLY model the producer may touch. It returns
// BOTH a contradiction and a convergence given a two-artifact pair whose text
// supports each. It records that it was the only callee (Part 8 instrumentation).
let llmCalls = 0;
function stubLlm(prompt) {
  llmCalls += 1;
  return JSON.stringify([
    { source: 'artifact:market-2024', target: 'assumption:tam-2b', edge_type: 'CONTRADICTS', reason: 'the 2024 read contradicts the 2b TAM assumption' },
    { source: 'artifact:market-2024', target: 'section:gtm', edge_type: 'CONVERGES', reason: 'the same theme recurs across gtm and finance' },
  ]);
}

const artifactPair = {
  a: { id: 'artifact:market-2024', text: 'The 2024 market read shows TAM is 400M, far below the 2B assumption. Channel themes recur in GTM.' },
  b: { id: 'assumption:tam-2b', text: 'Assumption: TAM is 2B. GTM channel is the same as finance.' },
};

let candidates;
check('produceCandidates returns an array of candidate tuples from a stub llm', () => {
  candidates = produceCandidates({ roomDir: '/tmp/does-not-need-to-exist', artifactPair, llm: stubLlm });
  assert.ok(Array.isArray(candidates), 'produceCandidates must return an array');
  assert.ok(candidates.length >= 2, 'the producer must emit at least two candidates from this pair');
});

check('the producer emits BOTH a CONTRADICTS AND a CONVERGES candidate (D-169-06)', () => {
  const types = new Set(candidates.map(c => c.edge_type));
  assert.ok(types.has('CONTRADICTS'), 'must emit a CONTRADICTS candidate');
  assert.ok(types.has('CONVERGES'), 'must emit a CONVERGES candidate (not CONTRADICTS-only)');
});

check('every emitted edge_type is in the frozen cascade subset', () => {
  for (const c of candidates) {
    assert.ok(CASCADE_SUBSET.has(c.edge_type),
      `edge_type ${c.edge_type} must be in the frozen cascade subset`);
  }
});

check('every candidate carries source + target + reason fields', () => {
  for (const c of candidates) {
    assert.equal(typeof c.source, 'string');
    assert.equal(typeof c.target, 'string');
    assert.equal(typeof c.reason, 'string');
  }
});

check('the injected stub llm is the only model touched (Part 8: no Brain)', () => {
  assert.ok(llmCalls >= 1, 'the producer must drive the injected llm');
});

console.log(`\nPASS (${pass}/5)`);
