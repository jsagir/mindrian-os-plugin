#!/usr/bin/env node
/**
 * Phase 353 Plan 03 Task 4: the Claude-judge baseline and the agreement
 * metric (criterion 6).
 *
 * Gates RULE-25.
 *
 * The metric is EXACT AGREEMENT (see evals/icm/README.md): the fraction of
 * graded jev items whose runner verdict equals the once-authored baseline
 * verdict for that same item. Spearman is explicitly not used -- the
 * checklist verdicts are categorical (pass/fail), never ranked.
 *
 * With no TYPESAFE_API_KEY, this leg SKIPs loudly (criterion 6 is
 * unmeasured this run) and still exits 0 -- the skip is never mistaken for
 * a pass, and never for a measured 1.0 or 0.
 *
 * House rule: hyphens only, no em-dashes.
 */

'use strict';

let fetchCalls = 0;
global.fetch = function () { fetchCalls += 1; throw new Error('no network in this test'); };

const fs = require('node:fs');
const path = require('node:path');

const REPO = path.join(__dirname, '..');
const RUNNER_PATH = path.join(REPO, 'scripts', 'eval-icm-writers.cjs');
const BASELINE_PATH = path.join(REPO, 'evals', 'icm', 'claude-judge-baseline.json');

if (!fs.existsSync(RUNNER_PATH)) {
  console.error('RED: missing scripts/eval-icm-writers.cjs');
  process.exit(1);
}

let PASS = 0;
let FAIL = 0;
function check(label, cond) {
  if (cond) { PASS += 1; console.log('PASS: ' + label); }
  else { FAIL += 1; console.log('FAIL: ' + label); }
}

const runner = require(RUNNER_PATH);

// --- the baseline file itself: authored once, never rewritten by the runner
const baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));
check('baseline carries authored_at', typeof baseline.authored_at === 'string' && baseline.authored_at.length > 0);
check('baseline carries a non-empty items array', Array.isArray(baseline.items) && baseline.items.length > 0);
check('every baseline item carries a rationale', baseline.items.every((i) => typeof i.rationale === 'string' && i.rationale.length > 0));

const runnerSrc = fs.readFileSync(RUNNER_PATH, 'utf8');
check('the runner never writeFileSyncs the baseline path', !/writeFileSync\([^)]*claude-judge-baseline/.test(runnerSrc));

// --- computeAgreement: the assertion, the loud skip, the never-silently-green property
const perfectMatch = baseline.items.map((i) => ({ checklist: i.checklist, item_id: i.item_id, kind: 'jev', ok: true, verdict: i.verdict }));
const agreementPerfect = runner.computeAgreement(perfectMatch, baseline);
check('perfect agreement over the baseline set computes to 1', agreementPerfect === 1);

const allWrong = baseline.items.map((i) => ({ checklist: i.checklist, item_id: i.item_id, kind: 'jev', ok: false, verdict: i.verdict === 'pass' ? 'fail' : 'pass' }));
const agreementZero = runner.computeAgreement(allWrong, baseline);
check('zero agreement over the baseline set computes to 0', agreementZero === 0);

const noneAnswered = baseline.items.map((i) => ({ checklist: i.checklist, item_id: i.item_id, kind: 'jev', ok: null, verdict: null }));
const agreementSkipped = runner.computeAgreement(noneAnswered, baseline);
check('agreement is null (never 0, never 1.0) when nothing was answered -- the skip path stays distinguishable from a pass or a fail', agreementSkipped === null);

check('agreement >= 0.8 is the asserted threshold, exercised against the perfect-agreement case', agreementPerfect >= 0.8);

// --- the actual key-gated leg: SKIP loudly with no key, never silently green
const key = process.env.TYPESAFE_API_KEY;
if (!key) {
  console.log('SKIP: grader agreement -- no TYPESAFE_API_KEY (criterion 6 unmeasured this run)');
} else {
  console.log('key present: a live grading run is the navigator\'s own act, not run automatically here');
}

