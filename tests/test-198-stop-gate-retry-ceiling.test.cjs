'use strict';
// mcp-first-path-retry-ceiling-hardcoded-zero (2026-07-28) -- the MCP-first
// Stop-gate path's BOUNDED ESCAPE.
//
// THE DEFECT. lib/mcp/stop-gate-handler.cjs sat between deriveTurnSignals and
// classifyCardFire and hardcoded BOTH bounded-escape counters to zero on every
// single call:
//
//     turn.retry_count = 0;
//     turn.session_count = 0;
//     const verdict = checkCardFire.classifyCardFire(turn, registry);
//
// classifyCardFire's two ceiling checks read exactly those two fields, so on
// this path they evaluated 0 >= MAX_SESSION_INTERCEPTS and 0 >= MAX_FORCE_RETRIES
// forever. The handler also never bumped or cleared either counter anywhere, so
// even a correct READ would not have helped -- nothing on this path ever wrote
// them. Both constitutional ceilings were structurally unreachable, and the
// "self-bounded, never a livelock" guarantee that scripts/check-card-fire.cjs
// provides on the CLI path did not exist here at all.
//
// WHY A SOURCE-INSPECTION FIX WOULD NOT HAVE BEEN ENOUGH. The defect is dormant
// (MINDRIAN_MCP_FIRST is unset in every current deployment), so there is zero
// production telemetry to corroborate against. That is exactly why this suite
// drives the REAL handleStopEvent through a repeated force-fire loop and counts
// the cards it actually forces. Pre-fix these legs run to their generous outer
// bound with zero degrades; post-fix they stop at the declared ceiling.
//
// THE TWO LEGS ARE DIFFERENT DEFECTS, and both are load-bearing:
//
//   LEG A (per-gate ceiling, MAX_FORCE_RETRIES). Drives the PRIMARY arm with a
//   STABLE ran_entries identity (so turnContextHash is stable and the per-gate
//   counter can climb) and a FLAPPING gate_signature. The flap matters: gate-
//   dedup keys its in-memory fire-once on gate_signature, so a model that
//   re-words its options each retry -- the single most natural LLM behavior
//   under a "re-emit this turn" re-prompt -- slips past that layer every time.
//   With dedup defeated, the retry ceiling is the ONLY thing between this path
//   and an unbounded loop.
//
//   LEG B (session ceiling, MAX_SESSION_INTERCEPTS -- the CR-04 convergence
//   floor). Drives the BACKSTOP arm with a fully flapping gate identity, so
//   turnContextHash mints a FRESH per-gate key every turn and the per-gate
//   counter provably never reaches its own ceiling. Only the content-independent
//   session counter can bound this, which is precisely why CR-04 added it. This
//   is the genuinely unbounded shape and the strongest proof in the file.
//
// Canon Part 8: LOCAL-only. Every path this suite touches is redirected into a
// temp dir before the first require, so it never reads or writes the navigator's
// real ~/.mindrian, real rooms registry, or real STATE.md.
// No em-dashes. CJS only.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.join(__dirname, '..');

// ---------------------------------------------------------------------------
// Hermetic environment. Set BEFORE the first require: every path helper in play
// (retryFilePath, interceptLogPath, the side-channel store path, resolveActiveRoom)
// resolves process.env at CALL time, so redirecting here isolates all of them.
//
// The rooms redirect is not cosmetic. handleStopEvent runs closeOutRoom() before
// anything else, and closeOutRoom writes STATE.md and drains memory into whatever
// room it resolves. Pointing MINDRIAN_ROOMS_HOME at an empty temp dir (no
// .rooms/registry.json) and clearing CLAUDE_ACTIVE_ROOM makes it resolve null, so
// the close-out is a no-op instead of mutating the navigator's live room.
// ---------------------------------------------------------------------------
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-stopgate-ceiling-'));
process.env.MINDRIAN_HOME = path.join(TMP, 'mindrian');
process.env.MINDRIAN_ROOMS_HOME = path.join(TMP, 'rooms');
process.env.CARD_FIRE_SIDECHANNEL_PATH = path.join(TMP, 'sidechannel.json');
delete process.env.CLAUDE_ACTIVE_ROOM;
fs.mkdirSync(process.env.MINDRIAN_HOME, { recursive: true });
fs.mkdirSync(process.env.MINDRIAN_ROOMS_HOME, { recursive: true });

