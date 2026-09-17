'use strict';
// Phase 209-06 (H3) -- PRIMARY side-channel writer/reader + consumer wire.
//
// Behaviors 1-4 (Task 1): the module round trip, degrade paths, TTL, and the
// three producer call sites (hermetic fixtures; never touches the real
// ~/.mindrian). Behaviors 5-7 (Task 2): the check-card-fire.cjs consumer
// wire, source-verified against the constitutional floor.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.join(__dirname, '..');
const sidechannel = require(path.join(REPO, 'lib', 'core', 'card-fire-sidechannel.cjs'));
const { recordReachedGate, readReachedGates, readReachedGateSubjects } = sidechannel;

let n = 0;
function ok(desc, fn) { fn(); n += 1; console.log('  ok   ' + desc); }

console.log('test-209-primary-sidechannel');

function tmpFile() {
  return path.join(os.tmpdir(), 'gsd-sidechannel-' + Date.now() + '-' + Math.floor(Math.random() * 1e6) + '.json');
}

// ---------------------------------------------------------------------------
// Task 1: writer/reader behaviors
// ---------------------------------------------------------------------------

ok('Behavior 1: round trip - recordReachedGate then readReachedGates returns the entry; a different sessionId returns []', function () {
  const f = tmpFile();
  recordReachedGate({ sessionId: 's1', surface: 'lib/hmi/selector-dispatcher.cjs', shape: 'F.1', filePath: f });
  const got = readReachedGates('s1', { filePath: f });
  assert.equal(Array.isArray(got), true);
  assert.equal(got.indexOf('lib/hmi/selector-dispatcher.cjs') !== -1, true);
  const other = readReachedGates('s2', { filePath: f });
  assert.deepStrictEqual(other, []);
  fs.unlinkSync(f);
});

ok('Behavior 2: degrade - corrupt file, missing file, and an oversized file all yield [] / a silent no-op, never throw', function () {
  const corrupt = tmpFile();
  fs.writeFileSync(corrupt, 'not valid json {{{');
  assert.doesNotThrow(function () {
    const got = readReachedGates('s1', { filePath: corrupt });
    assert.deepStrictEqual(got, []);
  });
  fs.unlinkSync(corrupt);

  const missing = tmpFile(); // never created
  assert.doesNotThrow(function () {
    const got = readReachedGates('s1', { filePath: missing });
    assert.deepStrictEqual(got, []);
  });

  const oversized = tmpFile();
  fs.writeFileSync(oversized, JSON.stringify({ s1: [{ entry: 'x'.repeat(sidechannel.SIZE_CAP_BYTES * 5), ts: Date.now() }] }));
  assert.doesNotThrow(function () {
    const got = readReachedGates('s1', { filePath: oversized });
    assert.deepStrictEqual(got, []);
  });
  fs.unlinkSync(oversized);

  // recordReachedGate never throws on a garbage opts / unwritable path either.
  assert.doesNotThrow(function () { recordReachedGate(null); });
  assert.doesNotThrow(function () { recordReachedGate({ surface: 's', filePath: '/nonexistent-dir-xyz/definitely/not/writable.json' }); });
});

ok('Behavior 3: TTL - entries older than TTL_MS are pruned on read', function () {
  const f = tmpFile();
  const staleTs = Date.now() - (sidechannel.TTL_MS + 60000);
  fs.writeFileSync(f, JSON.stringify({ s1: [{ entry: 'stale/surface.cjs', ts: staleTs }] }));
  const got = readReachedGates('s1', { filePath: f });
  assert.deepStrictEqual(got, []);
  fs.unlinkSync(f);
});

ok('Behavior 4: the pickShape door writes ONLY when payload.emitTelemetry===true (fs_scope proof); the engine arm and emitBindingGate paths write their own records', function () {
  const f = tmpFile();
  const dispatcher = require(path.join(REPO, 'lib', 'hmi', 'selector-dispatcher.cjs'));

  const origEnv = process.env.CARD_FIRE_SIDECHANNEL_PATH;
  process.env.CARD_FIRE_SIDECHANNEL_PATH = f;
  // stop-hook-fires-card-on-option-shaped-prose-sentence (2026-09-17, second pass):
  // the trailer door now threads process.env.CLAUDE_CODE_SESSION_ID into its mint when
  // present (see selector-dispatcher.cjs). This behavior test is about the fs_scope
  // emitTelemetry gate specifically, not session identity, so CLAUDE_CODE_SESSION_ID is
  // cleared for its duration (this ambient dev/CI process DOES carry a real one -- a live
  // Claude Code Bash-tool subprocess inherits it, confirmed directly) so the mint falls
  // through to NO_SESSION_KEY exactly like the pre-fix contract this test still checks.
  // The NEW session-threading behavior gets its own dedicated tests below (Behavior 17).
  const origSessionEnv = process.env.CLAUDE_CODE_SESSION_ID;
  delete process.env.CLAUDE_CODE_SESSION_ID;
  try {
    // Without emitTelemetry: no write at all (file never created).
    dispatcher.pickShape({
      requestedShape: 'F.1',
      roomDir: null,
      operator: null,
      payload: { verbs: ['A', 'B'], header: 'h' },
    });
    assert.equal(fs.existsSync(f), false, 'no telemetry flag must mean zero FS side-effects');

    // With emitTelemetry: a record is written.
    dispatcher.pickShape({
      requestedShape: 'F.1',
      roomDir: null,
      operator: null,
      payload: { verbs: ['A', 'B'], header: 'h', emitTelemetry: true },
    });
    assert.equal(fs.existsSync(f), true, 'emitTelemetry:true must produce a side-channel record');
    const got = readReachedGates('no-session', { filePath: f });
    assert.equal(got.indexOf('lib/hmi/selector-dispatcher.cjs') !== -1, true);
  } finally {
    if (origEnv === undefined) delete process.env.CARD_FIRE_SIDECHANNEL_PATH;
    else process.env.CARD_FIRE_SIDECHANNEL_PATH = origEnv;
    if (origSessionEnv === undefined) delete process.env.CLAUDE_CODE_SESSION_ID;
    else process.env.CLAUDE_CODE_SESSION_ID = origSessionEnv;
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }
});

ok('Source proof: recordReachedGate sits inside the emitTelemetry guard in selector-dispatcher.cjs; both intent-classifier.cjs sites are present', function () {
  const dispatcherSrc = fs.readFileSync(path.join(REPO, 'lib', 'hmi', 'selector-dispatcher.cjs'), 'utf8');
  const guardIdx = dispatcherSrc.indexOf('payloadObj.emitTelemetry === true');
  const producerIdx = dispatcherSrc.indexOf('recordReachedGate');
  assert.equal(guardIdx !== -1 && producerIdx !== -1 && producerIdx > guardIdx, true);

  const icSrc = fs.readFileSync(path.join(REPO, 'scripts', 'intent-classifier.cjs'), 'utf8');
  const count = (icSrc.match(/recordReachedGate/g) || []).length;
  // Phase 209 shipped 2 producer sites here (the engine arm + emitBindingGate). Phase 225
  // added a legitimate third (emitNoMatchGate, the zero-score no-match gate), so the exact
  // count grew. This guard exists to prove the producer sites are PRESENT, not to freeze a
  // literal count against every future legitimate gate-minting surface -- assert the floor.
  assert.equal(count >= 2, true, 'expected at least the 2 original recordReachedGate call sites in intent-classifier.cjs');
});

// ---------------------------------------------------------------------------
// Task 2: the PRIMARY consumer wire in check-card-fire.cjs
// ---------------------------------------------------------------------------

const checkCardFire = require(path.join(REPO, 'scripts', 'check-card-fire.cjs'));
const gateRelevance = require(path.join(REPO, 'lib', 'core', 'gate-relevance.cjs'));

ok('Behavior 5: a session with side-channel records and no fired card classifies reached-gate-no-card even with plain-prose output text', function () {
  const f = tmpFile();
  const origEnv = process.env.CARD_FIRE_SIDECHANNEL_PATH;
  process.env.CARD_FIRE_SIDECHANNEL_PATH = f;
  try {
    // card-fire-relevance-check-gap (2026-07-17): a PRIMARY intercept now requires a
    // non-empty reach-recorded subject (proof a gate existed THIS turn), so the fixture
    // records the gate's own subject text alongside the surface. preceding_user_text is
    // empty here, so the relevance check is conservatively relevant and the intercept holds.
    recordReachedGate({ sessionId: 'sess-incident', surface: 'lib/hmi/selector-dispatcher.cjs', shape: 'F.1', subjectText: 'Ignite - pick a room to resume or continue', filePath: f });

    const env = {
      session_id: 'sess-incident',
      output_text: 'Sounds good, want me to continue with that room?',
      askuserquestion_fired: false,
    };
    const turn = checkCardFire.deriveTurnSignals(env);
    assert.equal(turn.ran_entries.indexOf('lib/hmi/selector-dispatcher.cjs') !== -1, true, 'ran_entries must be populated from the side file');

    const registry = checkCardFire.loadRegistry();
    const verdict = checkCardFire.classifyCardFire(turn, registry);
    assert.equal(verdict.intercept, true);
    assert.equal(verdict.reason, 'reached-registry-gate-no-card');
  } finally {
    if (origEnv === undefined) delete process.env.CARD_FIRE_SIDECHANNEL_PATH;
    else process.env.CARD_FIRE_SIDECHANNEL_PATH = origEnv;
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }
});

