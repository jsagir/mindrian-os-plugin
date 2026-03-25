/**
 * MindrianOS MCP Hierarchical Tool Router
 *
 * Registers 6 high-level MCP tools that dispatch to all 41 CLI commands.
 * Hierarchical design keeps total tool definition under 5000 tokens
 * (vs 30-60K for flat 41-tool registration).
 *
 * Router tools:
 *   1. data_room    — room state, sections, project lifecycle (10 commands)
 *   2. methodology  — PWS innovation frameworks (13 commands)
 *   3. analysis     — systems analysis and trend exploration (10 commands)
 *   4. intelligence — connections, grading, research (7 commands)
 *   5. meeting      — meeting filing and pipeline (2 commands)
 *   6. export       — export and radar visualization (2 commands)
 *
 * Total: 41 commands across 6 router tools (verified via ALL_TOOL_COMMANDS).
 */

'use strict';

const path = require('path');
const { z } = require('zod');
const { safeReadFile } = require('../core/index.cjs');

// ---------------------------------------------------------------------------
// Command groupings — authoritative mapping from RESEARCH.md
// ---------------------------------------------------------------------------

const DATA_ROOM_COMMANDS = [
  'status', 'list-sections', 'analyze', 'compute-state', 'get-state',
  'new-project', 'setup', 'update', 'help', 'suggest-next',
  'scan-opportunities', 'list-opportunities', 'file-opportunity',
  'list-funding', 'create-funding', 'update-funding-stage'
];

const METHODOLOGY_COMMANDS = [
  'lean-canvas', 'think-hats', 'structure-argument', 'beautiful-question',
  'build-knowledge', 'challenge-assumptions', 'validate', 'map-unknowns',
  'diagnose', 'score-innovation', 'explore-domains', 'analyze-needs',
  'user-needs'
];

const ANALYSIS_COMMANDS = [
  'analyze-systems', 'analyze-timing', 'find-bottlenecks', 'root-cause',
  'systems-thinking', 'macro-trends', 'explore-trends', 'explore-futures',
  'dominant-designs', 'scenario-plan'
];

const INTELLIGENCE_COMMANDS = [
  'find-connections', 'build-thesis', 'compare-ventures', 'research',
  'deep-grade', 'grade', 'leadership'
];

const MEETING_COMMANDS = [
  'file-meeting', 'pipeline'
];

const EXPORT_COMMANDS = [
  'export', 'radar'
];

/**
 * Flat array of all 41 CLI command names for parity checking.
 * Maps 1:1 to the 41 .md files in commands/.
 *
 * Note: data_room router has internal sub-commands (list-sections, analyze,
 * compute-state, get-state) that map back to the CLI "room" command.
 * ALL_TOOL_COMMANDS uses CLI names for parity validation.
 */
const ALL_TOOL_COMMANDS = [
  // data_room group (CLI names)
  'room', 'status', 'new-project', 'setup', 'update', 'help', 'suggest-next',
  // methodology group
  ...METHODOLOGY_COMMANDS,
  // analysis group
  ...ANALYSIS_COMMANDS,
  // intelligence group
  ...INTELLIGENCE_COMMANDS,
  // meeting group
  ...MEETING_COMMANDS,
  // export group
  ...EXPORT_COMMANDS
];

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
 * Load a methodology/command reference file from references/methodology/.
 * Falls back to the command's CLI reference in commands/.
 */
