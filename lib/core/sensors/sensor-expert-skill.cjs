'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 203-03 Task 1 -- SENS-11 expert-skill detector: Larry PROACTIVELY suggests
 * materializing a reusable SyntheticExpert as a project skill (SEED-035 sub-claim 2).
 *
 * This module carries THREE roles at three different layers, kept separate on purpose:
 *
 *   1. sensorExpertSkill(turn, tuple, ctx) -> reach|null  -- the PURE registered
 *      sensor. It mirrors sensor-recency.cjs:114 / sensor-external-fact.cjs:117
 *      EXACTLY: a sync fn that reads ONLY LOCAL ctx enum/scalars, makes NO db read
 *      and NO Brain call, and returns a SINGLE makeReach({ reach_id:'context_block',
 *      ... }) object or null. It promotes nothing and emits nothing. It is the piece
 *      registered into SENSOR_REGISTRY so dispatchSensors actually fires it.
 *
 *   2. detectExpertSkillCandidates(db, opts)  -- the ctx-assembly PRODUCER helper.
 *      THIS is where the db read lives. It runs at ctx-assembly time (inside the
 *      navigation-engine sensorCtx block, mirroring the MED-01 cortex producer at
 *      navigation-engine.cjs:847-865), reads CONFIRMED-only SyntheticExpert nodes
 *      via the shipped confirmed filter (rankExpertsForSlot's confirmed read), and
 *      returns closed scalars + a LOCAL candidate list. The sensor NEVER touches it.
 *
 *   3. resolveExpertSkillDecision(db, nodeId, decision, opts)  -- the gate action.
 *      APPROVE promotes the expert node through the SINGLE door, the POSITIONAL
 *      confirmNode(db, nodeId, byUser, reason) where byUser is a STRING id from
 *      resolveByUser(roomDir), then returns a materialize intent naming Plan 02's
 *      /mos:skill --from-expert <nodeId>. REJECT/DEFER become typed graph edges
 *      through the navigation chokepoint (writeEdge REJECTED / DEFERRED); a REJECT
 *      with no reason is refused (rejection is data, Decision 13). The sensor never
 *      calls this; only the navigator's Shape-F gate does.
 *
 * FROZEN REACH (Phase 148 lockstep): this sensor mints NO new reach_id. It rides the
 *   existing 'context_block' reach (the LOCAL in-process context surface). The
 *   'save as skill' identity is a sub_mode/offer LABEL on the evidence, never a 7th
 *   reach_id. The module fails closed at load if context_block ever drifts off the
 *   frozen REACH_IDS bank.
 *
 * Canon Part 8: the reach evidence carries CLOSED scalars only (candidate count,
 *   invocation max, tier-signal boolean) -- never a node id, name, or prose. The WHICH
 *   (the specific expert) is resolved LOCALLY at the gate from the producer's candidate
 *   list, never ridden on the reach.
 *
 * Canon Part 9 role 5: only a human promotes. The sensor promotes nothing; the gate
 *   APPROVE promotes only through the positional confirmNode with a string byUser.
 *
 * Pure / sync / LOCAL-first for the sensor. node built-ins + project libs only.
 * House rule: hyphens only, no em-dashes.
 */

const { makeReach, REACH_IDS } = require('./sensor-types.cjs');

// SENS-11: the new sensor id (SENS-01/06 live in insight-sensors; 02-05/07-10 live
// in sibling sensor files; 11 is the next free id).
const SENSOR_ID = 'SENS-11';

// FROZEN: the sensor rides the existing context_block reach (the LOCAL in-process
// context surface). Fail closed at load if it ever drifts off the frozen bank.
const REACH_ID = 'context_block';
if (REACH_IDS.indexOf(REACH_ID) === -1) {
  throw new Error('sensor-expert-skill: REACH_ID "' + REACH_ID + '" is not in the frozen REACH_IDS bank');
}

// The default reusable-invocation threshold N (SEED-035: a confirmed expert reused
// at least N times is a reuse signal). Overridable via the producer opts.
const DEFAULT_THRESHOLD = 3;

// The evidence tiers that mark a confirmed expert reusable on their own, even at
// invocation 0 (a rigorously-grounded expert is worth offering to save as a skill).
const REUSABLE_TIERS = Object.freeze(['Academic', 'Operational']);

function isFiniteNumber(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

/**
 * SENS-11 -- the PURE registered sensor. Fires the context_block reach when the
 * ctx carries the reusable-expert signal (ctx.reusableExpertCandidate === true),
 * surfaced by the ctx-assembly producer. Reads ONLY LOCAL ctx scalars; makes NO db
 * read and NO Brain call; promotes nothing. Soft-fails to null on malformed ctx;
 * never throws.
 *
 * @param {object} _turn  -- the turn signal bag (unused; the signal is state-driven)
 * @param {object} _tuple -- the /mos:diagnose tuple (unused for detection)
 * @param {object} ctx    -- LOCAL context carrying the reusable-expert scalars
 * @returns {Readonly<object>|null}
 */
function sensorExpertSkill(_turn, _tuple, ctx) {
  if (!ctx || typeof ctx !== 'object') return null;
  if (ctx.reusableExpertCandidate !== true) return null; // no confirmed reusable signal

  const invocationMax = (isFiniteNumber(ctx.reusableExpertInvocationMax) && ctx.reusableExpertInvocationMax > 0)
    ? ctx.reusableExpertInvocationMax
    : 0;
  const tierSignal = ctx.reusableExpertTierSignal === true;
  const candidateCount = (isFiniteNumber(ctx.reusableExpertCandidateCount) && ctx.reusableExpertCandidateCount > 0)
    ? ctx.reusableExpertCandidateCount
    : 0;

  return makeReach({
    // FROZEN: rides the existing context_block reach. Mints NO new reach_id.
    reach_id: REACH_ID,
    // push_forward: a reusable expert is forward momentum -- bring the save-as-skill
    // offer forward to the Decision Gate, then push through on the navigator's call.
    posture: 'push_forward',
    // Dispatch names the SHIPPED Plan-02 materializer surface. A handle, not a call.
    dispatch: 'expert-skill materialization offer (mos:skill --from-expert)',
    companions: [],
    signal: 'expert_skill',
    // LOCAL closed scalars only. sub_mode is the 'save as skill' offer LABEL (not a
    // reach_id). The WHICH (the specific expert) is resolved LOCALLY at the gate.
    evidence: {
      candidate_count: candidateCount,
      invocation_max: invocationMax,
      tier_signal: tierSignal,
      sub_mode: 'save_expert_as_skill',
    },
  });
}

// ---------- The ctx-assembly PRODUCER helper (the db read lives HERE) ----------

// The shipped CONFIRMED-only SyntheticExpert read (mirrors expert-library.cjs
// rankExpertsForSlot :155-157). A proposed expert is not yet trusted (Part 9 role
// 5); only a confirmed expert is a save-as-skill candidate.
const CONFIRMED_EXPERT_SQL =
  "SELECT id, properties FROM nodes WHERE type = 'SyntheticExpert' AND review_status = 'confirmed'";

function parseProps(raw) {
  try {
    const p = JSON.parse(raw || '{}');
    return (p && typeof p === 'object' && !Array.isArray(p)) ? p : {};
  } catch (_e) {
    return {};
  }
}

/**
 * detectExpertSkillCandidates(db, opts) -- the ctx-assembly producer. Reads the
 * CONFIRMED SyntheticExpert nodes from the caller-owned db handle at ctx-assembly
 * time (NOT inside the sensor), applies the reuse signal (invocation_count >=
 * threshold OR evidence_tier in {Academic, Operational}), and returns the closed
 * scalars the sensor reads plus a LOCAL candidate list (node ids, for the gate
 * APPROVE handler only -- never ridden on the reach). Defensive; never throws.
 *
 * @param {object} db   -- a caller-owned room.db handle (opened upstream; this
 *                         helper NEVER opens room.db itself, mirroring
 *                         rankExpertsForSlot's caller-owned-handle contract)
 * @param {object} opts -- { threshold?: number }  (default N = DEFAULT_THRESHOLD)
 * @returns {{ reusable:boolean, invocationMax:number, tierSignal:boolean,
 *             candidates:Array<{ nodeId:string, rank:number }> }}
 */
function detectExpertSkillCandidates(db, opts) {
  const options = (opts && typeof opts === 'object') ? opts : {};
  const threshold = isFiniteNumber(options.threshold) ? options.threshold : DEFAULT_THRESHOLD;
  const result = { reusable: false, invocationMax: 0, tierSignal: false, candidates: [] };

  if (!db || typeof db.prepare !== 'function') return result;

  let rows;
  try {
    rows = db.prepare(CONFIRMED_EXPERT_SQL).all();
  } catch (_e) {
    return result; // soft-fail: no signal when the read fails
  }
  if (!Array.isArray(rows)) return result;

  const hits = [];
  for (const row of rows) {
    if (!row || typeof row.id !== 'string') continue;
    const props = parseProps(row.properties);
    const invocation = isFiniteNumber(props.invocation_count) ? props.invocation_count : 0;
    const tier = typeof props.evidence_tier === 'string' ? props.evidence_tier : '';
    const meetsInvocation = invocation >= threshold;
    const meetsTier = REUSABLE_TIERS.indexOf(tier) !== -1;
    if (!meetsInvocation && !meetsTier) continue;

    result.reusable = true;
    if (invocation > result.invocationMax) result.invocationMax = invocation;
    if (meetsTier) result.tierSignal = true;
    hits.push({ nodeId: row.id, invocation: invocation });
  }

  // Rank the LOCAL candidate list by invocation (desc) so the gate APPROVE handler
  // offers the most-reused expert first. LOCAL only -- never ridden on the reach.
  hits.sort(function (a, b) { return b.invocation - a.invocation; });
  result.candidates = hits.map(function (h, i) { return { nodeId: h.nodeId, rank: i }; });

  return result;
}

// ---------- The gate action: APPROVE / REJECT / DEFER (Part 9 role 5 + Part 4) ----------

// The navigation chokepoint is loaded LAZILY (only when the gate action runs), so
// the pure sensor path + the producer never pull in the heavy navigation surface,
// and there is no require cycle (navigation.cjs does not require this module). The
// test seam can inject confirmNode / resolveByUser / writeEdge via opts.
let _nav = null;
function lazyNav() {
  if (_nav) return _nav;
  _nav = require('../navigation.cjs');
  return _nav;
}

/**
 * resolveExpertSkillDecision(db, nodeId, decision, opts) -- the Shape-F gate action.
 *
 *   APPROVE -> promotes the expert node through the SINGLE door, the POSITIONAL
 *     confirmNode(db, nodeId, byUser, reason) where byUser is a STRING id resolved by
 *     resolveByUser(opts.roomDir) (NEVER an { byUser } object -- an object corrupts
 *     the Part 9 human-confirm attribution). Returns a materialize intent naming
 *     Plan 02's /mos:skill --from-expert <nodeId>.
 *   REJECT  -> writes a typed REJECTED edge through the navigation chokepoint
 *     (writeEdge); promotes nothing. A REJECT with NO reason is REFUSED (rejection
 *     is data, Decision 13).
 *   DEFER   -> writes a typed DEFERRED edge; leaves the node proposed.
 *
 * The sensor never calls this; only the navigator's runtime Shape-F gate does.
 * Defensive; never throws on caller input.
 *
 * @param {object} db       -- a caller-owned room.db handle
 * @param {string} nodeId   -- the confirmed-candidate SyntheticExpert node id
 * @param {string} decision -- one of 'APPROVE' | 'REJECT' | 'DEFER'
 * @param {object} opts     -- { roomDir?, reason?, targetId?, confirmNode?,
 *                              resolveByUser?, writeEdge? }  (last three are the seam)
 * @returns {object} a plain result bag (never throws)
 */
function resolveExpertSkillDecision(db, nodeId, decision, opts) {
  const options = (opts && typeof opts === 'object') ? opts : {};
  if (typeof nodeId !== 'string' || nodeId.length === 0) {
    return { ok: false, decision: decision, reason: 'invalid_node_id', promoted: false };
  }

  const nav = lazyNav();
  const confirmNode = (typeof options.confirmNode === 'function') ? options.confirmNode : nav.confirmNode;
  const resolveByUser = (typeof options.resolveByUser === 'function') ? options.resolveByUser : nav.resolveByUser;
  const writeEdge = (typeof options.writeEdge === 'function') ? options.writeEdge : nav.writeEdge;
  const roomDir = typeof options.roomDir === 'string' ? options.roomDir : '';

  if (decision === 'APPROVE') {
    // byUser is a STRING id from resolveByUser -- POSITIONAL, never an { byUser } object.
    const byUser = resolveByUser(roomDir);
    const reason = (typeof options.reason === 'string' && options.reason.length > 0)
      ? options.reason
      : 'navigator approved: save the reusable expert as a project skill';
    const res = confirmNode(db, nodeId, byUser, reason); // the SINGLE positional door
    const promoted = !!(res && res.ok === true);
    return {
      ok: promoted,
      decision: 'APPROVE',
      promoted: promoted,
      byUser: byUser,
      confirm: res,
      // The materialize intent naming Plan 02's /mos:skill --from-expert front door.
      intent: promoted
        ? { action: 'materialize', command: '/mos:skill --from-expert ' + nodeId, nodeId: nodeId }
        : null,
    };
  }

  if (decision === 'REJECT' || decision === 'DEFER') {
    const reason = (typeof options.reason === 'string') ? options.reason.trim() : '';
    // Rejection is data (Decision 13): a reasonless REJECT is refused.
    if (decision === 'REJECT' && reason.length === 0) {
      return { ok: false, decision: decision, reason: 'reason_required', promoted: false };
    }
    const edgeType = (decision === 'REJECT') ? 'REJECTED' : 'DEFERRED';
    // The typed edge target: the LOCAL save-as-skill offer handle (a generic marker,
    // never user content). The reason rides as typed graph data (Part 4).
    const targetId = (typeof options.targetId === 'string' && options.targetId.length > 0)
      ? options.targetId
      : 'offer:expert-skill';
    const res = writeEdge(db, {
      source_id: nodeId,
      target_id: targetId,
      edge_type: edgeType,
      properties: { decision: decision, reason: reason, sub_mode: 'save_expert_as_skill' },
    });
    return { ok: !!(res && res.ok === true), decision: decision, promoted: false, edge: res };
  }

  return { ok: false, decision: decision, reason: 'unknown_decision', promoted: false };
}

module.exports = {
  sensorExpertSkill: sensorExpertSkill,
  detectExpertSkillCandidates: detectExpertSkillCandidates,
  resolveExpertSkillDecision: resolveExpertSkillDecision,
  SENSOR_ID: SENSOR_ID,
  REACH_ID: REACH_ID,
  DEFAULT_THRESHOLD: DEFAULT_THRESHOLD,
  REUSABLE_TIERS: REUSABLE_TIERS,
};
