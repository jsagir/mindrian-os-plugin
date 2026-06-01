#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 130.7-01 Task 2 -- correlation-label-index.cjs
 * ====================================================
 * The NAMED producer + parser for the LOCAL correlation_labels index. This is
 * the real data source Plan 02's no-fork canonical pick reads: a map of
 *   canonical_name -> [ { primary_label, edge_degree }, ... ]
 * (one entry per (name,label) pair, so a cross-label-duplicate name carries one
 * entry per label with that label's degree -- exactly the disambiguation data
 * the pick needs to choose the most-edged canonical target).
 *
 * This module MIRRORS lib/core/framework-chain-composer.cjs
 * parseFrameworkChainSection: the recommender reads the LOCAL section body
 * synchronously from a pre-loaded roomState.brainSections.correlation_labels --
 * NEVER via a live Cypher in the recommender path (the plan forbids live Cypher
 * there). serializeLabelIndex is the inverse: it renders the deterministic,
 * line-oriented section body the backfill writes.
 *
 * Canon Part 8 (Graph Boundary):
 * ==============================
 * The correlation_labels index is a LOCAL artifact (LOCAL -> LOCAL: YES). It
 * carries only generic methodology handles (already public in the teaching
 * graph), label enums, and integer degrees. It carries ZERO user content and it
 * NEVER egresses toward the Brain. Both functions are PURE: no fs, no Brain, no
 * db, no network -- serializeLabelIndex renders a string, parseLabelIndex reads
 * a string. That purity is what keeps the recommender synchronous and
 * Brain-touch-free.
 *
 * License: BSL 1.1.
 */

// The stable section key the recommender reads via
// roomState.brainSections.correlation_labels (mirrors
// framework_chain_predictions). NEVER rename -- Plan 02 binds to this literal.
const LABEL_INDEX_SECTION_KEY = 'correlation_labels';

// The line format is deterministic and line-oriented, one (name,label,degree)
// triple per line, joined by a fixed pipe delimiter with the fields trimmed:
//   <canonical_name> | <primary_label> | <edge_degree>
// A pipe is the field delimiter; a name or label that itself contains a pipe is
// escaped on write and unescaped on read so the round-trip is lossless. Names
// are emitted in a stable (name, then label) sort order so two runs over the
// same rows produce byte-identical bodies (idempotency at the artifact level).
const FIELD_DELIM = ' | ';
const PIPE_ESCAPE = '\\|';
const PIPE_TOKEN = '|';

function escapeField(s) {
  // Escape backslash first, then pipe, so unescape is unambiguous.
  return String(s).replace(/\\/g, '\\\\').replace(/\|/g, PIPE_ESCAPE);
}

function unescapeField(s) {
  // Reverse: collapse the escaped-pipe then the escaped-backslash.
  return String(s).replace(/\\\|/g, PIPE_TOKEN).replace(/\\\\/g, '\\');
}

/**
 * serializeLabelIndex(rows) -> string
 *
 * Renders the correlation_labels section body from the backfill's read rows.
 * Each row is { canonical_name, primary_label, edge_degree }. One line per
 * (name,label) pair; a name appearing under multiple labels emits one line per
 * label, carrying that label's degree. Output is deterministically sorted by
 * (canonical_name, primary_label) so repeated runs are byte-identical.
 *
 * Tolerant of malformed rows: a row missing canonical_name or primary_label is
 * skipped (never throws); a non-finite edge_degree is normalized to 0.
 *
 * @param {Array<{canonical_name:string, primary_label:string, edge_degree:number}>} rows
 * @returns {string} line-oriented section body (no trailing newline)
 */
function serializeLabelIndex(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return '';
  const clean = [];
  for (const r of rows) {
    if (!r || typeof r !== 'object') continue;
    const name = typeof r.canonical_name === 'string' ? r.canonical_name.trim() : '';
    const label = typeof r.primary_label === 'string' ? r.primary_label.trim() : '';
    if (name.length === 0 || label.length === 0) continue;
    let deg = Number(r.edge_degree);
    if (!Number.isFinite(deg) || deg < 0) deg = 0;
    deg = Math.floor(deg);
    clean.push({ name: name, label: label, degree: deg });
  }
  if (clean.length === 0) return '';
  clean.sort(function (a, b) {
    if (a.name < b.name) return -1;
    if (a.name > b.name) return 1;
    if (a.label < b.label) return -1;
    if (a.label > b.label) return 1;
    return 0;
  });
  const lines = clean.map(function (c) {
    return escapeField(c.name) + FIELD_DELIM + escapeField(c.label) + FIELD_DELIM + String(c.degree);
  });
  return lines.join('\n');
}

/**
 * parseLabelIndex(sectionBody) -> { name -> [ {primary_label, edge_degree}, ... ] }
 *
 * The inverse of serializeLabelIndex. Reads a correlation_labels section body
 * and returns a map from canonical_name to an array of {primary_label,
 * edge_degree} entries (one per label that name appears under). A unique name
 * has a single-entry array; a cross-label-duplicate name has one entry per
 * label, so Plan 02's pick can choose the most-edged label.
 *
 * PURE and total: returns {} on null / undefined / empty / non-string input and
 * never throws on a malformed line (the line is skipped). This matches
 * parseFrameworkChainSection's tolerance contract.
 *
 * @param {string|null} sectionBody
 * @returns {Object<string, Array<{primary_label:string, edge_degree:number}>>}
 */
function parseLabelIndex(sectionBody) {
  const out = {};
  if (typeof sectionBody !== 'string' || sectionBody.length === 0) return out;
  if (/^\s*\(no\s*signal\)\s*$/i.test(sectionBody)) return out;
  const lines = sectionBody.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+$/u, '');
    if (line.length === 0) continue;
    // Split on the pipe delimiter, honoring the escape. Split on a pipe that is
    // NOT preceded by a backslash, then unescape each field.
    const parts = splitUnescaped(line);
    if (parts.length < 3) continue;
    const name = unescapeField(parts[0]).trim();
    const label = unescapeField(parts[1]).trim();
    const degRaw = parts[2].trim();
    if (name.length === 0 || label.length === 0) continue;
    let deg = Number(degRaw);
    if (!Number.isFinite(deg) || deg < 0) deg = 0;
    deg = Math.floor(deg);
    if (!Object.prototype.hasOwnProperty.call(out, name)) out[name] = [];
    out[name].push({ primary_label: label, edge_degree: deg });
  }
  return out;
}

// Split a line on unescaped pipe field-delimiters. The serializer joins with
// ' | ' (space-pipe-space); we split on a pipe not preceded by a backslash,
// then trim each side, which tolerates the surrounding spaces.
function splitUnescaped(line) {
  const fields = [];
  let buf = '';
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '\\' && i + 1 < line.length) {
      // Keep the escape sequence intact for unescapeField to resolve.
      buf += ch + line[i + 1];
      i += 1;
      continue;
    }
    if (ch === PIPE_TOKEN) {
      fields.push(buf);
      buf = '';
      continue;
    }
    buf += ch;
  }
  fields.push(buf);
  return fields.map(function (f) { return f.trim(); });
}

module.exports = {
  serializeLabelIndex: serializeLabelIndex,
  parseLabelIndex: parseLabelIndex,
  LABEL_INDEX_SECTION_KEY: LABEL_INDEX_SECTION_KEY,
};
