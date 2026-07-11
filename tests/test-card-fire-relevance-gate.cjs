'use strict';
// Phase 210-01 (Wave 0, item 210-E-1) -- the two-directional Stop-hook relevance
// gate test. Encodes the CONTEXT.md constraint for scripts/check-card-fire.cjs's
// classifyCardFire BEFORE the relevance gate exists (Nyquist Wave 0):
//
//   Leg 1 (SOFTENED direction, EXPECTED RED until plan 210-05): the live incident
//     of 2026-07-02 replayed -- the navigator ALREADY answered "yes" in plain text
//     to the immediately preceding question, then the assistant emitted gate-shaped
//     ASCII-box text with NO AskUserQuestion tool_use. The backstop must NOT
//     force-block: intercept:false, reason 'gate-already-answered'.
//   Leg 2 (SOFTENED direction, EXPECTED RED until plan 210-05): the stale-artifact
//     pattern -- the preceding user turn has zero token overlap with the gate's
//     option-label set. intercept:false, reason 'gate-irrelevant-to-turn'.
//   Leg 3 (PRESERVE FLOOR, green NOW and must STAY green): a genuine, relevant,
//     unanswered fork still intercepts (the Phase 209 guarantee -- this phase must
//     not turn the backstop off entirely; that would be 209's regression in reverse).
//   Leg 4 (BINARY EXEMPTION, navigator decision 2026-07-05): a genuine, RELEVANT,
//     UNANSWERED 2-option binary closer passes as intercept:false reason
//     gate-is-simple-binary through the LIVE transcript path (not just the direct
//     unit shape). Neither relevance pass-reason can claim it (it topically overlaps
//     the gate and does not answer it), so it proves the binary exemption is reached.
//
// Harness idiom copied from tests/test-209-incident-replay.cjs: JSONL transcript
// to a tmp dir, hook_event_name Stop + transcript_path env, MINDRIAN_HOME re-point
// per leg, CARD_FIRE_SIDECHANNEL_PATH tmp isolation for the whole file (T-209-25 /
// T-210-01), try/finally env restore. Legs distinguish assertion failures (RED)
// from harness errors (T-210-02). House rule: hyphens only, no em-dashes. CJS,
// node built-ins only.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.join(__dirname, '..');
const checkCardFire = require(path.join(REPO, 'scripts', 'check-card-fire.cjs'));

console.log('test-card-fire-relevance-gate (Phase 210 Wave 0)');

// Hermetic isolation for the WHOLE file (the T-209-25 idiom): point the card-fire
// side-channel at an isolated tmp path so this test NEVER reads or writes the real
// ~/.mindrian/card-fire-reached.json (the NO_SESSION_KEY union would otherwise leak
// stale real-machine records into these lookups for up to TTL_MS).
const HERMETIC_TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-210-relevance-sidechannel-'));
process.env.CARD_FIRE_SIDECHANNEL_PATH = path.join(HERMETIC_TMP, 'card-fire-reached.json');

let pass = 0;
let fail = 0;
function leg(desc, fn) {
  try {
    fn();
    pass += 1;
    console.log('  ok   (' + desc + ')');
  } catch (e) {
    fail += 1;
    if (e && (e.code === 'ERR_ASSERTION' || e.name === 'AssertionError')) {
      console.error('  RED  (' + desc + '): ' + e.message);
    } else {
      console.error('  ERROR(' + desc + '): harness error, NOT an assertion failure: ' + (e && e.stack ? e.stack : e));
    }
  }
}

