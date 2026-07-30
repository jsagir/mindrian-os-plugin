#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 196-04 (PB8-04/05/08) -- the Part-8 runtime egress PreToolUse hook.
 * ==========================================================================
 * The classifier (lib/core/part8-egress-guard.cjs) is inert until the harness
 * fires it BEFORE the Brain MCP call and reads its exit code as the block. This
 * hook is that fire: it reads the PreToolUse payload on stdin, runs the pure
 * LOCAL classify(), and signals the harness by exit code.
 *
 * Signaling (clone of scripts/write-scope-check.cjs):
 *   exit 2 = BLOCK (harness cancels the outbound tool call), stderr carries why.
 *   exit 0 = ALLOW (proven MOVE-SET) OR fail-OPEN on any hook-INTERNAL error.
 *
 * Fail posture (A3 accepted risk, matches write-scope-check):
 *   - fail-OPEN (exit 0) on a parse / resolution error -- a false block is worse
 *     than a false allow for a safety hook.
 *   - fail-CLOSED (exit 2) ONLY on a real content hit.
 *
 * Part 8 (D-01): the hook opens NO Brain wire and makes NO network call at
 * classify time. The block is a harness exit code, not a dispatch protocol.
 * Part 8 (D-08a): Brain-less mode (isAvailable() false) skips any gate, LOCAL-
 * logs the ambiguous decision, and allows (exit 0) -- with no wire, nothing can
 * leak.
 *
 * Telemetry: record() is wrapped best-effort; a telemetry throw NEVER bricks a
 * Brain call.
 *
 * NO em-dashes anywhere (CLAUDE.md HARD RULE). Pure CJS, zero npm deps.
 *
 * License: BSL 1.1.
 */

const fs = require('node:fs');
const path = require('node:path');

const LIB_CORE = path.join(__dirname, '..', 'lib', 'core');
const GUARD_PATH = path.join(LIB_CORE, 'part8-egress-guard.cjs');
const ONTOLOGY_PATH = path.join(LIB_CORE, 'part8-egress-ontology.cjs');
const SANITIZER_PATH = path.join(LIB_CORE, 'brain-response-sanitize.cjs');
const BRAIN_CLIENT_PATH = path.join(LIB_CORE, 'brain-client.cjs');
const ROOM_DB_PATH = path.join(LIB_CORE, 'room-db.cjs');
const NAVIGATION_PATH = path.join(LIB_CORE, 'navigation.cjs');
// The F.1 gate lands in 196-05; require it DEFENSIVELY so this hook degrades
// gracefully until Wave 3.
const GATE_PATH = path.join(__dirname, '..', 'lib', 'hmi', 'part8-egress-gate.cjs');

// ---------------------------------------------------------------------------
// stdin read + exit signaling (clone write-scope-check.cjs:144-150, 174-179).
// ---------------------------------------------------------------------------

function readStdinSync() {
  try {
    return fs.readFileSync(0, 'utf8');
  } catch (_) {
    return '';
  }
}

function allow() { process.exit(0); }

function block(message) {
  process.stderr.write(message);
  if (!message.endsWith('\n')) process.stderr.write('\n');
  process.exit(2);
}

