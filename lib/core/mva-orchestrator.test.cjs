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

  // Forbidden tokens. Phase 239 (BRAIN-01) verdict: /mcp__brain_/ here is a
  // ZERO-REFERENCE census guard (alongside /brain_query/, MVA_SENTENCE, and
  // the raw-field destructuring tokens), not a tool-name-liveness fixture --
  // it asserts mva-orchestrator.cjs's source contains NO Brain reference in
  // any form, matching mva-detect.smoke.test.cjs's S6 sweep. Left UNCHANGED
  // rather than updated to the live mcp__(?:plugin_...)?mindrian-brain__.*
  // shape: narrowing it to one specific dead literal would weaken a
  // defense-in-depth negative-literal set into a single-string tripwire.
  // Canon Part 8: this orchestrator is deliberately Brain-free.
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
      // Plan 118-04 contract update: vercel_url is no longer null at this stage.
      // The Plan 118-03 baseline had no deploy wired; Plan 118-04 wires
      // deployDeck and writes either the deploy URL OR the file:// fallback.
      // In this test path (no VERCEL_TOKEN, no mock), it falls back locally.
      assert.ok(typeof manifest.vercel_url === 'string' && manifest.vercel_url.length > 0,
        'Plan 118-04: vercel_url is filled (real URL or file:// fallback)');
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

// -------------------- Task 3 -- skill + command static-file checks --------------------

