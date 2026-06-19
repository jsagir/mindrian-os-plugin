#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 88.1-16 -- query efficiency telemetry PostToolUse hook.
 * ==============================================================
 * ADVISORY, NEVER BLOCKING. Fires after Read|Grep|Glob tool calls. When the
 * tool call originated from a /mos:* slash-command context AND an active
 * MindrianRoom can be resolved, the hook:
 *
 *   1. Estimates tokens_used from the tool's returned payload (the envelope's
 *      tool_response.content field) via chars/4.
 *   2. Estimates tokens_naive_estimate as the total .md token count for the
 *      active room (session-cached per room path).
 *   3. Computes ratio = tokens_naive_estimate / tokens_used and appends one
 *      JSONL event to ~/.mindrian/telemetry/query-efficiency.jsonl with the
 *      8-field contract from PLAN <interfaces>.
 *   4. If classifyRatio(ratio) === 'warn' (< 10x), emits a one-line advisory
 *      systemMessage. Otherwise silent (normal path).
 *   5. ALWAYS exits 0. The hook is advisory; a Read/Grep/Glob tool call
 *      must never fail because of telemetry accounting.
 *
 * Hard invariants (audited via grep in verify block + tests):
 *   - No network surface. Grep the source for the Brain hostname or any
 *     remote URL scheme and the count must be zero. Telemetry is LOCAL
 *     under ~/.mindrian/ per Canon Part 8.
 *   - JSONL contains ONLY scalar integer counts + LOCAL slug + ISO timestamp.
 *     No file paths, no artifact content, no user strings that could egress.
 *     Canon Part 8 "only scalar counts" rule.
 *   - /mos:* context gate: if neither the envelope nor the env carries a
 *     slash-command signal, the hook exits silent with no JSONL write. This
 *     prevents instrumentation of unrelated Read/Grep/Glob calls (e.g. user
 *     inspecting a file inside Claude Code without an active /mos:* flow).
 *
 * /mos:* context detection strategy (priority order):
 *   (a) envelope has `slash_command` / `command_context` / `triggering_command`
 *       (string starting with '/mos:') - use directly. Future-proof for when
 *       Claude Code 2.1.x passes command context in the envelope.
 *   (b) process.env.CLAUDE_SLASH_COMMAND starts with '/mos:' - use.
 *   (c) process.env.MOS_COMMAND_CONTEXT starts with '/mos:' - our own
 *       forward-compatible env var for future plugin-side wiring.
 *   (d) short-circuit: none of the above -> silent no-op exit 0.
 *
 * Detection-path decision at plan time (2026-04-23):
 * Claude Code 2.1.x does not yet surface slash-command context in the
 * PostToolUse envelope per public docs. The hook therefore lands on branch
 * (b)/(c) in practice today; when Anthropic adds the envelope field, branch
 * (a) pre-empts without a code change. This is documented in the 88.1-16
 * SUMMARY <detection-path> section.
 *
 * Claude Code PostToolUse envelope (stdin JSON):
 *   { "tool_name": "Read"|"Grep"|"Glob",
 *     "tool_input": { ... },
 *     "tool_response": { "content": <string | array> },
 *     "slash_command"?: "/mos:..." }
 *
 * Stdout envelope (one-line JSON):
 *   { "additionalContext": null,
 *     "systemMessage": "<warn advisory>" | null,
 *     "suppressOutput": false }
 *
 * Canon:
 *   Part 6 Product-as-Venture -- the 57x efficiency claim is a venture
 *     claim; this hook is the measurement arm that defends it.
 *   Part 8 Graph Boundary -- telemetry stays LOCAL under ~/.mindrian/.
 *     No HTTP, no Brain endpoint, no artifact body bytes persisted.
 *
 * Three-surface compatibility: triggered by hooks.json on CLI; Desktop MCP
 * and Cowork share the same hooks.json bundle. No surface-specific code.
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

// ---------- Soft-fail envelope ----------
// v1.10.19 (hotfixes shipped 2026-04-26): Claude Code 2.x added `additionalProperties: false` to the
// hook output schema. Top-level `systemMessage` and `additionalContext` are no
// longer accepted -- they must be wrapped in `hookSpecificOutput`. Without
// this fix, every Read/Grep/Glob fires "Hook JSON output validation failed"
// in the user's terminal. See: https://docs.anthropic.com/en/docs/claude-code/hooks

function emitEnvelope(systemMessage) {
  if (!systemMessage) return; // silent exit -- never emit JSON when no message
  try {
    const payload = {
      hookSpecificOutput: {
        hookEventName: 'PostToolUse',
        additionalContext: String(systemMessage),
      },
    };
    process.stdout.write(JSON.stringify(payload) + '\n');
  } catch (_e) { /* best-effort */ }
}

function exitSilent() {
  // v1.10.19 (hotfixes shipped 2026-04-26): previously called emitEnvelope(null) which wrote an
  // invalid JSON envelope. Silent now means truly silent -- exit 0 with no
  // stdout output at all. Schema validation passes by emitting nothing.
  process.exit(0);
}

