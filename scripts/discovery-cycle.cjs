#!/usr/bin/env node
/**
 * discovery-cycle.cjs -- Discovery Cycle Orchestrator
 * =====================================================
 * Chains HSI, RS, and Analogy whitespace detection into a single
 * sequenced command. Each step's JSON output feeds the next.
 *
 * Step sequence:
 *   1. Pre-flight -- check which pipeline outputs exist
 *   2. Export ANALOGOUS_TO edges from SQLite to .mindrian/analogy-edges.json
 *   3. HSI -> Whitespace(between) -- run discover-hsi-whitespace.py
 *   4. RS -> Whitespace(downstream) -- run discover-rs-whitespace.py
 *   5. Analogy -> Whitespace(transfer) -- run discover-analogy-whitespace.py
 *   6. Aggregate -- merge all discovery results into discovery-cycle-results.json
 *   7. Run interpret-whitespace.cjs on new zones (classify + hypothesis via Brain)
 *   8. Write validated whitespace to Brain (fire-and-forget, never blocks)
 *
 * On-demand execution only (per D-11 -- NOT a post-write hook).
 *
 * Usage:
 *   node scripts/discovery-cycle.cjs /path/to/room [--steps all|hsi|rs|analogy] [--verbose] [--dry-run]
 *   node scripts/discovery-cycle.cjs --help
 *
 * Output:
 *   {room}/.mindrian/discovery-cycle-results.json
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { ensureBrainBaseline } = require('./ensure-brain-baseline.cjs');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SCRIPTS_DIR = path.join(__dirname);

const DISCOVERY_STEPS = {
  hsi: {
    script: path.join(SCRIPTS_DIR, 'discover-hsi-whitespace.py'),
    outputFile: 'discovery-hsi-whitespace.json',
    label: 'HSI -> Whitespace(between)',
    requires: ['.hsi-results.json'],
  },
  rs: {
    script: path.join(SCRIPTS_DIR, 'discover-rs-whitespace.py'),
    outputFile: 'discovery-rs-whitespace.json',
    label: 'RS -> Whitespace(downstream)',
    requires: ['.hsi-results.json'],
  },
  analogy: {
    script: path.join(SCRIPTS_DIR, 'discover-analogy-whitespace.py'),
    outputFile: 'discovery-analogy-whitespace.json',
    label: 'Analogy -> Whitespace(transfer)',
    requires: [],  // analogy-edges.json exported in step 2, or HSI fallback
  },
};

const VALID_STEPS = ['all', 'hsi', 'rs', 'analogy'];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function log(msg) {
  process.stderr.write(msg + '\n');
}

function verbose(msg, isVerbose) {
  if (isVerbose) log('  [verbose] ' + msg);
}

function fileExists(p) {
  try { return fs.statSync(p).isFile(); } catch { return false; }
}

function readJSON(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch {
    return null;
  }
}

function writeJSON(p, data) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf-8');
}

// ---------------------------------------------------------------------------
// Step 1: Pre-flight
// ---------------------------------------------------------------------------

function preflight(roomDir, requestedSteps, opts) {
  const mindrianDir = path.join(roomDir, '.mindrian');
  const report = {
    hsi_results: fileExists(path.join(roomDir, '.hsi-results.json')),
    embeddings: fileExists(path.join(mindrianDir, 'whitespace-embeddings.json')),
    brain_baseline: fileExists(path.join(mindrianDir, 'brain-baseline.json')),
    analogy_edges: fileExists(path.join(mindrianDir, 'analogy-edges.json')),
    sqlite_available: false,
    python_available: false,
    python_version: null,
    steps_will_run: [],
    steps_will_skip: [],
    data_summary: {},
  };

  // Check embeddings (hard requirement)
  if (!report.embeddings) {
    return { ok: false, report, error: 'Run whitespace embedder first: no .mindrian/whitespace-embeddings.json found' };
  }

  // Check Python availability
  try {
    const pyVer = execSync('python3 --version 2>&1', { encoding: 'utf-8' }).trim();
    report.python_available = true;
    report.python_version = pyVer.replace('Python ', '');
  } catch {
    report.python_available = false;
  }

  // Check SQLite (LazyGraph) availability
  try {
    require('node:sqlite');
    report.sqlite_available = true;
  } catch {
    report.sqlite_available = false;
  }

  // Load data summaries for reporting
  if (report.hsi_results) {
    const hsi = readJSON(path.join(roomDir, '.hsi-results.json'));
    if (hsi) {
      const pairs = hsi.hsi_pairs || [];
      const aboveThreshold = pairs.filter(p => (p.hsi_score || 0) > 0.4).length;
      report.data_summary.hsi = `${pairs.length} pairs, ${aboveThreshold} above threshold`;
    }
  }

  if (report.embeddings) {
    const ws = readJSON(path.join(mindrianDir, 'whitespace-embeddings.json'));
    if (ws) {
      const embs = ws.embeddings || [];
      const dim = embs.length > 0 && embs[0].vector ? embs[0].vector.length : 0;
      report.data_summary.embeddings = `${embs.length} artifacts, ${dim}-dim`;
    }
  }

  if (report.brain_baseline) {
    const bl = readJSON(path.join(mindrianDir, 'brain-baseline.json'));
    if (bl) {
      report.data_summary.brain_baseline = `${(bl.baselines || []).length} frameworks`;
    }
  }

  // Determine which steps run vs skip
  for (const stepName of requestedSteps) {
    const step = DISCOVERY_STEPS[stepName];
    if (!step) continue;

    // Check script exists
    if (!fileExists(step.script)) {
      report.steps_will_skip.push(stepName);
      verbose(`${stepName}: script not found at ${step.script}`, opts.verbose);
      continue;
    }

    // Check required data files
    const missingReqs = step.requires.filter(
      req => !fileExists(path.join(roomDir, req))
    );

    if (missingReqs.length > 0) {
      report.steps_will_skip.push(stepName);
      verbose(`${stepName}: missing prerequisites: ${missingReqs.join(', ')}`, opts.verbose);
      continue;
    }

    report.steps_will_run.push(stepName);
  }

  return { ok: true, report };
}

// ---------------------------------------------------------------------------
// Step 2: Export ANALOGOUS_TO edges from SQLite
// ---------------------------------------------------------------------------

async function exportAnalogyEdges(roomDir, opts) {
  const outputPath = path.join(roomDir, '.mindrian', 'analogy-edges.json');

  try {
    const lazygraphOps = require(path.join(__dirname, '..', 'lib', 'core', 'lazygraph-ops.cjs'));
    const { db, conn } = await lazygraphOps.openGraph(roomDir);

    try {
      const rows = await lazygraphOps.queryGraph(conn,
        `MATCH (a:Artifact)-[r:ANALOGOUS_TO]->(b:Artifact)
         RETURN a.id AS source_id, b.id AS target_id,
                r.analogy_distance AS distance,
                r.structural_fitness AS fitness,
                r.source_domain AS domain,
                r.transfer_map AS transfer_map`
      );

      const edges = rows.map(r => ({
        source_id: r.source_id || '',
        target_id: r.target_id || '',
        analogy_distance: r.distance || 'near',
        structural_fitness: r.fitness || 0,
        source_domain: r.domain || '',
        transfer_map: r.transfer_map || '',
      }));

      writeJSON(outputPath, { edges, exported_at: new Date().toISOString() });
      verbose(`Exported ${edges.length} ANALOGOUS_TO edges to analogy-edges.json`, opts.verbose);

      return { exported: true, count: edges.length };
    } finally {
      await lazygraphOps.closeGraph(db);
    }
  } catch (err) {
    verbose(`SQLite edge export skipped: ${err.message}`, opts.verbose);
    return { exported: false, reason: err.message };
  }
}

// ---------------------------------------------------------------------------
// Steps 3-5: Run Python discovery scripts
// ---------------------------------------------------------------------------

function runDiscoveryStep(stepName, roomDir, opts) {
  const step = DISCOVERY_STEPS[stepName];
  if (!step) return { ran: false, reason: `Unknown step: ${stepName}` };

  const scriptPath = step.script;
  if (!fileExists(scriptPath)) {
    return { ran: false, reason: `Script not found: ${scriptPath}` };
  }

  const cmd = `python3 "${scriptPath}" "${roomDir}"`;
  verbose(`Running: ${cmd}`, opts.verbose);

  try {
    const result = execSync(cmd, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 120000,  // 2 minute timeout per step
    });

    const outputPath = path.join(roomDir, '.mindrian', step.outputFile);
    const outputData = readJSON(outputPath);
    const zoneCount = outputData ? (outputData.zones || []).length : 0;

    verbose(`${stepName}: ${zoneCount} zones found`, opts.verbose);
    return { ran: true, zones: zoneCount, outputFile: step.outputFile };
  } catch (err) {
    const stderr = err.stderr || err.message || '';
    log(`Warning: ${stepName} step failed: ${stderr.trim()}`);
    return { ran: false, reason: stderr.trim() || err.message };
  }
}

// ---------------------------------------------------------------------------
// Step 6: Aggregate results
// ---------------------------------------------------------------------------

function aggregateResults(roomDir, stepsRun, stepsSkipped) {
  const mindrianDir = path.join(roomDir, '.mindrian');
  const signalOrder = { strong: 0, moderate: 1, weak: 2 };

  const result = {
    metadata: {
      timestamp: new Date().toISOString(),
      room: roomDir,
      steps_run: stepsRun,
      steps_skipped: stepsSkipped,
      total_zones_found: 0,
    },
    hsi_whitespace: null,
    rs_whitespace: null,
    analogy_whitespace: null,
    all_zones: [],
  };

  // Read each discovery output
  for (const stepName of ['hsi', 'rs', 'analogy']) {
    const step = DISCOVERY_STEPS[stepName];
    const outputPath = path.join(mindrianDir, step.outputFile);
    const data = readJSON(outputPath);

    if (!data) continue;

    const key = stepName + '_whitespace';
    result[key] = data;

    // Flatten zones into all_zones with source_pipeline tag
    const zones = data.zones || [];
    for (const zone of zones) {
      result.all_zones.push({
        ...zone,
        source_pipeline: stepName,
      });
    }
  }

  // Sort all_zones by gap_signal strength (strong > moderate > weak)
  result.all_zones.sort((a, b) => {
    const aOrder = signalOrder[a.gap_signal] !== undefined ? signalOrder[a.gap_signal] : 3;
    const bOrder = signalOrder[b.gap_signal] !== undefined ? signalOrder[b.gap_signal] : 3;
    return aOrder - bOrder;
  });

  result.metadata.total_zones_found = result.all_zones.length;

  // Write aggregated results
  const outputPath = path.join(mindrianDir, 'discovery-cycle-results.json');
  writeJSON(outputPath, result);

  return result;
}

// ---------------------------------------------------------------------------
// Step 7: Interpretation pass
// ---------------------------------------------------------------------------

function runInterpretation(roomDir, opts) {
  const interpretScript = path.join(SCRIPTS_DIR, 'interpret-whitespace.cjs');

  if (!fileExists(interpretScript)) {
    verbose('interpret-whitespace.cjs not found, skipping interpretation', opts.verbose);
    return { ran: false, reason: 'Script not found' };
  }

  const cmd = `node "${interpretScript}" "${roomDir}"`;
  verbose(`Running interpretation: ${cmd}`, opts.verbose);

  try {
    execSync(cmd, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 60000,  // 1 minute timeout
    });

    verbose('Interpretation pass complete', opts.verbose);
    return { ran: true };
  } catch (err) {
    const stderr = err.stderr || err.message || '';
    verbose(`Interpretation skipped: ${stderr.trim()}`, opts.verbose);
    return { ran: false, reason: stderr.trim() || err.message };
  }
}

// ---------------------------------------------------------------------------
// Main orchestrator
// ---------------------------------------------------------------------------

/**
 * Run the full Discovery Cycle programmatically.
 *
 * @param {string} roomDir - Absolute path to room directory
 * @param {object} [options] - Options
 * @param {string[]} [options.steps] - Which steps to run (default: ['hsi','rs','analogy'])
 * @param {boolean} [options.verbose] - Enable verbose logging to stderr
 * @param {boolean} [options.dryRun] - Validate chain without executing
 * @returns {Promise<object>} Discovery cycle results (or dry-run report)
 */
