#!/usr/bin/env node
'use strict';

/**
 * fetch-brain-baseline.cjs -- Fetch Brain Framework Descriptions
 * ================================================================
 * Queries Brain (Neo4j via brain-client.cjs) for all Framework nodes
 * with descriptions, outputs JSON suitable for the Python embedding
 * pipeline (fetch-brain-baseline.py).
 *
 * Usage:
 *   node scripts/fetch-brain-baseline.cjs --room ./room [--output brain-data.json]
 *
 * Output: JSON file with framework descriptions from Brain, written to
 *   {room}/.mindrian/brain-data.json (default) or --output path.
 *
 * If Brain is unreachable (no API key, network error), exits gracefully
 * with a message (exit code 0, empty frameworks array).
 */

const fs = require('fs');
const path = require('path');

// Parse arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = { room: null, output: null };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--room' && args[i + 1]) {
      parsed.room = args[i + 1];
      i++;
    } else if (args[i] === '--output' && args[i + 1]) {
      parsed.output = args[i + 1];
      i++;
    } else if (args[i] === '--help' || args[i] === '-h') {
      console.log(`Usage: node scripts/fetch-brain-baseline.cjs --room ./room [--output brain-data.json]

Fetches Brain framework descriptions via brain-client.cjs (Neo4j HTTP API).
Outputs JSON for the Python embedding pipeline (fetch-brain-baseline.py).

Options:
  --room    Path to room directory (required)
  --output  Output JSON path (default: {room}/.mindrian/brain-data.json)
  --help    Show this help message`);
      process.exit(0);
    }
  }

  if (!parsed.room) {
    console.error('Error: --room is required. Run with --help for usage.');
    process.exit(1);
  }

  return parsed;
}

async function main() {
  const args = parseArgs();
  const roomDir = path.resolve(args.room);

  if (!fs.existsSync(roomDir) || !fs.statSync(roomDir).isDirectory()) {
    console.error(`Error: ${roomDir} is not a directory`);
    process.exit(1);
  }

  // Determine output path
  const outputPath = args.output
    ? path.resolve(args.output)
    : path.join(roomDir, '.mindrian', 'brain-data.json');

  // Ensure output directory exists
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Load brain-client
  let brain;
  try {
    brain = require(path.join(__dirname, '..', 'lib', 'core', 'brain-client.cjs'));
  } catch (err) {
    console.error('Warning: Could not load brain-client.cjs:', err.message);
    writeEmptyResult(outputPath, 'brain-client-unavailable');
    process.exit(0);
  }

  // Check Brain availability
  if (!brain.isAvailable()) {
    console.log('Brain: No API key found (MINDRIAN_BRAIN_KEY not set). Writing empty baseline.');
    writeEmptyResult(outputPath, 'no-api-key');
    process.exit(0);
  }

  // Query Brain for Framework nodes via the curated askOp surface.
  // Uses brain.askOp('list_frameworks', {}) -- the ungated D-MOAT-1-safe
  // curated op. No raw Cypher. Row shape: { name, description, category }.
  console.log('Brain: Fetching framework descriptions via askOp(list_frameworks)...');

  let opResult;
  try {
    opResult = await brain.askOp('list_frameworks', {});
  } catch (err) {
    console.error('Brain: askOp failed:', err.message);
    writeEmptyResult(outputPath, 'query-failed');
    process.exit(0);
  }

  if (!opResult) {
    console.log('Brain: askOp returned null (Brain may be unreachable). Writing empty baseline.');
    writeEmptyResult(outputPath, 'query-returned-null');
    process.exit(0);
  }

  // Curated op returns { op, source, count, rows, degraded? }.
  // On graph failure the server returns degraded:true + rows:[].
  if (opResult.degraded) {
    console.log('Brain: askOp returned degraded envelope. Writing empty baseline.');
    writeEmptyResult(outputPath, 'brain-degraded');
    process.exit(0);
  }

  // Parse records from the curated op rows array.
  // Row shape: { name, description, category } (all strings; description/category
  // may be empty strings when the node lacks those fields -- that is acceptable;
  // the old filter required a non-empty description, preserve that behaviour).
  //
  // RUN 3, 2026-08-11: the drop is now COUNTED AND REPORTED via the
  // dropped_empty_description metadata field below. The deployed brain
  // census fix returns the full 181-row population, so an unreported drop
  // (~45 rows) would masquerade as a fetch regression instead of the honest
  // read it actually is. The keep-condition below is unchanged.
  const frameworks = [];
  const rows = Array.isArray(opResult.rows) ? opResult.rows : [];
  let droppedEmptyDescription = 0;
  let droppedEmptyName = 0;

  for (const rec of rows) {
    const name = rec.name || '';
    const description = rec.description || '';
    const category = rec.category || '';

    if (name && description) {
      frameworks.push({ name, description, category });
    } else if (name && !description) {
      droppedEmptyDescription++;
    } else if (!name) {
      droppedEmptyName++;
    }
  }

  // Write output
  const output = {
    metadata: {
      timestamp: new Date().toISOString(),
      source: 'brain-mcp',
      framework_count: frameworks.length,
      rows_total: rows.length,
      dropped_empty_description: droppedEmptyDescription,
      dropped_empty_name: droppedEmptyName,
    },
    frameworks,
  };

  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf8');
  let summary = `Brain: Fetched ${frameworks.length} frameworks (${rows.length} rows, ${droppedEmptyDescription} dropped for empty description) -> ${outputPath}`;
  if (droppedEmptyName > 0) {
    summary += ` (${droppedEmptyName} dropped for empty name)`;
  }
  console.log(summary);
}

function writeEmptyResult(outputPath, reason) {
  const output = {
    metadata: {
      timestamp: new Date().toISOString(),
      source: 'brain-mcp',
      framework_count: 0,
      empty_reason: reason,
    },
    frameworks: [],
  };
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf8');
  console.log(`Brain: Wrote empty result (${reason}) -> ${outputPath}`);
}

main().catch((err) => {
  console.error('Unexpected error:', err.message);
  process.exit(1);
});
