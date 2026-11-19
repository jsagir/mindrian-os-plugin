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
 *   exit 0 = ALLOW (proven MOVE-SET), or no tool input to inspect (plan 386-30:
 *            a hook-INTERNAL error after the input was read now exits 2).
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
 * ambiguous branch's allow used `isBrainTool()`, which at that time ALSO
 * trusted the direct HTTPS connector key of the Memgraph era (retired since
 * Phase 392 plan 06, D-08, 2026-11-08) -- a connector with no local plugin
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
 * justifies; every other Brain-shaped route (`mcp__theo__*`,
 * `mcp__theo-context__*`, the claude.ai Theo connectors, a legacy direct
 * connector's brain_* calls) returns to exit 2 on ambiguity.
 *
 * Phase 392 plan 06 (F6 bypass 5, D-08, 2026-11-08): the hook matcher and
 * `isBrainShapedTool()` now see EVERY Theo route Claude Code can call, in
 * both cases of the known connector literals, and the guard reads
 * `data/theo-tool-classes.json`: an operational Theo tool (room_bind,
 * graph_write, gate_*, chain_run and the rest) is allowed by class without a
 * scan (class operational_tool, recorded in telemetry); a content tool is
 * scanned by its typed arm or the generic content arm. The Memgraph-era
 * direct connector key is retired from every matcher; every Brain route is
 * mindrian-brain or a Theo server.
 *
 * Phase 392 plan 11 (P5, 392-SC5, F8, 2026-11-09): the lexicon check is
 * session-owned. The hook hands `session_id` to
 * `part8-room-lexicon.cjs::resolveLexiconRoom({sessionId, requireOwnership:
 * true})`, which resolves THIS session's bound room through
 * `resolveSessionRoom` (the binding file under .rooms/sessions). An unbound
 * session has an empty lexicon and is allowed; a corrupt binding, a resolver
 * throw or a bound room whose room.db cannot be read is `unavailable`, and the
 * guard blocks every payload kind with `room_check_unavailable`. Two sessions
 * bound to different rooms never share a lexicon. Without a session id the
 * check runs against the machine-global active room (today's behaviour) and
 * the verdict says so (`lexicon_scope: machine_global`). Telemetry lands in
 * the resolved room only, with `lexicon_scope` on the row. With
 * MINDRIAN_PART8_DEBUG set the hook writes one stderr line, "part8 session:
 * present|absent; lexicon_scope: session|machine_global", never the id.
 *
 * Fail posture (plan 386-30, owner decision of plan 386-29, 2026-11-06; this
 * REVERSES the earlier A3 accepted risk and threat T6 of Phase 239):
 *   - fail-CLOSED (exit 2, reason guard_unavailable) when the sanitizer or the
 *     guard cannot load, classify throws, the verdict is not an object, or the
 *     hook fails after it read a Brain-shaped tool input. Each outage writes
 *     one count-only line (lib/core/part8-outage-log.cjs). A provably empty
 *     payload (a plain object with no keys) still proceeds, because zero bytes
 *     cannot leak.
 *   - fail-OPEN (exit 0) stays for empty or unparsable stdin and for a tool
 *     name that is not Brain-shaped: there is no tool input to inspect.
 *   - fail-CLOSED (exit 2) also on a real content hit.
 *   - As of 260917-ild: the hook no longer converts a proven-harmless
 *     ambiguity into a block on a SHIM-BACKED scope. It still does for every
 *     other Brain-shaped key, the untrusted Theo routes (`mcp__theo__*`,
 *     `mcp__theo-context__*`, the claude.ai connectors) and a legacy direct
 *     connector's brain_* calls: none of those has a second enforcement point behind it,
 *     so the hook's block stays exactly as strict as before this quick task.
 *     Fail-CLOSED is unchanged for: `content_set` on any scope,
 *     `unproven_packet` on any scope, and any ambiguous verdict on a
 *     non-shim-backed Brain-shaped key.
 *
 * Plan 386-27 (option-e, owner decision of plan 386-26, 2026-11-06): the
 * 260917-dgf allow above no longer covers an ambiguous payload that carries an
 * edge or a body string (classifyShape of lib/core/part8-sprout-shape.cjs, any
 * depth, the cypher key of brain_query excepted). On a shim-backed scope with
 * Brain available that call exits 2 with the constant split guide of
 * lib/core/part8-split-route.cjs (reason sprouts_required, 5 steps, no payload
 * byte). A guard verdict block with the class sprouts_required exits 2 with the
 * same text on every scope. A sprout-only ambiguous payload keeps the allow,
 * Brain-less mode keeps the allow, the direct connector keeps its block.
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
 * every call that reaches it. Every other Brain-shaped name (`mcp__theo__*`,
 * `mcp__theo-context__*`, the claude.ai connectors, a legacy direct
 * connector's brain_* calls; no second classification behind any of them)
 * keeps exit 2 on ambiguity,
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

// Quick 261118-q35 (owner ruling 2026-11-18, V6 hook budget): the Node
// module compile cache (Node 22.1 and later; the floor here is 22.18) keeps
// the compiled code of the guard, the sanitizer and the telemetry modules on
// disk, so each spawn of this hook compiles less. Speed only: no check, no
// verdict and no exit path changes. A failure or an older runtime leaves the
// cache off; NODE_DISABLE_COMPILE_CACHE=1 turns it off by hand.
try {
  const nodeModule = require('node:module');
  if (typeof nodeModule.enableCompileCache === 'function') nodeModule.enableCompileCache();
} catch (_) { /* the cache is optional */ }
const fs = require('node:fs');
const path = require('node:path');

const LIB_CORE = path.join(__dirname, '..', 'lib', 'core');
const GUARD_PATH = path.join(LIB_CORE, 'part8-egress-guard.cjs');
const LEXICON_PATH = path.join(LIB_CORE, 'part8-room-lexicon.cjs');
const TELEMETRY_QUEUE_PATH = path.join(LIB_CORE, 'part8-egress-telemetry-queue.cjs');
const SANITIZER_PATH = path.join(LIB_CORE, 'brain-response-sanitize.cjs');
const BRAIN_CLIENT_PATH = path.join(LIB_CORE, 'brain-client.cjs');
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
// Plan 386-30 (E-FAIL, owner decision plan 386-29, 2026-11-06): the guard
// cannot run. Record one count-only outage line (tool name class and failure
// mode, never a payload byte), then block with the typed reason. A provably
// empty payload (a plain object with no keys) carries zero bytes, so it
// proceeds; the line is written for it too. The empty check does not depend on
// the guard. The log module has Node built-ins only and is required lazily, so
// a healthy run loads nothing new. A failing log write never changes the exit.
// ---------------------------------------------------------------------------
const OUTAGE_LOG_PATH = path.join(LIB_CORE, 'part8-outage-log.cjs');

// Plan 386-27: the sprouts_required message and the shape test come from
// lib/core/part8-split-route.cjs (plan 386-42). Required lazily, on the paths
// that need them, so a healthy allow loads nothing new. If the module cannot
// load, the hook fails closed with the plain reason (it never allows).
const SPLIT_ROUTE_PATH = path.join(LIB_CORE, 'part8-split-route.cjs');

function splitRouteMessage() {
  try {
    return require(SPLIT_ROUTE_PATH).refusalMessage();
  } catch (_) {
    return 'Canon Part 8: this call carries text that must stay in the room (reason sprouts_required). Nothing was sent.';
  }
}

// Plan 395-13 (owner ruling 37, "cut the paste, send the rest"). The refusal
// for a Brain route with no shim behind it: nothing is sent, and the message
// gives the cut input to send once more. The cut input is the question with
// each pasted span replaced by the note; it holds no pasted byte, and the
// guard already allowed it. A shim-backed route needs no resend: the shim cuts
// the same spans before any wire call (lib/core/brain-client.cjs).
function pasteResendMessage(cutInput) {
  return 'Canon Part 8: pasted text (a quote, a block quote or a code block) stays on this machine (reason pasted_text). Nothing was sent. ' +
    'Send the call 1 more time with exactly this input; the note in square brackets marks the pasted text: ' + JSON.stringify(cutInput) +
    ' Write a method name without quote marks.';
}

// Plan 395-13 review WR-06: the paste branch lets a call go on with the
// uncut input only on this plugin's own shim, never on a name match alone.
// The project or user scope name mcp__mindrian-brain__* can belong to a
// user-level entry that shadows the shim, and any plugin can name a server
// mindrian-brain. So the route goes on only when (1) the tool name is the
// plugin scope of THIS plugin (the name in .claude-plugin/plugin.json), (2)
// this plugin's .mcp.json registers mindrian-brain with the shim script, and
// (3) the shim script exists. Any other Brain route gets exit 2 with the cut
// input to send 1 more time. A read or parse failure answers false.
const PLUGIN_ROOT = path.join(__dirname, '..');
const SHIM_SCRIPT = path.join(__dirname, 'mindrian-brain-mcp-client.cjs');

function ownPluginShimRoute(toolName, sanitizer) {
  try {
    if (!(sanitizer && sanitizer.isShimBackedBrainTool(toolName))) return false;
    const name = JSON.parse(fs.readFileSync(path.join(PLUGIN_ROOT, '.claude-plugin', 'plugin.json'), 'utf8')).name;
    if (typeof name !== 'string' || !/^[a-z0-9_-]+$/.test(name)) return false;
    if (toolName.indexOf('mcp__plugin_' + name + '_mindrian-brain__') !== 0) return false;
    const mcp = JSON.parse(fs.readFileSync(path.join(PLUGIN_ROOT, '.mcp.json'), 'utf8'));
    const entry = mcp && mcp.mcpServers && mcp.mcpServers['mindrian-brain'];
    const args = entry && Array.isArray(entry.args) ? entry.args : [];
    const registered = args.some(function (a) { return typeof a === 'string' && /(?:^|[\\/])scripts[\\/]mindrian-brain-mcp-client\.cjs$/.test(a); });
    return registered && fs.existsSync(SHIM_SCRIPT);
  } catch (_) {
    return false;
  }
}

function carriesEdgeOrBody(toolName, toolInput) {
  try {
    return require(SPLIT_ROUTE_PATH).carriesEdgeOrBody(toolName, toolInput) !== false;
  } catch (_) {
    return true;
  }
}

// Set once the tool input is read and the tool is Brain-shaped.
let armed = null;

function isProvablyEmptyPayload(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  if (Object.getPrototypeOf(value) !== Object.prototype) return false;
  return Object.keys(value).length === 0;
}

function guardUnavailable(toolName, toolInput, mode) {
  try {
    require(OUTAGE_LOG_PATH).recordGuardOutage(typeof toolName === 'string' ? toolName : '', mode);
  } catch (_) {
    // A failing log never changes a verdict.
  }
  if (isProvablyEmptyPayload(toolInput)) return allow();
  return block('Canon Part 8: the egress guard could not run (reason guard_unavailable). Nothing was sent.');
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
// Best-effort telemetry. Plan 392-11 (P5): the row lands in the room the
// lexicon check resolved (the session's room when a session id exists, the
// machine-global active room otherwise), with lexicon_scope on it. Quick
// 261118-vbv: the hook only appends one small line to the room-local queue
// (lib/core/part8-egress-telemetry-queue.cjs enqueue) and opens no db. The
// Stop drain (scripts/part8-egress-telemetry-drain.cjs) writes the row through
// part8-egress-ontology, which routes every write through navigation.cjs.
// Nothing is queued for an unbound session (no room) or an unavailable one
// (no db to write), and nothing when room.db does not exist, so telemetry
// never mints a database. The verdict never waits on and never depends on the
// record: EVERY step is wrapped -- a telemetry failure NEVER bricks a Brain
// call and NEVER changes the exit code.
// ---------------------------------------------------------------------------
function bestEffortRecord(verdictObj, sessionId, resolvedRoom) {
  try {
    if (!resolvedRoom || resolvedRoom.status !== 'bound' || typeof resolvedRoom.roomDir !== 'string') return;
    if (!fs.existsSync(path.join(resolvedRoom.roomDir, '.mindrian', 'room.db'))) return;
    require(TELEMETRY_QUEUE_PATH).enqueue(resolvedRoom.roomDir, {
      verdict: verdictObj.verdict,
      class: verdictObj.class,
      matched_pattern: verdictObj.reason,
      sessionId: sessionId,
      lexicon_scope: resolvedRoom.lexicon_scope,
    });
  } catch (_e) {
    // best-effort: swallow
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
  // (mcp__mindrian-brain__brain_*), nor the custom-connector key of that
  // time (retired since Phase 392 plan 06, D-08), so a theo-keyed call took the
  // unconditional allow() below and got ZERO Part 8 enforcement. Being in
  // scope here means the payload gets INSPECTED by classify(), never that
  // the connector is TRUSTED: isBrainTool (the trust predicate) is
  // byte-unchanged, so no foreign key gains an allow it had not earned.
  // The fail-OPEN posture on a failed require below was a deliberate accepted
  // risk (A3 / threat T6). Plan 386-30 reversed it: a guard that cannot run now
  // blocks with the typed reason guard_unavailable (see guardUnavailable()).
  //
  // Quick task 260917-dgf: `sanitizer` is hoisted to a function-scoped
  // variable (declared before this try) so it is still reachable further
  // down in the ambiguous branch, where the TRUST predicate (isBrainTool)
  // is consulted. The INSPECTION scope gate below (isBrainShapedTool) is
  // byte-unchanged.
  let sanitizer = null;
  let brainShaped = false;
  try {
    sanitizer = require(SANITIZER_PATH);
    brainShaped = !!sanitizer.isBrainShapedTool(toolName);
  } catch (_) {
    // Plan 386-30: the sanitizer cannot load, so the hook cannot tell whether
    // the tool is Brain-shaped. The hook matcher registers only Brain-shaped
    // names, so fail CLOSED with the typed reason (a provably empty payload
    // still proceeds).
    return guardUnavailable(toolName, toolInput, 'sanitizer_load_failed');
  }
  if (!brainShaped) return allow();
  // From here a failure of the hook itself must block (uncaught handler below).
  armed = { toolName: toolName, toolInput: toolInput };

  let verdictObj;
  let guard;
  let resolvedRoom = null;
  try {
    guard = require(GUARD_PATH);
  } catch (_) {
    return guardUnavailable(toolName, toolInput, 'guard_load_failed');
  }
  try {
    // Phase 369.2 Plan 01 (CODE-07, J4): the hook asks the same Theo verdict
    // the in-process verbs ask. The bound room is resolved through the one
    // shared resolver (never the payload cwd directly) and its lexicon is
    // read from room.db rows only, inside this hook's 2000 ms budget.
    // Phase 392 plan 11 (P5): the room is THIS session's room
    // (resolveSessionRoom through resolveLexiconRoom with requireOwnership),
    // the machine-global active room only when the payload carries no
    // session_id. A resolver throw is "unavailable" and blocks; it is never
    // an empty lexicon.
    const scopeIfThrown = sessionId ? 'session' : 'machine_global';
    try {
      resolvedRoom = require(LEXICON_PATH).resolveLexiconRoom({ sessionId: sessionId || null, requireOwnership: true });
    } catch (_) {
      resolvedRoom = null;
    }
    if (!resolvedRoom || typeof resolvedRoom !== 'object' || typeof resolvedRoom.status !== 'string') {
      resolvedRoom = { status: 'unavailable', roomDir: null, reason: 'resolver_error', lexicon_scope: scopeIfThrown };
    }
    if (process.env.MINDRIAN_PART8_DEBUG) {
      // The F8 probe (392-CONTEXT.md): presence and scope only, never the id.
      process.stderr.write('part8 session: ' + (sessionId ? 'present' : 'absent') + '; lexicon_scope: ' + resolvedRoom.lexicon_scope + '\n');
    }
    verdictObj = guard.classify(toolInput, {
      toolName: toolName,
      roomDir: resolvedRoom.status === 'bound' ? resolvedRoom.roomDir : null,
      roomStatus: resolvedRoom.status,
      lexiconScope: resolvedRoom.lexicon_scope,
    });
  } catch (_) {
    return guardUnavailable(toolName, toolInput, 'classify_threw');
  }
  if (!verdictObj || typeof verdictObj !== 'object') {
    return guardUnavailable(toolName, toolInput, 'verdict_invalid');
  }

  // Best-effort telemetry BEFORE each exit (process.exit terminates). Plan
  // 395-13 review IN-02: it records the final disposition, so it runs after
  // the paste branch below (a cut call that proceeds is recorded as an allow).

  // Plan 395-13 (owner ruling 37, "cut the paste, send the rest"): the guard
  // found pasted text (a quote, a block quote or a code block) and no rule
  // for every shape fired. classifyAndCut cuts the paste and decides the rest.
  // Rest allowed: this plugin's own shim route proceeds (the shim cuts the
  // same spans before any wire call and discloses the cut; WR-06: checked by
  // ownPluginShimRoute, not by the name alone); any other Brain route gets
  // exit 2 with the cut input to send once more. Rest blocked: the verdict of
  // the rest is answered below. This hook never rewrites the tool input.
  if (verdictObj.verdict === 'block' && verdictObj.token_class === 'pasted_text' && typeof guard.classifyAndCut === 'function') {
    let planned = null;
    try {
      // The session room status rides along, so an unreadable room still blocks after a cut.
      planned = guard.classifyAndCut(toolInput, { toolName: toolName, roomDir: resolvedRoom.status === 'bound' ? resolvedRoom.roomDir : null, roomStatus: resolvedRoom.status, lexiconScope: resolvedRoom.lexicon_scope });
    } catch (_) {
      return guardUnavailable(toolName, toolInput, 'classify_threw');
    }
    if (planned && planned.cut > 0 && planned.verdict && planned.verdict.verdict === 'allow') {
      // Plan 395-13 review WR-06: the name alone is not trusted here.
      if (ownPluginShimRoute(toolName, sanitizer)) {
        bestEffortRecord({ verdict: 'allow', class: 'pasted_text', reason: 'sent_without_paste' }, sessionId, resolvedRoom);
        return allow();
      }
      bestEffortRecord(verdictObj, sessionId, resolvedRoom);
      return block(pasteResendMessage(planned.payload));
    }
    if (planned && planned.cut > 0 && planned.verdict && planned.verdict.verdict === 'block') verdictObj = planned.verdict;
    else if (planned && planned.cut > 0) { bestEffortRecord(verdictObj, sessionId, resolvedRoom); return block(splitRouteMessage()); }
  }
  bestEffortRecord(verdictObj, sessionId, resolvedRoom);

  const verdict = verdictObj.verdict;
  const klass = verdictObj.class || 'unknown';
  const reason = verdictObj.reason || '';

  if (verdict === 'block') {
    if (klass === 'sprouts_required') {
      // Plan 386-27 (option-e, owner decision of plan 386-26): the guard asks
      // for a split. Answer with the constant guide from the split-route
      // module (plan 386-42): the reason, the 5 steps, no payload byte.
      return block(splitRouteMessage());
    }
    if (klass === 'room_content' || klass === 'room_check_unavailable') {
      // Phase 369.2 Plan 01: a Theo free-form block names its class and token
      // class, never the token and never the matched pattern.
      // Quick 261012-sph: a lexicon match also names the entry kind and the
      // word count, never the token. The require runs on the block path only
      // (about 50 to 70 ms, inside the 2000 ms hook budget; V6 measures the
      // allow path). A failed require keeps the old text and still exits 2.
      let matchedSentence = null;
      if (klass === 'room_content') {
        try {
          matchedSentence = require(BRAIN_CLIENT_PATH)._describeLexiconMatch(verdictObj);
        } catch (_) {
          matchedSentence = null;
        }
      }
      if (typeof matchedSentence === 'string') {
        return block(
          'Canon Part 8: blocked (' + klass + ', ' + (verdictObj.token_class || 'none') + '). ' + matchedSentence
        );
      }
      return block(
        'Canon Part 8: outbound Theo payload carries room content (' + klass + ', ' +
        (verdictObj.token_class || 'none') + '). Blocked.'
      );
    }
    if (klass === 'write_blocked') {
      // Plan 386-04 (B2): a Brain write is blocked by tool name for every
      // payload. The text names the rule only; it carries no payload bytes.
      return block('Canon Part 8: Brain writes from this client are blocked (write_blocked).');
    }
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
    // Plan 386-27 (option-e): an ambiguous call on a shim-backed scope that
    // carries an edge or a body string by shape is not handed to the shim. It
    // gets the typed outcome sprouts_required with the split guide (exit 2).
    // Brain-less mode has no wire, so it keeps the allow (D-08a). A sprout-only
    // payload keeps the allow below, so a short keyword query is never stopped
    // for being unproven. The cypher key of brain_query is not read.
    if (shimBacked && SHIM_BACKED_AMBIGUOUS_ALLOW_CLASSES.has(klass) && brainAvailable() && carriesEdgeOrBody(toolName, toolInput)) {
      return block(splitRouteMessage());
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

// Outer wrap + uncaughtException backstop. Plan 386-30: once the tool input is
// read and the tool is Brain-shaped (`armed`), a failure of the hook itself
// blocks with the typed reason. A failure before that point (nothing to
// inspect) keeps exit 0.
function failureExit() {
  if (!armed) return process.exit(0);
  try {
    return guardUnavailable(armed.toolName, armed.toolInput, 'hook_uncaught');
  } catch (_) {
    return process.exit(2);
  }
}

process.on('uncaughtException', function () {
  failureExit();
});

try {
  main();
} catch (_) {
  failureExit();
}
