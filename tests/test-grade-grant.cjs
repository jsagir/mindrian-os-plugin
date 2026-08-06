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
  validateRubric,
  scoreApplication,
  gapCategories,
  sectionMap,
  buildRoadmap,
  askBrainForCoaching,
  askBrainForStrategy,
  writeGradingResult,
  ROOM_SECTION_VALUES,
} = require(MODULE_PATH);

const { openRoomDb, closeRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));
const navigation = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation.cjs'));
const { ALLOWED_EDGE_TYPES, writeEdge } = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'edges.cjs'));

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

    // No edges table pollution from THIS function -- writeGradingResult stays
    // node-only (quick 260806 D4). The graph edges are the separate, opt-in
    // navigation writers (writeGrantRubricGraph / writeGradingSectionEdges),
    // exercised in their own checks below.
    const edgeCount = db.prepare('SELECT COUNT(*) AS n FROM edges').get().n;
    assert.equal(edgeCount, 0, 'writeGradingResult alone files a single claim node, zero edges');
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

// ---------------------------------------------------------------------------
// Quick 260806-grant-grader-room-graph: the room_section map, both directions,
// as pure functions AND as typed graph structure through navigation.cjs.
// ---------------------------------------------------------------------------

check('every tnufa criterion carries a valid room_section (slug or honest null), never a forced mapping', () => {
  const rubric = loadRubric('tnufa').rubric;
  let nulls = 0;
  for (const c of rubric.criteria) {
    assert.ok(c.room_section !== undefined, c.id + ' must declare room_section explicitly');
    if (c.room_section === null) nulls += 1;
    else assert.ok(ROOM_SECTION_VALUES.has(c.room_section), c.id + ' carries an unknown section: ' + c.room_section);
  }
  assert.ok(nulls >= 1, 'pure process/reporting criteria must stay null, not get a fake section');
  // The named process items from the mapping decision stay null.
  for (const id of ['submission_process', 'reporting_requirements']) {
    const c = rubric.criteria.find((x) => x.id === id);
    assert.equal(c.room_section, null, id + ' is a post-award/process item with no room location');
  }
});

check('validateRubric fails closed on an unknown room_section string', () => {
  const rubric = JSON.parse(JSON.stringify(loadRubric('tnufa').rubric));
  rubric.criteria[0].room_section = 'not-a-real-section';
  const result = validateRubric(rubric);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'fixture_invalid_room_section');
});

check('sectionMap groups criteria by section and keeps null-section criteria as process items', () => {
  const rubric = loadRubric('tnufa').rubric;
  const map = sectionMap(rubric);
  assert.equal(map.ok, true);
  const mappedCount = Object.values(map.sections).reduce((n, arr) => n + arr.length, 0);
  assert.equal(mappedCount + map.process.length, rubric.criteria.length, 'every criterion lands exactly once');
  assert.ok(map.mapped_sections.includes('financial-model'));
  assert.equal(map.sections['financial-model'].length, 3, 'funding_terms + budget_planning + matching_funds_proof');
  assert.ok(map.process.every((c) => c.room_section === null || c.room_section === undefined));
  assert.equal(sectionMap(null).ok, false, 'garbage in, {ok:false} out, never a throw');
});

