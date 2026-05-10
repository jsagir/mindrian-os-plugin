#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 89.5 Plan 05 -- end-to-end CLI smoke test for /mos:rs-explain.
 *
 * Tests the bidirectional NL-Graph CLI dispatcher at
 * scripts/rs-explain-command.cjs. The dispatcher chains:
 *
 *   user NL -> rs-nl-to-query.translate(nl) -> {cypher, sql, brain_query}
 *           -> execute against room.db (SQLite) + Aura (Cypher) + Brain
 *           -> aggregate into query_results
 *           -> rs-query-to-text.explain(query_results) -> Larry-voiced NL
 *
 * Mock injection pattern: Module._cache shim BEFORE requiring the script.
 * The script lazy-loads its libraries via _lazyLoad() so injecting mocks
 * into require.cache before main() runs guarantees the script consumes
 * the mocks. Production callers never set this; the underscore prefix
 * marks it as private to the test surface.
 *
 * Scenarios (>=4 per plan; 6 total):
 *   T1 -- Happy path: NL "Show me reverse salients in my fintech room";
 *         room.db SQLite returns 3 rows; explain() renders Larry-voiced
 *         NL referencing reverse salients with non-empty content; honors
 *         VOICE_TEMPLATES voice rules.
 *   T2 -- Mode B Brain offline: NL "What frameworks chain into RS Discovery?";
 *         brainClient.isAvailable() returns false; dispatcher gracefully
 *         renders fallback explanation; NO throw; non-empty NL.
 *   T3 -- Tier 0 Aura offline: NL "Who are experts on quantum computing?";
 *         brainClient.isAvailable returns true initially but query throws
 *         AuraUnreachableError; dispatcher catches via _cypher_degraded
 *         marker; non-empty NL render.
 *   T4 -- Canon Part 8 adversarial: NL "What's my governing thought on X?";
 *         rs-nl-to-query.translate throws ExternalEgressViolation; dispatcher
 *         catches; emits "Query rejected by Canon Part 8 audit:" message;
 *         exit code 1.
 *   T5 -- BSL 1.1 header check on all 4 command CJS scripts.
 *   T6 -- A1 sweep on rendered NL outputs from Tests 1-3; assert ZERO
 *         matches against FORBIDDEN_PATTERNS in any captured output.
 *
 * Pure CJS, zero npm deps, node built-ins only (assert + fs + path + child_process).
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

// ---------- Suite bookkeeping ----------

let passed = 0;
let failed = 0;
const failures = [];
const tests = [];

function record(name, fn) {
  tests.push({ name, fn });
}

async function runAll() {
  for (const t of tests) {
    try {
      await t.fn();
      passed++;
      process.stdout.write('PASS ' + t.name + '\n');
    } catch (err) {
      failed++;
      failures.push({ name: t.name, message: err && err.message ? err.message : String(err) });
      process.stdout.write('FAIL ' + t.name + ': ' + (err && err.message ? err.message : String(err)) + '\n');
    }
  }
}

// ---------- Reference imports ----------

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const SCRIPT_PATH = path.join(REPO_ROOT, 'scripts', 'rs-explain-command.cjs');
const COMMAND_SCRIPTS = [
  path.join(REPO_ROOT, 'scripts', 'rs-fetch-command.cjs'),
  path.join(REPO_ROOT, 'scripts', 'rs-thesis-command.cjs'),
  path.join(REPO_ROOT, 'scripts', 'rs-experts-command.cjs'),
  path.join(REPO_ROOT, 'scripts', 'rs-explain-command.cjs'),
];

const { FORBIDDEN_PATTERNS } = require('../core/rs-egress-prompts.cjs');

