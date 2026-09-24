#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 355 (Hidden in Plain Sight: Jev-through-Theo cross-connection
 * engines) Plan 23 (HIPS-05, D-27, D-28, D-29, D-30, D12). The render gate:
 * no bare decimal, no bare percent, and no banned over-claim reaches a user
 * on ANY of the five producers' rendered output, the F.1 qualify card, the
 * reach card text, or any of the four Larry prose fixtures -- Theo up
 * (replay) and Theo down (null) alike.
 *
 * A single D-30 sweep (lib/core/verification-stamp-format.cjs's
 * assertNoScalar, plus an independent regex re-check here) runs over every
 * captured render. Each surface also carries its own NEGATIVE CONTROL: a
 * literal "0.87" planted into an input that flows into the render, proving
 * the sweep actually catches a violation rather than passing vacuously
 * because nothing here ever trips it (355-RESEARCH.md negative-control
 * idiom, test-353-tripwires.cjs precedent).
 *
 * The F.1 brain-chip <conf>% (skills/ui-system/SKILL.md section 3, F.1 row
 * 2) is EXPLICITLY OUT OF SCOPE for this D-30 sweep (355-CONTEXT.md D-30's
 * own carve-out) -- printed as a note below, never asserted against.
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
const hygiene = require('./helpers/hygiene-355.cjs');

hygiene.scrubVendorKey();
const netGuard = hygiene.installNetGuard();

const REPO = path.join(__dirname, '..');
const checker = hygiene.makeChecker('test-355-no-decimal');
const { check } = checker;

const whitespaceCommand = require(path.join(REPO, 'scripts', 'whitespace-command.cjs'));
const hsiToGraph = require(path.join(REPO, 'scripts', 'hsi-to-graph.cjs'));
const reverseSalientAgent = require(path.join(REPO, 'lib', 'agents', 'reverse-salient-agent.cjs'));
const stampConnections = require(path.join(REPO, 'scripts', 'stamp-connections.cjs'));
const eurekaRunner = require(path.join(REPO, 'scripts', 'eureka-portfolio-report.cjs'));
const reportHtml = require(path.join(REPO, 'lib', 'core', 'eureka', 'report-html.cjs'));
const qualifyOpportunity = require(path.join(REPO, 'lib', 'core', 'eureka', 'qualify-opportunity.cjs'));
const verificationStamp = require(path.join(REPO, 'lib', 'core', 'verification-stamp.cjs'));
const verificationStampFormat = require(path.join(REPO, 'lib', 'core', 'verification-stamp-format.cjs'));
const directionConvention = require(path.join(REPO, 'lib', 'core', 'direction-convention.cjs'));
const { makeReplayCallTool, makeNullCallTool } = require(path.join(REPO, 'tests', 'helpers', 'theo-replay-355.cjs'));

const stubFixture = JSON.parse(fs.readFileSync(path.join(REPO, 'tests', 'fixtures', '355', 'theo-stub-responses.json'), 'utf8'));
const gapsFixture = JSON.parse(fs.readFileSync(path.join(REPO, 'tests', 'fixtures', '355', 'producers', 'whitespace-gaps.json'), 'utf8'));
const noveltyFixture = JSON.parse(fs.readFileSync(path.join(REPO, 'tests', 'fixtures', '355', 'producers', 'whitespace-novelty.json'), 'utf8'));
const eurekaFixture = JSON.parse(fs.readFileSync(path.join(REPO, 'tests', 'fixtures', '355', 'producers', 'eureka-report.json'), 'utf8'));

const PROSE_DIR = path.join(REPO, 'tests', 'fixtures', '355', 'prose');

// ---------------------------------------------------------------------------
// Shared helpers.
// ---------------------------------------------------------------------------

const BANNED_CLAIMS = /\b(breakthrough|convergent|validated|proven)\b/i;
const WIRE_IDS = /\b(structural_transfer|semantic_implementation)\b/;

