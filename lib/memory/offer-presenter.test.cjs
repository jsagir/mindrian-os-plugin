#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 91-04 -- Next-step offer presenter fixture tests
 * =======================================================
 * Exercises lib/core/offer-presenter.cjs. The presenter converts
 * navigation-engine.decide()'s offer_next_step output into a one-line
 * grounded suggestion that Larry surfaces at the end of the turn.
 *
 * Canon Part 3 (Tri-Context Decision Gate, Section 6 RECOMMENDED gate):
 * the marker is rendered IFF mode === mode_a AND
 * pattern_matches confidence >= 0.7 AND verb match. The engine evaluates
 * the gate; the presenter respects the resolved
 * decision_trace.brain_md_recommended_marker_rendered flag.
 *
 * Canon Part 4 (Every Choice Is Graph Data): offer outcomes (shown /
 * ignored / acted) persist locally to .mindrian/offer-history.json so
 * future decisions can weight against fatigue patterns. LOCAL-only
 * (Canon Part 8); never egresses.
 *
 * Test map (Tests 1-15 = unit tests for presenter; Tests 16-17 = end-to-
 * end integration through scripts/intent-classifier.cjs added in Task 2):
 *
 *   1.  happy path: grounded MINTO reason renders one-line offer (no marker)
 *   2.  RECOMMENDED marker rendered when decision_trace flag is true
 *   3.  null offer_next_step -> no offer line, no suppression code
 *   4.  reason shorter than 15 chars -> ungrounded_reason suppression
 *   5.  generic reason ("to make progress") -> generic_reason suppression
 *   6.  signal keyword acceptance: "pattern_matches in BRAIN ..." renders
 *   7.  section name acceptance: "market-analysis section MINTO is stale"
 *   8.  history seeded with 2 ignored outcomes -> consecutive_ignores_threshold
 *   9.  suppression clears after one non-offer turn
 *   10. max 1 per turn: second presentOffer call returns one_offer_per_turn
 *   11. recordOfferOutcome 'ignored' appends to history atomically
 *   12. recordOfferOutcome 'acted' appends to history
 *   13. atomic write: 10 rapid concurrent recordOfferOutcome -> parseable JSON
 *   14. readOfferHistory on absent file -> {version: 1, history: []}
 *   15. readOfferHistory on malformed JSON -> {history: [], parse_failed: true}
 *   16. integration: classifier emits 'Offer: ...' line when engine offers
 *   17. integration: ignore loop -- turn 1 'shown'; turn 2 marks turn-1 ignored
 *
 * Registered in lib/memory/run-feynman-tests.cjs.
 */

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..', '..');
const PRESENTER_PATH = path.join(REPO, 'lib/core/offer-presenter.cjs');
const CLASSIFIER_PATH = path.join(REPO, 'scripts/intent-classifier.cjs');

function requirePresenter() {
  // Lazy require so Task 1 RED can be written before the file exists.
  return require(PRESENTER_PATH);
}

// ---------- Test scaffolding ----------

let passed = 0;
let failed = 0;
function run(name, fn) {
  try {
    fn();
    process.stdout.write('ok  ' + name + '\n');
    passed += 1;
  } catch (err) {
    process.stderr.write('FAIL ' + name + '\n');
    process.stderr.write(String(err && err.stack ? err.stack : err) + '\n');
    failed += 1;
  }
}

// ---------- Fixture builders ----------

const TMPDIRS = [];

function mkTmp(label) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), '91-04-' + label + '-'));
  TMPDIRS.push(d);
  return d;
}

process.on('exit', () => {
  for (const d of TMPDIRS) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) {}
  }
});

