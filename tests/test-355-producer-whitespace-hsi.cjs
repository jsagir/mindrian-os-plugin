#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 355 (Hidden in Plain Sight: Jev-through-Theo cross-connection
 * engines) Plan 16 (HIPS-04, HIPS-05, HIPS-02, D-08, D-16, D-27, D-29, D-30,
 * D-48, D-49). Coverage, no-decimal, disclosure and node-prop proofs for two
 * producers (whitespace, HSI), Theo up (replay) and Theo down (null).
 *
 * Every check label in the "whitespace" section starts with the literal
 * "whitespace "; every check label in the "hsi" section starts with the
 * literal "hsi ", so a caller can grep `^FAIL: whitespace ` or `^FAIL: hsi `
 * independently (Task 1's own verify command greps only the whitespace
 * prefix, since the HSI section does not exist until Task 3).
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

const hadKey = hygiene.scrubVendorKey();
const netGuard = hygiene.installNetGuard();

const REPO = path.join(__dirname, '..');
const checker = hygiene.makeChecker('test-355-producer-whitespace-hsi');
const { check } = checker;

const os = require('node:os');
const whitespaceCommand = require(path.join(REPO, 'scripts', 'whitespace-command.cjs'));
const whitespaceToGraph = require(path.join(REPO, 'scripts', 'whitespace-to-graph.cjs'));
const { openGraph, closeGraph } = require(path.join(REPO, 'lib', 'core', 'lazygraph-ops.cjs'));
const verificationStamp = require(path.join(REPO, 'lib', 'core', 'verification-stamp.cjs'));
const verificationStampFormat = require(path.join(REPO, 'lib', 'core', 'verification-stamp-format.cjs'));
const directionConvention = require(path.join(REPO, 'lib', 'core', 'direction-convention.cjs'));
const floorDisclosure = require(path.join(REPO, 'lib', 'core', 'floor-disclosure.cjs'));
const { makeReplayCallTool, makeNullCallTool } = require(path.join(REPO, 'tests', 'helpers', 'theo-replay-355.cjs'));
const hsiToGraph = require(path.join(REPO, 'scripts', 'hsi-to-graph.cjs'));

const stubFixture = JSON.parse(fs.readFileSync(path.join(REPO, 'tests', 'fixtures', '355', 'theo-stub-responses.json'), 'utf8'));
const gapsFixture = JSON.parse(fs.readFileSync(path.join(REPO, 'tests', 'fixtures', '355', 'producers', 'whitespace-gaps.json'), 'utf8'));
const noveltyFixture = JSON.parse(fs.readFileSync(path.join(REPO, 'tests', 'fixtures', '355', 'producers', 'whitespace-novelty.json'), 'utf8'));

const NONE_MEANING = directionConvention.NONE_MEANING;

// ---------------------------------------------------------------------------
// Shared assertions, reused across every render seam leg below.
// ---------------------------------------------------------------------------

function countStampBlocks(lines) {
  // Every formatStampLines('cli') block opens on a glyph line (checkmark,
  // bullet, or the bare warning sign) followed by the tier word.
  return lines.filter((l) => /^(✓|•|⚠) (strong|indirect|unverified)/.test(l)).length;
}

function assertNoDecimalOrPercent(label, lines) {
  const result = verificationStampFormat.assertNoScalar(lines);
  check('whitespace ' + label + ': no decimal or percent token anywhere in the render', result.withheld === 0, result.withheld + ' withheld');
}

function assertDirectionIsNone(label, lines, expectedBlocks) {
  const matches = lines.filter((l) => l.indexOf(NONE_MEANING) !== -1).length;
  check('whitespace ' + label + ': every stamp block carries the NONE_MEANING direction phrase', matches === expectedBlocks, 'found ' + matches + ' expected ' + expectedBlocks);
}

function assertDisclosureLast(label, lines) {
  const last = lines[lines.length - 1];
  check('whitespace ' + label + ": disclosureLine('whitespace') is the last line", last === floorDisclosure.disclosureLine('whitespace'), 'got: ' + last);
}

