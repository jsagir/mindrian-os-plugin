'use strict';
// Phase 209-07 Task 3 -- the phase's ADVERSARIAL VERIFICATION (209-RESEARCH.md
// section 3, implemented verbatim). Replays the incident's exact shape (a
// mid-dialogue room resume in free conversation, no command, no engine dial)
// end to end and asserts the four RESEARCH-mandated outcomes:
//   (a) the card fires natively turn-1 (the transport exists BEFORE emission)
//   (b) zero check-card-fire intercepts on that turn
//   (c) render-coverage gate green for commands/*.md, 0 unwired declared entries
//       (the skills/*/SKILL.md keyspace, added by the intern-w1-mode-gate-skip
//       fix, carries a separate known/tracked set -- see the assertion below)
//   (d) a legit U+25A0-bearing non-gate turn still passes without a block

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

const REPO = path.join(__dirname, '..');
const insightSensors = require(path.join(REPO, 'lib', 'core', 'insight-sensors.cjs'));
const checkCardFire = require(path.join(REPO, 'scripts', 'check-card-fire.cjs'));

let n = 0;
function ok(desc, fn) { fn(); n += 1; console.log('  ok   (' + desc + ')'); }

console.log('test-209-incident-replay');

// Hermetic isolation for the WHOLE file (T-209-25 idiom): point the
// card-fire side-channel at an isolated tmp path so this test NEVER reads or
// writes the real ~/.mindrian/card-fire-reached.json. Discovered adversarially
// by this very test during authoring: the NO_SESSION_KEY union (designed so
// the pickShape door's session-less records still surface, see
// lib/core/card-fire-sidechannel.cjs) means stale real-machine records under
// 'no-session' would otherwise leak into (d)'s unrelated session lookup for
// up to TTL_MS (10 minutes) - a real, bounded, documented cross-session noise
// property of the union design, not a bug, but exactly why every test that
// touches the side channel must isolate its path.
const HERMETIC_TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-incident-replay-sidechannel-'));
process.env.CARD_FIRE_SIDECHANNEL_PATH = path.join(HERMETIC_TMP, 'card-fire-reached.json');

const SAMPLE_ROOMS = [
  { name: 'align-ecosystem', venture_name: 'ALIGN', venture_stage: 'Well-Defined Problem', status: 'active', last_opened: '2026-07-01T10:00:00Z' },
];

// ---------------------------------------------------------------------------
// (a) Card fires natively turn-1: the SENS-12 room-pick sensor fires on the
// incident's exact fork (mid-dialogue resume, no command) and the reach
// already carries the rendered card + marker + BINDING BEFORE any emission
// step runs.
// ---------------------------------------------------------------------------
ok('a: card fires natively turn-1 (the transport exists before emission)', function () {
  const turn = {
    text: 'Can we resume work on the align-ecosystem room?',
    __listRegisteredRooms: function () { return SAMPLE_ROOMS; },
  };
  const ctx = { __listRegisteredRooms: function () { return SAMPLE_ROOMS; } };
  const out = insightSensors.dispatchSensors(turn, {}, ctx);
  const roomPick = out.find(function (r) { return r.signal === 'room_pick'; });
  assert.notEqual(roomPick, undefined, 'the room-pick reach must fire on the incident fork');
  const envelope = roomPick.evidence.envelope;
  assert.equal(typeof envelope, 'string');
  assert.equal(envelope.indexOf('[AskUserQuestion contract:') !== -1, true);
  assert.equal(envelope.indexOf('[FIRE-IF-FORK:') !== -1, true);
});

