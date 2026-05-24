'use strict';
/*
 * lib/core/resolve-active-room.cjs -- the ONE resolver for "which room is
 * active on this machine?" (Phase 127.3 Plan 00).
 *
 * Background: before this module, FOUR different places guessed independently
 * (jtbd-update.cjs:65-79 hardcoded the legacy active_room+Array shape;
 * intent-classifier.cjs:680-706 read the current active+Object shape correctly;
 * memory-command.cjs:108-139 tolerated both; check-onboard-statusline.cjs and
 * hmi-compliance-poll.cjs and jtbd-command.cjs and operator-command.cjs each
 * carried independent copies). FOUR guessers, four failure modes -- the JTBD
 * memory layer was silently dead in every release since v1.11.x because one
 * of those guessers always returned null. This collapses them into one source
 * of truth. Mirrors lib/core/resolve-brain-key.cjs (the resolver this one is
 * patterned on; the Canon Part 7 precedent from Phase 123 Plan-07).
 *
 * Precedence (first hit wins):
 *   1. CLAUDE_ACTIVE_ROOM env var       -- explicit test/operator override.
 *   2. MINDRIAN_ROOMS_HOME/.rooms/registry.json `active` field (current shape).
 *   3. MINDRIAN_ROOMS_HOME/.rooms/registry.json `active_room` field (legacy
 *      shape, still tolerated for backward compat).
 *   4. not-found.
 *
 * Returns { slug, abs_path } on hit, null on miss. NEVER throws -- callers
 * depend on null-on-failure semantics (the graceful-degradation pattern
 * shipped throughout the spine scripts).
 *
 * IMPORTANT (FLAG-3 fix). The default for the home directory is
 *   process.env.HOME || process.env.USERPROFILE || os.homedir()
 * -- NOT bare os.homedir(). On Linux/POSIX, os.homedir() reads /etc/passwd and
 * IGNORES process.env.HOME, which breaks hermetic tests that override HOME to
 * a scratch directory. The env-aware default matches the precedent in
 * scripts/doctor.cjs, scripts/session-start, lib/core/active-plugin-root.cjs,
 * and lib/core/resolve-brain-key.cjs.
 *
 * Sealed/archived disposition: entry.sealed === true OR entry.status ===
 * 'sealed' OR entry.status === 'archived' returns null. The resolver does NOT
 * surface non-active rooms even if they are the registry's nominal active
 * slug -- the registry's job is to mark them, this resolver's job is to
 * honor the mark.
 *
 * abs_path resolution: prefer entry.abs_path if set, else entry.path
 * (resolved relative against home), else compose <home>/<slug>. Final gate:
 * fs.existsSync(abs_path) -- if the directory does not exist on disk, return
 * null (a registry pointing at a deleted directory is a stale registry).
 *
 * Use as a module:
 *   const { resolveActiveRoom } = require('<...>/lib/core/resolve-active-room.cjs');
 *   const r = resolveActiveRoom();      // r.slug, r.abs_path   OR   null
 *
 * Use as a CLI (so bash wrappers can shell out without a JSON parser):
 *   node lib/core/resolve-active-room.cjs    -> prints JSON, exits 0 on hit, 1 on miss.
 *
 * The exit-code distinction is intentional. resolve-brain-key.cjs exits 0
 * always (its result has more nuanced fields like reason+source); this
 * resolver's null-or-object shape maps cleanly to exit-code semantics.
 *
 * Canon Part 8: this reads LOCAL files and env only. Zero network surface.
 * The structural source-grep tripwire in tests/test-resolve-active-room-canonical.cjs
 * (rar.11) asserts this invariant on every CI run.
 *
 * Canon Part 9: this is a READ-only registry resolver. It does NOT open the
 * per-room SQLite graph (that is the navigation chokepoint's domain).
 * Calling-side code that needs a graph read must go through the navigation
 * chokepoint AFTER resolving the room dir here. The structural source-grep
 * tripwire in tests/test-resolve-active-room-canonical.cjs (rar.12) asserts
 * this invariant on every CI run by scanning this file for the forbidden
 * SQLite-driver and graph-chokepoint tokens.
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

/**
 * Resolve the active room from the precedence chain. Returns
 *   { slug: string, abs_path: string }   on hit
 *   null                                  on miss
 * NEVER throws -- the top-level try/catch returns null on any unexpected
 * error. Callers across the spine (jtbd-update, intent-classifier,
 * memory-command, jtbd-command, operator-command, hmi-compliance-poll,
 * check-onboard-statusline) all expect this null-on-failure shape.
 *
 * The `home` opt is a test seam; default is the env-aware form (FLAG-3
 * landmine; bare os.homedir() reads /etc/passwd on Linux and ignores
 * process.env.HOME, breaking hermetic mkdtempSync-based fixtures).
 *
 * @param {{home?: string}} [opts]
 * @returns {{slug: string, abs_path: string}|null}
 */
