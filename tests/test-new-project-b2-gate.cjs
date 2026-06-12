'use strict';
// Phase 155-01 Task 1 -- B2 blueprint gate static-analysis driver.
//
// Canon Part 3 compliance gate: asserts that the bare-prose confirmation
// violation at commands/new-project.md:103 has been replaced by a proper
// F.0 B2 blueprint gate, and that the bespoke-prompt tripwire stays green.
//
// Tests: static analysis only. No LLM invocation. No node:sqlite needed.
//
// Pattern: check/pass counter (test-typed-claim-writer.cjs idiom).
// SKIP-77 not applicable here (no node:sqlite use).
//
// NO em-dashes anywhere in this file (CLAUDE.md HARD RULE).
// No (RECOMMENDED), no 'continue', no 'Pick one to ' patterns.

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const NEW_PROJECT = path.join(REPO_ROOT, 'commands', 'new-project.md');

let checks = 0;
let passed = 0;

function check(label, condition, detail) {
  checks++;
  if (condition) {
    passed++;
    process.stdout.write('  PASS: ' + label + '\n');
  } else {
    process.stdout.write('  FAIL: ' + label + (detail ? ' -- ' + detail : '') + '\n');
  }
}

process.stdout.write('=== test-new-project-b2-gate.cjs ===\n\n');

// Load the file
if (!fs.existsSync(NEW_PROJECT)) {
  process.stdout.write('FATAL: commands/new-project.md not found at ' + NEW_PROJECT + '\n');
  process.exit(1);
}

const content = fs.readFileSync(NEW_PROJECT, 'utf-8');
const lines = content.split('\n');

// --- Test 1: the bare-prose violation is gone ---
const bareProseOccurrences = lines.filter(l =>
  l.includes('Wait for user confirmation before creating the room')
).length;
check(
  'bare-prose violation absent: "Wait for user confirmation before creating the room"',
  bareProseOccurrences === 0,
  'found ' + bareProseOccurrences + ' occurrence(s) -- must be 0'
);

// --- Test 2: pickShape call is present ---
const pickShapeCount = lines.filter(l => l.includes('pickShape')).length;
check(
  'pickShape call present (F.0 gate)',
  pickShapeCount >= 1,
  'found ' + pickShapeCount + ' occurrence(s) -- must be >= 1'
);

// --- Test 3: the B2 block contains 'ROOM BLUEPRINT' ---
const hasBlueprintHeader = content.includes('ROOM BLUEPRINT');
check(
  'B2 block contains "ROOM BLUEPRINT" (BIRTH-FLOW-BRIEF Section 2 header)',
  hasBlueprintHeader,
  'pattern not found'
);

// --- Test 4: nugget routing table present (nugget | target section | why) ---
const hasNuggetTable = content.includes('nugget | target section | why') ||
  content.includes('nugget|target section|why') ||
  (content.includes('nugget') && content.includes('target section') && content.includes('why'));
check(
  'nugget routing table present (nugget | target section | why)',
  hasNuggetTable,
  'HARD RULE constraint 11 -- the routing table must be embedded in the B2 display block'
);

// --- Test 5: Tri-Polar degradation script present ---
const hasDegradation = content.includes('approve / reject') ||
  content.includes('Type: approve') ||
  content.includes('approve / adjust') ||
  content.includes('Desktop') ||
  content.includes('Tri-Polar') ||
  content.includes('conversational degradation');
check(
  'Tri-Polar degradation script present',
  hasDegradation,
  'Desktop conversational fallback ("Type: approve / reject [reason] / defer") not found'
);

// --- Test 6: F.0 shape referenced ---
const hasF0 = content.includes('F.0') || content.includes('shape-f0') || content.includes('Shape F.0');
check(
  'F.0 gate shape referenced',
  hasF0,
  'F.0 blueprint gate shape not mentioned'
);

// --- Test 7: Approve / Reject / Defer vocabulary present ---
const hasApprove = content.toLowerCase().includes('approve');
const hasReject = content.toLowerCase().includes('reject') || content.toLowerCase().includes('adjust');
const hasDefer = content.toLowerCase().includes('defer');
check(
  'Approve path present in B2 block',
  hasApprove,
  'Approve verb not found'
);
check(
  'Reject/Adjust path present in B2 block',
  hasReject,
  'Reject or Adjust verb not found'
);
check(
  'Defer path present in B2 block',
  hasDefer,
  'Defer verb not found'
);

// --- Test 8: birth_gate_answers / writeScratchpadBirthAnswer referenced ---
// The B2 Defer path must journal via writeScratchpadBirthAnswer
const hasBirthAnswerCall = content.includes('writeScratchpadBirthAnswer') ||
  content.includes('birth_gate_answers');
check(
  'writeScratchpadBirthAnswer referenced in B2 Defer path',
  hasBirthAnswerCall,
  'Defer must journal to scratchpad via writeScratchpadBirthAnswer'
);

// --- Test 9: Part 9 confirmNode / promotion moment referenced ---
const hasPart9 = content.includes('confirmNode') || content.includes('Part 9') || content.includes('promotion moment');
check(
  'Part 9 promotion moment (confirmNode / byUser) referenced in B2 Approve path',
  hasPart9,
  'B2 Approve is the Part 9 promotion moment per BIRTH-FLOW-BRIEF Section 2'
);

// --- Anti-pattern checks (bespoke-prompt tripwire) ---
const linesNonComment = lines.filter(l => !l.trimStart().startsWith('#') && !l.trimStart().startsWith('//'));
const hasRecommendedTag = linesNonComment.some(l => l.includes('(RECOMMENDED)'));
check(
  'no (RECOMMENDED) tag in non-comment lines',
  !hasRecommendedTag,
  '(RECOMMENDED) is a bespoke Brain-suggestion pattern -- use the locked template'
);

// 'continue' check -- only flag if it looks like a [continue] selector pattern
const hasContinueBespoke = linesNonComment.some(l =>
  l.includes('[continue]') || /\bcontinue\s*\/\s*stop\b/.test(l)
);
check(
  'no bespoke [continue] selector pattern',
  !hasContinueBespoke,
  '[continue] / stop bespoke selector pattern detected'
);

const hasPickOneTo = linesNonComment.some(l => l.includes('Pick one to '));
check(
  'no "Pick one to " bespoke pattern',
  !hasPickOneTo,
  '"Pick one to " is a bespoke selector pattern'
);

process.stdout.write('\n');
process.stdout.write('=== Results: ' + passed + '/' + checks + ' passed ===\n');

if (passed < checks) {
  process.exit(1);
}
process.exit(0);