function makeDecision(overrides) {
  const base = {
    fire_skill: null,
    suppress_skills: [],
    persona_updates: null,
    offer_next_step: null,
    decision_trace: {
      icm_scope: null,
      sql_signals: null,
      minto_reasoning: null,
      brain_patterns: null,
      intent_persona: null,
      chosen_rationale: '',
      brain_md_tier_mode: 'mode_a',
      brain_md_staleness: 'fresh',
      brain_md_stale_reason: null,
      brain_md_weight_applied: 1.0,
      brain_md_recommended_confidence: null,
      brain_md_recommended_marker_rendered: false,
      brain_md_sections_consumed: [],
      brain_md_version: 1,
    },
  };
  // Shallow merge top-level; deep merge decision_trace.
  const out = Object.assign({}, base, overrides || {});
  if (overrides && overrides.decision_trace) {
    out.decision_trace = Object.assign({}, base.decision_trace, overrides.decision_trace);
  }
  return out;
}

function emptyHistory() {
  return { version: 1, history: [] };
}

function freshSession() {
  // Each test gets an isolated session context object so the
  // one-offer-per-turn marker does not leak between tests.
  return { offeredThisTurn: false, sessionId: 'test-session', command: null };
}

// =========================================================
// Task 1 -- Presenter unit tests (Tests 1-15)
// =========================================================

run('Test 1: happy path -- grounded MINTO reason renders single-line offer', () => {
  const { presentOffer } = requirePresenter();
  const decision = makeDecision({
    offer_next_step: {
      command: '/mos:validate',
      reason: 'MINTO shows weak TAM evidence in market-analysis',
    },
  });
  const out = presentOffer(decision, emptyHistory(), freshSession());
  assert.equal(out.suppressReason, null);
  assert.equal(out.recommendedMarker, false);
  assert.equal(typeof out.offerLine, 'string');
  assert.equal(out.offerLine.indexOf('Offer:') === 0, true,
    'offer line must start with "Offer:"; got ' + out.offerLine);
  assert.equal(out.offerLine.indexOf('MINTO shows weak TAM evidence in market-analysis') !== -1,
    true, 'reason must appear verbatim');
  assert.equal(out.offerLine.indexOf('/mos:validate') !== -1, true,
    'command must appear verbatim');
  assert.equal(out.offerLine.indexOf('Because') !== -1, true,
    'offer must use "Because" connective');
  // RECOMMENDED marker absent (gate not passed).
  assert.equal(out.offerLine.indexOf('(RECOMMENDED)') === -1, true,
    'RECOMMENDED marker must NOT appear when gate is false');
});

run('Test 2: RECOMMENDED marker rendered when decision_trace flag is true', () => {
  const { presentOffer } = requirePresenter();
  const decision = makeDecision({
    offer_next_step: {
      command: '/mos:validate',
      reason: 'BRAIN pattern_matches confidence above 0.7 floor',
    },
    decision_trace: {
      brain_md_tier_mode: 'mode_a',
      brain_md_recommended_confidence: 0.85,
      brain_md_recommended_marker_rendered: true,
    },
  });
  const out = presentOffer(decision, emptyHistory(), freshSession());
  assert.equal(out.suppressReason, null);
  assert.equal(out.recommendedMarker, true);
  assert.equal(out.offerLine.indexOf('(RECOMMENDED)') !== -1, true,
    'RECOMMENDED marker must appear when gate is true; got ' + out.offerLine);
  // Marker placement: '(RECOMMENDED)' immediately after 'Offer'.
  assert.equal(out.offerLine.indexOf('Offer (RECOMMENDED):') === 0, true,
    'marker must follow "Offer "; got ' + out.offerLine);
});

run('Test 3: null offer_next_step -> no offer line, no suppression code', () => {
  const { presentOffer } = requirePresenter();
  const decision = makeDecision({ offer_next_step: null });
  const out = presentOffer(decision, emptyHistory(), freshSession());
  assert.equal(out.offerLine, null);
  assert.equal(out.recommendedMarker, false);
  assert.equal(out.suppressReason, null);
});

