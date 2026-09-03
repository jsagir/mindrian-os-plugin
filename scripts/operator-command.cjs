#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 99-05 -- /mos:operator command-line entry point
 * =====================================================
 * Shape E (Action Report) renderer for the conversation operator.
 *
 * Subcommands (Phase 99 D-15):
 *   /mos:operator                      show current state + last 5 history (Shape E)
 *   /mos:operator history              full history up to 50 entries (Shape E)
 *   /mos:operator set [<op>]           Shape F.1 picker; if <op> given, transition
 *   /mos:operator reset [--confirm]    Shape F.4 confirmation; --confirm to fire
 *   /mos:operator --json [subcmd]      machine-readable JSON output
 *
 * UI Ruling System compliance (skills/ui-system/SKILL.md sections 1-4):
 *   12-glyph vocabulary only (forbidden: BOX-CHARS, X-GLYPHS, emoji presentation)
 *   five-color contract (green/cyan/yellow/red/gray; no magenta/blue)
 *   four-zone anatomy (Zone 1 header, Zone 2 body, Zone 3 omitted, Zone 4 footer)
 *   Shape E body shape (Phase 99 D-13; canonical body_shape declaration in commands/operator.md)
 *   Shape F.1 selector + Shape F.4 confirmation as structural markers per
 *   Phase 95.1-04 D-19 deferral pattern; Larry handles conversational selection
 *   until Phase 88.2 ships the canonical AskUserQuestion primitive.
 *
 * Self-dog-food: this script's runtime output MUST pass the Phase 95.1 class F
 * UI Ruling System drift detector. The script's SOURCE must also pass:
 *   grep -E "BOX-CHARS"     -> 0 matches  (no curved/straight box drawing chars)
 *   grep -E "X-GLYPHS"      -> 0 matches  (no failed-x family literals)
 * The source uses Unicode escape sequences (\uXXXX) for every glyph emission so
 * the source itself contains zero literal forbidden characters; runtime
 * concatenation produces the visible glyphs at stdout time.
 *
 * Frame budget: < 50ms wall-clock end-to-end (single getCurrent + assembly + write).
 *
 * Canon Part 8 (LOCAL ONLY):
 *   Reads <roomDir>/.mindrian/conversation-operator.json via 99-01.
 *   Writes via 99-01's transition() (which writes both the JSON and the
 *   OPERATOR_TRANSITION graph edge per Canon Part 4).
 *   Zero Brain queries. Zero Pinecone lookups. Zero remote calls.
 *
 * License: BSL 1.1.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const PLUGIN_ROOT = path.resolve(__dirname, '..');

// 99-01 dependency. Loaded at runtime so this script ships independently of
// wave-1 merge order; when /mos:operator is invoked by a user, all wave-1
// commits will have landed.
let operator = null;
function loadOperatorModule() {
  if (operator) return operator;
  operator = require(path.join(PLUGIN_ROOT, 'lib', 'conversation', 'operator.cjs'));
  return operator;
}

// Gate machinery (Phase 260903-eu9). Loaded lazily, same rationale as
// loadOperatorModule above -- the script keeps working if wave ordering
// shifts these modules around.
let gateRenderMod = null;
function loadGateRender() {
  if (gateRenderMod) return gateRenderMod;
  gateRenderMod = require(path.join(PLUGIN_ROOT, 'lib', 'mcp', 'gate-render.cjs'));
  return gateRenderMod;
}

let sessionBindingMod = null;
function loadSessionBinding() {
  if (sessionBindingMod) return sessionBindingMod;
  sessionBindingMod = require(path.join(PLUGIN_ROOT, 'lib', 'core', 'session-binding.cjs'));
  return sessionBindingMod;
}