// ---------------------------------------------------------------------------
// Leg: scan (the `map` subcommand's renderScanLines seam)
// ---------------------------------------------------------------------------

async function runScanLeg() {
  const gaps = gapsFixture.gaps.slice().sort((a, b) => (a.density_score || 0) - (b.density_score || 0));
  const findings = gaps.map((g) => Object.assign({ direction: directionConvention.NONE }, whitespaceCommand.whitespaceEndpoints(g, 'zone')));

  // Theo up (replay).
  {
    const callTool = makeReplayCallTool(stubFixture);
    const stamps = await verificationStamp.stampFindings(findings, { callTool });
    const lines = whitespaceCommand.renderScanLines(gaps, stamps);
    check('whitespace scan (replay): rendered rows == findings == stamp blocks', countStampBlocks(lines) === gaps.length, 'got ' + countStampBlocks(lines) + ' expected ' + gaps.length);
    assertDirectionIsNone('scan (replay)', lines, gaps.length);
    assertDisclosureLast('scan (replay)', lines);
    assertNoDecimalOrPercent('scan (replay)', lines);
  }

  // Theo down (null): the three resolvable zones (ws-gap-001..003) each
  // carry both handles, so each attempts one Theo call and gets null back --
  // backend unavailable, reason backend_unavailable, the advice line present.
  // The two unresolvable/degenerate zones (ws-gap-004, ws-gap-005) never
  // reach Theo at all (not_called), so the null callTool sees exactly 3
  // calls, never 5.
  {
    const callTool = makeNullCallTool();
    const stamps = await verificationStamp.stampFindings(findings, { callTool });
    const lines = whitespaceCommand.renderScanLines(gaps, stamps);
    check('whitespace scan (null): rendered rows == findings == stamp blocks', countStampBlocks(lines) === gaps.length, 'got ' + countStampBlocks(lines) + ' expected ' + gaps.length);
    assertDisclosureLast('scan (null)', lines);
    assertNoDecimalOrPercent('scan (null)', lines);
    check('whitespace scan (null): Theo attempted exactly for the 3 resolvable zones', callTool.calls.length === 3, 'got ' + callTool.calls.length);
    const unavailableStamps = stamps.filter((s) => s.backend === 'unavailable' && s.reason === 'backend_unavailable');
    check('whitespace scan (null): the 3 resolvable zones report backend unavailable', unavailableStamps.length === 3, 'got ' + unavailableStamps.length);
    const adviceLines = lines.filter((l) => l.indexOf(verificationStampFormat.UNVERIFIED_ADVICE) !== -1);
    check('whitespace scan (null): every unverified block carries the advice line', adviceLines.length === gaps.length, 'got ' + adviceLines.length + ' expected ' + gaps.length);
    const backendWordLines = lines.filter((l) => l.indexOf('theo unavailable') !== -1);
    check('whitespace scan (null): the 3 resolvable zones render "theo unavailable"', backendWordLines.length === 3, 'got ' + backendWordLines.length);
  }

  // Negative control (D-30): a planted decimal inside a zone_id proves the
  // no-decimal assertion actually catches a violation, not a vacuous pass.
  {
    const planted = JSON.parse(JSON.stringify(gaps));
    planted[0].zone_id = 'ws-gap-0.87';
    const plantedFindings = planted.map((g) => Object.assign({ direction: directionConvention.NONE }, whitespaceCommand.whitespaceEndpoints(g, 'zone')));
    const callTool = makeReplayCallTool(stubFixture);
    const stamps = await verificationStamp.stampFindings(plantedFindings, { callTool });
    const lines = whitespaceCommand.renderScanLines(planted, stamps);
    const withheldCount = lines.filter((l) => l.indexOf('[withheld]') !== -1).length;
    check('whitespace scan negative control: a planted 0.87 in a zone_id is caught (withheld)', withheldCount >= 1, 'got ' + withheldCount);
    check('whitespace scan negative control: the raw "0.87" text never reaches the render', !lines.some((l) => l.indexOf('0.87') !== -1));
  }
}

