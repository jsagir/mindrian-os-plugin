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
// normalized session key, checked on every consume. peekGate is the
// non-consuming read of the same ledger (Phase 289): callers peek, run
// every refusal, and consume only when nothing refused.
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

// Phase 369 plan 26 (GREC369-03): ids whose entry was cleared because its TTL ran
// out. A cleared entry reads null for every caller, so without this memory an
// expired gate and a gate this process never minted would look the same; with it,
// gate_answer can answer gate_expired for the first and unknown_gate for the
// second (until the process restarts, which forgets both, by contract). Bounded:
// the oldest id is dropped past EXPIRED_CAP so the set cannot grow without limit.
const _expired = new Set();
const EXPIRED_CAP = 1000;
function _noteExpired(gateId) {
  _expired.add(gateId);
  if (_expired.size > EXPIRED_CAP) {
    const oldest = _expired.values().next().value;
    _expired.delete(oldest);
  }
}

// Phase 369 plan 33 (SHELL369-12): two optional observers, installed by
// lib/mcp/tools/gate.cjs, so a gate minted for a room-bound session leaves a
// durable record in its room (lib/mcp/gate-raised.cjs) and a take that leaves
// without a recorded answer leaves a close record. The ledger itself stays the
// same rule set: no new parameter on any function, still exactly one literal
// delete (inside consumeGate, after its session check), and an observer that
// throws changes no mint and no take (each call sits in its own try/catch and runs
// AFTER the set or the delete). Seven callers mint here (gate.cjs, chain.cjs,
// research.cjs, canon-release.cjs, never-do-gate.cjs, tool-router.cjs,
// scripts/operator-command.cjs); the observer sits in the ledger so none of them
// is edited. The ledger holds no knowledge of rooms.
const _observers = { onMint: null, onTake: null };

/**
 * setGateObservers({ onMint, onTake }) -> replaces BOTH observers; a missing or
 * non-function member clears that slot, and null clears both. onMint(gateId,
 * storedEntry) runs after a mint stored the entry (the stored object is the
 * ledger's own, so an observer may annotate it); onTake(gateId, entry) runs after
 * a successful consumeGate (and so releaseGate) deleted it.
 */
function setGateObservers(observers) {
  const o = (observers && typeof observers === 'object') ? observers : {};
  _observers.onMint = (typeof o.onMint === 'function') ? o.onMint : null;
  _observers.onTake = (typeof o.onTake === 'function') ? o.onTake : null;
}

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
 * mintGate(gateId, entry) -> true when the entry was stored, false when a live
 * entry of another session holds gateId (nothing changes then). Stores entry under gateId. Uses the payload-
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
  // Phase 369 plan 38 (WR-05): every mint first clears the entries whose TTL ran out
  // (so a loop of mints cannot grow the ledger without bound), then refuses to
  // overwrite a LIVE entry that belongs to another session (a second session that
  // learned a live id must not be able to take the gate over). A mint under the
  // same session still replaces its own entry; the refusal leaves the ledger
  // untouched and returns false, and the observer is not told.
  _sweepExpired();
  const sessionKey = ledgerSessionKey(src.sessionId);
  const existing = _ledger.get(gateId);
  if (existing && existing.sessionKey !== sessionKey) return false;
  const stored = Object.assign(
    { mintedAt: Date.now() },
    src,
    { sessionKey: sessionKey }
  );
  _ledger.set(gateId, stored);
  // Phase 369 plan 33: tell the observer, after the set, so it can never change
  // the result. A throw is swallowed.
  if (_observers.onMint) {
    try { _observers.onMint(gateId, stored); } catch (_e) { /* an observer never changes a mint */ }
  }
  return true;
}

// Phase 369 plan 38 (WR-05): drop every entry whose TTL ran out. It takes each one
// through consumeGate (an expired entry reads null for every caller and is cleared
// there, noted in the expired set), so the ledger keeps exactly ONE literal delete.
function _sweepExpired() {
  const now = Date.now();
  for (const [id, entry] of _ledger) {
    if (now - entry.mintedAt > LEDGER_TTL_MS) consumeGate(id, entry.sessionId);
  }
}

/**
 * liveCountFor(sessionId) -> how many unexpired entries this session holds. A
 * pure read (Phase 369 plan 38, WR-05): gate_render uses it to bound one
 * session's open gates.
 */
function liveCountFor(sessionId) {
  const key = ledgerSessionKey(sessionId);
  const now = Date.now();
  let n = 0;
  for (const entry of _ledger.values()) {
    if (entry.sessionKey === key && now - entry.mintedAt <= LEDGER_TTL_MS) n += 1;
  }
  return n;
}

/**
 * isGateLive(gateId) -> true when an unexpired entry exists for this id under ANY
 * session. A pure read that tells nothing about the entry (Phase 369 plan 38,
 * WR-05): gate_render refuses a caller-chosen id that is already live.
 */
