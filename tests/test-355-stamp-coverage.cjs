#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 355 (Hidden in Plain Sight: Jev-through-Theo cross-connection
 * engines) Plan 23 (HIPS-04, HIPS-02, SPEC AC5, AC7, AI-SPEC D4, D5, D7).
 * Aggregate stamp coverage across all five producers (produced findings ==
 * rendered stamp blocks == Stamp-parseable stamps, by INTEGER equality,
 * never a rounded percentage), the judge:'none' + disclosure-line
 * uniformity every render already carries, the AC7 no-citation-judgment
 * sweep over lib/ and hooks/, and a byte-true replay of the REAL 355-14
 * Theo capture (148 recorded pairs) proving every verified stamp's path is
 * exactly what Theo returned, never invented.
 *
 * Per this plan's own action text: the capture-replay leg exits 77 with a
 * loud message ONLY if tests/fixtures/355-theo-find-connections-responses.json
 * is genuinely absent (it exists after 355-14; this is a hard requirement,
 * not a soft skip).
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
const checker = hygiene.makeChecker('test-355-stamp-coverage');
const { check } = checker;

const whitespaceCommand = require(path.join(REPO, 'scripts', 'whitespace-command.cjs'));
const hsiToGraph = require(path.join(REPO, 'scripts', 'hsi-to-graph.cjs'));
const reverseSalientAgent = require(path.join(REPO, 'lib', 'agents', 'reverse-salient-agent.cjs'));
const stampConnections = require(path.join(REPO, 'scripts', 'stamp-connections.cjs'));
const eurekaRunner = require(path.join(REPO, 'scripts', 'eureka-portfolio-report.cjs'));
const verificationStamp = require(path.join(REPO, 'lib', 'core', 'verification-stamp.cjs'));
const verificationStampFormat = require(path.join(REPO, 'lib', 'core', 'verification-stamp-format.cjs'));
const directionConvention = require(path.join(REPO, 'lib', 'core', 'direction-convention.cjs'));
const floorDisclosure = require(path.join(REPO, 'lib', 'core', 'floor-disclosure.cjs'));
const { makeReplayCallTool } = require(path.join(REPO, 'tests', 'helpers', 'theo-replay-355.cjs'));

const stubFixture = JSON.parse(fs.readFileSync(path.join(REPO, 'tests', 'fixtures', '355', 'theo-stub-responses.json'), 'utf8'));
const gapsFixture = JSON.parse(fs.readFileSync(path.join(REPO, 'tests', 'fixtures', '355', 'producers', 'whitespace-gaps.json'), 'utf8'));
const noveltyFixture = JSON.parse(fs.readFileSync(path.join(REPO, 'tests', 'fixtures', '355', 'producers', 'whitespace-novelty.json'), 'utf8'));
const rsFixture = JSON.parse(fs.readFileSync(path.join(REPO, 'tests', 'fixtures', '355', 'producers', 'rs-pairs.json'), 'utf8'));
const eurekaFixture = JSON.parse(fs.readFileSync(path.join(REPO, 'tests', 'fixtures', '355', 'producers', 'eureka-report.json'), 'utf8'));

// ---------------------------------------------------------------------------
// Shared helpers.
// ---------------------------------------------------------------------------

function countStampBlocks(text) {
  return String(text).split('\n').filter((l) => /^(✓|•|⚠) (strong|indirect|unverified)/.test(l)).length;
}

function countJudgeLines(text) {
  return String(text).split('judge  none, path check only').length - 1;
}

function allStampsParse(stamps) {
  return stamps.every((s) => verificationStamp.Stamp.safeParse(s).success);
}

