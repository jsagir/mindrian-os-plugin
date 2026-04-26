#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 89.2 Plan 01 -- Egress primitives adversarial fixture suite.
 *
 * 8 scenarios covering the three Wave-1 foundation modules:
 *   rs-egress-violations.cjs
 *   rs-egress-prompts.cjs
 *   rs-egress-telemetry.cjs
 *
 * Test 1 (violation throws): ExternalEgressViolation shape + meta
 * Test 2 (FORBIDDEN_PATTERNS parity gate): byte-for-byte from cross-room-aggregator
 * Test 3 (auditQueryString happy path): clean query passes through
 * Test 4 (auditQueryString forbidden hits): all 6 FORBIDDEN_PATTERNS throw
 * Test 5 (auditQueryObject happy path): clean object passes through
 * Test 6 (telemetry append+read): hash-not-literal proof
 * Test 7 (budget across 24h window): rolling window math
 * Test 8 (graceful fs-error degradation): writeFileSync EACCES + readFileSync ENOENT
 *
 * Suite-end audits:
 *   A1: every captured request payload + every persisted telemetry record
 *       JSON.stringify scanned against FORBIDDEN_PATTERNS; assert ZERO hits
 *   A2: glob TELEMETRY_DIR for tmpfile orphans; assert ZERO after suite
 *
 * Pure CJS, zero npm deps, node built-ins only (assert, fs, os, path).
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

// ---------- Suite bookkeeping ----------

let passed = 0;
let failed = 0;
const failures = [];

// Captured outputs from happy-path tests (audited at A1 sweep).
const SCENARIO_RESULTS = [];

// Telemetry path is determined by the module under test; we relocate to a
// scoped tmpdir per scenario via env override + module re-require so the
// real ~/.mindrian/telemetry path is never touched.
let testHomeDir = null;
let originalHome = null;

// ---------- Tmpdir setup + cleanup ----------

const ALL_TMP_ROOTS = [];

process.on('exit', function () {
  // Restore HOME first so any stray require in cleanup hits original paths.
  if (originalHome !== null) {
    process.env.HOME = originalHome;
  }
  for (const d of ALL_TMP_ROOTS) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  }
});

function setupScopedHome() {
  if (originalHome === null) {
    originalHome = process.env.HOME;
  }
  testHomeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rsegress-home-'));
  ALL_TMP_ROOTS.push(testHomeDir);
  process.env.HOME = testHomeDir;
  // Force require.cache reset so TELEMETRY_DIR is recomputed against new HOME.
  resetRequireCache();
}

function resetRequireCache() {
  const targets = [
    '../core/rs-egress-violations.cjs',
    '../core/rs-egress-prompts.cjs',
    '../core/rs-egress-telemetry.cjs',
    '../core/cross-room-aggregator.cjs',
  ];
  for (const t of targets) {
    try {
      const p = require.resolve(t);
      delete require.cache[p];
    } catch (_e) { /* best effort */ }
  }
}

// ---------- Scenario runner ----------

