#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 103-04 -- /mos:memory command dispatcher + 6 renderers.
 * =============================================================
 *
 * Subcommands per CONTEXT D-10:
 *   /mos:memory                  -> overview (Shape E)
 *   /mos:memory query <jtbd>     -> per-JTBD across-room (Shape G; E fallback if Phase 101 absent)
 *   /mos:memory cross-room       -> full cross-room landscape (Shape G Mode A / E Mode B)
 *   /mos:memory resume           -> in_flight picker (Shape F.1, F.6 when Phase 101 ships)
 *   /mos:memory park <jtbd>      -> manual park (Shape E)
 *   /mos:memory complete <jtbd>  -> manual complete override (Shape E)
 *   /mos:memory --opt-out        -> write ~/MindrianRooms/.memory/.opt-out sentinel (Shape E)
 *
 * UI Ruling System compliance (skills/ui-system/SKILL.md):
 *   - 4-zone anatomy (Zone 1 header / Zone 2 body / Zone 3 signals / Zone 4 footer)
 *   - 12-glyph vocabulary only: filled-square / down-triangle /
 *     right-triangle-filled / right-triangle-empty / branch / last-branch /
 *     check / bullet / warning / lightning / empty-square / arrow
 *   - 5-color contract: green=success, cyan=info, yellow=warning, red=error,
 *     gray=meta. No magenta. No blue.
 *
 * Honors:
 *   - D-16 global opt-out (~/MindrianRooms/.memory/.opt-out)
 *   - D-17 per-room opt-out (<roomDir>/.mindrian/.memory-opt-out)
 *   - RESEARCH §8 Pitfall 8 Cowork warning (presence of <roomDir>/00_Context/)
 *
 * Phase 101 graceful fallback:
 *   - Shape G renderer (lib/hmi/shape-g-renderer.cjs) is OPTIONAL. When
 *     absent, /mos:memory query renders Shape E with an explicit
 *     "Shape G renders after Phase 101 ships" note.
 *   - Shape F.6 renderer (lib/hmi/shape-f6-renderer.cjs) is OPTIONAL.
 *     When absent, /mos:memory resume renders an F.1 numbered list.
 *
 * Canon Part 8 (LOCAL ONLY at this layer):
 *   - Reads / writes ~/MindrianRooms/.memory/jtbd-history.json via
 *     lib/hmi/across-session-memory.cjs (Phase 103-02).
 *   - Cross-room subcommand delegates to lib/hmi/cross-room-memory.cjs
 *     (Phase 103-03), which honors the buildBrainQueryContext chokepoint
 *     for any Brain query (generic handles only; never user content).
 *
 * Phase 87 invariant: Node built-ins + relative requires only. Zero new
 * runtime dependencies.
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const PLUGIN_ROOT = path.resolve(__dirname, '..');

// Phase 103 Wave 1 (data layer) modules.
const acrossSession = require('../lib/hmi/across-session-memory.cjs');
const crossRoom     = require('../lib/hmi/cross-room-memory.cjs');
// Phase 128.1-03b: the canonical session-scoped active-room resolver. The
// getActiveRoom() inline `reg.active` read was a Bucket B-reader of the racing
// global string; it now routes through resolveActiveRoom (D-03).
const sessionBinding = require('../lib/core/session-binding.cjs');

// ----------------------------------------------------------------------
// 12-glyph vocabulary (skills/ui-system/SKILL.md section 3).
// One meaning each. No overloading.
// ----------------------------------------------------------------------
const G = {
  filledSquare:    '■', // ■  progress fill / section block
  downTriangle:    '▼', // ▼  expanded node (reserved)
  rightTriFilled:  '▶', // ▶  primary action / RECOMMENDED
  rightTriEmpty:   '▷', // ▷  alternative action
  branch:          '├─', // ├─ not-last sibling
  lastBranch:      '└─', // └─ last sibling
  check:           '✓', // ✓  complete
  bullet:          '•', // •  draft / partial
  warning:         '⚠', // ⚠  contradiction / warning
  lightning:       '⚡', // ⚡ convergence (reserved)
  emptySquare:     '⬜', // ⬜ gap / null
  arrow:           '→', // →  inline suggestion
};

