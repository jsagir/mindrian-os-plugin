#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 354 Plan 09 Task 1 -- THEO-01 router -> composer -> captured Theo
 * arguments regression, registry validation, act-chain pipeline-state check,
 * honest provenance.
 *
 * Seeded from docs/reviews/phase-354-probes/theo.cjs's 'router-composer-
 * contract' probe (lines 37-80: a stubbed recommendChain + query proving
 * every case observed IllDefined regardless of input). This suite goes one
 * step further: it drives the REAL wire path against the shared SSE capture
 * server (tests/helpers/brain-capture-server.cjs), never an in-process stub
 * of brainClient.ask(), so every assertion sits on what the Brain actually
 * receives and what tool-router actually persists.
 *
 * Cases:
 *   C1-C4: room classification -> the problem_type the capture server
 *     actually receives on recommend_chain (the classification round trip,
 *     CTX-THEO-CLASS).
 *   V1: the Brain-sourced chain validates and contains only exact registry
 *     slugs; framework labels travel in rec.frameworks, never rec.chain
 *     (the executable-chain fix, CTX-THEO-CHAIN).
 *   P1: the Brain-sourced recommendation states ranked-candidate provenance,
 *     never a FEEDS_INTO derivation claim (CTX-THEO-PROV).
 *   A1: act-chain never initializes pipeline state from a chain
 *     validateChain rejects.
 *   D1: every distinguishable Tier-3 miss cause is disclosed via
 *     brain_router_note, never silent.
 *
 * Run: node tests/test-354-theo-router-contract.cjs
 * Hyphens only, no em-dashes (CLAUDE.md HARD RULE).
 */

const assert = require('node:assert/strict');
const path = require('node:path');
const http = require('node:http');

const REPO_ROOT = path.resolve(__dirname, '..');
const BRAIN_CLIENT_PATH = path.join(REPO_ROOT, 'lib', 'core', 'brain-client.cjs');
const BRAIN_ROUTER_PATH = path.join(REPO_ROOT, 'lib', 'mcp', 'brain-router.cjs');
const STATE_OPS_PATH = path.join(REPO_ROOT, 'lib', 'core', 'state-ops.cjs');
const TOOL_ROUTER_PATH = path.join(REPO_ROOT, 'lib', 'mcp', 'tool-router.cjs');
const PIPELINE_STATE_PATH = path.join(REPO_ROOT, 'lib', 'mcp', 'pipeline-state.cjs');

const {
  startCaptureServer,
  captured,
  resetCaptured,
  stopCaptureServer,
  setToolScript,
  resetToolScript,
} = require('./helpers/brain-capture-server.cjs');
const { makeScratchRoom, captureToolServer } = require('./helpers/fixture-room-354.cjs');

let pass = 0;
let fail = 0;
function test(name, fn) {
  try {
    fn();
    process.stdout.write('  ok    ' + name + '\n');
    pass += 1;
  } catch (e) {
    process.stdout.write('  FAIL  ' + name + ' -- ' + (e && e.message ? e.message : String(e)) + '\n');
    fail += 1;
  }
}

async function atest(name, fn) {
  try {
    await fn();
    process.stdout.write('  ok    ' + name + '\n');
    pass += 1;
  } catch (e) {
    process.stdout.write('  FAIL  ' + name + ' -- ' + (e && e.message ? e.message : String(e)) + '\n');
    fail += 1;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sseTextBody(payload, id) {
  return 'data: ' + JSON.stringify({
    jsonrpc: '2.0',
    id: id || 2,
    result: { content: [{ type: 'text', text: JSON.stringify(payload) }] },
  }) + '\n';
}

function requireFresh(modulePath) {
  delete require.cache[modulePath];
  return require(modulePath);
}

function lastNamed(calls, name) {
  for (let i = calls.length - 1; i >= 0; i--) {
    if (calls[i].name === name) return calls[i];
  }
  return null;
}

// A minimal SSE-shaped server that delays every tools/call response by
// `delayMs` -- brain-capture-server.cjs's setToolScript has no delay knob,
// so D1's timeout case stands up its own tiny sibling rather than widening
// the shared fixture for one caller (Canon Part 7: a scoped addition here,
// not a shared-fixture change with no other consumer).
function startDelayServer(delayMs) {
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      let parsed;
      try { parsed = JSON.parse(body); } catch (_e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'bad_json' }));
        return;
      }
      if (parsed.method === 'initialize') {
        res.writeHead(200, { 'Content-Type': 'text/event-stream' });
        res.end('data: ' + JSON.stringify({
          jsonrpc: '2.0', id: parsed.id,
          result: { protocolVersion: '2024-11-05', capabilities: {} },
        }) + '\n');
        return;
      }
      setTimeout(() => {
        res.writeHead(200, { 'Content-Type': 'text/event-stream' });
        res.end(sseTextBody({ answer_mode: 'structured_rows', rows: [] }, parsed.id));
      }, delayMs);
    });
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ server, port, url: 'http://127.0.0.1:' + port });
    });
  });
}