run('Test 4: reason shorter than 15 chars -> ungrounded_reason', () => {
  const { presentOffer } = requirePresenter();
  const decision = makeDecision({
    offer_next_step: { command: '/mos:validate', reason: 'too short' },
  });
  const out = presentOffer(decision, emptyHistory(), freshSession());
  assert.equal(out.offerLine, null);
  assert.equal(out.suppressReason, 'ungrounded_reason');
});

run('Test 5: generic reason ("to make progress") -> generic_reason', () => {
  const { presentOffer } = requirePresenter();
  const decision = makeDecision({
    offer_next_step: {
      command: '/mos:validate',
      reason: 'to make progress quickly today',
    },
  });
  const out = presentOffer(decision, emptyHistory(), freshSession());
  assert.equal(out.offerLine, null);
  assert.equal(out.suppressReason, 'generic_reason');
});

run('Test 6: signal keyword acceptance -- pattern + BRAIN renders', () => {
  const { presentOffer } = requirePresenter();
  const decision = makeDecision({
    offer_next_step: {
      command: '/mos:think-hats',
      reason: 'pattern_matches in BRAIN shows SWOT precedent',
    },
  });
  const out = presentOffer(decision, emptyHistory(), freshSession());
  assert.equal(out.suppressReason, null);
  assert.equal(typeof out.offerLine, 'string');
  assert.equal(out.offerLine.indexOf('SWOT') !== -1, true);
});

run('Test 7: section name acceptance -- "market-analysis section MINTO" renders', () => {
  const { presentOffer } = requirePresenter();
  const decision = makeDecision({
    offer_next_step: {
      command: '/mos:validate',
      reason: 'market-analysis section MINTO is stale',
    },
  });
  const out = presentOffer(decision, emptyHistory(), freshSession());
  assert.equal(out.suppressReason, null);
  assert.equal(typeof out.offerLine, 'string');
  assert.equal(out.offerLine.indexOf('market-analysis') !== -1, true);
});

run('Test 8: history seeded with 2 ignored -> consecutive_ignores_threshold', () => {
  const { presentOffer } = requirePresenter();
  const decision = makeDecision({
    offer_next_step: {
      command: '/mos:validate',
      reason: 'MINTO reasoning_health_score below threshold',
    },
  });
  const history = {
    version: 1,
    history: [
      { at: '2026-04-27T18:00:00Z', session_id: 'a', command: '/mos:foo', reason: 'pattern x', outcome: 'ignored' },
      { at: '2026-04-27T18:05:00Z', session_id: 'a', command: '/mos:bar', reason: 'pattern y', outcome: 'ignored' },
    ],
  };
  const out = presentOffer(decision, history, freshSession());
  assert.equal(out.offerLine, null);
  assert.equal(out.suppressReason, 'consecutive_ignores_threshold');
});

run('Test 9: suppression clears after one non-offer turn', () => {
  const { presentOffer } = requirePresenter();
  // History pattern: ignored, ignored, then a non-offer turn (no entry
  // appended; or an entry with outcome other than 'ignored'). The
  // simplest representation: two ignored entries separated from any
  // newer entry by an 'acted' or 'shown' record. We use a 'reset'
  // sentinel record with outcome other than ignored to model the
  // "one turn without an offer" gap. The presenter checks the last
  // 2 history entries; if not BOTH 'ignored', suppression does not
  // fire.
  const decision = makeDecision({
    offer_next_step: {
      command: '/mos:validate',
      reason: 'MINTO weakness in evidence after audit',
    },
  });
  const history = {
    version: 1,
    history: [
      { at: '2026-04-27T18:00:00Z', session_id: 'a', command: '/mos:foo', reason: 'pattern x', outcome: 'ignored' },
      { at: '2026-04-27T18:05:00Z', session_id: 'a', command: '/mos:bar', reason: 'pattern y', outcome: 'ignored' },
      { at: '2026-04-27T18:10:00Z', session_id: 'a', command: null, reason: '', outcome: 'reset' },
    ],
  };
  const out = presentOffer(decision, history, freshSession());
  assert.equal(out.suppressReason, null,
    'suppression must clear when last 2 entries are not both ignored; got ' + out.suppressReason);
  assert.equal(typeof out.offerLine, 'string');
});

