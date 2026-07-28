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
 * readRegistry(home) -> parsed registry object, or null.
 * Missing file / malformed JSON both collapse to null (never throws) so every
 * caller keeps the null-on-failure contract.
 *
 * @param {string} home
 * @returns {object|null}
 */
function readRegistry(home) {
  try {
    const regPath = path.join(home, '.rooms', 'registry.json');
    if (!fs.existsSync(regPath)) return null;
    const reg = JSON.parse(fs.readFileSync(regPath, 'utf8'));
    return (reg && typeof reg === 'object') ? reg : null;
  } catch (_e) {
    return null;
  }
}

/**
 * registryRoomPath(home, slug, reg) -> abs_path string, or null.
 *
 * The ONE slug -> directory derivation (Canon Part 7). Precedence:
 * entry.abs_path -> entry.path (resolved against home when relative) ->
 * <home>/<slug>. Final gate: the directory must exist on disk.
 *
 * RCA resolve-active-room-cross-session-bleed (D2): before this helper existed,
 * resolveWriteRoom's leg 2 derived the bound room's directory as the bare
 * path.join(home, primary). That is FALSE for every SUB-room, whose registry
 * `path` is nested (e.g. motj-ecosystem/sub-rooms/jonathan-contractor-motj).
 * The existsSync gate then failed and leg 2 fell through to leg 3 -- so a
 * session correctly bound to a sub-room silently resolved to the machine-wide
 * reg.active instead, which is the cross-session bleed itself. resolveActiveRoom
 * already did this derivation correctly; extracting it here gives leg 2 the SAME
 * correct derivation rather than a fifth independent guess (the SEED-034
 * four-guessers lesson).
 *
 * Sealed/archived disposition is deliberately NOT applied here -- it is the
 * caller's policy. resolveActiveRoom gates on it before calling; leg 2 keeps its
 * documented exists-on-disk-only contract.
 *
 * NEVER throws.
 *
 * @param {string} home
 * @param {string} slug
 * @param {object} [reg] - a pre-read registry (avoids a second file read)
 * @returns {string|null}
 */
function registryRoomPath(home, slug, reg) {
  try {
    if (typeof slug !== 'string' || slug.length === 0) return null;
    const registry = (reg && typeof reg === 'object') ? reg : readRegistry(home);

    let entry = null;
    if (registry) {
      if (Array.isArray(registry.rooms)) {
        entry = registry.rooms.find(function (r) {
          return r && (r.slug === slug || r.name === slug);
        }) || null;
      } else if (registry.rooms && typeof registry.rooms === 'object') {
        entry = registry.rooms[slug] || null;
      }
    }

    let abs_path;
    if (entry && typeof entry.abs_path === 'string' && entry.abs_path.length > 0) {
      abs_path = entry.abs_path;
    } else if (entry && typeof entry.path === 'string' && entry.path.length > 0) {
      abs_path = path.isAbsolute(entry.path) ? entry.path : path.join(home, entry.path);
    } else {
      // No entry, or an entry with no location: fall back to the flat default.
      // An unregistered-but-present directory still resolves, which preserves
      // leg 2's pre-existing behavior for a binding the registry does not know.
      abs_path = path.join(home, slug);
    }

    if (!fs.existsSync(abs_path)) return null;
    return abs_path;
  } catch (_e) {
    return null;
  }
}

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
    const reg = readRegistry(home);
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

    // Resolve room directory through the ONE shared derivation (abs_path ->
    // path -> default <home>/<slug>), which also applies the final
    // exists-on-disk gate. A registry pointing at a deleted directory is
    // stale; surface null rather than a phantom path.
    const abs_path = registryRoomPath(home, slug, reg);
    if (!abs_path) return null;

    return { slug: slug, abs_path: abs_path };
  } catch (_e) {
    // Defense-in-depth: NEVER throw. The spine scripts treat null as
    // "no active room; silently exit" -- a throw here would break that.
    return null;
  }
}

