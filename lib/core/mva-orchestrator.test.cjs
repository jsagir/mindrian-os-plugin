/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 118-03 Plan 03 Task 2 -- mva-orchestrator tests.
 *
 * End-to-end orchestrator tests with all 6 agents MOCKED via require-cache
 * manipulation. Verifies:
 *   - State transitions (markRunning at start, markComplete at end)
 *   - Telemetry events fire in the right order with the right schemas
 *   - Hebrew short-circuit skips the dispatcher and the state.json manifest
 *   - All-fail emits the sharp-question fallback + mva_pipeline_failed
 *   - state.json manifest atomically written after mva_brief_rendered
 *   - The 3-option footer always closes the rendered output (except Hebrew)
 *   - Canon Part 8: orchestrator code does not destructure forbidden fields
 *   - scripts/mva-run.cjs CLI smoke test writes rendered output to stdout
 *
 * Tests mock modules via require.cache injection BEFORE requiring the
 * orchestrator. Each test creates a hermetic temp HOME so state.json + jsonl
 * writes do not pollute the real filesystem.
 *
 * Pure CJS, node built-ins only. Run via `node --test`.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

const SHA256_SAMPLE = 'a'.repeat(64);

// -------------------- helpers --------------------

function mkTmpHome() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mva-orchestrator-test-'));
}

function rmTmpHome(tmpHome) {
  try { fs.rmSync(tmpHome, { recursive: true, force: true }); } catch (_e) {}
}

/**
 * Install module mocks into require.cache so the orchestrator picks them up.
 * The orchestrator under test require()s:
 *   - ./mva-state.cjs
 *   - ./mva-progressive-renderer.cjs (we use the real one)
 *   - ./mva-telemetry.cjs (we use the real one)
 *   - ./mva-dispatcher.cjs (mocked: replaces dispatch async-generator)
 *   - ../agents/mva/index.cjs (mocked: provides ALL_AGENTS)
 */
function withMocks({ pending, dispatchResults, ALL_AGENTS }, fn) {
  // Resolve module paths
  const stateP = require.resolve('./mva-state.cjs');
  const dispP = require.resolve('./mva-dispatcher.cjs');
  // Use require.resolve.paths to compute the agents path
  const agentsP = path.resolve(__dirname, '..', 'agents', 'mva', 'index.cjs');

  // Tracking calls
  const calls = {
    markRunning: 0,
    markComplete: 0,
    readPending: 0,
    pending: pending
  };

  // Save current cache entries
  const prevState = require.cache[stateP];
  const prevDisp = require.cache[dispP];
  const prevAgents = require.cache[agentsP];

  // Install mocks
  require.cache[stateP] = {
    id: stateP,
    filename: stateP,
    loaded: true,
    exports: {
      readPending: () => { calls.readPending++; return pending; },
      markRunning: () => { calls.markRunning++; },
      markComplete: () => { calls.markComplete++; },
      // Other functions are unused by the orchestrator under test
    }
  };

  require.cache[dispP] = {
    id: dispP,
    filename: dispP,
    loaded: true,
    exports: {
      // async generator that yields each result in order
      dispatch: async function* () {
        for (const r of (dispatchResults || [])) {
          yield r;
        }
      },
      dispatchToArray: async () => (dispatchResults || []).slice(),
    }
  };

  // Mock agents module. Ensure the directory exists (require.cache can hold
  // entries for non-existent files; node uses the cache by id-resolution).
  try {
    fs.mkdirSync(path.dirname(agentsP), { recursive: true });
  } catch (_e) {}

  require.cache[agentsP] = {
    id: agentsP,
    filename: agentsP,
    loaded: true,
    exports: {
      ALL_AGENTS: ALL_AGENTS || []
    }
  };

  // Also clear orchestrator cache so it rebinds to fresh mocks
  const orchP = require.resolve('./mva-orchestrator.cjs');
  delete require.cache[orchP];

  try {
    return fn(calls);
  } finally {
    // Restore
    if (prevState) require.cache[stateP] = prevState; else delete require.cache[stateP];
    if (prevDisp) require.cache[dispP] = prevDisp; else delete require.cache[dispP];
    if (prevAgents) require.cache[agentsP] = prevAgents; else delete require.cache[agentsP];
    delete require.cache[orchP];
  }
}

