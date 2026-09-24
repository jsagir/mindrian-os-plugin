#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 355 (Hidden in Plain Sight: Jev-through-Theo cross-connection
 * engines) Plan 18 (HIPS-04, HIPS-05, D-08, D-16, D-18, D-27, D-29, D-30,
 * D-48, D-49, D-56). Stamp coverage, no-decimal and banned-claim proofs for
 * eureka's three renders: the portfolio report (scripts/eureka-portfolio-
 * report.cjs's stampRankedPairs/eurekaEndpoints/renderReport), the HTML
 * export (lib/core/eureka/report-html.cjs's rankedTable), and the F.1
 * qualify card (lib/core/eureka/qualify-opportunity.cjs's formatComponentLines
 * / renderQualificationCard).
 *
 * Every check label in the "eureka stamp" section starts with the literal
 * "eureka stamp "; "eureka report " covers the markdown writer; "eureka
 * html " covers the HTML export; "eureka qualify " covers the F.1 card
 * (355-16/17 grep-by-prefix precedent).
 *
 * Test hygiene contract (every 355 test): scrub TYPESAFE_API_KEY and install
 * the net guard via tests/helpers/hygiene-355.cjs BEFORE requiring any repo
 * module; assert attempts() === 0 as the last check.
 *
 * No em-dashes (CLAUDE.md HARD RULE). Hyphens only.
 */

'use strict';

const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const hygiene = require('./helpers/hygiene-355.cjs');

const hadKey = hygiene.scrubVendorKey();
const netGuard = hygiene.installNetGuard();

const REPO = path.join(__dirname, '..');
const checker = hygiene.makeChecker('test-355-producer-eureka');
const { check } = checker;

const runner = require(path.join(REPO, 'scripts', 'eureka-portfolio-report.cjs'));
const reportHtml = require(path.join(REPO, 'lib', 'core', 'eureka', 'report-html.cjs'));
const qualifyOpportunity = require(path.join(REPO, 'lib', 'core', 'eureka', 'qualify-opportunity.cjs'));
const verificationStamp = require(path.join(REPO, 'lib', 'core', 'verification-stamp.cjs'));
const verificationStampFormat = require(path.join(REPO, 'lib', 'core', 'verification-stamp-format.cjs'));
const floorDisclosure = require(path.join(REPO, 'lib', 'core', 'floor-disclosure.cjs'));
const { makeReplayCallTool, makeNullCallTool } = require(path.join(REPO, 'tests', 'helpers', 'theo-replay-355.cjs'));

const stubFixture = JSON.parse(fs.readFileSync(path.join(REPO, 'tests', 'fixtures', '355', 'theo-stub-responses.json'), 'utf8'));
const eurekaFixture = JSON.parse(fs.readFileSync(path.join(REPO, 'tests', 'fixtures', '355', 'producers', 'eureka-report.json'), 'utf8'));

const BANNED_CLAIMS = /\b(breakthrough|convergent|validated|proven)\b/i;

function countStampBlocks(text) {
  const lines = text.split('\n');
  return lines.filter((l) => /^(✓|•|⚠) (strong|indirect|unverified)/.test(l)).length;
}

function stripTags(html) {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
}

// A fresh deep-cloned copy of the fixture's embedded.ranked array, so each
// leg (replay vs null callTool) stamps its OWN rows and never leaks a stamp
// from a prior leg (stampRankedPairs mutates its input array in place).
function cloneRanked() {
  return JSON.parse(JSON.stringify(eurekaFixture.embedded.ranked));
}

const minimalProvenanceEmbedded = {
  run_mode: 'live',
  pairs_mode: 'graph',
  encoder_model: 'fixture-stub',
  encoder_dtype: 'stub',
  vec_backend: 'fixture',
  ahp_weights: { strategic_fit: 0.5, validated_demand: 0.3, tech_econ_feasibility: 0.2 },
  ahp_cr: 0.0,
  ahp_matrix_source: 'fixture',
  tail_composition: 'fixture',
  growth_proxy: 'fixture',
  tail_thresholds: { attnCut: 0.5, growthCut: 0.5 },
  tail_insufficient_structure: true,
  tail_suspect_noise: false,
  graph_nodes: 6,
  converges_pairs: 6,
  cohort_techs: 6,
  pairs_scored: 6,
  scaffold_pairs_excluded: 0,
  container_pairs_excluded: 0,
  low_trust_pairs_excluded: 0,
  figure_guard_skipped: 0,
  critic_resolution: 'fixture',
  honest_nouns: 'a fixture report, not a real room',
  run_date: '2026-09-24',
  encoder_unavailable: false,
  degrade_cause: null,
};

function makeMdCtx(ranked) {
  return {
    provenance: minimalProvenanceEmbedded,
    roomDir: 'fixture-room',
    graphRel: 'fixture-graph.json',
    offline: true,
    top: ranked.length,
    ranked: ranked,
    tailIds: new Set(eurekaFixture.embedded.tailIds),
    tail: { insufficient_structure: true, suspect_noise: false, tail: [] },
    tailPairs: [],
    statements: [],
    techFor: () => ({ title: 'unused' }),
  };
}

// ---------------------------------------------------------------------------
// eureka stamp -- eurekaEndpoints + stampRankedPairs (unit level)
// ---------------------------------------------------------------------------

async function runStampSection() {
  // D-48 local resolution: a canon title resolves via 'title'; a non-canon
  // title degrades honestly to a null handle (not_called), never a fuzzy
  // guess and never a Theo call for that side.
  {
    const ep = runner.eurekaEndpoints({ idA: 'a', idB: 'b', techA: { title: 'Design Thinking' }, techB: { title: 'Jobs to Be Done (JTBD)' } }, {});
    check('eureka stamp eurekaEndpoints: canon titles resolve via title', ep.fromHandle === 'Design Thinking' && ep.toHandle === 'Jobs to Be Done (JTBD)' && ep.fromVia === 'title' && ep.toVia === 'title');
  }
  {
    const ep = runner.eurekaEndpoints({ idA: 'a', idB: 'b', techA: { title: 'Bespoke Venture Concept Alpha' }, techB: { title: 'Bespoke Venture Concept Beta' } }, {});
    check('eureka stamp eurekaEndpoints: non-canon titles resolve to null handles (D-10, honest miss)', ep.fromHandle === null && ep.toHandle === null && ep.fromVia === null && ep.toVia === null);
  }
  // Missing ctx (no db/indexed/roomDir) degrades gracefully to title-only
  // resolution rather than throwing -- eurekaEndpoints(pair, {}) never
  // requires a live room.db.
  {
    let threw = false;
    try {
      runner.eurekaEndpoints({ idA: 'a', idB: 'b', techA: { title: 'Systems Thinking' }, techB: { title: 'Hierarchy Mapping' } }, {});
    } catch (_e) {
      threw = true;
    }
    check('eureka stamp eurekaEndpoints: never throws with an empty ctx', threw === false);
  }

  // stampRankedPairs (Theo up / replay): every ranked row carries a
  // Stamp-parseable stamp (rows == stamps); T-355-85 -- the opaque idA/idB
  // handles never cross the wire, only the resolved canon title pair does.
  {
    const ranked = cloneRanked();
    const callTool = makeReplayCallTool(stubFixture);
    const stamps = await runner.stampRankedPairs(ranked, {}, { callTool });
    check('eureka stamp stampRankedPairs (replay): returns one stamp per ranked row', stamps.length === ranked.length);
    let reparseFailures = 0;
    for (const s of stamps) {
      const safe = verificationStamp.Stamp.safeParse(s);
      if (!safe.success) reparseFailures += 1;
    }
    check('eureka stamp stampRankedPairs (replay): every stamp is Stamp-parseable', reparseFailures === 0, reparseFailures + ' failures');
    check('eureka stamp stampRankedPairs (replay): every ranked row is mutated with .stamp in place', ranked.every((r) => r.stamp !== undefined));
    const strongOrIndirect = ranked.filter((r) => r.stamp.verification === 'strong' || r.stamp.verification === 'indirect');
    check('eureka stamp stampRankedPairs (replay): the 4 canon-title pairs verify strong/indirect', strongOrIndirect.length === 4, 'got ' + strongOrIndirect.length);
    const unresolved = ranked.filter((r) => r.stamp.backend === 'not_called');
    check('eureka stamp stampRankedPairs (replay): the 2 non-canon pairs stamp not_called, zero Theo calls for them', unresolved.length === 2, 'got ' + unresolved.length);
    check('eureka stamp stampRankedPairs (replay): Theo attempted exactly for the 4 resolvable pairs (Part 8, T-355-85)', callTool.calls.length === 4, 'got ' + callTool.calls.length);
    const bag = JSON.stringify(callTool.calls);
    check('eureka stamp stampRankedPairs (replay): no idA/idB opaque handle crosses the wire', bag.indexOf('cand-a') === -1 && bag.indexOf('cand-b') === -1);
    // direction: each stamped row's direction matches its own rs.direction.
    const directionMismatch = ranked.filter((r) => r.stamp.direction !== r.rs.direction);
    check('eureka stamp stampRankedPairs (replay): every stamp direction matches the pair\'s own rs.direction (D-48/D-49)', directionMismatch.length === 0, directionMismatch.length + ' mismatches');
  }

  // stampRankedPairs (Theo down / null): still attaches an honest unverified
  // stamp to every row, zero throws, zero dropped findings.
  {
    const ranked = cloneRanked();
    const callTool = makeNullCallTool();
    const stamps = await runner.stampRankedPairs(ranked, {}, { callTool });
    check('eureka stamp stampRankedPairs (null): returns one stamp per ranked row', stamps.length === ranked.length);
    check('eureka stamp stampRankedPairs (null): every stamp is unverified (Theo down)', stamps.every((s) => s.verification === 'unverified'));
    const reasons = new Set(stamps.map((s) => s.reason));
    check('eureka stamp stampRankedPairs (null): reachable pairs stamp backend_unavailable, unreachable ones stamp handle_unresolved', reasons.has('backend_unavailable') && reasons.has('handle_unresolved'));
  }

  // Direction-with-no-match (D-49): an rs.direction outside the closed
  // DIRECTIONS enum falls back to 'none' rather than forwarding garbage.
  {
    const ranked = [{ idA: 'x', idB: 'y', techA: { title: 'Bespoke Venture Concept Alpha' }, techB: { title: 'Bespoke Venture Concept Beta' }, rs: { direction: 'not_a_real_direction' } }];
    const stamps = await runner.stampRankedPairs(ranked, {}, { callTool: makeNullCallTool() });
    check('eureka stamp stampRankedPairs: an out-of-enum rs.direction falls back to NONE, never forwards garbage', stamps[0].direction === 'none');
  }

  // D-56 static source-order proof: stampRankedPairs is called before
  // bankStatements inside main().
  {
    const src = fs.readFileSync(path.join(REPO, 'scripts', 'eureka-portfolio-report.cjs'), 'utf8');
    const stampIdx = src.indexOf('stampRankedPairs(ranked,');
    const bankIdx = src.indexOf('bankStatements(db, BANK_SESSION_ID, statements)');
    check('eureka stamp eureka-portfolio-report.cjs: stampRankedPairs is called before bankStatements (D-56)', stampIdx !== -1 && bankIdx !== -1 && stampIdx < bankIdx, 'stampIdx=' + stampIdx + ' bankIdx=' + bankIdx);
  }
}

// ---------------------------------------------------------------------------
// eureka report -- the Markdown writer (exported renderReport)
// ---------------------------------------------------------------------------

async function runReportSection() {
  const rankedReplay = cloneRanked();
  await runner.stampRankedPairs(rankedReplay, {}, { callTool: makeReplayCallTool(stubFixture) });
  const mdReplay = runner.renderReport(makeMdCtx(rankedReplay));
  const rankedSectionReplay = mdReplay.split('## Ranked top')[1].split('## Tail quadrant')[0];

  check('eureka report (replay): one stamp block per ranked row', countStampBlocks(rankedSectionReplay) === rankedReplay.length, 'got ' + countStampBlocks(rankedSectionReplay));
  check('eureka report (replay): disclosureLine(\'eureka\') appears exactly once', rankedSectionReplay.split(floorDisclosure.disclosureLine('eureka')).length - 1 === 1);
  check('eureka report: the Score column is gone (no "| score |" style header, no bare AHP composite render)', !/\|\s*score\s*\|/i.test(rankedSectionReplay));
  check('eureka report (replay): weak dims / tail / mode fields render per row', /weak dims: .* {2}\| {2}tail: .* {2}\| {2}mode: embedded/.test(rankedSectionReplay));
  check('eureka report (replay): no banned claim word (breakthrough/convergent/validated/proven)', !BANNED_CLAIMS.test(rankedSectionReplay));

  // D-30 negative control: the planted "0.87" inside a title must be
  // withheld by the assertNoScalar backstop, proving the sweep actually
  // catches a violation rather than passing vacuously because nothing ever
  // trips it.
  check('eureka report (replay): the planted 0.87 title-decimal is withheld ([withheld] present, "0.87" absent)', rankedSectionReplay.indexOf('0.87') === -1 && rankedSectionReplay.indexOf('[withheld]') !== -1);
  // A general decimal/percent sweep over the WHOLE ranked section (the same
  // regexes assertNoScalar itself uses) as an independent proof, not just
  // trusting the render's own internal call to the backstop.
  const scalarSweep = verificationStampFormat.assertNoScalar(rankedSectionReplay.split('\n'));
  check('eureka report (replay): an independent assertNoScalar pass over the rendered section finds nothing left to withhold', scalarSweep.withheld === 0, scalarSweep.withheld + ' would be withheld');

  // Theo down (null): still one honest block per row, still no decimal.
  const rankedNull = cloneRanked();
  await runner.stampRankedPairs(rankedNull, {}, { callTool: makeNullCallTool() });
  const mdNull = runner.renderReport(makeMdCtx(rankedNull));
  const rankedSectionNull = mdNull.split('## Ranked top')[1].split('## Tail quadrant')[0];
  check('eureka report (null): one stamp block per ranked row', countStampBlocks(rankedSectionNull) === rankedNull.length, 'got ' + countStampBlocks(rankedSectionNull));
  check('eureka report (null): the unverified advice line is present', rankedSectionNull.indexOf(verificationStampFormat.UNVERIFIED_ADVICE) !== -1);
  check('eureka report (null): no decimal/percent survives (0.87 still withheld)', rankedSectionNull.indexOf('0.87') === -1);

  // Unstamped run (no --stamp; every row's .stamp stays undefined): honest
  // "not verified" line, never a decimal, never a fabricated stamp.
  const rankedUnstamped = cloneRanked();
  const mdUnstamped = runner.renderReport(makeMdCtx(rankedUnstamped));
  const rankedSectionUnstamped = mdUnstamped.split('## Ranked top')[1].split('## Tail quadrant')[0];
  check('eureka report (unstamped): every row honestly says "not verified this run" instead of a stamp block', (rankedSectionUnstamped.match(/not verified this run/g) || []).length === rankedUnstamped.length);
  check('eureka report (unstamped): zero stamp blocks (no fabricated verification)', countStampBlocks(rankedSectionUnstamped) === 0);

  // Reasoning-mode render: no lsa_similarity column, no differential/semantic
  // column, no decimal of any kind.
  const reasoningRanked = eurekaFixture.reasoning.ranked;
  const mdReasoning = runner.renderReasoningReport({
    provenance: { run_mode: 'reasoning', degrade_cause: 'encoder_unavailable', formula_version: 'fixture', entries_read: 2, pairs_considered: 2, pairs_sent: 2, reasoning_cap: 10, pairs_rejected_by_rubric: { pseudoscience: 0, restatement: 0, general_shallow: 1 }, banking: 'skipped (reasoning mode)', run_date: '2026-09-24' },
    ranked: reasoningRanked,
    statements: [],
    top: reasoningRanked.length,
  });
  check('eureka report (reasoning): renders without throwing (D6 never-merge guard passes on an all-reasoning ranked array)', typeof mdReasoning === 'string' && mdReasoning.length > 0);
  check('eureka report (reasoning): no lsa_similarity cell anywhere in the render', mdReasoning.indexOf('lsa_similarity') === -1);
  check('eureka report (reasoning): no bare decimal token in the ranked table region', verificationStampFormat.assertNoScalar(mdReasoning.split('## Ranked top')[1].split('## Statements')[0].split('\n')).withheld === 0);
}

// ---------------------------------------------------------------------------
// eureka html -- lib/core/eureka/report-html.cjs's rankedTable
// ---------------------------------------------------------------------------

async function runHtmlSection() {
  const rankedReplay = cloneRanked();
  await runner.stampRankedPairs(rankedReplay, {}, { callTool: makeReplayCallTool(stubFixture) });
  const jsonRankedEmbedded = rankedReplay.map((r) => ({
    rank: r.rank, a: r.idA, b: r.idB, a_title: r.techA.title, b_title: r.techB.title,
    mode: 'embedded', banked: r.banked === true, stamp: r.stamp,
  }));
  const htmlEmbedded = reportHtml.renderReportHtml({
    provenance: Object.assign({}, minimalProvenanceEmbedded),
    ranked: jsonRankedEmbedded,
    statements: [],
  });
  const textEmbedded = stripTags(htmlEmbedded);
  // Scope the D-30 sweep to the RANKED TABLE region only -- the provenance
  // table legitimately carries AHP/tail decimals out of this plan's scope
  // (D-29's own ranked-table-only claim), so sweeping the whole document
  // would over-assert.
  const rankedTableHtml = htmlEmbedded.split('<h2>Ranked')[1].split('<h2>Opportunity Statements')[0];
  const rankedTableText = stripTags(rankedTableHtml);

  check('eureka html (embedded): renders one <table> ranked row per pair', (htmlEmbedded.match(/<tr><td>\d+<\/td>/g) || []).length === jsonRankedEmbedded.length);
  check('eureka html (embedded): the verified rows show their tier word (strong/indirect) and path text', /strong: /.test(textEmbedded) || /indirect: /.test(textEmbedded));
  check('eureka html (embedded): the unverified rows show "unverified: " plus the honest reason word', /unverified: /.test(textEmbedded));
  check('eureka html (embedded): no Score column header remains', !/<th>Score<\/th>/.test(htmlEmbedded));
  const scalarSweepHtml = verificationStampFormat.assertNoScalar([rankedTableText]);
  check('eureka html (embedded): no decimal/percent token survives in the stripped ranked-table text', scalarSweepHtml.withheld === 0, scalarSweepHtml.withheld + ' would be withheld');
  check('eureka html (embedded): no banned claim word', !BANNED_CLAIMS.test(textEmbedded));

  // Reasoning-mode HTML: no lsa_similarity cell.
  const jsonRankedReasoning = eurekaFixture.reasoning.ranked.map((r) => ({ rank: r.rank, a: r.a, b: r.b, a_title: r.a_title, b_title: r.b_title, verdict: r.verdict, mode: 'reasoning' }));
  const htmlReasoning = reportHtml.renderReportHtml({
    provenance: { run_mode: 'reasoning', degrade_cause: 'encoder_unavailable' },
    ranked: jsonRankedReasoning,
    statements: [],
  });
  check('eureka html (reasoning): renders no lsa_similarity cell anywhere', htmlReasoning.indexOf('lsa_similarity') === -1);
  check('eureka html (reasoning): renders no differential_score/semantic_similarity cell in the ranked table', !/<th>differential_score<\/th>|<th>semantic_similarity<\/th>/i.test(htmlReasoning));
}

// ---------------------------------------------------------------------------
// eureka qualify -- lib/core/eureka/qualify-opportunity.cjs's F.1 card
// (Task 2: componentValue -> 'measured', formatComponentLines(stamp), the
// F.1 render path's stored-stamp pass-through)
// ---------------------------------------------------------------------------

async function runQualifySection() {
  const componentsFixture = {
    critic_gate: 'pass',
    compression_score: 0.62,
    portfolio_score: { strategic_fit: 0.5, validated_demand: 0.4, feasibility: 0.7 },
    tail_flag: true,
    evidence_readiness: 'unknown',
    follow_through_readiness: false,
  };

  // componentValue (via formatComponentLines): a finite number renders
  // 'measured', never the raw digits; typed unknown and booleans unchanged.
  {
    const lines = qualifyOpportunity.formatComponentLines(componentsFixture, null);
    const joined = lines.join('\n');
    check('eureka qualify componentValue: a finite number renders as "measured", never a raw decimal (D-29, Canon Part 12)', /compression:\s*measured/.test(joined) && joined.indexOf('0.62') === -1);
    check('eureka qualify componentValue: a typed unknown still renders verbatim', joined.indexOf('unknown') !== -1);
    check('eureka qualify componentValue: a boolean still renders yes/no, not "measured"', /tail flag:\s*yes/.test(joined));
    check('eureka qualify componentValue: false renders "no", not "measured" or 0', /follow-through readiness:\s*no/.test(joined));
  }

  // formatComponentLines(components, harvestIndex, stamp): the stamp block
  // is prepended as the FIRST why lines when a real Stamp is supplied.
  {
    const callTool = makeReplayCallTool(stubFixture);
    const stamp = await verificationStamp.stampFinding({ fromHandle: 'Design Thinking', toHandle: 'Jobs to Be Done (JTBD)', direction: 'structural_transfer' }, { callTool });
    const withStamp = qualifyOpportunity.formatComponentLines(componentsFixture, null, stamp);
    const withoutStamp = qualifyOpportunity.formatComponentLines(componentsFixture, null);
    check('eureka qualify formatComponentLines(stamp): the stamp block is prepended as the first lines', withStamp.length === withoutStamp.length + verificationStampFormat.formatStampLines(stamp, 'cli').length);
    check('eureka qualify formatComponentLines(stamp): the stamp\'s tier glyph line is literally the first line', withStamp[0] === verificationStampFormat.formatStampLines(stamp, 'cli')[0]);
    check('eureka qualify formatComponentLines(stamp): no decimal/percent token anywhere in the combined lines', verificationStampFormat.assertNoScalar(withStamp).withheld === 0);
  }

  // formatComponentLines defensively degrades on a malformed stamp (never throws).
  {
    let threw = false;
    let lines = null;
    try {
      lines = qualifyOpportunity.formatComponentLines(componentsFixture, null, { not: 'a real stamp' });
    } catch (_e) {
      threw = true;
    }
    check('eureka qualify formatComponentLines: a malformed stamp degrades gracefully, never throws', threw === false && Array.isArray(lines));
  }

  // The F.1 card render: a candidate carrying a stored stamp (the
  // toNodeProps-shaped props a stamped opportunity node would carry,
  // re-parsed via fromNodeProps) renders the stamp block in zones.body, no
  // decimal anywhere. A candidate with no stamp also renders no decimal.
  {
    const callTool = makeReplayCallTool(stubFixture);
    const stamp = await verificationStamp.stampFinding({ fromHandle: 'Systems Thinking', toHandle: 'Hierarchy Mapping', direction: 'structural_transfer' }, { callTool });
    const stampProps = verificationStamp.toNodeProps(stamp);
    const gateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-355-18-qualify-'));
    const gateFile = path.join(gateDir, 'card-fire-reached.json');

    const candidateWithStamp = {
      candidate_id: 'cand-eureka-355-18',
      name: 'Systems Thinking x Hierarchy Mapping bridge',
      score: 0.71,
      rubric: { q1: 1, q2: 1, q3: 1, q4: 1, q5: 1, q6: 1, q7: 1, q8: 1 },
      components: componentsFixture,
      harvest_index: { version: 'HarvestIndex_v1', status: 'EXPERIMENTAL', value: 0.5 },
      stamp: stampProps,
    };
    const rWith = qualifyOpportunity.renderQualificationCard(candidateWithStamp, null, { gateFilePath: gateFile });
    check('eureka qualify renderQualificationCard: ok on a candidate carrying a stamp', rWith.ok === true, JSON.stringify(rWith.reason));
    const bodyWith = (rWith.rendered && rWith.rendered.zones && rWith.rendered.zones.body) || '';
    check('eureka qualify renderQualificationCard (with stamp): zones.body carries the stamp block', countStampBlocks(bodyWith) >= 1, 'blocks=' + countStampBlocks(bodyWith));
    check('eureka qualify renderQualificationCard (with stamp): zones.body carries no D-30 decimal', verificationStampFormat.assertNoScalar(bodyWith.split('\n')).withheld === 0);

    const candidateNoStamp = Object.assign({}, candidateWithStamp, { candidate_id: 'cand-eureka-355-18-nostamp' });
    delete candidateNoStamp.stamp;
    const rWithout = qualifyOpportunity.renderQualificationCard(candidateNoStamp, null, { gateFilePath: gateFile });
    check('eureka qualify renderQualificationCard: ok on a candidate with no stamp', rWithout.ok === true, JSON.stringify(rWithout.reason));
    const bodyWithout = (rWithout.rendered && rWithout.rendered.zones && rWithout.rendered.zones.body) || '';
    check('eureka qualify renderQualificationCard (no stamp): zones.body carries no stamp block', countStampBlocks(bodyWithout) === 0);
    check('eureka qualify renderQualificationCard (no stamp): zones.body still carries no D-30 decimal (components render as "measured")', verificationStampFormat.assertNoScalar(bodyWithout.split('\n')).withheld === 0);

    try { fs.rmSync(gateDir, { recursive: true, force: true }); } catch (_e) { /* best-effort */ }
  }
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

(async () => {
  try {
    await runStampSection();
    await runReportSection();
    await runHtmlSection();
    await runQualifySection();
  } finally {
    check('installNetGuard: zero fetch attempts', netGuard.attempts() === 0);
    netGuard.restore();
    console.log('scrubVendorKey found a pre-set TYPESAFE_API_KEY: ' + hadKey);
    process.exit(checker.summary());
  }
})();
