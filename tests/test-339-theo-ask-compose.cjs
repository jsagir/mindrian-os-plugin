#!/usr/bin/env node
'use strict';

/**
 * Quick 260910-hni, Task 3 -- the offline seven-arm fixture suite over
 * brain-client.cjs's Theo `brain_ask` composer and the widened `askOp`
 * normalizer, written from the CONTRACT stated in Tasks 1 and 2, not by
 * reading the shipped implementation. Zero network for six of the seven
 * arms (they drive `_composeTheoAsk` / `_normalizeAskOpResult` directly
 * through the injectable `deps` seam); Arms 2 and 3 exercise `ask()`'s own
 * ladder and use this repo's own established zero-socket idiom
 * (monkey-patching `global.fetch`, the same technique
 * lib/memory/brain-client-query-shape.test.cjs and
 * tests/test-246-census-render.cjs already use) -- no real Brain, no real
 * key, no socket ever opens.
 *
 * Arms:
 *   1. Theo rows + stubbed recommendChain/query -> a full composed
 *      envelope: directive.guided.framework set, next_gate.options
 *      populated with commands, grounding.rows present, exactly one
 *      label-anchored query() call.
 *   2. ask() against an incumbent-shaped response passes through
 *      unchanged (deep-equal to the wire payload, no grounding key added).
 *   3. An egress_blocked sentinel (zero network -- the Part 8 belt
 *      short-circuits before any fetch) and a transport null (fetch always
 *      throws) both pass through ask() unchanged.
 *   4. recommend_chain returning an empty chain, and a throwing
 *      recommend_chain, both leave grounding.rows populated and never
 *      throw.
 *   5. Canon Part 8 tripwire: the question and a canary planted in
 *      query_terms (the one key _composeTheoAsk deletes) and in the
 *      query() wire response's own `diagnostics` field (a field
 *      _composeTheoAsk never reads, mirroring query()'s real
 *      `{records, diagnostics}` shape) never reach the composed envelope.
 *   6/7. _normalizeAskOpResult: a Theo shape reports coverage.matched as
 *      count/source:'theo'; an incumbent shape (including its own
 *      degraded sentinel) stays byte-identical; a non-array `rows`
 *      degrades to the existing sentinel.
 *
 * NON-VACUITY (recorded in the SUMMARY, not re-run here): Arms 1, 4, 5 and
 * 6 were each proven capable of failing by a scratch mutation of the
 * corresponding brain-client.cjs branch, confirmed red, then reverted,
 * during authoring of this file.
 *
 * node:test, CJS, node:assert/strict and node built-ins only. No new deps.
 * No em-dashes (hyphens only). What this file keys on: PAYLOAD SHAPE and
 * closed enum values, never prose text.
 */

const assert = require('node:assert/strict');
const path = require('node:path');
const { test } = require('node:test');

const REPO_ROOT = path.resolve(__dirname, '..');
const BRAIN_CLIENT_PATH = path.resolve(REPO_ROOT, 'lib', 'core', 'brain-client.cjs');

/**
 * A fresh brain-client.cjs module instance per test, mirroring the ordering
 * contract tests/test-254-ambiguous-disclosure.cjs and
 * lib/memory/brain-client-query-shape.test.cjs already establish: set
 * MINDRIAN_BRAIN_KEY BEFORE requiring (getApiKey() reads it), then delete
 * require.cache so every arm gets its own sessionCache / auto-register
 * state with zero cross-arm bleed.
 */
function freshBrainClient(key) {
  process.env.MINDRIAN_BRAIN_KEY = key;
  delete require.cache[BRAIN_CLIENT_PATH];
  return require(BRAIN_CLIENT_PATH);
}

function sseBody(jsonRpcResult) {
  return 'data: ' + JSON.stringify(jsonRpcResult) + '\n';
}

function makeInitOkResponse() {
  return {
    ok: true,
    status: 200,
    text: async () => sseBody({
      jsonrpc: '2.0',
      id: 1,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        serverInfo: { name: 'brain', version: '1' },
      },
    }),
  };
}