// classifyTranscript(records, sessionId) -> verdict. Writes a JSONL transcript to
// a tmp dir, re-points MINDRIAN_HOME at a tmp home (retry-side-file isolation),
// derives turn signals via the REAL Stop contract (transcript_path), classifies,
// and restores env in finally.
function classifyTranscript(records, sessionId) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-210-relevance-'));
  const transcriptPath = path.join(tmpDir, 'turn.jsonl');
  const retryHome = path.join(tmpDir, 'mindrian-home');
  fs.mkdirSync(retryHome, { recursive: true });
  fs.writeFileSync(
    transcriptPath,
    records.map(function (r) { return JSON.stringify(r); }).join('\n') + '\n',
    'utf8'
  );
  const env = {
    hook_event_name: 'Stop',
    session_id: sessionId,
    transcript_path: transcriptPath,
  };
  const origHome = process.env.MINDRIAN_HOME;
  process.env.MINDRIAN_HOME = retryHome;
  try {
    const turn = checkCardFire.deriveTurnSignals(env);
    const registry = checkCardFire.loadRegistry();
    return { turn: turn, verdict: checkCardFire.classifyCardFire(turn, registry) };
  } finally {
    if (origHome === undefined) delete process.env.MINDRIAN_HOME;
    else process.env.MINDRIAN_HOME = origHome;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

// The incident-shaped room-pick gate (same fixture shape as
// tests/test-209-incident-replay.cjs assertion b, WITHOUT the tool_use record).
// A THIRD option is present on purpose: 2-option gates are now EXEMPT as simple
// binaries (reason gate-is-simple-binary, navigator decision 2026-07-05), so the
// PRESERVE-FLOOR leg needs a genuine 3+-option fork to assert the intercept floor.
const ROOM_PICK_GATE = [
  'Ignite -- pick a room to resume, or start something new',
  '1. ALIGN - Well-Defined Problem - opened in the last day',
  '2. Just talk (no room)',
  '3. Start a new room',
].join('\n');

// A release go/no-go gate whose option labels a plain-text "yes" plainly answers.
const RELEASE_GATE = [
  'Publish this release?',
  '1. Yes - publish v1.15.2 to npm now',
  '2. No - hold the release for another pass',
].join('\n');

// ---------------------------------------------------------------------------
// Leg 1 -- SOFTENED direction (EXPECTED RED until plan 210-05): the live-incident
// replay. The user answered "yes" in plain text to the immediately preceding
// question; the assistant then re-emitted the gate as ASCII-box text with no card.
// The relevance gate must recognize the answer and NOT force-block.
// ---------------------------------------------------------------------------
leg('leg 1 SOFTENED: already-answered plain-text "yes" must not force-block (RED until plan 210-05)', function () {
  const out = classifyTranscript([
    { type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'Ready to ship. Publish this release?' }] } },
    { type: 'user', message: { role: 'user', content: 'yes' } },
    { type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: RELEASE_GATE }] } },
  ], 'gsd-210-already-answered-session');
  assert.equal(out.verdict.intercept, false,
    'SOFTENED direction: an already-answered gate must NOT intercept (the 2026-07-02 live incident)');
  assert.equal(out.verdict.reason, 'gate-already-answered',
    'SOFTENED direction: the verdict must name the already-answered relevance reason');
});

// ---------------------------------------------------------------------------
// Leg 2 -- SOFTENED direction (EXPECTED RED until plan 210-05): the stale-artifact
// pattern. The preceding user turn is about a topic with zero token overlap with
// the gate's option-label set; the gate is irrelevant to the current conversation.
// ---------------------------------------------------------------------------
leg('leg 2 SOFTENED: an irrelevant/stale gate must not force-block (RED until plan 210-05)', function () {
  const out = classifyTranscript([
    { type: 'user', message: { role: 'user', content: 'what did the biomarker survival-curve figure show in that oncology paper?' } },
    { type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: ROOM_PICK_GATE }] } },
  ], 'gsd-210-irrelevant-session');
  assert.equal(out.verdict.intercept, false,
    'SOFTENED direction: a gate with zero connection to the current turn must NOT intercept');
  assert.equal(out.verdict.reason, 'gate-irrelevant-to-turn',
    'SOFTENED direction: the verdict must name the irrelevance reason');
});

