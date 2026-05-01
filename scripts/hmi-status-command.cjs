#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 105-02 -- /mos:hmi-status command-line entry point
 * =========================================================
 * Read-only Shape E (Action Report) renderer for the Phase 105 HMI compliance
 * poll side-channel at <roomDir>/.mindrian/last-hmi-poll.json.
 *
 * D-02 invariant: this command NEVER auto-fixes. It NEVER calls the doctor.
 * It NEVER mutates state. Recovery is surfaced via Zone 4 action footer
 * pointing at /mos:doctor --ui-compliance --fix; the user invokes that
 * deliberately (Canon Part 3 - every choice is graph data).
 *
 * Subcommands:
 *   node scripts/hmi-status-command.cjs               render Shape E from side-channel
 *   node scripts/hmi-status-command.cjs --json        emit raw envelope JSON
 *
 * UI Ruling System compliance (skills/ui-system/SKILL.md sections 1-4):
 *   12-glyph vocabulary only. Forbidden: box-chars (curved + straight), X-glyph
 *   family, emoji presentation. Source uses Unicode escape sequences for every
 *   glyph emission so the source itself contains zero literal forbidden chars;
 *   runtime concatenation produces visible glyphs at stdout time. The renderer
 *   self-complies (Phase 95.1-06 ironic test).
 *
 *   Five-color contract (green/cyan/yellow/red/gray; no magenta/blue).
 *
 *   Four-zone anatomy:
 *     Zone 1 header  -- {room} -- hmi-status -- {stage} --
 *     Zone 2 body    Doctor status + counts + Top 5 priorities + mismatches
 *     Zone 3         omitted in 105-02 (room-proactive deferred per 95.1-04 D-17)
 *     Zone 4 footer  2-3 grounded /mos: actions; primary U+25B6, alt U+25B7
 *
 * Canon Part 8 (LOCAL ONLY):
 *   Reads <roomDir>/.mindrian/last-hmi-poll.json (Phase 105-01 side-channel).
 *   Reads ~/MindrianRooms/.rooms/registry.json (Phase 83 substrate).
 *   Zero Brain queries. Zero Pinecone lookups. Zero remote calls. Zero writes.
 *
 * Read-only invariant (D-02): renderer never mutates state; never persists.
 *
 * Frame budget: < 50ms wall-clock end-to-end (single read + 4-zone render).
 *
 * License: BSL 1.1.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

// -- Glyph constants -------------------------------------------------
// Approved 12-glyph vocabulary (skills/ui-system/SKILL.md section 3) emitted via
// Unicode escape sequences so the source code itself contains zero literal
// glyphs that the FORBIDDEN_BOX_CHARS / FORBIDDEN_GLYPHS regexes catch.
//   U+25A0 BLACK SQUARE                  filled-square (Zone 2 row header)
//   U+25B6 BLACK RIGHT-POINTING TRIANGLE primary action (Zone 4)
//   U+25B7 WHITE RIGHT-POINTING TRIANGLE alt action (Zone 4)
//   U+2713 CHECK MARK                    matched-jtbd row marker
//   U+2022 BULLET                        unmatched-jtbd row marker
//   U+26A0 WARNING SIGN                  shape-mismatch row marker (bare; no VS16)
const G = Object.freeze({
  HEADER:  '■',   // ■
  ACTION:  '▶',   // ▶
  ALT:     '▷',   // ▷
  CHECK:   '✓',   // ✓
  BULLET:  '•',   // •
  WARN:    '⚠',   // ⚠
});

// -- ANSI colors (5-color contract from skills/ui-system/SKILL.md §4) -
const C = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  cyan:  '\x1b[36m',
  yellow:'\x1b[33m',
  red:   '\x1b[31m',
  dim:   '\x1b[90m',
};

// -- Defensive truncation --------------------------------------------
function trunc(s, max) {
  if (s == null) return '';
  const str = String(s);
  if (str.length <= max) return str;
  return str.slice(0, max);
}

