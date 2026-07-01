'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 195-05 -- FCM-12: the three cross-room umbilical triggers.
 * ============================================================================
 * The inverse of Phase-194 binding (many sessions, ONE room): here ONE navigator,
 * MANY rooms, connected LOCALLY. Three triggers decide WHEN to offer the F.8
 * cross-room umbilical gate (cross-room-umbilical-closer.cjs). All three read
 * LOCAL room.dbs + LOCAL embeddings ONLY; ZERO Brain wire; aggregate-scalar-only
 * across boundaries (Canon Part 8 / D-10).
 *
 *   (1) ROOM-OPEN  -- on entering a room, run the aggregator vs the active focus;
 *       fire the gate IF >= 1 candidate clears the frozen 0.70 pre-check.
 *   (2) CROSS-SESSION RESUME -- fire ONLY when a SIBLING room moved since this
 *       room's last session. It reads the Phase-194 presence ledger's per-room
 *       timestamps (session-presence.readPresence) and pays the aggregator cost
 *       ONLY when a sibling actually changed. A single-room navigator has no
 *       siblings, so it pays ZERO ceremony (T-195-17 DoS mitigation).
 *   (3) MID-WORK  -- offer the umbilical inline when the CURRENT item
 *       semantically/graph-matches a sibling (shared framework / problem_type /
 *       entity / room-local vector proximity).
 *
 * The frozen 0.70 is REUSED from the shipped renderer via the closer -- no new
 * scalar is minted here (Pitfall 4). Pure CJS, node built-ins only. Hyphens only,
 * no em-dashes. No emoji. No Brain call, no network.
 */

const fs = require('node:fs');
const path = require('node:path');

const aggregator = require('./cross-room-aggregator.cjs');
const presence = require('./session-presence.cjs');
const umbilical = require('../workflow/cross-room-umbilical-closer.cjs');

// The frozen pre-check threshold, REUSED (never minted here).
const PRE_CHECK_THRESHOLD = umbilical.PRE_CHECK_THRESHOLD;

// ---------- Registry + presence helpers (LOCAL reads) ----------

// Read the registered room slugs from <roomsHome>/.rooms/registry.json. Returns
// [] on any failure (never throws).
function readRegistrySlugs(roomsHome) {
  try {
    const p = path.join(roomsHome, '.rooms', 'registry.json');
    const reg = JSON.parse(fs.readFileSync(p, 'utf8'));
    if (!reg || typeof reg.rooms !== 'object' || reg.rooms === null) return [];
    return Object.keys(reg.rooms);
  } catch (_e) {
    return [];
  }
}

// The sibling slugs of the current room (every registered room except itself).
function siblingSlugs(roomsHome, currentSlug, injectedSlugs) {
  const all = Array.isArray(injectedSlugs) ? injectedSlugs : readRegistrySlugs(roomsHome);
  return all.filter(function (s) { return s !== currentSlug; });
}

// The most recent presence timestamp (ms epoch) across a room's session ledger,
// or null when the room has no presence entries. Reads LOCAL presence files only
// (session-presence.readPresence); zero Brain wire.
function maxPresenceUpdated(roomsHome, slug) {
  const entries = presence.readPresence({ home: roomsHome, room: slug });
  let max = null;
  for (const e of entries) {
    if (!e || typeof e !== 'object') continue;
    const parsed = Date.parse(e.updated);
    const ms = Number.isFinite(parsed) ? parsed : (Number.isFinite(e._mtimeMs) ? e._mtimeMs : null);
    if (ms === null) continue;
    if (max === null || ms > max) max = ms;
  }
  return max;
}

// Resolve the "since" baseline: this room's last-session timestamp. An explicit
// numeric `since` wins; otherwise derive it from this room's own presence ledger
// (0 when the room has never registered presence, so any sibling movement counts).
function resolveSince(args, roomsHome) {
  if (args && Number.isFinite(args.since)) return args.since;
  const ownMax = maxPresenceUpdated(roomsHome, args && args.currentRoomSlug);
  return ownMax === null ? 0 : ownMax;
}

// ---------- Trigger 2: CROSS-SESSION RESUME (presence-only, cheap) ----------

/**
 * resumeTrigger(args) -> { fire, reason, moved, sinceMs, siblings }
 *
 * Cheap, SYNC, presence-only decision -- it does NOT run the aggregator. Fires
 * ONLY when a sibling room's presence timestamp advanced past this room's last
 * session. A single-room navigator (no siblings) NEVER fires (zero ceremony).
 * The caller runs the aggregator + gate only when fire === true (T-195-17).
 *
 * args:
 *   roomsHome        -- the ~/MindrianRooms root.
 *   currentRoomSlug  -- the room being resumed.
 *   since            -- (optional) ms-epoch baseline; defaults to this room's
 *                       own last presence timestamp.
 *   registrySlugs    -- (optional test seam) the registered slug list.
 */
