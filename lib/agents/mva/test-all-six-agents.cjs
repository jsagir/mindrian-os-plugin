'use strict';
/*
 * Phase 118 Plan 02 -- aggregate test runner for the 6 MVA agents.
 *
 * Tests 1-6:   Task 1 (the 3 Brain agents: brain-similar-ventures,
 *                      brain-cross-domain, brain-classic-traps)
 * Tests 7-12:  Task 2 (tavily-funding-scan + six-hats-red-black)
 * Tests 13-17: Task 3 (dashboard-graph-neighborhood + index.cjs aggregator
 *                      + end-to-end mock dispatch)
 *
 * Plus static grep tests for Canon Part 8 + Canon Part 9 invariants.
 *
 * All agents conform to the Agent contract from Plan 118-01:
 *   async function agent(context, signal) -> { status:'ok'|'empty', payload } | null
 *
 * Mocks are installed via require-cache monkey-patch (precedent:
 *   lib/memory/run-feynman-tests.cjs and lib/memory/brain-derive-command.test.cjs).
 *
 * Canon Part 8 invariant: this test file asserts that no agent reads
 * MVA_SENTENCE or passes sentence_sha256 as a query body to Brain / Tavily.
 */
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');

const AGENT_DIR = __dirname;

// ---------- helpers ----------

function makeSignal(aborted) {
  const ctl = new AbortController();
  if (aborted) ctl.abort();
  return ctl.signal;
}

function freshRequire(modPath) {
  delete require.cache[require.resolve(modPath)];
  return require(modPath);
}

/**
 * Install a mock for the brain-client module before the agent under test
 * require()s it. We resolve the brain-client.cjs path the agent will resolve,
 * delete it from cache, install the mock, then freshRequire the agent.
 *
 * Returns the mock object so the test can inspect callTool/query/search args.
 */
function installBrainMock(behavior) {
  const brainPath = require.resolve(path.join(AGENT_DIR, '..', '..', 'core', 'brain-client.cjs'));
  const mock = {
    _calls: [],
    isAvailable: () => behavior.available !== false,
    query: async (cypher, params) => {
      mock._calls.push({ tool: 'query', cypher, params });
      if (behavior.queryResult !== undefined) return behavior.queryResult;
      return { records: [] };
    },
    search: async (queryText, opts) => {
      mock._calls.push({ tool: 'search', queryText, opts });
      if (behavior.searchResult !== undefined) return behavior.searchResult;
      return { results: [] };
    },
    callTool: async (toolName, args) => {
      mock._calls.push({ tool: 'callTool', toolName, args });
      if (behavior.callToolResult !== undefined) return behavior.callToolResult;
      return null;
    },
  };
  require.cache[brainPath] = {
    id: brainPath,
    filename: brainPath,
    loaded: true,
    exports: mock,
  };
  return mock;
}

function uninstallBrainMock() {
  const brainPath = require.resolve(path.join(AGENT_DIR, '..', '..', 'core', 'brain-client.cjs'));
  delete require.cache[brainPath];
}

// =========================================================================
// Task 1: The 3 Brain agents
// =========================================================================

test('Test 1: brain-similar-ventures returns 3 ventures with summary line', async () => {
  installBrainMock({
    available: true,
    searchResult: {
      results: [
        { name: 'Alpha Co', status: 'active' },
        { name: 'Beta Co', status: 'pivoted' },
        { name: 'Gamma Co', status: 'active' },
      ],
    },
  });
  const agent = freshRequire(path.join(AGENT_DIR, 'brain-similar-ventures.cjs'));
  const res = await agent.run(
    { sentence_sha256: 'abc123', remaining_budget_ms: 30000 },
    makeSignal(false)
  );
  uninstallBrainMock();
  assert.equal(res.status, 'ok');
  assert.match(res.payload.summary_line, /Found 3 ventures/);
  assert.equal(res.payload.deck_data.ventures.length, 3);
});

test('Test 2: brain-cross-domain returns 1 analogy with Cross-domain summary', async () => {
  installBrainMock({
    available: true,
    searchResult: {
      results: [
        { name: 'Bridge Pattern', signature: 'separate interface from implementation' },
      ],
    },
  });
  const agent = freshRequire(path.join(AGENT_DIR, 'brain-cross-domain.cjs'));
  const res = await agent.run(
    { sentence_sha256: 'abc123', remaining_budget_ms: 30000 },
    makeSignal(false)
  );
  uninstallBrainMock();
  assert.equal(res.status, 'ok');
  assert.match(res.payload.summary_line, /^Cross-domain analogy:/);
  assert.equal(res.payload.deck_data.analogy.name, 'Bridge Pattern');
});