function resolveActiveRoom(opts) {
  try {
    const o = opts || {};
    const home = o.home || process.env.MINDRIAN_ROOMS_HOME
      || path.join(process.env.HOME || process.env.USERPROFILE || os.homedir(), 'MindrianRooms');

    // (1) CLAUDE_ACTIVE_ROOM env override beats registry. The env value is
    // expected to be an absolute directory path; slug is derived from
    // basename. Operators and hermetic tests rely on this seam.
    if (process.env.CLAUDE_ACTIVE_ROOM) {
      const v = String(process.env.CLAUDE_ACTIVE_ROOM).trim();
      if (v.length > 0 && fs.existsSync(v)) {
        return { slug: path.basename(v), abs_path: v };
      }
    }

    // (2) + (3) Registry.json -- support both legacy (active_room) and
    // current (active) field names for the active slug.
    const regPath = path.join(home, '.rooms', 'registry.json');
    if (!fs.existsSync(regPath)) return null;
    let reg;
    try {
      reg = JSON.parse(fs.readFileSync(regPath, 'utf8'));
    } catch (_e) {
      // Malformed registry -- treat as not-found rather than throwing.
      return null;
    }
    if (!reg) return null;

    const slug = (typeof reg.active === 'string' && reg.active.length > 0)
      ? reg.active
      : (typeof reg.active_room === 'string' && reg.active_room.length > 0)
      ? reg.active_room
      : null;
    if (!slug) return null;

    // Support both Array form (legacy) and Object form (current) for the
    // rooms field. Object lookup is O(1) via reg.rooms[slug]; Array lookup
    // matches on .slug or .name.
    let entry = null;
    if (Array.isArray(reg.rooms)) {
      entry = reg.rooms.find(function (r) {
        return r && (r.slug === slug || r.name === slug);
      }) || null;
    } else if (reg.rooms && typeof reg.rooms === 'object') {
      entry = reg.rooms[slug] || null;
    }
    if (!entry) return null;

    // Sealed/archived disposition. The registry's job is to mark; this
    // resolver's job is to honor the mark.
    if (entry.sealed === true) return null;
    if (entry.status === 'sealed' || entry.status === 'archived') return null;

    // Resolve room directory. Precedence: abs_path -> path (relative to
    // home if not absolute) -> default <home>/<slug>.
    let abs_path;
    if (typeof entry.abs_path === 'string' && entry.abs_path.length > 0) {
      abs_path = entry.abs_path;
    } else if (typeof entry.path === 'string' && entry.path.length > 0) {
      abs_path = path.isAbsolute(entry.path) ? entry.path : path.join(home, entry.path);
    } else {
      abs_path = path.join(home, slug);
    }

    // Final gate: directory must exist on disk. A registry pointing at a
    // deleted directory is stale; surface null rather than a phantom path.
    if (!fs.existsSync(abs_path)) return null;

    return { slug: slug, abs_path: abs_path };
  } catch (_e) {
    // Defense-in-depth: NEVER throw. The spine scripts treat null as
    // "no active room; silently exit" -- a throw here would break that.
    return null;
  }
}

/**
 * Convenience wrapper: returns the active room's slug, or null.
 * @returns {string|null}
 */
function resolveActiveRoomSlug() {
  const r = resolveActiveRoom();
  return r ? r.slug : null;
}

/**
 * Convenience wrapper: returns the active room's absolute directory path,
 * or null. This is the most common consumer entry point (jtbd-update.cjs,
 * intent-classifier.cjs, hmi-compliance-poll.cjs all need the dir).
 * @returns {string|null}
 */
function resolveActiveRoomDir() {
  const r = resolveActiveRoom();
  return r ? r.abs_path : null;
}

module.exports = { resolveActiveRoom, resolveActiveRoomSlug, resolveActiveRoomDir };

// CLI entry. Bash wrappers can shell out via:
//   node lib/core/resolve-active-room.cjs
// stdout receives a JSON line (the resolved object, or the literal "null").
// Exit code: 0 on hit, 1 on miss. The exit-code distinction lets bash
// dispatch without parsing JSON.
if (require.main === module) {
  const r = resolveActiveRoom();
  process.stdout.write(JSON.stringify(r) + '\n');
  process.exit(r ? 0 : 1);
}