function makeToolTextResponse(payload) {
  return {
    ok: true,
    status: 200,
    text: async () => sseBody({
      jsonrpc: '2.0',
      id: 2,
      result: { content: [{ type: 'text', text: JSON.stringify(payload) }] },
    }),
  };
}

// ---------------------------------------------------------------------------
// Arm 1
// ---------------------------------------------------------------------------
test('Arm 1: Theo rows + stubbed recommendChain/query compose a full envelope, one label-anchored query() call', async () => {
  const brainClient = freshBrainClient('test-key-260910-hni-arm1');
  const payload = {
    answer_mode: 'structured_rows',
    rows: [
      { chapterId: 'dualuse', section: 'FRAMEWORK', score: 2.05, snippet: 'row one' },
      { chapterId: 'ch02', section: 'CONCEPT', score: 1.69, snippet: 'row two' },
      { chapterId: 'ch04', section: 'HOOK', score: 1.41, snippet: 'row three' },
    ],
    search_mode: 'lexical',
    query_terms: ['which', 'opportunity', 'chase'],
    effective_top_k: 3,
    diagnostics: { tool: 'brain_ask' },
  };
  const chainStub = {
    problem_type: 'IllDefined',
    chain: [
      { step: 1, framework: 'Design Thinking', degree: 291 },
      { step: 2, framework: 'Disruptive Innovation', degree: 255 },
      { step: 3, framework: 'Red Teaming', degree: 239 },
      { step: 4, framework: 'Creative Destruction', degree: 189 },
    ],
    coverage: { matched: 1, total: 6, status: 'partial' },
  };
  let queryCallCount = 0;
  let lastCypher = null;
  let lastParams = null;
  const queryStub = async (cypher, params) => {
    queryCallCount += 1;
    lastCypher = cypher;
    lastParams = params;
    return {
      records: [
        { framework: 'Design Thinking', commands: ['/mos:diagnose', '/mos:build-mvp'] },
        { framework: 'Red Teaming', commands: ['/mos:challenge-assumptions'] },
      ],
    };
  };

  const composed = await brainClient._test._composeTheoAsk(
    payload,
    'which opportunity should we chase next',
    { recommendChain: async () => chainStub, query: queryStub }
  );

  assert.equal(composed.directive.guided.framework, 'Design Thinking');
  assert.ok(['UnDefined', 'IllDefined', 'WellDefined', 'Wicked'].includes(composed.directive.guided.stage));
  assert.equal(composed.next_gate.sub_shape, 'F.1');
  assert.equal(composed.next_gate.options.length, 4);

  // Phase 392-10 (D-05, 2026-11-08) RE-PIN: Theo's pedagogical rank is
  // authoritative. The Quick 260911-ddd command-bearing-first partition is
  // removed, so the options come back in Theo's order (steps 1, 2, 3, 4):
  // Design Thinking, Disruptive Innovation, Red Teaming, Creative
  // Destruction. Was: Design Thinking, Red Teaming, Disruptive Innovation,
  // Creative Destruction (command-bearing first).
  assert.deepEqual(composed.next_gate.options.map((o) => o.framework), [
    'Design Thinking', 'Disruptive Innovation', 'Red Teaming', 'Creative Destruction',
  ]);
  assert.deepEqual(composed.next_gate.options[0].commands, ['diagnose', 'build-mvp']);
  assert.deepEqual(composed.next_gate.options[1].commands, []); // Disruptive Innovation has no edges
  assert.deepEqual(composed.next_gate.options[2].commands, ['challenge-assumptions']);
  assert.deepEqual(composed.next_gate.options[3].commands, []); // Creative Destruction has no edges
  // The partition's information survives as a boolean on each option.
  assert.deepEqual(composed.next_gate.options.map((o) => o.has_command), [true, false, true, false]);

  // 392-10 RE-PIN: confidence is the documented blend (confidence_source
  // 'theo_rank_blend'): clamp(0.9 - 0.1 * (rank - 1), 0.5, 0.9), degree
  // only as a tie-break between equal ranks (none here). Was the degree
  // normalisation 0.5 + 0.4 * degree/top (0.9, 0.85, 0.83, 0.76).
  const confidenceByFramework = {};
  for (const o of composed.next_gate.options) confidenceByFramework[o.framework] = o.confidence;
  assert.equal(confidenceByFramework['Design Thinking'], 0.9);
  assert.equal(confidenceByFramework['Disruptive Innovation'], 0.8);
  assert.equal(confidenceByFramework['Red Teaming'], 0.7);
  assert.equal(confidenceByFramework['Creative Destruction'], 0.6);

  // 392-10 RE-PIN: the global "confidence must be non-increasing" check is
  // TRUE again by construction (one rank step is 0.1, a tie-break at most
  // 0.04); the per-partition checks are gone with the partition.
  const confidences = composed.next_gate.options.map((o) => o.confidence);
  for (const c of confidences) assert.ok(c >= 0.5 && c <= 0.9);
  for (let i = 1; i < confidences.length; i++) {
    assert.ok(confidences[i] <= confidences[i - 1], 'confidence must be non-increasing along theo_rank');
  }
  assert.equal(confidences[0], 0.9); // the rank-1 option reads the top value

  // 392-10 RE-PIN: theo_rank carries Theo's own rank on every option and
  // the options are sorted by it: [1, 2, 3, 4]. Was [1, 3, 2, 4] under the
  // partition.
  assert.deepEqual(composed.next_gate.options.map((o) => o.theo_rank), [1, 2, 3, 4]);

  // grounding.option_order names the applied ordering on the success path.
  // 392-10 RE-PIN: 'theo_rank'; was 'command_bearing_first'.
  assert.equal(composed.grounding.option_order, 'theo_rank');

  assert.equal(composed.grounding.rows.length, 3);
  for (const r of composed.grounding.rows) {
    assert.deepEqual(Object.keys(r).sort(), ['chapterId', 'score', 'section', 'snippet']);
  }
  assert.equal(composed.grounding.problem_type_source, 'heuristic');
  // 392-10 RE-PIN: 'theo_rank_blend'; was 'theo_degree_normalized'.
  assert.equal(composed.grounding.confidence_source, 'theo_rank_blend');
  assert.equal(composed.grounding.chain_status, 'ok');
  assert.equal('query_terms' in composed, false);

  // Exactly one wire call for commands, and it is label-anchored (never
  // relationship-first -- Theo's read allow-list refuses a scan that
  // starts from [:USES_FRAMEWORK]).
  assert.equal(queryCallCount, 1);
  assert.ok(lastCypher.startsWith('MATCH (f:Framework)'));
  assert.ok(/\(c:MindrianCommand\)-\[:USES_FRAMEWORK\]/.test(lastCypher));
  assert.deepEqual(lastParams.names, [
    'Design Thinking', 'Disruptive Innovation', 'Red Teaming', 'Creative Destruction',
  ]);
});

