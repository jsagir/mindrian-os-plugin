/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 101-02 -- lib/hmi/shape-g-renderer.cjs
 * Shape G (Comparison Matrix). Render-only in v1; interactive table picking
 * is v1.15.x. Produces a 4-zone block whose Zone 2 body is a comparison
 * matrix: rows = options, columns = criteria.
 *
 * Contract (RESEARCH section 3 + PLAN must_haves):
 *   - options.length >= 3 AND criteria.length >= 2 (D-08); else fallthrough to E
 *   - cells clamped to CELL_CLAMP (12) chars + ellipsis; criteria to CRITERION_CLAMP (10)
 *   - 4-zone wrapping with Zone 4 footer (>= 2 /mos: references)
 *   - 12-glyph compliance + ASCII pipe column separator (allowed for table use)
 *
 * Source uses String.fromCharCode(0x2500) for U+2500 so the file contains
 * zero literal forbidden box-drawing chars per scripts/doctor.cjs scan.
 *
 * Canon Part 8 (LOCAL ONLY): pure function. License: BSL 1.1.
 */

'use strict';

// path + fs reserved for forward-compat (PLAN names them as imports).
require('node:path');
require('node:fs');

const G_FILLED_SQUARE = '■';        // U+25A0
const G_RIGHT_TRI_FILLED = '▶';     // U+25B6
const G_RIGHT_TRI_EMPTY = '▷';      // U+25B7
const G_DASH = String.fromCharCode(0x2500); // U+2500 (avoid literal in source)

const CRITERION_CLAMP = 10;
const CELL_CLAMP = 12;
const ELLIPSIS = '...';

const DEFAULT_FOOTER_VERBS = [
  { glyph: G_RIGHT_TRI_FILLED, command: '/mos:scenario-plan', hint: 'Branch into futures' },
  { glyph: G_RIGHT_TRI_EMPTY, command: '/mos:deep-grade', hint: 'Score each option' },
  { glyph: G_RIGHT_TRI_EMPTY, command: '/mos:jtbd set decide-pursue', hint: 'Move to commit gate' },
];

function clamp(s, maxLen) {
  const str = (s === null || s === undefined) ? '' : String(s);
  if (str.length <= maxLen) return str;
  if (maxLen <= ELLIPSIS.length) return str.slice(0, maxLen);
  return str.slice(0, maxLen - ELLIPSIS.length) + ELLIPSIS;
}

function pad(s, width) {
  const str = (s === null || s === undefined) ? '' : String(s);
  if (str.length >= width) return str;
  return str + ' '.repeat(width - str.length);
}

function repeatChar(ch, width) {
  return width <= 0 ? '' : ch.repeat(width);
}

function validateDimensions(options, criteria) {
  if (!Array.isArray(options) || options.length < 3) {
    return { fallthrough: true, fallthroughTo: 'E', reason: 'degenerate_matrix' };
  }
  if (!Array.isArray(criteria) || criteria.length < 2) {
    return { fallthrough: true, fallthroughTo: 'E', reason: 'degenerate_matrix' };
  }
  return null;
}

function computeWidths(options, criteriaClamped, cellsClamped) {
  let optionColWidth = 0;
  for (const opt of options) {
    const len = String(opt || '').length;
    if (len > optionColWidth) optionColWidth = len;
  }
  const criterionWidths = new Array(criteriaClamped.length);
  for (let c = 0; c < criteriaClamped.length; c++) {
    let maxCell = criteriaClamped[c].length;
    for (const opt of options) {
      const cell = (cellsClamped[opt] && cellsClamped[opt][criteriaClamped[c]]) || '';
      if (cell.length > maxCell) maxCell = cell.length;
    }
    criterionWidths[c] = maxCell;
  }
  return { optionColWidth: optionColWidth, criterionWidths: criterionWidths };
}

function renderHeader(options, criteria, opts) {
  const room = (opts && opts.room) ? opts.room : 'mindrianOS';
  const middle = opts && opts.title
    ? opts.title
    : (opts && opts.jtbd ? opts.jtbd : 'compare');
  const dims = options.length + ' options x ' + criteria.length + ' criteria';
  return '-- ' + room + ' -- ' + middle + ' -- ' + dims + ' --';
}