// ---------- Stdin ----------

function readStdinSync() {
  try {
    return fs.readFileSync(0, 'utf8');
  } catch (_e) {
    return '';
  }
}

// ---------- Envelope field extractors ----------

function extractToolName(payload) {
  if (!payload || typeof payload !== 'object') return null;
  if (typeof payload.tool_name === 'string') return payload.tool_name;
  if (typeof payload.tool === 'string') return payload.tool;
  return null;
}

/**
 * Extract the tool's returned payload string. Claude Code 2.1.x envelopes
 * place the Read/Grep/Glob result under tool_response.content; fall back to
 * tool_result.content and result.content for older shapes. Arrays are
 * joined because Read returns an array of text blocks; strings pass
 * through. Non-string / non-array leaves -> '' (caller records 0 tokens).
 */
function extractToolResponse(payload) {
  if (!payload || typeof payload !== 'object') return '';
  const candidates = [payload.tool_response, payload.tool_result, payload.result];
  for (const tr of candidates) {
    if (!tr || typeof tr !== 'object') continue;
    const content = tr.content;
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
      // Concatenate string-shaped elements (array of text blocks).
      let acc = '';
      for (const el of content) {
        if (typeof el === 'string') acc += el;
        else if (el && typeof el === 'object' && typeof el.text === 'string') {
          acc += el.text;
        }
      }
      return acc;
    }
    // Some envelopes just put the string directly under the response key.
    if (typeof tr === 'string') return tr;
  }
  // Last-ditch: stdout field (some matchers put the raw stream here).
  if (typeof payload.stdout === 'string') return payload.stdout;
  return '';
}

/**
 * Extract the /mos:* slash-command context. Returns the command string
 * (e.g. '/mos:whitespace') or null if no context is detected.
 *
 * Priority order matches PLAN <action>:
 *   (a) envelope.slash_command / command_context / triggering_command
 *   (b) process.env.CLAUDE_SLASH_COMMAND
 *   (c) process.env.MOS_COMMAND_CONTEXT
 */
function extractSlashCommand(payload) {
  const MOS_PREFIX = '/mos:';
  // (a) envelope fields
  const envCandidates = [
    payload && payload.slash_command,
    payload && payload.command_context,
    payload && payload.triggering_command,
  ];
  for (const v of envCandidates) {
    if (typeof v === 'string' && v.startsWith(MOS_PREFIX)) return v;
  }
  // (b) (c) env vars
  const envVars = [
    process.env.CLAUDE_SLASH_COMMAND,
    process.env.MOS_COMMAND_CONTEXT,
  ];
  for (const v of envVars) {
    if (typeof v === 'string' && v.startsWith(MOS_PREFIX)) return v;
  }
  return null;
}

// ---------- Room resolution ----------
//
// Two strategies:
//   1. Walk up from process.cwd() looking for .room-root sentinel (Phase
//      87-01a). This is the authoritative room-presence marker.
//   2. Fall back to MindrianRooms parent + active registry basename, but
//      only if the plugin resolve-room script can produce an answer
//      quickly (< 200ms). If either fails, the hook exits silent.

// Phase 169-02 (GDH-01): the inline .room-root walk-up is repointed at the ONE
// shared resolver (lib/core/room-root.cjs) so there is no duplicated walk-up.
// The shared resolver returns '' when no sentinel is found; this script's
// existing contract is null, so we coerce '' -> null at the boundary.
const { resolveRoomRoot: resolveRoomRootShared } = require(
  path.resolve(__dirname, '..', 'lib', 'core', 'room-root.cjs')
);

function findRoomRootFromCwd() {
  return resolveRoomRootShared(process.cwd()) || null;
}

function resolveRoomRoot() {
  // Primary: .room-root sentinel from cwd (via the shared resolver).
  const fromCwd = findRoomRootFromCwd();
  if (fromCwd) return fromCwd;

  // Fallback: resolve-room script. Wrapped in spawnSync with 1s timeout
  // so a hanging script never blocks the PostToolUse latency budget.
  try {
    const pluginRoot = path.resolve(__dirname, '..');
    const resolver = path.join(pluginRoot, 'scripts', 'resolve-room');
    if (!fs.existsSync(resolver)) return null;
    const res = spawnSync('bash', [resolver, process.cwd()], {
      encoding: 'utf8',
      timeout: 1000,
    });
    if (res.status !== 0) return null;
    const out = (res.stdout || '').trim();
    if (!out || !fs.existsSync(out)) return null;
    return out;
  } catch (_e) {
    return null;
  }
}

// ---------- JSONL writer ----------

function telemetryPath() {
  const home = process.env.HOME || os.homedir();
  if (!home) return null;
  return path.join(home, '.mindrian', 'telemetry', 'query-efficiency.jsonl');
}

