#!/usr/bin/env node
/**
 * MindrianOS Plugin — CLI Entry Point
 * Routes subcommands to lib/core modules.
 * Pattern: GSD gsd-tools.cjs (switch-case routing, async main, catch).
 * Surface-agnostic — no CLI/MCP/Desktop branching here.
 */

'use strict';

const { output, error } = require('../lib/core/index.cjs');
const roomOps = require('../lib/core/room-ops.cjs');
const stateOps = require('../lib/core/state-ops.cjs');
const meetingOps = require('../lib/core/meeting-ops.cjs');
const graphOps = require('../lib/core/graph-ops.cjs');
const opportunityOps = require('../lib/core/opportunity-ops.cjs');
const personaOps = require('../lib/core/persona-ops.cjs');
const reasoningOps = require('../lib/core/reasoning-ops.cjs');

const USAGE = `Usage: mindrian-tools.cjs <command> <subcommand> [roomDir] [--raw]

Commands:
  room list-sections [roomDir]   List discovered sections with metadata
  room analyze [roomDir]         Run analyze-room script
  state compute [roomDir]        Run compute-state script
  state get [roomDir]            Read STATE.md from room
  meeting compute-intel [roomDir]  Run compute-meetings-intelligence script
  meeting compute-team [roomDir]   Run compute-team script
  graph build [roomDir] [outputPath]  Generate knowledge graph JSON
  graph index [roomDir] <filePath>   Index single artifact in LazyGraph (KuzuDB)
  graph rebuild [roomDir]            Rebuild entire LazyGraph from room artifacts
  graph query [roomDir] "<cypher>"   Execute Cypher query against LazyGraph
  graph stats [roomDir]              Show LazyGraph node/edge statistics
  opportunity scan [roomDir]     Context-driven grant discovery
  opportunity list [roomDir]     List filed opportunities
  opportunity file [roomDir] [dataJson]  File an opportunity
  funding list [roomDir]         List funding pipeline entries
  funding create [roomDir] [slug] [source]  Create funding entry from opportunity
  funding advance [roomDir] [slug] [note]   Advance to next stage
  funding status [roomDir] [slug]           Show funding entry details
  funding outcome [roomDir] [slug] [outcome]  Set outcome (awarded|rejected|withdrawn)
  funding compute-state [roomDir]  Compute opportunity-bank + funding STATE.md
  persona generate [roomDir]       Generate 6 De Bono hat personas from room state
  persona list [roomDir]           List generated personas
  persona invoke [roomDir] [hat] [artifact]  Invoke a specific hat perspective
  persona analyze [roomDir] [artifact]       Run all 6 perspectives on an artifact
  reasoning get [roomDir] [section]          Get REASONING.md for a section
  reasoning generate [roomDir] [section]     Generate/regenerate REASONING.md
  reasoning verify [roomDir] [section]       Check verification criteria
  reasoning run [roomDir] [section]          Execute full methodology run
  reasoning list [roomDir]                   Show all sections with reasoning status
  reasoning frontmatter [roomDir] [json|section] [field]  Read/write reasoning frontmatter`;