// ---------- Handle-shape sentinels (graph-on-graph P0 cont., 2026-05-11) ----------
//
// rs-explain-command.cjs destructures `{ conn, db }` from `openGraph()` and
// passes `conn` to `queryGraph` / `db` to `closeGraph`. If anyone reverts that
// destructure back to `const conn = await openGraph(...)` (the pre-fix bug),
// `conn` becomes the `{ conn, db }` wrapper object and the SQLite query silently
// fails. These module-local sentinels make T1's openGraph mock hand back
// distinguishable objects, and the queryGraph/closeGraph mocks assert they
// received exactly the destructured handles -- so the reversion fails the test.
const SENTINEL_CONN = { __kind: 'sentinel-conn' };
const SENTINEL_DB = { __kind: 'sentinel-db' };

// ---------- Mock injection helper ----------
//
// The dispatcher lazy-loads libraries via require() inside _lazyLoad().
// Inject mocks into require.cache BEFORE the dispatcher's main() runs
// so the cached fake modules are returned instead of the real files.

function withMockedModules(moduleMap, fn) {
  const NL_TO_QUERY_PATH = path.join(REPO_ROOT, 'lib', 'core', 'rs-nl-to-query.cjs');
  const QUERY_TO_TEXT_PATH = path.join(REPO_ROOT, 'lib', 'core', 'rs-query-to-text.cjs');
  const LAZYGRAPH_PATH = path.join(REPO_ROOT, 'lib', 'core', 'lazygraph-ops.cjs');
  const BRAIN_CLIENT_PATH = path.join(REPO_ROOT, 'lib', 'core', 'brain-client.cjs');
  const SCRIPT_REAL_PATH = path.resolve(SCRIPT_PATH);
  const PATHS = {
    'rs-nl-to-query': NL_TO_QUERY_PATH,
    'rs-query-to-text': QUERY_TO_TEXT_PATH,
    'lazygraph-ops': LAZYGRAPH_PATH,
    'brain-client': BRAIN_CLIENT_PATH,
  };
  // Save original cache entries so we can restore.
  const savedEntries = {};
  for (const key of Object.keys(PATHS)) {
    savedEntries[PATHS[key]] = require.cache[PATHS[key]];
  }
  // Save and clear the script cache so we get a fresh copy.
  const savedScriptCache = require.cache[SCRIPT_REAL_PATH];
  delete require.cache[SCRIPT_REAL_PATH];

  try {
    // Install mocks in the cache.
    for (const key of Object.keys(moduleMap)) {
      const target = PATHS[key];
      if (!target) throw new Error('Unknown mock key: ' + key);
      require.cache[target] = {
        id: target,
        filename: target,
        loaded: true,
        exports: moduleMap[key],
        children: [],
        paths: [],
      };
    }
    return fn();
  } finally {
    // Restore originals.
    for (const key of Object.keys(PATHS)) {
      const target = PATHS[key];
      if (savedEntries[target] === undefined) {
        delete require.cache[target];
      } else {
        require.cache[target] = savedEntries[target];
      }
    }
    if (savedScriptCache === undefined) {
      delete require.cache[SCRIPT_REAL_PATH];
    } else {
      require.cache[SCRIPT_REAL_PATH] = savedScriptCache;
    }
  }
}

// ---------- Output capture helper ----------

function captureCli(argv, mocks) {
  // Capture stdout + stderr + exit code while running main() in-process.
  const realWrite = process.stdout.write.bind(process.stdout);
  const realErrWrite = process.stderr.write.bind(process.stderr);
  const realExit = process.exit.bind(process);
  const realArgv = process.argv;

  const stdoutBuf = [];
  const stderrBuf = [];
  let exitCode = null;
  process.stdout.write = function (s) { stdoutBuf.push(String(s)); return true; };
  process.stderr.write = function (s) { stderrBuf.push(String(s)); return true; };
  process.exit = function (code) {
    exitCode = code == null ? 0 : code;
    throw new Error('__TEST_EXIT__:' + exitCode);
  };
  process.argv = ['node', SCRIPT_PATH].concat(argv);

  return withMockedModules(mocks, function () {
    const dispatcher = require(SCRIPT_PATH);
    return dispatcher.main()
      .catch(function (err) {
        if (err && /^__TEST_EXIT__/.test(err.message)) return; // expected
        stderrBuf.push('UNHANDLED:' + (err && err.message ? err.message : String(err)));
      })
      .then(function () {
        process.stdout.write = realWrite;
        process.stderr.write = realErrWrite;
        process.exit = realExit;
        process.argv = realArgv;
        return { stdout: stdoutBuf.join(''), stderr: stderrBuf.join(''), exitCode: exitCode };
      });
  });
}