const checkCardFire = require(path.join(REPO, 'scripts', 'check-card-fire.cjs'));
const sidechannel = require(path.join(REPO, 'lib', 'core', 'card-fire-sidechannel.cjs'));
const handler = require(path.join(REPO, 'lib', 'mcp', 'stop-gate-handler.cjs'));

const MAX_FORCE_RETRIES = checkCardFire.MAX_FORCE_RETRIES;
const MAX_SESSION_INTERCEPTS = checkCardFire.MAX_SESSION_INTERCEPTS;

// A generous outer bound for the drive loops. Pre-fix the loops run all the way
// to this number with zero degrades, so a failure reports a real observed count
// ("forced 36 cards, ceiling is 12") instead of a bare timeout.
const RUNAWAY_BOUND = MAX_SESSION_INTERCEPTS * 3;

let n = 0;
const tests = [];
function ok(desc, fn) { tests.push({ desc: desc, fn: fn }); }

console.log('test-198-stop-gate-retry-ceiling');

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

// PRIMARY arm. ran_entries is a real render-coverage-registry gate-reaching
// surface, so turnContextHash keys on it and stays STABLE across the flap
// (gateIdentity = ran || gateSig, and ran wins). gate_subject_text overlaps
// preceding_user_text so the relevance gate does not take an early pass, and
// output_text carries no option labels so gate-already-answered and
// gate-is-simple-binary cannot either. Net verdict: reached-registry-gate-no-card.
function primaryTurn(sessionId, variant) {
  return {
    session_id: sessionId,
    ran_entries: ['scripts/intent-classifier.cjs'],
    gate_subject_text: 'choose a starting point for the venture plan: build the plan now, run research first, or file evidence',
    preceding_user_text: 'help me choose a starting point for the venture plan',
    preceding_user_text_source: 'typed',
    output_text: 'I think you should probably just start with the research and skip the rest.',
    askuserquestion_fired: false,
    // FLAPPING: defeats gate-dedup's in-memory fire-once (it keys its subject on
    // gate_signature), leaving the retry ceiling as the sole bound.
    gate_signature: 'flap-' + variant,
  };
}

// BACKSTOP arm. No ran_entries at all, so gateIdentity falls through to the
// gate signature, which is DERIVED from the option labels -- re-wording the
// options mints a fresh turnContextHash every turn. That is the CR-04 flapping
// shape the per-gate counter structurally cannot catch.
//
// Phase 238-08 (GATE-04, D-15): this fixture deliberately declares
// sidechannel_health:'unavailable' (a direct-field override; deriveTurnSignals
// keeps precedence for it exactly like every other direct field). This suite
// tests the RETRY/SESSION-CEILING mechanics of the BACKSTOP arm, not GATE-04's
// corroboration gate -- a corroborating side-channel reach record for this
// session would ALSO populate ran_entries (readReachedGates and
// mostRecentReachedTs read the SAME recorded entries), which would stabilize
// turnContextHash's gateIdentity and defeat Floor 0c's flapping-key
// requirement this leg depends on. Declaring the side channel unavailable
// instead exercises D-15 state 3 (the last-resort arm, unconditional intercept
// preserved), which is the historically-accurate pre-238-08 semantics this
// fixture always relied on, without touching ran_entries at all.
function backstopTurn(sessionId, variant) {
  return {
    session_id: sessionId,
    preceding_user_text: 'which path forward should we take on the venture plan',
    preceding_user_text_source: 'typed',
    output_text: 'Here are the paths forward.\n\n'
      + '[1] Run the market research pass first\n'
      + '[2] Build the venture plan immediately\n'
      + '[3] File the evidence trail before either (variant ' + variant + ')\n',
    askuserquestion_fired: false,
    sidechannel_health: 'unavailable',
  };
}