ok('Behavior 5b: the SAME turn WITH a fired card classifies pass', function () {
  const f = tmpFile();
  const origEnv = process.env.CARD_FIRE_SIDECHANNEL_PATH;
  process.env.CARD_FIRE_SIDECHANNEL_PATH = f;
  try {
    recordReachedGate({ sessionId: 'sess-incident-2', surface: 'lib/hmi/selector-dispatcher.cjs', shape: 'F.1', filePath: f });
    const env = {
      session_id: 'sess-incident-2',
      output_text: 'Sounds good, want me to continue with that room?',
      askuserquestion_fired: true,
    };
    const turn = checkCardFire.deriveTurnSignals(env);
    const registry = checkCardFire.loadRegistry();
    const verdict = checkCardFire.classifyCardFire(turn, registry);
    assert.equal(verdict.intercept, false);
    assert.equal(verdict.reason, 'card-fired');
  } finally {
    if (origEnv === undefined) delete process.env.CARD_FIRE_SIDECHANNEL_PATH;
    else process.env.CARD_FIRE_SIDECHANNEL_PATH = origEnv;
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }
});

ok('Behavior 6: direct-field envelopes (the unit-test shape) keep precedence over the side file', function () {
  const f = tmpFile();
  const origEnv = process.env.CARD_FIRE_SIDECHANNEL_PATH;
  process.env.CARD_FIRE_SIDECHANNEL_PATH = f;
  try {
    recordReachedGate({ sessionId: 'sess-direct', surface: 'some/other-surface.cjs', shape: 'F.1', filePath: f });
    const env = {
      session_id: 'sess-direct',
      ran_entries: ['already-carried-entry.cjs'],
      output_text: 'plain text',
      askuserquestion_fired: false,
    };
    const turn = checkCardFire.deriveTurnSignals(env);
    assert.deepStrictEqual(turn.ran_entries, ['already-carried-entry.cjs'], 'an envelope that already carries ran_entries must not be overwritten by the side file');
  } finally {
    if (origEnv === undefined) delete process.env.CARD_FIRE_SIDECHANNEL_PATH;
    else process.env.CARD_FIRE_SIDECHANNEL_PATH = origEnv;
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }
});

ok('Behavior 7: an empty/missing side file leaves behavior byte-identical to today', function () {
  const f = tmpFile(); // never created -> readReachedGates degrades to []
  const origEnv = process.env.CARD_FIRE_SIDECHANNEL_PATH;
  process.env.CARD_FIRE_SIDECHANNEL_PATH = f;
  try {
    const env = { session_id: 'sess-empty', output_text: 'ordinary turn', askuserquestion_fired: false };
    const turn = checkCardFire.deriveTurnSignals(env);
    assert.deepStrictEqual(turn.ran_entries, []);
    const registry = checkCardFire.loadRegistry();
    const verdict = checkCardFire.classifyCardFire(turn, registry);
    assert.equal(verdict.intercept, false);
    assert.equal(verdict.reason, 'no-gate-signal');
  } finally {
    if (origEnv === undefined) delete process.env.CARD_FIRE_SIDECHANNEL_PATH;
    else process.env.CARD_FIRE_SIDECHANNEL_PATH = origEnv;
  }
});

// ---------------------------------------------------------------------------
// Task 3: the PRIMARY-path relevance-gate false-positive fix (2026-07-05)
// ---------------------------------------------------------------------------

ok('Behavior 8: subject round trip + truncation - a normal subject is returned verbatim, an oversized one is truncated to MAX_SUBJECT_CHARS', function () {
  const f = tmpFile();
  const normal = 'rethinking-mindrianos governing_thought solution-design';
  const long = 'x'.repeat(sidechannel.MAX_SUBJECT_CHARS + 500);
  try {
    recordReachedGate({ sessionId: 's8', surface: 'lib/hmi/selector-dispatcher.cjs', shape: 'F.1', subjectText: normal, filePath: f });
    recordReachedGate({ sessionId: 's8', surface: 'scripts/intent-classifier.cjs', shape: 'F.8', subjectText: long, filePath: f });
    const subjects = readReachedGateSubjects('s8', { filePath: f });
    assert.equal(subjects.indexOf(normal) !== -1, true, 'the normal subject must be present verbatim');
    const truncated = subjects.find(function (s) { return s.length > 0 && s[0] === 'x'; });
    assert.equal(typeof truncated, 'string', 'the long subject must be present (truncated)');
    assert.equal(truncated.length, sidechannel.MAX_SUBJECT_CHARS, 'the long subject must be truncated to MAX_SUBJECT_CHARS');
  } finally {
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }
});

ok('Behavior 9: the false-positive regression proof (the literal 2026-07-05 incident shape) - a stale PRIMARY reach about an unrelated topic no longer force-blocks a turn about a different current topic', function () {
  const f = tmpFile();
  const origEnv = process.env.CARD_FIRE_SIDECHANNEL_PATH;
  process.env.CARD_FIRE_SIDECHANNEL_PATH = f;
  const staleSubject = 'rethinking-mindrianos governing_thought solution-design MindrianOS architecture refactor';
  try {
    // The stale reach: a PRIMARY registry-gate hit whose OWN subject text is
    // about the unrelated stale topic (the actual incident shape).
    recordReachedGate({
      sessionId: 'sess-incident-2026-07-05',
      surface: 'lib/hmi/selector-dispatcher.cjs',
      shape: 'F.1',
      subjectText: staleSubject,
      filePath: f,
    });

    // The CURRENT turn is about a completely different topic (drafting a
    // Gmail email about an assignment status), and the model's reply
    // naturally echoes that current topic back -- the exact mechanism that
    // caused the old code (comparing precedingUserText against outputText)
    // to false-positive as "relevant" regardless of the stale reach's real
    // subject.
    const precedingUserText = 'can you draft the Gmail email about the assignment status for Diana';
    const outputText = 'Sure, drafting the Gmail email now about the assignment status.';

    const env = {
      session_id: 'sess-incident-2026-07-05',
      output_text: outputText,
      preceding_user_text: precedingUserText,
      askuserquestion_fired: false,
    };
    const turn = checkCardFire.deriveTurnSignals(env);
    assert.equal(turn.gate_subject_text, staleSubject, 'gate_subject_text must equal the recorded subject text');

    const registry = checkCardFire.loadRegistry();
    const verdict = checkCardFire.classifyCardFire(turn, registry);
    assert.deepStrictEqual(
      { intercept: verdict.intercept, reason: verdict.reason },
      { intercept: false, reason: 'gate-irrelevant-to-turn' },
      'the fixed code must recognize the stale reach is irrelevant to the current turn and NOT intercept'
    );

    // Mechanism-of-failure proof, kept as a documented contrast (NOT a
    // behavior change to gate-relevance.cjs itself): the OLD comparison
    // (precedingUserText vs outputText, the model's own reply) would have
    // returned true (looked "relevant") for this exact fixture, because the
    // reply naturally echoes the user's current-turn topic back.
    assert.equal(
      gateRelevance.gateTopicallyRelevant(precedingUserText, outputText),
      true,
      'the OLD comparison (user turn vs the assistant own reply) is the mechanism of the original false positive'
    );
  } finally {
    if (origEnv === undefined) delete process.env.CARD_FIRE_SIDECHANNEL_PATH;
    else process.env.CARD_FIRE_SIDECHANNEL_PATH = origEnv;
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }
});

// ---------------------------------------------------------------------------
// Task 4: card-fire-over-enforcement (2026-07-20) -- the stale/cross-session
// bleed fix. Fix (A), ORIGINAL SHAPE (superseded 2026-09-17, see Behavior 10
// below): the NO_SESSION_KEY union was freshness-scoped so a sessionless mint
// could not leak across sessions past a time window. stop-hook-fires-card-on-
// option-shaped-prose-sentence (2026-09-17, SECOND pass) proved live that a
// time window narrows, but never closes, this leak -- there is no window width
// where "the second session's read is NEVER affected" is actually true except
// zero. Fix (A) is now "no union, ever" (see scopedRecords' own doc comment);
// Behavior 10 below is rewritten to match. Fix (B) is unaffected by this
// revision: the consumer still judges a side-channel gate FRESH vs STALE
// (mostRecentReachedTs vs TURN_FRESH_MS) within a session's OWN exact-match
// bucket, and threads staleness into the low-signal relevance branch.
// ---------------------------------------------------------------------------

