/**
 * MindrianOS MCP Hierarchical Tool Router
 *
 * Registers 9 high-level MCP tools that dispatch to all 64 CLI commands.
 * Hierarchical design keeps total tool definition under 7000 tokens
 * (vs 30-60K for flat 64-tool registration).
 *
 * Router tools:
 *   1. room_state      - room health, state, recommendations (5 commands)
 *   2. room_content    - projects, opportunities, funding, personas (15 commands)
 *   3. room_graph      - knowledge graph, Minto reasoning, visualization (13 commands)
 *   4. methodology     - PWS innovation frameworks (14 commands)
 *   5. analysis        - systems analysis and trend exploration (13 commands)
 *   6. intelligence    - connections, grading, research (7 commands)
 *   7. meeting         - meeting filing, pipeline, speakers (3 commands)
 *   8. export          - dashboards, wikis, presentations, snapshots (7 commands)
 *   9. orchestration   - autonomous execution, rooms, scout, admin (20 commands)
 *
 * Total: 64 unique CLI commands across 9 router tools (verified via ALL_TOOL_COMMANDS).
 *
 * Suggested Next: Every tool response includes a ## Suggested Next section
 * with tool_name, args, and rationale for LLM-orchestrated pipeline chaining (MCP-05).
 *
 * Intelligence Cascade: Write-tools call runCascade after operations
 * for surface parity between CLI hooks and MCP handlers.
 */

'use strict';

const path = require('path');
const { z } = require('zod');
const { safeReadFile } = require('../core/index.cjs');
const pipelineState = require('./pipeline-state.cjs');
// Phase 205-01 item 0b: the surface fence MUST hold on the MCP router surface
// (Desktop/Cowork), not only the CLI, or the fence leaks. The router runs every
// offered next-command through filterToNavigator at the suggest chokepoint.
const { filterToNavigator } = require('../core/surface-fence.cjs');
// Todo 2026-07-06-room-content-file-opportunity-misroutes-active-room: the MCP
// server resolves its write target ONCE at boot (bin/mindrian-mcp-server.cjs
// captures roomDir and freezes it into this router's closure via
// registerRouterTools). A mid-session `room-registry set-active X` never reaches
// the long-lived server, so room_content WRITES kept landing in the spawn-time
// room. Canon Part 7 (reuse before build): re-resolve per write call through the
// ONE canonical resolver instead of adding a 6th active-room guesser. Canon
// Part 8: the resolver reads LOCAL registry.json + env only, zero Brain
// egress. CLAUDE_ACTIVE_ROOM / MINDRIAN_ROOM still win (they are precedence leg 1
// inside resolveActiveRoom). The boot-time roomDir remains the miss-fallback.
//
// Phase 248-01 (CTX-01): resolveWriteTargetDir is now a thin delegate to
// lib/mcp/session-room.cjs, the ONE shared MCP resolver. It no longer reads
// MINDRIAN_MCP_FIRST at all -- a session's explicit room_bind is
// authoritative regardless of flag state (CTX-02); an unbound session still
// resolves byte-identically to legacy, since the resolver's own reg.active
// leg is the same demoted fallback resolveActiveRoom always was.
const { resolveEffectiveSessionId } = require('../core/session-binding.cjs');
const sessionRoom = require('./session-room.cjs');
// Phase 212-03: the portable Grounding Guard critic core (D4 thin-wrapper
// contract). criticRule is a PURE function of the D1 payload; requiring it here
// couples ONLY the disposable wrapper to this router, never the critic logic
// (SEED-014 lifts lib/core/eureka-critic.cjs unchanged). loadCriticTags supplies
// the closed domain-tag enum the eureka_critic zod schema is built from.
const eurekaCritic = require('../core/eureka-critic.cjs');

// Phase 212-03: eureka_critic wrapper state. Module-level (NOT per-registration)
// so dedupe + rate-limit persist across calls for the life of the process.
// Neither references a room closure (D5: pure function of the payload).
const _eurekaCriticDedupeCache = new Map(); // payloadHash -> { ruling, ts }
const _eurekaCriticRateWindow = [];         // rolling-minute call timestamps

// Quick-260717-2vf (D-D): the eureka compute scan in-flight guard. Module-level
// (NOT per-registration) for the SAME reason _eurekaCriticDedupeCache is: under
// flag-ON the daemon mints a FRESH McpServer per session via createServer(), so a
// per-registration closure would NOT be shared across sessions -- module state is.
// A second eureka-run for a room already in flight returns already_running instead
// of double-running; the entry clears in .finally() when the in-process (http) scan
// settles. Maps roomDir -> { started_at }. The detached stdio path is not
// cross-process-tracked (today's CLI `start` does not guard either -- contract
// preserved).
//
// hitl_shape: none (D-H). RATIONALE mirrors eureka_critic's: the scan is compute
// plus a written report; it has no Decision-Gate fork of its own. The human gate on
// eureka verdicts is the navigator READING the report downstream, not a fork inside
// this tool. These subcommands are deliberately NOT in ALL_TOOL_COMMANDS (no CLI
// parity twin under these names -- the CLI twin is /mos:eureka through its own
// dispatcher, so the 65-pin parity array must never see them) and NOT in
// MCP_TOOL_CONNECTORS (they ride the already-registered `intelligence` tool, minting
// no new connector descriptor). Canon Part 8: ZERO network -- the scan is the same
// local compute the CLI runs, and the response carries only local file PATHS plus
// local report CONTENT to the local MCP client (the same trust boundary as CLI
// stdout; LOCAL -> BRAIN never happens, and this tool adds no wire eureka_critic
// does not already have).
const _eurekaScanInFlight = new Map(); // roomDir -> { started_at }

/**
 * Re-resolve the live WRITE target per call, session-aware UNCONDITIONALLY as
 * of Phase 248-01 (CTX-01/CTX-02) -- a thin delegate to
 * lib/mcp/session-room.cjs, which now owns the MCP_FIRST_DEPRECATED_ACTIVE_WRITE
 * stderr token (moved there, byte-identical, Task 2). Signature preserved
 * exactly so every call site and the _test export survive unchanged.
 *
 * @param {string|undefined} sessionId - this connection's session id (undefined on stdio / unbound)
 * @param {string} fallbackRoomDir - boot-time closure roomDir (miss-fallback)
 * @param {string} [surface] - this process's detected surface name (still threaded through for logging context, no longer gates resolution)
 * @returns {string} absolute directory the write should land in
 */
function resolveWriteTargetDir(sessionId, fallbackRoomDir, surface) {
  return sessionRoom.resolveMcpSessionRoom({
    sessionId: sessionId,
    ctx: { fallbackRoomDir: fallbackRoomDir, surface: surface },
    forWrite: true,
  }).dir;
}

// ---------------------------------------------------------------------------
// 87-05: MCP input validation primitives (CASCADE-03 + CASCADE-05)
// ---------------------------------------------------------------------------
// Three coordinated guards protect the MCP tool surface:
//   1. SECTION_RE -- Zod regex whitelist for section parameters. No traversal
//      tokens, no whitespace, no Unicode control codes, no caps.
//   2. safeResolveSection() -- path.resolve guard that rejects any input that
//      escapes roomDir after resolution. Paired with SECTION_RE so a malformed
//      section never reaches fs.readFile/writeFile.
//   3. opportunitySchema -- explicit Zod validation of the file-opportunity
//      JSON payload (previously accepted raw).
//
// These primitives are exported via module.exports._test for unit tests in
// lib/memory/mcp-input-validation.test.cjs.
// ---------------------------------------------------------------------------

const SECTION_RE = /^[a-z0-9-]+$/;
const sectionOptional = z.string().regex(SECTION_RE, 'section must match [a-z0-9-]+').optional();
const sectionRequired = z.string().regex(SECTION_RE, 'section must match [a-z0-9-]+');

/**
 * Resolve `section` relative to `roomDir` and refuse any path that escapes
 * roomDir. Complements the SECTION_RE regex: even if a caller bypasses Zod
 * (internal handler, test harness, future refactor), path traversal is still
 * blocked at the I/O boundary.
 *
 * @param {string} roomDir - Absolute room directory path.
 * @param {string|null|undefined} section - Section name.
 * @returns {string} Resolved absolute path inside roomDir.
 * @throws {Error} If resolved path escapes roomDir.
 */
function safeResolveSection(roomDir, section) {
  const base = path.resolve(roomDir);
  if (section === null || section === undefined || section === '') return base;
  const resolved = path.resolve(base, section);
  if (resolved !== base && !resolved.startsWith(base + path.sep)) {
    throw new Error(`section path traversal rejected: ${section}`);
  }
  return resolved;
}

/**
 * Zod schema for the file-opportunity payload. `passthrough()` preserves
 * caller-supplied fields (source_url, opportunity_id, relevance_reasoning,
 * etc.) that opportunity-ops.cjs reads dynamically.
 *
 * Aligned to the op it guards (fileOpportunity in opportunity-ops.cjs). That
 * op treats `title` as OPTIONAL and derives the slug/frontmatter from
 * `program || title`, so `title` here is optional too; a `.refine` requires at
 * least one of title/program (matching the op's `program || title || 'unknown'`
 * fallback intent while still rejecting a fully empty payload). Numeric fields
 * use `z.coerce.number()` so stringified scores/amounts ("0.8", "50000") -- the
 * shape LLM tool-callers routinely emit -- pass instead of being rejected as
 * "Invalid opportunity payload" for a payload the op would file fine.
 */
const opportunitySchema = z.object({
  title: z.string().min(1).max(500).optional(),
  program: z.string().max(500).optional(),
  funder: z.string().max(500).optional(),
  source: z.string().max(200).optional(),
  source_url: z.string().max(2000).optional(),
  opportunity_id: z.string().max(200).optional(),
  domain: z.string().max(200).optional(),
  deadline: z.string().max(50).optional(),
  amount: z.coerce.number().nonnegative().optional(),
  amount_floor: z.coerce.number().nonnegative().optional(),
  amount_ceiling: z.coerce.number().nonnegative().optional(),
  relevance_score: z.coerce.number().min(0).max(1).optional(),
  relevance_reasoning: z.string().max(5000).optional(),
  confidence: z.coerce.number().min(0).max(1).optional(),
}).passthrough().refine(
  (o) => Boolean(o.title || o.program),
  { message: 'title or program required' }
);

// ---------------------------------------------------------------------------
// Command groupings - authoritative mapping from 52-RESEARCH.md
// ---------------------------------------------------------------------------

// Router 1: room_state (5 commands)
const ROOM_STATE_COMMANDS = [
  'status', 'analyze', 'compute-state', 'get-state', 'suggest-next'
];

// Router 2: room_content (15 commands)
//
// NOTE (organize-soft-alias-redirects-to-nonexistent-target, filed 2026-08-24):
// 'organize' USED to be advertised here, but the dispatcher switch below never
// had a matching case -- the schema promised a capability the server did not
// have, and any caller who trusted this enum got a raw "Unknown room_content
// command: organize" at call time instead of a validation-time rejection.
// Removed until a real handler exists (short-term patch per that RCA). If
// `/mos:rooms organize` (commands/rooms.md) ever gets a real tree/propose/
// view/move implementation, add 'organize' back here with a matching case in
// the switch below in the SAME change -- never one without the other again.
const ROOM_CONTENT_COMMANDS = [
  'new-project', 'setup', 'update', 'help', 'detect-integrations',
  'scan-opportunities', 'list-opportunities', 'file-opportunity',
  'list-funding', 'create-funding', 'update-funding-stage',
  'generate-personas', 'list-personas', 'invoke-persona', 'analyze-perspectives'
];

// Router 3: room_graph (13 commands)
const ROOM_GRAPH_COMMANDS = [
  'graph-index', 'graph-rebuild', 'graph-query', 'graph-stats',
  'reasoning-get', 'reasoning-generate', 'reasoning-verify',
  'reasoning-run', 'reasoning-list', 'reasoning-frontmatter',
  'visualize-room', 'visualize-graph', 'visualize-chain'
];

// Router 4: methodology (14 commands)
const METHODOLOGY_COMMANDS = [
  'lean-canvas', 'think-hats', 'structure-argument', 'beautiful-question',
  'build-knowledge', 'challenge-assumptions', 'validate', 'map-unknowns',
  'diagnose', 'score-innovation', 'explore-domains', 'analyze-needs',
  'user-needs', 'find-analogies'
];

// Router 5: analysis (13 commands)
const ANALYSIS_COMMANDS = [
  'analyze-systems', 'analyze-timing', 'find-bottlenecks', 'root-cause',
  'systems-thinking', 'macro-trends', 'explore-trends', 'explore-futures',
  'dominant-designs', 'scenario-plan',
  'causal-extract', 'causal-trace', 'causal-predict'
];

// Router 6: intelligence (8 commands)
const INTELLIGENCE_COMMANDS = [
  'find-connections', 'build-thesis', 'compare-ventures', 'research',
  'deep-grade', 'grade', 'leadership', 'whitespace'
];

// Quick-260717-2vf (D-A): the three eureka portfolio-scan compute subcommands.
// They register on the `intelligence` router tool's z.enum ONLY -- kept OUT of
// both INTELLIGENCE_COMMANDS and ALL_TOOL_COMMANDS on purpose: INTELLIGENCE_COMMANDS
// is spread into ALL_TOOL_COMMANDS, and tests/test-205-surface-fence.cjs pins that
// array's unique membership at exactly 65 (the CLI<->MCP parity guard for the 64
// routed CLI commands). eureka-run/status/report have NO CLI command twin under
// these names (the CLI twin is /mos:eureka via scripts/eureka-command.cjs's own
// dispatcher), so they are the exact eureka_critic precedent: registered on a router
// enum, never touching the parity array.
const EUREKA_COMPUTE_COMMANDS = ['eureka-run', 'eureka-status', 'eureka-report'];

