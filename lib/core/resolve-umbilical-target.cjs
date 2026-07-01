'use strict';
/*
 * lib/core/resolve-umbilical-target.cjs -- the ONE resolver for "which room
 * is the umbilical/health target from THIS working directory?" (Phase 139
 * Plan 01, S1 WHERE fix).
 *
 * Background: doctor.cjs used to guess its cwd-derived target from a bare
 * process.cwd() probe walking up for a .room-root sentinel. Run from
 * ~/dev/<repo> or ~/decks it found no room and either no-oped or scaffolded
 * spurious room artifacts into a plain code repo (the 2026-06-04 home-dir
 * reorg incident). The codebase has been bitten TWICE by N-independent
 * target guessers (lib/core/active-plugin-root.cjs collapsed 3 copies;
 * lib/core/resolve-active-room.cjs collapsed 4). Per the LOCKED single_resolver
 * decision this module is ONE module from day one; ALL doctor cwd-target
 * resolution routes through it. It MIRRORS lib/core/resolve-active-room.cjs
 * in shape (env-aware HOME default, null-on-miss, NEVER throws, CLI entry with
 * 0/1 exit codes, sealed/archived honoring).
 *
 * Precedence (first hit wins):
 *   1. `.umbilical` cord  -- bounded upward walk from cwd for a `.umbilical`
 *      marker file. EXPLICIT declaration only (never guessed). The marker's
 *      `room:` field (one or many; FIRST wins for target resolution) is
 *      resolved against the registry to an abs_path. If the marker exists but
 *      its room: does not resolve to a real registered room, FALL THROUGH --
 *      never fabricate a target. source === 'umbilical'.
 *   2. `.room-root` sentinel -- bounded upward walk from cwd for a `.room-root`
 *      sentinel directory. source === 'sentinel'.
 *   3. registry.active  -- <home>/.rooms/registry.json `active` (current) /
 *      `active_room` (legacy) field, Array|Object `rooms` shape, sealed/
 *      archived honored (null), final fs.existsSync gate. source === 'registry'.
 *   4. not-found -> null.
 *
 * Returns { slug, abs_path, source } on hit, null on miss. NEVER throws -- the
 * top-level try/catch returns null on any unexpected error (the graceful-
 * degradation pattern shipped throughout the spine scripts).
 *
 * IMPORTANT (FLAG-3 fix). The default for the home directory is
 *   process.env.MINDRIAN_ROOMS_HOME
 *     || path.join(process.env.HOME || process.env.USERPROFILE || os.homedir(), 'MindrianRooms')
 * -- NOT bare os.homedir(). On Linux/POSIX, os.homedir() reads /etc/passwd and
 * IGNORES process.env.HOME, which breaks hermetic tests that override HOME to
 * a scratch directory.
 *
 * Use as a module:
 *   const { resolveUmbilicalTarget } = require('<...>/lib/core/resolve-umbilical-target.cjs');
 *   const r = resolveUmbilicalTarget();   // r.slug, r.abs_path, r.source  OR  null
 *
 * Use as a CLI (so bash wrappers can shell out without a JSON parser):
 *   node lib/core/resolve-umbilical-target.cjs  -> prints JSON, exits 0 on hit, 1 on miss.
 *
 * Canon Part 8 (LOCAL-only, no egress): this reads LOCAL filesystem + env
 * ONLY. ZERO network surface -- no remote calls, no methodology-graph client,
 * no outbound requests of any kind. The structural source-grep tripwire in
 * tests/test-resolve-umbilical-target.cjs asserts this invariant on every CI
 * run by scanning this file for forbidden network/egress tokens (the same
 * forbidden-substring floor pattern as the Phase 90 5-tripwire sweep).
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

// Bounded upward walk: from `startDir`, climb at most `maxHops` parents
// looking for a marker. Mirrors findRoomRoot's symlink-safe bounded walk in
// scripts/doctor.cjs (max 12 hops; we use 8 per the cord-as-doctor-map design)
// but stops climbing at the filesystem root or at `home`. `predicate(dir)`
// returns a truthy value to stop the walk (that value is returned).
function walkUpFor(startDir, home, maxHops, predicate) {
  let dir = startDir;
  const visited = new Set();
  let hops = 0;
  while (dir && dir !== path.dirname(dir) && hops < maxHops) {
    let real;
    try { real = fs.realpathSync(dir); } catch (_e) { return null; }
    if (visited.has(real)) break;
    visited.add(real);
    const hit = predicate(real);
    if (hit) return hit;
    // Stop climbing above HOME: a room never lives above the rooms home, and
    // walking into / or /home would be a misfire surface.
    if (home && path.resolve(real) === path.resolve(home)) break;
    dir = path.dirname(real);
    hops += 1;
  }
  return null;
}

// Parse a `.umbilical` marker file. Fields (YAML-ish, line-oriented):
//   room: slug            (or `room: slug-a, slug-b` -- FIRST wins)
//   relation: code|deck|research|deploy|doc|data
//   born: <iso>
//   note: <free text>
// Returns the FIRST room slug declared, or null. Tolerant of missing/garbled
// content -- a marker we cannot parse yields null (fall through, never throw).
function parseUmbilicalRoom(markerPath) {
  let raw;
  try { raw = fs.readFileSync(markerPath, 'utf8'); } catch (_e) { return null; }
  const lines = String(raw).split(/\r?\n/);
  for (const line of lines) {
    const m = /^\s*room\s*:\s*(.+?)\s*$/.exec(line);
    if (!m) continue;
    // Value may be a single slug or a comma/space separated list; take the
    // FIRST for target resolution. Strip surrounding quotes/brackets.
    let val = m[1].replace(/^[\[\s'"]+|[\]\s'"]+$/g, '');
    const first = val.split(/[,\s]+/).filter(Boolean)[0];
    if (first) return first;
  }
  return null;
}

// ---------------------------------------------------------------------------
// parseUmbilicalInheritance(markerPath) -- the v2 `.umbilical` inheritance-map
// reader (Phase 195 FCM-03). SIBLING to parseUmbilicalRoom above: same
// line-oriented parse, CJS built-ins only (no YAML dependency).
//
// A v2 `.umbilical` marker extends the v1 shape with an `inherits:` block that
// declares, per memory kind, whether the child derives it FROM the parent
// (`parent`) or grows its OWN (`local`):
//
//   room: <parent-slug>
//   relation: subroom
//   born: <iso>
//   inherits:
//     USER: parent          # persona flows down (Part 8: generic persona enums only)
//     BRAIN: parent         # generic framework-handle anchors flow down (Part 8)
//     STATE: local          # child grows its own
//     MINTO: local
//     FEYNMAN: local
//
// Returns { USER, BRAIN, STATE, MINTO, FEYNMAN } each 'parent' | 'local'.
//
// SAFE DEFAULT: ALL kinds are 'local' when the `inherits:` block is absent. A
// v1 marker (no block) therefore parses to all-local -- byte-compatible, no
// migration, no silent propagation. A garbled/unparseable block degrades to
// all-local WITHOUT throwing (the same tolerant posture as parseUmbilicalRoom).
//
// Part 8 boundary note: only USER (generic persona enums) and BRAIN (generic
// framework handles) are ever ACTED ON downstream by the birth seeder;
// STATE/MINTO/FEYNMAN never carry user prose across the cord. The parser reads
// the declared map faithfully; the seeder enforces which kinds flow.
// ---------------------------------------------------------------------------
const INHERITANCE_KINDS = Object.freeze(['USER', 'BRAIN', 'STATE', 'MINTO', 'FEYNMAN']);

function allLocalInheritance() {
  return { USER: 'local', BRAIN: 'local', STATE: 'local', MINTO: 'local', FEYNMAN: 'local' };
}

function parseUmbilicalInheritance(markerPath) {
  const map = allLocalInheritance();
  let raw;
  try { raw = fs.readFileSync(markerPath, 'utf8'); } catch (_e) { return map; }
  const lines = String(raw).split(/\r?\n/);
  let inBlock = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!inBlock) {
      // The block opener is a bare `inherits:` line (no inline value). Anything
      // else (e.g. `inherits: garbage`) never opens the block -> all-local.
      if (/^\s*inherits\s*:\s*$/.test(line)) inBlock = true;
      continue;
    }
    // Inside the block. A non-indented non-empty line ends it. Blank lines are
    // tolerated (skipped). An indented `KEY: value` line declares one kind.
    if (line.trim().length === 0) continue;
    if (/^\S/.test(line)) break;
    const m = /^\s+([A-Za-z]+)\s*:\s*([A-Za-z]+)\s*$/.exec(line);
    if (!m) continue; // garbled line inside the block -> skip (stays local)
    const kind = m[1].toUpperCase();
    const val = m[2].toLowerCase();
    if (INHERITANCE_KINDS.indexOf(kind) === -1) continue;
    // Only the explicit 'parent' token flows down; any other value degrades to
    // 'local' (the safe default), so a typo never silently propagates.
    map[kind] = (val === 'parent') ? 'parent' : 'local';
  }
  return map;
}

// Read <home>/.rooms/registry.json and resolve a slug to an existing,
// non-sealed/non-archived room abs_path. Returns abs_path string or null.
// Mirrors the registry resolution logic in resolve-active-room.cjs (Array|
// Object rooms shape; sealed/archived honoring; abs_path -> path -> default
// composition; final fs.existsSync gate).
function resolveSlugAgainstRegistry(slug, home) {
  if (!slug) return null;
  const regPath = path.join(home, '.rooms', 'registry.json');
  if (!fs.existsSync(regPath)) return null;
  let reg;
  try { reg = JSON.parse(fs.readFileSync(regPath, 'utf8')); } catch (_e) { return null; }
  if (!reg) return null;

  let entry = null;
  if (Array.isArray(reg.rooms)) {
    entry = reg.rooms.find(function (r) {
      return r && (r.slug === slug || r.name === slug);
    }) || null;
  } else if (reg.rooms && typeof reg.rooms === 'object') {
    entry = reg.rooms[slug] || null;
  }
  if (!entry) return null;

  // Sealed/archived disposition: do not surface.
  if (entry.sealed === true) return null;
  if (entry.status === 'sealed' || entry.status === 'archived') return null;

  let abs_path;
  if (typeof entry.abs_path === 'string' && entry.abs_path.length > 0) {
    abs_path = entry.abs_path;
  } else if (typeof entry.path === 'string' && entry.path.length > 0) {
    abs_path = path.isAbsolute(entry.path) ? entry.path : path.join(home, entry.path);
  } else {
    abs_path = path.join(home, slug);
  }
  if (!fs.existsSync(abs_path)) return null;
  return abs_path;
}

/**
 * Resolve the umbilical/room target for the given cwd, following the
 * cord -> sentinel -> registry precedence. Returns
 *   { slug: string, abs_path: string, source: 'umbilical'|'sentinel'|'registry' }
 *   on hit, null on miss. NEVER throws.
 *
 * @param {{cwd?: string, home?: string}} [opts] test seams.
 * @returns {{slug: string, abs_path: string, source: string}|null}
 */
