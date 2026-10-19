'use strict';

const assert = require('node:assert/strict');
const {
  invokeCapabilityWithClient,
  waitForJob,
  resolveCapability,
  clientOptions,
  eurekaChildEnvironment,
  run,
  register,
} = require('../lib/mcp/tools/eureka-capability-run.cjs');
const { registerCoreTools } = require('../lib/mcp/register-core-tools.cjs');
const { signalFromExtra } = require('../lib/mcp/eureka-tool-contract.cjs');
const capabilityJobs = require('../lib/mcp/tools/eureka-capability-jobs.cjs');

async function main() {
  const configuredChild = clientOptions('/opt/mindrian-eureka', {
    MINDRIAN_EUREKA_UV: '/opt/uv',
    MINDRIAN_EUREKA_RS_ENCODER: 'reference-bert',
    MINDRIAN_EUREKA_RS_MODEL_PATH: '/models/bert-local',
    HF_HOME: '/cache/huggingface',
    HF_HUB_OFFLINE: '1',
    HF_TOKEN: 'must-not-leak',
    PINECONE_API_KEY: 'must-not-leak',
  }, 'opportunity.find_cross_domain_pairs');
  assert.ok(configuredChild.args.includes('--extra') && configuredChild.args.includes('reference-encoder'));
  assert.equal(configuredChild.env.MINDRIAN_EUREKA_RS_ENCODER, 'reference-bert');
  assert.equal(configuredChild.env.MINDRIAN_EUREKA_RS_MODEL_PATH, '/models/bert-local');
  assert.equal(configuredChild.env.HF_HOME, '/cache/huggingface');
  assert.equal(configuredChild.env.HF_HUB_OFFLINE, '1');
  assert.equal(configuredChild.env.HF_TOKEN, undefined, 'model credentials are not forwarded to Eureka');
  assert.equal(configuredChild.env.PINECONE_API_KEY, undefined, 'unrelated provider credentials are not forwarded');
  const narrowedEnv = eurekaChildEnvironment({ MINDRIAN_EUREKA_ROOT: '/private/root', SECRET_KEY: 'hidden' });
  assert.equal(narrowedEnv.MINDRIAN_EUREKA_ROOT, undefined);
  assert.equal(narrowedEnv.SECRET_KEY, undefined);

  const hostSignal = new AbortController().signal;
  assert.equal(signalFromExtra({ mcpReq: { signal: hostSignal } }), hostSignal,
    'MCP v2 cancellation comes from extra.mcpReq.signal');
  const request = { scope_id: 'room:alpha', snapshot_id: 'snapshot-1', topic: 'care systems' };
  const calls = [];
  const client = { callTool: async (input) => {
    calls.push(input);
    if (input.name === 'scout_capability_contract') return { structuredContent: {
      capability: { id: 'research.analyze_rs_domain_projection' },
      schemas: { input: { type: 'object' }, output: { type: 'object' } },
    } };
    return { structuredContent: {
      capability_id: 'research.analyze_rs_domain_projection', status: 'completed',
      scope_id: 'room:alpha', snapshot_id: 'snapshot-1', outputs: [],
    } };
  } };
  const direct = await invokeCapabilityWithClient(client, {
    id: 'research.analyze_rs_domain_projection', status: 'experimental',
    routes: { mcp: { tool: 'scout_run_workflow' } },
  }, request, {});
  assert.equal(direct.ok, true);
  assert.equal(direct.route, 'scout_run_workflow');
  assert.equal(calls[1].arguments.capability_id, 'research.analyze_rs_domain_projection');
  assert.deepEqual(calls[1].arguments.request, request);
  assert.deepEqual(direct.contract, { input: { type: 'object' }, output: { type: 'object' } });

  const unsupported = await invokeCapabilityWithClient({ callTool: async () => {
    throw new Error('unsupported catalog route must be rejected before MCP invocation');
  } }, {
    id: 'research.analyze_rs_domain_projection', status: 'experimental',
    routes: { mcp: { tool: 'unexpected_tool' } },
  }, request, {});
  assert.equal(unsupported.ok, false);
  assert.equal(unsupported.reason, 'unsupported_mcp_route');

  assert.equal(resolveCapability({ capabilities: [{ id: 'claims.compare', status: 'planned' }] }, 'claims.compare').reason,
    'capability_not_runnable');
  assert.equal(resolveCapability({ capabilities: [{ id: 'research.x', status: 'experimental', routes: { mcp: { tool: 'unexpected_tool' } } }] }, 'research.x').reason,
    'unsupported_mcp_route');

  const jobCalls = [];
  const jobClient = { callTool: async (input) => {
    jobCalls.push(input);
    if (input.name === 'scout_capability_contract') return { structuredContent: {
      capability: { id: 'opportunity.find_cross_domain_pairs' },
      schemas: { input: { type: 'object' }, output: { type: 'object' } },
    } };
    if (input.name === 'scout_start') return { structuredContent: { job_id: 'job-123', status: 'queued' } };
    if (input.name === 'scout_status') return { structuredContent: { job_id: 'job-123', status: 'completed' } };
    if (input.name === 'scout_result') return { structuredContent: {
      capability_id: 'opportunity.find_cross_domain_pairs', status: 'completed', outputs: [],
    } };
    throw new Error('unexpected tool call ' + input.name);
  } };
  const job = await invokeCapabilityWithClient(jobClient, {
    id: 'opportunity.find_cross_domain_pairs', status: 'experimental',
    routes: { mcp: { tool: 'scout_start' } },
  }, { objective: 'test' }, {});
  assert.equal(job.ok, true);
  assert.equal(job.job_id, 'job-123');
  assert.equal(job.status, 'completed');
  assert.deepEqual(jobCalls.map((call) => call.name), [
    'scout_capability_contract', 'scout_start', 'scout_status', 'scout_result',
  ]);

  const wrapped = await run({ capability_id: 'research.analyze_rs_domain_projection', request }, {
    callEurekaCapability: async () => ({ ok: true, route: 'scout_run_workflow', readiness: 'experimental',
      contract: { input: {}, output: {} }, result: { capability_id: 'research.analyze_rs_domain_projection', status: 'completed' } }),
  });
  assert.equal(wrapped.review_required, true);
  assert.equal(wrapped.persistence, 'none');
  assert.equal(wrapped.accepted_knowledge_persistence, 'none');
  assert.equal(wrapped.engine_state_persistence, 'none');
  assert.equal(wrapped.engine_result.status, 'completed');
  const wrappedJob = await run({ capability_id: 'opportunity.synthesize_discovery_signals', request }, {
    callEurekaCapability: async () => ({ ok: true, route: 'scout_start_opportunity_signal_scout', readiness: 'experimental',
      contract: { input: {}, output: {} }, job_id: 'eureka-job-1',
      result: { capability_id: 'opportunity.synthesize_discovery_signals', status: 'completed' } }),
  });
  assert.equal(wrappedJob.persistence, 'none', 'legacy persistence field continues to represent accepted MindrianOS knowledge');
  assert.equal(wrappedJob.accepted_knowledge_persistence, 'none');
  assert.equal(wrappedJob.engine_state_persistence, 'durable_local_job_store');
  assert.equal(wrappedJob.derived_cache_persistence, 'local_embedding_cache_may_be_written');
  const alreadyAborted = new AbortController();
  alreadyAborted.abort();
  const abortCalls = [];
  const abortedJob = await waitForJob({ callTool: async (input) => {
    abortCalls.push(input.name);
    return { structuredContent: { status: 'cancellation_requested' } };
  } }, { job_id: 'job-aborted' }, {}, 'opportunity.synthesize_discovery_signals', alreadyAborted.signal);
  assert.equal(abortedJob.reason, 'cancelled');
  assert.equal(abortedJob.persistence, 'eureka_job_store_only');
  assert.deepEqual(abortCalls, ['scout_cancel']);

  let handler;
  register({ registerTool: (_name, config, callback) => { handler = { config, callback }; } });
  assert.equal(typeof handler.callback, 'function');
  assert.match(handler.config.description, /Planned and blocked capabilities are refused/);
  assert.deepEqual(handler.config.annotations, {
    readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false,
  });
  assert.equal(handler.config.outputSchema.safeParse({ ok: true, scope_id: 'room:alpha', snapshot_id: 'snapshot-1',
    partial: false, review_required: true, persistence: 'none', accepted_knowledge_persistence: 'none',
    engine_state_persistence: 'durable_local_job_store', derived_cache_persistence: 'local_embedding_cache_may_be_written', result: {} }).success, true);
  const structured = require('../lib/mcp/tools/eureka-capability-run.cjs').textResponse({
    ok: true, scope_id: 'room:alpha', snapshot_id: 'snapshot-1', partial: false, review_required: true,
  }, false);
  assert.equal(structured.structuredContent.scope_id, 'room:alpha');
  assert.equal(structured.structuredContent.accepted_knowledge_persistence, 'none');
  assert.equal(structured.structuredContent.engine_state_persistence, 'none');
  assert.equal(structured.structuredContent.derived_cache_persistence, 'none');
  const storedJobResponse = require('../lib/mcp/eureka-tool-contract.cjs').response({ ok: true,
    capability_id: 'opportunity.find_cross_domain_pairs', job_id: 'eureka-job-test',
    persistence: 'eureka_job_store_only' });
  assert.equal(storedJobResponse.structuredContent.accepted_knowledge_persistence, 'none');
  assert.equal(storedJobResponse.structuredContent.engine_state_persistence, 'durable_local_job_store');
  assert.equal(storedJobResponse.structuredContent.derived_cache_persistence, 'local_embedding_cache_may_be_written');
  assert.match(storedJobResponse.content[0].text, /derived_cache_persistence/);
  assert.ok(structured.content[0].text.length < 1000, 'text content summarizes rather than duplicates structured output');
  const large = require('../lib/mcp/eureka-tool-contract.cjs').response({ ok: true, result: { outputs: [{}, {}], body: 'x'.repeat(300_000) } });
  assert.equal(large.structuredContent.response_size_warning.includes('Large structured result'), true);
  assert.equal(large.structuredContent.review_required, true, 'review metadata is uniform even on tool results without a candidate');
  assert.match(large.content[0].text, /response_size_warning/);
  assert.match(large.content[0].text, /result\.outputs/);
  assert.ok(large.content[0].text.length < 1500, 'large payload text remains compact');

  // Async lifecycle calls must reuse the same Eureka client process across
  // separate host tools, then close it after terminal result retrieval.
  const fakeRoot = require('node:fs').mkdtempSync(require('node:path').join(require('node:os').tmpdir(), 'eureka-job-session-'));
  require('node:fs').writeFileSync(require('node:path').join(fakeRoot, 'pyproject.toml'), '[project]\nname = "fake"\n');
  const lifecycleCalls = [];
  let clientClosed = false;
  class FakeTransport { constructor() {} }
  class PersistentClient {
    constructor() {}
    async connect() {}
    async callTool(input) {
      lifecycleCalls.push(input.name);
      if (input.name === 'scout_capabilities') return { structuredContent: { capabilities: [{
        id: 'opportunity.find_cross_domain_pairs', status: 'experimental', routes: { mcp: { tool: 'scout_start' } },
      }] } };
      if (input.name === 'scout_capability_contract') return { structuredContent: {
        capability: { id: 'opportunity.find_cross_domain_pairs' }, schemas: { input: {}, output: {} },
      } };
      if (input.name === 'scout_start') return { structuredContent: { job_id: 'job-retained', status: 'queued' } };
      if (input.name === 'scout_status') return { structuredContent: { status: 'completed', progress: 'complete', events: [] } };
      if (input.name === 'scout_cancel') return { structuredContent: { status: 'cancellation_requested' } };
      if (input.name === 'scout_result') return { structuredContent: {
        capability_id: 'opportunity.find_cross_domain_pairs', status: 'completed',
        scope: { scope_id: 'room:async', snapshot_id: 'snapshot-async' }, outputs: [],
      } };
      throw new Error('unexpected call ' + input.name);
    }
    async close() { clientClosed = true; }
  }
  const startedJob = await capabilityJobs.startCapability({ capability_id: 'opportunity.find_cross_domain_pairs',
    request: { scope_id: 'room:async', snapshot_id: 'snapshot-async', artifacts: [] } }, {}, {
    env: { MINDRIAN_EUREKA_ROOT: fakeRoot }, Client: PersistentClient, StdioClientTransport: FakeTransport,
  });
  assert.equal(startedJob.ok, true);
  assert.equal(clientClosed, false, 'worker-owning client remains open after start returns');
  assert.equal((await capabilityJobs.jobStatus({ job_id: startedJob.job_id })).status, 'completed');
  const cancellation = await capabilityJobs.cancelJob({ job_id: startedJob.job_id });
  assert.equal(cancellation.status, 'cancellation_requested');
  assert.equal(clientClosed, false, 'cancellation request keeps the session available for status/result');
  const finalResult = await capabilityJobs.jobResult({ job_id: startedJob.job_id });
  assert.equal(finalResult.ok, true);
  assert.equal(finalResult.scope_id, 'room:async');
  assert.equal(clientClosed, true, 'terminal result closes the worker-owning client');
  assert.deepEqual(lifecycleCalls, ['scout_capabilities', 'scout_capability_contract', 'scout_start', 'scout_status', 'scout_cancel', 'scout_result']);
  for (const omitted of ['capability_id', 'scope', 'snapshot_id']) {
    const jobId = 'job-missing-' + omitted;
    const malformed = {
      capability_id: 'opportunity.find_cross_domain_pairs', status: 'completed',
      scope: { scope_id: 'room:async', snapshot_id: 'snapshot-async' }, outputs: [],
    };
    if (omitted === 'capability_id') delete malformed.capability_id;
    if (omitted === 'scope') delete malformed.scope;
    if (omitted === 'snapshot_id') delete malformed.scope.snapshot_id;
    capabilityJobs.sessions.set(jobId, {
      client: { callTool: async () => ({ structuredContent: malformed }), async close() {} },
      job_id: jobId, capability_id: 'opportunity.find_cross_domain_pairs',
      scope_id: 'room:async', snapshot_id: 'snapshot-async',
      expires_at: Date.now() + 60_000, timer: null,
    });
    const invalidLineage = await capabilityJobs.jobResult({ job_id: jobId });
    assert.equal(invalidLineage.ok, false, `${omitted} lineage omission is rejected`);
    assert.equal(invalidLineage.reason, 'engine_lineage_mismatch');
    await capabilityJobs.closeSession(jobId);
  }
  const unknownJob = await capabilityJobs.jobStatus({ job_id: 'job-from-prior-process' });
  assert.equal(unknownJob.reason, 'job_session_not_found');
  assert.match(unknownJob.message, /start a new job/i);
  const unknownJobResponse = require('../lib/mcp/eureka-tool-contract.cjs').response(unknownJob);
  assert.equal(unknownJobResponse.structuredContent.engine_state_persistence, 'unknown');
  assert.equal(unknownJobResponse.structuredContent.derived_cache_persistence, 'unknown');
  assert.equal(capabilityJobs.MAX_ACTIVE_SESSIONS, 8);
  assert.equal(capabilityJobs.SESSION_TTL_MS, 30 * 60 * 1000);
  for (let index = 0; index < capabilityJobs.MAX_ACTIVE_SESSIONS; index += 1) {
    capabilityJobs.sessions.set('test-cap-' + index, {});
  }
  const limitResult = await capabilityJobs.startCapability({ capability_id: 'opportunity.find_cross_domain_pairs', request: {} }, {}, {
    env: { MINDRIAN_EUREKA_ROOT: fakeRoot }, Client: PersistentClient, StdioClientTransport: FakeTransport,
  });
  assert.equal(limitResult.reason, 'job_session_limit', 'active job count is capped before spawning another worker');
  capabilityJobs.sessions.clear();
  require('node:fs').rmSync(fakeRoot, { recursive: true, force: true });
  const lifecycleTools = new Map();
  capabilityJobs.register({ registerTool(name, config, callback) { lifecycleTools.set(name, { config, callback }); } });
  for (const name of ['eureka_capability_start', 'eureka_capability_job_status', 'eureka_capability_job_result', 'eureka_capability_job_cancel']) {
    assert.ok(lifecycleTools.has(name), `${name} is registered`);
    assert.ok(lifecycleTools.get(name).config.outputSchema, `${name} publishes an output schema`);
  }
  assert.equal(lifecycleTools.get('eureka_capability_start').config.annotations.readOnlyHint, false,
    'starting a job changes ephemeral engine state');
  assert.equal(lifecycleTools.get('eureka_capability_job_status').config.annotations.readOnlyHint, true,
    'status only reads job state');
  assert.equal(lifecycleTools.get('eureka_capability_job_result').config.annotations.readOnlyHint, false,
    'terminal result retrieval closes the retained session');
  assert.equal(lifecycleTools.get('eureka_capability_job_cancel').config.annotations.readOnlyHint, false,
    'cancellation changes ephemeral engine state');
  const registered = [];
  const report = registerCoreTools({
    tool: (name) => { registered.push(name); },
    registerTool: (name) => { registered.push(name); },
  }, {});
  assert.ok(report.registered.includes('eureka-capability-run.cjs'));
  assert.ok(registered.includes('eureka_capability_run'));
  console.log('eureka generic capability bridge: PASS (catalog route, contract, no-write envelope)');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
