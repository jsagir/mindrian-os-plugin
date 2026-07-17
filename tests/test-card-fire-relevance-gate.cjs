'use strict';
// SUPERSEDED IN PART by backstop-numbered-prose-retired (card-fire-relevance-check-gap,
// navigator decision 2026-07-17): the bare numbered-prose backstop arm is RETIRED (6 false
// positives vs 1 true catch in the live log). The relevance-gate legs (1-5) render their gates
// as BRACKET-BOX (the surviving backstop shape) so they still exercise the relevance machinery;
// legs 6-8 and Test 2 (which render numbered-prose forks) are FLIPPED to assert the new contract
// -- a numbered-prose fork no longer force-fires at the hook; the model's Phase-210 judgment owns
// it. This DELIBERATELY reverses the HOOK-level guarantee of intern-w1-card-discipline-decay and
// interacts with the OPEN under-firing sibling bug; see the legs 6-8 block for the trade-off. The
// descriptions below reflect the pre-supersession intent.
//
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
//   Leg 4 (BINARY EXEMPTION -> intern-w1-card-discipline-decay, 2026-07-11): a
//     genuine, RELEVANT, UNANSWERED 2-option FORK whose labels are NOT yes/no
//     shaped now FORCE-FIRES (intercept:true) through the LIVE transcript path.
//     Originally this leg asserted the opposite (a bare `gateLabels.length===2`
//     cardinality check swallowed any 2-option gate, yes/no or not) -- that was
//     the exact shape of the intern's 3 missed forks in one QA session. The
//     assertion below was corrected as part of that fix; a NEW leg 5 proves a
//     genuine yes/no-shaped closer still stays exempt (the navigator-approved
//     2026-07-05 behavior, narrowed rather than removed).
//   Leg 5 (YES/NO EXEMPTION PRESERVED, intern-w1-card-discipline-decay fix): a
//     genuine, RELEVANT, UNANSWERED 2-option gate whose labels ARE yes/no shaped
//     still passes as intercept:false reason gate-is-simple-binary -- the
//     narrowed exemption is not a removal.
//   Legs 6-8 (INTERN REGRESSION FIXTURES): the intern's 3 quoted missed-fork
//     phrasings, reconstructed as numbered-prose gate renderings (this worktree's
//     ASCII_BOX_GLYPH_RE has no framing-cue co-requirement -- that is CR-05, which
//     landed on main AFTER this worktree branched and is out of scope here), each
//     asserted to now force-fire instead of being swallowed by gate-is-simple-binary.
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
// backstop-numbered-prose-retired (card-fire-relevance-check-gap, 2026-07-17): the
// relevance-gate legs (1-5) render their gates as BRACKET-BOX (the surviving backstop
// shape, ASCII_BOX_UNCONDITIONAL_RE arms 1-3) so they still admit the turn to the relevance
// machinery under test. extractOptionLabels treats `[n]` and `n.` markers identically, so the
// relevance / already-answered / binary logic is unchanged; only the shape detector that lets
// the turn reach those checks moved off the retired numbered-prose arm onto the bracket arm.
const ROOM_PICK_GATE = [
  'Ignite -- pick a room to resume, or start something new',
  '[1] ALIGN - Well-Defined Problem - opened in the last day',
  '[2] Just talk (no room)',
  '[3] Start a new room',
].join('\n');

// A release go/no-go gate whose option labels a plain-text "yes" plainly answers.
const RELEASE_GATE = [
  'Publish this release?',
  '[1] Yes - publish v1.15.2 to npm now',
  '[2] No - hold the release for another pass',
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

// A genuine 2-option FORK whose labels are NOT yes/no shaped (so the
// affirmation/negation branch of gateAlreadyAnswered cannot claim it) and whose
// subject tokens overlap the preceding user turn (so gate-irrelevant-to-turn cannot
// claim it either). Pre-fix this was swallowed by the bare-cardinality
// gate-is-simple-binary check; post-fix (intern-w1-card-discipline-decay) it must
// force-fire, since isYesNoShapedGate is false for these labels.
const BINARY_DRAFT_GATE = [
  'Which draft should I open next?',
  '[1] The revenue projection draft',
  '[2] The onboarding rewrite draft',
].join('\n');

// ---------------------------------------------------------------------------
// Leg 4 -- intern-w1-card-discipline-decay (2026-07-11): a genuine, relevant,
// unanswered 2-option FORK (not yes/no shaped) must now FORCE-FIRE. The preceding
// user turn topically overlaps the gate (so it is not irrelevant) but does not
// answer it (no ordinal, no label match, not yes/no) -- so neither relevance
// pass-reason claims it, and the narrowed gate-is-simple-binary exemption no
// longer claims it either (its labels are not yes/no shaped), so it falls
// through to the final intercept: force it, exactly like a 3+-way fork.
// ---------------------------------------------------------------------------
leg('leg 4 FORK NOW FORCE-FIRES: a relevant unanswered non-yes/no 2-option fork intercepts (intern-w1-card-discipline-decay fix)', function () {
  const out = classifyTranscript([
    { type: 'user', message: { role: 'user', content: 'can you tell me about the revenue projection draft and the onboarding rewrite draft?' } },
    { type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: BINARY_DRAFT_GATE }] } },
  ], 'gsd-260705-m9g-binary-exemption-session');
  assert.equal(out.turn.askuserquestion_fired, false,
    'FORK fixture sanity: no card fired on this turn');
  assert.equal(out.verdict.intercept, true,
    'FIXED: a genuine non-yes/no 2-option fork must force-fire, not be swallowed as gate-is-simple-binary');
  assert.equal(out.verdict.reason, 'ascii-box-backstop-no-card',
    'FIXED: the verdict must name the backstop intercept reason, not the binary exemption');
});

