#!/usr/bin/env node
'use strict';

/*
 * tests/test-354-theo-journey.cjs -- Phase 354 Plan 12 Task 1.
 *
 * Hermetic four-case teaching-to-action journey with a canary egress check.
 * Proves the complete loop: generic methodology request (tool-router
 * 'act-chain') -> guarded client (brain-client.cjs through the real wire
 * path against tests/helpers/brain-capture-server.cjs) -> provider response
 * and provenance (brain-router.cjs) -> local application (pipeline-state.cjs
 * read()) -> governed room write (views.cjs artifact_file handler) -> later
 * retrieval through the MCP resource (resources.cjs room://section/<name>,
 * read via a real @modelcontextprotocol/sdk Client over InMemoryTransport).
 *
 * Four provider conditions, one journey each:
 *   H (healthy)        -- brain_ask structured_rows, recommend_chain returns
 *                          a candidate whose commands include a registry
 *                          slug. source:'brain', chain_type:'ranked_candidates'.
 *   U (unavailable)     -- the capture server answers every tools/call with
 *                          HTTP 503. source: local, a disclosure field
 *                          (brain_refusal or brain_router_note) present.
 *   S (invalid schema)  -- brain_ask returns valid structured_rows, but the
 *                          downstream recommend_chain response carries a
 *                          malformed (non-array) chain field. source: local,
 *                          no brain_ask/recommend_chain-sourced provenance.
 *   T (thin result)     -- brain_ask returns valid structured_rows, and the
 *                          downstream recommend_chain response carries a
 *                          well-shaped but EMPTY chain array. source: local,
 *                          brain_router_note set.
 *
 * S vs T design note: both S and T converge on brainRoute()'s own
 * 'brain_chain_not_executable' miss cause (an empty finalChain either way),
 * but they exercise DIFFERENT branches inside brain-client.cjs's
 * _composeTheoAsk (S: `!Array.isArray(chainRes.chain)` -> chainStatus
 * 'unreachable'; T: a real empty array -> chainStatus 'empty') -- the two
 * cases are genuinely distinct at the schema-validation layer the plan names,
 * even though brain-router.cjs's own local-fallback outcome is the same
 * shape for both. This is a documented implementation decision, not a
 * deviation: the plan's case S description ("recommend_chain returns
 * { chain: 'not-an-array' } and brain_ask returns an unrecognized object")
 * is read here as naming the recommend_chain malformed-schema leg
 * specifically (the literal payload the plan names), with "brain_ask
 * returns an unrecognized object" describing the ROUTER-LEVEL outcome
 * (brainRoute() ultimately cannot use brainResult, the same as if brain_ask
 * itself had been unrecognized) rather than a second, unreachable script
 * leg (recommendChain is only ever called after brain_ask's OWN response
 * already parsed as structured_rows -- see brain-client.cjs::ask()).
 *
 * Every captured request body (every case) is scanned for CANARY_354_ROOM_
 * BYTES_*, seeded into a room file, a governed claim node, and STATE.md's
 * body text -- Canon Part 8: only closed enums and generic English cross
 * the wire, never room content.
 *
 * Seeded from tests/test-354-theo-router-contract.cjs (the real-wire-path
 * capture-server pattern, sseTextBody, lastNamed, requireFresh) and
 * tests/test-354-room-symlink-containment.cjs (the SDK Client + InMemory
 * Transport + registerResources retrieval pattern). Canon Part 7: reuse,
 * not reinvention.
 *
 * Plain-Node harness, no framework. Hyphens only, no em-dashes.
 * Run: node tests/test-354-theo-journey.cjs
 */

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const BRAIN_CLIENT_PATH = path.join(REPO_ROOT, 'lib', 'core', 'brain-client.cjs');
const BRAIN_ROUTER_PATH = path.join(REPO_ROOT, 'lib', 'mcp', 'brain-router.cjs');
const TOOL_ROUTER_PATH = path.join(REPO_ROOT, 'lib', 'mcp', 'tool-router.cjs');
const PIPELINE_STATE_PATH = path.join(REPO_ROOT, 'lib', 'mcp', 'pipeline-state.cjs');
const VIEWS_PATH = path.join(REPO_ROOT, 'lib', 'mcp', 'tools', 'views.cjs');
const RESOURCES_PATH = path.join(REPO_ROOT, 'lib', 'mcp', 'resources.cjs');
const NAVIGATION_PATH = path.join(REPO_ROOT, 'lib', 'core', 'navigation.cjs');

const {
  startCaptureServer,
  captured,
  resetCaptured,
  stopCaptureServer,
  setToolScript,
  resetToolScript,
} = require('./helpers/brain-capture-server.cjs');
const { makeScratchRoom, captureToolServer } = require('./helpers/fixture-room-354.cjs');
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { InMemoryTransport } = require('@modelcontextprotocol/sdk/inMemory.js');

