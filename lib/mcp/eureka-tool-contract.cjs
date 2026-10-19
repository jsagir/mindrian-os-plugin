'use strict';

const { z } = require('zod');

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
  persistence: z.string().optional(),
  response_size_bytes: z.number().int().nonnegative().optional(),
  response_size_warning: z.string().optional(),
}).passthrough();

function registerEurekaTool(server, name, config, handler) {
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
  }, handler);
}

const TEXT_WARNING_BYTES = 256 * 1024;

function textSummary(payload, responseBytes) {
  const summary = { ok: payload && payload.ok === true };
  for (const key of [
    'reason', 'message', 'capability_id', 'job_id', 'status', 'readiness',
    'scope_id', 'snapshot_id', 'partial', 'projection_complete',
    'projection_omissions', 'review_required', 'persistence', 'candidate_count',
    'result_count', 'response_size_bytes',
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
  const serialized = JSON.stringify(payload);
  const responseBytes = Buffer.byteLength(serialized, 'utf8');
  const structuredContent = {
    ...payload,
    review_required: payload && payload.review_required !== undefined ? payload.review_required : true,
    response_size_bytes: responseBytes,
  };
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

module.exports = { outputSchema, registerEurekaTool, response, signalFromExtra, textSummary, TEXT_WARNING_BYTES };