ok('Behavior 10 (fix A, revised 2026-09-17): a no-session mint NEVER unions into another session read, regardless of age -- fresh or stale, it is invisible to a real session', function () {
  const f = tmpFile();
  const now = Date.now();
  // Just past the turn window but still well inside the 10-minute file TTL.
  const staleTs = now - (sidechannel.TURN_FRESH_MS + 30000);
  fs.writeFileSync(f, JSON.stringify({
    'no-session': [
      { entry: 'lib/hmi/selector-dispatcher.cjs', shape: 'F.1', ts: staleTs, subject: 'stale sessionless reach' },
    ],
  }));
  assert.deepStrictEqual(
    readReachedGates('some-other-live-session', { filePath: f }),
    [],
    'a no-session mint older than TURN_FRESH_MS must not bleed into another session (cross-session leak closed)'
  );
  // 2026-09-17 (second pass, live-disconfirmation of the first pass): a
  // GENUINELY FRESH sessionless mint must ALSO stay invisible to an unrelated
  // session -- there is no way to distinguish "my own same-turn read-back" from
  // "a concurrent peer session's mint" once the record carries no session
  // identity, so ANY union (however freshness-gated) is unsafe. This is the
  // exact scenario that live-disconfirmed the first pass's 20-second window.
  fs.writeFileSync(f, JSON.stringify({
    'no-session': [
      { entry: 'lib/hmi/selector-dispatcher.cjs', shape: 'F.1', ts: now, subject: 'fresh sessionless reach' },
    ],
  }));
  assert.deepStrictEqual(
    readReachedGates('some-other-live-session', { filePath: f }),
    [],
    'a genuinely fresh (0ms-old) no-session mint must ALSO never union into an unrelated session -- freshness cannot substitute for identity'
  );
  assert.equal(
    sidechannel.mostRecentReachedTs('some-other-live-session', { filePath: f }),
    0,
    'freshness for the unrelated session sees nothing from the sessionless bucket at any age'
  );
  fs.unlinkSync(f);
});

ok('Behavior 11 (fix B): a STALE same-session gate + a terse low-signal turn does NOT intercept; a FRESH one still does', function () {
  const f = tmpFile();
  const origEnv = process.env.CARD_FIRE_SIDECHANNEL_PATH;
  process.env.CARD_FIRE_SIDECHANNEL_PATH = f;
  const now = Date.now();
  const staleTs = now - (sidechannel.TURN_FRESH_MS + 30000); // prior-turn mint, still inside TTL
  const staleSubject = 'rethinking-mindrianos REACH decision gate governing_thought solution-design';
  const registry = checkCardFire.loadRegistry();
  // A terse slash-command-class trigger: a single subject token, unrelated to the stale reach.
  const terseEnv = {
    session_id: 'sess-stale-bleed',
    output_text: 'Running the doctor check now.',
    preceding_user_text: '/mos:doctor',
    askuserquestion_fired: false,
  };
  try {
    // STALE: a prior-turn reach still inside the 10-minute file TTL, keyed to THIS session.
    fs.writeFileSync(f, JSON.stringify({
      'sess-stale-bleed': [
        { entry: 'lib/hmi/selector-dispatcher.cjs', shape: 'F.1', ts: staleTs, subject: staleSubject },
      ],
    }));
    const staleTurn = checkCardFire.deriveTurnSignals(terseEnv);
    assert.equal(staleTurn.gate_is_fresh, false, 'a prior-turn side-channel mint must be judged stale');
    assert.equal(staleTurn.gate_subject_text, staleSubject, 'the stale subject still populates (fix B decides via staleness, not by dropping it)');
    const staleVerdict = checkCardFire.classifyCardFire(staleTurn, registry);
    assert.deepStrictEqual(
      { intercept: staleVerdict.intercept, reason: staleVerdict.reason },
      { intercept: false, reason: 'gate-irrelevant-to-turn' },
      'a terse turn against a STALE bled gate must NOT force-fire (the over-enforcement fix)'
    );

    // FRESH: the SAME terse turn against a this-turn mint of the same gate still force-fires
    // (the WR-06 / Behavior-5 conservative floor is preserved).
    fs.writeFileSync(f, JSON.stringify({
      'sess-stale-bleed': [
        { entry: 'lib/hmi/selector-dispatcher.cjs', shape: 'F.1', ts: now, subject: staleSubject },
      ],
    }));
    const freshTurn = checkCardFire.deriveTurnSignals(terseEnv);
    assert.equal(freshTurn.gate_is_fresh, true, 'a this-turn side-channel mint must be judged fresh');
    const freshVerdict = checkCardFire.classifyCardFire(freshTurn, registry);
    assert.equal(freshVerdict.intercept, true, 'a terse turn against a FRESH gate still force-fires (floor preserved)');
    assert.equal(freshVerdict.reason, 'reached-registry-gate-no-card', 'the fresh-gate intercept names the PRIMARY reason');
  } finally {
    if (origEnv === undefined) delete process.env.CARD_FIRE_SIDECHANNEL_PATH;
    else process.env.CARD_FIRE_SIDECHANNEL_PATH = origEnv;
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }
});

// ---------------------------------------------------------------------------
// Task 5: room-bind-gate-fires-on-notification-only-turns (2026-07-23) -- the F.8
// room-binding gate must NOT force-fire on a turn whose ONLY preceding "user" transcript
// record is a synthetic tool_result / task-notification envelope with zero human-authored
// text, while a genuinely terse HUMAN turn against the SAME gate must still force-fire
// (the WR-06/CR-06 conservative floor, unchanged). This is the live, three-times-reproduced
// defect: .planning/debug/resolved/room-bind-gate-fires-on-notification-only-turns.md.
// ---------------------------------------------------------------------------

// writeTranscriptAndDerive(records, sessionId) -- write a REAL transcript JSONL and drive
// it through the actual transcript_path Stop contract (readTranscriptTurn -> deriveTurnSignals),
// exactly mirroring the production path (not the direct-field unit-test shortcut), so the
// preceding_user_text_source classification is exercised end-to-end.
function writeTranscriptAndDerive(records, sessionId) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-room-bind-notif-'));
  const transcriptPath = path.join(tmpDir, 'turn.jsonl');
  fs.writeFileSync(
    transcriptPath,
    records.map(function (r) { return JSON.stringify(r); }).join('\n') + '\n',
    'utf8'
  );
  try {
    return checkCardFire.deriveTurnSignals({
      hook_event_name: 'Stop',
      session_id: sessionId,
      transcript_path: transcriptPath,
    });
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

// The F.8 room-binding gate's realistic subject text (scripts/intent-classifier.cjs's
// emitBindingGate composes zones.header + zones.body into subjectText -- mirrored here).
const F8_ROOM_BIND_SUBJECT = 'Bind this session to a room? rethinking-mindrianos - Just talk (no room) - Start a new room';

ok('Behavior 12: a synthetic tool_result-only preceding turn does NOT force-fire the F.8 room-bind gate (the confirmed live defect)', function () {
  const f = tmpFile();
  const origEnv = process.env.CARD_FIRE_SIDECHANNEL_PATH;
  process.env.CARD_FIRE_SIDECHANNEL_PATH = f;
  try {
    recordReachedGate({
      sessionId: 'sess-room-bind-notif',
      surface: 'scripts/intent-classifier.cjs',
      shape: 'F.8',
      subjectText: F8_ROOM_BIND_SUBJECT,
      filePath: f,
    });

    // The preceding "user" transcript record is a bare tool_result envelope (the confirmed
    // shape from live-session-running-stale-plugin-cache-fixes-inert.md's 2026-07-06 evidence:
    // a background tool call's result, or equally a background subagent completion notice) --
    // NO human ever typed anything this turn.
    const turn = writeTranscriptAndDerive([
      {
        type: 'user',
        message: {
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: 'toolu_01HgKX9Fexample',
              content: 'Background task "audit-fix-scan" completed successfully.',
            },
          ],
        },
      },
      {
        type: 'assistant',
        message: { role: 'assistant', content: [{ type: 'text', text: 'Noted, the background scan finished.' }] },
      },
    ], 'sess-room-bind-notif');

    assert.equal(turn.preceding_user_text, '', 'extractAssistantText must still resolve a tool_result-only record to empty text');
    assert.equal(turn.preceding_user_text_source, 'tool_result', 'the synthetic source classification must be confirmed tool_result');
    assert.equal(turn.gate_subject_text, F8_ROOM_BIND_SUBJECT, 'the F.8 gate subject must be recorded from the side channel');

    const registry = checkCardFire.loadRegistry();
    const verdict = checkCardFire.classifyCardFire(turn, registry);
    assert.deepStrictEqual(
      { intercept: verdict.intercept, reason: verdict.reason },
      { intercept: false, reason: 'preceding-turn-synthetic-no-user-engagement' },
      'a notification-only preceding turn must NOT force-fire the F.8 room-bind gate'
    );
  } finally {
    if (origEnv === undefined) delete process.env.CARD_FIRE_SIDECHANNEL_PATH;
    else process.env.CARD_FIRE_SIDECHANNEL_PATH = origEnv;
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }
});

