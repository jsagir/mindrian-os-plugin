#!/usr/bin/env node
/**
 * MindrianOS Plugin -- Phase 157-02 (BOG-02/03/04/09/10) generator unit tests.
 * ===========================================================================
 *
 * Proves the orchestration-projection generator
 * (scripts/build-orchestration-projection.cjs) honors the Phase 157 canon
 * amendment (Appendix D entry 19) and the SPEC must-haves:
 *
 *   1. buildProjection() returns { ontology_ref, generated_note, nodes, edges }.
 *   2. tier-on-every-node: EVERY node carries methodology_tier of exactly
 *      "pws" or "mindrian-operation" (BOG-02 boundary-keeper; a node lacking it
 *      is not a legal projection node).
 *   3. tier-assignment: framework nodes are "pws"; command / skill / agent /
 *      reach / sub_mode nodes are "mindrian-operation".
 *   4. derived-not-hand-authored (BOG-03): a fake framework name nowhere in the
 *      sources is absent from nodes[]; the node list is the file walk + the
 *      registry framework union, not a literal list.
 *   5. node-grain (BOG-04): node count == commands + skills + agents + distinct
 *      frameworks + reaches + sub_modes (within the documented tolerance); no
 *      node is finer than file-level.
 *   6. the 6 frozen reaches (REACH_IDS) all appear as mindrian-operation reach
 *      nodes, including `hats` (NOT silently dropped).
 *   7. the analogue-endpoint frameworks ("Reverse Salient Analysis",
 *      "Four Lenses of Innovation", "Systems Thinking") are minted as pws
 *      framework nodes so Wave 3's CROSS_DOMAIN_ANALOGUE edges do not dangle.
 *   8. serializeProjection(proj) is byte-deterministic (idempotent) and ends in
 *      a trailing newline.
 *   9. OPERATES scaffold edges: >=1 OPERATES edge per command declaring a
 *      framework, command -> framework, only documented edge types.
 *  10. zero live Brain: no top-level require of brain-client anywhere in the
 *      generator source.
 *
 * License: BSL 1.1 (Business Source License 1.1) -- see LICENSE.
 */

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const GEN_PATH = path.join(__dirname, '..', '..', 'scripts', 'build-orchestration-projection.cjs');
const gen = require(GEN_PATH);
const { REACH_IDS } = require(path.join(__dirname, '..', 'core', 'sensors', 'sensor-types.cjs'));

const TIERS = new Set(['pws', 'mindrian-operation']);

function build() {
  return gen.buildProjection();
}

function testShape() {
  const p = build();
  assert.ok(p && typeof p === 'object', 'projection is an object');
  assert.strictEqual(typeof p.ontology_ref, 'string', 'ontology_ref string');
  assert.strictEqual(typeof p.generated_note, 'string', 'generated_note string');
  assert.ok(Array.isArray(p.nodes) && p.nodes.length > 0, 'nodes[] non-empty');
  assert.ok(Array.isArray(p.edges), 'edges[] array');
}

function testTierOnEveryNode() {
  const p = build();
  for (const n of p.nodes) {
    assert.ok(
      TIERS.has(n.methodology_tier),
      'node ' + n.id + ' has a legal methodology_tier (got ' + n.methodology_tier + ')'
    );
  }
}

function testTierAssignment() {
  const p = build();
  for (const n of p.nodes) {
    if (n.kind === 'framework') {
      assert.strictEqual(n.methodology_tier, 'pws', 'framework node ' + n.id + ' is pws');
    } else {
      assert.strictEqual(
        n.methodology_tier,
        'mindrian-operation',
        n.kind + ' node ' + n.id + ' is mindrian-operation'
      );
    }
  }
}

function testDerivedNotHandAuthored() {
  // No node whose name is a framework that exists nowhere in the sources.
  const p = build();
  const FAKE = 'Zzgloop Nonexistent Framework 9000';
  const names = new Set(p.nodes.map((n) => n.name));
  assert.ok(!names.has(FAKE), 'a fake framework name is absent (derived, not hand-authored)');
}

