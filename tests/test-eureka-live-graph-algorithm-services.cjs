'use strict';

// Plan 373-01 live check: the five room-backed graph algorithm services against
// a real Eureka stdio MCP process, through the REAL session resolver and a real
// bound temporary room. The installed Eureka CLI is run on the same snapshot to
// show CLI and MCP share one implementation. Set MINDRIAN_EUREKA_ROOT to run.

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const engineRoot = process.env.MINDRIAN_EUREKA_ROOT;
if (!engineRoot) throw new Error('Set MINDRIAN_EUREKA_ROOT to the Mindrian Eureka checkout to run this integration test.');

const TEXTS = [
  'Biological sensors detect cellular stress through molecular signals and fluorescence measurements.',
  'Adaptive control systems adjust robotic motion using feedback from distributed sensor arrays.',
  'Medical imaging pipelines identify tissue anomalies from spectral and magnetic measurements.',
  'Environmental monitoring networks track water contamination with field-deployed biosensors.',
  'Robotic prostheses translate neural signals into motor control and tactile feedback for users.',
  'Microfluidic devices isolate rare cells for rapid diagnostic testing and targeted treatment.',
  'Spectral imaging of tissue samples supports rapid diagnostic testing of rare cells.',
  'Feedback control of robotic sensor arrays improves tactile signal measurements.',
];
// Ring plus two chords: gives open triads, induced four-cycles, and enough
// distinct edges for the degree-preserving rewiring nulls.
const EDGES = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 0], [0, 2], [4, 6]];