function resumeTrigger(args) {
  const a = (args && typeof args === 'object') ? args : {};
  const roomsHome = a.roomsHome;
  const currentSlug = a.currentRoomSlug;
  const siblings = siblingSlugs(roomsHome, currentSlug, a.registrySlugs);

  if (siblings.length === 0) {
    return { fire: false, reason: 'single_room_zero_ceremony', moved: [], sinceMs: null, siblings: [] };
  }

  const sinceMs = resolveSince(a, roomsHome);
  const moved = [];
  for (const sib of siblings) {
    const ts = maxPresenceUpdated(roomsHome, sib);
    if (ts !== null && ts > sinceMs) moved.push(sib);
  }
  if (moved.length === 0) {
    return { fire: false, reason: 'no_sibling_moved', moved: [], sinceMs: sinceMs, siblings: siblings };
  }
  return { fire: true, reason: 'siblings_changed', moved: moved, sinceMs: sinceMs, siblings: siblings };
}

// ---------- Trigger 1: ROOM-OPEN ----------

/**
 * roomOpenTrigger(args) -> Promise<{ fire, reason, candidates, clearing, rendered? }>
 *
 * Runs the aggregator vs the active focus and fires the gate IF >= 1 candidate
 * clears the frozen 0.70 pre-check. On fire, returns the rendered F.8 basket
 * (display-only; nothing attaches until the navigator confirms).
 *
 * args:
 *   currentRoom    -- absolute path to the room being opened.
 *   focus_section  -- (optional) the active-focus section slug to narrow the emit.
 *   max_rooms / per_room_timeout_ms -- passed through to the aggregator.
 */
async function roomOpenTrigger(args) {
  const a = (args && typeof args === 'object') ? args : {};
  let res;
  try {
    res = await aggregator.aggregateRelevanceCandidates(a.currentRoom, {
      focus_section: a.focus_section,
      max_rooms: a.max_rooms,
      per_room_timeout_ms: a.per_room_timeout_ms,
    });
  } catch (_e) {
    return { fire: false, reason: 'aggregator_error', candidates: [], clearing: [] };
  }
  const candidates = Array.isArray(res.candidates) ? res.candidates : [];
  const clearing = candidates.filter(function (c) {
    return typeof c.relevance === 'number' && c.relevance >= PRE_CHECK_THRESHOLD;
  });
  if (clearing.length === 0) {
    return { fire: false, reason: 'no_candidate_over_threshold', candidates: candidates, clearing: [] };
  }
  const rendered = umbilical.renderUmbilicalBasket(candidates);
  return {
    fire: true,
    reason: 'candidate_cleared_threshold',
    candidates: candidates,
    clearing: clearing,
    rendered: rendered,
  };
}

// ---------- Trigger 3: MID-WORK ----------

/**
 * midWorkTrigger(args) -> Promise<{ fire, reason, candidates, clearing, rendered? }>
 *
 * Offers the umbilical inline when the CURRENT item (focus_section) matches a
 * sibling on ANY signal (shared framework / problem_type / entity / semantic).
 * Fires when >= 1 candidate exists for the focus item; pre-checks the >= 0.70
 * ones in the rendered basket. focus_section is REQUIRED -- mid-work is scoped to
 * the item under work, never the whole room.
 */
async function midWorkTrigger(args) {
  const a = (args && typeof args === 'object') ? args : {};
  if (typeof a.focus_section !== 'string' || a.focus_section.length === 0) {
    return { fire: false, reason: 'no_focus_item', candidates: [], clearing: [] };
  }
  let res;
  try {
    res = await aggregator.aggregateRelevanceCandidates(a.currentRoom, {
      focus_section: a.focus_section,
      max_rooms: a.max_rooms,
      per_room_timeout_ms: a.per_room_timeout_ms,
    });
  } catch (_e) {
    return { fire: false, reason: 'aggregator_error', candidates: [], clearing: [] };
  }
  const candidates = Array.isArray(res.candidates) ? res.candidates : [];
  if (candidates.length === 0) {
    return { fire: false, reason: 'no_sibling_match', candidates: [], clearing: [] };
  }
  const clearing = candidates.filter(function (c) {
    return typeof c.relevance === 'number' && c.relevance >= PRE_CHECK_THRESHOLD;
  });
  const rendered = umbilical.renderUmbilicalBasket(candidates);
  return {
    fire: true,
    reason: 'sibling_match',
    candidates: candidates,
    clearing: clearing,
    rendered: rendered,
  };
}

module.exports = {
  PRE_CHECK_THRESHOLD: PRE_CHECK_THRESHOLD,
  roomOpenTrigger: roomOpenTrigger,
  resumeTrigger: resumeTrigger,
  midWorkTrigger: midWorkTrigger,
  // Test surface
  _test: Object.freeze({
    readRegistrySlugs: readRegistrySlugs,
    siblingSlugs: siblingSlugs,
    maxPresenceUpdated: maxPresenceUpdated,
    resolveSince: resolveSince,
  }),
};
