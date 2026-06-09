'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 148-05 Task 2 (IRW-02 cache path, D-06) -- the per-room Hats persona cache.
 * ===============================================================================
 * The Hats reach (the 6th machine reach minted in Plan 01) is confirm-gated: it
 * builds research personas and runs the de-Bono hats research spin only AFTER the
 * navigator confirms (the reach-component-map 'confirm' archetype from Plan 03 +
 * the D-06 confirm copy). Building the personas is the heavy step; D-06 says the
 * personas are CACHED PER ROOM and rebuilt on demand.
 *
 * This module is that per-room cache. It mirrors the per-room dial-memory idiom
 * (lib/core/feynman/dial-memory-renderer.cjs A5: a room-local projection, rebuilt
 * on demand) -- a room-keyed in-process cache with an explicit invalidation entry.
 * It builds-then-reads: the FIRST call for a room is a cache miss and runs the
 * builder; the SECOND call for the same room reads from cache and does NOT rebuild.
 * This is exactly the read-then-rebuild assertion that the Plan 01
 * tests/test-148-hats-sixth-reach.cjs persona-cache check now exercises HARD.
 *
 * Canon Part 8: the persona cache is room-local; it NEVER egresses (T-148-05-04
 * disposition = accept). No Brain call, no fetch, no network surface anywhere in
 * this file. The cache holds only what the builder returns for that room.
 *
 * The Hats reach also carries the "go deep" marker from the existing 12-glyph
 * UI-ruling vocabulary (the lightning glyph used for heavy / convergence, A2). We
 * surface that glyph + the D-06 confirm copy as frozen module constants so the
 * render host can attach them without inventing a NEW glyph.
 *
 * NO em-dashes / en-dashes anywhere (CLAUDE.md HARD RULE). Hyphens only.
 *
 * License: BSL 1.1.
 */

// The "go deep" marker: the lightning glyph from the existing 12-glyph UI-ruling
// vocabulary (heavy / convergence; A2). NOT a new glyph -- the Hats reach reuses it.
const GO_DEEP_GLYPH = '⚡'; // lightning bolt

// The D-06 confirm copy for the confirm-gated Hats reach. Frozen so the render
// host attaches the canonical confirm line without re-authoring it.
const HATS_CONFIRM_COPY = 'Build research personas + run the hats research spin, ~1 min';

// The canonical six de-Bono hat persona handles (generic, no user content).
const DEFAULT_HAT_PERSONAS = Object.freeze([
  'white', 'red', 'black', 'yellow', 'green', 'blue',
]);

// Per-room in-process cache. Keyed by a normalized room handle (a roomDir path or
// a room id string). Room-local by construction; never serialized off-box.
const _cache = new Map();

/**
 * _roomKey(room) -> string
 *
 * Normalize the room handle to a stable cache key. Accepts a roomDir absolute
 * path OR a room id string (the Plan 01 test passes a plain room id). Trailing
 * slashes are stripped so 'room/' and 'room' collapse to one key.
 */
function _roomKey(room) {
  if (typeof room !== 'string' || room.length === 0) return '__default_room__';
  return room.replace(/\/+$/, '');
}

/**
 * _defaultBuilder() -> { personas: string[] }
 *
 * The fallback persona builder when no builder is supplied. Returns the canonical
 * six de-Bono hat handles. Pure, room-independent, zero IO -- a real builder
 * (Engine 2 BONO orchestration) would compose room-context personas, but the
 * cache contract only requires SOMETHING to cache + rebuild.
 */
function _defaultBuilder() {
  return { personas: DEFAULT_HAT_PERSONAS.slice() };
}

/**
 * getOrBuildPersonas(room, builder) -> { personas: ... }
 *
 * The cache chokepoint (D-06 rebuilt-on-demand). On a cache MISS for `room`, runs
 * the builder (or the default builder), stores the result, and returns it. On a
 * cache HIT, returns the cached value WITHOUT re-running the builder.
 *
 *   - room:    a roomDir path or a room id string (the cache key).
 *   - builder: optional () -> personas. When omitted, the default six-hat builder
 *              is used. The builder is called AT MOST ONCE per room until the
 *              cache is invalidated.
 *
 * Read-then-rebuild contract (the Plan 01 IRW-02 assertion):
 *   first call  -> miss -> builder fires -> rebuildCount === 1
 *   second call -> hit  -> builder does NOT fire -> rebuildCount still 1
 *
 * Never throws on caller input. A builder that throws is allowed to propagate
 * (the caller chose the builder); the cache is not poisoned with a partial value.
 */
function getOrBuildPersonas(room, builder) {
  const key = _roomKey(room);
  if (_cache.has(key)) {
    return _cache.get(key);
  }
  const build = (typeof builder === 'function') ? builder : _defaultBuilder;
  const built = build();
  _cache.set(key, built);
  return built;
}

/**
 * invalidatePersonas(room) -> boolean
 *
 * Explicit invalidation entry (D-06 "rebuilt on demand"). Drops the cached
 * personas for `room` so the next getOrBuildPersonas call is a fresh miss that
 * rebuilds. Returns true when an entry was removed, false when there was nothing
 * cached. Passing no room (or a falsy room) clears the ENTIRE cache (used by
 * tests + a room-switch reset).
 */
function invalidatePersonas(room) {
  if (room === undefined || room === null || room === '') {
    const had = _cache.size > 0;
    _cache.clear();
    return had;
  }
  return _cache.delete(_roomKey(room));
}

/**
 * isCached(room) -> boolean
 *
 * Introspection: whether `room` currently has cached personas (a HIT on the next
 * getOrBuildPersonas). Used by tests + the render host to decide whether the
 * confirm gate will be a fast cache read or a rebuild.
 */
function isCached(room) {
  return _cache.has(_roomKey(room));
}

module.exports = {
  getOrBuildPersonas: getOrBuildPersonas,
  invalidatePersonas: invalidatePersonas,
  isCached: isCached,
  GO_DEEP_GLYPH: GO_DEEP_GLYPH,
  HATS_CONFIRM_COPY: HATS_CONFIRM_COPY,
  DEFAULT_HAT_PERSONAS: DEFAULT_HAT_PERSONAS,
};
