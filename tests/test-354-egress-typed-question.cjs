#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 354 Plan 06 (THEO-03), Task 1 -- the failing regression this plan
 * exists to turn green. Seed: docs/reviews/phase-354-probes/theo.cjs's
 * false-safe-egress probe, which measured that
 * lib/core/part8-egress-guard.cjs:521-531's keyword-presence test let a
 * private sentence that merely mentions "SWOT" reach the real Brain wire
 * through brain.ask().
 *
 * Cases (per 354-06-PLAN.md Task 1):
 *   A. transport capture: brain.ask(PRIVATE) opens no wire, egress_blocked
 *      sentinel, class freeform_unproven.
 *   B. same proof for brain.search() and brain.smartSearch().
 *   C. classify() itself never returns allow for PRIVATE; class
 *      freeform_unproven.
 *   D. private corpus: >=10 sentences, one methodology word next to
 *      unproven prose each, all refused with zero captured bytes.
 *   E. generic corpus: >=20 questions built ONLY from canonical vocabulary,
 *      including every internal template instantiated with canonical
 *      inputs (brain-router.cjs, rs-chain-feeder.cjs, rs-explain-command.cjs)
 *      -- every one allows (class typed_question) and forwards.
 *   F. shim end-to-end: bin/mindrian-brain-mcp-client.cjs via
 *      StdioClientTransport, brain_ask(PRIVATE) renders the honest
 *      egress_blocked refusal and the capture server records nothing
 *      carrying 'cedar'.
 *
 * Plain Node harness. Exit 1 on any failure. No em-dashes (CLAUDE.md).
 */

const assert = require('node:assert/strict');
const path = require('node:path');

const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');

const REPO_ROOT = path.resolve(__dirname, '..');
const SHIM = path.join(REPO_ROOT, 'bin', 'mindrian-brain-mcp-client.cjs');

const {
  startCaptureServer,
  captured,
  resetCaptured,
  stopCaptureServer,
} = require('./helpers/brain-capture-server.cjs');

// ---------------------------------------------------------------------------
// The seed sentence from docs/reviews/phase-354-probes/theo.cjs's
// false-safe-egress probe, verbatim.
// ---------------------------------------------------------------------------
const PRIVATE = 'Use the SWOT framework on our confidential plan: cedar will acquire juniper next autumn.';

// ---------------------------------------------------------------------------
// Case D: private corpus. Each sentence carries exactly one methodology word
// (SWOT, first-principles, framework, methodology, Porter, chain, design-
// thinking, value-chain, technique) next to unproven prose (a venture-
// sounding proper noun, a date, "our"/"my", a money-free plan description).
// A unique proper-noun MARKER per sentence lets each case assert its own
// bytes never crossed, not merely that captured stayed empty in aggregate.
// ---------------------------------------------------------------------------
const PRIVATE_CORPUS = [
  { text: 'Use the SWOT framework on our confidential plan: cedar will acquire juniper next autumn.', marker: 'cedar' },
  { text: 'Apply first-principles thinking to my acquisition of Meridian Robotics before March.', marker: 'Meridian' },
  { text: 'Which framework fits our secret merger with Solstice Ventures?', marker: 'Solstice' },
  { text: 'Recommend a methodology for the Blackwood expansion our board approved yesterday.', marker: 'Blackwood' },
  { text: "Use Porter's five forces on our confidential Northwind deal.", marker: 'Northwind' },
  { text: 'What chain of frameworks should I use for our Ashgrove pilot launch?', marker: 'Ashgrove' },
  { text: 'Apply design-thinking to my proprietary Halcyon roadmap for next quarter.', marker: 'Halcyon' },
  { text: 'Use the value-chain framework to analyze our merger with Cobalt Systems.', marker: 'Cobalt' },
  { text: 'Recommend a technique for our undisclosed Ridgeline acquisition next spring.', marker: 'Ridgeline' },
  { text: 'Which methodology should I use for our secret Ferrow expansion plan?', marker: 'Ferrow' },
];

