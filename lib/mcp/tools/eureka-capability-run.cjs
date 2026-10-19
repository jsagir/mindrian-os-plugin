'use strict';

const { registerEurekaTool, response: eurekaResponse, signalFromExtra } = require('../eureka-tool-contract.cjs');

// Catalog-driven access to Eureka capabilities that do not need a dedicated
// MindrianOS graph adapter. The request is caller supplied; this tool does not
// read a room, persist accepted knowledge, or approve proposals. Async Eureka
// routes do persist their own local job and derived-cache state.

const fs = require('node:fs');
const path = require('node:path');
const { z } = require('zod');
const { Client } = require('@modelcontextprotocol/client');
const { StdioClientTransport } = require('@modelcontextprotocol/client/stdio');

const ALLOWED_MCP_ROUTES = new Set([
  'scout_run_workflow',
  'scout_start',
  'scout_sme_map',
  'decision_compare_sequence_patterns',
  'decision_fit_sequence_patterns',
  'scout_start_opportunity_signal_scout',
]);
const TERMINAL_JOB_STATES = new Set(['completed', 'completed_empty', 'failed', 'blocked', 'cancelled', 'expired']);
const MAX_REQUEST_BYTES = 20 * 1024 * 1024;
const EUREKA_CHILD_ENV_KEYS = Object.freeze([
  'HOME', 'USERPROFILE', 'PATH', 'SHELL', 'TERM', 'USER', 'LANG', 'LC_ALL', 'TMPDIR', 'TEMP', 'TMP',
  'MINDRIAN_EUREKA_LOG_LEVEL', 'MINDRIAN_EUREKA_RS_ENCODER', 'MINDRIAN_EUREKA_RS_MODEL_PATH',
  'MINDRIAN_EUREKA_RS_MODEL_REVISION', 'MINDRIAN_EUREKA_CACHE_DIR', 'MINDRIAN_EUREKA_DATA_DIR',
  'MINDRIAN_EUREKA_HSI_MODEL_PATH', 'MINDRIAN_EUREKA_JASON_MODEL_PATH', 'MINDRIAN_EUREKA_ANALOGY_MODEL_PATH',
  'HF_HOME', 'HF_HUB_CACHE', 'HUGGINGFACE_HUB_CACHE', 'TRANSFORMERS_CACHE',
  'SENTENCE_TRANSFORMERS_HOME', 'TORCH_HOME', 'HF_HUB_OFFLINE', 'TRANSFORMERS_OFFLINE',
  'TOKENIZERS_PARALLELISM',
]);

function decodeResponse(response, fallbackMessage) {
  if (response && response.isError) {
    const detail = (response.content || []).filter((item) => item.type === 'text').map((item) => item.text).join('\n');
    return { ok: false, reason: 'engine_rejected_request', message: detail || fallbackMessage };
  }
  if (response && response.structuredContent && typeof response.structuredContent === 'object') {
    return { ok: true, result: response.structuredContent };
  }
  const text = (response && response.content || []).find((item) => item.type === 'text');
  if (!text) return { ok: false, reason: 'engine_invalid_response', message: 'Eureka returned no structured result.' };
  try {
    return { ok: true, result: JSON.parse(text.text) };
  } catch (_error) {
    return { ok: false, reason: 'engine_invalid_response', message: 'Eureka returned non-JSON content.' };
  }
}

function clientOptions(root, env, capabilityId) {
  const args = ['run', '--project', root, '--extra', 'mcp-server'];
  if (capabilityId === 'decision.compare_sequence_patterns' || capabilityId === 'decision.fit_sequence_patterns') args.push('--extra', 'hmm');
  if (capabilityId === 'opportunity.find_cross_domain_pairs' || capabilityId === 'opportunity.synthesize_discovery_signals') {
    const encoderExtra = env.MINDRIAN_EUREKA_RS_ENCODER === 'reference-bert' ? 'reference-encoder' : 'modern-encoder';
    args.push('--extra', encoderExtra);
  }
  args.push('eureka-mcp');
  return { command: env.MINDRIAN_EUREKA_UV || 'uv', args, cwd: root, env: eurekaChildEnvironment(env) };
}

function eurekaChildEnvironment(env = process.env) {
  const childEnv = {};
  for (const key of EUREKA_CHILD_ENV_KEYS) {
    if (typeof env[key] === 'string') childEnv[key] = env[key];
  }
  return childEnv;
}