// ----------------------------------------------------------------------
// 5-color contract (skills/ui-system/SKILL.md section 4).
// CSI escape sequences -- emitted directly to stdout.
// ----------------------------------------------------------------------
const C = {
  reset:  '\x1b[0m',
  green:  '\x1b[32m',
  cyan:   '\x1b[36m',
  yellow: '\x1b[33m',
  red:    '\x1b[31m',
  dim:    '\x1b[90m',
};

// ----------------------------------------------------------------------
// Path helpers.
// ----------------------------------------------------------------------
function ROOMS_HOME() {
  return process.env.MINDRIAN_ROOMS_HOME || path.join(os.homedir(), 'MindrianRooms');
}

function readRegistry() {
  const p = path.join(ROOMS_HOME(), '.rooms', 'registry.json');
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (_) {
    return null;
  }
}

// Resolve the active-room slug for THIS session.
// Phase 128.1-03b (D-03): the racing global `active` string is no longer read
// inline. resolveActiveRoom does the session-keyed lookup plus the
// last_active/active fallback internally so concurrent sessions resolve their
// own room. The `active_room` key (a non-existent registry key per the
// 128.1-01 CALLER-INVENTORY "active_room shape note") is dropped: it always
// returned null and is not the racing field.
function getActiveRoom() {
  try {
    const sid = sessionBinding.resolveSessionId();
    const { room /* path, tripwire -- Plan 05 owns tripwire */ } =
      sessionBinding.resolveActiveRoom(sid);
    return (typeof room === 'string' && room.length > 0) ? room : null;
  } catch (_) {
    return null;
  }
}

function getActiveRoomDir(slug) {
  if (!slug) return null;
  const home = ROOMS_HOME();
  const reg = readRegistry();
  if (!reg) return null;
  // Object form
  if (reg.rooms && !Array.isArray(reg.rooms) && reg.rooms[slug]) {
    const e = reg.rooms[slug];
    const rel = (typeof e.path === 'string' && e.path.length) ? e.path : slug;
    return path.isAbsolute(rel) ? rel : path.join(home, rel);
  }
  // Array form
  if (Array.isArray(reg.rooms)) {
    const e = reg.rooms.find(function (x) { return x && x.slug === slug; });
    if (!e) return null;
    if (typeof e.abs_path === 'string' && e.abs_path.length) return e.abs_path;
    const rel = (typeof e.path === 'string' && e.path.length) ? e.path : slug;
    return path.isAbsolute(rel) ? rel : path.join(home, rel);
  }
  return null;
}

// ----------------------------------------------------------------------
// Phase 101 lazy loaders -- silent graceful fallback.
// ----------------------------------------------------------------------
let _shapeG  = null; // null=untried, false=absent, function=loaded
let _shapeF6 = null;

function tryLoadShapeG() {
  if (_shapeG !== null) return _shapeG;
  try {
    const mod = require('../lib/hmi/shape-g-renderer.cjs');
    _shapeG = (mod && typeof mod.render === 'function') ? mod : false;
  } catch (_) { _shapeG = false; }
  return _shapeG;
}

function tryLoadShapeF6() {
  if (_shapeF6 !== null) return _shapeF6;
  try {
    const mod = require('../lib/hmi/shape-f6-renderer.cjs');
    _shapeF6 = (mod && typeof mod.render === 'function') ? mod : false;
  } catch (_) { _shapeF6 = false; }
  return _shapeF6;
}

// ----------------------------------------------------------------------
// Zone helpers.
// ----------------------------------------------------------------------
function zone1(room, subcommand) {
  // Plain literal "-- {room} -- memory -- {sub} --" (UI Ruling §1).
  return C.dim + '-- ' + room + ' -- memory -- ' + subcommand + ' --' + C.reset;
}

function zone4(steps) {
  // steps = [{ glyph, text, note? }]
  // Each emits a single line: "  {glyph} {text}            # {note}"
  const lines = [];
  for (const s of steps) {
    let line = '  ' + (s.primary ? C.cyan : C.dim) + s.glyph + C.reset
      + ' ' + (s.primary ? C.cyan : C.cyan) + s.text + C.reset;
    if (s.note) line += '  ' + C.dim + '# ' + s.note + C.reset;
    lines.push(line);
  }
  return lines.join('\n');
}