// ---------- Captured outputs for A1 sweep (T6) ----------

const capturedOutputs = [];

// ---------- T1: Happy path NL -> NL ----------

record('T1 happy path NL -> NL via 3-graph triangulation', async function () {
  const nlToQueryMock = {
    translate: function (nl, opts) {
      // Honor SEAM A audit on benign input: return triangulated bundle.
      assert.equal(typeof nl, 'string');
      return {
        cypher: 'MATCH (rs:RSDiscovery {room_slug: $room_slug}) RETURN rs',
        sql: 'SELECT * FROM rs_discoveries WHERE room_slug = ? ORDER BY created_at DESC',
        brain_query: null,
        sql_params: ['fintech'],
        cypher_params: { room_slug: 'fintech' },
      };
    },
    ALLOW_LIST_INTENTS: [],
    ExternalEgressViolation: class extends Error {},
  };
  const queryToTextMock = {
    explain: function (query_results, opts) {
      assert.ok(query_results && Array.isArray(query_results.rows));
      // Render in the rs_discovery voice template style.
      const n = query_results.rows.length;
      return 'Found ' + n + ' reverse salients across 2 domains. The strongest is improved fraud-graph (breakthrough score 8). Filed to opportunity-bank/. Worth Bank Opportunity or Devil\'s Advocate.';
    },
    VOICE_TEMPLATES: {},
    KNOWN_KINDS: ['rs_discovery'],
  };
  const lazygraphOpsMock = {
    openGraph: async function () { return { conn: SENTINEL_CONN, db: SENTINEL_DB }; },
    closeGraph: async function (db) {
      assert.strictEqual(db, SENTINEL_DB, 'closeGraph must receive the destructured db handle');
    },
    queryGraph: async function (conn, sql, params) {
      assert.strictEqual(conn, SENTINEL_CONN, 'queryGraph must receive the destructured conn handle, not the {conn,db} wrapper');
      assert.equal(typeof sql, 'string');
      assert.ok(Array.isArray(params));
      return [
        { id: 'rs_001', thesis: 'fraud-graph mapping', breakthrough_score: 8, rs_type: 'structural_transfer' },
        { id: 'rs_002', thesis: 'KYC pattern transfer', breakthrough_score: 7, rs_type: 'semantic_implementation' },
        { id: 'rs_003', thesis: 'compliance signal', breakthrough_score: 6, rs_type: 'hybrid' },
      ];
    },
  };
  const brainClientMock = {
    isAvailable: function () { return false; },
    query: async function () { throw new Error('should not be called when brain_query null'); },
  };

  const result = await captureCli(['Show me reverse salients in my fintech room'], {
    'rs-nl-to-query': nlToQueryMock,
    'rs-query-to-text': queryToTextMock,
    'lazygraph-ops': lazygraphOpsMock,
    'brain-client': brainClientMock,
  });

  assert.equal(result.exitCode, 0, 'expected exit 0; got ' + result.exitCode + ' stderr=' + result.stderr);
  assert.ok(result.stdout.length > 0, 'stdout must be non-empty');
  assert.ok(/reverse salients/i.test(result.stdout), 'output must mention "reverse salients"');
  assert.ok(/Bank Opportunity/.test(result.stdout), 'output must include Canon Part 3 verb');

  capturedOutputs.push(result.stdout);
});

// ---------- T2: Mode B Brain offline graceful ----------

