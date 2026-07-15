#!/usr/bin/env node
'use strict';
/**
 * huji-eval.cjs -- Phase 229 deterministic eval harness (HUJI pitch-feedback module).
 * ================================================================================
 * The no-model-call HALF of the PWS_grading eval: the seven CODE checks that gate
 * every commit and every wave. The judge/anchor half (model calls) is Plan 06.
 *
 * Seven deterministic dimensions, each a `--check` subcommand:
 *   D1 quote-verifier   -- every quote in evidence.json / feedback.md is verbatim in
 *                          the source transcript (the fabricated-critique prohibition,
 *                          the phase's HARDEST gate; code-first, never judge-first).
 *   D2 inventory-recall -- 100% of the labeled inventory's entities/claims/gaps land
 *                          in evidence.json (intake fidelity vs the extraction standard).
 *   D5 schema           -- FeedbackResultSchema.safeParse (Minto/MECE structural shape),
 *                          reusing the ONE zod source in lib/core/pitch-feedback-schemas.cjs.
 *   D3 drift            -- duplicate-anchor probes within 1 band + pinned model_id (Plan 03 Task 2).
 *   D8 similarity       -- pairwise shingle-Jaccard below threshold (Plan 03 Task 2).
 *   D9 cost-ledger      -- total_cost_usd per unit <= $3.00 (Plan 03 Task 2).
 *   D4 part8-hygiene    -- zero student-specific strings in Brain query payloads,
 *                          reusing lib/core/part8-egress-guard.classify (Plan 03 Task 3).
 *
 * CLI (switch-case argv router, the gsd-tools.cjs / label-topic-forest.cjs pattern -
 * no Commander/yargs):
 *   --check <name>            run one check (on --transcript/--evidence/--feedback/
 *                             --inventory/--out paths when given; else its in-file selftest)
 *   --selftest <grounding|cohort|hygiene>   run the tiny PASS+FAIL fixtures for a group
 *   --suite code [--strict]   run all seven with a PASS/FAIL roll-up (Task 3)
 *   --report                  render the cohort view (Task 3)
 *
 * When a `--check` is invoked with no data paths (the run-all-229 aggregator calls it
 * bare, since no batch output exists until Plan 07), it runs that check's deterministic
 * selftest: a known-good fixture must PASS and a known-bad fixture must FAIL, so the leg
 * turns RED the moment the check logic regresses, and stays green while it is sound.
 *
 * CJS only, zero npm deps beyond the already-vendored zod (transitively, via the schema
 * module). No em-dashes anywhere (CLAUDE.md HARD RULE). Hyphens only.
 */

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

// Whitespace + case normalization: the verbatim-substring gate compares on this
// canonical form so diarization spacing and casing never mask a real match or a
// real miss.
function normalize(s) {
  return String(s == null ? '' : s).toLowerCase().replace(/\s+/g, ' ').trim();
}

// Flatten every string leaf in an object graph (the recall blob builder).
function collectStrings(node, acc) {
  acc = acc || [];
  if (node == null) return acc;
  if (typeof node === 'string') { acc.push(node); return acc; }
  if (typeof node === 'number' || typeof node === 'boolean') return acc;
  if (Array.isArray(node)) { for (const x of node) collectStrings(x, acc); return acc; }
  for (const k of Object.keys(node)) collectStrings(node[k], acc);
  return acc;
}

function loadJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }
function loadText(p) { return fs.readFileSync(p, 'utf8'); }

// ---------------------------------------------------------------------------
// D1 - quote-verifier (the fabricated-critique prohibition, hardest gate)
// ---------------------------------------------------------------------------

