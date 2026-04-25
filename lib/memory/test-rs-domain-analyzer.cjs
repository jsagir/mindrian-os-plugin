#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 89.1 Plan 02 -- Domain analyzer adversarial fixture suite.
 *
 * 11 scenarios covering:
 *   Happy path                : scenario 1
 *   Edge cases                : scenarios 2-5 (empty, non-string, oversized, empty substrate)
 *   Boundary detection        : scenario 6
 *   Determinism               : scenario 7
 *   Adversarial (Canon Part 8): scenarios 8-11 (artifact body, venture name, email, SSN-like)
 *
 * Mocks loadSubstrate via require.cache override (Phase 90-08 / 89.1a-03 pattern).
 * Between scenarios, resetRequireCache clears rs-brain-substrate +
 * rs-brain-substrate-prompts + cross-room-aggregator + rs-domain-analyzer
 * so the next require sees fresh module state.
 *
 * End-of-suite sweep:
 *   A1: re-scan every analyzer output (JSON.stringify) against
 *       FORBIDDEN_PATTERNS + DANGEROUS_SUBSTRINGS as a cross-scenario
 *       Canon Part 8 guarantee. Any hit hard-fails the suite.
 *
 * Pure CJS, zero npm deps, node built-ins only (assert, fs, os, path).
 */

const assert = require('node:assert/strict');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

// Source of truth for the parity gate: re-export from the canonical
// location. Drift detection is automatic at this require boundary.
const crossRoomAggregator = require('../core/cross-room-aggregator.cjs');
const FORBIDDEN_PATTERNS = crossRoomAggregator.FORBIDDEN_PATTERNS;

// Hard substrings that must never appear in any analyzer output.
// Parity with Phase 89.1a-03 + 90-08 DANGEROUS_SUBSTRINGS.
const DANGEROUS_SUBSTRINGS = Object.freeze([
  'Lawrence',
  '5.2M',
  'meeting with',
  'jonathan@mindrian.com',
  '123-45-6789',
]);

// Every analyzer output captured for end-of-suite A1 sweep.
const capturedOutputs = [];

// ---------- Mock substrate loader ----------
//
// Override loadSubstrate via require.cache. The analyzer require()s
// rs-brain-substrate.cjs, so substituting its exports is sufficient.

function installMockLoadSubstrate(fixtureSubstrate, overrides) {
  overrides = overrides || {};
  const subPath = require.resolve('../core/rs-brain-substrate.cjs');
  // Load real module first so we can extend (preserves any other exports).
  delete require.cache[subPath];
  const realModule = require('../core/rs-brain-substrate.cjs');
  const fakeExports = Object.assign({}, realModule, {
    loadSubstrate: async function () {
      if (overrides.throwLoadSubstrate) {
        throw new Error('mock: loadSubstrate forced throw');
      }
      return {
        success: true,
        substrate: fixtureSubstrate,
        mode: overrides.mode || 'A3',
        cache_age_days: overrides.cache_age_days === undefined ? 0 : overrides.cache_age_days,
        warning: overrides.warning,
      };
    },
  });
  require.cache[subPath] = {
    id: subPath,
    filename: subPath,
    loaded: true,
    exports: fakeExports,
  };
}

function resetRequireCache() {
  const targets = [
    '../core/brain-client.cjs',
    '../core/rs-brain-substrate.cjs',
    '../core/rs-brain-substrate-prompts.cjs',
    '../core/cross-room-aggregator.cjs',
    '../core/rs-domain-analyzer.cjs',
  ];
  for (const t of targets) {
    try {
      const p = require.resolve(t);
      delete require.cache[p];
    } catch (_e) { /* best effort */ }
  }
}

// ---------- Scenario bookkeeping ----------

let passed = 0;
let failed = 0;
const failures = [];

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

// ---------- Helper: capture output for end-of-suite sweep ----------

function captureOutput(name, output) {
  capturedOutputs.push({ scenario: name, output: output });
}

// ---------- Fixtures ----------