record('T2 Mode B Brain offline graceful (no throw, non-empty NL)', async function () {
  const nlToQueryMock = {
    translate: function (nl) {
      return {
        cypher: null,
        sql: null,
        brain_query: {
          cypher: 'MATCH (m:Methodology {id: $target_framework})-[:FEEDS_INTO]-(t) RETURN t.name AS name LIMIT 10',
          params: { target_framework: 'reverse_salient_engine' },
          intent_id: 'feeds_into_query',
        },
        sql_params: null,
        cypher_params: null,
      };
    },
    ALLOW_LIST_INTENTS: [],
    ExternalEgressViolation: class extends Error {},
  };
  const queryToTextMock = {
    explain: function (query_results) {
      // Mode B: brain_degraded marker present; explainer should still render coherent fallback.
      assert.equal(query_results._brain_degraded, 'brain_unreachable', 'Mode B marker expected');
      return 'Triangulated across room.db + Aura + Brain. Brain offline; methodology chain not available locally. Worth reframing? Run Methodology /mos:beautiful-question.';
    },
    VOICE_TEMPLATES: {},
    KNOWN_KINDS: ['fallback'],
  };
  const lazygraphOpsMock = {
    openGraph: async function () { return {}; },
    closeGraph: async function () {},
    queryGraph: async function () { return []; },
  };
  const brainClientMock = {
    isAvailable: function () { return false; }, // Mode B
    query: async function () { throw new Error('Brain unreachable'); },
  };

  const result = await captureCli(['What frameworks chain into RS Discovery?'], {
    'rs-nl-to-query': nlToQueryMock,
    'rs-query-to-text': queryToTextMock,
    'lazygraph-ops': lazygraphOpsMock,
    'brain-client': brainClientMock,
  });

  assert.equal(result.exitCode, 0, 'Mode B graceful must NOT exit non-zero; got ' + result.exitCode + ' stderr=' + result.stderr);
  assert.ok(result.stdout.length > 0, 'Mode B output must be non-empty');
  assert.ok(/Brain offline|Brain unreachable|reformulate|Reformulate/i.test(result.stdout), 'Mode B should reference offline state OR reformulate');
  capturedOutputs.push(result.stdout);
});

// ---------- T3: Tier 0 Aura offline graceful ----------

record('T3 Tier 0 Aura offline graceful (AuraUnreachableError caught)', async function () {
  const nlToQueryMock = {
    translate: function () {
      return {
        cypher: 'MATCH (a:Author)-[:AUTHORED_BY]->(p:Paper) WHERE p.topic = $topic RETURN a',
        sql: null,
        brain_query: null,
        sql_params: null,
        cypher_params: { topic: 'quantum computing' },
      };
    },
    ALLOW_LIST_INTENTS: [],
    ExternalEgressViolation: class extends Error {},
  };
  const queryToTextMock = {
    explain: function (query_results) {
      // Tier 0: cypher_degraded marker present.
      assert.equal(query_results._cypher_degraded, 'aura_unreachable');
      return 'Mapped 0 experts (Aura offline). Run /mos:rs-fetch first to populate the local mirror. Tier 0 explanation only.';
    },
    VOICE_TEMPLATES: {},
    KNOWN_KINDS: ['expert_network'],
  };
  const lazygraphOpsMock = {
    openGraph: async function () { return {}; },
    closeGraph: async function () {},
    queryGraph: async function () { return []; },
  };
  // Aura available on isAvailable, but query throws AuraUnreachableError.
  class AuraUnreachableError extends Error {
    constructor(msg) { super(msg); this.name = 'AuraUnreachableError'; }
  }
  const brainClientMock = {
    isAvailable: function () { return true; },
    query: async function () { throw new AuraUnreachableError('aura down'); },
  };

  const result = await captureCli(['Who are experts on quantum computing?'], {
    'rs-nl-to-query': nlToQueryMock,
    'rs-query-to-text': queryToTextMock,
    'lazygraph-ops': lazygraphOpsMock,
    'brain-client': brainClientMock,
  });

  assert.equal(result.exitCode, 0, 'Tier 0 fallback must NOT exit non-zero; got ' + result.exitCode + ' stderr=' + result.stderr);
  assert.ok(result.stdout.length > 0, 'Tier 0 output must be non-empty');
  assert.ok(/Aura offline|Tier 0|rs-fetch/i.test(result.stdout), 'Tier 0 should reference offline state');
  capturedOutputs.push(result.stdout);
});

