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

const whitespaceCommand = require(path.join(REPO, 'scripts', 'whitespace-command.cjs'));
const verificationStamp = require(path.join(REPO, 'lib', 'core', 'verification-stamp.cjs'));
const verificationStampFormat = require(path.join(REPO, 'lib', 'core', 'verification-stamp-format.cjs'));
const directionConvention = require(path.join(REPO, 'lib', 'core', 'direction-convention.cjs'));
const floorDisclosure = require(path.join(REPO, 'lib', 'core', 'floor-disclosure.cjs'));
const { makeReplayCallTool, makeNullCallTool } = require(path.join(REPO, 'tests', 'helpers', 'theo-replay-355.cjs'));

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
// Run
// ---------------------------------------------------------------------------

(async () => {
  try {
    await runScanLeg();
    await runAnalyzeLeg();
    await runNoveltyLeg();
  } finally {
    check('installNetGuard: zero fetch attempts', netGuard.attempts() === 0);
    netGuard.restore();
    console.log('scrubVendorKey found a pre-set TYPESAFE_API_KEY: ' + hadKey);
    process.exit(checker.summary());
  }
})();