// -- Active-room resolution -----------------------------------------
// Mirrors scripts/hmi-compliance-poll.cjs._internal.resolveActiveRoom (Plan
// 105-01). Local copy avoids the cross-script require dance and keeps this
// command self-contained. If a future refactor exposes a shared helper, this
// can switch to a require + fall-through pattern.
function resolveActiveRoom() {
  const home = process.env.MINDRIAN_ROOMS_HOME || path.join(os.homedir(), 'MindrianRooms');
  const regPath = path.join(home, '.rooms', 'registry.json');
  if (!fs.existsSync(regPath)) return null;
  let reg;
  try { reg = JSON.parse(fs.readFileSync(regPath, 'utf8')); }
  catch (_e) { return null; }
  if (!reg || !reg.active_room || !Array.isArray(reg.rooms)) return null;
  const room = reg.rooms.find(function (r) { return r && r.slug === reg.active_room; });
  if (!room || !room.abs_path) return null;
  if (!fs.existsSync(room.abs_path)) return null;
  if (room.sealed === true) return null;
  return room;
}

// -- Side-channel reader (read-only, never throws) ------------------
function readSideChannel(roomDir) {
  if (!roomDir) return { envelope: null, error: 'missing' };
  const sidePath = path.join(roomDir, '.mindrian', 'last-hmi-poll.json');
  if (!fs.existsSync(sidePath)) return { envelope: null, error: 'missing' };
  let raw;
  try { raw = fs.readFileSync(sidePath, 'utf8'); }
  catch (e) { return { envelope: null, error: 'read: ' + trunc(e && e.message, 200) }; }
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch (e) { return { envelope: null, error: 'parse: ' + trunc(e && e.message, 200) }; }
  if (!parsed || typeof parsed !== 'object') {
    return { envelope: null, error: 'parse: not an object' };
  }
  return { envelope: parsed, error: null };
}

// -- Zone 1 header --------------------------------------------------
function renderZone1(envelope, command, slug) {
  const cmd = command || 'hmi-status';
  let room = trunc(slug || 'unknown', 80);
  if (!room) room = 'unknown';
  let stage;
  if (!envelope) {
    stage = 'no-poll-yet';
  } else if (envelope.status === 'ok') {
    const op = trunc(envelope.operator || 'unknown', 40);
    const jt = envelope.jtbd ? trunc(envelope.jtbd, 40) : 'no-jtbd';
    stage = op + '/' + jt;
  } else if (envelope.status === 'tier-0-skip') {
    stage = 'tier-0';
  } else if (envelope.status === 'doctor-error') {
    stage = 'doctor-error';
  } else if (envelope.status === 'no-active-room') {
    stage = 'tier-0';
  } else {
    stage = 'unknown';
  }
  return C.dim + '-- ' + room + ' -- ' + cmd + ' -- ' + stage + ' --' + C.reset;
}

// -- Zone 2 status row ----------------------------------------------
function renderZone2Status(envelope) {
  const lines = [];
  const doctor = (envelope && envelope.doctor) || {};
  const status = doctor.status || 'unknown';
  const total = typeof doctor.totalViolations === 'number' ? doctor.totalViolations : 0;
  const statusColor = status === 'ok' ? C.green : (status === 'warn' ? C.yellow : C.red);
  lines.push('  ' + statusColor + G.HEADER + C.reset + ' Doctor status: '
    + statusColor + status + C.reset + ' (' + total + ' violations)');

  const counts = doctor.counts || {};
  const kindOrder = [
    ['missingBodyShape', 'missing-body-shape'],
    ['unauthorizedBoxChar', 'unauthorized-box-char'],
    ['unauthorizedGlyph', 'unauthorized-glyph'],
    ['rendererMissingZone1', 'renderer-missing-zone1'],
    ['rendererMissingZone4', 'renderer-missing-zone4'],
  ];
  const populated = [];
  for (const pair of kindOrder) {
    const camel = pair[0];
    const label = pair[1];
    const v = typeof counts[camel] === 'number' ? counts[camel] : 0;
    if (v > 0) populated.push(v + ' ' + label);
  }
  if (populated.length > 0) {
    lines.push('  ' + C.dim + G.HEADER + C.reset + ' Counts: ' + populated.join(', '));
  }
  return lines;
}