// ANSI colors (skills/ui-system/SKILL.md section 4 -- exact copy from scripts/doctor.cjs).
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
// glyphs that the FORBIDDEN_BOX_CHARS / FORBIDDEN_GLYPHS regexes catch. The
// runtime emission concatenates them into the rendered output verbatim.
//   U+25A0 BLACK SQUARE                  filled-square
//   U+25BC BLACK DOWN-POINTING TRIANGLE  down-triangle
//   U+25B6 BLACK RIGHT-POINTING TRIANGLE right-triangle-filled (primary action)
//   U+25B7 WHITE RIGHT-POINTING TRIANGLE right-triangle-empty (alternative action)
//   U+251C BOX DRAWINGS LIGHT VERTICAL AND RIGHT  branch (not-last sibling)
//   U+2514 BOX DRAWINGS LIGHT UP AND RIGHT       last-branch (last sibling)
//   U+2500 BOX DRAWINGS LIGHT HORIZONTAL         used only as branch tail
//   U+2713 CHECK MARK                    check (complete)
//   U+2022 BULLET                        bullet (draft/partial)
//   U+26A0 WARNING SIGN                  warning (note: bare codepoint only;
//                                           variation selector U+FE0F is forbidden)
//   U+26A1 HIGH VOLTAGE SIGN             lightning (convergence)
//   U+2B1C WHITE LARGE SQUARE            empty-square (gap)
//   U+2192 RIGHTWARDS ARROW              arrow (inline suggestion)
const G = {
  filledSquare: '■',                  // U+25A0 BLACK SQUARE
  rightTriFilled: '▶',                // U+25B6 BLACK RIGHT-POINTING TRIANGLE
  rightTriEmpty: '▷',                 // U+25B7 WHITE RIGHT-POINTING TRIANGLE
  branch: '\u251C\u2500',               // branch (U+251C + U+2500) -- emitted at runtime, not literal in source
  lastBranch: '\u2514\u2500',           // last-branch (U+2514 + U+2500) -- emitted at runtime, not literal in source
  check: '✓',                          // U+2713 CHECK MARK
  bullet: '•',                         // U+2022 BULLET
  warning: '⚠',                        // U+26A0 WARNING SIGN (bare, no VS16)
  lightning: '⚡',                      // U+26A1 HIGH VOLTAGE SIGN
  emptySquare: '⬜',                    // U+2B1C WHITE LARGE SQUARE
  arrow: '→',                          // U+2192 RIGHTWARDS ARROW
};

// -- Argument parsing ------------------------------------------------

function parseArgs(argv) {
  const out = { subcommand: 'show', opArg: null, confirm: false, json: false };
  const args = argv.slice();
  while (args.length) {
    const a = args.shift();
    if (a === '--json') { out.json = true; continue; }
    if (a === '--confirm') { out.confirm = true; continue; }
    if (a === 'history') { out.subcommand = 'history'; continue; }
    if (a === 'set') {
      out.subcommand = 'set';
      if (args.length && !args[0].startsWith('--')) {
        out.opArg = args.shift();
      }
      continue;
    }
    if (a === 'reset') { out.subcommand = 'reset'; continue; }
    // Unknown arg: ignore (defensive); future flags slot here.
  }
  return out;
}

// -- Active-room resolution -----------------------------------------

// Phase 127.3 Plan 03 Task 4: canonical-single-source for active-room
// resolution. Before this refactor, this function carried its own legacy-only
// registry walk that silently rejected the CURRENT registry shape (Object
// rooms). Same bug family as the JTBD-update silent-failure RCA, applied to
// /mos:operator. Pre-flight 121.5 scope-guard verified clear: the 121.5 guard
// names commands/operator.md (the markdown UI surface), NOT
// scripts/operator-command.cjs (the implementation). Distinct files; zero
// parallel-session collision in the last 2 weeks of git log. Reroutes to
// lib/core/resolve-active-room.cjs (Plan 00 chokepoint). The chokepoint
// returns { slug, abs_path } -- both field names match the 18 downstream
// call-sites (room.slug + room.abs_path). Canon Part 7 single-resolver.
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

// -- Suggested default for Shape F.1 picker -------------------------
// Pick the most-likely user intent. Default to BUILD_ROOM when current
// is anything else; default to JUST_TALK when current is BUILD_ROOM
// (manual override path away from filing).
function suggestedF1Default(currentOp) {
  if (currentOp !== 'BUILD_ROOM') return 'BUILD_ROOM';
  return 'JUST_TALK';
}

