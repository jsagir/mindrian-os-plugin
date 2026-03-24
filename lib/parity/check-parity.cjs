#!/usr/bin/env node
/**
 * CLI/MCP Parity Check
 *
 * Validates that every CLI command in commands/ has a corresponding
 * MCP tool path in the hierarchical router. Designed for CI — exits 1
 * on any missing mapping so parity drift is caught automatically.
 *
 * Usage:  node lib/parity/check-parity.cjs
 */

'use strict';

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const COMMANDS_DIR = path.join(REPO_ROOT, 'commands');
const TOOL_ROUTER = path.join(REPO_ROOT, 'lib', 'mcp', 'tool-router.cjs');

// ── 1. Read CLI commands from commands/*.md ──────────────────────────────────

if (!fs.existsSync(COMMANDS_DIR)) {
  process.stderr.write(`ERROR: commands/ directory not found at ${COMMANDS_DIR}\n`);
  process.exit(1);
}

const cliCommands = fs.readdirSync(COMMANDS_DIR)
  .filter(f => f.endsWith('.md'))
  .map(f => f.replace(/\.md$/, ''))
  .sort();

if (cliCommands.length === 0) {
  process.stderr.write('ERROR: No .md files found in commands/ directory\n');
  process.exit(1);
}

// ── 2. Import ALL_TOOL_COMMANDS from tool router ─────────────────────────────

if (!fs.existsSync(TOOL_ROUTER)) {
  process.stderr.write(`ERROR: tool-router.cjs not found at ${TOOL_ROUTER}\n`);
  process.exit(1);
}

let ALL_TOOL_COMMANDS;
try {
  ({ ALL_TOOL_COMMANDS } = require(TOOL_ROUTER));
} catch (err) {
  process.stderr.write(`ERROR: Failed to load tool-router.cjs: ${err.message}\n`);
  process.exit(1);
}

if (!Array.isArray(ALL_TOOL_COMMANDS)) {
  process.stderr.write('ERROR: ALL_TOOL_COMMANDS is not an array\n');
  process.exit(1);
}

const mcpSet = new Set(ALL_TOOL_COMMANDS);
const cliSet = new Set(cliCommands);

// ── 3. Compare ───────────────────────────────────────────────────────────────

const missingInMcp = cliCommands.filter(cmd => !mcpSet.has(cmd));
const extraInMcp = ALL_TOOL_COMMANDS.filter(cmd => !cliSet.has(cmd));

// ── 4. Report ────────────────────────────────────────────────────────────────

if (missingInMcp.length > 0) {
  process.stderr.write(`FAIL: ${missingInMcp.length} CLI command(s) missing from MCP tools:\n`);
  missingInMcp.forEach(cmd => process.stderr.write(`  - ${cmd}\n`));
}

if (extraInMcp.length > 0) {
  process.stderr.write(`WARNING: ${extraInMcp.length} MCP tool command(s) not in CLI commands/:\n`);
  extraInMcp.forEach(cmd => process.stderr.write(`  - ${cmd}\n`));
}

if (missingInMcp.length > 0) {
  process.exit(1);
}

process.stdout.write(`Parity OK: ${cliCommands.length} CLI commands, ${ALL_TOOL_COMMANDS.length} MCP tool commands\n`);
process.exit(0);