// A genuine YES/NO-shaped 2-option closer (labels start with "yes" / "no"). The
// preceding user turn topically overlaps the gate but does not plainly answer it
// (no ordinal, no exact label match, no bare yes/no token) -- so gate-already-answered
// and gate-irrelevant-to-turn both fall through, and the narrowed gate-is-simple-binary
// exemption must STILL claim it (the exemption is narrowed, not removed).
const RELEASE_GATE_UNANSWERED = [
  'Publish this release?',
  '[1] Yes - publish v1.15.2 to npm now',
  '[2] No - hold the release for another pass',
].join('\n');

// ---------------------------------------------------------------------------
// Leg 5 -- YES/NO EXEMPTION PRESERVED (intern-w1-card-discipline-decay fix): a
// genuine, relevant, unanswered yes/no-shaped 2-option closer must still pass as
// intercept:false reason gate-is-simple-binary. Proves the fix NARROWED the
// exemption to yes/no-shaped closers rather than deleting it outright.
// ---------------------------------------------------------------------------
leg('leg 5 YES/NO EXEMPTION PRESERVED: a relevant unanswered yes/no closer still passes as gate-is-simple-binary', function () {
  const out = classifyTranscript([
    { type: 'user', message: { role: 'user', content: "I'm still deciding about the release timeline for this publish." } },
    { type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: RELEASE_GATE_UNANSWERED }] } },
  ], 'gsd-intern-w1-yesno-exemption-session');
  assert.equal(out.turn.askuserquestion_fired, false,
    'YES/NO EXEMPTION fixture sanity: no card fired on this turn');
  assert.equal(out.verdict.intercept, false,
    'PRESERVED: a genuine yes/no-shaped 2-option closer must NOT intercept');
  assert.equal(out.verdict.reason, 'gate-is-simple-binary',
    'PRESERVED: the verdict must still name the simple-binary pass-reason');
});

// ---------------------------------------------------------------------------
// Legs 6-8 -- INTERN REGRESSION FIXTURES, FLIPPED by backstop-numbered-prose-retired
// (card-fire-relevance-check-gap, navigator decision 2026-07-17). The 3 quoted missed-fork
// phrasings from Intern-4's session are NUMBERED-PROSE gate renderings. The HOOK-level
// guarantee of intern-w1-card-discipline-decay (a numbered-prose fork force-fires) is
// DELIBERATELY REVERSED: the numbered-prose backstop arm produced 6 false positives against 1
// true catch in the live log and could not separate a benign numbered list from a genuine
// fork, so it was retired. These forks now produce no-gate-signal at the hook; catching a
// genuine numbered-prose fork is the model's own Phase-210 / SEED-021 judgment (its system
// prompt still mandates firing AskUserQuestion for a real decision fork). KNOWN TRADE-OFF:
// this shifts toward the OPEN opposite-direction under-firing sibling bug
// (intern-qa-silent-degrade-pattern-*); a BRACKET-BOX rendering of the same fork still
// force-fires (arms 1-3 survive, see leg 4). If the hook-level numbered-prose catch is later
// wanted back, the path is the negation-guarded tighten-framing variant, not re-adding the arm.
// ---------------------------------------------------------------------------
const INTERN_FORK_1 = [
  'Which pull is stronger right now?',
  '1. Get hired soon',
  '2. Build toward the long-term plan',
].join('\n');

const INTERN_FORK_2 = [
  'Two paths from here:',
  '1. Run research',
  '2. Build the plan',
].join('\n');

const INTERN_FORK_3 = [
  'Two options:',
  '1. Build the plan now',
  '2. File evidence first',
].join('\n');

