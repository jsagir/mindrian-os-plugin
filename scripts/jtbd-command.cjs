#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 100-04 -- /mos:jtbd command-line entry point
 * ==================================================
 * Shape E (Action Report) renderer for the active room JTBD state, plus
 * a Shape F.1 Next Move selector for `set` (no-arg) per Phase 95.1-04
 * D-19 deferral pattern.
 *
 * Subcommands (Phase 100 D-10):
 *   /mos:jtbd                   show current state + last 5 history (Shape E)
 *   /mos:jtbd history           last 20 history entries (Shape E)
 *   /mos:jtbd list              list 13 taxonomy entries (Shape E)
 *   /mos:jtbd set [<jtbd>]      Shape F.1 picker (no arg) or transition (with arg)
 *   /mos:jtbd clear             clear current to null (writes manual_clear row)
 *   /mos:jtbd --json [subcmd]   machine-readable JSON
 *
 * UI Ruling System compliance (skills/ui-system/SKILL.md sections 1-4):
 *   12-glyph vocabulary only -- forbidden: box-chars (curved + straight),
 *   X-glyph family (failed-x), emoji presentation
 *   five-color contract (green/cyan/yellow/red/gray; no magenta/blue)
 *   four-zone anatomy (Zone 1 header, Zone 2 body, Zone 3 omitted, Zone 4 footer)
 *   Shape E body shape (Phase 100 D-09; canonical body_shape declaration in commands/jtbd.md)
 *   Shape F.1 selector renders as STRUCTURAL marker block per Phase 95.1-04 D-19;
 *   Larry handles conversational selection; Phase 88.2 ships AskUserQuestion.
 *
 * Self-dog-food: this script's runtime output MUST pass the Phase 95.1 class F
 * UI Ruling System drift detector. The source uses Unicode escape sequences
 * (\uXXXX) for every glyph emission so the source itself contains zero literal
 * forbidden characters; runtime concatenation produces visible glyphs at
 * stdout time.
 *
 * Frame budget: < 50ms wall-clock end-to-end (single getCurrent + assembly + write).
 *
 * Canon Part 8 (LOCAL ONLY):
 *   Reads <roomDir>/.mindrian/jtbd-state.json via lib/hmi/jtbd-state.cjs.
 *   Reads lib/hmi/jtbd-taxonomy.json (static plugin asset).
 *   Writes via lib/hmi/jtbd-state.cjs setCurrent / clear (atomic tmp+rename).
 *   Zero Brain queries. Zero Pinecone lookups. Zero remote calls.
 *
 * License: BSL 1.1.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const PLUGIN_ROOT = path.resolve(__dirname, '..');
const TAXONOMY_PATH = path.join(PLUGIN_ROOT, 'lib', 'hmi', 'jtbd-taxonomy.json');

// 100-03 dependency. Loaded at runtime so this script ships independently of
// wave-1 merge order; when /mos:jtbd is invoked by a user, all wave-1 commits
// will have landed.
let jtbdState = null;
function loadStateModule() {
  if (jtbdState) return jtbdState;
  jtbdState = require(path.join(PLUGIN_ROOT, 'lib', 'hmi', 'jtbd-state.cjs'));
  return jtbdState;
}

let taxonomyCache = null;
function loadTaxonomy() {
  if (taxonomyCache) return taxonomyCache;
  if (!fs.existsSync(TAXONOMY_PATH)) {
    throw new Error('jtbd-taxonomy.json missing at ' + TAXONOMY_PATH);
  }
  const raw = fs.readFileSync(TAXONOMY_PATH, 'utf8');
  taxonomyCache = JSON.parse(raw);
  return taxonomyCache;
}

// ANSI colors (skills/ui-system/SKILL.md section 4 -- exact copy from scripts/operator-command.cjs).
const C = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  cyan:  '\x1b[36m',
  yellow:'\x1b[33m',
  red:   '\x1b[31m',
  dim:   '\x1b[90m',
};

