#!/usr/bin/env node
/**
 * MindrianOS Plugin - CLI Entry Point
 * Routes subcommands to lib/core modules.
 * Pattern: GSD gsd-tools.cjs (switch-case routing, async main, catch).
 * Surface-agnostic - no CLI/MCP/Desktop branching here.
 */

'use strict';

const { execFileSync } = require('child_process');
const path = require('path');
const { output, error } = require('../lib/core/index.cjs');
// Phase 87-04: CLI path uses the sync entry point directly (self-documenting).
// The legacy './room-ops.cjs' shim still works but emits a DeprecationWarning.
const roomOps = require('../lib/core/room-ops-sync.cjs');
const stateOps = require('../lib/core/state-ops.cjs');
const meetingOps = require('../lib/core/meeting-ops.cjs');
const graphOps = require('../lib/core/graph-ops.cjs');
const opportunityOps = require('../lib/core/opportunity-ops.cjs');
const personaOps = require('../lib/core/persona-ops.cjs');
const reasoningOps = require('../lib/core/reasoning-ops.cjs');
const visualOps = require('../lib/core/visual-ops.cjs');
const scratchpadOps = require('../lib/core/scratchpad-ops.cjs');

const USAGE = `Usage: mindrian-tools.cjs <command> <subcommand> [roomDir] [--raw]

Commands:
  room list-sections [roomDir]   List discovered sections with metadata
  room analyze [roomDir]         Run analyze-room script
  state compute [roomDir]        Run compute-state script
  state get [roomDir]            Read STATE.md from room
  meeting compute-intel [roomDir]  Run compute-meetings-intelligence script
  meeting compute-team [roomDir]   Run compute-team script
  graph build [roomDir] [outputPath]  Generate knowledge graph JSON
  graph build-sqlite [roomDir] [outputPath]  Build graph.json from SQLite (primary)
  graph index [roomDir] <filePath>   Index single artifact in room graph (SQLite)
  graph rebuild [roomDir]            Rebuild entire room graph from artifacts
  graph query [roomDir] "<sql>"      Execute SQL query against room graph
  graph stats [roomDir]              Show room graph node/edge statistics
  opportunity scan [roomDir]     Context-driven grant discovery
  opportunity list [roomDir]     List filed opportunities
  opportunity file [roomDir] [dataJson]  File an opportunity
  funding list [roomDir]         List funding pipeline entries
  funding create [roomDir] [slug] [source]  Create funding entry from opportunity
  funding advance [roomDir] [slug] [note]   Advance to next stage
  funding status [roomDir] [slug]           Show funding entry details
  funding outcome [roomDir] [slug] [outcome]  Set outcome (awarded|rejected|withdrawn)
  funding compute-state [roomDir]  Compute opportunity-bank + funding STATE.md
  persona generate [roomDir] [--preview]  Routes to /mos:persona --parallel by default; --preview writes 6 labelled template-only files instead
  persona list [roomDir]           List generated personas
  persona invoke [roomDir] [hat] [artifact]  Invoke a specific hat perspective
  persona analyze [roomDir] [artifact]       Run all 6 perspectives on an artifact
  reasoning get [roomDir] [section]          Get REASONING.md for a section
  reasoning generate [roomDir] [section]     Generate/regenerate REASONING.md
  reasoning verify [roomDir] [section]       Check verification criteria
  reasoning run [roomDir] [section]          Execute full methodology run
  reasoning list [roomDir]                   Show all sections with reasoning status
  reasoning frontmatter [roomDir] [json|section] [field]  Read/write reasoning frontmatter
  visualize room [roomDir]       Generate room structure Mermaid diagram
  visualize graph [roomDir]      Generate knowledge graph Mermaid diagram
  visualize chain [roomDir]      Generate methodology chain Mermaid diagram
  visualize mermaid [roomDir] [type]  Output raw Mermaid syntax to stdout
  cascade [roomDir] [filePath]       Run intelligence cascade on a filed artifact
  bank-opportunity [roomDir] <json>   Bank an opportunity from conversation (room or scratchpad)
  record-decision --room DIR --key KEY --decision approve|reject|defer [--reason "..."] [--source-artifact ID] [--target-artifact ID]
                                     Record user decision on a proactive intelligence finding
  detect-integrations                Detect all integration statuses (env, MCP, filesystem)
  vault [room] [--path <target>] [--in-place]
                                  Export room as Obsidian vault (or linkify in-place)
  room linkify [room]             Retroactively inject wikilinks + footers in-place (WIKI-08)`;

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
        case 'linkify': {
          const orchestrator = path.resolve(__dirname, '..', 'scripts', 'vault-export-orchestrator.cjs');
          // User invocation forms:
          //   room linkify                 -> orchestrator --in-place (resolves active room)
          //   room linkify <room>          -> orchestrator <room> --in-place
          const extra = argv.slice(2);
          const args = extra.length > 0 ? [...extra, '--in-place'] : ['--in-place'];
          try {
            execFileSync(process.execPath, [orchestrator, ...args], { stdio: 'inherit' });
          } catch (err) {
            error(`room linkify failed: ${err.message}`);
          }
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
          const sql = argv[3];
          if (!sql) error('Usage: graph query <roomDir> "<sql>"');
          const result = await graphOps.queryGraph(roomDir, sql);
          output(result, raw, JSON.stringify(result));
          break;
        }
        case 'stats': {
          const result = await graphOps.graphStats(roomDir);
          output(result, raw, JSON.stringify(result));
          break;
        }
        case 'build-sqlite':
        case 'build-kuzu': { // backward-compat alias
          const outputPath = argv[3]; // optional 4th arg
          const result = graphOps.buildGraphFromSQLite(roomDir, outputPath);
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
          // Phase 265-16 (T-265-72): default is now the ROUTE response (no
          // files written) naming /mos:persona --parallel; --preview opts
          // into the old template-writing behavior, every file now stamped
          // with PREVIEW_NOTICE. Before this plan, this case always wrote 6
          // files and printed their JSON list; after, the default prints a
          // readable routing line instead (raw JSON stays reachable via
          // --raw for scripting).
          const previewIndex = argv.indexOf('--preview');
          const preview = previewIndex !== -1;
          if (preview) argv.splice(previewIndex, 1);
          const opts = preview ? { mode: 'preview' } : undefined;
          const result = personaOps.generatePersonas(roomDir, opts);
          if (result && result.routed && !raw) {
            process.stdout.write(
              `Routed - run ${result.route_to} for six independently-reasoning hat perspectives with a cross-agent tension map. ${result.why} Pass --preview for a quick template-only preview instead.\n`
            );
            process.exit(0);
          }
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
          // Phase 130-03: analyzeAllPerspectives now delegates to the lens-engine
          // rotation loop and is async; await it.
          const result = await personaOps.analyzeAllPerspectives(roomDir, artifactPath);
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
            // Not JSON - treat as section name, optional field in argv[4]
            const result = reasoningOps.getReasoningFrontmatter(roomDir, fmArg, argv[4] || null);
            output(result, raw, JSON.stringify(result, null, 2));
            break;
          }
          // JSON parsed - route by action
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

    case 'visualize': {
      const vizType = subcommand || 'room';
      const fs = require('fs');
      const path = require('path');

      // Helper: collect section data from room
      function collectSections() {
        try {
          const sectionData = roomOps.listSections(roomDir);
          let stage = 'discovery';
          try {
            const stateContent = stateOps.getState(roomDir);
            if (stateContent) {
              const stageMatch = stateContent.match(/venture_stage:\s*(.+)/);
              if (stageMatch) stage = stageMatch[1].trim();
            }
          } catch (_e) {}
          if (sectionData && sectionData.sections) {
            return sectionData.sections.map(s => ({
              name: s.name || s,
              entryCount: s.entryCount || s.entries || 0,
              stage: stage,
              edges: s.edges || []
            }));
          }
        } catch (_e) {}
        return [{ name: 'No room data', entryCount: 0, stage: 'discovery', edges: [] }];
      }

      switch (vizType) {
        case 'room': {
          const sections = collectSections();
          const mermaid = visualOps.generateMermaidRoom(sections);
          const block = visualOps.generateMermaidBlock(mermaid);
          output({ mermaid, block }, raw, block);
          break;
        }
        case 'graph': {
          let nodes = [];
          let edges = [];
          try {
            const stats = await graphOps.graphStats(roomDir);
            if (stats && stats.nodes) {
              nodes = stats.nodes;
              edges = stats.edges || [];
            }
          } catch (_e) {}
          if (nodes.length === 0) {
            nodes = [{ id: 'empty', type: 'Section', label: 'No graph data' }];
          }
          const mermaid = visualOps.generateMermaidGraph(nodes, edges);
          const block = visualOps.generateMermaidBlock(mermaid);
          output({ mermaid, block }, raw, block);
          break;
        }
        case 'chain': {
          let steps = [];
          try {
            const reasonDir = path.join(path.resolve(roomDir), '.reasoning');
            if (fs.existsSync(reasonDir)) {
              const runs = fs.readdirSync(reasonDir)
                .filter(f => f.endsWith('.md'))
                .sort()
                .reverse();
              if (runs.length > 0) {
                const content = fs.readFileSync(path.join(reasonDir, runs[0]), 'utf-8');
                const stepMatches = content.match(/##\s+Step\s+\d+[^#]*/g) || [];
                steps = stepMatches.map((blk, i) => {
                  const nameMatch = blk.match(/##\s+Step\s+\d+:\s*(.+)/);
                  const fwMatch = blk.match(/framework:\s*(.+)/i);
                  const statusMatch = blk.match(/status:\s*(.+)/i);
                  return {
                    name: nameMatch ? nameMatch[1].trim() : `Step ${i + 1}`,
                    framework: fwMatch ? fwMatch[1].trim() : '',
                    status: statusMatch ? statusMatch[1].trim() : 'pending'
                  };
                });
              }
            }
          } catch (_e) {}
          if (steps.length === 0) {
            steps = [
              { name: 'Diagnose', framework: 'diagnose', status: 'pending' },
              { name: 'Framework', framework: '', status: 'pending' },
              { name: 'Apply', framework: '', status: 'pending' },
              { name: 'File', framework: '', status: 'pending' },
              { name: 'Cross-ref', framework: '', status: 'pending' },
              { name: 'Graph Update', framework: '', status: 'pending' }
            ];
          }
          const mermaid = visualOps.generateMermaidChain(steps);
          const block = visualOps.generateMermaidBlock(mermaid);
          output({ mermaid, block }, raw, block);
          break;
        }
        case 'mermaid': {
          // Raw Mermaid output - type from argv[3]
          const mermaidType = argv[3] || 'room';
          let mermaid;
          if (mermaidType === 'graph') {
            let nodes = [];
            let edges = [];
            try {
              const stats = await graphOps.graphStats(roomDir);
              if (stats && stats.nodes) { nodes = stats.nodes; edges = stats.edges || []; }
            } catch (_e) {}
            if (nodes.length === 0) nodes = [{ id: 'empty', type: 'Section', label: 'No graph data' }];
            mermaid = visualOps.generateMermaidGraph(nodes, edges);
          } else if (mermaidType === 'chain') {
            mermaid = visualOps.generateMermaidChain([
              { name: 'Diagnose', framework: 'diagnose', status: 'pending' },
              { name: 'Framework', framework: '', status: 'pending' },
              { name: 'Apply', framework: '', status: 'pending' },
              { name: 'File', framework: '', status: 'pending' },
              { name: 'Cross-ref', framework: '', status: 'pending' },
              { name: 'Graph Update', framework: '', status: 'pending' }
            ]);
          } else {
            const sections = collectSections();
            mermaid = visualOps.generateMermaidRoom(sections);
          }
          output({ mermaid }, raw, mermaid);
          break;
        }
        default:
          error(`Unknown visualize subcommand: ${vizType}\n\nValid: room, graph, chain, mermaid`);
      }
      break;
    }

    case 'cascade': {
      const cascadeRoomDir = argv[1] || './room';
      const cascadeFilePath = argv[2] || null;
      const cascade = require('../lib/core/intelligence-cascade.cjs');
      const cascadeResult = await cascade.runCascade(cascadeRoomDir, {
        trigger: 'cli-hook',
        filePath: cascadeFilePath
      });
      if (raw) {
        process.stdout.write(JSON.stringify(cascadeResult));
      } else {
        process.stdout.write(JSON.stringify(cascadeResult, null, 2));
      }
      process.exit(0);
      break;
    }

    case 'record-decision': {
      // Parse named flags from argv
      const rdFlags = {};
      for (let i = 1; i < argv.length; i++) {
        if (argv[i].startsWith('--') && i + 1 < argv.length) {
          rdFlags[argv[i].slice(2)] = argv[++i];
        }
      }
      const rdRoom = rdFlags['room'];
      const rdKey = rdFlags['key'];
      const rdDecision = rdFlags['decision'];
      const rdReason = rdFlags['reason'] || '';
      const rdSourceArtifact = rdFlags['source-artifact'];
      const rdTargetArtifact = rdFlags['target-artifact'];

      // Validate required args
      if (!rdRoom || !rdKey || !rdDecision) {
        process.stderr.write('Usage: mindrian-tools.cjs record-decision --room DIR --key KEY --decision approve|reject|defer [--reason "..."] [--source-artifact ID] [--target-artifact ID]\n');
        process.exit(1);
      }
      if (!['approve', 'reject', 'defer'].includes(rdDecision)) {
        process.stderr.write('Error: --decision must be one of: approve, reject, defer\n');
        process.exit(1);
      }
      if (rdDecision === 'reject' && !rdReason) {
        process.stderr.write('Error: --reason is required when decision is reject\n');
        process.exit(1);
      }

      // Record decision in .proactive-intelligence.json
      const proactiveIntel = require('../lib/core/proactive-intelligence.cjs');
      const rdResult = proactiveIntel.recordDecision(rdRoom, rdKey, rdDecision, rdReason);

      // Optionally persist graph edge (best-effort, Tier 0: works without graph)
      let graphEdge = false;
      if (rdSourceArtifact && rdTargetArtifact) {
        const fs = require('fs');
        const graphDb = require('path').join(require('path').resolve(rdRoom), '.mindrian', 'room.db');
        if (fs.existsSync(graphDb)) {
          try {
            await graphOps.persistDecisionEdge(
              rdRoom,
              rdSourceArtifact,
              rdTargetArtifact,
              rdResult.edgeType,
              { reason: rdReason, timestamp: new Date().toISOString() }
            );
            graphEdge = true;
          } catch (_e) {
            // Graph edge creation is best-effort
          }
        }
      }

      // --- Phase 88 dual-write to decision_log (additive; primary write already completed) ---
      //
      // Primary writer above (proactive-intelligence.cjs + optional graph edge) is
      // authoritative and byte-frozen. This block is a tertiary convenience write that
      // lands the decision in the owning section's Feynman-MINTO decision_log for
      // session-start TRIPLE_CONTEXT injection (88-07). Section is derived from
      // --source-artifact; without a derivable section, dual-write is a documented
      // skip (NOT a failure: no error log entry). Any failure of the dual-write is
      // logged to .mindrian/decision-dual-write-errors.jsonl and then swallowed;
      // CLI exit 0 is preserved because primary write already succeeded.
      try {
        const path = require('path');
        const fs = require('fs');
        let derivedSection = null;
        if (rdSourceArtifact) {
          const roomAbs = path.resolve(rdRoom);
          const absArt = path.isAbsolute(rdSourceArtifact)
            ? rdSourceArtifact
            : path.join(roomAbs, rdSourceArtifact);
          const rel = path.relative(roomAbs, absArt);
          if (!rel.startsWith('..') && !path.isAbsolute(rel)) {
            const firstSeg = rel.split(path.sep)[0];
            if (firstSeg && firstSeg !== '.' && !firstSeg.startsWith('.')) {
              derivedSection = firstSeg;
            }
          } else {
            process.stderr.write(
              'record-decision: --source-artifact outside --room; dual-write skipped\n'
            );
          }
        }
        if (derivedSection) {
          const { recordDecision: persistDecision } = require('../lib/core/decision-capture.cjs');
          const decision = {
            session_id: process.env.CLAUDE_SESSION_ID || 'sess-' + Date.now(),
            timestamp: new Date().toISOString(),
            action: rdKey,
            user_response: rdDecision,
            reason: rdReason || '(no reason)',
          };
          const dualResult = persistDecision(rdRoom, derivedSection, decision);
          if (!dualResult || dualResult.success === false) {
            const errPath = path.join(
              path.resolve(rdRoom),
              '.mindrian',
              'decision-dual-write-errors.jsonl'
            );
            try {
              fs.mkdirSync(path.dirname(errPath), { recursive: true });
              fs.appendFileSync(
                errPath,
                JSON.stringify({
                  timestamp: new Date().toISOString(),
                  reason: 'decision_log_failed',
                  decision,
                  violations: (dualResult && dualResult.violations) || [],
                }) + '\n'
              );
            } catch (logErr) {
              process.stderr.write(
                'dual-write error logging failed: ' + logErr.message + '\n'
              );
            }
          }
        }
      } catch (e) {
        process.stderr.write(
          'decision-capture dual-write error: ' + (e && e.message ? e.message : e) + '\n'
        );
      }
      // --- end Phase 88 ---

      const rdOutput = {
        recorded: true,
        decision: rdDecision,
        edgeType: rdResult.edgeType,
        graphEdge
      };

      if (raw) {
        process.stdout.write(JSON.stringify(rdOutput));
      } else {
        process.stdout.write(JSON.stringify(rdOutput, null, 2));
      }
      process.exit(0);
      break;
    }

    case 'bank-opportunity': {
      // argv[1] could be roomDir or JSON. If it parses as JSON, no roomDir given.
      let bkRoom = null;
      let bkJson = argv[1];
      if (argv[2]) {
        // Two args: roomDir + JSON
        bkRoom = argv[1];
        bkJson = argv[2];
      }
      if (!bkJson) error('bank-opportunity requires a JSON argument');
      let bkData;
      try { bkData = JSON.parse(bkJson); } catch (_e) { error('Invalid JSON for bank-opportunity'); }

      // If room exists, bank directly to room
      if (bkRoom) {
        const fs = require('fs');
        if (fs.existsSync(require('path').resolve(bkRoom))) {
          const result = opportunityOps.bankOpportunity(bkRoom, bkData);
          output(result, raw, JSON.stringify(result));
          break;
        }
      }

      // No room or room not found -- bank to scratchpad
      const spResult = scratchpadOps.writeScratchpadEntry('opportunity', bkData);
      output(spResult, raw, JSON.stringify(spResult));
      break;
    }

    case 'vault': {
      const orchestrator = path.resolve(__dirname, '..', 'scripts', 'vault-export-orchestrator.cjs');
      const forwarded = argv.slice(1);
      try {
        execFileSync(process.execPath, [orchestrator, ...forwarded], { stdio: 'inherit' });
      } catch (err) {
        error(`vault export failed: ${err.message}`);
      }
      break;
    }

    case 'detect-integrations': {
      const integrationRegistry = require('../lib/core/integration-registry.cjs');
      const result = integrationRegistry.detectIntegrations();
      output(result, raw, JSON.stringify(result, null, 2));
      break;
    }

    default:
      error(`Unknown command: ${command}\n\n${USAGE}`);
  }
}

main().catch(e => {
  error(e.message);
});