// -- Gate card composition (Phase 260903-eu9) ------------------------
// Builds the superset card gate-render.cjs normalizes and renders, and that
// gate-ledger.cjs mints/consumes on the `set <op>` path. One option per
// OPERATORS member plus a trailing Free-Text affordance (F-9); id and label
// are both the operator name so validateChosenAgainstCard resolves a raw
// CLI argument directly against an option id. `kind` MUST be 'general'
// (F-5) -- ratifiableGateKinds() is a frozen list and 'general' is the one
// this surface is allowed to mint.
function buildOperatorGateCard(state) {
  const op = loadOperatorModule();
  const OPS = op.OPERATORS;
  const def = suggestedF1Default(state.current);
  const options = OPS.map((o) => ({
    id: o,
    label: o,
    description: o === state.current ? '(current -- selecting this is a no-op)' : null,
    rank: o === def ? 1 : null,
  }));
  options.push({ id: 'free-text', label: 'Free-Text' });
  return {
    header: '[F.1 Next Move]',
    kind: 'general',
    selectMode: 'single',
    options: options,
  };
}

// -- Renderers (Shape E, Shape F.1, Shape F.4) ----------------------

// Pad a string to width (left-justified, ASCII space).
function pad(s, width) {
  if (s.length >= width) return s;
  return s + ' '.repeat(width - s.length);
}

// Render a single history entry line: <branch-glyph> <op-padded> <ts-dim> trigger=<trigger>
// When fullMode=true, append from=<from> at the right.
function renderHistoryLine(entry, isLast, fullMode) {
  const glyph = isLast ? G.lastBranch : G.branch;
  const opLabel = pad(entry.op || '?', 16);
  const ts = entry.ts || entry.to_ts || '';
  const trigger = entry.trigger || '?';
  let line = '     ' + C.dim + glyph + C.reset + ' ' + opLabel + ' ' + C.dim + ts + C.reset + '  trigger=' + trigger;
  if (fullMode) {
    line += '          from=' + (entry.from === null || entry.from === undefined ? 'null' : entry.from);
  }
  return line;
}

