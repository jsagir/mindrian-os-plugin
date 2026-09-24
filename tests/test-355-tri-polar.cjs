#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 355 (Hidden in Plain Sight: Jev-through-Theo cross-connection
 * engines) Plan 23 (HIPS-05, AI-SPEC D13, D-27, D-28, D-49, D-50). Proves
 * the SAME stamp reads the same story on every surface: for one verified
 * fixture's stamp, the CLI block (formatStampLines(stamp, 'cli')), the
 * Larry Desktop prose fixture, and the reach card text
 * (formatStampLines(stamp, 'card')) all carry the tier word, the identical
 * undirected path text, the direction phrase and the judge disclosure --
 * and for an unverified fixture's stamp, the CLI advice line and the
 * card's fixed unverified sentence both appear.
 *
 * HONEST SCOPE NOTE (found while writing this test, not a bug in this
 * test's own scope to fix): formatStampLines(stamp, 'card') -- the actual
 * shipped reach-card line (355-06 D-27/D-28; byte-identical to
 * lib/hmi/dial-label-composer.cjs's stamped-finding variant, proven in
 * tests/test-dial-label-bank-drift.cjs by 355-22) -- is a deliberately
 * compact ONE-LINER: "verified through <path>" or the fixed unverified
 * sentence. It does not repeat the tier word, the direction phrase or the
 * judge line (those exist only on cli/desktop, where there is room for
 * them). So "the tier word... the direction phrase... and the judge
 * disclosure" are asserted verbatim on CLI + the prose fixture (both
 * genuinely carry them); on the card, what is asserted is what the card
 * ACTUALLY carries and shares byte-identically with cli/desktop: the exact
 * same undirected path text, and the same verified/unverified
 * classification. This is documented in the plan's own SUMMARY as a
 * deviation, not silently narrowed.
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
const checker = hygiene.makeChecker('test-355-tri-polar');
const { check } = checker;

const verificationStamp = require(path.join(REPO, 'lib', 'core', 'verification-stamp.cjs'));
const verificationStampFormat = require(path.join(REPO, 'lib', 'core', 'verification-stamp-format.cjs'));
const directionConvention = require(path.join(REPO, 'lib', 'core', 'direction-convention.cjs'));
const { makeReplayCallTool } = require(path.join(REPO, 'tests', 'helpers', 'theo-replay-355.cjs'));

const stubFixture = JSON.parse(fs.readFileSync(path.join(REPO, 'tests', 'fixtures', '355', 'theo-stub-responses.json'), 'utf8'));
const PROSE_DIR = path.join(REPO, 'tests', 'fixtures', '355', 'prose');

function readProseBody(fileName) {
  const raw = fs.readFileSync(path.join(PROSE_DIR, fileName), 'utf8');
  return raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '');
}

