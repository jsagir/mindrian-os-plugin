'use strict';

const { z } = require('zod');
// Phase 387 plan 05: the engine location rule and the fixed sentences live in the resolver (Plan 387-03).
// This file only turns them into the typed refusal the tools return; it re-implements neither.
const resolver = require('../core/eureka/eureka-engine-resolver.cjs');
// Phase 387 plan 11: the needs map, the probes, the text classifier and the start-line cleaner (Plan 387-03).
const requirements = require('../core/eureka/eureka-engine-requirements.cjs');
// Phase 392 plan 07: the client's own request timeout code. The client package (2.x) throws an SdkError with
// the string code SdkErrorCode.RequestTimeout (REQUEST_TIMEOUT); the 1.x SDK threw an McpError with -32001.
const { SdkErrorCode } = require('@modelcontextprotocol/client');

// Shared output envelope for read-only Eureka adapters. The schema types the
// cross-tool lineage and review fields while preserving capability-specific
// nested results for forward-compatible clients.
const outputSchema = z.object({
  ok: z.boolean(),
  reason: z.string().optional(),
  capability_id: z.string().optional(),
  scope_id: z.string().optional(),
  snapshot_id: z.string().optional(),
  partial: z.boolean().optional(),
  projection_complete: z.boolean().optional(),
  projection_omissions: z.record(z.string(), z.unknown()).optional(),
  review_required: z.boolean().optional(),
  acceptance_requires_review: z.boolean().optional(),
  accepted_knowledge_persistence: z.enum(['none']).optional(),
  engine_state_persistence: z.enum(['none', 'durable_local_job_store', 'unknown']).optional(),
  derived_cache_persistence: z.enum(['none', 'local_embedding_cache_may_be_written', 'unknown']).optional(),
  persistence: z.string().optional(),
  response_size_bytes: z.number().int().nonnegative().optional(),
  response_size_warning: z.string().optional(),
  // Phase 387 plan 05: the typed engine state of a refusal and its next step.
  engine_state: z.enum(['absent', 'present', 'broken']).optional(),
  cause: z.string().optional(),
  fix: z.string().optional(),
  route_state: z.enum(['needs_extra', 'needs_model', 'needs_node']).optional(),
  needs: z.array(z.string()).optional(),
  // Phase 387 plan 11: the cleaned first line of the engine start-up error (start phase only).
  engine_start_line: z.string().optional(),
}).passthrough();

function frozenSet(items) {
  const set = new Set(items);
  const refuse = () => { throw new TypeError('this set is frozen'); };
  set.add = refuse;
  set.delete = refuse;
  set.clear = refuse;
  return Object.freeze(set);
}

// Tools the engine gate skips. eureka_graph_project reads the bound room and calls no engine.
const ENGINE_FREE_TOOLS = frozenSet(['eureka_graph_project']);
// The four job tools need an engine-started job. They answer from the in-process session table, so the
// gate skips them; their not-found answer carries the engine state instead (eureka-capability-jobs.cjs).
const JOB_LIFECYCLE_TOOLS = frozenSet(['eureka_capability_job_status', 'eureka_capability_job_result', 'eureka_capability_job_cancel', 'eureka_capability_job_forget']);

const ENGINE_REQUIREMENT = 'Requires the Eureka engine (set up with /mos:eureka enable engine) and uv.';
const NO_ENGINE_TAIL = ' The default /mos:eureka run needs no engine.';

// Causes where the engine exists and one route needs more (a package group, a model folder, Node.js).
const ROUTE_STATE_BY_CAUSE = Object.freeze({
  extra_missing: 'needs_extra', model_missing: 'needs_model', node_missing: 'needs_node', node_too_old: 'needs_node',
});

