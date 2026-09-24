'use strict';
// Phase 359-03 -- test-359-declared-arm.cjs: the declared-fork arm in the
// card gate (FORK359-04, FORK359-05, SPEC R4, R5, D-06 to D-09, N-3).
//
// Covers: A1-A9 direct classifyCardFire legs (declared intercept, card-fired
// precedence, the N-3 yes/no exemption over PRACTICAL labels only, both
// bounded-escape ceilings matching the PRIMARY arm's own reason strings byte
// for byte, D-07's "declared wins over a stale irrelevant PRIMARY hit"), A10
// the declaration-source precedence (Pattern 1, Pitfall 1: this turn's final
// text only, never a stale one), A11 (no direct fork_declared/declared_labels
// field is ever accepted from the envelope), A12 (a real Stop-stdin spawn of
// scripts/check-card-fire.cjs), and (--tripwires mode) A13 (the two ASCII-box
// regex literals stay byte-identical, classifyCardFire/deriveTurnSignals read
// output text only through the pre-359 call sites, and parseForkDeclaration
// is called exactly once).
//
// Default mode runs A1-A12. `--tripwires` runs A13 only.
//
// Test hygiene: hermetic MINDRIAN_HOME / CARD_FIRE_SIDECHANNEL_PATH per leg
// that touches the retry/side-channel store or spawns the real hook; no
// network egress; every mkdtemp cleaned up in a finally.
//
// No em-dashes anywhere (hyphens only, CLAUDE.md HARD RULE).

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

delete process.env.TYPESAFE_API_KEY;

const REPO = path.join(__dirname, '..');
const CHECK_CARD_FIRE_PATH = path.join(REPO, 'scripts', 'check-card-fire.cjs');
const PRE_359_PATH = path.join(REPO, 'tests', 'fixtures', 'card-fire-replay', 'pre-359.json');
const PRE359 = JSON.parse(fs.readFileSync(PRE_359_PATH, 'utf8')).pre_359_sha;

const TRIPWIRES_ONLY = process.argv.indexOf('--tripwires') !== -1;

console.log('test-359-declared-arm' + (TRIPWIRES_ONLY ? ' --tripwires' : ''));

let failures = 0;
let total = 0;
function ok(desc, fn) {
  total += 1;
  try {
    fn();
    console.log('  ok   ' + desc);
  } catch (e) {
    failures += 1;
    console.log('  FAIL ' + desc + ' -- ' + (e && e.message ? e.message : String(e)));
  }
}

const checkCardFire = require(CHECK_CARD_FIRE_PATH);

// ---------------------------------------------------------------------
// Pre-359 archive helper (per the plan's own recipe): git archive the
// pre-359 sha's runtime files into a mkdtemp, symlink node_modules, require
// the archived scripts/check-card-fire.cjs by absolute path. Built ONCE,
// shared by A7/A8/A13, cleaned up at the very end of this file.
// ---------------------------------------------------------------------
let PRE_DIR = null;
let preCheckCardFire = null;
function buildPre359Archive() {
  if (preCheckCardFire) return preCheckCardFire;
  PRE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'declared-arm-359-pre-'));
  const archivePath = path.join(PRE_DIR, 'a.tar');
  const arc = spawnSync('git', ['archive', '-o', archivePath, PRE359, 'scripts', 'lib', 'data', 'package.json', '.claude-plugin'], { cwd: REPO, stdio: ['ignore', 'ignore', 'pipe'] });
  if (arc.status !== 0) throw new Error('git archive ' + PRE359 + ' failed: ' + arc.stderr);
  const untar = spawnSync('tar', ['-xf', archivePath, '-C', PRE_DIR], { stdio: ['ignore', 'ignore', 'pipe'] });
  if (untar.status !== 0) throw new Error('tar -x failed: ' + untar.stderr);
  fs.rmSync(archivePath, { force: true });
  const nodeModulesSrc = path.join(REPO, 'node_modules');
  if (fs.existsSync(nodeModulesSrc)) {
    try { fs.symlinkSync(nodeModulesSrc, path.join(PRE_DIR, 'node_modules'), 'dir'); } catch (_e) { /* best-effort */ }
  }
  preCheckCardFire = require(path.join(PRE_DIR, 'scripts', 'check-card-fire.cjs'));
  return preCheckCardFire;
}

