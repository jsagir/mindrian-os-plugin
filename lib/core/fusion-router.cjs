'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 205-07 (scope item 1) -- the FUSION cross-frame stage as a ROUTER (not a
 * monolith). FUSION fires when the navigator is stuck ACROSS frames: two-plus
 * live topics share a job / structure / conclusion and Larry never connects them
 * (the Test 6 five-misses failure, Larry's measured weak point).
 * ============================================================================
 * The loop: understand -> map frames -> research -> synthesize per frame ->
 * FUSION -> write. FUSION routes:
 *
 *   (1) ASSEMBLE  -- read the live Frame nodes (205-02 typed-frame.readOpenFrames)
 *                    plus any generic frame descriptors the caller passes; two-plus
 *                    open frames are the precondition for any cross-frame move.
 *   (2) BRAIN_ASK -- wrap the decision in a DirectiveEnvelope via the Phase 191
 *                    directive-envelope.cjs path (move + next_gate + mode_signals).
 *                    Canon Part 8: only GENERIC frame/job/structure HANDLES cross
 *                    to the Brain; no user prose, no frame membership prose, ever.
 *   (3) JOB-TEST  -- the JTBD classifier: two frames serving the SAME job -> go UP
 *                    (HORIZONTAL: name the containing system); same STRUCTURE with
 *                    a DIVERGENT surface -> go SIDEWAYS (LATERAL: the reverse-salient
 *                    signature, routed to the Phase 200 RS engine -- scaffolded).
 *   (4) GATE      -- D-Q4 0.70 detent via decision-axes.cjs: at/above 0.70 the move
 *                    is act-and-report (still HEDGED); below 0.70 it is an
 *                    offer-as-question. Hedging is ALWAYS on (tell-and-confident is
 *                    structurally unreachable in decision-axes).
 *   (5) HORIZONTAL MOVE -- name the containing system, write SHARES_JOB (frame ->
 *                    frame) + ELEVATES_TO (frame -> containing-system) through the
 *                    navigation.writeEdge chokepoint (LOCAL room.db, Canon Part 9).
 *
 * Canon Part 7 (reuse before build): FUSION mints NO new reach_id. It is a nav-dial
 *   move that routes through the EXISTING frozen `deep_research` reach (the same
 *   frozen-six routing the GRILL / REFRAME gear exits use in sensor-circularity.cjs).
 *   The frozen six stay {context_block, contradiction, cross_room, brain_consult,
 *   deep_research, hats}; FUSION is a POSITION, not a reach (item-7 invariant,
 *   tests/test-205-frozen-six-guard.cjs).
 *
 * Canon Part 3 / hedged-always: FUSION OFFERS, never asserts. Every horizontal
 *   hypothesis is phrased "these MIGHT be the same argument -- here is why I think
 *   so", never "these ARE the same". The 0.70 detent governs act-vs-offer; the
 *   DEFAULT is offer. This reuses decision-axes.cjs so tell-and-confident cannot be
 *   expressed.
 *
 * Canon Part 9: every graph read/write goes through the navigation chokepoint
 *   family -- reads via the typed-frame navigation submodule (readOpenFrames),
 *   writes via navigation.writeEdge / navigation.writeFrameNode. No second door.
 *
 * Open question Q2 (job-test visibility) resolved with the recommended default:
 *   INVISIBLE for peers / professors (role_level researcher | professor), VISIBLE
 *   for learners (role_level student | practitioner). See isJobTestVisible below.
 *
 * Constraints: CJS, Node built-ins only, zero new runtime deps, LOCAL only
 * (Part 8: the module makes NO network call of its own -- the brain_ask wrapper is
 * a pure data shaper). House rule: hyphens only, NO em-dashes.
 *
 * License: BSL 1.1.
 */

const directiveEnvelope = require('./directive-envelope.cjs');
const decisionAxes = require('./decision-axes.cjs');
const navigation = require('./navigation.cjs');
// The read counterpart lives in the typed-frame navigation submodule (Part 9
// chokepoint family). navigation.cjs re-exports writeFrameNode / FRAME_NODE_ID /
// writeEdge; readOpenFrames is read straight off the submodule (same allow-list).
const typedFrame = require('./navigation/typed-frame.cjs');

// FUSION_REACH_ID -- FUSION routes through the EXISTING frozen `deep_research`
// reach (item-7: mint NO new reach_id). This is a string reference to a frozen-six
// member, NOT a new reach declaration. The frozen-six guard asserts FUSION is not a
// REACH_IDS member; this const is the routing target, the same way the GRILL /
// REFRAME exits in sensor-circularity.cjs route to 'deep_research'.
const FUSION_REACH_ID = 'deep_research';

// The Q2 detent: which role_levels SEE the job-test. Recommended default --
// invisible for peers/professors (the reasoning is internal to a peer), visible for
// learners (the reasoning is the teaching). Frozen enum split.
const JOB_TEST_VISIBLE_ROLES = Object.freeze(new Set(['student', 'practitioner']));
const JOB_TEST_INVISIBLE_ROLES = Object.freeze(new Set(['researcher', 'professor']));

function isPlainObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Q2 job-test visibility gate. VISIBLE for learners (student / practitioner),
 * INVISIBLE for peers (researcher / professor). Unknown / cold-start role_level
 * defaults to VISIBLE (a cold room is treated as a learner -- teach by default).
 * @param {string|null} role_level
 * @returns {boolean}
 */
function isJobTestVisible(role_level) {
  if (typeof role_level !== 'string' || role_level.length === 0) {
    return true; // cold start -> learner default -> visible.
  }
  if (JOB_TEST_INVISIBLE_ROLES.has(role_level)) {
    return false;
  }
  if (JOB_TEST_VISIBLE_ROLES.has(role_level)) {
    return true;
  }
  return true; // unknown role -> teach by default.
}

/**
 * Assemble the set of open frames. Reads the LIVE Frame nodes back through the
 * typed-frame navigation submodule (Canon Part 9) and merges in any GENERIC frame
 * descriptors the caller passes on ctx.frames. A descriptor carries only generic
 * handles: { frameKey, job, structure, surface, node_id? }. Live-node data
 * (node_id / members) is joined by frameKey when the caller descriptor omits it.
 * Part 8: no prose is read or joined -- membership stays generic handles only.
 *
 * @param {object} ctx {db, sessionId, frames?}
 * @returns {Array<object>} assembled frames [{ frameKey, node_id, job, structure, surface, members }]
 */
function assembleOpenFrames(ctx) {
  const c = isPlainObject(ctx) ? ctx : {};
  const sessionId = typeof c.sessionId === 'string' ? c.sessionId : '';
  const live = (c.db) ? typedFrame.readOpenFrames(c.db, { sessionId }) : [];
  const liveByKey = new Map();
  for (const f of live) {
    if (f && typeof f.frameKey === 'string' && f.frameKey.length > 0) {
      liveByKey.set(f.frameKey, f);
    }
  }
  const descriptors = Array.isArray(c.frames) ? c.frames : [];
  const out = [];
  const seenKeys = new Set();
  // Caller descriptors first (they carry the job / structure / surface handles the
  // job-test needs); join the live node_id / members by frameKey.
  for (const d of descriptors) {
    if (!isPlainObject(d) || typeof d.frameKey !== 'string' || d.frameKey.length === 0) {
      continue;
    }
    const liveMatch = liveByKey.get(d.frameKey) || null;
    const node_id = (typeof d.node_id === 'string' && d.node_id)
      ? d.node_id
      : (liveMatch ? liveMatch.node_id : navigation.FRAME_NODE_ID(sessionId, d.frameKey));
    out.push({
      frameKey: d.frameKey,
      node_id,
      job: typeof d.job === 'string' ? d.job : '',
      structure: typeof d.structure === 'string' ? d.structure : '',
      surface: typeof d.surface === 'string' ? d.surface : '',
      members: liveMatch ? liveMatch.members : (Array.isArray(d.members) ? d.members : []),
    });
    seenKeys.add(d.frameKey);
  }
  // Any live frame with no caller descriptor still counts toward the two-plus
  // precondition (its job / structure handles ride in its topic handle if present).
  for (const f of live) {
    if (seenKeys.has(f.frameKey)) {
      continue;
    }
    out.push({
      frameKey: f.frameKey,
      node_id: f.node_id,
      job: '',
      structure: typeof f.topic === 'string' ? f.topic : '',
      surface: '',
      members: f.members,
    });
  }
  return out;
}

/**
 * Build the Part-8-fenced brain_ask handle payload. Only GENERIC frame / job /
 * structure handles egress -- never prose, never membership prose, never frame
 * body text. This is the constitutional fence: whatever this returns is all that
 * would cross the LOCAL -> BRAIN boundary.
 * @param {Array<object>} frames
 * @returns {{frame_handles: string[], job_handles: string[], structure_handles: string[]}}
 */
function buildBrainHandles(frames) {
  const frame_handles = [];
  const job_handles = [];
  const structure_handles = [];
  for (const f of frames) {
    if (typeof f.node_id === 'string' && f.node_id) frame_handles.push(f.node_id);
    if (typeof f.job === 'string' && f.job) job_handles.push(f.job);
    if (typeof f.structure === 'string' && f.structure) structure_handles.push(f.structure);
  }
  return { frame_handles, job_handles, structure_handles };
}

/**
 * The JTBD job-test. Pairwise classify:
 *   HORIZONTAL -- two frames serve the SAME job (job handle equal) -> go UP.
 *   LATERAL    -- two frames share the SAME structure but DIVERGE on surface
 *                 (the reverse-salient signature) -> go SIDEWAYS.
 * Horizontal takes precedence (the highest-value move). Returns the first matching
 * pair, or classification 'none' when no cross-frame relation is found.
 * @param {Array<object>} frames
 * @returns {{classification: string, pair: [object, object]|null, job?: string, structure?: string}}
 */
function jobTest(frames) {
  const n = frames.length;
  // Pass 1: same-job -> horizontal (precedence).
  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      const a = frames[i];
      const b = frames[j];
      if (a.job && b.job && a.job === b.job) {
        return { classification: 'horizontal', pair: [a, b], job: a.job };
      }
    }
  }
  // Pass 2: same-structure + divergent-surface -> lateral.
  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      const a = frames[i];
      const b = frames[j];
      if (a.structure && b.structure && a.structure === b.structure
          && a.surface !== b.surface) {
        return { classification: 'lateral', pair: [a, b], structure: a.structure };
      }
    }
  }
  return { classification: 'none', pair: null };
}