// ---------- T4: Canon Part 8 adversarial ----------

record('T4 Canon Part 8 adversarial (ExternalEgressViolation -> exit 1)', async function () {
  class ExternalEgressViolation extends Error {
    constructor(msg, meta) { super(msg); this.name = 'ExternalEgressViolation'; this.meta = meta || {}; }
  }
  const nlToQueryMock = {
    translate: function () {
      throw new ExternalEgressViolation('forbidden field detected', { surface: 'rs-nl-to-query-input', matched_pattern: 'governing_thought' });
    },
    ALLOW_LIST_INTENTS: [],
    ExternalEgressViolation: ExternalEgressViolation,
  };
  const queryToTextMock = {
    explain: function () { throw new Error('should not be reached'); },
    VOICE_TEMPLATES: {},
    KNOWN_KINDS: [],
  };
  const lazygraphOpsMock = {
    openGraph: async function () { return {}; },
    closeGraph: async function () {},
    queryGraph: async function () { return []; },
  };
  const brainClientMock = {
    isAvailable: function () { return true; },
    query: async function () { throw new Error('should not be reached'); },
  };

  const result = await captureCli(['What is my governing thought on X?'], {
    'rs-nl-to-query': nlToQueryMock,
    'rs-query-to-text': queryToTextMock,
    'lazygraph-ops': lazygraphOpsMock,
    'brain-client': brainClientMock,
  });

  assert.equal(result.exitCode, 1, 'Canon Part 8 violation must exit 1; got ' + result.exitCode);
  assert.ok(/Canon Part 8 audit/i.test(result.stderr), 'stderr must mention Canon Part 8 audit; got: ' + result.stderr);
  assert.ok(/rs-nl-to-query-input|surface/i.test(result.stderr), 'stderr should reference the surface tag');
});

// ---------- T5: BSL 1.1 header check on all 4 command CJS scripts ----------

record('T5 BSL 1.1 headers on all 4 command CJS scripts', async function () {
  for (const f of COMMAND_SCRIPTS) {
    assert.ok(fs.existsSync(f), 'script must exist: ' + f);
    const src = fs.readFileSync(f, 'utf8');
    assert.ok(/BSL 1\.1/.test(src) || /BSL-1\.1/.test(src) || /BUSL/.test(src), 'BSL 1.1 header missing in ' + f);
  }
});

// ---------- T6: A1 sweep on rendered NL outputs ----------

record('T6 A1 sweep on rendered NL outputs (zero FORBIDDEN_PATTERNS)', async function () {
  assert.ok(capturedOutputs.length >= 3, 'expected captures from T1-T3; got ' + capturedOutputs.length);
  for (let i = 0; i < capturedOutputs.length; i += 1) {
    const out = capturedOutputs[i];
    for (const re of FORBIDDEN_PATTERNS) {
      const m = out.match(re);
      assert.equal(m, null, 'capture ' + i + ' triggered FORBIDDEN_PATTERN ' + String(re) + ' on: ' + (m ? m[0] : 'n/a'));
    }
  }
});

// ---------- Run all ----------

(async function () {
  await runAll();
  process.stdout.write('\n=== 89.5-05 rs-explain-command suite: ' + passed + '/' + tests.length + ' passed ===\n');
  if (failed > 0) {
    process.stdout.write('Failures:\n');
    for (const f of failures) process.stdout.write('  - ' + f.name + ': ' + f.message + '\n');
    process.exit(1);
  }
  process.exit(0);
})();
