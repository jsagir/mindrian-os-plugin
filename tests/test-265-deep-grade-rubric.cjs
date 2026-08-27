#!/usr/bin/env node
// Phase 265-20 (RADAR-23) -- rubric-consistency tripwire for /mos:deep-grade.
//
// THE FINDING THIS TEST DEFENDS (two sentences): three numbers were in play across
// four files for deep-grade's rubric -- agents/grading.md said SEVEN components while
// commands/deep-grade.md and commands/grade.md both independently said FIVE, and a
// fourth file (references/methodology/grade.md) genuinely defines a DIFFERENT SIX-component
// static rubric for /mos:grade's Brain-less path that must never be folded into this check.
// Plan 265-20 reconciled the seven down to five; this test pins count, names, and weight
// sum across the three deep-grade-rubric files so that reconciliation cannot silently
// drift apart again, and separately asserts the panel's calibrate-once-before-fan-out shape.
//
// Four arms:
//   1. COUNT AGREEMENT (load-bearing) -- the stated deep-grade component count agrees
//      across agents/grading.md, commands/deep-grade.md, commands/grade.md.
//      references/methodology/grade.md is explicitly EXCLUDED: it defines a genuinely
//      different, Brain-less, six-component static rubric for /mos:grade, not a fourth
//      opinion about deep-grade's rubric.
//   2. NAME AGREEMENT -- the component NAMES in agents/grading.md's scoring table match
//      the component NAMES commands/deep-grade.md names in its own rubric sentence. A
//      matching count with mismatched names is the subtler version of the same bug.
//   3. WEIGHT SUM -- the per-component weights in agents/grading.md's scoring table sum
//      to exactly 100. Dropping a component during a future reconciliation and forgetting
//      to redistribute its weight silently deflates every grade.
//   4. PANEL SHAPE -- commands/deep-grade.md contains consolidatePanel, states that
//      disputes render above the score, contains zero run_in_background occurrences, and
//      pulls brain_grade_calibrate (Phase 0) strictly BEFORE the Dispatching status block
//      (Phase 1) -- calibration happens once, before the fan-out, never per agent.
//
// Plain Node text-analysis script, no node:test. Hyphens only (no em-dashes).
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const GRADING_AGENT = path.join(ROOT, 'agents', 'grading.md');
const DEEP_GRADE = path.join(ROOT, 'commands', 'deep-grade.md');
const GRADE = path.join(ROOT, 'commands', 'grade.md');
// EXCLUDED DELIBERATELY (arm 1 comment, and see header): this file's six-component
// rubric belongs to /mos:grade's separate Brain-less static path, not deep-grade.
const METHODOLOGY_GRADE = path.join(ROOT, 'references', 'methodology', 'grade.md');

let pass = 0;
let fail = 0;
const failures = [];

function recordPass(label) {
  pass += 1;
  console.log('PASS: ' + label);
}

function recordFail(armLabel, message) {
  fail += 1;
  failures.push(armLabel + ': ' + message);
  console.error('FAIL (' + armLabel + '): ' + message);
}

function readFile(p) {
  return fs.readFileSync(p, 'utf8');
}

// ---------------------------------------------------------------------------
// Arm 1 helpers -- each file's deep-grade component count is pinned to the
// SPECIFIC sentence this plan authored (not a naive global "N component"
// scan, which would also match /mos:grade's own separate 6-component static
// rubric mentioned inside commands/grade.md itself, e.g. its frontmatter
// `description: ... (6 components)` and its "static 6-component rubric"
// prose -- both correctly excluded here by anchoring to the deep-grade-
// specific phrasing rather than any bare "N component" occurrence).
// ---------------------------------------------------------------------------

function extractGradingAgentCount(text) {
  const m = /Score\s+(\d+)\s+Rubric\s+Components?/i.exec(text);
  return m ? Number(m[1]) : null;
}

function extractDeepGradeCount(text) {
  const m = /(\d+)-component\s+weighted/i.exec(text);
  return m ? Number(m[1]) : null;
}

function extractGradeCount(text) {
  const m = /calibrated\s+(\d+)-component\s+assessment/i.exec(text);
  return m ? Number(m[1]) : null;
}