// -- Single priority row formatter ----------------------------------
function formatPriorityRow(p) {
  if (!p || typeof p !== 'object') return '';
  const file = trunc(p.file || '?', 200);
  const weight = typeof p.weight === 'number' ? p.weight : 0;
  const matched = p.matched_jtbd ? trunc(p.matched_jtbd, 80) : null;
  const via = p.via ? trunc(p.via, 80) : null;
  const isMatched = weight === 1.0;
  const glyph = isMatched
    ? (C.green + G.CHECK + C.reset)
    : (C.dim + G.BULLET + C.reset);
  let row = '     ' + glyph + ' ' + file + '  weight ' + weight.toFixed(1);
  if (matched) {
    row += '  matched: ' + matched;
    if (via) row += ' via ' + via;
  }
  return row;
}

// -- Zone 2 priorities sub-block ------------------------------------
function renderZone2Priorities(envelope) {
  const lines = [];
  const priorities = (envelope && Array.isArray(envelope.priorities)) ? envelope.priorities : [];
  if (priorities.length === 0) return lines;
  lines.push('');
  lines.push('  ' + C.cyan + G.HEADER + C.reset + ' Top 5 priorities (JTBD-weighted)');
  const top = priorities.slice(0, 5);
  for (const p of top) {
    lines.push(formatPriorityRow(p));
  }
  return lines;
}

// -- Single mismatch row formatter ----------------------------------
function formatMismatchRow(m) {
  if (!m || typeof m !== 'object') return '';
  const file = trunc(m.file || '?', 200);
  const declared = trunc(m.declared || '?', 40);
  const operator = trunc(m.operator || '?', 40);
  const expected = Array.isArray(m.expected_family) ? m.expected_family.map(function (x) {
    return trunc(x, 40);
  }).join('|') : '?';
  return '     ' + C.yellow + G.WARN + C.reset
    + ' ' + file + '  declared: ' + declared
    + '  operator ' + operator + ' expects: ' + expected;
}

// -- Zone 2 mismatches sub-block ------------------------------------
function renderZone2Mismatches(envelope) {
  const lines = [];
  const mismatches = (envelope && Array.isArray(envelope.operator_shape_mismatches))
    ? envelope.operator_shape_mismatches : [];
  if (mismatches.length === 0) return lines;
  lines.push('');
  lines.push('  ' + C.yellow + G.HEADER + C.reset + ' Operator shape mismatches');
  for (const m of mismatches) {
    lines.push(formatMismatchRow(m));
  }
  return lines;
}

// -- Zone 4 action footer -------------------------------------------
// Renderer Zone 4 pattern (anchor for the doctor.cjs --ui-compliance scanner):
//   ▶ /mos:doctor --ui-compliance --fix    primary recovery action
//   ▷ /mos:hmi-status --json               machine-readable alt
// mode: 'ok' | 'clean' | 'error' | 'tier-0' | 'no-poll' | 'no-room'
function renderZone4(envelope, mode) {
  const lines = [];
  if (mode === 'ok') {
    lines.push('  ' + C.cyan + G.ACTION + C.reset + ' /mos:doctor --ui-compliance --fix');
    lines.push('  ' + C.dim + G.ALT + C.reset + ' /mos:doctor --ui-compliance --json');
    lines.push('  ' + C.dim + G.ALT + C.reset + ' /mos:hmi-status --json');
  } else if (mode === 'clean') {
    lines.push('  ' + C.cyan + G.ACTION + C.reset + ' /mos:hmi-status --json');
    lines.push('  ' + C.dim + G.ALT + C.reset + ' /mos:doctor --all');
  } else if (mode === 'error') {
    lines.push('  ' + C.cyan + G.ACTION + C.reset + ' /mos:doctor --ui-compliance');
    lines.push('  ' + C.dim + G.ALT + C.reset + ' /mos:hmi-status --json');
  } else if (mode === 'tier-0') {
    lines.push('  ' + C.cyan + G.ACTION + C.reset + ' /mos:setup graph');
    lines.push('  ' + C.dim + G.ALT + C.reset + ' /mos:doctor --all');
  } else if (mode === 'no-poll') {
    lines.push('  ' + C.cyan + G.ACTION + C.reset + ' /mos:doctor --ui-compliance');
    lines.push('  ' + C.dim + G.ALT + C.reset + ' node scripts/hmi-compliance-poll.cjs --once');
  } else if (mode === 'no-room') {
    lines.push('  ' + C.cyan + G.ACTION + C.reset + ' /mos:setup');
    lines.push('  ' + C.dim + G.ALT + C.reset + ' /mos:doctor --cascade-rooms');
  }
  return lines;
}