function fixtureSubstrateRich() {
  // 5 entries, 5 different framework_names.
  return [
    {
      id: 'mindrian-knowledge_t2-rs-001',
      score: 0.92,
      metadata: {
        framework_name: 'reverse-salient-framework',
        title: 'Reverse Salient Innovation Discovery',
        text: 'Reverse salient analysis identifies lagging components in expanding systems.',
        tier: 'core',
      },
    },
    {
      id: 'mindrian-knowledge_t2-jtbd-002',
      score: 0.78,
      metadata: {
        framework_name: 'jtbd',
        title: 'Jobs to be Done',
        text: 'JTBD framework for innovation discovery.',
        tier: 'core',
      },
    },
    {
      id: 'mindrian-knowledge_t2-six-003',
      score: 0.65,
      metadata: {
        framework_name: 'six-thinking-hats',
        title: 'Six Thinking Hats',
        text: 'de Bono parallel-thinking innovation method.',
        tier: 't1',
      },
    },
    {
      id: 'mindrian-knowledge_t2-syst-004',
      score: 0.58,
      metadata: {
        framework_name: 'systems-thinking',
        title: 'Systems Thinking Reverse Salient',
        text: 'Hierarchical systems thinking and reverse salient discovery.',
        tier: 't1',
      },
    },
    {
      id: 'mindrian-knowledge_t2-hsi-005',
      score: 0.51,
      metadata: {
        framework_name: 'hsi-semantic-surprise-analysis',
        title: 'HSI Semantic Surprise Discovery',
        text: 'High semantic information for innovation surprise discovery.',
        tier: 't2',
      },
    },
  ];
}

// ---------- Scenarios ----------

async function scenario1HappyPath() {
  installMockLoadSubstrate(fixtureSubstrateRich());
  const m = require('../core/rs-domain-analyzer.cjs');
  const out = await m.analyzeDomain('reverse salient innovation discovery');
  captureOutput('1-happy-path', out);
  // 7-field shape required.
  assert.ok(out, 'output present');
  assert.ok('primary_domain' in out, 'has primary_domain');
  assert.ok(Array.isArray(out.concepts), 'concepts array');
  assert.ok(Array.isArray(out.terminology), 'terminology array');
  assert.ok(Array.isArray(out.methods), 'methods array');
  assert.ok(Array.isArray(out.breakthroughs), 'breakthroughs array');
  assert.equal(typeof out.boundary_flag, 'boolean', 'boundary_flag boolean');
  assert.ok(Array.isArray(out.adjacent_domains), 'adjacent_domains array');
  // Reverse-salient-framework should win on token intersection AND highest score.
  assert.equal(out.primary_domain, 'reverse-salient-framework',
    'primary should be reverse-salient-framework, got ' + out.primary_domain);
  assert.ok(out.concepts.length >= 3, 'concepts >= 3, got ' + out.concepts.length);
  assert.ok(out.terminology.length >= 3, 'terminology >= 3, got ' + out.terminology.length);
  assert.ok(out.methods.length >= 2, 'methods >= 2, got ' + out.methods.length);
  assert.ok(out.breakthroughs.length >= 1, 'breakthroughs >= 1, got ' + out.breakthroughs.length);
  assert.equal(out.boundary_flag, false, 'boundary should be false');
  assert.ok(out.adjacent_domains.length >= 1, 'adjacent >= 1');
  assert.ok(out.adjacent_domains.length <= 5, 'adjacent <= 5');
}

async function scenario2EmptyTopic() {
  installMockLoadSubstrate(fixtureSubstrateRich());
  const m = require('../core/rs-domain-analyzer.cjs');
  const out = await m.analyzeDomain('');
  captureOutput('2-empty-topic', out);
  assert.equal(out.error, 'invalid_topic');
  assert.equal(out.reason, 'empty_or_whitespace');
}

async function scenario3NonStringTopic() {
  installMockLoadSubstrate(fixtureSubstrateRich());
  const m = require('../core/rs-domain-analyzer.cjs');
  const out = await m.analyzeDomain(null);
  captureOutput('3-non-string', out);
  assert.equal(out.error, 'invalid_topic');
  assert.equal(out.reason, 'not_string');
}

async function scenario4OversizedTopic() {
  installMockLoadSubstrate(fixtureSubstrateRich());
  const m = require('../core/rs-domain-analyzer.cjs');
  const oversize = 'a'.repeat(5000);
  const out = await m.analyzeDomain(oversize);
  captureOutput('4-oversized', out);
  assert.equal(out.error, 'invalid_topic');
  assert.equal(out.reason, 'oversized');
  assert.equal(out.max, 512);
}