// The one builder of a typed refusal. cause null means the engine is absent. Every text comes from a fixed
// sentence; no path and no raw engine output enters it.
function typedRefusal(cause, detail) {
  const named = typeof cause === 'string' && cause ? cause : null;
  const d = resolver.describeEngineState({ state: named ? 'broken' : 'absent', cause: named, detail });
  const routeState = d.cause ? ROUTE_STATE_BY_CAUSE[d.cause] : undefined;
  const out = {
    ok: false,
    reason: d.reason || resolver.reasonForCause(d.cause),
    engine_state: !d.cause ? 'absent' : routeState ? 'present' : 'broken',
  };
  if (d.cause) out.cause = d.cause;
  if (routeState) out.route_state = routeState;
  if (d.cause === 'extra_missing' && detail && Array.isArray(detail.extras)) {
    out.needs = detail.extras.filter((x) => typeof x === 'string' && /^[a-z][a-z0-9-]*$/.test(x));
  }
  out.message = d.sentence + NO_ENGINE_TAIL;
  out.fix = d.fix;
  return out;
}

// null when the engine folder is present, else the typed refusal for the resolver cause.
function engineRefusal(env) {
  const engine = resolver.resolveEngine(env);
  if (engine.state === 'present') return null;
  return typedRefusal(engine.cause);
}

// The one replacement for the inline root checks of the tool modules.
function engineRootOrRefusal(env) {
  const engine = resolver.resolveEngine(env);
  if (engine.state === 'present') return { ok: true, root: engine.root };
  return typedRefusal(engine.cause);
}

// A failed engine start: a missing uv shows as ENOENT on the spawn; anything else is a plain start failure.
function classifyEngineStartError(error) {
  const code = error && error.code;
  const message = String(error && error.message || error || '');
  if (code === 'ENOENT' || message.indexOf('ENOENT') !== -1) return { cause: 'uv_missing' };
  return { cause: 'engine_start_failed' };
}

// ---------------------------------------------------------------------------
// Phase 387 plan 11: route needs, typed engine text, start-phase capture
// ---------------------------------------------------------------------------

// The probes the route gate reads at call time. Tests replace them through setProbeDeps.
const REAL_PROBES = Object.freeze({
  needsForCall: requirements.needsForCall,
  extrasInstalled: requirements.extrasInstalled,
  nodeStatus: requirements.nodeStatus,
});
let probes = REAL_PROBES;

// Test seam. deps may hold needsForCall, extrasInstalled and nodeStatus. No argument restores the real ones.
function setProbeDeps(deps) {
  probes = deps && typeof deps === 'object' ? { ...REAL_PROBES, ...deps } : REAL_PROBES;
}

// The engine answered with a text that names a known need or start problem: return the typed refusal with
// its fixed sentence, never the engine text. null when the text is not known.
function refusalFromEngineText(text) {
  try {
    const found = requirements.classifyEngineText(text);
    if (!found) return null;
    return typedRefusal(found.cause, { extras: found.extras });
  } catch (_error) {
    return null;
  }
}

