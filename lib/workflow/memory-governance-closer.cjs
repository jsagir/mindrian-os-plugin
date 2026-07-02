'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 189-02 -- HMG-02/HMG-03: the F.8 governance CONFIRM gate + per-item closer.
 * ============================================================================
 * This module COMPOSES the shipped Phase-188 F.8 machinery -- it mints NO new
 * selector shape and NO new frozen scalar. It clones the cross-room-umbilical-closer
 * (Phase 195-05) structural template exactly:
 *   - the render leg is governance-candidate-raiser.renderGovernanceBasket (reused),
 *   - the fan-out is f8-fanout-consumer.consumeF8Fanout (reused; 1 confirm -> N
 *     typed edges; it loops the confirmed toggle array and calls the per-item
 *     closer supplied HERE),
 *   - every write routes through navigation.writeEdge -- the Part-9 chokepoint.
 *
 * The per-item closer is the net-new piece:
 *   - a toggled-ON candidate writes ONE REMEMBERED_AS edge (the WHAT/HOW decision:
 *     which Part-4 verb rides as the filed_as scalar, plus truth_state + confidence,
 *     all enum/scalar-only per Part 8),
 *   - when truth_state is 'confirmed' it ALSO promotes the node via
 *     navigation.promoteNodeStatus with a NON-NULL human byUser (Part 9 role 5: a
 *     truth-claim promotion always carries a human attribution; this closer NEVER
 *     promotes without one),
 *   - a toggled-OFF candidate writes ONE NOT_REMEMBERED_BECAUSE edge (rejection is
 *     data, Canon Part 4). A per-item reject is a SUCCESSFUL close (ok:true) -- it
 *     never aborts the confirmed fan-out (degrade-never-block, inherited verbatim
 *     from consumeF8Fanout).
 *
 * hitl_shape: F.8. Pre-check is DISPLAY-ONLY: nothing attaches until the single
 * confirm (the closer only ever sees the CONFIRMED accepted Set).
 *
 * Part 9 substrate guard: this module NEVER opens the room database itself. The
 * caller owns the handle (args.db) and passes it through; every write routes
 * through the navigation chokepoint. No direct room-db open, no local database
 * driver require here (the source-grep leg proves the forbidden requires are
 * absent). navigation.cjs is loaded via a lazy, tolerant require (mirrors
 * f8-fanout-consumer's safe-require) so a load failure degrades to a structured
 * no-op instead of crashing the turn.
 *
 * Pure CJS, node built-ins only. Hyphens only, no em-dashes. No emoji. No Brain call.
 */

const path = require('node:path');

const REPO = path.resolve(__dirname, '..', '..');

// The HITL shape this gate declares. It COMPOSES F.8; it mints no new one.
const HITL_SHAPE = 'F.8';

const REMEMBERED_EDGE_TYPE = 'REMEMBERED_AS';
const NOT_REMEMBERED_EDGE_TYPE = 'NOT_REMEMBERED_BECAUSE';

// The default HOW verb when the raiser carried no explicit filed_as. INFORMS is
// the shipped Part-4 cascade verb (edges.cjs allow-list) -- a safe generic filing.
const DEFAULT_FILED_AS = 'INFORMS';
// The default rejection reason for a toggled-OFF candidate (an enum handle, never
// prose). Mirrors the NOT_LINKED_BECAUSE navigator_declined precedent.
const DEFAULT_REJECT_REASON = 'navigator_declined';

// Lazy + tolerant require (mirrors f8-fanout-consumer / f1-pick-consumer): a
// navigation load failure degrades to a structured no-op rather than crashing.
function _safeRequire(p) {
  try {
    return require(p);
  } catch (_e) {
    return null;
  }
}

// Resolve the navigation chokepoint. The caller MAY inject gateCtx.nav (a spy or a
// surface) so the gate is testable WITHOUT a live room database (Part 9). Otherwise
// lazy-require the shipped navigation.cjs; a load failure degrades to null.
function _resolveNav(gateCtx) {
  if (gateCtx && typeof gateCtx === 'object'
      && gateCtx.nav && typeof gateCtx.nav.writeEdge === 'function') {
    return gateCtx.nav;
  }
  return _safeRequire(path.join(REPO, 'lib', 'core', 'navigation.cjs'));
}

// The Part-8-safe toggle label for a candidate: its candidate_id (a structural
// handle). Never prose. Used as the F.8 option label + the consumeF8Fanout verb.
function labelFor(cand) {
  if (cand && typeof cand.candidate_id === 'string' && cand.candidate_id.length > 0) {
    return cand.candidate_id;
  }
  return null;
}

// The edge target for a candidate: its target_section when set, else the candidate
// id itself (the no-single-section case). Never a body / prose.
function _targetFor(cand) {
  if (cand && typeof cand.target_section === 'string' && cand.target_section.length > 0) {
    return cand.target_section;
  }
  return (cand && typeof cand.candidate_id === 'string') ? cand.candidate_id : null;
}

/**
 * makeGovernanceCloser(gateCtx) -> { closeOffer }
 *
 * The closer consumeF8Fanout calls PER confirmed item. Two-branch idiom mirroring
 * makeUmbilicalCloser:
 *   accept -> ONE REMEMBERED_AS edge via navigation.writeEdge; when truth_state is
 *             'confirmed', ALSO promoteNodeStatus(proposed -> confirmed) with the
 *             human byUser (never absent).
 *   reject -> ONE NOT_REMEMBERED_BECAUSE edge (rejection-is-data).
 * Both branches return ok:true on a successful write so a per-item reject never
 * aborts the confirmed fan-out.
 */
function makeGovernanceCloser(gateCtx) {
  return {
    closeOffer: function (closeArgs) {
      const a = (closeArgs && typeof closeArgs === 'object') ? closeArgs : {};
      const label = (a.offer && typeof a.offer.command === 'string') ? a.offer.command : null;
      const cand = label ? gateCtx.byLabel[label] : null;
      if (!cand) return { ok: false, reason: 'unknown_candidate' };

      const nav = _resolveNav(gateCtx);
      if (!nav || typeof nav.writeEdge !== 'function') {
        return { ok: false, reason: 'navigation_unavailable' };
      }

      const source_id = cand.candidate_id;
      const target_id = _targetFor(cand);
      if (typeof source_id !== 'string' || source_id.length === 0
          || typeof target_id !== 'string' || target_id.length === 0) {
        return { ok: false, reason: 'invalid_candidate' };
      }

      if (a.pick === 'accept') {
        const filed_as = (typeof cand.filed_as === 'string' && cand.filed_as.length > 0)
          ? cand.filed_as
          : DEFAULT_FILED_AS;
        const truth_state = (cand.truth_state === 'confirmed') ? 'confirmed' : 'proposed';
        const confidence = (typeof cand.confidence === 'number' && Number.isFinite(cand.confidence))
          ? cand.confidence
          : null;

        const w = nav.writeEdge(gateCtx.db, {
          source_id: source_id,
          target_id: target_id,
          edge_type: REMEMBERED_EDGE_TYPE,
          properties: {
            filed_as: filed_as,
            truth_state: truth_state,
            confidence: confidence,
          },
        });
        if (!w || w.ok !== true) {
          return { ok: false, reason: (w && w.reason) ? w.reason : 'edge_write_failed' };
        }

        // Part 9 role 5: a truth-claim promotion ALWAYS carries a human byUser. We
        // only promote when a non-empty byUser was supplied -- this closer NEVER
        // calls promoteNodeStatus with byUser absent.
        let promoted = false;
        if (truth_state === 'confirmed'
            && typeof gateCtx.byUser === 'string' && gateCtx.byUser.length > 0
            && typeof nav.promoteNodeStatus === 'function') {
          try {
            const pr = nav.promoteNodeStatus(
              gateCtx.db, source_id, 'proposed', 'confirmed',
              gateCtx.byUser, 'governance_basket_confirm'
            );
            promoted = !!(pr && pr.ok === true);
          } catch (_e) {
            promoted = false;
          }
        }

        gateCtx.remembered.push({
          candidate_id: source_id,
          target_id: target_id,
          filed_as: filed_as,
          truth_state: truth_state,
          promoted: promoted,
          edge_type: REMEMBERED_EDGE_TYPE,
        });
        return { ok: true, edge_type: REMEMBERED_EDGE_TYPE };
      }

      if (a.pick === 'reject') {
        const reason = (typeof cand.reason === 'string' && cand.reason.length > 0)
          ? cand.reason
          : DEFAULT_REJECT_REASON;
        const w = nav.writeEdge(gateCtx.db, {
          source_id: source_id,
          target_id: target_id,
          edge_type: NOT_REMEMBERED_EDGE_TYPE,
          properties: { reason: reason },
        });
        if (!w || w.ok !== true) {
          return { ok: false, reason: (w && w.reason) ? w.reason : 'rejection_write_failed' };
        }
        gateCtx.not_remembered.push({
          candidate_id: source_id,
          target_id: target_id,
          reason: reason,
          edge_type: NOT_REMEMBERED_EDGE_TYPE,
        });
        return { ok: true, edge_type: NOT_REMEMBERED_EDGE_TYPE };
      }

      // defer / any other outcome: no governance write (never auto-file).
      return { ok: false, reason: 'unsupported_outcome' };
    },
  };
}

/**
 * runGovernanceGate(args) -> { ok, hitl_shape, rendered, appliedCount, remembered, not_remembered, items }
 *
 * Composes render + consumeF8Fanout on ONE confirm, mirroring runUmbilicalGate. A
 * candidate is REMEMBERED_AS only when its label appears in `accepted` (the CONFIRMED
 * toggle state); every other candidate is a NOT_REMEMBERED_BECAUSE. Pre-check
 * (>=0.70) is display-only and does NOT imply acceptance.
 *
 * args:
 *   db        -- caller-owned room database handle (Part 9: this module never opens it).
 *   byUser    -- the human navigator identity for a confirmed-status promotion.
 *   candidates-- [{ candidate_id, kind, confidence, target_section?, filed_as?, truth_state?, reason? }].
 *   accepted  -- array of candidate_id labels the navigator confirmed ON.
 *                Omit / empty => every candidate becomes a NOT_REMEMBERED_BECAUSE.
 *   nav       -- (test seam) defaults to the lazy-required navigation chokepoint.
 *   header / personaContext -- forwarded to the basket renderer.
 */
function runGovernanceGate(args) {
  const a = (args && typeof args === 'object') ? args : {};
  const candidates = Array.isArray(a.candidates) ? a.candidates : [];
  const acceptedSet = new Set(Array.isArray(a.accepted) ? a.accepted : []);

  const raiser = _safeRequire(path.join(REPO, 'lib', 'core', 'memory', 'governance-candidate-raiser.cjs'));
  const rendered = (raiser && typeof raiser.renderGovernanceBasket === 'function')
    ? raiser.renderGovernanceBasket(candidates, { header: a.header, personaContext: a.personaContext })
    : { zones: {}, contract: { hitl_shape: HITL_SHAPE } };

  // Map each toggle label back to its candidate; build the fan-out verbs + picks.
  const byLabel = {};
  const verbs = [];
  const picks = [];
  for (const c of candidates) {
    const label = labelFor(c);
    if (!label || byLabel[label]) continue; // skip malformed / duplicate
    byLabel[label] = c;
    verbs.push(label);
    picks.push({ verb: label, outcome: acceptedSet.has(label) ? 'accept' : 'reject' });
  }

  const gateCtx = {
    db: a.db,
    byUser: (typeof a.byUser === 'string' && a.byUser.length > 0) ? a.byUser : null,
    nav: a.nav,
    byLabel: byLabel,
    remembered: [],
    not_remembered: [],
  };

  const fanout = _safeRequire(path.join(REPO, 'lib', 'workflow', 'f8-fanout-consumer.cjs'));
  if (!fanout || typeof fanout.consumeF8Fanout !== 'function') {
    return {
      ok: false,
      reason: 'fanout_unavailable',
      hitl_shape: HITL_SHAPE,
      rendered: rendered,
      appliedCount: 0,
      remembered: [],
      not_remembered: [],
      items: [],
    };
  }

  const roomState = {
    closer: makeGovernanceCloser(gateCtx),
    offer: {}, // shared scaffold; the per-item command carries the label
    db: a.db,  // Part 9: the closer routes writes through navigation, never opens db
  };

  const fan = fanout.consumeF8Fanout({
    priorPayload: { verbs: verbs },
    picks: picks,
    roomState: roomState,
  });

  return {
    ok: !!(fan && fan.ok),
    hitl_shape: HITL_SHAPE,
    rendered: rendered,
    appliedCount: (fan && typeof fan.appliedCount === 'number') ? fan.appliedCount : 0,
    remembered: gateCtx.remembered,
    not_remembered: gateCtx.not_remembered,
    items: (fan && Array.isArray(fan.items)) ? fan.items : [],
  };
}

module.exports = {
  HITL_SHAPE: HITL_SHAPE,
  REMEMBERED_EDGE_TYPE: REMEMBERED_EDGE_TYPE,
  NOT_REMEMBERED_EDGE_TYPE: NOT_REMEMBERED_EDGE_TYPE,
  DEFAULT_FILED_AS: DEFAULT_FILED_AS,
  DEFAULT_REJECT_REASON: DEFAULT_REJECT_REASON,
  labelFor: labelFor,
  makeGovernanceCloser: makeGovernanceCloser,
  runGovernanceGate: runGovernanceGate,
};