// ---------------------------------------------------------------------
// Fixture helpers (A1-A9)
// ---------------------------------------------------------------------
const EMPTY_REGISTRY = { entries: [] };
const DECLARED_LABELS_3 = ['Ship it now', 'Hold for review', 'What if we ask early testers first'];

function declaredTurn(overrides) {
  return Object.assign({
    session_id: 'sess-declared-a',
    ran_entries: [],
    output_text: '',
    askuserquestion_fired: false,
    fork_declared: true,
    declared_labels: DECLARED_LABELS_3.slice(),
    preceding_user_text: '',
    preceding_user_text_source: 'none',
    sidechannel_health: 'healthy',
    reach_corroborated: false,
    session_count: 0,
    retry_count: 0,
  }, overrides || {});
}

function registryFor(ranEntries) {
  return { entries: (ranEntries || []).map(function (e) { return { entry: e, render_coverage: 'card-emission' }; }) };
}

function primaryTurn(overrides) {
  const ranEntries = ['scripts/intent-classifier.cjs'];
  return Object.assign({
    session_id: 'sess-primary-a',
    ran_entries: ranEntries,
    output_text: '',
    askuserquestion_fired: false,
    gate_subject_text: 'choose between building the venture plan now or running additional research first',
    preceding_user_text: 'help me choose the starting point for building the venture plan',
    preceding_user_text_source: 'typed',
    sidechannel_health: 'healthy',
    reach_corroborated: true,
    session_count: 0,
    retry_count: 0,
  }, overrides || {});
}