// driveForceLoop -- call the REAL handleStopEvent repeatedly and report how many
// cards it actually forced before the bounded escape released, plus the reason it
// gave when it stopped. Returns { fired, stopReason, results }.
async function driveForceLoop(sessionId, makeTurn) {
  let fired = 0;
  let stopReason = null;
  const results = [];
  for (let i = 0; i < RUNAWAY_BOUND; i += 1) {
    const res = await handler.handleStopEvent(sessionId, makeTurn(sessionId, i));
    results.push(res);
    assert.notEqual(res.reason, 'handler-error',
      'iteration ' + i + ': the handler threw internally, so this run proves nothing');
    if (res.fire === true) { fired += 1; continue; }
    stopReason = res.reason;
    break;
  }
  return { fired: fired, stopReason: stopReason, results: results };
}

// ---------------------------------------------------------------------------
// Floor 0: the harness itself is hermetic and the fixtures are genuinely material.
// Without these, a "bounded" result could be a false pass -- a loop that stopped
// because the turn never warranted a card in the first place proves nothing about
// the ceiling.
// ---------------------------------------------------------------------------

ok('Floor 0a: the harness is hermetic -- no live room resolves, so closeOutRoom cannot touch real STATE.md', function () {
  assert.equal(handler.resolveSessionRoomDir('sess-hermetic', { surface: 'cli' }), null,
    'a room resolved under the temp rooms home; this suite would mutate a real room, refusing to trust its results');
});

ok('Floor 0b: both fixtures reach a genuine intercept verdict in the shipped predicate', function () {
  const reg = checkCardFire.loadRegistry();

  const p = checkCardFire.deriveTurnSignals(primaryTurn('floor-p', 0));
  p.retry_count = 0;
  p.session_count = 0;
  const pv = checkCardFire.classifyCardFire(p, reg);
  assert.equal(pv.intercept, true, 'the PRIMARY fixture must be material or LEG A proves nothing');
  assert.equal(pv.reason, 'reached-registry-gate-no-card');

  const b = checkCardFire.deriveTurnSignals(backstopTurn('floor-b', 0));
  b.retry_count = 0;
  b.session_count = 0;
  const bv = checkCardFire.classifyCardFire(b, reg);
  assert.equal(bv.intercept, true, 'the BACKSTOP fixture must be material or LEG B proves nothing');
  assert.equal(bv.reason, 'ascii-box-backstop-no-card');
});

ok('Floor 0c: the two fixtures carry the retry-key shapes each leg depends on (stable vs flapping)', function () {
  const a0 = checkCardFire.turnContextHash(checkCardFire.deriveTurnSignals(primaryTurn('floor-k', 0)));
  const a1 = checkCardFire.turnContextHash(checkCardFire.deriveTurnSignals(primaryTurn('floor-k', 1)));
  assert.equal(a0, a1, 'LEG A needs a STABLE per-gate key so the per-gate counter can climb');

  const b0 = checkCardFire.turnContextHash(checkCardFire.deriveTurnSignals(backstopTurn('floor-k', 0)));
  const b1 = checkCardFire.turnContextHash(checkCardFire.deriveTurnSignals(backstopTurn('floor-k', 1)));
  assert.notEqual(b0, b1, 'LEG B needs a FLAPPING per-gate key so ONLY the session ceiling can bound it');
});

// ---------------------------------------------------------------------------
// LEG A -- the per-gate ceiling (MAX_FORCE_RETRIES).
// ---------------------------------------------------------------------------

ok('LEG A: a repeated force-fire on the MCP-first path STOPS at MAX_FORCE_RETRIES (per-gate ceiling reached and respected)', async function () {
  handler._resetForTest();
  const sid = 'sess-leg-a';
  const run = await driveForceLoop(sid, primaryTurn);

  assert.equal(run.fired, MAX_FORCE_RETRIES,
    'the handler must force exactly MAX_FORCE_RETRIES (' + MAX_FORCE_RETRIES + ') cards before the bounded escape releases; it forced ' + run.fired);
  assert.equal(run.stopReason, 'bounded-escape-released-after-' + MAX_FORCE_RETRIES + '-retries',
    'the degrade must name the PER-GATE floor, got: ' + run.stopReason);
});

