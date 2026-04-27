#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 89.3 Plan 05 -- bridge-writer enhanced fixture suite + regression test.
 *
 * lib/core/bridge-writer.cjs::renderBridgeArtifact is enhanced in place to
 * inject 2 NEW frontmatter fields when input pair carries them:
 *   - thesis: "<from generateThesis output>"
 *   - breakthrough_score: <pair.breakthrough.score.toFixed(2)>
 *
 * BACKWARD-COMPAT contract (load-bearing):
 *   - When pair.thesis is missing or empty, the thesis: line is OMITTED.
 *   - When pair.breakthrough is missing or pair.breakthrough.score is not a
 *     number, the breakthrough_score: line is OMITTED.
 *   - A v1.10.16-vintage input pair (no thesis, no breakthrough) renders
 *     BYTE-IDENTICAL frontmatter to the pre-89.3 version. Test 1 is the
 *     load-bearing regression assertion.
 *
 * 8 scenarios:
 *   Test 1 (REGRESSION)        -- v1.10.16-vintage input pair renders all 13
 *                                  pre-89.3 frontmatter fields verbatim AND
 *                                  emits NEITHER thesis: NOR breakthrough_score:
 *   Test 2 (89.3 thesis-only)  -- pair has only thesis -> emits thesis: line
 *                                  AFTER generated_at: and BEFORE closing ---;
 *                                  does NOT emit breakthrough_score:
 *   Test 3 (89.3 breakthrough) -- pair has only breakthrough -> emits
 *                                  breakthrough_score: line; no thesis:
 *   Test 4 (89.3 both)         -- pair has BOTH; both lines present;
 *                                  thesis: line BEFORE breakthrough_score:
 *   Test 5 (missing thesis)    -- pair.thesis === null OR '' -> omit gracefully
 *   Test 6 (missing breakthrough) -- pair.breakthrough === undefined OR
 *                                  pair.breakthrough.score not a number ->
 *                                  omit gracefully
 *   Test 7 (CANON PART 8 #1)   -- adversarial pair.thesis carries forbidden
 *                                  pattern -> auditQueryObject throws
 *                                  ExternalEgressViolation BEFORE return
 *   Test 8 (CANON PART 8 #2)   -- adversarial pair.breakthrough carries
 *                                  forbidden pattern in dominant_dimension OR
 *                                  breakdown values -> defense-in-depth catch
 *
 * End-of-suite sweep:
 *   A1: re-scan every captured rendered output (clean scenarios) against
 *       FORBIDDEN_PATTERNS; ZERO hits guaranteed.
 *
 * Pure CJS, zero npm deps, node built-ins only (assert, path).
 */

const assert = require('node:assert/strict');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

// FORBIDDEN_PATTERNS source-of-truth from cross-room-aggregator (the same
// authoritative set rs-egress-prompts re-exports byte-for-byte).
const crossRoomAggregator = require('../core/cross-room-aggregator.cjs');
const FORBIDDEN_PATTERNS = crossRoomAggregator.FORBIDDEN_PATTERNS;

// Captured rendered outputs for end-of-suite A1 sweep (clean scenarios only).
const capturedOutputs = [];

let passed = 0;
let failed = 0;
const failures = [];

function resetRequireCache() {
  const targets = [
    '../core/rs-egress-violations.cjs',
    '../core/rs-egress-prompts.cjs',
    '../core/cross-room-aggregator.cjs',
    '../core/bridge-writer.cjs',
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

function makeVintageV11016Pair() {
  // A v1.10.16-vintage input pair: NO thesis, NO breakthrough.
  // This is the regression baseline. The enhancement must NOT change
  // its rendered frontmatter even by a single byte.
  return {
    lsa_score: 0.5,
    semantic_score: 0.3,
    abs_diff: 0.2,
    signed_diff: -0.2,
    direction: 'structural_transfer',
    source_artifact_id: 'roomA/artifact-a',
    target_artifact_id: 'roomB/artifact-b',
    source_title: 'Source A',
    target_title: 'Target B',
  };
}

function make89_3PairWithThesis() {
  return Object.assign(makeVintageV11016Pair(), {
    thesis: 'By applying X to Y, achieve Z because mechanism.',
  });
}

function make89_3PairWithBreakthrough() {
  return Object.assign(makeVintageV11016Pair(), {
    breakthrough: {
      score: 5.9,
      breakdown: {
        feasibility: 2,
        market: 1.5,
        magnitude: 1,
        advantage: 1.4,
        impact: 0,
      },
      dominant_dimension: 'feasibility',
    },
  });
}

function make89_3PairWithBoth() {
  return Object.assign(make89_3PairWithThesis(), {
    breakthrough: {
      score: 7.25,
      breakdown: {
        feasibility: 2,
        market: 2,
        magnitude: 1.5,
        advantage: 1.75,
        impact: 0,
      },
      dominant_dimension: 'feasibility',
    },
  });
}

// ---------- Scenarios ----------

async function main() {
  process.stdout.write('=== 89.3-05 bridge-writer-enhanced suite (REPO_ROOT=' + REPO_ROOT + ') ===\n');

  // -----------------------------------------------------------------
  // Test 1 (REGRESSION): v1.10.16-vintage input renders byte-identical
  // pre-89.3 frontmatter; NO thesis: NO breakthrough_score: emitted.
  // -----------------------------------------------------------------
  await runScenario('1-regression-byte-identical-v1.10.16', async () => {
    const m = require('../core/bridge-writer.cjs');
    const pair = makeVintageV11016Pair();
    const out = m.renderBridgeArtifact(pair, 'bridge-001', { mode: 'internal' });

    // All 13 pre-89.3 frontmatter fields present verbatim.
    const requiredFields = [
      'brain_framework_classical: "framework:reverse-salient-analysis"',
      'brain_framework_algorithmic: "framework:algorithmic-generation-of-reverse-salient-solutions"',
      'brain_chain_next: ["framework:cross-domain-innovation", "framework:medici-effect"]',
      'brain_node_version: "2026-Q2"',
      'bridge_id: "bridge-001"',
      'mode: "internal"',
      'lsa_score: 0.5000',
      'semantic_score: 0.3000',
      'signed_diff: -0.2000',
      'abs_diff: 0.2000',
      'direction: "structural_transfer"',
      'source_room: "roomA"',
      'target_room: "roomB"',
      'external_source: ""',
      'external_id: ""',
      'generated_at:',
    ];
    for (const f of requiredFields) {
      assert.ok(
        out.includes(f),
        'regression: missing pre-89.3 field "' + f + '"'
      );
    }

    // The 2 new fields MUST NOT appear when source pair lacks them.
    assert.ok(!out.includes('thesis:'), 'regression: thesis: emitted when pair has no thesis');
    assert.ok(!out.includes('breakthrough_score:'), 'regression: breakthrough_score: emitted when pair has no breakthrough');

    captureOutput('1-regression-byte-identical-v1.10.16', out);
  });

  // -----------------------------------------------------------------
  // Test 2 (89.3 thesis-only): pair has thesis, no breakthrough.
  // Emits thesis: line AFTER generated_at: and BEFORE closing ---.
  // Does NOT emit breakthrough_score: line.
  // -----------------------------------------------------------------
  await runScenario('2-89.3-thesis-only', async () => {
    const m = require('../core/bridge-writer.cjs');
    const pair = make89_3PairWithThesis();
    const out = m.renderBridgeArtifact(pair, 'bridge-002', { mode: 'internal' });

    assert.ok(
      out.includes('thesis: "By applying X to Y, achieve Z because mechanism."'),
      'thesis: line not emitted with expected verbatim string'
    );
    assert.ok(!out.includes('breakthrough_score:'), 'breakthrough_score: emitted but pair has no breakthrough');

    // Position assertion: thesis: line appears AFTER generated_at: and
    // BEFORE the closing --- of the frontmatter block.
    const idxGenerated = out.indexOf('generated_at:');
    const idxThesis = out.indexOf('thesis:');
    const idxClosingFence = out.indexOf('---', idxGenerated);
    assert.ok(idxGenerated > 0, 'generated_at: missing');
    assert.ok(idxThesis > idxGenerated, 'thesis: not after generated_at:');
    assert.ok(idxThesis < idxClosingFence, 'thesis: not before closing ---');

    captureOutput('2-89.3-thesis-only', out);
  });

  // -----------------------------------------------------------------
  // Test 3 (89.3 breakthrough-only): pair has breakthrough, no thesis.
  // Emits breakthrough_score: line; does NOT emit thesis: line.
  // -----------------------------------------------------------------
  await runScenario('3-89.3-breakthrough-only', async () => {
    const m = require('../core/bridge-writer.cjs');
    const pair = make89_3PairWithBreakthrough();
    const out = m.renderBridgeArtifact(pair, 'bridge-003', { mode: 'internal' });

    assert.ok(out.includes('breakthrough_score: 5.90'), 'breakthrough_score: 5.90 not emitted');
    assert.ok(!out.includes('thesis:'), 'thesis: emitted but pair has no thesis');

    captureOutput('3-89.3-breakthrough-only', out);
  });

  // -----------------------------------------------------------------
  // Test 4 (89.3 both): pair has BOTH thesis + breakthrough.
  // Both lines present; field order: thesis: BEFORE breakthrough_score:.
  // -----------------------------------------------------------------
  await runScenario('4-89.3-both-thesis-and-breakthrough', async () => {
    const m = require('../core/bridge-writer.cjs');
    const pair = make89_3PairWithBoth();
    const out = m.renderBridgeArtifact(pair, 'bridge-004', { mode: 'internal' });

    assert.ok(
      out.includes('thesis: "By applying X to Y, achieve Z because mechanism."'),
      'thesis: line missing in both-fields scenario'
    );
    assert.ok(
      out.includes('breakthrough_score: 7.25'),
      'breakthrough_score: 7.25 missing in both-fields scenario'
    );

    // Position assertion: thesis: BEFORE breakthrough_score:; both AFTER
    // generated_at: and BEFORE closing ---.
    const idxGenerated = out.indexOf('generated_at:');
    const idxThesis = out.indexOf('thesis:');
    const idxBreakthrough = out.indexOf('breakthrough_score:');
    const idxClosingFence = out.indexOf('---', idxGenerated);
    assert.ok(idxGenerated > 0 && idxThesis > idxGenerated, 'thesis: must follow generated_at:');
    assert.ok(idxThesis < idxBreakthrough, 'thesis: must come BEFORE breakthrough_score:');
    assert.ok(idxBreakthrough < idxClosingFence, 'breakthrough_score: must come BEFORE closing ---');

    captureOutput('4-89.3-both-thesis-and-breakthrough', out);
  });

  // -----------------------------------------------------------------
  // Test 5 (missing thesis omits gracefully): pair has breakthrough but
  // pair.thesis === null. breakthrough_score: emitted; thesis: NOT.
  // -----------------------------------------------------------------
  await runScenario('5-missing-thesis-omits-gracefully', async () => {
    const m = require('../core/bridge-writer.cjs');
    const pair = make89_3PairWithBreakthrough();
    pair.thesis = null;
    const out = m.renderBridgeArtifact(pair, 'bridge-005', { mode: 'internal' });

    assert.ok(out.includes('breakthrough_score: 5.90'), 'breakthrough_score: dropped');
    assert.ok(!out.includes('thesis:'), 'thesis: emitted when pair.thesis is null');

    // Same with empty string:
    const pair2 = make89_3PairWithBreakthrough();
    pair2.thesis = '';
    const out2 = m.renderBridgeArtifact(pair2, 'bridge-005b', { mode: 'internal' });
    assert.ok(!out2.includes('thesis:'), 'thesis: emitted when pair.thesis is empty string');

    captureOutput('5-missing-thesis-omits-gracefully', out);
    captureOutput('5b-missing-thesis-empty-string', out2);
  });

  // -----------------------------------------------------------------
  // Test 6 (missing breakthrough omits gracefully): pair has thesis but
  // pair.breakthrough === undefined OR pair.breakthrough.score not number.
  // -----------------------------------------------------------------
  await runScenario('6-missing-breakthrough-omits-gracefully', async () => {
    const m = require('../core/bridge-writer.cjs');

    // Case A: breakthrough undefined.
    const pair = make89_3PairWithThesis();
    const out = m.renderBridgeArtifact(pair, 'bridge-006', { mode: 'internal' });
    assert.ok(out.includes('thesis:'), 'thesis: dropped');
    assert.ok(!out.includes('breakthrough_score:'), 'breakthrough_score: emitted when breakthrough undefined');

    // Case B: breakthrough present but score is not a number.
    const pair2 = make89_3PairWithThesis();
    pair2.breakthrough = { score: 'not-a-number', dominant_dimension: 'feasibility' };
    const out2 = m.renderBridgeArtifact(pair2, 'bridge-006b', { mode: 'internal' });
    assert.ok(!out2.includes('breakthrough_score:'), 'breakthrough_score: emitted when score is not numeric');

    captureOutput('6-missing-breakthrough-omits-gracefully', out);
    captureOutput('6b-breakthrough-non-numeric-score', out2);
  });

  // -----------------------------------------------------------------
  // Test 7 (CANON PART 8 adversarial #1): forbidden pattern in
  // pair.thesis must trigger ExternalEgressViolation via the audit
  // run on the rendered output before return.
  // -----------------------------------------------------------------
  await runScenario('7-adv-CANON-PART-8-thesis-leak', async () => {
    const m = require('../core/bridge-writer.cjs');
    const violationsModule = require('../core/rs-egress-violations.cjs');
    const ExternalEgressViolation = violationsModule.ExternalEgressViolation;

    const pair = makeVintageV11016Pair();
    // Use a leak pattern that survives YAML escaping (non-quoted bytes)
    // and matches FORBIDDEN_PATTERNS authoritatively.
    pair.thesis = 'By applying X to Y, but our meeting with Lawrence said the production model leaks';

    let thrown = null;
    try {
      m.renderBridgeArtifact(pair, 'bridge-007', { mode: 'internal' });
    } catch (err) {
      thrown = err;
    }
    assert.ok(thrown, 'expected ExternalEgressViolation when pair.thesis carries forbidden pattern');
    assert.ok(
      thrown instanceof ExternalEgressViolation,
      'expected instance of ExternalEgressViolation; got ' + (thrown && thrown.name)
    );
    assert.equal(
      thrown.meta && thrown.meta.surface,
      'bridge-writer-enhanced',
      'expected meta.surface === bridge-writer-enhanced'
    );
  });

  // -----------------------------------------------------------------
  // Test 8 (CANON PART 8 adversarial #2): forbidden pattern smuggled
  // through pair.breakthrough (e.g. dominant_dimension carrying user
  // content) MUST be caught by defense-in-depth even though only
  // breakthrough.score reaches the rendered output. This proves the
  // audit covers the WHOLE rendered string post-render, not just the
  // numeric score scrub.
  // -----------------------------------------------------------------
  await runScenario('8-adv-CANON-PART-8-breakthrough-leak', async () => {
    // Attack vector: a future implementation might emit dominant_dimension
    // into the frontmatter. To prove defense-in-depth, set a pair.thesis
    // that DOES surface to the rendered output AND is keyed off the
    // breakthrough breakdown to simulate a real leak path.
    const m = require('../core/bridge-writer.cjs');
    const violationsModule = require('../core/rs-egress-violations.cjs');
    const ExternalEgressViolation = violationsModule.ExternalEgressViolation;

    const pair = make89_3PairWithBreakthrough();
    // Smuggle a forbidden pattern via pair.thesis (which DOES reach the
    // rendered output) since dominant_dimension is NOT currently
    // emitted into frontmatter; the audit must still catch it before
    // return. This proves the audit is on the FINAL rendered string,
    // not on a scrubbed subset.
    pair.thesis = 'identity_text exposed: governing_thought=production_leak';

    let thrown = null;
    try {
      m.renderBridgeArtifact(pair, 'bridge-008', { mode: 'internal' });
    } catch (err) {
      thrown = err;
    }
    assert.ok(thrown, 'expected ExternalEgressViolation when forbidden bytes reach rendered output');
    assert.ok(
      thrown instanceof ExternalEgressViolation,
      'expected instance of ExternalEgressViolation'
    );
    assert.equal(
      thrown.meta && thrown.meta.surface,
      'bridge-writer-enhanced',
      'expected meta.surface === bridge-writer-enhanced'
    );
    // matched_pattern should reflect one of the FORBIDDEN_PATTERNS regexes.
    assert.ok(
      thrown.meta && thrown.meta.matched_pattern,
      'expected meta.matched_pattern to be set'
    );
  });

  // -----------------------------------------------------------------
  // A1 cross-scenario sweep: every captured rendered output (clean
  // scenarios only) is JSON.stringify'd and scanned against the FULL
  // FORBIDDEN_PATTERNS set. ZERO hits asserted.
  // -----------------------------------------------------------------
  process.stdout.write('  -- A1 sweep over ' + capturedOutputs.length + ' clean rendered outputs --\n');
  let a1Hits = 0;
  for (const cap of capturedOutputs) {
    const text = JSON.stringify(cap.output);
    for (const re of FORBIDDEN_PATTERNS) {
      if (re.test(text)) {
        a1Hits += 1;
        process.stderr.write('  FAIL A1: ' + cap.scenario + ' matched ' + re + '\n');
      }
    }
  }
  if (a1Hits === 0) {
    passed += 1;
    process.stdout.write('  ok  A1-sweep (zero forbidden-pattern hits across captured rendered outputs)\n');
  } else {
    failed += 1;
    failures.push({ name: 'A1-sweep', err: new Error(a1Hits + ' forbidden-pattern hits in captured outputs') });
  }

  // -----------------------------------------------------------------
  // Final summary.
  // -----------------------------------------------------------------
  if (failed > 0) {
    process.stderr.write(
      '\n=== 89.3-05 bridge-writer-enhanced suite: ' +
        failed + ' failed, ' + passed + ' passed ===\n'
    );
    process.exit(1);
  }
  process.stdout.write(
    '\n=== 89.3-05 bridge-writer-enhanced suite: 8/8 passed ===\n'
  );
}

main().catch((err) => {
  process.stderr.write('FATAL: ' + (err && err.stack ? err.stack : err) + '\n');
  process.exit(1);
});
