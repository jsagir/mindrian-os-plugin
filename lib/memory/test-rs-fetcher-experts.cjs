#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 89.2 Plan 05 -- experts post-processor fixture suite.
 *
 * mapExperts(papers, opts) is the Wave-2 post-processor over academic
 * fetcher output. NO network egress. The module reads papers[] and
 * emits experts[] (one record per deduped author).
 *
 * 12 scenarios covering:
 *   Happy path                : scenario 1 (10 papers, 6 unique authors)
 *   Edge cases                : scenarios 2-4 (missing orcid, missing institution, login-gated email)
 *   Aggregation               : scenarios 5-6 (paper_count, h_index_estimate)
 *   Determinism               : scenarios 7-8 (dedup deterministic, sort order)
 *   Adversarial (Canon Part 8): scenarios 9-12 (forbidden in name, email, institution, paper.id-or-source)
 *
 * End-of-suite sweep:
 *   A1: re-scan every captured experts[] output (JSON.stringify) against
 *       FORBIDDEN_PATTERNS + DANGEROUS_SUBSTRINGS as cross-scenario
 *       Canon Part 8 guarantee. Any hit hard-fails the suite.
 *
 * Pure CJS, zero npm deps, node built-ins only (assert, path).
 */

const assert = require('node:assert/strict');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

// Source of truth for parity gate.
const crossRoomAggregator = require('../core/cross-room-aggregator.cjs');
const FORBIDDEN_PATTERNS = crossRoomAggregator.FORBIDDEN_PATTERNS;

const DANGEROUS_SUBSTRINGS = Object.freeze([
  'Lawrence',
  '5.2M',
  'meeting with',
  'jonathan@mindrian.com',
  '123-45-6789',
]);

// Every output captured for end-of-suite A1 sweep.
const capturedOutputs = [];

let passed = 0;
let failed = 0;
const failures = [];

