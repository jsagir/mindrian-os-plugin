'use strict';

// Keep Eureka's worker-owning MCP process alive across separate MindrianOS
// start/status/result/cancel calls. Eureka's job table persists, but its worker
// and cooperative cancel event are process-local.

const crypto = require('node:crypto');
const { z } = require('zod');
const { Client } = require('@modelcontextprotocol/client');
const { StdioClientTransport } = require('@modelcontextprotocol/client/stdio');
const { registerEurekaTool, response, signalFromExtra, engineRootOrRefusal, captureStartLine, startFailureRefusal } = require('../eureka-tool-contract.cjs');
const { resolveEngine, describeEngineState } = require('../../core/eureka/eureka-engine-resolver.cjs');
const { clientOptions, resolveCapability, decodeResponse, ALLOWED_MCP_ROUTES, requestTooLarge, getCatalog, getContract } = require('./eureka-capability-run.cjs');
const { resolveEffectiveSessionId } = require('../../core/session-binding.cjs');
const { resolveMcpSessionRoom, describeRoomBinding } = require('../session-room.cjs');
const gateLedger = require('../gate-ledger.cjs');
const { mintApprovalGate } = require('../approval-gate.cjs');
const pairScreen = require('../eureka-pair-screen.cjs');

const ASYNC_ROUTES = new Set(['scout_start', 'scout_start_opportunity_signal_scout', 'scout_start_pair_screen']);
const TERMINAL = new Set(['completed', 'completed_empty', 'failed', 'blocked', 'cancelled', 'expired']);
const sessions = new Map();
const SESSION_TTL_MS = 30 * 60 * 1000;
const MAX_ACTIVE_SESSIONS = 8;
let activeStarts = 0;

// The one engine root rule lives in the tool contract (Plan 387-05); this keeps the old name and shape.
function configuredRoot(env) {
  return engineRootOrRefusal(env);
}

// Phase 374 plan 06 (E8): a retained job belongs to the MCP session and the room that started it. The record
// holds only the sha256 of the session key (never the raw session id) and the bound room id. The identity is
// built the way eureka-graph-projection builds its room binding. It never throws: an error gives null fields.
function callerIdentity(extra, ctx) {
  try {
    const sessionId = resolveEffectiveSessionId(undefined, extra);
    const sessionKeyHash = crypto.createHash('sha256').update(String(gateLedger.ledgerSessionKey(sessionId)), 'utf8').digest('hex');
    let roomId = null;
    try {
      const resolution = resolveMcpSessionRoom({ sessionId, ctx, noFloor: true });
      roomId = describeRoomBinding(resolution).room_id || null;
    } catch (_error) { roomId = null; }
    return { sessionKeyHash, roomId };
  } catch (_error) {
    return { sessionKeyHash: null, roomId: null };
  }
}

function identityOf(deps, extra) {
  const resolver = deps && typeof deps.callerIdentity === 'function' ? deps.callerIdentity : (x) => callerIdentity(x, deps && deps.ctx);
  const who = resolver(extra) || {};
  return {
    sessionKeyHash: typeof who.sessionKeyHash === 'string' ? who.sessionKeyHash : null,
    roomId: typeof who.roomId === 'string' && who.roomId ? who.roomId : null,
  };
}

const MAX_LINEAGE_ID_CHARS = 256;
function validLineageId(value) {
  return typeof value === 'string' && value.length > 0 && value.length <= MAX_LINEAGE_ID_CHARS;
}

