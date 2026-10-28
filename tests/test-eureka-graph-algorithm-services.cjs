'use strict';

// Plan 373-01: the five room-backed Eureka graph algorithm services.
// Negative and boundary cases. No Eureka engine is started here: every engine
// call is a counted stub, and the refusal cases prove the stub is never called.
// The real session resolver and a real bound room are used for authorization.

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const savedEnv = {};
for (const key of ['HOME', 'USERPROFILE', 'MINDRIAN_ROOMS_HOME', 'CLAUDE_ACTIVE_ROOM', 'MINDRIAN_EUREKA_ROOT']) savedEnv[key] = process.env[key];
function restoreEnv() {
  for (const [key, value] of Object.entries(savedEnv)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
}

const { TOOLS, runDiscoverySignal, register } = require('../lib/mcp/tools/eureka-graph-discovery-signals.cjs');

const EXPECTED = {
  'graph.find_structural_gaps': ['min_common', 'hub_cap', 'top'],
  'graph.find_network_holes': ['rounds', 'seed', 'hub_cap', 'cycle_limit', 'top', 'include_persistence'],
  'graph.find_bridge_pairs': ['seed', 'top', 'per_node', 'min_betweenness'],
  'graph.assess_edge_atypicality': ['category_attribute', 'shuffles', 'seed', 'use_label'],
  'graph.find_semantic_gaps': ['text_label', 'min_similarity', 'top'],
};

const host = (overrides = {}) => ({
  ok: true, scope_id: 'room-test', snapshot_id: 'snapshot-test',
  room_binding: { room_id: 'room-test', source: 'session.primary', registry_fallback: false },
  snapshot: { nodes: [{ id: 'n1' }, { id: 'n2' }], edges: [], meta: { complete: true, omissions: {} } },
  ...overrides,
});
const goodResult = (spec) => ({ capability_id: spec.capability_id, scope_id: 'room-test', snapshot_id: 'snapshot-test', status: 'completed_analysis' });

async function main() {
  // 1. Five independent, specifically named tools, one capability each, with only
  //    the algorithm-specific options accepted (strict schema, no room path).
  assert.equal(TOOLS.length, 5);
  assert.deepEqual(TOOLS.map((spec) => spec.capability_id).sort(), Object.keys(EXPECTED).sort());
  assert.equal(new Set(TOOLS.map((spec) => spec.tool)).size, 5, 'tool names are unique');
  const registered = new Map();
  register({ registerTool: (name, config, handler) => registered.set(name, { config, handler }) }, {});
  assert.equal(registered.size, 5);
  for (const spec of TOOLS) {
    const entry = registered.get(spec.tool);
    assert.deepEqual(Object.keys(spec.options.shape).sort(), [...EXPECTED[spec.capability_id]].sort(), `${spec.capability_id} option set`);
    const schema = entry.config.inputSchema;
    assert.equal(schema.safeParse({ node_ids: ['claim:a'] }).success, true, `${spec.tool} accepts node_ids alone`);
    assert.equal(schema.safeParse({ node_ids: [] }).success, false, `${spec.tool} refuses an empty selection`);
    assert.equal(schema.safeParse({ node_ids: ['claim:a'], room_path: '/tmp/room' }).success, false, `${spec.tool} refuses a caller room path`);
    assert.equal(schema.safeParse({ node_ids: ['claim:a'], snapshot: { nodes: [], edges: [] } }).success, false, `${spec.tool} refuses a caller graph object`);
    assert.equal(schema.safeParse({ node_ids: ['claim:a'], capability_id: 'graph.find_bridge_pairs' }).success, false, `${spec.tool} refuses a caller capability ID`);
    assert.equal(schema.safeParse({ node_ids: ['../etc/passwd'] }).success, false, `${spec.tool} refuses path-like node IDs`);
    assert.equal(schema.safeParse({ node_ids: ['claim:a'], not_an_option: 1 }).success, false);
    // An option that belongs to a different algorithm is refused.
    const foreign = Object.values(EXPECTED).flat().find((name) => !EXPECTED[spec.capability_id].includes(name));
    assert.equal(schema.safeParse({ node_ids: ['claim:a'], [foreign]: 1 }).success, false, `${spec.tool} refuses foreign option ${foreign}`);
    // Read-only annotations and typed output are declared.
    assert.equal(entry.config.annotations.readOnlyHint, true);
    assert.equal(entry.config.annotations.openWorldHint, false);
    assert.ok(entry.config.outputSchema, `${spec.tool} declares a typed output contract`);
  }

  // 2. Lineage fails closed: missing, null, empty or wrong identity is refused.
  const badResults = {
    'missing capability_id': (spec) => { const r = goodResult(spec); delete r.capability_id; return r; },
    'wrong capability_id': (spec) => ({ ...goodResult(spec), capability_id: TOOLS.find((other) => other !== spec).capability_id }),
    'missing scope_id': (spec) => { const r = goodResult(spec); delete r.scope_id; return r; },
    'null scope_id': (spec) => ({ ...goodResult(spec), scope_id: null }),
    'empty scope_id': (spec) => ({ ...goodResult(spec), scope_id: '' }),
    'wrong scope_id': (spec) => ({ ...goodResult(spec), scope_id: 'other-room' }),
    'missing snapshot_id': (spec) => { const r = goodResult(spec); delete r.snapshot_id; return r; },
    'null snapshot_id': (spec) => ({ ...goodResult(spec), snapshot_id: null }),
    'wrong snapshot_id': (spec) => ({ ...goodResult(spec), snapshot_id: 'other-snapshot' }),
    'null result': () => null,
    'empty result': () => ({}),
  };
  for (const spec of TOOLS) {
    for (const [label, make] of Object.entries(badResults)) {
      const out = await runDiscoverySignal(spec, { node_ids: ['n1'] }, {}, {}, {
        project: () => host(), callEurekaWorkflow: async () => ({ ok: true, result: make(spec) }),
      });
      assert.equal(out.ok, false, `${spec.capability_id}: ${label} is refused`);
      assert.equal(out.reason, 'engine_lineage_mismatch', `${spec.capability_id}: ${label}`);
      assert.equal('analysis' in out, false, `${spec.capability_id}: ${label} returns no untrusted analysis`);
    }
    // A host projection without identity never reaches the engine.
    let launched = 0;
    for (const broken of [{ scope_id: null }, { snapshot_id: '' }, { scope_id: undefined }]) {
      const out = await runDiscoverySignal(spec, { node_ids: ['n1'] }, {}, {}, {
        project: () => host(broken), callEurekaWorkflow: async () => { launched += 1; return { ok: true, result: goodResult(spec) }; },
      });
      assert.equal(out.ok, false);
      assert.equal(out.reason, 'projection_lineage_unavailable');
    }
    assert.equal(launched, 0, 'an identity-less projection never starts an engine');
  }

  // 3. Engine failure statuses map to typed refusals, never to "ok" or to a
  //    misleading lineage error, and never forward engine free text.
  for (const spec of TOOLS) {
    for (const status of ['invalid_input', 'failed', 'blocked', 'cancelled', 'expired']) {
      const out = await runDiscoverySignal(spec, { node_ids: ['n1'] }, {}, {}, {
        project: () => host(),
        callEurekaWorkflow: async () => ({ ok: true, result: { status, capability_id: spec.capability_id, error: '/home/secret/path leaked' } }),
      });
      assert.equal(out.ok, false, `${spec.capability_id}: ${status}`);
      assert.equal(out.reason, `engine_${status}`);
      assert.equal(out.engine_status, status);
      assert.equal(out.persistence, 'none');
      assert.equal(JSON.stringify(out).includes('/home/secret'), false, 'engine free text is not forwarded');
    }
  }

  // 4. Success carries lineage, review state, and no persistence. Projection
  //    truncation and omissions are visible at the top level.
  const truncated = host({ snapshot: { nodes: [{ id: 'n1' }], edges: [], meta: {
    complete: false, omissions: { requested_nodes: 3, missing_nodes: 1, empty_text_nodes: 0, text_truncated_nodes: 1, edges_truncated: true } } } });
  for (const spec of TOOLS) {
    for (const [label, projected] of [['complete', host()], ['truncated', truncated]]) {
      const out = await runDiscoverySignal(spec, { node_ids: ['n1', 'n2'] }, {}, {}, {
        project: () => projected, callEurekaWorkflow: async () => ({ ok: true, result: goodResult(spec) }),
      });
      assert.equal(out.ok, true, `${spec.capability_id} ${label}`);
      assert.equal(out.capability_id, spec.capability_id);
      assert.equal(out.scope_id, 'room-test');
      assert.equal(out.snapshot_id, 'snapshot-test');
      assert.equal(out.review_required, true);
      assert.equal(out.acceptance_requires_review, true);
      assert.equal(out.persistence, 'none');
      assert.equal(out.partial, label === 'truncated');
      assert.equal(out.projection_complete, label === 'complete');
      assert.deepEqual(out.projection_omissions, projected.snapshot.meta.omissions);
    }
  }

  // 5. Options are forwarded as given, node_ids never reach the engine request,
  //    and the engine request has exactly the snapshot plus validated options.
  for (const spec of TOOLS) {
    let seen;
    const opts = Object.fromEntries(EXPECTED[spec.capability_id].slice(0, 1).map((name) => [name, 1]));
    await runDiscoverySignal(spec, { node_ids: ['n1'], ...opts }, {}, {}, {
      project: () => host(),
      callEurekaWorkflow: async (capabilityId, request) => { seen = { capabilityId, request }; return { ok: true, result: goodResult(spec) }; },
    });
    assert.equal(seen.capabilityId, spec.capability_id);
    assert.deepEqual(Object.keys(seen.request).sort(), ['snapshot', ...Object.keys(opts)].sort());
  }

  // 6. Cancellation: the host abort signal reaches the engine call, and an
  //    already-aborted signal stops the real engine caller before any launch.
  for (const spec of TOOLS) {
    const controller = new AbortController();
    let passed;
    await runDiscoverySignal(spec, { node_ids: ['n1'] }, {}, { mcpReq: { signal: controller.signal } }, {
      project: () => host(),
      callEurekaWorkflow: async (_id, _request, _env, signal) => { passed = signal; return { ok: true, result: goodResult(spec) }; },
    });
    assert.equal(passed, controller.signal, `${spec.capability_id} forwards the host abort signal`);
  }
  process.env.MINDRIAN_EUREKA_ROOT = path.join(os.tmpdir(), 'mos-373-no-such-eureka-root');
  const abortedController = new AbortController();
  abortedController.abort();
  for (const spec of TOOLS) {
    const out = await runDiscoverySignal(spec, { node_ids: ['n1'] }, {}, { signal: abortedController.signal }, { project: () => host() });
    assert.equal(out.ok, false);
    assert.equal(out.reason, 'cancelled', `${spec.capability_id} aborted before launch`);
  }

  // 7. Authorization refusal with the REAL resolver: unbound session and a
  //    registry active-room fallback never reach the engine call.
  const resolverHome = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-373-unbound-'));
  process.env.MINDRIAN_ROOMS_HOME = resolverHome;
  delete process.env.CLAUDE_ACTIVE_ROOM;
  let launches = 0;
  const counted = (spec) => async () => { launches += 1; return { ok: true, result: goodResult(spec) }; };
  for (const spec of TOOLS) {
    const unbound = await runDiscoverySignal(spec, { node_ids: ['claim:a'] }, {}, { sessionId: 'mos-373-unbound' }, { callEurekaWorkflow: counted(spec) });
    assert.equal(unbound.ok, false);
    assert.equal(unbound.reason, 'no_bound_room', `${spec.capability_id} unbound session`);
  }
  const fallbackRoom = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-373-fallback-room-'));
  fs.mkdirSync(path.join(resolverHome, '.rooms'), { recursive: true });
  fs.writeFileSync(path.join(resolverHome, '.rooms', 'registry.json'), JSON.stringify({
    active: 'fallback', rooms: { fallback: { abs_path: fallbackRoom, status: 'active' } },
  }));
  for (const spec of TOOLS) {
    const fallback = await runDiscoverySignal(spec, { node_ids: ['claim:a'] }, {}, { sessionId: 'mos-373-fallback' }, { callEurekaWorkflow: counted(spec) });
    assert.equal(fallback.ok, false);
    assert.equal(fallback.reason, 'no_bound_room', `${spec.capability_id} registry fallback`);
  }
  assert.equal(launches, 0, 'no engine call after an authorization refusal');
  fs.rmSync(resolverHome, { recursive: true, force: true });
  fs.rmSync(fallbackRoom, { recursive: true, force: true });

  // 8. Real bound room: a missing node ID is disclosed as a partial projection,
  //    the room database is byte-identical afterwards, and the call is not persisted.
  const helper = require('./helpers/isolated-home-36925.cjs');
  const isolated = helper.mkIsolatedHome('eureka-373-services');
  try {
    const born = helper.birthFixtureRoom({ iso: isolated, slug: 'eureka-373-services', sessionId: 'fixture-birth' });
    const nav = require('../lib/core/navigation.cjs');
    const sessionId = 'eureka-373-services-session';
    const writeDb = nav.openRoomDbForCaller(born.roomDir);
    const ids = [];
    try {
      for (const [index, text] of ['Sensors detect cellular stress.', 'Control systems adjust robot motion.', 'Imaging finds tissue anomalies.'].entries()) {
        const claim = nav.writeClaimNode(writeDb, { knowledge_type: 'fact', text, sessionId, sourceSegment: `eureka-373-${index}` });
        assert.equal(claim.ok, true, JSON.stringify(claim));
        ids.push(claim.node_id);
      }
    } finally { nav.closeRoomDbForCaller(writeDb); }
    require('../lib/core/session-binding.cjs').writeSessionBinding(sessionId, { bound: [born.slug], primary: born.slug, sticky: true }, { home: isolated.roomsHome });
    process.env.MINDRIAN_ROOMS_HOME = isolated.roomsHome;
    delete process.env.CLAUDE_ACTIVE_ROOM;
    const dbPath = path.join(born.roomDir, '.mindrian', 'room.db');
    const hashBefore = crypto.createHash('sha256').update(fs.readFileSync(dbPath)).digest('hex');
    for (const spec of TOOLS) {
      let requestSeen;
      const out = await runDiscoverySignal(spec, { node_ids: [...ids, 'claim:does-not-exist'] }, {}, { sessionId }, {
        callEurekaWorkflow: async (capabilityId, request) => {
          requestSeen = request;
          return { ok: true, result: { capability_id: capabilityId, scope_id: request.snapshot.meta.scope_id, snapshot_id: request.snapshot.meta.snapshot_id, status: 'completed_analysis' } };
        },
      });
      assert.equal(out.ok, true, JSON.stringify(out));
      assert.equal(out.scope_id, born.room_id);
      assert.equal(out.room_binding.source, 'session.primary');
      assert.equal(out.partial, true, `${spec.capability_id} discloses the missing node`);
      assert.equal(out.projection_omissions.missing_nodes, 1);
      assert.equal(out.persistence, 'none');
      assert.equal(out.review_required, true);
      assert.deepEqual(requestSeen.snapshot.nodes.map((node) => node.id).sort(), [...ids].sort(), 'only selected existing nodes reach the engine');
      assert.equal(JSON.stringify(requestSeen).includes(born.roomDir), false, 'no room path reaches the engine request');
    }
    assert.equal(crypto.createHash('sha256').update(fs.readFileSync(dbPath)).digest('hex'), hashBefore, 'room.db is byte-identical after all five services');
  } finally {
    isolated.cleanup();
  }

  console.log('eureka graph algorithm services: PASS (5 tools, strict options, fail-closed lineage, typed engine statuses, partial disclosure, cancellation, real-resolver refusal, non-persistence)');
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(restoreEnv);