ok('LEG A: the bounded escape RESETS the counters, so the navigator is not permanently locked out of future gates', async function () {
  const sid = 'sess-leg-a';
  assert.equal(checkCardFire.readSessionCount(sid), 0,
    'a degrade must clear the session counter (CLI main() parity: a degrade ENDS the intercept run)');
  const ctxHash = checkCardFire.turnContextHash(checkCardFire.deriveTurnSignals(primaryTurn(sid, 0)));
  assert.equal(checkCardFire.readRetryCount(ctxHash), 0, 'a degrade must clear the per-gate counter too');
});

// ---------------------------------------------------------------------------
// LEG B -- the session ceiling (MAX_SESSION_INTERCEPTS), the CR-04 convergence
// floor. This is the shape that was genuinely unbounded pre-fix.
// ---------------------------------------------------------------------------

ok('LEG B: a FLAPPING gate identity (which the per-gate counter cannot catch) STOPS at MAX_SESSION_INTERCEPTS', async function () {
  handler._resetForTest();
  const sid = 'sess-leg-b';
  const run = await driveForceLoop(sid, backstopTurn);

  assert.equal(run.fired, MAX_SESSION_INTERCEPTS,
    'a flapping gate identity must be bounded by the SESSION ceiling (' + MAX_SESSION_INTERCEPTS + '); it forced ' + run.fired + ' cards');
  assert.equal(run.stopReason, 'session-intercept-ceiling-reached-after-' + MAX_SESSION_INTERCEPTS + '-intercepts',
    'the degrade must name the SESSION floor (the per-gate key flapped, so only this one can fire), got: ' + run.stopReason);
});

ok('LEG B: the per-gate counter genuinely never reached its own ceiling, proving the SESSION counter did the bounding', function () {
  const sid = 'sess-leg-b';
  for (let i = 0; i < MAX_SESSION_INTERCEPTS; i += 1) {
    const h = checkCardFire.turnContextHash(checkCardFire.deriveTurnSignals(backstopTurn(sid, i)));
    assert.equal(checkCardFire.readRetryCount(h) < MAX_FORCE_RETRIES, true,
      'per-gate key ' + i + ' must never have reached MAX_FORCE_RETRIES; the flap is what makes the session floor load-bearing');
  }
});

// ---------------------------------------------------------------------------
// WIRING -- one store, not two. Constraint: the fix must READ the counters the
// CLI path already maintains, never mint a second parallel counting mechanism.
// ---------------------------------------------------------------------------

ok('WIRING: the MCP handler bumps the SAME on-disk store the CLI Stop hook reads (one counting path, not two)', async function () {
  handler._resetForTest();
  const sid = 'sess-wiring';
  const ctxHash = checkCardFire.turnContextHash(checkCardFire.deriveTurnSignals(primaryTurn(sid, 0)));

  assert.equal(checkCardFire.readRetryCount(ctxHash), 0, 'fresh session starts at 0');
  assert.equal(checkCardFire.readSessionCount(sid), 0, 'fresh session starts at 0');

  const res = await handler.handleStopEvent(sid, primaryTurn(sid, 0));
  assert.equal(res.fire, true, 'a fresh material gate must still force its first card');

  // Read back through the CLI path's OWN accessors. If the handler had minted a
  // second private counter, these would still read 0.
  assert.equal(checkCardFire.readRetryCount(ctxHash), 1,
    'the CLI per-gate accessor must observe the MCP handler bump');
  assert.equal(checkCardFire.readSessionCount(sid), 1,
    'the CLI session accessor must observe the MCP handler bump');

  // And the bump landed in the real shared side-file, not some in-memory shadow.
  const storePath = path.join(process.env.MINDRIAN_HOME, 'card-fire-retries.json');
  assert.equal(fs.existsSync(storePath), true, 'the shared retry side-file must exist');
  const store = JSON.parse(fs.readFileSync(storePath, 'utf8'));
  assert.equal(Object.prototype.hasOwnProperty.call(store, ctxHash), true,
    'the per-gate entry must live in the shared card-fire-retries.json');
  assert.equal(Object.prototype.hasOwnProperty.call(store, checkCardFire.sessionKey(sid)), true,
    'the session entry must live in the SAME file under the __session__: prefix');
});

// ---------------------------------------------------------------------------
// NON-REGRESSION -- the fix must not over-correct into "never force" or into a
// permanently poisoned counter.
// ---------------------------------------------------------------------------