async function startCapability(args, extra, deps = {}) {
  if (!args || typeof args.capability_id !== 'string' || !args.request || typeof args.request !== 'object' || Array.isArray(args.request)) {
    return { ok: false, reason: 'invalid_request', message: 'capability_id and a JSON object request are required.' };
  }
  // The pair screen has its own path (Phase 374 plan 08): plan, then an approval gate, then the start. Nothing else
  // calls the start route of this capability.
  if (args.capability_id === pairScreen.PAIR_SCREEN_CAPABILITY_ID) return startPairScreen(args, extra, deps);
  // Start guards (E4, E7): refused before the engine root, the session limit and any child process.
  const tooLarge = requestTooLarge(args.request);
  if (tooLarge) return tooLarge;
  if (!validLineageId(args.request.scope_id) || !validLineageId(args.request.snapshot_id)) {
    return { ok: false, reason: 'lineage_required',
      message: 'A catalogued job needs a scope_id and a snapshot_id in the request, so the result can be checked against them.' };
  }
  const owner = identityOf(deps, extra);
  return launchJob({ args, owner, signal: signalFromExtra(extra) }, deps);
}

// Connect one child, read the catalog and the contract, call the start route, keep the session. params is
// { args, owner, signal }. The guards (size, lineage ids) ran before this function.
async function launchJob(params, deps = {}) {
  const { args, owner, signal } = params;
  const env = deps.env || process.env;
  const rootResult = configuredRoot(env);
  if (!rootResult.ok) return rootResult;
  if (sessions.size + activeStarts >= MAX_ACTIVE_SESSIONS) {
    return { ok: false, reason: 'job_session_limit', active_jobs: sessions.size + activeStarts,
      message: 'The MindrianOS MCP process already owns the maximum number of active Eureka jobs. Retrieve or cancel an existing job before starting another.' };
  }
  if (signal && signal.aborted) return { ok: false, reason: 'cancelled', message: 'Eureka job start was cancelled before launch.' };
  activeStarts += 1;
  const Transport = deps.StdioClientTransport || StdioClientTransport;
  const McpClient = deps.Client || Client;
  let client;
  let retained = false;
  let capture = null;
  let connected = false;
  try {
    const transport = new Transport(clientOptions(rootResult.root, env, args.capability_id));
    client = new McpClient({ name: 'mindrian-os-eureka-job-session', version: '1.0.0' }, { capabilities: {} });
    capture = captureStartLine(transport);
    await client.connect(transport);
    connected = true;
    capture.stop();
    const catalogResponse = await getCatalog(client, rootResult.root, signal);
    if (!catalogResponse.ok) return catalogResponse;
    const resolved = resolveCapability(catalogResponse.result, args.capability_id);
    if (!resolved.ok) return resolved;
    const capability = resolved.capability;
    const route = capability.routes.mcp.tool;
    if (!ALLOWED_MCP_ROUTES.has(route) || !ASYNC_ROUTES.has(route)) {
      return { ok: false, reason: 'capability_not_async', readiness: capability.status,
        message: 'This capability does not expose a supported asynchronous Eureka job route.' };
    }
    // The pair-screen start route is reached only with the approval block that the gate adds (T-374-30): no other
    // capability id may point at it, and the pair screen itself may not start without the block.
    if (route === 'scout_start_pair_screen' &&
        (capability.id !== pairScreen.PAIR_SCREEN_CAPABILITY_ID || !args.request.approval)) {
      return { ok: false, reason: 'capability_requires_approval',
        message: 'This capability starts only after a person approves a plan card. Use eureka_capability_start.' };
    }
    const contractResponse = await getContract(client, rootResult.root, capability.id, signal);
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
    // The pair screen answers a refusal as a normal result (status refused). It shows the plugin's own sentence.
    if (capability.id === pairScreen.PAIR_SCREEN_CAPABILITY_ID && started && (started.status === 'refused' || started.status === 'blocked')) {
      return pairScreen.refusalFor(started.reason);
    }
    if (!started || typeof started.job_id !== 'string' || !started.job_id) {
      return { ok: false, reason: 'engine_invalid_response', message: 'Eureka accepted the start call without returning a job ID.' };
    }
    const session = {
      client, job_id: started.job_id, capability_id: capability.id, route,
      readiness: capability.status, contract: contract.schemas,
      scope_id: args.request.scope_id, snapshot_id: args.request.snapshot_id,
      session_key_hash: owner.sessionKeyHash, room_id: owner.roomId,
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
  } catch (error) {
    if (signal && signal.aborted) return { ok: false, reason: 'cancelled', message: 'Eureka job start was cancelled.' };
    // Typed refusal from fixed sentences: no raw spawn text, no path (Plans 387-05 and 387-11). The start line
    // is used only when the connect itself failed, before the engine received any request.
    if (capture) { capture.stop(); if (!connected) await capture.settle(); }
    return startFailureRefusal(error, connected || !capture ? '' : capture.line(), { root: rootResult.root, home: env.HOME || env.USERPROFILE });
  } finally {
    activeStarts -= 1;
    if (!retained) {
      try { if (client) await client.close(); } catch (_error) { /* best effort */ }
    }
  }
}

// The pair screen start (Phase 374 plan 08, D-04, D-08, D-10). Without an approval the call only plans: the bundle
// comes from prepare() over the room projection (the only reader of the room), the plan runs on one short-lived
// child, and one material_step gate shows the card. The start route is called only inside the resolve function
// of that gate, once, with the planned request plus the approval block.
async function startPairScreen(args, extra, deps) {
  const env = deps.env || process.env;
  const request = args.request;
  const tooLarge = requestTooLarge(request);
  if (tooLarge) return tooLarge;
  const bad = pairScreen.checkStartInput(request, env);
  if (bad) return bad;
  if (!deps.server) {
    return { ok: false, reason: 'approval_gate_unavailable', message: 'The approval card cannot be shown here, so the pair screen was not planned.' };
  }
  const rootResult = configuredRoot(env);
  if (!rootResult.ok) return rootResult;
  const signal = signalFromExtra(extra);
  if (signal && signal.aborted) return { ok: false, reason: 'cancelled', message: 'The pair screen was cancelled before it was planned.' };
  const owner = identityOf(deps, extra);

  const prepareFn = deps.prepare || require('./eureka-graph-prepare-artifacts.cjs').prepare;
  const prepared = await prepareFn({ node_ids: request.node_ids, objective: request.objective }, deps.ctx, extra, deps);
  if (!prepared || !prepared.ok) return prepared || { ok: false, reason: 'projection_failed', message: 'MindrianOS could not prepare this graph projection.' };
  const built = pairScreen.buildPairScreenRequest(request, prepared);
  if (!built.ok) return built;

  const planned = await pairScreen.planPairScreen({ request: built.request, root: rootResult.root, env, signal, deps });
  if (!planned.ok) return planned;
  const plan = planned.plan;
  const summary = pairScreen.planSummary(plan);
  const sessionId = resolveEffectiveSessionId(undefined, extra);

  const gate = await mintApprovalGate(deps.server, deps.ctx, sessionId, {
    card: { title: 'Review this plan before it runs.', question: pairScreen.cardBody(summary, pairScreen.DELETE_WORDING) },
    options: [
      { id: 'approve_run', label: 'Run the screen' },
      { id: 'stop', label: 'Stop without running' },
    ],
    approving: ['approve_run'],
    rejecting: ['stop'],
    refusedNote: 'Nothing was started.',
    resolve: async (_chosen, _answer, info) => {
      const approvalRef = info && info.gate_id;
      if (typeof approvalRef !== 'string' || !pairScreen.GATE_ID_RE.test(approvalRef)) {
        return { ok: false, executed: false, reason: 'approval_reference_missing', message: 'The approval has no usable reference, so nothing was started. Plan again.' };
      }
      const startRequest = { ...built.request, approval: { plan_digest: plan.plan_digest, approval_ref: approvalRef } };
      const idempotencyKey = crypto.createHash('sha256').update(plan.plan_digest + ':' + approvalRef, 'utf8').digest('hex');
      const launched = await launchJob({
        args: { capability_id: pairScreen.PAIR_SCREEN_CAPABILITY_ID, request: startRequest, idempotency_key: idempotencyKey },
        owner, signal: undefined,
      }, deps);
      return { ...launched, executed: launched.ok === true };
    },
  });

  return {
    ok: true, status: 'awaiting_approval', capability_id: pairScreen.PAIR_SCREEN_CAPABILITY_ID,
    gate_id: gate.gate_id, scope_id: built.request.scope_id, snapshot_id: built.request.snapshot_id,
    plan_summary: summary, plan_warnings: pairScreen.planWarnings(plan),
    persistence: 'none', review_required: true,
    note: 'Show the approval card to the person. Nothing has started. Only an approval starts the run. If the card is lost, for example after a restart, plan again with eureka_capability_start.',
    ...(gate.resumed ? { inline_result: gate.resumed } : {}),
  };
}

function getSession(jobId, caller) {
  const session = sessions.get(jobId);
  if (!session) {
    const base = { ok: false, reason: 'job_session_not_found', message: 'No active Eureka MCP session owns this job_id. Jobs cannot resume after the MindrianOS host process restarts; start a new job.' };
    // Plan 387-05: when the engine is not present, say so, because then no job can have started.
    const engine = resolveEngine(process.env);
    if (engine.state === 'present') return base;
    const d = describeEngineState({ state: engine.state, cause: engine.cause });
    const sentence = engine.state === 'absent' ? 'The Eureka engine is not set up, so no job can start.' : d.sentence;
    return { ...base, engine_state: engine.state, ...(d.cause ? { cause: d.cause } : {}), fix: d.fix, message: base.message + ' ' + sentence };
  }
  // The owner check comes before the expiry answer, so a wrong caller learns nothing about the job.
  const who = caller || { sessionKeyHash: null, roomId: null };
  if (session.session_key_hash !== who.sessionKeyHash || (session.room_id && session.room_id !== who.roomId)) {
    return { ok: false, reason: 'job_session_wrong_owner', message: 'This job belongs to another session or room.' };
  }
  if (session.expires_at <= Date.now()) return { ok: false, reason: 'job_session_expired', capability_id: session.capability_id,
    job_id: jobId, persistence: 'eureka_job_store_only', message: 'The retained Eureka MCP job session has expired.' };
  return { ok: true, session };
}

async function jobStatus(args, extra, deps = {}) {
  const found = getSession(args.job_id, identityOf(deps, extra));
  if (!found.ok) return found;
  const { session } = found;
  let responseResult;
  try { responseResult = decodeResponse(await session.client.callTool({
    name: 'scout_status', arguments: { job_id: session.job_id },
  }, { signal: signalFromExtra(extra) }), 'Eureka could not read job status.'); }
  catch (_error) { return { ok: false, reason: 'engine_status_error', capability_id: session.capability_id, job_id: session.job_id,
    persistence: 'eureka_job_store_only', message: 'Eureka could not read job status.' }; }
  if (!responseResult.ok) return { ...responseResult, capability_id: session.capability_id, job_id: session.job_id,
    persistence: 'eureka_job_store_only' };
  return { ok: true, capability_id: session.capability_id, job_id: session.job_id,
    status: responseResult.result.status, progress: responseResult.result.progress,
    scope_id: session.scope_id, snapshot_id: session.snapshot_id,
    events: responseResult.result.events, expires_at: new Date(session.expires_at).toISOString(),
    persistence: 'eureka_job_store_only', review_required: true };
}

async function jobResult(args, extra, deps = {}) {
  const found = getSession(args.job_id, identityOf(deps, extra));
  if (!found.ok) return found;
  const { session } = found;
  let resultResponse;
  try { resultResponse = decodeResponse(await session.client.callTool({
    name: 'scout_result', arguments: { job_id: session.job_id },
  }, { signal: signalFromExtra(extra) }), 'Eureka could not retrieve the job result.'); }
  catch (_error) { return { ok: false, reason: 'engine_result_error', capability_id: session.capability_id, job_id: session.job_id,
    persistence: 'eureka_job_store_only', message: 'Eureka could not retrieve the job result.' }; }
  if (!resultResponse.ok) return { ...resultResponse, capability_id: session.capability_id, job_id: session.job_id,
    persistence: 'eureka_job_store_only' };
  const result = resultResponse.result;
  const status = result && result.status;
  if (!TERMINAL.has(status)) {
    return { ok: false, reason: 'job_not_terminal', capability_id: session.capability_id, job_id: session.job_id,
      persistence: 'eureka_job_store_only', status,
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
    return { ok: false, reason: 'engine_lineage_mismatch', capability_id: session.capability_id,
      job_id: session.job_id, persistence: 'eureka_job_store_only',
      message: 'Eureka returned a job result with missing or mismatched capability lineage.' };
  }
  // Phase 374 plan 06 (E10): the scope check is unconditional. The start guard makes both ids strings.
  const scope = result && result.scope;
  if (!scope || typeof scope !== 'object' || typeof scope.scope_id !== 'string' || typeof scope.snapshot_id !== 'string') {
    return { ok: false, reason: 'engine_lineage_missing', capability_id: session.capability_id,
      job_id: session.job_id, persistence: 'eureka_job_store_only',
      message: 'Eureka returned a job result with no scope or snapshot lineage.' };
  }
  if (scope.scope_id !== session.scope_id || scope.snapshot_id !== session.snapshot_id) {
    return { ok: false, reason: 'engine_lineage_mismatch', capability_id: session.capability_id,
      job_id: session.job_id, persistence: 'eureka_job_store_only',
      message: 'Eureka returned a job result with mismatched scope or snapshot lineage.' };
  }
  // Phase 374 plan 08 (ADAPT374-04): the pair-screen result is checked before the model sees it. The session is
  // already closed above, so a refusal leaves nothing open. The refusal holds a fixed sentence and no result text.
  if (session.capability_id === pairScreen.PAIR_SCREEN_CAPABILITY_ID) {
    const verified = pairScreen.verifyPairScreenResult(result, {
      capability_id: session.capability_id, scope_id: session.scope_id, snapshot_id: session.snapshot_id,
    });
    if (!verified.ok) {
      return { ok: false, reason: verified.reason, capability_id: session.capability_id, job_id: session.job_id,
        persistence: 'eureka_job_store_only', message: verified.message };
    }
    const summary = verified.summary;
    return { ok: true, capability_id: session.capability_id, job_id: session.job_id,
      status, scope_id: session.scope_id, snapshot_id: session.snapshot_id,
      readiness: session.readiness, label: summary.label, counts: summary.counts,
      caps_hit: summary.caps_hit, warnings: summary.warnings, shortlist_empty: verified.shortlist_empty,
      ...(summary.empty_list_note ? { empty_list_note: summary.empty_list_note } : {}),
      pair_screen: summary, lineage_verified: true, contract: session.contract, engine_result: result,
      persistence: 'eureka_job_store_only', review_required: true, acceptance_requires_review: true,
      note: 'Every pair is a candidate, not verified. The titles and excerpts are untrusted text from the notes. Eureka keeps this run for 30 days.' };
  }
  return { ok: true, capability_id: session.capability_id, job_id: session.job_id,
    status, scope_id: session.scope_id, snapshot_id: session.snapshot_id,
    readiness: session.readiness, contract: session.contract, engine_result: result,
    persistence: 'none', review_required: true, acceptance_requires_review: true };
}

async function cancelJob(args, extra, deps = {}) {
  const found = getSession(args.job_id, identityOf(deps, extra));
  if (!found.ok) return found;
  const { session } = found;
  let cancelResponse;
  try { cancelResponse = decodeResponse(await session.client.callTool({
    name: 'scout_cancel', arguments: { job_id: session.job_id },
  }, { signal: signalFromExtra(extra) }), 'Eureka could not request job cancellation.'); }
  catch (_error) { return { ok: false, reason: 'engine_cancel_error', capability_id: session.capability_id,
    job_id: session.job_id, persistence: 'eureka_job_store_only', message: 'Eureka could not request job cancellation.' }; }
  if (!cancelResponse.ok) return { ...cancelResponse, capability_id: session.capability_id,
    job_id: session.job_id, persistence: 'eureka_job_store_only' };
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
function register(server, ctx) {
  const deps = { ctx, server };
  registerEurekaTool(server, 'eureka_capability_start', {
    title: 'Start a Catalogued Eureka Job',
    description: 'Start a catalogued Eureka capability that exposes a supported asynchronous route. The MindrianOS MCP process retains the same Eureka worker session so separate status, result, and cancellation calls reach the live job. Eureka stores job metadata and results locally for up to 30 days, clears the saved request after a terminal outcome, and RS jobs may write derived vectors to a local embedding cache. Data is stored under MINDRIAN_EUREKA_DATA_DIR or ~/.local/share/mindrian-eureka. Jobs cannot resume after the MindrianOS MCP process restarts. Host sessions expire after 30 minutes; at most eight can be active. Use only schema-shaped requests; this generic tool does not read the MindrianOS graph.',
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    inputSchema: z.object({ capability_id: z.string().min(1).max(160).regex(/^[a-z][a-z0-9_.-]+$/), request: z.record(z.string(), z.unknown()), idempotency_key: z.string().min(1).max(128).optional() }).strict(),
  }, async (args, extra) => { const result = await startCapability(args, extra, deps); return response(result, !result.ok); });
  registerEurekaTool(server, 'eureka_capability_job_status', {
    title: 'Check Eureka Job Status', description: 'Read progress for a job started in this MindrianOS MCP process. The Eureka job record is stored locally for up to 30 days. A job from a previous or restarted process is unknown to this host session and must be started again.',
    inputSchema: jobIdSchema,
  }, async (args, extra) => { const result = await jobStatus(args, extra, deps); return response(result, !result.ok); });
  registerEurekaTool(server, 'eureka_capability_job_result', {
    title: 'Retrieve Eureka Job Result', description: 'Retrieve the result for a job started in this MindrianOS MCP process. Eureka retains the result locally for up to 30 days; RS jobs may also write derived vectors to the local embedding cache. Jobs cannot resume after a MindrianOS host restart. Terminal results close the retained Eureka session.',
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    inputSchema: jobIdSchema,
  }, async (args, extra) => { const result = await jobResult(args, extra, deps); return response(result, !result.ok); });
  registerEurekaTool(server, 'eureka_capability_job_cancel', {
    title: 'Cancel Eureka Job', description: 'Request cooperative cancellation for a job started in this MindrianOS MCP process. Eureka retains job records locally for up to 30 days. Jobs cannot resume after a MindrianOS host restart. Poll status to confirm the terminal state.',
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    inputSchema: jobIdSchema,
  }, async (args, extra) => { const result = await cancelJob(args, extra, deps); return response(result, !result.ok); });
}

// Only the pair-screen capability raises a card (owner card OD-5A, answer F6); every other capability starts without one.
const connectors = [
  ['eureka_capability_start', 'F.6', 'Only the pair-screen capability raises a plan-review card, and only an approval on that card starts the run; every other capability starts without a card and retains its worker session.'],
  ['eureka_capability_job_status', 'none', 'Reads status for jobs owned by the current MindrianOS process.'],
  ['eureka_capability_job_result', 'none', 'Returns result for a completed catalogued Eureka job.'],
  ['eureka_capability_job_cancel', 'none', 'Requests cooperative cancellation for a retained Eureka job.'],
].map(([tool, hitl_shape, hitl_why]) => ({ tool, surface: tool, connector: 'mcp-tool', hitl_shape, hitl_why,
  layer: 'harness', layer_why: 'Owns the Eureka MCP worker session and job lifecycle; persistence and review remain governed by MindrianOS.' }));

module.exports = { ASYNC_ROUTES, TERMINAL, sessions, SESSION_TTL_MS, MAX_ACTIVE_SESSIONS, callerIdentity, startCapability, jobStatus, jobResult, cancelJob, closeSession, expireSession, register, connectors };