/**
 * Resolve the confidence scalar that feeds the D-Q4 0.70 gate. Preference:
 * ctx.confidence (the decide()-spine scalar), then a Brain-supplied
 * next_gate.confidence, else 0 (which resolves to offer-as-question -- the safe
 * default). The confidence never comes from the frame prose (Part 8).
 * @param {object} ctx
 * @returns {number}
 */
function resolveConfidence(ctx) {
  if (typeof ctx.confidence === 'number' && Number.isFinite(ctx.confidence)) {
    return ctx.confidence;
  }
  const br = ctx.brainResponse;
  if (isPlainObject(br) && isPlainObject(br.next_gate)
      && typeof br.next_gate.confidence === 'number'
      && Number.isFinite(br.next_gate.confidence)) {
    return br.next_gate.confidence;
  }
  return 0;
}

/**
 * Build the HEDGED horizontal offer. FUSION offers, never asserts (Canon Part 3):
 * the text always carries "might" + "here is why I think", never "these ARE".
 * `act_and_report` colors it as a report; below the detent it is an explicit
 * question -- both hedged.
 * @param {string} job
 * @param {string} containingSystem
 * @param {string} actOrOffer  'act_and_report' | 'offer_as_question'
 * @returns {{text: string, hedged: boolean, asserted: boolean, act_or_offer: string}}
 */
