#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 89.1 Plan 01 -- brain-client shape adapter fixture suite.
 *
 * Resolves the deferred item from 89.1a (deferred-items.md item 1):
 * brain-client.search returns {result:{hits:[]}} on the live MCP wire,
 * but pullFromBrain expected {matches:[]}. Plan 01 introduces an
 * adaptBrainSearchResponse pure function inside rs-brain-substrate.cjs
 * that translates the live shape into the legacy match[] shape (with
 * score-bearing entries since Pinecone searchRecords does not return
 * embedding vectors today; see mcp-server-brain/lib/pinecone-tools.cjs
 * line 47).
 *
 * Suite scope:
 *   Tests 1-9 (Task 1):  shape adapter inside pullFromBrain. Mocks
 *                        brain-client.search via require.cache to
 *                        return the LIVE shape; asserts pullFromBrain
 *                        emits {ok:true, matches:[{id, score, metadata}]}
 *                        with framework -> framework_name rename.
 *   Tests 10-14 (Task 2): validator Check E embedding-or-score
 *                        relaxation. Plants caches with score-only,
 *                        score-out-of-range, neither, embedding-only,
 *                        and forbidden-regex-laden metadata; asserts
 *                        the validator emits the expected severity +
 *                        violation category.
 *
 * Mocks brain-client via require.cache override (89.1a-03 pattern,
 * resetRequireCache after each scenario). Each test calls runShape
 * with (scenarioName, mockSearchReturns, expectedAssertion).
 *
 * Pure CJS, zero npm deps, node built-ins only.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// ---------- Tmpdir cleanup ----------

const ALL_TMP_ROOTS = [];
process.on('exit', function () {
  for (const d of ALL_TMP_ROOTS) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  }
});

// ---------- Brain-client mock helpers (89.1a-03 pattern, byte-identical) ----------

function installMockBrainClient(opts) {
  opts = opts || {};
  const audit = {
    isAvailable_calls: 0,
    query_calls: [],
    search_calls: [],
    smartSearch_calls: [],
  };
  const brainClientPath = require.resolve('../core/brain-client.cjs');
  const realClient = require('../core/brain-client.cjs');
  const fakeExports = {
    isAvailable: function () {
      audit.isAvailable_calls += 1;
      if (typeof opts.isAvailable === 'function') return opts.isAvailable(audit.isAvailable_calls);
      return opts.isAvailable === undefined ? true : !!opts.isAvailable;
    },
    query: async function (cypher) {
      audit.query_calls.push({ cypher: cypher });
      if (typeof opts.query === 'function') return opts.query(cypher);
      return { records: [] };
    },
    search: async function (q, o) {
      audit.search_calls.push({ query: q, options: o });
      if (typeof opts.search === 'function') return opts.search(q, o);
      return { result: { hits: [] } };
    },
    smartSearch: async function (q, o) {
      audit.smartSearch_calls.push({ query: q, options: o });
      return null;
    },
    _test: realClient._test,
  };
  require.cache[brainClientPath] = {
    id: brainClientPath,
    filename: brainClientPath,
    loaded: true,
    exports: fakeExports,
  };
  return audit;
}

function resetRequireCache() {
  const targets = [
    '../core/brain-client.cjs',
    '../core/rs-brain-substrate.cjs',
    '../core/rs-brain-substrate-prompts.cjs',
    '../core/cross-room-aggregator.cjs',
    './validators/brain-substrate-invariants.cjs',
  ];
  for (const t of targets) {
    try {
      const p = require.resolve(t);
      delete require.cache[p];
    } catch (_e) { /* best effort */ }
  }
}

// ---------- Scenario bookkeeping ----------

let passed = 0;
let failed = 0;
const failures = [];

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

function makeRoomDir(label) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'rs01-' + label + '-'));
  ALL_TMP_ROOTS.push(d);
  return d;
}

function plantCache(roomDir, payload) {
  fs.mkdirSync(path.join(roomDir, '.mindrian'), { recursive: true });
  const cp = path.join(roomDir, '.mindrian', 'brain-substrate-cache.json');
  fs.writeFileSync(cp, JSON.stringify(payload));
  return cp;
}

// ---------- Main ----------