/**
 * resolveWriteRoom -- the ONE session-aware WRITE precedence (PSB-02, PSB-15,
 * D-02). Both write-guards (the intent-classifier tripwire and the
 * write-scope-check middleware) inherit their write-target resolution from
 * THIS function, so session precedence lives in exactly one place (the
 * SEED-034 four-guessers lesson: do NOT add a second resolver).
 *
 * Precedence (first hit wins):
 *   Leg 1 -- `.room-root` walk-up from filePath (room-root.cjs resolveRoomRoot):
 *            a file physically inside a room ROOT writes to THAT room, no matter
 *            what the session or registry says. source:'room-root'.
 *   Leg 2 -- session.primary (session-binding.cjs readSessionBinding): the
 *            per-session default write target, but ONLY when that room exists on
 *            disk (a primary pointing at a deleted/never-created room falls
 *            through, never returns a dead room). source:'session.primary'.
 *   Leg 3 -- reg.active DEMOTED (resolveActiveRoom): the fresh-session
 *            seed-default. reg.active is no longer the write AUTHORITY for a
 *            bound session (PSB-15); it is reached only when no `.room-root`
 *            wins and the session is unbound. source:'reg.active'.
 *
 * Returns { slug, abs_path, source } on hit, null on total miss. NEVER throws:
 * a failure in any leg falls through to the next (mirrors resolveActiveRoom's
 * never-throw discipline). Additive -- this does NOT change resolveActiveRoom's
 * own precedence or signature.
 *
 * Canon Part 8/9: this reads only the LOCAL filesystem session/registry files.
 * It requires room-root.cjs and session-binding.cjs (both pure-fs modules); it
 * introduces zero SQLite driver and zero graph-chokepoint token, so the
 * rar.11/rar.12 source-grep tripwires stay green.
 *
 * @param {{filePath?: string, sessionId?: string, home?: string}} [opts]
 * @returns {{slug: string, abs_path: string, source: string}|null}
 */
function resolveWriteRoom(opts) {
  const o = opts || {};
  const filePath = o.filePath;
  const sessionId = o.sessionId;
  const home = o.home || process.env.MINDRIAN_ROOMS_HOME
    || path.join(process.env.HOME || process.env.USERPROFILE || os.homedir(), 'MindrianRooms');

  // Leg 1: a `.room-root` sentinel above the file wins over everything.
  try {
    const roomRoot = require('./room-root.cjs');
    const rootDir = roomRoot.resolveRoomRoot(filePath);
    if (typeof rootDir === 'string' && rootDir.length > 0) {
      return { slug: path.basename(rootDir), abs_path: rootDir, source: 'room-root' };
    }
  } catch (_e) { /* leg 1 failed -- fall through to session.primary */ }

  // Legs 2 + 3 are the SESSION-SCOPED precedence, implemented once in
  // resolveSessionRoom and shared with the hook consumers (Canon Part 7).
  return resolveSessionRoom({ sessionId: sessionId, home: home });
}

/**
 * resolveSessionRoom -- the ONE session-scoped READ resolver: "which room does
 * THIS session belong to?" (RCA resolve-active-room-cross-session-bleed, D1).
 *
 * Precedence (first hit wins):
 *   Leg A -- session.primary (session-binding.cjs readSessionBinding), resolved
 *            to its REAL directory through registryRoomPath so a SUB-room
 *            binding resolves correctly. source:'session.primary'.
 *   Leg B -- reg.active (resolveActiveRoom), the fresh-session seed-default for
 *            a genuinely UNBOUND session. source:'reg.active'.
 *
 * This is resolveWriteRoom's legs 2+3 with leg 1 (the `.room-root` walk-up)
 * deliberately EXCLUDED. That matters: resolveWriteRoom's leg 1 answers "where
 * does THIS FILE belong", and with no filePath it silently walks up from
 * process.cwd(). A hook that only wants "which room is this session in" must
 * not inherit a cwd-derived answer, so it calls THIS function instead of
 * resolveWriteRoom({}) -- same shared implementation, no accidental leg-1 leak.
 *
 * Why this exists at all: scripts/intent-classifier.cjs resolved the room for
 * the F.1 navigation-engine block and the F.8 / zero-score gate state via the
 * MACHINE-WIDE resolveActiveRoomDir(). With several concurrent CLI sessions on
 * one machine, every session therefore rendered its Decision Gate cards -- and
 * wrote its decision traces -- against whichever room another session last
 * activated. This is a DIFFERENT defect from the c123f3d7 fix: that one repaired
 * the WRITER (room_bind could not persist session.primary on stdio); this one is
 * a READER that never consulted the session-aware precedence at all.
 *
 * Returns { slug, abs_path, source } on hit, null on total miss. NEVER throws.
 * Canon Part 8/9: LOCAL filesystem reads only, zero network, zero graph token.
 *
 * @param {{sessionId?: string, home?: string}} [opts]
 * @returns {{slug: string, abs_path: string, source: string}|null}
 */