ok('NON-REGRESSION: a terminal verdict CLEARS both counters, so an unrelated later gate starts from a fresh budget', async function () {
  handler._resetForTest();
  const sid = 'sess-terminal';
  const ctxHash = checkCardFire.turnContextHash(checkCardFire.deriveTurnSignals(primaryTurn(sid, 0)));

  const forced = await handler.handleStopEvent(sid, primaryTurn(sid, 0));
  assert.equal(forced.fire, true);
  assert.equal(checkCardFire.readSessionCount(sid), 1, 'the intercept bumped the session counter');

  // The navigator fires the card: a TERMINAL verdict, the CLI's no-intercept branch.
  const terminal = await handler.handleStopEvent(sid, Object.assign(primaryTurn(sid, 1), { askuserquestion_fired: true }));
  assert.equal(terminal.fire, false);
  assert.equal(terminal.reason, 'card-fired');

  assert.equal(checkCardFire.readRetryCount(ctxHash), 0, 'a terminal verdict must clear the per-gate counter');
  assert.equal(checkCardFire.readSessionCount(sid), 0, 'a terminal verdict must clear the session counter');
});

ok('NON-REGRESSION: a fresh session still force-fires its first genuine gate (the ceiling bounds the loop, it does not disable the gate)', async function () {
  handler._resetForTest();
  const res = await handler.handleStopEvent('sess-fresh', primaryTurn('sess-fresh', 0));
  assert.equal(res.fire, true, 'the Phase 209 guarantee must survive: a genuine unanswered fork still forces');
});

ok('NON-REGRESSION: the ceiling is per-session, so one session exhausting its budget never gags a concurrent session', async function () {
  handler._resetForTest();
  const busy = 'sess-busy';
  const quiet = 'sess-quiet';

  const run = await driveForceLoop(busy, primaryTurn);
  assert.equal(run.fired, MAX_FORCE_RETRIES, 'the busy session exhausts its own budget');

  const other = await handler.handleStopEvent(quiet, primaryTurn(quiet, 0));
  assert.equal(other.fire, true, 'a DIFFERENT live session must still get its card forced');
});

// ---------------------------------------------------------------------------
// The dead-branch repair. gateDedup.shouldFireGate returns false whenever
// material !== true, so pre-fix EVERY non-intercept verdict returned from the
// dedup pre-filter and the handler's own `if (verdict.intercept !== true)` block
// was unreachable -- taking the sibling TTL-refire fix's consumption wire with
// it. tests/test-209-primary-sidechannel.cjs Behavior 15 could not catch this: it
// greps the source text for the call, which was present but dead.
// ---------------------------------------------------------------------------

ok('DEAD-BRANCH REPAIR: a terminal MCP verdict actually REACHES the lifecycle consumption wire (not just contains it in dead source)', async function () {
  handler._resetForTest();
  const sid = 'sess-consume';
  sidechannel.recordReachedGate({
    sessionId: sid,
    surface: 'scripts/intent-classifier.cjs',
    shape: 'F.8',
    subjectText: 'bind this session and select the rooms it writes to',
  });
  assert.equal(sidechannel.readReachedGates(sid).length, 1, 'the mint is live before the terminal turn');

  const terminal = await handler.handleStopEvent(sid, {
    session_id: sid,
    output_text: 'Which rooms should this session write to?',
    preceding_user_text: 'bind this session and select the rooms it writes to',
    preceding_user_text_source: 'typed',
    askuserquestion_fired: true,
  });
  assert.equal(terminal.fire, false);
  assert.equal(terminal.reason, 'card-fired');
  assert.equal(sidechannel.readReachedGates(sid).length, 0,
    'a TERMINAL verdict on the MCP path must spend the reached-gate record, exactly as the CLI path does');
});

ok('DEAD-BRANCH REPAIR: an ACTIVE force-loop still does NOT consume, so the record survives to be re-checked', async function () {
  handler._resetForTest();
  const sid = 'sess-active';
  sidechannel.recordReachedGate({
    sessionId: sid,
    surface: 'scripts/intent-classifier.cjs',
    shape: 'F.1',
    subjectText: 'choose a starting point for the venture plan',
  });

  const forced = await handler.handleStopEvent(sid, primaryTurn(sid, 0));
  assert.equal(forced.fire, true);
  assert.equal(sidechannel.readReachedGates(sid).length, 1,
    'consuming during an active force-loop would make MAX_FORCE_RETRIES unreachable -- the Phase 209 guarantee in reverse');
});