function buildHorizontalOffer(job, containingSystem, actOrOffer) {
  const why = 'here is why I think so: both frames answer the same job (' + job + ')';
  const lead = 'These two frames MIGHT be the same argument';
  const tail = (actOrOffer === 'act_and_report')
    ? '. ' + why + ', so they may elevate to ' + containingSystem + '.'
    : '. ' + why + ' -- do they belong to ' + containingSystem + '?';
  return {
    text: lead + tail,
    hedged: true,
    asserted: false,
    act_or_offer: actOrOffer,
  };
}

// The lateral / sideways path is defined in the Task 2 scaffold section below.

/**
 * runFusion(ctx) -- the FUSION cross-frame router.
 *
 * ctx = {
 *   db,             // caller-owned room.db handle (openRoomDb); reads via chokepoint
 *   sessionId,      // session scope for the live Frame nodes
 *   frames,         // OPTIONAL generic frame descriptors [{frameKey, job, structure, surface, node_id?}]
 *   brainResponse,  // OPTIONAL Brain response to wrap (null -> Tier-0 DirectiveEnvelope)
 *   modeSignals,    // generic mode signals for the DirectiveEnvelope + gate
 *   confidence,     // scalar for the D-Q4 0.70 gate (or brainResponse.next_gate.confidence)
 *   role_level,     // Q2 visibility gate (student|practitioner -> visible)
 *   persona,        // annotation for the initiative rationale
 *   requires_judgment, // P0-6 hard override -> ask-first
 *   lateralEngine,  // OPTIONAL injected Phase 200 RS discriminator (scaffold seam)
 * }
 *
 * Returns a structured, hedged result; never throws on caller input.
 */