ok('Behavior 13 (floor preserved): a genuinely terse HUMAN preceding turn ("ok") against the SAME F.8 gate still force-fires', function () {
  const f = tmpFile();
  const origEnv = process.env.CARD_FIRE_SIDECHANNEL_PATH;
  process.env.CARD_FIRE_SIDECHANNEL_PATH = f;
  try {
    recordReachedGate({
      sessionId: 'sess-room-bind-terse-human',
      surface: 'scripts/intent-classifier.cjs',
      shape: 'F.8',
      subjectText: F8_ROOM_BIND_SUBJECT,
      filePath: f,
    });

    // A human really was there this turn -- just terse. The WR-06/CR-06 conservative
    // force-floor must NOT be weakened by this fix: this is the exact case the fix must
    // NOT touch.
    const turn = writeTranscriptAndDerive([
      { type: 'user', message: { role: 'user', content: 'ok' } },
      {
        type: 'assistant',
        message: { role: 'assistant', content: [{ type: 'text', text: 'Continuing.' }] },
      },
    ], 'sess-room-bind-terse-human');

    assert.equal(turn.preceding_user_text, 'ok', 'a genuinely typed short turn must still populate preceding_user_text');
    assert.equal(turn.preceding_user_text_source, 'typed', 'a genuinely typed turn must classify as typed, never tool_result');

    const registry = checkCardFire.loadRegistry();
    const verdict = checkCardFire.classifyCardFire(turn, registry);
    assert.deepStrictEqual(
      { intercept: verdict.intercept, reason: verdict.reason },
      { intercept: true, reason: 'reached-registry-gate-no-card' },
      'a terse but genuinely HUMAN turn must still force-fire the F.8 gate (the conservative floor, unweakened)'
    );
  } finally {
    if (origEnv === undefined) delete process.env.CARD_FIRE_SIDECHANNEL_PATH;
    else process.env.CARD_FIRE_SIDECHANNEL_PATH = origEnv;
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }
});

ok('Behavior 14: classifyPrecedingUserContentSource classifies typed / tool_result / none correctly (unit-level, no transcript needed)', function () {
  const classify = checkCardFire.classifyPrecedingUserContentSource;
  assert.equal(typeof classify, 'function', 'classifyPrecedingUserContentSource must be exported');
  assert.equal(classify('go on'), 'typed', 'a bare non-empty string is typed');
  assert.equal(classify(''), 'none', 'a bare empty string is none');
  assert.equal(classify(null), 'none', 'null content is none');
  assert.equal(classify(undefined), 'none', 'undefined content is none');
  assert.equal(classify([]), 'none', 'an empty array is none');
  assert.equal(
    classify([{ type: 'tool_result', tool_use_id: 'x', content: 'done' }]),
    'tool_result',
    'an all-tool_result content array is tool_result'
  );
  assert.equal(
    classify([{ type: 'text', text: 'yes please' }]),
    'typed',
    'a real text block is typed'
  );
  assert.equal(
    classify([
      { type: 'tool_result', tool_use_id: 'x', content: 'done' },
      { type: 'text', text: 'and also continue with the plan' },
    ]),
    'typed',
    'a MIXED record with real human text alongside a tool_result is still typed (real text always wins)'
  );
});

// ---------------------------------------------------------------------------
// Task 6: card-fire-answered-gate-refires-within-ttl-window (2026-07-28) -- the
// RECORD LIFECYCLE fix. Before it, a reached-gate record's ONLY exit from the
// store was the 10-minute TTL, so ONE mint kept asserting "force the card" on
// EVERY Stop evaluation inside its 2-minute TURN_FRESH_MS window -- including
// the turns AFTER the navigator had already fired and answered the card. Three
// independent live sessions hit it (2026-07-22 x2, 2026-07-28), and it survived
// four interim fixes (18cc8b8b, f63d1ddc, 0d47ed6d, 5431b7e9) because none of
// them gave the record a lifecycle.
//
// The fix: consumeReachedGates (module) + consumeReachedGatesForVerdict
// (consumer) spend the records once a Stop evaluation reaches a TERMINAL verdict
// -- card-fired, no-gate-signal, a relevance pass, or a bounded-escape degrade.
// intercept:true is an ACTIVE force-loop and deliberately does NOT consume.
//
// BOTH DIRECTIONS are load-bearing here and both are asserted below:
//   (a) THE FIX          -- an answered gate must stop re-intercepting, and must
//                           stay quiet across a MULTI-TURN span (2026-07-22
//                           evidence: Leah's session took two blocks in one short
//                           run, so a 1-turn fixture would not have caught it).
//   (b) NON-REGRESSION   -- a genuinely still-pending fresh gate that was NEVER
//                           answered MUST keep force-firing, and MUST keep
//                           forcing across the whole retry loop until the bounded
//                           escape releases it. Losing this is the Phase 209
//                           guarantee in reverse and is exactly as bad as the
//                           over-enforcement the fix removes.
// ---------------------------------------------------------------------------

// simulateStopTurn(env) -- one Stop-hook evaluation, wired EXACTLY as
// scripts/check-card-fire.cjs main() wires it: derive signals, classify, then
// apply the terminal-verdict consumption. main() calls the consumption on its
// degrade branch and its no-intercept branch and NOT on its intercept branch;
// consumeReachedGatesForVerdict self-guards on intercept:true, so calling it
// unconditionally here is byte-equivalent to main()'s branching.
function simulateStopTurn(env) {
  const turn = checkCardFire.deriveTurnSignals(env);
  turn.retry_count = Number.isFinite(env.retry_count) ? env.retry_count : 0;
  turn.session_count = Number.isFinite(env.session_count) ? env.session_count : 0;
  const verdict = checkCardFire.classifyCardFire(turn, checkCardFire.loadRegistry());
  checkCardFire.consumeReachedGatesForVerdict(turn, verdict);
  return verdict;
}

function withSideFile(fn) {
  const f = tmpFile();
  const origEnv = process.env.CARD_FIRE_SIDECHANNEL_PATH;
  process.env.CARD_FIRE_SIDECHANNEL_PATH = f;
  try {
    fn(f);
  } finally {
    if (origEnv === undefined) delete process.env.CARD_FIRE_SIDECHANNEL_PATH;
    else process.env.CARD_FIRE_SIDECHANNEL_PATH = origEnv;
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }
}

ok('Behavior 12 (module): consumeReachedGates deletes the session bucket, returns the removed count, and is idempotent', function () {
  const f = tmpFile();
  recordReachedGate({ sessionId: 's-consume', surface: 'scripts/intent-classifier.cjs', shape: 'F.8', subjectText: 'bind session select rooms', filePath: f });
  recordReachedGate({ sessionId: 's-consume', surface: 'lib/hmi/selector-dispatcher.cjs', shape: 'F.1', subjectText: 'choose next reach', filePath: f });
  assert.equal(readReachedGates('s-consume', { filePath: f }).length, 2, 'both mints are visible before consumption');

  assert.equal(sidechannel.consumeReachedGates('s-consume', { filePath: f }), 2, 'consumption reports how many records it spent');
  assert.deepStrictEqual(readReachedGates('s-consume', { filePath: f }), [], 'the session bucket is gone after consumption');
  assert.deepStrictEqual(readReachedGateSubjects('s-consume', { filePath: f }), [], 'the subjects go with it');
  assert.equal(sidechannel.mostRecentReachedTs('s-consume', { filePath: f }), 0, 'freshness collapses to 0 once the records are spent');

  assert.equal(sidechannel.consumeReachedGates('s-consume', { filePath: f }), 0, 'consuming an already-spent session is a no-op, not an error');
  fs.unlinkSync(f);
});