// ---------------------------------------------------------------------------
// Leg: analyze (renderAnalyzeLines seam)
// ---------------------------------------------------------------------------

async function runAnalyzeLeg() {
  const gaps = gapsFixture.gaps.slice().sort((a, b) => (a.density_score || 0) - (b.density_score || 0));
  const rankIndex = gaps.findIndex((g) => g.zone_id === 'ws-gap-003'); // the 3-hop indirect zone
  const zone = gaps[rankIndex];
  const endpoints = whitespaceCommand.whitespaceEndpoints(zone, 'zone');

  {
    const callTool = makeReplayCallTool(stubFixture);
    const stamp = await verificationStamp.stampFinding(Object.assign({ direction: directionConvention.NONE }, endpoints), { callTool });
    const lines = whitespaceCommand.renderAnalyzeLines(zone, stamp, rankIndex + 1, gaps.length);
    check('whitespace analyze (replay): rendered rows == findings == stamp blocks', countStampBlocks(lines) === 1, 'got ' + countStampBlocks(lines));
    check('whitespace analyze (replay): the Density line is gone, replaced by a sparsity rank', lines.some((l) => l.indexOf('Rank: sparsity rank ' + (rankIndex + 1) + ' of ' + gaps.length) !== -1));
    check('whitespace analyze (replay): no line reads "Density:"', !lines.some((l) => l.indexOf('Density:') !== -1));
    assertDirectionIsNone('analyze (replay)', lines, 1);
    assertDisclosureLast('analyze (replay)', lines);
    assertNoDecimalOrPercent('analyze (replay)', lines);
    check('whitespace analyze (replay): indirect tier (3-hop) renders correctly', stamp.verification === 'indirect');
  }

  {
    const callTool = makeNullCallTool();
    const stamp = await verificationStamp.stampFinding(Object.assign({ direction: directionConvention.NONE }, endpoints), { callTool });
    const lines = whitespaceCommand.renderAnalyzeLines(zone, stamp, rankIndex + 1, gaps.length);
    check('whitespace analyze (null): backend unavailable', stamp.backend === 'unavailable' && stamp.reason === 'backend_unavailable');
    check('whitespace analyze (null): advice line present', lines.some((l) => l.indexOf(verificationStampFormat.UNVERIFIED_ADVICE) !== -1));
    assertDisclosureLast('analyze (null)', lines);
    assertNoDecimalOrPercent('analyze (null)', lines);
  }
}

// ---------------------------------------------------------------------------
// Leg: score / novelty (renderNoveltyLines seam)
// ---------------------------------------------------------------------------

function _noveltyFinding(row) {
  return Object.assign({ direction: directionConvention.NONE }, whitespaceCommand.whitespaceEndpoints(row, 'novelty'));
}

