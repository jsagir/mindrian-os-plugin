'use strict';
// Phase 238-07 Task 2 -- the table-driven card-fire corpus test (GATE-04).
// Drives tests/fixtures/card-fire-corpus-238.json through the REAL classifier
// (scripts/check-card-fire.cjs::classifyCardFire), never the raw regex
// predicate, because the 238-08 remedy changes the intercept DECISION, not
// the pattern (D-06, 238-07-PLAN.md). ASCII_BOX_GLYPH_RE / ASCII_BOX_UNCONDITIONAL_RE
// both stay byte-identical for the whole phase.
//
// Mandatory hermetic isolation on the WHOLE file via makeHermeticCardFireEnv
// (tests/helpers/cardfire-hermetic-238.cjs, landed by 238-01). WHY BOTH env
// vars are mandatory, not optional (copied/adapted from
// tests/test-209-incident-replay.cjs's own header, which discovered this trap
// while being written): MINDRIAN_HOME covers card-fire-retries.json (the
// bounded-escape counters) AND card-fire-intercepts.log (the CR-07 diagnostic
// log) -- without redirecting it, a test run could read or write the
// navigator's own live retry store on their real machine. CARD_FIRE_SIDECHANNEL_PATH
// covers card-fire-reached.json (the PRIMARY-arm side channel); its
// NO_SESSION_KEY union is a documented, bounded, INTENTIONAL cross-session
// noise property, so a stale real-machine record could otherwise leak into
// this test's lookups for up to TTL_MS if the path is not redirected. Both
// vars must be set together, every time.
//
// Expected outcome at the end of PLAN 238-07 (before 238-08's classifier fix
// lands): state 1 (below) is OBSERVED RED for exactly the Half A entries
// whose text trips the shipped computeBackstopHit today (the measured live
// false-positive shapes from 238-RESEARCH.md section 5b). States 2, 3, and 4
// must ALL pass today -- any failure there is a real defect in THIS plan's
// work, not an expected-RED signal, and must be fixed here, not deferred.
// No em-dashes anywhere in this file (CLAUDE.md HARD RULE).

const assert = require('node:assert/strict');
const path = require('node:path');

const REPO = path.join(__dirname, '..');
const checkCardFire = require(path.join(REPO, 'scripts', 'check-card-fire.cjs'));
const { makeHermeticCardFireEnv } = require(path.join(REPO, 'tests', 'helpers', 'cardfire-hermetic-238.cjs'));
const corpus = require(path.join(REPO, 'tests', 'fixtures', 'card-fire-corpus-238.json'));

console.log('test-238-card-fire-corpus');

let n = 0;
function ok(desc, fn) { fn(); n += 1; console.log('  ok   ' + desc); }

// State-1 checks are EXPECTED to be red for some entries before 238-08 lands
// (the classifier fix). A thrown assertion would abort the whole file after
// the FIRST failure, which would hide the other failing entry ids from the
// SUMMARY. So state-1 uses a non-throwing recorder instead of ok(): every
// corpus entry's state-1 check runs and is recorded, pass or fail, and the
// full list of failing ids is printed and returned to the caller so
// 238-07-SUMMARY.md can record it verbatim (238-08 must prove it turned
// EXACTLY those ids green, no more, no fewer).
const state1Failures = [];
function checkState1(entryId, actualIntercept) {
  n += 1;
  if (actualIntercept === false) {
    console.log('  ok   state1 (' + entryId + '): intercept=false as expected');
  } else {
    state1Failures.push(entryId);
    console.log(
      '  FAIL state1 (' + entryId + '): intercept=' + actualIntercept +
      ', expected false -- RED before 238-08 by design, see 238-07-SUMMARY.md'
    );
  }
}

const hermetic = makeHermeticCardFireEnv('corpus-238');

