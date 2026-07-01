/**
 * Surface Fence (Phase 205-01, decision D-Q6)
 *
 * The navigator-vs-plumbing routing fence. The registry `kind` field is the
 * WRONG boundary (funding, file-meeting, doctor, heal, deck, show are
 * navigator-facing and CRITICAL even though they are not `methodology`). The
 * correct boundary is the two-value `surface` tag emitted onto every entry in
 * data/command-registry.json by scripts/build-command-registry.cjs:
 *
 *   navigator = a move the ranker / suggest-next / Provoked surfacer MAY offer
 *   internal  = plumbing the navigator never needs offered
 *
 * These helpers are THE ENFORCED FENCE (item 0 rule c): the router / ranker
 * calls filterToNavigator at the chokepoint. The fence is NEVER re-derived from
 * Larry's recall and NEVER hand-rolls a second copy of the D-Q6 partition - it
 * reads the surface tag straight off the generated registry, which is the single
 * source of truth. This module is a PURE LOCAL read helper: no filesystem write,
 * no network, no room.db mutation (Canon Part 8 safe).
 */

'use strict';

// ---------------------------------------------------------------------------
// Single source of truth: the generated command registry. Required lazily and
// memoized so the disk read happens once per process. lib/core -> ../../data.
// ---------------------------------------------------------------------------
let _registry = null;
let _byName = null;

function _load() {
  if (_byName) return _byName;
  // eslint-disable-next-line global-require
  _registry = require('../../data/command-registry.json');
  _byName = new Map();
  const commands = Array.isArray(_registry.commands) ? _registry.commands : [];
  for (const entry of commands) {
    const key = _normalize(entry.command);
    if (key) _byName.set(key, entry);
  }
  return _byName;
}

/**
 * Normalize a command reference to the bare registry key.
 * Accepts '/mos:funding', 'mos:funding', 'funding' (any case) -> 'funding'.
 * Non-string input returns '' (the null sentinel; callers treat as unknown).
 */
function _normalize(command) {
  if (typeof command !== 'string') return '';
  let c = command.trim();
  if (!c) return '';
  c = c.replace(/^\//, '');       // strip leading slash
  c = c.replace(/^mos:/i, '');    // strip the mos: namespace
  return c.toLowerCase();
}

/**
 * Resolve a command list item to (normalizedKey, entry).
 * List items may be bare strings or objects carrying a `command` field.
 */
function _resolve(item) {
  const raw = item && typeof item === 'object' ? item.command : item;
  const key = _normalize(raw);
  return { key, entry: key ? _load().get(key) || null : null };
}

/**
 * True when the command is a navigator-surface move (offerable).
 * Soft-fail: an UNKNOWN command is treated as navigator, the safe direction for
 * surfacing (a mis-offered command is a smaller harm than a hidden navigator
 * move). The enforced complement lives in isInternalSurface (rule c).
 */
function isNavigatorSurface(command) {
  const { key, entry } = _resolve(command);
  if (!key) return false;             // no command at all is not offerable
  if (!entry) return true;            // unknown -> navigator (safe direction)
  return entry.surface === 'navigator';
}

/**
 * True ONLY when the command is a known plumbing (internal) surface. Unknown
 * commands are NOT internal (they fall to navigator per the safe direction), so
 * this is the strict, build-closed side of the fence.
 */
function isInternalSurface(command) {
  const { entry } = _resolve(command);
  return !!entry && entry.surface === 'internal';
}

/**
 * True when the command is a methodology (kind === 'methodology'). Used by the
 * anti-circular gear-shift exits (item 0 rule a): thinking moves are methodology
 * commands only. Unknown commands are not methodology.
 */
function isMethodology(command) {
  const { entry } = _resolve(command);
  return !!entry && entry.kind === 'methodology';
}

/**
 * The fence chokepoint (rule c): return only the items that are NOT an internal
 * surface. Navigator + unknown items survive (safe direction); every known
 * internal command is dropped. Item form is preserved (string in -> string out,
 * object in -> object out).
 */
function filterToNavigator(commandList) {
  if (!Array.isArray(commandList)) return [];
  return commandList.filter((item) => !isInternalSurface(item));
}

/**
 * Return only kind:methodology items - the anti-circular gear-shift EXITS
 * (item 0 rule a, consumed by 205-03). Exits are real thinking moves, never
 * navigator-utility and never plumbing.
 */
function methodologyExitsOnly(commandList) {
  if (!Array.isArray(commandList)) return [];
  return commandList.filter((item) => isMethodology(item));
}

module.exports = {
  isNavigatorSurface,
  isInternalSurface,
  isMethodology,
  filterToNavigator,
  methodologyExitsOnly,
};