function testNodeGrainCount() {
  const p = build();
  // Recompute the expected per-file + derived counts from the SAME sources.
  const sources = gen.listSourceFiles();
  const commands = sources.filter((s) => s.kind === 'command').length;
  const skills = sources.filter((s) => s.kind === 'skill').length;
  const agents = sources.filter((s) => s.kind === 'agent').length;

  const byKind = {};
  for (const n of p.nodes) byKind[n.kind] = (byKind[n.kind] || 0) + 1;

  assert.strictEqual(byKind.command || 0, commands, 'one node per command');
  assert.strictEqual(byKind.skill || 0, skills, 'one node per skill');
  assert.strictEqual(byKind.agent || 0, agents, 'one node per agent');
  assert.ok((byKind.framework || 0) > 0, 'at least one framework node');
  assert.ok((byKind.reach || 0) === REACH_IDS.length, 'exactly the 6 frozen reach nodes');

  // Total equals the sum of the per-kind counts (no node is finer than file-level
  // i.e. no node outside the documented kinds).
  const allowed = new Set(['command', 'skill', 'agent', 'framework', 'reach', 'sub_mode']);
  for (const n of p.nodes) {
    assert.ok(allowed.has(n.kind), 'node kind ' + n.kind + ' is a documented file-level kind');
  }
  const sum = Object.values(byKind).reduce((a, b) => a + b, 0);
  assert.strictEqual(sum, p.nodes.length, 'node count is the sum of per-kind counts');
}

function testFrozenReachesIncludingHats() {
  const p = build();
  const reaches = p.nodes.filter((n) => n.kind === 'reach').map((n) => n.name || n.id);
  for (const r of REACH_IDS) {
    assert.ok(reaches.includes(r), 'frozen reach ' + r + ' is a node');
  }
  assert.ok(reaches.includes('hats'), 'the hats reach is NOT silently dropped');
}

function testAnalogueEndpointsMinted() {
  const p = build();
  const frameworkNames = new Set(
    p.nodes.filter((n) => n.kind === 'framework').map((n) => n.name)
  );
  for (const fw of ['Reverse Salient Analysis', 'Four Lenses of Innovation', 'Systems Thinking']) {
    assert.ok(frameworkNames.has(fw), 'analogue endpoint framework "' + fw + '" is a pws node');
  }
}

function testSerializeDeterministic() {
  const p = build();
  const a = gen.serializeProjection(p);
  const b = gen.serializeProjection(gen.buildProjection());
  assert.strictEqual(a, b, 'serializeProjection is byte-deterministic across builds');
  assert.ok(a.endsWith('\n'), 'serialized output ends with a trailing newline');
}

function testOperatesEdges() {
  const p = build();
  const operates = p.edges.filter((e) => e.type === 'OPERATES');
  assert.ok(operates.length > 0, 'at least one OPERATES edge');
  // Every OPERATES edge is command -> framework.
  const nodeById = new Map(p.nodes.map((n) => [n.id, n]));
  for (const e of operates) {
    const from = nodeById.get(e.from);
    const to = nodeById.get(e.to);
    assert.ok(from && from.kind === 'command', 'OPERATES from is a command node');
    assert.ok(to && to.kind === 'framework', 'OPERATES to is a framework node');
  }
  // Only documented edge types in this plan's scaffold.
  const DOCUMENTED = new Set(['OPERATES']);
  for (const e of p.edges) {
    assert.ok(DOCUMENTED.has(e.type), 'edge type ' + e.type + ' is documented in the scaffold');
  }
}

function testNoBrainClientRequire() {
  const src = fs.readFileSync(GEN_PATH, 'utf8');
  assert.ok(
    !/require\([^)]*brain-client[^)]*\)/.test(src),
    'generator source has no brain-client require (zero live Brain, Part 9)'
  );
}

function testNoEmDash() {
  const src = fs.readFileSync(GEN_PATH, 'utf8');
  // The em-dash codepoint (U+2014) is referenced by escape, never as a literal,
  // so this test file itself stays em-dash-free (HARD RULE: hyphens only).
  const EM_DASH = String.fromCharCode(0x2014);
  assert.ok(!src.includes(EM_DASH), 'generator source has no em-dashes');
}

function run() {
  const tests = [
    ['shape', testShape],
    ['tier-on-every-node', testTierOnEveryNode],
    ['tier-assignment', testTierAssignment],
    ['derived-not-hand-authored', testDerivedNotHandAuthored],
    ['node-grain-count', testNodeGrainCount],
    ['frozen-reaches-including-hats', testFrozenReachesIncludingHats],
    ['analogue-endpoints-minted', testAnalogueEndpointsMinted],
    ['serialize-deterministic', testSerializeDeterministic],
    ['operates-edges', testOperatesEdges],
    ['no-brain-client-require', testNoBrainClientRequire],
    ['no-em-dash', testNoEmDash],
  ];
  let pass = 0;
  for (const [name, fn] of tests) {
    try {
      fn();
      pass += 1;
      console.log('  ok   ' + name);
    } catch (e) {
      console.error('  FAIL ' + name + ': ' + (e && e.message ? e.message : String(e)));
      process.exitCode = 1;
    }
  }
  console.log('orchestration-projection.test: ' + pass + '/' + tests.length + ' passed');
}

if (require.main === module) {
  run();
} else {
  module.exports = { run };
}
