'use strict';

const { registerEurekaTool, response: eurekaResponse, signalFromExtra } = require('../eureka-tool-contract.cjs');

// End-to-end local handoff: authorized MindrianOS graph projection -> Eureka's
// own stdio MCP engine -> proposals returned to MindrianOS. The engine never
// receives a room path or a graph handle and cannot write host state.

const fs = require('node:fs');
const path = require('node:path');
const { z } = require('zod');
const { Client } = require('@modelcontextprotocol/client');
const { StdioClientTransport } = require('@modelcontextprotocol/client/stdio');
const { eurekaChildEnvironment } = require('./eureka-capability-run.cjs');
const { project } = require('./eureka-graph-projection.cjs');

const CAPABILITY_ID = 'graph.explore_local_relationships';

async function callEurekaWorkflow(capabilityId, request, env = process.env, signal, deps = {}) {
  if (signal && signal.aborted) return { ok: false, reason: 'cancelled', message: 'Eureka workflow was cancelled before launch.' };
  const configuredTimeout = Number(env.MINDRIAN_EUREKA_WORKFLOW_TIMEOUT_MS || 120000);
  const timeoutMs = Number.isFinite(configuredTimeout) ? Math.min(Math.max(configuredTimeout, 1000), 1800000) : 120000;
  const requestSignal = signal ? AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]) : AbortSignal.timeout(timeoutMs);
  const configuredRoot = env.MINDRIAN_EUREKA_ROOT;
  if (typeof configuredRoot !== 'string' || !configuredRoot.trim()) {
    return { ok: false, reason: 'engine_not_configured', message: 'Set MINDRIAN_EUREKA_ROOT to the Mindrian Eureka checkout before calling this tool.' };
  }
  const root = path.resolve(configuredRoot);
  if (!fs.existsSync(path.join(root, 'pyproject.toml'))) {
    return { ok: false, reason: 'engine_checkout_unavailable', message: 'The configured Mindrian Eureka checkout is unavailable.' };
  }

  // Graph workflows need no model download or package fetch: run them offline.
  const Transport = deps.StdioClientTransport || StdioClientTransport;
  const transport = new Transport({
    command: env.MINDRIAN_EUREKA_UV || 'uv',
    args: ['run', '--project', root, '--extra', 'mcp-server', 'eureka-mcp'],
    cwd: root,
    env: eurekaChildEnvironment(env, { forceOffline: true }),
  });
  const McpClient = deps.Client || Client;
  const client = new McpClient({ name: 'mindrian-os-eureka-bridge', version: '1.0.0' }, { capabilities: {} });
  try {
    await client.connect(transport);
    const response = await client.callTool({
      name: 'scout_run_workflow',
      arguments: {
        capability_id: capabilityId,
        request,
      },
    }, { signal: requestSignal });
    return decodeEurekaResponse(response, 'Eureka MCP rejected the graph analysis request.');
  } catch (_error) {
    if (signal && signal.aborted) return { ok: false, reason: 'cancelled', message: 'Eureka workflow was cancelled.' };
    if (requestSignal.aborted) return { ok: false, reason: 'engine_timeout', message: 'Eureka workflow exceeded its configured runtime limit.' };
    return { ok: false, reason: 'engine_unavailable', message: 'Could not start or call the configured local Eureka MCP server.' };
  } finally {
    try { await client.close(); } catch (_error) { /* close is best-effort after the single call */ }
  }
}

function decodeEurekaResponse(response, fallbackMessage) {
  if (response && response.isError) {
    const detail = (response.content || []).filter((item) => item.type === 'text').map((item) => item.text).join('\n');
    return { ok: false, reason: 'engine_rejected_request', message: detail || fallbackMessage };
  }
  if (response && response.structuredContent && typeof response.structuredContent === 'object') {
    return { ok: true, result: response.structuredContent };
  }
  const text = (response && response.content || []).find((item) => item.type === 'text');
  if (!text) return { ok: false, reason: 'engine_invalid_response', message: 'Eureka MCP returned no structured result.' };
  try {
    return { ok: true, result: JSON.parse(text.text) };
  } catch (_error) {
    return { ok: false, reason: 'engine_invalid_response', message: 'Eureka MCP returned non-JSON content.' };
  }
}