if (!TRIPWIRES_ONLY) {
  // ---------------------------------------------------------------------
  // A1-A9: direct classifyCardFire legs
  // ---------------------------------------------------------------------

  ok('A1 declared (3 labels) + no card + no PRIMARY/BACKSTOP -> intercept declared-fork-no-card', function () {
    const v = checkCardFire.classifyCardFire(declaredTurn({}), EMPTY_REGISTRY);
    assert.deepEqual(v, { intercept: true, reason: 'declared-fork-no-card', degrade: false });
  });

  ok('A2 declared + askuserquestion_fired true -> card-fired', function () {
    const v = checkCardFire.classifyCardFire(declaredTurn({ askuserquestion_fired: true }), EMPTY_REGISTRY);
    assert.deepEqual(v, { intercept: false, reason: 'card-fired', degrade: false });
  });

  ok('A3 declared yes/no + moonshot -> gate-is-simple-binary; a third practical label -> intercept', function () {
    const ynTurn = declaredTurn({
      declared_labels: ['Yes, ship it', 'No, hold it', 'What if we let the users ship it'],
    });
    const ynVerdict = checkCardFire.classifyCardFire(ynTurn, EMPTY_REGISTRY);
    assert.equal(ynVerdict.reason, 'gate-is-simple-binary');
    assert.equal(ynVerdict.intercept, false);
    assert.equal(ynVerdict.degrade, false);

    const yn3Turn = declaredTurn({
      declared_labels: ['Yes, ship it', 'No, hold it', 'Launch in EMEA first', 'What if we let the users ship it'],
    });
    const yn3Verdict = checkCardFire.classifyCardFire(yn3Turn, EMPTY_REGISTRY);
    assert.equal(yn3Verdict.reason, 'declared-fork-no-card');
    assert.equal(yn3Verdict.intercept, true);
  });

  ok('A4 declared + retry_count===MAX_FORCE_RETRIES degrades with the PRIMARY arm own reason string', function () {
    const MAX = checkCardFire.MAX_FORCE_RETRIES;
    const declaredVerdict = checkCardFire.classifyCardFire(
      declaredTurn({ retry_count: MAX, session_count: 0 }), EMPTY_REGISTRY
    );
    const primaryVerdict = checkCardFire.classifyCardFire(
      primaryTurn({ retry_count: MAX, session_count: 0 }), registryFor(['scripts/intent-classifier.cjs'])
    );
    assert.equal(declaredVerdict.degrade, true);
    assert.equal(primaryVerdict.degrade, true);
    assert.equal(declaredVerdict.reason, primaryVerdict.reason);
    assert.equal(declaredVerdict.reason, 'bounded-escape-released-after-' + MAX + '-retries');
  });

  ok('A5 declared + session_count===MAX_SESSION_INTERCEPTS degrades with the PRIMARY arm own reason string', function () {
    const MAX = checkCardFire.MAX_SESSION_INTERCEPTS;
    const declaredVerdict = checkCardFire.classifyCardFire(
      declaredTurn({ retry_count: 0, session_count: MAX }), EMPTY_REGISTRY
    );
    const primaryVerdict = checkCardFire.classifyCardFire(
      primaryTurn({ retry_count: 0, session_count: MAX }), registryFor(['scripts/intent-classifier.cjs'])
    );
    assert.equal(declaredVerdict.degrade, true);
    assert.equal(primaryVerdict.degrade, true);
    assert.equal(declaredVerdict.reason, primaryVerdict.reason);
    assert.equal(declaredVerdict.reason, 'session-intercept-ceiling-reached-after-' + MAX + '-intercepts');
  });

  ok('A6 (D-07) a stale/irrelevant PRIMARY hit passes gate-irrelevant-to-turn without a declaration; the same turn plus a declaration intercepts', function () {
    const registry = registryFor(['scripts/intent-classifier.cjs']);
    const base = {
      session_id: 'sess-d07',
      ran_entries: ['scripts/intent-classifier.cjs'],
      gate_subject_text: 'choose between building the venture plan now or running additional research first',
      preceding_user_text: 'discussing lunch downtown today with the team',
      preceding_user_text_source: 'typed',
      output_text: '',
      askuserquestion_fired: false,
      sidechannel_health: 'healthy',
      reach_corroborated: true,
      session_count: 0,
      retry_count: 0,
    };
    const withoutDecl = checkCardFire.classifyCardFire(Object.assign({}, base), registry);
    assert.equal(withoutDecl.reason, 'gate-irrelevant-to-turn');
    assert.equal(withoutDecl.intercept, false);

    const withDecl = checkCardFire.classifyCardFire(
      Object.assign({}, base, { fork_declared: true, declared_labels: DECLARED_LABELS_3.slice() }),
      registry
    );
    assert.equal(withDecl.reason, 'declared-fork-no-card');
    assert.equal(withDecl.intercept, true);
  });

  // -----------------------------------------------------------------
  // A7: inertness matrix -- every NON-declared shape byte-for-byte matches
  // the archived pre-359 classifier.
  // -----------------------------------------------------------------
  const NO_SIGNAL_TURN = {
    session_id: 'sess-matrix-no-signal',
    ran_entries: [],
    output_text: 'just chatting, nothing gate-shaped here',
    askuserquestion_fired: false,
    sidechannel_health: 'healthy',
    reach_corroborated: false,
    session_count: 0,
    retry_count: 0,
  };
  const PRIMARY_RELEVANT_TURN = {
    session_id: 'sess-matrix-primary-relevant',
    ran_entries: ['scripts/intent-classifier.cjs'],
    gate_subject_text: 'choose between building the venture plan now or running additional research first',
    preceding_user_text: 'help me choose the starting point for building the venture plan',
    preceding_user_text_source: 'typed',
    output_text: '',
    askuserquestion_fired: false,
    sidechannel_health: 'healthy',
    reach_corroborated: true,
    session_count: 0,
    retry_count: 0,
  };
  const PRIMARY_IRRELEVANT_TURN = {
    session_id: 'sess-matrix-primary-irrelevant',
    ran_entries: ['scripts/intent-classifier.cjs'],
    gate_subject_text: 'choose between building the venture plan now or running additional research first',
    preceding_user_text: 'discussing lunch downtown today with the team',
    preceding_user_text_source: 'typed',
    output_text: '',
    askuserquestion_fired: false,
    sidechannel_health: 'healthy',
    reach_corroborated: true,
    session_count: 0,
    retry_count: 0,
  };
  const BACKSTOP_CORROBORATED_TURN = {
    session_id: 'sess-matrix-backstop-corroborated',
    ran_entries: [],
    output_text: '[1] Build the plan\n[2] File the evidence',
    askuserquestion_fired: false,
    sidechannel_health: 'healthy',
    reach_corroborated: true,
    session_count: 0,
    retry_count: 0,
  };
  const BACKSTOP_UNCORROBORATED_TURN = {
    session_id: 'sess-matrix-backstop-uncorroborated',
    ran_entries: [],
    output_text: '[1] Build the plan\n[2] File the evidence',
    askuserquestion_fired: false,
    sidechannel_health: 'healthy',
    reach_corroborated: false,
    session_count: 0,
    retry_count: 0,
  };
  const CARD_FIRED_TURN = {
    session_id: 'sess-matrix-card-fired',
    ran_entries: ['scripts/intent-classifier.cjs'],
    output_text: '',
    askuserquestion_fired: true,
    sidechannel_health: 'healthy',
    reach_corroborated: true,
    session_count: 0,
    retry_count: 0,
  };
  const RETRY_CEILING_TURN = {
    session_id: 'sess-matrix-retry-ceiling',
    ran_entries: ['scripts/intent-classifier.cjs'],
    output_text: '',
    askuserquestion_fired: false,
    sidechannel_health: 'healthy',
    reach_corroborated: true,
    session_count: 0,
    retry_count: 3,
  };
  const SESSION_CEILING_TURN = {
    session_id: 'sess-matrix-session-ceiling',
    ran_entries: ['scripts/intent-classifier.cjs'],
    output_text: '',
    askuserquestion_fired: false,
    sidechannel_health: 'healthy',
    reach_corroborated: true,
    session_count: 12,
    retry_count: 0,
  };
  const NON_DECLARED_MATRIX = [
    { name: 'no-signal', turn: NO_SIGNAL_TURN, registry: EMPTY_REGISTRY },
    { name: 'primary-relevant', turn: PRIMARY_RELEVANT_TURN, registry: registryFor(['scripts/intent-classifier.cjs']) },
    { name: 'primary-irrelevant', turn: PRIMARY_IRRELEVANT_TURN, registry: registryFor(['scripts/intent-classifier.cjs']) },
    { name: 'backstop-corroborated', turn: BACKSTOP_CORROBORATED_TURN, registry: EMPTY_REGISTRY },
    { name: 'backstop-uncorroborated', turn: BACKSTOP_UNCORROBORATED_TURN, registry: EMPTY_REGISTRY },
    { name: 'card-fired', turn: CARD_FIRED_TURN, registry: registryFor(['scripts/intent-classifier.cjs']) },
    { name: 'retry-ceiling', turn: RETRY_CEILING_TURN, registry: registryFor(['scripts/intent-classifier.cjs']) },
    { name: 'session-ceiling', turn: SESSION_CEILING_TURN, registry: registryFor(['scripts/intent-classifier.cjs']) },
  ];

  ok('A7 inertness: HEAD classifyCardFire deep-equals the archived pre-359 classifier over the non-declared matrix', function () {
    try {
      const pre = buildPre359Archive();
      for (const entry of NON_DECLARED_MATRIX) {
        const headVerdict = checkCardFire.classifyCardFire(entry.turn, entry.registry);
        const preVerdict = pre.classifyCardFire(entry.turn, entry.registry);
        assert.deepEqual(headVerdict, preVerdict, entry.name + ': HEAD verdict must equal pre-359 verdict');
      }
    } finally {
      // cleanup happens once at end of file
    }
  });

  // -----------------------------------------------------------------
  // A8: turnContextHash
  // -----------------------------------------------------------------
  ok('A8 turnContextHash: every non-declared matrix turn hashes identically to the archived pre-359 function', function () {
    const pre = buildPre359Archive();
    for (const entry of NON_DECLARED_MATRIX) {
      const headHash = checkCardFire.turnContextHash(entry.turn);
      const preHash = pre.turnContextHash(entry.turn);
      assert.equal(headHash, preHash, entry.name + ': turnContextHash must match pre-359');
    }
  });

  ok('A8 a declared turn hashes differently from its undeclared twin', function () {
    const undeclared = Object.assign({}, NO_SIGNAL_TURN);
    const declared = Object.assign({}, NO_SIGNAL_TURN, {
      fork_declared: true,
      declared_labels: DECLARED_LABELS_3.slice(),
    });
    assert.notEqual(checkCardFire.turnContextHash(declared), checkCardFire.turnContextHash(undeclared));
  });

  ok('A8 the declared hash is invariant to label order, case and whitespace', function () {
    const t1 = Object.assign({}, NO_SIGNAL_TURN, {
      fork_declared: true,
      declared_labels: ['Ship it now', 'Hold for review', 'What if we ask early testers first'],
    });
    const t2 = Object.assign({}, NO_SIGNAL_TURN, {
      fork_declared: true,
      declared_labels: ['  HOLD FOR review  ', 'ShIp It NOW', '  What if   we ask early testers first'],
    });
    assert.equal(checkCardFire.turnContextHash(t1), checkCardFire.turnContextHash(t2));
  });

  ok('A8 the declared hash differs for a different label set', function () {
    const t1 = Object.assign({}, NO_SIGNAL_TURN, {
      fork_declared: true,
      declared_labels: DECLARED_LABELS_3.slice(),
    });
    const t2 = Object.assign({}, NO_SIGNAL_TURN, {
      fork_declared: true,
      declared_labels: ['Ship it now', 'Hold for review', 'What if we launch in EMEA first'],
    });
    assert.notEqual(checkCardFire.turnContextHash(t1), checkCardFire.turnContextHash(t2));
  });

  ok('A8 two different Hebrew label sets hash differently', function () {
    const t1 = Object.assign({}, NO_SIGNAL_TURN, {
      fork_declared: true,
      declared_labels: ['לבנות עכשיו', 'לחכות לבדיקה', 'What if נשאל את המשתמשים'],
    });
    const t2 = Object.assign({}, NO_SIGNAL_TURN, {
      fork_declared: true,
      declared_labels: ['למכור עכשיו', 'לחכות לרבעון הבא', 'What if נשיק בשוק אחר'],
    });
    assert.notEqual(checkCardFire.turnContextHash(t1), checkCardFire.turnContextHash(t2));
  });

  // -----------------------------------------------------------------
  // A9: declaredIdentity
  // -----------------------------------------------------------------
  function expectedDeclaredIdentity(labels) {
    const normalized = labels
      .map(function (l) { return String(l).normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim(); })
      .sort();
    return 'decl:' + normalized.join(',');
  }

  ok("A9 declaredIdentity: '' for undeclared, 'decl:' + sorted NFKC-lowercased whitespace-collapsed labels for declared", function () {
    assert.equal(checkCardFire.declaredIdentity({}), '');
    assert.equal(checkCardFire.declaredIdentity({ fork_declared: false, declared_labels: ['x'] }), '');
    assert.equal(checkCardFire.declaredIdentity({ fork_declared: true, declared_labels: [] }), '');
    assert.equal(checkCardFire.declaredIdentity(null), '');

    const labels = ['B', 'a', '  What if C  '];
    assert.equal(
      checkCardFire.declaredIdentity({ fork_declared: true, declared_labels: labels }),
      expectedDeclaredIdentity(labels)
    );

    const hebrewLabels = ['לבנות עכשיו', 'לחכות  לבדיקה', 'What if   נשאל את המשתמשים'];
    assert.equal(
      checkCardFire.declaredIdentity({ fork_declared: true, declared_labels: hebrewLabels }),
      expectedDeclaredIdentity(hebrewLabels)
    );
  });

  // -----------------------------------------------------------------
  // A10-A12: deriveTurnSignals declaration-source precedence
  // -----------------------------------------------------------------
  function writeTranscript(records) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'declared-arm-359-transcript-'));
    const p = path.join(dir, 'transcript.jsonl');
    fs.writeFileSync(p, records.map(function (r) { return JSON.stringify(r); }).join('\n') + '\n', 'utf8');
    return p;
  }

  const DECL_LINE = 'Your call: Ship it now | Hold for review | What if we ask early testers first';

  ok('A10 a direct output_text declaration wins over a differently-declared transcript', function () {
    const tp = writeTranscript([
      { type: 'user', message: { role: 'user', content: 'kick off the review' }, origin: { kind: 'human' } },
      { type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'Your call: Launch now | Wait a week | What if we soft-launch to a cohort' }] } },
    ]);
    const turn = checkCardFire.deriveTurnSignals({
      hook_event_name: 'Stop',
      session_id: 'sess-a10a',
      output_text: DECL_LINE,
      transcript_path: tp,
    });
    assert.equal(turn.fork_declared, true);
    assert.deepEqual(turn.declared_labels, ['Ship it now', 'Hold for review', 'What if we ask early testers first']);
  });

  ok('A10 with no direct output_text, last_assistant_message is parsed', function () {
    const tp = writeTranscript([
      { type: 'user', message: { role: 'user', content: 'kick off the review' }, origin: { kind: 'human' } },
      { type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'This transcript text is irrelevant prose, no declaration here.' }] } },
    ]);
    const turn = checkCardFire.deriveTurnSignals({
      hook_event_name: 'Stop',
      session_id: 'sess-a10b',
      last_assistant_message: DECL_LINE,
      transcript_path: tp,
    });
    assert.equal(turn.fork_declared, true);
    assert.deepEqual(turn.declared_labels, ['Ship it now', 'Hold for review', 'What if we ask early testers first']);
  });

  ok('A10 with neither direct field, the last text in the current-window assistant_contents is parsed', function () {
    const tp = writeTranscript([
      { type: 'user', message: { role: 'user', content: 'kick off the review' }, origin: { kind: 'human' } },
      { type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: DECL_LINE }] } },
    ]);
    const turn = checkCardFire.deriveTurnSignals({
      hook_event_name: 'Stop',
      session_id: 'sess-a10c',
      transcript_path: tp,
    });
    assert.equal(turn.fork_declared, true);
    assert.deepEqual(turn.declared_labels, ['Ship it now', 'Hold for review', 'What if we ask early testers first']);
  });

  ok('A10 (Pitfall 1) a transcript whose ONLY declaration sits before the last user record gives fork_declared false', function () {
    const tp = writeTranscript([
      { type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: DECL_LINE }] } },
      { type: 'user', message: { role: 'user', content: 'actually, forget that, something else entirely' }, origin: { kind: 'human' } },
      { type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'ok, sounds good.' }] } },
    ]);
    const turn = checkCardFire.deriveTurnSignals({
      hook_event_name: 'Stop',
      session_id: 'sess-a10d',
      transcript_path: tp,
    });
    assert.equal(turn.fork_declared, false);
    assert.deepEqual(turn.declared_labels, []);
  });

  ok('A10 (Pitfall 1) a stale last-assistant-transcript-record declaration is ignored when last_assistant_message is plain prose', function () {
    const tp = writeTranscript([
      { type: 'user', message: { role: 'user', content: 'kick off the review' }, origin: { kind: 'human' } },
      { type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: DECL_LINE }] } },
    ]);
    const turn = checkCardFire.deriveTurnSignals({
      hook_event_name: 'Stop',
      session_id: 'sess-a10e',
      last_assistant_message: 'Sounds good, moving on.',
      transcript_path: tp,
    });
    assert.equal(turn.fork_declared, false);
    assert.deepEqual(turn.declared_labels, []);
  });

  ok('A11 a direct fork_declared/declared_labels field on the envelope is never accepted (no text, no declaration)', function () {
    const turn = checkCardFire.deriveTurnSignals({
      hook_event_name: 'Stop',
      session_id: 'sess-a11',
      output_text: 'plain prose, no declaration line here at all.',
      fork_declared: true,
      declared_labels: ['Injected A', 'Injected B', 'What if injected moonshot'],
    });
    assert.equal(turn.fork_declared, false);
    assert.deepEqual(turn.declared_labels, []);
  });

  ok('A12 end to end: a real Stop-stdin spawn blocks on a declared fork with no card, never leaks the slug to stdout, and logs it locally', function () {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'declared-arm-359-e2e-'));
    try {
      const mindrianHome = path.join(tmp, 'mindrian');
      fs.mkdirSync(mindrianHome, { recursive: true });
      const tp = writeTranscript([
        { type: 'user', message: { role: 'user', content: 'help me decide on the release' }, origin: { kind: 'human' } },
        { type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: DECL_LINE }] } },
      ]);
      const stdinPayload = JSON.stringify({
        hook_event_name: 'Stop',
        session_id: 'sess-a12-' + Date.now(),
        transcript_path: tp,
        last_assistant_message: DECL_LINE,
      });
      const env = Object.assign({}, process.env);
      delete env.TYPESAFE_API_KEY;
      delete env.MINDRIAN_MCP_FIRST;
      env.MINDRIAN_HOME = mindrianHome;
      env.CARD_FIRE_SIDECHANNEL_PATH = path.join(tmp, 'sidechannel.json');

      const res = spawnSync(process.execPath, [CHECK_CARD_FIRE_PATH], {
        cwd: REPO,
        env: env,
        input: stdinPayload,
        encoding: 'utf8',
      });
      assert.equal(res.status, 0, 'the hook must exit 0; stderr: ' + res.stderr);
      let envelope = null;
      try { envelope = JSON.parse(res.stdout); } catch (_e) { envelope = null; }
      assert.ok(envelope, 'stdout must be parseable JSON; got: ' + res.stdout);
      assert.equal(envelope.decision, 'block');
      assert.equal(envelope.continue, false);
      assert.ok(res.stdout.indexOf('declared-fork-no-card') === -1, 'the internal slug must never reach stdout');

      const logPath = path.join(mindrianHome, 'card-fire-intercepts.log');
      const logLines = fs.readFileSync(logPath, 'utf8').trim().split('\n');
      const lastRecord = JSON.parse(logLines[logLines.length - 1]);
      assert.equal(lastRecord.reason, 'declared-fork-no-card');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
}

