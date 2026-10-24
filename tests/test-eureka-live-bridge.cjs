'use strict';

// Development integration test for the real MindrianOS projection -> Eureka
// stdio MCP -> MindrianOS result envelope. Session resolution is the only
// stub: it binds a temporary synthetic room through the normal handler path.

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const engineRoot = process.env.MINDRIAN_EUREKA_ROOT;
if (!engineRoot) throw new Error('Set MINDRIAN_EUREKA_ROOT to the Mindrian Eureka checkout to run this integration test.');

const roomDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-eureka-live-bridge-'));
process.env.MINDRIAN_EUREKA_DATA_DIR = path.join(roomDir, 'eureka-data');
fs.mkdirSync(path.join(roomDir, '.mindrian'), { recursive: true });
const db = new DatabaseSync(path.join(roomDir, '.mindrian', 'room.db'));
db.exec('CREATE TABLE nodes (id TEXT PRIMARY KEY, type TEXT NOT NULL, properties TEXT DEFAULT \'{}\')');
db.exec('CREATE TABLE edges (source TEXT NOT NULL, target TEXT NOT NULL, type TEXT NOT NULL, properties TEXT DEFAULT \'{}\')');
const names = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot'];
const claimBodies = [
  'Biological sensors detect cellular stress through molecular signals and fluorescence measurements.',
  'Adaptive control systems adjust robotic motion using feedback from distributed sensor arrays.',
  'Medical imaging pipelines identify tissue anomalies from spectral and magnetic measurements.',
  'Environmental monitoring networks track water contamination with field-deployed biosensors.',
  'Robotic prostheses translate neural signals into motor control and tactile feedback for users.',
  'Microfluidic devices isolate rare cells for rapid diagnostic testing and targeted treatment.',
];
for (let index = 0; index < names.length; index += 1) {
  db.prepare('INSERT INTO nodes (id,type,properties) VALUES (?,?,?)').run(
    `claim:${index}`, 'claim', JSON.stringify({ title: names[index], body: claimBodies[index] })
  );
}
db.prepare('INSERT INTO nodes (id,type,properties) VALUES (?,?,?)').run('framework:systems', 'Framework', JSON.stringify({ name: 'Systems Thinking' }));
db.prepare('INSERT INTO nodes (id,type,properties) VALUES (?,?,?)').run('framework:causal', 'Framework', JSON.stringify({ name: 'Causal Loop Diagrams' }));
db.prepare('INSERT INTO nodes (id,type,properties) VALUES (?,?,?)').run('problem:wicked', 'ProblemType', JSON.stringify({ name: 'Wicked' }));
db.prepare('INSERT INTO nodes (id,type,properties) VALUES (?,?,?)').run('evidence:source-1', 'Evidence', JSON.stringify({ title: 'Source evidence', body: 'A bounded, source-linked observation for the proposed relationship.' }));
db.prepare('INSERT INTO edges (source,target,type,properties) VALUES (?,?,?,?)').run('framework:systems', 'problem:wicked', 'ADDRESSES_PROBLEM_TYPE', JSON.stringify({ effectiveness: 0.95 }));
db.prepare('INSERT INTO edges (source,target,type,properties) VALUES (?,?,?,?)').run('framework:systems', 'framework:causal', 'FEEDS_INTO', JSON.stringify({ confidence: 0.82, transform: 'trace system feedback' }));
for (const [index, [source, target]] of [[0, 1], [0, 2], [1, 2], [3, 4], [3, 5]].entries()) {
  const createdAt = index < 3 ? '2020-01-01T00:00:00Z' : '2022-01-01T00:00:00Z';
  const edgeProperties = { created_at: createdAt };
  if (index === 0) Object.assign(edgeProperties, { confidence: 0.91, pws_confidence: 'high', evidence: 'Observed in the selected source report.' });
  db.prepare('INSERT INTO edges (source,target,type,properties) VALUES (?,?,?,?)').run(`claim:${source}`, `claim:${target}`, 'RELATES_TO', JSON.stringify(edgeProperties));
}
db.close();
const graphDbPath = path.join(roomDir, '.mindrian', 'room.db');
const graphDbHash = () => crypto.createHash('sha256').update(fs.readFileSync(graphDbPath)).digest('hex');
const graphDbHashBefore = graphDbHash();

