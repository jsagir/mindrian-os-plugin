'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { run, register, CAPABILITY_ID } = require('../lib/mcp/tools/eureka-graph-opportunity-scout.cjs');

async function main() {
  let capturedRequest;
  const result = await run({
    node_ids: ['n1', 'n2'], objective: 'Find overlooked opportunities', top_k: 7,
  }, {}, {}, {
    prepare: async () => ({
      ok: true, scope_id: 'room:alpha', snapshot_id: 'sha256:snapshot',
      projection: { selected_node_count: 2 }, room_binding: { room_id: 'room:alpha' },
      bundle: { artifacts: [{ id: 'n1' }, { id: 'n2' }] },
    }),
    callEurekaOpportunityScout: async (request) => {
      capturedRequest = request;
      return {
        ok: true, job_id: 'job-1', result: {
          capability_id: CAPABILITY_ID, status: 'completed',
          scope: { scope_id: 'room:alpha', snapshot_id: 'sha256:snapshot' }, outputs: [],
        },
      };
    },
  });
  assert.equal(result.ok, true);
  assert.equal(result.review_required, true);
  assert.equal(result.acceptance_requires_review, true);
  assert.equal(result.persistence, 'none');
  assert.equal(result.accepted_knowledge_persistence, 'none');
  assert.equal(result.engine_state_persistence, 'durable_local_job_store');
  assert.equal(result.derived_cache_persistence, 'local_embedding_cache_may_be_written');
  assert.equal(Object.hasOwn(capturedRequest, 'mode'), false, 'the Eureka MCP adapter fixes the scout to local mode');
  assert.equal(capturedRequest.scope_id, 'room:alpha');
  assert.equal(capturedRequest.snapshot_id, 'sha256:snapshot');
  assert.deepEqual(capturedRequest.artifacts, [{ id: 'n1' }, { id: 'n2' }]);
  assert.equal(capturedRequest.top_k, 7);

  const mismatch = await run({ node_ids: ['n1', 'n2'], objective: 'x' }, {}, {}, {
    prepare: async () => ({
      ok: true, scope_id: 'room:alpha', snapshot_id: 'sha256:snapshot', bundle: { artifacts: [] },
    }),
    callEurekaOpportunityScout: async () => ({ ok: true, result: {
      capability_id: CAPABILITY_ID, status: 'completed',
      scope: { scope_id: 'room:other', snapshot_id: 'sha256:snapshot' },
    } }),
  });
  assert.equal(mismatch.ok, false);
  assert.equal(mismatch.reason, 'engine_lineage_mismatch');

  const partial = await run({ node_ids: ['n1', 'n2'], objective: 'x' }, {}, {}, {
    prepare: async () => ({ ok: true, scope_id: 'room:alpha', snapshot_id: 'sha256:snapshot',
      projection: { complete: false, omissions: { missing_nodes: 1 } }, bundle: { artifacts: [] } }),
    callEurekaOpportunityScout: async () => ({ ok: true, result: { capability_id: CAPABILITY_ID,
      status: 'completed', scope: { scope_id: 'room:alpha', snapshot_id: 'sha256:snapshot' } } }),
  });
  assert.equal(partial.ok, true);
  assert.equal(partial.partial, true);
  assert.deepEqual(partial.projection_omissions, { missing_nodes: 1 });

  let handler;
  let registeredTitle;
  let registeredConfig;
  register({ registerTool: (_name, config, callback) => { handler = callback; registeredConfig = config; registeredTitle = config.title; } }, {});
  assert.equal(typeof handler, 'function');
  assert.equal(registeredTitle, 'Screen Local Graph for Candidate Pair Leads');
  assert.equal(registeredConfig.annotations.readOnlyHint, false,
    'the local RS+HSI job has persistent engine-side state');

  const { callEurekaOpportunityScout } = require('../lib/mcp/tools/eureka-graph-analyze.cjs');
  const controller = new AbortController();
  const calls = [];
  let closed = false;
  const fakeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-eureka-cancel-'));
  fs.writeFileSync(path.join(fakeRoot, 'pyproject.toml'), '[project]\nname = "fake"\n');
  let transportOptions;
  class FakeTransport { constructor(options) { transportOptions = options; } }
  class FakeClient {
    constructor() {}
    async connect() {}
    async callTool(request) {
      calls.push(request.name);
      if (request.name === 'scout_start_opportunity_signal_scout') return { structuredContent: { job_id: 'job-cancel' } };
      if (request.name === 'scout_status') { controller.abort(); throw new Error('cancelled'); }
      if (request.name === 'scout_cancel') return { structuredContent: { cancelled: true } };
      throw new Error('unexpected tool ' + request.name);
    }
    async close() { closed = true; }
  }
  const cancelled = await callEurekaOpportunityScout({}, {
    MINDRIAN_EUREKA_ROOT: fakeRoot,
    MINDRIAN_EUREKA_RS_ENCODER: 'reference-bert',
    MINDRIAN_EUREKA_RS_MODEL_PATH: '/models/bert-local',
    HF_HOME: '/cache/huggingface',
    HF_TOKEN: 'must-not-leak',
  }, controller.signal, {
    Client: FakeClient, StdioClientTransport: FakeTransport,
  });
  assert.equal(cancelled.reason, 'cancelled');
  assert.deepEqual(calls, ['scout_start_opportunity_signal_scout', 'scout_status', 'scout_cancel']);
  assert.equal(closed, true, 'MCP process session closes after cancellation');
  assert.ok(transportOptions.args.includes('reference-encoder'));
  assert.equal(transportOptions.env.MINDRIAN_EUREKA_RS_ENCODER, 'reference-bert');
  assert.equal(transportOptions.env.MINDRIAN_EUREKA_RS_MODEL_PATH, '/models/bert-local');
  assert.equal(transportOptions.env.HF_HOME, '/cache/huggingface');
  assert.equal(transportOptions.env.HF_TOKEN, undefined);
  fs.rmSync(fakeRoot, { recursive: true, force: true });
  console.log('eureka opportunity scout host adapter: PASS');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