// ---------------------------------------------------------------------------
// Quick 260911-ddd (DDD-01) arms: theo_rank and grounding.option_order.
// Phase 392-10 (D-05, 2026-11-08) RE-PIN: the command-bearing-first partition
// these arms pinned is removed; Theo's pedagogical rank is authoritative and
// the information the partition encoded is kept as `has_command` on each
// option. The arms below keep their purpose (rank survives, catch path
// carries option_order) with the new rule.
// ---------------------------------------------------------------------------
test('Arm DDD-1 (260911-ddd, re-pinned 392-10): mixed chain, top step has NO command -- the rank-1 framework stays at options[0]; has_command marks the command-bearing one (live IllDefined shape)', async () => {
  const brainClient = freshBrainClient('test-key-260911-ddd-arm1');
  const payload = {
    answer_mode: 'structured_rows',
    rows: [{ chapterId: 'c1', section: 's', score: 1, snippet: 'x' }],
    query_terms: ['x'],
  };
  const chainStub = {
    problem_type: 'IllDefined',
    chain: [
      { step: 1, framework: 'Design Thinking', degree: 291 },
      { step: 2, framework: 'Disruptive Innovation', degree: 255 },
      { step: 3, framework: 'Red Teaming', degree: 239 },
      { step: 4, framework: 'Creative Destruction', degree: 189 },
    ],
    coverage: { matched: 1, total: 6, status: 'partial' },
  };
  const queryStub = async () => ({
    records: [
      { framework: 'Red Teaming', commands: ['/mos:challenge-assumptions'] },
    ],
  });

  const composed = await brainClient._test._composeTheoAsk(
    payload,
    'which opportunity should we chase next',
    { recommendChain: async () => chainStub, query: queryStub }
  );

  // 392-10 RE-PIN: Theo's order, rank-1 Design Thinking at options[0] even
  // without a command. Was: Red Teaming (the only command-bearing option)
  // surfaced first with theo_rank 3 at options[0].
  assert.deepEqual(composed.next_gate.options.map((o) => o.framework), [
    'Design Thinking', 'Disruptive Innovation', 'Red Teaming', 'Creative Destruction',
  ]);
  assert.equal(composed.directive.guided.framework, 'Design Thinking');
  assert.equal(composed.next_gate.options[0].theo_rank, 1);
  assert.equal(composed.next_gate.options[0].has_command, false);

  // The command information is not lost: has_command on every option.
  assert.deepEqual(composed.next_gate.options.map((o) => o.has_command), [false, false, true, false]);
  const commandLessFrameworks = composed.next_gate.options
    .filter((o) => !o.has_command)
    .map((o) => o.framework);
  assert.deepEqual(commandLessFrameworks, ['Design Thinking', 'Disruptive Innovation', 'Creative Destruction']);
  assert.equal(commandLessFrameworks.length, 3);
  assert.deepEqual(composed.next_gate.options[2].commands, ['challenge-assumptions']);

  const theoRankByFramework = {};
  for (const o of composed.next_gate.options) theoRankByFramework[o.framework] = o.theo_rank;
  assert.equal(theoRankByFramework['Design Thinking'], 1);
  assert.equal(theoRankByFramework['Disruptive Innovation'], 2);
  assert.equal(theoRankByFramework['Red Teaming'], 3);
  assert.equal(theoRankByFramework['Creative Destruction'], 4);

  // 392-10 RE-PIN: 'theo_rank'; was 'command_bearing_first'.
  assert.equal(composed.grounding.option_order, 'theo_rank');
});

