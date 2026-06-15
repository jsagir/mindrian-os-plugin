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
}

// ---- Task 1 (Plan 03): the closed typed-edge set (BOG-05) ----

function testClosedEdgeSet() {
  // ALLOWED_EDGE_TYPES is EXACTLY the 5 documented types, frozen.
  assert.ok(gen.ALLOWED_EDGE_TYPES instanceof Set, 'ALLOWED_EDGE_TYPES is a Set');
  assert.ok(Object.isFrozen(gen.ALLOWED_EDGE_TYPES), 'ALLOWED_EDGE_TYPES is frozen');
  const expected = ['OPERATES', 'CHAINS', 'FEEDS_INTO', 'PREREQUISITE', 'CROSS_DOMAIN_ANALOGUE'];
  assert.strictEqual(gen.ALLOWED_EDGE_TYPES.size, expected.length, 'exactly 5 edge types');
  for (const t of expected) {
    assert.ok(gen.ALLOWED_EDGE_TYPES.has(t), 'ALLOWED_EDGE_TYPES has ' + t);
  }
}

function testOnlyClosedTypesEmitted() {
  const p = build();
  for (const e of p.edges) {
    assert.ok(
      gen.ALLOWED_EDGE_TYPES.has(e.type),
      'emitted edge type ' + e.type + ' is in the closed set'
    );
  }
}

function testReferentialIntegrity() {
  // No emitted edge references a node id absent from nodes[].
  const p = build();
  const ids = new Set(p.nodes.map((n) => n.id));
  for (const e of p.edges) {
    assert.ok(ids.has(e.from), 'edge from ' + e.from + ' resolves to a node');
    assert.ok(ids.has(e.to), 'edge to ' + e.to + ' resolves to a node');
  }
}

function testAddEdgeChokepointThrows() {
  // The addEdge chokepoint throws on an undocumented type AND on a dangling
  // endpoint; it dedupes a repeated (type, from, to).
  const ids = new Set(['x', 'y']);
  const edges = [];
  const seen = new Set();
  const add = gen.makeAddEdge(ids, edges, seen);
  assert.throws(() => add('NOT_A_TYPE', 'x', 'y'), /undocumented/, 'throws on bad type');
  assert.throws(() => add('OPERATES', 'x', 'zzz'), /dangling/, 'throws on dangling to');
  assert.throws(() => add('OPERATES', 'zzz', 'y'), /dangling/, 'throws on dangling from');
  add('OPERATES', 'x', 'y');
  add('OPERATES', 'x', 'y');
  assert.strictEqual(edges.length, 1, 'addEdge dedupes a repeated edge');
}

function testCrossDomainAnalogueEdges() {
  // The 150.10 pairs appear as CROSS_DOMAIN_ANALOGUE edges between framework
  // nodes (>=2): Systems Thinking <-> Reverse Salient Analysis AND
  // Systems Thinking <-> Four Lenses of Innovation.
  const p = build();
  const xda = p.edges.filter((e) => e.type === 'CROSS_DOMAIN_ANALOGUE');
  assert.ok(xda.length >= 2, 'at least 2 CROSS_DOMAIN_ANALOGUE edges (the 150.10 seeds)');
  const nodeById = new Map(p.nodes.map((n) => [n.id, n]));
  for (const e of xda) {
    const from = nodeById.get(e.from);
    const to = nodeById.get(e.to);
    assert.ok(from && from.kind === 'framework', 'XDA from is a framework node');
    assert.ok(to && to.kind === 'framework', 'XDA to is a framework node');
  }
  const pairKey = (a, b) => a + ' :: ' + b;
  const present = new Set(xda.map((e) => pairKey(e.from, e.to)));
  assert.ok(
    present.has(pairKey('framework:Systems Thinking', 'framework:Reverse Salient Analysis')),
    'leverage <-> reverse-salient pair present'
  );
  assert.ok(
    present.has(pairKey('framework:Systems Thinking', 'framework:Four Lenses of Innovation')),
    'archetype <-> four-lenses pair present'
  );
}