const sessionRoom = require('../lib/mcp/session-room.cjs');
const originalResolve = sessionRoom.resolveMcpSessionRoom;
sessionRoom.resolveMcpSessionRoom = () => ({
  dir: roomDir, slug: 'eureka-live-bridge', source: 'session.primary', room_id: 'room:integration-1',
  room_identity: { state: 'ready' },
});

async function main() {
  const bridge = require('../lib/mcp/tools/eureka-graph-analyze.cjs');
  const registeredTools = new Map();
  bridge.register({ registerTool(name, config, handler) { registeredTools.set(name, { config, handler }); } }, {});
  const registered = registeredTools.get('eureka_graph_analyze');
  assert.ok(registered, 'composed MCP tool is registered');
  assert.equal(registered.config.inputSchema.safeParse({ node_ids: ['claim:0'], top: 10 }).success, true);
  assert.equal(registered.config.inputSchema.safeParse({ node_ids: ['claim:0'], room_path: roomDir }).success, false);
  assert.equal(registered.config.inputSchema.safeParse({ node_ids: ['claim:0'], capability_id: 'anything' }).success, false);
  const result = await bridge.analyze({
    node_ids: names.map((_name, index) => `claim:${index}`), top: 20, seed: 7, null_rounds: 1,
  }, {}, { sessionId: 'integration-session' });
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.capability_id, 'graph.explore_local_relationships');
  assert.equal(result.scope_id, 'room:integration-1');
  assert.match(result.snapshot_id, /^[a-f0-9]{64}$/);
  assert.equal(result.analysis.status, 'completed_analysis');
  assert.equal(result.analysis.graph_access, 'read_only_snapshot');
  assert.equal(result.analysis.scope_id, result.scope_id);
  assert.equal(result.analysis.snapshot_id, result.snapshot_id);
  assert.equal(result.projection.complete, true);
  assert.equal(result.persistence, 'none');
  assert.equal(result.review_required, true);
  assert.ok(result.analysis.proposals.every((candidate) => candidate.status === 'proposed' && candidate.evidence.length === 0));
  assert.equal(graphDbHash(), graphDbHashBefore, 'host graph bytes remain unchanged through projection and engine analysis');

  const proposalAlias = require('../lib/mcp/tools/eureka-graph-propose.cjs');
  const proposalTools = new Map();
  proposalAlias.register({ registerTool(name, config, handler) { proposalTools.set(name, { config, handler }); } }, {});
  assert.ok(proposalTools.has('eureka_graph_propose_relationships'), 'stable relationship-proposal capability MCP tool is registered');
  const proposalResult = await proposalAlias.propose({
    node_ids: names.map((_name, index) => `claim:${index}`), top: 20, seed: 7, null_rounds: 1,
  }, {}, { sessionId: 'integration-session' });
  assert.equal(proposalResult.ok, true, JSON.stringify(proposalResult));
  assert.equal(proposalResult.capability_id, 'graph.propose_relationships');
  assert.equal(proposalResult.analysis.capability_id, 'graph.propose_relationships');
  assert.equal(proposalResult.scope_id, result.scope_id);
  assert.equal(proposalResult.snapshot_id, result.snapshot_id);
  assert.ok(proposalResult.analysis.proposals.every((candidate) => candidate.status === 'proposed' && candidate.evidence.length === 0));
  assert.equal(proposalResult.persistence, 'none');
  assert.equal(graphDbHash(), graphDbHashBefore, 'relationship proposal alias leaves MindrianOS graph unchanged');

  const structural = require('../lib/mcp/tools/eureka-graph-map.cjs');
  const structuralTools = new Map();
  structural.register({ registerTool(name, config, handler) { structuralTools.set(name, { config, handler }); } }, {});
  const mapTool = structuralTools.get('eureka_graph_map_neighbourhoods');
  assert.ok(mapTool, 'SME neighborhood mapping MCP tool is registered');
  assert.equal(mapTool.config.inputSchema.safeParse({ node_ids: ['claim:0', 'claim:3'], base_node_id: 'claim:0', target_node_id: 'claim:3' }).success, true);
  assert.equal(mapTool.config.inputSchema.safeParse({ node_ids: ['claim:0'], base_node_id: 'claim:0', target_node_id: 'claim:3', room_path: roomDir }).success, false);
  const mapped = await structural.map({
    node_ids: names.map((_name, index) => `claim:${index}`),
    base_node_id: 'claim:0', target_node_id: 'claim:3', hops: 1,
  }, {}, { sessionId: 'integration-session' });
  assert.equal(mapped.ok, true, JSON.stringify(mapped));
  assert.equal(mapped.capability_id, 'graph.map_neighbourhoods');
  assert.equal(mapped.scope_id, 'room:integration-1');
  assert.equal(mapped.snapshot_id, result.snapshot_id, 'both graph methods analyze the same unchanged host snapshot');
  assert.equal(mapped.analysis.status, 'completed_analysis');
  assert.equal(mapped.analysis.base_node_id, 'claim:0');
  assert.equal(mapped.analysis.target_node_id, 'claim:3');
  assert.equal(mapped.review_required, true);
  const mappedProposals = mapped.analysis.mapping.matches.flatMap((match) => match.proposals);
  assert.ok(mappedProposals.length > 0, 'the fixture produces at least one structural inference');
  assert.ok(mappedProposals.every((proposal) => proposal.status === 'proposed' && proposal.evidence.length === 0));
  assert.equal(graphDbHash(), graphDbHashBefore, 'SME mapping leaves host graph bytes unchanged');

  const graphDiscovery = require('../lib/mcp/tools/eureka-graph-discovery-signals.cjs');
  const discoveryTools = new Map();
  graphDiscovery.register({ registerTool(name, config, handler) { discoveryTools.set(name, { config, handler }); } }, {});
  for (const spec of graphDiscovery.TOOLS) {
    const registeredDiscovery = discoveryTools.get(spec.tool);
    assert.ok(registeredDiscovery, `${spec.tool} is registered as a room-aware MCP tool`);
    assert.equal(registeredDiscovery.config.inputSchema.safeParse({ node_ids: names.map((_name, index) => `claim:${index}`) }).success, true);
    assert.equal(registeredDiscovery.config.inputSchema.safeParse({ node_ids: ['claim:0'], room_path: roomDir }).success, false);
    const discovery = await graphDiscovery.runDiscoverySignal(spec, {
      node_ids: names.map((_name, index) => `claim:${index}`),
    }, {}, { sessionId: 'integration-session' });
    assert.equal(discovery.ok, true, `${spec.capability_id}: ${JSON.stringify(discovery)}`);
    assert.equal(discovery.capability_id, spec.capability_id);
    assert.equal(discovery.scope_id, result.scope_id);
    assert.equal(discovery.snapshot_id, result.snapshot_id);
    assert.equal(discovery.analysis.scope_id, result.scope_id);
    assert.equal(discovery.analysis.snapshot_id, result.snapshot_id);
    assert.equal(discovery.partial, false);
    assert.equal(discovery.review_required, true);
    assert.equal(discovery.persistence, 'none');
  }
  assert.equal(graphDbHash(), graphDbHashBefore, 'all five graph-discovery services leave the MindrianOS room graph unchanged');

  const artifactProjection = require('../lib/mcp/tools/eureka-graph-prepare-artifacts.cjs');
  const prepared = await artifactProjection.prepare({
    node_ids: names.map((_name, index) => `claim:${index}`),
    objective: 'Find opportunity leads hidden across this local research snapshot',
  }, {}, { sessionId: 'integration-session' });
  assert.equal(prepared.ok, true, JSON.stringify(prepared));
  assert.equal(prepared.capability_id, 'graph.prepare_artifact_bundle');
  assert.equal(prepared.scope_id, result.scope_id);
  assert.equal(prepared.snapshot_id, result.snapshot_id);
  assert.equal(prepared.bundle.status, 'completed_projection');
  assert.equal(prepared.bundle.artifacts.length, names.length);
  assert.ok(prepared.bundle.artifacts.every((artifact) => artifact.source_ref.startsWith('mindrian-graph://node/')));
  assert.ok(prepared.bundle.artifacts.every((artifact) => /^[a-f0-9]{64}$/.test(artifact.sha256)));

  const opportunityScout = require('../lib/mcp/tools/eureka-graph-opportunity-scout.cjs');
  const scoutTools = new Map();
  opportunityScout.register({ registerTool(name, config, handler) { scoutTools.set(name, { config, handler }); } }, {});
  const scoutTool = scoutTools.get('eureka_graph_opportunity_scout');
  assert.ok(scoutTool, 'MindrianOS registers the graph-to-RS+HSI opportunity scout MCP tool');
  const scoutResult = await opportunityScout.run({
    node_ids: names.map((_name, index) => `claim:${index}`),
    objective: 'Find overlooked opportunities across biological sensing and adaptive control',
    top_k: 5,
  }, {}, { sessionId: 'integration-session' });
  if (!scoutResult.ok && scoutResult.reason === 'engine_job_failed' && scoutResult.failure_code === 'model_unavailable') {
    console.log('eureka opportunity scout: ENGINE UNAVAILABLE (optional local encoder extra is not installed)');
  } else {
    assert.equal(scoutResult.ok, true, JSON.stringify(scoutResult));
    assert.equal(scoutResult.capability_id, 'opportunity.synthesize_discovery_signals');
    assert.equal(scoutResult.scope_id, result.scope_id);
    assert.equal(scoutResult.snapshot_id, result.snapshot_id);
    assert.ok(['completed', 'completed_empty'].includes(scoutResult.status));
    assert.equal(scoutResult.analysis.scope.scope_id, scoutResult.scope_id);
    assert.equal(scoutResult.analysis.scope.snapshot_id, scoutResult.snapshot_id);
    assert.equal(scoutResult.persistence, 'none');
    assert.equal(scoutResult.accepted_knowledge_persistence, 'none');
    assert.equal(scoutResult.engine_state_persistence, 'durable_local_job_store');
    assert.equal(scoutResult.derived_cache_persistence, 'local_embedding_cache_may_be_written');
    assert.equal(scoutResult.review_required, true);
  }
  assert.equal(graphDbHash(), graphDbHashBefore, 'RS+HSI scout leaves the MindrianOS room graph unchanged');
  assert.equal(prepared.review_required, true, 'all engine outputs state the acceptance review gate consistently');
  assert.equal(prepared.acceptance_requires_review, true);
  assert.equal(graphDbHash(), graphDbHashBefore, 'artifact preparation leaves host graph bytes unchanged');

  const genesis = require('../lib/mcp/tools/eureka-graph-genesis-plan.cjs');
  const genesisResult = await genesis.plan({
    node_ids: names.map((_name, index) => `claim:${index}`),
    objective: 'Explore future opportunities in adaptive biological sensing',
    research_year: 2026,
  }, {}, { sessionId: 'integration-session' });
  assert.equal(genesisResult.ok, true, JSON.stringify(genesisResult));
  assert.equal(genesisResult.capability_id, 'research.run_genesis_local_plan');
  assert.equal(genesisResult.scope_id, result.scope_id);
  assert.equal(genesisResult.snapshot_id, result.snapshot_id);
  assert.equal(genesisResult.plan.source_manifest.scope_id, result.scope_id);
  assert.equal(genesisResult.plan.source_manifest.snapshot_id, result.snapshot_id);
  assert.equal(genesisResult.external_research_executed, false);
  assert.equal(genesisResult.review_required, true);
  assert.ok(['plan_ready_for_host_review', 'insufficient_domain_signal'].includes(genesisResult.plan.status));
  assert.equal(graphDbHash(), graphDbHashBefore, 'Genesis planning leaves host graph bytes unchanged');

  const hsi = require('../lib/mcp/tools/eureka-hsi-interpret-whitespace.cjs');
  const hsiTools = new Map();
  hsi.register({ registerTool(name, config, handler) { hsiTools.set(name, { config, handler }); } }, {});
  assert.ok(hsiTools.has('eureka_hsi_interpret_whitespace'), 'graph-derived HSI interpretation MCP tool is registered');
  const interpreted = await hsi.interpret({
    node_ids: ['framework:systems', 'framework:causal', 'problem:wicked', 'claim:0', 'claim:1', 'claim:2'],
    gaps: [{ id: 'gap:wicked', brain_framework_id: 'framework:systems', brain_framework: 'Systems Thinking', gap_percentile: 0.98,
      nearest_room_artifacts: ['claim:0', 'claim:1', 'claim:2'] }],
    umap_2d: { room_artifacts: [
      { id: 'claim:0', x: 0, y: 0 }, { id: 'claim:1', x: 10, y: 0 }, { id: 'claim:2', x: 0, y: 10 },
    ] },
  }, {}, { sessionId: 'integration-session' });
  assert.equal(interpreted.ok, true, JSON.stringify(interpreted));
  assert.equal(interpreted.capability_id, 'portfolio.interpret_whitespace');
  assert.equal(interpreted.snapshot_id, interpreted.analysis.scope.snapshot_id);
  assert.equal(interpreted.analysis.gaps[0].problem_type, 'Wicked', 'Wicked is inherited from the selected MindrianOS ADDRESSES_PROBLEM_TYPE edge');
  assert.equal(interpreted.analysis.gaps[0].confidence, 0.95);
  assert.deepEqual(interpreted.analysis.gaps[0].framework_chain_refs.map((item) => item.id), ['framework:systems', 'framework:causal']);
  assert.equal(interpreted.persistence, 'none');
  assert.equal(interpreted.review_required, true);
  assert.equal(graphDbHash(), graphDbHashBefore, 'HSI interpretation leaves the MindrianOS room graph unchanged');

  const backtest = require('../lib/mcp/tools/eureka-graph-backtest.cjs');
  const backtestTools = new Map();
  backtest.register({ registerTool(name, config, handler) { backtestTools.set(name, { config, handler }); } }, {});
  assert.ok(backtestTools.has('eureka_graph_backtest'), 'temporal graph backtest MCP tool is registered');
  const evaluated = await backtest.backtest({
    node_ids: names.map((_name, index) => `claim:${index}`),
    cutoff: '2021-01-01T00:00:00Z', seed: 7,
  }, {}, { sessionId: 'integration-session' });
  assert.equal(evaluated.ok, true, JSON.stringify(evaluated));
  assert.equal(evaluated.capability_id, 'graph.backtest_relationship_methods');
  assert.equal(evaluated.scope_id, result.scope_id);
  assert.equal(evaluated.snapshot_id, result.snapshot_id);
  assert.equal(evaluated.evaluation.status, 'completed_evaluation');
  assert.equal(evaluated.evaluation.evaluation.future_edges, 2);
  assert.equal(evaluated.persistence, 'none');
  assert.equal(graphDbHash(), graphDbHashBefore, 'temporal graph backtest leaves MindrianOS graph unchanged');

  const surprise = require('../lib/mcp/tools/eureka-graph-score-surprise.cjs');
  const surpriseTools = new Map();
  surprise.register({ registerTool(name, config, handler) { surpriseTools.set(name, { config, handler }); } }, {});
  assert.ok(surpriseTools.has('eureka_graph_score_surprise'), 'Bayesian surprise MCP tool is registered');
  const triage = await surprise.score({
    node_ids: ['claim:0', 'claim:1'],
    claims: [
      { id: 'claim:0', prior: [0.8, 0.9], posterior: [0.2, 0.3] },
      { id: 'claim:1', prior: [0.5, 0.5], posterior: [0.5, 0.5] },
    ],
  }, {}, { sessionId: 'integration-session' });
  assert.equal(triage.ok, true, JSON.stringify(triage));
  assert.equal(triage.capability_id, 'graph.score_bayesian_surprise');
  assert.equal(triage.scope_id, result.scope_id);
  assert.equal(triage.snapshot_id, triage.analysis.snapshot_id);
  assert.equal(triage.analysis.scores.length, 2);
  assert.ok(triage.analysis.scores[0].surprise_bits > triage.analysis.scores[1].surprise_bits);
  assert.equal(triage.persistence, 'none');
  assert.equal(graphDbHash(), graphDbHashBefore, 'Bayesian surprise triage leaves MindrianOS graph unchanged');

  const topics = require('../lib/mcp/tools/eureka-graph-compare-topics.cjs');
  const topicTools = new Map();
  topics.register({ registerTool(name, config, handler) { topicTools.set(name, { config, handler }); } }, {});
  assert.ok(topicTools.has('eureka_graph_compare_topics'), 'bidirectional topic comparison MCP tool is registered');
  const compared = await topics.compare({
    node_ids_a: ['claim:0', 'claim:1'], node_ids_b: ['claim:3', 'claim:4'],
    k: 1, tau: 0.18, seeds: [1],
  }, {}, { sessionId: 'integration-session' });
  assert.equal(compared.ok, true, JSON.stringify(compared));
  assert.equal(compared.capability_id, 'graph.compare_bidirectional_topics');
  assert.equal(compared.scope_id, result.scope_id);
  assert.equal(compared.analysis.snapshot_id, compared.projection.snapshot_id);
  assert.deepEqual(compared.corpus_refs.texts_a, ['claim:0', 'claim:1']);
  assert.equal(compared.persistence, 'none');
  assert.equal(graphDbHash(), graphDbHashBefore, 'bidirectional topic comparison leaves MindrianOS graph unchanged');

  const pathRanker = require('../lib/mcp/tools/eureka-graph-rank-paths.cjs');
  const pathTools = new Map();
  pathRanker.register({ registerTool(name, config, handler) { pathTools.set(name, { config, handler }); } }, {});
  assert.ok(pathTools.has('eureka_graph_rank_paths'), 'evidence-path ranking MCP tool is registered');
  const rankedPaths = await pathRanker.rank({
    node_ids: ['claim:0', 'claim:1', 'claim:2'],
    paths: [{ node_ids: ['claim:0', 'claim:1', 'claim:2'], edge_types: ['RELATES_TO', 'RELATES_TO'] }],
  }, {}, { sessionId: 'integration-session' });
  assert.equal(rankedPaths.ok, true, JSON.stringify(rankedPaths));
  assert.equal(rankedPaths.capability_id, 'graph.rank_evidence_paths');
  assert.equal(rankedPaths.scope_id, result.scope_id);
  assert.equal(rankedPaths.analysis.snapshot_id, rankedPaths.projection.snapshot_id);
  assert.deepEqual(rankedPaths.analysis.paths[0].nodes.map((node) => node.id), ['claim:0', 'claim:1', 'claim:2']);
  assert.equal(rankedPaths.analysis.paths[0].summary.n_with_evidence, 1);
  assert.equal(rankedPaths.analysis.paths[0].summary.n_unknown, 1);
  assert.equal(rankedPaths.persistence, 'none');
  assert.equal(graphDbHash(), graphDbHashBefore, 'evidence-path ranking leaves MindrianOS graph unchanged');

  const packager = require('../lib/mcp/tools/eureka-graph-package-relationships.cjs');
  const packageTools = new Map();
  packager.register({ registerTool(name, config, handler) { packageTools.set(name, { config, handler }); } }, {});
  assert.ok(packageTools.has('eureka_graph_package_relationships'), 'relationship packaging MCP tool is registered');
  const packaged = await packager.packageRelationships({
    node_ids: ['claim:0', 'claim:1', 'evidence:source-1'],
    relationships: [{ source_id: 'claim:0', target_id: 'claim:1', relation: 'RELATED_TO',
      rationale: 'The selected source supports a possible connection for review.', evidence_ids: ['evidence:source-1'] }],
  }, {}, { sessionId: 'integration-session' });
  assert.equal(packaged.ok, true, JSON.stringify(packaged));
  assert.equal(packaged.capability_id, 'graph.package_relationship_proposals');
  assert.equal(packaged.scope_id, result.scope_id);
  assert.equal(packaged.snapshot_id, packaged.proposals.snapshot_id);
  assert.equal(packaged.proposals.status, 'completed_proposal_packaging');
  assert.equal(packaged.proposals.proposals[0].status, 'proposed_for_human_review');
  assert.equal(packaged.proposals.proposals[0].evidence[0].source_ref, 'mindrian-graph://node/evidence%3Asource-1');
  assert.equal(packaged.persistence, 'none');
  assert.equal(packaged.review_required, true);
  assert.equal(graphDbHash(), graphDbHashBefore, 'relationship packaging leaves MindrianOS graph unchanged');

  // Close the live authorization gap: exercise the real session resolver and
  // room-binding store while Eureka analyzes only the room bound to this MCP
  // session. The synthetic stubbed-room checks above remain useful for
  // deterministic fixture data; this verifies the actual host authorization
  // path joined to a live Eureka worker.
  sessionRoom.resolveMcpSessionRoom = originalResolve;
  delete require.cache[require.resolve('../lib/mcp/tools/eureka-graph-projection.cjs')];
  delete require.cache[require.resolve('../lib/mcp/tools/eureka-graph-analyze.cjs')];
  const realBridge = require('../lib/mcp/tools/eureka-graph-analyze.cjs');
  const isolatedHome = require('./helpers/isolated-home-36925.cjs');
  const isolated = isolatedHome.mkIsolatedHome('eureka-live-bound-bridge');
  try {
    const sessionId = 'eureka-live-bound-bridge-session';
    const born = isolatedHome.birthFixtureRoom({
      iso: isolated, slug: 'eureka-live-bound-bridge', sessionId: 'fixture-room-birth',
      ventureText: 'A bounded synthetic room for a live Eureka authorization test.',
    });
    const navigation = require('../lib/core/navigation.cjs');
    const roomDb = navigation.openRoomDbForCaller(born.roomDir);
    const boundNodeIds = [];
    try {
      for (const [index, text] of [
        'Biological sensors detect cellular stress through molecular signals and fluorescence measurements.',
        'Adaptive control systems adjust robotic motion using feedback from distributed sensor arrays.',
        'Medical imaging pipelines identify tissue anomalies from spectral and magnetic measurements.',
        'Environmental monitoring networks track water contamination with field-deployed biosensors.',
      ].entries()) {
        const claim = navigation.writeClaimNode(roomDb, {
          knowledge_type: 'fact', text, sessionId,
          sourceSegment: `eureka-live-bound-claim-${index + 1}`,
        });
        assert.equal(claim.ok, true, JSON.stringify(claim));
        boundNodeIds.push(claim.node_id);
      }
    } finally { navigation.closeRoomDbForCaller(roomDb); }
    require('../lib/core/session-binding.cjs').writeSessionBinding(sessionId, {
      bound: [born.slug], primary: born.slug, sticky: true,
    }, { home: isolated.roomsHome });
    process.env.HOME = isolated.home;
    process.env.USERPROFILE = isolated.home;
    process.env.MINDRIAN_ROOMS_HOME = isolated.roomsHome;
    delete process.env.CLAUDE_ACTIVE_ROOM;
    const boundDbPath = path.join(born.roomDir, '.mindrian', 'room.db');
    const boundDbHash = crypto.createHash('sha256').update(fs.readFileSync(boundDbPath)).digest('hex');
    const liveBoundResult = await realBridge.analyze({
      node_ids: boundNodeIds, top: 10, seed: 7, null_rounds: 1,
    }, {}, { sessionId });
    assert.equal(liveBoundResult.ok, true, JSON.stringify(liveBoundResult));
    assert.equal(liveBoundResult.scope_id, born.room_id);
    assert.equal(liveBoundResult.room_binding.source, 'session.primary');
    assert.equal(liveBoundResult.analysis.scope_id, born.room_id);
    assert.equal(liveBoundResult.analysis.snapshot_id, liveBoundResult.snapshot_id);
    assert.equal(fs.existsSync(boundDbPath), true);
    delete require.cache[require.resolve('../lib/mcp/tools/eureka-graph-discovery-signals.cjs')];
    const realGraphDiscovery = require('../lib/mcp/tools/eureka-graph-discovery-signals.cjs');
    const liveStructuralGaps = await realGraphDiscovery.runDiscoverySignal(realGraphDiscovery.TOOLS[0], {
      node_ids: boundNodeIds,
    }, {}, { sessionId });
    assert.equal(liveStructuralGaps.ok, true, JSON.stringify(liveStructuralGaps));
    assert.equal(liveStructuralGaps.room_binding.source, 'session.primary');
    assert.equal(liveStructuralGaps.scope_id, born.room_id);
    assert.equal(liveStructuralGaps.analysis.snapshot_id, liveStructuralGaps.snapshot_id);
    assert.equal(crypto.createHash('sha256').update(fs.readFileSync(boundDbPath)).digest('hex'), boundDbHash,
      'live Eureka graph analysis leaves the real session-bound room.db unchanged');
  } finally {
    isolated.cleanup();
    sessionRoom.resolveMcpSessionRoom = originalResolve;
  }
  process.stdout.write('eureka live bridge: PASS (real bound-session authorization -> read-only MindrianOS projection -> live Eureka MCP -> lineage-bound results)\n');
}

main().catch((error) => { process.stderr.write((error.stack || String(error)) + '\n'); process.exitCode = 1; })
  .finally(() => {
    sessionRoom.resolveMcpSessionRoom = originalResolve;
    fs.rmSync(roomDir, { recursive: true, force: true });
  });