function runScenario(name, fn) {
  const start = Date.now();
  try {
    fn();
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

// ---------- A1 + A2 sweep helpers ----------

function getForbiddenPatternsFromAggregator() {
  const aggregator = require('../core/cross-room-aggregator.cjs');
  return aggregator.FORBIDDEN_PATTERNS;
}

function scanAgainstForbidden(stringified) {
  const patterns = getForbiddenPatternsFromAggregator();
  for (const re of patterns) {
    if (re.test(stringified)) {
      return { hit: true, pattern: re.source };
    }
  }
  return { hit: false };
}

// ---------- Scenarios ----------

console.log('=== 89.2-01 egress-primitives suite: starting ===');

// Initialize scoped HOME so telemetry tests use a sandbox path.
setupScopedHome();

// ---------- Test 1: violation throws ----------

runScenario('Test 1: ExternalEgressViolation construction shape', function () {
  const { ExternalEgressViolation } = require('../core/rs-egress-violations.cjs');
  let threw = null;
  try {
    throw new ExternalEgressViolation('msg', { surface: 'academic' });
  } catch (e) {
    threw = e;
  }
  assert.ok(threw, 'expected throw');
  assert.equal(threw.name, 'ExternalEgressViolation', 'name field');
  assert.equal(threw.message, 'msg', 'message field');
  assert.deepEqual(threw.meta, { surface: 'academic' }, 'meta field');
  assert.ok(threw instanceof Error, 'instanceof Error');

  // Default meta when omitted should be {} (no undefined leak).
  const e2 = new ExternalEgressViolation('m2');
  assert.deepEqual(e2.meta, {}, 'default meta is empty object');
});

// ---------- Test 2: FORBIDDEN_PATTERNS parity gate ----------

runScenario('Test 2: FORBIDDEN_PATTERNS byte-for-byte parity with cross-room-aggregator', function () {
  const promptsModule = require('../core/rs-egress-prompts.cjs');
  const aggregator = require('../core/cross-room-aggregator.cjs');
  const ours = promptsModule.FORBIDDEN_PATTERNS;
  const truth = aggregator.FORBIDDEN_PATTERNS;
  assert.ok(Array.isArray(ours), 'ours is array');
  assert.ok(Array.isArray(truth), 'truth is array');
  assert.equal(ours.length, truth.length, 'lengths match');
  assert.ok(ours.length >= 6, 'expected >= 6 patterns; got ' + ours.length);
  for (let i = 0; i < truth.length; i++) {
    assert.equal(ours[i].source, truth[i].source, 'pattern source mismatch at index ' + i);
    assert.equal(ours[i].flags, truth[i].flags, 'pattern flags mismatch at index ' + i);
  }
});

// ---------- Test 3: auditQueryString happy path ----------

runScenario('Test 3: auditQueryString clean input passes through', function () {
  const { auditQueryString } = require('../core/rs-egress-prompts.cjs');
  const inputs = [
    'cancer immunotherapy biomarkers',
    'graphene heat conductivity',
    'CAR-T cell therapy clinical trials 2024',
    'reverse salient theory hughes electrification',
  ];
  for (const s of inputs) {
    const out = auditQueryString(s, 'academic');
    assert.equal(out, s, 'expected pass-through for clean input: ' + s);
    SCENARIO_RESULTS.push({ test: 'T3', surface: 'academic', payload: out });
  }
});

// ---------- Test 4: auditQueryString forbidden hits (all 6 FORBIDDEN_PATTERNS) ----------

runScenario('Test 4: auditQueryString throws on every FORBIDDEN_PATTERNS hit', function () {
  const { auditQueryString } = require('../core/rs-egress-prompts.cjs');
  const adversarial = [
    { name: 'email',         input: 'jonathan@mindrian.com cancer biomarkers' },
    { name: 'currency',      input: 'venture raised $5M last quarter' },
    { name: 'quoted-person', input: 'Lawrence said the deal closes' },
    { name: 'meeting',       input: 'meeting with the FDA next Tuesday' },
    { name: 'ssn',           input: 'patient id 123-45-6789 protocol' },
    { name: 'phone',         input: 'contact +1 (415) 555-1234 today' },
  ];
  for (const adv of adversarial) {
    let threw = null;
    try {
      auditQueryString(adv.input, 'academic');
    } catch (e) {
      threw = e;
    }
    assert.ok(threw, 'expected throw for adversarial case: ' + adv.name);
    assert.equal(threw.name, 'ExternalEgressViolation',
      'expected ExternalEgressViolation for case ' + adv.name + '; got ' + threw.name);
    assert.equal(threw.meta.surface, 'academic',
      'meta.surface for case ' + adv.name + ': ' + threw.meta.surface);
    assert.ok(typeof threw.meta.matched_pattern === 'string' && threw.meta.matched_pattern.length > 0,
      'meta.matched_pattern present for case ' + adv.name);
  }

  // TypeError on non-string input.
  let typeThrew = null;
  try { auditQueryString(123, 'academic'); } catch (e) { typeThrew = e; }
  assert.ok(typeThrew && typeThrew.name === 'TypeError', 'TypeError on non-string input');
});

// ---------- Test 5: auditQueryObject happy path + adversarial ----------

runScenario('Test 5: auditQueryObject clean + adversarial', function () {
  const { auditQueryObject } = require('../core/rs-egress-prompts.cjs');
  const clean = { q: 'cancer biomarkers', filter: 'year:2024' };
  const out = auditQueryObject(clean, 'patents');
  assert.deepEqual(out, clean, 'clean object pass-through');
  SCENARIO_RESULTS.push({ test: 'T5', surface: 'patents', payload: out });

  // Adversarial: email tucked inside a nested field.
  let threw = null;
  try {
    auditQueryObject({ q: 'cancer', meta: { contact: 'lawrence@mindrian.com' } }, 'patents');
  } catch (e) {
    threw = e;
  }
  assert.ok(threw, 'expected throw on adversarial nested object');
  assert.equal(threw.name, 'ExternalEgressViolation', 'class name');
  assert.equal(threw.meta.surface, 'patents', 'surface meta');
});

// ---------- Test 6: telemetry append+read (hash-not-literal proof) ----------

runScenario('Test 6: recordTelemetry hashes query_text + persists structured record', function () {
  const telemetry = require('../core/rs-egress-telemetry.cjs');
  const result = telemetry.recordTelemetry({
    source: 'openalex',
    query_text: 'cancer biomarkers',
    status: 'ok',
    http_status: 200,
    rate_limit_remaining: 99,
  });
  assert.equal(result.success, true, 'telemetry record success');

  // Read back from disk and audit shape.
  const filePath = telemetry.TELEMETRY_FILE;
  assert.ok(fs.existsSync(filePath), 'telemetry file exists at ' + filePath);
  const payload = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  assert.equal(payload.schema_version, '1.0', 'schema_version field');
  assert.ok(Array.isArray(payload.entries), 'entries is array');
  assert.equal(payload.entries.length, 1, 'one entry');
  const entry = payload.entries[0];
  assert.equal(entry.source, 'openalex', 'source field');
  assert.ok(/^[a-f0-9]{16}$/.test(entry.query_text_hash),
    'query_text_hash matches 16-char hex; got ' + entry.query_text_hash);
  assert.equal(entry.query_text, undefined, 'literal query_text NEVER persisted');
  assert.equal(entry.status, 'ok', 'status field');
  assert.equal(entry.http_status, 200, 'http_status field');
  assert.equal(entry.rate_limit_remaining, 99, 'rate_limit_remaining field');
  assert.ok(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(entry.fetched_at),
    'fetched_at ISO-8601');
  // Capture the persisted record for A1 sweep.
  SCENARIO_RESULTS.push({ test: 'T6', surface: 'telemetry', payload: payload });

  // Verify hash matches expected sha256 of query text (independent oracle).
  const expectedHash = crypto.createHash('sha256').update('cancer biomarkers').digest('hex').slice(0, 16);
  assert.equal(entry.query_text_hash, expectedHash, 'hash matches independent sha256 oracle');
});

// ---------- Test 7: budget computation across 24h window ----------

runScenario('Test 7: computeRemainingBudget honors rolling 24h window', function () {
  // Reset HOME for isolation: clean telemetry file for this scenario.
  setupScopedHome();
  const telemetry = require('../core/rs-egress-telemetry.cjs');

  // Seed: 50 entries within last 24h + 60 entries older than 24h, all source=arxiv.
  const now = Date.now();
  const entries = [];
  for (let i = 0; i < 50; i++) {
    entries.push({
      source: 'arxiv',
      query_text_hash: 'aaaaaaaaaaaaaaaa',
      status: 'ok',
      fetched_at: new Date(now - (i * 60 * 1000)).toISOString(), // last 50 minutes
    });
  }
  for (let i = 0; i < 60; i++) {
    entries.push({
      source: 'arxiv',
      query_text_hash: 'bbbbbbbbbbbbbbbb',
      status: 'ok',
      fetched_at: new Date(now - (25 * 60 * 60 * 1000) - (i * 60 * 1000)).toISOString(), // > 24h ago
    });
  }
  const payload = { schema_version: '1.0', entries: entries };
  fs.mkdirSync(path.dirname(telemetry.TELEMETRY_FILE), { recursive: true });
  fs.writeFileSync(telemetry.TELEMETRY_FILE, JSON.stringify(payload, null, 2));

  // 100 default budget -> 50 remaining.
  assert.equal(telemetry.computeRemainingBudget('arxiv', 100), 50,
    'budget 100 with 50 in-window -> 50 remaining');
  // 30 budget with 50 in-window -> 0 (clamped non-negative).
  assert.equal(telemetry.computeRemainingBudget('arxiv', 30), 0,
    'budget 30 with 50 in-window -> 0 (clamped)');
  // Other source unaffected.
  assert.equal(telemetry.computeRemainingBudget('openalex', 100), 100,
    'openalex unaffected by arxiv entries');

  // Capture for A1 sweep.
  SCENARIO_RESULTS.push({ test: 'T7', surface: 'telemetry', payload: payload });
});

// ---------- Test 8: graceful fs-error degradation ----------

runScenario('Test 8: recordTelemetry graceful on EACCES; computeRemainingBudget graceful on ENOENT', function () {
  // Fresh HOME so no telemetry exists.
  setupScopedHome();
  const telemetry = require('../core/rs-egress-telemetry.cjs');

  // Cold-start computeRemainingBudget -> returns full default (no telemetry file).
  const cold = telemetry.computeRemainingBudget('openalex', 100);
  assert.equal(cold, 100, 'cold start returns full default budget');

  // Mock writeFileSync to throw EACCES; verify recordTelemetry returns
  // {success:false, error:'fs_error'} without throwing.
  const realWrite = fs.writeFileSync;
  let mockedThrows = 0;
  fs.writeFileSync = function (file, data, opts) {
    if (typeof file === 'string' && file.indexOf('external-papers.json') !== -1) {
      mockedThrows += 1;
      const err = new Error('EACCES: permission denied');
      err.code = 'EACCES';
      throw err;
    }
    return realWrite(file, data, opts);
  };
  try {
    const result = telemetry.recordTelemetry({
      source: 'arxiv',
      query_text: 'graceful test',
      status: 'ok',
    });
    assert.equal(result.success, false, 'success false on fs error');
    assert.equal(result.error, 'fs_error', 'error tag');
    assert.ok(mockedThrows >= 1, 'mock fired at least once');
  } finally {
    fs.writeFileSync = realWrite;
  }

  // Mock readFileSync to throw ENOENT for the telemetry path; verify
  // computeRemainingBudget returns the full default.
  const realRead = fs.readFileSync;
  fs.readFileSync = function (file, opts) {
    if (typeof file === 'string' && file.indexOf('external-papers.json') !== -1) {
      const err = new Error('ENOENT: no such file');
      err.code = 'ENOENT';
      throw err;
    }
    return realRead(file, opts);
  };
  try {
    const remaining = telemetry.computeRemainingBudget('arxiv', 100);
    assert.equal(remaining, 100, 'ENOENT fallback returns full default');
  } finally {
    fs.readFileSync = realRead;
  }
});

// ---------- Suite-end A1 sweep: zero forbidden matches in any captured output ----------

runScenario('A1: zero forbidden matches across captured payloads', function () {
  for (const rec of SCENARIO_RESULTS) {
    const stringified = JSON.stringify(rec.payload);
    const hit = scanAgainstForbidden(stringified);
    assert.equal(hit.hit, false,
      'A1 violation in ' + rec.test + '/' + rec.surface +
      ' against pattern ' + (hit.pattern || 'n/a'));
  }
});

// ---------- Suite-end A2 sweep: zero orphan tmpfiles in TELEMETRY_DIR ----------

runScenario('A2: zero orphan tmpfiles in TELEMETRY_DIR', function () {
  // Re-require to read the module's TELEMETRY_DIR (HOME may have shifted).
  const telemetry = require('../core/rs-egress-telemetry.cjs');
  const dir = path.dirname(telemetry.TELEMETRY_FILE);
  if (!fs.existsSync(dir)) {
    return; // nothing to scan
  }
  const orphans = fs.readdirSync(dir).filter(function (f) {
    return /^external-papers\.json\.tmp\.\d+\.\d+$/.test(f);
  });
  assert.equal(orphans.length, 0,
    'A2 found orphan tmpfiles: ' + JSON.stringify(orphans));
});

// ---------- Final report ----------

if (failed > 0) {
  console.error('\n=== ' + failed + ' FAILURES ===');
  for (const f of failures) {
    console.error('  ' + f.name);
  }
  process.exit(1);
}

console.log('=== 89.2-01 egress-primitives suite: 8/8 passed ===');
process.exit(0);
