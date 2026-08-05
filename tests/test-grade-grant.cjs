'use strict';
// Quick task 260805-tnufa-graphrag-grant-grader -- smoke test for
// lib/core/eureka/grade-grant.cjs: the Tnufa rubric loads and validates,
// scoring a synthetic draft produces a sane verdict with real gaps named, the
// Brain-coaching handle composer degrades gracefully and never leaks draft
// prose, and the verdict writes to room.db as a typed 'heuristic' claim node
// with review_status 'proposed' (Canon Part 9 role 5: never auto-confirmed) --
// through navigation.writeClaimNode only, no direct room.db SQL, no invented
// edge type.
//
// Canon Part 8: asserts the fixture directory is 100% local (data/grant-
// rubric-fixtures/*.json) and that nothing in this module requires a Brain
// client. Canon Part 7: asserts listPrograms() surfaces all 8 fixtures
// (Tnufa reviewed, 7 stubs) -- the reuse-before-build record for this build.
//
// NO em-dashes anywhere (CLAUDE.md HARD RULE).

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const MODULE_PATH = path.join(REPO_ROOT, 'lib', 'core', 'eureka', 'grade-grant.cjs');

const {
  listPrograms,
  loadRubric,
  scoreApplication,
  gapCategories,
  askBrainForCoaching,
  writeGradingResult,
} = require(MODULE_PATH);

const { openRoomDb, closeRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));

let pass = 0;
let total = 0;
function check(label, fn) {
  total += 1;
  fn();
  pass += 1;
  console.log('  ok -', label);
}

function freshRoomDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mos-grade-grant-'));
}

console.log('test-grade-grant.cjs');

check('listPrograms() surfaces all 8 bundled fixtures, tnufa reviewed', () => {
  const result = listPrograms();
  assert.equal(result.ok, true);
  assert.equal(result.programs.length, 8, 'expected 8 fixtures (tnufa + 7 stubs)');
  const tnufa = result.programs.find((p) => p.id === 'tnufa');
  assert.ok(tnufa, 'tnufa fixture must be present');
  assert.equal(tnufa.status, 'reviewed');
  assert.ok(tnufa.criteria_count >= 15, 'tnufa should carry a real, non-trivial criteria set');
  const stubs = result.programs.filter((p) => p.id !== 'tnufa');
  assert.equal(stubs.length, 7);
  for (const s of stubs) {
    assert.equal(s.status, 'stub');
    assert.equal(s.criteria_count, 0, s.id + ' stub fixtures carry no invented criteria');
  }
});

check('loadRubric(tnufa) validates against the schema contract', () => {
  const result = loadRubric('tnufa');
  assert.equal(result.ok, true);
  assert.equal(result.rubric.id, 'tnufa');
  assert.ok(result.rubric.criteria.length >= 15);
  for (const c of result.rubric.criteria) {
    assert.ok(c.id && c.aspect && c.details && c.common_mistake && c.category);
  }
});

check('loadRubric rejects a path-traversal / invalid slug rather than reading outside fixtures dir', () => {
  const attempt = loadRubric('../../etc/passwd');
  assert.equal(attempt.ok, false);
  assert.equal(attempt.reason, 'invalid_program_id');
});

check('loadRubric reports fixture_not_found for an unknown program id', () => {
  const attempt = loadRubric('not-a-real-program');
  assert.equal(attempt.ok, false);
  assert.equal(attempt.reason, 'fixture_not_found');
});

check('scoreApplication produces a sane verdict with real named gaps for a weak synthetic draft', () => {
  const rubric = loadRubric('tnufa').rubric;
  // A synthetic draft that is strong on a few criteria, weak/silent on most --
  // exercises evidenced / asserted / absent all three, and the "no finding at
  // all" -> absent default (silent gaps are not hidden as passes).
  const findings = [
    { criterion_id: 'eligibility_applicant', status: 'evidenced', note: 'pre-revenue solo founder, stated explicitly' },
    { criterion_id: 'funding_terms', status: 'evidenced', note: 'draft states 85% / NIS 200K / 12 months correctly' },
    { criterion_id: 'matching_funds_proof', status: 'asserted', note: 'claims matching funds available, no source named' },
    { criterion_id: 'market_validation_scope', status: 'asserted', note: 'general market pitch, not tied to the tech' },
    // every other criterion has no finding at all -> defaults to 'absent'
  ];
  const verdict = scoreApplication(rubric, findings);
  assert.equal(verdict.ok, true);
  assert.equal(verdict.program_id, 'tnufa');
  assert.equal(verdict.counts.total, rubric.criteria.length);
  assert.equal(verdict.counts.evidenced, 2);
  assert.equal(verdict.counts.asserted, 2);
  assert.equal(verdict.counts.absent, rubric.criteria.length - 4);
  assert.ok(verdict.score_pct > 0 && verdict.score_pct < 50, 'a mostly-silent draft should score low, not zero, not high');
  assert.ok(verdict.gaps.length === rubric.criteria.length - 2, 'every non-evidenced criterion surfaces as a named gap');
  const legalGap = verdict.gaps.find((g) => g.criterion_id === 'legal_ip_registration');
  assert.ok(legalGap, 'an unaddressed criterion must be named, not silently dropped');
  assert.ok(legalGap.common_mistake.length > 0, 'each gap carries its rubric common_mistake for coaching');
});