test('Arm DDD-2 (260911-ddd): an all-command chain and a no-command chain both come back in Theo order, theo_rank strictly ascending', async () => {
  const brainClient = freshBrainClient('test-key-260911-ddd-arm2');
  const payload = {
    answer_mode: 'structured_rows',
    rows: [{ chapterId: 'c1', section: 's', score: 1, snippet: 'x' }],
    query_terms: ['x'],
  };

  // All-command: every step carries at least one command -- the
  // command-bearing queue holds everything, the command-less queue is
  // empty, so concatenation is the identity.
  const allCommandChain = {
    chain: [
      { step: 1, framework: 'Alpha', degree: 300 },
      { step: 2, framework: 'Beta', degree: 200 },
      { step: 3, framework: 'Gamma', degree: 100 },
    ],
  };
  const allCommandQuery = async () => ({
    records: [
      { framework: 'Alpha', commands: ['/mos:cmd-alpha'] },
      { framework: 'Beta', commands: ['/mos:cmd-beta'] },
      { framework: 'Gamma', commands: ['/mos:cmd-gamma'] },
    ],
  });
  const allCommandOut = await brainClient._test._composeTheoAsk(payload, 'q', {
    recommendChain: async () => allCommandChain,
    query: allCommandQuery,
  });
  assert.deepEqual(allCommandOut.next_gate.options.map((o) => o.framework), ['Alpha', 'Beta', 'Gamma']);
  const allRanks = allCommandOut.next_gate.options.map((o) => o.theo_rank);
  assert.deepEqual(allRanks, [1, 2, 3]);
  for (let i = 1; i < allRanks.length; i++) assert.ok(allRanks[i] > allRanks[i - 1], 'theo_rank must be strictly ascending');

  // No-command: no step carries any command -- the command-less queue
  // holds everything, the command-bearing queue is empty, concatenation is
  // again the identity.
  const noCommandChain = {
    chain: [
      { step: 1, framework: 'Alpha', degree: 300 },
      { step: 2, framework: 'Beta', degree: 200 },
      { step: 3, framework: 'Gamma', degree: 100 },
    ],
  };
  const noCommandOut = await brainClient._test._composeTheoAsk(payload, 'q', {
    recommendChain: async () => noCommandChain,
    query: async () => ({ records: [] }),
  });
  assert.deepEqual(noCommandOut.next_gate.options.map((o) => o.framework), ['Alpha', 'Beta', 'Gamma']);
  const noRanks = noCommandOut.next_gate.options.map((o) => o.theo_rank);
  assert.deepEqual(noRanks, [1, 2, 3]);
  for (let i = 1; i < noRanks.length; i++) assert.ok(noRanks[i] > noRanks[i - 1], 'theo_rank must be strictly ascending');
});

