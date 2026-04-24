#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 89.1a Plan 03 -- Brain substrate loader adversarial fixture suite.
 *
 * 14 scenarios covering:
 *   Adversarial (I1):             scenarios 1-6
 *   Happy path (I1, I2, I5):      scenarios 7-9
 *   Cache + persistence (I2,I3,I6,I8): scenarios 10-12
 *   Graceful degradation (I4,I5): scenarios 13-14
 *
 * Mocks brain-client via require.cache override (Phase 90-08 pattern).
 * Between scenarios, resetRequireCache clears brain-client + module-
 * under-test so the next require() sees fresh module state.
 *
 * End-of-suite sweeps:
 *   A1: re-scan every landed cache file against FORBIDDEN_PATTERNS +
 *       DANGEROUS_SUBSTRINGS (Canon Part 8 cross-scenario guarantee).
 *   A2: glob every scenario roomDir for orphan tmpfiles matching
 *       /^brain-substrate-cache\.json\.tmp\.[a-z0-9]+\.substrate$/.
 *
 * Pure CJS, zero npm deps, node built-ins only (assert, fs, os, path).
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

// ---------- Frozen invariant enums ----------

const FROZEN_MODES = Object.freeze(['A1', 'A2', 'A3', 'B1', 'B2', 'B3']);

// Source of truth for the parity gate at suite start. Importing from the
// authoritative module (cross-room-aggregator) means any canon amendment
// there is felt here with zero code change. A drift at any FORBIDDEN_PATTERNS
// index vs. the prompts module breaks the suite loudly at the parity gate.
const crossRoomAggregator = require('../core/cross-room-aggregator.cjs');

// Hard substrings that must never appear in any landed cache file. Parity
// with Phase 90-08 DANGEROUS_SUBSTRINGS so the A1 sweep mirrors the
// reference suite byte-for-byte.
const DANGEROUS_SUBSTRINGS = Object.freeze([
  'Lawrence',
  '5M',
  'revenue',
  'Q4 meeting',
  'jonathan@mindrian.com',
  '123-45-6789',
]);

// Every cache file written by any scenario (happy-path A3 + the planted
// fixtures). A1 sweep at suite end scans each against FORBIDDEN_PATTERNS.
const landedCachePaths = [];
// Every roomDir used by a scenario. A2 sweep at suite end scans the
// .mindrian/ subdir of each for orphan tmpfiles.
const scenarioRoomDirs = [];

// ---------- Tmpdir cleanup ----------

const ALL_TMP_ROOTS = [];
process.on('exit', function () {
  for (const d of ALL_TMP_ROOTS) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  }
});

// ---------- Brain-client mock helpers ----------
//
// Mirrors Phase 90-08 installMockBrainClient byte-for-byte. The fake
// exports are written to require.cache BEFORE rs-brain-substrate is
// loaded (resetRequireCache is called in runScenario's finally block)
// so the substrate module sees the mocked client on every re-require.

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
      return { matches: [] };
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

// ---------- runLoad helper (universal I4 + I5 enforcement) ----------
//
// Wraps loadSubstrate with try/catch. Asserts:
//   Invariant I4: loadSubstrate NEVER throws (any throw is a suite failure).
//   Invariant I5: result.mode is always in the frozen enum.
// These apply to every loadSubstrate call across all scenarios, so the
// helper is the single universal contract enforcement point.

async function runLoad(options) {
  let threw = null;
  let result = null;
  try {
    const m = require('../core/rs-brain-substrate.cjs');
    result = await m.loadSubstrate(options);
  } catch (err) {
    threw = err;
  }
  assert.equal(threw, null,
    'I4: loadSubstrate threw: ' + (threw && (threw.stack || threw.message)));
  assert.ok(result && typeof result === 'object',
    'I4: loadSubstrate returned non-object');
  assert.ok(FROZEN_MODES.includes(result.mode),
    'I5: result.mode not in enum: ' + String(result.mode));
  return result;
}

// ---------- Fixture helpers ----------