function testChainLayerSourceEmptyNote() {
  // curated_chains is EMPTY today, so ZERO chaining edges are emitted, and the
  // top-level chain_layer_note makes the empty layer LEGIBLE, not silent.
  const p = build();
  const chaining = p.edges.filter(
    (e) => e.type === 'CHAINS' || e.type === 'FEEDS_INTO' || e.type === 'PREREQUISITE'
  );
  assert.strictEqual(chaining.length, 0, 'zero chaining edges while curated_chains is empty');
  assert.strictEqual(typeof p.chain_layer_note, 'string', 'chain_layer_note is a string');
  assert.ok(/SOURCE-EMPTY/.test(p.chain_layer_note), 'chain_layer_note flags the empty source state');
  assert.ok(/curated_chains/.test(p.chain_layer_note), 'chain_layer_note names curated_chains');
}

// ---- Task 2 (Plan 03): ranking-input exposure + the fixture query (BOG-07) ----

function testRankingInputsExposed() {
  // Every connector-derived mindrian-operation node exposes its ranking inputs at
  // the TOP LEVEL: reach_id, hierarchy_rank, posture (+ sub_mode, sensor_triggers).
  const p = build();
  const conn = p.nodes.filter((n) => n.methodology_tier === 'mindrian-operation' && n.reach_id);
  assert.ok(conn.length > 0, 'at least one connector-derived node exposes reach_id');
  for (const n of conn) {
    assert.strictEqual(typeof n.reach_id, 'string', n.id + ' exposes reach_id');
    assert.strictEqual(typeof n.hierarchy_rank, 'number', n.id + ' exposes hierarchy_rank');
    assert.strictEqual(typeof n.posture, 'string', n.id + ' exposes posture');
  }
}

function testChainAndSensorProvenance() {
  // The framework -> command -> reach chain + the firing-sensor list are present
  // as provenance on every connector-derived node (BOG-07 elevated).
  const p = build();
  const conn = p.nodes.filter((n) => n.methodology_tier === 'mindrian-operation' && n.reach_id);
  for (const n of conn) {
    assert.ok(n.chain_provenance && typeof n.chain_provenance === 'object', n.id + ' has chain_provenance');
    assert.strictEqual(n.chain_provenance.command, n.name, 'provenance command is the node name');
    assert.strictEqual(n.chain_provenance.reach_id, n.reach_id, 'provenance reach_id matches');
    if (Array.isArray(n.sensor_triggers)) {
      assert.deepStrictEqual(
        n.chain_provenance.firing_sensors,
        n.sensor_triggers,
        'provenance firing_sensors mirrors sensor_triggers'
      );
    }
  }
}

function testNameOnlySkillsCarryNoRanking() {
  // Skills carry NO connector (D-01): no ranking fields. They are exempt from the
  // ranking gate (Plan 04 enforces that exemption).
  const p = build();
  const skills = p.nodes.filter((n) => n.kind === 'skill');
  assert.ok(skills.length > 0, 'there are skill nodes');
  for (const n of skills) {
    assert.strictEqual(typeof n.reach_id, 'undefined', n.id + ' has no reach_id');
    assert.strictEqual(typeof n.hierarchy_rank, 'undefined', n.id + ' has no hierarchy_rank');
    assert.strictEqual(typeof n.chain_provenance, 'undefined', n.id + ' has no chain_provenance');
  }
}

function testRankReachesFromProjectionAlone() {
  // rankReachesForProblem reads the PROJECTION ALONE and returns a stable order.
  const p = build();
  const ranked = gen.rankReachesForProblem(p, { problemType: 'wicked', stage: 'discovery' });
  assert.ok(Array.isArray(ranked) && ranked.length === REACH_IDS.length, 'ranks all frozen reaches');
  for (const r of ranked) {
    assert.ok(REACH_IDS.includes(r.reach_id), 'ranked reach ' + r.reach_id + ' is a frozen reach');
    assert.ok('best_rank' in r && 'wired_count' in r, 'rank row carries best_rank + wired_count');
  }
  // Non-decreasing best_rank (the ranking key).
  for (let i = 1; i < ranked.length; i += 1) {
    assert.ok(ranked[i - 1].best_rank <= ranked[i].best_rank, 'best_rank is non-decreasing');
  }
  // Stable across rebuilds (deterministic, projection-only).
  const again = gen.rankReachesForProblem(gen.buildProjection(), {});
  assert.deepStrictEqual(ranked, again, 'rankReachesForProblem is deterministic');
}