check('buildRoadmap turns gaps into per-section build plans plus a process checklist', () => {
  const rubric = loadRubric('tnufa').rubric;
  // Financial-model fully evidenced; everything else silent -> gapped.
  const findings = [
    { criterion_id: 'funding_terms', status: 'evidenced' },
    { criterion_id: 'budget_planning', status: 'evidenced' },
    { criterion_id: 'matching_funds_proof', status: 'evidenced' },
  ];
  const verdict = scoreApplication(rubric, findings);
  const roadmap = buildRoadmap(rubric, verdict);
  assert.equal(roadmap.ok, true);
  assert.equal(roadmap.program_id, 'tnufa');
  // Covered: financial-model has zero gaps.
  assert.deepEqual(roadmap.covered_sections, ['financial-model']);
  // No section plan points at financial-model; every plan carries build text
  // drawn from the criterion's details field (the WHAT to build).
  for (const plan of roadmap.section_plans) {
    assert.notEqual(plan.room_section, 'financial-model');
    assert.ok(ROOM_SECTION_VALUES.has(plan.room_section));
    for (const gap of plan.gaps) {
      assert.ok(gap.build.length > 0, gap.criterion_id + ' must carry its details as the build target');
      assert.ok(gap.common_mistake.length > 0);
    }
  }
  // The null-section criteria surface as a checklist, never inside a section plan.
  const checklistIds = roadmap.process_checklist.map((r) => r.criterion_id);
  assert.ok(checklistIds.includes('submission_process'));
  assert.ok(checklistIds.includes('reporting_requirements'));
  // Weakest section first (sorted by gap count descending).
  for (let i = 1; i < roadmap.section_plans.length; i++) {
    assert.ok(roadmap.section_plans[i - 1].gaps.length >= roadmap.section_plans[i].gaps.length);
  }
  assert.equal(buildRoadmap(rubric, null).ok, false, 'garbage verdict degrades, never throws');
});

check('askBrainForStrategy composes section-coverage ENUMS only, never room prose (Part 8)', () => {
  const rubric = loadRubric('tnufa').rubric;
  const findings = [
    { criterion_id: 'funding_terms', status: 'evidenced' },
    { criterion_id: 'budget_planning', status: 'evidenced' },
    { criterion_id: 'matching_funds_proof', status: 'evidenced' },
    { criterion_id: 'eligibility_applicant', status: 'evidenced' },
    // team_section left silent -> team-execution is partial, not covered.
  ];
  const verdict = scoreApplication(rubric, findings);
  const strategy = askBrainForStrategy(verdict, rubric);
  assert.equal(strategy.ok, true);
  assert.equal(strategy.brain_available, false, 'recommend-never-trigger: the host command owns the wire');
  assert.equal(strategy.handles.framework, 'grant-application-strategy');
  assert.equal(strategy.handles.section_profile['financial-model'], 'covered');
  assert.equal(strategy.handles.section_profile['team-execution'], 'partial');
  assert.equal(strategy.handles.section_profile['market-analysis'], 'missing');
  for (const v of Object.values(strategy.handles.section_profile)) {
    assert.ok(['covered', 'partial', 'missing'].includes(v), 'profile values are a closed enum');
  }
  const serialized = JSON.stringify(strategy.handles);
  const sampleProse = rubric.criteria[0].details.slice(0, 30);
  assert.ok(!serialized.includes(sampleProse), 'no rubric/room prose in the handle bag');
});

check('MAPS_TO_SECTION is a real ALLOWED_EDGE_TYPES member; an ad hoc string still rejects', () => {
  assert.ok(ALLOWED_EDGE_TYPES.has('MAPS_TO_SECTION'));
  const roomDir = freshRoomDir();
  const db = openRoomDb(roomDir);
  try {
    const bad = writeEdge(db, {
      source_id: 'a', target_id: 'b', edge_type: 'GRANT_GAP_IN', properties: {},
    });
    assert.equal(bad.ok, false);
    assert.equal(bad.reason, 'invalid_edge_type', 'no invented edge strings sneak past the chokepoint');
  } finally {
    closeRoomDb(db);
    fs.rmSync(roomDir, { recursive: true, force: true });
  }
});