function allJudgeNone(stamps) {
  return stamps.every((s) => s.judge === 'none');
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
// Section A + B: per-producer coverage (produced findings == rendered
// stamp blocks == Stamp-parseable stamps, by integer equality) and the
// judge:'none' + disclosure-line uniformity.
// ---------------------------------------------------------------------------

async function coverageWhitespace() {
  const gaps = gapsFixture.gaps.slice().sort((a, b) => (a.density_score || 0) - (b.density_score || 0));
  const findings = gaps.map((g) => Object.assign({ direction: directionConvention.NONE }, whitespaceCommand.whitespaceEndpoints(g, 'zone')));
  const callTool = makeReplayCallTool(stubFixture);
  const stamps = await verificationStamp.stampFindings(findings, { callTool });
  const lines = whitespaceCommand.renderScanLines(gaps, stamps);
  const text = lines.join('\n');

  const produced = findings.length;
  const rendered = countStampBlocks(text);
  const parsed = stamps.filter((s) => verificationStamp.Stamp.safeParse(s).success).length;
  check('whitespace coverage: produced == rendered == parsed (integer equality)', produced === rendered && rendered === parsed, produced + '/' + rendered + '/' + parsed);
  check('whitespace coverage: every stamp carries judge none', allJudgeNone(stamps));
  check('whitespace coverage: every rendered block ends "judge  none, path check only"', countJudgeLines(text) === produced, countJudgeLines(text) + ' vs ' + produced);
  check("whitespace coverage: ends with disclosureLine('whitespace')", text.indexOf(floorDisclosure.disclosureLine('whitespace')) !== -1);
}

async function coverageHsi() {
  const pairs = [
    { left_title: 'Reverse Salient Analysis', right_title: 'Six Thinking Hats' },
    { left_title: 'Cynefin Framework', right_title: 'Hedgehog Concept' },
    { left_title: 'Hierarchy Mapping', right_title: 'PEST Analysis' },
    { left_title: 'Not A Real Framework', right_title: 'Also Not Real' },
  ];
  const findings = pairs.map((p) => {
    const from = verificationStamp.resolveEndpoint({ title: p.left_title });
    const to = verificationStamp.resolveEndpoint({ title: p.right_title });
    return { fromHandle: from.name, toHandle: to.name, direction: directionConvention.NONE };
  });
  const callTool = makeReplayCallTool(stubFixture);
  const stamps = await verificationStamp.stampFindings(findings, { callTool });
  const lines = hsiToGraph.renderHsiFindings(pairs, stamps);
  const text = lines.join('\n');

  const produced = findings.length;
  const rendered = countStampBlocks(text);
  const parsed = stamps.filter((s) => verificationStamp.Stamp.safeParse(s).success).length;
  check('hsi coverage: produced == rendered == parsed (integer equality)', produced === rendered && rendered === parsed, produced + '/' + rendered + '/' + parsed);
  check('hsi coverage: every stamp carries judge none', allJudgeNone(stamps));
  check('hsi coverage: every rendered block ends "judge  none, path check only"', countJudgeLines(text) === produced, countJudgeLines(text) + ' vs ' + produced);
  check("hsi coverage: ends with disclosureLine('hsi')", text.indexOf(floorDisclosure.disclosureLine('hsi')) !== -1);
}

async function coverageFindBottlenecks() {
  const pairs = rsFixture.pairs;
  const callTool = makeReplayCallTool(stubFixture);
  const findings = [];
  const stamps = [];
  const lines = [];
  for (const p of pairs) {
    const from = verificationStamp.resolveEndpoint({ title: p.source_title });
    const to = verificationStamp.resolveEndpoint({ title: p.target_title });
    const finding = { fromHandle: from.name, toHandle: to.name, direction: directionConvention.DIRECTIONS.indexOf(p.direction) !== -1 ? p.direction : directionConvention.NONE };
    findings.push(finding);
    const stamp = await verificationStamp.stampFinding(finding, { callTool });
    stamps.push(stamp);
    const rsFinding = { body_text: (p.source_title || p.source_artifact_id) + ' is lagging relative to ' + (p.target_title || p.target_artifact_id), brain_chain_text: '' };
    lines.push.apply(lines, reverseSalientAgent.renderBottleneckFinding(rsFinding, stamp));
  }
  const text = lines.join('\n');

  const produced = findings.length;
  const rendered = countStampBlocks(text);
  const parsed = stamps.filter((s) => verificationStamp.Stamp.safeParse(s).success).length;
  check('find-bottlenecks coverage: produced == rendered == parsed (integer equality)', produced === rendered && rendered === parsed, produced + '/' + rendered + '/' + parsed);
  check('find-bottlenecks coverage: every stamp carries judge none', allJudgeNone(stamps));
  check('find-bottlenecks coverage: every rendered block ends "judge  none, path check only"', countJudgeLines(text) === produced, countJudgeLines(text) + ' vs ' + produced);
  // renderBottleneckFinding appends disclosureLine('find-bottlenecks') to
  // EACH finding's own block (this test calls it once per pair, the same
  // way a real /mos:find-bottlenecks turn surfaces one finding at a time),
  // so the combined text carries one disclosure per produced finding.
  const disclosureCount = text.split(floorDisclosure.disclosureLine('find-bottlenecks')).length - 1;
  check("find-bottlenecks coverage: disclosureLine('find-bottlenecks') appears once per rendered block", disclosureCount === produced, disclosureCount + ' vs ' + produced);
}

async function coverageFindConnections() {
  const pairArgs = ['--pair', 'Reverse Salient Analysis|Six Thinking Hats', '--pair', 'Design Thinking|Jobs to Be Done (JTBD)', '--pair', 'Cynefin Framework|Hedgehog Concept'];
  const callTool = makeReplayCallTool(stubFixture);
  const { rawLines } = await captureStdoutAsync(() => stampConnections.main(pairArgs, { callTool }));
  const text = rawLines.join('');
  const { rawLines: jsonLines } = await captureStdoutAsync(() => stampConnections.main(pairArgs.concat(['--json']), { callTool: makeReplayCallTool(stubFixture) }));
  const stamps = JSON.parse(jsonLines.join(''));

  const produced = 3;
  const rendered = countStampBlocks(text);
  const parsed = stamps.filter((s) => verificationStamp.Stamp.safeParse(s).success).length;
  check('find-connections coverage: produced == rendered == parsed (integer equality)', produced === rendered && rendered === parsed, produced + '/' + rendered + '/' + parsed);
  check('find-connections coverage: every stamp carries judge none', allJudgeNone(stamps));
  check('find-connections coverage: every rendered block ends "judge  none, path check only"', countJudgeLines(text) === produced, countJudgeLines(text) + ' vs ' + produced);
  check("find-connections coverage: ends with disclosureLine('find-connections')", text.trim().endsWith(floorDisclosure.disclosureLine('find-connections')));
}

function cloneEurekaRanked() {
  return JSON.parse(JSON.stringify(eurekaFixture.embedded.ranked));
}

async function coverageEureka() {
  const ranked = cloneEurekaRanked();
  const callTool = makeReplayCallTool(stubFixture);
  const stamps = await eurekaRunner.stampRankedPairs(ranked, {}, { callTool });
  const md = eurekaRunner.renderReport(makeMdCtx(ranked));
  const rankedSection = md.split('## Ranked top')[1].split('## Tail quadrant')[0];

  const produced = ranked.length;
  const rendered = countStampBlocks(rankedSection);
  const parsed = stamps.filter((s) => verificationStamp.Stamp.safeParse(s).success).length;
  // Two of the six fixture rows are non-canon titles (D-10 honest miss ->
  // not_called/handle_unresolved) -- still a STAMP (unverified), still
  // Stamp-parseable, still ONE rendered block. All six produce == render
  // == parse, exactly like every other producer, per SPEC AC5's own
  // "produced == rendered == parsed" wording (never "produced == verified").
  check('eureka coverage: produced == rendered == parsed (integer equality)', produced === rendered && rendered === parsed, produced + '/' + rendered + '/' + parsed);
  check('eureka coverage: every stamp carries judge none', allJudgeNone(stamps));
  check('eureka coverage: every rendered block ends "judge  none, path check only"', countJudgeLines(rankedSection) === produced, countJudgeLines(rankedSection) + ' vs ' + produced);
  check("eureka coverage: ends with disclosureLine('eureka')", rankedSection.indexOf(floorDisclosure.disclosureLine('eureka')) !== -1);
}

// ---------------------------------------------------------------------------
// Section C (AC7): no lib/ or hooks/ file references jev-question-ceilings
// or the citation question -- the Jev seam stays dev-time-only
// (scripts/jev-question-ceilings.cjs), never a runtime judgment path.
// ---------------------------------------------------------------------------

function sweepNoCitationJudgment() {
  const targets = [
    { root: path.join(REPO, 'lib'), name: 'lib' },
    { root: path.join(REPO, 'hooks'), name: 'hooks' },
  ];
  const NEEDLES = ['jev-question-ceilings', 'jev_question_ceilings', 'the citation question'];
  let hits = [];
  for (const t of targets) {
    const files = hygiene.listFilesRecursive(t.root);
    for (const f of files) {
      let raw;
      try {
        raw = fs.readFileSync(f, 'utf8');
      } catch (_e) {
        continue;
      }
      for (const needle of NEEDLES) {
        if (raw.indexOf(needle) !== -1) hits.push(f + ' :: ' + needle);
      }
    }
  }
  check('AC7: no lib/ or hooks/ file references jev-question-ceilings or the citation question', hits.length === 0, JSON.stringify(hits.slice(0, 5)));
}

// ---------------------------------------------------------------------------
// Section D: byte-true replay against the REAL 355-14 Theo capture.
// ---------------------------------------------------------------------------

async function byteTrueReplay() {
  const capturePath = path.join(REPO, 'tests', 'fixtures', '355-theo-find-connections-responses.json');
  if (!fs.existsSync(capturePath)) {
    console.error('test-355-stamp-coverage: LOUD FAILURE -- the real Theo capture'
      + ' (tests/fixtures/355-theo-find-connections-responses.json, the 355-14'
      + ' deliverable) is missing. This leg is required, not optional; exiting 77.');
    process.exit(77);
  }
  const capture = JSON.parse(fs.readFileSync(capturePath, 'utf8'));
  const responses = capture.responses || {};
  const keys = Object.keys(responses);
  check('byte-true replay: the real capture has recorded pairs', keys.length > 0, String(keys.length));

  const callTool = makeReplayCallTool(capture);

  let verifiedCount = 0;
  let unverifiedCount = 0;
  const nodeMismatches = [];
  const edgeMismatches = [];
  const tierMismatches = [];
  const pathOutsideCapture = [];
  const unverifiedWithPath = [];

  for (const key of keys) {
    const sepIdx = key.indexOf('\u0000');
    if (sepIdx === -1) continue;
    const from = key.slice(0, sepIdx);
    const to = key.slice(sepIdx + 1);

    const stamp = await verificationStamp.stampFinding({ fromHandle: from, toHandle: to, direction: directionConvention.NONE }, { callTool });
    const raw = responses[key];
    const hasPaths = raw && Array.isArray(raw.paths) && raw.paths.length > 0;

    if (!hasPaths) {
      // No path within 3 hops (the capture's own 83 empty-paths entries):
      // the stamp must be unverified and must carry no path at all.
      unverifiedCount += 1;
      if (stamp.path !== undefined) unverifiedWithPath.push(key);
      continue;
    }

    const { chosen } = verificationStamp.choosePath(raw.paths);
    if (!chosen) continue; // malformed_response -- 0 of the 148 recorded pairs, defensive only

    const hasLateral = chosen.edges.some((e) => verificationStamp.LATERAL_EDGE_TYPES.has(e));
    if (!hasLateral) {
      // co_sourced_only / no_lateral_relation -- unverified, no path.
      unverifiedCount += 1;
      if (stamp.path !== undefined) unverifiedWithPath.push(key);
      continue;
    }

    // A verified outcome: byte-true against the recorded chosen path.
    verifiedCount += 1;
    const expectedNodes = chosen.path.map((n, i) => (chosen.pathLabels[i] === 'Framework' ? n : '[' + chosen.pathLabels[i] + ']'));
    const expectedEdges = chosen.edges;
    const expectedTier = verificationStamp.tierFromHops(expectedEdges.length);

    if (!stamp.path || JSON.stringify(stamp.path.nodes) !== JSON.stringify(expectedNodes)) {
      nodeMismatches.push(key);
    }
    if (!stamp.path || JSON.stringify(stamp.path.edges) !== JSON.stringify(expectedEdges)) {
      edgeMismatches.push(key);
    }
    if (stamp.verification !== expectedTier) {
      tierMismatches.push(key);
    }
    // No stamp carries a path that is not in the capture: every node in the
    // produced path must appear in the raw response's own recorded path
    // array for at least one of its candidate paths (the chosen one, since
    // that is exactly where this stamp's path came from).
    if (stamp.path) {
      const rawNodesForChosen = raw.paths.find((p) => p.edges.join('|') === chosen.edges.join('|') && p.path.join('|') === chosen.path.join('|'));
      if (!rawNodesForChosen) pathOutsideCapture.push(key);
    }
  }

  check('byte-true replay: at least one verified pair replayed', verifiedCount > 0, String(verifiedCount));
  check('byte-true replay: at least one unverified pair replayed', unverifiedCount > 0, String(unverifiedCount));
  check('byte-true replay: verified + unverified accounts for every recorded pair', verifiedCount + unverifiedCount === keys.length, verifiedCount + '+' + unverifiedCount + ' vs ' + keys.length);
  check('byte-true replay: every verified stamp.path.nodes equals the recorded chosen path (bracketed non-Framework)', nodeMismatches.length === 0, JSON.stringify(nodeMismatches.slice(0, 5)));
  check('byte-true replay: every verified stamp.path.edges equals the recorded chosen edges', edgeMismatches.length === 0, JSON.stringify(edgeMismatches.slice(0, 5)));
  check('byte-true replay: every verified stamp.verification equals tierFromHops(recorded edges length)', tierMismatches.length === 0, JSON.stringify(tierMismatches.slice(0, 5)));
  check('byte-true replay: no stamp carries a path that is not in the capture', pathOutsideCapture.length === 0, JSON.stringify(pathOutsideCapture.slice(0, 5)));
  check('byte-true replay: no unverified stamp carries a path', unverifiedWithPath.length === 0, JSON.stringify(unverifiedWithPath.slice(0, 5)));
}

// ---------------------------------------------------------------------------
// Run everything.
// ---------------------------------------------------------------------------

async function main() {
  await coverageWhitespace();
  await coverageHsi();
  await coverageFindBottlenecks();
  await coverageFindConnections();
  await coverageEureka();
  sweepNoCitationJudgment();
  await byteTrueReplay();

  check('no network attempted (hygiene-355 net guard)', netGuard.attempts() === 0, String(netGuard.attempts()));
  netGuard.restore();

  process.exit(checker.summary());
}

main().catch((e) => {
  console.error('test-355-stamp-coverage: uncaught error: ' + String((e && e.stack) || e));
  netGuard.restore();
  process.exit(1);
});
