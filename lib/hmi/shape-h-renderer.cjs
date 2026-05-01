#!/usr/bin/env node
/*
 * Phase 101-03 - Shape H (Timeline / Roadmap) renderer.
 * ASCII-art horizontal timeline. 4-zone anatomy. 12-glyph compliant.
 * Glyphs: filled-square (marker), dash (axis), right-tri-fill (primary),
 * right-tri-empty (alt). Spec: 101-RESEARCH.md Section 4.
 */

'use strict';

const path = require('path');

const FILLED_SQUARE = '■'; // filled-square
const DASH = '─';          // dash
const PRIMARY = '▶';       // right-tri-fill
const ALT = '▷';           // right-tri-empty

const DEFAULT_WIDTH = 60;
const MIN_WIDTH = 40;
const MAX_WIDTH = 80;
const CROWD_THRESHOLD = 3;

const DEFAULT_FOOTER = [
  { glyph: PRIMARY, command: '/mos:act', description: 'Run methodology' },
  { glyph: ALT, command: '/mos:add-phase', description: 'Add phase to roadmap' },
  { glyph: ALT, command: '/mos:milestone-summary', description: 'Generate milestone summary' },
];

function parseDate(d) {
  if (d instanceof Date) return isNaN(d.getTime()) ? null : d;
  const p = new Date(d);
  return isNaN(p.getTime()) ? null : p;
}

function fmtDate(d) {
  const m = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return m[d.getUTCMonth()] + ' ' + d.getUTCDate();
}

function err(line1, line2, line3) {
  return { error: 'x ' + line1 + '\nWhy: ' + line2 + '\nFix: ' + line3 };
}

function clampWidth(w) {
  if (typeof w !== 'number' || !isFinite(w)) return DEFAULT_WIDTH;
  return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.round(w)));
}

function buildHeader(jtbd, title, start, end) {
  const tag = jtbd || 'plan-execution';
  const subtitle = title || (fmtDate(start) + ' to ' + fmtDate(end));
  return '-- mindrianOS -- ' + tag + ' -- timeline (' + subtitle + ') --';
}

function buildAxis(width, start, end) {
  const a = fmtDate(start), b = fmtDate(end);
  const middle = width - a.length - b.length - 2;
  if (middle <= 0) return DASH.repeat(Math.max(width, 1));
  return a + ' ' + DASH.repeat(middle) + ' ' + b;
}

function placeMarkers(milestones, start, end, width) {
  const span = end.getTime() - start.getTime();
  const pixelsPerMs = (width - 2) / span;
  return milestones.map((m, idx) => {
    const at = parseDate(m.at);
    let col = Math.round((at.getTime() - start.getTime()) * pixelsPerMs);
    if (col < 0) col = 0;
    if (col > width - 1) col = width - 1;
    return { idx, col, label: String(m.label || ''), at };
  });
}

function markerLine(marks, width) {
  const arr = new Array(width).fill(' ');
  for (const m of marks) arr[m.col] = FILLED_SQUARE;
  return arr.join('').replace(/\s+$/, '');
}

function isCrowded(marks) {
  if (marks.length < 2) return false;
  const s = marks.slice().sort((a, b) => a.col - b.col);
  for (let i = 1; i < s.length; i++) {
    if (s[i].col - s[i - 1].col < CROWD_THRESHOLD) return true;
  }
  return false;
}

function stampLabel(arr, col, label, room) {
  let lab = label;
  if (lab.length > room) lab = lab.slice(0, Math.max(1, room - 1)) + '.';
  for (let k = 0; k < lab.length && (col + k) < arr.length; k++) {
    arr[col + k] = lab[k];
  }
}

function labelRowsUncrowded(marks, width) {
  const sorted = marks.slice().sort((a, b) => a.col - b.col);
  const arr = new Array(width).fill(' ');
  for (let i = 0; i < sorted.length; i++) {
    const m = sorted[i];
    const nextCol = (i + 1 < sorted.length) ? sorted[i + 1].col : width;
    stampLabel(arr, m.col, m.label, Math.max(1, nextCol - m.col - 1));
  }
  return [arr.join('').replace(/\s+$/, '')];
}

function labelRowsCrowded(marks, width) {
  const sorted = marks.slice().sort((a, b) => a.col - b.col);
  return sorted.map((m) => {
    const arr = new Array(width).fill(' ');
    stampLabel(arr, m.col, m.label, Math.max(1, width - m.col));
    return arr.join('').replace(/\s+$/, '');
  });
}

function buildBody(start, end, marks, width, title) {
  const lines = [];
  if (title) { lines.push(FILLED_SQUARE + ' ' + title); lines.push(''); }
  lines.push(buildAxis(width, start, end));
  lines.push(markerLine(marks, width));
  const rows = isCrowded(marks)
    ? labelRowsCrowded(marks, width)
    : labelRowsUncrowded(marks, width);
  for (const r of rows) lines.push(r);
  return lines.join('\n');
}

function buildFooter(footerVerbs) {
  const verbs = (Array.isArray(footerVerbs) && footerVerbs.length > 0)
    ? footerVerbs : DEFAULT_FOOTER;
  return verbs.map((v, i) => {
    const g = v.glyph || (i === 0 ? PRIMARY : ALT);
    const cmd = v.command || '';
    const desc = v.description ? ('  ' + v.description) : '';
    return g + ' ' + cmd + desc;
  }).join('\n');
}

/**
 * renderShapeH({ start, end, milestones, title?, width?, jtbd?, tier?,
 *                footerVerbs? }) -> { zones, contract } | { error }
 */
function renderShapeH(opts) {
  const o = opts || {};
  const start = parseDate(o.start);
  const end = parseDate(o.end);
  if (!start || !end) {
    return err('Invalid timeline dates',
      'start or end could not be parsed as ISO date',
      '/mos:plan-execution add-milestone');
  }
  if (end.getTime() <= start.getTime()) {
    return err('Timeline end is not after start',
      'Shape H needs end > start to compute scale',
      '/mos:plan-execution add-milestone');
  }
  const milestones = Array.isArray(o.milestones) ? o.milestones : [];
  if (milestones.length === 0) {
    return err('No milestones in scope',
      'Shape H needs at least one milestone',
      '/mos:plan-execution add-milestone');
  }
  for (const m of milestones) {
    if (!parseDate(m && m.at)) {
      return err('Milestone date invalid',
        'one or more milestones lack a parseable at: field',
        '/mos:plan-execution add-milestone');
    }
  }
  const width = clampWidth(o.width);
  const marks = placeMarkers(milestones, start, end, width);
  return {
    zones: {
      header: buildHeader(o.jtbd, o.title, start, end),
      body: buildBody(start, end, marks, width, o.title),
      footer: buildFooter(o.footerVerbs),
    },
    contract: {
      shape: 'H',
      width: width,
      milestoneCount: marks.length,
      crowded: isCrowded(marks),
      tier: o.tier == null ? null : o.tier,
      jtbd: o.jtbd || null,
    },
  };
}

module.exports = {
  renderShapeH: renderShapeH,
  __glyphs: { FILLED_SQUARE, DASH, PRIMARY, ALT },
  __defaults: { DEFAULT_WIDTH, MIN_WIDTH, MAX_WIDTH, CROWD_THRESHOLD },
};

void path;