async function main() {
  const helper = require('./helpers/isolated-home-36925.cjs');
  const isolated = helper.mkIsolatedHome('eureka-373-live-services');
  const savedEnv = { HOME: process.env.HOME, USERPROFILE: process.env.USERPROFILE, MINDRIAN_ROOMS_HOME: process.env.MINDRIAN_ROOMS_HOME };
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-373-live-'));
  process.env.MINDRIAN_EUREKA_DATA_DIR = path.join(scratch, 'eureka-data');
  try {
    const born = helper.birthFixtureRoom({ iso: isolated, slug: 'eureka-373-live-services', sessionId: 'fixture-birth' });
    const nav = require('../lib/core/navigation.cjs');
    const sessionId = 'eureka-373-live-services-session';
    const db = nav.openRoomDbForCaller(born.roomDir);
    const ids = [];
    try {
      for (const [index, text] of TEXTS.entries()) {
        const claim = nav.writeClaimNode(db, { knowledge_type: 'fact', text, sessionId, sourceSegment: `eureka-373-live-${index}` });
        assert.equal(claim.ok, true, JSON.stringify(claim));
        ids.push(claim.node_id);
      }
      const insert = db.prepare('INSERT INTO edges (source,target,type,properties) VALUES (?,?,?,?)');
      for (const [from, to] of EDGES) insert.run(ids[from], ids[to], 'RELATES_TO', '{}');
    } finally { nav.closeRoomDbForCaller(db); }
    require('../lib/core/session-binding.cjs').writeSessionBinding(sessionId, { bound: [born.slug], primary: born.slug, sticky: true }, { home: isolated.roomsHome });
    process.env.HOME = isolated.home;
    process.env.USERPROFILE = isolated.home;
    process.env.MINDRIAN_ROOMS_HOME = isolated.roomsHome;
    delete process.env.CLAUDE_ACTIVE_ROOM;
    const dbPath = path.join(born.roomDir, '.mindrian', 'room.db');
    const hash = () => crypto.createHash('sha256').update(fs.readFileSync(dbPath)).digest('hex');
    const before = hash();

    const services = require('../lib/mcp/tools/eureka-graph-discovery-signals.cjs');
    const registered = new Map();
    services.register({ registerTool: (name, config, handler) => registered.set(name, { config, handler }) }, {});
    assert.equal(registered.size, 5);

    const uv = process.env.MINDRIAN_EUREKA_UV || 'uv';
    const snapshots = new Set();
    for (const spec of services.TOOLS) {
      // Call through the registered MCP handler so the wire envelope is exercised.
      // Seeded algorithms get a fixed seed so MCP and CLI runs are comparable.
      const options = 'seed' in spec.options.shape ? { seed: 7 } : {};
      const response = await registered.get(spec.tool).handler({ node_ids: ids, ...options }, { sessionId });
      const out = response.structuredContent;
      assert.notEqual(response.isError, true, `${spec.capability_id}: ${JSON.stringify(out)}`);
      assert.equal(out.ok, true, `${spec.capability_id}: ${JSON.stringify(out)}`);
      assert.equal(out.capability_id, spec.capability_id);
      assert.equal(out.scope_id, born.room_id);
      assert.equal(out.room_binding.source, 'session.primary');
      assert.equal(out.room_binding.registry_fallback, false);
      assert.match(out.snapshot_id, /^[a-f0-9]{64}$/);
      assert.equal(out.analysis.capability_id, spec.capability_id);
      assert.equal(out.analysis.scope_id, out.scope_id);
      assert.equal(out.analysis.snapshot_id, out.snapshot_id);
      assert.equal(out.analysis.status, 'completed_analysis');
      assert.equal(out.analysis.graph_access, 'read_only_snapshot');
      assert.equal(out.partial, false);
      assert.equal(out.projection_complete, true);
      assert.equal(out.review_required, true);
      assert.equal(out.persistence, 'none');
      snapshots.add(out.snapshot_id);

      // Installed CLI on the identical snapshot: same capability, lineage, and
      // analysis as the MCP route (one implementation, two routes). Both routes
      // receive the same projected object; the wire call above projected its own
      // snapshot, whose generated_at differs, so its fingerprint is not compared.
      const projected = require('../lib/mcp/tools/eureka-graph-projection.cjs').project({ node_ids: ids }, {}, { sessionId });
      assert.equal(projected.ok, true);
      assert.equal(projected.snapshot_id, out.snapshot_id, 'projection is stable across calls');
      const requestFile = path.join(scratch, `${spec.capability_id}.json`);
      fs.writeFileSync(requestFile, JSON.stringify({ snapshot: projected.snapshot, ...options }));
      const cli = spawnSync(uv, ['run', '--project', engineRoot, 'eureka-workflow', spec.capability_id, requestFile, '--output', '-'], {
        encoding: 'utf8', timeout: 120000, env: { ...process.env, UV_OFFLINE: '1', HF_HUB_OFFLINE: '1', TRANSFORMERS_OFFLINE: '1' },
      });
      assert.equal(cli.status, 0, `${spec.capability_id} CLI: ${cli.stderr}`);
      const cliResult = JSON.parse(cli.stdout.slice(cli.stdout.indexOf('{')));
      const cliAnalysis = cliResult.result || cliResult;
      assert.equal(cliAnalysis.capability_id, spec.capability_id);
      assert.equal(cliAnalysis.scope_id, out.scope_id);
      assert.equal(cliAnalysis.snapshot_id, out.snapshot_id);
      const direct = await require('../lib/mcp/tools/eureka-graph-analyze.cjs').callEurekaWorkflow(spec.capability_id, { snapshot: projected.snapshot, ...options });
      assert.equal(direct.ok, true, JSON.stringify(direct));
      // Compare the deterministic envelope and result shape. Randomized null-model
      // statistics (network holes, edge atypicality) differ between processes even
      // with a fixed seed in the engine under test, so those values are not compared.
      for (const key of ['schema_version', 'capability_id', 'status', 'graph_access', 'scope_id', 'snapshot_id', 'graph_summary', 'run_config', 'limitations']) {
        assert.deepEqual(cliAnalysis[key], direct.result[key], `${spec.capability_id} CLI and MCP agree on ${key}`);
      }
      assert.deepEqual(Object.keys(cliAnalysis).sort(), Object.keys(direct.result).sort(), `${spec.capability_id} CLI and MCP return the same result shape`);
    }
    assert.equal(snapshots.size, 1, 'all five services analyzed the same unchanged snapshot');

    // A missing ID is disclosed, not hidden, on the live path too.
    const partial = (await registered.get(services.TOOLS[0].tool).handler({ node_ids: [...ids, 'claim:absent'] }, { sessionId })).structuredContent;
    assert.equal(partial.ok, true, JSON.stringify(partial));
    assert.equal(partial.partial, true);
    assert.equal(partial.projection_omissions.missing_nodes, 1);

    // Unbound session: refused by the real resolver; no engine process is needed.
    const unbound = (await registered.get(services.TOOLS[0].tool).handler({ node_ids: ids }, { sessionId: 'eureka-373-live-unbound' })).structuredContent;
    assert.equal(unbound.ok, false);
    assert.equal(unbound.reason, 'no_bound_room');

    assert.equal(hash(), before, 'room.db is byte-identical after five live services, one partial call, and one refusal');
    console.log('eureka live graph algorithm services: PASS (5 services, real resolver, live stdio MCP, installed CLI parity, lineage, partial disclosure, refusal, no room writes)');
  } finally {
    for (const [key, value] of Object.entries(savedEnv)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
    isolated.cleanup();
    fs.rmSync(scratch, { recursive: true, force: true });
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