// Quick-260717-2vf (D-E): the stable eureka path contract, taken verbatim (not
// re-derived through a new door) from scripts/eureka-command.cjs's own header
// ("Path contract: everything this command writes lives under here"). status.json
// and the report md+json all live under <room>/.mindrian/eureka/. eureka-status and
// eureka-report read these files DIRECTLY rather than calling cmdStatus/cmdReport,
// because those two write to process.stdout -- which is the JSON-RPC framing channel
// on a stdio transport (a foreign write would corrupt the MCP session).
function eurekaPaths(dir) {
  const base = path.join(dir, '.mindrian', 'eureka');
  return {
    base: base,
    status: path.join(base, 'status.json'),
    md: path.join(base, 'portfolio-report.md'),
    json: path.join(base, 'portfolio-report.json'),
  };
}

// Router 7: meeting (3 commands)
const MEETING_COMMANDS = [
  'file-meeting', 'pipeline', 'speakers'
];

// Router 8: export (7 commands)
const EXPORT_COMMANDS = [
  'export', 'radar', 'dashboard', 'wiki', 'present', 'publish', 'snapshot'
];

// Router 9: orchestration (22 commands)
const ORCHESTRATION_COMMANDS = [
  'act', 'act-chain', 'act-swarm', 'act-dry-run',
  'rooms-list', 'rooms-new', 'rooms-open', 'rooms-close', 'rooms-archive', 'rooms-where',
  'scout', 'scout-health', 'scout-deadlines', 'scout-competitors', 'scout-hsi', 'scout-snapshot',
  'reanalyze', 'onboard', 'models', 'admin',
  'hat-briefing', 'scheduled-tasks'
];

// RCA rooms-open-false-success (2026-07-27), structural half.
//
// 18 of the 22 orchestration commands above have no handler; they fall through
// to the generic reference-echo fallback at the bottom of the orchestration
// tool, which returns the command's markdown instruction sheet wrapped in a
// payload that used to end with "Room operation complete - check status". For a
// command that MUTATES STATE, that is a false success: it asserts a completed
// operation that was never attempted. That is exactly how rooms-open reported a
// verified-looking room switch while `room-registry get-active` still returned
// the previous room.
//
// rooms-open is now implemented and executes (see its branch below). rooms-new,
// rooms-close and rooms-archive remain unimplemented BY DESIGN in this RCA's
// scope -- rooms-new has its own separate open RCA with a different root cause
// (.planning/debug/intern-w1-rooms-new-silent-fail.md), and implementing it
// here would collide with that session. What changes is that they can no longer
// claim to have done something. They get an explicit NOT EXECUTED banner and a
// Suggested Next rationale that does not assert completion.
//
// Membership rule, corrected (quick 260903, F-1): a command belongs here if
// ITS DESCRIPTION CLAIMS a write or state change the handler does not perform,
// not, as the original rule read, "mutates persistent state AND has no
// executing branch." That original test silently exempted a family that
// mutates nothing but was still falsely DESCRIBED as an ordinary write (the
// scout family: orchestration's description used to say "the room and scout
// operations are ordinary reads and writes, so use them freely"), so the
// false-claim disease slipped through on a technicality. The honest test asks
// what the description PROMISES, not what the handler TOUCHES. rooms-list and
// rooms-where correctly stay out: their descriptions make no persistence
// claim, so returning documentation instead of data is a genuine capability
// gap, not a false claim about a state change. This set is also reused by the
// room_content tool's own reference-echo group (new-project, setup, update),
// which shares the identical false-completion shape under a different
// description; command names never collide across tools, so one Set safely
// gates both.
const UNIMPLEMENTED_MUTATING_ORCHESTRATION = new Set([
  'rooms-new', 'rooms-close', 'rooms-archive',
  'scout', 'scout-health', 'scout-deadlines', 'scout-competitors', 'scout-hsi', 'scout-snapshot',
  // room_content's F-11..F-14 echo group (Task 3 of 276-08): new-project,
  // setup and update fall through to the identical reference-echo shape
  // (loadReference + loadRoomState + a fireCascade call that RESEARCH
  // assumption A6 measured never reaches a leaf write). help stays out: its
  // description makes no write claim, so returning documentation is its
  // whole job, matching the rooms-list/rooms-where reasoning above.
  'new-project', 'setup', 'update'
]);

/**
 * Flat array of all 64 CLI command names for parity checking.
 * Maps 1:1 to the 66 .md files in commands/ minus splash (banner-only)
 * and funding (covered by room_content sub-commands) = 64 routed commands.
 *
 * CLI command names are used (not router sub-command names) for parity validation.
 * Some CLI commands map to multiple router sub-commands (e.g., "room" -> status/analyze/etc).
 */
const ALL_TOOL_COMMANDS = [
  // room_state (CLI names)
  'status', 'room', 'suggest-next',
  // room_content (CLI names)
  'new-project', 'setup', 'update', 'help',
  'opportunities', 'persona',
  // room_graph (CLI names)
  'graph', 'query', 'reason', 'visualize',
  // methodology
  ...METHODOLOGY_COMMANDS,
  // analysis - CLI names for causal subcommands
  'analyze-systems', 'analyze-timing', 'find-bottlenecks', 'root-cause',
  'systems-thinking', 'macro-trends', 'explore-trends', 'explore-futures',
  'dominant-designs', 'scenario-plan', 'causal',
  // intelligence
  ...INTELLIGENCE_COMMANDS,
  // meeting - CLI names
  'file-meeting', 'pipeline', 'speakers',
  // export - CLI names
  'export', 'radar', 'dashboard', 'wiki', 'present', 'publish', 'snapshot',
  // orchestration - CLI names
  'act', 'rooms', 'scout', 'reanalyze', 'onboard', 'models', 'admin',
  'hat-briefing', 'scheduled-tasks'
];