// -- Provenance footer ----------------------------------------------
function renderProvenance(envelope) {
  if (!envelope) return C.dim + '  (no provenance)' + C.reset;
  const polled = envelope.polled_at || null;
  const elapsed = typeof envelope.elapsed_ms === 'number' ? envelope.elapsed_ms : null;
  const mode = envelope.mode || null;
  if (!polled && elapsed == null && !mode) {
    return C.dim + '  (no provenance)' + C.reset;
  }
  const polledStr = polled ? trunc(polled, 80) : 'unknown';
  const elapsedStr = elapsed != null ? elapsed + 'ms' : 'unknown';
  const modeStr = mode ? trunc(mode, 4) : 'unknown';
  return C.dim + '  (polled ' + polledStr + ', elapsed ' + elapsedStr + ', mode ' + modeStr + ')' + C.reset;
}

// -- Render: status === 'ok' ----------------------------------------
function renderShapeE(envelope, slug) {
  const lines = [];
  lines.push(renderZone1(envelope, 'hmi-status', slug));
  lines.push('');
  // Zone 2: status header.
  const statusLines = renderZone2Status(envelope);
  for (const l of statusLines) lines.push(l);
  // Zone 2: priorities.
  const priorityLines = renderZone2Priorities(envelope);
  for (const l of priorityLines) lines.push(l);
  // Zone 2: mismatches.
  const mismatchLines = renderZone2Mismatches(envelope);
  for (const l of mismatchLines) lines.push(l);
  // Provenance.
  lines.push('');
  lines.push(renderProvenance(envelope));
  // Zone 4.
  lines.push('');
  const total = (envelope && envelope.doctor && typeof envelope.doctor.totalViolations === 'number')
    ? envelope.doctor.totalViolations : 0;
  const mode = total > 0 ? 'ok' : 'clean';
  const z4 = renderZone4(envelope, mode);
  for (const l of z4) lines.push(l);
  lines.push('');
  return lines.join('\n');
}

// -- Render: status === 'tier-0-skip' -------------------------------
function renderTier0(envelope, slug) {
  const lines = [];
  lines.push(renderZone1(envelope, 'hmi-status', slug));
  lines.push('');
  lines.push('  ' + C.dim + G.HEADER + C.reset
    + ' Tier 0: Brain unreachable AND local graph unusable');
  lines.push('');
  lines.push(renderProvenance(envelope));
  lines.push('');
  const z4 = renderZone4(envelope, 'tier-0');
  for (const l of z4) lines.push(l);
  lines.push('');
  return lines.join('\n');
}

// -- Render: status === 'doctor-error' ------------------------------
function renderDoctorError(envelope, slug) {
  const lines = [];
  lines.push(renderZone1(envelope, 'hmi-status', slug));
  lines.push('');
  const errMsg = trunc((envelope && envelope.error) || 'unknown', 80);
  lines.push('  ' + C.red + G.HEADER + C.reset
    + ' Doctor error: ' + errMsg);
  lines.push('');
  lines.push(renderProvenance(envelope));
  lines.push('');
  const z4 = renderZone4(envelope, 'error');
  for (const l of z4) lines.push(l);
  lines.push('');
  return lines.join('\n');
}

// -- Render: side-channel missing ----------------------------------
function renderNoPoll(slug) {
  const room = trunc(slug || 'unknown', 80);
  const lines = [];
  lines.push(C.dim + '-- ' + room + ' -- hmi-status -- no-poll-yet --' + C.reset);
  lines.push('');
  lines.push('  ' + C.dim + G.HEADER + C.reset
    + ' No poll has fired yet for this room');
  lines.push('');
  const z4 = renderZone4(null, 'no-poll');
  for (const l of z4) lines.push(l);
  lines.push('');
  return lines.join('\n');
}

// -- Render: no active room registered ------------------------------
function renderNoActiveRoom() {
  const lines = [];
  lines.push(C.dim + '-- (no-room) -- hmi-status -- tier-0 --' + C.reset);
  lines.push('');
  lines.push('  ' + C.dim + G.HEADER + C.reset
    + ' No active room registered');
  lines.push('');
  const z4 = renderZone4(null, 'no-room');
  for (const l of z4) lines.push(l);
  lines.push('');
  return lines.join('\n');
}

