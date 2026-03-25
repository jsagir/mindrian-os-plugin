/**
 * MindrianOS MCP Hierarchical Tool Router
 *
 * Registers 6 high-level MCP tools that dispatch to all 49 CLI commands.
 * Hierarchical design keeps total tool definition under 5000 tokens
 * (vs 30-60K for flat 41-tool registration).
 *
 * Router tools:
 *   1. data_room    — room state, sections, project lifecycle, personas, graph (24 commands)
 *   2. methodology  — PWS innovation frameworks (13 commands)
 *   3. analysis     — systems analysis and trend exploration (10 commands)
 *   4. intelligence — connections, grading, research (7 commands)
 *   5. meeting      — meeting filing and pipeline (2 commands)
 *   6. export       — export and radar visualization (2 commands)
 *
 * Total: 49 commands across 6 router tools (verified via ALL_TOOL_COMMANDS).
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
  'list-funding', 'create-funding', 'update-funding-stage',
  'generate-personas', 'list-personas', 'invoke-persona', 'analyze-perspectives',
  'graph-index', 'graph-rebuild', 'graph-query', 'graph-stats',
  'reasoning-get', 'reasoning-generate', 'reasoning-verify', 'reasoning-run', 'reasoning-list', 'reasoning-frontmatter',
  'visualize-room', 'visualize-graph', 'visualize-chain'
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
 * Flat array of all 49 CLI command names for parity checking.
 * Maps 1:1 to the 41 .md files in commands/ plus graph subcommands.
 *
 * Note: data_room router has internal sub-commands (list-sections, analyze,
 * compute-state, get-state) that map back to the CLI "room" command.
 * ALL_TOOL_COMMANDS uses CLI names for parity validation.
 */