function emitZones(z1, z2, z3, z4) {
  const out = [];
  out.push(z1);
  out.push('');
  if (z2 && String(z2).trim().length) {
    out.push(z2);
    out.push('');
  }
  if (z3 && String(z3).trim().length) {
    out.push(z3);
    out.push('');
  }
  if (z4 && String(z4).trim().length) {
    out.push(z4);
  }
  return out.join('\n');
}

// ----------------------------------------------------------------------
// Opt-out + Cowork detection -> Zone 3 lines.
// Returns the joined Zone 3 string (possibly empty).
// ----------------------------------------------------------------------
function gateZone3(roomSlug) {
  const lines = [];
  if (acrossSession.isGlobalOptOut()) {
    lines.push('  ' + C.yellow + G.warning + C.reset
      + ' Across-session memory disabled (opt-out sentinel present).');
  }
  if (roomSlug && acrossSession.isRoomOptOut(roomSlug)) {
    lines.push('  ' + C.yellow + G.warning + C.reset
      + ' Room ' + roomSlug + ' opted out of across-session memory.');
  }
  const dir = roomSlug ? getActiveRoomDir(roomSlug) : null;
  try {
    if (dir && fs.existsSync(path.join(dir, '00_Context'))) {
      lines.push('  ' + C.yellow + G.warning + C.reset
        + ' Cowork detected (00_Context/ present). Memory layer is per-USER, not team-shared. '
        + 'Use STATE.md for team continuity.');
    }
  } catch (_) { /* fs error -> skip warning */ }
  return lines.join('\n');
}

// ----------------------------------------------------------------------
// Renderer: overview (no args) -- Shape E.
// ----------------------------------------------------------------------
function renderOverview(room) {
  const z1 = zone1(room, 'overview');

  // Pull within-session JTBD via Phase 100 module (graceful if absent).
  let currentJtbd = null;
  try {
    const dir = getActiveRoomDir(room);
    if (dir) {
      const jtbdState = require('../lib/hmi/jtbd-state.cjs');
      const cur = jtbdState.getCurrent(dir);
      if (cur && cur.jtbd) currentJtbd = cur.jtbd;
    }
  } catch (_) { /* module absent or read error -- show "(none)" */ }

  const mem = acrossSession.getRoomMemory(room);
  const inflight  = (mem.in_flight || []).length;
  const parked    = (mem.parked || []).length;
  const completed = (mem.completed || []).length;

  const z2Lines = [];
  z2Lines.push('  ' + C.dim + 'Within-session: ' + C.reset
    + (currentJtbd ? C.cyan + currentJtbd + C.reset : C.dim + '(none)' + C.reset));
  z2Lines.push('');
  z2Lines.push('  ' + G.bullet + ' in_flight  : ' + (inflight  ? C.green + inflight  + C.reset : C.dim + '0' + C.reset));
  z2Lines.push('  ' + G.bullet + ' parked     : ' + (parked    ? C.yellow + parked   + C.reset : C.dim + '0' + C.reset));
  z2Lines.push('  ' + G.bullet + ' completed  : ' + (completed ? C.cyan + completed + C.reset : C.dim + '0' + C.reset));
  const z2 = z2Lines.join('\n');

  const z3 = gateZone3(room);

  const z4 = zone4([
    { glyph: G.rightTriEmpty, text: '/mos:memory cross-room', note: 'full cross-room landscape' },
    { glyph: G.rightTriEmpty, text: '/mos:memory resume',     note: 'in_flight JTBD picker' },
    { glyph: G.rightTriEmpty, text: '/mos:memory query <jtbd>', note: 'per-JTBD across-room view' },
  ]);

  return emitZones(z1, z2, z3, z4);
}

