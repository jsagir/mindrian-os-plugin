'use strict';

// Keep Eureka's worker-owning MCP process alive across separate MindrianOS
// start/status/result/cancel calls. Eureka's job table persists, but its worker
// and cooperative cancel event are process-local.

const crypto = require('node:crypto');
const { z } = require('zod');
const { Client } = require('@modelcontextprotocol/client');
const { StdioClientTransport } = require('@modelcontextprotocol/client/stdio');
const { registerEurekaTool, response, signalFromExtra, engineRootOrRefusal, engineRefusal, captureStartLine, startFailureRefusal, engineBusyRefusal, setBusyProbe, TEXT_WARNING_BYTES,
  callOptions, isRequestTimeout, remainingMs, configuredDeadlineMs, engineTimeoutRefusal, CANCEL_DEADLINE_MS } = require('../eureka-tool-contract.cjs');
const { resolveEngine, describeEngineState } = require('../../core/eureka/eureka-engine-resolver.cjs');
const { clientOptions, resolveCapability, decodeResponse, ALLOWED_MCP_ROUTES, requestTooLarge, getCatalog, getContract } = require('./eureka-capability-run.cjs');
const { resolveEffectiveSessionId } = require('../../core/session-binding.cjs');
const { resolveMcpSessionRoom, describeRoomBinding } = require('../session-room.cjs');
const gateLedger = require('../gate-ledger.cjs');
const { mintApprovalGate } = require('../approval-gate.cjs');
const pairScreen = require('../eureka-pair-screen.cjs');
const jobRecord = require('../eureka-job-record.cjs');

const ASYNC_ROUTES = new Set(['scout_start', 'scout_start_opportunity_signal_scout', 'scout_start_pair_screen']);
const TERMINAL = new Set(['completed', 'completed_empty', 'failed', 'blocked', 'cancelled', 'expired']);
const sessions = new Map();
const SESSION_TTL_MS = 30 * 60 * 1000;
const MAX_ACTIVE_SESSIONS = 8;
let activeStarts = 0;

// Phase 374 plan 12 (owner card OD-7 = PAGE-ARG, ADAPT374-03). A verified result above 256 KiB, or an explicit
// page, is kept here so later pages work after the session closed. Process memory only: this Map is never written
// to disk, a room, the plugin job record or a log (D-08, D-12). At most 4 entries, 30 minutes each, the oldest
// dropped first. An entry holds the verified answer without file text; it is stored only after the hash and
// lineage checks passed, so a refused result is never kept.
const resultPages = new Map();
const RESULT_PAGE_TTL_MS = 30 * 60 * 1000;
const RESULT_PAGE_MAX = 4;
const PAGE_EXPIRED = 'The first page of this result is no longer kept. Ask for page 1 again.';

// Phase 374 plan 10 (ADAPT374-02, owner card OD-4 = USER-DIR). Fixed sentences for the job record and for a job
// that is read again after a host restart. The record is a pointer (ids and hashes); the engine holds the job.
const RECORD_NOTE_FAILED = 'The job record could not be saved, so this job cannot be read again after a host restart. The job itself is not affected.';
const RECOVERY_NOTE = 'This job was read again after the MindrianOS host restarted. A job that was still running when the host stopped may read as failed with server_restarted, and the run does not resume.';
const HEX64_RE = /^[a-fA-F0-9]{64}$/;

// Phase 374 plan 11 (card OD-6, decision D-11): the interim engine_busy guard. The tool contract holds the refusal
// and the wrapper that applies it; this file only says which jobs of THIS process are still running. A session
// is busy until a status or result answer has been read for it ("observed"); after that its last status decides.
// It clears when the last status is terminal, the session is closed or past its lifetime, or the engine client
// threw (unreachable). It cannot see another host process (EXT-01, the Eureka owner lock, does not exist yet).
function busyNow() {
  const now = Date.now();
  for (const session of sessions.values()) {
    if (session.expires_at <= now) continue;
    if (session.last_status === 'unreachable') continue;
    if (session.observed === true && TERMINAL.has(session.last_status)) continue;
    return { job_id: session.job_id, unobserved: session.observed !== true };
  }
  if (activeStarts > 0) return { job_id: null, unobserved: false };
  return null;
}
setBusyProbe(busyNow);

// Record what an engine answer said about a session. A thrown client call marks the session unreachable.
function noteStatus(session, status) {
  if (typeof status === 'string' && status) session.last_status = status;
  session.observed = true;
}
function noteUnreachable(session) {
  session.last_status = 'unreachable';
  session.observed = true;
}

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

// Write the plugin job record for a started job. It never throws and never fails the job: false means "not saved".
// The record holds ids, hashes, counts and times only. The request is hashed, never copied (D-12).
function persistRecord({ session, args, owner, started, env }) {
  try {
    const where = jobRecord.resolveBase({ room_id: owner.roomId, env });
    if (!where.ok) return false;
    const request = args.request && typeof args.request === 'object' ? args.request : {};
    const approval = request.approval && typeof request.approval === 'object' ? request.approval : null;
    const withoutApproval = {};
    for (const key of Object.keys(request)) { if (key !== 'approval') withoutApproval[key] = request[key]; }
    const now = Date.now();
    const status = typeof started.status === 'string' && started.status ? started.status : 'queued';
    jobRecord.sweep(where.base, now);
    const written = jobRecord.recordStart(where.base, {
      job_id: session.job_id, capability_id: session.capability_id, route: session.route,
      scope_id: session.scope_id, snapshot_id: session.snapshot_id, room_id: owner.roomId,
      session_key_hash: owner.sessionKeyHash && HEX64_RE.test(owner.sessionKeyHash) ? owner.sessionKeyHash : null,
      request_sha256: jobRecord.canonicalSha256(withoutApproval),
      artifact_count: Array.isArray(request.artifacts) ? request.artifacts.length : null,
      top_k: Number.isInteger(request.top_k) && request.top_k >= 0 ? request.top_k : null,
      plan_digest: approval && typeof approval.plan_digest === 'string' && HEX64_RE.test(approval.plan_digest) ? approval.plan_digest : null,
      approval_ref: approval && typeof approval.approval_ref === 'string' && approval.approval_ref ? approval.approval_ref : null,
      idempotency_key: typeof args.idempotency_key === 'string' && args.idempotency_key ? args.idempotency_key : null,
      started_at: new Date(now).toISOString(), engine_expires_at: new Date(now + jobRecord.RETENTION_MS).toISOString(),
      last_status: status, last_status_at: new Date(now).toISOString(), terminal: false, manifest_sha256: null,
    });
    return written.ok === true;
  } catch (_error) {
    return false;
  }
}