async function runDiscoveryCycle(roomDir, options = {}) {
  const resolvedRoom = path.resolve(roomDir);
  const steps = options.steps || ['hsi', 'rs', 'analogy'];
  const opts = {
    verbose: options.verbose || false,
    dryRun: options.dryRun || false,
  };

  // Step 1: Pre-flight
  log('Discovery Cycle: pre-flight check...');
  const { ok, report, error } = preflight(resolvedRoom, steps, opts);

  if (!ok) {
    log(`Discovery Cycle aborted: ${error}`);
    return { success: false, error, report };
  }

  // Dry-run mode: return pre-flight report without executing
  if (opts.dryRun) {
    return runDryRun(resolvedRoom, report, opts);
  }

  // Step 1b: Ensure Brain baseline (auto-fire per Phase 88.6-01)
  // All three discover-* Python scripts need .mindrian/brain-baseline.json to
  // produce non-zero results. Pre-88.6, if it was missing they silently returned
  // 0 zones. Now we auto-fetch or log offline status explicitly.
  log('Discovery Cycle: ensuring Brain baseline...');
  const baselineResult = ensureBrainBaseline(resolvedRoom, { verbose: opts.verbose });
  if (!baselineResult.ensured) {
    log(`  Brain baseline: ${baselineResult.reason} -- discover-* scripts will produce 0 zones without baseline embeddings`);
  } else if (baselineResult.fetched) {
    log('  Brain baseline: fetched successfully');
  }

  // Step 2: Export ANALOGOUS_TO edges from SQLite
  log('Discovery Cycle: exporting ANALOGOUS_TO edges...');
  const edgeExport = await exportAnalogyEdges(resolvedRoom, opts);
  if (edgeExport.exported) {
    verbose(`Exported ${edgeExport.count} ANALOGOUS_TO edges`, opts.verbose);
  } else {
    verbose(`Edge export skipped: ${edgeExport.reason}`, opts.verbose);
  }

  // Steps 3-5: Run discovery scripts
  const stepsRun = [];
  const stepsSkipped = [...report.steps_will_skip];
  const stepResults = {};

  for (const stepName of report.steps_will_run) {
    log(`Discovery Cycle: ${DISCOVERY_STEPS[stepName].label}...`);
    const result = runDiscoveryStep(stepName, resolvedRoom, opts);
    stepResults[stepName] = result;

    if (result.ran) {
      stepsRun.push(stepName);
    } else {
      stepsSkipped.push(stepName);
      log(`  Skipped ${stepName}: ${result.reason}`);
    }
  }

  // Step 6: Aggregate
  log('Discovery Cycle: aggregating results...');
  const aggregated = aggregateResults(resolvedRoom, stepsRun, stepsSkipped);

  // Step 7: Interpretation pass
  if (aggregated.all_zones.length > 0) {
    log('Discovery Cycle: running interpretation pass...');
    runInterpretation(resolvedRoom, opts);
  }

  // Step 8: Write validated whitespace to Brain (fire-and-forget, per D-03)
  if (!opts.dryRun) {
    try {
      execSync(`node "${path.join(SCRIPTS_DIR, 'whitespace-to-brain.cjs')}" "${resolvedRoom}"`, {
        stdio: opts.verbose ? 'inherit' : 'pipe',
        timeout: 30000  // 30s timeout -- fire and forget
      });
      if (opts.verbose) log('Brain write complete');
    } catch (e) {
      if (opts.verbose) log('Brain write skipped: ' + (e.message || 'unknown error'));
      // Fire-and-forget: never block discovery cycle
    }
  }

  // Print human-readable summary to stdout
  const hsiCount = aggregated.hsi_whitespace ? (aggregated.hsi_whitespace.zones || []).length : 0;
  const rsCount = aggregated.rs_whitespace ? (aggregated.rs_whitespace.zones || []).length : 0;
  const anaCount = aggregated.analogy_whitespace ? (aggregated.analogy_whitespace.zones || []).length : 0;

  console.log(`Discovery Cycle complete: ${hsiCount} HSI zones, ${rsCount} RS zones, ${anaCount} Analogy zones`);

  if (opts.verbose) {
    for (const zone of aggregated.all_zones) {
      console.log(`  [${zone.gap_signal}] ${zone.zone_id}: ${zone.hypothesis}`);
    }
  }

  return {
    success: true,
    results: aggregated,
    steps_run: stepsRun,
    steps_skipped: stepsSkipped,
    edge_export: edgeExport,
    step_details: stepResults,
  };
}