async function scenario5SubstrateEmpty() {
  installMockLoadSubstrate([], { mode: 'B3' });
  const m = require('../core/rs-domain-analyzer.cjs');
  const out = await m.analyzeDomain('innovation discovery');
  captureOutput('5-empty-substrate', out);
  assert.equal(out.primary_domain, null);
  assert.deepEqual(out.concepts, []);
  assert.deepEqual(out.terminology, []);
  assert.deepEqual(out.methods, []);
  assert.deepEqual(out.breakthroughs, []);
  assert.equal(out.boundary_flag, true);
  assert.deepEqual(out.adjacent_domains, []);
  assert.equal(out.warning, 'substrate_empty_tier0');
}

async function scenario6BoundaryDetection() {
  // Single low-score entry.
  const lowScoreSubstrate = [
    {
      id: 'mindrian-knowledge_t2-low-001',
      score: 0.3,
      metadata: {
        framework_name: 'obscure-framework',
        title: 'Obscure Framework',
        text: 'Some obscure methodology.',
        tier: 't2',
      },
    },
  ];
  installMockLoadSubstrate(lowScoreSubstrate);
  const m = require('../core/rs-domain-analyzer.cjs');
  const out = await m.analyzeDomain('cancer immunotherapy biomarker discovery');
  captureOutput('6-boundary', out);
  assert.equal(out.boundary_flag, true,
    'boundary_flag should be true for score=0.3 < threshold 0.5');
}

async function scenario7Determinism() {
  installMockLoadSubstrate(fixtureSubstrateRich());
  const m = require('../core/rs-domain-analyzer.cjs');
  const out1 = await m.analyzeDomain('reverse salient innovation discovery');
  const out2 = await m.analyzeDomain('reverse salient innovation discovery');
  captureOutput('7-determinism-1', out1);
  captureOutput('7-determinism-2', out2);
  assert.equal(JSON.stringify(out1), JSON.stringify(out2),
    'determinism: same input must produce byte-identical output');
}

async function scenario8AdversarialMeetingFragmentInText() {
  // FORBIDDEN_PATTERNS[3] matches /\bmeeting with\b/i.
  const poisoned = [
    {
      id: 'mindrian-knowledge_t2-adv-001',
      score: 0.9,
      metadata: {
        framework_name: 'rs',
        title: 'Strategy review',
        text: 'meeting with Dr Smith about Q4 financials',
        tier: 'core',
      },
    },
  ];
  installMockLoadSubstrate(poisoned);
  const m = require('../core/rs-domain-analyzer.cjs');
  let threw = null;
  let out = null;
  try {
    out = await m.analyzeDomain('innovation strategy');
  } catch (err) {
    threw = err;
  }
  // Either the analyzer threw ExternalEgressViolation OR the output
  // does not contain the forbidden fragment. Both satisfy Canon Part 8.
  if (threw) {
    assert.equal(threw.name, 'ExternalEgressViolation',
      'must throw ExternalEgressViolation on adversarial fixture, got ' +
      (threw && threw.name));
    captureOutput('8-adv-meeting-throw', { thrown: threw.name });
  } else {
    captureOutput('8-adv-meeting-scrubbed', out);
    const json = JSON.stringify(out);
    assert.ok(!/meeting with/i.test(json),
      'output must not contain "meeting with" fragment; got: ' + json);
  }
}

async function scenario9AdversarialVentureNameInTopic() {
  installMockLoadSubstrate(fixtureSubstrateRich());
  const m = require('../core/rs-domain-analyzer.cjs');
  // FORBIDDEN_PATTERNS[2] matches "Lawrence said" / "Lawrence revealed", etc.
  // FORBIDDEN_PATTERNS[1] matches "$5.2M".
  const out = await m.analyzeDomain('Lawrence said our valuation is $5.2M');
  captureOutput('9-adv-topic-leaked', out);
  assert.equal(out.error, 'invalid_topic');
  assert.equal(out.reason, 'forbidden_input',
    'topic must be rejected at input gate; got reason=' + out.reason);
}