leg('leg 6 INTERN FORK 1: numbered-prose fork no longer force-fires via the backstop (model judgment owns it)', function () {
  const out = classifyTranscript([
    { type: 'user', message: { role: 'user', content: 'I keep going back and forth between getting hired soon and building toward the long-term plan.' } },
    { type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: INTERN_FORK_1 }] } },
  ], 'gsd-intern-w1-fork1-session');
  assert.equal(out.verdict.intercept, false,
    'RETIRED (2026-07-17): a bare numbered-prose fork is no longer a hook force-fire; the model Phase-210 judgment owns it');
  assert.equal(out.verdict.reason, 'no-gate-signal',
    'no bracket-box glyph and the numbered-prose arm is retired, so the reason is no-gate-signal');
});

leg('leg 7 INTERN FORK 2: numbered-prose fork no longer force-fires via the backstop (model judgment owns it)', function () {
  const out = classifyTranscript([
    { type: 'user', message: { role: 'user', content: 'not sure if we should run research first or just build the plan directly.' } },
    { type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: INTERN_FORK_2 }] } },
  ], 'gsd-intern-w1-fork2-session');
  assert.equal(out.verdict.intercept, false,
    'RETIRED (2026-07-17): a bare numbered-prose fork is no longer a hook force-fire; the model Phase-210 judgment owns it');
  assert.equal(out.verdict.reason, 'no-gate-signal',
    'no bracket-box glyph and the numbered-prose arm is retired, so the reason is no-gate-signal');
});

leg('leg 8 INTERN FORK 3: numbered-prose fork no longer force-fires via the backstop (model judgment owns it)', function () {
  const out = classifyTranscript([
    { type: 'user', message: { role: 'user', content: 'trying to decide whether to build the plan now or file evidence first.' } },
    { type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: INTERN_FORK_3 }] } },
  ], 'gsd-intern-w1-fork3-session');
  assert.equal(out.verdict.intercept, false,
    'RETIRED (2026-07-17): a bare numbered-prose fork is no longer a hook force-fire; the model Phase-210 judgment owns it');
  assert.equal(out.verdict.reason, 'no-gate-signal',
    'no bracket-box glyph and the numbered-prose arm is retired, so the reason is no-gate-signal');
});

// ---------------------------------------------------------------------------
// CR-05 legs, SUPERSEDED by backstop-numbered-prose-retired (card-fire-relevance-check-gap,
// 2026-07-17). The bare numbered-prose backstop arm (alternative 4) is RETIRED entirely, so
// BOTH numbered-prose legs below now assert no-gate-signal:
//   Test 1 (benign, no framing): a plain 3-item "next steps" list does NOT intercept
//     (unchanged -- it never carried a framing cue, and now the arm is gone regardless).
//   Test 2 (formerly "genuine framed fork must STILL intercept"): FLIPPED -- a numbered-prose
//     fork no longer force-fires at the hook; the model's Phase-210 judgment owns it. A
//     bracket-box rendering of the same fork still force-fires (arms 1-3 survive, see leg 4).
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

// A genuine hand-rolled Decision Gate rendered as bracket-free `1./2./3.` numbered prose WITH a
// which/? framing cue. backstop-numbered-prose-retired (2026-07-17): the numbered-prose backstop
// arm is RETIRED, so this NO LONGER force-fires at the hook -- the model's Phase-210 judgment owns
// a genuine numbered-prose fork now. The SAME fork rendered as a `[1]...[2]` bracket box still
// force-fires (arms 1-3 survive; see leg 4).
const FRAMED_NUMBERED_GATE = [
  'Good question about the auth onboarding rewrite. Which onboarding path do you want to build?',
  '1. Guided setup wizard for the auth flow',
  '2. Minimal one-screen auth setup',
  '3. Import an existing auth config from a file',
].join('\n');

leg('Test 2 CR-05 FLIPPED: a genuine framed `1./2./3.` numbered-prose fork no longer force-fires (retired; model owns it)', function () {
  const out = classifyTranscript([
    { type: 'user', message: { role: 'user', content: 'Which onboarding path should we build for the auth rewrite?' } },
    { type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: FRAMED_NUMBERED_GATE }] } },
  ], 'gsd-cr05-framed-gate-session');
  assert.equal(out.turn.askuserquestion_fired, false,
    'Test 2 fixture sanity: no card fired on this turn');
  assert.equal(out.verdict.intercept, false,
    'RETIRED (2026-07-17): a bare numbered-prose fork no longer force-fires at the hook; the model Phase-210 judgment owns it');
  assert.equal(out.verdict.reason, 'no-gate-signal',
    'no bracket-box glyph and the numbered-prose arm is retired, so the reason is no-gate-signal');
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