// Approved 12-glyph vocabulary (skills/ui-system/SKILL.md section 3) emitted via
// Unicode escape sequences so the source code itself contains zero literal
// glyphs that the FORBIDDEN_BOX_CHARS / FORBIDDEN_GLYPHS regexes catch.
//   U+25A0 BLACK SQUARE                  filled-square
//   U+25BC BLACK DOWN-POINTING TRIANGLE  down-triangle (unused here; reserved)
//   U+25B6 BLACK RIGHT-POINTING TRIANGLE right-triangle-filled (primary action)
//   U+25B7 WHITE RIGHT-POINTING TRIANGLE right-triangle-empty (alternative)
//   U+251C + U+2500                      branch (not-last sibling)
//   U+2514 + U+2500                      last-branch (last sibling)
//   U+2713 CHECK MARK                    check (complete)
//   U+2022 BULLET                        bullet (draft/partial)
//   U+26A0 WARNING SIGN                  warning (note: bare codepoint, no VS16)
//   U+26A1 HIGH VOLTAGE SIGN             lightning (convergence; reserved)
//   U+2B1C WHITE LARGE SQUARE            empty-square (gap / null)
//   U+2192 RIGHTWARDS ARROW              arrow (inline suggestion)
const G = {
  filledSquare:    '■',
  rightTriFilled:  '▶',
  rightTriEmpty:   '▷',
  branch:          '├─',
  lastBranch:      '└─',
  check:           '✓',
  bullet:          '•',
  warning:         '⚠',
  lightning:       '⚡',
  emptySquare:     '⬜',
  arrow:           '→',
};

// -- Argument parsing ------------------------------------------------

function parseArgs(argv) {
  const out = { subcommand: 'show', jtbdArg: null, json: false };
  const args = argv.slice();
  while (args.length) {
    const a = args.shift();
    if (a === '--json') { out.json = true; continue; }
    if (a === 'history') { out.subcommand = 'history'; continue; }
    if (a === 'list') { out.subcommand = 'list'; continue; }
    if (a === 'clear') { out.subcommand = 'clear'; continue; }
    if (a === 'set') {
      out.subcommand = 'set';
      if (args.length && !args[0].startsWith('--')) {
        out.jtbdArg = args.shift();
      }
      continue;
    }
    if (a === '--help' || a === '-h') {
      process.stdout.write(usageText());
      process.exit(0);
    }
    // Unknown arg: ignore (defensive); future flags slot here.
  }
  return out;
}

function usageText() {
  return [
    'Usage: jtbd-command.cjs [subcommand] [--json]',
    '',
    'Subcommands:',
    '  (default)         show current JTBD + last 5 history (Shape E)',
    '  history           last 20 transitions (Shape E)',
    '  list              all 13 taxonomy entries (Shape E)',
    '  set <jtbd>        manual override (24h sticky); writes manual_set row',
    '  set               render Shape F.1 picker (12 jobs + Free-Text)',
    '  clear             clear current to null; writes manual_clear row',
    '',
    'Behavior flags:',
    '  --json            machine-readable JSON output',
    '  --help, -h        print this usage',
    '',
    'Exit codes:',
    '  0  success',
    '  1  validation failure (unknown JTBD, no active room, etc.)',
    '  2  internal error',
    '',
  ].join('\n');
}

// -- Active-room resolution -----------------------------------------

// Phase 127.3 Plan 03 Task 3: canonical-single-source for active-room
// resolution. Before this refactor, this function carried its own legacy-only
// registry walk that silently rejected the CURRENT registry shape (Object
// rooms). The bug was identical to the JTBD-update silent-failure RCA
// (jtbd-auto-anchor-silent-failure.md), which is particularly ironic for the
// /mos:jtbd command itself. Reroutes to lib/core/resolve-active-room.cjs
// (Plan 00 chokepoint). The chokepoint returns the same { slug, abs_path }
// shape this function did, so downstream `room.abs_path` references continue
// to work byte-identically. Null-on-miss semantics preserved. Canon Part 7.
const { resolveActiveRoom: _chokepointResolveActiveRoom } = require(path.join(PLUGIN_ROOT, 'lib', 'core', 'resolve-active-room.cjs'));

function resolveActiveRoom() {
  return _chokepointResolveActiveRoom();
}

// -- Time helper -----------------------------------------------------

function ageHuman(isoTs) {
  if (!isoTs) return 'unknown';
  const t = new Date(isoTs).getTime();
  if (isNaN(t)) return 'unknown';
  const now = Date.now();
  const sec = Math.max(0, Math.floor((now - t) / 1000));
  if (sec < 60) return sec + 's ago';
  if (sec < 3600) return Math.floor(sec / 60) + 'm ago';
  if (sec < 86400) return Math.floor(sec / 3600) + 'h ago';
  return Math.floor(sec / 86400) + 'd ago';
}