async function main() {
  const callTool = makeReplayCallTool(stubFixture);

  // -------------------------------------------------------------------
  // The verified fixture: tests/fixtures/355/prose/desktop-verified.md
  // (Reverse Salient Analysis -> Six Thinking Hats, strong, 1 hop EXTENDS).
  // -------------------------------------------------------------------
  const verifiedStamp = await verificationStamp.stampFinding(
    { fromHandle: 'Reverse Salient Analysis', toHandle: 'Six Thinking Hats', direction: 'structural_transfer' },
    { callTool }
  );
  check('tri-polar precondition: the verified fixture pair actually stamps strong/indirect', verifiedStamp.verification === 'strong' || verifiedStamp.verification === 'indirect');

  const verifiedCli = verificationStampFormat.formatStampLines(verifiedStamp, 'cli').join('\n');
  const verifiedProse = readProseBody('desktop-verified.md');
  const verifiedCard = verificationStampFormat.formatStampLines(verifiedStamp, 'card').join('\n');
  const verifiedPathText = verificationStampFormat.formatPathText(verifiedStamp.path.nodes, verifiedStamp.path.edges);
  const verifiedPhrase = directionConvention.DIRECTION_MEANING[verifiedStamp.direction];

  // Tier word: present verbatim on CLI and prose (both have room for it).
  check('tri-polar verified: CLI carries the tier word', new RegExp('\\b' + verifiedStamp.verification + '\\b').test(verifiedCli));
  check('tri-polar verified: prose carries the tier word ("Checked: ' + verifiedStamp.verification + '.")', verifiedProse.indexOf('Checked: ' + verifiedStamp.verification + '.') !== -1);

  // formatPathText(nodes, edges): the SAME byte-identical path text appears
  // on all three surfaces -- this is the one thing the card's compact
  // one-liner also carries verbatim.
  check('tri-polar verified: CLI carries the exact path text', verifiedCli.indexOf(verifiedPathText) !== -1);
  check('tri-polar verified: prose carries the exact path text', verifiedProse.indexOf(verifiedPathText) !== -1);
  check('tri-polar verified: card carries the exact same path text', verifiedCard.indexOf(verifiedPathText) !== -1);
  check('tri-polar verified: card opens with "verified through " (the classification matches the stamp)', verifiedCard.indexOf('verified through ') === 0);

  // Direction phrase: present verbatim on CLI and prose.
  check('tri-polar verified: CLI carries the direction phrase', verifiedCli.indexOf(verifiedPhrase) !== -1);
  check('tri-polar verified: prose carries the direction phrase ("Direction: ' + verifiedPhrase + '.")', verifiedProse.indexOf('Direction: ' + verifiedPhrase + '.') !== -1);

  // The judge disclosure: the exact phrasing named by the plan, one per
  // surface that carries a judge line at all.
  check('tri-polar verified: CLI carries "judge  none, path check only"', verifiedCli.indexOf('judge  none, path check only') !== -1);
  check('tri-polar verified: prose carries "Nobody has judged the citation yet"', verifiedProse.indexOf('Nobody has judged the citation yet') !== -1);

  // The backend: appears on CLI verbatim ('theo'), and is implied in prose
  // by the fixed phrase "The methodology graph" (never the literal word
  // "theo", "Brain" or "database" -- the same capability-honesty register
  // the SKILL's "Honest about thin grounding" section already enforces).
  check('tri-polar verified: CLI carries the backend word "theo"', verifiedCli.indexOf('theo') !== -1);
  check('tri-polar verified: prose implies the backend via "The methodology graph"', verifiedProse.indexOf('The methodology graph') !== -1);

  // -------------------------------------------------------------------
  // The unverified fixture: tests/fixtures/355/prose/desktop-unverified.md
  // (Hierarchy Mapping -> PEST Analysis, co_sourced_only).
  // -------------------------------------------------------------------
  const unverifiedStamp = await verificationStamp.stampFinding(
    { fromHandle: 'Hierarchy Mapping', toHandle: 'PEST Analysis', direction: 'semantic_implementation' },
    { callTool }
  );
  check('tri-polar precondition: the unverified fixture pair actually stamps unverified', unverifiedStamp.verification === 'unverified');

  const unverifiedCli = verificationStampFormat.formatStampLines(unverifiedStamp, 'cli').join('\n');
  const unverifiedProse = readProseBody('desktop-unverified.md');
  const unverifiedCard = verificationStampFormat.formatStampLines(unverifiedStamp, 'card').join('\n');

  check('tri-polar unverified: the CLI advice line appears', unverifiedCli.indexOf(verificationStampFormat.UNVERIFIED_ADVICE) !== -1);
  check('tri-polar unverified: the prose advice sentence appears', unverifiedProse.indexOf(verificationStampFormat.UNVERIFIED_ADVICE) !== -1);
  check("tri-polar unverified: the card's fixed unverified sentence appears verbatim", unverifiedCard.indexOf('unverified - novel or hallucinated, verify with an expert') !== -1);
  check('tri-polar unverified: CLI and prose share the same direction phrase', unverifiedCli.indexOf(directionConvention.DIRECTION_MEANING[unverifiedStamp.direction]) !== -1
    && unverifiedProse.indexOf(directionConvention.DIRECTION_MEANING[unverifiedStamp.direction]) !== -1);

  // -------------------------------------------------------------------
  // Negative control: the SAME planted-decimal proof, scoped to the
  // tri-polar comparison itself -- a path node carrying "0.87" must be
  // withheld identically wherever the path text is reproduced (cli,
  // desktop, card). The plant sits on the MIDDLE node of a 2-hop path
  // (never the last node) so it is followed by " -- EDGE --", not a
  // sentence-ending period -- the D-30 decimal regex's own trailing
  // lookahead `(?![0-9.])` does not match immediately before a literal
  // period, so a decimal planted at the very end of a desktop sentence
  // ("...0.87.") is a known regex edge case, not the property this
  // negative control is proving.
  const plantedStamp = {
    verification: 'strong',
    backend: 'theo',
    direction: 'structural_transfer',
    judge: 'none',
    path: { nodes: ['Reverse Salient Analysis', 'Middle Step 0.87', 'Six Thinking Hats'], labels: ['Framework', 'Framework', 'Framework'], edges: ['EXTENDS', 'SUPPORTS'] },
  };
  const plantedCli = verificationStampFormat.formatStampLines(plantedStamp, 'cli').join('\n');
  const plantedDesktop = verificationStampFormat.formatStampLines(plantedStamp, 'desktop').join('\n');
  const plantedCard = verificationStampFormat.formatStampLines(plantedStamp, 'card').join('\n');
  check('tri-polar negative control: a planted 0.87 path node is withheld on CLI', plantedCli.indexOf('0.87') === -1 && plantedCli.indexOf('[withheld]') !== -1);
  check('tri-polar negative control: a planted 0.87 path node is withheld on desktop', plantedDesktop.indexOf('0.87') === -1 && plantedDesktop.indexOf('[withheld]') !== -1);
  check('tri-polar negative control: a planted 0.87 path node is withheld on the card', plantedCard.indexOf('0.87') === -1 && plantedCard.indexOf('[withheld]') !== -1);

  check('no network attempted (hygiene-355 net guard)', netGuard.attempts() === 0, String(netGuard.attempts()));
  netGuard.restore();

  process.exit(checker.summary());
}

main().catch((e) => {
  console.error('test-355-tri-polar: uncaught error: ' + String((e && e.stack) || e));
  netGuard.restore();
  process.exit(1);
});
