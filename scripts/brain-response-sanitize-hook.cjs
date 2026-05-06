#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 117-04 -- PostToolUse hook on mcp__brain_* tool calls.
 *
 * Per SEED-003 A3 spec: scans + redacts accidental user-data echo via
 * hookSpecificOutput.updatedToolOutput before the response reaches the
 * model. Hook fires on PostToolUse for matcher 'mcp__brain_.*'.
 *
 * Reads stdin JSON {tool_name, tool_input, tool_response, session_id}.
 * Emits a hook envelope JSON on stdout and exits 0.
 *
 * ALWAYS exits 0; never blocks the tool call. Failure modes pass through
 * (defaults to continue-true with no updatedToolOutput) so a bug in the
 * sanitizer cannot stall the agent loop.
 */
'use strict';

const fs = require('node:fs');
const sanitizer = require('../lib/core/brain-response-sanitize.cjs');

/**
 * ENVELOPE_ALLOWED -- the keys we will pass through to stdout.
 * Per Claude Code hook envelope spec: drop unknown keys to keep the
 * envelope lean and to avoid surfacing accidental side-channel state.
 */
const ENVELOPE_ALLOWED = new Set([
  'decision', 'reason', 'continue', 'stopReason',
  'suppressOutput', 'systemMessage', 'hookSpecificOutput',
]);

function emitEnvelope(envelope) {
  const filtered = {};
  for (const k of Object.keys(envelope || {})) {
    if (ENVELOPE_ALLOWED.has(k)) filtered[k] = envelope[k];
  }
  if (filtered.continue === undefined) filtered.continue = true;
  process.stdout.write(JSON.stringify(filtered));
  process.exit(0);
}

function emitPassthrough() {
  emitEnvelope({ continue: true });
}

function readStdin() {
  try {
    const data = fs.readFileSync(0, 'utf8');
    if (!data) return {};
    return JSON.parse(data);
  } catch (_e) {
    return {};
  }
}

function main() {
  try {
    const input = readStdin();
    const toolName = String((input && input.tool_name) || '');
    if (!sanitizer.isBrainTool(toolName)) {
      // Passthrough for non-Brain tools.
      return emitPassthrough();
    }
    const envelope = sanitizer.buildEnvelope(toolName, input.tool_response);
    return emitEnvelope(envelope);
  } catch (_e) {
    return emitPassthrough();
  }
}

process.on('uncaughtException', function() {
  try { emitPassthrough(); } catch (_e) { /* swallow */ }
});

main();
