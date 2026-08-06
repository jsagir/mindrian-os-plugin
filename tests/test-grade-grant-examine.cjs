'use strict';
// Quick task 260806-d0x -- grade-grant reviewer-panel examination mode: smoke tests for
// lib/core/eureka/grade-grant-examine.cjs. Mirrors tests/test-grade-grant.cjs's check()
// harness and real-room.db-round-trip convention (no mocking the graph).
//
// Covers: buildReviewerSlots always names all 7 CATEGORY_VALUES; the N2 fan-out-cap fix
// (batchCategories never exceeds FUTURES_FANOUT_CAP per batch, and runReviewerFanout's two
// batches together cover all 7 categories, never silently dropping any); defensive
// defaultReviewerDispatchCell behavior (mechanical reshape vs the neutral stub);
// reviewerCellsToFindings parity against scoreApplication (round-trips through the SAME
// scoring engine, byte-unchanged); the fail-closed merge-collision rule (stricter status
// wins, recorded); applyPanelChallenges' downgrade-only resolution table (sustained /
// stands / ignored_upward / ignored_unmatched); THE DEGENERATION PIN (a cross-category
// challenge from the debate MUST change the scored verdict and can flip the ruling to
// rejected -- proving the panel is a debate, not 7 independent verdicts, the design's
// own flagged open risk); writeGradingResult's additive extraProps merge (a panel
// verdict is distinguishable in the graph, standard keys never clobbered);
// grade-grant.cjs::deriveRulingVerb's 4 branches (re-verified here at the
// orchestration-module boundary); and a REAL runDebate/runDerivation round-trip (no
// mocking) proving the batched-cells-into-debate pipeline does not silently drop work.
//
// Canon Part 8: asserts this module never requires a network/Brain client. Canon Part 7:
// asserts the fan-out/debate calls are the SHIPPED substrate (runCellFanout/runDebate),
// never a duplicate engine.
//
// NO em-dashes anywhere (CLAUDE.md HARD RULE).

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const MODULE_PATH = path.join(REPO_ROOT, 'lib', 'core', 'eureka', 'grade-grant-examine.cjs');

const examine = require(MODULE_PATH);
const grantGrant = require(path.join(REPO_ROOT, 'lib', 'core', 'eureka', 'grade-grant.cjs'));
const { FUTURES_FANOUT_CAP } = require(path.join(REPO_ROOT, 'lib', 'core', 'futures', 'orchestrator.cjs'));
const { openRoomDb, closeRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));
const debate = require(path.join(REPO_ROOT, 'lib', 'core', 'bono', 'debate-composition.cjs'));

let pass = 0;
let total = 0;
function check(label, fn) {
  total += 1;
  return Promise.resolve()
    .then(fn)
    .then(() => { pass += 1; console.log('  ok -', label); });
}

function freshRoomDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mos-grade-grant-examine-'));
}

function findingsCoveringAllCategories(rubric, opts) {
  const o = opts || {};
  const byCategory = {};
  for (const c of rubric.criteria) {
    if (!byCategory[c.category]) byCategory[c.category] = [];
    byCategory[c.category].push({
      criterion_id: c.id,
      status: 'evidenced',
      room_location: 'room/x',
      note: o.note || 'reconciled evidence',
      reconciled: true,
      disposition: 'disconfirming',
    });
  }
  return byCategory;
}

