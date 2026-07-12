#!/usr/bin/env node
'use strict';

/**
 * Regression (intern-w1-research-reach-broken):
 *
 * The intelligence tool's `research` command used to fall through to the
 * generic buildContext() doc-echo helper, which reads commands/research.md
 * off disk (no dedicated references/methodology/research.md exists) and
 * returns it verbatim - zero fetch, for any input. The fix special-cases
 * command === 'research' and wires research-context-extractor.cjs ->
 * source-lens-driver.cjs (Stage 1-4), returning real findings instead of
 * the command's own spec text.
 *
 * Hermetic: a _fetchCorpus stub is forwarded through runResearchPipeline ->
 * runSourceLens (the same test seam tests/test-131-source-lens-driver.cjs
 * already uses), so this suite makes ZERO live network calls.
 *
 * Zero test frameworks. Node built-in assert only. CJS only.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const PLUGIN_ROOT = path.resolve(__dirname, '..');
const router = require(path.join(PLUGIN_ROOT, 'lib', 'mcp', 'tool-router.cjs'));

let failed = 0;
function check(name, fn) {
  try {
    fn();
    process.stdout.write('  ok ' + name + '\n');
  } catch (err) {
    failed += 1;
    process.stderr.write('  FAIL ' + name + '\n    ' +
      (err && err.message ? err.message : err) + '\n');
  }
}

async function checkAsync(name, fn) {
  try {
    await fn();
    process.stdout.write('  ok ' + name + '\n');
  } catch (err) {
    failed += 1;
    process.stderr.write('  FAIL ' + name + '\n    ' +
      (err && err.message ? err.message : err) + '\n');
  }
}

// A deterministic fetchCorpus stub. Returns one item for openalex (the
// source a cold room's Tier-0 default scholarly lens maps to) and records
// every call so the suite can assert the pipeline actually invoked fetch.
function makeFetchStub() {
  const calls = [];
  const stub = async function fetchCorpusStub(args) {
    calls.push(args);
    if (args && args.source === 'openalex') {
      return [{
        id: 'https://example.org/pm-role-trend-study',
        url: 'https://example.org/pm-role-trend-study',
        title: 'Product Manager Role Demand: A Longitudinal Study',
        abstract: 'An analysis of PM role demand trends across sectors.',
        authors: [],
        institution: '',
        doi: null,
        source: 'openalex',
        fetched_at: '2026-07-11T00:00:00.000Z',
      }];
    }
    return [];
  };
  stub.calls = calls;
  return stub;
}

async function run() {
  const roomDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-research-pipeline-'));

  try {
    await checkAsync('runResearchPipeline invokes the real fetch pipeline, not the doc-echo fallback', async () => {
      const fetchStub = makeFetchStub();
      const output = await router._test.runResearchPipeline(roomDir, 'which job role is more in trend', {
        _fetchCorpus: fetchStub,
      });

      assert.ok(fetchStub.calls.length > 0,
        'the fetch stub must have been called at least once (pipeline must actually fetch)');
      assert.ok(!output.includes('# /mos:research'),
        'response must NOT contain the command spec header (the old doc-echo symptom)');
      assert.ok(!output.includes('reach_id: deep_research'),
        'response must NOT contain commands/research.md frontmatter (the old doc-echo symptom)');
      assert.ok(output.includes('Product Manager Role Demand'),
        'response must surface the fetched finding title (got: ' + output.slice(0, 300) + ')');
      assert.ok(output.includes('https://example.org/pm-role-trend-study'),
        'response must surface the finding source URL');
      assert.ok(output.includes('Filing decision needed'),
        'response must name the human filing decision as the next step, not auto-file it');
    });

    await checkAsync('a fetch source with zero results degrades to a no-findings message, never throws', async () => {
      const emptyStub = async () => [];
      const output = await router._test.runResearchPipeline(roomDir, 'a topic with no hits', {
        _fetchCorpus: emptyStub,
      });
      assert.ok(output.includes('### Findings'), 'response must still have a Findings section');
      assert.ok(!output.includes('# /mos:research'), 'response must never fall back to the doc-echo');
    });
  } finally {
    fs.rmSync(roomDir, { recursive: true, force: true });
  }

  process.stdout.write('\nintelligence-research-pipeline: ' +
    (failed === 0 ? 'ALL PASS' : failed + ' FAILED') + '\n');
  process.exit(failed === 0 ? 0 : 1);
}

run().catch((err) => {
  process.stderr.write('FATAL: ' + (err && err.stack ? err.stack : err) + '\n');
  process.exit(1);
});