function resolveUmbilicalTarget(opts) {
  try {
    const o = opts || {};
    const cwd = o.cwd || process.cwd();
    const home = o.home || process.env.MINDRIAN_ROOMS_HOME
      || path.join(process.env.HOME || process.env.USERPROFILE || os.homedir(), 'MindrianRooms');

    // (1) `.umbilical` cord -- bounded upward walk. Explicit declaration only.
    const cordHit = walkUpFor(cwd, home, 8, function (dir) {
      const markerPath = path.join(dir, '.umbilical');
      if (!fs.existsSync(markerPath)) return null;
      const slug = parseUmbilicalRoom(markerPath);
      if (!slug) return null;
      const abs_path = resolveSlugAgainstRegistry(slug, home);
      // Marker present but room: does not resolve -> fall through (return null
      // here so walkUpFor keeps climbing / ultimately misses). NEVER fabricate.
      if (!abs_path) return null;
      return { slug: slug, abs_path: abs_path, source: 'umbilical' };
    });
    if (cordHit) return cordHit;

    // (2) `.room-root` sentinel -- bounded upward walk.
    const sentinelHit = walkUpFor(cwd, home, 8, function (dir) {
      if (fs.existsSync(path.join(dir, '.room-root'))) {
        return { slug: path.basename(dir), abs_path: dir, source: 'sentinel' };
      }
      return null;
    });
    if (sentinelHit) return sentinelHit;

    // (3) registry.active -- current `active` / legacy `active_room` field.
    const regPath = path.join(home, '.rooms', 'registry.json');
    if (!fs.existsSync(regPath)) return null;
    let reg;
    try { reg = JSON.parse(fs.readFileSync(regPath, 'utf8')); } catch (_e) { return null; }
    if (!reg) return null;
    const slug = (typeof reg.active === 'string' && reg.active.length > 0)
      ? reg.active
      : (typeof reg.active_room === 'string' && reg.active_room.length > 0)
      ? reg.active_room
      : null;
    if (!slug) return null;
    const abs_path = resolveSlugAgainstRegistry(slug, home);
    if (!abs_path) return null;
    return { slug: slug, abs_path: abs_path, source: 'registry' };
  } catch (_e) {
    // Defense-in-depth: NEVER throw. Callers treat null as "no target;
    // silently skip" -- a throw here would break that.
    return null;
  }
}

module.exports = { resolveUmbilicalTarget, parseUmbilicalInheritance };

// CLI entry. Bash wrappers can shell out via:
//   node lib/core/resolve-umbilical-target.cjs
// stdout receives a JSON line (the resolved object, or the literal "null").
// Exit code: 0 on hit, 1 on miss.
if (require.main === module) {
  const r = resolveUmbilicalTarget();
  process.stdout.write(JSON.stringify(r) + '\n');
  process.exit(r ? 0 : 1);
}
