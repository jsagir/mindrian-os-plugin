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

// A genuine 2-option FORK whose labels are NOT yes/no shaped (so the
// affirmation/negation branch of gateAlreadyAnswered cannot claim it) and whose
// subject tokens overlap the preceding user turn (so gate-irrelevant-to-turn cannot
// claim it either). Pre-fix this was swallowed by the bare-cardinality
// gate-is-simple-binary check; post-fix (intern-w1-card-discipline-decay) it must
// force-fire, since isYesNoShapedGate is false for these labels.
const BINARY_DRAFT_GATE = [
  'Which draft should I open next?',
  '1. The revenue projection draft',
  '2. The onboarding rewrite draft',
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
  '1. Yes - publish v1.15.2 to npm now',
  '2. No - hold the release for another pass',
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
// Legs 6-8 -- INTERN REGRESSION FIXTURES (intern-w1-card-discipline-decay): the 3
// quoted missed-fork phrasings from Intern-4's session, reconstructed as
// numbered-prose gate renderings (this worktree's ASCII_BOX_GLYPH_RE has no
// framing-cue co-requirement -- CR-05 is out of scope here, see the debug file).
// Each is a genuine two-way forced-choice fork, not yes/no shaped, and must now
// force-fire instead of being swallowed by gate-is-simple-binary.
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

leg('leg 6 INTERN FORK 1 force-fires: "get hired soon vs build toward" is not yes/no shaped', function () {
  const out = classifyTranscript([
    { type: 'user', message: { role: 'user', content: 'I keep going back and forth between getting hired soon and building toward the long-term plan.' } },
    { type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: INTERN_FORK_1 }] } },
  ], 'gsd-intern-w1-fork1-session');
  assert.equal(out.verdict.intercept, true,
    'INTERN FORK 1 must force-fire, not be swallowed as gate-is-simple-binary');
  assert.notEqual(out.verdict.reason, 'gate-is-simple-binary',
    'INTERN FORK 1 must not be classified as a simple binary');
});

leg('leg 7 INTERN FORK 2 force-fires: "run research vs build the plan" is not yes/no shaped', function () {
  const out = classifyTranscript([
    { type: 'user', message: { role: 'user', content: 'not sure if we should run research first or just build the plan directly.' } },
    { type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: INTERN_FORK_2 }] } },
  ], 'gsd-intern-w1-fork2-session');
  assert.equal(out.verdict.intercept, true,
    'INTERN FORK 2 must force-fire, not be swallowed as gate-is-simple-binary');
  assert.notEqual(out.verdict.reason, 'gate-is-simple-binary',
    'INTERN FORK 2 must not be classified as a simple binary');
});

leg('leg 8 INTERN FORK 3 force-fires: "build the plan now vs file evidence first" is not yes/no shaped', function () {
  const out = classifyTranscript([
    { type: 'user', message: { role: 'user', content: 'trying to decide whether to build the plan now or file evidence first.' } },
    { type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: INTERN_FORK_3 }] } },
  ], 'gsd-intern-w1-fork3-session');
  assert.equal(out.verdict.intercept, true,
    'INTERN FORK 3 must force-fire, not be swallowed as gate-is-simple-binary');
  assert.notEqual(out.verdict.reason, 'gate-is-simple-binary',
    'INTERN FORK 3 must not be classified as a simple binary');
});

fs.rmSync(HERMETIC_TMP, { recursive: true, force: true });

console.log('\ntest-card-fire-relevance-gate: ' + pass + ' passed, ' + fail + ' failed'
  + (fail > 0 ? ' (softened-direction RED legs are EXPECTED until plan 210-05 lands)' : ''));
process.exit(fail > 0 ? 1 : 0);