// ---------------------------------------------------------------------------
// Leg 3 -- PRESERVE FLOOR (green NOW, must stay green FOREVER): a genuine,
// relevant, UNANSWERED fork with gate-shaped text and no fired card still
// intercepts. This is the Phase 209 guarantee; softening must never delete it.
// ---------------------------------------------------------------------------
leg('leg 3 PRESERVE FLOOR: a genuine relevant unanswered fork still intercepts (green now, stays green)', function () {
  const out = classifyTranscript([
    { type: 'user', message: { role: 'user', content: 'Can we resume work on the align-ecosystem room?' } },
    { type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: ROOM_PICK_GATE }] } },
  ], 'gsd-210-genuine-fork-session');
  assert.equal(out.turn.askuserquestion_fired, false,
    'PRESERVE FLOOR fixture sanity: no card fired on this turn');
  assert.equal(out.verdict.intercept, true,
    'PRESERVE FLOOR: a genuine, relevant, unanswered fork must STILL intercept (Phase 209 guarantee)');
  assert.equal(out.verdict.degrade, false,
    'PRESERVE FLOOR: the intercept is a real force, not a bounded-escape degrade');
});

// A genuine 2-option BINARY closer whose labels are NOT yes/no shaped (so the
// affirmation/negation branch of gateAlreadyAnswered cannot claim it) and whose
// subject tokens overlap the preceding user turn (so gate-irrelevant-to-turn cannot
// claim it either). The ONLY pass-reason that can fire is gate-is-simple-binary.
const BINARY_DRAFT_GATE = [
  'Which draft should I open next?',
  '1. The revenue projection draft',
  '2. The onboarding rewrite draft',
].join('\n');

// ---------------------------------------------------------------------------
// Leg 4 -- BINARY EXEMPTION (navigator decision 2026-07-05): a genuine, relevant,
// unanswered 2-option binary closer must pass as intercept:false with reason
// gate-is-simple-binary. The preceding user turn topically overlaps the gate (so it
// is not irrelevant) but does not answer it (no ordinal, no label match, not yes/no),
// so neither existing relevance pass-reason can claim it -- the exemption is the only
// path, reached through the live transcript, not the direct-field unit shape.
// ---------------------------------------------------------------------------
leg('leg 4 BINARY EXEMPTION: a relevant unanswered 2-option binary passes as gate-is-simple-binary', function () {
  const out = classifyTranscript([
    { type: 'user', message: { role: 'user', content: 'can you tell me about the revenue projection draft and the onboarding rewrite draft?' } },
    { type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: BINARY_DRAFT_GATE }] } },
  ], 'gsd-260705-m9g-binary-exemption-session');
  assert.equal(out.turn.askuserquestion_fired, false,
    'BINARY EXEMPTION fixture sanity: no card fired on this turn');
  assert.equal(out.verdict.intercept, false,
    'BINARY EXEMPTION: a simple 2-option binary closer must NOT intercept');
  assert.equal(out.verdict.reason, 'gate-is-simple-binary',
    'BINARY EXEMPTION: the verdict must name the simple-binary pass-reason');
});

// ---------------------------------------------------------------------------
// CR-05 (backstop-benign-list-defeats-relevance-gate, 2026-07-11) -- the framing
// co-requirement. Alternative 4 (bare `1. / 2.` numbered prose) now counts as a
// backstop hit ONLY when a choice-framing cue sits near it. Two directional legs:
//   Test 1 (benign, no framing): a plain 3-item "next steps" list must NOT intercept.
//   Test 2 (genuine, WITH framing): a hand-rolled `1./2./3.` fork carrying a
//     which/would-you-like/pick cue must STILL intercept (the Phase 209 floor survives).
// ---------------------------------------------------------------------------

// A benign, on-topic Action-Footer / next-steps list. No brackets (so alternatives 1-3
// cannot fire), and NO choice-framing cue anywhere near the numbered span (no `?`, no
// which/choose/pick/select/would-you-like/type-1), so alternative 4 must be inert.
const BENIGN_NEXT_STEPS = [
  'I traced the auth failure. The token check runs before the session middleware, so an '
    + 'expired token slips past validation and the login flow rejects a valid user.',
  'Next you could:',
  '1. Add logging around the token verification step',
  '2. Reorder the session middleware so it runs first',
  '3. Add a regression test for the expired-token path',
].join('\n');

