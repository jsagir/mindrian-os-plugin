'use strict';
// Phase 109-05 test: 7 insight query primitives. NAV-109-04 acceptance harness.
// findRecentChanges is the 7th but lives in memory-events.cjs (Plan 109-03 already covers it);
// this test covers the 6 NEW primitives shipped by this plan.

const { ok, equal, deepEqual } = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const REPO_ROOT = path.resolve(__dirname, '..');
const { openRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));
const navigation = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation.cjs'));

function makeRoom() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'phase-109-insights-'));
  fs.mkdirSync(path.join(tmp, '.mindrian'), { recursive: true });
  const db = openRoomDb(tmp);
  const nowMs = Date.now();
  const days = (n) => nowMs - n * 24 * 60 * 60 * 1000;

  const insN = db.prepare("INSERT OR IGNORE INTO nodes (id, type, properties, source_path, created_by, confidence, review_status, created_at, last_seen_at, source_section) VALUES (?, ?, ?, ?, 'user', ?, ?, ?, ?, ?)");
  // Room root.
  insN.run('room:test', 'room', '{}', 'fixture', 1.0, 'confirmed', nowMs, nowMs, null);
  // Focus + 2 contradictory claims (depth 1).
  insN.run('focus:design', 'decision', '{}', 'fixture/design.md', 0.7, 'confirmed', nowMs, nowMs, 'design');
  insN.run('claim:c1', 'claim', '{"summary":"X is true"}', 'fixture/c1.md', 0.6, 'confirmed', nowMs, nowMs, 'design');
  insN.run('claim:c2', 'claim', '{"summary":"X is false"}', 'fixture/c2.md', 0.6, 'confirmed', nowMs, nowMs, 'design');
  // Unsupported claim (no SUPPORTS edge); supported claim (HAS SUPPORTS edge); enabled-only claim (only ENABLES, no SUPPORTS).
  insN.run('claim:unsup-1', 'claim', '{"summary":"unsupported"}', 'fixture/u1.md', 0.5, 'confirmed', nowMs, nowMs, 'design');
  insN.run('claim:supported-1', 'claim', '{"summary":"supported"}', 'fixture/s1.md', 0.7, 'confirmed', nowMs, nowMs, 'design');
  insN.run('claim:enabled-only', 'claim', '{"summary":"enabled only"}', 'fixture/eo.md', 0.5, 'confirmed', nowMs, nowMs, 'design');
  insN.run('evidence:e1', 'evidence', '{"tier":"academic"}', 'fixture/e1.md', 0.9, 'confirmed', nowMs, nowMs, 'design');
  insN.run('claim:cc-unsup', 'CausalClaim', '{"cause":"A","effect":"B"}', 'fixture/cc1.md', 0.6, 'confirmed', nowMs, nowMs, 'design');
  // Goal + assumption chain.
  insN.run('goal:gx', 'decision', '{"goal":"shipx"}', 'fixture/gx.md', 0.7, 'proposed', nowMs, nowMs, 'design');
  insN.run('assumption:risky', 'assumption', '{"claim":"X assumed"}', 'fixture/risky.md', 0.4, 'proposed', nowMs, nowMs, 'design');
  // Decisions: stale + fresh.
  insN.run('decision:stale', 'decision', '{"summary":"stale"}', 'fixture/d-stale.md', 0.7, 'confirmed', days(60), days(45), 'design');
  insN.run('decision:fresh', 'decision', '{"summary":"fresh"}', 'fixture/d-fresh.md', 0.7, 'confirmed', days(20), days(10), 'design');
  // Open questions: orphan + answered.
  insN.run('open_question:o1', 'open_question', '{"text":"how X?"}', 'fixture/o1.md', 0.5, 'proposed', days(15), days(15), 'design');
  insN.run('open_question:o2', 'open_question', '{"text":"how Y?"}', 'fixture/o2.md', 0.5, 'proposed', days(7), days(7), 'design');
  // Opportunities for ranking test.
  insN.run('opportunity:hi', 'opportunity', '{"hsi_score":85,"tags":["fintech","b2b"]}', 'fixture/oh.md', 0.6, 'confirmed', nowMs, nowMs, 'design');
  insN.run('opportunity:mid', 'opportunity', '{"hsi_score":50,"tags":["biotech"]}', 'fixture/om.md', 0.6, 'confirmed', nowMs, nowMs, 'design');
  insN.run('opportunity:lo', 'opportunity', '{"hsi_score":20,"tags":["climate"]}', 'fixture/ol.md', 0.6, 'confirmed', nowMs, nowMs, 'design');

  const insE = db.prepare("INSERT OR IGNORE INTO edges (source, target, type, properties) VALUES (?, ?, ?, '{}')");
  // Contradictions inside focus neighborhood.
  insE.run('focus:design', 'claim:c1', 'INFORMS');
  insE.run('focus:design', 'claim:c2', 'INFORMS');
  insE.run('claim:c1', 'claim:c2', 'CONTRADICTS');
  // Supported claim has SUPPORTS edge.
  insE.run('evidence:e1', 'claim:supported-1', 'SUPPORTS');
  // Enabled-only claim has ONLY ENABLES (proves separate-edge-type filter).
  insE.run('focus:design', 'claim:enabled-only', 'ENABLES');
  // Goal cascade: goal DEPENDS_ON assumption.
  insE.run('goal:gx', 'assumption:risky', 'DEPENDS_ON');
  // Open question o2 HAS a SUPPORTS edge from evidence (so it's "answered" for the test).
  insE.run('evidence:e1', 'open_question:o2', 'SUPPORTS');
  // Connect opportunities to focus via BANKED_BY (depth 1).
  insE.run('focus:design', 'opportunity:hi', 'BANKED_BY');
  insE.run('focus:design', 'opportunity:mid', 'BANKED_BY');
  insE.run('focus:design', 'opportunity:lo', 'BANKED_BY');
  return { tmp, db };
}