// ----------------------------------------------------------------------
// Renderer: query <jtbd> -- Shape G (Comparison Matrix) or Shape E fallback.
// ----------------------------------------------------------------------
function renderQuery(room, jtbd) {
  const z1 = zone1(room, 'query');

  if (!jtbd) {
    return emitZones(z1,
      '  ' + C.red + G.warning + C.reset + ' query requires a <jtbd> argument',
      gateZone3(room),
      zone4([
        { glyph: G.rightTriEmpty, text: '/mos:memory', note: 'overview' },
        { glyph: G.rightTriEmpty, text: '/mos:jtbd list', note: '13 known JTBDs' },
      ]));
  }

  const local = acrossSession.getJtbdAcrossRooms(jtbd);
  const slugs = Object.keys(local.by_room || {});
  const shapeG = tryLoadShapeG();

  if (shapeG && shapeG !== false) {
    // Phase 101 Shape G ships a render(payload) that returns a multi-line
    // string. The 103-04 plan does not pin the payload schema; we provide
    // a defensive payload and trust the renderer to handle it.
    try {
      const rows = slugs.map(function (slug) {
        const e = local.by_room[slug];
        return {
          option: slug,
          values: {
            in_flight: (e.in_flight && e.in_flight.last_seen) ? e.in_flight.last_seen.slice(0, 10) : '--',
            parked:    (e.parked && e.parked[0] && (e.parked[0].last_seen || e.parked[0].parked_at))
                       ? (e.parked[0].last_seen || e.parked[0].parked_at).slice(0, 10) : '--',
            completed: (e.completed && e.completed[0] && e.completed[0].completed_at)
                       ? e.completed[0].completed_at.slice(0, 10) : '--',
          },
        };
      });
      const matrix = shapeG.render({
        title: jtbd,
        criteria: ['in_flight', 'parked', 'completed'],
        rows: rows,
      });
      return emitZones(z1, matrix, gateZone3(room), zone4([
        { glyph: G.rightTriEmpty, text: '/mos:memory cross-room', note: 'full landscape' },
        { glyph: G.rightTriEmpty, text: '/mos:memory resume',     note: 'pick one to resume' },
      ]));
    } catch (_) {
      // Renderer threw -- degrade silently to Shape E fallback below.
    }
  }

  // Shape E fallback (Phase 101 not yet shipped, or renderer threw).
  const lines = [];
  lines.push('  ' + G.filledSquare + ' JTBD: ' + C.cyan + jtbd + C.reset);
  lines.push('');
  if (slugs.length === 0) {
    lines.push('  ' + C.dim + '(no rooms have any record of this JTBD)' + C.reset);
  } else {
    for (let i = 0; i < slugs.length; i++) {
      const slug = slugs[i];
      const e = local.by_room[slug];
      const states = [];
      if (e.in_flight) states.push('in_flight @ ' + e.in_flight.last_seen.slice(0, 10));
      if (e.parked && e.parked.length)       states.push('parked (' + e.parked.length + ')');
      if (e.completed && e.completed.length) states.push('completed (' + e.completed.length + ')');
      const isLast = i === slugs.length - 1;
      const branch = isLast ? G.lastBranch : G.branch;
      lines.push('     ' + C.dim + branch + C.reset + ' '
        + C.cyan + slug + C.reset + ': ' + (states.join(', ') || C.dim + '(empty)' + C.reset));
    }
  }
  lines.push('');
  lines.push('  ' + C.yellow + G.warning + C.reset
    + ' Shape G renders after Phase 101 ships (Shape E fallback active).');

  return emitZones(z1, lines.join('\n'), gateZone3(room), zone4([
    { glyph: G.rightTriEmpty, text: '/mos:memory cross-room', note: 'full landscape' },
    { glyph: G.rightTriEmpty, text: '/mos:memory resume',     note: 'pick one to resume' },
  ]));
}