// The write-path flag for the 'cli' surface -- artifact_file's writePathRefusal
// gate (lib/mcp/tools/views.cjs) checks isWritePathEnabled({surface}), and an
// explicit MINDRIAN_MCP_FIRST entry always wins (mcp-first-flag.cjs's own
// documented precedence, case 1). Set once, module-level: a static flag, not
// per-case state.
process.env.MINDRIAN_MCP_FIRST = 'cli';

console.log('test-354-theo-journey');

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

function requireFresh(modulePath) {
  delete require.cache[modulePath];
  return require(modulePath);
}

function sseTextBody(payload, id) {
  return 'data: ' + JSON.stringify({
    jsonrpc: '2.0',
    id: id || 2,
    result: { content: [{ type: 'text', text: JSON.stringify(payload) }] },
  }) + '\n';
}

function lastNamed(calls, name) {
  for (let i = calls.length - 1; i >= 0; i--) {
    if (calls[i].name === name) return calls[i];
  }
  return null;
}

// Every captured tools/call body, scanned for the room's canary. Returns the
// list of {name, hit} entries that DID leak, empty when clean.
function findCanaryLeaks(canary) {
  const leaks = [];
  for (const entry of captured) {
    const asText = JSON.stringify(entry);
    if (asText.indexOf(canary) !== -1) {
      leaks.push(entry);
    }
  }
  return leaks;
}

// -----------------------------------------------------------------------
// Per-case scripted responses.
// -----------------------------------------------------------------------
const CASE_SCRIPTS = {
  H: [
    { body: sseTextBody({ answer_mode: 'structured_rows', rows: [] }) },
    { body: sseTextBody({ chain: [{ framework: 'Design Thinking', degree: 100 }] }) },
    { body: sseTextBody([{ framework: 'Design Thinking', commands: ['/mos:diagnose', '/mos:build-mvp'] }]) },
  ],
  U: [
    { status: 503 },
  ],
  S: [
    { body: sseTextBody({ answer_mode: 'structured_rows', rows: [] }) },
    { body: sseTextBody({ chain: 'not-an-array' }) },
  ],
  T: [
    { body: sseTextBody({ answer_mode: 'structured_rows', rows: [] }) },
    { body: sseTextBody({ chain: [] }) },
  ],
};

/**
 * runCase(label) -- the full journey for one provider condition.
 * @returns {Promise<{label: string, rec: object, source: string,
 *   chainType: string|undefined, problemType: string|null}>}
 */