async function runNoveltyLeg() {
  const rows = noveltyFixture.rows.slice().sort((a, b) => (b.novelty_score || 0) - (a.novelty_score || 0));
  const findings = rows.map(_noveltyFinding);

  {
    const callTool = makeReplayCallTool(stubFixture);
    const stamps = await verificationStamp.stampFindings(findings, { callTool });
    const lines = whitespaceCommand.renderNoveltyLines(rows, stamps);
    check('whitespace score (replay): rendered rows == findings == stamp blocks', countStampBlocks(lines) === rows.length, 'got ' + countStampBlocks(lines) + ' expected ' + rows.length);
    assertDirectionIsNone('score (replay)', lines, rows.length);
    assertDisclosureLast('score (replay)', lines);
    assertNoDecimalOrPercent('score (replay)', lines);
    check('whitespace score (replay): band words replace the raw novelty decimal', lines.some((l) => /\bnovel\b/.test(l)) && lines.some((l) => /\bmoderate\b/.test(l)) && lines.some((l) => /\bcovered\b/.test(l)));
    check('whitespace score (replay): no "Novel (>0.8)" / "Covered (<0.4)" label text', !lines.some((l) => l.indexOf('Novel (>0.8)') !== -1 || l.indexOf('Covered (<0.4)') !== -1));
    // Row 6 (novelty-f) resolves through nothing (both ends unresolvable):
    // not_called even with Theo up.
    const lastRowStamp = stamps[rows.findIndex((r) => r.artifact === 'novelty-f')];
    check('whitespace score (replay): an unresolvable row stamps not_called/handle_unresolved', lastRowStamp.backend === 'not_called' && lastRowStamp.reason === 'handle_unresolved');
    check('whitespace score (replay): the unresolved row still renders under its own artifact name with the unverified advice', lines.some((l) => l.indexOf('novelty-f') !== -1) && lines.some((l) => l.indexOf(verificationStampFormat.UNVERIFIED_ADVICE) !== -1));
  }

  {
    const callTool = makeNullCallTool();
    const stamps = await verificationStamp.stampFindings(findings, { callTool });
    const lines = whitespaceCommand.renderNoveltyLines(rows, stamps);
    check('whitespace score (null): rendered rows == findings == stamp blocks', countStampBlocks(lines) === rows.length, 'got ' + countStampBlocks(lines));
    assertDisclosureLast('score (null)', lines);
    assertNoDecimalOrPercent('score (null)', lines);
    const resolvedBoth = findings.filter((f) => f.fromHandle && f.toHandle).length;
    check('whitespace score (null): Theo attempted exactly for the resolvable rows', callTool.calls.length === resolvedBoth, 'got ' + callTool.calls.length + ' expected ' + resolvedBoth);
  }
}

// ---------------------------------------------------------------------------
// Leg: whitespace-to-graph.cjs --stamp (D-16 node-prop proof)
// ---------------------------------------------------------------------------

function makeMos355ScratchRoom(label) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-355-16-' + label + '-'));
  const room = path.join(root, 'room');
  fs.mkdirSync(path.join(room, '.mindrian'), { recursive: true });
  return {
    root,
    room,
    cleanup() {
      try {
        fs.rmSync(root, { recursive: true, force: true });
      } catch (_e) {
        // best-effort
      }
    },
  };
}

async function readZoneNodes(roomDir) {
  const graph = await openGraph(roomDir);
  try {
    const rows = graph.conn.prepare("SELECT id, properties FROM nodes WHERE type = 'WhitespaceZone'").all();
    return rows.map((r) => ({ id: r.id, props: JSON.parse(r.properties) }));
  } finally {
    await closeGraph(graph.db);
  }
}