ok('Behavior 12b (module): consumption is session-scoped and never touches another session or the NO_SESSION_KEY bucket', function () {
  const f = tmpFile();
  const now = Date.now();
  fs.writeFileSync(f, JSON.stringify({
    'sess-a': [{ entry: 'scripts/intent-classifier.cjs', shape: 'F.8', ts: now, subject: 'gate a' }],
    'sess-b': [{ entry: 'scripts/intent-classifier.cjs', shape: 'F.8', ts: now, subject: 'gate b' }],
    'no-session': [{ entry: 'lib/hmi/selector-dispatcher.cjs', shape: 'F.1', ts: now, subject: 'sessionless trailer-door mint' }],
  }));

  assert.equal(sidechannel.consumeReachedGates('sess-a', { filePath: f }), 1);
  assert.equal(
    readReachedGates('sess-a', { filePath: f }).indexOf('scripts/intent-classifier.cjs') === -1,
    true,
    "sess-a's OWN mint is spent (the still-visible sessionless trailer-door mint is the documented carve-out below, not sess-a's record)"
  );
  assert.equal(
    readReachedGates('sess-b', { filePath: f }).indexOf('scripts/intent-classifier.cjs') !== -1,
    true,
    'a CONCURRENT session must keep its own records -- consumption is never cross-session'
  );
  // The documented NO_SESSION_KEY carve-out: consuming under a real sessionId must NOT
  // delete a sessionless mint, or one idle session could silently destroy a DIFFERENT
  // session's genuine force-fire before that session ever adjudicated it.
  const raw = JSON.parse(fs.readFileSync(f, 'utf8'));
  assert.equal(Array.isArray(raw['no-session']) && raw['no-session'].length === 1, true,
    'the NO_SESSION_KEY bucket survives a session-scoped consumption (the documented carve-out)');
  // A caller with no sessionId of its own DOES consume that bucket (mirrors the read precedence).
  assert.equal(sidechannel.consumeReachedGates('', { filePath: f }), 1);
  assert.deepStrictEqual(readReachedGates('', { filePath: f }), [], 'a sessionless caller consumes the sessionless bucket');
  fs.unlinkSync(f);
});

ok('Behavior 12c (module): consumeReachedGates never throws on a corrupt, missing, or unwritable store', function () {
  const corrupt = tmpFile();
  fs.writeFileSync(corrupt, 'not valid json {{{');
  assert.doesNotThrow(function () { assert.equal(sidechannel.consumeReachedGates('s1', { filePath: corrupt }), 0); });
  fs.unlinkSync(corrupt);
  assert.doesNotThrow(function () { assert.equal(sidechannel.consumeReachedGates('s1', { filePath: tmpFile() }), 0); });
  assert.doesNotThrow(function () { sidechannel.consumeReachedGates(null); });
});

ok('Behavior 13 (a) THE FIX: a gate fired-and-answered in turn N does NOT re-intercept in turns N+1, N+2, N+3 inside the fresh window', function () {
  withSideFile(function (f) {
    const SUBJECT = '-- mindrianOS -- bind session -- select rooms -- 1. untitled-2026-06-01-1702 2. polygon 3. pws-website 4. mindrianOS';
    // Turn N: the F.8 binding gate is minted AND the navigator's card actually fires.
    recordReachedGate({ sessionId: 'sess-ttl-bleed', surface: 'scripts/intent-classifier.cjs', shape: 'F.8', subjectText: SUBJECT, filePath: f });
    const turnN = simulateStopTurn({
      session_id: 'sess-ttl-bleed',
      output_text: 'Which room(s) should this session write to?',
      preceding_user_text: 'bind this session to a room',
      preceding_user_text_source: 'typed',
      askuserquestion_fired: true,
    });
    assert.equal(turnN.intercept, false);
    assert.equal(turnN.reason, 'card-fired');
    assert.equal(readReachedGates('sess-ttl-bleed').length, 0,
      'a fired card is a TERMINAL verdict -- the gate mint is spent, not left to bleed forward');

    // Turns N+1..N+3: ordinary prose, no card, no gate shape, well inside the 2-minute
    // TURN_FRESH_MS window the mint above would otherwise still occupy. The 2026-07-22
    // evidence showed the bleed spanning MULTIPLE consecutive turns, so a single-turn
    // fixture is not sufficient coverage here.
    const followUps = [
      'Dev-repo only, no room. Launching the background executor now.',
      'Gap-closure executor running (root-cause the write-integrity discrepancy, then fix + independently re-verify). Standing by.',
      'Memory logged - two files, indexed at the top of MEMORY.md. The update ran clean.',
    ];
    for (let i = 0; i < followUps.length; i += 1) {
      const v = simulateStopTurn({
        session_id: 'sess-ttl-bleed',
        output_text: followUps[i],
        preceding_user_text: 'ok keep going with the room work and start the next step',
        preceding_user_text_source: 'typed',
        askuserquestion_fired: false,
      });
      assert.equal(v.intercept, false,
        'turn N+' + (i + 1) + ' must NOT be force-blocked for a gate that was already fired and answered');
      assert.equal(v.reason, 'no-gate-signal',
        'turn N+' + (i + 1) + ' carries no gate signal at all once the answered mint is spent');
    }
  });
});

ok('Behavior 13b (a) THE FIX: a relevance PASS is also terminal -- the declined gate is not re-litigated next turn', function () {
  withSideFile(function () {
    // A gate whose subject has ZERO token overlap with the turn: the relevance gate
    // passes it (gate-irrelevant-to-turn). That is a decision NOT to enforce, so the
    // record must be spent -- re-litigating it on the next turn is the defect.
    recordReachedGate({ sessionId: 'sess-irrelevant', surface: 'scripts/intent-classifier.cjs', shape: 'F.1', subjectText: 'quarterly pricing waterfall spreadsheet reconciliation' });
    const v1 = simulateStopTurn({
      session_id: 'sess-irrelevant',
      output_text: 'Here is the summary you asked for.',
      preceding_user_text: 'summarise yesterday transcription accuracy benchmarks',
      preceding_user_text_source: 'typed',
      askuserquestion_fired: false,
    });
    assert.equal(v1.intercept, false);
    assert.equal(v1.reason, 'gate-irrelevant-to-turn');
    assert.equal(readReachedGates('sess-irrelevant').length, 0, 'a declined gate is spent, not carried forward');

    const v2 = simulateStopTurn({
      session_id: 'sess-irrelevant',
      output_text: 'And here is the follow-up detail.',
      preceding_user_text: 'now walk me through the pricing waterfall reconciliation spreadsheet',
      preceding_user_text_source: 'typed',
      askuserquestion_fired: false,
    });
    assert.equal(v2.reason, 'no-gate-signal',
      'even a LATER topically-overlapping turn cannot resurrect a gate this session already declined');
  });
});

ok('Behavior 14 (b) NON-REGRESSION: a still-pending, never-answered fresh gate keeps force-firing across the WHOLE retry loop, then the degrade spends it', function () {
  withSideFile(function () {
    const SUBJECT = 'Choose your starting point - build the plan now, or run research first';
    const USER = 'help me choose a starting point for the venture plan';
    recordReachedGate({ sessionId: 'sess-pending', surface: 'scripts/intent-classifier.cjs', shape: 'F.1', subjectText: SUBJECT });

    // Retries 0, 1, 2: the model keeps refusing to fire the card. EVERY one of these
    // must still intercept -- an intercept is an ACTIVE force-loop, so the record must
    // survive it. If consumption ran here, MAX_FORCE_RETRIES would be unreachable and
    // the force-fire would silently collapse to a single shot.
    for (let retry = 0; retry < checkCardFire.MAX_FORCE_RETRIES; retry += 1) {
      const v = simulateStopTurn({
        session_id: 'sess-pending',
        output_text: 'I think you should probably just start with the research.',
        preceding_user_text: USER,
        preceding_user_text_source: 'typed',
        askuserquestion_fired: false,
        retry_count: retry,
      });
      assert.equal(v.intercept, true, 'retry ' + retry + ': a genuine unanswered fork MUST still force-fire');
      assert.equal(v.reason, 'reached-registry-gate-no-card');
      assert.equal(readReachedGates('sess-pending').length, 1,
        'retry ' + retry + ': the record MUST survive an active force-loop');
    }

    // The bounded escape releases: that IS terminal, so the record is finally spent.
    const degraded = simulateStopTurn({
      session_id: 'sess-pending',
      output_text: 'I think you should probably just start with the research.',
      preceding_user_text: USER,
      preceding_user_text_source: 'typed',
      askuserquestion_fired: false,
      retry_count: checkCardFire.MAX_FORCE_RETRIES,
    });
    assert.equal(degraded.degrade, true);
    assert.equal(degraded.intercept, false);
    assert.equal(readReachedGates('sess-pending').length, 0, 'a bounded-escape degrade spends the record');

    // And having been released, it never comes back to block an unrelated later turn.
    const after = simulateStopTurn({
      session_id: 'sess-pending',
      output_text: 'Running the research pass now.',
      preceding_user_text: 'go with research',
      preceding_user_text_source: 'typed',
      askuserquestion_fired: false,
    });
    assert.equal(after.intercept, false);
    assert.equal(after.reason, 'no-gate-signal');
  });
});

