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

const USAGE = `Usage: mindrian-tools.cjs <command> <subcommand> [roomDir] [--raw]

Commands:
  room list-sections [roomDir]   List discovered sections with metadata
  room analyze [roomDir]         Run analyze-room script
  state compute [roomDir]        Run compute-state script
  state get [roomDir]            Read STATE.md from room
  meeting compute-intel [roomDir]  Run compute-meetings-intelligence script
  meeting compute-team [roomDir]   Run compute-team script
  graph build [roomDir] [outputPath]  Generate knowledge graph JSON
  opportunity scan [roomDir]     Context-driven grant discovery
  opportunity list [roomDir]     List filed opportunities
  opportunity file [roomDir] [dataJson]  File an opportunity`;

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

    default:
      error(`Unknown command: ${command}\n\n${USAGE}`);
  }
}

main().catch(e => {
  error(e.message);
});