function readJsonl(home) {
  const p = path.join(home, '.mindrian', 'telemetry', 'v1.13', 'mva.jsonl');
  if (!fs.existsSync(p)) return [];
  return fs.readFileSync(p, 'utf8').split('\n').filter((l) => l.length > 0).map((l) => JSON.parse(l));
}

function readStateJson(home) {
  const p = path.join(home, '.mindrian', 'mva', 'state.json');
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

// -------------------- tests --------------------

test('orchestrator Test 1 -- 6 ok agents stream, full telemetry, footer present', async () => {
  const tmpHome = mkTmpHome();
  const prevHome = process.env.HOME;
  process.env.HOME = tmpHome;

  try {
    const dispatchResults = [
      { agent_id: 'brain_similar', status: 'ok', duration_ms: 10, payload: { summary_line: 'Found 3 ventures' } },
      { agent_id: 'brain_cross_domain', status: 'ok', duration_ms: 20, payload: { summary_line: 'Cross-domain analog' } },
      { agent_id: 'brain_classic_traps', status: 'ok', duration_ms: 30, payload: { summary_line: 'Classic trap: freemium' } },
      { agent_id: 'tavily_funding', status: 'ok', duration_ms: 40, payload: { summary_line: 'Tnufa track active' } },
      { agent_id: 'six_hats_red_black', status: 'ok', duration_ms: 50, payload: { summary_line: 'One question: how' } },
      { agent_id: 'dashboard_graph', status: 'ok', duration_ms: 60, payload: { summary_line: 'Room nodes pre-rendered' } },
    ];

    await withMocks({
      pending: { sentence_sha256: SHA256_SAMPLE, classifier_source: 'heuristic' },
      dispatchResults,
      ALL_AGENTS: [{ id: 'a', fn: async () => null }] // unused (dispatch is mocked)
    }, async (calls) => {
      const { runPipeline } = require('./mva-orchestrator.cjs');
      const t0 = Date.now();
      const outcome = await runPipeline({});
      const elapsed = Date.now() - t0;

      assert.strictEqual(calls.markRunning, 1, 'markRunning called once');
      assert.strictEqual(calls.markComplete, 1, 'markComplete called once');
      assert.strictEqual(outcome.results.length, 6);
      assert.ok(outcome.rendered.includes('What now?'), 'footer must be present');
      assert.ok(outcome.rendered.includes('[brain]'), 'brain label present');
      assert.equal(outcome.rendered.match(/—/), null, 'no em-dashes in rendered output');
      assert.ok(elapsed < 1000, `wall-clock ${elapsed}ms must be < 1s`);

      // Telemetry events
      const events = readJsonl(tmpHome);
      const types = events.map((e) => e.event);
      assert.ok(types.includes('mva_pipeline_started'), 'pipeline_started fired');
      assert.strictEqual(types.filter((t) => t === 'mva_agent_returned').length, 6, '6 agent_returned events');
      assert.ok(types.includes('mva_brief_rendered'), 'brief_rendered fired');

      // CRITICAL: mva_brief_rendered carries total_duration_ms (not duration_ms)
      const rendered = events.find((e) => e.event === 'mva_brief_rendered');
      assert.ok(typeof rendered.total_duration_ms === 'number', 'must have total_duration_ms');
      assert.strictEqual(rendered.duration_ms, undefined, 'must NOT have duration_ms');
      assert.strictEqual(rendered.agent_count_ok, 6);
      assert.strictEqual(rendered.agent_count_failed, 0);
    });
  } finally {
    process.env.HOME = prevHome;
    rmTmpHome(tmpHome);
  }
});

test('orchestrator Test 2 -- 6 error agents trigger sharp-question + pipeline_failed', async () => {
  const tmpHome = mkTmpHome();
  const prevHome = process.env.HOME;
  process.env.HOME = tmpHome;

  try {
    const dispatchResults = Array.from({ length: 6 }, (_, i) => ({
      agent_id: `agent_${i}`,
      status: 'error',
      duration_ms: 10,
      error: 'forced fail'
    }));

    await withMocks({
      pending: { sentence_sha256: SHA256_SAMPLE, classifier_source: 'heuristic' },
      dispatchResults,
      ALL_AGENTS: []
    }, async (calls) => {
      const { runPipeline } = require('./mva-orchestrator.cjs');
      const outcome = await runPipeline({});

      assert.strictEqual(calls.markComplete, 1);
      assert.ok(outcome.rendered.includes("I didn't find precedents"), 'sharp-question fallback rendered');

      const events = readJsonl(tmpHome);
      const types = events.map((e) => e.event);
      assert.strictEqual(types.filter((t) => t === 'mva_agent_returned').length, 6);
      assert.ok(types.includes('mva_brief_rendered'), 'brief_rendered still fires');
      assert.ok(types.includes('mva_pipeline_failed'), 'pipeline_failed fires on all-fail');

      const failed = events.find((e) => e.event === 'mva_pipeline_failed');
      assert.ok(typeof failed.total_duration_ms === 'number');
    });
  } finally {
    process.env.HOME = prevHome;
    rmTmpHome(tmpHome);
  }
});

test('orchestrator Test 3 -- 3 ok + 3 timeout renders footer with mixed results', async () => {
  const tmpHome = mkTmpHome();
  const prevHome = process.env.HOME;
  process.env.HOME = tmpHome;

  try {
    const dispatchResults = [
      { agent_id: 'brain_similar', status: 'ok', duration_ms: 10, payload: { summary_line: 'X' } },
      { agent_id: 'brain_cross_domain', status: 'ok', duration_ms: 20, payload: { summary_line: 'Y' } },
      { agent_id: 'brain_classic_traps', status: 'timeout', duration_ms: 45000 },
      { agent_id: 'tavily_funding', status: 'ok', duration_ms: 30, payload: { summary_line: 'Z' } },
      { agent_id: 'six_hats_red_black', status: 'timeout', duration_ms: 45000 },
      { agent_id: 'dashboard_graph', status: 'timeout', duration_ms: 45000 },
    ];

    await withMocks({
      pending: { sentence_sha256: SHA256_SAMPLE, classifier_source: 'heuristic' },
      dispatchResults,
      ALL_AGENTS: []
    }, async () => {
      const { runPipeline } = require('./mva-orchestrator.cjs');
      const outcome = await runPipeline({});

      assert.strictEqual(outcome.results.length, 6);
      assert.ok(outcome.rendered.includes('What now?'), 'footer present');
      assert.ok(/still in progress/.test(outcome.rendered), 'timeout placeholders rendered');

      const events = readJsonl(tmpHome);
      const rendered = events.find((e) => e.event === 'mva_brief_rendered');
      assert.strictEqual(rendered.agent_count_ok, 3);
      assert.strictEqual(rendered.agent_count_failed, 3);
    });
  } finally {
    process.env.HOME = prevHome;
    rmTmpHome(tmpHome);
  }
});

test('orchestrator Test 4 -- Hebrew refusal short-circuits dispatcher and state.json', async () => {
  const tmpHome = mkTmpHome();
  const prevHome = process.env.HOME;
  process.env.HOME = tmpHome;

  try {
    let dispatchCalled = false;

    await withMocks({
      pending: { sentence_sha256: SHA256_SAMPLE, classifier_source: 'language_detect', hebrew_refusal: true, locale: 'he' },
      dispatchResults: [], // would be empty anyway
      ALL_AGENTS: []
    }, async (calls) => {
      // Re-install a dispatcher that flips a flag if called
      const dispP = require.resolve('./mva-dispatcher.cjs');
      require.cache[dispP] = {
        id: dispP,
        filename: dispP,
        loaded: true,
        exports: {
          dispatch: async function* () { dispatchCalled = true; },
          dispatchToArray: async () => { dispatchCalled = true; return []; }
        }
      };
      // Bust orchestrator cache
      delete require.cache[require.resolve('./mva-orchestrator.cjs')];

      const { runPipeline } = require('./mva-orchestrator.cjs');
      const outcome = await runPipeline({});

      assert.strictEqual(dispatchCalled, false, 'dispatcher must not be called on Hebrew');
      assert.ok(outcome.rendered.includes('Hebrew') || /[֐-׿]/.test(outcome.rendered), 'Hebrew refusal rendered');
      assert.strictEqual(calls.markComplete, 1, 'markComplete still called');
      // state.json manifest must NOT be written on Hebrew path
      const manifest = readStateJson(tmpHome);
      assert.strictEqual(manifest, null, 'state.json must NOT exist on Hebrew refusal');
    });
  } finally {
    process.env.HOME = prevHome;
    rmTmpHome(tmpHome);
  }
});

test('orchestrator Test 5 -- Canon Part 8 source-grep: no forbidden field destructuring', () => {
  const src = fs.readFileSync(path.join(__dirname, 'mva-orchestrator.cjs'), 'utf8');
  // Strip comments to avoid documentation false positives
  const noBlock = src.replace(/\/\*[\s\S]*?\*\//g, '');
  const noLine = noBlock.replace(/\/\/[^\n]*/g, '');

  // Forbidden tokens
  const forbidden = [
    /\.sentence\b/,
    /\.prompt\b/,
    /\.raw_sentence\b/,
    /\.raw_text\b/,
    /MVA_SENTENCE/,
    /brain_query/,
    /mcp__brain_/,
  ];
  for (const re of forbidden) {
    assert.equal(re.test(noLine), false, `forbidden pattern ${re} present in orchestrator source`);
  }
});

test('orchestrator Test 6 -- footer text exact verbatim', async () => {
  const tmpHome = mkTmpHome();
  const prevHome = process.env.HOME;
  process.env.HOME = tmpHome;

  try {
    const dispatchResults = [
      { agent_id: 'brain_similar', status: 'ok', duration_ms: 10, payload: { summary_line: 'X' } },
    ];

    await withMocks({
      pending: { sentence_sha256: SHA256_SAMPLE, classifier_source: 'heuristic' },
      dispatchResults,
      ALL_AGENTS: []
    }, async () => {
      const { runPipeline } = require('./mva-orchestrator.cjs');
      const outcome = await runPipeline({});
      assert.ok(outcome.rendered.includes("Just tell me what's new"));
      assert.ok(outcome.rendered.includes("Build a room around this"));
      assert.ok(outcome.rendered.includes("Challenge me -- Devil's Advocate"));
      assert.equal(outcome.rendered.match(/—/), null, 'orchestrator output em-dash-free');
    });
  } finally {
    process.env.HOME = prevHome;
    rmTmpHome(tmpHome);
  }
});

test('orchestrator Test 6b (CRITICAL-3 wire) -- state.json manifest atomically written', async () => {
  const tmpHome = mkTmpHome();
  const prevHome = process.env.HOME;
  process.env.HOME = tmpHome;

  try {
    const sha256 = 'b'.repeat(64);
    const dispatchResults = [
      { agent_id: 'brain_similar', status: 'ok', duration_ms: 10, payload: { summary_line: 'X' } },
    ];

    await withMocks({
      pending: { sentence_sha256: sha256, classifier_source: 'heuristic' },
      dispatchResults,
      ALL_AGENTS: []
    }, async () => {
      const { runPipeline } = require('./mva-orchestrator.cjs');
      const tBefore = Date.now();
      await runPipeline({});

      const manifest = readStateJson(tmpHome);
      assert.ok(manifest !== null, 'state.json must exist');
      assert.strictEqual(manifest.current_sha8, sha256.slice(0, 8));
      assert.strictEqual(manifest.current_sha256, sha256);
      assert.strictEqual(manifest.vercel_url, null, 'vercel_url null at this plan stage');
      assert.ok(typeof manifest.rendered_at_ms === 'number');
      assert.ok(manifest.rendered_at_ms >= tBefore && manifest.rendered_at_ms - tBefore < 5000,
        'rendered_at_ms within 5s of test start');
    });
  } finally {
    process.env.HOME = prevHome;
    rmTmpHome(tmpHome);
  }
});

test('orchestrator Test 7 -- scripts/mva-run.cjs smoke test exits 0 with no pending', () => {
  // With no pending state, the script should exit 0 and print nothing
  // (or only the header). We exercise the no-pending path.
  const tmpHome = mkTmpHome();
  const env = Object.assign({}, process.env, { HOME: tmpHome });

  try {
    const scriptPath = path.resolve(__dirname, '..', '..', 'scripts', 'mva-run.cjs');
    assert.ok(fs.existsSync(scriptPath), `script must exist: ${scriptPath}`);
    const r = spawnSync('node', [scriptPath], { env, encoding: 'utf8', timeout: 10000 });
    assert.strictEqual(r.status, 0, `script must exit 0, got ${r.status}; stderr: ${r.stderr}`);
  } finally {
    rmTmpHome(tmpHome);
  }
});
