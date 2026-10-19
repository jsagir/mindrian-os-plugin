'use strict';

// Keep Eureka's worker-owning MCP process alive across separate MindrianOS
// start/status/result/cancel calls. Eureka's job table persists, but its worker
// and cooperative cancel event are process-local.

const fs = require('node:fs');
const path = require('node:path');
const { z } = require('zod');
const { Client } = require('@modelcontextprotocol/client');
const { StdioClientTransport } = require('@modelcontextprotocol/client/stdio');
const { registerEurekaTool, response, signalFromExtra } = require('../eureka-tool-contract.cjs');
const { clientOptions, resolveCapability, decodeResponse, ALLOWED_MCP_ROUTES } = require('./eureka-capability-run.cjs');

const ASYNC_ROUTES = new Set(['scout_start', 'scout_start_opportunity_signal_scout']);
const TERMINAL = new Set(['completed', 'completed_empty', 'failed', 'blocked', 'cancelled', 'expired']);
const sessions = new Map();
const SESSION_TTL_MS = 30 * 60 * 1000;
const MAX_ACTIVE_SESSIONS = 8;
let activeStarts = 0;

function configuredRoot(env) {
  const value = env.MINDRIAN_EUREKA_ROOT;
  if (typeof value !== 'string' || !value.trim()) return { ok: false, reason: 'engine_not_configured', message: 'Set MINDRIAN_EUREKA_ROOT to the Mindrian Eureka checkout before calling this tool.' };
  const root = path.resolve(value);
  if (!fs.existsSync(path.join(root, 'pyproject.toml'))) return { ok: false, reason: 'engine_checkout_unavailable', message: 'The configured Mindrian Eureka checkout is unavailable.' };
  return { ok: true, root };
}

