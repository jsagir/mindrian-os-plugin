#!/usr/bin/env node
'use strict';

/**
 * Phase 83-08: Honesty layer markdown test.
 *
 * Asserts that skills/larry-personality/SKILL.md contains the "## Honesty
 * about memory" section with the no-fake-recall rule, the forbidden phrase
 * documented as forbidden, and at least one CORRECT and one INCORRECT example
 * with the CORRECT block appearing lexically before the INCORRECT block.
 */

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert');

const REPO_ROOT = path.resolve(__dirname, '..');
const SKILL_PATH = path.join(
  REPO_ROOT,
  'skills',
  'larry-personality',
  'SKILL.md'
);

const src = fs.readFileSync(SKILL_PATH, 'utf8');

let failures = 0;
function check(name, cond) {
  if (cond) {
    process.stdout.write('ok ' + name + '\n');
  } else {
    process.stderr.write('FAIL ' + name + '\n');
    failures += 1;
  }
}

check(
  'SKILL.md contains "## Honesty about memory" heading',
  src.includes('## Honesty about memory')
);

check(
  'SKILL.md contains "### No fake recall" sub-heading',
  src.includes('### No fake recall')
);

check(
  'SKILL.md contains the forbidden phrase (as forbidden)',
  src.includes('"I do not have that in working memory"')
);

const firstCorrect = src.indexOf('CORRECT:');
const firstIncorrect = src.indexOf('INCORRECT:');

check('SKILL.md contains at least one CORRECT: block', firstCorrect !== -1);
check('SKILL.md contains at least one INCORRECT: block', firstIncorrect !== -1);

check(
  'first CORRECT: block appears before first INCORRECT: block',
  firstCorrect !== -1 && firstIncorrect !== -1 && firstCorrect < firstIncorrect
);

// Sanity: forbidden phrase must live AFTER the honesty heading, not before.
const honestyIdx = src.indexOf('## Honesty about memory');
const forbiddenIdx = src.indexOf('"I do not have that in working memory"');
check(
  'forbidden phrase is inside the Honesty about memory section',
  honestyIdx !== -1 && forbiddenIdx !== -1 && forbiddenIdx > honestyIdx
);

if (failures === 0) {
  process.stdout.write('\n83-honesty-layer: all assertions passed\n');
  process.exit(0);
} else {
  process.stderr.write(
    '\n83-honesty-layer: ' + failures + ' assertion(s) failed\n'
  );
  process.exit(1);
}