function runFusion(ctx) {
  const c = isPlainObject(ctx) ? ctx : {};
  const modeSignals = isPlainObject(c.modeSignals) ? c.modeSignals : {};

  // (1) ASSEMBLE.
  const frames = assembleOpenFrames(c);
  if (frames.length < 2) {
    return {
      fired: false,
      reason: 'insufficient_frames',
      classification: 'none',
      reach_id: FUSION_REACH_ID,
      frames_assembled: frames.length,
    };
  }

  // (2) BRAIN_ASK -- Part-8 fence: only generic handles cross. The DirectiveEnvelope
  // is built through the Phase 191 wrapper (a pure data shaper, zero network here).
  const brainHandles = buildBrainHandles(frames);
  const envelope = directiveEnvelope.wrapDirective(
    (c.brainResponse === undefined ? null : c.brainResponse),
    modeSignals,
  );

  // (3) JOB-TEST.
  const test = jobTest(frames);

  // (4) GATE -- D-Q4 0.70 detent (hedged-always via decision-axes).
  const confidence = resolveConfidence(c);
  const decision = decisionAxes.resolveDecisionMode({
    confidence,
    mode_signals: modeSignals,
    persona: typeof c.persona === 'string' ? c.persona : null,
    requires_judgment: c.requires_judgment === true,
  });
  const actOrOffer = (confidence >= decisionAxes.ACT_TELL_DETENT
    && decision.initiative_axis === 'act_first')
    ? 'act_and_report' : 'offer_as_question';

  const gate = {
    mode: decision.mode,                 // ask_and_hedged | tell_and_hedged
    confidence_axis: decision.confidence_axis, // always 'hedged'
    initiative_axis: decision.initiative_axis,
    confidence,
    detent: decisionAxes.ACT_TELL_DETENT, // 0.70 (frozen Shape-F, D-Q4)
    act_or_offer: actOrOffer,
    rationale: decision.rationale,
  };

  const base = {
    fired: false,
    classification: test.classification,
    reach_id: FUSION_REACH_ID,          // frozen six; FUSION mints NO reach
    gate,
    brain_handles: brainHandles,        // the ONLY thing that would egress (Part 8)
    envelope_mode: envelope.mode,
    job_test_visible: isJobTestVisible(typeof c.role_level === 'string' ? c.role_level : null),
    frames_assembled: frames.length,
  };

  if (test.classification === 'horizontal') {
    // (5) HORIZONTAL MOVE -- name the containing system, write the two edges.
    const [fa, fb] = test.pair;
    const containingSystem = 'system:' + test.job;
    const offer = buildHorizontalOffer(test.job, containingSystem, actOrOffer);
    const edges_written = [];
    if (c.db) {
      const sharesJob = navigation.writeEdge(c.db, {
        source_id: fa.node_id,
        target_id: fb.node_id,
        edge_type: 'SHARES_JOB',
        properties: { job: test.job, confidence },
      });
      if (sharesJob && sharesJob.ok) {
        edges_written.push({ type: 'SHARES_JOB', source: fa.node_id, target: fb.node_id });
      }
      const elevates = navigation.writeEdge(c.db, {
        source_id: fa.node_id,
        target_id: containingSystem,
        edge_type: 'ELEVATES_TO',
        properties: { relation: 'elevates', job: test.job },
      });
      if (elevates && elevates.ok) {
        edges_written.push({ type: 'ELEVATES_TO', source: fa.node_id, target: containingSystem });
      }
    }
    return Object.assign(base, {
      fired: true,
      job: test.job,
      containing_system: containingSystem,
      offer,
      edges_written,
    });
  }

  if (test.classification === 'lateral') {
    // (3b) LATERAL -> the sideways path (Task 2 scaffold, gated on Phase 200).
    const lateral = runLateralPath(c, test.pair, test.structure);
    return Object.assign(base, {
      fired: false,           // lateral does not auto-fire a horizontal move
      lateral,
    });
  }

  // No cross-frame relation found this pass.
  return base;
}

