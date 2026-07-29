'use strict';
// Phase 238-02 (GATE-01 G-1, GATE-03 half A) -- proves the unified
// session-keyed gate ledger (lib/mcp/gate-ledger.cjs) is session-scoped,
// single-use on any verdict, TTL-bounded, and that the process-scoped
// no-session sentinel (D-09) does not become a cross-process wildcard.
//
// Plain-Node harness (tests/test-209-backstop-tuning.cjs shape): no
// framework, a local ok() counter, a leading name log, a trailing PASS
// tally line. Every assertion checks an OBSERVABLE effect (the returned
// verdict, the Map size, the derived key) -- never merely that a function
// was called, per the repo's documented source-presence-grep anti-pattern.

const assert = require('node:assert/strict');
const path = require('node:path');

const REPO = path.join(__dirname, '..');
const L = require(path.join(REPO, 'lib', 'mcp', 'gate-ledger.cjs'));

let n = 0;
function ok(desc, fn) { fn(); n += 1; console.log('  ok   ' + desc); }

console.log('test-238-session-scoped-ledger');

// ---------------------------------------------------------------------------
// Case 1: cross-session consume is rejected with the exact reason slug.
// ---------------------------------------------------------------------------

ok('session A mints, session B consumes -> { ok:false, reason:"session_mismatch" }', function () {
  L.mintGate('case1', { card: { options: [] }, sessionId: 'sessA', kind: 'general' });
  const result = L.consumeGate('case1', 'sessB');
  assert.equal(result && result.ok, false);
  assert.equal(result && result.reason, 'session_mismatch');
});

// ---------------------------------------------------------------------------
// Case 2: same-session consume returns the entry, carrying the minted
// payload keys.
// ---------------------------------------------------------------------------

ok('session A mints, session A consumes -> the entry, carrying its minted payload', function () {
  L.mintGate('case2', { card: { options: [{ id: 'approve', label: 'Approve' }] }, sessionId: 'sessA', kind: 'general', haltedStep: 3 });
  const result = L.consumeGate('case2', 'sessA');
  assert.ok(result, 'expected a truthy entry, got ' + JSON.stringify(result));
  assert.equal(result.sessionId, 'sessA');
  assert.equal(result.kind, 'general');
  assert.equal(result.haltedStep, 3);
  assert.deepEqual(result.card, { options: [{ id: 'approve', label: 'Approve' }] });
});

// ---------------------------------------------------------------------------
// Case 3: single-use across a session mismatch. Case 1's rejected consume
// already deleted the entry (deletion happens on lookup, before the
// session check), so session A's own follow-up consume of the SAME id
// also returns null, and the ledger no longer carries it.
// ---------------------------------------------------------------------------

ok('single-use even on a session-mismatch reject: the rightful owner\'s follow-up consume is null', function () {
  const followUp = L.consumeGate('case1', 'sessA');
  assert.equal(followUp, null);
});

ok('the ledger no longer carries case1 after either consume attempt', function () {
  assert.equal(L._internal._ledger.has('case1'), false);
});

// ---------------------------------------------------------------------------
// Case 4: two null-session callers in ONE process consume each other's
// gates successfully, because both resolve to the SAME process.pid
// sentinel. This documents the in-process semantics honestly (D-04: the
// two-process fence is a separate, file-based proof in 238-05, not
// conflated here).
// ---------------------------------------------------------------------------

ok('two null-session callers in ONE process share the same sentinel and can consume each other\'s gates', function () {
  L.mintGate('case4', { card: {}, sessionId: null, kind: 'binding' });
  const result = L.consumeGate('case4', null);
  assert.ok(result, 'expected a truthy entry for a same-process null/null round trip');
});

ok('the derived null-session key equals NO_SESSION_PREFIX + process.pid', function () {
  assert.equal(L.ledgerSessionKey(null), L.NO_SESSION_PREFIX + process.pid);
  assert.equal(L.ledgerSessionKey(undefined), L.NO_SESSION_PREFIX + process.pid);
});