// ---------------------------------------------------------------------------
// Case E: generic corpus, built ONLY from canonical vocabulary. Every
// internal template this plan names, instantiated with canonical inputs.
// ---------------------------------------------------------------------------
function buildGenericCorpus() {
  const corpus = [];

  // Template 1: lib/mcp/brain-router.cjs::brainRoute, the exact assembly at
  // "recommend a framework for a " + safeDefinition + " definition " +
  // safeComplexity + " problem" (brain-router.cjs, brainRoute()).
  const definitions = ['undefined', 'ill-defined', 'well-defined'];
  const complexities = ['simple', 'complex', 'wicked'];
  definitions.forEach((definition) => {
    complexities.forEach((complexity) => {
      corpus.push({
        text: 'recommend a framework for a ' + definition + ' definition ' + complexity + ' problem',
        source: 'brain-router.cjs::brainRoute',
      });
    });
  });

  // Template 2: lib/core/rs-chain-feeder.cjs::_buildUpstreamQuestion is NOT
  // exported (checked: module.exports = { lookupUpstream, emitChainMetadata,
  // recommendSkillSpawn, SKILL_SPAWN_RULES, ExternalEgressViolation,
  // CanonVerbViolation, CANONICAL_VERBS }) -- reproduced here EXACTLY per its
  // source (rs-chain-feeder.cjs, _buildUpstreamQuestion(), the 'what
  // frameworks feed into the reverse salient framework' + ' for a ' +
  // safeProblem + ' problem' + ' at the ' + safeStage + ' stage' + '?'
  // assembly).
  const problemTypes = ['undefined', 'ill-defined', 'well-defined', 'wicked'];
  const stages = ['discovery', 'investment', 'scoping', 'execution'];
  problemTypes.forEach((problemType) => {
    stages.forEach((stage) => {
      let q = 'what frameworks feed into the reverse salient framework';
      if (problemType) q += ' for a ' + problemType + ' problem';
      if (stage) q += ' at the ' + stage + ' stage';
      q += '?';
      corpus.push({ text: q, source: 'rs-chain-feeder.cjs::_buildUpstreamQuestion' });
    });
  });

  // Template 3a: scripts/rs-explain-command.cjs's feeds_into_query branch --
  // 'what frameworks chain from ' + params.target_framework + ' via
  // FEEDS_INTO?' -- three real canonical framework names from
  // data/framework-names.json.
  const frameworkNames = ['Design Thinking', 'Adaptive Leadership', 'Black Hat Analysis'];
  frameworkNames.forEach((name) => {
    corpus.push({
      text: 'what frameworks chain from ' + name + ' via FEEDS_INTO?',
      source: 'rs-explain-command.cjs::feeds_into_query',
    });
  });

  // Template 3b: scripts/rs-explain-command.cjs's methodology_chain branch --
  // 'what methodology chain follows ' + params.source_id + '?' -- three real
  // command slugs from data/command-registry.json.
  const commandSlugs = ['diagnose', 'act', 'research'];
  commandSlugs.forEach((slug) => {
    corpus.push({
      text: 'what methodology chain follows ' + slug + '?',
      source: 'rs-explain-command.cjs::methodology_chain',
    });
  });

  return corpus;
}

const GENERIC_CORPUS = buildGenericCorpus();

let passed = 0;
let failed = 0;
function check(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      passed += 1;
      console.log('  ok - ' + name);
    })
    .catch((err) => {
      failed += 1;
      console.error('  FAIL - ' + name);
      console.error('    ' + (err && err.stack ? err.stack : err));
    });
}

function capturedContains(needle) {
  const wire = JSON.stringify(captured);
  return wire.indexOf(needle) !== -1;
}

