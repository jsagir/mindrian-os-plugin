#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 121-03 Task 3 -- command_invocation PostToolUse hook (D-09 surface 3).
 *
 * Fires from hooks/hooks.json PostToolUse on every SlashCommand-like tool
 * call. Filters at the script level for /mos:* invocations and emits ONE
 * command_invocation row per matched call via writer.emit() (Canon Part 9
 * chokepoint).
 *
 * D-09 drowning protection: this is the broad-sweep surface -- 100%
 * sampling of /mos:* invocations. Consumers (SEED-002 ingestion +
 * hooked-rescore-117 + future analyses) MUST filter by event type to avoid
 * drowning the high-signal selector_pick / tension_engagement /
 * breakthrough_dismissed events. The type discriminator IS the protection;
 * no per-row sampling is applied at write time.
 *
 * Hook env contract (set by Claude Code PostToolUse runtime):
 *   CLAUDE_TOOL_COMMAND      slash command name (e.g. '/mos:scout')
 *   CLAUDE_TOOL_OUTCOME      'success' | 'error' | 'cancelled' (or 'aborted')
 *   CLAUDE_TOOL_DURATION_MS  integer ms; defaults to 0 if absent
 *   CLAUDE_SESSION_ID        session id (used for context_hash material)
 *   PWD                      cwd (used for context_hash material)
 *
 * Best-effort: any internal error exits 0 so the user's flow is never
 * blocked. process.exit(0) is the universal terminal action.
 *
 * Pure CJS, node built-ins + lib/core/telemetry/writer.cjs. Zero new runtime deps.
 */

const path = require('node:path');
const crypto = require('node:crypto');
const REPO = path.resolve(__dirname, '..');
const telemetry = require(path.join(REPO, 'lib/core/telemetry/writer.cjs'));

function sha256(s) {
  return crypto.createHash('sha256').update(String(s || '')).digest('hex');
}

/**
 * processInvocation -- pure logic, no process.exit. Returns 'emitted' or
 * 'skipped' so tests can assert without the script terminating the runtime.
 * Always swallows errors.
 *
 * @returns {'emitted'|'skipped'}
 */
function processInvocation() {
  try {
    const command = String(process.env.CLAUDE_TOOL_COMMAND || '').slice(0, 64);

    // Filter: only /mos:* invocations land in telemetry. Non-/mos: tools
    // (Read / Edit / Bash / etc.) are covered by other PostToolUse hooks
    // (operator-update, query-efficiency-telemetry, etc.) and do not
    // belong in the command_invocation broad-sweep bucket.
    if (!/^\/mos:/.test(command)) {
      return 'skipped';
    }

    // outcome enum normalization. ALLOWED_FIELDS.command_invocation outcome
    // closed-set is 'success' | 'error' | 'aborted' (per schema.cjs), so we
    // coerce 'cancelled' to 'aborted'. Anything outside the set falls back
    // to 'success' (defensive: never reject a row over an enum mismatch).
    const outcomeRaw = String(process.env.CLAUDE_TOOL_OUTCOME || 'success').toLowerCase();
    let outcome = 'success';
    if (outcomeRaw === 'success' || outcomeRaw === 'error' || outcomeRaw === 'aborted') {
      outcome = outcomeRaw;
    } else if (outcomeRaw === 'cancelled') {
      outcome = 'aborted';
    }

    const durationRaw = process.env.CLAUDE_TOOL_DURATION_MS;
    let durationMs = 0;
    if (durationRaw !== undefined && durationRaw !== '') {
      const parsed = parseInt(durationRaw, 10);
      if (Number.isFinite(parsed) && parsed >= 0) {
        durationMs = parsed;
      }
    }

    // context_hash material: cwd + session id. Sliced to 16 chars
    // (MAX_CONTEXT_HASH_LEN) per schema.cjs convention for context_hash
    // fields. Per Canon Part 8: no raw paths flow into telemetry; the
    // sha256 + slice ensures only an opaque 16-char hex identifier lands.
    const contextSource = String(process.env.PWD || '') + '|' + String(process.env.CLAUDE_SESSION_ID || '');
    const contextHash = sha256(contextSource).slice(0, 16);

    telemetry.emit('command_invocation', {
      command: command,
      outcome: outcome,
      duration_ms: durationMs,
      context_hash: contextHash,
    });
    return 'emitted';
  } catch (_e) {
    // Best-effort. PostToolUse hook MUST NOT crash the user's flow. Any
    // internal error (validator rejection, env edge case, disk error)
    // swallows silently. Telemetry is a lab-side concern (per D-12), not
    // a runtime contract.
    return 'skipped';
  }
}

/**
 * main -- CLI entry. Tests call processInvocation() directly. The CLI path
 * always exits 0 because PostToolUse hook failures must never break the
 * user's flow.
 */
function main() {
  processInvocation();
  process.exit(0);
}

if (require.main === module) {
  main();
}

module.exports = { main: main, processInvocation: processInvocation };
