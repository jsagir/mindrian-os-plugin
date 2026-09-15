#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 345-08 Task 3 -- test-345-doctrine: pins the amended anti-circular
 * paragraph in skills/larry-personality/SKILL.md (the strategy node named as
 * the owner of the room-level reframe, phrased in the observing voice, no
 * reach count named), its byte-for-byte parity across both dist/ mirrors,
 * and the two section-contract Inputs pointers + the corrected
 * problem-definition.md rung prose (345-ICM-CONSULT R6).
 *
 * The paragraph is extracted by CONTENT (the line containing the literal
 * "anti-circular rule", through the next blank line), never by a hardcoded
 * line number, so the parity leg survives Phase 344's frontmatter edits
 * landing on the same three files.
 *
 * Bare node script, no framework, exits non-zero on any assertion failure,
 * self-contained. House rule: hyphens only, no em-dashes.
 *
 * Run: node tests/test-345-doctrine.cjs
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');

const SKILL_SRC = path.join(REPO, 'skills', 'larry-personality', 'SKILL.md');
const SKILL_GENERIC = path.join(
  REPO, 'dist', 'generic-claude-dir', '.claude', 'skills', 'larry-personality', 'SKILL.md'
);
const SKILL_ZED = path.join(REPO, 'dist', 'zed', '.agents', 'skills', 'larry-personality', 'SKILL.md');
const PROBLEM_DEFINITION = path.join(
  REPO, 'templates', 'room-skeleton', 'section-contracts', 'problem-definition.md'
);
const STRATEGY_CONTRACT = path.join(REPO, 'templates', 'room-skeleton', 'section-contracts', 'strategy.md');

// The explicit five-element em-dash guard file list (NOT a glob): a file this
// plan did not write must never be able to redden this test.
const EMDASH_FILES = [SKILL_SRC, SKILL_GENERIC, SKILL_ZED, PROBLEM_DEFINITION, STRATEGY_CONTRACT];

let checks = 0;
function ok(label) {
  checks += 1;
  console.log('  ok - ' + label);
}

function readText(p) {
  return fs.readFileSync(p, 'utf8');
}

// Locate the line containing `marker`, then collect lines from there through
// (not including) the next blank line. Content-addressed, never line-number-
// addressed, so it survives an unrelated frontmatter-length change upstream.
function extractParagraph(text, marker) {
  const lines = text.split('\n');
  const startIdx = lines.findIndex((l) => l.includes(marker));
  if (startIdx === -1) return null;
  const collected = [];
  for (let i = startIdx; i < lines.length; i++) {
    if (lines[i].trim() === '') break;
    collected.push(lines[i]);
  }
  return collected.join('\n');
}

function countOccurrences(text, literal) {
  let count = 0;
  let idx = text.indexOf(literal);
  while (idx !== -1) {
    count += 1;
    idx = text.indexOf(literal, idx + literal.length);
  }
  return count;
}

function main() {
  // ===========================================================================
  // The anti-circular rule appears exactly once in the source SKILL.md.
  // ===========================================================================

  const skillText = readText(SKILL_SRC);
  const anticircularCount = countOccurrences(skillText, 'anti-circular rule');
  assert.equal(anticircularCount, 1, 'anti-circular rule must appear exactly once, found ' + anticircularCount);
  ok('SKILL.md contains the literal "anti-circular rule" exactly once');

  // ===========================================================================
  // The paragraph carrying that literal carries the four required ideas and
  // never names a specific reach count.
  // ===========================================================================

  const paragraph = extractParagraph(skillText, 'anti-circular rule');
  assert.ok(paragraph, 'the anti-circular rule paragraph must be extractable by content');
  ok('the anti-circular rule paragraph was extracted by content, not by line number');

  assert.ok(paragraph.includes('strategy node'), 'the paragraph must name "strategy node"');
  ok('the paragraph names "strategy node" as the owner of the room-level reframe');

  assert.ok(paragraph.includes('4645:4703'), 'the paragraph must cite the graph-engineering source offset 4645:4703');
  ok('the paragraph cites the graph-engineering source at 4645:4703');

  assert.ok(
    paragraph.includes("when the engine surfaces the strategy reach, Larry's move is the climb"),
    'the paragraph must be phrased in the observing voice (engine decides, Larry observes)'
  );
  ok('the paragraph is phrased in the observing voice, not as something Larry computes');

  const digitReachesMatch = paragraph.match(/\d+\s+reaches\b/);
  assert.equal(digitReachesMatch, null, 'the paragraph must not name a specific number of reaches');
  ok('the paragraph names no specific number of reaches (the constant lives in goal-cadence.cjs)');

  // ===========================================================================
  // Three-copy byte parity on the extracted paragraph (survives an unrelated
  // frontmatter-length divergence between the source and either mirror).
  // ===========================================================================

  const genericParagraph = extractParagraph(readText(SKILL_GENERIC), 'anti-circular rule');
  const zedParagraph = extractParagraph(readText(SKILL_ZED), 'anti-circular rule');
  assert.ok(genericParagraph, 'the dist/generic-claude-dir mirror must carry the same paragraph');
  assert.ok(zedParagraph, 'the dist/zed mirror must carry the same paragraph');
  assert.equal(genericParagraph, paragraph, 'dist/generic-claude-dir mirror paragraph must be byte-identical to the source');
  assert.equal(zedParagraph, paragraph, 'dist/zed mirror paragraph must be byte-identical to the source');
  ok('the extracted paragraph is byte-identical across the source file and both dist/ mirrors');

  // ===========================================================================
  // problem-definition.md: one jtbd-state.json pointer, the stale three-rung-
  // plus-escalation sentence is gone.
  // ===========================================================================

  const problemDefText = readText(PROBLEM_DEFINITION);
  assert.equal(
    countOccurrences(problemDefText, 'jtbd-state.json'), 1,
    'problem-definition.md must carry exactly one jtbd-state.json pointer'
  );
  ok('problem-definition.md carries exactly one jtbd-state.json pointer');

  assert.equal(
    countOccurrences(problemDefText, 'not a fourth, co-equal rung'), 0,
    'problem-definition.md must no longer contradict the persisted four-rung vocabulary'
  );
  ok('problem-definition.md no longer contains the stale "not a fourth, co-equal rung" sentence');

  // ===========================================================================
  // strategy.md: one jtbd-state.json pointer.
  // ===========================================================================

  const strategyText = readText(STRATEGY_CONTRACT);
  assert.equal(
    countOccurrences(strategyText, 'jtbd-state.json'), 1,
    'strategy.md must carry exactly one jtbd-state.json pointer'
  );
  ok('strategy.md carries exactly one jtbd-state.json pointer');

  // ===========================================================================
  // All five files this plan touches carry zero em-dashes.
  // ===========================================================================

  for (const f of EMDASH_FILES) {
    const text = readText(f);
    const hasEmDash = text.indexOf('\u2014') !== -1;
    assert.equal(hasEmDash, false, f + ' must contain zero em-dashes');
  }
  ok('all five files this plan touches contain zero em-dashes');

  console.log('');
  console.log('Checks: ' + checks);
  console.log('PASS test-345-doctrine.cjs');
}

main();