async function startCapability(args, extra, deps = {}) {
  const env = deps.env || process.env;
  if (!args || typeof args.capability_id !== 'string' || !args.request || typeof args.request !== 'object' || Array.isArray(args.request)) {
    return { ok: false, reason: 'invalid_request', message: 'capability_id and a JSON object request are required.' };
  }
  const rootResult = configuredRoot(env);
  if (!rootResult.ok) return rootResult;
  if (sessions.size + activeStarts >= MAX_ACTIVE_SESSIONS) {
    return { ok: false, reason: 'job_session_limit', active_jobs: sessions.size + activeStarts,
      message: 'The MindrianOS MCP process already owns the maximum number of active Eureka jobs. Retrieve or cancel an existing job before starting another.' };
  }
  const signal = signalFromExtra(extra);
  if (signal && signal.aborted) return { ok: false, reason: 'cancelled', message: 'Eureka job start was cancelled before launch.' };
  activeStarts += 1;
  const Transport = deps.StdioClientTransport || StdioClientTransport;
  const McpClient = deps.Client || Client;
  let client;
  let retained = false;
  try {
    const transport = new Transport(clientOptions(rootResult.root, env, args.capability_id));
    client = new McpClient({ name: 'mindrian-os-eureka-job-session', version: '1.0.0' }, { capabilities: {} });
    await client.connect(transport);
    const catalogResponse = decodeResponse(await client.callTool({ name: 'scout_capabilities', arguments: {} }, { signal }), 'Eureka could not load its capability catalog.');
    if (!catalogResponse.ok) return catalogResponse;
    const resolved = resolveCapability(catalogResponse.result, args.capability_id);
    if (!resolved.ok) return resolved;
    const capability = resolved.capability;
    const route = capability.routes.mcp.tool;
    if (!ALLOWED_MCP_ROUTES.has(route) || !ASYNC_ROUTES.has(route)) {
      return { ok: false, reason: 'capability_not_async', readiness: capability.status,
        message: 'This capability does not expose a supported asynchronous Eureka job route.' };
    }
    const contractResponse = decodeResponse(await client.callTool({
      name: 'scout_capability_contract', arguments: { capability_id: capability.id },
    }, { signal }), 'Eureka could not load the capability contract.');
    if (!contractResponse.ok) return contractResponse;
    const contract = contractResponse.result;
    if (!contract || !contract.capability || contract.capability.id !== capability.id || !contract.schemas?.input || !contract.schemas?.output) {
      return { ok: false, reason: 'capability_contract_unavailable', message: 'Eureka did not return the published input and output contracts.' };
    }
    const callArguments = route === 'scout_run_workflow'
      ? { capability_id: capability.id, request: args.request }
      : { request: args.request, ...(args.idempotency_key ? { idempotency_key: args.idempotency_key } : {}) };
    const startedResponse = decodeResponse(await client.callTool({ name: route, arguments: callArguments }, { signal }), 'Eureka rejected the capability request.');
    if (!startedResponse.ok) return startedResponse;
    const started = startedResponse.result;
    if (!started || typeof started.job_id !== 'string' || !started.job_id) {
      return { ok: false, reason: 'engine_invalid_response', message: 'Eureka accepted the start call without returning a job ID.' };
    }
    const session = {
      client, job_id: started.job_id, capability_id: capability.id, route,
      readiness: capability.status, contract: contract.schemas,
      scope_id: args.request.scope_id || null, snapshot_id: args.request.snapshot_id || null,
      expires_at: Date.now() + SESSION_TTL_MS, timer: null,
    };
    session.timer = setTimeout(() => { void expireSession(session.job_id); }, SESSION_TTL_MS);
    if (session.timer.unref) session.timer.unref();
    sessions.set(session.job_id, session);
    retained = true;
    return {
      ok: true, capability_id: session.capability_id, job_id: session.job_id,
      status: started.status || 'queued', readiness: session.readiness, route,
      scope_id: session.scope_id, snapshot_id: session.snapshot_id,
      expires_at: new Date(session.expires_at).toISOString(),
      persistence: 'eureka_job_store_only', review_required: true,
      note: 'This job exists only in the MindrianOS MCP process that started it and cannot resume after that process restarts. Poll status, retrieve the result, or request cancellation using the returned job_id. The retained session expires after 30 minutes.',
    };
  } catch (_error) {
    if (signal && signal.aborted) return { ok: false, reason: 'cancelled', message: 'Eureka job start was cancelled.' };
    return { ok: false, reason: 'engine_unavailable', message: 'Could not start an asynchronous job in the configured local Eureka MCP server.' };
  } finally {
    activeStarts -= 1;
    if (!retained) {
      try { if (client) await client.close(); } catch (_error) { /* best effort */ }
    }
  }
}

function getSession(jobId) {
  const session = sessions.get(jobId);
  if (!session) return { ok: false, reason: 'job_session_not_found', message: 'No active Eureka MCP session owns this job_id. Jobs cannot resume after the MindrianOS host process restarts; start a new job.' };
  if (session.expires_at <= Date.now()) return { ok: false, reason: 'job_session_expired', job_id: jobId, message: 'The retained Eureka MCP job session has expired.' };
  return { ok: true, session };
}

async function jobStatus(args, extra) {
  const found = getSession(args.job_id);
  if (!found.ok) return found;
  const { session } = found;
  let responseResult;
  try { responseResult = decodeResponse(await session.client.callTool({
    name: 'scout_status', arguments: { job_id: session.job_id },
  }, { signal: signalFromExtra(extra) }), 'Eureka could not read job status.'); }
  catch (_error) { return { ok: false, reason: 'engine_status_error', job_id: session.job_id, message: 'Eureka could not read job status.' }; }
  if (!responseResult.ok) return { ...responseResult, job_id: session.job_id };
  return { ok: true, capability_id: session.capability_id, job_id: session.job_id,
    status: responseResult.result.status, progress: responseResult.result.progress,
    scope_id: session.scope_id, snapshot_id: session.snapshot_id,
    events: responseResult.result.events, expires_at: new Date(session.expires_at).toISOString(),
    persistence: 'eureka_job_store_only', review_required: true };
}