// ---------------------------------------------------------------------------
// (b) Zero check-card-fire intercepts: a Stop-transcript fixture whose
// current turn contains that envelope's text AND an AskUserQuestion tool-use
// record classifies as no-intercept; no retry-side-file growth.
// ---------------------------------------------------------------------------
ok('b: zero check-card-fire intercepts on the replayed turn', function () {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-incident-replay-'));
  const transcriptPath = path.join(tmpDir, 'incident.jsonl');
  const retryHome = path.join(tmpDir, 'mindrian-home');
  fs.mkdirSync(retryHome, { recursive: true });

  const cardText = [
    'Ignite -- pick a room to resume, or start something new',
    '1. ALIGN - Well-Defined Problem - opened in the last day',
    '2. Just talk (no room)',
  ].join('\n');

  fs.writeFileSync(transcriptPath, [
    JSON.stringify({ type: 'user', message: { role: 'user', content: 'Can we resume work on the align-ecosystem room?' } }),
    JSON.stringify({
      type: 'assistant',
      message: {
        role: 'assistant',
        content: [
          { type: 'text', text: cardText },
          { type: 'tool_use', name: 'AskUserQuestion', input: { questions: [] } },
        ],
      },
    }),
  ].join('\n') + '\n', 'utf8');

  const env = {
    hook_event_name: 'Stop',
    session_id: 'incident-replay-session',
    transcript_path: transcriptPath,
  };

  const origHome = process.env.MINDRIAN_HOME;
  process.env.MINDRIAN_HOME = retryHome;
  try {
    const turn = checkCardFire.deriveTurnSignals(env);
    assert.equal(turn.askuserquestion_fired, true, 'the card fired this turn');
    const registry = checkCardFire.loadRegistry();
    const verdict = checkCardFire.classifyCardFire(turn, registry);
    assert.equal(verdict.intercept, false, 'a fired card must never intercept');
    assert.equal(verdict.reason, 'card-fired');

    const retryFile = path.join(retryHome, 'card-fire-retries.json');
    assert.equal(fs.existsSync(retryFile), false, 'no retry-side-file growth expected (nothing was intercepted)');
  } finally {
    if (origHome === undefined) delete process.env.MINDRIAN_HOME;
    else process.env.MINDRIAN_HOME = origHome;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// (c) Render-coverage gate green for commands/*.md: 0 unwired declared entries.
// Updated by the intern-w1-mode-gate-skip fix (RCA gap 1): the registry now
// ALSO covers a THIRD keyspace, skills/*/SKILL.md, which carries 5 known,
// pre-existing, out-of-scope unwired declarations that were invisible before
// this fix (see the debug file Resolution section) -- so the DEFAULT-mode CLI
// (which reports on BOTH the commands and skill keyspaces) no longer exits 0
// on a clean repo. This narrows the "0 unwired" invariant to commands/*.md
// (this test's own original scope: the incident replay is about a room-resume
// COMMAND flow, not a skill) and separately confirms the skill gaps are the
// known, tracked set, not a new regression.
// ---------------------------------------------------------------------------
ok('c: render-coverage gate green for commands/*.md, 0 unwired declared entries', function () {
  const run = spawnSync('node', ['scripts/check-render-coverage.cjs'], { cwd: REPO, encoding: 'utf8' });
  const registry = JSON.parse(fs.readFileSync(path.join(REPO, 'data', 'render-coverage-registry.json'), 'utf8'));
  const mdEntries = registry.entries.filter(function (e) { return String(e.surface || '').startsWith('commands/'); });
  assert.equal(mdEntries.length >= 90, true, 'expected >= 90 declaring commands/*.md entries, got ' + mdEntries.length);
  const unwired = mdEntries.filter(function (e) { return e.declared_shape && !e.wired && !e.excluded; });
  assert.deepStrictEqual(unwired, [], '0 unwired declared commands/*.md entries expected');

  const skillEntries = registry.entries.filter(function (e) { return String(e.surface || '').startsWith('skills/'); });
  const unwiredSkills = skillEntries.filter(function (e) { return e.declared_shape && !e.wired && !e.excluded; });
  assert.equal(unwiredSkills.length, 5, 'expected exactly the 5 known, tracked pre-existing unwired skill declarations (see test-209-declared-implies-wired.cjs Behavior 13)');
  assert.notEqual(run.status, 0, 'the default-mode CLI now correctly reports non-zero due to the 5 known skill gaps');
});

// ---------------------------------------------------------------------------
// (d) Sanctioned glyph passes: a non-gate turn with a bare U+25A0 and no card
// classifies as no-intercept (no-gate-signal).
// ---------------------------------------------------------------------------
ok('d: a legit U+25A0-bearing non-gate turn passes without a block', function () {
  const env = {
    session_id: 'sanctioned-glyph-session',
    output_text: 'The dashboard shows a ■ next to blocked items.',
    askuserquestion_fired: false,
  };
  const turn = checkCardFire.deriveTurnSignals(env);
  const registry = checkCardFire.loadRegistry();
  const verdict = checkCardFire.classifyCardFire(turn, registry);
  assert.equal(verdict.intercept, false);
  assert.equal(verdict.reason, 'no-gate-signal');
});

fs.rmSync(HERMETIC_TMP, { recursive: true, force: true });

console.log('\nAll four lettered assertions (a-d) PASS.');
console.log('PASS test-209-incident-replay (' + n + ' assertions)');