// ---------------------------------------------------------------------------
// Anti-drift source floors.
// ---------------------------------------------------------------------------

ok('Constitutional floor is byte-untouched: MAX_FORCE_RETRIES=3, MAX_SESSION_INTERCEPTS=12, still declared in exactly one place', function () {
  assert.equal(checkCardFire.MAX_FORCE_RETRIES, 3);
  assert.equal(checkCardFire.MAX_SESSION_INTERCEPTS, 12);
  const src = fs.readFileSync(path.join(REPO, 'scripts', 'check-card-fire.cjs'), 'utf8');
  assert.equal(/const MAX_FORCE_RETRIES = 3;/.test(src), true);
  assert.equal(/const MAX_SESSION_INTERCEPTS = 12;/.test(src), true);

  // The MCP handler must never RE-DECLARE the floor; it reads it through the
  // predicate's verdict only (its own header promises exactly this).
  const mcpSrc = fs.readFileSync(path.join(REPO, 'lib', 'mcp', 'stop-gate-handler.cjs'), 'utf8');
  assert.equal(/const MAX_FORCE_RETRIES\s*=/.test(mcpSrc), false,
    'the MCP handler must not re-declare the per-gate ceiling');
  assert.equal(/const MAX_SESSION_INTERCEPTS\s*=/.test(mcpSrc), false,
    'the MCP handler must not re-declare the session ceiling');
});

// stripLineComments -- the anti-drift grep below must test LIVE CODE, not prose.
// The fix deliberately quotes the old defective lines verbatim in its explanatory
// comment ("these two lines used to read turn.retry_count = 0; ..."), which a naive
// whole-file regex reads as the defect still being present. Dropping comment lines
// keeps the explanation in the source where it is useful AND keeps the assertion
// honest. Line comments only, which is all this file uses.
function stripLineComments(src) {
  return src
    .split('\n')
    .map(function (line) {
      const i = line.indexOf('//');
      return i === -1 ? line : line.slice(0, i);
    })
    .join('\n');
}

ok('ANTI-DRIFT: the MCP handler no longer hardcodes either counter to zero', function () {
  const mcpSrc = stripLineComments(
    fs.readFileSync(path.join(REPO, 'lib', 'mcp', 'stop-gate-handler.cjs'), 'utf8')
  );
  assert.equal(/turn\.retry_count\s*=\s*0\s*;/.test(mcpSrc), false,
    'turn.retry_count = 0 makes MAX_FORCE_RETRIES structurally unreachable');
  assert.equal(/turn\.session_count\s*=\s*0\s*;/.test(mcpSrc), false,
    'turn.session_count = 0 makes MAX_SESSION_INTERCEPTS structurally unreachable');
  assert.equal(mcpSrc.indexOf('readRetryCount') !== -1, true, 'it must READ the shared per-gate counter');
  assert.equal(mcpSrc.indexOf('readSessionCount') !== -1, true, 'it must READ the shared session counter');
  assert.equal(mcpSrc.indexOf('bumpRetryCount') !== -1, true, 'it must BUMP the shared per-gate counter on a forced card');
  assert.equal(mcpSrc.indexOf('bumpSessionCount') !== -1, true, 'it must BUMP the shared session counter on a forced card');
});

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

(async function run() {
  let failed = 0;
  for (const t of tests) {
    try {
      await t.fn();
      n += 1;
      console.log('  ok   ' + t.desc);
    } catch (e) {
      failed += 1;
      console.log('  FAIL ' + t.desc);
      console.log('       ' + String((e && e.message) || e).split('\n').join('\n       '));
    }
  }
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_e) { /* best-effort */ }
  if (failed > 0) {
    console.log('\nFAIL test-198-stop-gate-retry-ceiling (' + n + ' passed, ' + failed + ' failed)');
    process.exit(1);
  }
  console.log('\nPASS test-198-stop-gate-retry-ceiling (' + n + ' assertions)');
})();
