#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 117-04 -- PostToolUse hook on the live Brain MCP tool calls.
 *
 * Per SEED-003 A3 spec: scans + redacts accidental user-data echo via
 * hookSpecificOutput.updatedToolOutput before the response reaches the
 * model. Phase 239 (BRAIN-01): the matcher scopes this hook to the live
 * registered Brain tool names in both plugin scope
 * (mcp__plugin_mos_mindrian-brain__brain_*) and project scope
 * (mcp__mindrian-brain__brain_*); the superseded dead literal 'mcp__brain_.*'
 * never matched a live name once the Brain server shipped inside the "mos"
 * plugin. The in-hook isBrainTool re-check below derives from the SAME
 * exported BRAIN_TOOL_MATCHER the hooks.json matcher is asserted equal to.
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
const path = require('node:path');
const sanitizer = require('../lib/core/brain-response-sanitize.cjs');

// Phase 117-05 telemetry: emit auto_explore_sanitizer_hit when sanitize()
// modifies input. Lazy require to keep hook fast when no Brain tool fires.
let _agentRef;
function _getAgent() {
  if (_agentRef !== undefined) return _agentRef;
  try { _agentRef = require('../lib/agents/auto-explore-agent.cjs'); }
  catch (_e) { _agentRef = null; }
  return _agentRef;
}

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
    // Phase 117-05 telemetry: detect redactions BEFORE building envelope so
    // we can emit one auto_explore_sanitizer_hit per matched pattern.
    //
    // Quick task 260807-h5s (defect A1): this read used to be
    // `input.tool_response.text` and nothing else. MCP tool results carry an
    // ARRAY of content blocks under `.content`, not a bare `.text`, so the old
    // read produced undefined on every live Brain call, text became '', and the
    // ENTIRE Brain response was silently blanked before it reached the model.
    // extractResponseText is the shared seam both this hook and buildEnvelope
    // read through, so the defect cannot re-diverge across the two files.
    const text = sanitizer.extractResponseText(input.tool_response);
    const detailed = sanitizer.sanitizeDetailed(text);
    if (detailed && detailed.redactions) {
      const agent = _getAgent();
      if (agent && typeof agent.emitSanitizerHit === 'function') {
        // Resolve roomDir from cwd; if no .room-root chain present the agent
        // emit helper falls back to graceful no-op (telemetry path is JSONL
        // primary at ~/.mindrian/telemetry/selector.jsonl per Phase 88.2-03).
        const roomDir = (function () {
          let cur = process.cwd();
          const root = path.parse(cur).root;
          let hops = 0;
          while (cur && cur !== root && hops < 12) {
            try { if (fs.existsSync(path.join(cur, '.room-root'))) return cur; } catch (_e) { /* ignore */ }
            cur = path.dirname(cur);
            hops += 1;
          }
          return process.cwd();
        })();
        for (const patName of Object.keys(detailed.redactions)) {
          const count = Number(detailed.redactions[patName]) || 0;
          if (count > 0) {
            try {
              agent.emitSanitizerHit(roomDir, {
                tool_name: toolName,
                pattern_name: patName,
                redaction_count: count,
              });
            } catch (_e) { /* never throw */ }
          }
        }
      }
    }
    // Build envelope with sanitized text (re-use sanitized output from detailed).
    //
    // Quick task 260807-h5s (defect A2): updatedToolOutput MUST be an ARRAY of
    // content blocks, never the bare object this used to emit. The client-side
    // length reducer walks the value with a reduce over content blocks, so a
    // bare object has no reduce method and the user sees the raw
    // "e.reduce is not a function" error instead of their Brain answer. The key
    // name stays `updatedToolOutput`: the Claude Code binary describes
    // `updatedMCPToolOutput` as MCP-only while telling callers to prefer
    // `updatedToolOutput`.
    const envelope = {
      continue: true,
      hookSpecificOutput: {
        hookEventName: 'PostToolUse',
        updatedToolOutput: [
          {
            type: 'text',
            text: (detailed && typeof detailed.text === 'string') ? detailed.text : sanitizer.sanitize(text),
          },
        ],
      },
    };
    return emitEnvelope(envelope);
  } catch (_e) {
    return emitPassthrough();
  }
}

process.on('uncaughtException', function() {
  try { emitPassthrough(); } catch (_e) { /* swallow */ }
});

main();