// Best effort update of the record of a job. Never throws. The base folder comes from the room of the caller.
function touchRecord(env, roomId, jobId, patch) {
  try {
    const where = jobRecord.resolveBase({ room_id: roomId, env });
    if (!where.ok) return false;
    const clean = {};
    if (typeof patch.last_status === 'string' && patch.last_status) clean.last_status = patch.last_status.slice(0, 64);
    clean.last_status_at = new Date().toISOString();
    if (typeof patch.terminal === 'boolean') clean.terminal = patch.terminal;
    if (typeof patch.manifest_sha256 === 'string' && HEX64_RE.test(patch.manifest_sha256)) clean.manifest_sha256 = patch.manifest_sha256;
    return jobRecord.updateRecord(where.base, jobId, clean, roomId).ok === true;
  } catch (_error) {
    return false;
  }
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
  // Phase 374 plan 11: no second engine child while a job of this process runs. The session limit above stays the
  // first and more specific answer. This also guards the resolve function of a pair-screen approval, which reaches
  // the engine only through this function.
  const busy = engineBusyRefusal();
  if (busy) return busy;
  // Phase 392 plan 07: the configured workflow deadline rides on every call of this session (timeout and
  // maxTotalTimeout), else the client default of 60 s wins. The session keeps it for its lifecycle calls.
  const callDeadlineMs = configuredDeadlineMs(env, 'MINDRIAN_EUREKA_WORKFLOW_TIMEOUT_MS', 900000);
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
    const catalogResponse = await getCatalog(client, rootResult.root, signal, callOptions(callDeadlineMs, signal));
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
    const contractResponse = await getContract(client, rootResult.root, capability.id, signal, callOptions(callDeadlineMs, signal));
    if (!contractResponse.ok) return contractResponse;
    const contract = contractResponse.result;
    if (!contract || !contract.capability || contract.capability.id !== capability.id || !contract.schemas?.input || !contract.schemas?.output) {
      return { ok: false, reason: 'capability_contract_unavailable', message: 'Eureka did not return the published input and output contracts.' };
    }
    const callArguments = route === 'scout_run_workflow'
      ? { capability_id: capability.id, request: args.request }
      : { request: args.request, ...(args.idempotency_key ? { idempotency_key: args.idempotency_key } : {}) };
    const startedResponse = decodeResponse(await client.callTool({ name: route, arguments: callArguments }, callOptions(callDeadlineMs, signal)), 'Eureka rejected the capability request.');
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
      last_status: typeof started.status === 'string' && started.status ? started.status : 'queued', observed: false,
      call_deadline_ms: callDeadlineMs,
    };
    session.timer = setTimeout(() => { void expireSession(session.job_id); }, SESSION_TTL_MS);
    if (session.timer.unref) session.timer.unref();
    sessions.set(session.job_id, session);
    retained = true;
    const persisted = persistRecord({ session, args, owner, started, env });
    attachEviction(session);
    return {
      ok: true, capability_id: session.capability_id, job_id: session.job_id,
      ...(persisted ? { record_persisted: true } : { record_persisted: false, record_note: RECORD_NOTE_FAILED }),
      status: started.status || 'queued', readiness: session.readiness, route,
      scope_id: session.scope_id, snapshot_id: session.snapshot_id,
      expires_at: new Date(session.expires_at).toISOString(),
      persistence: 'eureka_job_store_only', review_required: true,
      note: 'This job is held by the MindrianOS MCP process that started it. A finished job can be read again after a restart from its saved record. A job that is still running when the host stops does not resume, and the engine may mark it failed with server_restarted. Poll status, retrieve the result, or request cancellation using the returned job_id. The retained session expires after 30 minutes.',
    };
  } catch (error) {
    if (signal && signal.aborted) return { ok: false, reason: 'cancelled', message: 'Eureka job start was cancelled.' };
    // Phase 392 plan 07: a request past the deadline while connected is a timeout, never a start failure.
    if (connected && isRequestTimeout(error)) return engineTimeoutRefusal(callDeadlineMs, 'job start');
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
  // Phase 374 plan 11: the plan step opens an engine child, so a running job of this process is checked first.
  const busyAtPlan = engineBusyRefusal();
  if (busyAtPlan) return busyAtPlan;
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
      if (launched && launched.reason === 'engine_busy') {
        // Another job began after the plan was shown. Nothing was started; the plan must be made again.
        return { ...launched, executed: false, message: launched.message + ' Nothing was started. Plan again after that job ends.' };
      }
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

function notFoundAnswer() {
  const base = { ok: false, reason: 'job_session_not_found', message: 'No active Eureka MCP session owns this job_id. Jobs cannot resume after the MindrianOS host process restarts; start a new job.' };
  // Plan 387-05: when the engine is not present, say so, because then no job can have started.
  const engine = resolveEngine(process.env);
  if (engine.state === 'present') return base;
  const d = describeEngineState({ state: engine.state, cause: engine.cause });
  const sentence = engine.state === 'absent' ? 'The Eureka engine is not set up, so no job can start.' : d.sentence;
  return { ...base, engine_state: engine.state, ...(d.cause ? { cause: d.cause } : {}), fix: d.fix, message: base.message + ' ' + sentence };
}

// Phase 392 plan 07: a retained session whose transport closes or fails leaves the session map at once, so a
// dead engine child never counts against MAX_ACTIVE_SESSIONS until the 30 minute expiry. The client calls
// its onclose after the transport is gone, so the close inside closeSession is a no-op then.
function attachEviction(session) {
  const evict = () => {
    if (sessions.get(session.job_id) === session) void closeSession(session.job_id);
  };
  session.client.onclose = evict;
  session.client.onerror = evict;
}

function lifecycleTimeout(session, subject) {
  return { ...engineTimeoutRefusal(session.call_deadline_ms, subject), capability_id: session.capability_id, job_id: session.job_id, persistence: 'eureka_job_store_only' };
}

function getSession(jobId, caller) {
  const session = sessions.get(jobId);
  if (!session) return notFoundAnswer();
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
  const caller = identityOf(deps, extra);
  const found = getSession(args.job_id, caller);
  if (!found.ok) return found.reason === 'job_session_not_found' ? recover('status', args.job_id, caller, extra, deps, found) : found;
  const { session } = found;
  let responseResult;
  try { responseResult = decodeResponse(await session.client.callTool({ name: 'scout_status', arguments: { job_id: session.job_id } }, callOptions(session.call_deadline_ms, signalFromExtra(extra))), 'Eureka could not read job status.'); }
  catch (error) {
    if (isRequestTimeout(error)) return lifecycleTimeout(session, 'job status');
    noteUnreachable(session);
    return { ok: false, reason: 'engine_status_error', capability_id: session.capability_id, job_id: session.job_id,
      persistence: 'eureka_job_store_only', message: 'Eureka could not read job status.' };
  }
  if (!responseResult.ok) return { ...responseResult, capability_id: session.capability_id, job_id: session.job_id,
    persistence: 'eureka_job_store_only' };
  noteStatus(session, responseResult.result.status);
  touchRecord(deps.env || process.env, session.room_id, session.job_id,
    { last_status: responseResult.result.status, terminal: TERMINAL.has(responseResult.result.status) });
  return { ok: true, capability_id: session.capability_id, job_id: session.job_id,
    status: responseResult.result.status, progress: responseResult.result.progress,
    scope_id: session.scope_id, snapshot_id: session.snapshot_id,
    events: responseResult.result.events, expires_at: new Date(session.expires_at).toISOString(),
    persistence: 'eureka_job_store_only', review_required: true };
}

// The answer for a terminal result. view is { capability_id, job_id, scope_id, snapshot_id, readiness, contract }.
// It does not close any session; the caller does. It is used by the live path and by the recovery path, so the
// lineage check, the pair-screen verifier and the answer shapes are the same in both.
function shapeResult(result, view) {
  const status = result && result.status;
  // A failed, blocked, cancelled, or expired job has no analysis result to
  // lineage-check. Report only its state and explicitly disclose that no
  // lineage-verified findings are available.
  if (status !== 'completed' && status !== 'completed_empty') {
    return { ok: true, capability_id: view.capability_id, job_id: view.job_id,
      status, scope_id: view.scope_id, snapshot_id: view.snapshot_id,
      readiness: view.readiness, result_kind: 'job_state_only', lineage_verified: false,
      engine_state: { status, ...(result.progress ? { progress: result.progress } : {}),
        ...(result.failure_code ? { failure_code: result.failure_code } : {}) },
      message: 'Eureka returned a terminal job state without a lineage-bound analysis result; no findings are included.',
      persistence: 'none', review_required: true, acceptance_requires_review: true };
  }
  if (!result || result.capability_id !== view.capability_id) {
    return { ok: false, reason: 'engine_lineage_mismatch', capability_id: view.capability_id,
      job_id: view.job_id, persistence: 'eureka_job_store_only',
      message: 'Eureka returned a job result with missing or mismatched capability lineage.' };
  }
  // Phase 374 plan 06 (E10): the scope check is unconditional. The start guard makes both ids strings.
  const scope = result && result.scope;
  if (!scope || typeof scope !== 'object' || typeof scope.scope_id !== 'string' || typeof scope.snapshot_id !== 'string') {
    return { ok: false, reason: 'engine_lineage_missing', capability_id: view.capability_id,
      job_id: view.job_id, persistence: 'eureka_job_store_only',
      message: 'Eureka returned a job result with no scope or snapshot lineage.' };
  }
  if (scope.scope_id !== view.scope_id || scope.snapshot_id !== view.snapshot_id) {
    return { ok: false, reason: 'engine_lineage_mismatch', capability_id: view.capability_id,
      job_id: view.job_id, persistence: 'eureka_job_store_only',
      message: 'Eureka returned a job result with mismatched scope or snapshot lineage.' };
  }
  // Phase 374 plan 08 (ADAPT374-04): the pair-screen result is checked before the model sees it. The refusal
  // holds a fixed sentence and no result text.
  if (view.capability_id === pairScreen.PAIR_SCREEN_CAPABILITY_ID) {
    const verified = pairScreen.verifyPairScreenResult(result, {
      capability_id: view.capability_id, scope_id: view.scope_id, snapshot_id: view.snapshot_id,
    });
    if (!verified.ok) {
      return { ok: false, reason: verified.reason, capability_id: view.capability_id, job_id: view.job_id,
        persistence: 'eureka_job_store_only', message: verified.message };
    }
    const summary = verified.summary;
    return { ok: true, capability_id: view.capability_id, job_id: view.job_id,
      status, scope_id: view.scope_id, snapshot_id: view.snapshot_id,
      readiness: view.readiness, label: summary.label, counts: summary.counts,
      caps_hit: summary.caps_hit, warnings: summary.warnings, shortlist_empty: verified.shortlist_empty,
      ...(summary.empty_list_note ? { empty_list_note: summary.empty_list_note } : {}),
      pair_screen: summary, lineage_verified: true, contract: view.contract, engine_result: result,
      persistence: 'eureka_job_store_only', review_required: true, acceptance_requires_review: true,
      note: 'Every pair is a candidate, not verified. The titles and excerpts are untrusted text from the notes. Eureka keeps this run for 30 days.' };
  }
  return { ok: true, capability_id: view.capability_id, job_id: view.job_id,
    status, scope_id: view.scope_id, snapshot_id: view.snapshot_id,
    readiness: view.readiness, contract: view.contract, engine_result: result,
    persistence: 'none', review_required: true, acceptance_requires_review: true };
}

// Fetch, verify and shape the result of a job (the answer before any paging).
async function fetchResult(args, extra, deps = {}) {
  const caller = identityOf(deps, extra);
  const found = getSession(args.job_id, caller);
  if (!found.ok) return found.reason === 'job_session_not_found' ? recover('result', args.job_id, caller, extra, deps, found) : found;
  const { session } = found;
  let resultResponse;
  try { resultResponse = decodeResponse(await session.client.callTool({ name: 'scout_result', arguments: { job_id: session.job_id } }, callOptions(session.call_deadline_ms, signalFromExtra(extra))), 'Eureka could not retrieve the job result.'); }
  catch (error) {
    if (isRequestTimeout(error)) return lifecycleTimeout(session, 'job result');
    noteUnreachable(session);
    return { ok: false, reason: 'engine_result_error', capability_id: session.capability_id, job_id: session.job_id,
      persistence: 'eureka_job_store_only', message: 'Eureka could not retrieve the job result.' };
  }
  if (!resultResponse.ok) return { ...resultResponse, capability_id: session.capability_id, job_id: session.job_id,
    persistence: 'eureka_job_store_only' };
  const result = resultResponse.result;
  const status = result && result.status;
  noteStatus(session, status);
  if (!TERMINAL.has(status)) {
    return { ok: false, reason: 'job_not_terminal', capability_id: session.capability_id, job_id: session.job_id,
      persistence: 'eureka_job_store_only', status,
      message: 'Eureka has not returned a terminal job state yet; poll status and retrieve the result again after completion.' };
  }
  // Retire a terminal worker even when a purported analysis result fails
  // lineage checks, so an invalid response cannot leak a child process.
  await closeSession(session.job_id);
  const answer = shapeResult(result, {
    capability_id: session.capability_id, job_id: session.job_id, scope_id: session.scope_id,
    snapshot_id: session.snapshot_id, readiness: session.readiness, contract: session.contract,
  });
  touchRecord(deps.env || process.env, session.room_id, session.job_id, { last_status: status, terminal: true, manifest_sha256: manifestOf(answer) });
  return answer;
}

// ---------------------------------------------------------------------------
// Phase 374 plan 12: paged results
// ---------------------------------------------------------------------------

function clockNow(deps) {
  return deps && typeof deps.now === 'function' ? deps.now() : Date.now();
}
function sameOwner(entry, caller) {
  const who = caller || { sessionKeyHash: null, roomId: null };
  return entry.owner.sessionKeyHash === who.sessionKeyHash && (!entry.owner.roomId || entry.owner.roomId === who.roomId);
}
function dropExpiredPages(now) {
  for (const [jobId, entry] of resultPages) if (now - entry.stored_at >= RESULT_PAGE_TTL_MS) resultPages.delete(jobId);
}
function storePages(jobId, answer, caller, now) {
  dropExpiredPages(now);
  resultPages.delete(jobId);
  resultPages.set(jobId, { answer: pairScreen.slimForCache(answer), stored_at: now,
    owner: { sessionKeyHash: caller ? caller.sessionKeyHash : null, roomId: caller ? caller.roomId : null } });
  while (resultPages.size > RESULT_PAGE_MAX) resultPages.delete(resultPages.keys().next().value);
  return resultPages.get(jobId);
}
// Forget a cached result (the forget tool of plan 374-13 calls this).
function dropCachedResult(jobId) {
  return resultPages.delete(jobId);
}

// A verified answer is returned whole when it is small and no page was asked for. Otherwise the verified answer is
// kept in process memory and one page of it is returned.
function deliver(answer, args, caller, now) {
  if (!answer || answer.ok !== true || !answer.engine_result || typeof answer.engine_result !== 'object') return answer;
  const page = args.page;
  if (page === undefined) {
    if (Buffer.byteLength(JSON.stringify(answer), 'utf8') <= TEXT_WARNING_BYTES) return answer;
    // A large answer with nothing to page (no outputs array, not a pair screen) keeps today's behavior.
    const outputs = answer.engine_result.outputs;
    if (!Array.isArray(outputs) && answer.capability_id !== pairScreen.PAIR_SCREEN_CAPABILITY_ID) return answer;
  }
  const entry = storePages(args.job_id, answer, caller, now);
  return pairScreen.pageResult(entry.answer, page === undefined ? 1 : page);
}

async function jobResult(args, extra, deps = {}) {
  const page = args.page;
  if (page !== undefined && (!Number.isInteger(page) || page < 1)) return pairScreen.pageResult({}, page);
  const caller = identityOf(deps, extra);
  const now = clockNow(deps);
  if (page !== undefined) {
    const entry = resultPages.get(args.job_id);
    if (entry) {
      if (!sameOwner(entry, caller)) return { ok: false, reason: 'job_session_wrong_owner', message: 'This job belongs to another session or room.' };
      if (now - entry.stored_at < RESULT_PAGE_TTL_MS) return pairScreen.pageResult(entry.answer, page);
      resultPages.delete(args.job_id);
    }
    // A later page cannot start a read: with no live session the first page was kept for 30 minutes and is gone.
    if (page >= 2 && !sessions.has(args.job_id)) return { ok: false, reason: 'job_result_page_expired', message: PAGE_EXPIRED };
  }
  const answer = await fetchResult(args, extra, deps);
  return deliver(answer, args, caller, now);
}

// The manifest hash of a verified result, or undefined.
function manifestOf(answer) {
  if (!answer || answer.ok !== true) return undefined;
  const fromSummary = answer.pair_screen && answer.pair_screen.manifest_sha256;
  if (typeof fromSummary === 'string') return fromSummary;
  const fromResult = answer.engine_result && answer.engine_result.manifest_sha256;
  return typeof fromResult === 'string' ? fromResult : undefined;
}

async function cancelJob(args, extra, deps = {}) {
  const caller = identityOf(deps, extra);
  const found = getSession(args.job_id, caller);
  if (!found.ok) return found.reason === 'job_session_not_found' ? recover('cancel', args.job_id, caller, extra, deps, found) : found;
  const { session } = found;
  let cancelResponse;
  try { cancelResponse = decodeResponse(await session.client.callTool({ name: 'scout_cancel', arguments: { job_id: session.job_id } }, callOptions(session.call_deadline_ms, signalFromExtra(extra))), 'Eureka could not request job cancellation.'); }
  catch (error) {
    if (isRequestTimeout(error)) return lifecycleTimeout(session, 'job cancel');
    noteUnreachable(session);
    return { ok: false, reason: 'engine_cancel_error', capability_id: session.capability_id,
      job_id: session.job_id, persistence: 'eureka_job_store_only', message: 'Eureka could not request job cancellation.' };
  }
  if (!cancelResponse.ok) return { ...cancelResponse, capability_id: session.capability_id,
    job_id: session.job_id, persistence: 'eureka_job_store_only' };
  return { ok: true, capability_id: session.capability_id, job_id: session.job_id,
    cancellation: cancelResponse.result, scope_id: session.scope_id, snapshot_id: session.snapshot_id,
    status: 'cancellation_requested', persistence: 'eureka_job_store_only', review_required: true,
    note: 'Cancellation is cooperative; poll status until Eureka reports a terminal state.' };
}

// Phase 374 plan 10 (ADAPT374-02, E7(d), E9, E13): the session table has no session for this job id, for example
// after a host restart. Read the plugin record of the caller's room, check the room, and ask the engine through
// ONE short child. A job that was still running when the host stopped may read as failed with server_restarted
// (EXT-02), and the engine cannot cancel a job across processes (EXT-03). notFound is the answer to give when no
// record exists. The session key is not compared: it changes with a host restart.
// The plugin record for a job id in the caller's room, or the answer to give. A record of another room is not
// shown: the caller only learns that the job is not theirs. An expired record is removed. Used by recover and by
// the forget tool, so both answer the same way.
function lookupRecord(jobId, caller, env, notFound) {
  if (!jobRecord.jobIdOk(jobId)) return { answer: notFound };
  const where = jobRecord.resolveBase({ room_id: caller.roomId, env });
  const record = where.ok ? jobRecord.readRecord(where.base, jobId, caller.roomId) : null;
  if (!record) {
    if (jobRecord.findInOtherRooms({ room_id: caller.roomId, env }, jobId)) {
      return { answer: { ok: false, reason: 'job_session_wrong_owner', message: 'This job belongs to another session or room.' } };
    }
    return { answer: notFound };
  }
  if (Date.parse(record.engine_expires_at) <= Date.now()) {
    jobRecord.removeRecord(where.base, jobId);
    return { answer: notFound };
  }
  return { record, where };
}

// Open ONE short engine child for a job read or a forget. { client } on success, { answer } on failure. A failed
// connect leaves nothing to close. The caller closes the client in a finally block.
async function connectChild({ deps, root, capabilityId, clientName, signal, env, cancelledMessage }) {
  const Transport = deps.StdioClientTransport || StdioClientTransport;
  const McpClient = deps.Client || Client;
  let capture = null;
  let connected = false;
  try {
    const transport = new Transport(clientOptions(root, env, capabilityId));
    const client = new McpClient({ name: clientName, version: '1.0.0' }, { capabilities: {} });
    capture = captureStartLine(transport);
    await client.connect(transport);
    connected = true;
    capture.stop();
    return { client };
  } catch (error) {
    if (signal && signal.aborted) return { answer: { ok: false, reason: 'cancelled', message: cancelledMessage } };
    if (capture) { capture.stop(); if (!connected) await capture.settle(); }
    return { answer: startFailureRefusal(error, connected || !capture ? '' : capture.line(), { root, home: env.HOME || env.USERPROFILE }) };
  }
}

async function recover(operation, jobId, caller, extra, deps, notFound) {
  const env = deps.env || process.env;
  const looked = lookupRecord(jobId, caller, env, notFound);
  if (looked.answer) return looked.answer;
  const { record } = looked;
  const view = { capability_id: record.capability_id, job_id: record.job_id, scope_id: record.scope_id, snapshot_id: record.snapshot_id };
  const recovered = {
    recovered: true,
    started_by_this_session: record.session_key_hash !== null && record.session_key_hash === caller.sessionKeyHash,
    recovery_note: RECOVERY_NOTE,
  };
  if (operation === 'cancel') {
    return { ok: false, reason: 'cancel_unavailable_after_restart', capability_id: view.capability_id, job_id: view.job_id,
      persistence: 'eureka_job_store_only', ...recovered,
      message: 'This job cannot be cancelled after the MindrianOS host restarted, because the engine cannot cancel a job from another process.' };
  }
  if (operation === 'status' && record.terminal && record.last_status) {
    return { ok: true, capability_id: view.capability_id, job_id: view.job_id, status: record.last_status,
      scope_id: view.scope_id, snapshot_id: view.snapshot_id, engine_expires_at: record.engine_expires_at,
      source: 'plugin_record', persistence: 'eureka_job_store_only', review_required: true, ...recovered };
  }
  // The job tools skip the engine gate, so the engine check is made here, before any child starts (E13).
  const refusal = engineRefusal(env);
  if (refusal) return refusal;
  const rootResult = configuredRoot(env);
  if (!rootResult.ok) return rootResult;
  const signal = signalFromExtra(extra);
  if (signal && signal.aborted) return { ok: false, reason: 'cancelled', message: 'The Eureka job read was cancelled before launch.' };
  // Quick 261118-vbv: the plan 392-07 deadline rides on the recovery calls too (timeout and maxTotalTimeout),
  // else the client default of 60 s wins. A request timeout answers engine_timeout, not an engine error.
  const callDeadlineMs = configuredDeadlineMs(env, 'MINDRIAN_EUREKA_WORKFLOW_TIMEOUT_MS', 900000);
  // Phase 374 plan 11: recovery opens ONE short child (EXT-02 accepts that risk when nothing runs here). While a job
  // of THIS process runs, that child could end it, so recovery waits. Cancel and a terminal record never get here.
  const busy = engineBusyRefusal();
  if (busy) return busy;

  const opened = await connectChild({ deps, root: rootResult.root, capabilityId: record.capability_id,
    clientName: 'mindrian-os-eureka-job-recovery', signal, env, cancelledMessage: 'The Eureka job read was cancelled.' });
  if (opened.answer) return opened.answer;
  const client = opened.client;
  try {
    if (operation === 'status') {
      let statusResponse;
      try { statusResponse = decodeResponse(await client.callTool({ name: 'scout_status', arguments: { job_id: jobId } }, callOptions(callDeadlineMs, signal)), 'Eureka could not read job status.'); }
      catch (error) { if (isRequestTimeout(error)) return { ...engineTimeoutRefusal(callDeadlineMs, 'job status'), capability_id: view.capability_id, job_id: view.job_id, persistence: 'eureka_job_store_only', ...recovered };
        return { ok: false, reason: 'engine_status_error', capability_id: view.capability_id, job_id: view.job_id,
        persistence: 'eureka_job_store_only', message: 'Eureka could not read job status.', ...recovered }; }
      if (!statusResponse.ok) return { ...statusResponse, capability_id: view.capability_id, job_id: view.job_id, persistence: 'eureka_job_store_only', ...recovered };
      const state = statusResponse.result || {};
      touchRecord(env, caller.roomId, jobId, { last_status: state.status, terminal: TERMINAL.has(state.status) });
      return { ok: true, capability_id: view.capability_id, job_id: view.job_id, status: state.status, progress: state.progress,
        ...(typeof state.failure_code === 'string' && /^[a-z0-9_]{1,64}$/.test(state.failure_code) ? { failure_code: state.failure_code } : {}),
        scope_id: view.scope_id, snapshot_id: view.snapshot_id, events: state.events, engine_expires_at: record.engine_expires_at,
        source: 'engine_status', persistence: 'eureka_job_store_only', review_required: true, ...recovered };
    }
    // operation is result
    let resultResponse;
    try { resultResponse = decodeResponse(await client.callTool({ name: 'scout_result', arguments: { job_id: jobId } }, callOptions(callDeadlineMs, signal)), 'Eureka could not retrieve the job result.'); }
    catch (error) { if (isRequestTimeout(error)) return { ...engineTimeoutRefusal(callDeadlineMs, 'job result'), capability_id: view.capability_id, job_id: view.job_id, persistence: 'eureka_job_store_only', ...recovered };
      return { ok: false, reason: 'engine_result_error', capability_id: view.capability_id, job_id: view.job_id,
      persistence: 'eureka_job_store_only', message: 'Eureka could not retrieve the job result.', ...recovered }; }
    if (!resultResponse.ok) return { ...resultResponse, capability_id: view.capability_id, job_id: view.job_id, persistence: 'eureka_job_store_only', ...recovered };
    const result = resultResponse.result;
    const status = result && result.status;
    if (!TERMINAL.has(status)) {
      touchRecord(env, caller.roomId, jobId, { last_status: status, terminal: false });
      return { ok: false, reason: 'job_not_terminal', capability_id: view.capability_id, job_id: view.job_id,
        persistence: 'eureka_job_store_only', status, ...recovered,
        message: 'Eureka has not returned a terminal job state yet; poll status and retrieve the result again after completion.' };
    }
    let contract;
    try {
      const contractResponse = await getContract(client, rootResult.root, view.capability_id, signal, callOptions(callDeadlineMs, signal));
      if (contractResponse.ok && contractResponse.result && contractResponse.result.schemas) contract = contractResponse.result.schemas;
    } catch (_error) { contract = undefined; }
    const answer = shapeResult(result, { ...view, contract });
    touchRecord(env, caller.roomId, jobId, { last_status: status, terminal: true, manifest_sha256: manifestOf(answer) });
    return { ...answer, source: 'engine_status', ...recovered };
  } finally {
    try { if (client) await client.close(); } catch (_error) { /* best effort */ }
  }
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
  try { await session.client.callTool({ name: 'scout_cancel', arguments: { job_id: jobId } }, callOptions(CANCEL_DEADLINE_MS)); } catch (_error) { /* continue bounded cleanup */ }
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    try {
      const status = decodeResponse(await session.client.callTool({ name: 'scout_status', arguments: { job_id: jobId } }, callOptions(remainingMs(deadline))), 'status unavailable');
      if (status.ok && TERMINAL.has(status.result.status)) break;
    } catch (_error) { break; }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return closeSession(jobId);
}

// Phase 374 plan 13 (owner card OD-2 = ADD-FORGET-TOOL, decision D-10). Forget ONE finished run: the engine row
// (scout_delete_job, which deletes the saved request, result and judgments), then the plugin pointer record, then
// any cached result page. Fixed sentences only; no engine text reaches the answer. The run is checked first: a
// run that has not finished is refused. The engine deletes only a finished row, and a person must cancel first.
const FORGET_CONFIRM = 'Forgetting a run deletes it for good. Call again with confirm true, and only after the person asks to forget this run.';
const FORGET_NOT_FINISHED = 'This run has not finished. Cancel it first, wait until it reports an end state, then forget it.';
const FORGET_ENGINE_ERROR = 'Eureka could not delete this run. The MindrianOS record was kept. Try again later.';
const FORGET_DONE = 'This run was deleted from the Eureka job store and from the MindrianOS record. It cannot be recovered.';
const FORGET_GONE = 'Eureka had no record of this run. The MindrianOS record was removed. It cannot be recovered.';
// EXT-02: any engine process that opens the job store marks every running row failed with server_restarted.
const FORGET_CHILD_NOTE = 'To forget this run after a host restart, MindrianOS opened one Eureka engine process. If another MindrianOS process was running a Eureka job at that time, the engine may have marked that job failed with server_restarted.';

// Remove what the plugin keeps for a forgotten run: the cached result page and the pointer record.
function forgetLocal(jobId, roomId, env) {
  const cached = dropCachedResult(jobId);
  let removed = false;
  try {
    const where = jobRecord.resolveBase({ room_id: roomId, env });
    if (where.ok) removed = jobRecord.removeRecord(where.base, jobId).ok === true;
  } catch (_error) { removed = false; }
  return { cached_result_dropped: cached, record_removed: removed };
}

// Ask the engine through client: status first (a run that has not ended is refused), then the delete.
// Returns { answer } for a refusal or { engineDeleted } on success. Never returns engine text.
// Quick 261118-vbv: deadlineMs (the plan 392-07 deadline) rides on both calls; a timeout keeps engine_forget_error.
async function forgetOnEngine(client, jobId, view, signal, deadlineMs) {
  let statusResponse;
  try { statusResponse = decodeResponse(await client.callTool({ name: 'scout_status', arguments: { job_id: jobId } }, callOptions(deadlineMs, signal)), 'Eureka could not read job status.'); }
  catch (_error) { statusResponse = { ok: false }; }
  if (!statusResponse.ok) return { answer: { ok: false, reason: 'engine_forget_error', ...view, message: FORGET_ENGINE_ERROR } };
  const status = statusResponse.result && statusResponse.result.status;
  if (!TERMINAL.has(status)) {
    return { answer: { ok: false, reason: 'job_not_finished', ...view, message: FORGET_NOT_FINISHED }, status };
  }
  let deleteResponse;
  try { deleteResponse = decodeResponse(await client.callTool({ name: 'scout_delete_job', arguments: { job_id: jobId } }, callOptions(deadlineMs, signal)), 'Eureka could not delete the job.'); }
  catch (_error) { deleteResponse = { ok: false }; }
  if (!deleteResponse.ok) return { answer: { ok: false, reason: 'engine_forget_error', ...view, message: FORGET_ENGINE_ERROR } };
  return { engineDeleted: !(deleteResponse.result && deleteResponse.result.deleted === false), status };
}

function forgotten(view, engineDeleted, local, extra) {
  return { ok: true, ...view, forgotten: true, engine_deleted: engineDeleted, record_removed: local.record_removed,
    cached_result_dropped: local.cached_result_dropped, persistence: 'none', message: engineDeleted ? FORGET_DONE : FORGET_GONE, ...(extra || {}) };
}

async function forgetJob(args, extra, deps = {}) {
  if (!args || args.confirm !== true) return { ok: false, reason: 'confirm_required', message: FORGET_CONFIRM };
  const caller = identityOf(deps, extra);
  const env = deps.env || process.env;
  const signal = signalFromExtra(extra);
  const found = getSession(args.job_id, caller);
  if (!found.ok && found.reason !== 'job_session_not_found') return found;

  if (found.ok) {
    // A live session of this process: the retained client makes the call, so no extra child opens.
    const { session } = found;
    const view = { capability_id: session.capability_id, job_id: session.job_id };
    const done = await forgetOnEngine(session.client, session.job_id, view, signal, session.call_deadline_ms);
    if (done.answer) {
      if (done.status !== undefined) noteStatus(session, done.status);
      return done.answer;
    }
    const local = forgetLocal(session.job_id, session.room_id, env);
    await closeSession(session.job_id);
    return forgotten(view, done.engineDeleted, local);
  }

  // No session (for example after a host restart): the plugin record decides who may forget, then ONE short child.
  const looked = lookupRecord(args.job_id, caller, env, found);
  if (looked.answer) return looked.answer;
  const { record } = looked;
  const view = { capability_id: record.capability_id, job_id: record.job_id };
  const refusal = engineRefusal(env);
  if (refusal) return refusal;
  const rootResult = configuredRoot(env);
  if (!rootResult.ok) return rootResult;
  if (signal && signal.aborted) return { ok: false, reason: 'cancelled', message: 'The Eureka forget was cancelled before launch.' };
  const busy = engineBusyRefusal();
  if (busy) return busy;
  const opened = await connectChild({ deps, root: rootResult.root, capabilityId: record.capability_id,
    clientName: 'mindrian-os-eureka-job-forget', signal, env, cancelledMessage: 'The Eureka forget was cancelled.' });
  if (opened.answer) return opened.answer;
  try {
    const done = await forgetOnEngine(opened.client, record.job_id, view, signal, configuredDeadlineMs(env, 'MINDRIAN_EUREKA_WORKFLOW_TIMEOUT_MS', 900000));
    if (done.answer) {
      if (done.status !== undefined) touchRecord(env, caller.roomId, record.job_id, { last_status: done.status, terminal: false });
      return { ...done.answer, ...(done.answer.reason === 'engine_forget_error' ? {} : { engine_note: FORGET_CHILD_NOTE }) };
    }
    const local = forgetLocal(record.job_id, caller.roomId, env);
    return forgotten(view, done.engineDeleted, local, { engine_note: FORGET_CHILD_NOTE });
  } finally {
    try { await opened.client.close(); } catch (_error) { /* best effort */ }
  }
}

const jobIdSchema = z.object({ job_id: z.string().min(1).max(200) }).strict();
// Phase 374 plan 12: the result tool alone takes an optional page. Status and cancel keep jobIdSchema.
const resultSchema = z.object({ job_id: z.string().min(1).max(200), page: z.number().int().min(1).max(100000).optional() }).strict();
const forgetSchema = z.object({ job_id: z.string().min(1).max(200), confirm: z.literal(true) }).strict();
function register(server, ctx) {
  const deps = { ctx, server };
  registerEurekaTool(server, 'eureka_capability_start', {
    title: 'Start a Catalogued Eureka Job',
    description: 'Start a catalogued Eureka capability as a background job. The MindrianOS MCP process keeps the Eureka worker session, so status, result and cancel calls reach the live job. For opportunity.run_pair_screen the first call only plans: it runs nothing and returns awaiting_approval with a card, and the run starts only after the person answers yes on that card. Other capabilities start at once. The pair screen needs a local meaning model. Eureka keeps the job and its result for 30 days under MINDRIAN_EUREKA_DATA_DIR or ~/.local/share/mindrian-eureka, clears the saved request at the end, and RS jobs may write vectors to a local cache. MindrianOS keeps a small job record (ids and hashes only), so a finished job can be read again after a host restart. While a job runs, other Eureka calls answer engine_busy until its status or result shows an end state; this holds for one MindrianOS host process only. Sessions last 30 minutes; at most eight are active. This generic tool does not read the MindrianOS graph: send schema-shaped requests.',
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    inputSchema: z.object({ capability_id: z.string().min(1).max(160).regex(/^[a-z][a-z0-9_.-]+$/), request: z.record(z.string(), z.unknown()), idempotency_key: z.string().min(1).max(128).optional() }).strict(),
  }, async (args, extra) => { const result = await startCapability(args, extra, deps); return response(result, !result.ok); });
  registerEurekaTool(server, 'eureka_capability_job_status', {
    title: 'Check Eureka Job Status', description: 'Read progress for a Eureka job. Eureka and MindrianOS keep the job record for 30 days. A finished job reads as finished again after a host restart. A job that was still running at the restart may read as failed (server_restarted), and the run does not resume. Reading an end state clears the engine_busy guard.',
    inputSchema: jobIdSchema,
  }, async (args, extra) => { const result = await jobStatus(args, extra, deps); return response(result, !result.ok); });
  registerEurekaTool(server, 'eureka_capability_job_result', {
    title: 'Retrieve Eureka Job Result', description: 'Retrieve the result of a Eureka job. Eureka keeps the result for 30 days; RS jobs may also write vectors to the local cache. A finished job can be read again after a host restart. A job that was still running at the restart may read as failed (server_restarted), and the run does not resume. A result above 256 KiB comes as a summary plus page 1; pass page 2, 3 and on for the rest. Pages stay in memory for 30 minutes, then the answer is job_result_page_expired; a page past the end gives page_out_of_range. A finished read closes the retained Eureka session.',
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    inputSchema: resultSchema,
  }, async (args, extra) => { const result = await jobResult(args, extra, deps); return response(result, !result.ok); });
  registerEurekaTool(server, 'eureka_capability_job_cancel', {
    title: 'Cancel Eureka Job', description: 'Request cooperative cancellation for a Eureka job started in this MindrianOS host process. Poll status to confirm the end state. A job from before a host restart cannot be cancelled (cancel_unavailable_after_restart), because a run does not resume after a restart.',
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    inputSchema: jobIdSchema,
  }, async (args, extra) => { const result = await cancelJob(args, extra, deps); return response(result, !result.ok); });
  registerEurekaTool(server, 'eureka_capability_job_forget', {
    title: 'Forget a Finished Eureka Run',
    description: 'Forget one finished Eureka run. Call this only after the person asks to forget it, with confirm true. It deletes the run from the Eureka job store, the MindrianOS job record and any kept result pages. This cannot be undone. A run that has not finished is refused: cancel it first. After a host restart, forgetting opens one Eureka engine process, which can mark a job running in another MindrianOS process as failed (server_restarted).',
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    inputSchema: forgetSchema,
  }, async (args, extra) => { const result = await forgetJob(args, extra, deps); return response(result, !result.ok); });
}

// Only the pair-screen capability raises a card (owner card OD-5A, answer F6); every other capability starts without one.
const connectors = [
  ['eureka_capability_start', 'F.6', 'Only the pair-screen capability raises a plan-review card, and only an approval on that card starts the run; every other capability starts without a card and retains its worker session.'],
  ['eureka_capability_job_status', 'none', 'Reads status for a Eureka job from the live session or, after a host restart, from the MindrianOS job record and the engine.'],
  ['eureka_capability_job_result', 'none', 'Returns the checked result for a finished catalogued Eureka job, in pages above 256 KiB.'],
  ['eureka_capability_job_cancel', 'none', 'Requests cooperative cancellation for a retained Eureka job.'],
  ['eureka_capability_job_forget', 'F.0', 'A person asks to forget one finished run, and the explicit confirm flag is that yes; the tool deletes only that run from the Eureka job store and the local MindrianOS record.'],
].map(([tool, hitl_shape, hitl_why]) => ({ tool, surface: tool, connector: 'mcp-tool', hitl_shape, hitl_why,
  layer: 'harness', layer_why: 'Owns the Eureka MCP worker session and job lifecycle; persistence and review remain governed by MindrianOS.' }));

module.exports = { ASYNC_ROUTES, TERMINAL, sessions, resultPages, RESULT_PAGE_TTL_MS, RESULT_PAGE_MAX, dropCachedResult, SESSION_TTL_MS, MAX_ACTIVE_SESSIONS, callerIdentity, startCapability, jobStatus, jobResult, cancelJob, forgetJob, closeSession, expireSession, register, connectors };