// -- Argument parsing -----------------------------------------------
function parseArgs(argv) {
  const out = { json: false };
  for (const a of argv) {
    if (a === '--json') out.json = true;
    if (a === '--help' || a === '-h') out.help = true;
  }
  return out;
}

// -- Top-level render orchestrator ----------------------------------
// Pure function. Reads disk via injectable resolveActiveRoom + readSideChannel
// helpers. Tests call this directly without spawning a subprocess when they
// want to inspect output programmatically.
function render(opts) {
  const o = opts || {};
  const json = !!o.json;
  const room = (typeof o.resolveActiveRoom === 'function')
    ? o.resolveActiveRoom()
    : resolveActiveRoom();

  if (!room) {
    if (json) {
      const payload = {
        schema_version: 1,
        status: 'no-active-room',
        polled_at: null,
        operator: null,
        jtbd: null,
        tier: 0,
        mode: '0',
        doctor: { status: 'unknown', totalViolations: 0, counts: {} },
        operator_shape_mismatches: [],
        priorities: [],
        elapsed_ms: 0,
        _provenance: { phase: '105-02', source: 'hmi-status-command', notice: 'no active room' },
      };
      return { stdout: JSON.stringify(payload, null, 2) + '\n', exitCode: 0 };
    }
    return { stdout: renderNoActiveRoom() + '\n', exitCode: 0 };
  }

  const sc = (typeof o.readSideChannel === 'function')
    ? o.readSideChannel(room.abs_path)
    : readSideChannel(room.abs_path);

  if (!sc.envelope) {
    if (json) {
      const payload = {
        schema_version: 1,
        status: 'no-poll-yet',
        polled_at: null,
        operator: null,
        jtbd: null,
        tier: 0,
        mode: '0',
        doctor: { status: 'unknown', totalViolations: 0, counts: {} },
        operator_shape_mismatches: [],
        priorities: [],
        elapsed_ms: 0,
        _provenance: { phase: '105-02', source: 'hmi-status-command', notice: sc.error || 'missing' },
      };
      return { stdout: JSON.stringify(payload, null, 2) + '\n', exitCode: 0 };
    }
    return { stdout: renderNoPoll(room.slug) + '\n', exitCode: 0 };
  }

  if (json) {
    return { stdout: JSON.stringify(sc.envelope, null, 2) + '\n', exitCode: 0 };
  }

  const env = sc.envelope;
  const status = env.status;
  let body;
  if (status === 'ok') {
    body = renderShapeE(env, room.slug);
  } else if (status === 'tier-0-skip') {
    body = renderTier0(env, room.slug);
  } else if (status === 'doctor-error') {
    body = renderDoctorError(env, room.slug);
  } else if (status === 'no-active-room') {
    body = renderNoPoll(room.slug);
  } else {
    // Unknown status -- defensive: render as no-poll.
    body = renderNoPoll(room.slug);
  }
  return { stdout: body + '\n', exitCode: 0 };
}

// -- Main -----------------------------------------------------------
function main() {
  const flags = parseArgs(process.argv.slice(2));
  if (flags.help) {
    process.stdout.write('Usage: hmi-status-command.cjs [--json]\n');
    process.exit(0);
    return;
  }
  const result = render({ json: flags.json });
  process.stdout.write(result.stdout);
  process.exit(result.exitCode || 0);
}

// -- Module exports for tests ---------------------------------------
module.exports = {
  render: render,
  readSideChannel: readSideChannel,
  resolveActiveRoom: resolveActiveRoom,
  renderShapeE: renderShapeE,
  renderTier0: renderTier0,
  renderNoPoll: renderNoPoll,
  renderDoctorError: renderDoctorError,
  renderNoActiveRoom: renderNoActiveRoom,
  _internal: {
    renderZone1: renderZone1,
    renderZone2Status: renderZone2Status,
    renderZone2Priorities: renderZone2Priorities,
    renderZone2Mismatches: renderZone2Mismatches,
    renderZone4: renderZone4,
    renderProvenance: renderProvenance,
    formatPriorityRow: formatPriorityRow,
    formatMismatchRow: formatMismatchRow,
  },
};

// -- CLI entry guard ------------------------------------------------
if (require.main === module) {
  try {
    main();
  } catch (e) {
    process.stderr.write('[hmi-status] uncaught: '
      + trunc((e && e.message) || 'unknown', 200) + '\n');
    process.exit(0);
  }
}