async function main() {
  console.log('test-grade-grant-examine.cjs');

  await check('this module never requires a network/Brain client (Canon Part 8)', () => {
    const src = fs.readFileSync(MODULE_PATH, 'utf8');
    assert.ok(!/require\(['"]https?/i.test(src));
    assert.ok(!/brain[-_]?client/i.test(src));
    assert.ok(!src.includes('fetch('));
  });

  await check('buildReviewerSlots always names all 7 CATEGORY_VALUES, one slot each', () => {
    const rubric = grantGrant.loadRubric('tnufa').rubric;
    const slots = examine.buildReviewerSlots(rubric);
    assert.equal(slots.length, 7);
    const hats = slots.map((s) => s.hat).sort();
    assert.deepEqual(hats, Array.from(grantGrant.CATEGORY_VALUES).sort());
    for (const s of slots) assert.equal(s.subdomain, 'tnufa');
    assert.deepEqual(examine.buildReviewerSlots(null), [], 'garbage rubric degrades to empty, never throws');
  });

  await check('batchCategories (the N2 fix) never exceeds FUTURES_FANOUT_CAP per batch, covers all 7 exactly once', () => {
    const batches = examine.batchCategories(examine.CATEGORY_LIST, FUTURES_FANOUT_CAP);
    assert.equal(FUTURES_FANOUT_CAP, 5, 'the fan-out cap this test assumes');
    assert.equal(batches.length, 2, '7 categories under a cap of 5 needs exactly 2 batches');
    for (const b of batches) assert.ok(b.length <= FUTURES_FANOUT_CAP, 'no batch exceeds the cap');
    const flattened = batches.flat();
    assert.equal(flattened.length, 7, 'all 7 categories present, none dropped');
    assert.deepEqual(flattened.slice().sort(), examine.CATEGORY_LIST.slice().sort(), 'no duplicate, no omission');
  });

  await check('runReviewerFanout dispatches all 7 categories across 2 real runCellFanout batches, never silently dropping 2 (the N2 bug)', async () => {
    const rubric = grantGrant.loadRubric('tnufa').rubric;
    const findingsByCategory = findingsCoveringAllCategories(rubric);
    const result = await examine.runReviewerFanout(rubric, { findingsByCategory }, {});
    assert.equal(result.ok, true);
    assert.equal(result.plan.batches, 2);
    assert.equal(result.plan.requested, 7, 'the grid requested all 7 categories');
    assert.equal(result.plan.dispatched, 7, 'all 7 were actually dispatched (never clamped to 5)');
    assert.equal(result.plan.capped, false);
    // Every category is represented among the collected cells (fully-evidenced findings
    // clear the default fable-mode confidence floor, so nothing is dropped here).
    const hats = result.cells.map((c) => c.hat).sort();
    assert.deepEqual(hats, examine.CATEGORY_LIST.slice().sort());
  });

  await check('runReviewerFanout degrades to invalid_rubric on garbage input, never throws', async () => {
    const result = await examine.runReviewerFanout(null, {}, {});
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'invalid_rubric');
  });

  await check('defaultReviewerDispatchCell mechanically reshapes injected findings, never invents one', () => {
    const rubric = grantGrant.loadRubric('tnufa').rubric;
    const cell = { subdomain: 'tnufa', hat: 'eligibility', handle: 'tnufa' };
    const ctx = {
      rubric: rubric,
      findingsByCategory: {
        eligibility: [
          { criterion_id: 'eligibility_applicant', status: 'evidenced', room_location: 'room/x', note: 'n' },
          { criterion_id: 'eligibility_sector', status: 'absent' },
        ],
      },
    };
    const reading = examine.defaultReviewerDispatchCell(cell, ctx);
    assert.equal(reading.stance, 'supports');
    assert.ok(reading.evidence.length >= 1);
    assert.ok(reading.criteria_examined.includes('eligibility_applicant'));
    assert.ok(reading.criteria_examined.includes('eligibility_sector'));
    // the absent finding never lands in the evidence array (it carries no support to cite)
    assert.ok(!reading.evidence.some((e) => e.criterion_id === 'eligibility_sector'));
  });

  await check('defaultReviewerDispatchCell degrades to a neutral low-confidence stub with zero injected findings', () => {
    const rubric = grantGrant.loadRubric('tnufa').rubric;
    const cell = { subdomain: 'tnufa', hat: 'market', handle: 'tnufa' };
    const reading = examine.defaultReviewerDispatchCell(cell, { rubric: rubric });
    assert.equal(reading.stance, 'neutral');
    assert.deepEqual(reading.evidence, []);
    assert.equal(reading.confidence, 0.2);
    assert.ok(Array.isArray(reading.criteria_examined) && reading.criteria_examined.length > 0);
  });

  await check('reviewerCellsToFindings round-trips into scoreApplication byte-identically to hand-built findings', () => {
    const rubric = grantGrant.loadRubric('tnufa').rubric;
    const cells = [
      { hat: 'eligibility', evidence: [{ criterion_id: 'eligibility_applicant', status: 'evidenced', note: 'a' }] },
      { hat: 'budget', evidence: [{ criterion_id: 'funding_terms', status: 'evidenced', note: 'b' }] },
    ];
    const derivedFindings = examine.reviewerCellsToFindings(cells, rubric);
    const handFindings = [
      { criterion_id: 'eligibility_applicant', status: 'evidenced', note: 'a' },
      { criterion_id: 'funding_terms', status: 'evidenced', note: 'b' },
    ];
    const verdictFromCells = grantGrant.scoreApplication(rubric, derivedFindings);
    const verdictFromHand = grantGrant.scoreApplication(rubric, handFindings);
    assert.deepEqual(verdictFromCells, verdictFromHand, 'scoreApplication runs byte-unchanged on either input shape');
  });

  await check('reviewerCellsToFindings collision fails CLOSED: the stricter status wins and the collision is recorded', () => {
    const rubric = grantGrant.loadRubric('tnufa').rubric;
    // Two cells BOTH claiming the same criterion (in a real run categories partition
    // the 18 criteria with no overlap, so a collision means something upstream is
    // broken). Fail closed: 'absent' (stricter) must beat the earlier 'evidenced' --
    // first-write-wins here would be the false-success failure class.
    const cells = [
      { hat: 'eligibility', evidence: [{ criterion_id: 'eligibility_applicant', status: 'evidenced', note: 'first' }] },
      { hat: 'process', evidence: [{ criterion_id: 'eligibility_applicant', status: 'absent', note: 'second' }] },
    ];
    const collisions = [];
    const findings = examine.reviewerCellsToFindings(cells, rubric, collisions);
    const matched = findings.filter((f) => f.criterion_id === 'eligibility_applicant');
    assert.equal(matched.length, 1, 'never a duplicate finding for one criterion');
    assert.equal(matched[0].status, 'absent', 'the STRICTER status wins, never the first writer');
    assert.equal(collisions.length, 1, 'the collision is recorded, never silent');
    assert.equal(collisions[0].resolution, 'collision_stricter_kept');
    assert.equal(collisions[0].kept, 'absent');
    // Same-status duplicates are not a dispute (nothing differs).
    const cleanCollisions = [];
    examine.reviewerCellsToFindings([
      { hat: 'a', evidence: [{ criterion_id: 'eligibility_applicant', status: 'evidenced' }] },
      { hat: 'b', evidence: [{ criterion_id: 'eligibility_applicant', status: 'evidenced' }] },
    ], rubric, cleanCollisions);
    assert.equal(cleanCollisions.length, 0, 'a same-status duplicate records no collision');
  });

  await check('applyPanelChallenges: downgrade-only resolution (sustained / stands / ignored_upward / ignored_unmatched)', () => {
    const findings = [
      { criterion_id: 'suitability_self_check', status: 'evidenced', note: 'plan named' },
      { criterion_id: 'funding_terms', status: 'asserted', note: '' },
      { criterion_id: 'market_validation_scope', status: 'asserted', note: '' },
    ];
    const challenges = [
      // sustained: budget challenges eligibility's evidenced DOWN to asserted.
      { criterion_id: 'suitability_self_check', to_status: 'asserted', challenged_by: 'budget', reason: 'post-Tnufa funding plan has no numbers behind it' },
      // stands: the owning reviewer rebutted -- original status kept, dispute recorded.
      { criterion_id: 'funding_terms', to_status: 'absent', challenged_by: 'legal', reason: 'no signed source', rebutted: true },
      // ignored_upward: a challenge may NEVER move a status up.
      { criterion_id: 'market_validation_scope', to_status: 'evidenced', challenged_by: 'ip', reason: 'looks fine to me' },
      // ignored_unmatched: no finding to downgrade, never invents one.
      { criterion_id: 'not_a_real_criterion', to_status: 'absent', challenged_by: 'legal', reason: 'x' },
    ];
    const out = examine.applyPanelChallenges(findings, challenges);
    assert.equal(out.disputes.length, 4, 'EVERY challenge lands in disputes, nothing silent');
    assert.deepEqual(out.disputes.map((d) => d.resolution), ['sustained', 'stands', 'ignored_upward', 'ignored_unmatched']);

    const byId = {};
    for (const f of out.findings) byId[f.criterion_id] = f;
    assert.equal(byId.suitability_self_check.status, 'asserted', 'the sustained challenge applied');
    assert.ok(byId.suitability_self_check.note.includes('challenged by budget'), 'the reason lands in the note');
    assert.equal(byId.funding_terms.status, 'asserted', 'a rebutted challenge stands at the original status');
    assert.equal(byId.market_validation_scope.status, 'asserted', 'an upward challenge is never applied');
    // Purity: the input findings array is never mutated.
    assert.equal(findings[0].status, 'evidenced', 'input findings untouched');
    // Garbage degrades, never throws.
    assert.deepEqual(examine.applyPanelChallenges(null, null), { findings: [], disputes: [] });
  });

  await check('THE DEGENERATION PIN: a cross-category challenge changes the scored verdict and can flip the ruling to rejected', async () => {
    const rubric = grantGrant.loadRubric('tnufa').rubric;
    const findingsByCategory = findingsCoveringAllCategories(rubric);
    const fanout = await examine.runReviewerFanout(rubric, { findingsByCategory }, {});
    assert.equal(fanout.cells.length, 7);

    // WITHOUT a challenge: all-evidenced, ruling 'supported'.
    const clean = examine.consolidatePanel(fanout.cells, rubric, { dropped: fanout.dropped });
    const cleanVerdict = grantGrant.scoreApplication(rubric, clean.findings);
    assert.equal(cleanVerdict.score_pct, 100);
    assert.equal(grantGrant.deriveRulingVerb(cleanVerdict, rubric).verb, 'supported');
    assert.deepEqual(clean.disputes, [], 'no challenge, no dispute');

    // WITH the debate's challenge (the budget reviewer, having read the eligibility
    // argument via previousOutput, downgrades suitability_self_check to absent): the
    // merged findings CHANGE before scoreApplication, the score drops, and the
    // eligibility hard gate flips the ruling to rejected. If this assertion ever
    // passes with an unchanged verdict, the panel has degenerated into 7 independent
    // verdicts and the debate is a costume.
    const challenged = examine.consolidatePanel(fanout.cells, rubric, {
      dropped: fanout.dropped,
      challenges: [{
        criterion_id: 'suitability_self_check',
        to_status: 'absent',
        challenged_by: 'budget',
        reason: 'no demonstrable post-Tnufa funding source in the financial model',
      }],
    });
    assert.equal(challenged.disputes.length, 1);
    assert.equal(challenged.disputes[0].resolution, 'sustained');
    const challengedVerdict = grantGrant.scoreApplication(rubric, challenged.findings);
    assert.ok(challengedVerdict.score_pct < cleanVerdict.score_pct, 'the debate changed the score');
    const ruling = grantGrant.deriveRulingVerb(challengedVerdict, rubric);
    assert.equal(ruling.verb, 'rejected', 'the sustained downgrade tripped the eligibility hard gate');
    assert.equal(ruling.escalation.criterion_id, 'suitability_self_check');

    // The disputes ride the ruling record as scalar counts (buildReviewerDebateOptions).
    const opts = examine.buildReviewerDebateOptions(fanout.cells, 'h', rubric, {
      verdict: challengedVerdict,
      disputes: challenged.disputes,
    });
    assert.ok(opts.ruling.finding.summary.includes('1 dispute'), 'the ruling summary names the dispute count');
    assert.ok(opts.ruling.finding.summary.includes('1 sustained'), 'and the sustained count');
  });

  await check('writeGradingResult merges caller extraProps UNDER the standard keys (panel verdicts distinguishable, never clobbered)', async () => {
    const rubric = grantGrant.loadRubric('tnufa').rubric;
    const allEvidenced = rubric.criteria.map((c) => ({ criterion_id: c.id, status: 'evidenced' }));
    const verdict = grantGrant.scoreApplication(rubric, allEvidenced);
    const roomDir = freshRoomDir();
    const db = openRoomDb(roomDir);
    try {
      const res = grantGrant.writeGradingResult(db, {
        verdict,
        sessionId: 'test-extraprops',
        extraProps: { mode: 'panel', dispute_count: 2, sustained_count: 1, score_pct: -999 },
      });
      assert.equal(res.ok, true);
      const row = db.prepare('SELECT properties FROM nodes WHERE id = ?').get(res.node_id);
      const props = JSON.parse(row.properties);
      assert.equal(props.mode, 'panel', 'the caller scalar landed');
      assert.equal(props.dispute_count, 2);
      assert.equal(props.sustained_count, 1);
      assert.equal(props.score_pct, verdict.score_pct, 'a caller extra can NEVER clobber a standard key');
    } finally {
      closeRoomDb(db);
      fs.rmSync(roomDir, { recursive: true, force: true });
    }
  });

  await check('reviewerCellsToFindings drops a criterion_id not present in the rubric, never invents one', () => {
    const rubric = grantGrant.loadRubric('tnufa').rubric;
    const cells = [{ hat: 'eligibility', evidence: [{ criterion_id: 'not_a_real_criterion', status: 'evidenced' }] }];
    const findings = examine.reviewerCellsToFindings(cells, rubric);
    assert.deepEqual(findings, []);
    assert.deepEqual(examine.reviewerCellsToFindings(null, rubric), [], 'garbage cells degrade, never throw');
  });

  await check('grade-grant.cjs::deriveRulingVerb 4 branches (re-verified at the orchestration boundary)', () => {
    const rubric = grantGrant.loadRubric('tnufa').rubric;

    // supported: everything evidenced, zero absent, score >= 80.
    const allEvidenced = rubric.criteria.map((c) => ({ criterion_id: c.id, status: 'evidenced' }));
    const supportedVerdict = grantGrant.scoreApplication(rubric, allEvidenced);
    assert.deepEqual(grantGrant.deriveRulingVerb(supportedVerdict, rubric), { verb: 'supported', escalation: null });

    // rejected: an eligibility criterion left absent overrides everything else.
    const oneAbsent = rubric.criteria
      .filter((c) => c.id !== 'eligibility_applicant')
      .map((c) => ({ criterion_id: c.id, status: 'evidenced' }));
    const rejectedVerdict = grantGrant.scoreApplication(rubric, oneAbsent);
    const rejected = grantGrant.deriveRulingVerb(rejectedVerdict, rubric);
    assert.equal(rejected.verb, 'rejected');
    assert.equal(rejected.escalation.criterion_id, 'eligibility_applicant');
    assert.equal(rejected.escalation.category, 'eligibility');
    assert.equal(rejected.escalation.reason, 'eligibility_hard_gate_absent');
    assert.equal(rejected.escalation.room_section, 'team-execution');

    // refined: zero absent, but score lands between 50 and 80 (everything asserted).
    const allAsserted = rubric.criteria.map((c) => ({ criterion_id: c.id, status: 'asserted' }));
    const refinedVerdict = grantGrant.scoreApplication(rubric, allAsserted);
    assert.ok(refinedVerdict.score_pct >= 50 && refinedVerdict.score_pct < 80);
    assert.deepEqual(grantGrant.deriveRulingVerb(refinedVerdict, rubric), { verb: 'refined', escalation: null });

    // undecided: a thin verdict, score under 50, eligibility asserted (not absent).
    const eligOnly = rubric.criteria
      .filter((c) => c.category === 'eligibility')
      .map((c) => ({ criterion_id: c.id, status: 'asserted' }));
    const undecidedVerdict = grantGrant.scoreApplication(rubric, eligOnly);
    assert.ok(undecidedVerdict.score_pct < 50);
    assert.deepEqual(grantGrant.deriveRulingVerb(undecidedVerdict, rubric), { verb: 'undecided', escalation: null });

    // garbage in, conservative default out, never a throw.
    assert.deepEqual(grantGrant.deriveRulingVerb(null, null), { verb: 'undecided', escalation: null });
    assert.deepEqual(grantGrant.deriveRulingVerb({}, rubric), { verb: 'undecided', escalation: null });
  });

  await check('buildReviewerDebateOptions wires deriveRulingVerb + buildRoadmap into runDebate-shaped options', () => {
    const rubric = grantGrant.loadRubric('tnufa').rubric;
    const allEvidenced = rubric.criteria.map((c) => ({ criterion_id: c.id, status: 'evidenced' }));
    const verdict = grantGrant.scoreApplication(rubric, allEvidenced);
    const opts = examine.buildReviewerDebateOptions([], 'would this be accepted', rubric, { verdict, sessionId: 's', roomDir: '/tmp/x' });
    assert.equal(opts.rulingVerb, 'supported');
    assert.equal(opts.rulingApproved, true);
    assert.equal(opts.residualTension, null);
    assert.deepEqual(opts.hats, examine.CATEGORY_LIST);
    assert.equal(typeof opts.deriveFn, 'function');
    assert.equal(typeof opts.selfCritiqueFn, 'function');
    assert.equal(typeof opts.onStep, 'function');
    assert.ok(opts.ruling.finding.source.length > 0 && opts.ruling.finding.url.length > 0, 'a real EvidenceClaim-shaped finding, never a bare string');

    // The rejected path wires a real REJECTED_BECAUSE-bound residualTension.
    const eligOtherId = rubric.criteria.find((c) => c.category === 'eligibility' && c.id !== 'eligibility_applicant').id;
    const oneAbsent = rubric.criteria
      .filter((c) => c.id !== eligOtherId)
      .map((c) => ({ criterion_id: c.id, status: 'evidenced' }));
    const rejectedVerdict = grantGrant.scoreApplication(rubric, oneAbsent);
    const rejectedOpts = examine.buildReviewerDebateOptions([], 'h', rubric, { verdict: rejectedVerdict });
    assert.equal(rejectedOpts.rulingApproved, false);
    assert.ok(rejectedOpts.residualTension, 'an escalation produces a residualTension payload');
    assert.equal(rejectedOpts.residualTension.rejected, true);
  });

  // ---------------------------------------------------------------------------
  // REAL round-trip: batched fan-out cells feed a REAL runDebate/runDerivation
  // pass over a real room.db, no mocking the graph (the design's own flagged
  // open risk -- does a batching-induced silent gap survive contact with the
  // real pipeline?). This is the acceptance-floor check for this quick task.
  // ---------------------------------------------------------------------------
  await check('a full reviewer-panel pass (batched fan-out -> findings -> verdict -> runDebate) writes real graph data for the supported path', async () => {
    const rubric = grantGrant.loadRubric('tnufa').rubric;
    const findingsByCategory = findingsCoveringAllCategories(rubric);
    const fanout = await examine.runReviewerFanout(rubric, { findingsByCategory }, {});
    assert.equal(fanout.ok, true);
    assert.equal(fanout.cells.length, 7, 'nothing dropped when every category carries real evidence');

    const findings = examine.reviewerCellsToFindings(fanout.cells, rubric);
    const verdict = grantGrant.scoreApplication(rubric, findings);
    assert.equal(verdict.score_pct, 100, 'every criterion evidenced');

    const roomDir = freshRoomDir();
    const db = openRoomDb(roomDir);
    try {
      const debateOpts = examine.buildReviewerDebateOptions(fanout.cells, 'would this application be accepted', rubric, {
        verdict, roomDir, db, sessionId: 'test-examine-supported',
      });
      const res = debate.runDebate(debateOpts);
      assert.equal(res.synthesis.ruling_verb, 'supported');
      assert.equal(res.synthesis.cell_count, 7);
      assert.equal(res.ruling.ok, true, 'the ruling wired a real EvidenceClaim + INFORMS edge');
      assert.equal(res.derivation.proposedNodes.length, 7, 'one derived CONVERGES claim per category, batching lost nothing');

      const claimCount = db.prepare("SELECT COUNT(*) n FROM nodes WHERE type = 'EvidenceClaim'").get().n;
      assert.ok(claimCount >= 1, 'a real EvidenceClaim node landed in room.db');
      const informsCount = db.prepare("SELECT COUNT(*) n FROM edges WHERE type = 'INFORMS'").get().n;
      assert.ok(informsCount >= 1, 'a real INFORMS edge landed in room.db');
    } finally {
      closeRoomDb(db);
      fs.rmSync(roomDir, { recursive: true, force: true });
    }
  });

  await check('the rejected path (eligibility absent) writes a real REJECTED_BECAUSE edge, never silently averaged away', async () => {
    const rubric = grantGrant.loadRubric('tnufa').rubric;
    const failingId = 'eligibility_applicant';
    const findingsByCategory = findingsCoveringAllCategories(rubric);
    findingsByCategory.eligibility = findingsByCategory.eligibility.filter((f) => f.criterion_id !== failingId);

    const fanout = await examine.runReviewerFanout(rubric, { findingsByCategory }, {});
    const findings = examine.reviewerCellsToFindings(fanout.cells, rubric);
    const verdict = grantGrant.scoreApplication(rubric, findings);
    assert.ok(verdict.score_pct > 50, 'a strong aggregate score despite the one missing eligibility criterion');

    const roomDir = freshRoomDir();
    const db = openRoomDb(roomDir);
    try {
      const debateOpts = examine.buildReviewerDebateOptions(fanout.cells, 'h', rubric, {
        verdict, roomDir, db, sessionId: 'test-examine-rejected',
      });
      const res = debate.runDebate(debateOpts);
      assert.equal(res.synthesis.ruling_verb, 'rejected', 'the hard gate overrides a strong aggregate score');
      assert.equal(res.ruling.ok, true);
      assert.equal(res.ruling.reason, 'eligibility_hard_gate_absent');

      const rejectedEdges = db.prepare("SELECT COUNT(*) n FROM edges WHERE type = 'REJECTED_BECAUSE'").get().n;
      assert.ok(rejectedEdges >= 1, 'a real REJECTED_BECAUSE edge landed -- the disagreement is graph data, not an average');
    } finally {
      closeRoomDb(db);
      fs.rmSync(roomDir, { recursive: true, force: true });
    }
  });

  console.log(pass + '/' + total + ' checks passed');
  if (pass !== total) {
    process.exitCode = 1;
  }
}

main().catch((e) => { console.error(e && e.stack ? e.stack : e); process.exit(1); });