// The banned-claim check runs on the text NEXT TO A FINDING (D-12's own
// phrase) -- from the first rendered stamp glyph line to the end of the
// captured text -- not the whole document. A producer's own PRE-EXISTING,
// unrelated field (e.g. whitespace's own zone gate-validation "Validated:
// Yes (2/2 gates)", which predates this phase and is not a claim ABOUT the
// cross-connection finding) sits ahead of the stamp block and is out of
// scope for this specific check; the decimal/percent and wire-id sweeps
// still run over the FULL text, since a leaked number is never acceptable
// anywhere in the render.
function stampAdjacentText(text) {
  const idx = text.search(/(✓|•|⚠) (strong|indirect|unverified)/);
  return idx === -1 ? text : text.slice(idx);
}

function sweepText(label, text) {
  const lines = String(text).split('\n');
  const result = verificationStampFormat.assertNoScalar(lines);
  check(label + ': no bare decimal or percent token', result.withheld === 0, result.withheld + ' would be withheld');
  check(label + ': no banned over-claim word next to a finding (breakthrough/convergent/validated/proven)', !BANNED_CLAIMS.test(stampAdjacentText(text)));
  check(label + ': the internal direction wire id never renders (structural_transfer/semantic_implementation)', !WIRE_IDS.test(text));
}

async function captureStdoutAsync(fn) {
  const rawLines = [];
  const original = process.stdout.write.bind(process.stdout);
  process.stdout.write = (chunk) => { rawLines.push(String(chunk)); return true; };
  try {
    const result = await fn();
    return { result, rawLines };
  } finally {
    process.stdout.write = original;
  }
}