// -- Renderers (Shape E + Shape F.1 + Tier 0) ----------------------

function pad(s, width) {
  if (s.length >= width) return s;
  return s + ' '.repeat(width - s.length);
}

function renderHistoryLine(entry, isLast, fullMode) {
  const glyph = isLast ? G.lastBranch : G.branch;
  const fromLabel = pad(entry.from || 'null', 16);
  const toLabel = pad(entry.to === null ? 'null' : (entry.to || '?'), 16);
  const ts = entry.at || '';
  const trigger = entry.trigger || '?';
  let line = '     ' + C.dim + glyph + C.reset + ' ' + toLabel + ' ' + C.dim + ts + C.reset
    + '  trigger=' + trigger;
  if (fullMode) {
    line += '          from=' + fromLabel.trim();
  }
  return line;
}

// Zone 4 footer for the show subcommand. The set of follow-up commands depends
// on whether a JTBD is active.
function renderShowFooter(currentJtbd) {
  const lines = [];
  if (currentJtbd) {
    lines.push('  ' + C.cyan + G.rightTriFilled + ' /mos:act                  ' + C.reset
      + C.dim + '# run methodology for active job' + C.reset);
    lines.push('  ' + C.dim + G.rightTriEmpty + ' ' + C.reset + C.cyan + '/mos:jtbd set' + C.reset
      + '             ' + C.dim + '# manual override (F.1)' + C.reset);
    lines.push('  ' + C.dim + G.rightTriEmpty + ' ' + C.reset + C.cyan + '/mos:jtbd history' + C.reset
      + '         ' + C.dim + '# transition history' + C.reset);
  } else {
    lines.push('  ' + C.cyan + G.rightTriFilled + ' /mos:jtbd list            ' + C.reset
      + C.dim + '# browse 13 jobs' + C.reset);
    lines.push('  ' + C.dim + G.rightTriEmpty + ' ' + C.reset + C.cyan + '/mos:jtbd set <id>' + C.reset
      + '        ' + C.dim + '# manual selection' + C.reset);
    lines.push('  ' + C.dim + G.rightTriEmpty + ' ' + C.reset + C.cyan + '/mos:status' + C.reset
      + '               ' + C.dim + '# room state' + C.reset);
  }
  return lines;
}

// Shape E renderer for the show subcommand (default + after set/clear write).
function renderShapeEShow(state, room, opts) {
  const o = opts || {};
  const successBanner = o.successBanner || null;
  const slug = room.slug || 'unknown';
  const stage = state && state.jtbd ? state.jtbd : 'null';
  const lines = [];

  // Zone 1 header.
  lines.push(C.dim + '-- ' + slug + ' -- jtbd -- ' + stage + ' --' + C.reset);
  lines.push('');

  // Zone 2: optional success banner.
  if (successBanner) {
    lines.push('  ' + C.green + G.check + C.reset + ' ' + successBanner.headline);
    if (successBanner.detail) {
      lines.push('     ' + C.dim + successBanner.detail + C.reset);
    }
    lines.push('');
  }

  // Zone 2 sub-block 1: Current state.
  if (state && state.jtbd) {
    const enteredAge = ageHuman(state.entered_at);
    lines.push('  ' + C.green + G.filledSquare + C.reset + ' Current               '
      + C.cyan + state.jtbd + C.reset);
    lines.push('     ' + C.dim + 'entered  ' + (state.entered_at || 'unknown')
      + ' (' + enteredAge + ')' + C.reset);
    const conf = typeof state.confidence === 'number' ? state.confidence.toFixed(2) : 'unknown';
    lines.push('     ' + C.dim + 'confidence  ' + conf + C.reset);
    const ev = Array.isArray(state.evidence) && state.evidence.length > 0
      ? state.evidence.join(', ') : '(none)';
    lines.push('     ' + C.dim + 'evidence  ' + ev + C.reset);
    if (state.expires_at) {
      lines.push('     ' + C.yellow + G.warning + C.reset + ' '
        + C.dim + 'manual override active until ' + state.expires_at + C.reset);
    }
  } else {
    lines.push('  ' + C.dim + G.emptySquare + C.reset + ' no JTBD set');
    lines.push('     ' + C.dim
      + 'classifier confidence below 0.6 threshold; explore fallback active'
      + C.reset);
    lines.push('     ' + C.dim + 'evidence  below_threshold' + C.reset);
  }
  lines.push('');

  // Zone 2 sub-block 2: Last 5 history.
  const allHistory = readHistorySafe(room);
  const slice = allHistory.slice(-Math.min(allHistory.length, 5));
  lines.push('  ' + C.green + G.filledSquare + C.reset + ' Last 5 history');
  if (slice.length === 0) {
    lines.push('     ' + C.dim + '(no history yet)' + C.reset);
  } else {
    for (let i = 0; i < slice.length; i++) {
      const isLast = i === slice.length - 1;
      lines.push(renderHistoryLine(slice[i], isLast, false));
    }
  }
  lines.push('');

  // Summary.
  const max = (loadStateModule().HISTORY_MAX) || 50;
  lines.push('  ' + C.dim + 'Summary: total transitions=' + allHistory.length
    + ', history_used=' + allHistory.length + '/' + max + C.reset);
  lines.push('');

  // Zone 3 (Intelligence Strip) intentionally omitted -- no signals integration in 100.

  // Zone 4.
  const footer = renderShowFooter(state && state.jtbd);
  for (const f of footer) lines.push(f);
  lines.push('');
  return lines.join('\n');
}

