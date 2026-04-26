#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 89.2 Plan 06 Task 2 -- preprocessor fixture suite.
 *
 * 10 scenarios for the deterministic per-document preprocessor that
 * produces the 5-field shape:
 *   {document_id, technical_terms[], concepts[], methods[],
 *    relevance_score, boundary_flag}
 *
 *   Test 1  happy path (5 papers + 3 patents + 2 signals; 5-field shape verified)
 *   Test 2  determinism (5 invocations identical bytes)
 *   Test 3  empty documents (returns [])
 *   Test 4  malformed document (no abstract/signal/title) -> warning + empty fields
 *   Test 5  industry signal (uses signal field instead of abstract)
 *   Test 6  boundary_flag triggered (low relevance / no concept overlap)
 *   Test 7  boundary_flag NOT triggered (high relevance + concept overlap)
 *   Test 8  CANON PART 8 adversarial: forbidden in document.abstract
 *   Test 9  CANON PART 8 adversarial: forbidden in document.title (email)
 *   Test 10 CANON PART 8 adversarial: forbidden in domain_analysis input
 *
 * Suite-end audit:
 *   A1  walk every captured preprocessed[]; JSON.stringify scan against
 *       FORBIDDEN_PATTERNS + DANGEROUS_SUBSTRINGS; ZERO hits.
 *
 * Pure CJS, zero npm deps, node built-ins only.
 */

const assert = require('node:assert/strict');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

const crossRoomAggregator = require('../core/cross-room-aggregator.cjs');
const FORBIDDEN_PATTERNS = crossRoomAggregator.FORBIDDEN_PATTERNS;

const DANGEROUS_SUBSTRINGS = Object.freeze([
  'Lawrence',
  '5.2M',
  'meeting with',
  'jonathan@mindrian.com',
  '123-45-6789',
]);

// ---------- Suite bookkeeping ----------

let passed = 0;
let failed = 0;
const failures = [];
const SCENARIO_RESULTS = [];

function resetRequireCache() {
  const targets = [
    '../core/rs-egress-violations.cjs',
    '../core/rs-egress-prompts.cjs',
    '../core/cross-room-aggregator.cjs',
    '../core/rs-preprocessor.cjs',
  ];
  for (const t of targets) {
    try {
      const p = require.resolve(t);
      delete require.cache[p];
    } catch (_e) { /* best effort */ }
  }
}

async function runScenario(name, fn) {
  const start = Date.now();
  try {
    await fn();
    passed += 1;
    process.stdout.write('  ok  ' + name + '  (' + (Date.now() - start) + 'ms)\n');
  } catch (err) {
    failed += 1;
    failures.push({ name: name, err: err });
    process.stderr.write('  FAIL  ' + name + '\n');
    process.stderr.write('        ' + (err && err.stack ? err.stack : err) + '\n');
  } finally {
    resetRequireCache();
  }
}

function captureResult(name, result) {
  SCENARIO_RESULTS.push({ scenario: name, result: result });
}

// ---------- Fixtures ----------

function makePapers(n) {
  // 5 papers with cancer-immunotherapy-style abstracts.
  const out = [];
  for (let i = 0; i < n; i += 1) {
    out.push({
      id: 'paper-' + i,
      title: 'Cancer immunotherapy biomarker analysis ' + i,
      abstract: 'We applied deep learning models to cancer immunotherapy biomarker discovery. ' +
                'The biomarker analysis revealed checkpoint inhibitor responsiveness in patient cohorts. ' +
                'We measured response rates and computed survival statistics across the cohort.',
      authors: ['Dr Adams', 'Dr Brown'],
      source: 'arxiv',
      doi: '10.1000/paper' + i,
      fetched_at: '2026-04-26T00:00:00Z',
    });
  }
  return out;
}

function makePatents(n) {
  const out = [];
  for (let i = 0; i < n; i += 1) {
    out.push({
      id: 'pat-' + i,
      patent_id: 'US' + (10000 + i),
      title: 'Method for biomarker checkpoint analysis ' + i,
      abstract: 'A method for analyzing biomarker expression in checkpoint inhibitor therapy. ' +
                'The system implemented machine learning over patient samples to predict response.',
      inventors: ['Adams J', 'Brown K'],
      source: 'google_patents',
      fetched_at: '2026-04-26T00:00:00Z',
    });
  }
  return out;
}