function resolveSessionRoom(opts) {
  const o = opts || {};
  const sessionId = o.sessionId;
  const home = o.home || process.env.MINDRIAN_ROOMS_HOME
    || path.join(process.env.HOME || process.env.USERPROFILE || os.homedir(), 'MindrianRooms');

  // Leg A: session.primary, but only when the room exists on disk. A primary
  // naming a non-existent room (or the reserved no-room sentinel) falls through
  // rather than resolving to a dead directory.
  try {
    const sessionBinding = require('./session-binding.cjs');
    const binding = sessionBinding.readSessionBinding(sessionId, { home: home });
    const primary = (binding && typeof binding.primary === 'string' && binding.primary.length > 0)
      ? binding.primary
      : null;
    if (primary) {
      const absPath = registryRoomPath(home, primary);
      if (absPath) {
        return { slug: primary, abs_path: absPath, source: 'session.primary' };
      }
    }
  } catch (_e) { /* leg A failed -- fall through to the demoted reg.active */ }

  // Leg B: reg.active DEMOTED to the fresh-session seed-default (PSB-15).
  try {
    const active = resolveActiveRoom({ home: home });
    if (active) {
      return { slug: active.slug, abs_path: active.abs_path, source: 'reg.active' };
    }
  } catch (_e) { /* leg B failed -- total miss */ }

  return null;
}

/**
 * resolveSessionScope -- the ONE session-aware tripwire on-scope test (PSB-03,
 * D-02). The intent-classifier tripwire (Wave 3) asks this instead of the old
 * single-equality `best.name === active` silence test: a top-scoring room is
 * ON-scope iff it is a MEMBER of this session's bound SET.
 *
 * An unbound session (empty/absent binding) yields onScope:false -- this is
 * precisely what graduates the tripwire into the F.8 binding gate (an unbound
 * session must be asked which room it is writing to). Membership is a plain
 * `bound.includes(topRoom)`; the reserved `__no_room__` dev-repo sentinel is a
 * first-class member (readSessionBinding round-trips it), so a session that
 * chose dev-repo/no-room is on-scope for a no-room write and does NOT re-fire
 * the gate.
 *
 * NEVER throws: a corrupt binding file collapses to the safe default
 * ({ onScope:false, bound:[] }). Canon Part 8/9: filesystem-only, zero graph
 * token (rar.11/rar.12 stay green).
 *
 * @param {{sessionId?: string, topRoom?: string, home?: string}} [opts]
 * @returns {{onScope: boolean, bound: string[]}}
 */
function resolveSessionScope(opts) {
  const o = opts || {};
  const sessionId = o.sessionId;
  const topRoom = o.topRoom;
  const home = o.home || process.env.MINDRIAN_ROOMS_HOME
    || path.join(process.env.HOME || process.env.USERPROFILE || os.homedir(), 'MindrianRooms');
  try {
    const sessionBinding = require('./session-binding.cjs');
    const binding = sessionBinding.readSessionBinding(sessionId, { home: home });
    const bound = (binding && Array.isArray(binding.bound)) ? binding.bound : [];
    return { onScope: bound.indexOf(topRoom) !== -1, bound: bound };
  } catch (_e) {
    // Safe default: an unreadable binding is off-scope, which fires the gate
    // rather than silently allowing an unscoped write. Never throw into a hook.
    return { onScope: false, bound: [] };
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

module.exports = {
  resolveActiveRoom,
  resolveActiveRoomSlug,
  resolveActiveRoomDir,
  resolveWriteRoom,
  resolveSessionRoom,
  resolveSessionScope,
  registryRoomPath,
};

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