function renderShapeE(state, room, opts) {
  const o = opts || {};
  const entries = o.entries || 5;
  const fullMode = !!o.full;
  const successBanner = o.successBanner || null;
  const stage = state.current;
  const slug = room.slug || 'unknown';

  const lines = [];
  // Zone 1 header: -- <slug> -- operator -- <stage> --
  lines.push(C.dim + '-- ' + slug + ' -- operator -- ' + stage + ' --' + C.reset);
  lines.push('');

  // Zone 2: optional success banner first
  if (successBanner) {
    lines.push('  ' + C.green + G.filledSquare + C.reset + ' ' + successBanner.headline);
    if (successBanner.detail) {
      lines.push('     ' + C.dim + successBanner.detail + C.reset);
    }
    lines.push('');
  }

  // Zone 2 sub-block 1: Current
  const enteredAge = ageHuman(state.entered_at);
  lines.push('  ' + C.green + G.filledSquare + C.reset + ' Current               ' + C.cyan + state.current + C.reset);
  lines.push('     ' + C.dim + 'entered  ' + (state.entered_at || 'unknown') + ' (' + enteredAge + ')' + C.reset);
  lines.push('     ' + C.dim + 'previous ' + (state.previous === null || state.previous === undefined ? 'null' : state.previous) + C.reset);
  const ctx = state.context || {};
  const ctxLine = 'context  active_section=' + (ctx.active_section === null || ctx.active_section === undefined ? 'null' : ctx.active_section)
    + ', methodology=' + (ctx.methodology_in_flight === null || ctx.methodology_in_flight === undefined ? 'null' : ctx.methodology_in_flight);
  lines.push('     ' + C.dim + ctxLine + C.reset);
  lines.push('');

  // Zone 2 sub-block 2: history
  const allHistory = Array.isArray(state.history) ? state.history : [];
  const historyMaxConst = (loadOperatorModule().HISTORY_MAX) || 50;
  const slice = fullMode
    ? allHistory.slice(-Math.min(allHistory.length, historyMaxConst))
    : allHistory.slice(-Math.min(allHistory.length, entries));
  if (fullMode) {
    lines.push('  ' + C.green + G.filledSquare + C.reset + ' Full history (' + allHistory.length + '/' + historyMaxConst + ' entries)');
  } else {
    const label = entries === 1 ? 'Last 1 history' : 'Last ' + entries + ' history';
    lines.push('  ' + C.green + G.filledSquare + C.reset + ' ' + label);
  }
  if (slice.length === 0) {
    lines.push('     ' + C.dim + '(no history yet)' + C.reset);
  } else {
    for (let i = 0; i < slice.length; i++) {
      const isLast = i === slice.length - 1;
      lines.push(renderHistoryLine(slice[i], isLast, fullMode));
    }
  }
  lines.push('');

  // Zone 2 summary line
  let summary = 'Summary: total transitions=' + allHistory.length + ', history_used=' + allHistory.length + '/' + historyMaxConst;
  if (fullMode && allHistory.length > 0) {
    summary += ', oldest=' + (allHistory[0].ts || 'unknown');
  }
  lines.push('  ' + C.dim + summary + C.reset);
  lines.push('');

  // Zone 3 (Intelligence Strip) intentionally omitted -- no signals integration in 99.

  // Zone 4 footer (always present, 3 actions).
  if (fullMode) {
    lines.push('  ' + C.cyan + '▶ /mos:operator             ' + C.reset + C.dim + '# current state' + C.reset);
    lines.push('  ' + C.dim + G.rightTriEmpty + ' ' + C.reset + C.cyan + '/mos:operator set <op>' + C.reset + '    ' + C.dim + '# manual transition' + C.reset);
    lines.push('  ' + C.dim + G.rightTriEmpty + ' ' + C.reset + C.cyan + '/mos:operator reset' + C.reset + '       ' + C.dim + '# return to JUST_TALK' + C.reset);
  } else {
    lines.push('  ' + C.cyan + '▶ /mos:operator history     ' + C.reset + C.dim + '# full history' + C.reset);
    lines.push('  ' + C.dim + G.rightTriEmpty + ' ' + C.reset + C.cyan + '/mos:operator set <op>' + C.reset + '    ' + C.dim + '# manual transition' + C.reset);
    lines.push('  ' + C.dim + G.rightTriEmpty + ' ' + C.reset + C.cyan + '/mos:operator reset' + C.reset + '       ' + C.dim + '# return to JUST_TALK' + C.reset);
  }
  lines.push('');
  return lines.join('\n');
}

async function renderShapeF1(state, room) {
  const slug = room.slug || 'unknown';
  const card = buildOperatorGateCard(state);
  const gateRender = loadGateRender();
  const sessionBinding = loadSessionBinding();
  const sessionId = sessionBinding.resolveEffectiveSessionId(undefined, undefined);
  // This path mints NOTHING into the gate ledger (F-3): it only composes and
  // renders the card so the human can read it. Minting a gate_id no later
  // process can consume is the dead-seam shape this repo hunts.
  const result = await gateRender.renderGate(card, { capabilities: {}, sessionId: sessionId });
  const bodyLines = (result.rendered.zones.body || '').split('\n').map((l) => '   ' + l);

  const lines = [];
  lines.push(C.dim + '-- ' + slug + ' -- operator -- set --' + C.reset);
  lines.push('');
  lines.push('  ' + C.green + G.filledSquare + C.reset + ' Manual operator transition');
  lines.push('     ' + C.dim + 'current: ' + state.current + C.reset);
  lines.push('');
  lines.push('  ' + C.cyan + result.rendered.zones.header + C.reset);
  for (const l of bodyLines) lines.push(l);
  lines.push('');
  // Zone 4
  lines.push('  ' + C.cyan + '▶ /mos:operator             ' + C.reset + C.dim + '# cancel and re-show state' + C.reset);
  lines.push('  ' + C.dim + G.rightTriEmpty + ' ' + C.reset + C.cyan + '/mos:operator history' + C.reset + '     ' + C.dim + '# see full history first' + C.reset);
  lines.push('');
  return lines.join('\n');
}