run('Test 10: max 1 per turn -- second call returns one_offer_per_turn', () => {
  const { presentOffer } = requirePresenter();
  const decision = makeDecision({
    offer_next_step: {
      command: '/mos:validate',
      reason: 'MINTO governing thought stale per audit',
    },
  });
  const session = freshSession();
  const out1 = presentOffer(decision, emptyHistory(), session);
  assert.equal(out1.suppressReason, null);
  assert.equal(typeof out1.offerLine, 'string');
  // Same session context handed to second call -- offeredThisTurn now true.
  const out2 = presentOffer(decision, emptyHistory(), session);
  assert.equal(out2.offerLine, null);
  assert.equal(out2.suppressReason, 'one_offer_per_turn');
});

run('Test 11: recordOfferOutcome ignored appends atomically', () => {
  const { recordOfferOutcome, readOfferHistory } = requirePresenter();
  const dir = mkTmp('t11');
  recordOfferOutcome(dir, {
    outcome: 'ignored',
    session_id: 's1',
    command: '/mos:validate',
    reason: 'pattern weak',
  });
  const hist = readOfferHistory(dir);
  assert.equal(hist.history.length, 1);
  assert.equal(hist.history[0].outcome, 'ignored');
  assert.equal(hist.history[0].command, '/mos:validate');
  assert.equal(typeof hist.history[0].at, 'string');
  // ISO-8601 sanity check.
  assert.equal(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(hist.history[0].at), true);
});

run('Test 12: recordOfferOutcome acted appends', () => {
  const { recordOfferOutcome, readOfferHistory } = requirePresenter();
  const dir = mkTmp('t12');
  recordOfferOutcome(dir, {
    outcome: 'acted',
    session_id: 's2',
    command: '/mos:think-hats',
    reason: 'pattern matched',
  });
  const hist = readOfferHistory(dir);
  assert.equal(hist.history.length, 1);
  assert.equal(hist.history[0].outcome, 'acted');
  assert.equal(hist.history[0].command, '/mos:think-hats');
});

run('Test 13: atomic write under 10 rapid concurrent record calls', () => {
  const { recordOfferOutcome, readOfferHistory } = requirePresenter();
  const dir = mkTmp('t13');
  // 10 sequential rapid writes (in-process; cannot easily fork inside a
  // single test, but rapid sequential covers the tmp+rename atomicity
  // contract -- no partial JSON on disk after each call).
  for (let i = 0; i < 10; i += 1) {
    recordOfferOutcome(dir, {
      outcome: 'shown',
      session_id: 's' + i,
      command: '/mos:cmd' + i,
      reason: 'pattern ' + i,
    });
    // Mid-loop read must always parse cleanly.
    const mid = readOfferHistory(dir);
    assert.equal(typeof mid, 'object');
    assert.equal(Array.isArray(mid.history), true);
  }
  const final = readOfferHistory(dir);
  assert.equal(final.history.length, 10);
  // Verify no .tmp.* leftovers in .mindrian.
  const mindrianDir = path.join(dir, '.mindrian');
  if (fs.existsSync(mindrianDir)) {
    const leftovers = fs.readdirSync(mindrianDir).filter(function (n) {
      return n.indexOf('offer-history.json.tmp.') === 0;
    });
    assert.equal(leftovers.length, 0,
      'no .tmp.* files must remain after writes; found ' + JSON.stringify(leftovers));
  }
});

run('Test 14: readOfferHistory on absent file -> empty history struct', () => {
  const { readOfferHistory } = requirePresenter();
  const dir = mkTmp('t14');
  const hist = readOfferHistory(dir);
  assert.equal(hist.version, 1);
  assert.deepEqual(hist.history, []);
  // No throws -- function returned a value.
});