async function jobResult(args, extra) {
  const found = getSession(args.job_id);
  if (!found.ok) return found;
  const { session } = found;
  let resultResponse;
  try { resultResponse = decodeResponse(await session.client.callTool({
    name: 'scout_result', arguments: { job_id: session.job_id },
  }, { signal: signalFromExtra(extra) }), 'Eureka could not retrieve the job result.'); }
  catch (_error) { return { ok: false, reason: 'engine_result_error', job_id: session.job_id, message: 'Eureka could not retrieve the job result.' }; }
  if (!resultResponse.ok) return { ...resultResponse, job_id: session.job_id };
  const result = resultResponse.result;
  const status = result && result.status;
  if (!TERMINAL.has(status)) {
    return { ok: false, reason: 'job_not_terminal', job_id: session.job_id, status,
      message: 'Eureka has not returned a terminal job state yet; poll status and retrieve the result again after completion.' };
  }
  // A failed, blocked, cancelled, or expired job has no analysis result to
  // lineage-check. Report only its state and explicitly disclose that no
  // lineage-verified findings are available.
  if (status !== 'completed' && status !== 'completed_empty') {
    await closeSession(session.job_id);
    return { ok: true, capability_id: session.capability_id, job_id: session.job_id,
      status, scope_id: session.scope_id, snapshot_id: session.snapshot_id,
      readiness: session.readiness, result_kind: 'job_state_only', lineage_verified: false,
      engine_state: { status, ...(result.progress ? { progress: result.progress } : {}),
        ...(result.failure_code ? { failure_code: result.failure_code } : {}) },
      message: 'Eureka returned a terminal job state without a lineage-bound analysis result; no findings are included.',
      persistence: 'none', review_required: true, acceptance_requires_review: true };
  }
  // Retire a terminal worker even when a purported analysis result fails
  // lineage checks, so an invalid response cannot leak a child process.
  await closeSession(session.job_id);
  if (!result || result.capability_id !== session.capability_id) {
    return { ok: false, reason: 'engine_lineage_mismatch', job_id: session.job_id,
      message: 'Eureka returned a job result with missing or mismatched capability lineage.' };
  }
  const scope = result && result.scope;
  if ((session.scope_id && scope?.scope_id !== session.scope_id) ||
      (session.snapshot_id && scope?.snapshot_id !== session.snapshot_id)) {
    return { ok: false, reason: 'engine_lineage_mismatch', job_id: session.job_id,
      message: 'Eureka returned a job result with missing or mismatched scope or snapshot lineage.' };
  }
  return { ok: true, capability_id: session.capability_id, job_id: session.job_id,
    status, scope_id: session.scope_id, snapshot_id: session.snapshot_id,
    readiness: session.readiness, contract: session.contract, engine_result: result,
    persistence: 'none', review_required: true, acceptance_requires_review: true };
}

async function cancelJob(args, extra) {
  const found = getSession(args.job_id);
  if (!found.ok) return found;
  const { session } = found;
  let cancelResponse;
  try { cancelResponse = decodeResponse(await session.client.callTool({
    name: 'scout_cancel', arguments: { job_id: session.job_id },
  }, { signal: signalFromExtra(extra) }), 'Eureka could not request job cancellation.'); }
  catch (_error) { return { ok: false, reason: 'engine_cancel_error', job_id: session.job_id, message: 'Eureka could not request job cancellation.' }; }
  if (!cancelResponse.ok) return { ...cancelResponse, job_id: session.job_id };
  return { ok: true, capability_id: session.capability_id, job_id: session.job_id,
    cancellation: cancelResponse.result, scope_id: session.scope_id, snapshot_id: session.snapshot_id,
    status: 'cancellation_requested', persistence: 'eureka_job_store_only', review_required: true,
    note: 'Cancellation is cooperative; poll status until Eureka reports a terminal state.' };
}