function resolveCapability(catalog, capabilityId) {
  const capability = catalog && Array.isArray(catalog.capabilities)
    ? catalog.capabilities.find((item) => item.id === capabilityId)
    : null;
  if (!capability) return { ok: false, reason: 'capability_not_found', message: 'The requested capability is not in the Eureka catalog.' };
  if (!['experimental', 'host_brokered'].includes(capability.status) || !capability.routes || !capability.routes.mcp) {
    return { ok: false, reason: 'capability_not_runnable', readiness: capability.status,
      message: 'This capability has no currently runnable MCP route; inspect its catalog readiness and prerequisites.' };
  }
  if (!ALLOWED_MCP_ROUTES.has(capability.routes.mcp.tool)) {
    return { ok: false, reason: 'unsupported_mcp_route', readiness: capability.status,
      message: 'The catalog MCP route is not supported by this host bridge.' };
  }
  return { ok: true, capability };
}

async function waitForJob(client, started, env, capabilityId, signal) {
  const jobId = started && started.job_id;
  if (typeof jobId !== 'string' || !jobId) {
    return { ok: false, reason: 'engine_invalid_response', message: 'Eureka started a job without returning a job ID.' };
  }
  const configuredTimeout = Number(env.MINDRIAN_EUREKA_WORKFLOW_TIMEOUT_MS || 900000);
  const timeoutMs = Number.isFinite(configuredTimeout) ? Math.min(Math.max(configuredTimeout, 1000), 1800000) : 900000;
  const deadline = Date.now() + timeoutMs;
  let terminalStatus;
  let failure;
  while (Date.now() < deadline) {
    if (signal && signal.aborted) { failure = 'cancelled'; break; }
    await new Promise((resolve) => {
      const timer = setTimeout(done, 250);
      function done() { clearTimeout(timer); if (signal) signal.removeEventListener('abort', done); resolve(); }
      if (signal) signal.addEventListener('abort', done, { once: true });
    });
    if (signal && signal.aborted) { failure = 'cancelled'; break; }
    let statusResponse;
    try {
      statusResponse = decodeResponse(await client.callTool({ name: 'scout_status', arguments: { job_id: jobId } }, { signal }), 'Eureka could not read job status.');
    } catch (_error) {
      failure = signal && signal.aborted ? 'cancelled' : 'status_error';
      break;
    }
    if (!statusResponse.ok) { failure = 'status_error'; break; }
    if (TERMINAL_JOB_STATES.has(statusResponse.result.status)) {
      terminalStatus = statusResponse.result;
      break;
    }
  }
  if (failure || !terminalStatus) {
    try { await client.callTool({ name: 'scout_cancel', arguments: { job_id: jobId } }); } catch (_error) { /* keep the timeout result */ }
    const storedJob = { capability_id: capabilityId, job_id: jobId, persistence: 'eureka_job_store_only' };
    if (failure === 'cancelled') return { ok: false, reason: 'cancelled', ...storedJob, message: 'Eureka job was cancelled; cancellation was requested.' };
    if (failure === 'status_error') return { ok: false, reason: 'engine_status_error', ...storedJob, message: 'Eureka job status failed; cancellation was requested.' };
    return { ok: false, reason: 'engine_timeout', ...storedJob, message: 'Eureka exceeded the configured runtime limit; cancellation was requested.' };
  }
  let resultResponse;
  try {
    resultResponse = decodeResponse(await client.callTool({ name: 'scout_result', arguments: { job_id: jobId } }, { signal }), 'Eureka could not retrieve the completed job result.');
  } catch (_error) {
    try { await client.callTool({ name: 'scout_cancel', arguments: { job_id: jobId } }); } catch (_cancelError) { /* preserve result failure */ }
    return { ok: false, reason: signal && signal.aborted ? 'cancelled' : 'engine_result_error', capability_id: capabilityId, job_id: jobId, persistence: 'eureka_job_store_only',
      message: 'Eureka result retrieval failed; cancellation was requested.' };
  }
  if (!resultResponse.ok) {
    try { await client.callTool({ name: 'scout_cancel', arguments: { job_id: jobId } }); } catch (_cancelError) { /* preserve result failure */ }
    return { ...resultResponse, capability_id: capabilityId, job_id: jobId, persistence: 'eureka_job_store_only', cancellation_requested: true };
  }
  if (!resultResponse.result || resultResponse.result.capability_id !== capabilityId) {
    try { await client.callTool({ name: 'scout_cancel', arguments: { job_id: jobId } }); } catch (_cancelError) { /* preserve lineage error */ }
    return { ok: false, reason: 'engine_lineage_mismatch', capability_id: capabilityId, job_id: jobId, persistence: 'eureka_job_store_only', message: 'Eureka returned a job result for a different capability.' };
  }
  return { ok: true, job_id: jobId, status: terminalStatus.status, result: resultResponse.result };
}