run('Test 15: readOfferHistory on malformed JSON -> empty + parse_failed flag', () => {
  const { readOfferHistory, recordOfferOutcome } = requirePresenter();
  const dir = mkTmp('t15');
  // Seed a corrupt offer-history.json.
  const mindrianDir = path.join(dir, '.mindrian');
  fs.mkdirSync(mindrianDir, { recursive: true });
  fs.writeFileSync(path.join(mindrianDir, 'offer-history.json'), '{not valid json');
  const hist = readOfferHistory(dir);
  assert.deepEqual(hist.history, []);
  assert.equal(hist.parse_failed, true);
  // recordOfferOutcome must continue with fresh history (graceful self-heal).
  recordOfferOutcome(dir, {
    outcome: 'shown',
    session_id: 's-recover',
    command: '/mos:foo',
    reason: 'pattern recovery',
  });
  const after = readOfferHistory(dir);
  assert.equal(after.history.length, 1);
  assert.equal(after.history[0].command, '/mos:foo');
});

// =========================================================
// Task 2 -- Integration tests (Tests 16-17)
// =========================================================

function makeRoomsFixture(label) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), '91-04-int-' + label + '-'));
  TMPDIRS.push(tmp);
  const root = path.join(tmp, 'MindrianRooms');
  fs.mkdirSync(root, { recursive: true });
  const roomDir = path.join(root, 'fixture-room');
  fs.mkdirSync(roomDir, { recursive: true });
  fs.writeFileSync(
    path.join(roomDir, 'STATE.md'),
    '---\nproject: fixture room\n---\n\n# Fixture Room\n'
  );
  const sectionDir = path.join(roomDir, 'market-analysis');
  fs.mkdirSync(sectionDir, { recursive: true });
  fs.writeFileSync(
    path.join(sectionDir, 'MINTO.md'),
    '---\ngoverning_thought: Customers will pay\nreasoning_health_score: 0.6\n---\n\n# Market analysis\n'
  );
  fs.writeFileSync(
    path.join(sectionDir, 'ROOM.md'),
    '# market-analysis section\n'
  );
  const regDir = path.join(root, '.rooms');
  fs.mkdirSync(regDir, { recursive: true });
  fs.writeFileSync(
    path.join(regDir, 'registry.json'),
    JSON.stringify({ active: 'fixture-room', rooms: ['fixture-room'] }, null, 2)
  );
  return { tmp: tmp, root: root, roomDir: roomDir, sectionDir: sectionDir };
}

function runHook(rootEnv, extraEnv, prompt) {
  const env = Object.assign({}, process.env, {
    MINDRIAN_ROOMS_ROOT: rootEnv,
    MINDRIAN_ROOMS_HOME: rootEnv,
    MINDRIAN_COPILOT_INJECT_FINDINGS: '0',
  }, extraEnv || {});
  return spawnSync(process.execPath, [CLASSIFIER_PATH], {
    input: JSON.stringify({ user_message: prompt || 'analyze market sizing' }),
    env: env,
    encoding: 'utf8',
    timeout: 5000,
  });
}

function classifierIntegrated() {
  // Gate Tests 16-17 on the Task 2 wiring landing in scripts/intent-
  // classifier.cjs. Until then, skip them so RED of Task 1 only shows
  // the 15 presenter unit tests.
  const src = fs.readFileSync(CLASSIFIER_PATH, 'utf8');
  return src.indexOf('offer-presenter') !== -1;
}