// ---------------------------------------------------------------------
// A13 (--tripwires): the no-free-text-heuristic freeze
// ---------------------------------------------------------------------
if (TRIPWIRES_ONLY) {
  const source = fs.readFileSync(CHECK_CARD_FIRE_PATH, 'utf8');

  function extractRegexLiteral(src, constName) {
    const re = new RegExp(constName + '\\s*=\\s*\\n?\\s*(/(?:\\\\.|[^/\\n\\\\])+/[a-z]*)');
    const m = src.match(re);
    assert.ok(m, 'could not find ' + constName + ' literal');
    // eslint-disable-next-line no-eval
    return eval(m[1]);
  }

  function extractFn(src, name) {
    const m = src.match(new RegExp('function ' + name + '\\('));
    assert.ok(m, 'could not find function ' + name);
    const braceStart = src.indexOf('{', m.index);
    let depth = 0;
    let j = braceStart;
    for (; j < src.length; j += 1) {
      if (src[j] === '{') depth += 1;
      else if (src[j] === '}') { depth -= 1; if (depth === 0) { j += 1; break; } }
    }
    return src.slice(m.index, j);
  }

  function stripComments(s) {
    return s.split('\n').filter(function (l) { return !l.trim().startsWith('//'); }).join('\n');
  }

  ok('A13 the two ASCII-box regex literals are byte-for-byte the frozen strings', function () {
    const glyphRe = extractRegexLiteral(source, 'ASCII_BOX_GLYPH_RE');
    const unconditionalRe = extractRegexLiteral(source, 'ASCII_BOX_UNCONDITIONAL_RE');
    const frozenGlyph = /\[\s*1\s*\]\s*.*\[\s*2\s*\]|type\s+1\s*,\s*2\s*,\s*or\s+3|\[\s*1\s*\][^\n]*\n[\s\S]*?\[\s*2\s*\]|(?:^|\n)\s{0,3}1[.)]\s+\S[^\n]*\n(?:[^\n]*\n)?\s{0,3}2[.)]\s+\S/i;
    const frozenUnconditional = /\[\s*1\s*\]\s*.*\[\s*2\s*\]|type\s+1\s*,\s*2\s*,\s*or\s+3|\[\s*1\s*\][^\n]*\n[\s\S]*?\[\s*2\s*\]/i;
    assert.equal(glyphRe.toString(), frozenGlyph.toString());
    assert.equal(unconditionalRe.toString(), frozenUnconditional.toString());
  });

  ok('A13 classifyCardFire has 0 regex-use, outputText only at pre-359 call sites, count unchanged', function () {
    const ccf = stripComments(extractFn(source, 'classifyCardFire'));
    assert.equal((ccf.match(/\.test\(/g) || []).length, 0);
    assert.equal((ccf.match(/\.match\(/g) || []).length, 0);
    assert.equal((ccf.match(/\.exec\(/g) || []).length, 0);
    assert.equal((ccf.match(/new RegExp/g) || []).length, 0);
    // Frozen from the pre-359 archive: outputText appeared 4 times in
    // classifyCardFire (its own declaration, computeBackstopHit(, the
    // gateSubjectText fallback's ternary reads it twice). The declared
    // arm must add zero new outputText reads.
    assert.equal((ccf.match(/outputText/g) || []).length, 4);
  });

  ok('A13 deriveTurnSignals has 0 regex-use and calls parseForkDeclaration exactly once', function () {
    const dts = stripComments(extractFn(source, 'deriveTurnSignals'));
    assert.equal((dts.match(/\.test\(/g) || []).length, 0);
    assert.equal((dts.match(/\.match\(/g) || []).length, 0);
    assert.equal((dts.match(/\.exec\(/g) || []).length, 0);
    assert.equal((dts.match(/new RegExp/g) || []).length, 0);
    assert.equal((dts.match(/parseForkDeclaration\(/g) || []).length, 1);
  });

  ok('A13 MAX_FORCE_RETRIES and MAX_SESSION_INTERCEPTS are each declared exactly once', function () {
    const noComments = stripComments(source);
    assert.equal((noComments.match(/MAX_FORCE_RETRIES\s*=\s*3;/g) || []).length, 1);
    assert.equal((noComments.match(/MAX_SESSION_INTERCEPTS\s*=\s*12;/g) || []).length, 1);
  });
}

console.log('');
console.log('Passed: ' + (total - failures) + ' / ' + total);
if (PRE_DIR) {
  try { fs.rmSync(PRE_DIR, { recursive: true, force: true }); } catch (_e) { /* best-effort */ }
}
if (failures > 0) {
  console.log('Failed: ' + failures);
  process.exit(1);
}
process.exit(0);