function projectionDisclosure(meta) {
  return {
    partial: !meta.complete,
    projection_complete: meta.complete,
    projection_omissions: meta.omissions,
    partial_policy: 'warn_and_continue',
  };
}

function waitForPoll(signal, delayMs) {
  return new Promise((resolve) => {
    const timer = setTimeout(done, delayMs);
    function done() {
      clearTimeout(timer);
      if (signal) signal.removeEventListener('abort', done);
      resolve();
    }
    if (signal) signal.addEventListener('abort', done, { once: true });
  });
}

// Keep one Eureka process and MCP session alive for the asynchronous local
// RS+HSI job. Starting and polling in separate processes would lose the
// in-memory worker while it is running.
async function callEurekaOpportunityScout(request, env = process.env, signal, deps = {}) {
  if (signal && signal.aborted) return { ok: false, reason: 'cancelled', message: 'Eureka opportunity scout was cancelled before launch.' };
  const configuredRoot = env.MINDRIAN_EUREKA_ROOT;
  if (typeof configuredRoot !== 'string' || !configuredRoot.trim()) {
    return { ok: false, reason: 'engine_not_configured', message: 'Set MINDRIAN_EUREKA_ROOT to the Mindrian Eureka checkout before calling this tool.' };
  }
  const root = path.resolve(configuredRoot);
  if (!fs.existsSync(path.join(root, 'pyproject.toml'))) {
    return { ok: false, reason: 'engine_checkout_unavailable', message: 'The configured Mindrian Eureka checkout is unavailable.' };
  }
  const encoderExtra = env.MINDRIAN_EUREKA_RS_ENCODER === 'reference-bert' ? 'reference-encoder' : 'modern-encoder';
  const Transport = deps.StdioClientTransport || StdioClientTransport;
  const transport = new Transport({
    command: env.MINDRIAN_EUREKA_UV || 'uv',
    args: ['run', '--project', root, '--extra', 'mcp-server', '--extra', encoderExtra, 'eureka-mcp'],
    cwd: root,
    env: eurekaChildEnvironment(env),
  });
  const McpClient = deps.Client || Client;
  const client = new McpClient({ name: 'mindrian-os-eureka-bridge', version: '1.0.0' }, { capabilities: {} });
  let jobId;
  try {
    await client.connect(transport);
    const started = decodeEurekaResponse(await client.callTool({
      name: 'scout_start_opportunity_signal_scout',
      arguments: { request },
    }, { signal }), 'Eureka could not start the local RS+HSI opportunity scout.');
    if (!started.ok) return started;
    jobId = started.result && started.result.job_id;
    if (typeof jobId !== 'string' || !jobId) {
      return { ok: false, reason: 'engine_invalid_response', message: 'Eureka started the opportunity scout without returning a job ID.' };
    }
    const configuredTimeout = Number(env.MINDRIAN_EUREKA_SCOUT_TIMEOUT_MS || 900000);
    const timeoutMs = Number.isFinite(configuredTimeout) ? Math.min(Math.max(configuredTimeout, 1000), 1800000) : 900000;
    const deadline = Date.now() + timeoutMs;
    const terminal = new Set(['completed', 'completed_empty', 'failed', 'blocked', 'cancelled', 'expired']);
    let state = 'queued';
    let terminalStatus = null;
    let cancelReason = null;
    while (Date.now() < deadline) {
      if (signal && signal.aborted) { cancelReason = 'cancelled'; break; }
      await waitForPoll(signal, 250);
      if (signal && signal.aborted) { cancelReason = 'cancelled'; break; }
      let status;
      try {
        status = decodeEurekaResponse(await client.callTool({ name: 'scout_status', arguments: { job_id: jobId } }, { signal }), 'Eureka could not read opportunity scout status.');
      } catch (_statusError) {
        cancelReason = signal && signal.aborted ? 'cancelled' : 'status_error';
        break;
      }
      if (!status.ok) { cancelReason = 'status_error'; break; }
      state = status.result.status;
      if (terminal.has(state)) { terminalStatus = status.result; break; }
    }
    if (cancelReason || !terminal.has(state)) {
      try { await client.callTool({ name: 'scout_cancel', arguments: { job_id: jobId } }); } catch (_error) { /* preserve the timeout result */ }
      if (cancelReason === 'cancelled') return { ok: false, reason: 'cancelled', job_id: jobId, message: 'Eureka opportunity scout was cancelled; cancellation was requested.' };
      if (cancelReason === 'status_error') return { ok: false, reason: 'engine_status_error', job_id: jobId, message: 'Eureka opportunity scout status failed; cancellation was requested.' };
      return { ok: false, reason: 'engine_timeout', job_id: jobId, message: 'Eureka opportunity scout exceeded its configured runtime limit; cancellation was requested.' };
    }
    let finished;
    try {
      finished = decodeEurekaResponse(await client.callTool({ name: 'scout_result', arguments: { job_id: jobId } }), 'Eureka could not retrieve the opportunity scout result.');
    } catch (_resultError) {
      try { await client.callTool({ name: 'scout_cancel', arguments: { job_id: jobId } }); } catch (_cancelError) { /* preserve the result error */ }
      return { ok: false, reason: signal && signal.aborted ? 'cancelled' : 'engine_result_error', job_id: jobId,
        cancellation_requested: true, message: 'Eureka result retrieval failed; cancellation was requested.' };
    }
    if (!finished.ok) {
      try { await client.callTool({ name: 'scout_cancel', arguments: { job_id: jobId } }); } catch (_cancelError) { /* preserve the result error */ }
      return { ...finished, job_id: jobId, cancellation_requested: true };
    }
    if (!finished.result || finished.result.capability_id !== 'opportunity.synthesize_discovery_signals') {
      try { await client.callTool({ name: 'scout_cancel', arguments: { job_id: jobId } }); } catch (_cancelError) { /* preserve the invalid result */ }
      return { ok: false, reason: 'engine_job_failed', job_id: jobId, status: finished.result && finished.result.status || state,
        failure_code: (terminalStatus && terminalStatus.failure_code) || null,
        message: (terminalStatus && terminalStatus.failure_code === 'model_unavailable')
          ? 'Eureka opportunity scout could not load its configured local encoder. Install the selected optional encoder extra and ensure its model is available locally.'
          : 'Eureka opportunity scout ended without a contract-valid result.' };
    }
    return { ok: true, job_id: jobId, result: finished.result };
  } catch (error) {
    if (signal && signal.aborted) {
      if (typeof jobId === 'string' && jobId) {
        try { await client.callTool({ name: 'scout_cancel', arguments: { job_id: jobId } }); } catch (_cancelError) { /* best effort after host cancellation */ }
      }
      return { ok: false, reason: 'cancelled', job_id: jobId || null, message: 'Eureka opportunity scout was cancelled; cancellation was requested when a job had started.' };
    }
    const detail = String(error && error.message || error || 'unknown MCP transport error')
      .replaceAll(root, '<MINDRIAN_EUREKA_ROOT>').slice(0, 500);
    return { ok: false, reason: 'engine_unavailable', message: 'Could not complete the local Eureka opportunity scout MCP session: ' + detail };
  } finally {
    try { await client.close(); } catch (_error) { /* close is best-effort after the single job */ }
  }
}

