'use strict';
// Phase 198-09 (SPEC-5, D-05 prerequisite) -- server-side gate dedup + relevance.
//
// The Stop-gate is the highest-risk hook to migrate (D-05): a bad move
// re-creates the per-turn card-misfire regression the navigator has logged
// all week (.planning/STATE.md 2026-07-03 entry: "Stop hook forcing
// irrelevant Decision Gate cards"; the feedback_1_15_enforcement_regression_
// watch.md memory file). D-05 is a HARD sequencing constraint: this module
// (and lib/mcp/stop-gate-handler.cjs, which wires it into gate_render's fire
// decision) must exist and be proven BEFORE the Stop-gate enforcement moves
// server-side -- that move is Task 2 of this same plan.
//
// Two exports, both pure and defensive (never throw):
//   - dedupKey(gateContext)              : a stable identity key for a gate,
//     scoped to a session, so the SAME gate (same subject) does not fire
//     twice in one session -- the F.8/D-04 once-per-session discipline
//     (lib/mcp/gate-render.cjs's shouldFireBindingCard), GENERALIZED here
//     from the single 'binding' kind to ANY gate kind (the Stop-gate
//     included).
//   - shouldFireGate(gateContext, sessionState) : the combined DEDUP +
//     RELEVANCE gate. Returns false when either check fails:
//       (1) DEDUP     -- a gate whose dedupKey already fired this session
//                         (per sessionState.fired) does not fire again.
//       (2) RELEVANCE -- a gate whose context is not materially relevant
//                         (gateContext.material !== true) never fires; there
//                         is nothing pending that warrants a card. This is
//                         the structural fix for the 2026-07-03 regression:
//                         a stale/irrelevant reach can no longer force a
//                         card just because SOME gate-shaped signal exists.
//     Returns true ONLY for a novel, relevant, material gate.
//
// gateContext shape (tolerant -- accepts either name per field so callers can
// reuse whichever identity fields they already have on hand):
//   { gate | gateId    : string  -- the gate's kind/identity label
//     sid  | sessionId : string  -- the session this gate would fire in
//     subject | topic  : string  -- OPTIONAL finer-grained subject identity
//                                   (e.g. check-card-fire.cjs's gate_signature)
//                                   so two DIFFERENT gates in the same
//                                   session never share a dedup key
//     material          : boolean -- true iff something genuinely pending
//                                    warrants a card this turn }
//
// sessionState shape: { fired: { [dedupKey]: true } } -- an in-memory,
// caller-owned per-session ledger (lib/mcp/stop-gate-handler.cjs keeps one
// Map per session; this module never persists state itself, so it stays
// side-effect-free and trivially unit-testable).
//
// Canon Part 7: this is the ONE dedup+relevance primitive; stop-gate-
// handler.cjs consults it, never re-implements a parallel discipline.
// Canon Part 8: pure local computation (a sha256 over local scalars). Zero
// Brain/network tokens, zero fs access.
// No em-dashes. CJS only.

const crypto = require('node:crypto');

/**
 * dedupKey(gateContext) -- a stable identity key for a gate, scoped to the
 * session it would fire in. Two calls with the SAME (session, gate kind,
 * subject) always produce the SAME key, regardless of any other field on the
 * context (e.g. `material` never affects identity -- a gate's identity does
 * not change just because its relevance verdict changes turn to turn).
 * Never throws.
 *
 * @param {object} gateContext
 * @returns {string} a 24-hex-char stable key
 */
function dedupKey(gateContext) {
  try {
    const ctx = (gateContext && typeof gateContext === 'object') ? gateContext : {};
    const sid = typeof ctx.sid === 'string' ? ctx.sid
      : (typeof ctx.sessionId === 'string' ? ctx.sessionId : '');
    const gate = typeof ctx.gate === 'string' ? ctx.gate
      : (typeof ctx.gateId === 'string' ? ctx.gateId : '');
    const subject = typeof ctx.subject === 'string' ? ctx.subject
      : (typeof ctx.topic === 'string' ? ctx.topic : '');
    const raw = 'sid:' + sid + '|gate:' + gate + '|subject:' + subject;
    return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 24);
  } catch (_e) {
    // Defensive floor: a degenerate key still dedups (coarsely) rather than
    // throwing and taking down the caller's fire decision.
    return 'dedup-key-error';
  }
}

/**
 * shouldFireGate(gateContext, sessionState) -- the combined DEDUP + RELEVANCE
 * gate. Never throws; any internal error degrades to false (a fire-decision
 * bug must never FORCE a card -- the conservative direction matches
 * scripts/check-card-fire.cjs's own predicate-error floor).
 *
 * @param {object} gateContext   -- see module header for shape
 * @param {{fired?: Object<string, boolean>}} sessionState
 * @returns {boolean} true ONLY for a novel, relevant, material gate
 */
function shouldFireGate(gateContext, sessionState) {
  try {
    const ctx = (gateContext && typeof gateContext === 'object') ? gateContext : {};

    // (2) RELEVANCE -- nothing pending that warrants a card: never fires.
    // The 2026-07-03 regression fix: a gate-shaped signal alone is not
    // enough; the caller must have determined genuine materiality first.
    if (ctx.material !== true) return false;

    // (1) DEDUP -- a gate with a dedupKey already fired this session does
    // not fire again (fire-once, the F.8/D-04 discipline generalized).
    const state = (sessionState && typeof sessionState === 'object') ? sessionState : {};
    const fired = (state.fired && typeof state.fired === 'object') ? state.fired : {};
    const key = dedupKey(ctx);
    if (fired[key] === true) return false;

    return true;
  } catch (_e) {
    return false;
  }
}

module.exports = {
  dedupKey: dedupKey,
  shouldFireGate: shouldFireGate,
};