async function runWhitespaceToGraphStampLeg() {
  const resultsData = {
    gaps: [
      { brain_framework: 'Reverse Salient Analysis', density_score: 0.1, knn_density: 0.2, strategic_rank: 0.5, problem_type: 'Ill-Defined', nearest_room_artifacts: [] },
      { brain_framework: 'Not A Real Framework', density_score: 0.2, knn_density: 0.3, strategic_rank: 0.4, problem_type: 'Un-Defined', nearest_room_artifacts: [] },
    ],
    novelty_scores: [],
  };
  const interpData = {
    gaps: [
      { brain_framework: 'Reverse Salient Analysis', framework_chain: ['Reverse Salient Analysis', 'Six Thinking Hats'], problem_type: 'Ill-Defined' },
    ],
  };

  // With --stamp: both zones carry a stamp (one strong-verified, one
  // not_called), re-parsing cleanly through fromNodeProps.
  {
    const scratch = makeMos355ScratchRoom('stamp');
    try {
      fs.writeFileSync(path.join(scratch.room, '.mindrian', 'whitespace-results.json'), JSON.stringify(resultsData));
      fs.writeFileSync(path.join(scratch.room, '.mindrian', 'interpretation-results.json'), JSON.stringify(interpData));
      const callTool = makeReplayCallTool(stubFixture);
      await whitespaceToGraph.main([scratch.room, '--stamp'], { callTool });
      const zones = await readZoneNodes(scratch.room);
      check('whitespace whitespace-to-graph --stamp: writes 2 WhitespaceZone nodes', zones.length === 2, 'got ' + zones.length);
      for (const zone of zones) {
        let parsed = null;
        let threw = false;
        try {
          parsed = verificationStamp.fromNodeProps(zone.props);
        } catch (_e) {
          threw = true;
        }
        check('whitespace whitespace-to-graph --stamp: ' + zone.id + ' props re-parse via fromNodeProps', threw === false && !!parsed);
      }
      const strongZone = zones.find((z) => z.props.brain_framework === 'Reverse Salient Analysis');
      check('whitespace whitespace-to-graph --stamp: the resolvable zone stamps strong/theo', !!strongZone && strongZone.props.verification === 'strong' && strongZone.props.backend === 'theo');
      const unresolvedZone = zones.find((z) => z.props.brain_framework === 'Not A Real Framework');
      check('whitespace whitespace-to-graph --stamp: the unresolvable zone stamps unverified/not_called', !!unresolvedZone && unresolvedZone.props.verification === 'unverified' && unresolvedZone.props.backend === 'not_called');
    } finally {
      scratch.cleanup();
    }
  }

  // Without --stamp: byte-identical behavior -- no zone carries a
  // verification/backend/direction/judge property at all.
  {
    const scratch = makeMos355ScratchRoom('nostamp');
    try {
      fs.writeFileSync(path.join(scratch.room, '.mindrian', 'whitespace-results.json'), JSON.stringify(resultsData));
      fs.writeFileSync(path.join(scratch.room, '.mindrian', 'interpretation-results.json'), JSON.stringify(interpData));
      await whitespaceToGraph.main([scratch.room], {});
      const zones = await readZoneNodes(scratch.room);
      check('whitespace whitespace-to-graph (no --stamp): writes 2 WhitespaceZone nodes', zones.length === 2, 'got ' + zones.length);
      const anyStamped = zones.some((z) => Object.prototype.hasOwnProperty.call(z.props, 'verification'));
      check('whitespace whitespace-to-graph (no --stamp): no zone carries a verification property', anyStamped === false);
    } finally {
      scratch.cleanup();
    }
  }
}

// ---------------------------------------------------------------------------
// HSI section (Task 3, HIPS-04, HIPS-05, D-08, D-16, D-48). Every check
// label starts with the literal "hsi ".
// ---------------------------------------------------------------------------

const ROOM_272 = path.join(REPO, 'tests', 'fixtures', '272', 'room');

async function readHsiConnectionEdges(roomDir) {
  const graph = await openGraph(roomDir);
  try {
    const rows = graph.conn.prepare("SELECT source, target, properties FROM edges WHERE type = 'HSI_CONNECTION'").all();
    return rows.map((r) => ({ source: r.source, target: r.target, props: JSON.parse(r.properties) }));
  } finally {
    await closeGraph(graph.db);
  }
}

/*
 * A mkdtemp copy of the 272 room (real artifact content, its own
 * Section/Artifact structure), plus two synthetic artifacts under
 * synthetic-355/ carrying canon frontmatter (so at least one HSI pair
 * resolves to a real Theo answer instead of every pair landing on
 * not_called). Three pairs: two shown (topN=2, both above the existing
 * hsi_score<=0.3 write floor), one written but not shown (also above the
 * floor, so its edge exists but carries no stamp).
 */