async function closeSession(jobId) {
  const session = sessions.get(jobId);
  if (!session) return false;
  sessions.delete(jobId);
  if (session.timer) clearTimeout(session.timer);
  try { await session.client.close(); } catch (_error) { /* best effort */ }
  return true;
}

async function expireSession(jobId) {
  const session = sessions.get(jobId);
  if (!session) return false;
  try { await session.client.callTool({ name: 'scout_cancel', arguments: { job_id: jobId } }); } catch (_error) { /* continue bounded cleanup */ }
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    try {
      const status = decodeResponse(await session.client.callTool({ name: 'scout_status', arguments: { job_id: jobId } }), 'status unavailable');
      if (status.ok && TERMINAL.has(status.result.status)) break;
    } catch (_error) { break; }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return closeSession(jobId);
}

const jobIdSchema = z.object({ job_id: z.string().min(1).max(200) }).strict();
function register(server) {
  registerEurekaTool(server, 'eureka_capability_start', {
    title: 'Start a Catalogued Eureka Job',
    description: 'Start a catalogued Eureka capability that exposes a supported asynchronous route. The MindrianOS MCP process retains the same Eureka worker session so separate status, result, and cancellation calls reach the live job. Jobs cannot resume after the MindrianOS MCP process restarts. Sessions expire after 30 minutes; at most eight can be active. Use only schema-shaped requests; this generic tool does not read the MindrianOS graph.',
    inputSchema: z.object({ capability_id: z.string().min(1).max(160).regex(/^[a-z][a-z0-9_.-]+$/), request: z.record(z.string(), z.unknown()), idempotency_key: z.string().min(1).max(128).optional() }).strict(),
  }, async (args, extra) => { const result = await startCapability(args, extra); return response(result, !result.ok); });
  registerEurekaTool(server, 'eureka_capability_job_status', {
    title: 'Check Eureka Job Status', description: 'Read progress for a job started in this MindrianOS MCP process. A job from a previous or restarted process is unknown and must be started again.',
    inputSchema: jobIdSchema,
  }, async (args, extra) => { const result = await jobStatus(args, extra); return response(result, !result.ok); });
  registerEurekaTool(server, 'eureka_capability_job_result', {
    title: 'Retrieve Eureka Job Result', description: 'Retrieve the result for a job started in this MindrianOS MCP process. Jobs cannot resume after a MindrianOS host restart. Terminal results close the retained Eureka session.',
    inputSchema: jobIdSchema,
  }, async (args, extra) => { const result = await jobResult(args, extra); return response(result, !result.ok); });
  registerEurekaTool(server, 'eureka_capability_job_cancel', {
    title: 'Cancel Eureka Job', description: 'Request cooperative cancellation for a job started in this MindrianOS MCP process. Jobs cannot resume after a MindrianOS host restart. Poll status to confirm the terminal state.',
    inputSchema: jobIdSchema,
  }, async (args, extra) => { const result = await cancelJob(args, extra); return response(result, !result.ok); });
}

const connectors = [
  ['eureka_capability_start', 'Starts a supported catalogued async method and retains its worker session.'],
  ['eureka_capability_job_status', 'Reads status for jobs owned by the current MindrianOS process.'],
  ['eureka_capability_job_result', 'Returns result for a completed catalogued Eureka job.'],
  ['eureka_capability_job_cancel', 'Requests cooperative cancellation for a retained Eureka job.'],
].map(([tool, hitl_why]) => ({ tool, surface: tool, connector: 'mcp-tool', hitl_shape: 'none', hitl_why,
  layer: 'harness', layer_why: 'Owns the Eureka MCP worker session and job lifecycle; persistence and review remain governed by MindrianOS.' }));

module.exports = { ASYNC_ROUTES, TERMINAL, sessions, SESSION_TTL_MS, MAX_ACTIVE_SESSIONS, startCapability, jobStatus, jobResult, cancelJob, closeSession, expireSession, register, connectors };