test('Arm DDD-3 (260911-ddd, re-pinned 392-10): theo_rank falls back to the 1-based Theo-chain index when rank and step are absent, never to the post-sort index', async () => {
  const brainClient = freshBrainClient('test-key-260911-ddd-arm3');
  const payload = {
    answer_mode: 'structured_rows',
    rows: [{ chapterId: 'c1', section: 's', score: 1, snippet: 'x' }],
    query_terms: ['x'],
  };
  // Neither step carries a `rank` or a `step` field -- theo_rank must fall
  // back to the 1-based index WITHIN Theo's own chain array, computed
  // BEFORE the sort. 392-10 RE-PIN: unranked steps sort by degree
  // descending (the partition that put command-bearing Beta first is
  // gone), so the chain is written with the lower-degree step FIRST to keep
  // the arm's purpose: the sort moves Beta ahead, theo_rank must still read
  // the ORIGINAL index (2 then 1), never the post-sort position.
  const chainStub = {
    chain: [
      { framework: 'Alpha', degree: 200 }, // index 0 -> fallback rank 1, no command
      { framework: 'Beta', degree: 300 },  // index 1 -> fallback rank 2, has a command
    ],
  };
  const queryStub = async () => ({ records: [{ framework: 'Beta', commands: ['/mos:cmd-beta'] }] });

  const composed = await brainClient._test._composeTheoAsk(payload, 'q', {
    recommendChain: async () => chainStub,
    query: queryStub,
  });

  // Beta (higher degree) sorts first, Alpha second -- but theo_rank must
  // reflect the ORIGINAL Theo index (2 then 1), never the post-sort
  // position (which would read 1 then 2). Both read the floor confidence.
  assert.deepEqual(composed.next_gate.options.map((o) => o.framework), ['Beta', 'Alpha']);
  assert.deepEqual(composed.next_gate.options.map((o) => o.theo_rank), [2, 1]);
  assert.deepEqual(composed.next_gate.options.map((o) => o.confidence), [0.5, 0.5]);
  assert.deepEqual(composed.next_gate.options.map((o) => o.has_command), [true, false]);
});

