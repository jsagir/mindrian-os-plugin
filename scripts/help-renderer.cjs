#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 121.5-07 Task 2 -- /mos:help renderer with truecolor/ASCII dispatch.
 *
 * Composes the help page by joining data/help-groups.json (canonical groups)
 * with each commands/<name>.md help_jtbd: frontmatter field (Task 1 sweep).
 *
 * Dispatch (Decision D-05 LOCKED):
 *   capability == 'truecolor' -> truecolor branch (24-bit ANSI escapes)
 *   capability == '256color'  -> truecolor branch (uses 24-bit; modern 256-color
 *                                terminals also accept truecolor escapes)
 *   capability == 'ascii'     -> ASCII branch (12-glyph vocabulary, zero ANSI)
 *
 * The renderer is the SINGLE SOURCE OF TRUTH for /mos:help output. commands/help.md
 * delegates to this script.
 *
 * Canon references:
 *   Part 3  UI Ruling System -- 4-zone format preserved by the renderer's design;
 *           commands/help.md's body_shape: B (Semantic Tree) is preserved -- the
 *           renderer output IS a semantic tree grouped by category.
 *   Part 7  Reuse Before Build -- consolidates inline ANSI escape soup that
 *           previously lived in commands/help.md's LLM-rendered body.
 *   Part 8  Graph Boundary -- filesystem only; zero network, zero Brain,
 *           zero telemetry egress.
 */

const fs = require('fs');
const path = require('path');
const { probeCapability } = require('../lib/core/terminal-capability.cjs');

const REPO = path.resolve(__dirname, '..');
const GROUPS_PATH = path.join(REPO, 'data', 'help-groups.json');
const COMMANDS_DIR = path.join(REPO, 'commands');

function loadGroups() {
  return JSON.parse(fs.readFileSync(GROUPS_PATH, 'utf8'));
}

function readCommandFrontmatter(name) {
  try {
    const text = fs.readFileSync(path.join(COMMANDS_DIR, name + '.md'), 'utf8');
    const m = text.match(/^---\n([\s\S]*?)\n---/);
    if (!m) return null;
    const out = {};
    for (const line of m[1].split('\n')) {
      const kv = line.match(/^([a-z_]+):\s*(.+)$/i);
      if (kv) {
        let v = kv[2].trim();
        // Strip surrounding double-quotes if present (YAML scalar).
        const qm = v.match(/^"([\s\S]*)"$/);
        if (qm) v = qm[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
        out[kv[1]] = v;
      }
    }
    return out;
  } catch (_) {
    return null;
  }
}

// Truecolor palette per group id (sourced inline; references/visual/palette.json
// is canonical at Plan 121.5-03 but the renderer falls back to inline hex if the
// palette file is not loadable -- keeps the renderer self-contained and bulletproof).
const COLORS_TRUECOLOR = {
  'getting-started': '\x1b[38;2;42;107;94m', // teal
  'problem-discovery': '\x1b[38;2;166;61;47m', // red
  'structured-thinking': '\x1b[38;2;30;58;110m', // blue
  perspectives: '\x1b[38;2;107;78;139m', // amethyst
  'intelligence-brain': '\x1b[38;2;200;164;60m', // yellow
  working: '\x1b[38;2;245;240;232m', // cream
  reviewing: '\x1b[38;2;45;107;74m', // green
  export: '\x1b[38;2;45;107;74m', // green
  publish: '\x1b[38;2;42;107;94m', // teal
  hub: '\x1b[38;2;107;78;139m', // amethyst
  infrastructure: '\x1b[38;2;90;90;90m', // gray
};
const RESET = '\x1b[0m';
const HEADER = '\x1b[38;2;245;240;232m'; // cream

function renderHelpColor(groups) {
  const lines = [];
  lines.push(HEADER + 'MindrianOS commands' + RESET);
  lines.push(HEADER + '===================' + RESET);
  lines.push('');
  for (const g of groups.groups) {
    const c = COLORS_TRUECOLOR[g.id] || '';
    lines.push(c + g.glyph + ' ' + g.label + RESET);
    for (const cmd of g.commands) {
      const fm = readCommandFrontmatter(cmd);
      const jtbd = fm && fm.help_jtbd ? fm.help_jtbd : '(no help_jtbd)';
      lines.push('  ' + c + '/mos:' + cmd.padEnd(22) + RESET + ' ' + jtbd);
    }
    lines.push('');
  }
  return lines.join('\n');
}

function renderHelpAscii(groups) {
  const lines = [];
  lines.push('MindrianOS commands');
  lines.push('===================');
  lines.push('');
  for (const g of groups.groups) {
    lines.push(g.glyph + ' ' + g.label);
    for (const cmd of g.commands) {
      const fm = readCommandFrontmatter(cmd);
      const jtbd = fm && fm.help_jtbd ? fm.help_jtbd : '(no help_jtbd)';
      lines.push('  /mos:' + cmd.padEnd(22) + ' ' + jtbd);
    }
    lines.push('');
  }
  return lines.join('\n');
}

function renderHelp(opts) {
  const o = opts || {};
  const groups = o.groups || loadGroups();
  const capability = o.capability || probeCapability();
  if (capability === 'truecolor' || capability === '256color') {
    return renderHelpColor(groups);
  }
  return renderHelpAscii(groups);
}

function main() {
  process.stdout.write(renderHelp() + '\n');
  process.exit(0);
}

if (require.main === module) main();

module.exports = { renderHelp, renderHelpColor, renderHelpAscii, loadGroups };
