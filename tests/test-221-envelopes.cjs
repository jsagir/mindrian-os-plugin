#!/usr/bin/env node
'use strict';
/*
 * Phase 221 Plan 01 -- REQ-1 envelope suite (fixture test per failure class +
 * injection-harness determinism + legacy-contract preservation).
 *
 * Task 1 groups (A): the stage-envelope contract module
 *   A1 makeStageEnvelope fills every annex-2 key with defaults + ISO stamps
 *   A2 validateStageEnvelope rejects each interfaces-rule violation by name
 *   A3 forcedFailure determinism (env seam + opts seam, latched once)
 *   A4 the forced path is SILENT (zero stderr)
 *   A5 spend_limit_exceeded structural retryable:false at CONSTRUCTION (D-11)
 *
 * Task 2 groups (B): research-corpus typed envelope conversion
 *   (extended in the Task 2 RED step -- same file, never a fork)
 *
 * Hermetic: zero network (global.fetch stubbed + counted where relevant).
 * No em-dashes anywhere (CLAUDE.md). CJS only.
 */

const assert = require('node:assert');
const path = require('node:path');

let passed = 0;
let failed = 0;
const failures = [];

function record(name, fn) {
  try {
    fn();
    passed += 1;
    process.stdout.write('  ok  ' + name + '\n');
  } catch (err) {
    failed += 1;
    failures.push({ name: name, err: err });
    process.stdout.write('  FAIL  ' + name + '\n');
    process.stdout.write('        ' + (err && err.stack ? err.stack : String(err)) + '\n');
  }
}

async function recordAsync(name, fn) {
  try {
    await fn();
    passed += 1;
    process.stdout.write('  ok  ' + name + '\n');
  } catch (err) {
    failed += 1;
    failures.push({ name: name, err: err });
    process.stdout.write('  FAIL  ' + name + '\n');
    process.stdout.write('        ' + (err && err.stack ? err.stack : String(err)) + '\n');
  }
}

const ENVELOPE_PATH = path.resolve(__dirname, '..', 'lib', 'core', 'recovery', 'stage-envelope.cjs');
const CORPUS_PATH = path.resolve(__dirname, '..', 'lib', 'core', 'research-corpus.cjs');

const se = require(ENVELOPE_PATH);

// Every MINDRIAN_FORCE_* var this suite touches; scrubbed around each scenario
// so one group's force can never leak into another.
const FORCE_VARS = [
  'MINDRIAN_FORCE_RETRIEVAL_TIMEOUT',
  'MINDRIAN_FORCE_RETRIEVAL_HTTP',
  'MINDRIAN_FORCE_PARSE_CORRUPT',
  'MINDRIAN_FORCE_READBACK_MISMATCH',
  'MINDRIAN_FORCE_EGRESS_BLOCK',
  'MINDRIAN_FORCE_ENGINE_ABSENT',
];

function scrubForceEnv() {
  for (const v of FORCE_VARS) delete process.env[v];
  if (se._internal && typeof se._internal.resetForcedFailureLatch === 'function') {
    se._internal.resetForcedFailureLatch();
  }
}

const ANNEX2_KEYS = [
  'run_id', 'stage', 'engine', 'status', 'failure_class', 'retryable',
  'attempt', 'input_fingerprint', 'output_fingerprint', 'started_at',
  'completed_at', 'provenance', 'warnings', 'payload', 'error',
];

const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

console.log('=== 221-01 envelope suite: starting ===');

