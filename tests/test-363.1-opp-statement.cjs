'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 363.1 Plan 06 Tasks 2 and 3 (D-05, B51-04, D-29) -- an Opportunity
 * Statement must read as a sentence about two real things.
 *
 * WHY: in the beta.51 room a Windows path
 * ('problem-definition\agreed-structure-working-brief-....md') became the
 * "section" and landed in four prose slots; the fallback bridge phrase carried
 * its own article, which collided with the template ('the a market-analysis
 * x ... gap'); and the composite score was printed in the text, against D-29
 * (the composite lives in fields and JSON, prose carries the rank only).
 *
 * Legs:
 *   S1  sectionFor: backslash paths, root files, handles, props.section
 *   S2  catalogId normalizes backslashes
 *   S3  deriveBankSection never files under the 'unsectioned' pseudo-section
 *   S4  deriveSharedProblems fallback has no leading article
 *   R1  CLAUSE_LABELS[10] is '. Rank: ' and 0..9 are byte-identical
 *   R2  rank 1 / score 0.5464: score_label '1', fields.composite the number,
 *       text ends '. Rank: 1'
 *   R3  the beta.51 reproduction: no composite, no .md, no backslash, no
 *       'the a', no decimal in the statement text
 *   R4  reasoning-mode statements carry no composite either
 *
 * Zero network, zero deps, mkdtemp only. NO em-dashes (hyphens only; dash
 * characters are spelled with \u escapes where a test needs one).
 */

require('./eureka-offline-preload.cjs');

const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const roomNative = require(path.join(ROOT, 'lib/core/eureka/room-native-substrate.cjs'));
const oppmod = require(path.join(ROOT, 'lib/core/eureka/opportunity-statement.cjs'));
const reasoningMode = require(path.join(ROOT, 'lib/core/eureka/reasoning-mode.cjs'));
const RUNNER = require(path.join(ROOT, 'scripts/eureka-portfolio-report.cjs'));

let failures = 0;
const pending = [];
function leg(name, fn) {
  pending.push({ name, fn });
}

// ---------------------------------------------------------------------------
// TASK 2 LEGS: clean section and bridge phrases (D-05, part 1)
// ---------------------------------------------------------------------------

leg('S1 sectionFor: backslash first folder, unsectioned fallback, handles stay unknown', () => {
  const sf = roomNative._test.sectionFor;
  assert.equal(sf({ source_path: 'problem-definition\\agreed-structure-working-brief-2026-09-28.md' }, {}), 'problem-definition');
  assert.equal(sf({ source_path: 'legal-ip/notes.md' }, {}), 'legal-ip');
  assert.equal(sf({ source_path: 'business-model' }, {}), 'business-model');
  assert.equal(sf({ source_path: 'notes.md' }, {}), 'unsectioned');
  assert.equal(sf({ source_path: 'NOTES.MD' }, {}), 'unsectioned');
  assert.equal(sf({ source_path: 'system:rs-engine' }, {}), 'unknown');
  assert.equal(sf({}, { section: 'market-analysis' }), 'market-analysis');
  assert.equal(sf({}, { section: 'problem-definition\\x.md' }), 'unsectioned');
  assert.equal(sf({}, { section: 'a/b' }), 'unsectioned');
  assert.equal(sf({}, {}), 'unknown');
});

leg('S2 catalogId normalizes backslashes and still falls back to the row id', () => {
  assert.equal(RUNNER.catalogId({ id: 'raw', source_path: 'meeting:jhu\\tech:C16796' }), 'C16796');
  assert.equal(RUNNER.catalogId({ id: 'raw', source_path: 'problem-definition\\brief.md' }), 'raw');
  assert.equal(RUNNER.catalogId({ id: 'raw', source_path: 'meeting:jhu-tech-import:jhu-tech:C16796' }), 'C16796');
});

leg('S3 deriveBankSection never files under the unsectioned pseudo-section', () => {
  const bank = RUNNER.deriveBankSection;
  assert.equal(bank(null, { pair: { techA: { section: 'unsectioned' }, techB: { section: 'problem-definition' } } }), 'problem-definition');
  assert.equal(bank(null, { pair: { techA: { section: 'unsectioned' }, techB: { section: 'unsectioned' } } }), 'unknown');
});

leg('S4 deriveSharedProblems fallback carries no leading article', () => {
  const dsp = RUNNER.deriveSharedProblems;
  assert.deepEqual(dsp({ section: 'market-analysis' }, { section: 'problem-definition' }),
    ['market-analysis x problem-definition cross-domain bridge']);
  assert.deepEqual(dsp({ section: 'market-analysis' }, { section: 'problem-definition' }, 'COMPETES_WITH'),
    ['market-analysis x problem-definition competes-with bridge']);
  // A real primary_problem or shared problem passes through unchanged.
  assert.deepEqual(dsp({ section: 'x', primary_problem: 'battery drain' }, { section: 'y' }), ['battery drain']);
  assert.deepEqual(dsp({ problems: ['p1', 'p2'] }, { problems: ['p2'] }), ['p2']);
});

// ---------------------------------------------------------------------------
// TASK 3 LEGS: statement text carries rank only (D-05, part 2, D-29)
// ---------------------------------------------------------------------------

const PRE_D05_LABELS = ['Combining ', ' (unmet need: ', ') and ', ' (unmet need: ', ') creates a ',
  ' that addresses ', ', for ', '. Key risks: ', '. Next steps: ', '. Estimated potential: '];

leg('R1 CLAUSE_LABELS[10] is ". Rank: " and markers 0..9 are byte-identical', () => {
  assert.equal(oppmod.CLAUSE_LABELS.length, 11);
  assert.equal(oppmod.CLAUSE_LABELS[10], '. Rank: ');
  assert.deepEqual(oppmod.CLAUSE_LABELS.slice(0, 10), PRE_D05_LABELS);
});

function beta51Candidate(score, rank) {
  // Assembled the way the report does: sections derived through sectionFor from
  // a Windows path, shared_problems from deriveSharedProblems' fallback.
  const secA = roomNative._test.sectionFor({ source_path: 'market-analysis\\who-has-it-2026-09-28.md' }, {});
  const secB = roomNative._test.sectionFor({ source_path: 'problem-definition\\agreed-structure-working-brief-2026-09-28.md' }, {});
  const techA = { title: 'market-analysis - who has it, how many, doing what', section: secA, primary_problem: '' };
  const techB = { title: 'Milken Innovation Center', section: secB, primary_problem: '' };
  // The report's candidate assembly gives each side its 'unclassified problem for <id>' fallback.
  const a = Object.assign({}, techA, { primary_problem: 'unclassified problem for idA', weak_dimensions: [] });
  const b = Object.assign({}, techB, { primary_problem: 'unclassified problem for idB', weak_dimensions: [] });
  return {
    a, b, shared_problems: RUNNER.deriveSharedProblems(techA, techB),
    dims: { strategic_fit: 0.6, validated_demand: 0.3, tech_econ_feasibility: 0.7 },
    score: score, rank: rank, tail: false,
  };
}

leg('R2 rank 1 / score 0.5464: score_label is the rank, composite stays a number in fields', () => {
  oppmod._test.setCriticForTest(null);
  const r = oppmod.buildOpportunityStatement(beta51Candidate(0.5464, 1));
  assert.equal(r.fields.score_label, '1');
  assert.equal(r.fields.composite, 0.5464);
  assert.equal(typeof r.fields.composite, 'number');
  assert.ok(r.text.endsWith('. Rank: 1'), 'text must end ". Rank: 1", got tail ' + JSON.stringify(r.text.slice(-30)));
  oppmod._test.setCriticForTest();
});

leg('R3 beta.51 reproduction: no composite, path, doubled article or decimal in the text', () => {
  oppmod._test.setCriticForTest(null);
  const r = oppmod.buildOpportunityStatement(beta51Candidate(0.5464, 1));
  const t = r.text;
  assert.ok(!/composite/i.test(t), 'composite in text: ' + t);
  assert.ok(!/\.md\b/i.test(t), '.md in text: ' + t);
  assert.ok(!t.includes('\\'), 'backslash in text: ' + t);
  assert.ok(!/\bthe a\b/i.test(t), '"the a" in text: ' + t);
  assert.ok(!/\d\.\d{2}/.test(t), 'decimal in text: ' + t);
  assert.ok(t.includes('market-analysis x problem-definition'), 'real sections named: ' + t);
  oppmod._test.setCriticForTest();
  process.stdout.write('  reproduced statement: ' + t + '\n');
});

leg('R4 reasoning-mode statements carry no composite', () => {
  oppmod._test.setCriticForTest(null);
  const st = reasoningMode.buildReasoningStatement({
    a: 'idA', b: 'idB', title_a: 'Alpha thing', title_b: 'Beta thing', section_a: 'market-analysis', section_b: 'unsectioned',
  }, 1);
  assert.ok(!/composite/i.test(st.text), st.text);
  assert.ok(st.text.endsWith('. Rank: 1'), st.text);
  oppmod._test.setCriticForTest();
});

// ---------------------------------------------------------------------------
// runner
// ---------------------------------------------------------------------------

(async function main() {
  for (const { name, fn } of pending) {
    try {
      await fn();
      console.log('ok - ' + name);
    } catch (err) {
      failures += 1;
      console.log('not ok - ' + name);
      console.log('    ' + String(err && err.message ? err.message : err).split('\n').join('\n    '));
    }
  }
  if (failures > 0) {
    console.log('test-363.1-opp-statement: ' + failures + ' leg(s) FAILED');
    process.exit(1);
  }
  console.log('test-363.1-opp-statement: ' + pending.length + '/' + pending.length + ' legs PASSED');
  process.exit(0);
})();
