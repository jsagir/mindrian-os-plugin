/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 204-01 -- Ignite room-chooser: registry adapter + Shape-F.1 card builder.
 * =========================================================================
 * This module is the pure data / logic layer for the Ignite room-chooser branch
 * (ROADMAP Phase 204 branches (1) room-chooser + (2) "Just talk" no-room entry,
 * and the render-door requirement (4)). It does two things and only two things:
 *
 *   1. Read the LOCAL rooms registry (scripts/room-registry list) and decide
 *      whether the room-chooser gate fires at all. Zero Brain wire (Canon Part 8:
 *      the registry is local navigator-created state; it never egresses).
 *   2. Build the exact Shape-F.1 payload (up to 4 most-recent rooms + one bounded
 *      "Just talk (no room)" row) and render it through the SAME SEED-020
 *      pickShape('F.1') door every other Shape-F surface uses -- never a bespoke
 *      widget (Canon Part 7: reuse before build).
 *
 * Reuse discipline:
 *   - The shell-out to scripts/room-registry mirrors the JSON.stringify-per-arg
 *     quoting pattern in lib/core/navigation/room-birth.cjs (T-204-01): a room
 *     name / ROOMS_HOME override is never string-concatenated into the shell.
 *   - The recency label reuses the SHIPPED formatTimeAnchor exported by
 *     lib/hmi/shape-f7-breakthrough-renderer.cjs -- no second relative-time helper.
 *   - The card renders through lib/hmi/selector-dispatcher.cjs pickShape('F.1').
 *
 * Graceful-degradation invariant (Larry never blocks, Canon Part 3):
 *   ANY registry read failure (missing script, non-zero exit, malformed JSON,
 *   empty registry) resolves to an empty room list -- never a thrown error
 *   (T-204-02).
 *
 * Pure CJS, node built-ins + two in-repo requires, zero npm deps (Phase 87
 * invariant). Hyphens only, no em-dashes (CLAUDE.md hard rule).
 */

'use strict';

const path = require('node:path');
const { execSync } = require('node:child_process');

// Repo root: this file is lib/core/room-chooser.cjs, so two hops up.
const REPO_ROOT = path.join(__dirname, '..', '..');

// The exact "no room" row label the chooser appends after the room rows.
const JUST_TALK_LABEL = 'Just talk (no room)';

// The literal chooser card header (Ignite front door).
const CHOOSER_HEADER = 'Ignite -- pick a room to resume, or start something new';

// Max room rows shown before the Just Talk row. Four rooms + Just Talk = 5
// caller verbs, inside the F.1 renderer USER_VERB_CAP (5) with room for its own
// trailing Free-Text append.
const MAX_ROOM_ROWS = 4;

/**
 * Reuse the shipped relative-time formatter. Lazy-required so a degraded install
 * missing the module still lets formatRoomLabel fall back to a bare label.
 */
function _timeAnchor(ms) {
  try {
    const f7 = require('../hmi/shape-f7-breakthrough-renderer.cjs');
    if (f7 && typeof f7.formatTimeAnchor === 'function') {
      return f7.formatTimeAnchor(ms);
    }
  } catch (_e) {
    // degraded install -- fall through to a neutral anchor
  }
  return 'recently';
}

/**
 * listRegisteredRooms(roomsHomeOverride?) -- shell out to
 * `bash scripts/room-registry [roomsHomeOverride] list` and parse the JSON
 * array. On ANY failure returns [] and never throws (T-204-02).
 *
 * roomsHomeOverride, when a non-empty string, is passed as the leading
 * positional arg exactly as scripts/room-registry expects (the test seam that
 * points at a fixture registry instead of the real ~/MindrianRooms).
 */
function listRegisteredRooms(roomsHomeOverride) {
  try {
    const registryScript = path.join(REPO_ROOT, 'scripts', 'room-registry');
    // T-204-01: JSON.stringify-quote every argument (never concatenate a raw
    // path / name into the shell), mirroring room-birth.cjs.
    let cmd = 'bash ' + JSON.stringify(registryScript);
    if (typeof roomsHomeOverride === 'string' && roomsHomeOverride.length > 0) {
      cmd += ' ' + JSON.stringify(roomsHomeOverride);
    }
    cmd += ' list';
    const out = execSync(cmd, { stdio: 'pipe', cwd: REPO_ROOT });
    const parsed = JSON.parse(String(out));
    return Array.isArray(parsed) ? parsed : [];
  } catch (_e) {
    // Missing script, non-zero exit, malformed JSON, or empty registry: degrade
    // to an empty room list. Larry never blocks on a registry hiccup.
    return [];
  }
}

/**
 * hasResumableRooms(rooms) -- pure predicate. True iff `rooms` is a non-empty
 * array with at least one non-archived entry. An all-archived registry reads as
 * "no prior rooms" for the purposes of this gate (roadmap: skip straight to the
 * birth / talk branches when there are no prior rooms).
 */
function hasResumableRooms(rooms) {
  if (!Array.isArray(rooms) || rooms.length === 0) return false;
  for (const room of rooms) {
    if (room && typeof room === 'object' && room.status !== 'archived') {
      return true;
    }
  }
  return false;
}

/**
 * _parseOpened(room) -- parse the room's last_opened ISO-8601 string to epoch
 * ms. Returns NaN when it is absent / unparseable (used both for the label
 * fallback and for the recency sort's "unparseable sorts last" rule).
 */