check('writeGrantRubricGraph mints criterion anchors + MAPS_TO_SECTION edges, idempotently', () => {
  const roomDir = freshRoomDir();
  const db = openRoomDb(roomDir);
  try {
    const rubric = loadRubric('tnufa').rubric;
    const mappedCriteria = rubric.criteria.filter((c) => c.room_section !== null).length;
    const result = navigation.writeGrantRubricGraph(db, rubric);
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(result.criteria_nodes, rubric.criteria.length, 'one anchor node per criterion, null-section ones included');
    assert.equal(result.edges_written, mappedCriteria, 'one MAPS_TO_SECTION edge per NON-null criterion only');

    const nodeRow = db.prepare("SELECT type, review_status, properties FROM nodes WHERE id = ?")
      .get('grant_criterion:tnufa:funding_terms');
    assert.ok(nodeRow, 'the criterion anchor must actually land');
    assert.equal(nodeRow.type, 'grant_criterion');
    assert.equal(nodeRow.review_status, 'confirmed', 'system-bookkeeping structural anchor, Part 9 v1.5 carve-out');
    assert.ok(!nodeRow.properties.includes('85%'), 'no rubric prose/details on node properties (Part 8 discipline)');

    const edgeRow = db.prepare(
      "SELECT properties FROM edges WHERE source = ? AND target = ? AND type = 'MAPS_TO_SECTION'"
    ).get('grant_criterion:tnufa:funding_terms', 'financial-model');
    assert.ok(edgeRow, 'funding_terms MAPS_TO_SECTION financial-model must land');

    const nullEdge = db.prepare(
      "SELECT COUNT(*) AS n FROM edges WHERE source = ? AND type = 'MAPS_TO_SECTION'"
    ).get('grant_criterion:tnufa:submission_process').n;
    assert.equal(nullEdge, 0, 'a null-section criterion gets NO edge -- the null is honest');

    // Section anchors were ensured for the referenced sections.
    const sectionRow = db.prepare("SELECT type FROM nodes WHERE id = 'financial-model'").get();
    assert.equal(sectionRow.type, 'Section');

    // Idempotent: a second run upserts, never duplicates.
    const before = db.prepare("SELECT COUNT(*) AS n FROM edges WHERE type = 'MAPS_TO_SECTION'").get().n;
    const rerun = navigation.writeGrantRubricGraph(db, rubric);
    assert.equal(rerun.ok, true);
    const after = db.prepare("SELECT COUNT(*) AS n FROM edges WHERE type = 'MAPS_TO_SECTION'").get().n;
    assert.equal(before, after, 're-running the rubric graph writer must not grow the edge set');
  } finally {
    closeRoomDb(db);
    fs.rmSync(roomDir, { recursive: true, force: true });
  }
});

check('writeGradingSectionEdges files one INFORMS coverage-profile edge per mapped section, scalars only', () => {
  const roomDir = freshRoomDir();
  const db = openRoomDb(roomDir);
  try {
    const rubric = loadRubric('tnufa').rubric;
    const findings = [{ criterion_id: 'funding_terms', status: 'evidenced' }];
    const verdict = scoreApplication(rubric, findings);
    const written = writeGradingResult(db, { verdict, sessionId: 'test-grade-grant', programName: 'Tnufa (Ideation)' });
    assert.equal(written.ok, true);
    navigation.writeGrantRubricGraph(db, rubric);

    const result = navigation.writeGradingSectionEdges(db, {
      verdict_node_id: written.node_id,
      verdict: verdict,
      rubric: rubric,
    });
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(result.edges_written, result.sections.length, 'one aggregate edge per mapped section');
    assert.ok(result.sections.includes('financial-model'));

    const row = db.prepare(
      "SELECT properties FROM edges WHERE source = ? AND target = 'financial-model' AND type = 'INFORMS'"
    ).get(written.node_id);
    assert.ok(row, 'the verdict->section coverage edge must land');
    const props = JSON.parse(row.properties);
    assert.equal(props.relation, 'grant_gap_profile');
    assert.equal(props.total, 3, 'financial-model maps 3 criteria');
    assert.equal(props.evidenced, 1);
    assert.equal(props.absent, 2);
    for (const v of Object.values(props)) {
      assert.ok(typeof v === 'number' || typeof v === 'string');
      if (typeof v === 'string') assert.ok(v.length < 60, 'scalar handles only, never prose');
    }
    const garbage = navigation.writeGradingSectionEdges(db, { verdict_node_id: '', verdict: null, rubric: null });
    assert.equal(garbage.ok, false, 'garbage degrades, never throws');
  } finally {
    closeRoomDb(db);
    fs.rmSync(roomDir, { recursive: true, force: true });
  }
});

console.log(pass + '/' + total + ' checks passed');
if (pass !== total) {
  process.exitCode = 1;
}