function isGateLive(gateId) {
  const entry = _ledger.get(gateId);
  return !!entry && Date.now() - entry.mintedAt <= LEDGER_TTL_MS;
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
 * Phase 289 (D-04, LEDGER289-01): the session is checked BEFORE the one
 * delete. A session mismatch returns the refusal and leaves the entry in
 * place for its rightful owner; before this change a stranger's refused
 * consume deleted the owner's gate (spike 007 burn-probe measured it: the
 * owner's next answer read unknown_or_expired_gate). Deletion now happens
 * only on a valid consume, or to clear an expired entry. A gate is still
 * single-use after a successful consume. An expired entry reads null for
 * every caller (never session_mismatch) and is cleared here.
 *
 * Return contract (unchanged):
 *   - absent / already consumed -> null
 *   - present, TTL expired -> null (and the entry is cleared)
 *   - present, TTL held, session key mismatch -> { ok: false, reason: 'session_mismatch' } (entry kept)
 *   - present, TTL held, session matches -> the stored entry (and it is removed)
 *
 * Callers distinguish the two failure modes by checking `result === null`
 * versus `result.ok === false`.
 */
function consumeGate(gateId, sessionId) {
  const entry = _ledger.get(gateId);
  if (!entry) return null;
  const expired = Date.now() - entry.mintedAt > LEDGER_TTL_MS;
  const mismatch = entry.sessionKey !== ledgerSessionKey(sessionId);
  if (!expired && mismatch) {
    return { ok: false, reason: 'session_mismatch' };
  }
  if (expired) _noteExpired(gateId);
  _ledger.delete(gateId);
  // Phase 369 plan 33: tell the observer about a SUCCESSFUL take only (session
  // matched, not expired), after the one delete. A throw is swallowed.
  if (!expired && _observers.onTake) {
    try { _observers.onTake(gateId, entry); } catch (_e) { /* an observer never changes a take */ }
  }
  return expired ? null : entry;
}

/**
 * peekGate(gateId, sessionId) -> the entry, null, or a session-mismatch
 * rejection object, WITHOUT consuming anything.
 *
 * Same two-parameter contract and the same TTL and session rules as
 * consumeGate (absent or expired -> null; live entry under another
 * session -> { ok: false, reason: 'session_mismatch' }; otherwise the
 * stored entry), but it never mutates the ledger. It is the non-consuming
 * read gate_answer and chain_run's resume use to run every refusal before
 * they consume (Phase 289 D-04, LEDGER289-02). Phase 369 plan 26 builds
 * releaseGate and durable consumption on top of it. Do not add a third
 * parameter.
 */
function peekGate(gateId, sessionId) {
  const entry = _ledger.get(gateId);
  if (!entry) return null;
  if (Date.now() - entry.mintedAt > LEDGER_TTL_MS) return null;
  if (entry.sessionKey !== ledgerSessionKey(sessionId)) {
    return { ok: false, reason: 'session_mismatch' };
  }
  return entry;
}

/**
 * releaseGate(gateId, sessionId) -> the entry, null, or a session-mismatch
 * rejection object: the durable-consumption verb (Phase 369 plan 26,
 * GREC369-01). gate_answer peeks, runs every refusal, writes the whole
 * ratification inside one transaction, and calls releaseGate only AFTER that
 * transaction commits, so a persistence failure leaves the gate answerable.
 *
 * It is the same take as consumeGate, on purpose: it delegates, so the ledger
 * keeps exactly ONE literal delete, inside consumeGate after its session check
 * (the 369-07 text rule that tests/test-369-human-only.cjs and
 * tests/test-289-ledger-consume-after-checks.cjs pin). Two positional
 * parameters, no options object, no force flag.
 */
function releaseGate(gateId, sessionId) {
  return consumeGate(gateId, sessionId);
}

/**
 * isGateExpired(gateId) -> true when the gate is present with its TTL run out,
 * or was cleared for that reason by this process. Never mutates. false for an id
 * this process never minted (or one released after an answer).
 */
function isGateExpired(gateId) {
  const entry = _ledger.get(gateId);
  if (entry) return Date.now() - entry.mintedAt > LEDGER_TTL_MS;
  return _expired.has(gateId);
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
  peekGate: peekGate,
  releaseGate: releaseGate,
  setGateObservers: setGateObservers,
  isGateExpired: isGateExpired,
  liveCountFor: liveCountFor,
  isGateLive: isGateLive,
  ledgerSessionKey: ledgerSessionKey,
  mintedGateKinds: mintedGateKinds,
  ratifiableGateKinds: ratifiableGateKinds,
  LEDGER_TTL_MS: LEDGER_TTL_MS,
  NO_SESSION_PREFIX: NO_SESSION_PREFIX,
  _internal: {
    _ledger: _ledger,
    _expired: _expired,
    // Test seam: age a live entry by `ms` so its TTL reads as run out, without
    // waiting 30 minutes. In-process use only; the live-daemon test reaches the
    // same state through gate.cjs's MINDRIAN_TEST_MODE fault marker.
    backdate: function backdate(gateId, ms) {
      const entry = _ledger.get(gateId);
      if (!entry) return false;
      entry.mintedAt -= ms;
      return true;
    },
  },
};