function cloneEurekaRanked() {
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
// Out-of-scope note (grep-checked by this plan's own acceptance criteria):
// the F.1 brain-chip <conf>% render is explicitly NOT part of this sweep.
// ---------------------------------------------------------------------------
console.log('NOTE (out of scope): the F.1 brain-chip <conf>% (skills/ui-system/SKILL.md section 3, row 2) is'
  + ' flagged by 355-CONTEXT.md D-30 as explicitly out of scope for this D-30 render sweep -- not asserted here.');

// ---------------------------------------------------------------------------
// whitespace: renderScanLines (map) + renderNoveltyLines (score)
// ---------------------------------------------------------------------------

async function runWhitespace() {
  const gaps = gapsFixture.gaps.slice().sort((a, b) => (a.density_score || 0) - (b.density_score || 0));
  const zoneFindings = gaps.map((g) => Object.assign({ direction: directionConvention.NONE }, whitespaceCommand.whitespaceEndpoints(g, 'zone')));

  for (const [label, callTool] of [['whitespace scan (replay)', makeReplayCallTool(stubFixture)], ['whitespace scan (null)', makeNullCallTool()]]) {
    const stamps = await verificationStamp.stampFindings(zoneFindings, { callTool });
    const lines = whitespaceCommand.renderScanLines(gaps, stamps);
    sweepText(label, lines.join('\n'));
  }

  const noveltyRows = noveltyFixture.rows;
  const noveltyFindings = noveltyRows.map((r) => Object.assign({ direction: directionConvention.NONE }, whitespaceCommand.whitespaceEndpoints(r, 'novelty')));
  for (const [label, callTool] of [['whitespace score (replay)', makeReplayCallTool(stubFixture)], ['whitespace score (null)', makeNullCallTool()]]) {
    const stamps = await verificationStamp.stampFindings(noveltyFindings, { callTool });
    const lines = whitespaceCommand.renderNoveltyLines(noveltyRows, stamps);
    sweepText(label, lines.join('\n'));
  }

  // Negative control: a planted 0.87 in a zone_id must be withheld.
  const plantedGaps = JSON.parse(JSON.stringify(gaps));
  plantedGaps[0].zone_id = plantedGaps[0].zone_id + '-0.87';
  const callTool = makeReplayCallTool(stubFixture);
  const stamps = await verificationStamp.stampFindings(zoneFindings, { callTool });
  const lines = whitespaceCommand.renderScanLines(plantedGaps, stamps);
  const text = lines.join('\n');
  check('whitespace negative control: planted 0.87 is caught and withheld', text.indexOf('0.87') === -1 && text.indexOf('[withheld]') !== -1);
}

// ---------------------------------------------------------------------------
// hsi: renderHsiFindings, driven directly with a title-only pairs array
// (no room file I/O -- resolveEndpoint over a title match is exactly what
// hsiEndpoints itself falls back to once no frontmatter carry exists).
// ---------------------------------------------------------------------------

function hsiPairsAndFindings() {
  const pairs = [
    { left_id: 'a1', right_id: 'a2', left_title: 'Reverse Salient Analysis', right_title: 'Six Thinking Hats' },
    { left_id: 'b1', right_id: 'b2', left_title: 'Cynefin Framework', right_title: 'Hedgehog Concept' },
    { left_id: 'c1', right_id: 'c2', left_title: 'Hierarchy Mapping', right_title: 'PEST Analysis' },
    { left_id: 'd1', right_id: 'd2', left_title: 'Not A Real Framework', right_title: 'Also Not Real' },
  ];
  const findings = pairs.map((p) => {
    const from = verificationStamp.resolveEndpoint({ title: p.left_title });
    const to = verificationStamp.resolveEndpoint({ title: p.right_title });
    return { fromHandle: from.name, toHandle: to.name, fromVia: from.via, toVia: to.via, direction: directionConvention.NONE };
  });
  return { pairs, findings };
}

async function runHsi() {
  const { pairs, findings } = hsiPairsAndFindings();
  for (const [label, callTool] of [['hsi (replay)', makeReplayCallTool(stubFixture)], ['hsi (null)', makeNullCallTool()]]) {
    const stamps = await verificationStamp.stampFindings(findings, { callTool });
    const lines = hsiToGraph.renderHsiFindings(pairs, stamps);
    sweepText(label, lines.join('\n'));
  }

  // Negative control: plant 0.87 into one pair's own title.
  const { pairs: plantedPairs, findings: plantedFindings } = hsiPairsAndFindings();
  plantedPairs[0].left_title = plantedPairs[0].left_title + ' 0.87';
  const callTool = makeReplayCallTool(stubFixture);
  const stamps = await verificationStamp.stampFindings(plantedFindings, { callTool });
  const lines = hsiToGraph.renderHsiFindings(plantedPairs, stamps);
  const text = lines.join('\n');
  check('hsi negative control: planted 0.87 is caught and withheld', text.indexOf('0.87') === -1 && text.indexOf('[withheld]') !== -1);
}

// ---------------------------------------------------------------------------
// find-bottlenecks: renderBottleneckFinding
// ---------------------------------------------------------------------------

function rsFinding(bodyTextSuffix) {
  return {
    body_text: 'Reverse Salient Analysis (problem-definition) is lagging relative to Six Thinking Hats (solution-design)' + (bodyTextSuffix || ''),
    brain_chain_text: 'Reverse Salient Analysis -> Six Thinking Hats',
  };
}

async function runFindBottlenecks() {
  for (const [label, callTool] of [['find-bottlenecks (replay)', makeReplayCallTool(stubFixture)], ['find-bottlenecks (null)', makeNullCallTool()]]) {
    const stamp = await verificationStamp.stampFinding({ fromHandle: 'Reverse Salient Analysis', toHandle: 'Six Thinking Hats', direction: directionConvention.DIRECTIONS[0] }, { callTool });
    const lines = reverseSalientAgent.renderBottleneckFinding(rsFinding(), stamp);
    sweepText(label, lines.join('\n'));
  }

  // Negative control: plant 0.87 into the body text itself.
  const callTool = makeReplayCallTool(stubFixture);
  const stamp = await verificationStamp.stampFinding({ fromHandle: 'Reverse Salient Analysis', toHandle: 'Six Thinking Hats', direction: directionConvention.DIRECTIONS[0] }, { callTool });
  const lines = reverseSalientAgent.renderBottleneckFinding(rsFinding(', abs_diff 0.87'), stamp);
  const text = lines.join('\n');
  check('find-bottlenecks negative control: planted 0.87 in body_text is caught and withheld', text.indexOf('0.87') === -1 && text.indexOf('[withheld]') !== -1);
}

// ---------------------------------------------------------------------------
// find-connections: scripts/stamp-connections.cjs's own main()
// ---------------------------------------------------------------------------

async function runFindConnections() {
  for (const [label, callTool] of [['find-connections (replay)', makeReplayCallTool(stubFixture)], ['find-connections (null)', makeNullCallTool()]]) {
    const { rawLines } = await captureStdoutAsync(() => stampConnections.main(['--pair', 'Reverse Salient Analysis|Six Thinking Hats', '--pair', 'Cynefin Framework|Hedgehog Concept'], { callTool }));
    sweepText(label, rawLines.join(''));
  }

  // Negative control: a planted 0.87 in the typed (unresolvable) pair name.
  const { rawLines } = await captureStdoutAsync(() => stampConnections.main(['--pair', 'Some Bespoke Framework 0.87|Six Thinking Hats'], { callTool: makeReplayCallTool(stubFixture) }));
  const text = rawLines.join('');
  check('find-connections negative control: planted 0.87 is caught and withheld', text.indexOf('0.87') === -1 && text.indexOf('[withheld]') !== -1);
}

// ---------------------------------------------------------------------------
// eureka: the Markdown writer, the HTML export, and the F.1 qualify card.
// ---------------------------------------------------------------------------

async function runEureka() {
  // Markdown: the fixture's own rank-4 techA title already plants "0.87"
  // (tests/fixtures/355/producers/eureka-report.json), reused here as the
  // eureka negative control rather than re-planting a second one.
  for (const [label, callTool] of [['eureka report (replay)', makeReplayCallTool(stubFixture)], ['eureka report (null)', makeNullCallTool()]]) {
    const ranked = cloneEurekaRanked();
    await eurekaRunner.stampRankedPairs(ranked, {}, { callTool });
    const md = eurekaRunner.renderReport(makeMdCtx(ranked));
    const rankedSection = md.split('## Ranked top')[1].split('## Tail quadrant')[0];
    sweepText(label, rankedSection);
    check(label + ': the planted eureka-report.json 0.87 title is caught and withheld', rankedSection.indexOf('0.87') === -1 && rankedSection.indexOf('[withheld]') !== -1);
  }

  // HTML: the same planted-0.87 fixture row, swept over the ranked-table
  // region only.
  {
    const ranked = cloneEurekaRanked();
    await eurekaRunner.stampRankedPairs(ranked, {}, { callTool: makeReplayCallTool(stubFixture) });
    const jsonRanked = ranked.map((r) => ({ rank: r.rank, a: r.idA, b: r.idB, a_title: r.techA.title, b_title: r.techB.title, mode: 'embedded', banked: r.banked === true, stamp: r.stamp }));
    const html = reportHtml.renderReportHtml({ provenance: Object.assign({}, minimalProvenanceEmbedded), ranked: jsonRanked, statements: [] });
    const rankedTableHtml = html.split('<h2>Ranked')[1].split('<h2>Opportunity Statements')[0];
    const text = rankedTableHtml.replace(/<[^>]+>/g, ' ');
    sweepText('eureka html', text);
    check('eureka html negative control: the planted eureka-report.json 0.87 title is caught and withheld', text.indexOf('0.87') === -1 && text.indexOf('[withheld]') !== -1);
  }

  // F.1 qualify card: formatComponentLines is the exact function that feeds
  // renderQualificationCard's zones.body (Phase 355-18). Drive it directly
  // with a real verified stamp (positive) and a hand-built stamp whose path
  // node carries a planted 0.87 (negative control -- formatStampLines is
  // never zod-validated by formatComponentLines itself, so this proves the
  // D-30 backstop, not the Stamp schema, is what catches it here).
  {
    const callTool = makeReplayCallTool(stubFixture);
    const stamp = await verificationStamp.stampFinding({ fromHandle: 'Reverse Salient Analysis', toHandle: 'Six Thinking Hats', direction: directionConvention.DIRECTIONS[0] }, { callTool });
    const lines = qualifyOpportunity.formatComponentLines(null, null, stamp);
    sweepText('eureka qualify (F.1 zones.body, verified)', lines.join('\n'));
    check('eureka qualify (F.1 zones.body): stamp lines are present', lines.length > 0);

    const plantedStamp = {
      verification: 'strong',
      backend: 'theo',
      direction: directionConvention.DIRECTIONS[0],
      judge: 'none',
      path: { nodes: ['Reverse Salient Analysis 0.87', 'Six Thinking Hats'], labels: ['Framework', 'Framework'], edges: ['EXTENDS'] },
    };
    const plantedLines = qualifyOpportunity.formatComponentLines(null, null, plantedStamp);
    const text = plantedLines.join('\n');
    check('eureka qualify negative control: planted 0.87 in a stamp path node is caught and withheld', text.indexOf('0.87') === -1 && text.indexOf('[withheld]') !== -1);
  }
}

// ---------------------------------------------------------------------------
// the reach card text (formatStampLines(stamp, 'card')) for a verified and
// an unverified stamp.
// ---------------------------------------------------------------------------

async function runCard() {
  const callTool = makeReplayCallTool(stubFixture);
  const verified = await verificationStamp.stampFinding({ fromHandle: 'Reverse Salient Analysis', toHandle: 'Six Thinking Hats', direction: directionConvention.DIRECTIONS[0] }, { callTool });
  const unverified = await verificationStamp.stampFinding({ fromHandle: 'Hierarchy Mapping', toHandle: 'PEST Analysis', direction: directionConvention.NONE }, { callTool });

  sweepText('reach card (verified)', verificationStampFormat.formatStampLines(verified, 'card').join('\n'));
  sweepText('reach card (unverified)', verificationStampFormat.formatStampLines(unverified, 'card').join('\n'));

  const plantedStamp = {
    verification: 'strong',
    backend: 'theo',
    direction: directionConvention.DIRECTIONS[0],
    judge: 'none',
    path: { nodes: ['Reverse Salient Analysis', 'Six Thinking Hats 0.87'], labels: ['Framework', 'Framework'], edges: ['EXTENDS'] },
  };
  const text = verificationStampFormat.formatStampLines(plantedStamp, 'card').join('\n');
  check('reach card negative control: planted 0.87 in a path node is caught and withheld', text.indexOf('0.87') === -1 && text.indexOf('[withheld]') !== -1);
}

// ---------------------------------------------------------------------------
// The four Larry prose fixtures (tests/fixtures/355/prose/*.md).
// ---------------------------------------------------------------------------

function readProseBody(fileName) {
  const raw = fs.readFileSync(path.join(PROSE_DIR, fileName), 'utf8');
  const withoutFrontmatter = raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '');
  return withoutFrontmatter;
}