async function scenario10AdversarialEmailInTitle() {
  // FORBIDDEN_PATTERNS[0] matches /@[a-zA-Z0-9._-]+\.[a-zA-Z]{2,}/.
  const poisoned = [
    {
      id: 'mindrian-knowledge_t2-adv-002',
      score: 0.9,
      metadata: {
        framework_name: 'rs',
        title: 'jonathan@mindrian.com analysis',
        text: 'Strategy framework.',
        tier: 'core',
      },
    },
  ];
  installMockLoadSubstrate(poisoned);
  const m = require('../core/rs-domain-analyzer.cjs');
  let threw = null;
  let out = null;
  try {
    out = await m.analyzeDomain('innovation strategy');
  } catch (err) {
    threw = err;
  }
  if (threw) {
    assert.equal(threw.name, 'ExternalEgressViolation',
      'must throw ExternalEgressViolation on email-in-title, got ' +
      (threw && threw.name));
    captureOutput('10-adv-email-throw', { thrown: threw.name });
  } else {
    captureOutput('10-adv-email-scrubbed', out);
    const json = JSON.stringify(out);
    assert.ok(!/jonathan@mindrian\.com/i.test(json),
      'output must not contain leaked email; got: ' + json);
  }
}

async function scenario11AdversarialSSNInSourceFile() {
  // FORBIDDEN_PATTERNS[4] matches /\b\d{3}-\d{2}-\d{4}\b/.
  const poisoned = [
    {
      id: 'mindrian-knowledge_t2-adv-003',
      score: 0.8,
      metadata: {
        framework_name: 'rs',
        title: 'Notes',
        text: 'Strategy notes.',
        source_file: 'notes-123-45-6789.md',
        tier: 'core',
      },
    },
  ];
  installMockLoadSubstrate(poisoned);
  const m = require('../core/rs-domain-analyzer.cjs');
  let threw = null;
  let out = null;
  try {
    out = await m.analyzeDomain('innovation strategy');
  } catch (err) {
    threw = err;
  }
  if (threw) {
    assert.equal(threw.name, 'ExternalEgressViolation',
      'must throw ExternalEgressViolation on SSN-like, got ' +
      (threw && threw.name));
    captureOutput('11-adv-ssn-throw', { thrown: threw.name });
  } else {
    captureOutput('11-adv-ssn-scrubbed', out);
    const json = JSON.stringify(out);
    assert.ok(!/\b\d{3}-\d{2}-\d{4}\b/.test(json),
      'output must not contain SSN-like sequence; got: ' + json);
  }
}

// ---------- A1 end-of-suite sweep ----------
//
// Walk every captured output, JSON.stringify, scan against
// FORBIDDEN_PATTERNS + DANGEROUS_SUBSTRINGS. Any hit hard-fails.

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
  process.stdout.write('=== 89.1-02 domain-analyzer suite (REPO_ROOT=' +
    REPO_ROOT + ') ===\n');

  await runScenario('1-happy-path', scenario1HappyPath);
  await runScenario('2-empty-topic', scenario2EmptyTopic);
  await runScenario('3-non-string-topic', scenario3NonStringTopic);
  await runScenario('4-oversized-topic', scenario4OversizedTopic);
  await runScenario('5-substrate-empty-B3', scenario5SubstrateEmpty);
  await runScenario('6-boundary-detection', scenario6BoundaryDetection);
  await runScenario('7-determinism', scenario7Determinism);
  await runScenario('8-adversarial-meeting-fragment', scenario8AdversarialMeetingFragmentInText);
  await runScenario('9-adversarial-venture-in-topic', scenario9AdversarialVentureNameInTopic);
  await runScenario('10-adversarial-email-in-title', scenario10AdversarialEmailInTitle);
  await runScenario('11-adversarial-ssn-in-source-file', scenario11AdversarialSSNInSourceFile);

  // A1 sweep across all captured outputs.
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

  process.stdout.write('=== 89.1-02 domain-analyzer suite: ' +
    passed + '/11 passed' +
    (failed > 0 ? '  (' + failed + ' failed)' : '') +
    ' ===\n');

  if (failed > 0) {
    for (const f of failures) {
      process.stderr.write('  FAILURE: ' + f.name + ': ' +
        (f.err && f.err.message ? f.err.message : String(f.err)) + '\n');
    }
    process.exit(1);
  }
  process.exit(0);
})().catch(function (err) {
  process.stderr.write('FATAL: ' + (err && err.stack ? err.stack : err) + '\n');
  process.exit(2);
});