function makeIsolatedRoom() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'phase-109-insights-iso-'));
  fs.mkdirSync(path.join(tmp, '.mindrian'), { recursive: true });
  const db = openRoomDb(tmp);
  return { tmp, db };
}

function cleanup(tmp) { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) { /* ignore */ } }

function test1_findContradictionsShape() {
  const { tmp, db } = makeRoom();
  try {
    const r = navigation.findContradictions(db, 'focus:design');
    ok(Array.isArray(r));
    ok(r.length >= 1, 'at least one contradiction returned');
    const first = r[0];
    ok(first.claimA && first.claimB);
    ok(typeof first.explanation === 'string' && first.explanation.length > 0);
    ok(Array.isArray(first.edgePath));
    db.close();
  } finally { cleanup(tmp); }
}

function test2_findContradictionsEmpty() {
  const { tmp, db } = makeIsolatedRoom();
  try {
    deepEqual(navigation.findContradictions(db, 'nope:not-here'), []);
    db.close();
  } finally { cleanup(tmp); }
}

function test3_findUnsupportedSupportsOnly() {
  const { tmp, db } = makeRoom();
  try {
    const r = navigation.findUnsupportedClaims(db, 'test');
    const ids = r.map((x) => x.claim.id);
    ok(ids.includes('claim:unsup-1'), 'unsupported claim included');
    ok(!ids.includes('claim:supported-1'), 'SUPPORTS-edged claim excluded');
    ok(ids.includes('claim:enabled-only'), 'ENABLES-only claim included (separate edge type)');
    db.close();
  } finally { cleanup(tmp); }
}

function test4_findUnsupportedCausalClaimUnion() {
  const { tmp, db } = makeRoom();
  try {
    const r = navigation.findUnsupportedClaims(db, 'test');
    const ids = r.map((x) => x.claim.id);
    ok(ids.includes('claim:cc-unsup'), 'CausalClaim included in unsupported set');
    const cc = r.find((x) => x.claim.id === 'claim:cc-unsup');
    equal(cc.claim.type, 'CausalClaim');
    db.close();
  } finally { cleanup(tmp); }
}

function test5_findBlockingAssumptions() {
  const { tmp, db } = makeRoom();
  try {
    const r = navigation.findBlockingAssumptions(db, 'goal:gx');
    ok(r.length >= 1);
    const first = r[0];
    equal(first.assumption.id, 'assumption:risky');
    equal(first.blocksGoal.id, 'goal:gx');
    ok(Array.isArray(first.cascadePath));
    ok(typeof first.explanation === 'string');
    db.close();
  } finally { cleanup(tmp); }
}

function test6_findStaleDecisions30day() {
  const { tmp, db } = makeRoom();
  try {
    const r = navigation.findStaleDecisions(db, 'test');
    const ids = r.map((x) => x.decision.id);
    ok(ids.includes('decision:stale'), '45-day-old decision included');
    ok(!ids.includes('decision:fresh'), '10-day-old decision excluded');
    db.close();
  } finally { cleanup(tmp); }
}

function test7_findOpenQuestionsNoEvidence() {
  const { tmp, db } = makeRoom();
  try {
    const r = navigation.findOpenQuestions(db, 'test');
    const ids = r.map((x) => x.question.id);
    ok(ids.includes('open_question:o1'), 'orphan open_question included');
    ok(!ids.includes('open_question:o2'), 'open_question with SUPPORTS edge excluded');
    db.close();
  } finally { cleanup(tmp); }
}

function test8_findRelevantOpportunitiesRanking() {
  const { tmp, db } = makeRoom();
  try {
    const r = navigation.findRelevantOpportunities(db, 'focus:design', { topK: 5 });
    const ids = r.map((x) => x.opportunityId);
    // hi has highest HSI (85) -> highest composite score; expected first.
    equal(ids[0], 'opportunity:hi');
    // mid (50) > lo (20) at same depth + same JTBD (none); mid before lo.
    const midIdx = ids.indexOf('opportunity:mid');
    const loIdx = ids.indexOf('opportunity:lo');
    ok(midIdx < loIdx);
    db.close();
  } finally { cleanup(tmp); }
}