(async function main() {

  // =========================================================================
  // Group A -- Task 1: the stage-envelope contract module
  // =========================================================================

  record('A0 frozen enums: 13 stages, 5 statuses, 13 failure classes (incl. spend_limit_exceeded)', function () {
    assert.ok(Array.isArray(se.STAGES) && Object.isFrozen(se.STAGES), 'STAGES frozen array');
    assert.equal(se.STAGES.length, 13, '13 stages; got ' + se.STAGES.length);
    for (const s of ['retrieval', 'discovery', 'normalization', 'segmentation', 'extraction',
      'dedup', 'ranking', 'synthesis', 'gate', 'filing', 'readback', 'orchestration', 'presentation']) {
      assert.ok(se.STAGES.includes(s), 'STAGES includes ' + s);
    }
    assert.ok(Array.isArray(se.STATUSES) && Object.isFrozen(se.STATUSES), 'STATUSES frozen array');
    assert.deepEqual(se.STATUSES.slice().sort(), ['blocked', 'degraded', 'empty_valid', 'failed', 'ok'].sort());
    assert.ok(Array.isArray(se.FAILURE_CLASSES) && Object.isFrozen(se.FAILURE_CLASSES), 'FAILURE_CLASSES frozen array');
    assert.equal(se.FAILURE_CLASSES.length, 13, '13 failure classes; got ' + se.FAILURE_CLASSES.length);
    for (const c of ['missing_credential', 'network_timeout', 'http_error', 'parse_error',
      'engine_unavailable', 'query_error', 'policy_blocked', 'contract_violation',
      'schema_invalid', 'readback_mismatch', 'size_exceeded', 'unknown_error', 'spend_limit_exceeded']) {
      assert.ok(se.FAILURE_CLASSES.includes(c), 'FAILURE_CLASSES includes ' + c);
    }
  });

  record('A1 makeStageEnvelope: every annex-2 key present, ISO stamps, defaults filled', function () {
    const env = se.makeStageEnvelope({
      stage: 'retrieval', engine: 'tavily', status: 'failed',
      failure_class: 'network_timeout', retryable: true,
    });
    for (const k of ANNEX2_KEYS) {
      assert.ok(Object.prototype.hasOwnProperty.call(env, k), 'envelope missing key: ' + k);
    }
    assert.equal(env.stage, 'retrieval');
    assert.equal(env.engine, 'tavily');
    assert.equal(env.status, 'failed');
    assert.equal(env.failure_class, 'network_timeout');
    assert.equal(env.retryable, true);
    assert.equal(env.attempt, 1, 'attempt defaults to 1');
    assert.ok(Array.isArray(env.provenance) && env.provenance.length === 0, 'provenance defaults []');
    assert.ok(Array.isArray(env.warnings) && env.warnings.length === 0, 'warnings defaults []');
    assert.ok(env.payload && typeof env.payload === 'object' && Object.keys(env.payload).length === 0, 'payload defaults {}');
    assert.equal(env.error, null, 'error defaults null');
    assert.ok(ISO_RE.test(env.started_at), 'started_at is ISO-8601: ' + env.started_at);
    assert.ok(ISO_RE.test(env.completed_at), 'completed_at is ISO-8601: ' + env.completed_at);
    assert.equal(env.input_fingerprint, null, 'no input given -> null fingerprint');
    assert.equal(env.output_fingerprint, null, 'no output given -> null fingerprint');
  });

  record('A1b fingerprints: sha256 hex computed when input/output provided', function () {
    const env = se.makeStageEnvelope({
      stage: 'retrieval', engine: 'tavily', status: 'ok',
      input: 'generic topic', output: [{ id: 'x' }],
    });
    assert.ok(/^[0-9a-f]{64}$/.test(env.input_fingerprint), 'input_fingerprint sha256 hex: ' + env.input_fingerprint);
    assert.ok(/^[0-9a-f]{64}$/.test(env.output_fingerprint), 'output_fingerprint sha256 hex: ' + env.output_fingerprint);
    const env2 = se.makeStageEnvelope({ stage: 'retrieval', engine: 'tavily', status: 'ok', input: 'generic topic' });
    assert.equal(env2.input_fingerprint, env.input_fingerprint, 'same input -> same fingerprint (deterministic)');
  });

  record('A2 validateStageEnvelope rejects each violation by name', function () {
    function base(over) {
      return Object.assign(se.makeStageEnvelope({
        stage: 'retrieval', engine: 'tavily', status: 'failed',
        failure_class: 'network_timeout', retryable: true,
      }), over || {});
    }
    // valid envelope passes
    const good = se.validateStageEnvelope(base());
    assert.equal(good.ok, true, 'well-formed failed envelope validates: ' + JSON.stringify(good.violations));

    // unknown stage
    let v = se.validateStageEnvelope(base({ stage: 'teleportation' }));
    assert.equal(v.ok, false);
    assert.ok(v.violations.some(function (x) { return x.indexOf('stage') >= 0; }), 'names the stage violation: ' + v.violations);

    // unknown status
    v = se.validateStageEnvelope(base({ status: 'sorta_ok' }));
    assert.equal(v.ok, false);
    assert.ok(v.violations.some(function (x) { return x.indexOf('status') >= 0; }), 'names the status violation: ' + v.violations);

    // failed with null failure_class
    v = se.validateStageEnvelope(base({ failure_class: null }));
    assert.equal(v.ok, false);
    assert.ok(v.violations.some(function (x) { return x.indexOf('failure_class') >= 0; }), 'names the failure_class violation: ' + v.violations);

    // ok with non-null failure_class
    v = se.validateStageEnvelope(base({ status: 'ok', failure_class: 'network_timeout', error: null }));
    assert.equal(v.ok, false);
    assert.ok(v.violations.some(function (x) { return x.indexOf('failure_class') >= 0; }), 'ok+class named: ' + v.violations);

    // empty_valid with non-null error
    v = se.validateStageEnvelope(base({ status: 'empty_valid', failure_class: null, error: 'boom' }));
    assert.equal(v.ok, false);
    assert.ok(v.violations.some(function (x) { return x.indexOf('error') >= 0; }), 'empty_valid+error named: ' + v.violations);

    // spend_limit_exceeded with status !== blocked (raw literal, bypassing the constructor)
    v = se.validateStageEnvelope(base({ status: 'failed', failure_class: 'spend_limit_exceeded', retryable: false }));
    assert.equal(v.ok, false);
    assert.ok(v.violations.some(function (x) { return x.indexOf('spend_limit') >= 0; }), 'spend_limit status invariant named: ' + v.violations);

    // spend_limit_exceeded with retryable !== false (raw literal)
    v = se.validateStageEnvelope(base({ status: 'blocked', failure_class: 'spend_limit_exceeded', retryable: true }));
    assert.equal(v.ok, false);
    assert.ok(v.violations.some(function (x) { return x.indexOf('spend_limit') >= 0; }), 'spend_limit retryable invariant named: ' + v.violations);

    // the well-formed spend_limit envelope passes
    v = se.validateStageEnvelope(base({ status: 'blocked', failure_class: 'spend_limit_exceeded', retryable: false }));
    assert.equal(v.ok, true, 'blocked + spend_limit_exceeded + retryable:false validates: ' + JSON.stringify(v.violations));
  });

  record('A3 forcedFailure: null with no env; env seam deterministic + latched once; opts seam identical', function () {
    scrubForceEnv();
    // (a) no env, no seam -> null
    assert.equal(se.forcedFailure('retrieval', {}), null, 'no force -> null');

    // (b) env seam: deterministic descriptor on every call
    process.env.MINDRIAN_FORCE_RETRIEVAL_TIMEOUT = '1';
    const d1 = se.forcedFailure('retrieval', {});
    assert.ok(d1, 'forced descriptor returned');
    assert.equal(d1.status, 'failed');
    assert.equal(d1.failure_class, 'network_timeout');
    assert.equal(d1.retryable, true);
    const d2 = se.forcedFailure('retrieval', {});
    assert.deepEqual(d2, d1, 'second call returns the same verdict');
    // latched once: removing the env after the latch keeps the verdict
    delete process.env.MINDRIAN_FORCE_RETRIEVAL_TIMEOUT;
    const d3 = se.forcedFailure('retrieval', {});
    assert.deepEqual(d3, d1, 'latched verdict survives env removal');

    // (c) stage scoping: a retrieval force never fires on another stage
    scrubForceEnv();
    process.env.MINDRIAN_FORCE_RETRIEVAL_TIMEOUT = '1';
    assert.equal(se.forcedFailure('filing', {}), null, 'retrieval force does not leak to filing');
    scrubForceEnv();

    // (d) opts._forceFailure seam behaves identically without the env var
    const s1 = se.forcedFailure('retrieval', { _forceFailure: 'network_timeout' });
    assert.ok(s1, 'opts seam descriptor returned');
    assert.equal(s1.status, d1.status);
    assert.equal(s1.failure_class, d1.failure_class);
    assert.equal(s1.retryable, d1.retryable);
    scrubForceEnv();

    // (e) the canonical per-class envs each force their class on their stage
    const CANON = [
      ['MINDRIAN_FORCE_RETRIEVAL_HTTP', 'retrieval', 'http_error', 'failed'],
      ['MINDRIAN_FORCE_PARSE_CORRUPT', 'normalization', 'parse_error', 'failed'],
      ['MINDRIAN_FORCE_READBACK_MISMATCH', 'readback', 'readback_mismatch', 'failed'],
      ['MINDRIAN_FORCE_EGRESS_BLOCK', 'gate', 'policy_blocked', 'blocked'],
      ['MINDRIAN_FORCE_ENGINE_ABSENT', 'retrieval', 'engine_unavailable', 'blocked'],
    ];
    for (const row of CANON) {
      scrubForceEnv();
      process.env[row[0]] = '1';
      const d = se.forcedFailure(row[1], {});
      assert.ok(d, row[0] + ' fires on ' + row[1]);
      assert.equal(d.failure_class, row[2], row[0] + ' class');
      assert.equal(d.status, row[3], row[0] + ' status');
    }
    scrubForceEnv();
  });

  record('A4 the forced path emits NOTHING on stderr (silent seam)', function () {
    scrubForceEnv();
    process.env.MINDRIAN_FORCE_RETRIEVAL_TIMEOUT = '1';
    let captured = '';
    const realWrite = process.stderr.write;
    process.stderr.write = function (chunk) { captured += String(chunk); return true; };
    try {
      se.forcedFailure('retrieval', {});
      se.forcedFailure('retrieval', {});
      se.forcedFailure('retrieval', { _forceFailure: 'network_timeout' });
    } finally {
      process.stderr.write = realWrite;
    }
    assert.equal(captured, '', 'forced path wrote to stderr: ' + JSON.stringify(captured));
    scrubForceEnv();
  });

  record('A5 D-11 structural override: spend_limit_exceeded forces retryable:false at construction', function () {
    // caller omits retryable
    const omitted = se.makeStageEnvelope({
      stage: 'retrieval', engine: 'anthropic', status: 'blocked',
      failure_class: 'spend_limit_exceeded',
    });
    assert.equal(omitted.retryable, false, 'omitted retryable -> false');
    // caller passes retryable:true -- the constructor overrides (never situational)
    const lied = se.makeStageEnvelope({
      stage: 'retrieval', engine: 'anthropic', status: 'blocked',
      failure_class: 'spend_limit_exceeded', retryable: true,
    });
    assert.equal(lied.retryable, false, 'retryable:true overridden to false');
    // the constructed envelope validates clean
    const v = se.validateStageEnvelope(lied);
    assert.equal(v.ok, true, 'constructed spend_limit envelope validates: ' + JSON.stringify(v.violations));
    // contrast: every other class respects the caller (network_timeout stays true)
    const normal = se.makeStageEnvelope({
      stage: 'retrieval', engine: 'tavily', status: 'failed',
      failure_class: 'network_timeout', retryable: true,
    });
    assert.equal(normal.retryable, true, 'non-spend-limit classes keep caller retryable');
  });

  // =========================================================================
  // Group B -- Task 2: research-corpus typed envelope conversion
  // Hermetic: global.fetch stubbed + counted; brain-client stubbed in place;
  // TAVILY_API_KEY manipulated per scenario and restored at the end.
  // =========================================================================

  scrubForceEnv();

  const SAVED_TAVILY_KEY = process.env.TAVILY_API_KEY;
  const realFetch = global.fetch;
  let fetchCallCount = 0;

  function installFetchStub(impl) {
    fetchCallCount = 0;
    global.fetch = async function () {
      fetchCallCount += 1;
      return impl.apply(null, arguments);
    };
  }
  function restoreFetch() {
    global.fetch = realFetch;
  }
  function okJsonResponse(body) {
    return {
      ok: true,
      status: 200,
      headers: { get: function () { return null; } },
      json: async function () { return body; },
      text: async function () { return JSON.stringify(body); },
      arrayBuffer: async function () { return new ArrayBuffer(0); },
    };
  }
  function freshCorpus() {
    delete require.cache[require.resolve(CORPUS_PATH)];
    return require(CORPUS_PATH);
  }

  await recordAsync('B1 missing key: blocked/missing_credential envelope, NOT an empty array, zero fetch', async function () {
    scrubForceEnv();
    delete process.env.TAVILY_API_KEY;
    installFetchStub(async function () { throw new Error('no network allowed'); });
    try {
      const m = freshCorpus();
      const env = await m.fetchCorpusEnvelope({ source: 'tavily', query: 'generic topic' });
      assert.ok(!Array.isArray(env), 'envelope, not a bare array');
      assert.equal(env.stage, 'retrieval');
      assert.equal(env.engine, 'tavily');
      assert.equal(env.status, 'blocked', 'missing key is blocked; got ' + env.status);
      assert.equal(env.failure_class, 'missing_credential');
      assert.equal(env.retryable, false);
      const v = se.validateStageEnvelope(env);
      assert.equal(v.ok, true, 'envelope validates: ' + JSON.stringify(v.violations));
      assert.equal(fetchCallCount, 0, 'zero fetch on the missing-key path');
    } finally {
      restoreFetch();
    }
  });

  await recordAsync('B2 forced timeout vs http vs parse: three DISTINCT envelopes, ZERO network', async function () {
    process.env.TAVILY_API_KEY = 'test-key-not-real';
    installFetchStub(async function () { throw new Error('forced path must attempt no network'); });
    try {
      const m = freshCorpus();
      const seen = [];
      const FORCES = [
        ['MINDRIAN_FORCE_RETRIEVAL_TIMEOUT', 'network_timeout', 'failed', true],
        ['MINDRIAN_FORCE_RETRIEVAL_HTTP', 'http_error', 'failed', true],
        ['MINDRIAN_FORCE_PARSE_CORRUPT', 'parse_error', 'failed', false],
      ];
      for (const row of FORCES) {
        scrubForceEnv();
        process.env[row[0]] = '1';
        const env = await m.fetchCorpusEnvelope({ source: 'tavily', query: 'generic topic' });
        assert.equal(env.status, row[2], row[0] + ' status; got ' + env.status);
        assert.equal(env.failure_class, row[1], row[0] + ' class; got ' + env.failure_class);
        assert.equal(env.retryable, row[3], row[0] + ' retryable');
        const v = se.validateStageEnvelope(env);
        assert.equal(v.ok, true, row[0] + ' envelope validates: ' + JSON.stringify(v.violations));
        seen.push(env.failure_class);
      }
      assert.equal(new Set(seen).size, 3, 'three DISTINCT failure classes: ' + seen.join(','));
      assert.equal(fetchCallCount, 0, 'ZERO network attempted under forcing; got ' + fetchCallCount);
      scrubForceEnv();
    } finally {
      restoreFetch();
      scrubForceEnv();
    }
  });

  await recordAsync('B3 Brain: unavailable -> blocked/engine_unavailable; query throw -> failed/query_error', async function () {
    scrubForceEnv();
    const brain = require(path.resolve(__dirname, '..', 'lib', 'core', 'brain-client.cjs'));
    const savedIsAvailable = brain.isAvailable;
    const savedQuery = brain.query;
    installFetchStub(async function () { throw new Error('brain path must not fetch'); });
    try {
      const m = freshCorpus();
      // (a) unavailable
      brain.isAvailable = function () { return false; };
      const envA = await m.fetchCorpusEnvelope({ source: 'brain-cypher', query: 'SWOT' });
      assert.equal(envA.status, 'blocked', 'unavailable is blocked; got ' + envA.status);
      assert.equal(envA.failure_class, 'engine_unavailable');
      assert.equal(envA.engine, 'brain-cypher');
      let v = se.validateStageEnvelope(envA);
      assert.equal(v.ok, true, 'unavailable envelope validates: ' + JSON.stringify(v.violations));
      // (b) query throw
      brain.isAvailable = function () { return true; };
      brain.query = async function () { throw new Error('stubbed cypher explosion'); };
      const envB = await m.fetchCorpusEnvelope({ source: 'brain-cypher', query: 'SWOT' });
      assert.equal(envB.status, 'failed', 'query throw is failed; got ' + envB.status);
      assert.equal(envB.failure_class, 'query_error');
      v = se.validateStageEnvelope(envB);
      assert.equal(v.ok, true, 'query-error envelope validates: ' + JSON.stringify(v.violations));
      assert.equal(fetchCallCount, 0, 'brain path issues zero global.fetch calls');
    } finally {
      brain.isAvailable = savedIsAvailable;
      brain.query = savedQuery;
      restoreFetch();
    }
  });

  await recordAsync('B4 empty_valid DISTINCT from failed: a live zero-hit fetch is a finding', async function () {
    scrubForceEnv();
    process.env.TAVILY_API_KEY = 'test-key-not-real';
    installFetchStub(async function () { return okJsonResponse({ results: [] }); });
    try {
      const m = freshCorpus();
      const env = await m.fetchCorpusEnvelope({ source: 'tavily', query: 'generic topic' });
      assert.equal(env.status, 'empty_valid', 'zero live hits is empty_valid; got ' + env.status);
      assert.equal(env.failure_class, null, 'a finding carries no failure_class');
      assert.equal(env.error, null, 'a finding carries no error');
      assert.ok(Array.isArray(env.payload.results) && env.payload.results.length === 0, 'payload.results []');
      const v = se.validateStageEnvelope(env);
      assert.equal(v.ok, true, 'empty_valid envelope validates: ' + JSON.stringify(v.violations));
      assert.equal(fetchCallCount, 1, 'exactly one live fetch');
    } finally {
      restoreFetch();
    }
  });

  await recordAsync('B4b results present: ok envelope with payload.results (normalized items)', async function () {
    scrubForceEnv();
    process.env.TAVILY_API_KEY = 'test-key-not-real';
    installFetchStub(async function () {
      return okJsonResponse({
        results: [
          { url: 'https://example.org/a', title: 'A', content: 'alpha snippet' },
          { url: 'https://example.org/b', title: 'B', content: 'beta snippet' },
        ],
      });
    });
    try {
      const m = freshCorpus();
      const env = await m.fetchCorpusEnvelope({ source: 'tavily', query: 'generic topic' });
      assert.equal(env.status, 'ok');
      assert.equal(env.failure_class, null);
      assert.equal(env.payload.results.length, 2, 'two normalized items');
      assert.equal(env.payload.results[0].source, 'tavily');
      assert.ok(env.output_fingerprint === null || /^[0-9a-f]{64}$/.test(env.output_fingerprint),
        'output fingerprint null or sha256 hex');
      const v = se.validateStageEnvelope(env);
      assert.equal(v.ok, true, 'ok envelope validates: ' + JSON.stringify(v.violations));
    } finally {
      restoreFetch();
    }
  });

  await recordAsync('B5 legacy contract: fetchCorpus arrays + sci-bot object + TypeErrors byte-preserved', async function () {
    scrubForceEnv();
    const brain = require(path.resolve(__dirname, '..', 'lib', 'core', 'brain-client.cjs'));
    const savedIsAvailable = brain.isAvailable;
    installFetchStub(async function () { throw new Error('degrade paths must not fetch'); });
    try {
      const m = freshCorpus();
      // tavily missing key -> [] (byte-compatible legacy degrade)
      delete process.env.TAVILY_API_KEY;
      const arr = await m.fetchCorpus({ source: 'tavily', query: 'generic topic' });
      assert.ok(Array.isArray(arr) && arr.length === 0, 'fetchCorpus(tavily, no key) -> []');
      // brain unavailable -> []
      brain.isAvailable = function () { return false; };
      const arrB = await m.fetchCorpus({ source: 'brain-cypher', query: 'SWOT' });
      assert.ok(Array.isArray(arrB) && arrB.length === 0, 'fetchCorpus(brain, unavailable) -> []');
      // sci-bot disabled object unchanged
      const sci = await m.fetchCorpus({ source: 'sci-bot', query: 'x' });
      assert.ok(sci && sci.disabled === true, 'sci-bot { disabled:true } preserved');
      assert.equal(sci.reason, 'sci-bot disabled (opt-in + token + legal-review required)');
      // TypeErrors preserved on BOTH entry points
      for (const fn of ['fetchCorpus', 'fetchCorpusEnvelope']) {
        let threw = null;
        try { await m[fn]({ source: 'tavily', query: '' }); } catch (e) { threw = e; }
        assert.ok(threw instanceof TypeError, fn + ' empty query throws TypeError');
        threw = null;
        try { await m[fn]({ source: 'not-a-real-source', query: 'x' }); } catch (e) { threw = e; }
        assert.ok(threw instanceof TypeError, fn + ' unknown source throws TypeError');
      }
      assert.equal(fetchCallCount, 0, 'zero fetch across every degrade + reject path');
      // live tavily results -> normalized array (the legacy happy path)
      restoreFetch();
      process.env.TAVILY_API_KEY = 'test-key-not-real';
      installFetchStub(async function () {
        return okJsonResponse({ results: [{ url: 'https://example.org/a', title: 'A', content: 'alpha' }] });
      });
      const m2 = freshCorpus();
      const live = await m2.fetchCorpus({ source: 'tavily', query: 'generic topic' });
      assert.ok(Array.isArray(live) && live.length === 1, 'live fetchCorpus returns the normalized array');
      for (const f of ['id', 'title', 'abstract', 'authors', 'doi', 'source', 'fetched_at']) {
        assert.ok(Object.prototype.hasOwnProperty.call(live[0], f), 'item field: ' + f);
      }
    } finally {
      brain.isAvailable = savedIsAvailable;
      restoreFetch();
    }
  });

  await recordAsync('B6 audit chokepoint UNTOUCHED: ExternalEgressViolation thrown by BOTH entry points, zero fetch', async function () {
    scrubForceEnv();
    process.env.TAVILY_API_KEY = 'test-key-not-real';
    installFetchStub(async function () { return okJsonResponse({ results: [] }); });
    try {
      const m = freshCorpus();
      const planted = 'oncology venture valuation $5.2M cancer treatment';
      for (const fn of ['fetchCorpus', 'fetchCorpusEnvelope']) {
        let threw = null;
        try { await m[fn]({ source: 'tavily', query: planted }); } catch (e) { threw = e; }
        assert.ok(threw, fn + ' throws on the planted query');
        assert.equal(threw.name, 'ExternalEgressViolation', fn + ' throws ExternalEgressViolation, never a softened envelope');
      }
      assert.equal(fetchCallCount, 0, 'NO fetch before the throw; got ' + fetchCallCount);
    } finally {
      restoreFetch();
    }
  });

  // =========================================================================
  // Group C -- 221-02 Task 0 (the absorbed 221-01 Task 3): typed per-provider
  // envelopes on the source-lens driver seam. fetchSourceCached consumes
  // fetchCorpusEnvelope; the 219-05 fields (research_mode, per-provider
  // status/reason/counts/freshness) stay present and UNRENAMED (additive).
  // Hermetic: every fetch is an injected seam; zero network.
  // =========================================================================

  const fs = require('node:fs');
  const os = require('node:os');
  const DRIVER_PATH = path.resolve(__dirname, '..', 'lib', 'lens-engine', 'source-lens-driver.cjs');
  const CACHE_PATH = path.resolve(__dirname, '..', 'lib', 'core', 'research-cache.cjs');
  const driver = require(DRIVER_PATH);
  const researchCache = require(CACHE_PATH);

  function corpusItem(fields) {
    return Object.assign({
      id: 'https://example.test/x',
      url: 'https://example.test/x',
      title: 'web finding',
      abstract: 'premium pricing tier revenue',
      fetched_at: new Date().toISOString(),
    }, fields);
  }
  function driverPreflight() {
    return {
      current_section: 'market-analysis',
      evidence_gaps: [{ summary: 'premium pricing tier revenue churn' }],
      prior_research: [],
    };
  }
  const DRIVER_LENSES = [{ lens: 'scholarly', weight: 1.0 }, { lens: 'industry', weight: 0.8 }];

  await recordAsync('C1 forced timeout surfaces as a typed per-provider envelope; rotation completes on remaining providers', async function () {
    scrubForceEnv();
    const res = await driver.runSourceLens({
      roomDir: '',
      topic: 'premium pricing',
      lensSet: DRIVER_LENSES,
      preflight: driverPreflight(),
      stage: 'explore',
      _fetchCorpusEnvelope: async function (args) {
        if (args.source === 'tavily') {
          return se.makeStageEnvelope({
            stage: 'retrieval', engine: 'tavily', status: 'failed',
            failure_class: 'network_timeout', retryable: true, error: 'forced timeout',
          });
        }
        const it = corpusItem({ id: 'https://oa/1', url: 'https://oa/1' });
        return se.makeStageEnvelope({
          stage: 'retrieval', engine: args.source, status: 'ok',
          payload: { results: [it] }, output: [it],
        });
      },
    });
    assert.equal(res.ok, true, 'run completes');
    assert.ok(Array.isArray(res.stage_envelopes), 'stage_envelopes array on the result');
    const dead = res.stage_envelopes.find(function (e) { return e && e.engine === 'tavily'; });
    assert.ok(dead, 'the dead provider has an envelope');
    assert.equal(dead.status, 'failed', 'typed failed status');
    assert.equal(dead.failure_class, 'network_timeout', 'typed failure_class');
    const v = se.validateStageEnvelope(dead);
    assert.equal(v.ok, true, 'the per-provider envelope validates: ' + JSON.stringify(v.violations));
    const alive = res.stage_envelopes.find(function (e) { return e && e.engine === 'openalex'; });
    assert.ok(alive && alive.status === 'ok', 'the healthy provider envelope is ok');
    assert.ok(res.findings.some(function (f) { return f.url === 'https://oa/1'; }),
      'rotation still completed: the healthy provider item is ranked');
    // 219-05 providers bag: the outage stays a typed error for existing consumers.
    const p = res.providers.find(function (x) { return x.provider === 'tavily'; });
    assert.ok(p && p.status === 'error', 'the 219 providers bag still types the outage');
  });

  await recordAsync('C2 live zero-hit is empty_valid: distinguishable from a dead provider', async function () {
    scrubForceEnv();
    const res = await driver.runSourceLens({
      roomDir: '',
      topic: 'premium pricing',
      lensSet: DRIVER_LENSES,
      preflight: driverPreflight(),
      stage: 'explore',
      _fetchCorpusEnvelope: async function (args) {
        return se.makeStageEnvelope({
          stage: 'retrieval', engine: args.source, status: 'empty_valid',
          payload: { results: [] }, output: [],
        });
      },
    });
    assert.equal(res.ok, true);
    assert.ok(res.stage_envelopes.length >= 2, 'one envelope per fetched provider');
    for (const e of res.stage_envelopes) {
      assert.equal(e.status, 'empty_valid', 'a live zero-hit is empty_valid, got ' + e.status);
      assert.equal(e.failure_class, null, 'a finding carries no failure_class');
      const v = se.validateStageEnvelope(e);
      assert.equal(v.ok, true, 'empty_valid envelope validates: ' + JSON.stringify(v.violations));
    }
    assert.equal(res.research_mode, 'insufficient_evidence', 'the 219 cold-corpus mode is unchanged');
    assert.ok(res.providers.every(function (p) { return p.status === 'empty' || p.status === 'skipped'; }),
      'the 219 providers bag stays empty/skipped, never error');
  });

  await recordAsync('C3 cache HIT carries ok + research-cache provenance; cache-read failure falls through with a warning', async function () {
    scrubForceEnv();
    const tmpRoom = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-221-02-cache-'));
    try {
      // (a) cache HIT: envelope ok with provenance naming research-cache; live fetch NOT called.
      const cachedItem = corpusItem({ id: 'https://cached/1', url: 'https://cached/1' });
      researchCache.putCached(tmpRoom, 'tavily', 'premium pricing', [cachedItem]);
      let liveCalls = 0;
      const resHit = await driver.runSourceLens({
        roomDir: tmpRoom,
        topic: 'premium pricing',
        lensSet: [{ lens: 'industry', weight: 1.0 }],
        preflight: driverPreflight(),
        stage: 'explore',
        _fetchCorpusEnvelope: async function () {
          liveCalls += 1;
          throw new Error('cache hit must not reach the live fetch');
        },
      });
      assert.equal(liveCalls, 0, 'zero live fetches on a cache hit');
      const hitEnv = resHit.stage_envelopes.find(function (e) { return e && e.engine === 'tavily'; });
      assert.ok(hitEnv, 'the cache hit has an envelope');
      assert.equal(hitEnv.status, 'ok', 'cache hit is ok');
      assert.ok(hitEnv.provenance.indexOf('research-cache') !== -1,
        'provenance names research-cache: ' + JSON.stringify(hitEnv.provenance));
      const vHit = se.validateStageEnvelope(hitEnv);
      assert.equal(vHit.ok, true, 'cache-hit envelope validates: ' + JSON.stringify(vHit.violations));
      const pHit = resHit.providers.find(function (x) { return x.provider === 'tavily'; });
      assert.ok(pHit && pHit.status === 'ok' && pHit.freshness === 'cached_fresh',
        'the 219 cache-hit fields are unchanged');

      // (b) cache-read FAILURE: falls through to the live fetch with a warning, never an error.
      const savedGetCached = researchCache.getCached;
      researchCache.getCached = function () { throw new Error('stubbed cache-read explosion'); };
      try {
        const liveItem = corpusItem({ id: 'https://live/1', url: 'https://live/1' });
        const resFallthrough = await driver.runSourceLens({
          roomDir: tmpRoom,
          topic: 'premium pricing',
          lensSet: [{ lens: 'industry', weight: 1.0 }],
          preflight: driverPreflight(),
          stage: 'explore',
          _fetchCorpusEnvelope: async function (args) {
            return se.makeStageEnvelope({
              stage: 'retrieval', engine: args.source, status: 'ok',
              payload: { results: [liveItem] }, output: [liveItem],
            });
          },
        });
        const ftEnv = resFallthrough.stage_envelopes.find(function (e) { return e && e.engine === 'tavily'; });
        assert.ok(ftEnv, 'the fallthrough fetch has an envelope');
        assert.equal(ftEnv.status, 'ok', 'cache-read failure never becomes an error; the live fetch covered');
        assert.ok(ftEnv.warnings.some(function (w) { return /cache/i.test(String(w)); }),
          'the cache-read failure rides as a WARNING: ' + JSON.stringify(ftEnv.warnings));
        assert.equal(ftEnv.failure_class, null, 'a warning is not a failure');
      } finally {
        researchCache.getCached = savedGetCached;
      }
    } finally {
      fs.rmSync(tmpRoom, { recursive: true, force: true });
    }
  });

  await recordAsync('C4 additive contract: 219-05 fields present + UNRENAMED; legacy _fetchCorpus seam unbroken', async function () {
    scrubForceEnv();
    // (a) healthy run through the envelope seam: every landed 219 field rides.
    const res = await driver.runSourceLens({
      roomDir: '',
      topic: 'premium pricing',
      lensSet: DRIVER_LENSES,
      preflight: driverPreflight(),
      stage: 'explore',
      _fetchCorpusEnvelope: async function (args) {
        const it = corpusItem({ id: 'https://ok/' + args.source, url: 'https://ok/' + args.source });
        return se.makeStageEnvelope({
          stage: 'retrieval', engine: args.source, status: 'ok',
          payload: { results: [it] }, output: [it],
        });
      },
    });
    assert.equal(res.ok, true);
    assert.ok(['normal', 'web_degraded_local_fallback', 'local_only', 'insufficient_evidence'].indexOf(res.research_mode) !== -1,
      'research_mode present + drawn from the closed 219 enum');
    assert.ok(Array.isArray(res.providers) && res.providers.length >= 2, 'providers bag present');
    for (const p of res.providers) {
      for (const k of ['provider', 'lens', 'status', 'reason', 'counts', 'freshness']) {
        assert.ok(Object.prototype.hasOwnProperty.call(p, k), 'provider field UNRENAMED: ' + k);
      }
    }
    for (const k of ['ok', 'findings', 'lens_set', 'rotation_ok', 'research_mode', 'providers']) {
      assert.ok(Object.prototype.hasOwnProperty.call(res, k), 'pre-221 result field present: ' + k);
    }
    // (b) the legacy array-returning _fetchCorpus seam still works: a throw is
    // still a typed 219 'error' AND now also carries a typed envelope.
    const resLegacy = await driver.runSourceLens({
      roomDir: '',
      topic: 'premium pricing',
      lensSet: [{ lens: 'industry', weight: 1.0 }],
      preflight: driverPreflight(),
      stage: 'explore',
      _fetchCorpus: async function () { throw new Error('provider down'); },
    });
    assert.equal(resLegacy.ok, true, 'legacy seam run completes');
    assert.ok(resLegacy.providers.some(function (p) { return p.status === 'error'; }),
      'legacy throw stays a typed 219 error');
    const legacyEnv = resLegacy.stage_envelopes.find(function (e) { return e && e.engine === 'tavily'; });
    assert.ok(legacyEnv && legacyEnv.status === 'failed',
      'the legacy throw now ALSO carries a typed failed envelope');
    const vL = se.validateStageEnvelope(legacyEnv);
    assert.equal(vL.ok, true, 'legacy-wrapped envelope validates: ' + JSON.stringify(vL.violations));
  });

  // env hygiene
  if (SAVED_TAVILY_KEY === undefined) delete process.env.TAVILY_API_KEY;
  else process.env.TAVILY_API_KEY = SAVED_TAVILY_KEY;
  scrubForceEnv();

  console.log('=== 221-01 envelope suite: ' + passed + ' passed, ' + failed + ' failed ===');
  if (failed > 0) process.exit(1);
})().catch(function (err) {
  console.error('suite crashed: ' + (err && err.stack ? err.stack : err));
  process.exit(1);
});