function makeHsiScratchRoom() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-355-16-hsi-'));
  const room = path.join(root, 'room');
  fs.cpSync(ROOM_272, room, { recursive: true });
  fs.mkdirSync(path.join(room, 'synthetic-355'), { recursive: true });
  fs.writeFileSync(path.join(room, 'synthetic-355', 'hsi-pair-a.md'), '---\nframework: Reverse Salient Analysis\n---\n\n# HSI Pair A\n\nBody text about reverse salience.');
  fs.writeFileSync(path.join(room, 'synthetic-355', 'hsi-pair-b.md'), '---\nframework: Six Thinking Hats\n---\n\n# HSI Pair B\n\nBody text about the six hats.');

  const pairs = [
    { left_id: 'synthetic-355/hsi-pair-a', right_id: 'synthetic-355/hsi-pair-b', lsa_sim: 0.2, semantic_sim: 0.5, hsi_score: 0.9, surprise_type: 'x', breakthrough_potential: 0.3 },
    { left_id: 'assumptions/performance-tuning-03', right_id: 'research/data-pipeline-04', lsa_sim: 0.6, semantic_sim: 0.3, hsi_score: 0.8, surprise_type: 'y', breakthrough_potential: 0.2 },
    { left_id: 'decisions/data-pipeline-01', right_id: 'research/performance-tuning-02', lsa_sim: 0.5, semantic_sim: 0.5, hsi_score: 0.5, surprise_type: 'z', breakthrough_potential: 0.1 },
  ];
  fs.writeFileSync(path.join(room, '.hsi-results.json'), JSON.stringify({ metadata: { tier: 1 }, hsi_pairs: pairs, reverse_salients: [] }));

  const involvedIds = ['synthetic-355/hsi-pair-a', 'synthetic-355/hsi-pair-b', 'assumptions/performance-tuning-03', 'research/data-pipeline-04', 'decisions/data-pipeline-01', 'research/performance-tuning-02'];

  return {
    root,
    room,
    pairs,
    involvedIds,
    cleanup() {
      try {
        fs.rmSync(root, { recursive: true, force: true });
      } catch (_e) {
        // best-effort
      }
    },
  };
}

async function seedArtifactNodes(roomDir, ids) {
  const graph = await openGraph(roomDir);
  try {
    const stmt = graph.conn.prepare("INSERT INTO nodes (id, type, properties) VALUES (?, 'Artifact', ?) ON CONFLICT(id) DO UPDATE SET properties = excluded.properties");
    for (const id of ids) stmt.run(id, JSON.stringify({ title: id }));
  } finally {
    await closeGraph(graph.db);
  }
}