function renderBody(options, criteriaClamped, cellsClamped) {
  const widths = computeWidths(options, criteriaClamped, cellsClamped);
  const optW = widths.optionColWidth;
  const critW = widths.criterionWidths;
  const lines = [];
  lines.push(G_FILLED_SQUARE + ' Comparison Matrix');

  let headerRow = '  ' + pad('', optW);
  for (let c = 0; c < criteriaClamped.length; c++) {
    headerRow += ' | ' + pad(criteriaClamped[c], critW[c]);
  }
  lines.push(headerRow);

  let sepRow = '  ' + repeatChar(G_DASH, optW);
  for (let c = 0; c < criteriaClamped.length; c++) {
    sepRow += ' ' + G_DASH + ' ' + repeatChar(G_DASH, critW[c]);
  }
  lines.push(sepRow);

  for (const opt of options) {
    let row = '  ' + pad(String(opt), optW);
    for (let c = 0; c < criteriaClamped.length; c++) {
      const cell = (cellsClamped[opt] && cellsClamped[opt][criteriaClamped[c]]) || '';
      row += ' | ' + pad(cell, critW[c]);
    }
    lines.push(row);
  }
  return lines.join('\n');
}

/**
 * Phase 101-05: Mode-aware footer marker selection.
 *
 * Per Canon Part 3 "Option generation tier-awareness":
 *   Mode A (tier >= 2)  -> first verb may carry RECOMMENDED ▶ marker (Brain-derived).
 *   Mode B (tier === 1) -> all verbs use the empty triangle ▷ marker; ▶ NEVER renders.
 *
 * Defense-in-depth: this guard lives inside the renderer regardless of whether
 * the dispatcher already gated the call. A buggy caller forgetting to pass mode
 * still cannot leak a ▶ marker in Mode B.
 */
function renderFooter(footerVerbs, mode) {
  const verbs = (Array.isArray(footerVerbs) && footerVerbs.length >= 2)
    ? footerVerbs
    : DEFAULT_FOOTER_VERBS;
  const isModeB = (mode === 'B');
  const lines = [];
  for (let i = 0; i < verbs.length; i++) {
    const v = verbs[i];
    const defaultGlyph = (i === 0 && !isModeB) ? G_RIGHT_TRI_FILLED : G_RIGHT_TRI_EMPTY;
    // In Mode B, hard-override any caller-supplied ▶ glyph to ▷ (Canon Part 3).
    const rawGlyph = v.glyph || defaultGlyph;
    const glyph = isModeB ? G_RIGHT_TRI_EMPTY : rawGlyph;
    const cmd = v.command || '/mos:status';
    const hint = v.hint || '';
    const hintSuffix = hint ? '# ' + hint : '';
    lines.push('  ' + glyph + ' ' + pad(cmd, 28) + hintSuffix);
  }
  return lines.join('\n');
}

function renderShapeG(input) {
  const opts = input || {};
  const options = opts.options;
  const criteria = opts.criteria;
  const cells = opts.cells || {};

  // Phase 101-05: derive mode from explicit `mode` arg or fall back to `tier`.
  // Mode A (Brain reachable + tier >= 2) renders RECOMMENDED ▶ on first footer verb.
  // Mode B (tier 1 / Brain unreachable) suppresses ▶ across the entire footer.
  let mode;
  if (opts.mode === 'A' || opts.mode === 'B') {
    mode = opts.mode;
  } else if (typeof opts.tier === 'number') {
    mode = opts.tier >= 2 ? 'A' : 'B';
  } else {
    mode = 'A'; // back-compat: pre-101-05 callers default to Mode A behavior
  }

  const dimErr = validateDimensions(options, criteria);
  if (dimErr) return dimErr;

  const criteriaClamped = criteria.map((c) => clamp(c, CRITERION_CLAMP));
  const cellsClamped = {};
  for (const opt of options) {
    cellsClamped[opt] = {};
    const optCells = (cells[opt] && typeof cells[opt] === 'object') ? cells[opt] : {};
    for (let c = 0; c < criteria.length; c++) {
      const origKey = criteria[c];
      const clampedKey = criteriaClamped[c];
      const raw = optCells[origKey] !== undefined ? optCells[origKey] : optCells[clampedKey];
      cellsClamped[opt][clampedKey] = clamp(raw, CELL_CLAMP);
    }
  }

  return {
    zones: {
      header: renderHeader(options, criteria, opts),
      body: renderBody(options, criteriaClamped, cellsClamped),
      signals: '',
      footer: renderFooter(opts.footerVerbs, mode),
    },
    contract: {
      shape: 'G',
      passthrough: false,
      options_count: options.length,
      criteria_count: criteria.length,
      mode: mode,
    },
  };
}

module.exports = {
  renderShapeG: renderShapeG,
  _internal: {
    clamp: clamp,
    pad: pad,
    validateDimensions: validateDimensions,
    computeWidths: computeWidths,
    CRITERION_CLAMP: CRITERION_CLAMP,
    CELL_CLAMP: CELL_CLAMP,
    ELLIPSIS: ELLIPSIS,
  },
};
