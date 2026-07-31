'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 245-06 (REQ-3, D-12 through D-17) -- SENS-17 perspective-lock detector.
 *
 * WHY THIS FILE EXISTS
 *
 * `hats` is one of the SIX frozen Phase-148 reach categories (sensor-types.cjs
 * REACH_IDS) with a shipped render path (lib/hmi/dial-reach-orchestrator.cjs
 * REACH_DEFS, lib/hmi/dial-label-composer.cjs) and a canonical-verb mapping to
 * the Synthesize skill family. Until this file, ZERO sensor in the 18-sensor
 * bank ever assigned it: `hats` was reachable ONLY by a manual navigator pick.
 * A frozen reach that no sensor can produce is a dead branch of the dial.
 * SENS-17 is the first sensor that can independently assign it.
 *
 * THE TRIGGER IS DOCTRINE, NOT INVENTION (D-13)
 *
 * skills/larry-personality/SKILL.md:383 already names the Six Thinking Hats
 * trigger condition verbatim:
 *
 *   "| Team stuck in one perspective (CONTRADICTS edges, circular pattern,
 *     decision point, jargon spike) | Six Thinking Hats -> add the missing
 *     perspective (illustration: /mos:think-hats serial, or
 *     /mos:persona --parallel) |"
 *
 * The first named condition, CONTRADICTS edges, is already computed and
 * threaded onto sensorCtx as `ctx.freshContradictions` by the MED-01 cortex
 * producer in lib/core/navigation-engine.cjs (the projected-cortex read at the
 * ctx-assembly seam, where a caller-threaded ctx.freshContradictions override
 * wins as the test seam). So this sensor adds NO new plumbing: it consumes a
 * LOCAL scalar that the engine already derives.
 *
 * THE >= 2 THRESHOLD IS LOAD-BEARING (D-14) -- see PERSPECTIVE_LOCK_THRESHOLD.
 *
 * WHY A NEW FILE RATHER THAN A FIFTH CAUSE ON SENS-10 (D-16)
 *
 * Extending lib/core/sensors/sensor-circularity.cjs was considered and
 * REJECTED for three independent reasons: SENS-10 is keyword-only FALLBACK-tier
 * detection (Canon Part 11 R3) while this trigger is a projected-cortex
 * problem-state read, which is context-tier; adding a cause would break that
 * sensor's audited zero-collision property; and its own header and tests encode
 * "four causes, four exits" as a closed contract. A cortex-state sensor does not
 * belong inside a lexical one.
 *
 * ALSO REJECTED (D-31): a model-judgment trigger in the shape of the
 * obra/superpowers "even a 1 percent chance" rule. It does not transfer, for
 * three each-sufficient reasons: dispatchSensors runs in a fresh pre-turn hook
 * process with no model in the loop; a model verdict produces no NUMBER, and
 * buildReachList needs a 0..1 score per reach; and Requirement 4's acceptance
 * criterion demands reproducibility across runs, which model judgment cannot
 * give. A 1-percent firing threshold is also close to the opposite of Canon
 * Part 12's invisibility mandate. SENS-17 stays a deterministic threshold
 * sensor.
 *
 * FLIP-CONDITION CHECK (D-17, corroborated by 245-RESEARCH.md F-9): NOT
 * tripped. SENS-17 takes registered sensor implementations from 18 to 19,
 * against the dial-rethink research's named ~25-30 rewrite threshold. Six to
 * eleven files of headroom remain, so the bank stays inside its current shape.
 *
 * Phase 144 fence: this file PRODUCES a candidate reach; it never assigns
 * routing_source and never requires/defines the routing entry point. The
 * routing fence over lib/core/sensors/ asserts this. It MUST soft-fail to null
 * on a malformed or empty ctx (never throw -- one bad sensor cannot poison
 * dispatchSensors, whose per-sensor try/catch treats a throw as "did not
 * fire"; the sensor is still defensive on its own account).
 *
 * Canon Part 8: the sensor reads ONLY a LOCAL scalar off ctx and emits ONLY a
 * trigger enum plus a count. It carries no claim body, no decision text, no
 * contradiction prose, no node id. The Part-8 sensor sweep auto-covers every
 * lib/core/sensors/*.cjs, including this file.
 *
 * Pure / sync / LOCAL-first. One project require (the shared struct contract).
 * No db, no fs, no network, no new deps.
 * House rule: hyphens only, no em-dashes.
 */

const { makeReach } = require('./sensor-types.cjs');

/**
 * The count of freshly projected contradiction edges at or above which the
 * room is treated as PERSPECTIVE-LOCKED rather than merely bridging.
 *
 * WHY 2 AND NOT 1 (D-14). This number ships WITH the sensor, not after it, and
 * it is load-bearing on three counts:
 *
 *   1. De-duplication. SENS-08 (lib/core/sensors/sensor-memory-cortex.cjs:84)
 *      already fires the `cross_room` reach on `freshContradictions > 0`,
 *      reading the SAME ctx field. A hats sensor at `> 0` would double-fire on
 *      every single contradiction the cortex ever projects.
 *
 *   2. Semantics. ONE fresh contradiction is a memory-cortex bridge: the room
 *      just learned something that tensions with a claim, and the right move is
 *      to surface the bridge. TWO OR MORE unresolved contradictions is a
 *      different state -- the room is stuck arguing from one stance and the
 *      tensions are accumulating faster than they resolve. That is a
 *      perspective lock, and a hats rotation is the move for it.
 *
 *   3. Canon Part 12 invisibility. Larry is measured by how invisible he is
 *      when the insight lands. A sensor that interrupts the navigator on every
 *      contradiction is the opposite of invisible. The higher threshold is a
 *      restraint on interruption, not merely a de-dup fix.
 *
 * At exactly 2 BOTH sensors fire, on purpose: SENS-08's `> 0` still holds and
 * SENS-17's `>= 2` now also holds, and they emit DIFFERENT reach ids. That
 * co-fire is the intended designed behavior and is pinned in both directions by
 * tests/test-245-sens17-no-double-fire.cjs.
 */
const PERSPECTIVE_LOCK_THRESHOLD = 2;

/**
 * The count of freshly projected contradiction edges on ctx (0 when absent or
 * malformed). Mirrors the freshContradictionCount helper shape in
 * sensor-memory-cortex.cjs rather than inlining the guard, so the two sensors
 * that read this one field read it the same way.
 *
 * Tolerant of a missing / non-object / non-numeric / non-finite value --
 * returns 0 rather than throwing.
 */
function freshContradictionCount(ctx) {
  if (!ctx || typeof ctx !== 'object') return 0;
  const n = ctx.freshContradictions;
  return typeof n === 'number' && isFinite(n) && n > 0 ? n : 0;
}

/**
 * SENS-17 -- perspective-lock -> the hats reach (the six-hats perspective
 * rotation).
 *
 * Fires when the projected cortex carries at least PERSPECTIVE_LOCK_THRESHOLD
 * fresh contradictions. Soft-fails to null below the threshold, on an absent or
 * malformed ctx, and on a non-numeric value; never throws.
 *
 * Posture `hold` (D-12): a perspective rotation HALTS the current line of
 * reasoning so a different stance can be taken, rather than pushing the current
 * line forward. `hold` is exactly that movement in the Hierarchical Navigator
 * vocabulary POSTURE_IDS mirrors.
 *
 * @param {object} _turn  -- the turn signal bag (unused; the perspective-lock
 *                           signal is state-driven, threaded on ctx by the
 *                           MED-01 cortex producer)
 * @param {object} _tuple -- the /mos:diagnose tuple (unused for detection)
 * @param {object} ctx    -- LOCAL context carrying the projected cortex scalars
 * @returns {Readonly<object>|null}
 */
function sensorPerspectiveLock(_turn, _tuple, ctx) {
  const fresh = freshContradictionCount(ctx);
  if (fresh < PERSPECTIVE_LOCK_THRESHOLD) return null;

  return makeReach({
    reach_id: 'hats',
    posture: 'hold',
    // Dispatch names the SHIPPED hats surface (the reach the orchestrator
    // routes per the connector registry). A descriptive handle, not user
    // content -- the same convention as 'memory-cortex-bridge' (SENS-08) and
    // 'room-chooser card (renderRoomChooserCard -> pickShape F.1)' (SENS-12).
    dispatch: 'think-hats (six-hats perspective rotation)',
    companions: [],
    signal: 'perspective_lock',
    // LOCAL scalars ONLY: the trigger enum + the contradiction count. No claim
    // body, no decision text, no contradiction prose, no node id -- the WHICH
    // never rides the reach. `sensor_id` is stamped CENTRALLY by
    // dispatchSensors (Phase 245-01), so it is deliberately not set here.
    evidence: {
      trigger: 'perspective_lock',
      fresh_contradictions: fresh,
    },
  });
}

module.exports = {
  sensorPerspectiveLock: sensorPerspectiveLock,
  PERSPECTIVE_LOCK_THRESHOLD: PERSPECTIVE_LOCK_THRESHOLD,
};