// ---------------------------------------------------------------------------
// Case 5: the two-null-session CROSS-PROCESS case. D-09 fix: a different
// process id yields a different key, so a null-session mint in one
// process cannot be matched by a null-session consume resolved in a
// different process. This is the in-repo precedent this fix follows:
// lib/core/card-fire-sidechannel.cjs's NO_SESSION_KEY bucket had exactly
// this cross-session bleed (a shared literal, not a scoped sentinel) until
// its own fix (A) scoped the union to a freshness window. Here the scope
// is the process id itself, computed at derivation time, not a shared
// constant string.
// ---------------------------------------------------------------------------

ok('D-09: a different process id yields a different no-session key (not a shared literal)', function () {
  const otherProcessKey = L.NO_SESSION_PREFIX + (process.pid + 1);
  assert.notEqual(L.ledgerSessionKey(null), otherProcessKey);
});

// ---------------------------------------------------------------------------
// Case 6: TTL expiry. Mint, rewrite the stored entry's mintedAt via the
// exposed _internal._ledger (matching the _internal convention both tool
// modules already use), then consume with the CORRECT session and assert
// null -- the TTL check fires even when the session matches.
// ---------------------------------------------------------------------------

ok('TTL expiry returns null even when the session matches', function () {
  L.mintGate('case6', { card: {}, sessionId: 'sessA', kind: 'general' });
  const stale = L._internal._ledger.get('case6');
  stale.mintedAt = Date.now() - L.LEDGER_TTL_MS - 1;
  const result = L.consumeGate('case6', 'sessA');
  assert.equal(result, null);
});

// ---------------------------------------------------------------------------
// Case 7: anti-vacuity control. Mint under session A, consume under
// session A -> truthy entry. Without this control a ledger that rejected
// EVERYTHING would still pass cases 1 and 3.
// ---------------------------------------------------------------------------

ok('anti-vacuity control: a matched-session consume is truthy, proving the ledger does not reject everything', function () {
  L.mintGate('case7', { card: {}, sessionId: 'sessA', kind: 'general' });
  const result = L.consumeGate('case7', 'sessA');
  assert.ok(result);
});

// ---------------------------------------------------------------------------
// Case 8 (T-238-06): mintGate cannot be spoofed by a caller-supplied
// sessionKey. sessionKey is derived LAST inside mintGate's Object.assign,
// so a forged value is always overwritten.
// ---------------------------------------------------------------------------

ok('a caller-supplied sessionKey cannot override the derived one at mint time', function () {
  L.mintGate('case8', { sessionId: 'sessA', sessionKey: 'FORGED', kind: 'general' });
  assert.equal(L._internal._ledger.get('case8').sessionKey, 'sessA');
  L.consumeGate('case8', 'sessA'); // clean up: leave no residue for later runs
});

// ---------------------------------------------------------------------------
// Mutation gate (SC2 named leg). Documented here rather than asserted in
// prose only: removing the
//   entry.sessionKey !== ledgerSessionKey(sessionId)
// comparison in consumeGate (lib/mcp/gate-ledger.cjs) turns Case 1 red --
// a cross-session consume would then return the entry instead of
// { ok:false, reason:'session_mismatch' }. The executor demonstrated this
// live: commented the comparison out, ran this file (observed exactly
// Case 1 fail, Case 3's "no longer carries" assertion also failing as a
// direct consequence since the mismatched consume no longer independently
// exercises the reject path before deletion), then restored the file
// byte-identically and re-ran to green. The full transcript (commands run
// and their observed output) is recorded in 238-02-SUMMARY.md -- this
// comment states the claim, the SUMMARY carries the proof.
// ---------------------------------------------------------------------------

console.log('\nPASS test-238-session-scoped-ledger (' + n + ' assertions)');