ok('Behavior 14b (b) NON-REGRESSION: consumption is scoped to the session that adjudicated -- a concurrent session still force-fires its own pending gate', function () {
  withSideFile(function () {
    recordReachedGate({ sessionId: 'sess-quiet', surface: 'scripts/intent-classifier.cjs', shape: 'F.1', subjectText: 'choose a starting point for the plan' });
    recordReachedGate({ sessionId: 'sess-busy', surface: 'scripts/intent-classifier.cjs', shape: 'F.1', subjectText: 'choose a starting point for the plan' });

    // The quiet session fires its card -> terminal -> spends ONLY its own record.
    const quiet = simulateStopTurn({
      session_id: 'sess-quiet',
      output_text: 'Which starting point do you want?',
      preceding_user_text: 'choose a starting point for the plan',
      preceding_user_text_source: 'typed',
      askuserquestion_fired: true,
    });
    assert.equal(quiet.reason, 'card-fired');

    // The busy session's own pending gate is untouched and still forces.
    const busy = simulateStopTurn({
      session_id: 'sess-busy',
      output_text: 'You should just go with the first one.',
      preceding_user_text: 'choose a starting point for the plan',
      preceding_user_text_source: 'typed',
      askuserquestion_fired: false,
    });
    assert.equal(busy.intercept, true, 'one session adjudicating must never disarm a DIFFERENT live session');
    assert.equal(busy.reason, 'reached-registry-gate-no-card');
  });
});

ok('Behavior 15: the consumption wire is present in BOTH enforcement paths (CLI Stop hook + MCP stop-gate handler) so they cannot drift apart again', function () {
  const hookSrc = fs.readFileSync(path.join(REPO, 'scripts', 'check-card-fire.cjs'), 'utf8');
  assert.equal(typeof checkCardFire.consumeReachedGatesForVerdict, 'function',
    'the consumer must export the lifecycle wire');
  assert.equal(typeof sidechannel.consumeReachedGates, 'function',
    'the side-channel module must export the consumption primitive');
  // main()'s two TERMINAL branches (degrade + no-intercept) both consume; the intercept
  // branch must not. Two call sites in main(), plus the definition itself.
  const callSites = hookSrc.split('consumeReachedGatesForVerdict(turn, verdict)').length - 1;
  assert.equal(callSites >= 2, true,
    'main() must consume on BOTH terminal branches (degrade and no-intercept), got ' + callSites);
  const mcpSrc = fs.readFileSync(path.join(REPO, 'lib', 'mcp', 'stop-gate-handler.cjs'), 'utf8');
  assert.equal(mcpSrc.indexOf('consumeReachedGatesForVerdict') !== -1, true,
    'the MCP stop-gate handler must WRAP the same lifecycle wire (Part 7), never fork a second one');
});

// ---------------------------------------------------------------------------
// Behavior 16 -- stop-hook-fires-card-on-option-shaped-prose-sentence /
// card-fire-stale-f1-reach-suggestion-forces-block-regardless-of-relevance
// (2026-09-17, SECOND pass -- the FIRST pass's SESSIONLESS_UNION_WINDOW_MS
// (20s) window narrowing was live-disconfirmed: it fired again with the fix
// already on disk, because a union gated on TIME ALONE cannot distinguish a
// legitimate same-turn read-back from a concurrent PEER session's mint -- both
// are, structurally, a fresh no-session record. The corrected fix removes the
// union entirely (scopedRecords now reads ONLY the exact-match session
// bucket) and instead gives the ONE producer that used to need the sessionless
// bucket (lib/hmi/selector-dispatcher.cjs's pickShape trailer door) a REAL
// session id: process.env.CLAUDE_CODE_SESSION_ID, thread through at the mint
// call site. Behavior 16/16b below re-prove the end-to-end false-positive is
// closed under the CORRECTED mechanism (no union, any age); Behavior 17 proves
// the true-positive same-turn detection is preserved via the new session-id
// threading, not via a window.
// ---------------------------------------------------------------------------

ok('Behavior 16 (fix C, revised): a sessionless mint NEVER bleeds into an unrelated session -- neither aged past the old window NOR genuinely fresh (0ms old)', function () {
  const f = tmpFile();
  const now = Date.now();
  const midAgeTs = now - (sidechannel.TURN_FRESH_MS + 30000);
  fs.writeFileSync(f, JSON.stringify({
    'no-session': [
      { entry: 'lib/hmi/selector-dispatcher.cjs', shape: 'F.1', ts: midAgeTs, subject: 'choose your next reach - unrelated candidate' },
    ],
  }));
  assert.deepStrictEqual(
    readReachedGates('completely-unrelated-session', { filePath: f }),
    [],
    'an aged sessionless mint must not bleed into an unrelated session'
  );
  // 2026-09-17 second pass: this is the EXACT scenario that live-disconfirmed
  // the first pass -- a fresh (this instant) sessionless mint, read from a
  // DIFFERENT session. There is no way to tell this apart from a legitimate
  // same-turn read-back once the record carries no session identity, so it
  // must ALSO stay invisible to the unrelated session, at ANY age.
  fs.writeFileSync(f, JSON.stringify({
    'no-session': [
      { entry: 'lib/hmi/selector-dispatcher.cjs', shape: 'F.1', ts: now, subject: 'choose your next reach - unrelated candidate' },
    ],
  }));
  assert.deepStrictEqual(
    readReachedGates('completely-unrelated-session', { filePath: f }),
    [],
    'a genuinely fresh (0ms-old) sessionless mint must ALSO never bleed into an unrelated session -- this is the exact live-disconfirmation scenario'
  );
  fs.unlinkSync(f);
});