// ---- Task 1 (Plan 04): the --check 3-mode taxonomy STALE / UN-WIRED / UN-RANKED ----

function testValidateProjectionCleanRepo() {
  // On the clean live repo (Task 0 resolved the 2 orphans), validateProjection
  // returns ZERO errors across all three modes.
  const p = build();
  const res = gen.validateProjection(p);
  assert.ok(res && typeof res === 'object', 'validateProjection returns a result object');
  assert.ok(Array.isArray(res.stale), 'stale is an array');
  assert.ok(Array.isArray(res.unwired), 'unwired is an array');
  assert.ok(Array.isArray(res.unranked), 'unranked is an array');
  assert.strictEqual(res.stale.length, 0, 'clean repo: no STALE errors');
  assert.strictEqual(res.unwired.length, 0, 'clean repo: no UN-WIRED errors (orphans resolved)');
  assert.strictEqual(res.unranked.length, 0, 'clean repo: no UN-RANKED errors');
}

function testValidateProjectionStale() {
  // A projection whose serialization differs from the committed on-disk file is
  // STALE. Mutate a node name in-memory so the regeneration differs.
  const p = build();
  const mutated = JSON.parse(JSON.stringify(p));
  mutated.nodes.push({
    id: 'framework:Stale Drift Probe',
    kind: 'framework',
    methodology_tier: 'pws',
    name: 'Stale Drift Probe',
  });
  const res = gen.validateProjection(mutated);
  assert.ok(res.stale.length > 0, 'a drifted projection flags STALE');
  assert.ok(/STALE/.test(res.stale.join('\n')), 'STALE message contains the STALE token');
  assert.ok(
    /build-orchestration-projection\.cjs/.test(res.stale.join('\n')),
    'STALE message names the recovery command'
  );
}

function testValidateProjectionUnwiredFramework() {
  // A framework node present in nodes[] but NOT reachable to any frozen reach via
  // an OPERATES->reach chain AND not in the allowlist fires UN-WIRED.
  const p = build();
  const mutated = JSON.parse(JSON.stringify(p));
  // Inject a framework with no OPERATES edge to any wired command.
  mutated.nodes.push({
    id: 'framework:Orphan Probe Framework',
    kind: 'framework',
    methodology_tier: 'pws',
    name: 'Orphan Probe Framework',
  });
  const res = gen.validateProjection(mutated);
  assert.ok(res.unwired.length > 0, 'an unreachable framework fires UN-WIRED');
  const joined = res.unwired.join('\n');
  assert.ok(/UN-WIRED/.test(joined), 'UN-WIRED message contains the UN-WIRED token');
  assert.ok(/Orphan Probe Framework/.test(joined), 'UN-WIRED names the offending framework');
}

function testValidateProjectionAllowlistExempts() {
  // A framework in data/orchestration-unwired-allowlist.json does NOT fire
  // UN-WIRED even with no reach wiring. MECE is the live allowlist entry.
  const allowlist = require(path.join(__dirname, '..', '..', 'data', 'orchestration-unwired-allowlist.json'));
  assert.ok(Array.isArray(allowlist) && allowlist.length > 0, 'allowlist is a non-empty array');
  const meceName = allowlist[0].framework;
  const p = build();
  const mutated = JSON.parse(JSON.stringify(p));
  // Ensure the allowlisted framework is present as a node (it may already be).
  if (!mutated.nodes.some((n) => n.kind === 'framework' && n.name === meceName)) {
    mutated.nodes.push({
      id: 'framework:' + meceName,
      kind: 'framework',
      methodology_tier: 'pws',
      name: meceName,
    });
  }
  const res = gen.validateProjection(mutated);
  const joined = res.unwired.join('\n');
  assert.ok(!joined.includes(meceName), 'an allowlisted framework does not fire UN-WIRED');
}