function makeRoomDir(label) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'rssub-s-' + label + '-'));
  ALL_TMP_ROOTS.push(d);
  scenarioRoomDirs.push(d);
  return d;
}

function writePoisonedCache(roomDir, overrides) {
  fs.mkdirSync(path.join(roomDir, '.mindrian'), { recursive: true });
  const base = {
    schema_version: '1.0',
    pulled_at: new Date().toISOString(),
    ttl_days: 30,
    source_index: 'pws-brain',
    source_namespaces: ['tools'],
    embedding_count: 1,
    content_hash: 'sha256:deadbeef',
    _completeness: 'full',
    substrate: [{
      id: 'six_thinking_hats',
      embedding: new Array(1024).fill(0.0),
      metadata: {
        framework_name: 'Six Thinking Hats',
        phase_id: 'phase_2',
        problem_type: 'idp',
        domain: 'innovation',
      },
    }],
  };
  const payload = Object.assign({}, base, overrides || {});
  const cachePath = path.join(roomDir, '.mindrian', 'brain-substrate-cache.json');
  fs.writeFileSync(cachePath, JSON.stringify(payload));
  landedCachePaths.push(cachePath);
  return cachePath;
}

// ---------- Main ----------

async function main() {
  process.stdout.write('\n=== Phase 89.1a Plan 03: Brain substrate fixture suite ===\n\n');

  // ----- Parity gate (runs BEFORE scenario 1) -----
  //
  // The prompts module re-exports FORBIDDEN_PATTERNS from cross-room-
  // aggregator by reference. If anyone ever redefines them instead of re-
  // exporting, this gate catches the drift. Plan 01 already defends
  // against this at require-time, but asserting byte-for-byte parity at
  // every index is the contractual tripwire for Phase 89.1a + Plan 90-08
  // FORBIDDEN_PATTERNS drift detection.
  const prompts = require('../core/rs-brain-substrate-prompts.cjs');
  assert.equal(
    prompts.FORBIDDEN_PATTERNS.length,
    crossRoomAggregator.FORBIDDEN_PATTERNS.length,
    'FORBIDDEN_PATTERNS parity: length mismatch with cross-room-aggregator'
  );
  for (let i = 0; i < prompts.FORBIDDEN_PATTERNS.length; i += 1) {
    assert.equal(
      prompts.FORBIDDEN_PATTERNS[i].source,
      crossRoomAggregator.FORBIDDEN_PATTERNS[i].source,
      'FORBIDDEN_PATTERNS parity: regex[' + i + '].source mismatch (drift detected)'
    );
  }
  process.stdout.write('  ok  Parity gate: FORBIDDEN_PATTERNS[' +
    prompts.FORBIDDEN_PATTERNS.length + '] byte-for-byte with cross-room-aggregator\n');
  resetRequireCache();

  // ========== Adversarial scenarios (Invariant I1) ==========
  //
  // Every adversarial scenario MUST assert audit.search_calls.length === 0
  // AND audit.query_calls.length === 0 after the throwing call. That is
  // the load-bearing Canon Part 8 contract: forbidden payloads must be
  // rejected BEFORE any byte leaves the process.

  await runScenario("Scenario 01: Leaked artifact body in query parameter", async () => {
    const audit = installMockBrainClient({ isAvailable: true });
    const roomDir = makeRoomDir('s01');
    const m = require('../core/rs-brain-substrate.cjs');
    let threw = null;
    try {
      m.buildBrainSubstrateQuery({
        framework_ids: ['The user said at the meeting with Jonathan'],
      });
    } catch (err) { threw = err; }
    assert.ok(threw !== null, 'Must throw on leaked artifact body');
    assert.ok(threw instanceof TypeError || threw.name === 'BrainBoundaryViolation',
      'Expected TypeError or BrainBoundaryViolation, got: ' + (threw && threw.name));
    assert.equal(audit.search_calls.length, 0,
      'NO bytes left process: search_calls=' + audit.search_calls.length);
    assert.equal(audit.query_calls.length, 0,
      'NO bytes left process: query_calls=' + audit.query_calls.length);
    // Unused but retained so future extensions can assert against it.
    void roomDir;
  });

  await runScenario("Scenario 02: Leaked venture name in domains", async () => {
    const audit = installMockBrainClient({ isAvailable: true });
    const roomDir = makeRoomDir('s02');
    const m = require('../core/rs-brain-substrate.cjs');
    let threw = null;
    try {
      m.buildBrainSubstrateQuery({ domains: ['ACME Corp (Pat Pending)'] });
    } catch (err) { threw = err; }
    assert.ok(threw !== null, 'Must throw on leaked venture name');
    assert.ok(threw instanceof TypeError, 'Expected TypeError, got: ' + (threw && threw.name));
    assert.equal(audit.search_calls.length, 0, 'NO bytes left process: search_calls');
    assert.equal(audit.query_calls.length, 0, 'NO bytes left process: query_calls');
    void roomDir;
  });

  await runScenario("Scenario 03: Leaked meeting transcript via preSendAudit", async () => {
    const audit = installMockBrainClient({ isAvailable: true });
    const roomDir = makeRoomDir('s03');
    const m = require('../core/rs-brain-substrate.cjs');
    let threw = null;
    try {
      m.preSendAudit(roomDir, {
        query: 'meeting with stakeholders discussed Q4',
        namespace: 'tools',
      }, 'test_s03');
    } catch (err) { threw = err; }
    assert.ok(threw !== null, 'Must throw BrainBoundaryViolation on meeting fragment');
    assert.equal(threw.name, 'BrainBoundaryViolation',
      'Expected BrainBoundaryViolation, got: ' + (threw && threw.name));
    assert.equal(audit.search_calls.length, 0, 'NO bytes left process: search_calls');
    assert.equal(audit.query_calls.length, 0, 'NO bytes left process: query_calls');
  });

  await runScenario("Scenario 04: Leaked currency in preSendAudit payload", async () => {
    const audit = installMockBrainClient({ isAvailable: true });
    const roomDir = makeRoomDir('s04');
    const m = require('../core/rs-brain-substrate.cjs');
    let threw = null;
    try {
      m.preSendAudit(roomDir, {
        query: 'valuation is $5.2M',
        namespace: 'tools',
      }, 'test_s04');
    } catch (err) { threw = err; }
    assert.ok(threw !== null, 'Must throw on leaked currency');
    assert.equal(threw.name, 'BrainBoundaryViolation',
      'Expected BrainBoundaryViolation, got: ' + (threw && threw.name));
    assert.equal(audit.search_calls.length, 0, 'NO bytes left process: search_calls');
    assert.equal(audit.query_calls.length, 0, 'NO bytes left process: query_calls');
  });

  await runScenario("Scenario 05: Malformed payload JSON-structure injection", async () => {
    const audit = installMockBrainClient({ isAvailable: true });
    const roomDir = makeRoomDir('s05');
    const m = require('../core/rs-brain-substrate.cjs');
    // Object masquerading as framework_ids array -> validateCtx must reject
    // at the array-type check before any nested string is even examined.
    let threw = null;
    try {
      m.buildBrainSubstrateQuery({
        framework_ids: { leaked: 'Lawrence said revenue' },
      });
    } catch (err) { threw = err; }
    assert.ok(threw instanceof TypeError,
      'Expected TypeError on JSON-structure injection, got: ' + (threw && threw.name));
    assert.equal(audit.search_calls.length, 0, 'NO bytes left process: search_calls');
    assert.equal(audit.query_calls.length, 0, 'NO bytes left process: query_calls');
    void roomDir;
  });

  await runScenario("Scenario 06: Oversized framework_ids (bypass via volume)", async () => {
    const audit = installMockBrainClient({ isAvailable: true });
    const roomDir = makeRoomDir('s06');
    const m = require('../core/rs-brain-substrate.cjs');
    // 70-char value exceeds SLUG_REGEX limit of 64 characters.
    let threw = null;
    try {
      m.buildBrainSubstrateQuery({ framework_ids: ['a'.repeat(70)] });
    } catch (err) { threw = err; }
    assert.ok(threw instanceof TypeError,
      'Expected TypeError on oversized slug, got: ' + (threw && threw.name));
    assert.equal(audit.search_calls.length, 0, 'NO bytes left process: search_calls');
    assert.equal(audit.query_calls.length, 0, 'NO bytes left process: query_calls');
    void roomDir;
  });

  // ========== Happy-path scenarios (Invariants I1, I2, I5) ==========

  await runScenario("Scenario 07: Mode A1 fresh cache hit, zero network", async () => {
    const audit = installMockBrainClient({ isAvailable: true });
    const roomDir = makeRoomDir('s07');
    writePoisonedCache(roomDir, {
      embedding_count: 1,
      substrate: [{
        id: 'six_thinking_hats',
        embedding: new Array(1024).fill(0.5),
        metadata: {
          framework_name: 'Six Thinking Hats',
          phase_id: 'phase_2',
          problem_type: 'idp',
          domain: 'innovation',
        },
      }],
    });
    const result = await runLoad({ roomDir: roomDir });
    assert.equal(result.mode, 'A1', 'Expected Mode A1, got: ' + result.mode);
    assert.equal(audit.search_calls.length, 0,
      'A1 must be zero-network: search_calls=' + audit.search_calls.length);
    assert.ok(Array.isArray(result.substrate) && result.substrate.length === 1,
      'A1 substrate array length 1');
  });

  await runScenario("Scenario 08: Mode A2 stale cache re-pull", async () => {
    const audit = installMockBrainClient({
      isAvailable: true,
      search: async () => ({
        matches: [{
          id: 'minto',
          embedding: new Array(1024).fill(0.1),
          metadata: {
            framework_name: 'Minto',
            phase_id: 'phase_3',
            problem_type: 'wdp',
            domain: 'strategy',
          },
        }],
      }),
    });
    const roomDir = makeRoomDir('s08');
    // Plant a stale cache (pulled_at 40 days ago -> past 30d TTL default).
    writePoisonedCache(roomDir, {
      pulled_at: new Date(Date.now() - 40 * 86400000).toISOString(),
    });
    const result = await runLoad({ roomDir: roomDir });
    assert.equal(result.mode, 'A2', 'Expected Mode A2, got: ' + result.mode);
    assert.ok(audit.search_calls.length >= 1, 'A2 must re-pull at least once');
    // After A2 writes the fresh cache, record its path for the A1 sweep.
    const freshCachePath = path.join(roomDir, '.mindrian', 'brain-substrate-cache.json');
    if (fs.existsSync(freshCachePath)) landedCachePaths.push(freshCachePath);
  });

  await runScenario("Scenario 09: Mode A3 missing cache fresh pull", async () => {
    const audit = installMockBrainClient({
      isAvailable: true,
      search: async () => ({
        matches: [{
          id: 'jtbd',
          embedding: new Array(1024).fill(0.2),
          metadata: {
            framework_name: 'JTBD',
            phase_id: 'phase_1',
            problem_type: 'udp',
            domain: 'innovation',
          },
        }],
      }),
    });
    const roomDir = makeRoomDir('s09');
    const result = await runLoad({ roomDir: roomDir });
    assert.equal(result.mode, 'A3', 'Expected Mode A3, got: ' + result.mode);
    assert.ok(audit.search_calls.length >= 1, 'A3 must pull from Brain');
    const m = require('../core/rs-brain-substrate.cjs');
    const cp = m._test.cachePath(roomDir);
    assert.ok(fs.existsSync(cp), 'A3 must write cache atomically at ' + cp);
    landedCachePaths.push(cp);
  });

  // ========== Cache + persistence (I2, I3, I6, I8) ==========

  await runScenario("Scenario 10: Malformed cache triggers validator", async () => {
    const roomDir = makeRoomDir('s10');
    fs.mkdirSync(path.join(roomDir, '.mindrian'), { recursive: true });
    fs.writeFileSync(
      path.join(roomDir, '.mindrian', 'brain-substrate-cache.json'),
      '{ not: valid json }'
    );
    const v = require('./validators/brain-substrate-invariants.cjs');
    const r = v.validate(roomDir, {});
    assert.ok(Array.isArray(r.violations), 'validator returns violations array');
    assert.ok(
      r.violations.some(function (x) { return x.category === 'cache_unreadable'; }),
      'Expected category cache_unreadable in violations'
    );
  });

  await runScenario("Scenario 11: 31-day-old cache returns B2 under Brain offline", async () => {
    installMockBrainClient({ isAvailable: false });
    const roomDir = makeRoomDir('s11');
    writePoisonedCache(roomDir, {
      pulled_at: new Date(Date.now() - 31 * 86400000).toISOString(),
    });
    const result = await runLoad({ roomDir: roomDir });
    assert.equal(result.mode, 'B2',
      'Expected Mode B2 (not A1) on 31-day cache + Brain offline, got: ' + result.mode);
    assert.ok(typeof result.stale_days === 'number' && result.stale_days >= 30,
      'stale_days must be >= 30 on 31-day-old cache, got: ' + result.stale_days);
  });

  await runScenario("Scenario 12: Validator registers {id, scope, validate}", async () => {
    const v = require('./validators/brain-substrate-invariants.cjs');
    // Registry-compatible shape (Phase 88-13 guardian contract).
    assert.equal(v.id, 'brain-substrate-invariants',
      'Expected validator id "brain-substrate-invariants", got: ' + String(v.id));
    assert.equal(v.scope, 'room',
      'Expected validator scope "room", got: ' + String(v.scope));
    assert.equal(typeof v.validate, 'function',
      'Expected validator.validate to be a function');
    // Exercise the validator against a forbidden-regex-laden metadata cache.
    // Canon boundary check (Plan 02 Check D) must flag this critical.
    const roomDir = makeRoomDir('s12');
    writePoisonedCache(roomDir, {
      substrate: [{
        id: 'six_thinking_hats',
        embedding: new Array(1024).fill(0.0),
        metadata: {
          // The framework_name deliberately embeds a FORBIDDEN_PATTERNS hit
          // (quoted-person + 'meeting with'). The validator's Check D runs
          // JSON.stringify(metadata) and scans against FORBIDDEN_PATTERNS.
          // We keep this content INSIDE the test file (not in the landed
          // cache as a parseable string) by overwriting the cache IMMEDIATELY
          // before the validator runs and then DELETING the file in the
          // A1 sweep's accept-list.
          framework_name: 'PLACEHOLDER',
          phase_id: 'phase_2',
          problem_type: 'idp',
          domain: 'innovation',
        },
      }],
    });
    // Overwrite with the dangerous-content fixture inline. After the
    // validator runs, delete the file so A1 sweep does not see it. The
    // A1 sweep's job is to prove that NO cache landed in the "healthy
    // code path" carries forbidden content; intentionally-poisoned
    // test fixtures are out of scope.
    const cp = path.join(roomDir, '.mindrian', 'brain-substrate-cache.json');
    const poisoned = {
      schema_version: '1.0',
      pulled_at: new Date().toISOString(),
      ttl_days: 30,
      source_index: 'pws-brain',
      source_namespaces: ['tools'],
      embedding_count: 1,
      content_hash: 'sha256:deadbeef',
      _completeness: 'full',
      substrate: [{
        id: 'six_thinking_hats',
        embedding: new Array(1024).fill(0.0),
        metadata: {
          framework_name: 'Lawrence said revenue at Q4 meeting',
          phase_id: 'phase_2',
          problem_type: 'idp',
          domain: 'innovation',
        },
      }],
    };
    fs.writeFileSync(cp, JSON.stringify(poisoned));
    const r = v.validate(roomDir, {});
    assert.ok(
      r.violations.some(function (x) { return x.category === 'canon_boundary'; }),
      'Expected canon_boundary violation on forbidden-regex-laden metadata'
    );
    assert.equal(r.severity, 'critical',
      'Expected aggregate severity critical on canon_boundary hit, got: ' + r.severity);
    // Delete the poisoned fixture BEFORE suite-end A1 sweep walks it.
    // This cache is intentionally dangerous for a single validator test;
    // it is not a production-landed cache, so exclude it from A1.
    try { fs.unlinkSync(cp); } catch (_e) { /* best effort */ }
  });

  // ========== Graceful degradation (I4, I5) ==========

  await runScenario("Scenario 13: Mode B1 Brain offline + fresh cache", async () => {
    installMockBrainClient({ isAvailable: false });
    const roomDir = makeRoomDir('s13');
    writePoisonedCache(roomDir, {});  // default: fresh (pulled_at = now)
    const result = await runLoad({ roomDir: roomDir });
    assert.equal(result.mode, 'B1',
      'Expected Mode B1 on offline + fresh cache, got: ' + result.mode);
    assert.ok(typeof result.warning === 'string' && /offline/i.test(result.warning),
      'B1 must carry "offline" warning string, got: ' + String(result.warning));
  });

  await runScenario("Scenario 14: Mode B3 offline + no cache = tier-0", async () => {
    installMockBrainClient({ isAvailable: false });
    const roomDir = makeRoomDir('s14');
    const result = await runLoad({ roomDir: roomDir });
    assert.equal(result.mode, 'B3',
      'Expected Mode B3 on offline + missing cache, got: ' + result.mode);
    assert.deepEqual(result.substrate, [],
      'B3 substrate must be empty tier-0 array');
    assert.equal(result.success, true,
      'success must be true even in B3 (tier-0 is a legitimate degradation mode)');
  });

  // ========== End-of-suite cross-cutting sweeps ==========
  //
  // These sweeps run AFTER all scenarios complete. They are the final
  // Canon Part 8 guarantee: no cache landed during the suite carries a
  // forbidden regex hit OR a dangerous substring, and no orphan tmpfile
  // was left behind by any atomic-write invocation.

  // A1: Canon Part 8 cross-scenario cache sweep.
  let scanned = 0;
  for (const p of landedCachePaths) {
    if (!fs.existsSync(p)) continue;
    scanned += 1;
    const content = fs.readFileSync(p, 'utf8');
    for (const re of crossRoomAggregator.FORBIDDEN_PATTERNS) {
      assert.ok(!re.test(content),
        'A1 sweep: ' + p + ' matched forbidden regex ' + re.source);
    }
    for (const s of DANGEROUS_SUBSTRINGS) {
      assert.ok(!content.includes(s),
        'A1 sweep: ' + p + ' contains dangerous substring ' + s);
    }
  }
  process.stdout.write('  ok  A1 sweep: 0 forbidden matches across ' +
    scanned + ' landed cache files\n');

  // A2: Orphan tmpfile sweep.
  const tmpRegex = /^brain-substrate-cache\.json\.tmp\.[a-z0-9]+\.substrate$/;
  let orphans = 0;
  const orphanPaths = [];
  for (const rd of scenarioRoomDirs) {
    const mindrianDir = path.join(rd, '.mindrian');
    if (!fs.existsSync(mindrianDir)) continue;
    let entries;
    try { entries = fs.readdirSync(mindrianDir); } catch (_e) { continue; }
    for (const f of entries) {
      if (tmpRegex.test(f)) {
        orphans += 1;
        orphanPaths.push(path.join(mindrianDir, f));
      }
    }
  }
  assert.equal(orphans, 0,
    'A2 sweep: ' + orphans + ' orphan tmpfiles found: ' + orphanPaths.join(','));
  process.stdout.write('  ok  A2 sweep: 0 orphan tmpfiles across ' +
    scenarioRoomDirs.length + ' roomDirs\n');

  // ----- Summary -----
  const total = passed + failed;
  process.stdout.write('\n=== 89.1a substrate fixture suite: ' +
    passed + '/' + total + ' passed, ' + failed + ' failed ===\n');
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