function makeSignals(n) {
  const out = [];
  for (let i = 0; i < n; i += 1) {
    out.push({
      id: 'sig-' + i,
      signal: 'Biotech startup ' + i + ' raised funding for cancer immunotherapy biomarker platform development.',
      source: 'tavily',
      url: 'https://example.com/signal' + i,
      fetched_at: '2026-04-26T00:00:00Z',
    });
  }
  return out;
}

function makeDomainAnalysis() {
  return {
    primary_domain: 'cancer-immunotherapy',
    concepts: ['cancer', 'immunotherapy', 'biomarker', 'checkpoint', 'inhibitor', 'response'],
    terminology: ['oncology', 'immune', 'targeted'],
    methods: ['deep-learning', 'machine-learning'],
  };
}

// ---------- Scenarios ----------

async function scenario1HappyPath() {
  const m = require('../core/rs-preprocessor.cjs');
  const docs = [].concat(makePapers(5), makePatents(3), makeSignals(2));
  const out = m.preprocess(docs, { domain_analysis: makeDomainAnalysis() });
  captureResult('1-happy-path', out);
  assert.ok(Array.isArray(out), 'output is array');
  assert.equal(out.length, 10, 'all 10 documents processed; got ' + out.length);
  for (const rec of out) {
    assert.ok(typeof rec.document_id === 'string', 'document_id is string');
    assert.ok(Array.isArray(rec.technical_terms), 'technical_terms is array');
    assert.ok(Array.isArray(rec.concepts), 'concepts is array');
    assert.ok(Array.isArray(rec.methods), 'methods is array');
    assert.equal(typeof rec.relevance_score, 'number', 'relevance_score is number');
    assert.ok(rec.relevance_score >= 0 && rec.relevance_score <= 1, 'relevance_score in [0,1]');
    assert.equal(typeof rec.boundary_flag, 'boolean', 'boundary_flag is boolean');
    assert.ok(rec.technical_terms.length <= 20, 'technical_terms <= 20');
    assert.ok(rec.concepts.length <= 10, 'concepts <= 10');
    assert.ok(rec.methods.length <= 5, 'methods <= 5');
  }
  // Spot-check at least one paper carries some technical_terms + concepts.
  const firstPaper = out[0];
  assert.ok(firstPaper.technical_terms.length >= 1, 'first paper has >=1 technical_terms');
  assert.ok(firstPaper.concepts.length >= 1, 'first paper has >=1 concept overlap with domain_analysis');
}

async function scenario2Determinism() {
  const m = require('../core/rs-preprocessor.cjs');
  const docs = makePapers(3);
  const da = makeDomainAnalysis();
  const out1 = m.preprocess(docs, { domain_analysis: da });
  const out2 = m.preprocess(docs, { domain_analysis: da });
  const out3 = m.preprocess(docs, { domain_analysis: da });
  const out4 = m.preprocess(docs, { domain_analysis: da });
  const out5 = m.preprocess(docs, { domain_analysis: da });
  captureResult('2-determinism-1', out1);
  const j1 = JSON.stringify(out1);
  assert.equal(j1, JSON.stringify(out2), 'invocation 2 byte-identical to 1');
  assert.equal(j1, JSON.stringify(out3), 'invocation 3 byte-identical to 1');
  assert.equal(j1, JSON.stringify(out4), 'invocation 4 byte-identical to 1');
  assert.equal(j1, JSON.stringify(out5), 'invocation 5 byte-identical to 1');
}

async function scenario3EmptyDocuments() {
  const m = require('../core/rs-preprocessor.cjs');
  const out = m.preprocess([], { domain_analysis: makeDomainAnalysis() });
  captureResult('3-empty-docs', out);
  assert.ok(Array.isArray(out), 'output is array');
  assert.equal(out.length, 0, 'empty input -> empty output');
}

async function scenario4MalformedDocument() {
  const m = require('../core/rs-preprocessor.cjs');
  const docs = [{ id: 'malformed-1', source: 'unknown' }];
  const out = m.preprocess(docs, { domain_analysis: makeDomainAnalysis() });
  captureResult('4-malformed', out);
  assert.equal(out.length, 1, 'one record processed');
  const rec = out[0];
  assert.equal(rec.document_id, 'malformed-1', 'document_id preserved');
  assert.deepEqual(rec.technical_terms, [], 'technical_terms empty');
  assert.deepEqual(rec.concepts, [], 'concepts empty');
  assert.deepEqual(rec.methods, [], 'methods empty');
  assert.equal(rec.relevance_score, 0, 'relevance_score == 0');
  assert.equal(rec.boundary_flag, true, 'boundary_flag true');
  assert.equal(rec.warning, 'document_text_missing', 'warning emitted');
}