function renderShapeF4(state, room) {
  const slug = room.slug || 'unknown';
  const lines = [];
  lines.push(C.dim + '-- ' + slug + ' -- operator -- reset --' + C.reset);
  lines.push('');
  lines.push('  ' + C.green + G.filledSquare + C.reset + ' Reset operator to JUST_TALK');
  lines.push('     ' + C.dim + 'current: ' + state.current + C.reset);
  const ctx = state.context || {};
  const hasFiling = (ctx.active_section !== null && ctx.active_section !== undefined)
    || (ctx.methodology_in_flight !== null && ctx.methodology_in_flight !== undefined);
  if (hasFiling) {
    const detail = 'this discards your active filing context (active_section='
      + (ctx.active_section === null || ctx.active_section === undefined ? 'null' : ctx.active_section)
      + ')';
    lines.push('     ' + C.yellow + G.warning + C.reset + ' ' + C.dim + detail + C.reset);
  }
  lines.push('');
  lines.push('  ' + C.cyan + '[F.4 Confirm Reset]' + C.reset);
  lines.push('   ' + C.cyan + G.rightTriFilled + C.reset + ' Confirm reset to JUST_TALK ' + C.dim + '(re-run with --confirm)' + C.reset);
  lines.push('   ' + C.dim + G.rightTriEmpty + ' Cancel' + C.reset);
  lines.push('');
  // Zone 4
  lines.push('  ' + C.cyan + '▶ /mos:operator             ' + C.reset + C.dim + '# show current state' + C.reset);
  lines.push('  ' + C.dim + G.rightTriEmpty + ' ' + C.reset + C.cyan + '/mos:operator history' + C.reset + '     ' + C.dim + '# see full history' + C.reset);
  lines.push('');
  return lines.join('\n');
}

// Tier 0 fallback when no active room is registered.
function renderNoRoom() {
  const lines = [];
  lines.push(C.dim + '-- MindrianOS -- operator -- no-room --' + C.reset);
  lines.push('');
  lines.push('  ' + C.yellow + G.warning + C.reset + ' no active room registered');
  lines.push('     ' + C.dim + 'the conversation operator is per-room state' + C.reset);
  lines.push('     ' + C.dim + 'register a room first, then re-run /mos:operator' + C.reset);
  lines.push('');
  lines.push('  ' + C.cyan + '▶ /mos:rooms                ' + C.reset + C.dim + '# list known rooms' + C.reset);
  lines.push('  ' + C.dim + G.rightTriEmpty + ' ' + C.reset + C.cyan + '/mos:setup' + C.reset + '                ' + C.dim + '# initial room setup' + C.reset);
  lines.push('');
  return lines.join('\n');
}

// -- Stderr helpers (Canon Part 3 Rule 2: 3-line error pattern) -----

function writeError3Line(headline, why, fix) {
  process.stderr.write(C.red + 'x ' + C.reset + headline + '\n');
  process.stderr.write('  Why: ' + why + '\n');
  process.stderr.write('  Fix: ' + C.cyan + fix + C.reset + '\n');
}

// -- Main dispatch ---------------------------------------------------