leg('Test 1 CR-05: a benign on-topic 3-item next-steps list (no framing cue) must NOT intercept', function () {
  const out = classifyTranscript([
    { type: 'user', message: { role: 'user', content: 'Can you help me fix the auth bug in the login flow?' } },
    { type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: BENIGN_NEXT_STEPS }] } },
  ], 'gsd-cr05-benign-next-steps-session');
  assert.equal(out.turn.askuserquestion_fired, false,
    'Test 1 fixture sanity: no card fired on this turn');
  assert.equal(out.verdict.intercept, false,
    'CR-05: a benign numbered list with no choice-framing cue must NOT force-block');
  assert.equal(out.verdict.reason, 'no-gate-signal',
    'CR-05: with no unconditional glyph and no framed alternative-4 hit, the reason is no-gate-signal');
});

// A genuine hand-rolled Decision Gate: bracket-free `1./2./3.` prose WITH a which/?
// framing cue, topically relevant to the preceding user turn, unanswered, and 3-option
// (so gate-is-simple-binary cannot claim it). The ONLY outcome left is a real intercept.
const FRAMED_NUMBERED_GATE = [
  'Good question about the auth onboarding rewrite. Which onboarding path do you want to build?',
  '1. Guided setup wizard for the auth flow',
  '2. Minimal one-screen auth setup',
  '3. Import an existing auth config from a file',
].join('\n');

leg('Test 2 CR-05 PRESERVE FLOOR: a genuine framed `1./2./3.` fork must STILL intercept', function () {
  const out = classifyTranscript([
    { type: 'user', message: { role: 'user', content: 'Which onboarding path should we build for the auth rewrite?' } },
    { type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: FRAMED_NUMBERED_GATE }] } },
  ], 'gsd-cr05-framed-gate-session');
  assert.equal(out.turn.askuserquestion_fired, false,
    'Test 2 fixture sanity: no card fired on this turn');
  assert.equal(out.verdict.intercept, true,
    'CR-05 floor: a genuine, relevant, unanswered framed fork must STILL intercept (Phase 209 guarantee survives Change 1)');
  assert.equal(out.verdict.reason, 'ascii-box-backstop-no-card',
    'CR-05 floor: the intercept fires on the BACKSTOP arm');
  assert.equal(out.verdict.degrade, false,
    'CR-05 floor: the intercept is a real force, not a bounded-escape degrade');
});

// ---------------------------------------------------------------------------
// CR-06 (Item 2a) -- the retry-key identity must NOT read `reason`. buildEnforcementEnvelope
// now calms the user-facing `reason`, and the ORIGINAL slug is relocated to the local
// intercept log. This is only safe if turnContextHash (the bounded-escape retry key) never
// derives identity from `reason`. Assert the non-effect directly.
// ---------------------------------------------------------------------------
leg('Test 3 CR-06: changing `reason` does NOT change turnContextHash / retry-key identity', function () {
  const base = { session_id: 'gsd-cr06-reason-noeffect-session', gate_signature: 'abc123deadbeef01', ran_entries: [] };
  const hashA = checkCardFire.turnContextHash(Object.assign({}, base, { reason: 'ascii-box-backstop-no-card' }));
  const hashB = checkCardFire.turnContextHash(Object.assign({}, base, { reason: 'rendering your choices as a selectable card' }));
  assert.equal(hashA, hashB,
    'turnContextHash must NOT read `reason` -- the retry key is anchored on session_id + gate identity only');
  // Sanity guard: the hash IS sensitive to the gate identity, so the equality above is meaningful
  // (not a degenerate constant).
  const hashC = checkCardFire.turnContextHash(Object.assign({}, base, { gate_signature: 'different99feed', reason: 'ascii-box-backstop-no-card' }));
  assert.notEqual(hashA, hashC,
    'changing gate_signature MUST change the hash -- guards against a degenerate constant identity');
});

fs.rmSync(HERMETIC_TMP, { recursive: true, force: true });

console.log('\ntest-card-fire-relevance-gate: ' + pass + ' passed, ' + fail + ' failed'
  + (fail > 0 ? ' (softened-direction RED legs are EXPECTED until plan 210-05 lands)' : ''));
process.exit(fail > 0 ? 1 : 0);
