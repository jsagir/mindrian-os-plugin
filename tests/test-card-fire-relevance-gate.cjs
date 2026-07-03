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
const ROOM_PICK_GATE = [
  'Ignite -- pick a room to resume, or start something new',
  '1. ALIGN - Well-Defined Problem - opened in the last day',
  '2. Just talk (no room)',
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

fs.rmSync(HERMETIC_TMP, { recursive: true, force: true });

console.log('\ntest-card-fire-relevance-gate: ' + pass + ' passed, ' + fail + ' failed'
  + (fail > 0 ? ' (softened-direction RED legs are EXPECTED until plan 210-05 lands)' : ''));
process.exit(fail > 0 ? 1 : 0);