// ---------------------------------------------------------------------------
// Brain availability -- test seam PART8_FORCE_BRAIN_AVAILABLE ('1' available,
// '0' Brain-less) so the ambiguous branch is deterministically exercisable
// without a live Brain wire. Absent the override, fall back to the real
// brain-client.isAvailable() (key presence). Any failure -> false (safe: the
// Brain-less path is the no-leak path).
// ---------------------------------------------------------------------------
function brainAvailable() {
  const forced = process.env.PART8_FORCE_BRAIN_AVAILABLE;
  if (forced === '1') return true;
  if (forced === '0') return false;
  try {
    return !!require(BRAIN_CLIENT_PATH).isAvailable();
  } catch (_) {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Best-effort telemetry. Resolve the active room db, hand it to the ontology
// writer, and close it. EVERY step is wrapped -- a telemetry failure NEVER
// bricks a Brain call and NEVER changes the exit code.
// ---------------------------------------------------------------------------
function bestEffortRecord(verdictObj, sessionId) {
  let db = null;
  let roomDb = null;
  try {
    const navigation = require(NAVIGATION_PATH);
    const active = navigation.detectActiveRoom && navigation.detectActiveRoom();
    if (!active || !active.roomDir || !active.hasRoomDb) return;
    roomDb = require(ROOM_DB_PATH);
    db = roomDb.openRoomDb(active.roomDir);
    const ontology = require(ONTOLOGY_PATH);
    ontology.record(db, {
      verdict: verdictObj.verdict,
      class: verdictObj.class,
      matched_pattern: verdictObj.reason,
      count: 1,
      sessionId: sessionId,
    });
  } catch (_e) {
    // best-effort: swallow
  } finally {
    try {
      if (db && roomDb && roomDb.closeRoomDb) roomDb.closeRoomDb(db);
    } catch (_e) { /* ignore */ }
  }
}

// ---------------------------------------------------------------------------
// Main. Reads { tool_name, tool_input, session_id } (brain-response-sanitize-
// hook envelope), runs classify(), records best-effort, then branches on verdict.
// ---------------------------------------------------------------------------
function main() {
  const raw = readStdinSync();
  if (!raw || !raw.trim()) return allow();

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch (_) {
    return allow(); // fail-OPEN on garbage stdin (A3).
  }
  if (!payload || typeof payload !== 'object') return allow();

  const toolName = payload.tool_name;
  const toolInput = payload.tool_input;
  const sessionId = typeof payload.session_id === 'string' ? payload.session_id : undefined;

  // Defense-in-depth (Phase 239, BRAIN-01): the matcher scopes this hook to
  // the live Brain tool names in BOTH plugin scope
  // (mcp__plugin_mos_mindrian-brain__brain_*) and project scope
  // (mcp__mindrian-brain__brain_*). The in-hook re-check below derives from
  // the SAME exported BRAIN_TOOL_MATCHER the hooks.json matcher is asserted
  // equal to, so a matcher drift cannot leak the gate open (OQ-1 backstop).
  // The fail-OPEN posture on a failed require below is a deliberate accepted
  // risk (A3 / threat T6) this phase does NOT flip -- the complementary
  // fail-CLOSED belt lands in brain-client.cjs (sibling plan 239-05).
  try {
    const sanitizer = require(SANITIZER_PATH);
    if (!sanitizer.isBrainTool(toolName)) return allow();
  } catch (_) {
    // If the sanitizer cannot load, fail-OPEN (hook-internal error, A3).
    return allow();
  }

  let verdictObj;
  try {
    const guard = require(GUARD_PATH);
    verdictObj = guard.classify(toolInput, { toolName: toolName });
  } catch (_) {
    return allow(); // fail-OPEN on any classify resolution error (A3).
  }
  if (!verdictObj || typeof verdictObj !== 'object') return allow();

  // Best-effort telemetry BEFORE the exit branch (process.exit terminates).
  bestEffortRecord(verdictObj, sessionId);

  const verdict = verdictObj.verdict;
  const klass = verdictObj.class || 'unknown';
  const reason = verdictObj.reason || '';

  if (verdict === 'block') {
    return block(
      'Canon Part 8: outbound Brain payload carries CONTENT-SET (' + klass + '). Blocked. ' + reason
    );
  }

  if (verdict === 'ambiguous') {
    if (brainAvailable()) {
      // Brain available: render the Shape F.1 gate (Reformulate / Cancel; NO
      // send-anyway verb, honors D-01) then exit 2. The gate module lands in
      // 196-05; require it defensively and fall back to a minimal Part 8
      // ambiguous notice until then.
      let gateText = '';
      try {
        const gate = require(GATE_PATH);
        const render = gate.renderGate || gate.render || gate.default;
        if (typeof render === 'function') {
          const out = render({ tier: 'A', class: klass });
          gateText = typeof out === 'string' ? out : JSON.stringify(out);
        }
      } catch (_) {
        gateText = '';
      }
      if (gateText) {
        return block(gateText);
      }
      return block(
        'Canon Part 8: outbound Brain payload is ambiguous (' + klass + '). ' +
        'Reformulate to a generic methodology handle or Cancel. ' + reason
      );
    }
    // Brain-less (D-08a): no wire, nothing leaks. LOCAL-log already done above;
    // allow with no gate interruption.
    return allow();
  }

  // verdict === 'allow' (proven MOVE-SET) or any non-block/non-ambiguous value.
  return allow();
}

// Fail-OPEN outer wrap + uncaughtException backstop (clone write-scope-check
// :260-265). A false block is worse than a false allow for a safety hook.
process.on('uncaughtException', function () {
  process.exit(0);
});

try {
  main();
} catch (_) {
  process.exit(0);
}