async function invokeCapabilityWithClient(client, capability, request, env, signal) {
  const route = capability.routes && capability.routes.mcp && capability.routes.mcp.tool;
  if (!ALLOWED_MCP_ROUTES.has(route)) {
    return { ok: false, reason: 'unsupported_mcp_route', message: 'The catalog MCP route is not supported by this host bridge.' };
  }
  const contractResponse = decodeResponse(await client.callTool({
    name: 'scout_capability_contract', arguments: { capability_id: capability.id },
  }, { signal }), 'Eureka could not load the capability contract.');
  if (!contractResponse.ok) return contractResponse;
  const contract = contractResponse.result;
  if (!contract || !contract.capability || contract.capability.id !== capability.id ||
      !contract.schemas || !contract.schemas.input || !contract.schemas.output) {
    return { ok: false, reason: 'capability_contract_unavailable', message: 'Eureka did not return the published input and output contracts.' };
  }
  const callArguments = route === 'scout_run_workflow'
    ? { capability_id: capability.id, request }
    : { request };
  const startedResponse = decodeResponse(await client.callTool({ name: route, arguments: callArguments }, { signal }), 'Eureka rejected the capability request.');
  if (!startedResponse.ok) return startedResponse;
  const started = startedResponse.result;
  if (route === 'scout_start' || route === 'scout_start_opportunity_signal_scout') {
    const finished = await waitForJob(client, started, env, capability.id, signal);
    if (!finished.ok) return finished;
    return { ...finished, route, readiness: capability.status, contract: contract.schemas, result: finished.result };
  }
  if (!started || started.capability_id !== capability.id) {
    return { ok: false, reason: 'engine_lineage_mismatch', message: 'Eureka returned a result for a different capability.' };
  }
  if (started.status === 'blocked_or_not_implemented') {
    return { ok: false, reason: 'catalog_route_mismatch', readiness: capability.status,
      message: 'The catalog advertises this route, but Eureka has no runnable handler for it.' };
  }
  return { ok: true, route, readiness: capability.status, contract: contract.schemas, result: started };
}

async function callEurekaCapability(capabilityId, request, env = process.env, signal) {
  if (signal && signal.aborted) return { ok: false, reason: 'cancelled', message: 'Eureka capability call was cancelled before launch.' };
  const configuredTimeout = Number(env.MINDRIAN_EUREKA_WORKFLOW_TIMEOUT_MS || 900000);
  const timeoutMs = Number.isFinite(configuredTimeout) ? Math.min(Math.max(configuredTimeout, 1000), 1800000) : 900000;
  const requestSignal = signal ? AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]) : AbortSignal.timeout(timeoutMs);
  const configuredRoot = env.MINDRIAN_EUREKA_ROOT;
  if (typeof configuredRoot !== 'string' || !configuredRoot.trim()) {
    return { ok: false, reason: 'engine_not_configured', message: 'Set MINDRIAN_EUREKA_ROOT to the Mindrian Eureka checkout before calling this tool.' };
  }
  const root = path.resolve(configuredRoot);
  if (!fs.existsSync(path.join(root, 'pyproject.toml'))) {
    return { ok: false, reason: 'engine_checkout_unavailable', message: 'The configured Mindrian Eureka checkout is unavailable.' };
  }
  if (!request || typeof request !== 'object' || Array.isArray(request)) {
    return { ok: false, reason: 'invalid_request', message: 'request must be a JSON object.' };
  }
  if (Buffer.byteLength(JSON.stringify(request), 'utf8') > MAX_REQUEST_BYTES) {
    return { ok: false, reason: 'request_too_large', message: 'request exceeds the 20 MiB host limit.' };
  }

  const transport = new StdioClientTransport(clientOptions(root, env, capabilityId));
  const client = new Client({ name: 'mindrian-os-eureka-capability-bridge', version: '1.0.0' }, { capabilities: {} });
  try {
    await client.connect(transport);
    const catalogResponse = decodeResponse(await client.callTool({ name: 'scout_capabilities', arguments: {} }, { signal: requestSignal }), 'Eureka could not load its capability catalog.');
    if (!catalogResponse.ok) return catalogResponse;
    const resolved = resolveCapability(catalogResponse.result, capabilityId);
    if (!resolved.ok) return resolved;
    return await invokeCapabilityWithClient(client, resolved.capability, request, env, requestSignal);
  } catch (error) {
    if (signal && signal.aborted) return { ok: false, reason: 'cancelled', message: 'Eureka capability call was cancelled.' };
    if (requestSignal.aborted) return { ok: false, reason: 'engine_timeout', message: 'Eureka capability exceeded its configured runtime limit.' };
    const detail = String(error && error.message || error || 'unknown MCP transport error')
      .replaceAll(root, '<MINDRIAN_EUREKA_ROOT>').slice(0, 500);
    return { ok: false, reason: 'engine_unavailable', message: 'Could not call the configured local Eureka MCP server: ' + detail };
  } finally {
    try { await client.close(); } catch (_error) { /* close is best-effort after one call */ }
  }
}