async function runHsiLeg() {
  // --stamp, replay callTool: 2 shown pairs (top-2 by hsi_score), 1 written
  // but not shown.
  {
    const scratch = makeHsiScratchRoom();
    try {
      await seedArtifactNodes(scratch.room, scratch.involvedIds);
      const callTool = makeReplayCallTool(stubFixture);
      const rawLines = [];
      const original = process.stdout.write.bind(process.stdout);
      process.stdout.write = (chunk) => { rawLines.push(String(chunk)); return true; };
      try {
        await hsiToGraph.main([scratch.room, '--stamp', '--top', '2'], { callTool });
      } finally {
        process.stdout.write = original;
      }
      const lines = rawLines.join('').split('\n').filter((l) => l.length > 0);

      check('hsi --stamp (replay): shown pairs == stamp blocks == min(top, pairs)', countStampBlocks(lines) === 2, 'got ' + countStampBlocks(lines));
      const result = verificationStampFormat.assertNoScalar(lines);
      check('hsi --stamp (replay): no decimal or percent token on any stdout line', result.withheld === 0, result.withheld + ' withheld');
      check('hsi --stamp (replay): disclosureLine(\'hsi\') is the last line', lines[lines.length - 1] === floorDisclosure.disclosureLine('hsi'));

      const edges = await readHsiConnectionEdges(scratch.room);
      check('hsi --stamp (replay): writes all 3 HSI_CONNECTION edges (the hsi_score<=0.3 write floor is unchanged)', edges.length === 3, 'got ' + edges.length);

      const shownEdge = edges.find((e) => e.source === 'synthetic-355/hsi-pair-a');
      let parsedShown = null;
      let threwShown = false;
      try {
        parsedShown = verificationStamp.fromNodeProps(shownEdge.props);
      } catch (_e) {
        threwShown = true;
      }
      check('hsi --stamp (replay): the shown, resolvable pair stamps strong/theo and re-parses via fromNodeProps', threwShown === false && !!parsedShown && shownEdge.props.verification === 'strong' && shownEdge.props.backend === 'theo');

      const nonShownEdge = edges.find((e) => e.source === 'decisions/data-pipeline-01');
      check('hsi --stamp (replay): the non-shown (3rd) pair carries no stamp properties at all', !!nonShownEdge && !Object.prototype.hasOwnProperty.call(nonShownEdge.props, 'verification'));
    } finally {
      scratch.cleanup();
    }
  }

  // --stamp, null callTool: the resolvable shown pair reports backend
  // unavailable instead of strong (Theo down), still 2 stamp blocks, still
  // no decimal.
  {
    const scratch = makeHsiScratchRoom();
    try {
      await seedArtifactNodes(scratch.room, scratch.involvedIds);
      const callTool = makeNullCallTool();
      const rawLines = [];
      const original = process.stdout.write.bind(process.stdout);
      process.stdout.write = (chunk) => { rawLines.push(String(chunk)); return true; };
      try {
        await hsiToGraph.main([scratch.room, '--stamp', '--top', '2'], { callTool });
      } finally {
        process.stdout.write = original;
      }
      const lines = rawLines.join('').split('\n').filter((l) => l.length > 0);
      check('hsi --stamp (null): shown pairs == stamp blocks', countStampBlocks(lines) === 2, 'got ' + countStampBlocks(lines));
      const result = verificationStampFormat.assertNoScalar(lines);
      check('hsi --stamp (null): no decimal or percent token on any stdout line', result.withheld === 0, result.withheld + ' withheld');
      check('hsi --stamp (null): every unresolved end still renders under its own title with the unverified advice', lines.some((l) => l.indexOf('HSI Pair A') !== -1) && lines.some((l) => l.indexOf(verificationStampFormat.UNVERIFIED_ADVICE) !== -1));

      const edges = await readHsiConnectionEdges(scratch.room);
      const shownEdge = edges.find((e) => e.source === 'synthetic-355/hsi-pair-a');
      check('hsi --stamp (null): the resolvable pair reports backend unavailable (Theo down)', !!shownEdge && shownEdge.props.backend === 'unavailable' && shownEdge.props.reason === 'backend_unavailable');
    } finally {
      scratch.cleanup();
    }
  }

  // Without --stamp: byte-identical -- no HSI_CONNECTION edge carries a
  // stamp property, and stdout carries nothing.
  {
    const scratch = makeHsiScratchRoom();
    try {
      await seedArtifactNodes(scratch.room, scratch.involvedIds);
      const rawLines = [];
      const original = process.stdout.write.bind(process.stdout);
      process.stdout.write = (chunk) => { rawLines.push(String(chunk)); return true; };
      try {
        await hsiToGraph.main([scratch.room], {});
      } finally {
        process.stdout.write = original;
      }
      check('hsi (no --stamp): prints nothing to stdout', rawLines.join('').length === 0);
      const edges = await readHsiConnectionEdges(scratch.room);
      check('hsi (no --stamp): writes all 3 HSI_CONNECTION edges', edges.length === 3, 'got ' + edges.length);
      const anyStamped = edges.some((e) => Object.prototype.hasOwnProperty.call(e.props, 'verification'));
      check('hsi (no --stamp): no edge carries a verification property', anyStamped === false);
    } finally {
      scratch.cleanup();
    }
  }

  // hsiEndpoints/renderHsiFindings exported directly, per the plan's
  // artifacts section.
  check('hsi exports: main, renderHsiFindings, hsiEndpoints are all functions', typeof hsiToGraph.main === 'function' && typeof hsiToGraph.renderHsiFindings === 'function' && typeof hsiToGraph.hsiEndpoints === 'function');
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

(async () => {
  try {
    await runScanLeg();
    await runAnalyzeLeg();
    await runNoveltyLeg();
    await runWhitespaceToGraphStampLeg();
    await runHsiLeg();
  } finally {
    check('installNetGuard: zero fetch attempts', netGuard.attempts() === 0);
    netGuard.restore();
    console.log('scrubVendorKey found a pre-set TYPESAFE_API_KEY: ' + hadKey);
    process.exit(checker.summary());
  }
})();
