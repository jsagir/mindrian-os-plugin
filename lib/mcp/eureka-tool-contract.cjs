'use strict';

const { z } = require('zod');
// Phase 387 plan 05: the engine location rule and the fixed sentences live in the resolver (Plan 387-03).
// This file only turns them into the typed refusal the tools return; it re-implements neither.
const resolver = require('../core/eureka/eureka-engine-resolver.cjs');

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
// The three job tools need an engine-started job. They answer from the in-process session table, so the
// gate skips them; their not-found answer carries the engine state instead (eureka-capability-jobs.cjs).
const JOB_LIFECYCLE_TOOLS = frozenSet(['eureka_capability_job_status', 'eureka_capability_job_result', 'eureka_capability_job_cancel']);

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

function registerEurekaTool(server, name, config, handler) {
  // The engine gate runs before the handler body, so the room projection never opens when the engine is not
  // present and a person with no engine learns that first, bound room or not.
  const gated = !ENGINE_FREE_TOOLS.has(name) && !JOB_LIFECYCLE_TOOLS.has(name);
  const wrapped = gated
    ? async (...handlerArgs) => {
      const refusal = engineRefusal(process.env);
      if (refusal) return response(refusal, true);
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
};