function test9_findRelevantOpportunitiesJtbdJaccard() {
  const { tmp, db } = makeRoom();
  try {
    const mocks = { jtbd: { getCurrent: () => ({ current: { id: 'find-fintech-bottleneck', tags: ['fintech'] } }) } };
    const r = navigation.findRelevantOpportunities(db, 'focus:design', { topK: 5, _mocks: mocks });
    const hi = r.find((x) => x.opportunityId === 'opportunity:hi');
    const mid = r.find((x) => x.opportunityId === 'opportunity:mid');
    ok(hi && mid);
    // hi tags ['fintech','b2b'] vs ['fintech'] -> Jaccard = 1/2 = 0.5
    ok(Math.abs(hi.jtbdMatch - 0.5) < 1e-6, 'hi jtbdMatch ' + hi.jtbdMatch + ' should be 0.5');
    // mid tags ['biotech'] vs ['fintech'] -> Jaccard = 0/2 = 0
    equal(mid.jtbdMatch, 0);
    db.close();
  } finally { cleanup(tmp); }
}

function test10_findRelevantOpportunitiesTopK() {
  const { tmp, db } = makeRoom();
  try {
    const r = navigation.findRelevantOpportunities(db, 'focus:design', { topK: 2 });
    equal(r.length, 2);
    db.close();
  } finally { cleanup(tmp); }
}

function test11_noLlmInLoop() {
  const insightsPath = path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'insights.cjs');
  const explanationPath = path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'explanation.cjs');
  const sources = fs.readFileSync(insightsPath, 'utf8') + '\n' + fs.readFileSync(explanationPath, 'utf8');
  const forbidden = [
    /require\(['"][^'"]*brain[^'"]*['"]\)/i,
    /require\(['"][^'"]*anthropic[^'"]*['"]\)/i,
    /require\(['"][^'"]*openai[^'"]*['"]\)/i,
    /\bfetch\s*\(/,
    /\baxios\b/,
    /\bnodeFetch\b/,
    /process\.env\.[A-Z_]*BRAIN/i,
    /process\.env\.[A-Z_]*API_KEY/i,
  ];
  for (const rx of forbidden) {
    ok(!rx.test(sources), 'no LLM/Brain client reference in insights/explanation source: ' + rx);
  }
}

function test12_explanationContainsTypedLabel() {
  const { tmp, db } = makeRoom();
  try {
    const r = navigation.findContradictions(db, 'focus:design');
    ok(r.length > 0);
    ok(/CONTRADICTS/.test(r[0].explanation), 'explanation contains typed edge label CONTRADICTS');
    db.close();
  } finally { cleanup(tmp); }
}

function test13_emptyInputs() {
  const { tmp, db } = makeIsolatedRoom();
  try {
    deepEqual(navigation.findContradictions(db, 'nope'), []);
    deepEqual(navigation.findUnsupportedClaims(db, 'no-room'), []);
    deepEqual(navigation.findBlockingAssumptions(db, 'nope'), []);
    deepEqual(navigation.findStaleDecisions(db, 'no-room'), []);
    deepEqual(navigation.findOpenQuestions(db, 'no-room'), []);
    deepEqual(navigation.findRelevantOpportunities(db, 'nope'), []);
    db.close();
  } finally { cleanup(tmp); }
}

function test14_navigationSurfaceLive() {
  const { tmp, db } = makeRoom();
  try {
    for (const name of ['findContradictions', 'findUnsupportedClaims', 'findBlockingAssumptions', 'findStaleDecisions', 'findOpenQuestions', 'findRelevantOpportunities']) {
      // Just call it - if it throws not_implemented_yet, the test fails.
      try {
        const fn = navigation[name];
        // Use a benign invocation that should always return an array (or at least not throw).
        if (name === 'findRelevantOpportunities' || name === 'findContradictions' || name === 'findBlockingAssumptions') fn(db, 'focus:design');
        else fn(db, 'test');
      } catch (err) {
        ok(!/not_implemented_yet/.test(err.message), name + ' still stubbed: ' + err.message);
        // Other errors are real bugs surfaced by other tests.
        throw err;
      }
    }
    db.close();
  } finally { cleanup(tmp); }
}

function run() {
  const tests = [test1_findContradictionsShape, test2_findContradictionsEmpty, test3_findUnsupportedSupportsOnly, test4_findUnsupportedCausalClaimUnion, test5_findBlockingAssumptions, test6_findStaleDecisions30day, test7_findOpenQuestionsNoEvidence, test8_findRelevantOpportunitiesRanking, test9_findRelevantOpportunitiesJtbdJaccard, test10_findRelevantOpportunitiesTopK, test11_noLlmInLoop, test12_explanationContainsTypedLabel, test13_emptyInputs, test14_navigationSurfaceLive];
  let pass = 0; let fail = 0;
  for (const t of tests) {
    try { t(); pass++; process.stdout.write('PASS ' + t.name + '\n'); }
    catch (err) { fail++; process.stderr.write('FAIL ' + t.name + ': ' + err.message + '\n' + err.stack + '\n'); }
  }
  process.stdout.write('test-navigation-insights: ' + pass + '/' + tests.length + ' passed\n');
  process.exit(fail === 0 ? 0 : 1);
}

run();