// Shape E renderer for the history subcommand (last 20 transitions).
function renderShapeEHistory(room) {
  const slug = room.slug || 'unknown';
  const state = loadStateModule().getCurrent(room.abs_path);
  const stage = state && state.jtbd ? state.jtbd : 'null';
  const lines = [];

  lines.push(C.dim + '-- ' + slug + ' -- jtbd -- history --' + C.reset);
  lines.push('');

  const all = readHistorySafe(room);
  const max = (loadStateModule().HISTORY_MAX) || 50;
  const slice = all.slice(-Math.min(all.length, 20));
  lines.push('  ' + C.green + G.filledSquare + C.reset + ' History ('
    + all.length + ' of ' + max + ' entries)');
  if (slice.length === 0) {
    lines.push('     ' + C.dim + '(no history yet)' + C.reset);
  } else {
    for (let i = 0; i < slice.length; i++) {
      const isLast = i === slice.length - 1;
      lines.push(renderHistoryLine(slice[i], isLast, true));
    }
  }
  lines.push('');

  let summary = 'Summary: total transitions=' + all.length
    + ', history_used=' + all.length + '/' + max;
  if (slice.length > 0) {
    summary += ', oldest=' + (slice[0].at || 'unknown');
  }
  lines.push('  ' + C.dim + summary + C.reset);
  lines.push('');

  // Zone 4 (current state + actions).
  if (state && state.jtbd) {
    lines.push('  ' + C.cyan + G.rightTriFilled + ' /mos:jtbd                 ' + C.reset
      + C.dim + '# current state' + C.reset);
  } else {
    lines.push('  ' + C.cyan + G.rightTriFilled + ' /mos:jtbd                 ' + C.reset
      + C.dim + '# current state (null)' + C.reset);
  }
  lines.push('  ' + C.dim + G.rightTriEmpty + ' ' + C.reset + C.cyan + '/mos:jtbd set <id>' + C.reset
    + '        ' + C.dim + '# manual selection' + C.reset);
  lines.push('  ' + C.dim + G.rightTriEmpty + ' ' + C.reset + C.cyan + '/mos:jtbd clear' + C.reset
    + '           ' + C.dim + '# return to null' + C.reset);
  lines.push('');
  return lines.join('\n');
}

// Shape E renderer for the list subcommand (13 taxonomy entries).
function renderShapeEList(taxonomy, room) {
  const slug = room.slug || 'unknown';
  const lines = [];

  lines.push(C.dim + '-- ' + slug + ' -- jtbd -- list --' + C.reset);
  lines.push('');

  lines.push('  ' + C.green + G.filledSquare + C.reset + ' JTBD taxonomy ('
    + taxonomy.entries.length + ' entries)');
  // Compute id-column width for alignment.
  let idWidth = 0;
  for (const e of taxonomy.entries) {
    if (e.id.length > idWidth) idWidth = e.id.length;
  }
  for (const e of taxonomy.entries) {
    const tag = e.id === 'explore' ? ' (fallback)' : '';
    lines.push('     ' + C.dim + G.bullet + C.reset + ' '
      + C.cyan + pad(e.id, idWidth + 2) + C.reset + e.one_line + tag);
  }
  lines.push('');

  // Zone 4.
  lines.push('  ' + C.cyan + G.rightTriFilled + ' /mos:jtbd                 ' + C.reset
    + C.dim + '# current state' + C.reset);
  lines.push('  ' + C.dim + G.rightTriEmpty + ' ' + C.reset + C.cyan + '/mos:jtbd set <id>' + C.reset
    + '        ' + C.dim + '# manual selection' + C.reset);
  lines.push('  ' + C.dim + G.rightTriEmpty + ' ' + C.reset + C.cyan + '/mos:jtbd history' + C.reset
    + '         ' + C.dim + '# transition history' + C.reset);
  lines.push('');
  return lines.join('\n');
}