// ----------------------------------------------------------------------
// Renderer: cross-room -- Shape G Mode A or Shape E Mode B.
// ----------------------------------------------------------------------
async function renderCrossRoom(room) {
  const z1 = zone1(room, 'cross-room');
  let result;
  try {
    result = await crossRoom.aggregateAcrossRooms({});
  } catch (err) {
    return emitZones(z1,
      '  ' + C.red + G.warning + C.reset + ' aggregateAcrossRooms threw: '
        + String(err && err.message ? err.message : err).slice(0, 120),
      gateZone3(room),
      zone4([{ glyph: G.rightTriEmpty, text: '/mos:memory', note: 'overview' }]));
  }

  const lines = [];
  const jtbds = Object.keys(result.by_jtbd || {});
  if (jtbds.length === 0) {
    lines.push('  ' + C.dim + '(no JTBDs in flight or completed across rooms)' + C.reset);
  } else {
    for (const jtbd of jtbds) {
      lines.push('  ' + G.filledSquare + ' ' + C.cyan + jtbd + C.reset);
      const rooms = (result.by_jtbd[jtbd] && result.by_jtbd[jtbd].rooms) || [];
      for (let i = 0; i < rooms.length; i++) {
        const r = rooms[i];
        const isLast = i === rooms.length - 1;
        const branch = isLast ? G.lastBranch : G.branch;
        const last_seen = r.last_seen ? r.last_seen.slice(0, 10) : 'unknown';
        const stateColor = r.state === 'in_flight' ? C.green
          : (r.state === 'parked' ? C.yellow : C.dim);
        lines.push('     ' + C.dim + branch + C.reset + ' '
          + r.slug + ' (' + stateColor + r.state + C.reset + ', ' + C.dim + last_seen + C.reset + ')');
      }
    }
  }

  // Mode A enrichment block (Brain pattern hints).
  if (result.brain_pattern_hints && Object.keys(result.brain_pattern_hints).length) {
    lines.push('');
    lines.push('  ' + G.filledSquare + ' Patterns:');
    for (const jtbd of Object.keys(result.brain_pattern_hints)) {
      const hints = result.brain_pattern_hints[jtbd];
      if (!Array.isArray(hints)) continue;
      for (const p of hints) {
        let verb = '';
        if (p.precedes)  verb = jtbd + ' ' + G.arrow + ' ' + p.precedes;
        else if (p.follows)   verb = p.follows + ' ' + G.arrow + ' ' + jtbd;
        else if (p.co_occurs) verb = jtbd + ' ≈ ' + p.co_occurs;
        else continue;
        const conf = (typeof p.confidence === 'number') ? p.confidence.toFixed(2) : '?';
        lines.push('     ' + G.bullet + ' ' + verb + ' ' + C.dim + '(conf ' + conf + ')' + C.reset);
      }
    }
  }

  // Zone 3 -- gate warnings + Mode B Brain-unreachable line.
  const baseZ3 = gateZone3(room);
  let z3 = baseZ3;
  if (result.mode === 'B') {
    const brainLine = '  ' + C.yellow + G.warning + C.reset
      + ' Brain unreachable; cross-room view local-only.';
    z3 = baseZ3 ? baseZ3 + '\n' + brainLine : brainLine;
  }

  return emitZones(z1, lines.join('\n'), z3, zone4([
    { glyph: G.rightTriEmpty, text: '/mos:memory resume',       note: 'in_flight picker' },
    { glyph: G.rightTriEmpty, text: '/mos:memory query <jtbd>', note: 'per-JTBD view' },
  ]));
}

// ----------------------------------------------------------------------
// Renderer: resume -- Shape F.6 (when shipped) or Shape F.1 fallback.
// ----------------------------------------------------------------------
function renderResume(room) {
  const z1 = zone1(room, 'resume');
  const candidates = acrossSession.listInFlight(7);

  if (!candidates || candidates.length === 0) {
    return emitZones(z1,
      '  ' + C.dim + '(no in_flight JTBDs in last 7 days)' + C.reset,
      gateZone3(room),
      zone4([
        { glyph: G.rightTriEmpty, text: '/mos:memory', note: 'overview' },
        { glyph: G.rightTriEmpty, text: '/mos:jtbd list', note: '13 known JTBDs' },
      ]));
  }

  const shapeF6 = tryLoadShapeF6();
  if (shapeF6 && shapeF6 !== false) {
    try {
      const picker = shapeF6.render({
        title: 'Resume an in_flight JTBD',
        options: candidates.map(function (c) {
          return { id: c.jtbd, label: c.jtbd + ' (' + c.room + ', ' + c.last_seen.slice(0, 10) + ')' };
        }),
      });
      return emitZones(z1, picker, gateZone3(room), '');
    } catch (_) { /* renderer threw -- fall through to F.1 fallback */ }
  }

  // F.1 fallback (numbered list rendered as STRUCTURAL marker block).
  const lines = [];
  lines.push('  ' + G.filledSquare + ' Resume an in_flight JTBD');
  lines.push('     ' + C.dim + 'in_flight in last 7 days, sorted by recency:' + C.reset);
  lines.push('');
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    const idx = '[' + (i + 1) + ']';
    lines.push('  ' + C.cyan + idx + C.reset + ' '
      + C.cyan + c.jtbd + C.reset
      + '  ' + C.dim + '(' + c.room + ', ' + c.last_seen.slice(0, 10) + ')' + C.reset);
  }
  lines.push('');
  lines.push('  ' + C.dim + '(F.1 fallback: select a number above; Phase 101 ships F.6 when JTBD-aware)'
    + C.reset);

  return emitZones(z1, lines.join('\n'), gateZone3(room), zone4([
    { glyph: G.rightTriEmpty, text: '/mos:memory', note: 'cancel and re-show overview' },
  ]));
}

