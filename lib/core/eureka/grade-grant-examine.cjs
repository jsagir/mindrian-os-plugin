'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * grade-grant reviewer-panel examination mode -- lib/core/eureka/grade-grant-examine.cjs
 * =========================================================================================
 * The orchestration composer for /mos:grade-grant's opt-in "Reviewer panel examination"
 * mode: instead of one holistic Larry read, seven adversarial reviewer personas (one per
 * lib/core/eureka/grade-grant.cjs::CATEGORY_VALUES) examine their own category's criteria
 * in isolation via the SHIPPED BONO fan-out (lib/core/bono/cell-fanout.cjs::runCellFanout)
 * and debate (lib/core/bono/debate-composition.cjs::runDebate) substrate, self-critiqued
 * under lib/core/bono/reviewer-governance.cjs's per-category discipline, and their
 * findings flatten back into the EXACT SAME findings[] shape scoreApplication already
 * consumes. Every scoring/graph function grade-grant.cjs already ships
 * (scoreApplication, gapCategories, sectionMap, buildRoadmap, askBrainForCoaching,
 * askBrainForStrategy, writeGradingResult, writeGrantRubricGraph,
 * writeGradingSectionEdges) stays byte-unchanged; this module is a second way to produce
 * the findings[] array, never a duplicate scoring engine (Canon Part 7).
 *
 * Reuse before build (Canon Part 7) -- the fan-out/debate substrate below is CONSUMED
 * as-is, never re-implemented:
 *   - lib/core/bono/cell-fanout.cjs::runCellFanout (the parallel (subdomain x hat) grid
 *     fan-out with a pluggable dispatchCell) -- called TWICE here (batched), never with
 *     its cap raised.
 *   - lib/core/bono/debate-composition.cjs::runDebate / buildSteps / buildArtifactPairs /
 *     cellsForHat / consolidatorForHat (the sequential inter-persona debate) -- driven
 *     with hats: CATEGORY_VALUES (all 7 in ONE debate call; only the fan-out grid needs
 *     batching, the debate step-count carries no such cap).
 *   - lib/core/bono/reviewer-governance.cjs::composeReviewerGovernedSeams (the
 *     per-category scrutiny discipline, the reviewer-panel sibling of
 *     lib/core/bono/hat-governance.cjs::composeGovernedSeams).
 *   - lib/core/eureka/grade-grant.cjs::deriveRulingVerb (the eligibility hard-gate ->
 *     ruling-verb resolver) and ::buildRoadmap (the weakest-section anchor for the
 *     ruling's target_section).
 *
 * THE N2 FIX (the fan-out cost cap, respected not weakened): lib/core/bono/cell-fanout.cjs
 * DEFAULT_CELL_CAP is lib/core/futures/orchestrator.cjs's FUTURES_FANOUT_CAP (5), and
 * resolveFanoutCap HARD-CLAMPS any requested cap to that ceiling -- it is a ceiling, not a
 * default; passing opts.cap:7 still clamps to 5. CATEGORY_VALUES has 7 members. A single
 * runCellFanout call with hats:CATEGORY_VALUES would silently drop 2 of 7 categories every
 * run. runReviewerFanout below is the ONE named, testable chokepoint that fixes this by
 * BATCHING (two runCellFanout calls, 5 + 2 categories, concatenated) rather than by
 * touching cell-fanout.cjs's cap -- the cap is a real cost-governor safety rail
 * (threat T-164-16) and stays untouched.
 *
 * THE PRODUCTION CELL AGENT: mirrors lib/core/bono/persona-research.cjs's architectural
 * boundary. defaultReviewerDispatchCell below stays MECHANICAL by default -- it never
 * reads room/draft prose and never decides evidenced/asserted/absent itself. It either
 * mechanically reshapes ALREADY-EXTRACTED per-criterion findings a caller injects (a real
 * test seam, or the structured return of a live agents/grant-reviewer.md dispatch wired
 * in by the host command), or degrades to a defensive neutral/low-confidence stub when
 * none are supplied. The actual adversarial reading happens in the dispatched
 * agents/grant-reviewer.md Task-tool agent in a live run, never inside this deterministic
 * function.
 *
 * Canon Part 8 (LOCAL -> BRAIN: NO): everything here is LOCAL. No fetch, no http(s), no
 *   Brain wire. Reviewer cells examine ONLY room content or a pasted draft (never an
 *   external web leg -- unlike BONO's own persona-research.cjs, this reviewer's job is
 *   adversarial reading of LOCAL content only, per agents/grant-reviewer.md's
 *   Read/Glob-only tool-access contract).
 * Canon Part 9: every node this composer's callers write lands review_status 'proposed'
 *   (runDebate's own wireAccept/wireReject contract, unmodified). This module itself
 *   writes NOTHING to room.db directly -- it returns data for the host command to file
 *   through the existing navigation.cjs chokepoint, exactly like grade-grant.cjs's own
 *   pure functions.
 *
 * NO em-dashes anywhere in this file (CLAUDE.md HARD RULE).
 */

const cellFanout = require('../bono/cell-fanout.cjs');
const { FUTURES_FANOUT_CAP } = require('../futures/orchestrator.cjs');
const reviewerGovernance = require('../bono/reviewer-governance.cjs');
const grantGrant = require('./grade-grant.cjs');

// The 7-value category axis, frozen array form (Set insertion order preserved --
// eligibility naturally runs first, which is also the methodologically right order).
const CATEGORY_LIST = Object.freeze(Array.from(grantGrant.CATEGORY_VALUES));

function isPlainObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isNonEmptyString(v) {
  return typeof v === 'string' && v.length > 0;
}

// buildReviewerSlots(rubric) -- the assembleTeam neededSlots shape (D7: this pass never
// calls assembleTeam/writeSyntheticExpertNode -- see the design's D7 -- but the slot
// shape is documented here as the natural { hat, subdomain } tuple a future pass could
// feed into lib/core/expert-library.cjs::assembleTeam unmodified, category as the hat
// axis, rubric.id as the subdomain). Always all 7 categories, every run (Decision D1: the
// roster is fixed at all-7-always this pass; no partial-roster mode). Never throws.
function buildReviewerSlots(rubric) {
  if (!isPlainObject(rubric) || !isNonEmptyString(rubric.id)) return [];
  return CATEGORY_LIST.map(function (category) {
    return { hat: category, subdomain: rubric.id };
  });
}

// batchCategories(categories, size) -- pure batching helper (exported for tests to
// confirm the N2 fix independently of a live runCellFanout call). Never returns a batch
// longer than `size`.
function batchCategories(categories, size) {
  const list = Array.isArray(categories) ? categories : [];
  const cap = (Number.isInteger(size) && size > 0) ? size : FUTURES_FANOUT_CAP;
  const batches = [];
  for (let i = 0; i < list.length; i += cap) {
    batches.push(list.slice(i, i + cap));
  }
  return batches;
}

// defaultReviewerDispatchCell(cell, ctx) -- the MECHANICAL reference dispatch (D3/D5/N3:
// no LLM call embedded here; the real adversarial reading happens in a dispatched
// agents/grant-reviewer.md agent in a live run). cell = { subdomain, hat, handle } where
// hat carries the CATEGORY value (cell-fanout's grid loop assigns cell.hat from the
// `hats` array passed to runCellFanout -- reused as-is, so a reviewer cell's `hat` field
// IS its category, never a de Bono color).
//
// ctx.rubric supplies the loaded rubric so the criteria this category actually owns can
// be named even with zero findings supplied. ctx.findingsFn(category, criteria, ctx), or
// the simpler ctx.findingsByCategory[category] map, is the injection point for
// ALREADY-DECIDED per-criterion findings (a test seam, or the real dispatched agent's
// structured return wired in by the host command) -- this function reshapes them into
// the {stance, evidence, confidence} reading cell-fanout's normalizeReading expects
// WITHOUT judging evidenced/asserted/absent itself. Zero findings supplied degrades to a
// defensive neutral/low-confidence stub (mirrors cell-fanout's own defaultDispatchCell
// "found nothing to stand on" branch) -- never crashes, never invents. Never throws.
function defaultReviewerDispatchCell(cell, ctx) {
  const c = isPlainObject(cell) ? cell : {};
  const context = isPlainObject(ctx) ? ctx : {};
  const category = typeof c.hat === 'string' ? c.hat : '';
  const rubric = isPlainObject(context.rubric) ? context.rubric : null;
  const criteria = (rubric && Array.isArray(rubric.criteria))
    ? rubric.criteria.filter(function (crit) { return isPlainObject(crit) && crit.category === category; })
    : [];
  const criteriaIds = criteria.map(function (crit) { return crit.id; });

  let findingsSource = null;
  if (typeof context.findingsFn === 'function') {
    try {
      findingsSource = context.findingsFn(category, criteria, context);
    } catch (_e) {
      findingsSource = null;
    }
  } else if (isPlainObject(context.findingsByCategory)) {
    findingsSource = context.findingsByCategory[category];
  }
  const findings = Array.isArray(findingsSource) ? findingsSource : [];

  if (findings.length === 0) {
    return { stance: 'neutral', evidence: [], confidence: 0.2, criteria_examined: criteriaIds };
  }

  const evidence = [];
  let evidencedCount = 0;
  let absentCount = 0;
  for (const f of findings) {
    if (!isPlainObject(f) || typeof f.criterion_id !== 'string' || f.criterion_id.length === 0) continue;
    const status = grantGrant.FINDING_STATUS_VALUES.has(f.status) ? f.status : 'absent';
    if (status === 'evidenced') evidencedCount += 1;
    if (status === 'absent') absentCount += 1;
    if (status !== 'absent') {
      evidence.push({
        criterion_id: f.criterion_id,
        room_location: typeof f.room_location === 'string' ? f.room_location : '',
        note: typeof f.note === 'string' ? f.note : '',
        disposition: typeof f.disposition === 'string' ? f.disposition : 'confirming',
        reconciled: f.reconciled === true,
        status: status,
      });
    }
  }
  const stance = evidencedCount > 0 ? 'supports' : (absentCount === findings.length ? 'neutral' : 'refines');
  const confidence = Math.min(0.4 + (0.1 * evidencedCount), 0.9);

  return {
    stance: stance,
    evidence: evidence,
    confidence: confidence,
    criteria_examined: criteriaIds,
    findings: findings,
  };
}

// runReviewerFanout(rubric, sourceCtx, opts) -- batches CATEGORY_VALUES into
// <=FUTURES_FANOUT_CAP-sized groups (5 + 2 for the current 7-value axis), calls
// runCellFanout ONCE PER BATCH (never asking cell-fanout.cjs to raise its cap),
// concatenates the collected cells/dropped, sums the plan metadata. This is the ONE
// named, testable N2 chokepoint (module header). Returns
// { ok, cells, dropped, plan:{requested,dispatched,capped,batches}, dispatchPlans }.
// Never throws (a runCellFanout rejection propagates per its own async contract, but
// every internal branch here is defensive).
async function runReviewerFanout(rubric, sourceCtx, opts) {
  if (!isPlainObject(rubric) || !isNonEmptyString(rubric.id)) {
    return { ok: false, reason: 'invalid_rubric' };
  }
  const options = isPlainObject(opts) ? opts : {};
  const ctx = isPlainObject(sourceCtx) ? sourceCtx : {};
  const dispatchCell = (typeof options.dispatchCell === 'function') ? options.dispatchCell : defaultReviewerDispatchCell;
  const batches = batchCategories(CATEGORY_LIST, FUTURES_FANOUT_CAP);

  const cells = [];
  const dropped = [];
  const dispatchPlans = [];
  let requested = 0;
  let dispatched = 0;
  let capped = false;

  for (const batch of batches) {
    // eslint-disable-next-line no-await-in-loop -- batches run sequentially by design:
    // each batch is itself a full PARALLEL runCellFanout call (Promise.all inside);
    // only the batches themselves are sequenced, never the cells within one.
    const result = await cellFanout.runCellFanout({
      subdomains: [rubric.id],
      hats: batch,
      dispatchCell: function (cell, fanoutCtx) {
        return dispatchCell(cell, Object.assign({}, fanoutCtx, ctx, { rubric: rubric }));
      },
      selfCritique: options.selfCritique,
      cap: FUTURES_FANOUT_CAP,
      roomDir: options.roomDir,
      remainingContext: options.remainingContext,
      preferredModel: options.preferredModel,
    });
    for (const cell of result.cells) cells.push(cell);
    for (const d of result.dropped) dropped.push(d);
    requested += result.plan.requested;
    dispatched += result.plan.dispatched;
    capped = capped || result.plan.capped;
    dispatchPlans.push(result.dispatchPlan);
  }

  return {
    ok: true,
    cells: cells,
    dropped: dropped,
    plan: { requested: requested, dispatched: dispatched, capped: capped, batches: batches.length },
    dispatchPlans: dispatchPlans,
  };
}

// reviewerCellsToFindings(cells, rubric) -- the (d) reshape (design section (d)): flatten
// N reviewer cells' evidence arrays back into the EXACT {criterion_id, status, note}[]
// shape scoreApplication already accepts. Because `category` partitions the criteria with
// no overlap (a single-value enum field, never multi-tag), no two reviewers can ever
// produce a finding for the SAME criterion -- so there is no criterion-level averaging
// problem here, and this function does not manufacture one (first write wins is a
// defensive floor, never a real collision in practice). Prefers a cell's richer
// `findings` array (criterion_id + status + note already decided) when present, else
// derives from the flatter `evidence` array (criterion_id-bearing items only). A
// criterion_id not present in `rubric` is dropped defensively (never invents a
// criterion). Pure. Never throws.
function reviewerCellsToFindings(cells, rubric) {
  const list = Array.isArray(cells) ? cells : [];
  const validIds = (isPlainObject(rubric) && Array.isArray(rubric.criteria))
    ? new Set(rubric.criteria.filter(function (c) { return isPlainObject(c) && isNonEmptyString(c.id); })
        .map(function (c) { return c.id; }))
    : null;
  const findings = [];
  const seen = new Set();
  for (const cell of list) {
    if (!isPlainObject(cell)) continue;
    const source = (Array.isArray(cell.findings) && cell.findings.length > 0)
      ? cell.findings
      : (Array.isArray(cell.evidence) ? cell.evidence : []);
    for (const item of source) {
      if (!isPlainObject(item) || !isNonEmptyString(item.criterion_id)) continue;
      const criterionId = item.criterion_id;
      if (validIds && !validIds.has(criterionId)) continue;
      if (seen.has(criterionId)) continue;
      const status = grantGrant.FINDING_STATUS_VALUES.has(item.status) ? item.status : 'evidenced';
      findings.push({
        criterion_id: criterionId,
        status: status,
        note: typeof item.note === 'string' ? item.note : '',
      });
      seen.add(criterionId);
    }
  }
  return findings;
}

// buildReviewerDebateOptions(cells, hypothesis, rubric, opts) -- assembles the
// runDebate(...) call: hats:CATEGORY_VALUES (all 7, one debate; only the fan-out grid
// needed batching), the collected cells as the previousOutput seed,
// composeReviewerGovernedSeams wired in as {deriveFn, selfCritiqueFn, onStep}, and
// deriveRulingVerb's output shaped into runDebate's rulingVerb / ruling / residualTension
// / rulingApproved options (D4: rides runDebate's EXISTING wireAccept/wireReject call,
// unmodified -- no new wiring function). opts.verdict is the scoreApplication verdict
// (required for a real ruling; a caller with no verdict yet gets the conservative
// 'undecided' default deriveRulingVerb itself returns on invalid input). The ruling's
// target_section is buildRoadmap's weakest section (section_plans[0]) -- direct reuse,
// never a new anchor. Pure composition; never throws, never calls runDebate itself (the
// caller owns that call so it can inject its own db/roomDir/session).
function buildReviewerDebateOptions(cells, hypothesis, rubric, opts) {
  const options = isPlainObject(opts) ? opts : {};
  const verdict = isPlainObject(options.verdict) ? options.verdict : null;
  const ruling = deriveRulingVerbSafe(verdict, rubric);
  const roadmap = (verdict && isPlainObject(rubric)) ? grantGrant.buildRoadmap(rubric, verdict) : null;
  const targetSection = (roadmap && roadmap.ok && Array.isArray(roadmap.section_plans) && roadmap.section_plans.length > 0)
    ? roadmap.section_plans[0].room_section
    : 'solution-design';
  const programId = isPlainObject(rubric) && isNonEmptyString(rubric.id) ? rubric.id : 'unknown';

  const seams = reviewerGovernance.composeReviewerGovernedSeams({
    hats: CATEGORY_LIST,
    onStepFn: options.onStepFn,
    deriveCandidateFn: options.deriveCandidateFn,
  });

  const rulingApproved = ruling.verb !== 'rejected';
  // The `finding` sub-object is shaped to findings-wirer.wireAccept's EvidenceClaim
  // contract (source / url / retrieved_at / evidence_tier / summary -- the LOCKED
  // Phase 136 provenance schema, unmodified per D4). There is no external web source
  // for an internal reviewer-panel ruling, so source/url are synthetic LOCAL handles
  // (never a fabricated external citation) and evidence_tier is 'Practitioner' (a
  // structured internal-reviewer judgment, not an academic citation and not 'None').
  const rulingSummary = isNonEmptyString(options.rulingFindingText)
    ? options.rulingFindingText
    : ('Reviewer-panel ruling for ' + programId + ': ' + ruling.verb);
  const rulingFinding = {
    finding: {
      title: 'grade-grant reviewer-panel ruling',
      source: 'grade-grant-reviewer-panel',
      url: 'local:grade-grant-panel:' + programId,
      retrieved_at: new Date().toISOString(),
      evidence_tier: 'Practitioner',
      summary: rulingSummary,
    },
    decision: { target_section: targetSection },
    reason: ruling.escalation ? ruling.escalation.reason : undefined,
    topic: programId,
  };

  const residualTension = ruling.escalation
    ? {
        finding: {
          title: 'grade-grant eligibility hard-gate',
          source: 'grade-grant-reviewer-panel',
          url: 'local:grade-grant-panel:' + programId + ':' + ruling.escalation.criterion_id,
          retrieved_at: new Date().toISOString(),
          evidence_tier: 'Practitioner',
          summary: 'Eligibility hard-gate: ' + ruling.escalation.criterion_id
            + ' is absent, overriding the aggregate score',
        },
        decision: { target_section: ruling.escalation.room_section || targetSection },
        reason: ruling.escalation.reason,
        rejected: true,
        topic: programId,
      }
    : null;

  return {
    cells: Array.isArray(cells) ? cells : [],
    hypothesis: hypothesis,
    hypothesisId: isNonEmptyString(options.hypothesisId) ? options.hypothesisId : ('claim:grant-panel:' + programId),
    hats: CATEGORY_LIST,
    roomDir: options.roomDir,
    expertsByHat: isPlainObject(options.expertsByHat) ? options.expertsByHat : {},
    db: options.db || null,
    sessionId: isNonEmptyString(options.sessionId) ? options.sessionId : 'grade-grant-panel',
    rulingVerb: ruling.verb,
    ruling: rulingFinding,
    residualTension: residualTension,
    rulingApproved: rulingApproved,
    deriveFn: seams.deriveFn,
    selfCritiqueFn: seams.selfCritiqueFn,
    onStep: seams.onStep,
  };
}

// deriveRulingVerbSafe -- a defensive local wrapper so a garbage/missing verdict still
// returns the conservative { verb:'undecided', escalation:null } shape without requiring
// every caller of buildReviewerDebateOptions to pre-validate opts.verdict.
function deriveRulingVerbSafe(verdict, rubric) {
  try {
    return grantGrant.deriveRulingVerb(verdict, rubric) || { verb: 'undecided', escalation: null };
  } catch (_e) {
    return { verb: 'undecided', escalation: null };
  }
}

module.exports = {
  buildReviewerSlots,
  runReviewerFanout,
  defaultReviewerDispatchCell,
  reviewerCellsToFindings,
  buildReviewerDebateOptions,
  batchCategories,
  CATEGORY_LIST,
};