async function callEureka(snapshot, options, env = process.env, capabilityId = CAPABILITY_ID, signal) {
  return callEurekaWorkflow(capabilityId, { snapshot, ...options }, env, signal);
}

async function analyze(args, ctx, extra, deps = {}) {
  const capabilityId = deps.capabilityId || CAPABILITY_ID;
  const hostProjection = (deps.project || project)(args, ctx, extra);
  if (!hostProjection.ok) return hostProjection;
  const engineCall = deps.callEureka || ((snapshot, options) => callEureka(snapshot, options, process.env, capabilityId, signalFromExtra(extra)));
  const options = {};
  for (const key of ['top', 'seed', 'attr', 'text_label', 'null_rounds', 'focus_node_id', 'focus_hops']) {
    if (args[key] !== undefined) options[key] = args[key];
  }
  const engine = await engineCall(hostProjection.snapshot, options);
  if (!engine.ok) return engine;
  const result = engine.result;
  if (!result || result.capability_id !== capabilityId || result.scope_id !== hostProjection.scope_id ||
      result.snapshot_id !== hostProjection.snapshot_id) {
    return { ok: false, reason: 'engine_lineage_mismatch', message: 'Eureka returned a result with mismatched capability, room scope, or graph snapshot identity.' };
  }
  return {
    ok: true,
    capability_id: capabilityId,
    scope_id: hostProjection.scope_id,
    snapshot_id: hostProjection.snapshot_id,
    projection: hostProjection.snapshot.meta,
    ...projectionDisclosure(hostProjection.snapshot.meta),
    room_binding: hostProjection.room_binding,
    analysis: result,
    persistence: 'none',
    review_required: true,
    acceptance_requires_review: true,
  };
}

