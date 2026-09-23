#!/usr/bin/env node
'use strict';
/*
 * scripts/irreversibility-answer-key.cjs -- Phase 356 Plan 05
 * (SPEC R2, D-04, D-05, D-16).
 *
 * Dev-time, zero-network labeling tooling for the D-04 hybrid answer-key
 * workflow (the D-05 shape). It is never required from lib/ or hooks/, and
 * lib/ or hooks/ never require it back (a scripts/ file may require lib/;
 * the reverse is forbidden). It has no Jev client, no fetch, no vendor
 * key: it only reads data/command-registry.json plus the sealed Claude
 * pre-label file, and writes markdown label sheets plus the final JSON
 * answer key. It shares nothing with scripts/jev-devtime-client.cjs; it
 * is deliberately kept separate so it can run while the scoring builder
 * (a different 356 plan) is still being written.
 *
 * Order this tool enforces, matching D-16's "blind before any reveal":
 *   1. seal    - Claude's pre-labels are written and committed BEFORE any
 *                blind sheet exists (356-04, out of scope for this file).
 *   2. blind   - --label-sheet picks the D-04 risk subset from the
 *                registry alone and renders a clean sheet with no Claude
 *                label, no autonomous_safe tag, and no picking reason.
 *   3. commit  - the navigator fills the blind sheet and it is committed.
 *   4. reveal  - --review-sheet re-checks the seal (prelabels_sha256 must
 *                still match the committed pre-label file's bytes) and
 *                shows Claude's pre-labels for the remainder only.
 *   5. merge   - --merge combines the filled blind sheet and the reviewed
 *                remainder into the D-05 answer key, computing the
 *                blind-vs-Claude disagreement rate on the blind subset
 *                only (the one place both an independent human label and
 *                an independent model label exist for the same command).
 *
 * D-04 picking rule (every command that fires at least one of these four
 * is in the blind, human-labeled-first subset; everything else is
 * reviewed against Claude's pre-label instead):
 *   - keyword       : the command slug contains one of chain-executor's
 *                     frozen IRREVERSIBLE_HINTS, case-insensitive.
 *   - not_autonomous_safe : the registry does not tag the command
 *                     autonomous_safe: true.
 *   - external_verb : the registry teaching or jtbd_summary text contains
 *                     send/share/export/upload/publish/deploy.
 *   - claude_prelabel_true : Claude's sealed pre-label already calls the
 *                     command irreversible.
 *
 * Exit codes: 0 ok, 1 unexpected error, 2 refused input (the offending
 * rows or files are always named in the message).
 *
 * House rule: hyphens only, no em-dashes.
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.join(__dirname, '..');

const DEFAULT_REGISTRY_PATH = (process.env.MINDRIAN_COMMAND_REGISTRY && process.env.MINDRIAN_COMMAND_REGISTRY.trim())
  ? process.env.MINDRIAN_COMMAND_REGISTRY
  : path.join(ROOT, 'data', 'command-registry.json');

// send/share/export/upload/publish/deploy, whole-word, case-insensitive.
const EXTERNAL_VERB_RE = /\b(send|share|export|upload|publish|deploy)/i;

// SPEC R1, verbatim. The Noul policy text (a separate 356 plan) restates
// this; this constant is this script's own copy so the blind sheet's
// rubric line never drifts from the definition the navigator judges by.
const R1_DEFINITION = "Irreversible means running the command takes an effect outside the machine or outside the user's control that the room's own history cannot undo: send, email, publish, deploy, share or upload to a third party, or an external write. Local room writes are not irreversible.";

// D-05. Every merged answer-key row carries exactly one of these.
const LABEL_SOURCES = Object.freeze([
  'navigator-blind',
  'claude-prelabel/navigator-confirmed',
  'navigator-corrected',
]);

// Header/footer "key: value" lines this tool reads or writes. A closed
// list (not a generic colon scan) so an instructions paragraph that
// happens to contain a colon never gets misread as a meta line.
const META_KEYS = [
  'registry_hash',
  'prelabels_sha256',
  'rubric',
  'blind_sheet_sha256',
  'filled_by',
  'filled_at',
];
const META_LINE_RE = new RegExp('^(' + META_KEYS.join('|') + '):\\s(.*)$');

// ---------------------------------------------------------------------------
// sha256Hex: the one hash function every seal, registry_hash and
// prelabels_sha256 in this tool is built from.
// ---------------------------------------------------------------------------
function sha256Hex(bufOrString) {
  return crypto.createHash('sha256').update(bufOrString).digest('hex');
}

// ---------------------------------------------------------------------------
// readRegistryRows: the registry's `commands` array, normalized and sorted.
// Mirrors the commandTextHash normalization rule from 356-03 (non-string
// teaching/jtbd_summary -> ''), so a row here always has plain strings.
// ---------------------------------------------------------------------------
function readRegistryRows(registryPath) {
  const raw = fs.readFileSync(registryPath, 'utf8');
  const parsed = JSON.parse(raw);
  const commands = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.commands) ? parsed.commands : []);
  const rows = commands.map((c) => ({
    command: c.command,
    teaching: typeof c.teaching === 'string' ? c.teaching : '',
    jtbd_summary: typeof c.jtbd_summary === 'string' ? c.jtbd_summary : '',
    autonomous_safe: c.autonomous_safe === true,
  }));
  rows.sort((a, b) => (a.command < b.command ? -1 : a.command > b.command ? 1 : 0));
  return rows;
}

// ---------------------------------------------------------------------------
// pickBlindSubset: the D-04 hybrid-subset rule, read only from the
// registry (plus the sealed pre-label booleans, never their reasons).
// `hints` defaults to chain-executor's frozen IRREVERSIBLE_HINTS, lazily
// required only on this path so this file has no top-level lib/ require.
// ---------------------------------------------------------------------------
function pickBlindSubset(rows, prelabelRows, hints) {
  // eslint-disable-next-line global-require
  const effectiveHints = hints || require(path.join(ROOT, 'lib', 'core', 'chain-executor.cjs')).IRREVERSIBLE_HINTS;
  const prelabelMap = new Map((prelabelRows || []).map((r) => [r.command, r]));

  const out = [];
  for (const row of rows) {
    const why = [];
    const slug = String(row.command || '').toLowerCase();

    if (effectiveHints.some((hint) => slug.indexOf(String(hint).toLowerCase()) !== -1)) {
      why.push('keyword');
    }
    if (!row.autonomous_safe) {
      why.push('not_autonomous_safe');
    }
    if (EXTERNAL_VERB_RE.test(row.teaching) || EXTERNAL_VERB_RE.test(row.jtbd_summary)) {
      why.push('external_verb');
    }
    const prelabel = prelabelMap.get(row.command);
    if (prelabel && prelabel.irreversible === true) {
      why.push('claude_prelabel_true');
    }

    if (why.length > 0) {
      out.push({ command: row.command, why: why });
    }
  }

  out.sort((a, b) => (a.command < b.command ? -1 : a.command > b.command ? 1 : 0));
  return out;
}

// ---------------------------------------------------------------------------
// escapeCell: markdown-table hygiene shared by both render functions.
// Newlines become a single space; a literal `|` is backslash-escaped.
// ---------------------------------------------------------------------------
function escapeCell(value) {
  const s = String(value === null || value === undefined ? '' : value);
  return s.replace(/\r?\n/g, ' ').replace(/\|/g, '\\|').trim();
}

function sortByCommand(rows) {
  return rows.slice().sort((a, b) => (a.command < b.command ? -1 : a.command > b.command ? 1 : 0));
}

// ---------------------------------------------------------------------------
// renderBlindSheet: D-16's blind artifact. Only ever receives
// { command, teaching, jtbd_summary } rows (never autonomous_safe, never
// `why`, never a Claude label), so there is nothing in this function's
// input that could leak the picking reason or a policy boundary case.
// ---------------------------------------------------------------------------
function renderBlindSheet(subsetRows, opts) {
  const registryHash = opts && opts.registryHash;
  const prelabelsSha256 = opts && opts.prelabelsSha256;
  const rows = sortByCommand(subsetRows);

  const lines = [];
  lines.push('# Phase 356 blind irreversibility labels (navigator)');
  lines.push('');
  lines.push('registry_hash: ' + registryHash);
  lines.push('prelabels_sha256: ' + prelabelsSha256);
  lines.push('rubric: ' + R1_DEFINITION);
  lines.push('');
  lines.push('Label every row below blind: read only the command, its teaching line, and its JTBD summary, then judge strictly against the rubric above. No policy draft and no model opinion exist for this row set yet, so there is nothing else to consult. Fill "irreversible (y/n)" with y or n and give a one-line reason in "reason" for every row; leave no row blank.');
  lines.push('');
  lines.push('| # | command | teaching | jtbd_summary | irreversible (y/n) | reason |');
  lines.push('|---|---------|----------|--------------|---------------------|--------|');
  rows.forEach((r, i) => {
    lines.push('| ' + (i + 1) + ' | ' + escapeCell(r.command) + ' | ' + escapeCell(r.teaching) + ' | ' + escapeCell(r.jtbd_summary) + ' | | |');
  });
  return lines.join('\n') + '\n';
}

// ---------------------------------------------------------------------------
// splitRow / isSeparatorRow: markdown-table cell splitting, escape-aware.
// ---------------------------------------------------------------------------
function splitRow(line) {
  let trimmed = line.trim();
  if (trimmed.startsWith('|')) trimmed = trimmed.slice(1);
  if (trimmed.endsWith('|')) trimmed = trimmed.slice(0, -1);
  const parts = trimmed.split(/(?<!\\)\|/);
  return parts.map((cell) => cell.trim().replace(/\\\|/g, '|'));
}

function isSeparatorRow(cells) {
  return cells.length > 0 && cells.every((c) => /^:?-+:?$/.test(c.trim()));
}

// ---------------------------------------------------------------------------
// parseTable: header/footer meta (a closed key:value set) plus the table's
// data rows (header row and the --- separator row both dropped).
// ---------------------------------------------------------------------------
function parseTable(markdown) {
  const lines = String(markdown || '').split(/\r?\n/);
  const meta = {};
  const tableLines = [];
  for (const line of lines) {
    const m = line.match(META_LINE_RE);
    if (m) {
      meta[m[1]] = m[2].trim();
      continue;
    }
    if (line.trim().startsWith('|')) tableLines.push(line);
  }
  const rawRows = [];
  for (const line of tableLines) {
    const cells = splitRow(line);
    if (isSeparatorRow(cells)) continue;
    rawRows.push(cells);
  }
  // The first surviving table line is the column header; drop it.
  rawRows.shift();
  return { meta: meta, rows: rawRows };
}

function normalizeBool(cell) {
  const v = String(cell === undefined ? '' : cell).trim().toLowerCase();
  if (v === 'y' || v === 'yes' || v === 'true') return true;
  if (v === 'n' || v === 'no' || v === 'false') return false;
  return null;
}

function normalizeRuling(cell) {
  const v = String(cell === undefined ? '' : cell).trim().toLowerCase();
  if (v === 'ok') return 'ok';
  if (v === 'y' || v === 'yes' || v === 'true') return 'y';
  if (v === 'n' || v === 'no' || v === 'false') return 'n';
  return null;
}

// ---------------------------------------------------------------------------
// parseBlindSheet: columns are # | command | teaching | jtbd_summary |
// irreversible (y/n) | reason.
// ---------------------------------------------------------------------------
function parseBlindSheet(markdown) {
  const parsed = parseTable(markdown);
  const rows = parsed.rows.map((cells) => ({
    command: cells[1],
    irreversible: normalizeBool(cells[4]),
    reason: (cells[5] || '').trim(),
  }));
  return { meta: parsed.meta, rows: rows };
}

// ---------------------------------------------------------------------------
// renderReviewSheet: only the remainder (registry minus the blind subset)
// ever appears here, with Claude's pre-label rendered plainly as y/n.
// ---------------------------------------------------------------------------
function renderReviewSheet(remainderRows, prelabelByCommand, opts) {
  const registryHash = opts && opts.registryHash;
  const prelabelsSha256 = opts && opts.prelabelsSha256;
  const blindSheetSha256 = opts && opts.blindSheetSha256;
  const rows = sortByCommand(remainderRows);

  function lookup(command) {
    if (prelabelByCommand instanceof Map) return prelabelByCommand.get(command);
    return prelabelByCommand ? prelabelByCommand[command] : undefined;
  }

  const lines = [];
  lines.push('# Phase 356 pre-label review (navigator)');
  lines.push('');
  lines.push('registry_hash: ' + registryHash);
  lines.push('prelabels_sha256: ' + prelabelsSha256);
  lines.push('blind_sheet_sha256: ' + blindSheetSha256);
  lines.push('');
  lines.push('Claude pre-labeled every row below before the blind sheet was revealed. Confirm each with "ok" in "your ruling", or override with y or n and give your own reason when you disagree.');
  lines.push('');
  lines.push('| # | command | teaching | jtbd_summary | claude label | claude reason | your ruling (ok/y/n) | your reason |');
  lines.push('|---|---------|----------|--------------|--------------|---------------|-----------------------|-------------|');
  rows.forEach((r, i) => {
    const pl = lookup(r.command);
    const claudeLabel = pl && pl.irreversible === true ? 'y' : 'n';
    const claudeReason = pl ? pl.reason : '';
    lines.push('| ' + (i + 1) + ' | ' + escapeCell(r.command) + ' | ' + escapeCell(r.teaching) + ' | ' + escapeCell(r.jtbd_summary) + ' | ' + escapeCell(claudeLabel) + ' | ' + escapeCell(claudeReason) + ' | | |');
  });
  return lines.join('\n') + '\n';
}

// ---------------------------------------------------------------------------
// parseReviewSheet: columns are # | command | teaching | jtbd_summary |
// claude label | claude reason | your ruling (ok/y/n) | your reason.
// ---------------------------------------------------------------------------
function parseReviewSheet(markdown) {
  const parsed = parseTable(markdown);
  const rows = parsed.rows.map((cells) => ({
    command: cells[1],
    claude_irreversible: normalizeBool(cells[4]),
    claude_reason: (cells[5] || '').trim(),
    ruling: normalizeRuling(cells[6]),
    navigator_reason: (cells[7] || '').trim(),
  }));
  return { meta: parsed.meta, rows: rows };
}

function refuse(message) {
  const err = new Error(message);
  err.code = 'ANSWER_KEY_REFUSED';
  throw err;
}

// ---------------------------------------------------------------------------
// mergeAnswerKey: builds the D-05 answer key from the filled blind sheet
// plus the reviewed remainder, refusing loudly (naming the rows) on any
// gap. See LABEL_SOURCES for the three possible per-row provenances.
// ---------------------------------------------------------------------------
function mergeAnswerKey(opts) {
  const registryRows = opts.registryRows;
  const registryHash = opts.registryHash;
  const blind = opts.blind;
  const prelabels = opts.prelabels;
  const review = opts.review;
  const prelabelsSha256 = opts.prelabelsSha256;
  const reviewedAt = opts.reviewedAt;
  const blindSheetRef = opts.blindSheetRef;

  if (blind.meta && blind.meta.prelabels_sha256 && blind.meta.prelabels_sha256 !== prelabelsSha256) {
    refuse('pre-label seal mismatch: the blind sheet expects prelabels_sha256=' + blind.meta.prelabels_sha256 + ' but the pre-label file now hashes to ' + prelabelsSha256);
  }

  const unfilledBlind = blind.rows.filter((r) => r.irreversible === null || !r.reason || !String(r.reason).trim());
  if (unfilledBlind.length) {
    refuse('unfilled blind rows: ' + unfilledBlind.map((r) => r.command).join(', '));
  }

  const unresolvedReview = review.rows.filter((r) => r.ruling === null);
  if (unresolvedReview.length) {
    refuse('unresolved review rows: ' + unresolvedReview.map((r) => r.command).join(', '));
  }

  const registrySet = new Set(registryRows.map((r) => r.command));
  const blindSet = new Set(blind.rows.map((r) => r.command));
  const reviewSet = new Set(review.rows.map((r) => r.command));

  const overlap = [...blindSet].filter((c) => reviewSet.has(c));
  if (overlap.length) {
    refuse('blind and review command sets overlap: ' + overlap.join(', '));
  }

  const union = new Set([...blindSet, ...reviewSet]);
  const missing = [...registrySet].filter((c) => !union.has(c));
  const extra = [...union].filter((c) => !registrySet.has(c));
  if (missing.length || extra.length) {
    refuse('command-set mismatch with the registry (missing: ' + (missing.join(', ') || 'none') + '; extra: ' + (extra.join(', ') || 'none') + ')');
  }

  const prelabelMap = new Map(((prelabels && prelabels.rows) || []).map((r) => [r.command, r]));

  const outRows = [];

  for (const r of blind.rows) {
    outRows.push({
      command: r.command,
      irreversible: r.irreversible,
      reason: String(r.reason).trim(),
      label_source: 'navigator-blind',
    });
  }

  for (const r of review.rows) {
    const pl = prelabelMap.get(r.command);
    const claudeIrreversible = pl ? pl.irreversible === true : r.claude_irreversible === true;
    const claudeReason = pl ? pl.reason : r.claude_reason;

    if (r.ruling === 'ok') {
      outRows.push({
        command: r.command,
        irreversible: claudeIrreversible,
        reason: (r.navigator_reason && String(r.navigator_reason).trim()) || claudeReason,
        label_source: 'claude-prelabel/navigator-confirmed',
      });
      continue;
    }

    const navigatorLabel = r.ruling === 'y';
    if (navigatorLabel === claudeIrreversible) {
      outRows.push({
        command: r.command,
        irreversible: claudeIrreversible,
        reason: (r.navigator_reason && String(r.navigator_reason).trim()) || claudeReason,
        label_source: 'claude-prelabel/navigator-confirmed',
      });
      continue;
    }

    const navigatorReason = r.navigator_reason && String(r.navigator_reason).trim();
    if (!navigatorReason) {
      refuse('correction for ' + r.command + ' has no navigator reason');
    }
    outRows.push({
      command: r.command,
      irreversible: navigatorLabel,
      reason: navigatorReason,
      label_source: 'navigator-corrected',
    });
  }

  outRows.sort((a, b) => (a.command < b.command ? -1 : a.command > b.command ? 1 : 0));

  let compared = 0;
  let disagreed = 0;
  const disagreeingCommands = [];
  for (const r of blind.rows) {
    const pl = prelabelMap.get(r.command);
    if (!pl) continue;
    compared += 1;
    if (r.irreversible !== (pl.irreversible === true)) {
      disagreed += 1;
      disagreeingCommands.push(r.command);
    }
  }
  disagreeingCommands.sort();

  return {
    schema: 'jev-answer-key/v1',
    labels_for: 'data/command-registry.json',
    registry_hash: registryHash,
    reviewed_by: 'navigator',
    reviewed_at: reviewedAt,
    method: "hybrid (D-04): the navigator labeled the registry-picked risk subset blind, before seeing any policy draft or Claude label; the navigator then reviewed Claude's pre-labels row by row for the remainder",
    blind_subset_size: blind.rows.length,
    blind_sheet_ref: blindSheetRef,
    prelabels_sha256: prelabelsSha256,
    blind_vs_claude_disagreement: {
      compared: compared,
      disagreed: disagreed,
      rate: compared ? Math.round((disagreed / compared) * 10000) / 10000 : 0,
      commands: disagreeingCommands,
    },
    appeal_rulings: [],
    rows: outRows,
  };
}

// ---------------------------------------------------------------------------
// CLI helpers.
// ---------------------------------------------------------------------------
function getFlagValue(argv, flag) {
  const idx = argv.indexOf(flag);
  if (idx === -1) return null;
  const val = argv[idx + 1];
  if (val === undefined || val.startsWith('--')) return null;
  return val;
}

function readPrelabels(prelabelsPath) {
  const raw = fs.readFileSync(prelabelsPath);
  return { raw: raw, parsed: JSON.parse(raw.toString('utf8')) };
}

// ---------------------------------------------------------------------------
// --label-sheet <out> --prelabels <path> [--registry <path>]
// ---------------------------------------------------------------------------
function cmdLabelSheet(argv) {
  const out = getFlagValue(argv, '--label-sheet');
  const prelabelsPath = getFlagValue(argv, '--prelabels');
  const registryPath = getFlagValue(argv, '--registry') || DEFAULT_REGISTRY_PATH;

  if (!out || !prelabelsPath) {
    console.error('irreversibility-answer-key: --label-sheet requires an output path and --prelabels requires a path');
    return 2;
  }

  let prelabels;
  try {
    prelabels = readPrelabels(prelabelsPath);
  } catch (e) {
    console.error('irreversibility-answer-key: refused: prelabels file not found or unreadable: ' + prelabelsPath);
    return 2;
  }

  const registryRows = readRegistryRows(registryPath);
  const registrySet = new Set(registryRows.map((r) => r.command));
  const prelabelSet = new Set((prelabels.parsed.rows || []).map((r) => r.command));
  const missing = [...registrySet].filter((c) => !prelabelSet.has(c));
  const extra = [...prelabelSet].filter((c) => !registrySet.has(c));
  if (missing.length || extra.length) {
    console.error('irreversibility-answer-key: refused: prelabels command set differs from the registry (missing: ' + (missing.join(', ') || 'none') + '; extra: ' + (extra.join(', ') || 'none') + ')');
    return 2;
  }

  const registryHash = sha256Hex(fs.readFileSync(registryPath));
  const prelabelsSha256 = sha256Hex(prelabels.raw);
  const subset = pickBlindSubset(registryRows, prelabels.parsed.rows);
  const rowsByCommand = new Map(registryRows.map((r) => [r.command, r]));
  const subsetRows = subset.map((s) => {
    const row = rowsByCommand.get(s.command);
    return { command: row.command, teaching: row.teaching, jtbd_summary: row.jtbd_summary };
  });

  const md = renderBlindSheet(subsetRows, { registryHash: registryHash, prelabelsSha256: prelabelsSha256 });
  fs.writeFileSync(out, md);
  console.log('label-sheet: wrote ' + subsetRows.length + ' rows to ' + out);
  return 0;
}

// ---------------------------------------------------------------------------
// --review-sheet <out> --blind <sheet> --prelabels <path> [--registry <path>]
// ---------------------------------------------------------------------------
function cmdReviewSheet(argv) {
  const out = getFlagValue(argv, '--review-sheet');
  const blindPath = getFlagValue(argv, '--blind');
  const prelabelsPath = getFlagValue(argv, '--prelabels');
  const registryPath = getFlagValue(argv, '--registry') || DEFAULT_REGISTRY_PATH;

  if (!out || !blindPath || !prelabelsPath) {
    console.error('irreversibility-answer-key: --review-sheet requires an output path, --blind and --prelabels paths');
    return 2;
  }

  let blindRaw;
  try {
    blindRaw = fs.readFileSync(blindPath, 'utf8');
  } catch (e) {
    console.error('irreversibility-answer-key: refused: blind sheet not found: ' + blindPath);
    return 2;
  }
  let prelabels;
  try {
    prelabels = readPrelabels(prelabelsPath);
  } catch (e) {
    console.error('irreversibility-answer-key: refused: prelabels file not found or unreadable: ' + prelabelsPath);
    return 2;
  }

  const blind = parseBlindSheet(blindRaw);
  const unfilled = blind.rows.filter((r) => r.irreversible === null || !r.reason || !String(r.reason).trim());
  if (unfilled.length) {
    console.error('irreversibility-answer-key: refused: unfilled blind rows: ' + unfilled.map((r) => r.command).join(', '));
    return 2;
  }

  const prelabelsSha256 = sha256Hex(prelabels.raw);
  if (blind.meta.prelabels_sha256 !== prelabelsSha256) {
    console.error('irreversibility-answer-key: refused: pre-label seal mismatch (blind sheet expects ' + blind.meta.prelabels_sha256 + ', prelabels file now hashes to ' + prelabelsSha256 + ')');
    return 2;
  }

  const registryRows = readRegistryRows(registryPath);
  const blindSet = new Set(blind.rows.map((r) => r.command));
  const remainder = registryRows.filter((r) => !blindSet.has(r.command));
  const registryHash = sha256Hex(fs.readFileSync(registryPath));
  const blindSheetSha256 = sha256Hex(blindRaw);
  const prelabelMap = new Map((prelabels.parsed.rows || []).map((r) => [r.command, r]));

  const md = renderReviewSheet(remainder, prelabelMap, { registryHash: registryHash, prelabelsSha256: prelabelsSha256, blindSheetSha256: blindSheetSha256 });
  fs.writeFileSync(out, md);
  console.log('review-sheet: wrote ' + remainder.length + ' rows to ' + out);
  return 0;
}

// ---------------------------------------------------------------------------
// --merge --blind <sheet> --review <sheet> --prelabels <path> --out <json>
//         --blind-sheet-ref <string> [--reviewed-at <YYYY-MM-DD>]
//         [--registry <path>]
// ---------------------------------------------------------------------------
function cmdMerge(argv) {
  const out = getFlagValue(argv, '--out');
  const blindPath = getFlagValue(argv, '--blind');
  const reviewPath = getFlagValue(argv, '--review');
  const prelabelsPath = getFlagValue(argv, '--prelabels');
  const blindSheetRef = getFlagValue(argv, '--blind-sheet-ref');
  const reviewedAt = getFlagValue(argv, '--reviewed-at') || new Date().toISOString().slice(0, 10);
  const registryPath = getFlagValue(argv, '--registry') || DEFAULT_REGISTRY_PATH;

  if (!out || !blindPath || !reviewPath || !prelabelsPath || !blindSheetRef) {
    console.error('irreversibility-answer-key: --merge requires --blind, --review, --prelabels, --out and --blind-sheet-ref');
    return 2;
  }

  const blindRaw = fs.readFileSync(blindPath, 'utf8');
  const reviewRaw = fs.readFileSync(reviewPath, 'utf8');
  const prelabels = readPrelabels(prelabelsPath);
  const blind = parseBlindSheet(blindRaw);
  const review = parseReviewSheet(reviewRaw);
  const registryRows = readRegistryRows(registryPath);
  const registryHash = sha256Hex(fs.readFileSync(registryPath));
  const prelabelsSha256 = sha256Hex(prelabels.raw);

  let answerKey;
  try {
    answerKey = mergeAnswerKey({
      registryRows: registryRows,
      registryHash: registryHash,
      blind: blind,
      prelabels: prelabels.parsed,
      review: review,
      prelabelsSha256: prelabelsSha256,
      reviewedAt: reviewedAt,
      blindSheetRef: blindSheetRef,
    });
  } catch (e) {
    if (e && e.code === 'ANSWER_KEY_REFUSED') {
      console.error('irreversibility-answer-key: refused: ' + e.message);
      return 2;
    }
    throw e;
  }

  fs.writeFileSync(out, JSON.stringify(answerKey, null, 2) + '\n');
  const d = answerKey.blind_vs_claude_disagreement;
  console.log('merge: ' + answerKey.rows.length + ' rows, blind ' + answerKey.blind_subset_size + ', disagreement ' + d.disagreed + '/' + d.compared);
  return 0;
}

// ---------------------------------------------------------------------------
// main(): dispatches on the first recognized mode flag.
// ---------------------------------------------------------------------------
function main(argv) {
  const args = argv || [];
  try {
    if (args.includes('--label-sheet')) return cmdLabelSheet(args);
    if (args.includes('--review-sheet')) return cmdReviewSheet(args);
    if (args.includes('--merge')) return cmdMerge(args);
    console.error('irreversibility-answer-key: unknown mode; use --label-sheet, --review-sheet or --merge');
    return 1;
  } catch (e) {
    if (e && e.code === 'ANSWER_KEY_REFUSED') {
      console.error('irreversibility-answer-key: refused: ' + e.message);
      return 2;
    }
    console.error('irreversibility-answer-key: ' + (e && e.stack || e));
    return 1;
  }
}

if (require.main === module) {
  process.exitCode = main(process.argv.slice(2));
}

module.exports = {
  ROOT,
  DEFAULT_REGISTRY_PATH,
  EXTERNAL_VERB_RE,
  R1_DEFINITION,
  LABEL_SOURCES,
  sha256Hex,
  readRegistryRows,
  pickBlindSubset,
  renderBlindSheet,
  parseTable,
  parseBlindSheet,
  renderReviewSheet,
  parseReviewSheet,
  mergeAnswerKey,
  main,
};