// Pull every quoted span out of a feedback.md string: straight double quotes,
// curly double quotes, and blockquote (>) lines. Each must be verbatim in the
// transcript or it is a fabricated critique.
function extractQuotedSpans(md) {
  const spans = [];
  for (const q of (md.match(/"([^"]+)"/g) || [])) spans.push(q.slice(1, -1));
  for (const q of (md.match(/“([^”]+)”/g) || [])) spans.push(q.slice(1, -1));
  for (const line of md.split('\n')) {
    const m = line.match(/^\s*>\s?(.+)$/);
    if (m) spans.push(m[1]);
  }
  return spans;
}

function quoteVerifier({ transcript, evidence, feedback }) {
  const nt = normalize(transcript);
  const misses = [];
  const check = (source, q) => {
    if (q == null || String(q).trim() === '') return;
    if (!nt.includes(normalize(q))) misses.push({ source, quote: q });
  };
  if (evidence) {
    if (evidence.problem_claim) check('evidence.problem_claim.quote', evidence.problem_claim.quote);
    if (evidence.value_proposition) check('evidence.value_proposition.quote', evidence.value_proposition.quote);
    for (const ec of (evidence.evidence_claims || [])) check('evidence.evidence_claims[].quote', ec.quote);
  }
  if (feedback) {
    for (const span of extractQuotedSpans(feedback)) check('feedback.md quoted span', span);
  }
  return { ok: misses.length === 0, misses };
}

// ---------------------------------------------------------------------------
// D2 - inventory-recall (extraction completeness vs the labeled ground truth)
// ---------------------------------------------------------------------------

function inventoryRecall({ inventory, evidence }) {
  // The recall target: every string that landed anywhere in evidence.json.
  const blob = normalize(collectStrings(evidence).join('  '));
  const items = [];
  for (const e of (inventory.entities || [])) items.push({ kind: 'entity', text: e.text, quote: e.quote });
  for (const c of (inventory.claims || [])) items.push({ kind: 'claim', text: c.text, quote: c.quote });
  for (const g of (inventory.self_identified_gaps || [])) {
    items.push({ kind: 'gap', text: (typeof g === 'string' ? g : g.gap), quote: (typeof g === 'string' ? g : g.quote) });
  }
  const misses = [];
  for (const it of items) {
    const cands = [it.quote, it.text].filter((x) => x && String(x).trim() !== '').map(normalize);
    const recalled = cands.some((c) => blob.includes(c));
    if (!recalled) misses.push(it);
  }
  return { ok: misses.length === 0, misses };
}

// ---------------------------------------------------------------------------
// D5 - schema (Minto/MECE structural validity, reusing the ONE zod source)
// ---------------------------------------------------------------------------

function schemaCheck({ feedback }) {
  const { FeedbackResultSchema } = require('../lib/core/pitch-feedback-schemas.cjs');
  const res = FeedbackResultSchema.safeParse(feedback);
  if (res.success) return { ok: true, issues: [] };
  const issues = res.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
  return { ok: false, issues };
}

// ---------------------------------------------------------------------------
// Selftest fixtures + runners (tiny in-file PASS/FAIL, no files, no model calls)
// ---------------------------------------------------------------------------

function expectPass(name, result) {
  if (!result.ok) throw new Error(name + ': expected PASS, got ' + JSON.stringify(result));
  console.log('  [PASS-case] ' + name + ': verified clean');
}
function expectFail(name, result) {
  if (result.ok) throw new Error(name + ': expected FAIL, but the check passed a bad fixture');
  console.log('  [FAIL-case] ' + name + ': correctly flagged');
}

// A trimmed SafeScan transcript carrying the spans the grounding fixtures quote.
const SELFTEST_TRANSCRIPT =
  'Speaker 1: (0:01) Today I want to show you SafeScan. ' +
  'Food allergies are a big problem around the world. ' +
  'Just three quick steps. First, put a small food sample in the capsule. ' +
  'The science inside uses smart light sensor.';

function selftestQuoteVerifier() {
  const okEvidence = {
    problem_claim: { quote: 'Food allergies are a big problem around the world.' },
    value_proposition: { quote: 'put a small food sample in the capsule' },
    evidence_claims: [{ claim: 'uses a smart light sensor', quote: 'The science inside uses smart light sensor.' }],
  };
  const okFeedbackMd = [
    '# Feedback: SafeScan',
    'Your strongest claim is grounded: "Food allergies are a big problem around the world."',
    'The sensor is asserted, not evidenced: "The science inside uses smart light sensor."',
  ].join('\n');
  expectPass('quote-verifier', quoteVerifier({ transcript: SELFTEST_TRANSCRIPT, evidence: okEvidence, feedback: okFeedbackMd }));

  // FAIL fixture demonstrates BOTH failure modes the D1 gate exists to catch:
  //   (a) a one-word-altered evidence quote (light -> heat) is no longer verbatim, and
  //   (b) a fabricated feedback critique that marks a covered element missing and quotes
  //       a span ("smart sound sensor") the student never said.
  const badEvidence = {
    evidence_claims: [{ claim: 'uses a smart light sensor', quote: 'The science inside uses smart heat sensor.' }],
  };
  const badFeedbackMd = [
    '# Feedback: SafeScan',
    'The pitch never explains usage, and claims "the science inside uses smart sound sensor."',
  ].join('\n');
  expectFail('quote-verifier', quoteVerifier({ transcript: SELFTEST_TRANSCRIPT, evidence: badEvidence, feedback: badFeedbackMd }));
}

function selftestInventoryRecall() {
  const inventory = {
    entities: [
      { text: 'SafeScan', quote: 'Today I want to show you SafeScan.' },
      { text: 'smart light sensor', quote: 'The science inside uses smart light sensor.' },
    ],
    claims: [{ text: 'allergies are a big problem', quote: 'Food allergies are a big problem around the world.' }],
    self_identified_gaps: [],
  };
  const okEvidence = {
    problem_claim: { quote: 'Food allergies are a big problem around the world.' },
    evidence_claims: [
      { claim: 'product is SafeScan', quote: 'Today I want to show you SafeScan.' },
      { claim: 'uses a smart light sensor', quote: 'The science inside uses smart light sensor.' },
    ],
  };
  expectPass('inventory-recall', inventoryRecall({ inventory, evidence: okEvidence }));

  // FAIL fixture: the extractor dropped the smart-light-sensor entity entirely.
  const badEvidence = {
    problem_claim: { quote: 'Food allergies are a big problem around the world.' },
    evidence_claims: [{ claim: 'product is SafeScan', quote: 'Today I want to show you SafeScan.' }],
  };
  expectFail('inventory-recall', inventoryRecall({ inventory, evidence: badEvidence }));
}

function selftestSchema() {
  const okFeedback = {
    submission_id: 'safescan-001',
    governing_thought: 'SafeScan is a clear device concept whose main gap is unproven sensor evidence.',
    branches: [
      { point: 'The problem is well framed', support: ['Food allergies are a big problem around the world.'], teachable_next_step: 'Run 5 interviews with allergic diners.' },
      { point: 'The sensor claim is asserted not evidenced', support: ['The science inside uses smart light sensor.'], teachable_next_step: 'Add a bench test result for the sensor.' },
    ],
    scores: { grounding: 80, structure: 72 },
    model_id: 'claude-opus-4-8',
    calibration_source: 'local-anchors',
  };
  expectPass('schema', schemaCheck({ feedback: okFeedback }));

  // FAIL fixture: 1 branch is not a pyramid (schema requires 2-3).
  const badFeedback = JSON.parse(JSON.stringify(okFeedback));
  badFeedback.branches = [badFeedback.branches[0]];
  expectFail('schema', schemaCheck({ feedback: badFeedback }));
}

// Per-check selftest registry (extended in Tasks 2-3). Bare `--check X` runs this.
const CHECK_SELFTESTS = {
  'quote-verifier': selftestQuoteVerifier,
  'inventory-recall': selftestInventoryRecall,
  'schema': selftestSchema,
};

function selftestGrounding() {
  selftestQuoteVerifier();
  selftestInventoryRecall();
  selftestSchema();
}

// Selftest-group registry (extended in Tasks 2-3).
const SELFTEST_GROUPS = {
  grounding: selftestGrounding,
};

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

// The set of wired checks (extended in Tasks 2-3). Unknown -> usage + non-zero.
const KNOWN_CHECKS = ['quote-verifier', 'inventory-recall', 'schema'];

function usage() {
  console.error([
    'Usage: node scripts/huji-eval.cjs <mode>',
    '  --check <' + Object.keys(CHECK_SELFTESTS).join('|') + '>',
    '        [--transcript F --evidence F --feedback F --inventory F | --out DIR]',
    '  --selftest <' + Object.keys(SELFTEST_GROUPS).join('|') + '>',
  ].join('\n'));
}

function parseArgs(argv) {
  const o = { _: [] };
  const takesVal = ['--check', '--selftest', '--suite', '--transcript', '--evidence',
    '--feedback', '--inventory', '--out', '--threshold', '--query-log', '--evidence-dir', '--feedback-dir'];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (takesVal.includes(a)) o[a.slice(2)] = argv[++i];
    else if (a === '--strict') o.strict = true;
    else if (a === '--report') o.report = true;
    else o._.push(a);
  }
  return o;
}