try {
  const registry = checkCardFire.loadRegistry();

  const halfA = corpus.entries.filter(function (e) { return e.expect_fire === false; });
  const halfB = corpus.entries.filter(function (e) { return e.expect_fire === true; });

  // buildTurn: a production-shaped turn object, the same shape
  // deriveTurnSignals actually produces (scripts/check-card-fire.cjs:1377-1397),
  // not an invented one. output_text carries the fixture prose;
  // askuserquestion_fired is false and ran_entries is empty so the PRIMARY
  // arm cannot fire and the BACKSTOP arm is the arm under test; both retry
  // counters are zero so no ceiling degrade masks the result.
  // sidechannel_health / reach_corroborated do not exist as real fields on
  // this turn shape yet -- 238-08 adds them to deriveTurnSignals and teaches
  // classifyCardFire to read them. Setting them here today is harmless (the
  // classifier ignores unknown fields), which is exactly what makes state 1
  // observably RED before the fix and GREEN after it.
  function buildTurn(text, extra) {
    const base = {
      ran_entries: [],
      askuserquestion_fired: false,
      output_text: text,
      retry_count: 0,
      session_count: 0,
    };
    return Object.assign(base, extra || {});
  }

  // ---------------------------------------------------------------------
  // State 1: Half A entries, HEALTHY side channel, NO corroborating reach
  // record. intercept must be false. This is the half observed RED today
  // and turned green in 238-08.
  // ---------------------------------------------------------------------
  for (const entry of halfA) {
    const turn = buildTurn(entry.text, { sidechannel_health: 'healthy', reach_corroborated: false });
    const verdict = checkCardFire.classifyCardFire(turn, registry);
    checkState1(entry.id, verdict.intercept);
  }

  // ---------------------------------------------------------------------
  // State 2: Half B entries, healthy side channel, a corroborating reach
  // record present. intercept must be true. Must pass TODAY (the shipped
  // backstop already fires unconditionally on Half B's bracket-box shapes)
  // and must still pass after 238-08.
  // ---------------------------------------------------------------------
  for (const entry of halfB) {
    ok('state2 (' + entry.id + '): healthy sidechannel + corroborated reach -> intercept true', function () {
      const turn = buildTurn(entry.text, { sidechannel_health: 'healthy', reach_corroborated: true });
      const verdict = checkCardFire.classifyCardFire(turn, registry);
      assert.equal(verdict.intercept, true, entry.id + ' verdict=' + JSON.stringify(verdict));
    });
  }

  // ---------------------------------------------------------------------
  // State 3: Half B entries, side channel UNAVAILABLE. intercept must be
  // true. This is the detector-of-last-resort arm the navigator ruling
  // preserves: with no corroborating signal available at all, a genuine
  // rendered bracket-box gate must still force-fire.
  // ---------------------------------------------------------------------
  for (const entry of halfB) {
    ok('state3 (' + entry.id + '): sidechannel unavailable -> intercept true (last-resort arm)', function () {
      const turn = buildTurn(entry.text, { sidechannel_health: 'unavailable', reach_corroborated: false });
      const verdict = checkCardFire.classifyCardFire(turn, registry);
      assert.equal(verdict.intercept, true, entry.id + ' verdict=' + JSON.stringify(verdict));
    });
  }

  // ---------------------------------------------------------------------
  // State 4: Half A entries, side channel UNAVAILABLE. For the subset of
  // Half A whose text trips computeBackstopHit today (the measured live
  // false-positive shapes), intercept is TRUE, and that is CORRECT, not a
  // bug: with no side channel available to corroborate, the last-resort
  // detector falls back to its pre-238-08 unconditional behavior. That is
  // the documented cost of preserving the last-resort arm -- assert it as
  // such, with this comment, so a future reader does not "fix" it into
  // false. The remaining Half A entries carry no bracket notation at all
  // and structurally cannot trip ANY backstop arm regardless of
  // side-channel status, so they stay intercept:false here too, exactly
  // like state 1. computeBackstopHit is used here ONLY to derive the
  // expected per-entry outcome for this documented-cost assertion (not as
  // the thing being asserted on -- the assertion itself is still on
  // classifyCardFire(...).intercept).
  // ---------------------------------------------------------------------
  for (const entry of halfA) {
    const expectedWhenUnavailable = checkCardFire.computeBackstopHit(entry.text);
    ok(
      'state4 (' + entry.id + '): sidechannel unavailable -> intercept=' + expectedWhenUnavailable +
      ' (documented last-resort cost)',
      function () {
        const turn = buildTurn(entry.text, { sidechannel_health: 'unavailable', reach_corroborated: false });
        const verdict = checkCardFire.classifyCardFire(turn, registry);
        assert.equal(verdict.intercept, expectedWhenUnavailable, entry.id + ' verdict=' + JSON.stringify(verdict));
      }
    );
  }

  // ---------------------------------------------------------------------
  // Stability control (D-06): ASCII_BOX_GLYPH_RE still matches the four
  // shapes tests/test-209-backstop-tuning.cjs pins, so a future edit made
  // while closing out this corpus cannot silently re-key the retry store.
  // computeBackstopHit appears in this file ONLY inside state 4's
  // documented-cost derivation above and this stability block; every
  // corpus-row assertion in states 1-3 is on classifyCardFire(...).intercept.
  // ---------------------------------------------------------------------
  ok('stability: ASCII_BOX_GLYPH_RE still matches same-line bracket box "[1] resume [2] new room"', function () {
    assert.equal(checkCardFire.ASCII_BOX_GLYPH_RE.test('[1] resume [2] new room'), true);
  });
  ok('stability: ASCII_BOX_GLYPH_RE still matches a multiline labeled box', function () {
    const text = '[1] resume the room\n   details about the room\n[2] start fresh';
    assert.equal(checkCardFire.ASCII_BOX_GLYPH_RE.test(text), true);
  });
  ok('stability: ASCII_BOX_GLYPH_RE still matches the "type 1, 2, or 3" literal', function () {
    assert.equal(checkCardFire.ASCII_BOX_GLYPH_RE.test('Type 1, 2, or 3 to choose a room.'), true);
  });
  ok('stability: ASCII_BOX_GLYPH_RE still matches a numbered-prose gate (retry-key signature arm, unrelated to the retired intercept arm)', function () {
    assert.equal(checkCardFire.ASCII_BOX_GLYPH_RE.test('1. Resume align-ecosystem\n2. Start a new room'), true);
  });

  console.log('\nHalf A: ' + halfA.length + ' entries, Half B: ' + halfB.length + ' entries');
  console.log('State-1 failures (expected RED before 238-08): ' + state1Failures.length);
  if (state1Failures.length > 0) {
    console.log('Failing state-1 entry ids: ' + JSON.stringify(state1Failures));
  }

  console.log('\nPASS test-238-card-fire-corpus (' + n + ' assertions)');

  if (state1Failures.length > 0) {
    console.log(
      '\nEXIT NON-ZERO BY DESIGN: the state-1 failures above are the must-not-fire ' +
      'half observed RED, matching the Phase 236-01 precedent of landing the survival ' +
      'test before the fix. 238-08 must turn exactly these entry ids green.'
    );
    process.exitCode = 1;
  }
} finally {
  hermetic.restore();
}