test('Test 3: brain-classic-traps returns 1 trap with Classic trap summary', async () => {
  installBrainMock({
    available: true,
    queryResult: {
      records: [
        { name: 'Premature Optimization', signature: 'building features before market validation' },
      ],
    },
  });
  const agent = freshRequire(path.join(AGENT_DIR, 'brain-classic-traps.cjs'));
  const res = await agent.run(
    { sentence_sha256: 'abc123', remaining_budget_ms: 30000 },
    makeSignal(false)
  );
  uninstallBrainMock();
  assert.equal(res.status, 'ok');
  assert.match(res.payload.summary_line, /^Classic trap:/);
  assert.equal(res.payload.deck_data.trap.name, 'Premature Optimization');
});

test('Test 4: all 3 Brain agents return status=empty in <100ms when isAvailable() is false', async () => {
  const agents = ['brain-similar-ventures.cjs', 'brain-cross-domain.cjs', 'brain-classic-traps.cjs'];
  for (const file of agents) {
    installBrainMock({ available: false });
    const agent = freshRequire(path.join(AGENT_DIR, file));
    const t0 = Date.now();
    const res = await agent.run(
      { sentence_sha256: 'abc', remaining_budget_ms: 30000 },
      makeSignal(false)
    );
    const dt = Date.now() - t0;
    uninstallBrainMock();
    assert.equal(res.status, 'empty', file + ' should be empty');
    assert.equal(res.payload.reason, 'brain_unavailable', file + ' reason should be brain_unavailable');
    assert.ok(dt < 100, file + ' took ' + dt + 'ms (must be <100ms)');
  }
});

test('Test 5: all 3 Brain agents observe AbortSignal mid-flight', async () => {
  const agents = ['brain-similar-ventures.cjs', 'brain-cross-domain.cjs', 'brain-classic-traps.cjs'];
  for (const file of agents) {
    installBrainMock({ available: true, searchResult: { results: [{ name: 'X' }] }, queryResult: { records: [{ name: 'X' }] } });
    const agent = freshRequire(path.join(AGENT_DIR, file));
    const res = await agent.run(
      { sentence_sha256: 'abc', remaining_budget_ms: 30000 },
      makeSignal(true) // signal pre-aborted
    );
    uninstallBrainMock();
    // Agent must return null OR an empty/ok shape; what it MUST NOT do is throw.
    assert.ok(res === null || (res && typeof res === 'object'), file + ' must not throw when signal aborted');
  }
});

test('Test 6 [Canon Part 8 grep regression]: no raw sentence or sha256 in Brain query body', () => {
  const sources = ['brain-similar-ventures.cjs', 'brain-cross-domain.cjs', 'brain-classic-traps.cjs'];
  for (const src of sources) {
    const code = fs.readFileSync(path.join(AGENT_DIR, src), 'utf8');
    assert.equal(code.match(/MVA_SENTENCE/), null, src + ' must not read MVA_SENTENCE');
    assert.equal(code.match(/process\.env\.CLAUDE_USER_PROMPT/), null, src + ' must not read CLAUDE_USER_PROMPT');
    // Forbid passing sentence_sha256 as a query body or cypher param value
    assert.equal(code.match(/search\([^)]*sentence_sha256/), null, src + ' must not pass sentence_sha256 to search()');
    assert.equal(code.match(/query\([^)]*sentence_sha256/), null, src + ' must not pass sentence_sha256 to query()');
    // Forbid writing to stdout (telemetry side-channel rule)
    assert.equal(code.match(/process\.stdout|console\.log/), null, src + ' must not write to stdout');
  }
});

// =========================================================================
// Task 2: Tavily funding-scan + Six-hats red/black
// =========================================================================