// ----------------------------------------------------------------------
// Renderer: park <jtbd> -- Shape E confirmation.
// ----------------------------------------------------------------------
function renderPark(room, jtbd) {
  const z1 = zone1(room, 'park');

  if (!jtbd) {
    return emitZones(z1,
      '  ' + C.red + G.warning + C.reset + ' park requires a <jtbd> argument',
      gateZone3(room),
      zone4([{ glyph: G.rightTriEmpty, text: '/mos:memory', note: 'overview' }]));
  }

  if (acrossSession.isGlobalOptOut() || acrossSession.isRoomOptOut(room)) {
    return emitZones(z1,
      '  ' + C.dim + '(opt-out engaged; no park performed)' + C.reset,
      gateZone3(room),
      zone4([{ glyph: G.rightTriEmpty, text: '/mos:memory', note: 'overview' }]));
  }

  const result = acrossSession.parkJtbd(room, jtbd, 'manual_park_via_command');

  const z2Lines = [];
  if (result && result.action === 'parked') {
    z2Lines.push('  ' + C.green + G.check + C.reset + ' '
      + C.cyan + jtbd + C.reset + ': '
      + C.green + 'in_flight' + C.reset + ' ' + G.arrow + ' '
      + C.yellow + 'parked' + C.reset);
    z2Lines.push('     ' + C.dim + 'reason  manual_park_via_command' + C.reset);
  } else {
    z2Lines.push('  ' + C.yellow + G.warning + C.reset
      + ' park returned null (nothing to park, or write rejected).');
  }

  return emitZones(z1, z2Lines.join('\n'), gateZone3(room), zone4([
    { glyph: G.rightTriEmpty, text: '/mos:memory',                note: 'overview' },
    { glyph: G.rightTriEmpty, text: '/mos:memory query ' + jtbd,  note: 'view across rooms' },
  ]));
}

// ----------------------------------------------------------------------
// Renderer: complete <jtbd> -- Shape E confirmation.
// ----------------------------------------------------------------------
function renderComplete(room, jtbd) {
  const z1 = zone1(room, 'complete');

  if (!jtbd) {
    return emitZones(z1,
      '  ' + C.red + G.warning + C.reset + ' complete requires a <jtbd> argument',
      gateZone3(room),
      zone4([{ glyph: G.rightTriEmpty, text: '/mos:memory', note: 'overview' }]));
  }

  if (acrossSession.isGlobalOptOut() || acrossSession.isRoomOptOut(room)) {
    return emitZones(z1,
      '  ' + C.dim + '(opt-out engaged; no complete performed)' + C.reset,
      gateZone3(room),
      zone4([{ glyph: G.rightTriEmpty, text: '/mos:memory', note: 'overview' }]));
  }

  const result = acrossSession.completeJtbd(room, jtbd, 'manual_override', 'mos-memory-complete');

  const z2Lines = [];
  if (result && result.action === 'completed') {
    z2Lines.push('  ' + C.green + G.check + C.reset + ' '
      + C.cyan + jtbd + C.reset + ': '
      + C.green + 'in_flight' + C.reset + ' ' + G.arrow + ' '
      + C.cyan + 'completed' + C.reset + ' '
      + C.dim + '(manual override)' + C.reset);
    z2Lines.push('     ' + C.dim + 'completion_shape  manual_override' + C.reset);
  } else {
    z2Lines.push('  ' + C.yellow + G.warning + C.reset
      + ' complete returned null (nothing to complete, or write rejected).');
  }

  return emitZones(z1, z2Lines.join('\n'), gateZone3(room), zone4([
    { glyph: G.rightTriEmpty, text: '/mos:memory',               note: 'overview' },
    { glyph: G.rightTriEmpty, text: '/mos:memory query ' + jtbd, note: 'view across rooms' },
  ]));
}