ok('Behavior 16b (fix C, end to end): a status turn with NO fork, whose only connection to a reached gate is a sessionless bleed, no longer force-fires -- at ANY age of the sessionless mint, and regardless of whether its closing sentence names options in prose', function () {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-238-optprose-'));
  const sidechannelPath = path.join(tmpDir, 'card-fire-reached.json');
  const origSC = process.env.CARD_FIRE_SIDECHANNEL_PATH;
  process.env.CARD_FIRE_SIDECHANNEL_PATH = sidechannelPath;
  try {
    // Two ages: a stale mint (as the first-pass test already covered) AND a
    // GENUINELY FRESH one (0ms old) -- the second is the live-disconfirmation
    // scenario (a peer session's real, this-instant card render must still
    // never force an unrelated session's status turn).
    [Date.now() - (sidechannel.TURN_FRESH_MS + 30000), Date.now()].forEach(function (mintTs, idx) {
      fs.writeFileSync(sidechannelPath, JSON.stringify({
        'no-session': [
          { entry: 'lib/hmi/selector-dispatcher.cjs', shape: 'F.1', ts: mintTs, subject: 'choose your next reach - eureka-213-215 prior-art-validation' },
        ],
      }));

      const optionProseTurn = simulateStopTurn({
        session_id: 'sess-status-holding-' + idx,
        output_text: "Status: research is still running in the background. I'll hold here until it lands -- next up we can cut the beta, capture the seed, or wrap up.",
        preceding_user_text: '',
        preceding_user_text_source: 'none',
        askuserquestion_fired: false,
      });
      assert.equal(optionProseTurn.intercept, false,
        'a sessionless bleed (age index ' + idx + ') must not force-fire a status turn, regardless of its own closing-sentence shape');

      const plainTurn = simulateStopTurn({
        session_id: 'sess-status-holding-plain-' + idx,
        output_text: "Status: research is still running in the background. I'll hold here until it lands and report back once it does.",
        preceding_user_text: '',
        preceding_user_text_source: 'none',
        askuserquestion_fired: false,
      });
      assert.equal(plainTurn.intercept, false,
        'the no-option control turn (age index ' + idx + ') must behave identically -- the closing-sentence shape was never the cause');
    });
  } finally {
    if (origSC === undefined) delete process.env.CARD_FIRE_SIDECHANNEL_PATH;
    else process.env.CARD_FIRE_SIDECHANNEL_PATH = origSC;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Behavior 17 -- the CORRECTED mechanism: lib/hmi/selector-dispatcher.cjs's
// pickShape trailer door threads process.env.CLAUDE_CODE_SESSION_ID (when
// present) into its recordReachedGate call, so its mints land in a REAL
// session's own bucket directly -- found by an EXACT match, not a time
// window. This preserves the true-positive "same-turn read-back" detection
// the old union existed for WITHOUT reintroducing any cross-session ambiguity.
// ---------------------------------------------------------------------------

ok('Behavior 17a: with CLAUDE_CODE_SESSION_ID set, the pickShape trailer door mints under that REAL session id, not NO_SESSION_KEY', function () {
  const f = tmpFile();
  const dispatcher = require(path.join(REPO, 'lib', 'hmi', 'selector-dispatcher.cjs'));
  const origSC = process.env.CARD_FIRE_SIDECHANNEL_PATH;
  const origSessionEnv = process.env.CLAUDE_CODE_SESSION_ID;
  process.env.CARD_FIRE_SIDECHANNEL_PATH = f;
  process.env.CLAUDE_CODE_SESSION_ID = 'real-live-session-abc123';
  try {
    dispatcher.pickShape({
      requestedShape: 'F.1',
      roomDir: null,
      operator: null,
      payload: { verbs: ['A', 'B'], header: 'h', emitTelemetry: true },
    });
    const raw = JSON.parse(fs.readFileSync(f, 'utf8'));
    assert.equal(Array.isArray(raw['real-live-session-abc123']) && raw['real-live-session-abc123'].length === 1, true,
      'the mint must land under the REAL CLAUDE_CODE_SESSION_ID value, not a degenerate bucket');
    assert.equal(raw[sidechannel.NO_SESSION_KEY] === undefined, true,
      'NO_SESSION_KEY must stay empty entirely when a real session id resolves');
    assert.equal(
      readReachedGates('real-live-session-abc123', { filePath: f }).indexOf('lib/hmi/selector-dispatcher.cjs') !== -1,
      true,
      'the Stop hook of the SAME session (real session id, exact match) sees the mint -- true-positive preserved'
    );
    assert.deepStrictEqual(
      readReachedGates('a-totally-different-session', { filePath: f }),
      [],
      'a DIFFERENT session id sees nothing -- no union, no leak, exact match only'
    );
  } finally {
    if (origSC === undefined) delete process.env.CARD_FIRE_SIDECHANNEL_PATH;
    else process.env.CARD_FIRE_SIDECHANNEL_PATH = origSC;
    if (origSessionEnv === undefined) delete process.env.CLAUDE_CODE_SESSION_ID;
    else process.env.CLAUDE_CODE_SESSION_ID = origSessionEnv;
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }
});

ok('Behavior 17b: with CLAUDE_CODE_SESSION_ID absent, the pickShape trailer door falls back to NO_SESSION_KEY exactly as before (the documented safe-default residual)', function () {
  const f = tmpFile();
  const dispatcher = require(path.join(REPO, 'lib', 'hmi', 'selector-dispatcher.cjs'));
  const origSC = process.env.CARD_FIRE_SIDECHANNEL_PATH;
  const origSessionEnv = process.env.CLAUDE_CODE_SESSION_ID;
  process.env.CARD_FIRE_SIDECHANNEL_PATH = f;
  delete process.env.CLAUDE_CODE_SESSION_ID;
  try {
    dispatcher.pickShape({
      requestedShape: 'F.1',
      roomDir: null,
      operator: null,
      payload: { verbs: ['A', 'B'], header: 'h', emitTelemetry: true },
    });
    const raw = JSON.parse(fs.readFileSync(f, 'utf8'));
    assert.equal(Array.isArray(raw[sidechannel.NO_SESSION_KEY]) && raw[sidechannel.NO_SESSION_KEY].length === 1, true,
      'with no resolvable session id, the mint still degrades to NO_SESSION_KEY rather than being dropped');
    assert.deepStrictEqual(
      readReachedGates('any-other-live-session', { filePath: f }),
      [],
      'and per the corrected scopedRecords, that degenerate bucket is now invisible to every real session -- safe default, not a leak'
    );
  } finally {
    if (origSC === undefined) delete process.env.CARD_FIRE_SIDECHANNEL_PATH;
    else process.env.CARD_FIRE_SIDECHANNEL_PATH = origSC;
    if (origSessionEnv === undefined) delete process.env.CLAUDE_CODE_SESSION_ID;
    else process.env.CLAUDE_CODE_SESSION_ID = origSessionEnv;
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }
});

ok('Behavior 17c: an explicit payload.sessionId (a future/other caller with a real MCP extra.sessionId) takes precedence over CLAUDE_CODE_SESSION_ID', function () {
  const f = tmpFile();
  const dispatcher = require(path.join(REPO, 'lib', 'hmi', 'selector-dispatcher.cjs'));
  const origSC = process.env.CARD_FIRE_SIDECHANNEL_PATH;
  const origSessionEnv = process.env.CLAUDE_CODE_SESSION_ID;
  process.env.CARD_FIRE_SIDECHANNEL_PATH = f;
  process.env.CLAUDE_CODE_SESSION_ID = 'env-session-should-lose';
  try {
    dispatcher.pickShape({
      requestedShape: 'F.1',
      roomDir: null,
      operator: null,
      payload: { verbs: ['A', 'B'], header: 'h', emitTelemetry: true, sessionId: 'explicit-session-should-win' },
    });
    const raw = JSON.parse(fs.readFileSync(f, 'utf8'));
    assert.equal(Array.isArray(raw['explicit-session-should-win']), true,
      'an explicit payload.sessionId must win over the env var, mirroring resolveEffectiveSessionId precedence');
    assert.equal(raw['env-session-should-lose'], undefined, 'the env var value must not also be used when an explicit id is supplied');
  } finally {
    if (origSC === undefined) delete process.env.CARD_FIRE_SIDECHANNEL_PATH;
    else process.env.CARD_FIRE_SIDECHANNEL_PATH = origSC;
    if (origSessionEnv === undefined) delete process.env.CLAUDE_CODE_SESSION_ID;
    else process.env.CLAUDE_CODE_SESSION_ID = origSessionEnv;
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }
});

// ---------------------------------------------------------------------------
// Behavior 18 -- the TWO-CONCURRENT-SESSION-SAME-ROOM scenario the FIRST
// pass's tests never covered (it only tested single-session timing, not
// actual cross-session identity collision). Session A mints a genuine
// Shape-F card (with a REAL, resolved session id); session B, a DIFFERENT
// real session id, reads moments later at every delay from 0ms to well past
// the old 2-minute TURN_FRESH_MS window. Session B's read must be UNAFFECTED
// at every single delay -- not just outside a timing window.
// ---------------------------------------------------------------------------

ok("Behavior 18: two concurrent sessions, same room, same side-channel file -- session B never sees session A's mint, at ANY delay", function () {
  const f = tmpFile();
  const SESSION_A = 'concurrent-session-A-11111111';
  const SESSION_B = 'concurrent-session-B-22222222';
  // Delays spanning: same-instant, well inside the old 20s window, well inside
  // the old 2-minute TURN_FRESH_MS window, and well past both.
  const delaysMs = [0, 1000, 19000, 30000, 90000, 180000];
  delaysMs.forEach(function (delayMs) {
    const mintTs = Date.now() - delayMs;
    // Session A mints with its OWN real session id (the corrected producer
    // behavior -- see Behavior 17a). Written directly here to control the
    // exact age deterministically instead of racing a live setTimeout.
    fs.writeFileSync(f, JSON.stringify({
      [SESSION_A]: [
        { entry: 'lib/hmi/selector-dispatcher.cjs', shape: 'F.1', ts: mintTs, subject: 'session A genuine Shape-F card' },
      ],
    }));
    // Session A's OWN read still sees its own mint (sanity: the fix must not
    // have broken the legitimate same-session case while closing the
    // cross-session one). TTL_MS-bounded only, same as always.
    assert.equal(
      readReachedGates(SESSION_A, { filePath: f }).indexOf('lib/hmi/selector-dispatcher.cjs') !== -1,
      true,
      'session A must still see its OWN mint at delay ' + delayMs + 'ms (same-session read unaffected)'
    );
    // Session B, a DIFFERENT real, concurrently-active session, must NEVER
    // see session A's mint, regardless of delay.
    assert.deepStrictEqual(
      readReachedGates(SESSION_B, { filePath: f }),
      [],
      "session B must NEVER see session A's mint at delay " + delayMs + 'ms'
    );
    assert.equal(
      sidechannel.mostRecentReachedTs(SESSION_B, { filePath: f }),
      0,
      "session B's freshness verdict must also see nothing from session A at delay " + delayMs + 'ms'
    );
    assert.deepStrictEqual(
      readReachedGateSubjects(SESSION_B, { filePath: f }),
      [],
      "session B must not see session A's subject text either, at delay " + delayMs + 'ms'
    );
  });
  fs.unlinkSync(f);
});

// ---------------------------------------------------------------------------
// Behaviors 19a-19e -- stop-hook-fires-card-on-option-shaped-prose-sentence
// (2026-09-17, "RECLASSIFICATION: Third Block Is NOT a Disconfirmation"
// section) / card-fire-stale-f1-reach-suggestion-forces-block-regardless-
// of-relevance.md (the sibling PRIMARY-arm RCA, "Fold note update, THIRD
// report"). This is a DIFFERENT mechanism from Behaviors 9/10/16 above (the
// sessionless-bucket cross-session leak, already fixed): here the reach
// record is a REAL, own-session, correctly-never-fired F.8 gate (not a
// leaked or stale one), and the false positive comes from
// gateTopicallyRelevant's bag-of-tokens overlap matching the gate's own
// BOILERPLATE/structural wording ("bind", "session", "room"/"rooms",
// "select", "start", "talk", "new" -- present in EVERY F.8 render
// regardless of which candidate rooms are on offer) rather than its
// genuinely distinguishing content (the actual candidate room names). A
// meta-conversation about sessions/rooms/gates -- exactly what a debugging
// session investigating THIS bug naturally talks about -- satisfied that
// overlap purely on the boilerplate, with zero relation to the actual
// options on offer. The fix: lib/core/gate-relevance.cjs's
// GATE_BOILERPLATE_TOKENS + gateSubjectTokens() strip the gate side of the
// comparison down to its distinguishing content before the overlap check.
// ---------------------------------------------------------------------------

// The F.8 room-binding gate's realistic subject text (mirrors F8_ROOM_BIND_
// SUBJECT above and the debug file's own confirmed minimal repro): fixed
// chrome ("bind session select rooms") plus the reserved standing options
// ("Just talk (no room)", "Start a new room") plus ONE real candidate room
// name ("ALIGN") -- the only part of this string that actually varies
// between renders of this gate.
const F8_BOILERPLATE_SUBJECT =
  '-- mindrianOS -- bind session -- select rooms -- ALIGN Just talk (no room) Start a new room';

ok('Behavior 19a: a meta status turn about sessions/rooms/gates, with NO reference to the actual candidate room, does NOT force-fire a genuinely-reached F.8 gate (boilerplate-only overlap)', function () {
  withSideFile(function () {
    recordReachedGate({
      sessionId: 'sess-19a-boilerplate-meta',
      surface: 'scripts/intent-classifier.cjs',
      shape: 'F.8',
      subjectText: F8_BOILERPLATE_SUBJECT,
    });
    const v = simulateStopTurn({
      session_id: 'sess-19a-boilerplate-meta',
      output_text: 'Noted, continuing with the dev-repo work.',
      preceding_user_text: 'Every turn my session binds to rooms via this gate and I never fire it since it is irrelevant to my repo work.',
      preceding_user_text_source: 'typed',
      askuserquestion_fired: false,
    });
    assert.equal(v.intercept, false,
      'a turn whose ONLY connection to the gate is shared boilerplate vocabulary ("session", "rooms", "gate") must NOT force-fire');
    assert.equal(v.reason, 'gate-irrelevant-to-turn',
      'the verdict must name the irrelevance reason, not reached-registry-gate-no-card');
  });
});

ok('Behavior 19b: control -- a turn with ZERO session/room vocabulary against the SAME F.8 gate also does not force-fire', function () {
  withSideFile(function () {
    recordReachedGate({
      sessionId: 'sess-19b-control',
      surface: 'scripts/intent-classifier.cjs',
      shape: 'F.8',
      subjectText: F8_BOILERPLATE_SUBJECT,
    });
    const v = simulateStopTurn({
      session_id: 'sess-19b-control',
      output_text: 'Noted, continuing with the dev-repo work.',
      preceding_user_text: 'The oncology paper biomarker survival curve looked promising for the cohort.',
      preceding_user_text_source: 'typed',
      askuserquestion_fired: false,
    });
    assert.equal(v.intercept, false, 'a turn with no overlap at all must also not force-fire');
    assert.equal(v.reason, 'gate-irrelevant-to-turn');
  });
});

ok('Behavior 19c: PRESERVE FLOOR -- a turn that genuinely names the actual candidate room (ALIGN) still force-fires the SAME F.8 gate', function () {
  withSideFile(function () {
    recordReachedGate({
      sessionId: 'sess-19c-genuine',
      surface: 'scripts/intent-classifier.cjs',
      shape: 'F.8',
      subjectText: F8_BOILERPLATE_SUBJECT,
    });
    const v = simulateStopTurn({
      session_id: 'sess-19c-genuine',
      output_text: 'Noted, continuing with the dev-repo work.',
      preceding_user_text: 'Should I bind this session to the ALIGN room, or start fresh?',
      preceding_user_text_source: 'typed',
      askuserquestion_fired: false,
    });
    assert.equal(v.intercept, true,
      'a turn that genuinely names the specific candidate room MUST still force-fire (the boilerplate strip must not swallow real content)');
    assert.equal(v.reason, 'reached-registry-gate-no-card');
  });
});

ok("Behavior 19d: the fix generalizes across BOTH shared mint sites -- an F.8 card minted via the OTHER producer (lib/hmi/selector-dispatcher.cjs's pickShape trailer door) exhibits the same boilerplate-vs-content distinction", function () {
  const f = tmpFile();
  const dispatcher = require(path.join(REPO, 'lib', 'hmi', 'selector-dispatcher.cjs'));
  const origSC = process.env.CARD_FIRE_SIDECHANNEL_PATH;
  const origSessionEnv = process.env.CLAUDE_CODE_SESSION_ID;
  process.env.CARD_FIRE_SIDECHANNEL_PATH = f;
  process.env.CLAUDE_CODE_SESSION_ID = 'sess-19d-pickshape-f8';
  try {
    dispatcher.pickShape({
      requestedShape: 'F.8',
      roomDir: null,
      operator: null,
      payload: {
        header: '-- mindrianOS -- bind session -- select rooms --',
        options: ['ALIGN', 'dev repo / no room'],
        emitTelemetry: true,
      },
    });
    const mintedSubject = readReachedGateSubjects('sess-19d-pickshape-f8', { filePath: f })[0];
    assert.equal(typeof mintedSubject === 'string' && mintedSubject.length > 0, true,
      'the pickShape trailer door must have minted a real subject for this session');

    const boilerplateOnly = checkCardFire.classifyCardFire(
      checkCardFire.deriveTurnSignals({
        session_id: 'sess-19d-pickshape-f8',
        output_text: 'Noted, continuing.',
        preceding_user_text: 'This whole session keeps binding to rooms via a gate I never select.',
        preceding_user_text_source: 'typed',
        askuserquestion_fired: false,
      }),
      checkCardFire.loadRegistry()
    );
    assert.equal(boilerplateOnly.intercept, false,
      'boilerplate-only overlap must not force-fire regardless of which producer minted the record');
    assert.equal(boilerplateOnly.reason, 'gate-irrelevant-to-turn');
  } finally {
    if (origSC === undefined) delete process.env.CARD_FIRE_SIDECHANNEL_PATH;
    else process.env.CARD_FIRE_SIDECHANNEL_PATH = origSC;
    if (origSessionEnv === undefined) delete process.env.CLAUDE_CODE_SESSION_ID;
    else process.env.CLAUDE_CODE_SESSION_ID = origSessionEnv;
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }
});

ok('Behavior 19e (unit): gateSubjectTokens strips GATE_BOILERPLATE_TOKENS from the gate side only, preserving distinguishing content', function () {
  const stripped = gateRelevance.gateSubjectTokens(F8_BOILERPLATE_SUBJECT);
  assert.equal(stripped.has('bind'), false, '"bind" is boilerplate and must be stripped');
  assert.equal(stripped.has('session'), false, '"session" is boilerplate and must be stripped');
  assert.equal(stripped.has('room'), false, '"room" is boilerplate and must be stripped');
  assert.equal(stripped.has('select'), false, '"select" is boilerplate and must be stripped');
  assert.equal(stripped.has('start'), false, '"start" is boilerplate and must be stripped');
  assert.equal(stripped.has('talk'), false, '"talk" is boilerplate and must be stripped');
  assert.equal(stripped.has('new'), false, '"new" is boilerplate and must be stripped');
  assert.equal(stripped.has('align'), true, 'the genuine candidate room name must survive the strip');
});

ok('Constitutional floor is byte-untouched: MAX_FORCE_RETRIES=3, MAX_SESSION_INTERCEPTS=12', function () {
  assert.equal(checkCardFire.MAX_FORCE_RETRIES, 3);
  assert.equal(checkCardFire.MAX_SESSION_INTERCEPTS, 12);
  const src = fs.readFileSync(path.join(REPO, 'scripts', 'check-card-fire.cjs'), 'utf8');
  assert.equal(/const MAX_FORCE_RETRIES = 3;/.test(src), true);
  assert.equal(/const MAX_SESSION_INTERCEPTS = 12;/.test(src), true);
  assert.equal(src.indexOf('readReachedGates') !== -1, true, 'the consumer must call readReachedGates');
  assert.equal(src.indexOf('gate_subject_text') !== -1, true, 'the relevance-gate PRIMARY-path fix must be wired');
});

console.log('\nPASS test-209-primary-sidechannel (' + n + ' assertions)');