function textResponse(payload, isError) {
  return eurekaResponse(payload, isError);
}

function registerForCapability(server, ctx, options = {}) {
  const toolName = options.toolName || 'eureka_graph_analyze';
  const capabilityId = options.capabilityId || CAPABILITY_ID;
  registerEurekaTool(server, toolName, {
    title: options.title || 'Analyze MindrianOS Graph with Eureka',
    description: options.description || 'Project explicit node IDs from the bound MindrianOS room through its read-only navigation boundary, call the configured local Eureka MCP graph engine, and return snapshot-bound unverified proposals. Requires MINDRIAN_EUREKA_ROOT and uv. Does not accept paths, expand graph scope, fetch remote sources, or write graph state.',
    inputSchema: z.object({
      node_ids: z.array(z.string().min(1).max(200).regex(/^[A-Za-z0-9][A-Za-z0-9_.:/-]*$/)).min(1).max(2500),
      top: z.number().int().min(1).max(1000).optional(),
      seed: z.number().int().optional(),
      attr: z.string().max(200).optional(),
      text_label: z.string().max(200).nullable().optional(),
      null_rounds: z.number().int().min(1).max(20).optional(),
      focus_node_id: z.string().max(200).nullable().optional(),
      focus_hops: z.number().int().min(0).max(5).optional(),
    }).strict(),
  }, async (args, extra) => {
    const result = await analyze(args, ctx, extra, { capabilityId });
    return textResponse(result, !result.ok);
  });
}

function register(server, ctx) {
  return registerForCapability(server, ctx);
}

const connectors = [{
  tool: 'eureka_graph_analyze',
  surface: 'eureka_graph_analyze',
  connector: 'mcp-tool',
  hitl_shape: 'none',
  hitl_why: 'Read-only graph projection and local analysis; results remain proposed, unevidenced, and unfiled.',
  layer: 'harness',
  layer_why: 'Composes MindrianOS graph authorization with a separate local analysis process while leaving persistence and review in MindrianOS.',
}];

module.exports = { CAPABILITY_ID, callEurekaWorkflow, callEurekaOpportunityScout, callEureka, analyze, register, registerForCapability, connectors, textResponse, projectionDisclosure };