async function main() {
  process.stdout.write('\n=== Phase 89.1 Plan 01: brain-client shape adapter fixture suite ===\n\n');

  // ============================================================
  // Task 1 Tests 1-9: shape adapter inside pullFromBrain
  // ============================================================

  await runScenario("Test 1: live shape {result:{hits:[]}} translates to {ok:true, matches:[{id,score,metadata}]}", async () => {
    const audit = installMockBrainClient({
      isAvailable: true,
      search: async () => ({
        result: {
          hits: [{
            _id: 'mindrian-knowledge_t2-trending-absurd_2cddc6ac2cf58ea0',
            _score: 0.8089869022369385,
            fields: {
              framework: 'reverse-salient',
              title: 'Reverse Salient',
              content_hash: 'abc123',
              text: 'Reverse salient is a Hughes 1983 framework concept',
              tier: 'core',
              source_file: 'frameworks/rs.md',
            },
          }],
        },
        usage: { read_units: 5 },
      }),
    });
    const roomDir = makeRoomDir('t01');
    const m = require('../core/rs-brain-substrate.cjs');
    const result = await m._test.pullFromBrain(roomDir, { namespace: 'tools', limit: 5 });
    assert.equal(result.ok, true, 'Expected ok:true on live shape, got: ' + JSON.stringify(result));
    assert.ok(Array.isArray(result.matches), 'Expected matches array');
    assert.equal(result.matches.length, 1, 'Expected exactly 1 match');
    const m0 = result.matches[0];
    assert.equal(m0.id, 'mindrian-knowledge_t2-trending-absurd_2cddc6ac2cf58ea0',
      'id should map from hit._id, got: ' + m0.id);
    assert.ok(typeof m0.score === 'number' && m0.score > 0.8 && m0.score < 0.81,
      'score should map from hit._score, got: ' + m0.score);
    assert.ok(m0.metadata && typeof m0.metadata === 'object', 'metadata must be object');
    assert.equal(m0.metadata.framework_name, 'reverse-salient',
      'fields.framework should rename to metadata.framework_name, got: ' + m0.metadata.framework_name);
    assert.equal(m0.metadata.title, 'Reverse Salient',
      'fields.title should pass through, got: ' + m0.metadata.title);
    assert.equal(m0.metadata.tier, 'core', 'fields.tier should pass through');
    assert.equal(audit.search_calls.length, 1, 'Exactly one outbound search expected');
  });

  await runScenario("Test 2: empty hits array returns {ok:true, matches:[]} (NOT malformed_response)", async () => {
    installMockBrainClient({
      isAvailable: true,
      search: async () => ({ result: { hits: [] }, usage: {} }),
    });
    const roomDir = makeRoomDir('t02');
    const m = require('../core/rs-brain-substrate.cjs');
    const result = await m._test.pullFromBrain(roomDir, { namespace: 'tools' });
    assert.equal(result.ok, true,
      'Empty hits is a valid response (not malformed). Got: ' + JSON.stringify(result));
    assert.ok(Array.isArray(result.matches), 'Expected matches[] array');
    assert.equal(result.matches.length, 0, 'Expected zero matches on empty hits');
  });

  await runScenario("Test 3: legacy shape {matches:[{id,values,metadata}]} STILL works (back-compat)", async () => {
    installMockBrainClient({
      isAvailable: true,
      search: async () => ({
        matches: [{
          id: 'six_thinking_hats',
          values: new Array(1024).fill(0.5),
          metadata: {
            framework_name: 'Six Thinking Hats',
            phase_id: 'phase_2',
            problem_type: 'idp',
            domain: 'innovation',
          },
        }],
      }),
    });
    const roomDir = makeRoomDir('t03');
    const m = require('../core/rs-brain-substrate.cjs');
    const result = await m._test.pullFromBrain(roomDir, { namespace: 'tools' });
    assert.equal(result.ok, true, 'Legacy shape must still pass through');
    assert.equal(result.matches.length, 1, 'Expected 1 match');
    assert.equal(result.matches[0].id, 'six_thinking_hats',
      '89.1a-03 fixture id preserved');
    // Legacy mock entries carry values not score; either property is acceptable
    // post-adapter as long as the entry round-trips (back-compat for 89.1a-03).
  });

  await runScenario("Test 4: missing result key returns {ok:false, reason:'malformed_response'}", async () => {
    installMockBrainClient({
      isAvailable: true,
      search: async () => ({ unexpected: 'shape' }),
    });
    const roomDir = makeRoomDir('t04');
    const m = require('../core/rs-brain-substrate.cjs');
    const result = await m._test.pullFromBrain(roomDir, { namespace: 'tools' });
    assert.equal(result.ok, false, 'Unknown shape must return ok:false');
    assert.equal(result.reason, 'malformed_response',
      'Expected reason malformed_response, got: ' + result.reason);
  });

  await runScenario("Test 5: hit missing fields returns metadata:{} (defensive map; never throws)", async () => {
    installMockBrainClient({
      isAvailable: true,
      search: async () => ({
        result: {
          hits: [{ _id: 'sparse-hit', _score: 0.5 }],  // no fields
        },
      }),
    });
    const roomDir = makeRoomDir('t05');
    const m = require('../core/rs-brain-substrate.cjs');
    const result = await m._test.pullFromBrain(roomDir, { namespace: 'tools' });
    assert.equal(result.ok, true, 'Sparse hit should still translate cleanly');
    assert.equal(result.matches.length, 1, 'Expected 1 match');
    assert.equal(result.matches[0].id, 'sparse-hit', 'id mapped from _id');
    assert.equal(result.matches[0].score, 0.5, 'score mapped from _score');
    assert.deepEqual(result.matches[0].metadata, {},
      'Missing fields should default to empty metadata, got: ' + JSON.stringify(result.matches[0].metadata));
  });

  await runScenario("Test 6: loadSubstrate happy-path with live shape returns Mode A3 + cache lands", async () => {
    installMockBrainClient({
      isAvailable: true,
      search: async () => ({
        result: {
          hits: [{
            _id: 'mindrian-knowledge_jtbd_xyz',
            _score: 0.92,
            fields: {
              framework: 'jtbd',
              title: 'Jobs To Be Done',
              tier: 'core',
            },
          }],
        },
      }),
    });
    const roomDir = makeRoomDir('t06');
    const m = require('../core/rs-brain-substrate.cjs');
    const result = await m.loadSubstrate({ roomDir: roomDir });
    assert.equal(result.success, true, 'success must be true');
    assert.equal(result.mode, 'A3',
      'Expected Mode A3 on missing-cache + Brain-up + live-shape, got: ' + result.mode);
    assert.ok(Array.isArray(result.substrate) && result.substrate.length === 1,
      'A3 substrate length 1');
    assert.equal(result.substrate[0].id, 'mindrian-knowledge_jtbd_xyz',
      'substrate entry id mapped from _id');
    assert.equal(result.substrate[0].score, 0.92, 'score preserved on substrate entry');
    // Cache must land
    const cp = path.join(roomDir, '.mindrian', 'brain-substrate-cache.json');
    assert.ok(fs.existsSync(cp), 'A3 must write cache atomically at ' + cp);
    const cached = JSON.parse(fs.readFileSync(cp, 'utf8'));
    assert.ok(typeof cached.embedding_count === 'number' && cached.embedding_count > 0,
      'cache embedding_count > 0, got: ' + cached.embedding_count);
  });

  await runScenario("Test 7: Canon Part 8 audit log records outcome:pass with handles array (chokepoint preserved)", async () => {
    installMockBrainClient({
      isAvailable: true,
      search: async () => ({ result: { hits: [] } }),
    });
    const roomDir = makeRoomDir('t07');
    const m = require('../core/rs-brain-substrate.cjs');
    await m._test.pullFromBrain(roomDir, { namespace: 'tools', limit: 5 });
    const auditPath = path.join(roomDir, '.mindrian', 'brain-substrate-audit.jsonl');
    assert.ok(fs.existsSync(auditPath), 'audit log must exist after pullFromBrain');
    const lines = fs.readFileSync(auditPath, 'utf8').trim().split('\n');
    assert.ok(lines.length >= 1, 'expected at least one audit line');
    const last = JSON.parse(lines[lines.length - 1]);
    assert.equal(last.outcome, 'pass',
      'Canon Part 8 audit outcome must be pass on legitimate query, got: ' + last.outcome);
    assert.ok(Array.isArray(last.handles), 'audit must record handles array');
    // handles are the keys of the outbound payload, which is {query, namespace, topK}
    assert.ok(last.handles.includes('query'), 'handles must include query');
    assert.ok(last.handles.includes('namespace'), 'handles must include namespace');
    assert.ok(last.handles.includes('topK'), 'handles must include topK');
  });

  await runScenario("Test 8: pinecone_quota_exhausted is STILL rejected (Pitfall 1 guard intact)", async () => {
    installMockBrainClient({
      isAvailable: true,
      search: async () => ({
        error: 'pinecone_quota_exhausted',
        message: 'Pinecone quota exhausted',
        fallback: 'neo4j',
      }),
    });
    const roomDir = makeRoomDir('t08');
    const m = require('../core/rs-brain-substrate.cjs');
    const result = await m._test.pullFromBrain(roomDir, { namespace: 'tools' });
    assert.equal(result.ok, false, 'quota fallback must NOT be cached');
    assert.equal(result.reason, 'brain_quota_exhausted',
      'reason should be brain_quota_exhausted, got: ' + result.reason);
    assert.equal(result.err_category, 'rate_limited',
      'err_category should be rate_limited');
  });

  await runScenario("Test 9: loadSubstrate NEVER throws even on adapter-internal anomaly (graceful degradation)", async () => {
    installMockBrainClient({
      isAvailable: true,
      search: async () => {
        // Return something pathological that the adapter must handle without throwing.
        // Adapter sees neither matches[] nor result.hits[], so returns null;
        // pullFromBrain converts null to malformed_response. loadSubstrate then
        // falls through to B3 (no cache + Brain "up" but pull failed).
        return null;
      },
    });
    const roomDir = makeRoomDir('t09');
    const m = require('../core/rs-brain-substrate.cjs');
    let threw = null;
    let result = null;
    try {
      result = await m.loadSubstrate({ roomDir: roomDir });
    } catch (err) {
      threw = err;
    }
    assert.equal(threw, null, 'I4: loadSubstrate must NEVER throw, got: ' + (threw && threw.message));
    assert.ok(result && typeof result === 'object', 'result must be object');
    assert.equal(result.success, true, 'success must be true even on degraded path');
    assert.equal(result.mode, 'B3',
      'Pathological null response with no cache -> B3, got: ' + result.mode);
  });

  // ============================================================
  // Task 2 Tests 10-14: validator Check E embedding-or-score
  // ============================================================

  await runScenario("Test 10: validator on score-only entry (no embedding) returns zero violations (post-relax)", async () => {
    const roomDir = makeRoomDir('t10');
    plantCache(roomDir, {
      schema_version: '1.0',
      pulled_at: new Date().toISOString(),
      ttl_days: 30,
      source_index: 'pws-brain',
      source_namespaces: ['tools'],
      embedding_count: 1,
      content_hash: 'sha256:test',
      _completeness: 'score-only',
      substrate: [{
        id: 'mindrian-rs-abc',
        score: 0.8,
        metadata: { framework_name: 'rs', title: 'Reverse Salient' },
      }],
    });
    const v = require('./validators/brain-substrate-invariants.cjs');
    const r = v.validate(roomDir, {});
    assert.ok(Array.isArray(r.violations), 'validator returns violations array');
    assert.equal(r.violations.length, 0,
      'Score-only entry should pass post-relax. Violations: ' +
      JSON.stringify(r.violations));
    assert.equal(r.severity, null, 'severity should be null');
  });

  await runScenario("Test 11: validator on score-out-of-range returns critical cache_entry_shape_invalid", async () => {
    const roomDir = makeRoomDir('t11');
    plantCache(roomDir, {
      schema_version: '1.0',
      pulled_at: new Date().toISOString(),
      ttl_days: 30,
      source_index: 'pws-brain',
      source_namespaces: ['tools'],
      embedding_count: 1,
      content_hash: 'sha256:test',
      _completeness: 'score-only',
      substrate: [{
        id: 'mindrian-bad',
        score: 1.5,
        metadata: {},
      }],
    });
    const v = require('./validators/brain-substrate-invariants.cjs');
    const r = v.validate(roomDir, {});
    assert.ok(
      r.violations.some(function (x) { return x.category === 'cache_entry_shape_invalid'; }),
      'Expected cache_entry_shape_invalid violation, got: ' + JSON.stringify(r.violations)
    );
    assert.equal(r.severity, 'critical', 'severity must be critical on bad score');
  });

  await runScenario("Test 12: validator on entry missing both embedding AND score returns critical", async () => {
    const roomDir = makeRoomDir('t12');
    plantCache(roomDir, {
      schema_version: '1.0',
      pulled_at: new Date().toISOString(),
      ttl_days: 30,
      source_index: 'pws-brain',
      source_namespaces: ['tools'],
      embedding_count: 1,
      content_hash: 'sha256:test',
      _completeness: 'partial',
      substrate: [{
        id: 'mindrian-orphan',
        metadata: {},
      }],
    });
    const v = require('./validators/brain-substrate-invariants.cjs');
    const r = v.validate(roomDir, {});
    assert.ok(
      r.violations.some(function (x) { return x.category === 'cache_entry_shape_invalid'; }),
      'Expected cache_entry_shape_invalid for entry with neither embedding nor score, got: ' +
      JSON.stringify(r.violations)
    );
    assert.equal(r.severity, 'critical', 'severity must be critical on missing both');
  });

  await runScenario("Test 13: validator on legacy 1024-dim embedding entry STILL passes (back-compat)", async () => {
    const roomDir = makeRoomDir('t13');
    plantCache(roomDir, {
      schema_version: '1.0',
      pulled_at: new Date().toISOString(),
      ttl_days: 30,
      source_index: 'pws-brain',
      source_namespaces: ['tools'],
      embedding_count: 1,
      content_hash: 'sha256:test',
      _completeness: 'full-vectors',
      substrate: [{
        id: 'six_thinking_hats',
        embedding: new Array(1024).fill(0.0),
        metadata: { framework_name: 'Six Thinking Hats' },
      }],
    });
    const v = require('./validators/brain-substrate-invariants.cjs');
    const r = v.validate(roomDir, {});
    assert.equal(r.violations.length, 0,
      'Legacy 1024-dim path must remain valid. Violations: ' +
      JSON.stringify(r.violations));
    assert.equal(r.severity, null, 'severity should be null on legacy entry');
  });

  await runScenario("Test 14: validator on score-only entry with forbidden regex in metadata returns canon_boundary critical", async () => {
    const roomDir = makeRoomDir('t14');
    plantCache(roomDir, {
      schema_version: '1.0',
      pulled_at: new Date().toISOString(),
      ttl_days: 30,
      source_index: 'pws-brain',
      source_namespaces: ['tools'],
      embedding_count: 1,
      content_hash: 'sha256:test',
      _completeness: 'score-only',
      substrate: [{
        id: 'mindrian-poisoned',
        score: 0.8,
        metadata: { framework_name: 'jonathan@mindrian.com' },
      }],
    });
    const v = require('./validators/brain-substrate-invariants.cjs');
    const r = v.validate(roomDir, {});
    assert.ok(
      r.violations.some(function (x) { return x.category === 'canon_boundary'; }),
      'Expected canon_boundary on forbidden-regex-laden metadata, got: ' +
      JSON.stringify(r.violations)
    );
    assert.equal(r.severity, 'critical', 'severity must be critical on canon_boundary hit');
    // Cleanup (mirrors 89.1a-03 Scenario 12 pattern; poisoned cache is test-only)
    try {
      fs.unlinkSync(path.join(roomDir, '.mindrian', 'brain-substrate-cache.json'));
    } catch (_e) { /* best effort */ }
  });

  // ----- Summary -----
  const total = passed + failed;
  process.stdout.write(
    '\n=== 89.1-01 shape adapter suite: ' + passed + '/' + total + ' passed ===\n'
  );
  if (failed > 0) {
    for (const f of failures) {
      process.stderr.write('  - ' + f.name + ': ' +
        (f.err && f.err.message ? f.err.message : String(f.err)) + '\n');
    }
    process.exit(1);
  }
  process.exit(0);
}

main().catch(function (err) {
  process.stderr.write('FATAL: ' + String(err && err.stack || err) + '\n');
  process.exit(1);
});