// Write-tools that trigger intelligence cascade after operations
const WRITE_TOOLS = new Set([
  'file-opportunity', 'create-funding', 'update-funding-stage',
  'generate-personas', 'invoke-persona', 'new-project', 'setup', 'update',
  'graph-index', 'graph-rebuild', 'reasoning-generate',
  'file-meeting'
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a text response in MCP tool format.
 * @param {string} text - Response text
 * @param {boolean} [isError=false] - Whether this is an error response
 */
function textResponse(text, isError) {
  const result = { content: [{ type: 'text', text }] };
  if (isError) result.isError = true;
  return result;
}

/**
 * Quick 260903-kwl. Per `.planning/debug/meeting-file-meeting-false-success.md`,
 * a model reading an ok-shaped tool response has no other way to tell a
 * scaffolding tool (reference-only, writes nothing) apart from a write tool;
 * false confidence in a completed write is worse than a visible gap, so every
 * reference-only meeting branch leads with this exact, machine-checkable marker.
 */
const NO_WRITE_MARKER = '**filed: false**';

/**
 * Build the leading no-write banner every meeting branch uses, so the
 * NO_WRITE_MARKER literal appears exactly once in this file.
 * @param {string} realPathSentence - names the real write path for this branch
 * @returns {string} e.g. "**filed: false** Nothing was written; call artifact_file to file this content."
 */
function noWriteBanner(realPathSentence) {
  return `${NO_WRITE_MARKER} ${realPathSentence}`;
}

/**
 * Format a Suggested Next section for pipeline chaining (MCP-05).
 * @param {string} tool - MCP tool name (e.g., 'room_state')
 * @param {Object} args - Tool arguments
 * @param {string} rationale - Why this is the logical next step
 * @returns {string} Formatted markdown section
 */
function formatSuggestedNext(tool, args, rationale) {
  // Phase 205-01 item 0b: enforce the surface fence on the MCP surface. The
  // command being offered as the next move must be a navigator surface; a
  // plumbing (surface:internal) command is never surfaced to Desktop/Cowork.
  // filterToNavigator is the single-source-of-truth chokepoint (never re-derived
  // recall). A suppressed suggestion emits nothing rather than a plumbing move.
  const offered = args && args.command;
  if (offered && filterToNavigator([offered]).length === 0) {
    return '';
  }
  return `\n\n## Suggested Next\n\n**Tool:** \`${tool}\`\n**Args:** \`${JSON.stringify(args)}\`\n**Rationale:** ${rationale}`;
}

// Grouped orchestration sub-commands (rooms-new, scout-health, act-chain, ...)
// fall back to their command FAMILY base file. Closed map by design: dozens of
// unrelated commands contain hyphens (find-bottlenecks, act-on-insight class
// names, ...), so a generic split-on-hyphen would make unknown commands
// accidentally resolve and violate the null contract.
const GROUPED_PREFIX_FALLBACK = {
  'rooms-': 'rooms',
  'scout-': 'scout',
  'act-': 'act',
};

/**
 * Load a methodology/command reference file from references/methodology/.
 * Falls back to the command's CLI reference in commands/, then to the
 * command FAMILY base file for grouped sub-commands. Router 9 registers
 * grouped sub-commands but instruction files ship per command FAMILY; the
 * reference IS the instruction set, so a miss is a silent no-op.
 */
function loadReference(pluginRoot, command) {
  // Try methodology references first
  const methodRef = safeReadFile(path.join(pluginRoot, 'references', 'methodology', `${command}.md`));
  if (methodRef) return methodRef;

  // Fall back to CLI command reference
  const cmdRef = safeReadFile(path.join(pluginRoot, 'commands', `${command}.md`));
  if (cmdRef) return cmdRef;

  // Grouped-prefix fallback: exact-name lookups stay first so a future
  // per-subcommand file (e.g. commands/rooms-new.md) wins automatically.
  for (const [prefix, base] of Object.entries(GROUPED_PREFIX_FALLBACK)) {
    if (command.startsWith(prefix)) {
      const familyRef = safeReadFile(path.join(pluginRoot, 'commands', `${base}.md`));
      if (familyRef) return familyRef;
    }
  }

  return null;
}

/**
 * Load current room state (STATE.md contents). Returns empty string if unavailable.
 */
function loadRoomState(roomDir) {
  const stateOps = require('../core/state-ops.cjs');
  try {
    return stateOps.getState(roomDir) || '';
  } catch (_e) {
    return '';
  }
}

/**
 * Build combined context: reference + room state + user focus.
 */
function buildContext(pluginRoot, roomDir, command, userContext) {
  const ref = loadReference(pluginRoot, command);
  const state = loadRoomState(roomDir);

  const parts = [`## Command: ${command}`];
  if (state) parts.push(`\n### Room State\n${state}`);
  if (ref) parts.push(`\n### Reference\n${ref}`);
  if (userContext) parts.push(`\n### Focus\n${userContext}`);
  if (!ref) parts.push(`\n> Note: No reference file found for "${command}". Available commands in this group will still work.`);

  return parts.join('\n');
}

/**
 * Run the Stage 1-4 research pipeline (context extraction + web fetch) for
 * the intelligence tool's `research` command.
 *
 * intern-w1-research-reach-broken: this command used to fall through to
 * buildContext(), which only reads commands/research.md off disk and echoes
 * it back - zero fetch, for any input. This wires the two modules
 * commands/research.md itself documents as the MCP execution layer:
 *   Stage 1+2+3 research-context-extractor.cjs::extractContext()
 *   Stage 4     lib/lens-engine/source-lens-driver.cjs::runSourceLens()
 *
 * Stage 5 (presentation) is this function's return value. Stage 6 (F.1
 * filing selector) and Stage 7 (findings-wirer) are NOT run here: filing a
 * finding is a human decision (commands/research.md hitl_shape: F.8,
 * plan_gated: true; Canon Part 9 role 5 - Larry proposes, the human
 * decides), and a single synchronous MCP tool call has no channel to collect
 * that decision. The response names the filing step as the next move instead
 * of auto-wiring it.
 *
 * @param {string} roomDir - Active room directory
 * @param {string} topic - The research question/topic
 * @param {Object} [opts] - Optional overrides
 * @param {Function} [opts._fetchCorpus] - Test seam forwarded to
 *   runSourceLens (mirrors the seam tests/test-131-source-lens-driver.cjs
 *   already uses) so this can be tested hermetically, no live network.
 * @returns {Promise<string>} Formatted findings response
 */
async function runResearchPipeline(roomDir, topic, opts) {
  const { extractContext } = require('../core/research-context-extractor.cjs');
  const { runSourceLens } = require('../lens-engine/source-lens-driver.cjs');
  // lib/mcp/tool-router.cjs is NOT on the room-db.cjs substrate allow-list
  // (scripts/check-substrate.cjs), so it must never require room-db.cjs
  // directly. navigation.cjs already re-exports the exact caller-owned-handle
  // door built for this (Phase 135-01, the same pattern scripts/intent-
  // classifier.cjs uses): openRoomDbForCaller returns null on a cold room
  // instead of throwing or creating room.db as a read-only research call's
  // side effect.
  const navigation = require('../core/navigation.cjs');
  const db = navigation.openRoomDbForCaller(roomDir);
  const options = (opts && typeof opts === 'object') ? opts : {};

  try {
    const extracted = extractContext({ roomDir, topic, db });
    let driverResult;
    try {
      driverResult = await runSourceLens({
        roomDir,
        topic,
        lensSet: extracted.lens_set,
        preflight: extracted.preflight,
        stage: 'explore',
        _fetchCorpus: options._fetchCorpus,
        db,
      });
    } catch (_e) {
      driverResult = { ok: false, reason: 'driver_threw' };
    }

    const parts = ['## research'];
    if (extracted.context_summary) parts.push(`\n### Context\n${extracted.context_summary}`);

    if (!driverResult || driverResult.ok === false) {
      parts.push(`\n### Findings\nNo findings retrieved (${(driverResult && driverResult.reason) || 'fetch unavailable'}). Try again or give a more specific topic.`);
      return parts.join('\n');
    }

    const findings = Array.isArray(driverResult.findings) ? driverResult.findings : [];
    if (findings.length === 0) {
      parts.push('\n### Findings\nNo findings cleared the evidence-tier threshold for this stage.');
    } else {
      parts.push('\n### Findings');
      findings.forEach((f, i) => {
        const title = f.title || '(untitled)';
        const tier = f.evidence_tier || 'unknown-tier';
        const summary = f.summary || '';
        const source = f.source || 'unknown';
        const url = f.url || 'no url';
        const retrievedAt = f.retrieved_at || 'unknown';
        parts.push(`\n${i + 1}. **${title}** [${tier}]\n   ${summary}\n   Source: ${source} - ${url} (retrieved ${retrievedAt})`);
      });
      parts.push('\n### Filing decision needed\nEach finding above needs a human filing decision (file to a section, defer, or reject) before it becomes room graph data - this pipeline surfaces findings, it does not auto-file them.');
    }

    return parts.join('\n');
  } finally {
    navigation.closeRoomDbForCaller(db);
  }
}

/**
 * Fire intelligence cascade after a write operation.
 * Non-blocking - failures never break the tool response.
 * @param {string} roomDir
 * @param {string} command - The command that triggered the write
 * @param {string} [section] - Section context
 * @param {Object} [result] - Result from the write operation (may contain filePath)
 */
async function fireCascade(roomDir, command, section, result) {
  try {
    const { runCascade } = require('../core/intelligence-cascade.cjs');
    const filePath = (result && result.filePath) || '';
    await runCascade(roomDir, { trigger: 'mcp-tool', filePath, section: section || '' });
  } catch (_e) {
    // Cascade failures must never break tool responses
  }
}

/**
 * Phase 232.1 / D-07: the single-room density line folded into room_state.
 *
 * WHY THIS DOOR. Same in-file precedent as runResearchPipeline above:
 * lib/mcp/tool-router.cjs is NOT on the room-db.cjs substrate allow-list
 * (scripts/check-substrate.cjs), so it must never require room-db.cjs or
 * node:sqlite directly; navigation.cjs already re-exports the door. But this
 * function reaches for the READ-ONLY sibling door Plan 232.1-01 built
 * (openRoomDbReadOnlyForCaller), NEVER openRoomDbForCaller. The reason is
 * D-04's central finding: openRoomDbForCaller delegates to room-db.cjs's
 * openRoomDb, which mkdirSync's, runs 13 CREATE TABLE IF NOT EXISTS statements
 * and 5 migrations on EVERY open. A status line must never be able to trigger
 * a schema migration as a side effect of merely being READ (T-232.1-06).
 *
 * WHY activeRoomDir. The caller MUST pass the per-call-resolved activeRoomDir
 * (resolveWriteTargetDir's return value), never registerRouterTools' frozen
 * boot-time roomDir closure. Reading the wrong variable is the documented root
 * cause of the intern-w1-room-state-false-empty bug class (232.1-PATTERNS.md):
 * a mid-session room switch would leave this line reporting a DIFFERENT room's
 * counts as if they were the bound room's (T-232.1-07).
 *
 * COPY (D-06). Raw counts, one noun, no adjective. Never "density", never
 * "dense"/"sparse"/"at risk"/"healthy" - a count is a measurement, not a
 * health claim. Same guard the doctor module's rendered detail carries.
 *
 * The two count queries are fixed string literals against hardcoded table
 * names with zero interpolation (T-232.1-09). The per-query try/catch is the
 * repo's schema-less-safe idiom (D-05: a room.db with no nodes/edges tables
 * reports 0, never throws). It is deliberately re-implemented here rather than
 * imported from lib/core/doctor/room-graph-density-module.cjs's countTable:
 * lib/mcp/ must not depend on lib/core/doctor/, so this two-line duplication
 * is the intended Canon Part 8/9 layering cost, not an oversight.
 *
 * @param {string} activeRoomDir - the LIVE active room dir, not the boot-time one
 * @returns {string} a leading-blank-line-prefixed line, or '' if anything fails
 */
function roomDensityLine(activeRoomDir) {
  const navigation = require('../core/navigation.cjs');
  let db = null;
  try {
    db = navigation.openRoomDbReadOnlyForCaller(activeRoomDir);
    if (!db) return '\n\nLocal graph: 0 nodes, 0 edges (no room.db yet).';
    let n = 0;
    let e = 0;
    try { n = db.prepare('SELECT count(*) AS c FROM nodes').get().c; } catch (_e) { n = 0; }
    try { e = db.prepare('SELECT count(*) AS c FROM edges').get().c; } catch (_e) { e = 0; }
    return '\n\nLocal graph: ' + n + ' nodes, ' + e + ' edges.';
  } catch (_e) {
    return '';
  } finally {
    navigation.closeRoomDbForCaller(db);
  }
}

// ---------------------------------------------------------------------------
// Router registration
// ---------------------------------------------------------------------------

/**
 * Register all 9 hierarchical router tools on the MCP server.
 *
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server
 * @param {string} roomDir - Absolute path to the Data Room
 * @param {string} pluginRoot - Absolute path to the plugin root
 * @param {{ full: string }} larryContext - Larry personality context
 * @param {string} [surface] - this process's detected surface name ('cli'|'desktop'|'cowork'),
 *   threaded into resolveWriteTargetDir so session-aware write resolution can
 *   be gated per-surface behind MINDRIAN_MCP_FIRST (D-07, Phase 198-02)
 */
function registerRouterTools(server, roomDir, pluginRoot, larryContext, surface) {
  // -------------------------------------------------------------------------
  // 1. room_state - room health, state, and recommendations (5 commands)
  // -------------------------------------------------------------------------
  // Phase 266-02: this description used to splice the first 80 characters of
  // a trimmed voice-dna.md excerpt onto the end of a fixed prefix, which
  // shipped a raw markdown H1 and a mid-word cut to every host on every
  // surface. An arbitrary byte offset into a prose file cannot be made to
  // land on a sentence boundary, so the description is authored, not
  // borrowed. Pinned by tests/test-266-room-state-description.cjs.
  server.tool(
    'room_state',
    'Check room health and state and get framework recommendations for a Data Room. Use command=status for a one-line health read, analyze for a full section-by-section room analysis, compute-state to recompute STATE.md from what is on disk, get-state to read the current STATE.md, and suggest-next for the recommended next move. Reach for this before proposing work in a room so the suggestion is grounded in the room\'s real state rather than the conversation.',
    {
      command: z.enum(ROOM_STATE_COMMANDS)
        .describe('Room state operation to perform'),
      section: sectionOptional
        .describe('Section name for section-specific operations'),
    },
    async ({ command, section }, extra) => {
      // Phase 87-04: MCP path MUST use the async entry point so analyzeRoom's
      // subprocess call does not block the handler loop. Importing bare
      // './room-ops.cjs' would trip the MOS_DEP_ROOM_OPS_LEGACY warning.
      const roomOps = require('../core/room-ops-async.cjs');
      const stateOps = require('../core/state-ops.cjs');
      // intern-w1-room-state-false-empty: these 5 read branches used to read
      // the boot-time closure roomDir directly, so a mid-session room switch
      // (or a room created after the MCP daemon booted) was invisible here.
      // Re-resolve per call so status/analyze/compute-state/get-state/
      // suggest-next never report against a stale boot-time directory.
      //
      // Phase 248-01 (research pitfall 9): these are READS. They used to ride
      // resolveWriteTargetDir (the WRITE resolver, whose forWrite semantics
      // add a `.room-root` cwd walk-up leg that must never leak into a read
      // -- the exact reason core resolveSessionRoom excludes it, per its own
      // header). Split onto sessionRoom.resolveSessionRoomDir, the read-side
      // wrapper, instead. `sessionId` (per-connection, undefined on
      // stdio/legacy) and `surface` (this function's own outer parameter,
      // already in scope) are threaded through as ctx.
      const sessionId = resolveEffectiveSessionId(undefined, extra);
      const activeRoomDir = sessionRoom.resolveSessionRoomDir(sessionId, { fallbackRoomDir: roomDir, surface: surface });

      switch (command) {
        case 'status': {
          const state = stateOps.getState(activeRoomDir);
          const response = state || 'No room initialized. Run new-project to create one.';
          return textResponse(response + roomDensityLine(activeRoomDir) + formatSuggestedNext('room_state', { command: 'analyze' }, 'Room status retrieved - run full analysis to detect patterns and gaps'));
        }
        case 'analyze': {
          const analysis = await roomOps.analyzeRoom(activeRoomDir);
          return textResponse(analysis + formatSuggestedNext('room_graph', { command: 'graph-stats' }, 'Room analysis complete - check graph for relationship patterns'));
        }
        case 'compute-state': {
          const computed = stateOps.computeState(activeRoomDir);
          return textResponse(computed + formatSuggestedNext('room_state', { command: 'suggest-next' }, 'State updated - get framework recommendation for current stage'));
        }
        case 'get-state': {
          const state = stateOps.getState(activeRoomDir);
          return textResponse((state || 'No STATE.md found in room.') + roomDensityLine(activeRoomDir) + formatSuggestedNext('room_state', { command: 'analyze' }, 'State retrieved - run analysis to detect intelligence patterns'));
        }
        case 'suggest-next': {
          const ref = loadReference(pluginRoot, 'suggest-next');
          const state = loadRoomState(activeRoomDir);
          const parts = ['## suggest-next'];
          if (state) parts.push(`\n### Current Room State\n${state}`);
          if (ref) parts.push(`\n### Reference\n${ref}`);
          else parts.push('\n> Reference file for "suggest-next" not found.');
          return textResponse(parts.join('\n') + formatSuggestedNext('methodology', { command: 'diagnose' }, 'Framework recommendation provided - diagnose room to identify starting point'));
        }
        default:
          return textResponse(`Unknown room_state command: ${command}`, true);
      }
    }
  );

  // -------------------------------------------------------------------------
  // 2. room_content - projects, opportunities, funding, personas (15 commands)
  // -------------------------------------------------------------------------
  server.tool(
    'room_content',
    'This tool manages the entities that live inside a room: projects, opportunities, funding stages, personas, and detected integrations. The genuine WRITE surface is file-opportunity, create-funding, update-funding-stage and generate-personas; the last routes to /mos:persona --parallel by default and only writes for an explicit preview, so reach for this tool when room content needs to be added or changed. new-project, setup and update return the operation\'s instructions plus current room context rather than performing it; run the matching /mos: CLI command (new-project, setup or update) for the actual step. invoke-persona READS an existing persona document and returns it; it performs no write of its own. Use room_state instead when you only need to READ the room: its health, computed stage, or a suggested next move. room_state never mutates anything; the four listed commands above do, and the rest of this tool\'s commands return references or reads.',
    {
      command: z.enum(ROOM_CONTENT_COMMANDS)
        .describe('Room content operation to perform'),
      section: sectionOptional
        .describe('Section name or JSON data for operations'),
      context: z.string().optional()
        .describe('Additional context for the operation'),
    },
    async ({ command, section, context }, extra) => {
      // Phase 198-02 (SPEC-1): this connection's sessionId, when the SDK
      // transport supplies one (flag-ON HTTP path; undefined on stdio/legacy).
      // Threaded into every WRITE call site below via resolveWriteTargetDir.
      const sessionId = resolveEffectiveSessionId(undefined, extra);

      switch (command) {
        case 'new-project':
        case 'setup':
        case 'update':
        case 'help': {
          const ref = loadReference(pluginRoot, command);
          const state = loadRoomState(roomDir);
          const parts = [`## ${command}`];
          // Task 3 of 276-08 (F-11..F-14). new-project/setup/update are
          // DESCRIBED as instructions-only (Move 1 above) but this branch used
          // to silently omit any disclosure; they now carry the shipped
          // NOT-EXECUTED banner via the same corrected membership set Task 1
          // extended. help stays out: it makes no write claim.
          const unimplementedMutation = UNIMPLEMENTED_MUTATING_ORCHESTRATION.has(command);
          if (unimplementedMutation) {
            parts.push(`\n> **NOT EXECUTED.** This returns the \`${command}\` instructions, not a completed operation. Nothing has changed yet. Follow the Reference steps below and verify the result before reporting success.`);
          }
          if (state) parts.push(`\n### Current Room State\n${state}`);
          // Rule 1 bug fix: the pre-existing code bound this "not found" line
          // to `if (context) ... else ...`, so it fired whenever NO context
          // was supplied, regardless of whether the reference was actually
          // found - the inverse of Move 3's intent. Corrected to gate on `ref`.
          if (ref) parts.push(`\n### Reference\n${ref}`);
          else parts.push(`\n> Reference file for "${command}" not found.`);
          if (context) parts.push(`\n### Focus\n${context}`);
          const response = parts.join('\n');
          // Fire cascade for write operations
          if (WRITE_TOOLS.has(command)) {
            await fireCascade(roomDir, command, section);
          }
          // Move 4: the shared "Content updated - analyze room..." rationale
          // asserted a completion none of these four branches perform. help
          // gets its own honest, non-mutation rationale; the other three get
          // the same "Instructions returned" template used everywhere else
          // in this file for the identical shape.
          const suggestedNext = unimplementedMutation
            ? formatSuggestedNext('room_state', { command: 'status' }, 'Instructions returned - run them, then check status to confirm what actually changed')
            : formatSuggestedNext('room_state', { command: 'status' }, 'Reference returned - check room status if you want to see current content');
          return textResponse(response + suggestedNext);
        }
        case 'detect-integrations': {
          const integrationRegistry = require('../core/integration-registry.cjs');
          const integResult = integrationRegistry.detectIntegrations({ workDir: roomDir });
          return textResponse(JSON.stringify(integResult, null, 2) + formatSuggestedNext('room_content', { command: 'setup' }, 'Integrations detected - run setup to configure discovered services'));
        }
        case 'scan-opportunities': {
          const opportunityOps = require('../core/opportunity-ops.cjs');
          const scanResult = await opportunityOps.scanOpportunities(roomDir);
          return textResponse(JSON.stringify(scanResult, null, 2) + formatSuggestedNext('room_content', { command: 'list-opportunities' }, 'Scan complete - list discovered opportunities for review'));
        }
        case 'list-opportunities': {
          const opportunityOps = require('../core/opportunity-ops.cjs');
          const listResult = opportunityOps.listOpportunities(roomDir);
          return textResponse(JSON.stringify(listResult, null, 2) + formatSuggestedNext('room_content', { command: 'file-opportunity' }, 'Opportunities listed - file the most promising one to your room'));
        }
        case 'file-opportunity': {
          const opportunityOps = require('../core/opportunity-ops.cjs');
          let oppData;
          try {
            oppData = section ? JSON.parse(section) : {};
          } catch (_e) {
            return textResponse('Invalid JSON in section parameter for file-opportunity', true);
          }
          // 87-05: validate opportunity payload structure before filing (CASCADE-05)
          let validatedOpp;
          try {
            validatedOpp = opportunitySchema.parse(oppData);
          } catch (zodErr) {
            return textResponse('Invalid opportunity payload: ' + (zodErr && zodErr.message ? zodErr.message : String(zodErr)), true);
          }
          // Re-resolve the live active room per call so a mid-session
          // set-active routes the write to the CURRENT room, not the frozen
          // boot-time roomDir (todo room-content-file-opportunity-misroutes).
          const targetDir = resolveWriteTargetDir(sessionId, roomDir, surface);
          const fileResult = opportunityOps.fileOpportunity(targetDir, validatedOpp);
          await fireCascade(targetDir, command, section, fileResult);
          return textResponse(JSON.stringify(fileResult, null, 2) + formatSuggestedNext('room_state', { command: 'analyze' }, 'Opportunity filed - analyze room to detect cross-section patterns'));
        }
        case 'list-funding': {
          const opportunityOps = require('../core/opportunity-ops.cjs');
          const fundResult = opportunityOps.listFunding(roomDir);
          return textResponse(JSON.stringify(fundResult, null, 2) + formatSuggestedNext('room_content', { command: 'create-funding' }, 'Funding listed - create a new funding tracker if needed'));
        }
        case 'create-funding': {
          const opportunityOps = require('../core/opportunity-ops.cjs');
          let fundData;
          try {
            fundData = section ? JSON.parse(section) : {};
          } catch (_e) {
            return textResponse('Invalid JSON in section parameter for create-funding', true);
          }
          if (!fundData.slug || !fundData.source) {
            return textResponse('create-funding requires { slug, source } in section parameter', true);
          }
          // Same frozen-roomDir misroute as file-opportunity: re-resolve live.
          const targetDir = resolveWriteTargetDir(sessionId, roomDir, surface);
          const createResult = opportunityOps.createFunding(targetDir, fundData.slug, fundData.source);
          await fireCascade(targetDir, command, section, createResult);
          return textResponse(JSON.stringify(createResult, null, 2) + formatSuggestedNext('room_content', { command: 'update-funding-stage' }, 'Funding created - update its stage as progress is made'));
        }
        case 'update-funding-stage': {
          const opportunityOps = require('../core/opportunity-ops.cjs');
          let stageData;
          try {
            stageData = section ? JSON.parse(section) : {};
          } catch (_e) {
            return textResponse('Invalid JSON in section parameter for update-funding-stage', true);
          }
          if (!stageData.slug || !stageData.stage) {
            return textResponse('update-funding-stage requires { slug, stage, note? } in section parameter', true);
          }
          // Same frozen-roomDir misroute as file-opportunity: re-resolve live.
          const targetDir = resolveWriteTargetDir(sessionId, roomDir, surface);
          const updateResult = opportunityOps.updateFundingStage(targetDir, stageData.slug, stageData.stage, stageData.note || '');
          await fireCascade(targetDir, command, section, updateResult);
          return textResponse(JSON.stringify(updateResult, null, 2) + formatSuggestedNext('room_state', { command: 'status' }, 'Funding stage updated - check room status for pipeline overview'));
        }
        case 'generate-personas': {
          const personaOps = require('../core/persona-ops.cjs');
          // Phase 265-16 (T-265-72): the DEFAULT is the ROUTE response (writes
          // nothing, no personas/ dir) naming /mos:persona --parallel as the
          // surface that actually reasons. The preview opt-in rides the SAME
          // optional-JSON-via-`section` idiom invoke-persona already uses
          // below (T-265-75: no new key added to this tool's schema) -- pass
          // { "mode": "preview" } in `section` for the labelled template-only
          // quick preview.
          let genOpts;
          try {
            genOpts = section ? JSON.parse(section) : undefined;
          } catch (_e) {
            genOpts = undefined;
          }
          const genResult = personaOps.generatePersonas(roomDir, genOpts);
          await fireCascade(roomDir, command, section, genResult);
          return textResponse(JSON.stringify(genResult, null, 2) + formatSuggestedNext('room_content', { command: 'list-personas' }, 'Routed to /mos:persona --parallel for real six-agent analysis with a cross-agent tension map - list-personas only reads back personas that already exist'));
        }
        case 'list-personas': {
          const personaOps = require('../core/persona-ops.cjs');
          const personas = personaOps.listPersonas(roomDir);
          return textResponse(JSON.stringify(personas, null, 2) + formatSuggestedNext('room_content', { command: 'invoke-persona' }, 'Personas available - invoke one for a specific perspective on your venture'));
        }
        case 'invoke-persona': {
          const personaOps = require('../core/persona-ops.cjs');
          let invokeParams;
          try {
            invokeParams = section ? JSON.parse(section) : {};
          } catch (_e) {
            invokeParams = { hat: section };
          }
          if (!invokeParams.hat) {
            return textResponse('invoke-persona requires a hat color. Pass { "hat": "black", "artifact": "path" } in section parameter.', true);
          }
          const invokeResult = personaOps.invokePersona(roomDir, invokeParams.hat, invokeParams.artifact || null);
          await fireCascade(roomDir, command, section, invokeResult);
          return textResponse(JSON.stringify(invokeResult, null, 2) + formatSuggestedNext('room_content', { command: 'analyze-perspectives' }, 'Persona invoked - run full perspective analysis for all hats'));
        }
        case 'analyze-perspectives': {
          const personaOps = require('../core/persona-ops.cjs');
          let analyzeParams;
          try {
            analyzeParams = section ? JSON.parse(section) : {};
          } catch (_e) {
            analyzeParams = { artifact: section };
          }
          // Phase 130-03: analyzeAllPerspectives delegates to the lens-engine
          // rotation loop and is async; await it.
          const analyzeResult = await personaOps.analyzeAllPerspectives(roomDir, analyzeParams.artifact || null);
          return textResponse(JSON.stringify(analyzeResult, null, 2) + formatSuggestedNext('room_state', { command: 'analyze' }, 'All perspectives analyzed - check room for new cross-section patterns'));
        }
        default:
          return textResponse(`Unknown room_content command: ${command}`, true);
      }
    }
  );

  // -------------------------------------------------------------------------
  // 3. room_graph - knowledge graph, Minto reasoning, visualization (13 cmds)
  // -------------------------------------------------------------------------
  server.tool(
    'room_graph',
    "Operate on the room's own knowledge graph: build and repair it (graph-index, graph-rebuild), interrogate it (graph-query, graph-stats), work the Minto reasoning layer over it (reasoning-get, reasoning-generate, reasoning-verify, reasoning-run, reasoning-list, reasoning-frontmatter), and render it (visualize-room, visualize-graph, visualize-chain). Prefer this over the standalone graph_query tool for anything beyond a single read: graph_query only answers a query, while this router also builds, verifies, explains, and draws the graph.",
    {
      command: z.enum(ROOM_GRAPH_COMMANDS)
        .describe('Graph/reasoning/visualization operation'),
      section: sectionOptional
        .describe('Section name, file path, SQL query, or JSON params'),
      query: z.string().optional()
        .describe('SQL query for graph-query command'),
    },
    async ({ command, section, query }) => {
      switch (command) {
        case 'graph-index': {
          const graphOps = require('../core/graph-ops.cjs');
          if (!section) {
            return textResponse('graph-index requires a file path in the section parameter', true);
          }
          const indexResult = await graphOps.indexArtifact(roomDir, section);
          await fireCascade(roomDir, command, section, indexResult);
          return textResponse(JSON.stringify(indexResult, null, 2) + formatSuggestedNext('room_graph', { command: 'graph-stats' }, 'Artifact indexed - check graph stats for new relationship patterns'));
        }
        case 'graph-rebuild': {
          const graphOps = require('../core/graph-ops.cjs');
          const rebuildResult = await graphOps.rebuildGraph(roomDir);
          await fireCascade(roomDir, command, section, rebuildResult);
          return textResponse(JSON.stringify(rebuildResult, null, 2) + formatSuggestedNext('room_graph', { command: 'graph-stats' }, 'Graph rebuilt - review stats to verify relationship coverage'));
        }
        case 'graph-query': {
          const graphOps = require('../core/graph-ops.cjs');
          const queryStr = query || section;
          if (!queryStr) {
            return textResponse(
              'graph-query requires a SQL query in the query or section parameter.\n\n' +
              '## SQLite LazyGraph Schema Reference\n' +
              'Tables:\n' +
              '- nodes(id TEXT PK, type TEXT, properties TEXT JSON)\n' +
              '  Node types: Artifact, Section, CausalClaim, WhitespaceZone\n' +
              '  Artifact properties: title, section, methodology, created, content_hash\n' +
              '  Section properties: name, label\n\n' +
              '- edges(source TEXT, target TEXT, type TEXT, properties TEXT JSON)\n' +
              '  PK: (source, target, type)\n\n' +
              'Edge types:\n' +
              '- INFORMS (Artifact -> Artifact) - cross-section references via [[wikilinks]]\n' +
              '- CONTRADICTS (Artifact -> Artifact, confidence) - conflicting claims\n' +
              '- CONVERGES (Artifact -> Artifact, term) - themes in 3+ sections\n' +
              '- ENABLES (Artifact -> Artifact) - unblocks another artifact\n' +
              '- INVALIDATES (Artifact -> Artifact) - makes another claim stale\n' +
              '- BELONGS_TO (Artifact -> Section) - section membership\n\n' +
              'Example: SELECT n1.id, n2.id FROM edges e JOIN nodes n1 ON n1.id=e.source JOIN nodes n2 ON n2.id=e.target WHERE e.type=\'CONTRADICTS\'',
              true
            );
          }
          const queryResult = await graphOps.queryGraph(roomDir, queryStr);
          return textResponse(JSON.stringify(queryResult, null, 2) + formatSuggestedNext('room_graph', { command: 'visualize-graph' }, 'Query results returned - visualize the graph to see structural patterns'));
        }
        case 'graph-stats': {
          const graphOps = require('../core/graph-ops.cjs');
          const statsResult = await graphOps.graphStats(roomDir);
          return textResponse(JSON.stringify(statsResult, null, 2) + formatSuggestedNext('room_state', { command: 'analyze' }, 'Graph stats reviewed - analyze room for actionable intelligence'));
        }
        case 'reasoning-get': {
          const reasoningOps = require('../core/reasoning-ops.cjs');
          if (!section) return textResponse('reasoning-get requires a section name in the section parameter', true);
          const getResult = reasoningOps.getReasoning(roomDir, section);
          return textResponse(JSON.stringify(getResult, null, 2) + formatSuggestedNext('room_graph', { command: 'reasoning-verify', section }, 'Reasoning retrieved - verify its structural integrity'));
        }
        case 'reasoning-generate': {
          const reasoningOps = require('../core/reasoning-ops.cjs');
          const genResult = reasoningOps.generateReasoning(roomDir, section || null);
          await fireCascade(roomDir, command, section, genResult);
          return textResponse(JSON.stringify(genResult, null, 2) + formatSuggestedNext('room_graph', { command: 'graph-index' }, 'Reasoning filed - index for cross-reference discovery'));
        }
        case 'reasoning-verify': {
          const reasoningOps = require('../core/reasoning-ops.cjs');
          if (!section) return textResponse('reasoning-verify requires a section name in the section parameter', true);
          const verifyResult = reasoningOps.verifyReasoning(roomDir, section);
          return textResponse(JSON.stringify(verifyResult, null, 2) + formatSuggestedNext('room_graph', { command: 'reasoning-run', section }, 'Reasoning verified - create a reasoning run to track execution'));
        }
        case 'reasoning-run': {
          const reasoningOps = require('../core/reasoning-ops.cjs');
          if (!section) return textResponse('reasoning-run requires a section name in the section parameter', true);
          const runResult = reasoningOps.createRun(roomDir, section);
          return textResponse(JSON.stringify(runResult, null, 2) + formatSuggestedNext('room_state', { command: 'analyze' }, 'Reasoning run created - analyze room for updated intelligence'));
        }
        case 'reasoning-list': {
          const reasoningOps = require('../core/reasoning-ops.cjs');
          const listResult = reasoningOps.listReasoning(roomDir);
          return textResponse(JSON.stringify(listResult, null, 2) + formatSuggestedNext('room_graph', { command: 'reasoning-get' }, 'Reasoning files listed - get a specific one for detailed review'));
        }
        case 'reasoning-frontmatter': {
          const reasoningOps = require('../core/reasoning-ops.cjs');
          if (!section) return textResponse('reasoning-frontmatter requires a section name or JSON in the section parameter', true);
          let fmParams;
          try {
            fmParams = JSON.parse(section);
          } catch (_e) {
            const fmResult = reasoningOps.getReasoningFrontmatter(roomDir, section);
            return textResponse(JSON.stringify(fmResult, null, 2) + formatSuggestedNext('room_graph', { command: 'reasoning-verify', section }, 'Frontmatter retrieved - verify reasoning structure'));
          }
          const { action, section: fmSection, field, value } = fmParams;
          let fmResult;
          switch (action) {
            case 'set':
              fmResult = reasoningOps.setReasoningFrontmatter(roomDir, fmSection, field, value);
              break;
            case 'merge':
              fmResult = reasoningOps.mergeReasoningFrontmatter(roomDir, fmSection, fmParams);
              break;
            case 'get':
            default:
              fmResult = reasoningOps.getReasoningFrontmatter(roomDir, fmSection, field || null);
              break;
          }
          return textResponse(JSON.stringify(fmResult, null, 2) + formatSuggestedNext('room_graph', { command: 'reasoning-verify', section: fmSection }, 'Frontmatter updated - verify reasoning integrity'));
        }
        case 'visualize-room': {
          const visualOps = require('../core/visual-ops.cjs');
          // Phase 87-04: async entry point; MCP handler is already async so
          // awaiting listSections is free. See 87-04 for sync/async split.
          const roomOpsViz = require('../core/room-ops-async.cjs');
          const stateOpsViz = require('../core/state-ops.cjs');
          let sections = [];
          try {
            const sectionData = await roomOpsViz.listSections(roomDir);
            let stage = 'discovery';
            try {
              const stContent = stateOpsViz.getState(roomDir);
              if (stContent) {
                const sm = stContent.match(/venture_stage:\s*(.+)/);
                if (sm) stage = sm[1].trim();
              }
            } catch (_e) {}
            if (sectionData && sectionData.sections) {
              sections = sectionData.sections.map(s => ({
                name: s.name || s,
                entryCount: s.entryCount || s.entries || 0,
                stage: stage,
                edges: s.edges || []
              }));
            }
          } catch (_e) {}
          if (sections.length === 0) {
            sections = [{ name: 'No room data', entryCount: 0, stage: 'discovery', edges: [] }];
          }
          const roomMermaid = visualOps.generateMermaidRoom(sections);
          return textResponse(visualOps.generateMermaidBlock(roomMermaid) + formatSuggestedNext('room_graph', { command: 'visualize-graph' }, 'Room structure visualized - see the knowledge graph relationships'));
        }
        case 'visualize-graph': {
          const visualOps = require('../core/visual-ops.cjs');
          const graphOpsViz = require('../core/graph-ops.cjs');
          let nodes = [];
          let edges = [];
          try {
            const stats = await graphOpsViz.graphStats(roomDir);
            if (stats && stats.nodes) { nodes = stats.nodes; edges = stats.edges || []; }
          } catch (_e) {}
          if (nodes.length === 0) {
            nodes = [{ id: 'empty', type: 'Section', label: 'No graph data' }];
          }
          const graphMermaid = visualOps.generateMermaidGraph(nodes, edges);
          return textResponse(visualOps.generateMermaidBlock(graphMermaid) + formatSuggestedNext('room_graph', { command: 'graph-query' }, 'Graph visualized - query for specific relationship patterns'));
        }
        case 'visualize-chain': {
          const visualOps = require('../core/visual-ops.cjs');
          const chainSteps = [
            { name: 'Diagnose', framework: 'diagnose', status: 'pending' },
            { name: 'Framework', framework: '', status: 'pending' },
            { name: 'Apply', framework: '', status: 'pending' },
            { name: 'File', framework: '', status: 'pending' },
            { name: 'Cross-ref', framework: '', status: 'pending' },
            { name: 'Graph Update', framework: '', status: 'pending' }
          ];
          const rfs = require('fs');
          const rpath = require('path');
          if (section) {
            try {
              // 87-05: safeResolveSection guards against path traversal even if
              // a malformed section string bypassed the Zod regex at the MCP edge.
              const sectionDir = safeResolveSection(roomDir, section);
              const reasonDir = rpath.join(sectionDir, '.reasoning');
              if (rfs.existsSync(reasonDir)) {
                const runs = rfs.readdirSync(reasonDir).filter(f => f.endsWith('.md')).sort().reverse();
                if (runs.length > 0) {
                  const content = rfs.readFileSync(rpath.join(reasonDir, runs[0]), 'utf-8');
                  const stepMatches = content.match(/##\s+Step\s+\d+[^#]*/g) || [];
                  if (stepMatches.length > 0) {
                    chainSteps.length = 0;
                    stepMatches.forEach((blk, i) => {
                      const nm = blk.match(/##\s+Step\s+\d+:\s*(.+)/);
                      const fw = blk.match(/framework:\s*(.+)/i);
                      const st = blk.match(/status:\s*(.+)/i);
                      chainSteps.push({
                        name: nm ? nm[1].trim() : `Step ${i + 1}`,
                        framework: fw ? fw[1].trim() : '',
                        status: st ? st[1].trim() : 'pending'
                      });
                    });
                  }
                }
              }
            } catch (_e) {}
          }
          const chainMermaid = visualOps.generateMermaidChain(chainSteps);
          return textResponse(visualOps.generateMermaidBlock(chainMermaid) + formatSuggestedNext('room_state', { command: 'suggest-next' }, 'Chain visualized - get framework recommendation for next step'));
        }
        // I-1 fix: removed dead cases (detect-integrations, suggest-next, new-project,
        // setup, update, help) that are unreachable -- not in ROOM_GRAPH_COMMANDS z.enum.
        // These commands are handled by room_state and orchestration routers.
        default:
          return textResponse(`Unknown room_graph command: ${command}`, true);
      }
    }
  );

  // -------------------------------------------------------------------------
  // 4. methodology - PWS innovation frameworks (14 commands)
  // -------------------------------------------------------------------------
  server.tool(
    'methodology',
    'Run a PWS innovation methodology framework. Larry guides you through the selected framework and files results to your Data Room.',
    {
      command: z.enum(METHODOLOGY_COMMANDS)
        .describe('Which methodology to run'),
      context: z.string().optional()
        .describe('Focus area or venture aspect'),
      section: sectionOptional
        .describe('Section to focus on'),
    },
    async ({ command, context, section }) => {
      const response = buildContext(pluginRoot, roomDir, command, context);

      // Record step in pipeline state and generate Pipeline Context header
      const outputPath = section
        ? `${section}/${command}-output.md`
        : `methodology/${command}-output.md`;
      const updatedState = pipelineState.recordStep(roomDir, command, outputPath);
      const pipelineCtx = pipelineState.formatPipelineContext(roomDir, command, outputPath);

      // Use pipeline-aware suggested next if available, otherwise default
      let suggestedNext;
      if (updatedState.suggested_next) {
        // Determine which router group the next tool belongs to
        const nextTool = updatedState.suggested_next;
        const routerGroup = ANALYSIS_COMMANDS.includes(nextTool) ? 'analysis'
          : METHODOLOGY_COMMANDS.includes(nextTool) ? 'methodology'
          : INTELLIGENCE_COMMANDS.includes(nextTool) ? 'intelligence'
          : 'room_state';
        const nextArgs = routerGroup === 'room_state'
          ? { command: 'analyze' }
          : { command: nextTool };
        suggestedNext = formatSuggestedNext(routerGroup, nextArgs, `Pipeline step ${updatedState.chain_position + 2} of ${updatedState.chain.length} - run ${nextTool} next`);
      } else {
        suggestedNext = formatSuggestedNext('room_state', { command: 'analyze' }, 'Methodology complete - analyze room to detect new patterns from this framework');
      }

      return textResponse(response + pipelineCtx + suggestedNext);
    }
  );

  // -------------------------------------------------------------------------
  // 5. analysis - systems analysis and trend exploration (13 commands)
  // -------------------------------------------------------------------------
  server.tool(
    'analysis',
    'Run structured analysis over a venture or the system around it: analyze-systems, analyze-timing, find-bottlenecks, root-cause, systems-thinking, the trend family (macro-trends, explore-trends, explore-futures, dominant-designs, scenario-plan), and the causal family (causal-extract, causal-trace, causal-predict). Reach for this when the question is HOW something works, WHERE it breaks, or WHAT follows from it. Use the intelligence tool instead when the question is HOW GOOD something is, since that one returns a calibrated assessment rather than a structural map.',
    {
      command: z.enum(ANALYSIS_COMMANDS)
        .describe('Which analysis to run'),
      context: z.string().optional()
        .describe('Focus area or system boundary'),
      section: sectionOptional
        .describe('Section to focus on'),
    },
    async ({ command, context, section }) => {
      // Record step in pipeline state
      const outputPath = section
        ? `${section}/${command}-output.md`
        : `analysis/${command}-output.md`;
      const updatedState = pipelineState.recordStep(roomDir, command, outputPath);
      const pipelineCtx = pipelineState.formatPipelineContext(roomDir, command, outputPath);

      // Pipeline-aware suggested next: prefer chain ordering over hardcoded patterns
      let suggestedNext;
      if (updatedState.suggested_next) {
        const nextTool = updatedState.suggested_next;
        const routerGroup = ANALYSIS_COMMANDS.includes(nextTool) ? 'analysis'
          : METHODOLOGY_COMMANDS.includes(nextTool) ? 'methodology'
          : INTELLIGENCE_COMMANDS.includes(nextTool) ? 'intelligence'
          : 'room_state';
        const nextArgs = routerGroup === 'room_state'
          ? { command: 'analyze' }
          : { command: nextTool };
        suggestedNext = formatSuggestedNext(routerGroup, nextArgs, `Pipeline step ${updatedState.chain_position + 2} of ${updatedState.chain.length} - run ${nextTool} next`);
      } else if (command === 'scenario-plan') {
        suggestedNext = formatSuggestedNext('analysis', { command: 'root-cause' }, 'Scenarios mapped - identify root causes of key risks');
      } else if (command === 'root-cause') {
        suggestedNext = formatSuggestedNext('analysis', { command: 'causal-trace' }, 'Root causes identified - trace causal chains for deeper understanding');
      } else if (command === 'causal-extract') {
        suggestedNext = formatSuggestedNext('analysis', { command: 'causal-trace' }, 'Causal factors extracted - trace their chain of influence');
      } else if (command === 'causal-trace') {
        suggestedNext = formatSuggestedNext('analysis', { command: 'causal-predict' }, 'Causal chains traced - predict outcomes based on these chains');
      } else if (command === 'causal-predict') {
        suggestedNext = formatSuggestedNext('room_state', { command: 'analyze' }, 'Predictions generated - analyze room to integrate causal intelligence');
      } else {
        suggestedNext = formatSuggestedNext('room_state', { command: 'analyze' }, 'Analysis complete - check room for new intelligence patterns');
      }
      const response = buildContext(pluginRoot, roomDir, command, context);
      return textResponse(response + pipelineCtx + suggestedNext);
    }
  );

  // -------------------------------------------------------------------------
  // 6. intelligence - connections, grading, research (7 commands)
  //    + 3 eureka compute subcommands (eureka-run/status/report, NOT in the
  //      64-command parity set -- they register on this enum only, D-A)
  // -------------------------------------------------------------------------
  server.tool(
    'intelligence',
    'Run intelligence operations: find connections, grade ventures, build thesis, research. Larry evaluates with calibrated assessment.',
    {
      command: z.enum([...INTELLIGENCE_COMMANDS, ...EUREKA_COMPUTE_COMMANDS])
        .describe('Which intelligence operation to run'),
      context: z.string().optional()
        .describe('Focus area or evaluation target'),
    },
    async ({ command, context }, extra) => {
      // Quick-260717-2vf: the eureka portfolio-scan compute branch. It runs the ONE
      // governed dispatcher scripts/eureka-command.cjs main(argv) IN-PROCESS on the
      // resident daemon (http transport) so embedding-spine.cjs's module-level
      // _pipelineCache stays warm across scans, and detaches a child on stdio (where
      // process.stdout IS the JSON-RPC channel and an in-process runner would corrupt
      // it). Fire-and-return with status-poll observability, mirroring the CLI
      // start/status/report contract. See D-A..D-H at the top of the plan.
      if (EUREKA_COMPUTE_COMMANDS.includes(command)) {
        const fs = require('node:fs');
        // D-F: the room dir resolves ONLY through the one existing session-aware
        // door (no new room parameter, no second guesser). extra.sessionId mirrors
        // the room_state precedent; `surface` is registerRouterTools' own 5th param.
        const sessionId = resolveEffectiveSessionId(undefined, extra);
        const targetDir = resolveWriteTargetDir(sessionId, roomDir, surface);
        const p = eurekaPaths(targetDir);

        // D-G: flags ride the `context` string as optional JSON, the invoke-persona
        // try-parse precedent. Non-JSON or absent context means no flags (CLI defaults).
        let flags = {};
        try { flags = context ? JSON.parse(context) : {}; } catch (_e) { flags = {}; }
        if (!flags || typeof flags !== 'object') flags = {};
        const flagArgv = [];
        if (typeof flags.top === 'number' && Number.isFinite(flags.top) && flags.top > 0) flagArgv.push('--top', String(flags.top));
        if (flags.offline) flagArgv.push('--offline');
        if (typeof flags.graph === 'string' && flags.graph.length > 0) flagArgv.push('--graph', flags.graph);
        if (flags.noExtract) flagArgv.push('--no-extract');

        if (command === 'eureka-status') {
          // D-E: return the status.json content verbatim, or {"state":"none"} on a
          // missing/corrupt file (cmdStatus's exact fallback).
          let parsed = null;
          try { parsed = JSON.parse(fs.readFileSync(p.status, 'utf8')); } catch (_e) { parsed = null; }
          if (parsed) {
            const done = parsed.state === 'done';
            const nextArgs = done ? { command: 'eureka-report' } : { command: 'eureka-status' };
            const nextWhy = done ? 'Scan complete - fetch the report' : 'Scan not finished - poll again';
            return textResponse(JSON.stringify(parsed) + formatSuggestedNext('intelligence', nextArgs, nextWhy));
          }
          return textResponse(JSON.stringify({ state: 'none' }) + formatSuggestedNext('intelligence', { command: 'eureka-status' }, 'No scan on record - start one with eureka-run, then poll'));
        }

        if (command === 'eureka-report') {
          // D-E: return the report JSON file content verbatim (the CLI prints the raw
          // file -- no re-stringify), or the 3-line What/Why/Fix no-report error.
          let content = null;
          try { content = fs.readFileSync(p.json, 'utf8'); } catch (_e) { content = null; }
          if (content === null) {
            return textResponse(
              'eureka: no eureka report yet\n  Why: no completed scan for this room\n  Fix: run eureka-run (or /mos:eureka)',
              true
            );
          }
          return textResponse(content + formatSuggestedNext('room_state', { command: 'analyze' }, 'Report retrieved - analyze the room to fold these opportunities into its intelligence'));
        }

        // command === 'eureka-run'
        // D-F guard 1: fire-and-return makes an async early failure invisible, so the
        // missing-room check runs SYNCHRONOUSLY, BEFORE firing (cmdRun's triple).
        if (!fs.existsSync(targetDir)) {
          return textResponse(
            'eureka: room directory not found\n  Why: ' + String(targetDir) + ' is not a directory\n  Fix: pass a valid room path, or run /mos:new-project',
            true
          );
        }
        // D-D guard 2: one scan per room at a time.
        if (_eurekaScanInFlight.has(targetDir)) {
          const inflight = _eurekaScanInFlight.get(targetDir);
          return textResponse(JSON.stringify({
            state: 'already_running',
            started_at: (inflight && inflight.started_at) || null,
            status: p.status,
          }));
        }
        // D-C: the per-call TRANSPORT gate (the load-bearing stdout-protocol safety).
        const transport = require('./surface-detect.cjs').detectSurface().transport;
        let mode;
        if (transport === 'http') {
          // Warm-daemon residency: the FIRST lazy require pulls eureka-command.cjs +
          // eureka-portfolio-report.cjs + embedding-spine.cjs into THIS daemon's
          // require cache, which is the warm _pipelineCache mechanism itself. Fire
          // UN-awaited (fire-and-return) with a .catch() so a rejection can never
          // crash the daemon (cmdRun already writes a failed status.json internally;
          // the catch is belt-and-braces), and clear the in-flight entry in .finally().
          _eurekaScanInFlight.set(targetDir, { started_at: new Date().toISOString() });
          const eurekaCommand = require('../../scripts/eureka-command.cjs');
          eurekaCommand.main([targetDir, 'run'].concat(flagArgv)).catch(() => {}).finally(() => { _eurekaScanInFlight.delete(targetDir); });
          mode = 'in-process';
        } else {
          // stdio (Desktop, flag-OFF CLI): the runner writes progress to process.stdout
          // (eureka-portfolio-report.cjs lines ~1180/1197/1337), and stdout IS the
          // JSON-RPC channel on stdio transport -- an in-process scan would corrupt the
          // protocol mid-session. So detach a child exactly like today's CLI `start`
          // (detached, stdio 'ignore'): same status.json observability, zero protocol
          // risk. The warm-cache win is scoped to the resident daemon by design.
          const { spawn } = require('node:child_process');
          const child = spawn(
            process.execPath,
            [path.join(pluginRoot, 'scripts', 'eureka-command.cjs'), targetDir, 'run'].concat(flagArgv),
            { detached: true, stdio: 'ignore' }
          );
          child.unref();
          mode = 'detached';
        }
        return textResponse(JSON.stringify({
          state: 'started',
          mode: mode,
          status: p.status,
          report_md: p.md,
          report_json: p.json,
        }) + formatSuggestedNext('intelligence', { command: 'eureka-status' }, 'Eureka scan started - poll eureka-status until state is done, then eureka-report'));
      }

      // intern-w1-research-reach-broken: research is a fetch operation, not a
      // reasoning-only doc+state echo like its INTELLIGENCE_COMMANDS siblings
      // (grade, whitespace, etc.) - it needs its own pipeline, not buildContext().
      if (command === 'research') {
        const researchOutput = await runResearchPipeline(roomDir, context || '');
        const nextResearch = formatSuggestedNext('room_state', { command: 'analyze' }, 'Research findings surfaced - review and file, then analyze room for new intelligence patterns');
        return textResponse(researchOutput + nextResearch);
      }
      let assessmentExtra = '';
      if (command === 'grade' || command === 'deep-grade') {
        const assessment = safeReadFile(path.join(pluginRoot, 'references', 'personality', 'assessment-philosophy.md'));
        if (assessment) assessmentExtra = `\n### Assessment Philosophy\n${assessment}`;
      }
      let suggestedNext;
      if (command === 'grade') {
        suggestedNext = formatSuggestedNext('intelligence', { command: 'deep-grade' }, 'Quick grade done - run deep grade for detailed component feedback');
      } else if (command === 'deep-grade') {
        suggestedNext = formatSuggestedNext('room_state', { command: 'analyze' }, 'Deep grade complete - analyze room to see grading impact on intelligence');
      } else {
        suggestedNext = formatSuggestedNext('room_state', { command: 'analyze' }, 'Intelligence operation complete - analyze room for new patterns');
      }
      return textResponse(buildContext(pluginRoot, roomDir, command, context) + assessmentExtra + suggestedNext);
    }
  );

  // -------------------------------------------------------------------------
  // 7. meeting - meeting filing, pipeline, speakers (3 commands)
  // -------------------------------------------------------------------------
  server.tool(
    'meeting',
    'Turn a raw meeting transcript into structured Data Room content. This tool returns protocol and room context only; it writes nothing itself, so call artifact_file to actually file what it hands back. file-meeting returns the Claimify filing protocol plus room state, pipeline returns the meeting-intelligence pipeline reference, and speakers returns the speaker-identification reference. For the fuller path that performs the extraction and the typed-claim write directly, use /mos:file-meeting on the CLI. Reach for this whenever the user pastes or points at a conversation: institutional knowledge lives in meetings rather than documents.',
    {
      command: z.enum(MEETING_COMMANDS)
        .describe('Meeting operation'),
      context: z.string().optional()
        .describe('Meeting transcript, date, or context'),
    },
    async ({ command, context }) => {
      const state = loadRoomState(roomDir);

      if (command === 'file-meeting') {
        const meetingRef = safeReadFile(path.join(pluginRoot, 'references', 'meeting', 'filing-protocol.md'));
        const parts = [
          '## File Meeting (reference only, nothing written)',
          noWriteBanner('Nothing is written here; call artifact_file to actually file this content into the room.'),
        ];
        if (state) parts.push(`\n### Room State\n${state}`);
        if (meetingRef) {
          parts.push(`\n### Filing Protocol\n${meetingRef}`);
        } else {
          parts.push('\n### Filing Protocol\n> references/meeting/filing-protocol.md was not found on disk. The calling model has no protocol to follow for this call.');
        }
        if (context) parts.push(`\n### Transcript/Context\n${context}`);
        if (!context) parts.push('\n> Provide a meeting transcript to file.');
        const response = parts.join('\n');
        // Quick 260903-kwl: fireCascade's empty filePath is pre-existing
        // cascade-dispatch behavior (noted as odd in the RCA) and not a write
        // path itself; changing it is out of this pass's scope.
        await fireCascade(roomDir, command, null, { filePath: '' });
        return textResponse(response + formatSuggestedNext('artifact_file', {}, 'Protocol and room context returned, nothing filed - call artifact_file first to persist any of it'));
      }

      if (command === 'pipeline') {
        const pipelineRef = safeReadFile(path.join(pluginRoot, 'references', 'pipeline', 'index.md'))
          || safeReadFile(path.join(pluginRoot, 'commands', 'pipeline.md'));
        const parts = [
          '## Pipeline',
          noWriteBanner('Nothing is written here; call artifact_file to file anything derived from this reference.'),
        ];
        if (state) parts.push(`\n### Room State\n${state}`);
        if (pipelineRef) {
          parts.push(`\n### Reference\n${pipelineRef}`);
        } else {
          parts.push('\n### Reference\n> No pipeline reference was found on disk (checked references/pipeline/index.md and commands/pipeline.md).');
        }
        if (context) parts.push(`\n### Context\n${context}`);
        return textResponse(parts.join('\n') + formatSuggestedNext('meeting', { command: 'file-meeting' }, 'Pipeline reviewed - file a meeting to feed the intelligence pipeline'));
      }

      if (command === 'speakers') {
        const speakersRef = loadReference(pluginRoot, 'speakers');
        const parts = [
          '## Speakers',
          noWriteBanner('Nothing is written here; call artifact_file to file anything derived from this reference.'),
        ];
        if (state) parts.push(`\n### Room State\n${state}`);
        if (speakersRef) {
          parts.push(`\n### Reference\n${speakersRef}`);
        } else {
          parts.push('\n### Reference\n> No speaker-identification reference was found on disk.');
        }
        if (context) parts.push(`\n### Context\n${context}`);
        else parts.push('\n> Provide meeting text or speaker context.');
        return textResponse(parts.join('\n') + formatSuggestedNext('meeting', { command: 'file-meeting' }, 'Reference returned, no identification performed - file the meeting to route segments to sections'));
      }

      return textResponse(`Unknown meeting command: ${command}`, true);
    }
  );

  // -------------------------------------------------------------------------
  // 8. export - dashboards, wikis, presentations, snapshots (7 commands)
  // -------------------------------------------------------------------------
  server.tool(
    'export',
    'Return the export operation instructions plus current room context; this handler does not itself render anything. Run the matching CLI command for the format you chose (/mos:export, /mos:dashboard, /mos:wiki, /mos:present, /mos:radar, /mos:publish, or /mos:snapshot) to actually produce the artifact. Choose by audience: dashboard for a single-screen status view, wiki for a browsable cross-linked reference, present for a slide deck, radar for a scored-dimension chart, snapshot for a frozen point-in-time copy, publish to push an artifact outward, and export for a plain data dump. Reach for this only once the room has content worth showing, because every format reads from existing entries and invents nothing on its own.',
    {
      command: z.enum(EXPORT_COMMANDS)
        .describe('Export operation'),
      context: z.string().optional()
        .describe('Export options or context'),
      format: z.string().optional()
        .describe('Export format (e.g., html, pdf, md)'),
    },
    async ({ command, context, format }) => {
      const ref = loadReference(pluginRoot, command);
      const state = loadRoomState(roomDir);
      // Task 2 of 276-08 (F-2..F-8). Sentence 1's old "Render what is already
      // filed..." claim described a capability this handler does not have:
      // the branch below is loadReference + loadRoomState + echoes, exactly
      // the same reference-echo shape as the `meeting` fix's branches
      // (:1395, :1418, :1434). Leads with the shipped noWriteBanner() marker
      // naming the real per-format write path, same as those branches.
      const parts = [
        `## ${command}`,
        noWriteBanner(`Nothing is rendered here; run /mos:${command} on the CLI to actually produce the artifact.`),
      ];
      if (state) parts.push(`\n### Room State\n${state}`);
      if (ref) parts.push(`\n### Reference\n${ref}`);
      else parts.push(`\n> Reference file for "${command}" not found.`);
      if (context) parts.push(`\n### Context\n${context}`);
      if (format) parts.push(`\n### Format\n${format}`);

      // Task 2 of 276-08 (F-2..F-8) closed three false completion
      // assertions here, each claiming a render that never happened: the
      // snapshot branch's old "[artifact] generated" rationale, the
      // dashboard branch's matching one, and the fallback's "export
      // complete" claim. Honest template from the orchestration fallback
      // (:1659): instructions returned, run them, then verify.
      let suggestedNext;
      if (command === 'snapshot') {
        suggestedNext = formatSuggestedNext('export', { command: 'publish' }, 'Instructions returned - run /mos:snapshot, then verify the snapshot file exists before publishing it');
      } else if (command === 'dashboard') {
        suggestedNext = formatSuggestedNext('export', { command: 'wiki' }, 'Instructions returned - run /mos:dashboard, then verify it opened before creating a wiki for deeper navigation');
      } else {
        suggestedNext = formatSuggestedNext('room_state', { command: 'status' }, `Instructions returned - run /mos:${command}, then check room status to confirm the artifact now exists`);
      }
      return textResponse(parts.join('\n') + suggestedNext);
    }
  );

  // -------------------------------------------------------------------------
  // 9. orchestration - autonomous execution, rooms, scout, admin (20 commands)
  // -------------------------------------------------------------------------
  server.tool(
    'orchestration',
    'Manage rooms (rooms-list, rooms-new, rooms-open, rooms-close, rooms-archive, rooms-where), run scout intelligence (scout, scout-health, scout-deadlines, scout-competitors, scout-hsi, scout-snapshot), and handle admin, onboarding, models and scheduled tasks. rooms-open genuinely switches the active room. scout and its variants only return the scout reference plus current room context, not gathered intelligence; run /mos:scout on the CLI for the real scan (a .snapshots/ state capture, a competitor report, the HSI pipeline). Treat act, act-chain and act-swarm differently: they execute multi-step work with little supervision, so prefer act-dry-run first and do not invoke them for a decision the user has not already framed.',
    {
      command: z.enum(ORCHESTRATION_COMMANDS)
        .describe('Orchestration operation'),
      context: z.string().optional()
        .describe('Operation context or parameters'),
      room: z.string().optional()
        .describe('Room name or path for room operations'),
      confirmArchived: z.boolean().optional()
        .describe('rooms-open only: the human has confirmed reopening an ARCHIVED room (commands/rooms.md open, Step 2). Without this, opening an archived room is refused rather than performed silently.'),
    },
    async ({ command, context, room, confirmArchived }, extra) => {
      // Brain-driven act* commands use brain-router
      //
      // Phase 254 (COMP-01): this dispatch is enumerated in
      // lib/mcp/brain-composition-census.cjs as the 'orchestration dispatch'
      // site -- reaches_brain: false (indirect; the actual Brain call is
      // one hop downstream in brain-router.cjs's Tier 3, also
      // census-declared with reaches_brain: true). A new composed Brain
      // call anywhere under lib/mcp/ requires an entry there or the build
      // fails (tests/test-254-composition-census.cjs).
      if (command === 'act' || command === 'act-chain' || command === 'act-dry-run' || command === 'act-swarm') {
        const brainRouter = require('./brain-router.cjs');
        const rec = await brainRouter.recommend(roomDir, { intent: context || 'general' });

        if (command === 'act') {
          try { pipelineState.initChain(roomDir, rec.chain, rec.source || 'local'); } catch (_e) {}
          const parts = [
            `## Framework Recommendation`,
            `\n**Chain:** ${rec.chain.join(' -> ')}`,
            `**Confidence:** ${(rec.confidence * 100).toFixed(0)}%`,
            `**Source:** ${rec.source}`,
            `**Reasoning:** ${rec.reasoning}`,
          ];
          const ref = loadReference(pluginRoot, rec.chain[0]);
          if (ref) parts.push(`\n### First Framework Reference\n${ref}`);
          return textResponse(parts.join('\n') + formatSuggestedNext('methodology', { command: rec.chain[0], context: rec.reasoning }, `Run ${rec.chain[0]} as recommended`));
        }
        if (command === 'act-chain') {
          try { pipelineState.initChain(roomDir, rec.chain, rec.source || 'local'); } catch (_e) {}
          const chainSteps = rec.chain.map((m, i) => `${i + 1}. **${m}**`).join('\n');
          return textResponse(`## Framework Chain\n\n**Full Sequence:**\n${chainSteps}\n\n**Confidence:** ${(rec.confidence * 100).toFixed(0)}%\n**Source:** ${rec.source}\n**Reasoning:** ${rec.reasoning}` + formatSuggestedNext('methodology', { command: rec.chain[0] }, 'Start chain with first framework'));
        }
        if (command === 'act-dry-run') {
          const validation = brainRouter.validateChain(roomDir, rec.chain);
          return textResponse(`## Dry Run\n\n**Chain:** ${rec.chain.join(' -> ')}\n**Confidence:** ${(rec.confidence * 100).toFixed(0)}%\n**Source:** ${rec.source}\n**Valid:** ${validation.valid ? 'Yes' : 'No - ' + validation.reason}\n\n> Dry run. No frameworks executed.`);
        }
        if (command === 'act-swarm') {
          try { pipelineState.initChain(roomDir, rec.chain, rec.source || 'local'); } catch (_e) {}
          const ref = loadReference(pluginRoot, 'act');
          const parts = [
            `## Autonomous Swarm Execution`,
            `\n**Chain:** ${rec.chain.join(' -> ')}`,
            `**Confidence:** ${(rec.confidence * 100).toFixed(0)}%`,
            `**Source:** ${rec.source}`,
            `**Reasoning:** ${rec.reasoning}`,
            `\n> Swarm mode: all frameworks in the chain will execute sequentially with automatic artifact filing.`,
          ];
          if (ref) parts.push(`\n### Reference\n${ref}`);
          return textResponse(parts.join('\n') + formatSuggestedNext('room_state', { command: 'status' }, 'Swarm complete - check room status'));
        }
      }

      // -----------------------------------------------------------------
      // rooms-open EXECUTES. It does not describe.
      //
      // RCA rooms-open-false-success (2026-07-27): this command used to fall
      // through to the reference-echo fallback below, which built a
      // confirmation-shaped payload out of (a) commands/rooms.md read off
      // disk, (b) STATE.md from the boot-frozen roomDir closure, and (c) a
      // verbatim echo of the caller's own `room` argument -- then appended
      // "Room operation complete". Not one byte of that derived from an
      // operation, because no operation was ever attempted: a repo-wide grep
      // found ZERO product-code callers of `room-registry set-active`. The
      // MCP surface advertised multi-room management while having no
      // room-switch capability at all.
      //
      // openRoom() is the Canon Part 7 chokepoint that wraps the one
      // authoritative writer and gates ok:true behind a `get-active`
      // read-back. The response below is constructed FROM that verified
      // result, so a success-shaped payload is now structurally impossible
      // without the switch having actually landed.
      // -----------------------------------------------------------------
      if (command === 'rooms-open') {
        const { openRoom } = require('../core/room-open.cjs');
        const result = openRoom({
          room: room,
          sessionId: resolveEffectiveSessionId(undefined, extra) || undefined,
          confirmArchived: confirmArchived === true,
        });

        if (!result.ok) {
          const fixes = {
            no_room_specified: 'Supply the room slug: orchestration({ command: "rooms-open", room: "<slug>" }).',
            invalid_room_slug: 'Room slugs are simple names (no path separators). Run rooms-list to see valid slugs.',
            no_registry: 'No room registry exists yet. Create your first room before switching.',
            room_not_found: 'That room is not in the registry. Run rooms-list to see available rooms.',
            archived_needs_confirmation: 'This room is ARCHIVED. Opening it sets its status back to active. Ask the human to confirm, then retry with confirmArchived: true.',
            set_active_failed: 'The room-registry set-active call did not succeed. The active room is UNCHANGED.',
            verify_failed: 'set-active ran but the registry read-back does not match. The switch did NOT take effect.',
          };
          const failParts = [
            `## rooms-open FAILED`,
            `\n**The active room was NOT changed.**`,
            `\n- **Requested:** ${result.room || '(none)'}`,
            `- **Reason:** \`${result.reason}\``,
          ];
          if (result.active !== undefined) failParts.push(`- **Active room is still:** ${result.active || '(unset)'}`);
          if (result.status) failParts.push(`- **Room status:** ${result.status}`);
          failParts.push(`\n**Fix:** ${fixes[result.reason] || 'Inspect the registry and retry.'}`);
          return textResponse(failParts.join('\n'), true);
        }

        const okParts = [
          `## rooms-open`,
          `\n**Switched to: ${result.active}** (verified against the registry after the write)`,
          `\n- **Previous active room:** ${result.previous || '(none)'}`,
          `- **Status:** active`,
          `- **Session bound:** ${result.session_bound ? 'yes' : 'no (writes fall back to the global active room)'}`,
        ];
        if (result.abs_path) okParts.push(`- **Path:** ${result.abs_path}`);
        // Read the SWITCHED room's state, not the boot-frozen closure's. The
        // wrong-room STATE.md in the old payload was half of why the false
        // success read as plausible.
        const switchedState = result.abs_path ? loadRoomState(result.abs_path) : '';
        if (switchedState) okParts.push(`\n### Room State\n${switchedState}`);
        return textResponse(
          okParts.join('\n')
          + formatSuggestedNext('room_state', { command: 'status' }, 'Room switch verified - check the new room status')
        );
      }

      // All other orchestration commands use reference-based pattern
      const ref = loadReference(pluginRoot, command);
      const state = loadRoomState(roomDir);
      const parts = [`## ${command}`];
      // Same RCA, structural half: rooms-new / rooms-close / rooms-archive are
      // ALSO declared-but-unimplemented state MUTATIONS reaching this same
      // fallback, and they used to receive the same "Room operation complete"
      // assertion. The fallback returns INSTRUCTIONS; saying so out loud is
      // what stops the shared pattern from minting more false successes.
      // These are deliberately not implemented here -- rooms-new has its own
      // open RCA with a different root cause
      // (.planning/debug/intern-w1-rooms-new-silent-fail.md).
      const unimplementedMutation = UNIMPLEMENTED_MUTATING_ORCHESTRATION.has(command);
      if (unimplementedMutation) {
        parts.push(`\n> **NOT EXECUTED.** This returns the \`${command}\` instructions, not a completed operation. Nothing has changed yet. Follow the Reference steps below and verify the result before reporting success.`);
      }
      if (state) parts.push(`\n### Room State\n${state}`);
      if (ref) parts.push(`\n### Reference\n${ref}`);
      if (context) parts.push(`\n### Context\n${context}`);
      if (room) parts.push(`\n### Requested Room (echo of your argument, not a confirmation)\n${room}`);
      if (!ref) parts.push(`\n> Reference file for "${command}" not found.`);

      let suggestedNext;
      if (unimplementedMutation) {
        // Covers rooms-new/rooms-close/rooms-archive AND (F-1) the whole
        // scout family, now that both share the corrected membership rule
        // above. The old `command.startsWith('scout')` branch below this one
        // used to assert "Scout intelligence gathered - analyze room" for
        // every scout* command; that branch is now unreachable (scout* is
        // caught here first) and has been removed rather than left as dead,
        // misleading code a future edit could resurrect by accident.
        suggestedNext = formatSuggestedNext('room_state', { command: 'status' }, 'Instructions returned - run them, then check status to confirm what actually changed');
      } else if (command.startsWith('rooms-')) {
        // Reviewed against the same F-1 standard (rooms-list, rooms-where):
        // their descriptions make no write claim, and this fallback genuinely
        // does complete the one operation it performs (returning the
        // reference), so "Room operation complete" is not a false claim here
        // the way "Scout intelligence gathered" was for scout* -- left as-is.
        suggestedNext = formatSuggestedNext('room_state', { command: 'status' }, 'Room operation complete - check status');
      } else {
        suggestedNext = formatSuggestedNext('room_state', { command: 'status' }, 'Operation complete - check room status');
      }
      return textResponse(parts.join('\n') + suggestedNext);
    }
  );

  // (Duplicate orchestration router from 52-03 merge removed -- brain routing now integrated above)

  // -------------------------------------------------------------------------
  // 10. room_bind - the D-03 binding front door (Phase 198-02, SPEC-1)
  // -------------------------------------------------------------------------
  // D-03 precedence: explicit room arg WINS when supplied; else a `.room-root`
  // sentinel above process.cwd() auto-binds SILENTLY (cwd-default); a genuinely
  // ambiguous session (no explicit room, no cwd room) returns a structured
  // { needs_binding_card: true } signal instead of guessing -- the F.8 card
  // itself renders through gate_render (a later plan; this tool only emits the
  // signal). Wraps writeSessionBinding as-is (session-binding.cjs:107); does
  // NOT reimplement the binding store (Canon Part 7).
  //
  // RCA statusline-room-health-chip-never-updates: the statusline health chip
  // reads ~/.mindrian/room-health.json, whose write function had exactly ONE
  // caller in the tree - the manual `--bind-check <roomDir>` CLI flag, which
  // nothing in the shipped product ever invoked. The chip therefore froze at
  // whatever a past manual shell run wrote and a stale drift warning could never
  // clear. room_bind is the live binding front door, so it is where the honest
  // signal belongs. The check is IN-PROCESS (room-health-cache.runBindHealthCheck
  // composes session-presence.runBindCheck): an MCP tool handler must never spawn
  // a child process for a synchronous tool call. FAIL SOFT by construction - the
  // bind is the load-bearing operation and a health fault must never break or
  // block it. Canon Part 8: LOCAL only, zero Brain egress.
  function persistBindHealth(sessionId, slug, roomDir) {
    try {
      const roomHealthCache = require('../statusline/room-health-cache.cjs');
      roomHealthCache.runBindHealthCheck({
        sessionId: sessionId,
        room: slug,
        roomDir: roomDir || null,
      });
    } catch (_e) { /* advisory only: never break a successful bind */ }
  }

  server.tool(
    'room_bind',
    'Bind this MCP session to a room (D-03: explicit room wins; cwd auto-bind when launched inside a room; a structured binding-card signal on genuine ambiguity). The room this session binds to becomes the target for every subsequent write this session makes.',
    {
      room: z.string().optional()
        .describe('Explicit room slug to bind this session to. Wins over cwd auto-bind when supplied.'),
      sessionId: z.string().optional()
        .describe('Explicit sessionId override; defaults to this connection\'s session id.'),
    },
    async ({ room, sessionId }, extra) => {
      // RCA registry-active-room-concurrent-session-collision, Change 1: on
      // stdio (the local Claude Code CLI transport), the MCP SDK never
      // populates extra.sessionId (confirmed live; see the RCA doc). Without a
      // third fallback, writeSessionBinding's ONLY call sites (below) were
      // unreachable for every CLI session, so session.primary could never be
      // written and every write-target resolution fell through to the shared,
      // unlocked, machine-wide registry.json `active` field (Leg 3), which
      // concurrent CLI sessions on one machine then raced to overwrite.
      // Precedence: explicit `sessionId` param > SDK `extra.sessionId`
      // (desktop/cowork, non-stdio) > process.env.CLAUDE_CODE_SESSION_ID (the
      // real per-process env var Claude Code sets for a CLI session, mirroring
      // the F-01 precedent already shipped in scripts/write-scope-check.cjs,
      // commit 0bec81b9) > no_session_id only when all three are absent. This
      // widens ONLY how a session id is obtained; it does not touch the
      // needs_binding_card/F.8 ambiguity signal below, which fires exactly as
      // before once a session id is in hand.
      const effectiveSessionId = resolveEffectiveSessionId(sessionId, extra);
      if (!effectiveSessionId) {
        return textResponse(JSON.stringify({ ok: false, reason: 'no_session_id' }, null, 2), true);
      }
      const { writeSessionBinding } = require('../core/session-binding.cjs');

      // Phase 248-02 (CTX-02 return half): the write above can silently no-op
      // (an unsafe slug) or write a slug that has no directory on disk (the
      // room-not-on-disk lie this plan closes). Round-trip through the SAME
      // shared resolver, with the SAME sessionId, and report what a
      // subsequent read in this session will actually see. This doubles as
      // an in-process seam-liveness proof: the write end and the read end
      // are verified against each other on every call. Additive fields only
      // - the needs_binding_card branch below is untouched.
      function honestBindResult(baseFields, boundSlug) {
        const check = require('./session-room.cjs').resolveMcpSessionRoom({
          sessionId: effectiveSessionId,
          ctx: { fallbackRoomDir: roomDir, surface: surface },
        });
        const effective = check.source === 'session.primary' && check.slug === boundSlug;
        const result = Object.assign({}, baseFields, {
          effective: effective,
          resolved_dir: check.dir,
          resolved_source: check.source,
        });
        if (!effective) {
          // room_not_on_disk: a write of a safe slug that the resolver could
          // not turn into a session.primary hit (the existsSync gate in
          // registryRoomPath failed leg A). binding_not_effective is the
          // honest catch-all for any other silent no-op (e.g. an unsafe
          // slug writeSessionBinding rejected outright).
          result.reason = (check.slug !== boundSlug || check.source !== 'session.primary')
            ? 'room_not_on_disk'
            : 'binding_not_effective';
        }
        return result;
      }

      if (room) {
        writeSessionBinding(effectiveSessionId, { primary: room, bound: [room] });
        persistBindHealth(effectiveSessionId, room, null);
        const payload = honestBindResult({ ok: true, bound: true, primary: room, source: 'explicit' }, room);
        return textResponse(JSON.stringify(payload, null, 2)
          + formatSuggestedNext('room_state', { command: 'status' }, 'Session bound - check room status for the newly bound room'));
      }

      // cwd auto-bind: a `.room-root` sentinel above process.cwd() wins silently.
      try {
        const roomRoot = require('../core/room-root.cjs');
        const cwdRoomDir = roomRoot.resolveRoomRoot(process.cwd());
        if (cwdRoomDir) {
          const slug = path.basename(cwdRoomDir);
          writeSessionBinding(effectiveSessionId, { primary: slug, bound: [slug] });
          persistBindHealth(effectiveSessionId, slug, cwdRoomDir);
          const payload = honestBindResult({ ok: true, bound: true, primary: slug, source: 'cwd' }, slug);
          return textResponse(JSON.stringify(payload, null, 2)
            + formatSuggestedNext('room_state', { command: 'status' }, 'Session auto-bound from cwd - check room status'));
        }
      } catch (_e) { /* fall through to the ambiguity signal */ }

      // Genuine ambiguity: no explicit room, no cwd room. Signal the caller so
      // gate_render (a later plan) can fire the F.8 binding card ONCE per
      // session (D-03/D-05: never per-turn).
      return textResponse(JSON.stringify({ ok: true, bound: false, needs_binding_card: true }, null, 2));
    }
  );

  // -------------------------------------------------------------------------
  // eureka_critic - the Grounding Guard calibration ruling (Phase 212-03).
  //
  // WHAT: a THIN MCP wrapper over lib/core/eureka-critic.cjs's criticRule -- the
  // ONLY phase-212 surface that crosses a process/network boundary. Scalars +
  // closed enums in, a coarse ruling out; NO room content ever (D1: the 20-60
  // bit payload is the moat-correct boundary from 02-moat-embedding-audit -- the
  // generator stays local/open, only the abstracted ruling call crosses).
  //
  // hitl_shape: none. RATIONALE: criticRule is a PURE ruling function with no
  // Decision-Gate fork of its own -- it returns {verdict, confidence,
  // reasoning_tag}, it never asks the human anything. The human gate on eureka
  // verdicts lives DOWNSTREAM in Phase 213's eureka-reach wiring (exactly where
  // CONTEXT scopes it), not on this abstracted ruling call. This declaration is a
  // no-drift proof: eureka_critic is deliberately NOT in MCP_TOOL_CONNECTORS (its
  // governance dial is "none", so it mints no connector descriptor and the
  // born-wired registry stays byte-stable); registration on this one governed MCP
  // path via registerRouterTools IS the Canon Part 11 wiring.
  //
  // NOT in ALL_TOOL_COMMANDS: eureka_critic has NO CLI command twin (its CLI
  // surface is scripts/eureka-critic-run.cjs, plan 05; its programmatic consumer
  // is Phase 213). The 65-pin in tests/test-205-surface-fence.cjs guards
  // CLI<->MCP command PARITY for the 64 routed CLI commands -- this tool is not
  // one of them, so it registers directly via server.tool and must never touch
  // that parity array.
  //
  // SEED-014 lift note: this wrapper is DISPOSABLE. When the critic lifts into the
  // separate Brain repo, criticRule moves unchanged and only this thin wrapper is
  // rewritten -- zero change to lib/core/eureka-critic.cjs (D4 portability).
  //
  // Rate-limit scope: D3b item 4's "per API key" rate-limit is DEFERRED to the
  // SEED-014 Brain-repo lift. The plugin-local tool has no per-key identity yet,
  // so this phase ships an honest per-PROCESS token count (EUREKA_CRITIC_RATE_LIMIT
  // per rolling minute) as the local equivalent; the per-key upgrade lands with
  // the key surface, not here.
  //
  // D5: the handler is a PURE function of the payload -- it references NEITHER
  // roomDir NOR pluginRoot NOR larryContext, so the addendum's stale-roomDir bug
  // cannot recur on a surface that never touches a room closure.
  // -------------------------------------------------------------------------
  const _eurekaCriticDomainTags = eurekaCritic.loadCriticTags().domain_tags;
  server.tool(
    'eureka_critic',
    'Grounding Guard calibration ruling: quantized scalars + closed enums in, a coarse verdict/confidence/reasoning_tag out; no room content ever crosses this boundary.',
    {
      differential_score: z.number().min(-1).max(1)
        .describe('Quantized differential score in [-1, 1]'),
      semantic_similarity: z.number().min(-1).max(1)
        .describe('Quantized semantic similarity in [-1, 1]'),
      lsa_similarity: z.number().min(0).max(1)
        .describe('Quantized LSA similarity in [0, 1]'),
      surprise_type: z.enum(['structural_transfer', 'semantic_implementation'])
        .describe('Closed surprise-type enum'),
      source_domain_tag: z.enum(_eurekaCriticDomainTags)
        .describe('Generic source domain tag (never a room artifact id or content)'),
      target_domain_tag: z.enum(_eurekaCriticDomainTags)
        .describe('Generic target domain tag (never a room artifact id or content)'),
      rubric_pattern: z.string().regex(/^[01x]{6}$/)
        .describe('The abstracted [01x]{6} rubric boolean pattern'),
      schema_version: z.number().int()
        .describe('Tags/enum schema version for the Part 9 versioned-packet guard'),
    },
    async (payload) => {
      // Env tunables read at CALL time (RS_SEMANTIC_FLOOR precedent) so an
      // operator retunes without a code change.
      const dedupeTtlMs = (function () {
        const v = parseInt(process.env.EUREKA_CRITIC_DEDUPE_TTL_MS, 10);
        return Number.isFinite(v) && v > 0 ? v : 60000;
      })();
      const rateLimit = (function () {
        const v = parseInt(process.env.EUREKA_CRITIC_RATE_LIMIT, 10);
        return Number.isFinite(v) && v > 0 ? v : 30;
      })();

      // (1) Dedupe (D3b item 4): a sha256 over the canonical-JSON payload keyed
      // into a module-level Map. An identical payload within the TTL returns the
      // cached ruling without a recompute (and without spending a rate token).
      const crypto = require('crypto');
      const canonical = JSON.stringify(payload, Object.keys(payload).sort());
      const payloadHash = crypto.createHash('sha256').update(canonical).digest('hex');
      const now = Date.now();
      const cached = _eurekaCriticDedupeCache.get(payloadHash);
      if (cached && (now - cached.ts) < dedupeTtlMs) {
        return textResponse(JSON.stringify(cached.ruling));
      }

      // (2) Rate-limit (D3b item 4): a per-process rolling-minute token count.
      // Prune the window to the last 60s; over the limit returns an error naming
      // the limit rather than recomputing (query-stream / shadow-model brake).
      while (_eurekaCriticRateWindow.length > 0 && (now - _eurekaCriticRateWindow[0]) >= 60000) {
        _eurekaCriticRateWindow.shift();
      }
      if (_eurekaCriticRateWindow.length >= rateLimit) {
        return textResponse(
          'eureka_critic rate limit exceeded (' + rateLimit + ' calls per minute, EUREKA_CRITIC_RATE_LIMIT)',
          true
        );
      }
      _eurekaCriticRateWindow.push(now);

      // (3) The thin call: criticRule is PURE (D4) -- it takes the D1 payload and
      // returns {verdict, confidence, reasoning_tag}. No room-directory, no
      // plugin-root, no larry-context closure is referenced anywhere in this
      // handler (D5: the stale-room bug cannot recur on a surface it never touches).
      let ruling;
      try {
        ruling = eurekaCritic.criticRule(payload);
      } catch (err) {
        return textResponse('eureka_critic: ' + (err && err.message ? err.message : String(err)), true);
      }
      _eurekaCriticDedupeCache.set(payloadHash, { ruling: ruling, ts: now });
      return textResponse(JSON.stringify(ruling));
    }
  );

  // -------------------------------------------------------------------------
  // 11. The tools/ auto-discovery seam (Phase 198-04, Task 1). LAZILY required
  // here -- never at module top -- so this file finishes assigning its own
  // module.exports (below) before lib/mcp/register-core-tools.cjs (which
  // requires lib/mcp/tools/*.cjs, and those modules require this file back for
  // SECTION_RE/safeResolveSection reuse) ever runs. By the time
  // registerRouterTools() is actually CALLED (from bin/mindrian-mcp-server.cjs,
  // after this module has fully loaded), the require cache already holds the
  // complete exports object, so there is no cycle. Room/graph/... tool modules
  // are DISJOINT files from this router; later plans add new
  // lib/mcp/tools/*.cjs modules without ever editing this function again.
  // -------------------------------------------------------------------------
  const { registerCoreTools } = require('./register-core-tools.cjs');
  registerCoreTools(server, { fallbackRoomDir: roomDir, pluginRoot, surface });
}

// Phase 198-02 (SPEC-2 Part 11 born-wired seam): room_bind's connector
// descriptor, exported as the SOURCE of truth. Plan 04 extends
// build-connector-registry.cjs to discover this array (and every future tool
// module's `connectors` export) and regenerate data/mcp-tool-connectors.json
// from it -- this file is NEVER hand-edited (mirrors the existing
// data/connector-registry.json "do not edit by hand" pattern). hitl_shape
// F.8 names the binding-card-on-ambiguity fork room_bind can return.
const MCP_TOOL_CONNECTORS = [
  {
    tool: 'room_bind',
    surface: 'room_bind',
    connector: 'mcp-tool',
    hitl_shape: 'F.8',
    hitl_why: 'A session with no explicit room and no cwd auto-bind is genuinely ambiguous; room_bind returns needs_binding_card:true instead of guessing, and the F.8 card asks the human which room this session writes to (fires once per session, D-03/D-05).',
  },
];

module.exports = { registerRouterTools, ALL_TOOL_COMMANDS, MCP_TOOL_CONNECTORS };

// 87-05: Export validation primitives for unit tests
// (kept out of the registerRouterTools surface area).
module.exports._test = {
  SECTION_RE,
  sectionOptional,
  sectionRequired,
  safeResolveSection,
  opportunitySchema,
  loadReference,
  resolveWriteTargetDir,
  runResearchPipeline,
  // Phase 232.1 D-07: exported so the density line's counting/formatting can be
  // asserted in isolation, without spinning a fake MCP server.
  roomDensityLine,
  // Quick 260903-kwl: exported so tests/test-kwl-meeting-mcp-honesty.cjs can
  // drive every meeting sub-command off the module's own list rather than a
  // hand-typed literal, so a fourth command added later cannot escape the check.
  MEETING_COMMANDS,
};
