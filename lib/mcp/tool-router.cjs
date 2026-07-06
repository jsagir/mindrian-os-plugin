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
// Part 8: resolveActiveRoom reads LOCAL registry.json + env only, zero Brain
// egress. CLAUDE_ACTIVE_ROOM / MINDRIAN_ROOM still win (they are precedence leg 1
// inside resolveActiveRoom). The boot-time roomDir remains the miss-fallback.
const { resolveActiveRoom } = require('../core/resolve-active-room.cjs');

/**
 * Re-resolve the live active-room WRITE target per call. Returns the active
 * room's absolute path when the registry resolves, else the boot-time
 * fallback. This is NOT a new resolver: it delegates to the canonical
 * resolveActiveRoom (return shape { slug, abs_path } | null) and never throws.
 *
 * @param {string} fallbackRoomDir - boot-time closure roomDir (miss-fallback)
 * @returns {string} absolute directory the write should land in
 */
function resolveWriteTargetDir(fallbackRoomDir) {
  try {
    const active = resolveActiveRoom();
    return (active && active.abs_path) || fallbackRoomDir;
  } catch (_e) {
    return fallbackRoomDir;
  }
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

// Router 2: room_content (16 commands)
const ROOM_CONTENT_COMMANDS = [
  'new-project', 'setup', 'update', 'help', 'detect-integrations',
  'scan-opportunities', 'list-opportunities', 'file-opportunity',
  'list-funding', 'create-funding', 'update-funding-stage',
  'generate-personas', 'list-personas', 'invoke-persona', 'analyze-perspectives',
  'organize'
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

// ---------------------------------------------------------------------------
// Router registration
// ---------------------------------------------------------------------------

/**
 * Register all 9 hierarchical router tools on the MCP server.
 *
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server
 * @param {string} roomDir - Absolute path to the Data Room
 * @param {string} pluginRoot - Absolute path to the plugin root
 * @param {{ compact: string, full: string }} larryContext - Larry personality context
 */
function registerRouterTools(server, roomDir, pluginRoot, larryContext) {
  const compact = (larryContext && larryContext.compact) || '';

  // -------------------------------------------------------------------------
  // 1. room_state - room health, state, and recommendations (5 commands)
  // -------------------------------------------------------------------------
  server.tool(
    'room_state',
    `Check room health, state, and get framework recommendations. ${compact.slice(0, 80)}`,
    {
      command: z.enum(ROOM_STATE_COMMANDS)
        .describe('Room state operation to perform'),
      section: sectionOptional
        .describe('Section name for section-specific operations'),
    },
    async ({ command, section }) => {
      // Phase 87-04: MCP path MUST use the async entry point so analyzeRoom's
      // subprocess call does not block the handler loop. Importing bare
      // './room-ops.cjs' would trip the MOS_DEP_ROOM_OPS_LEGACY warning.
      const roomOps = require('../core/room-ops-async.cjs');
      const stateOps = require('../core/state-ops.cjs');

      switch (command) {
        case 'status': {
          const state = stateOps.getState(roomDir);
          const response = state || 'No room initialized. Run new-project to create one.';
          return textResponse(response + formatSuggestedNext('room_state', { command: 'analyze' }, 'Room status retrieved - run full analysis to detect patterns and gaps'));
        }
        case 'analyze': {
          const analysis = await roomOps.analyzeRoom(roomDir);
          return textResponse(analysis + formatSuggestedNext('room_graph', { command: 'graph-stats' }, 'Room analysis complete - check graph for relationship patterns'));
        }
        case 'compute-state': {
          const computed = stateOps.computeState(roomDir);
          return textResponse(computed + formatSuggestedNext('room_state', { command: 'suggest-next' }, 'State updated - get framework recommendation for current stage'));
        }
        case 'get-state': {
          const state = stateOps.getState(roomDir);
          return textResponse((state || 'No STATE.md found in room.') + formatSuggestedNext('room_state', { command: 'analyze' }, 'State retrieved - run analysis to detect intelligence patterns'));
        }
        case 'suggest-next': {
          const ref = loadReference(pluginRoot, 'suggest-next');
          const state = loadRoomState(roomDir);
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
    'Manage room content: projects, opportunities, funding, personas, integrations.',
    {
      command: z.enum(ROOM_CONTENT_COMMANDS)
        .describe('Room content operation to perform'),
      section: sectionOptional
        .describe('Section name or JSON data for operations'),
      context: z.string().optional()
        .describe('Additional context for the operation'),
    },
    async ({ command, section, context }) => {
      const defaultNext = formatSuggestedNext('room_state', { command: 'analyze' }, 'Content updated - analyze room to detect new intelligence patterns');

      switch (command) {
        case 'new-project':
        case 'setup':
        case 'update':
        case 'help': {
          const ref = loadReference(pluginRoot, command);
          const state = loadRoomState(roomDir);
          const parts = [`## ${command}`];
          if (state) parts.push(`\n### Current Room State\n${state}`);
          if (ref) parts.push(`\n### Reference\n${ref}`);
          if (context) parts.push(`\n### Focus\n${context}`);
          else parts.push(`\n> Reference file for "${command}" not found.`);
          const response = parts.join('\n');
          // Fire cascade for write operations
          if (WRITE_TOOLS.has(command)) {
            await fireCascade(roomDir, command, section);
          }
          return textResponse(response + defaultNext);
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
          const targetDir = resolveWriteTargetDir(roomDir);
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
          const targetDir = resolveWriteTargetDir(roomDir);
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
          const targetDir = resolveWriteTargetDir(roomDir);
          const updateResult = opportunityOps.updateFundingStage(targetDir, stageData.slug, stageData.stage, stageData.note || '');
          await fireCascade(targetDir, command, section, updateResult);
          return textResponse(JSON.stringify(updateResult, null, 2) + formatSuggestedNext('room_state', { command: 'status' }, 'Funding stage updated - check room status for pipeline overview'));
        }
        case 'generate-personas': {
          const personaOps = require('../core/persona-ops.cjs');
          const genResult = personaOps.generatePersonas(roomDir);
          await fireCascade(roomDir, command, section, genResult);
          return textResponse(JSON.stringify(genResult, null, 2) + formatSuggestedNext('room_content', { command: 'list-personas' }, 'Personas generated - list them to see available perspectives'));
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
    'Knowledge graph operations, Minto reasoning, and room visualization.',
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
    'Systems analysis, trend exploration, causal reasoning, and scenario planning.',
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
  // -------------------------------------------------------------------------
  server.tool(
    'intelligence',
    'Run intelligence operations: find connections, grade ventures, build thesis, research. Larry evaluates with calibrated assessment.',
    {
      command: z.enum(INTELLIGENCE_COMMANDS)
        .describe('Which intelligence operation to run'),
      context: z.string().optional()
        .describe('Focus area or evaluation target'),
    },
    async ({ command, context }) => {
      let extra = '';
      if (command === 'grade' || command === 'deep-grade') {
        const assessment = safeReadFile(path.join(pluginRoot, 'references', 'personality', 'assessment-philosophy.md'));
        if (assessment) extra = `\n### Assessment Philosophy\n${assessment}`;
      }
      let suggestedNext;
      if (command === 'grade') {
        suggestedNext = formatSuggestedNext('intelligence', { command: 'deep-grade' }, 'Quick grade done - run deep grade for detailed component feedback');
      } else if (command === 'deep-grade') {
        suggestedNext = formatSuggestedNext('room_state', { command: 'analyze' }, 'Deep grade complete - analyze room to see grading impact on intelligence');
      } else {
        suggestedNext = formatSuggestedNext('room_state', { command: 'analyze' }, 'Intelligence operation complete - analyze room for new patterns');
      }
      return textResponse(buildContext(pluginRoot, roomDir, command, context) + extra + suggestedNext);
    }
  );

  // -------------------------------------------------------------------------
  // 7. meeting - meeting filing, pipeline, speakers (3 commands)
  // -------------------------------------------------------------------------
  server.tool(
    'meeting',
    'Meeting filing, intelligence pipeline, and speaker identification.',
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
        const parts = ['## File Meeting'];
        if (state) parts.push(`\n### Room State\n${state}`);
        if (meetingRef) parts.push(`\n### Filing Protocol\n${meetingRef}`);
        if (context) parts.push(`\n### Transcript/Context\n${context}`);
        if (!context) parts.push('\n> Provide a meeting transcript to file.');
        const response = parts.join('\n');
        await fireCascade(roomDir, command, null, { filePath: '' });
        return textResponse(response + formatSuggestedNext('room_state', { command: 'analyze' }, 'Meeting filed - analyze room for new intelligence from this conversation'));
      }

      if (command === 'pipeline') {
        const pipelineRef = safeReadFile(path.join(pluginRoot, 'references', 'pipeline', 'index.md'))
          || safeReadFile(path.join(pluginRoot, 'commands', 'pipeline.md'));
        const parts = ['## Pipeline'];
        if (state) parts.push(`\n### Room State\n${state}`);
        if (pipelineRef) parts.push(`\n### Reference\n${pipelineRef}`);
        if (context) parts.push(`\n### Context\n${context}`);
        return textResponse(parts.join('\n') + formatSuggestedNext('meeting', { command: 'file-meeting' }, 'Pipeline reviewed - file a meeting to feed the intelligence pipeline'));
      }

      if (command === 'speakers') {
        const speakersRef = loadReference(pluginRoot, 'speakers');
        const parts = ['## Speakers'];
        if (state) parts.push(`\n### Room State\n${state}`);
        if (speakersRef) parts.push(`\n### Reference\n${speakersRef}`);
        if (context) parts.push(`\n### Context\n${context}`);
        else parts.push('\n> Provide meeting text or speaker context.');
        return textResponse(parts.join('\n') + formatSuggestedNext('meeting', { command: 'file-meeting' }, 'Speakers identified - file the meeting to route segments to sections'));
      }

      return textResponse(`Unknown meeting command: ${command}`, true);
    }
  );

  // -------------------------------------------------------------------------
  // 8. export - dashboards, wikis, presentations, snapshots (7 commands)
  // -------------------------------------------------------------------------
  server.tool(
    'export',
    'Generate dashboards, wikis, presentations, snapshots, and radar charts from room data.',
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
      const parts = [`## ${command}`];
      if (state) parts.push(`\n### Room State\n${state}`);
      if (ref) parts.push(`\n### Reference\n${ref}`);
      if (context) parts.push(`\n### Context\n${context}`);
      if (format) parts.push(`\n### Format\n${format}`);

      let suggestedNext;
      if (command === 'snapshot') {
        suggestedNext = formatSuggestedNext('export', { command: 'publish' }, 'Snapshot generated - publish to hosting for sharing');
      } else if (command === 'dashboard') {
        suggestedNext = formatSuggestedNext('export', { command: 'wiki' }, 'Dashboard generated - create wiki for detailed article navigation');
      } else {
        suggestedNext = formatSuggestedNext('room_state', { command: 'status' }, 'Export complete - check room status for overview');
      }
      return textResponse(parts.join('\n') + suggestedNext);
    }
  );

  // -------------------------------------------------------------------------
  // 9. orchestration - autonomous execution, rooms, scout, admin (20 commands)
  // -------------------------------------------------------------------------
  server.tool(
    'orchestration',
    'Autonomous execution, multi-room management, scout intelligence, and system administration.',
    {
      command: z.enum(ORCHESTRATION_COMMANDS)
        .describe('Orchestration operation'),
      context: z.string().optional()
        .describe('Operation context or parameters'),
      room: z.string().optional()
        .describe('Room name or path for room operations'),
    },
    async ({ command, context, room }) => {
      // Brain-driven act* commands use brain-router
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

      // All other orchestration commands use reference-based pattern
      const ref = loadReference(pluginRoot, command);
      const state = loadRoomState(roomDir);
      const parts = [`## ${command}`];
      if (state) parts.push(`\n### Room State\n${state}`);
      if (ref) parts.push(`\n### Reference\n${ref}`);
      if (context) parts.push(`\n### Context\n${context}`);
      if (room) parts.push(`\n### Target Room\n${room}`);
      if (!ref) parts.push(`\n> Reference file for "${command}" not found.`);

      let suggestedNext;
      if (command.startsWith('rooms-')) {
        suggestedNext = formatSuggestedNext('room_state', { command: 'status' }, 'Room operation complete - check status');
      } else if (command.startsWith('scout')) {
        suggestedNext = formatSuggestedNext('room_state', { command: 'analyze' }, 'Scout intelligence gathered - analyze room');
      } else {
        suggestedNext = formatSuggestedNext('room_state', { command: 'status' }, 'Operation complete - check room status');
      }
      return textResponse(parts.join('\n') + suggestedNext);
    }
  );

  // (Duplicate orchestration router from 52-03 merge removed -- brain routing now integrated above)
}

module.exports = { registerRouterTools, ALL_TOOL_COMMANDS };

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
};