test('orchestrator Test 8 -- skills/mva-pipeline/SKILL.md exists with required frontmatter', () => {
  const skillPath = path.resolve(__dirname, '..', '..', 'skills', 'mva-pipeline', 'SKILL.md');
  assert.ok(fs.existsSync(skillPath), `SKILL.md must exist: ${skillPath}`);
  const src = fs.readFileSync(skillPath, 'utf8');
  assert.ok(/^---/.test(src.trim()), 'must start with YAML frontmatter');
  // Required frontmatter keys (linter contract for Plan 118-06)
  assert.ok(/\bname:\s*mva-pipeline\b/.test(src), 'frontmatter must declare name: mva-pipeline');
  assert.ok(/\bdescription:/.test(src), 'frontmatter must declare description');
  assert.ok(/\binteractive_first_reward:\s*instant_brief\b/.test(src),
    'frontmatter must declare interactive_first_reward: instant_brief (Plan 118-06 linter contract)');
  // State-file hint
  assert.ok(/~\/\.mindrian\/mva\//.test(src), 'must reference the state file path');
});

test('orchestrator Test 9 -- commands/mva-brief.md exists with required frontmatter + body', () => {
  const cmdPath = path.resolve(__dirname, '..', '..', 'commands', 'mva-brief.md');
  assert.ok(fs.existsSync(cmdPath), `mva-brief.md must exist: ${cmdPath}`);
  const src = fs.readFileSync(cmdPath, 'utf8');
  assert.ok(/^---/.test(src.trim()), 'must start with YAML frontmatter');
  assert.ok(/\bname:\s*mva-brief\b/.test(src), 'frontmatter must declare name: mva-brief');
  assert.ok(/\bdescription:/.test(src), 'frontmatter must declare description');
  assert.ok(/\bargument-hint:/.test(src), 'frontmatter must declare argument-hint');
  assert.ok(/\ballowed-tools:\s*Bash\b/.test(src), 'frontmatter must declare allowed-tools: Bash');
  assert.ok(/\binteractive_first_reward:\s*instant_brief\b/.test(src),
    'frontmatter must declare interactive_first_reward: instant_brief');
  // Body must instruct invocation
  assert.ok(/scripts\/mva-run\.cjs/.test(src), 'body must reference scripts/mva-run.cjs');
  assert.ok(/Bash/i.test(src), 'body must mention Bash invocation');
});

test('orchestrator Test 10 -- both skill + command reference scripts/mva-run.cjs', () => {
  const skill = fs.readFileSync(
    path.resolve(__dirname, '..', '..', 'skills', 'mva-pipeline', 'SKILL.md'), 'utf8');
  const cmd = fs.readFileSync(
    path.resolve(__dirname, '..', '..', 'commands', 'mva-brief.md'), 'utf8');
  assert.ok(/scripts\/mva-run\.cjs/.test(skill), 'SKILL.md must reference scripts/mva-run.cjs');
  assert.ok(/scripts\/mva-run\.cjs/.test(cmd), 'mva-brief.md must reference scripts/mva-run.cjs');
});

test('orchestrator Test 11 -- SKILL.md has explicit GUIDED-voice DO-NOT section + em-dash-free', () => {
  const skill = fs.readFileSync(
    path.resolve(__dirname, '..', '..', 'skills', 'mva-pipeline', 'SKILL.md'), 'utf8');
  assert.ok(/\bWhat NOT to do\b/i.test(skill) || /\bDo NOT\b/i.test(skill),
    'SKILL.md must have explicit do-not section');
  assert.ok(/commentary/i.test(skill), 'must warn against commentary');
  assert.ok(/footer/i.test(skill), 'must warn against skipping footer');
  // Em-dash discipline
  assert.equal(skill.match(/—/), null, 'SKILL.md must have no em-dashes');

  const cmd = fs.readFileSync(
    path.resolve(__dirname, '..', '..', 'commands', 'mva-brief.md'), 'utf8');
  assert.equal(cmd.match(/—/), null, 'mva-brief.md must have no em-dashes');
});

// -------------------- Plan 118-04 -- deck + Vercel deploy integration --------------------

/**
 * withMocks-extended for Plan 118-04 -- also mocks deck-builder + vercel-deploy
 * so we can inspect what the orchestrator passes to them and what it returns
 * to the renderer.
 */
function withMocksDeck({ pending, dispatchResults, deployResult, captureBuildDeckCalls }, fn) {
  const stateP = require.resolve('./mva-state.cjs');
  const dispP = require.resolve('./mva-dispatcher.cjs');
  const agentsP = path.resolve(__dirname, '..', 'agents', 'mva', 'index.cjs');
  const deckP = require.resolve('./mva-deck-builder.cjs');
  const deployP = require.resolve('./mva-vercel-deploy.cjs');

  const calls = {
    markRunning: 0,
    markComplete: 0,
    readPending: 0,
    buildDeck: 0,
    deployDeck: 0,
    buildDeckArgs: [],
    deployDeckArgs: [],
  };

  const prevState = require.cache[stateP];
  const prevDisp = require.cache[dispP];
  const prevAgents = require.cache[agentsP];
  const prevDeck = require.cache[deckP];
  const prevDeploy = require.cache[deployP];

  require.cache[stateP] = {
    id: stateP, filename: stateP, loaded: true,
    exports: {
      readPending: () => { calls.readPending++; return pending; },
      markRunning: () => { calls.markRunning++; },
      markComplete: () => { calls.markComplete++; },
    }
  };

  require.cache[dispP] = {
    id: dispP, filename: dispP, loaded: true,
    exports: {
      dispatch: async function* () { for (const r of (dispatchResults || [])) yield r; },
      dispatchToArray: async () => (dispatchResults || []).slice(),
    }
  };

  try { fs.mkdirSync(path.dirname(agentsP), { recursive: true }); } catch (_e) {}
  require.cache[agentsP] = {
    id: agentsP, filename: agentsP, loaded: true,
    exports: { ALL_AGENTS: [] }
  };

  require.cache[deckP] = {
    id: deckP, filename: deckP, loaded: true,
    exports: {
      buildDeck: (outcome) => {
        calls.buildDeck++;
        if (captureBuildDeckCalls) calls.buildDeckArgs.push(outcome);
        return '<!DOCTYPE html><html><body>STUB-DECK</body></html>';
      },
      buildSlide: () => '<article></article>',
      DECK_PALETTE: {},
    }
  };

  require.cache[deployP] = {
    id: deployP, filename: deployP, loaded: true,
    exports: {
      deployDeck: async (html, sha8) => {
        calls.deployDeck++;
        calls.deployDeckArgs.push({ html, sha8 });
        return deployResult || { url: 'https://mos-brief-' + sha8 + '-x.vercel.app', deploy_duration_ms: 100 };
      },
      FALLBACK_DIR: path.join(os.homedir(), '.mindrian', 'mva', 'briefs'),
    }
  };

  const orchP = require.resolve('./mva-orchestrator.cjs');
  delete require.cache[orchP];

  // CRITICAL: fn is async; we must await it inside the try so caches stay
  // mocked for the entire await chain. The original Plan 118-03 withMocks
  // helper had the same bug but never tripped it because Plan 118-03's tests
  // did not lazy-require modules during await. Plan 118-04 DOES (the deck
  // builder + vercel-deploy are lazy-required inside runPipeline), so this
  // must be an async wrapper.
  return Promise.resolve()
    .then(() => fn(calls))
    .finally(() => {
      if (prevState) require.cache[stateP] = prevState; else delete require.cache[stateP];
      if (prevDisp) require.cache[dispP] = prevDisp; else delete require.cache[dispP];
      if (prevAgents) require.cache[agentsP] = prevAgents; else delete require.cache[agentsP];
      if (prevDeck) require.cache[deckP] = prevDeck; else delete require.cache[deckP];
      if (prevDeploy) require.cache[deployP] = prevDeploy; else delete require.cache[deployP];
      delete require.cache[orchP];
    });
}

test('orchestrator Test 12 (118-04) -- buildDeck + deployDeck called; outcome has deck_url; mva_brief_deployed fires', async () => {
  const tmpHome = mkTmpHome();
  const prevHome = process.env.HOME;
  process.env.HOME = tmpHome;
  try {
    const sha256 = 'c'.repeat(64);
    const dispatchResults = [
      { agent_id: 'brain_similar', status: 'ok', duration_ms: 10, payload: { summary_line: 'X' } },
      { agent_id: 'brain_cross_domain', status: 'ok', duration_ms: 20, payload: { summary_line: 'Y' } },
    ];
    await withMocksDeck({
      pending: { sentence_sha256: sha256, classifier_source: 'heuristic' },
      dispatchResults,
      deployResult: { url: 'https://mos-brief-cccccccc-foo.vercel.app', deploy_duration_ms: 120 },
    }, async (calls) => {
      const { runPipeline } = require('./mva-orchestrator.cjs');
      const outcome = await runPipeline({});

      assert.strictEqual(calls.buildDeck, 1, 'buildDeck called once');
      assert.strictEqual(calls.deployDeck, 1, 'deployDeck called once');
      assert.strictEqual(outcome.deck_url, 'https://mos-brief-cccccccc-foo.vercel.app');

      const events = readJsonl(tmpHome);
      const deployed = events.find((e) => e.event === 'mva_brief_deployed');
      assert.ok(deployed, 'mva_brief_deployed must fire');
      assert.strictEqual(deployed.vercel_subdomain_hash, sha256.slice(0, 8));
      assert.ok(typeof deployed.deploy_duration_ms === 'number');
      assert.strictEqual(deployed.status, 'ok');
    });
  } finally {
    process.env.HOME = prevHome;
    rmTmpHome(tmpHome);
  }
});

test('orchestrator Test 13 (118-04) -- fallback path: deploy returns fallback_path -> deck_url is file:// URL', async () => {
  const tmpHome = mkTmpHome();
  const prevHome = process.env.HOME;
  process.env.HOME = tmpHome;
  try {
    const sha256 = 'd'.repeat(64);
    const dispatchResults = [
      { agent_id: 'brain_similar', status: 'ok', duration_ms: 10, payload: { summary_line: 'X' } },
    ];
    const fallbackPath = path.join(tmpHome, '.mindrian', 'mva', 'briefs', 'dddddddd.html');
    await withMocksDeck({
      pending: { sentence_sha256: sha256, classifier_source: 'heuristic' },
      dispatchResults,
      deployResult: { error: 'vercel_unavailable', fallback_path: fallbackPath, deploy_duration_ms: 5 },
    }, async (calls) => {
      const { runPipeline } = require('./mva-orchestrator.cjs');
      const outcome = await runPipeline({});

      assert.strictEqual(calls.deployDeck, 1);
      assert.ok(typeof outcome.deck_url === 'string');
      assert.ok(outcome.deck_url.startsWith('file://'), 'deck_url must be file:// URL on fallback');
      assert.ok(outcome.deck_url.endsWith(fallbackPath));

      const events = readJsonl(tmpHome);
      const deployed = events.find((e) => e.event === 'mva_brief_deployed');
      assert.ok(deployed);
      assert.strictEqual(deployed.status, 'fallback');
    });
  } finally {
    process.env.HOME = prevHome;
    rmTmpHome(tmpHome);
  }
});

test('orchestrator Test 14 (118-04) -- URL line appears AFTER agent blocks BEFORE 3-option footer', async () => {
  const tmpHome = mkTmpHome();
  const prevHome = process.env.HOME;
  process.env.HOME = tmpHome;
  try {
    const sha256 = 'e'.repeat(64);
    const dispatchResults = [
      { agent_id: 'brain_similar', status: 'ok', duration_ms: 10, payload: { summary_line: 'AAAA' } },
      { agent_id: 'brain_cross_domain', status: 'ok', duration_ms: 20, payload: { summary_line: 'BBBB' } },
    ];
    await withMocksDeck({
      pending: { sentence_sha256: sha256, classifier_source: 'heuristic' },
      dispatchResults,
      deployResult: { url: 'https://mos-brief-eeeeeeee-z.vercel.app', deploy_duration_ms: 100 },
    }, async () => {
      const { runPipeline } = require('./mva-orchestrator.cjs');
      const outcome = await runPipeline({});

      // Order check: AAAA appears before URL line which appears before "What now?"
      const rendered = outcome.rendered;
      const idxAAAA = rendered.indexOf('AAAA');
      const idxUrl = rendered.indexOf('Your Feynman deck:');
      const idxFooter = rendered.indexOf('What now?');
      assert.ok(idxAAAA >= 0, 'first agent block present');
      assert.ok(idxUrl > idxAAAA, 'URL line appears AFTER agent blocks');
      assert.ok(idxFooter > idxUrl, 'footer appears AFTER URL line');
      assert.ok(rendered.includes('https://mos-brief-eeeeeeee-z.vercel.app'),
        'rendered output includes the deploy URL');
    });
  } finally {
    process.env.HOME = prevHome;
    rmTmpHome(tmpHome);
  }
});

test('orchestrator Test 15 (118-04) -- Hebrew refusal short-circuits BEFORE buildDeck/deployDeck', async () => {
  const tmpHome = mkTmpHome();
  const prevHome = process.env.HOME;
  process.env.HOME = tmpHome;
  try {
    await withMocksDeck({
      pending: { sentence_sha256: SHA256_SAMPLE, hebrew_refusal: true, locale: 'he' },
      dispatchResults: [],
      deployResult: { url: 'should-not-be-called' },
    }, async (calls) => {
      const { runPipeline } = require('./mva-orchestrator.cjs');
      const outcome = await runPipeline({});

      assert.strictEqual(calls.buildDeck, 0, 'buildDeck must NOT be called on Hebrew');
      assert.strictEqual(calls.deployDeck, 0, 'deployDeck must NOT be called on Hebrew');
      assert.ok(/Hebrew/.test(outcome.rendered) || /[֐-׿]/.test(outcome.rendered),
        'Hebrew refusal rendered');
      // state.json manifest still must NOT be written
      const manifest = readStateJson(tmpHome);
      assert.strictEqual(manifest, null, 'state.json must NOT exist on Hebrew refusal');
    });
  } finally {
    process.env.HOME = prevHome;
    rmTmpHome(tmpHome);
  }
});

test('orchestrator Test 16 (118-04) -- side-file ~/.mindrian/mva/briefs/<sha8>.json written for Plan 118-05', async () => {
  const tmpHome = mkTmpHome();
  const prevHome = process.env.HOME;
  process.env.HOME = tmpHome;
  try {
    const sha256 = 'f'.repeat(64);
    const sha8 = sha256.slice(0, 8);
    const dispatchResults = [
      { agent_id: 'brain_similar', status: 'ok', duration_ms: 10, payload: { summary_line: 'X' } },
      { agent_id: 'brain_cross_domain', status: 'ok', duration_ms: 20, payload: { summary_line: 'Y' } },
    ];
    await withMocksDeck({
      pending: { sentence_sha256: sha256, classifier_source: 'heuristic' },
      dispatchResults,
      deployResult: { url: 'https://mos-brief-ffffffff-q.vercel.app', deploy_duration_ms: 110 },
    }, async () => {
      const { runPipeline } = require('./mva-orchestrator.cjs');
      await runPipeline({});

      const sideFile = path.join(tmpHome, '.mindrian', 'mva', 'briefs', sha8 + '.json');
      assert.ok(fs.existsSync(sideFile), 'side-file must exist at ' + sideFile);
      const data = JSON.parse(fs.readFileSync(sideFile, 'utf8'));
      assert.strictEqual(data.sha256, sha256);
      assert.strictEqual(data.sha8, sha8);
      assert.ok(typeof data.timestamp === 'string');
      assert.ok(Array.isArray(data.results));
      assert.strictEqual(data.results.length, 2);
    });
  } finally {
    process.env.HOME = prevHome;
    rmTmpHome(tmpHome);
  }
});

test('orchestrator Test 17 (118-04) -- end-to-end wall-clock < 1500ms with mocked deploy', async () => {
  const tmpHome = mkTmpHome();
  const prevHome = process.env.HOME;
  process.env.HOME = tmpHome;
  try {
    const dispatchResults = Array.from({ length: 6 }, (_, i) => ({
      agent_id: 'agent_' + i,
      status: 'ok',
      duration_ms: 50,
      payload: { summary_line: 'result ' + i },
    }));
    await withMocksDeck({
      pending: { sentence_sha256: SHA256_SAMPLE, classifier_source: 'heuristic' },
      dispatchResults,
      deployResult: { url: 'https://mos-brief-aaaaaaaa-z.vercel.app', deploy_duration_ms: 200 },
    }, async () => {
      const { runPipeline } = require('./mva-orchestrator.cjs');
      const t0 = Date.now();
      const outcome = await runPipeline({});
      const wall = Date.now() - t0;

      assert.strictEqual(outcome.results.length, 6);
      assert.ok(outcome.deck_url);
      assert.ok(wall < 1500, 'wall-clock ' + wall + 'ms must be < 1500ms');
    });
  } finally {
    process.env.HOME = prevHome;
    rmTmpHome(tmpHome);
  }
});

test('orchestrator Test 18 (118-04) -- deploy exception does NOT fail the pipeline', async () => {
  const tmpHome = mkTmpHome();
  const prevHome = process.env.HOME;
  process.env.HOME = tmpHome;
  try {
    const sha256 = '1'.repeat(64);
    const dispatchResults = [
      { agent_id: 'brain_similar', status: 'ok', duration_ms: 10, payload: { summary_line: 'X' } },
    ];

    // Mock deployDeck to throw -- the orchestrator's try/catch must absorb it.
    const stateP = require.resolve('./mva-state.cjs');
    const dispP = require.resolve('./mva-dispatcher.cjs');
    const deckP = require.resolve('./mva-deck-builder.cjs');
    const deployP = require.resolve('./mva-vercel-deploy.cjs');

    const prevState = require.cache[stateP];
    const prevDisp = require.cache[dispP];
    const prevDeck = require.cache[deckP];
    const prevDeploy = require.cache[deployP];

    require.cache[stateP] = {
      id: stateP, filename: stateP, loaded: true,
      exports: {
        readPending: () => ({ sentence_sha256: sha256 }),
        markRunning: () => {},
        markComplete: () => {},
      }
    };
    require.cache[dispP] = {
      id: dispP, filename: dispP, loaded: true,
      exports: {
        dispatch: async function* () { for (const r of dispatchResults) yield r; },
        dispatchToArray: async () => dispatchResults,
      }
    };
    require.cache[deckP] = {
      id: deckP, filename: deckP, loaded: true,
      exports: {
        buildDeck: () => '<html></html>',
        buildSlide: () => '',
        DECK_PALETTE: {},
      }
    };
    require.cache[deployP] = {
      id: deployP, filename: deployP, loaded: true,
      exports: {
        deployDeck: async () => { throw new Error('explosive failure'); },
        FALLBACK_DIR: '',
      }
    };

    const orchP = require.resolve('./mva-orchestrator.cjs');
    delete require.cache[orchP];

    try {
      const { runPipeline } = require('./mva-orchestrator.cjs');
      // Should NOT throw
      const outcome = await runPipeline({});
      assert.ok(outcome, 'pipeline returned outcome even after deploy explosion');
      assert.ok(outcome.rendered.includes('What now?'), 'footer still rendered');
      // mva_brief_deployed should have fired with status: 'error'
      const events = readJsonl(tmpHome);
      const deployed = events.find((e) => e.event === 'mva_brief_deployed');
      assert.ok(deployed, 'mva_brief_deployed event still fires on exception');
      assert.strictEqual(deployed.status, 'error');
      assert.ok(typeof deployed.error_short === 'string');
    } finally {
      if (prevState) require.cache[stateP] = prevState; else delete require.cache[stateP];
      if (prevDisp) require.cache[dispP] = prevDisp; else delete require.cache[dispP];
      if (prevDeck) require.cache[deckP] = prevDeck; else delete require.cache[deckP];
      if (prevDeploy) require.cache[deployP] = prevDeploy; else delete require.cache[deployP];
      delete require.cache[orchP];
    }
  } finally {
    process.env.HOME = prevHome;
    rmTmpHome(tmpHome);
  }
});

test('orchestrator Test 19 (118-04) -- all-fail path skips deploy (no deck URL needed for sharp-question)', async () => {
  const tmpHome = mkTmpHome();
  const prevHome = process.env.HOME;
  process.env.HOME = tmpHome;
  try {
    const dispatchResults = Array.from({ length: 6 }, (_, i) => ({
      agent_id: 'agent_' + i, status: 'error', duration_ms: 10, error: 'fail',
    }));
    await withMocksDeck({
      pending: { sentence_sha256: SHA256_SAMPLE, classifier_source: 'heuristic' },
      dispatchResults,
      deployResult: { url: 'should-not-be-called' },
    }, async (calls) => {
      const { runPipeline } = require('./mva-orchestrator.cjs');
      const outcome = await runPipeline({});

      assert.strictEqual(calls.buildDeck, 0, 'buildDeck must NOT be called on all-fail');
      assert.strictEqual(calls.deployDeck, 0, 'deployDeck must NOT be called on all-fail');
      assert.ok(outcome.rendered.includes("didn't find precedents"), 'sharp-question rendered');
      assert.strictEqual(outcome.deck_url, null, 'deck_url is null on all-fail');
    });
  } finally {
    process.env.HOME = prevHome;
    rmTmpHome(tmpHome);
  }
});

test('orchestrator Test 20 (118-04) -- state.json vercel_url updated after successful deploy', async () => {
  const tmpHome = mkTmpHome();
  const prevHome = process.env.HOME;
  process.env.HOME = tmpHome;
  try {
    const sha256 = '2'.repeat(64);
    const dispatchResults = [
      { agent_id: 'brain_similar', status: 'ok', duration_ms: 10, payload: { summary_line: 'X' } },
    ];
    const url = 'https://mos-brief-22222222-mock.vercel.app';
    await withMocksDeck({
      pending: { sentence_sha256: sha256, classifier_source: 'heuristic' },
      dispatchResults,
      deployResult: { url, deploy_duration_ms: 100 },
    }, async () => {
      const { runPipeline } = require('./mva-orchestrator.cjs');
      await runPipeline({});

      const manifest = readStateJson(tmpHome);
      assert.ok(manifest, 'state.json must exist after deploy');
      assert.strictEqual(manifest.current_sha8, sha256.slice(0, 8));
      assert.strictEqual(manifest.vercel_url, url, 'state.json vercel_url MUST be the real URL');
    });
  } finally {
    process.env.HOME = prevHome;
    rmTmpHome(tmpHome);
  }
});