check('scoreApplication treats a criterion with no finding as absent, never a silent pass', () => {
  const rubric = loadRubric('tnufa').rubric;
  const verdict = scoreApplication(rubric, []);
  assert.equal(verdict.ok, true);
  assert.equal(verdict.counts.evidenced, 0);
  assert.equal(verdict.counts.absent, rubric.criteria.length);
  assert.equal(verdict.score_pct, 0);
});

check('gapCategories + askBrainForCoaching compose GENERIC handles only, never draft prose', () => {
  const rubric = loadRubric('tnufa').rubric;
  const findings = [
    { criterion_id: 'legal_ip_registration', status: 'absent' },
    { criterion_id: 'budget_planning', status: 'absent' },
  ];
  const verdict = scoreApplication(rubric, findings);
  const cats = gapCategories(verdict);
  assert.ok(cats.includes('legal'));
  assert.ok(cats.includes('budget'));
  const coaching = askBrainForCoaching(verdict);
  assert.equal(coaching.ok, true);
  assert.equal(coaching.brain_available, false, 'this module never calls Brain itself -- the host command does, or skips');
  assert.deepEqual(coaching.handles.gap_categories, cats.slice().sort());
  const serialized = JSON.stringify(coaching.handles);
  assert.ok(!serialized.includes('draft'), 'the handle bag must never carry applicant prose');
});

check('askBrainForCoaching degrades cleanly when there are no gaps', () => {
  const rubric = loadRubric('tnufa').rubric;
  const findings = rubric.criteria.map((c) => ({ criterion_id: c.id, status: 'evidenced' }));
  const verdict = scoreApplication(rubric, findings);
  assert.equal(verdict.score_pct, 100);
  const coaching = askBrainForCoaching(verdict);
  assert.equal(coaching.ok, true);
  assert.equal(coaching.handles, null);
});

check('writeGradingResult files the verdict as a proposed heuristic claim node via navigation.writeClaimNode', () => {
  const roomDir = freshRoomDir();
  const db = openRoomDb(roomDir);
  try {
    const rubric = loadRubric('tnufa').rubric;
    const findings = [{ criterion_id: 'eligibility_applicant', status: 'evidenced' }];
    const verdict = scoreApplication(rubric, findings);
    const written = writeGradingResult(db, { verdict, sessionId: 'test-grade-grant', programName: 'Tnufa (Ideation)' });
    assert.equal(written.ok, true, JSON.stringify(written));
    assert.ok(written.node_id.startsWith('claim:'));

    const row = db.prepare('SELECT type, review_status, properties FROM nodes WHERE id = ?').get(written.node_id);
    assert.ok(row, 'the claim node must actually land in room.db, not just report ok');
    assert.equal(row.type, 'claim');
    assert.equal(row.review_status, 'proposed', 'Canon Part 9 role 5: never auto-confirmed by an agent');
    const props = JSON.parse(row.properties);
    assert.equal(props.knowledge_type, 'heuristic');
    assert.equal(props.program_id, 'tnufa');
    assert.equal(props.score_pct, verdict.score_pct);

    // No edges table pollution -- this module writes a node only, zero
    // per-criterion edges in v1 (documented scope in grade-grant.cjs header).
    const edgeCount = db.prepare('SELECT COUNT(*) AS n FROM edges').get().n;
    assert.equal(edgeCount, 0, 'v1 files a single claim node, no invented edge type');
  } finally {
    closeRoomDb(db);
    fs.rmSync(roomDir, { recursive: true, force: true });
  }
});

check('writeGradingResult rejects an invalid verdict rather than writing garbage', () => {
  const roomDir = freshRoomDir();
  const db = openRoomDb(roomDir);
  try {
    const result = writeGradingResult(db, { verdict: { program_id: '' } });
    assert.equal(result.ok, false);
  } finally {
    closeRoomDb(db);
    fs.rmSync(roomDir, { recursive: true, force: true });
  }
});

console.log(pass + '/' + total + ' checks passed');
if (pass !== total) {
  process.exitCode = 1;
}