// ---------------------------------------------------------------------------
// Dry-run mode
// ---------------------------------------------------------------------------

function runDryRun(roomDir, report, opts) {
  const lines = [
    '',
    'Discovery Cycle Pre-flight:',
    `  HSI results:     ${report.hsi_results ? `FOUND (${report.data_summary.hsi || 'loaded'})` : 'MISSING'}`,
    `  Embeddings:      ${report.embeddings ? `FOUND (${report.data_summary.embeddings || 'loaded'})` : 'MISSING'}`,
    `  Brain baseline:  ${report.brain_baseline ? `FOUND (${report.data_summary.brain_baseline || 'loaded'})` : 'MISSING'}`,
    `  Analogy edges:   ${report.analogy_edges ? 'FOUND (pre-exported)' : 'MISSING (will export from SQLite or use HSI fallback)'}`,
    `  SQLite:          ${report.sqlite_available ? 'AVAILABLE' : 'NOT AVAILABLE (analogy step uses HSI fallback)'}`,
    `  Python:          ${report.python_available ? report.python_version : 'NOT FOUND'}`,
    '',
    `  Steps that will run:  ${report.steps_will_run.length > 0 ? report.steps_will_run.join(', ') : '(none)'}`,
    `  Steps that will skip: ${report.steps_will_skip.length > 0 ? report.steps_will_skip.join(', ') : '(none)'}`,
  ];

  // Validate Python scripts parse correctly
  if (report.python_available) {
    lines.push('');
    lines.push('  Script validation:');
    for (const stepName of report.steps_will_run) {
      const step = DISCOVERY_STEPS[stepName];
      try {
        execSync(
          `python3 -c "import ast; ast.parse(open('${step.script}').read())"`,
          { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
        );
        lines.push(`    ${stepName}: ${path.basename(step.script)} -- VALID`);
      } catch {
        lines.push(`    ${stepName}: ${path.basename(step.script)} -- PARSE ERROR`);
      }
    }
  }

  // Estimate zones
  const totalZones = report.steps_will_run.length > 0
    ? `~${report.steps_will_run.length * 3}-${report.steps_will_run.length * 8} based on pipeline data density`
    : '0 (no steps will run)';
  lines.push('');
  lines.push(`  Estimated zones: ${totalZones}`);
  lines.push('');

  const output = lines.join('\n');
  console.log(output);

  return {
    success: true,
    dryRun: true,
    report,
    output,
  };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function printHelp() {
  console.log(`
Usage: node scripts/discovery-cycle.cjs <room-dir> [options]

Discovery Cycle orchestrator -- chains HSI, RS, and Analogy whitespace
detection into a single sequenced command.

Arguments:
  room-dir             Path to room directory

Options:
  --steps <list>       Which steps to run: all, hsi, rs, analogy (default: all)
                       Comma-separated for multiple: --steps hsi,rs
  --verbose            Enable verbose logging to stderr
  --dry-run            Validate chain without executing Python scripts
  --help               Show this help message

Output:
  {room}/.mindrian/discovery-cycle-results.json

Examples:
  node scripts/discovery-cycle.cjs ./room
  node scripts/discovery-cycle.cjs ./room --steps hsi,rs --verbose
  node scripts/discovery-cycle.cjs ./room --dry-run
`);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h') || args.length === 0) {
    printHelp();
    process.exit(0);
  }

  // Parse arguments
  const roomDir = args.find(a => !a.startsWith('--'));
  if (!roomDir) {
    log('Error: room directory is required');
    printHelp();
    process.exit(1);
  }

  const resolvedRoom = path.resolve(roomDir);
  if (!fs.existsSync(resolvedRoom)) {
    log(`Error: room directory does not exist: ${resolvedRoom}`);
    process.exit(1);
  }

  const isVerbose = args.includes('--verbose');
  const isDryRun = args.includes('--dry-run');

  // Parse --steps
  let steps = ['hsi', 'rs', 'analogy'];
  const stepsIdx = args.indexOf('--steps');
  if (stepsIdx !== -1 && args[stepsIdx + 1]) {
    const stepsArg = args[stepsIdx + 1];
    if (stepsArg === 'all') {
      steps = ['hsi', 'rs', 'analogy'];
    } else {
      steps = stepsArg.split(',').map(s => s.trim()).filter(s => VALID_STEPS.includes(s));
      if (steps.length === 0) {
        log(`Error: invalid --steps value: ${stepsArg}. Valid: ${VALID_STEPS.join(', ')}`);
        process.exit(1);
      }
    }
  }

  const result = await runDiscoveryCycle(resolvedRoom, {
    steps,
    verbose: isVerbose,
    dryRun: isDryRun,
  });

  process.exit(result.success ? 0 : 1);
}

// Run CLI if invoked directly
if (require.main === module) {
  main().catch(err => {
    log(`Fatal error: ${err.message}`);
    process.exit(1);
  });
}

module.exports = { runDiscoveryCycle };