// ---------------------------------------------------------------------------
// Arm 2 / 3 helper -- parse the "### Rubric Scores" markdown table in
// agents/grading.md's Output Format template. Returns [{name, weight}].
// Skips the header row, the separator row, and the **Total** row.
// ---------------------------------------------------------------------------
function extractScoringTable(text) {
  const lines = text.split(/\r?\n/);
  const startIdx = lines.findIndex((l) => /^###\s*Rubric Scores/i.test(l.trim()));
  if (startIdx === -1) return [];
  const rows = [];
  for (let i = startIdx + 1; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (/^###\s/.test(line)) break; // next section, stop
    if (!line.startsWith('|')) continue;
    const cells = line.split('|').map((c) => c.trim()).filter((c, idx, arr) => !(idx === 0 && c === '') && !(idx === arr.length - 1 && c === ''));
    if (cells.length < 3) continue;
    const name = cells[0].replace(/\*/g, '').trim();
    if (/^section$/i.test(name)) continue; // header row
    if (/^-+$/.test(name)) continue; // separator row
    if (/^total$/i.test(name)) continue; // total row, not a component
    const weightCell = cells[2].replace(/\*/g, '').trim();
    const weightMatch = /^(\d+)%$/.exec(weightCell);
    if (!weightMatch) continue; // Total row's weight column is blank, skips naturally
    rows.push({ name, weight: Number(weightMatch[1]) });
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Arm 2 helper -- extract the component NAMES from commands/deep-grade.md's
// own rubric sentence: "its five rubric components (Vision 20%, Problem
// Definition 25%, ..., Completeness 15%)". Collapses whitespace first since
// the sentence wraps across source lines.
// ---------------------------------------------------------------------------
function extractDeepGradeComponentNames(text) {
  const collapsed = text.replace(/\s+/g, ' ');
  const m = /\(([A-Za-z][A-Za-z ]+\d+%(?:,\s*[A-Za-z][A-Za-z ]+\d+%)+)\)/.exec(collapsed);
  if (!m) return [];
  return m[1].split(',').map((part) => part.trim().replace(/\s*\d+%$/, '').trim());
}

function normalizeName(n) {
  return String(n || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

// ===========================================================================
// ARM 1: COUNT AGREEMENT
// ===========================================================================
const gradingText = readFile(GRADING_AGENT);
const deepGradeText = readFile(DEEP_GRADE);
const gradeText = readFile(GRADE);

const gradingCount = extractGradingAgentCount(gradingText);
const deepGradeCount = extractDeepGradeCount(deepGradeText);
const gradeCount = extractGradeCount(gradeText);

console.log('extracted counts: agents/grading.md=' + gradingCount
  + ', commands/deep-grade.md=' + deepGradeCount
  + ', commands/grade.md=' + gradeCount
  + ' (references/methodology/grade.md excluded: separate six-component static rubric)');

if (gradingCount === null || deepGradeCount === null || gradeCount === null) {
  recordFail('ARM 1 (count agreement)', 'could not extract a component count from one or more files: '
    + JSON.stringify({ gradingCount, deepGradeCount, gradeCount }));
} else if (gradingCount === deepGradeCount && deepGradeCount === gradeCount) {
  recordPass('ARM 1 -- component count agrees across all three files (' + gradingCount + ')');
} else {
  recordFail('ARM 1 (count agreement)', 'component counts disagree: agents/grading.md=' + gradingCount
    + ', commands/deep-grade.md=' + deepGradeCount + ', commands/grade.md=' + gradeCount);
}

// Sanity: prove METHODOLOGY_GRADE is genuinely excluded from this arm (not silently
// read at all), and that it still exists on disk with its own separate six.
if (!fs.existsSync(METHODOLOGY_GRADE)) {
  recordFail('ARM 1 (exclusion sanity)', 'references/methodology/grade.md is missing on disk');
} else {
  recordPass('ARM 1 -- references/methodology/grade.md exists and was NOT read for the count-agreement check');
}

// ===========================================================================
// ARM 2: NAME AGREEMENT
// ===========================================================================
const scoringTable = extractScoringTable(gradingText);
const deepGradeNames = extractDeepGradeComponentNames(deepGradeText);

if (scoringTable.length === 0) {
  recordFail('ARM 2 (name agreement)', 'could not parse agents/grading.md\'s ### Rubric Scores table');
} else if (deepGradeNames.length === 0) {
  recordFail('ARM 2 (name agreement)', 'could not parse commands/deep-grade.md\'s component-name sentence');
} else {
  const tableNames = new Set(scoringTable.map((r) => normalizeName(r.name)));
  const sentenceNames = new Set(deepGradeNames.map(normalizeName));
  const missingFromSentence = [...tableNames].filter((n) => !sentenceNames.has(n));
  const missingFromTable = [...sentenceNames].filter((n) => !tableNames.has(n));
  console.log('agents/grading.md table names: ' + JSON.stringify([...tableNames]));
  console.log('commands/deep-grade.md sentence names: ' + JSON.stringify([...sentenceNames]));
  if (missingFromSentence.length === 0 && missingFromTable.length === 0) {
    recordPass('ARM 2 -- component names agree between agents/grading.md and commands/deep-grade.md');
  } else {
    recordFail('ARM 2 (name agreement)', 'name sets differ: missing from deep-grade.md=' + JSON.stringify(missingFromSentence)
      + ', missing from grading.md table=' + JSON.stringify(missingFromTable));
  }
}

// ===========================================================================
// ARM 3: WEIGHT SUM
// ===========================================================================
if (scoringTable.length === 0) {
  recordFail('ARM 3 (weight sum)', 'no scoring table rows to sum (see ARM 2 failure above)');
} else {
  const sum = scoringTable.reduce((acc, r) => acc + r.weight, 0);
  console.log('agents/grading.md weight sum: ' + JSON.stringify(scoringTable) + ' = ' + sum);
  if (sum === 100) {
    recordPass('ARM 3 -- agents/grading.md scoring table weights sum to exactly 100');
  } else {
    recordFail('ARM 3 (weight sum)', 'weights sum to ' + sum + ', not 100: ' + JSON.stringify(scoringTable));
  }
}

// ===========================================================================
// ARM 4: PANEL SHAPE
// ===========================================================================
const hasConsolidatePanel = deepGradeText.includes('consolidatePanel');
const hasDisputesAboveScore = /disputes[\s\S]{0,80}(?:render|rendered)[\s\S]{0,40}ABOVE the percentage/i.test(deepGradeText)
  || /render[\s\S]{0,40}ABOVE the percentage/i.test(deepGradeText);
const runInBackgroundCount = (deepGradeText.match(/run_in_background/g) || []).length;
const calibrateIdx = deepGradeText.indexOf('brain_grade_calibrate');
const dispatchingIdx = deepGradeText.indexOf('Dispatching');

console.log('ARM 4 shape check: consolidatePanel=' + hasConsolidatePanel
  + ', disputesAboveScore=' + hasDisputesAboveScore
  + ', run_in_background count=' + runInBackgroundCount
  + ', brain_grade_calibrate offset=' + calibrateIdx
  + ', Dispatching offset=' + dispatchingIdx);

if (!hasConsolidatePanel) {
  recordFail('ARM 4 (panel shape)', 'commands/deep-grade.md does not mention consolidatePanel');
} else {
  recordPass('ARM 4 -- commands/deep-grade.md names consolidatePanel');
}

if (!hasDisputesAboveScore) {
  recordFail('ARM 4 (panel shape)', 'commands/deep-grade.md does not state that disputes render above the percentage');
} else {
  recordPass('ARM 4 -- commands/deep-grade.md states disputes render above the percentage');
}

if (runInBackgroundCount !== 0) {
  recordFail('ARM 4 (panel shape)', 'commands/deep-grade.md contains ' + runInBackgroundCount + ' occurrence(s) of run_in_background, expected 0');
} else {
  recordPass('ARM 4 -- commands/deep-grade.md contains zero run_in_background occurrences');
}

if (calibrateIdx === -1 || dispatchingIdx === -1) {
  recordFail('ARM 4 (panel shape)', 'could not find both brain_grade_calibrate and Dispatching in commands/deep-grade.md');
} else if (calibrateIdx < dispatchingIdx) {
  recordPass('ARM 4 -- brain_grade_calibrate is pulled before the Dispatching status block (calibrate once, before the fan)');
} else {
  recordFail('ARM 4 (panel shape)', 'brain_grade_calibrate (offset ' + calibrateIdx + ') does not precede Dispatching (offset ' + dispatchingIdx + ')');
}

// ---------------------------------------------------------------------------
// Summary and exit.
// ---------------------------------------------------------------------------
console.log('');
console.log('test-265-deep-grade-rubric: ' + pass + ' passed, ' + fail + ' failed');

if (fail > 0) {
  console.error('Offending state: ' + JSON.stringify(failures, null, 2));
  process.exit(1);
}

console.log('PASS: test-265-deep-grade-rubric (4 arms: count agreement, name agreement, weight sum, panel shape)');
process.exit(0);