// Shape F.1 selector for the set subcommand (no arg). Renders 12 first-class
// jobs + Free-Text; per Phase 95.1-04 D-19, this is a structural marker block;
// Larry handles conversational selection until Phase 88.2 ships AskUserQuestion.
function renderShapeF1Set(taxonomy, state, room) {
  const slug = room.slug || 'unknown';
  const current = state && state.jtbd ? state.jtbd : 'explore';
  const lines = [];

  lines.push(C.dim + '-- ' + slug + ' -- jtbd -- set --' + C.reset);
  lines.push('');
  lines.push('  ' + C.green + G.filledSquare + C.reset + ' Manual JTBD selection');
  lines.push('     ' + C.dim + 'current: ' + current + C.reset);
  lines.push('');
  lines.push('  ' + C.cyan + '[F.1 Next Move]' + C.reset);

  // 12 first-class jobs (everything except `explore`).
  const firstClass = taxonomy.entries.filter((e) => e.id !== 'explore');
  // Compute id-column width.
  let idWidth = 0;
  for (const e of firstClass) {
    if (e.id.length > idWidth) idWidth = e.id.length;
  }
  // First option is the recommended / primary; here we keep it deterministic
  // by marking the first job as primary unless it equals current (then second).
  let primaryIdx = 0;
  if (firstClass.length > 1 && firstClass[0].id === current) primaryIdx = 1;

  for (let i = 0; i < firstClass.length; i++) {
    const e = firstClass[i];
    const isPrimary = i === primaryIdx;
    const isCurrent = e.id === current;
    const glyph = isPrimary ? (C.cyan + G.rightTriFilled + C.reset)
      : (C.dim + G.rightTriEmpty + C.reset);
    const idLabel = pad(e.id, idWidth + 2);
    const suffix = isCurrent ? ' ' + C.dim + '(current)' + C.reset : '';
    const oneLine = e.one_line.replace(/\.$/, '');
    lines.push('   ' + glyph + ' ' + C.cyan + idLabel + C.reset
      + C.dim + '# ' + oneLine + C.reset + suffix);
  }
  // Free-Text option always last.
  lines.push('   ' + C.dim + G.rightTriEmpty + C.reset + ' '
    + C.cyan + pad('Free-Text', idWidth + 2) + C.reset
    + C.dim + '# describe the job in your own words' + C.reset);
  lines.push('');

  // Zone 4.
  lines.push('  ' + C.cyan + G.rightTriFilled + ' /mos:jtbd                 ' + C.reset
    + C.dim + '# cancel and re-show state' + C.reset);
  lines.push('  ' + C.dim + G.rightTriEmpty + ' ' + C.reset + C.cyan + '/mos:jtbd list' + C.reset
    + '            ' + C.dim + '# browse one-liners' + C.reset);
  lines.push('');
  return lines.join('\n');
}

// Tier 0 fallback when no active room is registered.
// Per Canon Part 3 Rule 2: 3-line error to stderr + zero exit code per
// the "graceful degradation" pattern (the command surfaced on a non-room
// surface; not a crash).
function renderNoRoom() {
  const lines = [];
  lines.push(C.dim + '-- MindrianOS -- jtbd -- no-room --' + C.reset);
  lines.push('');
  lines.push('  ' + C.red + 'x' + C.reset + ' No active room');
  lines.push('  ' + C.dim + 'Why: /mos:jtbd needs a room to query' + C.reset);
  lines.push('  ' + C.dim + 'Fix: ' + C.reset + C.cyan + '/mos:rooms list' + C.reset);
  lines.push('');
  lines.push('  ' + C.cyan + G.rightTriFilled + ' /mos:rooms list           ' + C.reset
    + C.dim + '# list known rooms' + C.reset);
  lines.push('  ' + C.dim + G.rightTriEmpty + ' ' + C.reset + C.cyan + '/mos:setup' + C.reset
    + '                ' + C.dim + '# initial room setup' + C.reset);
  lines.push('');
  return lines.join('\n');
}

