'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 209-05 (E5) -- SENS-12 room-pick detector: the conversational-gate
 * bridge for the incident's actual fork.
 *
 * RC-1 verdict 23 (2026-07-02-gate-native-fire-fix.md): a mid-dialogue room
 * resume/switch (no command, no engine dial) carries NEITHER card-fire
 * transport today. renderRoomChooserCard (lib/core/room-chooser.cjs) already
 * exists and routes through the SEED-020 pickShape('F.1') door, but nothing
 * detects the conversational fork and calls it. This sensor is that
 * detector.
 *
 * ARCHITECTURAL NOTE (documented, not a silent deviation): the two most
 * recent sensor precedents this phase could otherwise mirror
 * (sensor-expert-skill.cjs SENS-11, sensor-show-share.cjs SENS-SHOW) keep
 * their `evidence` bag to CLOSED SCALARS ONLY and delegate actual card
 * rendering to a downstream consumer this phase does not touch. This
 * sensor instead renders the FULL card envelope (rendered text + marker +
 * binding + an imperative instruction block) and carries it as a single
 * evidence STRING field. This is explicitly what 209-05-PLAN.md directs and
 * tests for (there is no downstream consumer wired in this phase to compose
 * the card from a bare reach), and it stays within makeReach's contract
 * (evidence values may be string/number/boolean; a string is a valid
 * scalar). The room-chooser's rendered content is the navigator's OWN LOCAL
 * room registry data (names, stages, timestamps) rendered back to the
 * navigator, never external or Brain content (Canon Part 8).
 *
 * FROZEN REACH (Phase 148 lockstep): mints NO new reach_id. Rides the
 * existing context_block reach exactly like SENS-11/SENS-SHOW.
 *
 * Reuse before build (Canon Part 7): mints the card ONLY via
 * lib/core/room-chooser.cjs::renderRoomChooserCard, which itself routes
 * through the SINGLE SEED-020 pickShape('F.1') door
 * (lib/hmi/selector-dispatcher.cjs). This sensor calls no per-shape renderer
 * function directly (grep-provable: zero "render" + "Shape" + "F" call-site
 * token anywhere below) and defines no new dispatcher branch.
 *
 * Detection is deliberately HIGH-PRECISION over high-recall (T-209-19): a
 * false fire injects a reversible UI offer (never a write, never a bind);
 * when unsure the sensor returns null and the check-card-fire.cjs backstop
 * (Phase 209-07) still covers a miss.
 *
 * Phase 144 fence: this file PRODUCES a candidate reach; it never assigns
 * routing_source and never requires/defines decide().
 *
 * Pure / sync for the sensor function itself; the ONE local shell-out
 * (listRegisteredRooms, via room-chooser.cjs) is LOCAL-only and already
 * degrades to [] on any fault (T-204-02). Never throws (T-209-20). No
 * Brain require, no network. House rule: hyphens only, no em-dashes.
 */

const { makeReach, REACH_IDS } = require('./sensor-types.cjs');

// SENS-12: the next free sensor id (SENS-01/06 live in insight-sensors;
// 02-05/07-10 live in sibling sensor files; 11 is sensor-expert-skill; 12 is
// this sensor).
const SENSOR_ID = 'SENS-12';

// FROZEN: rides the existing context_block reach. Fail closed at load if it
// ever drifts off the frozen bank (mirrors sensor-expert-skill.cjs).
const REACH_ID = 'context_block';
if (REACH_IDS.indexOf(REACH_ID) === -1) {
  throw new Error('sensor-room-pick: REACH_ID "' + REACH_ID + '" is not in the frozen REACH_IDS bank');
}

// OUR fixed generic lexicon (never user content) for a room resume/switch
// signal. Deliberately conservative: phrases that name the ACT of picking or
// returning to a room, not a bare mention of the word "room" in passing.
const ROOM_PICK_LEXICON = Object.freeze([
  'resume work on',
  'resuming work on',
  'switch to my',
  'switch to the',
  'back to my room',
  'back to the room',
  'which room',
  'go back to my',
  'pick up where i left off',
  'open my room',
  'open the room',
  'switch room',
  'switch rooms',
  'resume room',
  'resume my room',
]);

/**
 * textHasRoomPickSignal(turn) -- KEYWORD MODE. Returns true iff the LOCAL
 * turn.text contains one of OUR fixed lexicon terms. Reads turn.text only;
 * never egresses it. Mirrors sensor-show-share.cjs's textMatchesLexicon.
 */
function textHasRoomPickSignal(turn) {
  const text = (turn && typeof turn === 'object' && typeof turn.text === 'string') ? turn.text.toLowerCase() : '';
  if (!text) return false;
  for (const term of ROOM_PICK_LEXICON) {
    if (text.indexOf(term) !== -1) return true;
  }
  return false;
}

/**
 * isInsideOwnCommandFlow(ctx) -- true when the turn is already inside a
 * command flow that owns its own room-pick gate (ignite / rooms), so this
 * sensor must NOT also fire (their scripted gates already fire the card).
 * Reads ONLY a LOCAL ctx enum; never throws on a malformed ctx.
 */
function isInsideOwnCommandFlow(ctx) {
  const cmd = (ctx && typeof ctx === 'object' && typeof ctx.activeCommand === 'string')
    ? ctx.activeCommand.toLowerCase() : '';
  return cmd === 'ignite' || cmd === 'rooms';
}