function hasRealData(check, o) {
  if (check === 'quote-verifier') return !!(o.transcript && o.evidence);
  if (check === 'inventory-recall') return !!(o.inventory && o.evidence);
  if (check === 'schema') return !!o.feedback;
  return !!o.out;
}

function runCheckReal(check, o) {
  if (check === 'quote-verifier') {
    return quoteVerifier({ transcript: loadText(o.transcript), evidence: loadJson(o.evidence), feedback: o.feedback ? loadText(o.feedback) : null });
  }
  if (check === 'inventory-recall') return inventoryRecall({ inventory: loadJson(o.inventory), evidence: loadJson(o.evidence) });
  if (check === 'schema') return schemaCheck({ feedback: loadJson(o.feedback) });
  throw new Error('no real-data runner for ' + check);
}

function reportCheck(check, r) {
  if (r.ok) { console.log('>>> ' + check + ': PASSED'); return; }
  console.log('>>> ' + check + ': FAILED');
  for (const m of (r.misses || [])) console.log('    miss [' + (m.source || m.kind) + ']: ' + (m.quote || m.text));
  for (const i of (r.issues || [])) console.log('    schema issue [' + i.path + ']: ' + i.message);
}

function runCheck(check, o) {
  if (!KNOWN_CHECKS.includes(check)) { console.error('Unknown --check ' + check); usage(); process.exit(2); }
  if (hasRealData(check, o)) {
    const r = runCheckReal(check, o);
    reportCheck(check, r);
    process.exit(r.ok ? 0 : 1);
  }
  // No batch data present: run the deterministic selftest (PASS+FAIL fixtures).
  try {
    CHECK_SELFTESTS[check]();
    console.log('OK - ' + check + ' selftest passed (no batch data present; self-verified PASS+FAIL)');
    process.exit(0);
  } catch (e) {
    console.error('FAIL - ' + check + ' selftest: ' + e.message);
    process.exit(1);
  }
}

function runSelftest(kind) {
  const group = SELFTEST_GROUPS[kind];
  if (!group) { console.error('Unknown --selftest ' + kind); usage(); process.exit(2); }
  try {
    group();
    console.log('OK - selftest ' + kind + ' passed');
    process.exit(0);
  } catch (e) {
    console.error('FAIL - selftest ' + kind + ': ' + e.message);
    process.exit(1);
  }
}

function main() {
  const o = parseArgs(process.argv.slice(2));
  if (o.selftest !== undefined) return runSelftest(o.selftest);
  if (o.check !== undefined) return runCheck(o.check, o);
  if (typeof runSuite === 'function' && o.suite !== undefined) return runSuite(o.suite, o);
  if (typeof runReport === 'function' && o.report) return runReport(o);
  usage();
  process.exit(2);
}

main();