async function scenario5IndustrySignal() {
  const m = require('../core/rs-preprocessor.cjs');
  const docs = [{
    id: 'sig-only-1',
    signal: 'CRISPR startup raised 5M dollars for cancer biomarker platform development',
    source: 'tavily',
    fetched_at: '2026-04-26T00:00:00Z',
  }];
  const out = m.preprocess(docs, { domain_analysis: makeDomainAnalysis() });
  captureResult('5-industry-signal', out);
  assert.equal(out.length, 1, 'one record processed');
  const rec = out[0];
  // technical_terms should pick up tokens from signal field.
  const json = JSON.stringify(rec.technical_terms);
  assert.ok(/crispr|startup|biomarker|cancer/i.test(json),
    'technical_terms should reflect signal text; got ' + json);
  assert.equal(typeof rec.relevance_score, 'number', 'relevance_score number');
  // 'cancer' and 'biomarker' both in domain_analysis.concepts -> overlap exists.
  assert.ok(rec.concepts.length >= 1, 'concept overlap exists for biomarker/cancer');
  assert.equal(rec.boundary_flag, false, 'boundary_flag false (industry signal mapped)');
}

async function scenario6BoundaryFlagTriggered() {
  const m = require('../core/rs-preprocessor.cjs');
  const docs = [{
    id: 'unrelated-1',
    abstract: 'Completely unrelated content about astronomy and stars and galaxies',
    source: 'arxiv',
    fetched_at: '2026-04-26T00:00:00Z',
  }];
  const out = m.preprocess(docs, { domain_analysis: makeDomainAnalysis() });
  captureResult('6-boundary-triggered', out);
  const rec = out[0];
  // No overlap with cancer/immunotherapy/biomarker concepts.
  assert.equal(rec.boundary_flag, true, 'boundary_flag true on unrelated content; got ' + rec.boundary_flag);
}

async function scenario7BoundaryFlagNotTriggered() {
  const m = require('../core/rs-preprocessor.cjs');
  const docs = [{
    id: 'overlap-1',
    abstract: 'cancer immunotherapy biomarker checkpoint inhibitor response analysis cancer cancer biomarker biomarker checkpoint inhibitor response',
    source: 'arxiv',
    fetched_at: '2026-04-26T00:00:00Z',
  }];
  const out = m.preprocess(docs, { domain_analysis: makeDomainAnalysis() });
  captureResult('7-boundary-not-triggered', out);
  const rec = out[0];
  assert.ok(rec.relevance_score >= 0.5, 'relevance_score >= 0.5; got ' + rec.relevance_score);
  assert.ok(rec.concepts.length >= 4, 'concepts >= 4; got ' + rec.concepts.length);
  assert.equal(rec.boundary_flag, false, 'boundary_flag false on high overlap');
}

async function scenario8AdversarialAbstract() {
  const m = require('../core/rs-preprocessor.cjs');
  const docs = [{
    id: 'adv-1',
    abstract: 'meeting with Dr Smith about $5.2M Q4 financial results was held last week',
    source: 'arxiv',
    fetched_at: '2026-04-26T00:00:00Z',
  }];
  let out = null;
  let threw = null;
  try {
    out = m.preprocess(docs, { domain_analysis: makeDomainAnalysis() });
  } catch (err) {
    threw = err;
  }
  if (threw) {
    assert.equal(threw.name, 'ExternalEgressViolation',
      'must throw ExternalEgressViolation on adversarial abstract; got ' + (threw && threw.name));
    captureResult('8-adv-abstract-throw', { thrown: threw.name });
  } else {
    captureResult('8-adv-abstract-scrubbed', out);
    const json = JSON.stringify(out);
    assert.ok(!/meeting with/i.test(json), 'output must not contain "meeting with"');
    assert.ok(!/5\.2M/i.test(json), 'output must not contain "5.2M"');
  }
}

async function scenario9AdversarialTitleEmail() {
  const m = require('../core/rs-preprocessor.cjs');
  const docs = [{
    id: 'adv-2',
    title: 'jonathan@mindrian.com cancer paper',
    abstract: 'Standard cancer biomarker analysis content with no leakage at all',
    source: 'arxiv',
    fetched_at: '2026-04-26T00:00:00Z',
  }];
  let out = null;
  let threw = null;
  try {
    out = m.preprocess(docs, { domain_analysis: makeDomainAnalysis() });
  } catch (err) {
    threw = err;
  }
  if (threw) {
    assert.equal(threw.name, 'ExternalEgressViolation',
      'must throw ExternalEgressViolation on email-in-title; got ' + (threw && threw.name));
    captureResult('9-adv-email-throw', { thrown: threw.name });
  } else {
    captureResult('9-adv-email-scrubbed', out);
    const json = JSON.stringify(out);
    assert.ok(!/jonathan@mindrian\.com/i.test(json), 'output must not contain leaked email');
  }
}