(async () => {
  const { server, port, url } = await startCaptureServer();

  process.env.MINDRIAN_BRAIN_URL = url;
  process.env.MINDRIAN_BRAIN_KEY = 'synthetic-354-09-key';
  process.env.MINDRIAN_BRAIN_ROUTE_TIMEOUT_MS = '5000';
  process.env.MINDRIAN_BRAIN_RETRY_MAX = '0';
  process.env.MINDRIAN_BRAIN_RETRY_BASE_MS = '1';

  const brainClient = requireFresh(BRAIN_CLIENT_PATH);
  const brainRouter = requireFresh(BRAIN_ROUTER_PATH);
  const stateOps = require(STATE_OPS_PATH);
  const originalGetState = stateOps.getState;

  // -------------------------------------------------------------------------
  // C1-C4 + V1 + P1: classification round trip, registry-only chain, honest
  // provenance -- one Brain-sourced recommendation per case.
  // -------------------------------------------------------------------------
  const CASES = [
    ['well-defined', 'simple', 'WellDefined'],
    ['undefined', 'complex', 'UnDefined'],
    ['ill-defined', 'complex', 'IllDefined'],
    ['well-defined', 'wicked', 'Wicked'],
  ];

  const RANKED_SCRIPT = [
    { body: sseTextBody({ answer_mode: 'structured_rows', rows: [] }) },
    { body: sseTextBody({ chain: [{ framework: 'Design Thinking', degree: 100 }] }) },
    { body: sseTextBody([{ framework: 'Design Thinking', commands: ['/mos:diagnose', '/mos:build-mvp'] }]) },
  ];

  const caseResults = [];
  for (let i = 0; i < CASES.length; i++) {
    const [definition, complexity, expectedRung] = CASES[i];
    stateOps.getState = function () {
      return 'definition_level: ' + definition + '\ncomplexity: ' + complexity;
    };
    resetToolScript();
    setToolScript(RANKED_SCRIPT);
    resetCaptured();
    const room = 'synthetic-354-09-case-' + i;
    // eslint-disable-next-line no-await-in-loop
    const rec = await brainRouter.recommend(room);
    const callsSnapshot = captured.slice();
    caseResults.push({ definition, complexity, expectedRung, rec, callsSnapshot });
  }
  stateOps.getState = originalGetState;

  for (let i = 0; i < caseResults.length; i++) {
    const { definition, complexity, expectedRung, rec, callsSnapshot } = caseResults[i];
    const label = 'C' + (i + 1) + ' (' + definition + '/' + complexity + ')';

    test(label + ': recommend_chain observed problem_type is ' + expectedRung, function () {
      const call = lastNamed(callsSnapshot, 'recommend_chain');
      assert.ok(call, 'no recommend_chain call captured');
      assert.equal(
        call.arguments && call.arguments.problem_type,
        expectedRung,
        'observed problem_type: ' + JSON.stringify(call.arguments)
      );
    });

    test(label + ': rec.source is brain', function () {
      assert.equal(rec && rec.source, 'brain');
    });

    test('V1 ' + label + ': validateChain(null, rec.chain).valid === true', function () {
      const validation = brainRouter.validateChain(null, rec.chain);
      assert.equal(validation.valid, true, 'reason: ' + (validation && validation.reason));
    });

    test('V1 ' + label + ': rec.chain contains diagnose, not designthinking, not build-mvp', function () {
      assert.ok(Array.isArray(rec.chain), 'chain is an array');
      assert.ok(rec.chain.includes('diagnose'), 'chain: ' + JSON.stringify(rec.chain));
      assert.ok(!rec.chain.includes('designthinking'), 'chain: ' + JSON.stringify(rec.chain));
      assert.ok(!rec.chain.includes('build-mvp'), 'chain: ' + JSON.stringify(rec.chain));
    });

    test('V1 ' + label + ': rec.frameworks includes Design Thinking', function () {
      assert.ok(Array.isArray(rec.frameworks), 'frameworks is an array');
      assert.ok(rec.frameworks.includes('Design Thinking'), 'frameworks: ' + JSON.stringify(rec.frameworks));
    });

    test('P1 ' + label + ': rec.chain_type !== feeds_into', function () {
      assert.notEqual(rec.chain_type, 'feeds_into');
    });

    test('P1 ' + label + ': rec.reasoning does not contain FEEDS_INTO', function () {
      assert.equal(/FEEDS_INTO/.test(rec.reasoning || ''), false, 'reasoning: ' + rec.reasoning);
    });

    test('P1 ' + label + ': rec.provenance.feeds_into_verified === false', function () {
      assert.ok(rec.provenance && typeof rec.provenance === 'object', 'provenance present');
      assert.equal(rec.provenance.feeds_into_verified, false);
    });
  }

  // -------------------------------------------------------------------------
  // A1: act-chain never initializes pipeline state from a chain
  // validateChain rejects.
  // -------------------------------------------------------------------------
  await atest('A1: act-chain never initializes pipeline state from a non-registry-only chain', async function () {
    const scratch = makeScratchRoom('theo-contract-a1');
    try {
      const { server: fakeMcp, handlers } = captureToolServer();
      const toolRouter = requireFresh(TOOL_ROUTER_PATH);
      const pipelineState = requireFresh(PIPELINE_STATE_PATH);
      toolRouter.registerRouterTools(fakeMcp, scratch.room, REPO_ROOT, { full: '' }, 'cli');

      resetToolScript();
      setToolScript([
        { body: sseTextBody({ answer_mode: 'structured_rows', rows: [] }) },
        { body: sseTextBody({ chain: [{ framework: 'Build MVP Only', degree: 100 }] }) },
        { body: sseTextBody([{ framework: 'Build MVP Only', commands: ['/mos:build-mvp'] }]) },
      ]);
      resetCaptured();

      const handler = handlers.get('orchestration');
      assert.ok(typeof handler === 'function', 'orchestration handler registered');
      const response = await handler(
        { command: 'act-chain', context: 'synthetic' },
        { sessionId: 'synthetic-354-09-a1' }
      );
      const text = response && response.content && response.content[0] && response.content[0].text;
      assert.ok(typeof text === 'string' && text.length > 0, 'act-chain returned text');

      const state = pipelineState.read(scratch.room);
      const chainOk = state === null
        || (Array.isArray(state.chain) && state.chain.every(function (slug) {
          return brainRouter.KNOWN_METHODOLOGIES.includes(slug);
        }));
      assert.ok(chainOk, 'pipeline state chain: ' + JSON.stringify(state && state.chain));
      if (state) {
        assert.ok(!state.chain.includes('build-mvp'), 'chain: ' + JSON.stringify(state.chain));
        assert.ok(!state.chain.includes('designthinking'), 'chain: ' + JSON.stringify(state.chain));
      }
      assert.ok(
        /not executable/i.test(text) || /local/i.test(text),
        'response should disclose non-executable or fall back to a local source: ' + text
      );
    } finally {
      scratch.cleanup();
    }
  });

  // -------------------------------------------------------------------------
  // D1: degraded visibility -- every distinguishable Tier-3 miss cause is
  // disclosed via brain_router_note, never silent.
  // -------------------------------------------------------------------------
  await atest('D1a: HTTP 503 on brain_ask -> rec.source is not brain, brain_router_note === brain_unreachable', async function () {
    resetToolScript();
    setToolScript([{ status: 503 }]);
    resetCaptured();
    const rec = await brainRouter.recommend('synthetic-354-09-d1a');
    assert.notEqual(rec.source, 'brain');
    assert.equal(rec.brain_router_note, 'brain_unreachable', 'rec: ' + JSON.stringify(rec));
  });

  await atest('D1c: brain_ask returns { error: tier_denied } -> brain_router_note === brain_error_response', async function () {
    resetToolScript();
    setToolScript([{ body: sseTextBody({ error: 'tier_denied' }) }]);
    resetCaptured();
    const rec = await brainRouter.recommend('synthetic-354-09-d1c');
    assert.notEqual(rec.source, 'brain');
    assert.equal(rec.brain_router_note, 'brain_error_response', 'rec: ' + JSON.stringify(rec));
  });

  await atest('D1b: MINDRIAN_BRAIN_ROUTE_TIMEOUT_MS=50 against a 500ms-delayed server -> brain_router_note === brain_timeout', async function () {
    const delay = await startDelayServer(500);
    try {
      process.env.MINDRIAN_BRAIN_URL = delay.url;
      process.env.MINDRIAN_BRAIN_KEY = 'synthetic-354-09-timeout-key';
      process.env.MINDRIAN_BRAIN_ROUTE_TIMEOUT_MS = '50';
      const timeoutBrainRouter = requireFresh(BRAIN_ROUTER_PATH);
      requireFresh(BRAIN_CLIENT_PATH);
      const rec = await timeoutBrainRouter.recommend('synthetic-354-09-d1b');
      assert.notEqual(rec.source, 'brain');
      assert.equal(rec.brain_router_note, 'brain_timeout', 'rec: ' + JSON.stringify(rec));
      // Drain the abandoned in-flight request (the delayed server still
      // answers ~450ms from now) so it cannot land a stray write into a
      // later test's module state after this suite has moved on. This is
      // deliberately the LAST scenario in the file for that reason.
      await sleep(700);
    } finally {
      await stopCaptureServer(delay.server);
    }
  });

  await stopCaptureServer(server);

  process.stdout.write('\ntest-354-theo-router-contract.cjs: ' + pass + ' passed, ' + fail + ' failed\n');
  process.exit(fail === 0 ? 0 : 1);
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