if (classifierIntegrated()) {
  run('Test 16: integration -- engine offer renders Offer line in additionalContext', () => {
    const fix = makeRoomsFixture('t16');
    const res = runHook(fix.root, {
      MOS_NAV_TEST_OFFER_COMMAND: '/mos:validate',
      MOS_NAV_TEST_OFFER_REASON: 'MINTO shows weak TAM evidence in market-analysis',
    });
    assert.equal(res.status === 0, true,
      'classifier exited non-zero: ' + res.status + '\nstderr: ' + (res.stderr || ''));
    const out = res.stdout || '';
    assert.equal(
      out.indexOf('Offer:') !== -1,
      true,
      'expected Offer: line in stdout; got: ' + out
    );
    assert.equal(
      out.indexOf('MINTO shows weak TAM evidence in market-analysis') !== -1,
      true,
      'expected reason in offer line; got: ' + out
    );
    assert.equal(
      out.indexOf('/mos:validate') !== -1,
      true,
      'expected command in offer line; got: ' + out
    );
  });

  run('Test 17: integration -- ignore loop turn 1 shown, turn 2 marks turn-1 ignored', () => {
    const fix = makeRoomsFixture('t17');
    // Turn 1: engine offers /mos:validate. Presenter should record 'shown'.
    const res1 = runHook(fix.root, {
      MOS_NAV_TEST_OFFER_COMMAND: '/mos:validate',
      MOS_NAV_TEST_OFFER_REASON: 'MINTO weak evidence after recent audit',
      CLAUDE_SESSION_ID: 'session-t17',
    }, 'audit my market-analysis section');
    assert.equal(res1.status === 0, true,
      'turn 1 classifier exited non-zero: ' + res1.status);
    const histPath = path.join(fix.roomDir, '.mindrian', 'offer-history.json');
    assert.equal(fs.existsSync(histPath), true,
      'turn 1 must create offer-history.json; missing at ' + histPath);
    let hist1;
    try {
      hist1 = JSON.parse(fs.readFileSync(histPath, 'utf8'));
    } catch (e) {
      throw new Error('turn 1 offer-history.json malformed: ' + e.message);
    }
    assert.equal(hist1.history.length >= 1, true,
      'turn 1 must append at least one entry; got ' + hist1.history.length);
    const turn1Entry = hist1.history[hist1.history.length - 1];
    assert.equal(turn1Entry.outcome, 'shown',
      'turn 1 outcome must be shown; got ' + turn1Entry.outcome);
    assert.equal(turn1Entry.command, '/mos:validate');

    // Turn 2: engine offers nothing; user does NOT invoke /mos:validate.
    // Presenter should reclassify turn-1 outcome as 'ignored'.
    const res2 = runHook(fix.root, {
      MOS_NAV_TEST_OFFER_COMMAND: '__NULL__',
      CLAUDE_SESSION_ID: 'session-t17',
    }, 'tell me about competitors instead');
    assert.equal(res2.status === 0, true,
      'turn 2 classifier exited non-zero: ' + res2.status);
    let hist2;
    try {
      hist2 = JSON.parse(fs.readFileSync(histPath, 'utf8'));
    } catch (e) {
      throw new Error('turn 2 offer-history.json malformed: ' + e.message);
    }
    // Turn-1 entry's outcome must have been updated to 'ignored'.
    const turn1AfterTurn2 = hist2.history.find(function (e) {
      return e.session_id === 'session-t17' && e.command === '/mos:validate';
    });
    assert.equal(turn1AfterTurn2 !== undefined, true,
      'turn-1 entry must still exist after turn 2');
    assert.equal(turn1AfterTurn2.outcome, 'ignored',
      'turn-1 outcome must be reclassified to ignored after turn 2; got ' +
        turn1AfterTurn2.outcome);
  });
} else {
  process.stdout.write(
    'skip Tests 16-17 (intent-classifier.cjs not yet integrated with offer-presenter; gate clears in Task 2)\n'
  );
}

// ---------- Summary ----------

const total = passed + failed;
process.stdout.write('\noffer-presenter.test: ' + passed + '/' + total + ' passed\n');
process.exit(failed === 0 ? 0 : 1);