async function main() {
  const { server, url } = await startCaptureServer();

  // ORDERING CONTRACT (load-bearing, per tests/helpers/brain-capture-
  // server.cjs's own docblock): set env BEFORE requiring brain-client, and
  // clear the require cache for isolation.
  process.env.MINDRIAN_BRAIN_URL = url;
  process.env.MINDRIAN_BRAIN_KEY = 'synthetic-354-06-key';

  const brainClientPath = path.join(REPO_ROOT, 'lib', 'core', 'brain-client.cjs');
  delete require.cache[brainClientPath];
  const brain = require(brainClientPath);

  const guardPath = path.join(REPO_ROOT, 'lib', 'core', 'part8-egress-guard.cjs');
  delete require.cache[guardPath];
  const guard = require(guardPath);

  console.log('Phase 354-06 (THEO-03) egress typed-question regression\n');

  // -------------------------------------------------------------------------
  // Case A: transport capture, brain.ask(PRIVATE).
  // -------------------------------------------------------------------------
  await check('Case A: brain.ask(PRIVATE) opens no Brain wire, egress_blocked/freeform_unproven', async () => {
    resetCaptured();
    const result = await brain.ask(PRIVATE);
    assert.ok(!capturedContains('cedar'), 'PRIVATE\'s "cedar" marker must never reach the capture server, captured: ' + JSON.stringify(captured));
    assert.ok(!capturedContains('juniper'), 'PRIVATE\'s "juniper" marker must never reach the capture server, captured: ' + JSON.stringify(captured));
    assert.strictEqual(captured.length, 0, 'zero tools/call requests expected, captured: ' + JSON.stringify(captured));
    assert.ok(result && typeof result === 'object', 'ask() must return an object, got: ' + JSON.stringify(result));
    assert.strictEqual(result.error, 'egress_blocked', 'expected error egress_blocked, got: ' + JSON.stringify(result));
    assert.strictEqual(result.egress_class, 'freeform_unproven', 'expected egress_class freeform_unproven, got: ' + JSON.stringify(result));
  });

  // -------------------------------------------------------------------------
  // Case B: search channels.
  // -------------------------------------------------------------------------
  await check('Case B1: brain.search(PRIVATE) opens no Brain wire, egress_blocked/freeform_unproven', async () => {
    resetCaptured();
    const result = await brain.search(PRIVATE);
    assert.ok(!capturedContains('cedar'), 'search: PRIVATE\'s "cedar" marker must never reach the capture server');
    assert.strictEqual(captured.length, 0, 'search: zero tools/call requests expected, captured: ' + JSON.stringify(captured));
    assert.ok(result && typeof result === 'object');
    assert.strictEqual(result.error, 'egress_blocked');
    assert.strictEqual(result.egress_class, 'freeform_unproven');
  });

  await check('Case B2: brain.smartSearch(PRIVATE) opens no Brain wire, egress_blocked/freeform_unproven', async () => {
    resetCaptured();
    const result = await brain.smartSearch(PRIVATE);
    assert.ok(!capturedContains('cedar'), 'smartSearch: PRIVATE\'s "cedar" marker must never reach the capture server');
    assert.strictEqual(captured.length, 0, 'smartSearch: zero tools/call requests expected, captured: ' + JSON.stringify(captured));
    assert.ok(result && typeof result === 'object');
    assert.strictEqual(result.error, 'egress_blocked');
    assert.strictEqual(result.egress_class, 'freeform_unproven');
  });

  // -------------------------------------------------------------------------
  // Case C: classify() itself.
  // -------------------------------------------------------------------------
  await check('Case C: classify(PRIVATE) never returns allow, class freeform_unproven', async () => {
    const verdict = guard.classify({ question: PRIVATE }, { toolName: 'brain_ask' });
    assert.notStrictEqual(verdict.verdict, 'allow', 'PRIVATE must not classify allow, got: ' + JSON.stringify(verdict));
    assert.strictEqual(verdict.class, 'freeform_unproven', 'expected class freeform_unproven, got: ' + JSON.stringify(verdict));
  });

  // -------------------------------------------------------------------------
  // Case D: private corpus, >=10 sentences, each refused with zero captured
  // bytes of the sentence.
  // -------------------------------------------------------------------------
  assert.ok(PRIVATE_CORPUS.length >= 10, 'private corpus must carry at least 10 sentences, has: ' + PRIVATE_CORPUS.length);
  for (let i = 0; i < PRIVATE_CORPUS.length; i++) {
    const entry = PRIVATE_CORPUS[i];
    await check('Case D[' + i + ']: private corpus sentence refused, zero captured bytes ("' + entry.marker + '")', async () => {
      resetCaptured();
      const result = await brain.ask(entry.text);
      assert.ok(!capturedContains(entry.marker), 'marker "' + entry.marker + '" must never reach the capture server, captured: ' + JSON.stringify(captured));
      assert.strictEqual(captured.length, 0, 'zero tools/call requests expected for "' + entry.text + '", captured: ' + JSON.stringify(captured));
      assert.ok(result && typeof result === 'object' && result.error === 'egress_blocked', 'expected egress_blocked for "' + entry.text + '", got: ' + JSON.stringify(result));
    });
  }

  // -------------------------------------------------------------------------
  // Case E: generic corpus, >=20 questions, every one allow/typed_question
  // and forwarded (captured request present).
  // -------------------------------------------------------------------------
  assert.ok(GENERIC_CORPUS.length >= 20, 'generic corpus must carry at least 20 questions, has: ' + GENERIC_CORPUS.length);
  for (let i = 0; i < GENERIC_CORPUS.length; i++) {
    const entry = GENERIC_CORPUS[i];
    await check('Case E[' + i + ']: generic corpus question allows and forwards (' + entry.source + ': "' + entry.text + '")', async () => {
      const verdict = guard.classify({ question: entry.text }, { toolName: 'brain_ask' });
      assert.strictEqual(verdict.verdict, 'allow', 'expected allow for "' + entry.text + '" (' + entry.source + '), got: ' + JSON.stringify(verdict));
      assert.strictEqual(verdict.class, 'typed_question', 'expected class typed_question for "' + entry.text + '", got: ' + JSON.stringify(verdict));

      resetCaptured();
      await brain.ask(entry.text);
      assert.ok(captured.length > 0, 'expected a forwarded tools/call for "' + entry.text + '" (' + entry.source + '), captured stayed empty');
    });
  }

  // -------------------------------------------------------------------------
  // Case F: shim end-to-end, bin/mindrian-brain-mcp-client.cjs via
  // StdioClientTransport.
  // -------------------------------------------------------------------------
  await check('Case F: shim end-to-end -- brain_ask(PRIVATE) renders the honest egress_blocked refusal', async () => {
    resetCaptured();
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [SHIM],
      env: {
        HOME: process.env.HOME || '',
        PATH: process.env.PATH || '',
        MINDRIAN_BRAIN_URL: url,
        MINDRIAN_BRAIN_KEY: 'synthetic-354-06-shim-key',
      },
      stderr: 'pipe',
      cwd: REPO_ROOT,
    });
    const client = new Client({ name: 'test-354-06-shim', version: '1.0.0' }, { capabilities: {} });
    try {
      await client.connect(transport);
      const resp = await client.callTool({ name: 'brain_ask', arguments: { question: PRIVATE } });
      const content = resp && resp.content && resp.content[0];
      assert.ok(content && content.type === 'text', 'expected text content in tools/call result: ' + JSON.stringify(resp));
      assert.ok(content.text.indexOf('egress_blocked') !== -1, 'expected the shim response to name egress_blocked, got: ' + content.text);
      assert.ok(!capturedContains('cedar'), 'the shim must never let PRIVATE\'s "cedar" marker reach the capture server, captured: ' + JSON.stringify(captured));
      const brainAskCalls = captured.filter((c) => c.name === 'brain_ask');
      assert.strictEqual(brainAskCalls.length, 0, 'expected zero captured brain_ask tools/call requests, captured: ' + JSON.stringify(captured));
    } finally {
      try { await client.close(); } catch (_e) { /* best-effort teardown */ }
    }
  });

  await stopCaptureServer(server);

  console.log('\n' + passed + ' passed, ' + failed + ' failed.');
  if (failed > 0) {
    console.log('FAIL: test-354-egress-typed-question');
    process.exit(1);
  }
  console.log('PASS: test-354-egress-typed-question');
  process.exit(0);
}

main().catch((err) => {
  console.error('FATAL:', err && err.stack ? err.stack : err);
  process.exit(1);
});