test('Test 7: tavily-funding-scan returns status=empty in <50ms when key absent', async () => {
  // Ensure no key present in env nor file (test runs hermetic via env override)
  const prevKey = process.env.TAVILY_API_KEY;
  const prevHome = process.env.HOME;
  delete process.env.TAVILY_API_KEY;
  // Point HOME to a scratch dir that has no .mindrian.env so the file path lookup fails
  const tmpHome = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'mva-tav-'));
  process.env.HOME = tmpHome;
  try {
    const agent = freshRequire(path.join(AGENT_DIR, 'tavily-funding-scan.cjs'));
    const t0 = Date.now();
    const res = await agent.run(
      { sentence_sha256: 'abc', remaining_budget_ms: 30000 },
      makeSignal(false)
    );
    const dt = Date.now() - t0;
    assert.equal(res.status, 'empty');
    assert.equal(res.payload.reason, 'tavily_unavailable');
    assert.ok(dt < 50, 'tavily empty took ' + dt + 'ms (must be <50ms)');
  } finally {
    if (prevKey !== undefined) process.env.TAVILY_API_KEY = prevKey;
    if (prevHome !== undefined) process.env.HOME = prevHome;
    try { fs.rmSync(tmpHome, { recursive: true, force: true }); } catch (_e) {}
  }
});

test('Test 8: tavily-funding-scan returns ok when key set and Tavily returns 1 result', async () => {
  const prevKey = process.env.TAVILY_API_KEY;
  const prevFetch = global.fetch;
  process.env.TAVILY_API_KEY = 'tvly-test-key-12345';
  global.fetch = async (url, opts) => {
    assert.ok(String(url).startsWith('https://api.tavily.com'), 'must call Tavily API');
    return {
      ok: true,
      json: async () => ({
        results: [
          {
            title: 'NSF Innovation Corps Funding Track 2026',
            url: 'https://example.com/nsf-icorps',
            snippet: 'NSF I-Corps grants up to 50000 USD for pre-seed venture validation; deadline Q3 2026.',
          },
        ],
      }),
    };
  };
  try {
    const agent = freshRequire(path.join(AGENT_DIR, 'tavily-funding-scan.cjs'));
    const res = await agent.run(
      { sentence_sha256: 'abc', remaining_budget_ms: 30000 },
      makeSignal(false)
    );
    assert.equal(res.status, 'ok');
    assert.match(res.payload.summary_line, /^Live funding match:/);
    assert.ok(Array.isArray(res.payload.deck_data.funding));
    assert.ok(res.payload.deck_data.funding.length >= 1);
  } finally {
    if (prevKey === undefined) delete process.env.TAVILY_API_KEY;
    else process.env.TAVILY_API_KEY = prevKey;
    global.fetch = prevFetch;
  }
});

test('Test 9: tavily-funding-scan returns null when signal pre-aborted', async () => {
  const prevKey = process.env.TAVILY_API_KEY;
  process.env.TAVILY_API_KEY = 'tvly-test-key-12345';
  const prevFetch = global.fetch;
  global.fetch = async () => { throw new Error('should not be called'); };
  try {
    const agent = freshRequire(path.join(AGENT_DIR, 'tavily-funding-scan.cjs'));
    const res = await agent.run(
      { sentence_sha256: 'abc', remaining_budget_ms: 30000 },
      makeSignal(true)
    );
    assert.ok(res === null || (res && res.status === 'empty'), 'must short-circuit on aborted signal');
  } finally {
    if (prevKey === undefined) delete process.env.TAVILY_API_KEY;
    else process.env.TAVILY_API_KEY = prevKey;
    global.fetch = prevFetch;
  }
});

