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
// bleed fix. Fix (A): the NO_SESSION_KEY union is freshness-scoped so a
// sessionless mint cannot leak across sessions past the turn window. Fix (B):
// the consumer judges a side-channel gate FRESH vs STALE (mostRecentReachedTs
// vs TURN_FRESH_MS) and threads staleness into the low-signal relevance branch.
// ---------------------------------------------------------------------------

ok('Behavior 10 (fix A): a STALE no-session mint does NOT union into another session read; a FRESH one still does', function () {
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
  // A FRESH sessionless mint still unions -- the trailer-door same-turn detection is preserved.
  fs.writeFileSync(f, JSON.stringify({
    'no-session': [
      { entry: 'lib/hmi/selector-dispatcher.cjs', shape: 'F.1', ts: now, subject: 'fresh sessionless reach' },
    ],
  }));
  assert.equal(
    readReachedGates('some-other-live-session', { filePath: f }).indexOf('lib/hmi/selector-dispatcher.cjs') !== -1,
    true,
    'a fresh no-session mint must still union (same-turn trailer-door detection preserved)'
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