async function scenario10AdversarialDomainAnalysis() {
  const m = require('../core/rs-preprocessor.cjs');
  const docs = makePapers(2);
  // Domain analysis carries forbidden pattern in concepts.
  const dirty_da = {
    primary_domain: 'cancer',
    concepts: ['Lawrence said breakthrough', 'biomarker'],
    terminology: ['oncology'],
    methods: ['ml'],
  };
  let out = null;
  let threw = null;
  try {
    out = m.preprocess(docs, { domain_analysis: dirty_da });
  } catch (err) {
    threw = err;
  }
  // Either rejected at pre-input scan with envelope OR scrubbed and proceeds.
  if (threw) {
    assert.equal(threw.name, 'ExternalEgressViolation',
      'either throws ExternalEgressViolation or returns rejection envelope; got throw=' + (threw && threw.name));
    captureResult('10-adv-da-throw', { thrown: threw.name });
  } else if (out && out.error === 'invalid_input') {
    captureResult('10-adv-da-rejected', out);
    assert.equal(out.reason, 'forbidden_input', 'rejection reason matches');
  } else {
    captureResult('10-adv-da-scrubbed', out);
    const json = JSON.stringify(out);
    assert.ok(!/Lawrence said/.test(json), 'output must not contain "Lawrence said"');
  }
}

// ---------- A1 sweep ----------

function a1Sweep() {
  let hits = 0;
  for (const rec of SCENARIO_RESULTS) {
    const json = JSON.stringify(rec.result);
    for (const re of FORBIDDEN_PATTERNS) {
      if (re.test(json)) {
        hits += 1;
        process.stderr.write(
          '  A1 HIT  scenario=' + rec.scenario +
          '  pattern=' + re.source + '\n'
        );
      }
    }
    for (const sub of DANGEROUS_SUBSTRINGS) {
      if (json.indexOf(sub) !== -1) {
        hits += 1;
        process.stderr.write(
          '  A1 HIT  scenario=' + rec.scenario +
          '  substring=' + sub + '\n'
        );
      }
    }
  }
  return hits;
}

// ---------- Main ----------

(async function main() {
  process.stdout.write('=== 89.2-06-preprocessor suite (REPO_ROOT=' + REPO_ROOT + ') ===\n');

  await runScenario('1-happy-path', scenario1HappyPath);
  await runScenario('2-determinism', scenario2Determinism);
  await runScenario('3-empty-documents', scenario3EmptyDocuments);
  await runScenario('4-malformed-document', scenario4MalformedDocument);
  await runScenario('5-industry-signal', scenario5IndustrySignal);
  await runScenario('6-boundary-flag-triggered', scenario6BoundaryFlagTriggered);
  await runScenario('7-boundary-flag-not-triggered', scenario7BoundaryFlagNotTriggered);
  await runScenario('8-adversarial-abstract', scenario8AdversarialAbstract);
  await runScenario('9-adversarial-title-email', scenario9AdversarialTitleEmail);
  await runScenario('10-adversarial-domain-analysis', scenario10AdversarialDomainAnalysis);

  const sweepHits = a1Sweep();
  if (sweepHits > 0) {
    failed += 1;
    failures.push({
      name: 'A1-sweep',
      err: new Error('A1 sweep found ' + sweepHits + ' forbidden-pattern hits'),
    });
    process.stderr.write('  FAIL  A1-sweep (' + sweepHits + ' hits)\n');
  } else {
    process.stdout.write('  ok  A1-sweep (zero forbidden-pattern hits)\n');
  }

  if (failed > 0) {
    for (const f of failures) {
      process.stderr.write('  FAILURE: ' + f.name + ': ' +
        (f.err && f.err.message ? f.err.message : String(f.err)) + '\n');
    }
    process.stdout.write('=== 89.2-06-preprocessor suite: ' + passed + '/10 passed (' + failed + ' failed) ===\n');
    process.exit(1);
  }
  process.stdout.write('=== 89.2-06-preprocessor suite: 10/10 passed ===\n');
  process.exit(0);
})().catch(function (err) {
  process.stderr.write('FATAL: ' + (err && err.stack ? err.stack : err) + '\n');
  process.exit(2);
});