test('Arm DDD-4 (260911-ddd): grounding.option_order is present on the degraded catch path too (chain unreachable, options [])', async () => {
  const brainClient = freshBrainClient('test-key-260911-ddd-arm4');
  const payload = {
    answer_mode: 'structured_rows',
    rows: [{ chapterId: 'c1', section: 's', score: 1, snippet: 'x' }],
    query_terms: ['x'],
  };
  // A step whose `degree` getter throws forces an exception AFTER
  // chainStatus has already resolved to 'ok' (steps.length > 0), inside the
  // top/confidence computation -- this is the way to reach the function's
  // own trailing catch block from the outside, since a throwing
  // recommendChain or query is already caught by its own inner try/catch
  // and degrades chainStatus instead of propagating.
  const explodingStep = new Proxy({ step: 1, framework: 'Boom' }, {
    get(target, prop) {
      if (prop === 'degree') throw new Error('simulated degree-accessor failure');
      return target[prop];
    },
  });
  const chainStub = { chain: [explodingStep] };

  const composed = await brainClient._test._composeTheoAsk(payload, 'q', {
    recommendChain: async () => chainStub,
    query: async () => ({ records: [] }),
  });

  assert.deepEqual(composed.next_gate.options, []);
  assert.equal(composed.directive.guided.framework, null);
  assert.equal(composed.grounding.chain_status, 'unreachable');
  // 392-10 RE-PIN: 'theo_rank'; was 'command_bearing_first'.
  assert.equal(composed.grounding.option_order, 'theo_rank');
  assert.equal(composed.grounding.confidence_source, 'theo_rank_blend');
});

// ---------------------------------------------------------------------------
// Arm 2
// ---------------------------------------------------------------------------
test('Arm 2: ask() against an incumbent-shaped response passes through unchanged, gains no grounding key', async () => {
  const brainClient = freshBrainClient('test-key-260910-hni-arm2');
  const incumbentPayload = {
    directive: { guided: { questions: [], framework: 'Six Thinking Hats', stage: 'ill-defined' } },
    next_gate: { sub_shape: 'F.1', options: [{ framework: 'Six Thinking Hats', confidence: 0.8 }] },
  };
  const origFetch = global.fetch;
  let fetchCalls = 0;
  global.fetch = async (_url, init) => {
    fetchCalls += 1;
    const body = JSON.parse(init.body);
    if (body.method === 'initialize') return makeInitOkResponse();
    if (body.method === 'tools/call') return makeToolTextResponse(incumbentPayload);
    return { ok: false, status: 500, text: async () => '' };
  };
  try {
    // 354-06 (D-354-EGR): every token here (framework, chain, sequence) is
    // closed-vocabulary (QUESTION_FUNCTION_WORDS), so _typedFreeformGate
    // proves it typed_question and ask() proceeds to callTool() unchanged --
    // no egress_disclosure gets attached, keeping the byte-equal assertion
    // below clean. Was 'framework chain analysis sequence'; 'analysis' is
    // not closed-vocabulary and would now be refused before any fetch.
    const result = await brainClient.ask('framework chain sequence');
    assert.deepStrictEqual(result, incumbentPayload);
    assert.equal('grounding' in result, false);
    assert.equal(fetchCalls, 2); // initialize + tools/call
  } finally {
    global.fetch = origFetch;
  }
});

// ---------------------------------------------------------------------------
// Arm 3
// ---------------------------------------------------------------------------
test('Arm 3a: an egress_blocked sentinel passes through ask() unchanged, zero network', async () => {
  const brainClient = freshBrainClient('test-key-260910-hni-arm3a');
  const origFetch = global.fetch;
  let fetchCalls = 0;
  global.fetch = async () => {
    fetchCalls += 1;
    throw new Error('network must never be reached -- the Part 8 block verdict short-circuits before any fetch');
  };
  try {
    const result = await brainClient.ask('contact me at jane@startup.com');
    // 354-06 (D-354-EGR): the block now short-circuits at ask()'s own
    // _typedFreeformGate, BEFORE callTool() is ever reached, so the
    // sentinel is _typedFreeformGate's shape (adds a `reason` field) rather
    // than callTool()'s own belt sentinel. tool/egress_class are unchanged
    // (classify()'s content_set verdict is byte-identical either way);
    // fetchCalls stays 0 either way (both enforcement points are pre-wire).
    // 369.2-08 (CODE-07, 2026-10-05): the sentinel is the one Theo vocabulary
    // {error, tool, egress_class, token_class, reason}. The old reason text
    // ("Brain free-form channels accept closed-vocabulary methodology questions
    // only ...") belonged to the shape-based gate and is gone; the reason now
    // names the CLASS in plain language and never echoes the content. This arm
    // pins the stable fields exactly and the reason by property, so a rewording
    // of the sentence does not turn it red while an echo of the email would.
    assert.equal(result.error, 'egress_blocked');
    assert.equal(result.tool, 'brain_ask');
    assert.equal(result.egress_class, 'content_set');
    assert.equal(result.token_class, null);
    assert.equal(typeof result.reason, 'string');
    assert.ok(result.reason.length > 0, 'the sentinel must carry a plain-language reason');
    assert.ok(result.reason.indexOf('jane@startup.com') === -1 && result.reason.indexOf('startup') === -1, 'the reason must never echo the blocked content');
    // 2026-11-10 (plan 392-13 re-pin): plan 392-11 added lexicon_scope (session | machine_global) to every sentinel.
    assert.deepEqual(Object.keys(result).sort(), ['egress_class', 'error', 'lexicon_scope', 'reason', 'token_class', 'tool']);
    assert.ok(['session', 'machine_global'].includes(result.lexicon_scope), 'lexicon_scope is a closed value');
    assert.equal(fetchCalls, 0);
  } finally {
    global.fetch = origFetch;
  }
});