// Runs after the engine-level gate passed (the folder is there). Refuses before the engine starts when the
// prepared environment is missing, a needed package group is not installed, or Node.js 22 or newer is needed
// and absent. Unknown never refuses: an unreadable layout, a null group and a node cell that is not yes pass.
// The model is never gated here, because the plugin cannot see the model search path of the engine.
// It never throws; on an internal error it returns null.
function routeGate(toolName, args, env) {
  try {
    const e = env && typeof env === 'object' ? env : process.env;
    const engine = resolver.resolveEngine(e);
    if (engine.state !== 'present') return null;
    const needs = probes.needsForCall(toolName, args, e) || {};
    const found = probes.extrasInstalled(engine.root, e) || {};
    const envSetting = typeof e.UV_PROJECT_ENVIRONMENT === 'string' && e.UV_PROJECT_ENVIRONMENT.trim();
    if (found.venv_present === false && !envSetting) return typedRefusal('env_not_synced');
    if (found.located === true && found.installed && Array.isArray(needs.extras)) {
      const missing = needs.extras.filter((group) => found.installed[group] === false);
      if (missing.length) return typedRefusal('extra_missing', { extras: missing });
    }
    if (needs.node === 'yes') {
      const node = probes.nodeStatus(e);
      if (node && node.ok === false) return typedRefusal(node.cause === 'node_too_old' ? 'node_too_old' : 'node_missing');
    }
    return null;
  } catch (_error) {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Phase 374 plan 11 (card OD-6, decision D-11): the interim engine_busy guard
// ---------------------------------------------------------------------------
//
// Every new eureka-mcp process marks all running job rows failed when it opens the job store (Eureka jobs.py).
// The plugin opens a child for every job and every graph call, so a second call during a run could end that run.
// Until the Eureka owner lock exists (EXT-01), this guard refuses a call that would open a second child while a
// job started by THIS process is still running. It cannot see another host process. This file cannot require the
// jobs file (the jobs file requires this one), so the jobs file registers a probe at load.

const BUSY_NEXT_STEP = 'Read its status, retrieve its result or cancel it first, then repeat this call.';
const BUSY_UNOBSERVED = ' If it has finished, read its status first: the guard clears only after a terminal status is read.';
const BUSY_LIMIT = ' This guard covers one MindrianOS host process only.';

function defaultBusyProbe() { return null; }
let busyProbe = defaultBusyProbe;

// Test and wiring seam. fn() returns null when nothing runs, else { job_id: string or null, unobserved: boolean }.
// No argument restores the default (never busy).
function setBusyProbe(fn) {
  busyProbe = typeof fn === 'function' ? fn : defaultBusyProbe;
}

// null when no job of this process is running, else the typed refusal. Fixed sentences only; the only value in
// the answer is the job id, which the probe built from a plugin-made session. It never throws.
function engineBusyRefusal() {
  let busy = null;
  try { busy = busyProbe(); } catch (_error) { busy = null; }
  if (!busy || typeof busy !== 'object') return null;
  const jobId = typeof busy.job_id === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$/.test(busy.job_id) ? busy.job_id : null;
  const subject = jobId ? 'Eureka is running a job (' + jobId + ').' : 'Eureka is starting a job.';
  return {
    ok: false,
    reason: 'engine_busy',
    ...(jobId ? { job_id: jobId } : {}),
    message: subject + ' A second Eureka call now could end that job. ' + BUSY_NEXT_STEP +
      (busy.unobserved === true ? BUSY_UNOBSERVED : '') + BUSY_LIMIT,
    fix: 'Read the job status, retrieve the result or cancel the job, then repeat the call.',
  };
}

const START_CAPTURE_LIMIT = 2048;

// Listens to the stderr stream of a transport (the transport option stderr is pipe) and keeps at most 2,048
// characters. After stop() it keeps draining and discards, so the child never blocks on a full pipe.
// Without a stderr stream (a fake transport, an old SDK) line() is empty.
function captureStartLine(transport) {
  let buffer = '';
  let stopped = false;
  const stream = transport && transport.stderr;
  if (stream && typeof stream.on === 'function') {
    try {
      stream.on('data', (chunk) => {
        if (stopped || buffer.length >= START_CAPTURE_LIMIT) return;
        buffer += String(chunk).slice(0, START_CAPTURE_LIMIT - buffer.length);
      });
      stream.on('error', () => { /* a capture error must not reach the caller */ });
    } catch (_error) { /* no capture */ }
  }
  return {
    line() {
      return buffer.split(/\r?\n/).map((l) => l.trim()).find((l) => l.length > 0) || '';
    },
    stop() { stopped = true; },
    // The child writes its error and then exits; give the stream one short turn to deliver the text.
    settle() { return new Promise((resolve) => setTimeout(resolve, 25)); },
  };
}

// A failed start: classify the raw first line, then the error text, else a plain start failure. Adds the
// cleaned first line as engine_start_line unless it holds a token-like run or the word Traceback.
function startFailureRefusal(error, rawLine, ctx) {
  const c = ctx && typeof ctx === 'object' ? ctx : {};
  let found = null;
  try { found = requirements.classifyEngineText(rawLine); } catch (_error) { found = null; }
  if (!found) {
    const message = String(error && error.message || error || '');
    try { found = requirements.classifyEngineText(message); } catch (_error) { found = null; }
    if (!found) found = { cause: classifyEngineStartError(error).cause, extras: [] };
  }
  const out = typedRefusal(found.cause, { extras: found.extras });
  try {
    const cleaned = requirements.startLine(rawLine, { root: c.root, home: c.home });
    const probe = cleaned.split('<MINDRIAN_EUREKA_ROOT>').join('');
    if (cleaned && !/[A-Za-z0-9_-]{20,}/.test(probe) && !/Traceback/i.test(cleaned)) out.engine_start_line = cleaned;
  } catch (_error) { /* no start line */ }
  return out;
}

// ---------------------------------------------------------------------------
// Phase 392 plan 07 (loop check L2): the plugin deadline on every client.callTool
// ---------------------------------------------------------------------------

// The MCP client applies its own default request timeout of 60 s (DEFAULT_REQUEST_TIMEOUT_MSEC) to a call
// that passes no timeout. That default beat the plugin's 120 s and 900 s deadlines and the error landed in
// startFailureRefusal as a start failure. Every Eureka callTool now passes the options from callOptions.
const CALL_DEADLINE_MIN_MS = 1000;
const CALL_DEADLINE_MAX_MS = 1800000;
// A best-effort scout_cancel after a failure or a timeout gets a short fixed deadline.
const CANCEL_DEADLINE_MS = 5000;
const SDK_REQUEST_TIMEOUT_CODE = (SdkErrorCode && SdkErrorCode.RequestTimeout) || 'REQUEST_TIMEOUT';
const LEGACY_REQUEST_TIMEOUT_CODE = -32001;

function clampDeadline(ms) {
  const n = Number(ms);
  if (!Number.isFinite(n)) return CALL_DEADLINE_MIN_MS;
  return Math.min(Math.max(Math.floor(n), CALL_DEADLINE_MIN_MS), CALL_DEADLINE_MAX_MS);
}

// The second argument of client.callTool: the signal (undefined when the caller has none), the per-request
// timeout and the total budget, both equal to the plugin deadline of that call (clamped to 1 s .. 30 min).
function callOptions(deadlineMs, signal) {
  const timeout = clampDeadline(deadlineMs);
  return { signal: signal || undefined, timeout, maxTotalTimeout: timeout };
}

// For a call inside a polling loop: the time left until the loop deadline, never less than 1 s.
function remainingMs(deadline) {
  return Math.max(Number(deadline) - Date.now(), CALL_DEADLINE_MIN_MS);
}

// The configured deadline of a tool: the environment variable when it holds a number, else the fallback.
function configuredDeadlineMs(env, name, fallback) {
  const e = env && typeof env === 'object' ? env : process.env;
  const n = Number(e[name] || fallback);
  return clampDeadline(Number.isFinite(n) ? n : fallback);
}

// true for the client's request-timeout error (the SdkError code, or the legacy -32001 McpError code).
function isRequestTimeout(error) {
  if (!error || typeof error !== 'object') return false;
  return error.code === SDK_REQUEST_TIMEOUT_CODE || error.code === LEGACY_REQUEST_TIMEOUT_CODE;
}

// The typed answer for a request that ran past the plugin deadline while the engine was connected. The
// message names the configured limit; it holds no engine text.
function engineTimeoutRefusal(limitMs, subject) {
  const seconds = Math.round(clampDeadline(limitMs) / 1000);
  return { ok: false, reason: 'engine_timeout', message: 'Eureka ' + subject + ' exceeded its configured runtime limit of ' + seconds + ' seconds.' };
}

function registerEurekaTool(server, name, config, handler) {
  // The engine gate runs before the handler body, so the room projection never opens when the engine is not
  // present and a person with no engine learns that first, bound room or not.
  const gated = !ENGINE_FREE_TOOLS.has(name) && !JOB_LIFECYCLE_TOOLS.has(name);
  const wrapped = gated
    ? async (...handlerArgs) => {
      const refusal = engineRefusal(process.env);
      if (refusal) return response(refusal, true);
      // Phase 387 plan 11: route needs, checked before the handler can start the engine.
      const needsRefusal = routeGate(name, handlerArgs[0], process.env);
      if (needsRefusal) return response(needsRefusal, true);
      // Phase 374 plan 11: no second engine child while a job of this process still runs.
      const busyRefusal = engineBusyRefusal();
      if (busyRefusal) return response(busyRefusal, true);
      return handler(...handlerArgs);
    }
    : handler;
  server.registerTool(name, {
    ...config,
    outputSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
      ...(config.annotations || {}),
    },
  }, wrapped);
}

const TEXT_WARNING_BYTES = 256 * 1024;

function textSummary(payload, responseBytes) {
  const summary = { ok: payload && payload.ok === true };
  for (const key of [
    'reason', 'message', 'capability_id', 'job_id', 'status', 'readiness',
    'scope_id', 'snapshot_id', 'partial', 'projection_complete',
    'projection_omissions', 'review_required', 'accepted_knowledge_persistence',
    'engine_state_persistence', 'derived_cache_persistence', 'persistence', 'candidate_count',
    'result_count', 'response_size_bytes', 'engine_state', 'cause', 'fix', 'route_state', 'needs',
    'engine_start_line',
  ]) {
    if (payload && payload[key] !== undefined) summary[key] = payload[key];
  }
  const sizes = {};
  function countCollections(value, prefix, depth) {
    if (!value || typeof value !== 'object' || depth > 4 || Array.isArray(value)) return;
    for (const [key, child] of Object.entries(value)) {
      const name = prefix ? prefix + '.' + key : key;
      if (Array.isArray(child)) sizes[name] = child.length;
      else if (child && typeof child === 'object') countCollections(child, name, depth + 1);
    }
  }
  countCollections(payload, '', 0);
  if (Object.keys(sizes).length) summary.collection_counts = sizes;
  summary.structured_content_bytes = responseBytes;
  if (responseBytes >= TEXT_WARNING_BYTES) {
    summary.response_size_warning = 'Large structured result; inspect selected fields or narrow the request before adding it to model context.';
  }
  return summary;
}

function response(payload, isError) {
  const durableJob = payload && (payload.persistence === 'eureka_job_store_only' ||
    (payload.job_id && ['opportunity.find_cross_domain_pairs', 'opportunity.synthesize_discovery_signals'].includes(payload.capability_id)));
  const unknownJobState = payload && ['job_session_not_found', 'job_session_expired'].includes(payload.reason);
  const usesPairCache = durableJob && ['opportunity.find_cross_domain_pairs', 'opportunity.synthesize_discovery_signals'].includes(payload.capability_id);
  const structuredBase = {
    ...payload,
    review_required: payload && payload.review_required !== undefined ? payload.review_required : true,
    accepted_knowledge_persistence: payload && payload.accepted_knowledge_persistence || 'none',
    engine_state_persistence: payload && payload.engine_state_persistence || (durableJob ? 'durable_local_job_store' : unknownJobState ? 'unknown' : 'none'),
    derived_cache_persistence: payload && payload.derived_cache_persistence || (usesPairCache ? 'local_embedding_cache_may_be_written' : unknownJobState ? 'unknown' : 'none'),
  };
  const responseBytes = Buffer.byteLength(JSON.stringify(structuredBase), 'utf8');
  const structuredContent = { ...structuredBase, response_size_bytes: responseBytes };
  if (responseBytes >= TEXT_WARNING_BYTES) {
    structuredContent.response_size_warning = 'Large structured result; inspect selected fields or narrow the request before adding it to model context.';
  }
  return {
    content: [{ type: 'text', text: JSON.stringify(textSummary(structuredContent, responseBytes), null, 2) }],
    structuredContent,
    ...(isError ? { isError: true } : {}),
  };
}

function signalFromExtra(extra) {
  return extra && extra.mcpReq && extra.mcpReq.signal || extra && extra.signal;
}

module.exports = {
  outputSchema, registerEurekaTool, response, signalFromExtra, textSummary, TEXT_WARNING_BYTES,
  ENGINE_FREE_TOOLS, JOB_LIFECYCLE_TOOLS, ENGINE_REQUIREMENT, typedRefusal, engineRefusal, engineRootOrRefusal, classifyEngineStartError,
  routeGate, refusalFromEngineText, captureStartLine, startFailureRefusal, setProbeDeps, engineBusyRefusal, setBusyProbe,
  callOptions, isRequestTimeout, remainingMs, configuredDeadlineMs, engineTimeoutRefusal, CANCEL_DEADLINE_MS,
  CALL_DEADLINE_MIN_MS, CALL_DEADLINE_MAX_MS,
};