function resetRequireCache() {
  const targets = [
    '../core/rs-egress-violations.cjs',
    '../core/rs-egress-prompts.cjs',
    '../core/cross-room-aggregator.cjs',
    '../core/rs-fetcher-experts.cjs',
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

function captureOutput(name, output) {
  capturedOutputs.push({ scenario: name, output: output });
}

// ---------- Fixtures ----------

function makePaper(opts) {
  // opts: { id, title, authors, source, citationCount }
  return {
    id: opts.id,
    title: opts.title || 'Sample Paper',
    abstract: opts.abstract || 'Abstract.',
    authors: opts.authors || [],
    institution: (opts.authors && opts.authors[0] && opts.authors[0].institution) || null,
    doi: opts.doi || null,
    source: opts.source || 'openalex',
    fetched_at: '2026-04-26T14:00:00Z',
    citationCount: typeof opts.citationCount === 'number' ? opts.citationCount : 0,
  };
}

function fixtureTenPapersSixAuthors() {
  // 6 unique authors: Smith, Jane (4 papers); Alpha, Adam (2); Beta, Bob (2);
  // Gamma, Greg (1); Delta, Dora (1); Epsilon, Eve (1)
  const smith = { name: 'Smith, Jane', orcid: '0000-0001-1111-1111', institution: 'Stanford University', email: 'jane.smith@stanford.edu' };
  const alpha = { name: 'Alpha, Adam', orcid: '0000-0002-2222-2222', institution: 'MIT', email: 'adam@mit.edu' };
  const beta = { name: 'Beta, Bob', orcid: '0000-0003-3333-3333', institution: 'Harvard', email: 'bob@harvard.edu' };
  const gamma = { name: 'Gamma, Greg', orcid: '0000-0004-4444-4444', institution: 'Berkeley', email: null };
  const delta = { name: 'Delta, Dora', orcid: '0000-0005-5555-5555', institution: 'CalTech', email: 'dora@caltech.edu' };
  const epsilon = { name: 'Epsilon, Eve', orcid: null, institution: 'Princeton', email: null };

  return [
    makePaper({ id: 'openalex:W001', title: 'Paper 1', authors: [smith, alpha], source: 'openalex', citationCount: 10 }),
    makePaper({ id: 'openalex:W002', title: 'Paper 2', authors: [smith, beta], source: 'openalex', citationCount: 8 }),
    makePaper({ id: 'openalex:W003', title: 'Paper 3', authors: [smith, gamma], source: 'openalex', citationCount: 5 }),
    makePaper({ id: 'openalex:W004', title: 'Paper 4', authors: [smith, delta], source: 'openalex', citationCount: 3 }),
    makePaper({ id: 'openalex:W005', title: 'Paper 5', authors: [alpha, beta], source: 'openalex', citationCount: 1 }),
    makePaper({ id: 'openalex:W006', title: 'Paper 6', authors: [beta], source: 'openalex', citationCount: 0 }),
    makePaper({ id: 'openalex:W007', title: 'Paper 7', authors: [epsilon], source: 'openalex', citationCount: 12 }),
    makePaper({ id: 'openalex:W008', title: 'Paper 8', authors: [alpha], source: 'openalex', citationCount: 7 }),
    makePaper({ id: 'arxiv:2026.0001', title: 'Paper 9', authors: [gamma], source: 'arxiv', citationCount: 0 }),
    makePaper({ id: 'arxiv:2026.0002', title: 'Paper 10', authors: [delta], source: 'arxiv', citationCount: 0 }),
  ];
}

// ---------- Scenarios ----------

async function scenario1HappyPath() {
  const m = require('../core/rs-fetcher-experts.cjs');
  const papers = fixtureTenPapersSixAuthors();
  const experts = m.mapExperts(papers, {});
  captureOutput('1-happy-path', experts);

  assert.equal(experts.length, 6, 'expected 6 unique authors, got ' + experts.length);
  // Each expert has all 6 fields.
  for (const e of experts) {
    assert.ok('name' in e, 'name field present');
    assert.ok('orcid' in e, 'orcid field present');
    assert.ok('institution' in e, 'institution field present');
    assert.ok('paper_count' in e, 'paper_count field present');
    assert.ok('h_index_estimate' in e, 'h_index_estimate field present');
    assert.ok('public_email_or_null' in e, 'public_email_or_null field present');
    // No helper field should leak into output.
    assert.ok(!('citations_per_paper' in e), 'citations_per_paper helper must not leak; got ' + JSON.stringify(e));
  }

  // Smith, Jane should have paper_count === 4.
  const smith = experts.find(function (e) { return e.name === 'Smith, Jane'; });
  assert.ok(smith, 'Smith, Jane must be present');
  assert.equal(smith.paper_count, 4, 'Smith paper_count must be 4, got ' + smith.paper_count);
}

async function scenario2MissingOrcid() {
  const m = require('../core/rs-fetcher-experts.cjs');
  const papers = [
    makePaper({
      id: 'openalex:W100',
      authors: [{ name: 'NoOrcid, Person', institution: 'Some Uni', email: null }],
      source: 'openalex',
      citationCount: 1,
    }),
  ];
  const experts = m.mapExperts(papers, {});
  captureOutput('2-missing-orcid', experts);
  assert.equal(experts.length, 1);
  assert.strictEqual(experts[0].orcid, null, 'orcid must be explicit null when missing, got ' + JSON.stringify(experts[0].orcid));
}

async function scenario3MissingInstitution() {
  const m = require('../core/rs-fetcher-experts.cjs');
  const papers = [
    makePaper({
      id: 'openalex:W101',
      authors: [{ name: 'NoInst, Person', orcid: '0000-0001-9999-9999', email: null }],
      source: 'openalex',
      citationCount: 1,
    }),
  ];
  const experts = m.mapExperts(papers, {});
  captureOutput('3-missing-institution', experts);
  assert.equal(experts.length, 1);
  assert.strictEqual(experts[0].institution, null, 'institution must be explicit null when missing, got ' + JSON.stringify(experts[0].institution));
}

async function scenario4LoginGatedEmailSkipped() {
  const m = require('../core/rs-fetcher-experts.cjs');
  // Scopus is NOT in PUBLIC_EMAIL_SOURCES; the email must be dropped.
  const papers = [
    makePaper({
      id: 'scopus:S001',
      authors: [{ name: 'Scopus, User', orcid: '0000-0007-7777-7777', institution: 'Some Uni', email: 'someone@scopus.com' }],
      source: 'scopus',
      citationCount: 5,
    }),
  ];
  const experts = m.mapExperts(papers, {});
  captureOutput('4-login-gated-email-skipped', experts);
  assert.equal(experts.length, 1);
  assert.strictEqual(experts[0].public_email_or_null, null, 'Scopus email must be skipped, got ' + JSON.stringify(experts[0].public_email_or_null));
}

async function scenario5PaperCountAggregation() {
  const m = require('../core/rs-fetcher-experts.cjs');
  // Same author across 5 distinct papers.
  const author = { name: 'Multi, Author', orcid: '0000-0008-8888-8888', institution: 'X Uni', email: null };
  const papers = [];
  for (let i = 1; i <= 5; i += 1) {
    papers.push(makePaper({ id: 'openalex:W2' + String(i), authors: [author], source: 'openalex', citationCount: i }));
  }
  const experts = m.mapExperts(papers, {});
  captureOutput('5-paper-count-aggregation', experts);
  assert.equal(experts.length, 1);
  assert.equal(experts[0].paper_count, 5, 'paper_count must be 5, got ' + experts[0].paper_count);
}

async function scenario6HIndexEstimate() {
  const m = require('../core/rs-fetcher-experts.cjs');
  // Citations [10, 8, 5, 3, 1] -> h-index = 3
  // h=3: papers with >=3 citations = 4 (10,8,5,3) -> >=3, ok
  // h=4: papers with >=4 citations = 3 (10,8,5) -> NOT >=4 papers, fail
  const author = { name: 'Hindex, Author', orcid: '0000-0009-9999-9999', institution: 'Y Uni', email: null };
  const cites = [10, 8, 5, 3, 1];
  const papers = cites.map(function (c, i) {
    return makePaper({ id: 'openalex:WH' + String(i), authors: [author], source: 'openalex', citationCount: c });
  });
  const experts = m.mapExperts(papers, {});
  captureOutput('6-hindex-estimate', experts);
  assert.equal(experts.length, 1);
  assert.equal(experts[0].h_index_estimate, 3, 'h_index_estimate from [10,8,5,3,1] must be 3, got ' + experts[0].h_index_estimate);

  // Verify exposed helper too.
  if (m._test && m._test.computeHIndexEstimate) {
    assert.equal(m._test.computeHIndexEstimate([10, 8, 5, 3, 1]), 3);
    assert.equal(m._test.computeHIndexEstimate([0, 0, 0]), 0);
    assert.equal(m._test.computeHIndexEstimate([]), 0);
    assert.equal(m._test.computeHIndexEstimate([1]), 1);
    assert.equal(m._test.computeHIndexEstimate([5, 5, 5, 5, 5]), 5);
  }
}

async function scenario7DedupDeterministic() {
  const m = require('../core/rs-fetcher-experts.cjs');
  const papers = fixtureTenPapersSixAuthors();
  const experts1 = m.mapExperts(papers, {});
  const experts2 = m.mapExperts(papers, {});
  captureOutput('7-dedup-determinism-1', experts1);
  captureOutput('7-dedup-determinism-2', experts2);
  assert.equal(JSON.stringify(experts1), JSON.stringify(experts2),
    'determinism: same input must produce byte-identical output');
}

async function scenario8SortOrderDeterministic() {
  const m = require('../core/rs-fetcher-experts.cjs');
  const beta = { name: 'Beta', orcid: '0000-0010-0000-0001', institution: 'B Uni', email: null };
  const alpha = { name: 'Alpha', orcid: '0000-0010-0000-0002', institution: 'A Uni', email: null };
  const gamma = { name: 'Gamma', orcid: '0000-0010-0000-0003', institution: 'G Uni', email: null };

  // Beta on 5, Alpha on 5, Gamma on 3.
  const papers = [];
  for (let i = 0; i < 5; i += 1) {
    papers.push(makePaper({ id: 'openalex:WB' + i, authors: [beta], source: 'openalex', citationCount: 1 }));
  }
  for (let i = 0; i < 5; i += 1) {
    papers.push(makePaper({ id: 'openalex:WA' + i, authors: [alpha], source: 'openalex', citationCount: 1 }));
  }
  for (let i = 0; i < 3; i += 1) {
    papers.push(makePaper({ id: 'openalex:WG' + i, authors: [gamma], source: 'openalex', citationCount: 1 }));
  }

  const experts = m.mapExperts(papers, {});
  captureOutput('8-sort-order', experts);
  assert.equal(experts.length, 3);
  // Expected order: Alpha (5), Beta (5), Gamma (3). paper_count desc, name asc tiebreak.
  assert.equal(experts[0].name, 'Alpha', 'first must be Alpha (paper_count desc, name asc), got ' + experts[0].name);
  assert.equal(experts[1].name, 'Beta', 'second must be Beta, got ' + experts[1].name);
  assert.equal(experts[2].name, 'Gamma', 'third must be Gamma, got ' + experts[2].name);
  assert.equal(experts[0].paper_count, 5);
  assert.equal(experts[1].paper_count, 5);
  assert.equal(experts[2].paper_count, 3);
}

async function scenario9AdvForbiddenInName() {
  const m = require('../core/rs-fetcher-experts.cjs');
  // FORBIDDEN_PATTERNS[2] matches Lawrence said -- forbidden in any output.
  const safeAuthor = { name: 'Safe, Person', orcid: '0000-0011-0001-0001', institution: 'Safe Uni', email: null };
  const poisoned = { name: 'Lawrence said our PI', orcid: '0000-0011-0001-0002', institution: 'X', email: null };
  const papers = [
    makePaper({ id: 'openalex:WAA', authors: [safeAuthor, poisoned], source: 'openalex', citationCount: 1 }),
  ];
  let threw = null;
  let experts = null;
  try {
    experts = m.mapExperts(papers, {});
  } catch (err) {
    threw = err;
  }
  if (threw) {
    assert.equal(threw.name, 'ExternalEgressViolation',
      'must throw ExternalEgressViolation on adversarial name, got ' +
      (threw && threw.name));
    captureOutput('9-adv-name-throw', { thrown: threw.name });
  } else {
    captureOutput('9-adv-name-scrubbed', experts);
    const json = JSON.stringify(experts);
    assert.ok(!/Lawrence\s+said/i.test(json),
      'output must not contain Lawrence said fragment; got: ' + json);
    // Safe author still present.
    const safe = experts.find(function (e) { return e.name === 'Safe, Person'; });
    assert.ok(safe, 'Safe author must still be present');
  }
}

async function scenario10AdvForbiddenInEmail() {
  const m = require('../core/rs-fetcher-experts.cjs');
  // FORBIDDEN_PATTERNS[4] matches /\b\d{3}-\d{2}-\d{4}\b/.
  // Email contains an SSN-like pattern; isPublicEmail should return false because of regex
  // strictness AND defense-in-depth FORBIDDEN_PATTERNS scan should catch even if regex passes.
  const author = { name: 'EmailFail, Author', orcid: '0000-0012-0001-0001', institution: 'X Uni', email: 'ssn-123-45-6789@evil.example.com' };
  const papers = [
    makePaper({ id: 'openalex:WEM', authors: [author], source: 'openalex', citationCount: 1 }),
  ];
  let threw = null;
  let experts = null;
  try {
    experts = m.mapExperts(papers, {});
  } catch (err) {
    threw = err;
  }
  if (threw) {
    assert.equal(threw.name, 'ExternalEgressViolation',
      'must throw ExternalEgressViolation on adversarial email, got ' +
      (threw && threw.name));
    captureOutput('10-adv-email-throw', { thrown: threw.name });
  } else {
    captureOutput('10-adv-email-scrubbed', experts);
    assert.equal(experts.length, 1, 'expert still emitted (only email field stripped)');
    assert.strictEqual(experts[0].public_email_or_null, null,
      'email must be null when forbidden pattern present, got ' + JSON.stringify(experts[0].public_email_or_null));
    const json = JSON.stringify(experts);
    assert.ok(!/\b\d{3}-\d{2}-\d{4}\b/.test(json),
      'output must not contain SSN-like sequence; got: ' + json);
  }
}

async function scenario11AdvForbiddenInInstitution() {
  const m = require('../core/rs-fetcher-experts.cjs');
  // FORBIDDEN_PATTERNS[3] matches /\bmeeting with\b/i.
  const author = { name: 'InstFail, Author', orcid: '0000-0013-0001-0001', institution: 'meeting with Stanford', email: null };
  const papers = [
    makePaper({ id: 'openalex:WIN', authors: [author], source: 'openalex', citationCount: 1 }),
  ];
  let threw = null;
  let experts = null;
  try {
    experts = m.mapExperts(papers, {});
  } catch (err) {
    threw = err;
  }
  if (threw) {
    assert.equal(threw.name, 'ExternalEgressViolation',
      'must throw ExternalEgressViolation on adversarial institution, got ' +
      (threw && threw.name));
    captureOutput('11-adv-inst-throw', { thrown: threw.name });
  } else {
    captureOutput('11-adv-inst-scrubbed', experts);
    const json = JSON.stringify(experts);
    assert.ok(!/meeting with/i.test(json),
      'output must not contain meeting with fragment; got: ' + json);
  }
}

async function scenario12AdvForbiddenInPaperIdOrSource() {
  const m = require('../core/rs-fetcher-experts.cjs');
  // FORBIDDEN_PATTERNS[0] matches email pattern. Inject forbidden patterns into BOTH
  // paper.id and paper.source. Even though neither is part of the 6-field expert
  // contract, defense-in-depth pre-return audit must catch any path that smuggles
  // these strings into output (via accidental promotion to a helper field, etc.).
  const author = { name: 'IdSafe, Author', orcid: '0000-0014-0001-0001', institution: 'Safe Uni', email: null };
  const papers = [
    {
      id: 'openalex:W123|jonathan@mindrian.com',
      title: 'Sample Paper',
      abstract: 'Abstract.',
      authors: [author],
      institution: 'Safe Uni',
      doi: null,
      source: 'openalex<<meeting with Genentech>>',
      fetched_at: '2026-04-26T14:00:00Z',
      citationCount: 1,
    },
  ];
  let threw = null;
  let experts = null;
  try {
    experts = m.mapExperts(papers, {});
  } catch (err) {
    threw = err;
  }
  if (threw) {
    assert.equal(threw.name, 'ExternalEgressViolation',
      'must throw ExternalEgressViolation if forbidden bytes leak from paper.id or paper.source, got ' +
      (threw && threw.name));
    captureOutput('12-adv-paperid-throw', { thrown: threw.name });
  } else {
    captureOutput('12-adv-paperid-scrubbed', experts);
    const json = JSON.stringify(experts);
    // Paper id and source must NEVER smuggle bytes into expert output.
    assert.ok(!/jonathan@mindrian\.com/i.test(json),
      'expert output must not contain forbidden email from paper.id; got: ' + json);
    assert.ok(!/mindrian\.com/i.test(json),
      'expert output must not contain mindrian.com substring from paper.id; got: ' + json);
    assert.ok(!/meeting with/i.test(json),
      'expert output must not contain meeting with fragment from paper.source; got: ' + json);
    // Author still emitted.
    assert.equal(experts.length, 1, 'safe author still emitted');
  }
}

// ---------- A1 end-of-suite sweep ----------

function a1Sweep() {
  let hits = 0;
  for (const rec of capturedOutputs) {
    const json = JSON.stringify(rec.output);
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
  process.stdout.write('=== 89.2-05 fetcher-experts suite (REPO_ROOT=' +
    REPO_ROOT + ') ===\n');

  await runScenario('1-happy-path', scenario1HappyPath);
  await runScenario('2-missing-orcid', scenario2MissingOrcid);
  await runScenario('3-missing-institution', scenario3MissingInstitution);
  await runScenario('4-login-gated-email-skipped', scenario4LoginGatedEmailSkipped);
  await runScenario('5-paper-count-aggregation', scenario5PaperCountAggregation);
  await runScenario('6-hindex-estimate', scenario6HIndexEstimate);
  await runScenario('7-dedup-deterministic', scenario7DedupDeterministic);
  await runScenario('8-sort-order-deterministic', scenario8SortOrderDeterministic);
  await runScenario('9-adv-CANON-PART-8-name', scenario9AdvForbiddenInName);
  await runScenario('10-adv-CANON-PART-8-email', scenario10AdvForbiddenInEmail);
  await runScenario('11-adv-CANON-PART-8-institution', scenario11AdvForbiddenInInstitution);
  await runScenario('12-adv-CANON-PART-8-paper-id-or-source', scenario12AdvForbiddenInPaperIdOrSource);

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
    process.stdout.write('=== 89.2-05 fetcher-experts suite: ' +
      passed + '/12 passed' +
      ' (' + failed + ' failed) ===\n');
    for (const f of failures) {
      process.stderr.write('  FAILURE: ' + f.name + ': ' +
        (f.err && f.err.message ? f.err.message : String(f.err)) + '\n');
    }
    process.exit(1);
  }

  process.stdout.write('=== 89.2-05 fetcher-experts suite: 12/12 passed ===\n');
  process.exit(0);
})().catch(function (err) {
  process.stderr.write('FATAL: ' + (err && err.stack ? err.stack : err) + '\n');
  process.exit(2);
});