const ALL_TOOL_COMMANDS = [
  // data_room group (CLI names)
  'room', 'status', 'new-project', 'setup', 'update', 'help', 'suggest-next', 'persona', 'opportunities', 'funding', 'query', 'reason', 'visualize',
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
    `Manage your MindrianOS Data Room: state, sections, opportunities, funding, personas, reasoning, knowledge graph. Use reasoning-* commands for Minto/MECE structured critical thinking per section. Use graph-query with Cypher for relationship queries. ${compact.slice(0, 80)}`,
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
        case 'generate-personas': {
          const personaOps = require('../core/persona-ops.cjs');
          const genResult = personaOps.generatePersonas(roomDir);
          return textResponse(JSON.stringify(genResult, null, 2));
        }
        case 'list-personas': {
          const personaOps = require('../core/persona-ops.cjs');
          const personas = personaOps.listPersonas(roomDir);
          return textResponse(JSON.stringify(personas, null, 2));
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
          return textResponse(JSON.stringify(invokeResult, null, 2));
        }
        case 'analyze-perspectives': {
          const personaOps = require('../core/persona-ops.cjs');
          let analyzeParams;
          try {
            analyzeParams = section ? JSON.parse(section) : {};
          } catch (_e) {
            analyzeParams = { artifact: section };
          }
          const analyzeResult = personaOps.analyzeAllPerspectives(roomDir, analyzeParams.artifact || null);
          return textResponse(JSON.stringify(analyzeResult, null, 2));
        }
        case 'graph-index': {
          const graphOps = require('../core/graph-ops.cjs');
          if (!section) {
            return textResponse('graph-index requires a file path in the section parameter', true);
          }
          const indexResult = await graphOps.indexArtifact(roomDir, section);
          return textResponse(JSON.stringify(indexResult, null, 2));
        }
        case 'graph-rebuild': {
          const graphOps = require('../core/graph-ops.cjs');
          const rebuildResult = await graphOps.rebuildGraph(roomDir);
          return textResponse(JSON.stringify(rebuildResult, null, 2));
        }
        case 'graph-query': {
          const graphOps = require('../core/graph-ops.cjs');
          if (!section) {
            return textResponse(
              'graph-query requires a Cypher query in the section parameter.\n\n' +
              '## KuzuDB Schema Reference\n' +
              'Node types:\n' +
              '- Artifact(id STRING PK, title STRING, section STRING, methodology STRING, created STRING, content_hash STRING)\n' +
              '- Section(name STRING PK, label STRING)\n\n' +
              'Edge types:\n' +
              '- INFORMS (Artifact -> Artifact) — cross-section references via [[wikilinks]]\n' +
              '- CONTRADICTS (Artifact -> Artifact, confidence STRING) — conflicting claims\n' +
              '- CONVERGES (Artifact -> Artifact, term STRING) — themes in 3+ sections\n' +
              '- ENABLES (Artifact -> Artifact) — unblocks another artifact\n' +
              '- INVALIDATES (Artifact -> Artifact) — makes another claim stale\n' +
              '- BELONGS_TO (Artifact -> Section) — section membership\n\n' +
              'Example: MATCH (a:Artifact)-[:CONTRADICTS]->(b:Artifact) RETURN a.title, b.title',
              true
            );
          }
          const queryResult = await graphOps.queryGraph(roomDir, section);
          return textResponse(JSON.stringify(queryResult, null, 2));
        }
        case 'graph-stats': {
          const graphOps = require('../core/graph-ops.cjs');
          const statsResult = await graphOps.graphStats(roomDir);
          return textResponse(JSON.stringify(statsResult, null, 2));
        }
        case 'reasoning-get': {
          const reasoningOps = require('../core/reasoning-ops.cjs');
          if (!section) return textResponse('reasoning-get requires a section name in the section parameter', true);
          const getResult = reasoningOps.getReasoning(roomDir, section);
          return textResponse(JSON.stringify(getResult, null, 2));
        }
        case 'reasoning-generate': {
          const reasoningOps = require('../core/reasoning-ops.cjs');
          const genResult = reasoningOps.generateReasoning(roomDir, section || null);
          return textResponse(JSON.stringify(genResult, null, 2));
        }
        case 'reasoning-verify': {
          const reasoningOps = require('../core/reasoning-ops.cjs');
          if (!section) return textResponse('reasoning-verify requires a section name in the section parameter', true);
          const verifyResult = reasoningOps.verifyReasoning(roomDir, section);
          return textResponse(JSON.stringify(verifyResult, null, 2));
        }
        case 'reasoning-run': {
          const reasoningOps = require('../core/reasoning-ops.cjs');
          if (!section) return textResponse('reasoning-run requires a section name in the section parameter', true);
          const runResult = reasoningOps.createRun(roomDir, section);
          return textResponse(JSON.stringify(runResult, null, 2));
        }
        case 'reasoning-list': {
          const reasoningOps = require('../core/reasoning-ops.cjs');
          const listResult = reasoningOps.listReasoning(roomDir);
          return textResponse(JSON.stringify(listResult, null, 2));
        }
        case 'reasoning-frontmatter': {
          const reasoningOps = require('../core/reasoning-ops.cjs');
          if (!section) return textResponse('reasoning-frontmatter requires a section name or JSON in the section parameter', true);
          // Try parsing as JSON (for set/merge operations)
          let fmParams;
          try {
            fmParams = JSON.parse(section);
          } catch (_e) {
            // Not JSON — treat as section name, return full frontmatter
            const fmResult = reasoningOps.getReasoningFrontmatter(roomDir, section);
            return textResponse(JSON.stringify(fmResult, null, 2));
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
          return textResponse(JSON.stringify(fmResult, null, 2));
        }
        case 'visualize-room': {
          const visualOps = require('../core/visual-ops.cjs');
          const roomOpsViz = require('../core/room-ops.cjs');
          const stateOpsViz = require('../core/state-ops.cjs');
          let sections = [];
          try {
            const sectionData = roomOpsViz.listSections(roomDir);
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
          return textResponse(visualOps.generateMermaidBlock(roomMermaid));
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
          return textResponse(visualOps.generateMermaidBlock(graphMermaid));
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
          // Try loading from room reasoning data
          const rfs = require('fs');
          const rpath = require('path');
          if (section) {
            try {
              const reasonDir = rpath.join(rpath.resolve(roomDir), section, '.reasoning');
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
          return textResponse(visualOps.generateMermaidBlock(chainMermaid));
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