async function main() {
  const argv = process.argv.slice(2);

  // Detect --raw flag
  const rawIndex = argv.indexOf('--raw');
  const raw = rawIndex !== -1;
  if (raw) argv.splice(rawIndex, 1);

  const command = argv[0];
  const subcommand = argv[1];
  const roomDir = argv[2] || './room';

  if (!command) {
    error('No command specified.\n\n' + USAGE);
  }

  switch (command) {
    case 'room': {
      switch (subcommand) {
        case 'list-sections': {
          const result = roomOps.listSections(roomDir);
          output(result, raw, JSON.stringify(result));
          break;
        }
        case 'analyze': {
          const result = roomOps.analyzeRoom(roomDir);
          output({ output: result }, raw, result);
          break;
        }
        default:
          error(`Unknown room subcommand: ${subcommand}\n\n${USAGE}`);
      }
      break;
    }

    case 'state': {
      switch (subcommand) {
        case 'compute': {
          const result = stateOps.computeState(roomDir);
          output({ output: result }, raw, result);
          break;
        }
        case 'get': {
          const result = stateOps.getState(roomDir);
          if (result === null) {
            error(`No STATE.md found in ${roomDir}`);
          }
          output({ content: result }, raw, result);
          break;
        }
        default:
          error(`Unknown state subcommand: ${subcommand}\n\n${USAGE}`);
      }
      break;
    }

    case 'meeting': {
      switch (subcommand) {
        case 'compute-intel': {
          const result = meetingOps.computeMeetingsIntel(roomDir);
          output({ output: result }, raw, result);
          break;
        }
        case 'compute-team': {
          const result = meetingOps.computeTeam(roomDir);
          output({ output: result }, raw, result);
          break;
        }
        default:
          error(`Unknown meeting subcommand: ${subcommand}\n\n${USAGE}`);
      }
      break;
    }

    case 'graph': {
      switch (subcommand) {
        case 'build': {
          const outputPath = argv[3]; // optional 4th arg
          const result = graphOps.buildGraph(roomDir, outputPath);
          output(result, raw, JSON.stringify(result));
          break;
        }
        case 'index': {
          const filePath = argv[3];
          if (!filePath) error('Usage: graph index <roomDir> <filePath>');
          const result = await graphOps.indexArtifact(roomDir, filePath);
          output(result, raw, JSON.stringify(result));
          break;
        }
        case 'rebuild': {
          const result = await graphOps.rebuildGraph(roomDir);
          output(result, raw, JSON.stringify(result));
          break;
        }
        case 'query': {
          const cypher = argv[3];
          if (!cypher) error('Usage: graph query <roomDir> "<cypher>"');
          const result = await graphOps.queryGraph(roomDir, cypher);
          output(result, raw, JSON.stringify(result));
          break;
        }
        case 'stats': {
          const result = await graphOps.graphStats(roomDir);
          output(result, raw, JSON.stringify(result));
          break;
        }
        default:
          error(`Unknown graph subcommand: ${subcommand}\n\n${USAGE}`);
      }
      break;
    }

    case 'opportunity': {
      switch (subcommand) {
        case 'scan': {
          const result = await opportunityOps.scanOpportunities(roomDir);
          output(result, raw, JSON.stringify(result, null, 2));
          break;
        }
        case 'list': {
          const result = opportunityOps.listOpportunities(roomDir);
          output(result, raw, JSON.stringify(result, null, 2));
          break;
        }
        case 'file': {
          const dataJson = argv[3];
          if (!dataJson) {
            error('opportunity file requires a JSON data argument');
          }
          let data;
          try {
            data = JSON.parse(dataJson);
          } catch (_e) {
            error('Invalid JSON data for opportunity file');
          }
          const result = opportunityOps.fileOpportunity(roomDir, data);
          output(result, raw, JSON.stringify(result));
          break;
        }
        default:
          error(`Unknown opportunity subcommand: ${subcommand}\n\n${USAGE}`);
      }
      break;
    }

    case 'funding': {
      switch (subcommand) {
        case 'list': {
          const result = opportunityOps.listFunding(roomDir);
          output(result, raw, JSON.stringify(result, null, 2));
          break;
        }
        case 'create': {
          const slug = argv[3];
          const source = argv[4];
          if (!slug) {
            error('funding create requires a slug argument');
          }
          if (!source) {
            error('funding create requires a source opportunity filename');
          }
          const result = opportunityOps.createFunding(roomDir, slug, source);
          output(result, raw, JSON.stringify(result, null, 2));
          break;
        }
        case 'advance': {
          const slug = argv[3];
          const note = argv[4] || '';
          if (!slug) {
            error('funding advance requires a slug argument');
          }
          // Determine next stage from current entry
          const fundResult = opportunityOps.listFunding(roomDir);
          const entry = fundResult.entries.find(e => e.name === slug);
          if (!entry) {
            error(`Funding entry not found: ${slug}`);
          }
          const stageIdx = opportunityOps.FUNDING_STAGES.indexOf(entry.stage);
          const nextStage = opportunityOps.FUNDING_STAGES[stageIdx + 1];
          if (!nextStage) {
            error(`Entry ${slug} is already at final stage: ${entry.stage}`);
          }
          const result = opportunityOps.updateFundingStage(roomDir, slug, nextStage, note);
          output(result, raw, JSON.stringify(result, null, 2));
          break;
        }
        case 'status': {
          const slug = argv[3];
          if (!slug) {
            error('funding status requires a slug argument');
          }
          const statusPath = require('path').join(require('path').resolve(roomDir), 'funding', slug, 'STATUS.md');
          try {
            const content = require('fs').readFileSync(statusPath, 'utf-8');
            output({ slug, content }, raw, content);
          } catch (_e) {
            error(`Funding entry not found: ${slug}`);
          }
          break;
        }
        case 'outcome': {
          const slug = argv[3];
          const outcomeVal = argv[4];
          if (!slug || !outcomeVal) {
            error('funding outcome requires slug and outcome arguments');
          }
          const result = opportunityOps.setFundingOutcome(roomDir, slug, outcomeVal);
          output(result, raw, JSON.stringify(result, null, 2));
          break;
        }
        case 'compute-state': {
          const fundState = opportunityOps.computeFundingState(roomDir);
          const oppState = opportunityOps.computeOpportunityBankState(roomDir);
          const result = { funding: fundState, opportunity_bank: oppState };
          output(result, raw, JSON.stringify(result, null, 2));
          break;
        }
        default:
          error(`Unknown funding subcommand: ${subcommand}\n\n${USAGE}`);
      }
      break;
    }

    case 'persona': {
      switch (subcommand) {
        case 'generate': {
          const result = personaOps.generatePersonas(roomDir);
          output(result, raw, JSON.stringify(result));
          break;
        }
        case 'list': {
          const result = personaOps.listPersonas(roomDir);
          output(result, raw, JSON.stringify(result));
          break;
        }
        case 'invoke': {
          const hatColor = argv[3];
          const artifactPath = argv[4] || null;
          if (!hatColor) {
            error('persona invoke requires a hat color argument (white|red|black|yellow|green|blue)');
          }
          const result = personaOps.invokePersona(roomDir, hatColor, artifactPath);
          output(result, raw, JSON.stringify(result));
          break;
        }
        case 'analyze': {
          const artifactPath = argv[3] || null;
          const result = personaOps.analyzeAllPerspectives(roomDir, artifactPath);
          output(result, raw, JSON.stringify(result));
          break;
        }
        default:
          error(`Unknown persona subcommand: ${subcommand}\n\n${USAGE}`);
      }
      break;
    }

    case 'reasoning': {
      switch (subcommand) {
        case 'get': {
          const section = argv[3];
          if (!section) error('reasoning get requires a section name');
          const result = reasoningOps.getReasoning(roomDir, section);
          output(result, raw, JSON.stringify(result, null, 2));
          break;
        }
        case 'generate': {
          const section = argv[3] || null;
          const result = reasoningOps.generateReasoning(roomDir, section);
          output(result, raw, JSON.stringify(result, null, 2));
          break;
        }
        case 'verify': {
          const section = argv[3];
          if (!section) error('reasoning verify requires a section name');
          const result = reasoningOps.verifyReasoning(roomDir, section);
          output(result, raw, JSON.stringify(result, null, 2));
          break;
        }
        case 'run': {
          const section = argv[3];
          if (!section) error('reasoning run requires a section name');
          const result = reasoningOps.createRun(roomDir, section);
          output(result, raw, JSON.stringify(result, null, 2));
          break;
        }
        case 'list': {
          const result = reasoningOps.listReasoning(roomDir);
          output(result, raw, JSON.stringify(result, null, 2));
          break;
        }
        case 'frontmatter': {
          const fmArg = argv[3];
          if (!fmArg) error('reasoning frontmatter requires a section name or JSON argument');
          // Try parsing as JSON first (for set/merge operations)
          let parsed;
          try {
            parsed = JSON.parse(fmArg);
          } catch (_e) {
            // Not JSON — treat as section name, optional field in argv[4]
            const result = reasoningOps.getReasoningFrontmatter(roomDir, fmArg, argv[4] || null);
            output(result, raw, JSON.stringify(result, null, 2));
            break;
          }
          // JSON parsed — route by action
          const { action, section, field, value } = parsed;
          let result;
          switch (action) {
            case 'set':
              result = reasoningOps.setReasoningFrontmatter(roomDir, section, field, value);
              break;
            case 'merge':
              result = reasoningOps.mergeReasoningFrontmatter(roomDir, section, parsed);
              break;
            case 'get':
            default:
              result = reasoningOps.getReasoningFrontmatter(roomDir, section, field || null);
              break;
          }
          output(result, raw, JSON.stringify(result, null, 2));
          break;
        }
        default:
          error(`Unknown reasoning subcommand: ${subcommand}\n\n${USAGE}`);
      }
      break;
    }

    default:
      error(`Unknown command: ${command}\n\n${USAGE}`);
  }
}

main().catch(e => {
  error(e.message);
});