// ---------------------------------------------------------------------------
// Task 2: session-end quorum (D-Q1) + lateral-path scaffold (BLOCKED-UNTIL-200)
// (defined below runFusion; runFusion references runLateralPath by hoisting.)
// ---------------------------------------------------------------------------

// CONTINUOUS_CADENCE_ENABLED -- the D-Q1 continuous per-turn scanning seam. OFF by
// default: D-Q1 is boundary-pass-FIRST; continuous is added ONLY if the Bruce
// catch-rate is low (the German-resilience miss was mid-conversation, so continuous
// is the likely follow-on). The seam exists so the follow-on is a one-line flip, but
// it is NOT active now. DO NOT enable without the Bruce catch-rate signal.
const CONTINUOUS_CADENCE_ENABLED = false;

/**
 * runLateralPath(ctx, pair, structure) -- the LATERAL / SIDEWAYS scaffold.
 *
 * BLOCKED-UNTIL-200: the lateral path leans on the Phase 200 RS reverse-salient
 * discriminator (rs-differential-scorer.cjs) to score same-structure / divergent-
 * surface pairs and route to the sideways engine (reverse-salient + find-analogies
 * + web fetch). Phase 200 IS shipped, but wiring the heavy async RS scorer
 * (Python / Pinecone / Neo4j bridges) into this synchronous router is out of scope
 * for 205-07; the lateral handler is a GATED STUB.
 *
 * When a live RS discriminator is injected on ctx.lateralEngine (an object with a
 * `score` function), the handler routes to it. Otherwise it DEGRADES CLEANLY:
 * returns a clearly-marked not-available result with differential_score EXPLICITLY
 * null (T-205-07-R: NEVER fabricate a differential_score) and does NOT throw.
 *
 * @param {object} ctx
 * @param {[object, object]} pair
 * @param {string} structure
 * @returns {object}
 */