function testValidateProjectionSkillsExemptFromUnwired() {
  // Skills are name-only (D-01): a skill node never fires UN-WIRED (the gate is
  // framework-grained, not every command surface, and NOT skills).
  const p = build();
  const res = gen.validateProjection(p);
  const skillNames = p.nodes.filter((n) => n.kind === 'skill').map((n) => n.name);
  const joined = res.unwired.join('\n');
  for (const s of skillNames) {
    // A skill name appearing in an UN-WIRED message would be a false positive.
    assert.ok(!joined.includes('skill:' + s), 'skill ' + s + ' is exempt from UN-WIRED');
  }
}

function testValidateProjectionUnrankedConnectorNode() {
  // A connector-derived mindrian-operation node (declares a reach_id) stripped of
  // its hierarchy_rank fires UN-RANKED.
  const p = build();
  const mutated = JSON.parse(JSON.stringify(p));
  const target = mutated.nodes.find(
    (n) => n.methodology_tier === 'mindrian-operation' && typeof n.reach_id === 'string'
  );
  assert.ok(target, 'a connector-derived node exists to strip');
  delete target.hierarchy_rank;
  const res = gen.validateProjection(mutated);
  assert.ok(res.unranked.length > 0, 'a connector node missing hierarchy_rank fires UN-RANKED');
  const joined = res.unranked.join('\n');
  assert.ok(/UN-RANKED/.test(joined), 'UN-RANKED message contains the UN-RANKED token');
  assert.ok(joined.includes(target.id) || joined.includes(target.name), 'UN-RANKED names the node');
}

function testValidateProjectionSkillsExemptFromUnranked() {
  // A name-only skill node (no reach_id) is EXEMPT from UN-RANKED (it declares no
  // connector, so it has no ranking inputs to be missing).
  const p = build();
  const res = gen.validateProjection(p);
  const skillIds = p.nodes.filter((n) => n.kind === 'skill').map((n) => n.id);
  const joined = res.unranked.join('\n');
  for (const id of skillIds) {
    assert.ok(!joined.includes(id), 'skill ' + id + ' is exempt from UN-RANKED');
  }
}

function testCheckTokensInSource() {
  // The three literal tokens appear in the generator source (the --check branch
  // prints each named token).
  const src = fs.readFileSync(GEN_PATH, 'utf8');
  for (const tok of ['STALE', 'UN-WIRED', 'UN-RANKED']) {
    assert.ok(src.includes(tok), 'generator source contains the ' + tok + ' token');
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
    ['closed-edge-set', testClosedEdgeSet],
    ['only-closed-types-emitted', testOnlyClosedTypesEmitted],
    ['referential-integrity', testReferentialIntegrity],
    ['add-edge-chokepoint-throws', testAddEdgeChokepointThrows],
    ['cross-domain-analogue-edges', testCrossDomainAnalogueEdges],
    ['chain-layer-source-empty-note', testChainLayerSourceEmptyNote],
    ['ranking-inputs-exposed', testRankingInputsExposed],
    ['chain-and-sensor-provenance', testChainAndSensorProvenance],
    ['name-only-skills-carry-no-ranking', testNameOnlySkillsCarryNoRanking],
    ['rank-reaches-from-projection-alone', testRankReachesFromProjectionAlone],
    ['validate-projection-clean-repo', testValidateProjectionCleanRepo],
    ['validate-projection-stale', testValidateProjectionStale],
    ['validate-projection-unwired-framework', testValidateProjectionUnwiredFramework],
    ['validate-projection-allowlist-exempts', testValidateProjectionAllowlistExempts],
    ['validate-projection-skills-exempt-unwired', testValidateProjectionSkillsExemptFromUnwired],
    ['validate-projection-unranked-connector-node', testValidateProjectionUnrankedConnectorNode],
    ['validate-projection-skills-exempt-unranked', testValidateProjectionSkillsExemptFromUnranked],
    ['check-tokens-in-source', testCheckTokensInSource],
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