// Helper: read full history list (returns array; empty if state file missing).
function readHistorySafe(room) {
  try {
    const mod = loadStateModule();
    return mod.history(room.abs_path, mod.HISTORY_MAX || 50);
  } catch (_e) {
    return [];
  }
}

// -- Stderr helpers (Canon Part 3 Rule 2: 3-line error pattern) -----

function writeError3Line(headline, why, fix) {
  process.stderr.write(C.red + 'x ' + C.reset + headline + '\n');
  process.stderr.write('  Why: ' + why + '\n');
  process.stderr.write('  Fix: ' + C.cyan + fix + C.reset + '\n');
}

function jtbdIdSet(taxonomy) {
  const out = new Set();
  for (const e of taxonomy.entries) out.add(e.id);
  return out;
}

// -- Main dispatch ---------------------------------------------------

function main() {
  const flags = parseArgs(process.argv.slice(2));
  const room = resolveActiveRoom();

  // No active room: Tier 0 fallback. Same path for human and JSON.
  if (!room) {
    if (flags.json) {
      process.stdout.write(JSON.stringify({
        subcommand: flags.subcommand,
        error: 'no_active_room',
        warnings: ['no registry or no active room'],
      }, null, 2) + '\n');
    } else {
      process.stdout.write(renderNoRoom());
    }
    process.exit(0);
  }

  // Load taxonomy.
  let taxonomy;
  try { taxonomy = loadTaxonomy(); }
  catch (e) {
    writeError3Line(
      'cannot load jtbd-taxonomy.json',
      e.message,
      '/mos:doctor --all  # diagnose plugin install state'
    );
    process.exit(2);
  }

  // Load state module.
  let mod;
  try { mod = loadStateModule(); }
  catch (e) {
    writeError3Line(
      'cannot load jtbd-state module',
      e.message,
      '/mos:doctor --all  # diagnose plugin install state'
    );
    process.exit(2);
  }

  let state;
  try { state = mod.getCurrent(room.abs_path); }
  catch (e) {
    writeError3Line(
      'cannot read jtbd state',
      e.message,
      '/mos:doctor --all  # diagnose .mindrian/ state file'
    );
    process.exit(2);
  }

  // Branch by subcommand.
  if (flags.subcommand === 'show') {
    if (flags.json) {
      process.stdout.write(JSON.stringify({
        subcommand: 'show', room: room.slug,
        state: state, history: readHistorySafe(room),
      }, null, 2) + '\n');
    } else {
      process.stdout.write(renderShapeEShow(state, room, {}));
    }
    process.exit(0);
  }

  if (flags.subcommand === 'history') {
    if (flags.json) {
      process.stdout.write(JSON.stringify({
        subcommand: 'history', room: room.slug,
        state: state, history: readHistorySafe(room),
      }, null, 2) + '\n');
    } else {
      process.stdout.write(renderShapeEHistory(room));
    }
    process.exit(0);
  }

  if (flags.subcommand === 'list') {
    if (flags.json) {
      process.stdout.write(JSON.stringify({
        subcommand: 'list', room: room.slug, taxonomy: taxonomy,
      }, null, 2) + '\n');
    } else {
      process.stdout.write(renderShapeEList(taxonomy, room));
    }
    process.exit(0);
  }

  if (flags.subcommand === 'clear') {
    try {
      mod.clear(room.abs_path);
    } catch (e) {
      if (flags.json) {
        process.stdout.write(JSON.stringify({
          subcommand: 'clear', room: room.slug,
          error: e.message,
        }, null, 2) + '\n');
      } else {
        writeError3Line(
          'clear failed',
          e.message,
          '/mos:jtbd  # inspect state'
        );
      }
      process.exit(1);
    }
    const newState = mod.getCurrent(room.abs_path);
    if (flags.json) {
      process.stdout.write(JSON.stringify({
        subcommand: 'clear', room: room.slug,
        state: newState, success: true,
      }, null, 2) + '\n');
    } else {
      const wasJtbd = state && state.jtbd ? state.jtbd : 'null';
      process.stdout.write(renderShapeEShow(newState, room, {
        successBanner: {
          headline: 'Cleared JTBD (was: ' + wasJtbd + ')',
          detail: 'trigger=manual_clear; classifier may re-populate on next user turn',
        },
      }));
    }
    process.exit(0);
  }

  if (flags.subcommand === 'set') {
    // No jtbdArg: render F.1 picker.
    if (!flags.jtbdArg) {
      if (flags.json) {
        process.stdout.write(JSON.stringify({
          subcommand: 'set', room: room.slug,
          state: state,
          options: taxonomy.entries.filter((e) => e.id !== 'explore').map((e) => ({
            id: e.id, one_line: e.one_line,
          })),
          free_text: true,
        }, null, 2) + '\n');
      } else {
        process.stdout.write(renderShapeF1Set(taxonomy, state, room));
      }
      process.exit(0);
    }

    // Validate arg against taxonomy.
    const ids = jtbdIdSet(taxonomy);
    const arg = flags.jtbdArg;
    if (!ids.has(arg)) {
      if (flags.json) {
        process.stdout.write(JSON.stringify({
          subcommand: 'set', room: room.slug,
          transition: {
            success: false,
            violations: [{ category: 'argument', severity: 'error',
              message: 'unknown jtbd: ' + arg }],
          },
        }, null, 2) + '\n');
      } else {
        const allowed = Array.from(ids).join(' | ');
        writeError3Line(
          'unknown jtbd: ' + arg,
          'allowed jtbds are ' + allowed,
          '/mos:jtbd list  # see all 13 entries'
        );
      }
      process.exit(1);
    }

    // Fire the set transition. setCurrent in 100-03 doesn't throw; it logs to
    // stderr + returns. We re-read state to confirm the write landed.
    try {
      mod.setCurrent(room.abs_path, {
        jtbd: arg,
        confidence: 1.0,
        evidence: ['manual_set'],
        trigger: 'manual_set',
        manual: true,
      });
    } catch (e) {
      if (flags.json) {
        process.stdout.write(JSON.stringify({
          subcommand: 'set', room: room.slug,
          transition: {
            success: false,
            violations: [{ category: 'transition', severity: 'error',
              message: e.message }],
          },
        }, null, 2) + '\n');
      } else {
        writeError3Line(
          'set failed: ' + arg,
          e.message,
          '/mos:jtbd  # inspect state'
        );
      }
      process.exit(1);
    }

    const newState = mod.getCurrent(room.abs_path);
    const ok = newState && newState.jtbd === arg;
    if (!ok) {
      // The 100-03 setCurrent may have been blocked by a non-expired manual
      // override (the auto_blocked path). For /mos:jtbd set we always pass
      // manual:true so this should not happen, but defensively report.
      if (flags.json) {
        process.stdout.write(JSON.stringify({
          subcommand: 'set', room: room.slug,
          transition: {
            success: false,
            violations: [{ category: 'transition', severity: 'error',
              message: 'state did not change to ' + arg + ' after setCurrent' }],
          },
          state: newState,
        }, null, 2) + '\n');
      } else {
        writeError3Line(
          'set rejected: ' + (state && state.jtbd ? state.jtbd : 'null') + ' -> ' + arg,
          'state did not change after setCurrent (check stderr from jtbd-state)',
          '/mos:jtbd  # inspect state'
        );
      }
      process.exit(1);
    }

    if (flags.json) {
      process.stdout.write(JSON.stringify({
        subcommand: 'set', room: room.slug,
        transition: {
          success: true,
          jtbd: newState.jtbd,
          confidence: newState.confidence,
          entered_at: newState.entered_at,
          expires_at: newState.expires_at || null,
        },
        state: newState,
      }, null, 2) + '\n');
    } else {
      const fromLabel = state && state.jtbd ? state.jtbd : 'null';
      process.stdout.write(renderShapeEShow(newState, room, {
        successBanner: {
          headline: 'Set JTBD ' + fromLabel + ' ' + G.arrow + ' ' + newState.jtbd,
          detail: 'trigger=manual_set; sticky 24h until clear / re-set',
        },
      }));
    }
    process.exit(0);
  }

  // Should be unreachable -- defensive.
  writeError3Line(
    'unknown subcommand',
    'parsed subcommand=' + flags.subcommand,
    '/mos:jtbd  # default show subcommand'
  );
  process.exit(2);
}

try {
  main();
} catch (e) {
  process.stderr.write(C.red + 'x ' + C.reset + 'jtbd-command crashed\n');
  process.stderr.write('  ' + (e && e.message ? e.message : String(e)) + '\n');
  process.exit(2);
}