function runLateralPath(ctx, pair, structure) {
  const rs = ctx && ctx.lateralEngine;
  const p = Array.isArray(pair) ? pair : [null, null];
  const pairKeys = [
    p[0] && p[0].frameKey ? p[0].frameKey : null,
    p[1] && p[1].frameKey ? p[1].frameKey : null,
  ];
  if (!rs || typeof rs.score !== 'function') {
    // Clean degradation: RS not live. No fabricated score, no throw.
    return {
      available: false,
      reason: 'blocked_until_phase_200_rs',
      structure: typeof structure === 'string' ? structure : '',
      pair: pairKeys,
      differential_score: null, // T-205-07-R: never fabricated when RS is absent.
      offered: false,
    };
  }
  // RS is live: route to the sideways engine. The actual reverse-salient scoring is
  // async and owned by the RS engine; the router hands off the pair + structure and
  // leaves differential_score to the engine (null here -- computed downstream, not
  // fabricated).
  return {
    available: true,
    routed_to: 'rs_sideways_engine',
    structure: typeof structure === 'string' ? structure : '',
    pair: pairKeys,
    differential_score: null, // computed by the async RS engine, not by the router.
    offered: true,
  };
}

/**
 * sessionEndQuorum(ctx) -- the D-Q1 boundary-pass-first cross-frame synthesis.
 *
 * Runs the cheap cross-frame synthesis at the session boundary. If two-plus frames
 * are live AND no horizontal move fired during the session, FORCE exactly ONE
 * OFFERED cross-frame hypothesis (hedged, offer-as-question). The forced hypothesis
 * is OFFERED ONLY -- it is NEVER auto-committed to the graph as a decision
 * (T-205-07-E: no edge, no decision node is written here). When a horizontal move
 * already fired during the session, the quorum forces zero (the connection was made).
 *
 * ctx adds: horizontalFiredThisSession (boolean) -- did runFusion fire a horizontal
 *   move during the session. Absent / false -> the quorum may force one.
 *
 * @param {object} ctx
 * @returns {object}
 */
function sessionEndQuorum(ctx) {
  const c = isPlainObject(ctx) ? ctx : {};
  const frames = assembleOpenFrames(c);
  const alreadyFired = c.horizontalFiredThisSession === true;

  // D-Q1 boundary-pass: only force when 2+ frames are live AND nothing connected.
  if (frames.length < 2 || alreadyFired) {
    return {
      forced: false,
      reason: alreadyFired ? 'horizontal_move_already_fired' : 'insufficient_frames',
      frames_live: frames.length,
      continuous_cadence_enabled: CONTINUOUS_CADENCE_ENABLED, // seam status (off).
    };
  }

  // Force EXACTLY ONE offered hypothesis over the strongest candidate pair. Prefer a
  // job-test relation if one exists; else offer the first two open frames as a
  // "these MIGHT connect" hypothesis. Either way: OFFERED, never committed.
  const test = jobTest(frames);
  const pair = test.pair || [frames[0], frames[1]];
  const a = pair[0];
  const b = pair[1];
  const relation = test.classification !== 'none' ? test.classification : 'unclassified';
  const hypothesis = {
    offered: true,
    committed: false, // T-205-07-E: never auto-committed as a decision.
    hedged: true,
    asserted: false,
    relation,
    pair: [a.frameKey, b.frameKey],
    reach_id: FUSION_REACH_ID, // still routes the frozen deep_research reach.
    text: 'Before we close: these two frames (' + a.frameKey + ', ' + b.frameKey
      + ') MIGHT connect -- worth a look next session?',
  };
  return {
    forced: true,
    count: 1, // EXACTLY one offered hypothesis (D-Q1).
    hypothesis,
    frames_live: frames.length,
    continuous_cadence_enabled: CONTINUOUS_CADENCE_ENABLED, // seam present, off.
  };
}

module.exports = {
  runFusion,
  sessionEndQuorum,
  // Seams + helpers exported for the test harness (read-only).
  FUSION_REACH_ID,
  isJobTestVisible,
  assembleOpenFrames,
  jobTest,
  buildBrainHandles,
  runLateralPath,
  CONTINUOUS_CADENCE_ENABLED,
};
