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
 * Quick task 260917-dgf (ambiguous-verdict disposition, trusted Brain scopes):
 * on a tool name `isBrainTool()` TRUSTS (plugin scope, project scope, the
 * canonical custom connector), an ambiguous verdict of class
 * `freeform_unmatched` or `unknown` now exits 0 and the call PROCEEDS to the
 * shim. `lib/core/brain-client.cjs::callTool` re-classifies the SAME args at
 * its single dispatch seam and attaches the additive
 * `egress_disclosure { verdict:'ambiguous', egress_class, reason, tool,
 * disposition:'proceeded' }`. Nothing becomes silent: the disclosure moves to
 * where it can actually be rendered, because a PreToolUse hook cannot render
 * the Shape F.1 card in the first place (the card JSON was landing on stderr
 * as an unreadable error string).
 *
 * Quick task 260917-ild (Codex finding F1, narrows the allow above): the
 * ambiguous branch's allow used `isBrainTool()`, which ALSO trusts
 * `mcp__pws-brain-mcp__*` -- a direct HTTPS connector with no local plugin
 * code anywhere in its path (`lib/mcp/brain-composition-census.cjs`'s
 * ruling). That route never reaches `bin/mindrian-brain-mcp-client.cjs`, so
 * `brain-client.cjs::callTool`'s second classification -- the one the
 * paragraph above depends on to keep nothing silent -- NEVER RUNS there, and
 * the allow was unearned. The ambiguous branch now consults
 * `isShimBackedBrainTool()` instead: only `mcp__mindrian-brain__*` (project
 * scope) and `mcp__plugin_mos_mindrian-brain__*` (plugin scope) provably
 * route through that single shim (`.mcp.json` registers exactly one Brain
 * server key, "mindrian-brain"). `isBrainTool` itself, `BRAIN_TOOL_MATCHER`,
 * `BRAIN_SHAPED_TOOL_MATCHER` and this file's step-1 default-deny scan are
 * byte-unchanged: this quick task NARROWS an allow and widens nothing. Every
 * scope that blocked before this quick task keeps blocking; the two
 * shim-backed scopes keep the allow the shim's own egress_disclosure already
 * justifies; `mcp__pws-brain-mcp__*` and `mcp__theo__*` return to exit 2 on
 * ambiguity.
 *
 * Fail posture (A3 accepted risk, matches write-scope-check):
 *   - fail-OPEN (exit 0) on a parse / resolution error -- a false block is worse
 *     than a false allow for a safety hook.
 *   - fail-CLOSED (exit 2) ONLY on a real content hit.
 *   - As of 260917-ild: the hook no longer converts a proven-harmless
 *     ambiguity into a block on a SHIM-BACKED scope. It still does for every
 *     other Brain-shaped key, including the direct connector
 *     (`mcp__pws-brain-mcp__*`) and untrusted keys (`mcp__theo__brain_ask`
 *     and friends): none of those has a second enforcement point behind it,
 *     so the hook's block stays exactly as strict as before this quick task.
 *     Fail-CLOSED is unchanged for: `content_set` on any scope,
 *     `unproven_packet` on any scope, and any ambiguous verdict on a
 *     non-shim-backed Brain-shaped key.
 *
 * Part 8 (D-01): the hook opens NO Brain wire and makes NO network call at
 * classify time. The block is a harness exit code, not a dispatch protocol.
 * Part 8 (D-08a): Brain-less mode (isAvailable() false) skips any gate, LOCAL-
 * logs the ambiguous decision, and allows (exit 0) -- with no wire, nothing can
 * leak.
 *
 * The canon argument (260917-dgf, narrowed by 260917-ild / Codex F1),
 * compressed: step 1's default-deny scan is byte-unchanged -- nothing here
 * touches lib/core/part8-egress-guard.cjs, and a CONTENT-SET payload still
 * blocks on every scope. Step 3's methodology-vocabulary test protects
 * nothing on its own -- a trailing `// framework` comment already defeats it
 * (documented at lib/core/part8-egress-guard.cjs::_isFreeFormTool). The
 * allow now covers only scopes with a second enforcement point behind them
 * (the two shim-backed scopes; `isShimBackedBrainTool`), so allowing the
 * hook's exit does not make the call silent -- the shim still classifies
 * every call that reaches it. Every other Brain-shaped name, including
 * `mcp__pws-brain-mcp__*` (the direct HTTPS connector, no second
 * classification behind it) and `mcp__theo__*`, keeps exit 2 on ambiguity,
 * because none of them ever reaches the shim's second classification.
 * Tri-Polar note: Claude Desktop resolves the plugin scope through that same
 * shim -- no PreToolUse hook fires there, every plugin-scoped brain_* call
 * goes straight to `bin/mindrian-brain-mcp-client.cjs`, and the shim
 * discloses and proceeds -- so this change aligns the CLI to shipped Desktop
 * behavior instead of inventing a third policy. Cowork follows the CLI hook
 * path and is aligned by the same edit.
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
// Quick task 260917-dgf, narrowed by 260917-ild (Codex F1) -- the classes an
// ambiguous verdict is allowed to carry through on a SHIM-BACKED Brain scope
// (isShimBackedBrainTool() true: project scope, plugin scope -- the two
// tool-name shapes that provably route through
// bin/mindrian-brain-mcp-client.cjs into brain-client.cjs::callTool).
// `unproven_packet` is DELIBERATELY excluded: a typed packet that failed
// proof is a structure, not a free-form string, and widening to it would be
// a different decision with a different argument than the one this quick
// task makes. Both classes are minted at
// lib/core/part8-egress-guard.cjs::classify().
// ---------------------------------------------------------------------------
// 354-06 (D-354-EGR): 'freeform_unproven' joins the set. On a shim-backed
// scope the call proceeds to bin/mindrian-brain-mcp-client.cjs, whose
// ask()/search() (lib/core/brain-client.cjs::_typedFreeformGate, Task 3)
// refuse it with the renderable egress_blocked envelope BEFORE any wire
// call -- a PreToolUse hook cannot render that refusal itself (260917-dgf).
// Every non-shim Brain-shaped scope keeps exit 2 on this class, unchanged.
const SHIM_BACKED_AMBIGUOUS_ALLOW_CLASSES = Object.freeze(new Set(['freeform_unmatched', 'unknown', 'freeform_unproven']));

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

  // Defense-in-depth (Phase 239, BRAIN-01; widened by quick task 260906-gr1):
  // the in-hook re-check below derives from BRAIN_SHAPED_TOOL_MATCHER, not
  // BRAIN_TOOL_MATCHER. The widened scope is what lets a non-canonical
  // connector key such as `theo` (mcp__theo__brain_ask) reach classify() at
  // all -- before this change, `isBrainTool` matched neither the plugin
  // scope (mcp__plugin_mos_mindrian-brain__brain_*), the project scope
  // (mcp__mindrian-brain__brain_*), nor the canonical custom-connector name
  // (mcp__pws-brain-mcp__brain_*), so a theo-keyed call took the
  // unconditional allow() below and got ZERO Part 8 enforcement. Being in
  // scope here means the payload gets INSPECTED by classify(), never that
  // the connector is TRUSTED: isBrainTool (the trust predicate) is
  // byte-unchanged, so no foreign key gains an allow it had not earned.
  // The fail-OPEN posture on a failed require below is a deliberate accepted
  // risk (A3 / threat T6) this phase does NOT flip -- the complementary
  // fail-CLOSED belt lands in brain-client.cjs (sibling plan 239-05).
  //
  // Quick task 260917-dgf: `sanitizer` is hoisted to a function-scoped
  // variable (declared before this try) so it is still reachable further
  // down in the ambiguous branch, where the TRUST predicate (isBrainTool)
  // is consulted. The INSPECTION scope gate below (isBrainShapedTool) is
  // byte-unchanged.
  let sanitizer = null;
  try {
    sanitizer = require(SANITIZER_PATH);
    if (!sanitizer.isBrainShapedTool(toolName)) return allow();
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
    // Quick task 260917-dgf, narrowed by 260917-ild (Codex F1). Placement is
    // load-bearing: this sits BEFORE the brainAvailable() test below so the
    // policy reads as "shim-backed scope, free-form ambiguity, hand it to
    // the shim" -- not as an accident of the Brain-less branch -- and it
    // sits AFTER bestEffortRecord above, which stays exactly where it is so
    // telemetry still records every verdict, including the allowed ones.
    // Everything below this block is byte-unchanged: the block branch, the
    // F.1 gate render attempt, the minimal-notice fallback, the Brain-less
    // allow, the final allow, the fail-OPEN wraps.
    //
    // The route bit is computed defensively: a predicate throw degrades to
    // NOT-shim-backed, which keeps the block, never the allow (T-dgf-04,
    // T-ild-01). isShimBackedBrainTool is the ROUTE predicate (does this
    // scope provably reach bin/mindrian-brain-mcp-client.cjs), narrower than
    // isBrainTool (the TRUST predicate, unchanged, still used elsewhere).
    let shimBacked = false;
    try {
      shimBacked = !!(sanitizer && sanitizer.isShimBackedBrainTool(toolName));
    } catch (_) {
      shimBacked = false;
    }
    if (shimBacked && SHIM_BACKED_AMBIGUOUS_ALLOW_CLASSES.has(klass)) {
      return allow();
    }

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
