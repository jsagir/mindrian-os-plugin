'use strict';
/**
 * lib/core/room-bind-picker-policy.cjs -- Phase 360 (N-1, N-2; SPEC R10, R11).
 *
 * Two pure predicates that decide whether the UserPromptSubmit room-bind
 * picker should stay quiet for an UNBOUND session, layered underneath the
 * harness guard (D-06/D-07/D-08) in scripts/intent-classifier.cjs:
 *
 *   - N-1 (SPEC R10, cwdRoomsHomeVerdict): a deterministic realpath-prefix
 *     check against the rooms home. No text inspection, no egress (Canon
 *     Part 8 local-only). An unreadable or ambiguous cwd fails toward
 *     'unresolvable', and the caller's fail-toward-today's-picker stance
 *     means only a confirmed 'outside' cwd ever suppresses. An ancestor of
 *     the rooms home is deliberately ambiguous and does NOT suppress
 *     (Planner decision P-1).
 *
 *   - N-2 (SPEC R11, unboundPickerSuppression): once a session's stored
 *     binding already records the reserved "dev repo / no room" choice
 *     (lib/core/session-binding.cjs's NO_ROOM_SLUG sentinel, reused here
 *     rather than re-typed -- Canon Part 7 reuse before build), the picker
 *     does not re-fire for the rest of that session_id. A session with a
 *     REAL bound primary is never touched by either rule (Planner decision
 *     P-2: a real primary always wins over a co-resident sentinel).
 *
 * Composes lib/core/room-path-containment.cjs's realRoomRoot (the same
 * realpath-containment helper every room read/write site already uses) and
 * lib/core/session-binding.cjs's NO_ROOM_SLUG export. Adds no store, no
 * network call and no new file format of its own.
 *
 * Both exports never throw: every fault (a malformed binding, an
 * unresolvable cwd or rooms root, a throwing getter on the binding object)
 * is swallowed and degrades to the value that keeps today's picker firing
 * (SPEC R6 applied to this guard, PSB-06 never-block). CLI-only: only the
 * UserPromptSubmit hook injects this picker (Tri-Polar D-18), so this module
 * is never required from lib/mcp/.
 *
 * CJS, zero npm dependencies. Hyphens only, no em-dashes (CLAUDE.md HARD RULE).
 */

const fs = require('node:fs');
const path = require('node:path');
const { realRoomRoot } = require('./room-path-containment.cjs');
const { NO_ROOM_SLUG } = require('./session-binding.cjs');

/**
 * cwdRoomsHomeVerdict(cwd, roomsRoot) -> 'inside' | 'outside' | 'ancestor' | 'unresolvable'.
 *
 * 'inside': cwd's realpath equals or sits under roomsRoot's realpath.
 * 'outside': cwd's realpath resolves cleanly and sits strictly outside
 *   roomsRoot's realpath (a code repo such as ~/dev/MindrianOS-Plugin).
 * 'ancestor': cwd's realpath is an ANCESTOR of roomsRoot's realpath (P-1:
 *   ambiguous on purpose, never suppresses).
 * 'unresolvable': cwd is not a non-empty absolute string, does not exist,
 *   is not a directory, or roomsRoot itself does not resolve. Fails toward
 *   'unresolvable' so the caller's own fail-toward-the-picker stance holds.
 *
 * @param {*} cwd
 * @param {*} roomsRoot
 * @returns {'inside'|'outside'|'ancestor'|'unresolvable'}
 */
function cwdRoomsHomeVerdict(cwd, roomsRoot) {
  try {
    if (typeof cwd !== 'string' || cwd.length === 0) return 'unresolvable';
    if (!path.isAbsolute(cwd)) return 'unresolvable';

    let realCwd;
    try {
      realCwd = fs.realpathSync(cwd);
    } catch (_e) {
      return 'unresolvable';
    }

    let cwdStat;
    try {
      cwdStat = fs.statSync(realCwd);
    } catch (_e) {
      return 'unresolvable';
    }
    if (!cwdStat.isDirectory()) return 'unresolvable';

    let realRoot;
    try {
      realRoot = realRoomRoot(roomsRoot);
    } catch (_e) {
      return 'unresolvable';
    }

    if (realCwd === realRoot || realCwd.indexOf(realRoot + path.sep) === 0) {
      return 'inside';
    }

    const rel = path.relative(realCwd, realRoot);
    if (rel.length > 0 && !path.isAbsolute(rel) && rel.slice(0, 2) !== '..') {
      return 'ancestor';
    }

    return 'outside';
  } catch (_e) {
    return 'unresolvable';
  }
}

/**
 * unboundPickerSuppression({binding, cwd, roomsRoot}) ->
 *   null | 'no-room-remembered' | 'cwd-outside-unbound'.
 *
 * null: do not suppress (today's behavior holds).
 * 'no-room-remembered': the session's stored binding already carries the
 *   reserved NO_ROOM_SLUG sentinel, as either `primary` or a `bound` member
 *   (P-2: a null primary with the sentinel riding in `bound` still counts).
 * 'cwd-outside-unbound': the session has no real bound primary and no real
 *   bound room at all, and the cwd resolves strictly outside the rooms home.
 *
 * A session with a REAL primary (a non-empty, non-sentinel string) is never
 * suppressed by either rule (P-2): N-1/N-2 are unbound-only.
 *
 * Never throws: any fault reading `binding` (a malformed shape, a throwing
 * getter) degrades to null (do not suppress -- fail toward today's picker).
 *
 * @param {{binding: *, cwd: *, roomsRoot: *}} args
 * @returns {null|'no-room-remembered'|'cwd-outside-unbound'}
 */
function unboundPickerSuppression(args) {
  try {
    const binding = args && args.binding;
    const cwd = args && args.cwd;
    const roomsRoot = args && args.roomsRoot;

    const rawBound = binding && Array.isArray(binding.bound) ? binding.bound : [];
    const rawPrimary = binding && typeof binding.primary === 'string' ? binding.primary : null;

    const realPrimary = (rawPrimary && rawPrimary !== NO_ROOM_SLUG) ? rawPrimary : null;
    const realBound = rawBound.filter(function (slug) {
      return typeof slug === 'string' && slug !== NO_ROOM_SLUG;
    });

    if (!realPrimary) {
      const sentinelRemembered = rawPrimary === NO_ROOM_SLUG || rawBound.indexOf(NO_ROOM_SLUG) !== -1;
      if (sentinelRemembered) return 'no-room-remembered';

      if (realBound.length === 0 && cwdRoomsHomeVerdict(cwd, roomsRoot) === 'outside') {
        return 'cwd-outside-unbound';
      }
    }

    return null;
  } catch (_e) {
    return null;
  }
}

module.exports = {
  cwdRoomsHomeVerdict: cwdRoomsHomeVerdict,
  unboundPickerSuppression: unboundPickerSuppression,
};
