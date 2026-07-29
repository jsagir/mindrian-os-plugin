'use strict';
// Phase 238-02 (GATE-01 G-1, GATE-03 half A) -- the unified session-keyed
// gate ledger.
//
// T-198-10 / T-198-12 anti-spoofing doctrine, carried forward verbatim in
// intent from the gate.cjs live-gate ledger this module replaces: a gate
// answer only ratifies a gate_id THIS server process actually minted -- a
// forged or replayed gate_id (or answer) never reaches navigation.cjs. This
// module is the single, in-memory, single-use, TTL-bounded ledger that
// mint/consume discipline lives in now.
//
// Why this module exists: gate.cjs's own live-gate Map and chain.cjs's own
// resume-ledger Map were minted separately under the SAME T-198-10 doctrine
// and never joined, so a gate_id minted by a chain halt could not be
// consumed by a gate answer (238-RESEARCH.md Finding 1). Neither of those
// two ledgers checked a session id on consume either, so one session could
// consume a gate minted for a different session (238-RESEARCH.md Finding
// 3). This module closes both gaps in one place: ONE ledger, keyed by a
// normalized session key, checked on every consume.
//
// CJS, 'use strict', Node built-ins only. Zero network. Zero external
// service calls. Canon Part 8: LOCAL only, nothing egresses.

// -----------------------------------------------------------------------
// Module state: one Map, one TTL. 30 minutes, identical to both retired
// constants (LIVE_GATE_TTL_MS in the gate module, RESUME_TTL_MS in the
// chain module).
// -----------------------------------------------------------------------
const _ledger = new Map();
const LEDGER_TTL_MS = 30 * 60 * 1000; // 30 minutes

// D-09: a mint whose caller resolved a null session id must NOT become a
// wildcard any other caller can consume. The safe degrade is a
// process-scoped sentinel: two different processes that both resolve a
// null session id get two different keys, so they cannot cross-consume,
// while the SAME process's own null-session calls still round-trip. This
// mirrors the NO_SESSION_KEY precedent already in the repo (the side-
// channel module's own documented cross-session bleed and its fix).
const NO_SESSION_PREFIX = 'no-session:';

/**
 * ledgerSessionKey(sessionId) -> the normalized session key used for both
 * mint and consume. A non-empty string session id is returned unchanged.
 * Anything else (null, undefined, empty string, non-string) collapses to
 * the process-scoped no-session sentinel.
 */
function ledgerSessionKey(sessionId) {
  if (typeof sessionId === 'string' && sessionId.length > 0) return sessionId;
  return NO_SESSION_PREFIX + process.pid;
}

/**
 * mintGate(gateId, entry) -> store entry under gateId. Uses the payload-
 * merging form (Object.assign) so chain.cjs's full resume payload
 * (haltedStep/restSteps/previousOutput/roomDir/sessionId/onStepFn/
 * postureFn/maxSteps/gateRenderCtx) rides along unchanged, and gate.cjs
 * can mint with just { card, sessionId, kind }.
 *
 * sessionKey is computed LAST, so a caller cannot pass a pre-cooked
 * sessionKey that overrides the derived one -- the verdict-cannot-be-
 * overridden discipline this repo already applies to seam-liveness
 * assertions.
 */
function mintGate(gateId, entry) {
  const src = (entry && typeof entry === 'object') ? entry : {};
  const stored = Object.assign(
    { mintedAt: Date.now() },
    src,
    { sessionKey: ledgerSessionKey(src.sessionId) }
  );
  _ledger.set(gateId, stored);
}

/**
 * consumeGate(gateId, sessionId) -> the entry, null, or a session-mismatch
 * rejection object.
 *
 * Exactly two positional parameters. No options object, no force flag, no
 * allowlist argument, no bypass of any kind -- the same "a gate that
 * cannot fail is not a gate" discipline the seam-liveness helper carries.
 * Do not add a third parameter to this function.
 *
 * Deletion happens IMMEDIATELY after lookup, before any further check, so
 * a gate is single-use whether or not the TTL held and whether or not the
 * session matched -- this preserves both retired ledgers' semantics
 * exactly (each already deleted on lookup before checking TTL).
 *
 * Return contract:
 *   - absent / already consumed -> null
 *   - present, TTL expired -> null
 *   - present, session key mismatch -> { ok: false, reason: 'session_mismatch' }
 *   - present, TTL held, session matches -> the stored entry
 *
 * Callers distinguish the two failure modes by checking `result === null`
 * versus `result.ok === false`.
 */
function consumeGate(gateId, sessionId) {
  const entry = _ledger.get(gateId);
  if (!entry) return null;
  _ledger.delete(gateId); // single-use: consumed whether or not the verdict below holds
  if (Date.now() - entry.mintedAt > LEDGER_TTL_MS) return null;
  if (entry.sessionKey !== ledgerSessionKey(sessionId)) {
    return { ok: false, reason: 'session_mismatch' };
  }
  return entry;
}

/**
 * mintedGateKinds() -> a sorted, de-duplicated array of the `kind` values
 * currently present in the ledger. Feeds the seam-liveness mint-ratifier
 * wire: the ledger, not a test, is the source of truth for what it mints.
 */
function mintedGateKinds() {
  const seen = new Set();
  for (const entry of _ledger.values()) {
    if (entry && typeof entry.kind === 'string' && entry.kind.length > 0) {
      seen.add(entry.kind);
    }
  }
  return Array.from(seen).sort();
}

/**
 * ratifiableGateKinds() -> the frozen list of gate kinds a ratifier can
 * consume this phase. Declared here (not derived from the live Map) so a
 * seam-liveness check has a stable claim set independent of what happens
 * to be minted at the moment it runs.
 */
const RATIFIABLE_GATE_KINDS = Object.freeze(['general', 'binding', 'material_step']);
function ratifiableGateKinds() {
  return RATIFIABLE_GATE_KINDS.slice();
}

module.exports = {
  mintGate: mintGate,
  consumeGate: consumeGate,
  ledgerSessionKey: ledgerSessionKey,
  mintedGateKinds: mintedGateKinds,
  ratifiableGateKinds: ratifiableGateKinds,
  LEDGER_TTL_MS: LEDGER_TTL_MS,
  NO_SESSION_PREFIX: NO_SESSION_PREFIX,
  _internal: {
    _ledger: _ledger,
  },
};
