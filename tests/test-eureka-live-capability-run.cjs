'use strict';

// Live catalog-driven MindrianOS -> Eureka MCP dispatch on a schema-bounded
// host-supplied request. No MindrianOS room data or graph write is involved.

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('@modelcontextprotocol/client');
const { StdioClientTransport } = require('@modelcontextprotocol/client/stdio');
const { run, resolveCapability } = require('../lib/mcp/tools/eureka-capability-run.cjs');

if (!process.env.MINDRIAN_EUREKA_ROOT) {
  throw new Error('Set MINDRIAN_EUREKA_ROOT to the Mindrian Eureka checkout to run this integration test.');
}

async function main() {
  const catalogPath = path.join(process.env.MINDRIAN_EUREKA_ROOT, 'src/mindrian_eureka/data/capability-catalog.v1.json');
  const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
  const runnable = catalog.capabilities.filter((capability) => ['experimental', 'host_brokered'].includes(capability.status));
  const unavailable = catalog.capabilities.filter((capability) => ['planned', 'blocked'].includes(capability.status));
  assert.equal(runnable.length, 58);
  assert.equal(unavailable.length, 8);
  const cliCounts = new Map();
  for (const capability of runnable) {
    const route = resolveCapability(catalog, capability.id);
    assert.equal(route.ok, true, `${capability.id}: ${route.reason || ''}`);
    const cli = capability.routes && capability.routes.cli;
    assert.ok(cli && typeof cli.executable === 'string', `${capability.id} publishes a CLI route`);
    cliCounts.set(cli.executable, (cliCounts.get(cli.executable) || 0) + 1);
  }
  assert.deepEqual(Object.fromEntries([...cliCounts.entries()].sort()), {
    'eureka-decision-sequences': 2, 'eureka-pair-scout': 1, 'eureka-signal-scout': 1,
    'eureka-structure-mapping': 1, 'eureka-workflow': 53,
  });
  const workflowHelp = spawnSync(process.env.MINDRIAN_EUREKA_UV || 'uv', [
    'run', '--project', process.env.MINDRIAN_EUREKA_ROOT, 'eureka-workflow', '--help',
  ], { encoding: 'utf8', timeout: 30000 });
  assert.equal(workflowHelp.status, 0, workflowHelp.stderr);
  for (const capability of runnable.filter((item) => item.routes.cli.executable === 'eureka-workflow')) {
    assert.ok(workflowHelp.stdout.includes(capability.id), `${capability.id} is accepted by the eureka-workflow CLI`);
  }
  for (const [command, legacy] of [
    ['eureka-pair-scout', 'eureka-rs'],
    ['eureka-structure-mapping', 'eureka-sme'],
    ['eureka-decision-sequences', 'eureka-omm'],
    ['eureka-decision-sequences-web', 'eureka-omm-web'],
    ['eureka-signal-scout', 'eureka-scout'],
  ]) {
    for (const executable of [command, legacy]) {
      const help = spawnSync(process.env.MINDRIAN_EUREKA_UV || 'uv', [
        'run', '--project', process.env.MINDRIAN_EUREKA_ROOT, executable, '--help',
      ], { encoding: 'utf8', timeout: 30000 });
      assert.equal(help.status, 0, `${executable} CLI route is installed and runnable: ${help.stderr}`);
    }
  }
  for (const capability of unavailable) {
    const route = resolveCapability(catalog, capability.id);
    assert.equal(route.ok, false, capability.id);
    assert.equal(route.reason, 'capability_not_runnable', capability.id);
    assert.equal(capability.routes && capability.routes.cli, undefined, `${capability.id} must not claim a CLI route before implementation`);
  }

  // Verify the live Eureka server publishes a valid input/output contract for
  // every runnable catalog entry, not just the one exercised below.
  const transport = new StdioClientTransport({
    command: process.env.MINDRIAN_EUREKA_UV || 'uv',
    args: ['run', '--project', process.env.MINDRIAN_EUREKA_ROOT, '--extra', 'mcp-server', 'eureka-mcp'],
    cwd: process.env.MINDRIAN_EUREKA_ROOT,
  });
  const contractClient = new Client({ name: 'mindrian-capability-contract-audit', version: '1.0.0' }, { capabilities: {} });
  await contractClient.connect(transport);
  try {
    const toolList = await contractClient.listTools();
    const publishedToolNames = new Set(toolList.tools.map((tool) => tool.name));
    assert.ok(publishedToolNames.has('scout_capabilities'), 'live MCP publishes the capability catalog tool');
    const catalogResponse = await contractClient.callTool({ name: 'scout_capabilities', arguments: {} });
    assert.notEqual(catalogResponse.isError, true, 'live MCP capability catalog is readable');
    const exposedCatalog = catalogResponse.structuredContent || JSON.parse(catalogResponse.content.find((item) => item.type === 'text').text);
    assert.equal(exposedCatalog.capabilities.length, catalog.capabilities.length);
    const exposedById = new Map(exposedCatalog.capabilities.map((item) => [item.id, item]));
    for (const item of catalog.capabilities) {
      const exposed = exposedById.get(item.id);
      assert.ok(exposed, `${item.id} is discoverable through the live MCP catalog`);
      assert.equal(exposed.name, item.name, `${item.id} preserves its user-facing name`);
      assert.equal(exposed.jtbd, item.jtbd, `${item.id} preserves its JTBD`);
      assert.equal(exposed.status, item.status, `${item.id} preserves its readiness`);
      if (['planned', 'blocked'].includes(item.status)) {
        assert.equal(exposed.routes && exposed.routes.cli, undefined, `${item.id} remains without an executable CLI route`);
        assert.equal(exposed.routes && exposed.routes.mcp, undefined, `${item.id} remains without an invocation MCP route`);
      }
    }
    for (const capability of runnable) {
      assert.ok(publishedToolNames.has(capability.routes.mcp.tool),
        `${capability.id} catalog MCP route ${capability.routes.mcp.tool} is advertised by the live server`);
      const response = await contractClient.callTool({ name: 'scout_capability_contract', arguments: { capability_id: capability.id } });
      assert.notEqual(response.isError, true, `${capability.id} contract endpoint must succeed`);
      const contract = response.structuredContent || JSON.parse(response.content.find((item) => item.type === 'text').text);
      assert.equal(contract.capability.id, capability.id);
      assert.ok(contract.schemas && contract.schemas.input && contract.schemas.output, `${capability.id} publishes input and output schemas`);
    }
  } finally {
    await contractClient.close();
  }

  const result = await run({
    capability_id: 'research.analyze_rs_domain_projection',
    request: {
      scope_id: 'room:generic-bridge-test',
      snapshot_id: 'snapshot:generic-bridge-test',
      topic: 'low cost prosthetic touch feedback',
      substrate: [{
        id: 'framework:prosthetics', score: 0.9, source_ids: ['node:frame-1'],
        metadata: { framework_name: 'Prosthetics', title: 'Prosthetic systems',
          text: 'Prosthetic systems combine sensing, control, materials, and clinical workflows.' },
      }],
    },
  });
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.capability_id, 'research.analyze_rs_domain_projection');
  assert.equal(result.readiness, 'experimental');
  assert.equal(result.status, 'domain_analysis_ready');
  assert.equal(result.engine_result.scope_id, 'room:generic-bridge-test');
  assert.ok(result.contract.input && result.contract.output);
  assert.equal(result.persistence, 'none');
  assert.equal(result.accepted_knowledge_persistence, 'none');
  assert.equal(result.engine_state_persistence, 'none');
  assert.equal(result.derived_cache_persistence, 'none');

  // Exercise the two direct MCP routes as independent capabilities. These do
  // not require the MindrianOS graph projection and are not a Theo workflow.
  const mapping = await run({
    capability_id: 'analogy.map_structure',
    request: { document: {
      run_id: 'mos-direct-map', scope_id: 'room:direct-map',
      target: { name: 'target', entities: ['oxygen', 'plant'],
        expressions: [{ name: 'flow', functor: 'flow', args: ['oxygen', 'plant'] }] },
      target_evidence: { flow: ['claim-target'] },
      evidence_catalog: [
        { claim_id: 'claim-target', source_ref: 'room://claim/target', text: 'oxygen flows to plant' },
        { claim_id: 'claim-base', source_ref: 'room://claim/base', text: 'water flows to tree' },
      ],
      bases: [{ base_id: 'water', domain: 'hydrology',
        description: { name: 'source', entities: ['water', 'tree'],
          expressions: [{ name: 'flow', functor: 'flow', args: ['water', 'tree'] }] },
        evidence: { flow: ['claim-base'] } }],
      rules: ['AN'], max_maps_per_base: 2,
    } },
  });
  assert.equal(mapping.ok, true, JSON.stringify(mapping));
  assert.equal(mapping.capability_id, 'analogy.map_structure');
  assert.equal(mapping.route, 'scout_sme_map');
  assert.equal(mapping.engine_result.scope_id, 'room:direct-map');
  assert.equal(mapping.persistence, 'none');

  const probabilityModel = (id, probability) => ({
    id, label: id, initial_distribution: [0.25, 0.25, 0.25, 0.25],
    transition_matrix: Array.from({ length: 4 }, () => [0.25, 0.25, 0.25, 0.25]),
    emission_probabilities: Array.from({ length: 4 }, () => Array(4).fill(probability)),
  });
  const sequence = await run({
    capability_id: 'decision.compare_sequence_patterns',
    request: {
      scope_id: 'room:direct-sequence', snapshot_id: 'snapshot:direct-sequence',
      sequence_id: 'decision-trace-1',
      observations: [{ step_id: 'step-1', features: {
        complex_features: true, multidirectional_causation: true,
        holistic_view: false, creative_synthesis: true,
      } }],
      models: [probabilityModel('high-emission', 0.8), probabilityModel('low-emission', 0.3)],
    },
  });
  assert.equal(sequence.ok, true, JSON.stringify(sequence));
  assert.equal(sequence.capability_id, 'decision.compare_sequence_patterns');
  assert.equal(sequence.route, 'decision_compare_sequence_patterns');
  assert.equal(sequence.engine_result.scope.scope_id, 'room:direct-sequence');
  assert.equal(sequence.persistence, 'none');

  const codedObservations = (prefix) => Array.from({ length: 16 }, (_, index) => ({
    step_id: `${prefix}-${index + 1}`,
    features: {
      complex_features: index % 2 === 0,
      multidirectional_causation: index % 3 !== 0,
      holistic_view: index % 4 < 2,
      creative_synthesis: index % 5 === 0,
    },
  }));
  const fit = await run({
    capability_id: 'decision.fit_sequence_patterns',
    request: {
      training_mode: 'exploratory_unlabeled_baum_welch',
      seed_model: probabilityModel('seed-model', 0.5),
      sequences: [
        { observations: codedObservations('trace-a') },
        { observations: codedObservations('trace-b') },
      ],
      max_iterations: 1,
    },
  });
  assert.equal(fit.ok, true, JSON.stringify(fit));
  assert.equal(fit.capability_id, 'decision.fit_sequence_patterns');
  assert.equal(fit.route, 'decision_fit_sequence_patterns');
  assert.equal(fit.engine_result.status, 'exploratory_unvalidated_fit');
  assert.equal(fit.engine_result.observation_count, 32);
  assert.equal(fit.persistence, 'none');

  const planned = await run({ capability_id: 'claims.compare', request: {} });
  assert.equal(planned.ok, false);
  assert.equal(planned.reason, 'capability_not_runnable');
  assert.equal(planned.readiness, 'planned');
  console.log('eureka live capability bridge: PASS (contract discovery, generic and direct dispatch, planned refusal)');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
