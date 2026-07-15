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
// Cohort helpers (D3/D8/D9): band buckets, rolling stats, word shingles.
// ---------------------------------------------------------------------------

// The AI-SPEC Section 5 normalization buckets (< 50 = 1, 50-64 = 2, 65-79 = 3,
// 80-89 = 4, 90+ = 5). "Within 1 band" is a difference of <= 1 on this scale.
function bandOf(score) {
  if (score < 50) return 1;
  if (score < 65) return 2;
  if (score < 80) return 3;
  if (score < 90) return 4;
  return 5;
}
function meanScore(scores) {
  const vals = Object.values(scores || {}).map(Number).filter((n) => !Number.isNaN(n));
  if (!vals.length) return 0;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}
function mean(arr) { return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0; }
function stdev(arr) {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return Math.sqrt(arr.reduce((a, b) => a + (b - m) * (b - m), 0) / (arr.length - 1));
}
function medianOf(arr) {
  if (!arr.length) return 0;
  const s = arr.slice().sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

// k-word shingle set (dependency-free; the individuation fingerprint).
function shingles(text, k) {
  k = k || 5;
  const words = normalize(text).split(' ').filter(Boolean);
  const set = new Set();
  for (let i = 0; i + k <= words.length; i++) set.add(words.slice(i, i + k).join(' '));
  if (set.size === 0 && words.length) set.add(words.join(' '));
  return set;
}
function jaccard(a, b) {
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  const uni = new Set([...a, ...b]).size;
  return uni === 0 ? 0 : inter / uni;
}

// ---------------------------------------------------------------------------
// D3 - drift (duplicate-anchor probes within 1 band + one pinned model_id)
// ---------------------------------------------------------------------------

// results: array of { probe_id, position, model_id, scores } (one per result.json).
// manifest: the probe manifest array (duplicate-anchor entries carry inject_positions).
function driftStats({ results, manifest }) {
  const results2 = results || [];
  const modelIds = [...new Set(results2.map((r) => r.model_id).filter((x) => x != null))];
  const modelMismatches = modelIds.length > 1 ? modelIds : [];

  const dupIds = (manifest || []).filter((p) => p.type === 'duplicate-anchor').map((p) => p.id);
  const bandDeviations = [];
  for (const pid of dupIds) {
    const rows = results2.filter((r) => r.probe_id === pid).sort((a, b) => a.position - b.position);
    if (rows.length < 2) continue;
    const baseBand = bandOf(meanScore(rows[0].scores));
    for (const row of rows) {
      const band = bandOf(meanScore(row.scores));
      if (Math.abs(band - baseBand) > 1) {
        bandDeviations.push({ probe: pid, position: row.position, base_band: baseBand, band });
      }
    }
  }

  // Rolling cohort mean/stdev per 25 units (monotonic-drift watch; informational).
  const ordered = results2.filter((r) => typeof r.position === 'number').sort((a, b) => a.position - b.position);
  const rolling = [];
  for (let i = 0; i < ordered.length; i += 25) {
    const window = ordered.slice(i, i + 25).map((r) => meanScore(r.scores));
    rolling.push({ from: i + 1, to: i + window.length, mean: mean(window), stdev: stdev(window) });
  }

  return { ok: modelMismatches.length === 0 && bandDeviations.length === 0, modelMismatches, bandDeviations, rolling };
}

// ---------------------------------------------------------------------------
// D8 - similarity (pairwise shingle-Jaccard below the template ceiling)
// ---------------------------------------------------------------------------

// feedbacks: array of { id, text }. threshold default 0.5 (AI-SPEC).
function similarityIndex({ feedbacks, threshold, k }) {
  const thr = typeof threshold === 'number' ? threshold : 0.5;
  const sh = (feedbacks || []).map((f) => ({ id: f.id, s: shingles(f.text, k) }));
  const pairs = [];
  for (let i = 0; i < sh.length; i++) {
    for (let j = i + 1; j < sh.length; j++) {
      pairs.push({ a: sh[i].id, b: sh[j].id, sim: jaccard(sh[i].s, sh[j].s) });
    }
  }
  const sims = pairs.map((p) => p.sim);
  const over = pairs.filter((p) => p.sim > thr);
  return { ok: over.length === 0, threshold: thr, max: sims.length ? Math.max(...sims) : 0, median: medianOf(sims), over, pairs };
}

// ---------------------------------------------------------------------------
// D9 - cost-ledger (per-unit total_cost_usd <= $3.00; warm avg + batch total)
// ---------------------------------------------------------------------------

// results: array of { id, total_cost_usd }.
function costLedger({ results, perUnitMax, warmTarget, batchLow, batchHigh }) {
  const cap = typeof perUnitMax === 'number' ? perUnitMax : 3.00;
  const warm = typeof warmTarget === 'number' ? warmTarget : 2.00;
  const results2 = results || [];
  const over = results2
    .filter((r) => Number(r.total_cost_usd) > cap)
    .map((r) => ({ id: r.id || r.submission_id, cost: Number(r.total_cost_usd) }));
  const costs = results2.map((r) => Number(r.total_cost_usd)).filter((n) => !Number.isNaN(n));
  const total = costs.reduce((a, b) => a + b, 0);
  return {
    ok: over.length === 0,
    perUnitMax: cap, warmTarget: warm,
    over, avg: mean(costs), total,
    batchLow: batchLow || 150, batchHigh: batchHigh || 400,
    warmOver: mean(costs) > warm,
  };
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

function selftestDrift() {
  const manifest = [{ id: 'dup-anchor-safescan', type: 'duplicate-anchor' }];
  const model = 'claude-opus-4-8';
  // PASS: same probe across positions stays within 1 band, one pinned model_id.
  const okResults = [
    { probe_id: 'dup-anchor-safescan', position: 1, model_id: model, scores: { grounding: 82, structure: 78 } },
    { probe_id: 'dup-anchor-safescan', position: 100, model_id: model, scores: { grounding: 80, structure: 74 } },
    { probe_id: 'dup-anchor-safescan', position: 200, model_id: model, scores: { grounding: 84, structure: 76 } },
  ];
  expectPass('drift', driftStats({ results: okResults, manifest }));

  // FAIL (a): a mismatched model_id breaks cohort fairness.
  const badModel = JSON.parse(JSON.stringify(okResults));
  badModel[2].model_id = 'claude-sonnet-5';
  expectFail('drift (model_id)', driftStats({ results: badModel, manifest }));

  // FAIL (b): position 200 drifts > 1 band from position 1 (band 4 -> band 2).
  const badBand = JSON.parse(JSON.stringify(okResults));
  badBand[2].scores = { grounding: 58, structure: 55 };
  expectFail('drift (band)', driftStats({ results: badBand, manifest }));
}

function selftestSimilarity() {
  const distinctA = 'SafeScan tests food at the table using a smart light sensor for the big nine allergen groups with a three step capsule workflow.';
  const distinctB = 'The mobile learning app helps students study faster with short summaries flashcards and quizzes on a ten to twelve week timeline.';
  // PASS: two genuinely different feedback bodies stay below the ceiling.
  expectPass('similarity', similarityIndex({ feedbacks: [{ id: 'a', text: distinctA }, { id: 'b', text: distinctB }] }));

  // FAIL: two identical bodies are a templated pair (Jaccard 1.0 > 0.5).
  expectFail('similarity (dup pair)', similarityIndex({ feedbacks: [{ id: 'a', text: distinctA }, { id: 'a2', text: distinctA }] }));

  // --threshold is respected: a lenient ceiling of 1.01 passes even the dup pair.
  expectPass('similarity (--threshold honored)', similarityIndex({ feedbacks: [{ id: 'a', text: distinctA }, { id: 'a2', text: distinctA }], threshold: 1.01 }));
}

function selftestCostLedger() {
  // PASS: every unit under the $3.00 fuse.
  const okResults = [
    { id: 'u1', total_cost_usd: 1.80 },
    { id: 'u2', total_cost_usd: 2.10 },
    { id: 'u3', total_cost_usd: 1.95 },
  ];
  expectPass('cost-ledger', costLedger({ results: okResults }));

  // FAIL: one unit blew the $3.00 fuse.
  const badResults = okResults.concat([{ id: 'u4', total_cost_usd: 3.40 }]);
  expectFail('cost-ledger (over $3.00)', costLedger({ results: badResults }));
}

// Per-check selftest registry (extended in Task 3). Bare `--check X` runs this.
const CHECK_SELFTESTS = {
  'quote-verifier': selftestQuoteVerifier,
  'inventory-recall': selftestInventoryRecall,
  'schema': selftestSchema,
  'drift': selftestDrift,
  'similarity': selftestSimilarity,
  'cost-ledger': selftestCostLedger,
};

function selftestGrounding() {
  selftestQuoteVerifier();
  selftestInventoryRecall();
  selftestSchema();
}

function selftestCohort() {
  selftestDrift();
  selftestSimilarity();
  selftestCostLedger();
}

// Selftest-group registry (extended in Task 3).
const SELFTEST_GROUPS = {
  grounding: selftestGrounding,
  cohort: selftestCohort,
};

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

// The set of wired checks (extended in Task 3). Unknown -> usage + non-zero.
const KNOWN_CHECKS = ['quote-verifier', 'inventory-recall', 'schema', 'drift', 'similarity', 'cost-ledger'];

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
