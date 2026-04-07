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

  // Query Brain for Framework nodes with descriptions
  console.log('Brain: Fetching framework descriptions from Neo4j...');

  const cypher = `
    MATCH (f:Framework)
    WHERE f.description IS NOT NULL AND f.description <> ''
    RETURN f.name AS name, f.description AS description, f.category AS category
    ORDER BY f.name
    LIMIT 1000
  `;

  let result;
  try {
    result = await brain.query(cypher);
  } catch (err) {
    console.error('Brain: Query failed:', err.message);
    writeEmptyResult(outputPath, 'query-failed');
    process.exit(0);
  }

  if (!result) {
    console.log('Brain: Query returned null (Brain may be unreachable). Writing empty baseline.');
    writeEmptyResult(outputPath, 'query-returned-null');
    process.exit(0);
  }

  // Parse records from Brain response
  const frameworks = [];

  if (result.error) {
    console.error(`Brain: Error response: ${result.error} - ${result.message || ''}`);
    writeEmptyResult(outputPath, 'brain-error');
    process.exit(0);
  }

  // Brain query returns records as array of objects or arrays
  const records = result.records || result || [];

  if (Array.isArray(records)) {
    for (const rec of records) {
      const name = rec.name || rec[0] || '';
      const description = rec.description || rec[1] || '';
      const category = rec.category || rec[2] || '';

      if (name && description) {
        frameworks.push({ name, description, category });
      }
    }
  }

  // Write output
  const output = {
    metadata: {
      timestamp: new Date().toISOString(),
      source: 'brain-mcp',
      framework_count: frameworks.length,
    },
    frameworks,
  };

  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf8');
  console.log(`Brain: Fetched ${frameworks.length} frameworks -> ${outputPath}`);
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