function _parseOpened(room) {
  if (!room || typeof room !== 'object') return NaN;
  if (typeof room.last_opened !== 'string' || room.last_opened.length === 0) return NaN;
  return Date.parse(room.last_opened);
}

/**
 * formatRoomLabel(room) -- pure. Builds
 *   "<venture_name or name> - <venture_stage or 'no stage yet'> - opened <anchor>"
 * Never throws on a malformed room object (missing fields degrade to the
 * fallback strings shown).
 */
function formatRoomLabel(room) {
  const r = (room && typeof room === 'object') ? room : {};
  const title = (typeof r.venture_name === 'string' && r.venture_name.length > 0)
    ? r.venture_name
    : ((typeof r.name === 'string' && r.name.length > 0) ? r.name : 'untitled room');
  const stage = (typeof r.venture_stage === 'string' && r.venture_stage.length > 0)
    ? r.venture_stage
    : 'no stage yet';
  const openedMs = _parseOpened(r);
  const anchor = _timeAnchor(Number.isNaN(openedMs) ? Date.now() : openedMs);
  return title + ' - ' + stage + ' - opened ' + anchor;
}

/**
 * buildRoomChooserVerbs(rooms) -- pure. Filters archived entries, sorts by
 * last_opened descending (most recent first; unparseable last_opened sorts
 * last), takes the top MAX_ROOM_ROWS, maps each through formatRoomLabel, then
 * appends JUST_TALK_LABEL as the final verb.
 *
 * Returns { verbs, header, recommendedVerb, roomByVerb } where:
 *   - verbs: at most MAX_ROOM_ROWS room labels + the Just Talk row.
 *   - header: the literal CHOOSER_HEADER.
 *   - recommendedVerb: the label of the single most-recently-opened room, or
 *     null when there are zero rooms.
 *   - roomByVerb: a Map from each room-row label back to its full registry entry
 *     (consumed by resolvePick after the navigator answers).
 */
function buildRoomChooserVerbs(rooms) {
  const list = Array.isArray(rooms) ? rooms.slice() : [];
  const resumable = list.filter(r => r && typeof r === 'object' && r.status !== 'archived');

  resumable.sort((a, b) => {
    const ta = _parseOpened(a);
    const tb = _parseOpened(b);
    const aBad = Number.isNaN(ta);
    const bBad = Number.isNaN(tb);
    if (aBad && bBad) return 0;
    if (aBad) return 1;   // unparseable sorts last
    if (bBad) return -1;
    return tb - ta;       // most recent first
  });

  const top = resumable.slice(0, MAX_ROOM_ROWS);
  const roomByVerb = new Map();
  const verbs = [];
  for (const room of top) {
    const label = formatRoomLabel(room);
    roomByVerb.set(label, room);
    verbs.push(label);
  }
  const recommendedVerb = verbs.length > 0 ? verbs[0] : null;
  verbs.push(JUST_TALK_LABEL);

  return { verbs, header: CHOOSER_HEADER, recommendedVerb, roomByVerb };
}

/**
 * renderRoomChooserCard(rooms) -- render the room-chooser through the SEED-020
 * pickShape('F.1') door (the SAME door every other Shape-F surface uses; never a
 * bespoke widget). Returns the dispatcher's own { shape, rendered } envelope,
 * plus roomByVerb (the reverse-lookup map the caller needs after the navigator
 * answers).
 *
 * This is the pickShape('F.1') call site the Phase-178 render-coverage generator
 * picks up automatically -- no manual registry edit needed.
 */
function renderRoomChooserCard(rooms) {
  const built = buildRoomChooserVerbs(rooms);
  const dispatcher = require('../hmi/selector-dispatcher.cjs');
  const result = dispatcher.pickShape({
    requestedShape: 'F.1',
    roomDir: null,
    operator: null,
    payload: {
      verbs: built.verbs,
      header: built.header,
      recommendedVerb: built.recommendedVerb,
    },
  });
  return {
    shape: result && result.shape,
    rendered: result && result.rendered,
    roomByVerb: built.roomByVerb,
  };
}

/**
 * resolvePick(selectedVerb, roomByVerb) -- pure. Interpret the navigator's pick:
 *   - a key of roomByVerb            -> { action: 'resume', room: <entry> }
 *   - JUST_TALK_LABEL                -> { action: 'just_talk' }
 *   - anything else (incl. the renderer's auto-appended Free-Text row)
 *                                    -> { action: 'free_text', text: selectedVerb }
 * Never throws; an unexpected pick degrades to free-text interpretation.
 */
function resolvePick(selectedVerb, roomByVerb) {
  if (roomByVerb instanceof Map && roomByVerb.has(selectedVerb)) {
    return { action: 'resume', room: roomByVerb.get(selectedVerb) };
  }
  if (selectedVerb === JUST_TALK_LABEL) {
    return { action: 'just_talk' };
  }
  return { action: 'free_text', text: selectedVerb };
}

module.exports = {
  listRegisteredRooms: listRegisteredRooms,
  hasResumableRooms: hasResumableRooms,
  formatRoomLabel: formatRoomLabel,
  buildRoomChooserVerbs: buildRoomChooserVerbs,
  renderRoomChooserCard: renderRoomChooserCard,
  resolvePick: resolvePick,
  JUST_TALK_LABEL: JUST_TALK_LABEL,
};