function loadReference(pluginRoot, command) {
  // Try methodology references first
  const methodRef = safeReadFile(path.join(pluginRoot, 'references', 'methodology', `${command}.md`));
  if (methodRef) return methodRef;

  // Fall back to CLI command reference
  const cmdRef = safeReadFile(path.join(pluginRoot, 'commands', `${command}.md`));
  if (cmdRef) return cmdRef;

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

// ---------------------------------------------------------------------------
// Router registration
// ---------------------------------------------------------------------------

/**
 * Register all 6 hierarchical router tools on the MCP server.
 *
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server
 * @param {string} roomDir - Absolute path to the Data Room
 * @param {string} pluginRoot - Absolute path to the plugin root
 * @param {{ compact: string, full: string }} larryContext - Larry personality context
 */
function registerRouterTools(server, roomDir, pluginRoot, larryContext) {
  const compact = (larryContext && larryContext.compact) || '';

  // -------------------------------------------------------------------------
  // 1. data_room — room state, sections, project lifecycle
  // -------------------------------------------------------------------------
  server.tool(
    'data_room',
    `Manage your MindrianOS Data Room. ${compact.slice(0, 80)}`,
    {
      command: z.enum(DATA_ROOM_COMMANDS)
        .describe('Room operation to perform'),
      section: z.string().optional()
        .describe('Section name for section-specific operations'),
    },
    async ({ command, section }) => {
      const roomOps = require('../core/room-ops.cjs');
      const stateOps = require('../core/state-ops.cjs');

      switch (command) {
        case 'status': {
          const state = stateOps.getState(roomDir);
          return textResponse(state || 'No room initialized. Run new-project to create one.');
        }
        case 'list-sections': {
          const result = roomOps.listSections(roomDir);
          return textResponse(JSON.stringify(result, null, 2));
        }
        case 'analyze': {
          const analysis = roomOps.analyzeRoom(roomDir);
          return textResponse(analysis);
        }
        case 'compute-state': {
          const computed = stateOps.computeState(roomDir);
          return textResponse(computed);
        }
        case 'get-state': {
          const state = stateOps.getState(roomDir);
          return textResponse(state || 'No STATE.md found in room.');
        }
        case 'scan-opportunities': {
          const opportunityOps = require('../core/opportunity-ops.cjs');
          const scanResult = await opportunityOps.scanOpportunities(roomDir);
          return textResponse(JSON.stringify(scanResult, null, 2));
        }
        case 'list-opportunities': {
          const opportunityOps = require('../core/opportunity-ops.cjs');
          const listResult = opportunityOps.listOpportunities(roomDir);
          return textResponse(JSON.stringify(listResult, null, 2));
        }
        case 'file-opportunity': {
          const opportunityOps = require('../core/opportunity-ops.cjs');
          // section parameter carries the JSON data for filing
          let oppData;
          try {
            oppData = section ? JSON.parse(section) : {};
          } catch (_e) {
            return textResponse('Invalid JSON in section parameter for file-opportunity', true);
          }
          const fileResult = opportunityOps.fileOpportunity(roomDir, oppData);
          return textResponse(JSON.stringify(fileResult, null, 2));
        }
        case 'list-funding': {
          const opportunityOps = require('../core/opportunity-ops.cjs');
          const fundResult = opportunityOps.listFunding(roomDir);
          return textResponse(JSON.stringify(fundResult, null, 2));
        }
        case 'create-funding': {
          const opportunityOps = require('../core/opportunity-ops.cjs');
          // section parameter carries JSON: { slug, source }
          let fundData;
          try {
            fundData = section ? JSON.parse(section) : {};
          } catch (_e) {
            return textResponse('Invalid JSON in section parameter for create-funding', true);
          }
          if (!fundData.slug || !fundData.source) {
            return textResponse('create-funding requires { slug, source } in section parameter', true);
          }
          const createResult = opportunityOps.createFunding(roomDir, fundData.slug, fundData.source);
          return textResponse(JSON.stringify(createResult, null, 2));
        }
        case 'update-funding-stage': {
          const opportunityOps = require('../core/opportunity-ops.cjs');
          // section parameter carries JSON: { slug, stage, note }
          let stageData;
          try {
            stageData = section ? JSON.parse(section) : {};
          } catch (_e) {
            return textResponse('Invalid JSON in section parameter for update-funding-stage', true);
          }
          if (!stageData.slug || !stageData.stage) {
            return textResponse('update-funding-stage requires { slug, stage, note? } in section parameter', true);
          }
          const updateResult = opportunityOps.updateFundingStage(roomDir, stageData.slug, stageData.stage, stageData.note || '');
          return textResponse(JSON.stringify(updateResult, null, 2));
        }
        // Reference-based commands: return the reference for Claude to execute conversationally
        case 'new-project':
        case 'setup':
        case 'update':
        case 'help':
        case 'suggest-next': {
          const ref = loadReference(pluginRoot, command);
          const state = loadRoomState(roomDir);
          const parts = [`## ${command}`];
          if (state) parts.push(`\n### Current Room State\n${state}`);
          if (ref) parts.push(`\n### Reference\n${ref}`);
          else parts.push(`\n> Reference file for "${command}" not found.`);
          return textResponse(parts.join('\n'));
        }
        default:
          return textResponse(`Unknown data_room command: ${command}`, true);
      }
    }
  );

  // -------------------------------------------------------------------------
  // 2. methodology — PWS innovation frameworks
  // -------------------------------------------------------------------------
  server.tool(
    'methodology',
    'Run a PWS innovation methodology framework. Larry guides you through the selected framework and files results to your Data Room.',
    {
      command: z.enum(METHODOLOGY_COMMANDS)
        .describe('Which methodology to run'),
      context: z.string().optional()
        .describe('Focus area or venture aspect'),
    },
    async ({ command, context }) => {
      return textResponse(buildContext(pluginRoot, roomDir, command, context));
    }
  );

  // -------------------------------------------------------------------------
  // 3. analysis — systems analysis and trend exploration
  // -------------------------------------------------------------------------
  server.tool(
    'analysis',
    'Run systems analysis, trend exploration, or strategic planning frameworks. Larry helps you see the bigger picture.',
    {
      command: z.enum(ANALYSIS_COMMANDS)
        .describe('Which analysis to run'),
      context: z.string().optional()
        .describe('Focus area or system boundary'),
    },
    async ({ command, context }) => {
      return textResponse(buildContext(pluginRoot, roomDir, command, context));
    }
  );

  // -------------------------------------------------------------------------
  // 4. intelligence — connections, grading, research
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
      // Grade and deep-grade also load assessment philosophy
      let extra = '';
      if (command === 'grade' || command === 'deep-grade') {
        const assessment = safeReadFile(path.join(pluginRoot, 'references', 'personality', 'assessment-philosophy.md'));
        if (assessment) extra = `\n### Assessment Philosophy\n${assessment}`;
      }
      return textResponse(buildContext(pluginRoot, roomDir, command, context) + extra);
    }
  );

  // -------------------------------------------------------------------------
  // 5. meeting — meeting filing and pipeline
  // -------------------------------------------------------------------------
  server.tool(
    'meeting',
    'File a meeting transcript or run the pipeline. Larry classifies segments and routes artifacts to the right sections.',
    {
      command: z.enum(MEETING_COMMANDS)
        .describe('Meeting operation'),
      transcript: z.string().optional()
        .describe('Meeting transcript text (for file-meeting)'),
      date: z.string().optional()
        .describe('Meeting date YYYY-MM-DD (for file-meeting)'),
    },
    async ({ command, transcript, date }) => {
      const state = loadRoomState(roomDir);

      if (command === 'file-meeting') {
        const meetingRef = safeReadFile(path.join(pluginRoot, 'references', 'meeting', 'filing-protocol.md'));
        const parts = ['## File Meeting'];
        if (state) parts.push(`\n### Room State\n${state}`);
        if (meetingRef) parts.push(`\n### Filing Protocol\n${meetingRef}`);
        if (transcript) parts.push(`\n### Transcript\n${transcript}`);
        if (date) parts.push(`\n### Date\n${date}`);
        if (!transcript) parts.push('\n> Provide a meeting transcript to file.');
        return textResponse(parts.join('\n'));
      }

      if (command === 'pipeline') {
        const pipelineRef = safeReadFile(path.join(pluginRoot, 'references', 'pipeline', 'index.md'))
          || safeReadFile(path.join(pluginRoot, 'commands', 'pipeline.md'));
        const parts = ['## Pipeline'];
        if (state) parts.push(`\n### Room State\n${state}`);
        if (pipelineRef) parts.push(`\n### Reference\n${pipelineRef}`);
        return textResponse(parts.join('\n'));
      }

      return textResponse(`Unknown meeting command: ${command}`, true);
    }
  );

  // -------------------------------------------------------------------------
  // 6. export — export and radar visualization
  // -------------------------------------------------------------------------
  server.tool(
    'export',
    'Export Data Room content or generate radar visualization. Larry packages your venture intelligence.',
    {
      command: z.enum(EXPORT_COMMANDS)
        .describe('Export operation'),
      format: z.string().optional()
        .describe('Export format (for export command)'),
    },
    async ({ command, format }) => {
      const ref = loadReference(pluginRoot, command);
      const state = loadRoomState(roomDir);
      const parts = [`## ${command}`];
      if (state) parts.push(`\n### Room State\n${state}`);
      if (ref) parts.push(`\n### Reference\n${ref}`);
      if (format) parts.push(`\n### Format\n${format}`);
      return textResponse(parts.join('\n'));
    }
  );
}

module.exports = { registerRouterTools, ALL_TOOL_COMMANDS };