/**
 * listRooms(ctx) -- LOCAL registry read via the SHIPPED room-chooser adapter
 * (Phase 204-01), never a hand-rolled registry read. A test seam
 * (ctx.__listRegisteredRooms) lets the test inject a stub without touching
 * the real registry or the filesystem. Any failure (missing module, throwing
 * stub) degrades to [] -- never throws (T-209-20).
 */
function listRooms(ctx) {
  try {
    if (ctx && typeof ctx.__listRegisteredRooms === 'function') {
      const rooms = ctx.__listRegisteredRooms();
      return Array.isArray(rooms) ? rooms : [];
    }
    const roomChooser = require('../room-chooser.cjs');
    return roomChooser.listRegisteredRooms();
  } catch (_e) {
    return [];
  }
}

/**
 * buildEnvelope(rooms) -- render the room-chooser card through the SEED-020
 * door and compose the self-decoding injected block. renderRoomChooserCard's
 * return carries `rendered.zones` (header/body/signals/footer), NOT a flat
 * `.text` field -- this joins them the SAME way the engine-arm F.8 seam does
 * (scripts/intent-classifier.cjs's emitBindingGate bodyLines idiom:
 * header -> body -> signals -> footer). `zones.footer` already carries BOTH
 * the trailer marker and the BINDING line (minted EXCLUSIVELY by
 * selector-dispatcher.cjs's appendAskUserQuestionTrailer inside pickShape --
 * this function only READS the assembled zones, never composes trailer
 * strings itself, T-209-21). An imperative "INSTRUCTION FOR LARRY" block
 * (modeled on scripts/room-naming-selector.cjs's shipped pattern) is
 * appended last. Returns null on any render fault (never throws).
 */
function buildEnvelope(rooms) {
  try {
    const roomChooser = require('../room-chooser.cjs');
    const result = roomChooser.renderRoomChooserCard(rooms);
    const rendered = result && result.rendered;
    const zones = rendered && rendered.zones;
    if (!zones || typeof zones !== 'object') return null;

    const lines = [];
    if (typeof zones.header === 'string' && zones.header.length > 0) lines.push(zones.header);
    if (typeof zones.body === 'string' && zones.body.length > 0) lines.push(zones.body);
    if (typeof zones.signals === 'string' && zones.signals.length > 0) lines.push(zones.signals);
    if (typeof zones.footer === 'string' && zones.footer.length > 0) lines.push(zones.footer);
    if (lines.length === 0) return null;

    lines.push('');
    lines.push('INSTRUCTION FOR LARRY: dispatch the room chooser above via the AskUserQuestion');
    lines.push('tool with the options rendered above; never reproduce this block as text');
    lines.push('(SEED-021). When the navigator picks a room, resume/switch to that room; when');
    lines.push('they pick "Just talk (no room)", continue the conversation with no room bound.');

    return lines.join('\n');
  } catch (_e) {
    return null;
  }
}

/**
 * SENS-12 -- the mid-dialogue room resume/switch fork -> the room-chooser
 * card, self-decoding trailer, and the imperative dispatch instruction.
 *
 * Fires ONLY when ALL of:
 *   - the LOCAL turn text carries a room-pick signal (OUR fixed lexicon), AND
 *   - the turn is not already inside a command flow that owns its own gate
 *     (ignite / rooms), AND
 *   - at least one resumable (non-archived) room exists in the registry, AND
 *   - the card envelope renders successfully.
 *
 * Deliberately conservative (high precision, T-209-19): when unsure, return
 * null. Never throws (T-209-20).
 *
 * @param {object} turn  -- normalized turn ({ text, signals })
 * @param {object} _tuple -- the /mos:diagnose tuple (unused for detection)
 * @param {object} ctx   -- LOCAL context ({ roomDir, activeCommand?,
 *                          __listRegisteredRooms? (test seam) })
 * @returns {Readonly<object>|null}
 */
function sensorRoomPick(turn, _tuple, ctx) {
  if (!textHasRoomPickSignal(turn)) return null;
  if (isInsideOwnCommandFlow(ctx)) return null;

  const rooms = listRooms(ctx);
  const roomChooser = require('../room-chooser.cjs');
  if (!roomChooser.hasResumableRooms(rooms)) return null;

  const envelope = buildEnvelope(rooms);
  if (!envelope) return null;

  return makeReach({
    // REUSE the existing context_block reach -- mint NO new reach_id.
    reach_id: REACH_ID,
    // push_forward: the navigator named a room-pick intent directly; bring
    // the resume/switch offer forward now rather than holding it.
    posture: 'push_forward',
    // Generic handle: the room-chooser card door.
    dispatch: 'room-chooser card (renderRoomChooserCard -> pickShape F.1)',
    companions: [],
    signal: 'room_pick',
    evidence: {
      sub_mode: 'room_pick',
      room_count: rooms.length,
      // The full self-decoding envelope: rendered text + marker + binding +
      // the imperative instruction. A string is a valid makeReach evidence
      // scalar (see the ARCHITECTURAL NOTE above for why this sensor departs
      // from the closed-scalar-only convention of its sibling sensors).
      envelope: envelope,
    },
  });
}

module.exports = {
  sensorRoomPick: sensorRoomPick,
  SENSOR_ID: SENSOR_ID,
  REACH_ID: REACH_ID,
  ROOM_PICK_LEXICON: ROOM_PICK_LEXICON,
  textHasRoomPickSignal: textHasRoomPickSignal,
  isInsideOwnCommandFlow: isInsideOwnCommandFlow,
  listRooms: listRooms,
  buildEnvelope: buildEnvelope,
};