test('Test 10 [Canon Part 8]: tavily-funding-scan query is hardcoded generic string', () => {
  const code = fs.readFileSync(path.join(AGENT_DIR, 'tavily-funding-scan.cjs'), 'utf8');
  assert.equal(code.match(/MVA_SENTENCE/), null, 'must not read MVA_SENTENCE');
  assert.equal(code.match(/process\.env\.CLAUDE_USER_PROMPT/), null, 'must not read CLAUDE_USER_PROMPT');
  // The fetch body must not interpolate sentence_sha256
  assert.equal(code.match(/JSON\.stringify\([^)]*sentence_sha256/), null, 'must not put sha256 in fetch body');
  // The Tavily query must be a hardcoded string literal (NOT derived from context)
  assert.match(code, /const query = "/, 'tavily query must be hardcoded string literal');
  // No stdout writes
  assert.equal(code.match(/process\.stdout|console\.log/), null, 'no stdout writes');
});

test('Test 11: six-hats-red-black is deterministic per sentence_sha256', async () => {
  const agent = freshRequire(path.join(AGENT_DIR, 'six-hats-red-black.cjs'));
  const r1 = await agent.run(
    { sentence_sha256: 'aaaa1111bbbb2222cccc3333dddd4444', remaining_budget_ms: 30000 },
    makeSignal(false)
  );
  const r2 = await agent.run(
    { sentence_sha256: 'aaaa1111bbbb2222cccc3333dddd4444', remaining_budget_ms: 30000 },
    makeSignal(false)
  );
  const r3 = await agent.run(
    { sentence_sha256: 'ffffeeeeddddccccbbbb1111000099998', remaining_budget_ms: 30000 },
    makeSignal(false)
  );
  assert.equal(r1.status, 'ok');
  assert.match(r1.payload.summary_line, /^One question you haven't asked yourself:/);
  // Same hash -> same output
  assert.deepEqual(r1.payload, r2.payload, 'same hash must produce identical payload');
  // Different hash -> different output (registry has 12 entries so collisions exist for short tests; assert at least one of red_flag/black_flag/summary differs)
  const differs =
    r1.payload.summary_line !== r3.payload.summary_line ||
    r1.payload.deck_data.red_flag !== r3.payload.deck_data.red_flag ||
    r1.payload.deck_data.black_flag !== r3.payload.deck_data.black_flag;
  assert.ok(differs, 'different sha256 should yield different question pair');
});

test('Test 12: six-hats-red-black never makes a network call', async () => {
  let fetchCalled = false;
  const prevFetch = global.fetch;
  global.fetch = async () => { fetchCalled = true; throw new Error('forbidden'); };
  try {
    const agent = freshRequire(path.join(AGENT_DIR, 'six-hats-red-black.cjs'));
    await agent.run({ sentence_sha256: 'cafebabe', remaining_budget_ms: 30000 }, makeSignal(false));
  } finally {
    global.fetch = prevFetch;
  }
  assert.equal(fetchCalled, false, 'six-hats must not call fetch');
});

// =========================================================================
// Task 3: Dashboard graph-neighborhood + index aggregator + end-to-end
// =========================================================================

test('Test 13: dashboard-graph-neighborhood returns ok with 5-node neighborhood (mocked navigation)', async () => {
  const navPath = require.resolve(path.join(AGENT_DIR, '..', '..', 'core', 'navigation.cjs'));
  const realNav = require(navPath);
  // Monkey-patch the cached module exports
  const mockNav = {
    detectActiveRoom: () => ({ roomDir: '/tmp/fake-room', hasRoomDb: true }),
    getRecentDecisionNeighborhood: () => ({
      nodes: [
        { id: 'n1', type: 'decision' },
        { id: 'n2', type: 'decision' },
        { id: 'n3', type: 'decision' },
        { id: 'n4', type: 'decision' },
        { id: 'n5', type: 'decision' },
      ],
      edges: [],
    }),
  };
  require.cache[navPath] = {
    id: navPath,
    filename: navPath,
    loaded: true,
    exports: mockNav,
  };
  try {
    const agent = freshRequire(path.join(AGENT_DIR, 'dashboard-graph-neighborhood.cjs'));
    const res = await agent.run(
      { sentence_sha256: 'abc', remaining_budget_ms: 30000 },
      makeSignal(false)
    );
    assert.equal(res.status, 'ok');
    assert.match(res.payload.summary_line, /5 related decision nodes/);
    assert.equal(res.payload.deck_data.nodes.length, 5);
  } finally {
    require.cache[navPath] = { id: navPath, filename: navPath, loaded: true, exports: realNav };
  }
});

test('Test 14: dashboard-graph-neighborhood returns empty/no_active_room when no active room', async () => {
  const navPath = require.resolve(path.join(AGENT_DIR, '..', '..', 'core', 'navigation.cjs'));
  const realNav = require(navPath);
  const mockNav = {
    detectActiveRoom: () => null,
  };
  require.cache[navPath] = { id: navPath, filename: navPath, loaded: true, exports: mockNav };
  try {
    const agent = freshRequire(path.join(AGENT_DIR, 'dashboard-graph-neighborhood.cjs'));
    const res = await agent.run(
      { sentence_sha256: 'abc', remaining_budget_ms: 30000 },
      makeSignal(false)
    );
    assert.equal(res.status, 'empty');
    assert.equal(res.payload.reason, 'no_active_room');
  } finally {
    require.cache[navPath] = { id: navPath, filename: navPath, loaded: true, exports: realNav };
  }
});

test('Test 15 [Canon Part 9 grep regression]: dashboard agent uses navigation.cjs exclusively', () => {
  const code = fs.readFileSync(path.join(AGENT_DIR, 'dashboard-graph-neighborhood.cjs'), 'utf8');
  assert.equal(code.match(/require\([^)]*room-db/), null, 'must not require room-db directly');
  assert.equal(code.match(/require\(['"]better-sqlite3['"]\)/), null, 'must not require sqlite3 directly');
  assert.equal(code.match(/require\(['"]node:sqlite['"]\)/), null, 'must not require node:sqlite directly');
  assert.match(code, /require\([^)]*navigation\.cjs/, 'must require navigation.cjs');
  assert.equal(code.match(/MVA_SENTENCE/), null, 'must not read MVA_SENTENCE');
  assert.equal(code.match(/process\.stdout|console\.log/), null, 'no stdout writes');
});

test('Test 16: lib/agents/mva/index.cjs exports ALL_AGENTS array with 6 entries matching B1 ids', () => {
  const idx = freshRequire(path.join(AGENT_DIR, 'index.cjs'));
  assert.ok(Array.isArray(idx.ALL_AGENTS), 'ALL_AGENTS must be an array');
  assert.equal(idx.ALL_AGENTS.length, 6, 'exactly 6 agents');
  const ids = idx.ALL_AGENTS.map((a) => a.id);
  assert.deepEqual(ids, [
    'brain_similar',
    'brain_cross_domain',
    'brain_classic_traps',
    'tavily_funding',
    'six_hats_red_black',
    'dashboard_graph',
  ]);
  for (const a of idx.ALL_AGENTS) {
    assert.equal(typeof a.fn, 'function', a.id + '.fn must be a function');
  }
});

test('Test 17 [end-to-end mock dispatch]: 6 agents wire to mva-dispatcher and return 6 results <1500ms', async () => {
  // Install brain mock that returns null isAvailable -> all 3 brain agents return empty fast
  installBrainMock({ available: false });
  // Hide Tavily key -> tavily returns empty fast
  const prevKey = process.env.TAVILY_API_KEY;
  delete process.env.TAVILY_API_KEY;
  // Mock navigation.cjs to return no_active_room
  const navPath = require.resolve(path.join(AGENT_DIR, '..', '..', 'core', 'navigation.cjs'));
  const realNav = require(navPath);
  require.cache[navPath] = {
    id: navPath,
    filename: navPath,
    loaded: true,
    exports: { detectActiveRoom: () => null },
  };
  // Hermetic HOME so tavily file-fallback also finds nothing
  const prevHome = process.env.HOME;
  const tmpHome = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'mva-e2e-'));
  process.env.HOME = tmpHome;
  try {
    const { ALL_AGENTS } = freshRequire(path.join(AGENT_DIR, 'index.cjs'));
    const { dispatchToArray } = require(path.join(AGENT_DIR, '..', '..', 'core', 'mva-dispatcher.cjs'));
    const t0 = Date.now();
    const results = await dispatchToArray(ALL_AGENTS, 'aaaa1111bbbb2222cccc3333dddd4444eeee5555ffff6666aaaa7777bbbb8888', {
      globalBudgetMs: 1500,
      perAgentCapMs: 1000,
    });
    const dt = Date.now() - t0;
    assert.equal(results.length, 6, 'must get 6 results');
    for (const r of results) {
      assert.ok(['ok', 'empty', 'error', 'timeout'].includes(r.status), 'status ' + r.status);
      assert.equal(typeof r.agent_id, 'string');
      assert.ok(r.duration_ms >= 0);
    }
    assert.ok(dt < 1500, 'mock e2e took ' + dt + 'ms (must be <1500ms)');
    // At least six-hats should be ok (deterministic, no deps)
    const sixHats = results.find((r) => r.agent_id === 'six_hats_red_black');
    assert.equal(sixHats.status, 'ok', 'six-hats should always be ok');
  } finally {
    uninstallBrainMock();
    if (prevKey !== undefined) process.env.TAVILY_API_KEY = prevKey;
    require.cache[navPath] = { id: navPath, filename: navPath, loaded: true, exports: realNav };
    if (prevHome !== undefined) process.env.HOME = prevHome;
    try { fs.rmSync(tmpHome, { recursive: true, force: true }); } catch (_e) {}
  }
});