test('Arm 3b: a transport-null result passes through ask() unchanged', async () => {
  const brainClient = freshBrainClient('test-key-260910-hni-arm3b');
  const origFetch = global.fetch;
  global.fetch = async () => {
    throw new Error('simulated transport failure');
  };
  try {
    // 354-06 (D-354-EGR): same closed-vocabulary rephrase as Arm 2 above, so
    // _typedFreeformGate proceeds to callTool() and this arm still exercises
    // the transport-null contract instead of short-circuiting on the gate.
    const result = await brainClient.ask('framework chain sequence');
    assert.equal(result, null);
  } finally {
    global.fetch = origFetch;
  }
});

// ---------------------------------------------------------------------------
// Arm 4
// ---------------------------------------------------------------------------
test('Arm 4: an empty recommend_chain leaves grounding.rows populated (chain_status empty); a throwing recommend_chain never throws (chain_status unreachable)', async () => {
  const brainClient = freshBrainClient('test-key-260910-hni-arm4');
  const payload = {
    answer_mode: 'structured_rows',
    rows: [{ chapterId: 'c1', section: 's', score: 1, snippet: 'x' }],
    query_terms: ['x'],
  };

  const emptyChainOut = await brainClient._test._composeTheoAsk(
    payload,
    'which opportunity should we chase',
    {
      recommendChain: async () => ({
        problem_type: 'IllDefined',
        chain: [],
        available_problem_types: ['IllDefined'],
        coverage: { matched: 0, total: 6, status: 'empty' },
      }),
      query: async () => { throw new Error('query() must never be called when there are zero chain steps'); },
    }
  );
  assert.equal(emptyChainOut.grounding.chain_status, 'empty');
  assert.deepEqual(emptyChainOut.next_gate.options, []);
  assert.equal(emptyChainOut.directive.guided.framework, null);
  assert.equal(emptyChainOut.grounding.rows.length, 1);

  const throwingChainOut = await brainClient._test._composeTheoAsk(
    payload,
    'which opportunity should we chase',
    {
      recommendChain: async () => { throw new Error('simulated recommend_chain wire failure'); },
      query: async () => { throw new Error('query() must never be called after a thrown recommend_chain'); },
    }
  );
  assert.equal(throwingChainOut.grounding.chain_status, 'unreachable');
  assert.deepEqual(throwingChainOut.next_gate.options, []);
  assert.equal(throwingChainOut.grounding.rows.length, 1);
});