async function runCase(label) {
  const scratch = makeScratchRoom('journey-' + label);
  const CANARY = 'CANARY_354_ROOM_BYTES_' + crypto.randomBytes(8).toString('hex');
  let httpServer = null;
  let mcpClient = null;
  let mcpServer = null;

  try {
    // -----------------------------------------------------------------
    // Seed: a room file, a governed claim node, and STATE.md -- all three
    // carry the CANARY, none of it may ever reach the wire.
    // -----------------------------------------------------------------
    fs.mkdirSync(path.join(scratch.room, 'problem-definition'), { recursive: true });
    fs.writeFileSync(
      path.join(scratch.room, 'problem-definition', 'notes.md'),
      '# Problem Definition\n\nSynthetic room note: ' + CANARY + '\n'
    );

    fs.writeFileSync(
      path.join(scratch.room, 'STATE.md'),
      '---\ndefinition_level: ill-defined\ncomplexity: complex\n---\n\n'
        + '# State\n\nSynthetic state body: ' + CANARY + '\n'
    );

    const navigation = requireFresh(NAVIGATION_PATH);
    const seedDb = navigation.openRoomDbForCaller(scratch.room);
    assert.ok(seedDb, 'seed room.db must open (makeScratchRoom already created it)');
    let claimResult;
    try {
      claimResult = navigation.writeClaimNode(seedDb, {
        knowledge_type: 'fact',
        text: 'Synthetic room fact: ' + CANARY,
        sessionId: 'journey-' + label,
      });
    } finally {
      navigation.closeRoomDbForCaller(seedDb);
    }
    assert.ok(claimResult && claimResult.ok === true, 'seed claim node write must succeed: ' + JSON.stringify(claimResult));

    // -----------------------------------------------------------------
    // Point the guarded client at this case's own capture server (ordering
    // contract: env vars set BEFORE brain-client.cjs is required).
    // -----------------------------------------------------------------
    const cap = await startCaptureServer();
    httpServer = cap.server;
    process.env.MINDRIAN_BRAIN_URL = cap.url;
    process.env.MINDRIAN_BRAIN_KEY = 'synthetic-354-12-' + label + '-key';
    process.env.MINDRIAN_BRAIN_ROUTE_TIMEOUT_MS = '5000';
    process.env.MINDRIAN_BRAIN_RETRY_MAX = '0';
    process.env.MINDRIAN_BRAIN_RETRY_BASE_MS = '1';

    requireFresh(BRAIN_CLIENT_PATH);
    const brainRouter = requireFresh(BRAIN_ROUTER_PATH);
    const toolRouter = requireFresh(TOOL_ROUTER_PATH);
    const pipelineState = requireFresh(PIPELINE_STATE_PATH);
    const views = requireFresh(VIEWS_PATH);
    const resources = requireFresh(RESOURCES_PATH);

    resetToolScript();
    setToolScript(CASE_SCRIPTS[label]);
    resetCaptured();

    // Wrap (never replace the reference) brainRouter.recommend so the test
    // observes the EXACT rec object act-chain's own handler used, instead of
    // re-deriving it from rendered text or a second (cache-hitting) call.
    // tool-router.cjs does `require('./brain-router.cjs')` lazily inside its
    // handler -- Node's require cache returns this SAME module object, so
    // patching the property here is visible to that lazy require.
    const originalRecommend = brainRouter.recommend;
    let lastRec = null;
    brainRouter.recommend = async function wrapped(...args) {
      const rec = await originalRecommend.apply(brainRouter, args);
      lastRec = rec;
      return rec;
    };

    const { server: fakeMcp, handlers } = captureToolServer();
    toolRouter.registerRouterTools(fakeMcp, scratch.room, REPO_ROOT, { full: '' }, 'cli');
    views.register(fakeMcp, { fallbackRoomDir: scratch.room, pluginRoot: REPO_ROOT, surface: 'cli' });

    const extra = { sessionId: 'journey-' + label };

    // -----------------------------------------------------------------
    // (1) Request: act-chain.
    // -----------------------------------------------------------------
    const orchestrationHandler = handlers.get('orchestration');
    assert.ok(typeof orchestrationHandler === 'function', 'orchestration handler must be registered');
    const actResponse = await orchestrationHandler({ command: 'act-chain', context: 'synthetic-journey-' + label }, extra);
    const actText = actResponse && actResponse.content && actResponse.content[0] && actResponse.content[0].text;
    assert.ok(typeof actText === 'string' && actText.length > 0, 'act-chain must return response text');
    brainRouter.recommend = originalRecommend;
    assert.ok(lastRec, 'act-chain must have called brainRouter.recommend()');

    // Canary scan -- every captured tools/call body from this case's request.
    const leaks = findCanaryLeaks(CANARY);
    assert.equal(leaks.length, 0, 'no captured request body may contain the room canary: ' + JSON.stringify(leaks));

    // brain-sourced-only-when-proven invariant (T-354-23).
    if (lastRec.source === 'brain') {
      assert.ok(captured.length > 0, 'a brain-sourced rec must have at least one captured tools/call');
      const recommendChainCall = lastNamed(captured, 'recommend_chain');
      assert.ok(recommendChainCall, 'a brain-sourced rec must have a captured recommend_chain call');
    } else {
      assert.notEqual(lastRec.source, 'brain', 'a non-brain-sourced rec must never claim source brain');
    }

    // -----------------------------------------------------------------
    // (2) Local application: pipeline-state.
    // -----------------------------------------------------------------
    const state = pipelineState.read(scratch.room);
    assert.ok(state, 'pipeline-state must be initialized after a valid act-chain');
    assert.deepEqual(state.chain, lastRec.chain, 'pipeline-state chain must equal the validated chain act-chain used');

    // -----------------------------------------------------------------
    // (3) Governed room write: artifact_file, frontmatter carries source /
    // chain_type / provenance.method from the act-chain response (lastRec).
    // -----------------------------------------------------------------
    const provenanceMethod = (lastRec.provenance && lastRec.provenance.method) || 'none';
    const artifactContent = [
      '---',
      'source: ' + lastRec.source,
      'chain_type: ' + (lastRec.chain_type || 'none'),
      'provenance_method: ' + provenanceMethod,
      '---',
      '',
      '# Recommendation (' + label + ')',
      '',
      'Chain: ' + (Array.isArray(lastRec.chain) ? lastRec.chain.join(' -> ') : ''),
      '',
    ].join('\n');

    const artifactFileHandler = handlers.get('artifact_file');
    assert.ok(typeof artifactFileHandler === 'function', 'artifact_file handler must be registered');
    const fileResponse = await artifactFileHandler({
      section: 'recommendations',
      filename: 'journey-' + label + '.md',
      content: artifactContent,
    }, extra);
    const fileText = fileResponse && fileResponse.content && fileResponse.content[0] && fileResponse.content[0].text;
    const fileResult = JSON.parse(fileText);
    assert.equal(fileResult.ok, true, 'artifact_file must succeed: ' + fileText);

    // -----------------------------------------------------------------
    // (4) Later retrieval: room://section/recommendations through a real
    // SDK Client over InMemoryTransport, not a direct file read.
    // -----------------------------------------------------------------
    mcpServer = new McpServer({ name: 'test-354-theo-journey-' + label, version: '1' });
    resources.registerResources(mcpServer, { fallbackRoomDir: scratch.room });
    mcpClient = new Client({ name: 'test-354-theo-journey-client-' + label, version: '1' });
    const [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair();
    await mcpServer.connect(serverTransport);
    await mcpClient.connect(clientTransport);
    const readResult = await mcpClient.readResource({ uri: 'room://section/recommendations' });
    const retrievedText = readResult.contents.map((c) => c.text || '').join('\n');

    assert.ok(retrievedText.includes('source: ' + lastRec.source), 'retrieval must show the recommendation source');
    assert.ok(retrievedText.includes('chain_type: ' + (lastRec.chain_type || 'none')), 'retrieval must show the chain_type');
    assert.ok(retrievedText.includes('provenance_method: ' + provenanceMethod), 'retrieval must show the provenance method');
    assert.ok(!retrievedText.includes(CANARY), 'retrieval must never include the room canary (the artifact never carried it)');

    return {
      label,
      rec: lastRec,
      source: lastRec.source,
      chainType: lastRec.chain_type,
      problemType: (lastRec.provenance && lastRec.provenance.rung) || null,
    };
  } finally {
    if (mcpClient) { try { await mcpClient.close(); } catch (_e) { /* best-effort */ } }
    if (mcpServer) { try { await mcpServer.close(); } catch (_e) { /* best-effort */ } }
    if (httpServer) { await stopCaptureServer(httpServer); }
    scratch.cleanup();
  }
}

(async () => {
  const results = {};

  await atest('H (healthy): journey completes end to end', async () => {
    results.H = await runCase('H');
  });
  if (results.H) {
    test('H: source is brain', () => {
      assert.equal(results.H.source, 'brain');
    });
    test('H: chain_type is ranked_candidates', () => {
      assert.equal(results.H.chainType, 'ranked_candidates');
    });
    test('H: captured recommend_chain problem_type is IllDefined', () => {
      const call = lastNamed(captured, 'recommend_chain');
      // captured[] is reset per-case inside runCase(); by the time this runs
      // the NEXT case may already have started (H runs first, so this is
      // still H's own captured array at assertion time only if no other
      // case has run yet -- verified by running H strictly before U/S/T).
      assert.ok(call, 'recommend_chain call must have been captured for case H');
      assert.equal(call.arguments && call.arguments.problem_type, 'IllDefined');
    });
  }

  await atest('U (unavailable): journey completes end to end', async () => {
    results.U = await runCase('U');
  });
  if (results.U) {
    test('U: source is not brain', () => {
      assert.notEqual(results.U.source, 'brain');
    });
    test('U: chain_type is never ranked_candidates', () => {
      assert.notEqual(results.U.chainType, 'ranked_candidates');
    });
    test('U: a disclosure field (brain_refusal or brain_router_note) is present', () => {
      assert.ok(results.U.rec.brain_refusal || results.U.rec.brain_router_note, 'rec: ' + JSON.stringify(results.U.rec));
    });
  }

  await atest('S (invalid schema): journey completes end to end', async () => {
    results.S = await runCase('S');
  });
  if (results.S) {
    test('S: source is not brain', () => {
      assert.notEqual(results.S.source, 'brain');
    });
    test('S: chain_type is never ranked_candidates', () => {
      assert.notEqual(results.S.chainType, 'ranked_candidates');
    });
    test('S: no brain provenance on the local recommendation', () => {
      assert.ok(!results.S.rec.chain_type, 'rec.chain_type must be absent for a local recommendation: ' + JSON.stringify(results.S.rec));
    });
  }

  await atest('T (thin result): journey completes end to end', async () => {
    results.T = await runCase('T');
  });
  if (results.T) {
    test('T: source is not brain', () => {
      assert.notEqual(results.T.source, 'brain');
    });
    test('T: brain_router_note is set', () => {
      assert.ok(results.T.rec.brain_router_note, 'rec: ' + JSON.stringify(results.T.rec));
    });
  }

  console.log('');
  for (const label of ['H', 'U', 'S', 'T']) {
    const r = results[label];
    if (r) {
      console.log(label + ': source=' + r.source + ' chain_type=' + (r.chainType || 'none') + ' problem_type=' + (r.problemType || 'n/a'));
    } else {
      console.log(label + ': DID NOT COMPLETE');
    }
  }

  process.stdout.write('\ntest-354-theo-journey.cjs: ' + pass + ' passed, ' + fail + ' failed\n');
  process.exit(fail === 0 ? 0 : 1);
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