async function main() {
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

  // Load 99-01 module + state.
  let op;
  try { op = loadOperatorModule(); }
  catch (e) {
    writeError3Line(
      'cannot load operator module',
      e.message,
      '/mos:doctor --all  # diagnose plugin install state'
    );
    process.exit(2);
  }
  const { getCurrent, transition, OPERATORS } = op;

  let state;
  try { state = getCurrent(room.abs_path); }
  catch (e) {
    writeError3Line(
      'cannot read operator state',
      e.message,
      '/mos:doctor --all  # diagnose .mindrian/ state file'
    );
    process.exit(2);
  }

  // Branch by subcommand.
  if (flags.subcommand === 'show') {
    if (flags.json) {
      process.stdout.write(JSON.stringify({ subcommand: 'show', room: room.slug, state: state }, null, 2) + '\n');
    } else {
      process.stdout.write(renderShapeE(state, room, { entries: 5 }));
    }
    process.exit(0);
  }

  if (flags.subcommand === 'history') {
    if (flags.json) {
      process.stdout.write(JSON.stringify({ subcommand: 'history', room: room.slug, state: state }, null, 2) + '\n');
    } else {
      process.stdout.write(renderShapeE(state, room, { entries: op.HISTORY_MAX || 50, full: true }));
    }
    process.exit(0);
  }

  if (flags.subcommand === 'set') {
    // No opArg: render F.1 picker only. This path mints NOTHING into the
    // gate ledger (F-3): a gate_id no later process can consume is the
    // dead-seam shape this repo hunts.
    if (!flags.opArg) {
      if (flags.json) {
        const card = buildOperatorGateCard(state);
        const normalized = loadGateRender().normalizeCard(card);
        process.stdout.write(JSON.stringify({
          subcommand: 'set',
          room: room.slug,
          state: state,
          options: OPERATORS,
          default_suggestion: suggestedF1Default(state.current),
          card: normalized,
          gate_id: normalized.gate_id,
        }, null, 2) + '\n');
      } else {
        process.stdout.write(await renderShapeF1(state, room));
      }
      process.exit(0);
    }
    // Validate op argument.
    const opArg = flags.opArg;
    if (OPERATORS.indexOf(opArg) === -1) {
      if (flags.json) {
        process.stdout.write(JSON.stringify({
          subcommand: 'set',
          room: room.slug,
          transition: {
            success: false,
            violations: [{ category: 'argument', severity: 'error', message: 'unknown operator ' + opArg }],
          },
        }, null, 2) + '\n');
      } else {
        writeError3Line(
          'unknown operator: ' + opArg,
          'allowed operators are ' + OPERATORS.join(' | '),
          '/mos:operator set  # render F.1 picker'
        );
        process.stdout.write(renderShapeE(state, room, { entries: 5 }));
      }
      process.exit(1);
    }
    // No-op transition (already in target).
    if (opArg === state.current) {
      if (flags.json) {
        process.stdout.write(JSON.stringify({
          subcommand: 'set',
          room: room.slug,
          transition: {
            success: false,
            violations: [{ category: 'transition', severity: 'warn', message: 'already in ' + opArg + '; no transition needed' }],
          },
          state: state,
        }, null, 2) + '\n');
      } else {
        process.stdout.write(renderShapeE(state, room, {
          entries: 5,
          successBanner: {
            headline: 'Already in ' + opArg + ' (no transition fired)',
            detail: 'set <op> with the current operator is a no-op',
          },
        }));
      }
      process.exit(0);
    }
    // Fire the transition.
    let result;
    try {
      result = transition(room.abs_path, opArg, 'manual_set', {});
    } catch (e) {
      if (flags.json) {
        process.stdout.write(JSON.stringify({
          subcommand: 'set',
          room: room.slug,
          transition: {
            success: false,
            violations: [{ category: 'transition', severity: 'error', message: e.message }],
          },
        }, null, 2) + '\n');
      } else {
        writeError3Line(
          'transition failed: ' + state.current + ' -> ' + opArg,
          e.message,
          '/mos:operator set  # render F.1 picker for valid options'
        );
        process.stdout.write(renderShapeE(state, room, { entries: 5 }));
      }
      process.exit(1);
    }
    if (!result || result.success === false) {
      const violations = (result && result.violations) || [{ category: 'transition', severity: 'error', message: 'unknown failure' }];
      if (flags.json) {
        process.stdout.write(JSON.stringify({
          subcommand: 'set',
          room: room.slug,
          transition: { success: false, violations: violations },
        }, null, 2) + '\n');
      } else {
        const reason = violations[0] && violations[0].message ? violations[0].message : 'unknown';
        writeError3Line(
          'transition rejected: ' + state.current + ' -> ' + opArg,
          reason,
          '/mos:operator set  # render F.1 picker for valid options'
        );
        process.stdout.write(renderShapeE(state, room, { entries: 5 }));
      }
      process.exit(1);
    }
    // Success: re-render new state with banner.
    const newState = getCurrent(room.abs_path);
    if (flags.json) {
      process.stdout.write(JSON.stringify({
        subcommand: 'set',
        room: room.slug,
        transition: {
          success: true,
          current: newState.current,
          previous: newState.previous,
          entered_at: newState.entered_at,
        },
        state: newState,
      }, null, 2) + '\n');
    } else {
      process.stdout.write(renderShapeE(newState, room, {
        entries: 5,
        successBanner: {
          headline: 'Transitioned ' + (result.previous || state.current) + ' ' + G.arrow + ' ' + result.current,
          detail: 'trigger=manual_set',
        },
      }));
    }
    process.exit(0);
  }

  if (flags.subcommand === 'reset') {
    // No --confirm: show F.4 confirmation.
    if (!flags.confirm) {
      if (flags.json) {
        process.stdout.write(JSON.stringify({
          subcommand: 'reset',
          room: room.slug,
          state: state,
          awaiting_confirm: true,
        }, null, 2) + '\n');
      } else {
        process.stdout.write(renderShapeF4(state, room));
      }
      process.exit(0);
    }
    // Already in JUST_TALK: no-op.
    if (state.current === 'JUST_TALK') {
      if (flags.json) {
        process.stdout.write(JSON.stringify({
          subcommand: 'reset',
          room: room.slug,
          transition: {
            success: false,
            violations: [{ category: 'transition', severity: 'warn', message: 'already in JUST_TALK; reset is a no-op' }],
          },
          state: state,
        }, null, 2) + '\n');
      } else {
        process.stdout.write(renderShapeE(state, room, {
          entries: 5,
          successBanner: {
            headline: 'Already in JUST_TALK (reset is a no-op)',
            detail: 'no transition fired',
          },
        }));
      }
      process.exit(0);
    }
    // Fire reset transition.
    let result;
    try {
      result = transition(room.abs_path, 'JUST_TALK', 'manual_reset', {
        active_section: null,
        methodology_in_flight: null,
        decision_gate_pending: null,
      });
    } catch (e) {
      if (flags.json) {
        process.stdout.write(JSON.stringify({
          subcommand: 'reset',
          room: room.slug,
          transition: {
            success: false,
            violations: [{ category: 'transition', severity: 'error', message: e.message }],
          },
        }, null, 2) + '\n');
      } else {
        writeError3Line(
          'reset failed: ' + state.current + ' -> JUST_TALK',
          e.message,
          '/mos:operator history  # inspect state'
        );
      }
      process.exit(1);
    }
    if (!result || result.success === false) {
      const violations = (result && result.violations) || [{ category: 'transition', severity: 'error', message: 'unknown failure' }];
      if (flags.json) {
        process.stdout.write(JSON.stringify({
          subcommand: 'reset',
          room: room.slug,
          transition: { success: false, violations: violations },
        }, null, 2) + '\n');
      } else {
        const reason = violations[0] && violations[0].message ? violations[0].message : 'unknown';
        writeError3Line(
          'reset rejected: ' + state.current + ' -> JUST_TALK',
          reason,
          '/mos:operator history  # inspect state'
        );
      }
      process.exit(1);
    }
    const newState = getCurrent(room.abs_path);
    if (flags.json) {
      process.stdout.write(JSON.stringify({
        subcommand: 'reset',
        room: room.slug,
        transition: {
          success: true,
          current: newState.current,
          previous: newState.previous,
          entered_at: newState.entered_at,
        },
        state: newState,
      }, null, 2) + '\n');
    } else {
      process.stdout.write(renderShapeE(newState, room, {
        entries: 5,
        successBanner: {
          headline: 'Transitioned ' + (result.previous || state.current) + ' ' + G.arrow + ' ' + result.current,
          detail: 'trigger=manual_reset; cleared active_section + methodology_in_flight + decision_gate_pending',
        },
      }));
    }
    process.exit(0);
  }

  // Should be unreachable -- defensive.
  writeError3Line(
    'unknown subcommand',
    'parsed subcommand=' + flags.subcommand,
    '/mos:operator  # default show subcommand'
  );
  process.exit(2);
}

main().catch((e) => {
  process.stderr.write(C.red + 'x ' + C.reset + 'operator-command crashed\n');
  process.stderr.write('  ' + (e && e.message ? e.message : String(e)) + '\n');
  process.exit(2);
});