(async function testJevWire() {
  const ledgerBuilder = require('../scripts/build-section-command-ledger.cjs');
  const graded = runner.gradeRoom(path.join(REPO, 'tests/fixtures/icm-rooms/alpha-room'));
  const items = graded.items.filter((i) => i.kind === 'jev');
  check('at least four real jev items graded (alpha-room declares job "model-business")', items.length >= 4);
  check('every jev item on alpha-room carries real per-instance wire content, never a static label',
    items.every((i) => i.wire && i.wire.name && i.wire.name !== 'methodology sequence fit'
      && i.wire.name !== 'epistemic type plausibility' && i.wire.name !== 'governing thought summary fit'));
  // 353-03-PLAN.md line 120-121 + evals/icm/checklists/*.md: ruling-writer
  // item-5, claim-filer item-3 and entity-extractor item-2 are each a Jev
  // Score question; minto-refresher item-2 is a Jev Noul question. Never
  // Choice (RCA icm-ruling-eval-agreement-below-floor).
  const EXPECTED_QTYPE = {
    'ruling-writer|item-5-sequence-fits-job': 'score',
    'claim-filer|item-3-epistemic-type-plausible': 'score',
    'entity-extractor|item-2-names-a-concept': 'score',
    'minto-refresher|item-2-summarizes-artifacts': 'noul',
  };
  for (const item of items) {
    const payload = runner.buildJevPayload(item);
    const q = payload.questions[item.item_id];
    const expected = EXPECTED_QTYPE[item.checklist + '|' + item.item_id];
    check(item.item_id + ' uses its checklist-declared question type (' + expected + ')', q.type === expected);
    if (expected === 'score') {
      check(item.item_id + ' score criteria is a 2-level array', Array.isArray(q.criteria) && q.criteria.length === 2
        && typeof q.criteria[0] === 'string' && q.criteria[0].length > 0
        && typeof q.criteria[1] === 'string' && q.criteria[1].length > 0);
    } else if (expected === 'noul') {
      check(item.item_id + ' noul carries no criteria key', !('criteria' in q));
    }
    check(item.item_id + ' judge is bounded', typeof q.instructions.judge === 'string' && q.instructions.judge.length <= 200);
    check(item.item_id + ' passes egress ceiling', ledgerBuilder.assertEgressCeiling(payload) === true);
  }

  const scoreItem = items.find((i) => i.checklist === 'ruling-writer');
  const noulItem = items.find((i) => i.checklist === 'minto-refresher');
  const resolve = async (item, response) => {
    const copy = { ...item };
    await runner.resolveJevItems([copy], {
      keyPresent: true, codeOnly: false, key: 'test-key-not-real',
      jevFn: async () => response,
    });
    return copy;
  };
  const scoreResponse = (score, confidence) => ({ status: 200, json: {
    model: 'jev-1.13.0',
    answers: { [scoreItem.item_id]: { type: 'score', score: score, confidence: confidence,
      probabilities: { 0: 1 - score, 1: score }, legend: { 0: 'fail', 1: 'pass' } } },
    usage: { input_tokens: 500, output_tokens: 40 },
  } });

  const passed = await resolve(scoreItem, scoreResponse(0.92, 0.84));
  check('recorded high-confidence score >= 0.5 yields verdict pass', passed.verdict === 'pass' && passed.ok === true);
  check('recorded score response preserves confidence', passed.confidence === 0.84);
  check('recorded score response preserves vendor model', passed.jev_model === 'jev-1.13.0');

  const failedScore = await resolve(scoreItem, scoreResponse(0.05, 0.9));
  check('recorded high-confidence score < 0.5 yields verdict fail', failedScore.verdict === 'fail' && failedScore.ok === false);

  const lowConfidence = await resolve(scoreItem, scoreResponse(0.51, 0.06));
  check('a score confidence below the 0.5 floor abstains (verdict null, ok null)', lowConfidence.verdict === null && lowConfidence.ok === null);
  check('an abstained item names ABSTAIN in its detail', /ABSTAIN/.test(lowConfidence.detail));
  check('an abstained item is excluded from agreement', runner.computeAgreement([lowConfidence], baseline) === null);

  const noulResponse = (noul) => ({ status: 200, json: {
    model: 'jev-1.13.0',
    answers: { [noulItem.item_id]: { type: 'noul', noul: noul } },
    usage: { input_tokens: 400, output_tokens: 30 },
  } });
  const noulFail = await resolve(noulItem, noulResponse(0.1));
  check('a low noul value yields verdict fail with no confidence (Noul carries none)', noulFail.verdict === 'fail' && noulFail.confidence === null);
  const noulPass = await resolve(noulItem, noulResponse(0.9));
  check('a high noul value yields verdict pass with no confidence floor applied', noulPass.verdict === 'pass' && noulPass.confidence === null);

  const rejected = await resolve(scoreItem, { status: 422, json: { detail: 'unprocessable' } });
  check('recorded 422 remains unanswered', rejected.ok === null && rejected.verdict === null && rejected.confidence === null);
  check('recorded 422 names unrecognized shape and status', /unrecognized shape/.test(rejected.detail) && /422/.test(rejected.detail));
  check('recorded 422 is excluded from agreement', runner.computeAgreement([rejected], baseline) === null);

  const gammaGraded = runner.gradeRoom(path.join(REPO, 'tests/fixtures/icm-rooms/gamma-room'));
  const gammaRulingItem = gammaGraded.items.find((i) => i.checklist === 'ruling-writer' && i.item_id === 'item-5-sequence-fits-job');
  check('gamma-room (no business-model section) skips ruling-writer item-5 as not-applicable, never a guess', gammaRulingItem && gammaRulingItem.wire === null);
  check('the skipped item still names why, so it is visible and never silently dropped', gammaRulingItem && /SKIP/.test(gammaRulingItem.detail) && /model-business/.test(gammaRulingItem.detail));

  check('zero network calls throughout this test', fetchCalls === 0);
  console.log('');
  console.log('PASS=' + PASS + ' FAIL=' + FAIL);
  process.exitCode = FAIL === 0 ? 0 : 1;
}()).catch((e) => { console.error(e); process.exitCode = 1; });
