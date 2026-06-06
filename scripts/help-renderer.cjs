#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 121.5-07 Task 2 -- /mos:help renderer with truecolor/ASCII dispatch.
 * Quick task 260602-dsc -- De Stijl CARD view (the approved visualization).
 *
 * Composes the help page by joining data/help-groups.json (canonical groups)
 * with each commands/<name>.md help_jtbd: frontmatter field (Task 1 sweep).
 *
 * The view is a De Stijl CARD layout (user-approved prototype at
 * .planning/quick/260602-dsc-help-destijl-card-view/APPROVED-prototype.cjs):
 *   - A Mondrian header bar (red/yellow/blue blocks + "MindrianOS command map").
 *   - Four LANES, each color-coded + glyphed + counted (lanes come from
 *     data/help-groups.json group.lane + the _lanes labels block):
 *       start        De Stijl blue   glyph |>   label "Start + navigate"
 *       methodology  De Stijl yellow glyph []   label "Run a methodology"
 *       explore      De Stijl green  glyph zap  label "Explore + intelligence"
 *       view         De Stijl red    glyph #    label "View + manage"
 *   - Every command is a 2-LINE CARD: line 1 = block + /mos:<command>; line 2 =
 *     block + the help_jtbd one-liner. Blank line between cards.
 *
 * Dispatch (Decision D-05 LOCKED):
 *   capability == 'truecolor' -> renderHelpCards(groups, true)  (24-bit ANSI)
 *   capability == '256color'  -> renderHelpCards(groups, true)  (modern 256-color
 *                                terminals also accept truecolor escapes)
 *   capability == 'ascii'     -> renderHelpCards(groups, false) (SAME card layout,
 *                                zero ANSI -- the stripped view is already clean)
 *
 * The renderer is the SINGLE SOURCE OF TRUTH for /mos:help output. commands/help.md
 * delegates to this script.
 *
 * Canon references:
 *   Part 3  UI Ruling System -- 4-zone format preserved by the renderer's design;
 *           commands/help.md's body_shape: B (Semantic Tree) is preserved -- the
 *           card view IS a semantic tree grouped by lane.
 *   Part 7  Reuse Before Build -- consolidates inline ANSI escape soup that
 *           previously lived in commands/help.md's LLM-rendered body; the DS
 *           truecolor palette mirrors lib/core/visual-ops.cjs.
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

// De Stijl truecolor palette (mirrors the DS hex set in lib/core/visual-ops.cjs).
// Sourced inline so the renderer stays self-contained and bulletproof.
const DS = {
  red: '\x1b[38;2;166;61;47m',
  blue: '\x1b[38;2;30;58;110m',
  yellow: '\x1b[38;2;200;164;60m',
  green: '\x1b[38;2;45;107;74m',
  amethyst: '\x1b[38;2;107;78;139m',
  teal: '\x1b[38;2;42;107;94m',
  cream: '\x1b[38;2;245;240;232m',
  muted: '\x1b[38;2;160;154;144m',
};
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';

// Lane render order + per-lane color/glyph (the approved prototype's lane map).
// Labels come from groups._lanes; LANE_LABEL_FALLBACK keeps the renderer working
// if a future data edit drops the _lanes block.
const LANE_ORDER = ['start', 'methodology', 'explore', 'view'];
const LANE_META = {
  start: { colorKey: 'blue', glyph: '▶' }, //  blue, right-triangle
  methodology: { colorKey: 'yellow', glyph: '□' }, //  yellow, hollow square
  explore: { colorKey: 'green', glyph: '⚡' }, //  green, high-voltage
  view: { colorKey: 'red', glyph: '■' }, //  red, filled square
};
const LANE_LABEL_FALLBACK = {
  start: 'Start + navigate',
  methodology: 'Run a methodology',
  explore: 'Explore + intelligence',
  view: 'View + manage',
};
const BLOCK = '█'; // Mondrian color block
const RULE_WIDTH = 72;

function jtbdFor(name) {
  const fm = readCommandFrontmatter(name);
  return fm && fm.help_jtbd ? fm.help_jtbd : '';
}

// Collect every command whose group.lane === lane, in group order.
function commandsForLane(groups, lane) {
  const out = [];
  for (const g of groups.groups) {
    if (g.lane === lane) {
      for (const cmd of g.commands) out.push(cmd);
    }
  }
  return out;
}

// Collect the groups for a lane (in declaration order), each with its label,
// glyph, and command list. The card view prints a group sub-header per group so
// the full group taxonomy (all 11 group labels) stays visible inside its lane.
function groupsForLane(groups, lane) {
  return groups.groups.filter((g) => g.lane === lane);
}

/**
 * Render the De Stijl card view.
 *
 * @param {object} groups - parsed data/help-groups.json
 * @param {boolean} useColor - true emits DS 24-bit ANSI escapes; false emits the
 *   SAME card layout with zero ANSI (the stripped text view).
 * @returns {string} the full help page (no trailing newline)
 */
function renderHelpCards(groups, useColor) {
  // Color helpers collapse to '' when useColor is false, so one code path
  // produces both the truecolor and the stripped views byte-for-byte aligned.
  const col = (key) => (useColor ? DS[key] : '');
  const R = useColor ? RESET : '';
  const B = useColor ? BOLD : '';
  const D = useColor ? DIM : '';
  const lanes = (groups && groups._lanes) || {};

  const out = [];
  out.push('');
  // Mondrian header bar: red/yellow/blue blocks + title.
  out.push(
    '  ' +
      col('red') + B + BLOCK +
      col('yellow') + BLOCK +
      col('blue') + BLOCK + R +
      '  ' + B + 'MindrianOS' + R +
      col('muted') + '  command map' + R +
      '  ' + D + '(pick a card; type the command to run)' + R
  );
  out.push('');

  for (const lane of LANE_ORDER) {
    const meta = LANE_META[lane];
    const laneColor = col(meta.colorKey);
    const label = lanes[lane] || LANE_LABEL_FALLBACK[lane];
    const cmds = commandsForLane(groups, lane);

    // Lane header: glyph + label + rule + count.
    const ruleLen = Math.max(0, RULE_WIDTH - label.length - 6);
    out.push(
      '  ' + laneColor + B + meta.glyph + ' ' + label + R +
        col('muted') + '  ' + '─'.repeat(ruleLen) + R +
        '  ' + D + '(' + cmds.length + ')' + R
    );
    out.push('');

    // Walk the lane's groups in declaration order. Each group prints a sub-header
    // (its glyph + label) so the full 11-group taxonomy stays visible, then a
    // 2-line card per command.
    for (const g of groupsForLane(groups, lane)) {
      out.push(
        '    ' + col('muted') + B + (g.glyph || '·') + ' ' + g.label + R
      );
      for (const cmd of g.commands) {
        out.push('    ' + laneColor + BLOCK + R + ' ' + laneColor + B + '/mos:' + cmd + R);
        const j = jtbdFor(cmd);
        if (j) out.push('    ' + laneColor + BLOCK + R + ' ' + col('cream') + j + R);
        out.push('');
      }
    }
  }

  return out.join('\n');
}

function renderHelp(opts) {
  const o = opts || {};
  const groups = o.groups || loadGroups();
  const capability = o.capability || probeCapability();
  const useColor = capability === 'truecolor' || capability === '256color';
  return renderHelpCards(groups, useColor);
}

function main() {
  process.stdout.write(renderHelp() + '\n');
  process.exit(0);
}

if (require.main === module) main();

module.exports = { renderHelp, renderHelpCards, loadGroups };