/**
 * Append one event as a single JSONL line. Creates the parent directory
 * on first write. Soft-fails silently on any I/O error (the hook must
 * never block the tool call).
 *
 * Uses fs.appendFileSync: on Linux this maps to O_APPEND which is atomic
 * for single writes up to PIPE_BUF (4KB+); our event lines are well
 * under 1KB so we get atomicity for free without explicit locking.
 */
function appendEventAtomic(event) {
  const p = telemetryPath();
  if (!p) return false;
  try {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.appendFileSync(p, JSON.stringify(event) + '\n', { encoding: 'utf8' });
    return true;
  } catch (_e) {
    return false;
  }
}

// ---------- Main ----------

function main() {
  let raw;
  try {
    raw = readStdinSync();
    if (!raw || !raw.trim()) return exitSilent();
  } catch (_e) { return exitSilent(); }

  let payload;
  try { payload = JSON.parse(raw); }
  catch (_e) { return exitSilent(); }
  if (!payload || typeof payload !== 'object') return exitSilent();

  // Tool gate. hooks.json matcher already restricts to Read|Grep|Glob but
  // we defensively re-check for robustness against matcher drift.
  const tool = extractToolName(payload);
  if (!tool || !/^(Read|Grep|Glob)$/.test(tool)) return exitSilent();

  // /mos:* context detection. HARD-04 / D-01 (Phase 140-03): the gate is
  // RELAXED to measure ALL turns. We still extract the /mos: command handle
  // when present (so the aggregator can filter the published-claim population
  // to /mos: turns -- see scout-telemetry-aggregator.cjs --mos-only), but a
  // turn with NO /mos: context is no longer dropped: command is left null and
  // the line is still written. This closes the "logs 0 events" bug (nothing
  // in the repo sets the /mos: signal the old gate required).
  //
  // Canon Part 8 invariant preserved: we add NO new field and carry no user
  // strings; command is a generic /mos: handle or null, never user content.
  const command = extractSlashCommand(payload);

  // Resolve room. No room -> naive-estimate baseline undefined -> exit.
  const roomRoot = resolveRoomRoot();
  if (!roomRoot) return exitSilent();

  // Load the pure estimator + aggregation math.
  let estimator;
  try {
    estimator = require(path.resolve(__dirname, '..', 'lib', 'core', 'token-estimator.cjs'));
  } catch (_e) { return exitSilent(); }

  // Compute tokens_used from the tool response. Missing/empty -> 0, which
  // will divide into Infinity and be classified as 'normal' (not a leak
  // signal). We still emit the event so aggregation can observe it.
  const payloadStr = extractToolResponse(payload);
  const tokensUsed = estimator.estimateTokens(payloadStr);

  // Compute tokens_naive_estimate. null -> can't compute ratio -> exit.
  const tokensNaive = estimator.estimateRoomTokens(roomRoot);
  if (tokensNaive === null || typeof tokensNaive !== 'number') return exitSilent();

  // Ratio. Guard divide-by-zero: if tokens_used is 0, the query returned
  // literally nothing, so efficiency is undefined. Exit silent.
  if (tokensUsed <= 0) return exitSilent();
  const ratio = tokensNaive / tokensUsed;

  // Build the event per PLAN <interfaces>. Only scalar counts + a LOCAL
  // slug (basename of the room root) + the command handle reach the
  // JSONL. No artifact bytes, no file paths, no user strings.
  const roomSlug = path.basename(roomRoot);
  const event = {
    event: 'query.served',
    ts: new Date().toISOString(),
    // command is the /mos: handle when present, else '' for an all-turns
    // (no-/mos:-context) turn. We use '' rather than null so the 8-field
    // validateEventShape contract still holds (it rejects null fields) while
    // keeping the field scalar + present (Canon Part 8 -- no new field).
    command: command || '',
    tool: tool,
    tokens_used: tokensUsed,
    tokens_naive_estimate: tokensNaive,
    ratio: Math.round(ratio * 100) / 100, // 2 decimals for display friendliness
    room_slug: roomSlug,
  };

  // Validate before append. A malformed event must never pollute the JSONL.
  const shapeCheck = estimator.validateEventShape(event);
  if (!shapeCheck.valid) return exitSilent();

  appendEventAtomic(event);

  // Advisory classification.
  const cls = estimator.classifyRatio(ratio);
  if (cls === 'warn') {
    const pretty = event.ratio.toFixed(2);
    // For an all-turns turn (no /mos: context) the label is the tool name.
    const label = command || tool;
    const msg = 'query efficiency: ratio ' + pretty + 'x for ' + label +
      ' (below ' + estimator.BELOW_THRESHOLD_RATIO + 'x threshold)';
    emitEnvelope(msg);
    process.exit(0);
    return;
  }

  // Normal path: silent per Plan 03 reviewer R5 (no verification fatigue).
  return exitSilent();
}

// Outer try/catch is the soft-fail guarantee. An advisory hook must never
// crash the PostToolUse lifecycle or fail a user's Read/Grep/Glob call.
try { main(); }
catch (_e) { try { exitSilent(); } catch (_f) { process.exit(0); } }