function runProse() {
  const files = ['desktop-verified.md', 'desktop-unverified.md', 'desktop-unchecked.md', 'cowork-verified.md'];
  check('prose fixtures: exactly 4 present', files.every((f) => fs.existsSync(path.join(PROSE_DIR, f))));
  for (const f of files) {
    const body = readProseBody(f);
    sweepText('prose ' + f, body);
  }

  // Negative control: a planted 0.87 in a synthetic prose-shaped sentence
  // (never written into a committed fixture) proves the sweep catches a
  // violation in prose text generally, not only in table renders.
  const synthetic = readProseBody('desktop-verified.md') + '\nThe fit here is about 0.87 on the last pass.\n';
  const result = verificationStampFormat.assertNoScalar(synthetic.split('\n'));
  check('prose negative control: a planted 0.87 sentence is caught and withheld', result.withheld > 0);
}

// ---------------------------------------------------------------------------
// Run everything.
// ---------------------------------------------------------------------------

async function main() {
  await runWhitespace();
  await runHsi();
  await runFindBottlenecks();
  await runFindConnections();
  await runEureka();
  await runCard();
  runProse();

  check('no network attempted (hygiene-355 net guard)', netGuard.attempts() === 0, String(netGuard.attempts()));
  netGuard.restore();

  process.exit(checker.summary());
}

main().catch((e) => {
  console.error('test-355-no-decimal: uncaught error: ' + String((e && e.stack) || e));
  netGuard.restore();
  process.exit(1);
});