// ----------------------------------------------------------------------
// Renderer: --opt-out -- writes the global sentinel.
// ----------------------------------------------------------------------
function renderOptOut() {
  const home = ROOMS_HOME();
  const dir = path.join(home, '.memory');
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, '.opt-out'), '');
  } catch (err) {
    return emitZones(
      C.dim + '-- (global) -- memory -- opt-out --' + C.reset,
      '  ' + C.red + G.warning + C.reset + ' could not write opt-out sentinel: '
        + String(err && err.message ? err.message : err).slice(0, 120),
      '',
      zone4([{ glyph: G.rightTriEmpty, text: '/mos:memory', note: 'overview' }]));
  }
  const z1 = C.dim + '-- (global) -- memory -- opt-out --' + C.reset;
  const z2 = '  ' + C.green + G.check + C.reset + ' Across-session memory disabled.';
  const z3 = '  ' + C.yellow + G.warning + C.reset
    + ' Re-enable by removing ' + path.join(home, '.memory', '.opt-out') + '.';
  return emitZones(z1, z2, z3, zone4([
    { glyph: G.rightTriEmpty, text: '/mos:memory', note: 'overview (read-only after opt-out)' },
  ]));
}

// ----------------------------------------------------------------------
// Dispatch entry.
// ----------------------------------------------------------------------
async function dispatch(args, env) {
  args = Array.isArray(args) ? args : [];
  env  = env || {};

  // --opt-out short-circuits room resolution (it is global).
  if (args[0] === '--opt-out') {
    process.stdout.write(renderOptOut() + '\n');
    return;
  }

  const room = (env && typeof env.activeRoom === 'string' && env.activeRoom) || getActiveRoom();
  if (!room) {
    const z1 = C.dim + '-- (no-room) -- memory -- error --' + C.reset;
    const z2 = '  ' + C.red + G.warning + C.reset + ' No active room.';
    const z3 = '  ' + C.dim + 'Set one with /mos:room or run inside a room directory.' + C.reset;
    const z4 = zone4([{ glyph: G.rightTriEmpty, text: '/mos:room', note: 'list rooms' }]);
    process.stdout.write(emitZones(z1, z2, z3, z4) + '\n');
    return;
  }

  const sub = args[0] || 'overview';
  let out;
  switch (sub) {
    case 'overview':
    case undefined:
      out = renderOverview(room); break;
    case 'query':
      out = renderQuery(room, args[1] || ''); break;
    case 'cross-room':
      out = await renderCrossRoom(room); break;
    case 'resume':
      out = renderResume(room); break;
    case 'park':
      out = renderPark(room, args[1] || ''); break;
    case 'complete':
      out = renderComplete(room, args[1] || ''); break;
    default:
      // Unknown subcommand -- defensive: render overview rather than throw.
      out = renderOverview(room);
  }
  process.stdout.write(out + '\n');
}

module.exports = {
  dispatch: dispatch,
  // Internal helpers exposed for hermetic tests + future Phase 103-05 hook reuse.
  _internal: {
    getActiveRoom: getActiveRoom,
    getActiveRoomDir: getActiveRoomDir,
    gateZone3: gateZone3,
    tryLoadShapeG: tryLoadShapeG,
    tryLoadShapeF6: tryLoadShapeF6,
    G: G,
    C: C,
  },
};

// CLI entry.
if (require.main === module) {
  const argv = process.argv.slice(2);
  Promise.resolve(dispatch(argv, {})).catch(function (err) {
    process.stderr.write('[memory-command] error: '
      + String(err && err.message ? err.message : err).slice(0, 200) + '\n');
    process.exit(1);
  });
}