async function run(args, deps = {}, extra = {}) {
  if (!args || typeof args.capability_id !== 'string' || !args.capability_id.trim()) {
    return { ok: false, reason: 'invalid_capability_id', message: 'capability_id must be a non-empty stable Eureka capability ID.' };
  }
  const engine = await (deps.callEurekaCapability || callEurekaCapability)(args.capability_id, args.request, deps.env || process.env, signalFromExtra(extra));
  if (!engine.ok) return engine;
  return {
    ok: true,
    capability_id: args.capability_id,
    readiness: engine.readiness,
    route: engine.route,
    contract: engine.contract,
    job_id: engine.job_id,
    status: engine.status || (engine.result && engine.result.status),
    engine_result: engine.result,
    persistence: 'none',
    accepted_knowledge_persistence: 'none',
    engine_state_persistence: engine.job_id ? 'durable_local_job_store' : 'none',
    derived_cache_persistence: engine.job_id && ['opportunity.find_cross_domain_pairs', 'opportunity.synthesize_discovery_signals'].includes(args.capability_id)
      ? 'local_embedding_cache_may_be_written' : 'none',
    review_required: true,
    acceptance_requires_review: true,
    note: 'Eureka executed only the caller-supplied request. This bridge did not read or write the MindrianOS graph, retrieve external research, or accept proposed knowledge.',
  };
}

function textResponse(payload, isError) {
  return eurekaResponse(payload, isError);
}

function register(server) {
  registerEurekaTool(server, 'eureka_capability_run', {
    title: 'Run a Catalogued Eureka Capability',
    description: 'Inspect the Eureka catalog and contract, then run one capability currently marked experimental or host_brokered through its advertised local MCP route. Supply the exact contract-shaped request. This generic bridge does not read MindrianOS room data; use the dedicated graph projection and graph-scoped tools when the capability needs room content. Planned and blocked capabilities are refused. For asynchronous routes, prefer eureka_capability_start and the job status/result/cancel tools; this convenience call can block until completion. Async routes persist a local Eureka job record and result for up to 30 days, and RS routes may write derived vectors to the local embedding cache. The structured response distinguishes engine-side state from accepted MindrianOS knowledge; this tool never accepts proposed knowledge.',
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    inputSchema: z.object({
      capability_id: z.string().min(1).max(160).regex(/^[a-z][a-z0-9_.-]+$/),
      request: z.record(z.string(), z.unknown()),
    }).strict(),
  }, async (args, extra) => {
    const result = await run(args, {}, extra);
    return textResponse(result, !result.ok);
  });
}

const connectors = [{
  tool: 'eureka_capability_run',
  surface: 'eureka_capability_run',
  connector: 'mcp-tool',
  hitl_shape: 'none',
  hitl_why: 'Runs a bounded local capability on caller-supplied data; no accepted-knowledge write, external retrieval, or acceptance occurs. Async RS jobs may persist local operational state.',
  layer: 'harness',
  layer_why: 'Routes capability calls to the Eureka MCP server while exposing its readiness and schemas and leaving graph authorization and persistence in MindrianOS.',
}];

module.exports = { ALLOWED_MCP_ROUTES, EUREKA_CHILD_ENV_KEYS, decodeResponse, eurekaChildEnvironment, clientOptions, resolveCapability, waitForJob, invokeCapabilityWithClient, callEurekaCapability, run, register, connectors, textResponse };