// ---------------------------------------------------------------------------
// Arm 5
// ---------------------------------------------------------------------------
test('Arm 5 (Canon Part 8 tripwire): the question, plus a canary in query_terms and in the query() wire diagnostics, never reach the composed envelope', async () => {
  const brainClient = freshBrainClient('test-key-260910-hni-arm5');
  const CANARY = 'CANARY260910HNI7Q2WORD';
  const question = 'which distinctive multiword opportunity question should we chase ' + CANARY;
  const payload = {
    answer_mode: 'structured_rows',
    rows: [{ chapterId: 'c1', section: 's', score: 1, snippet: 'x' }],
    query_terms: [CANARY, 'which', 'opportunity'],
    search_mode: 'lexical',
  };

  const composed = await brainClient._test._composeTheoAsk(payload, question, {
    recommendChain: async () => ({
      chain: [{ step: 1, framework: 'Design Thinking', degree: 291 }],
      coverage: { matched: 1, total: 6, status: 'partial' },
    }),
    // Mirrors query()'s REAL return shape ({...result, records}), which DOES
    // carry a `diagnostics` field alongside `records` (query()'s own
    // docblock: "preserving every other field the Brain sent"). This proves
    // _composeTheoAsk reads ONLY .records off the query() result and never
    // blindly copies the rest of the wire response -- the standing tripwire
    // for any future echo path through a field this composer does not name.
    query: async () => ({
      diagnostics: { note: CANARY },
      records: [{ framework: 'Design Thinking', commands: [] }],
    }),
  });

  const serialized = JSON.stringify(composed);
  assert.equal(serialized.includes(CANARY), false, 'canary must not survive into the composed envelope');
  assert.equal(serialized.includes(question), false, 'the raw question string must never be echoed');
  assert.equal('query_terms' in composed, false);
});

// ---------------------------------------------------------------------------
// Arms 6 and 7
// ---------------------------------------------------------------------------
test('Arm 6: _normalizeAskOpResult recognizes the Theo shape via coverage.matched, never a count key', () => {
  const brainClient = freshBrainClient('test-key-260910-hni-arm6');
  const n = brainClient._test._normalizeAskOpResult;
  // coverage.matched (2) is deliberately DIFFERENT from rows.length (3) --
  // a partial-coverage answer can return fewer matched rows than the rows
  // array holds context for -- so this arm cannot pass by accident if a
  // future edit reads rows.length instead of coverage.matched.
  const theoResult = {
    op: 'list_frameworks',
    rows: [{ name: 'A' }, { name: 'B' }, { name: 'C' }],
    coverage: { matched: 2, total: 452, status: 'partial' },
  };
  const out = n(theoResult, 'list_frameworks');
  assert.equal(out.count, 2);
  assert.equal(out.source, 'theo');
  assert.deepEqual(out.coverage, { matched: 2, total: 452, status: 'partial' });
  assert.equal('degraded' in out, false);
});

test('Arm 7: _normalizeAskOpResult leaves the incumbent count-keyed shape byte-identical, including its own degraded sentinel; a non-array rows still degrades', () => {
  const brainClient = freshBrainClient('test-key-260910-hni-arm7');
  const n = brainClient._test._normalizeAskOpResult;

  const incumbentResult = { op: 'framework_edges', source: 'neo4j', count: 5, rows: [1, 2, 3, 4, 5] };
  assert.deepStrictEqual(n(incumbentResult, 'framework_edges'), incumbentResult);
  assert.notEqual(n(incumbentResult, 'framework_edges').source, 'theo');

  const incumbentDegraded = { op: 'x', count: 0, rows: [], degraded: true };
  // The incumbent arm always sets `source` (from result.source), so an
  // input with no source key produces an explicit `source: undefined` --
  // this IS today's byte-identical incumbent behavior (askOp's pre-Task-1
  // literal), not a regression; the comparator states that explicitly
  // rather than relying on an absent-vs-undefined key coincidence.
  assert.deepStrictEqual(n(incumbentDegraded, 'x'), { op: 'x', source: undefined, count: 0, rows: [], degraded: true });

  const malformed = { op: 'x', rows: 'not-an-array', coverage: { matched: 3 } };
  assert.deepStrictEqual(n(malformed, 'x'), { op: 'x', count: 0, rows: [], degraded: true });
});
