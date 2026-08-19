#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 130.7-03 Task 1 -- dual-graph-health.test.cjs
 * ===================================================
 * The report-only/baseline fail-closed CI gate suite. The gate
 * (scripts/check-dual-graph-health.cjs) ships in REPORT-ONLY / BASELINE mode
 * for 130.7: it RECORDS the live measured values as a baseline and fails the
 * build ONLY on a REGRESSION versus that baseline (a metric getting WORSE),
 * never on the absolute pre-existing debt. It fails-CLOSED on an inconclusive
 * read. The absolute-threshold mode is a documented post-132 flip, OFF by
 * default.
 *
 * The gate accepts an injectable metric-reader + baseline-store so these tests
 * plant fixture metric values + baselines WITHOUT a live Brain. The seven
 * behaviors below are the 130.7-03 Task 1 <behavior> block.
 *
 * Task 3 also appends a Part 8 phase-wide forbidden-pattern boundary sweep
 * over all eight 130.7 code paths to this file (the dedicated assertion block
 * at the tail).
 *
 * Run: node lib/memory/dual-graph-health.test.cjs
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const GATE_PATH = path.join(REPO_ROOT, 'scripts', 'check-dual-graph-health.cjs');

const gate = require('../../scripts/check-dual-graph-health.cjs');

let passed = 0;
function test(name, fn) {
  fn();
  process.stdout.write('  ok  ' + name + '\n');
  passed += 1;
}
// Quick task 260819-c9b: the async readLiveMetrics tests (8-11) already ran
// their own assertions inline before calling this -- ok() only records +
// prints the label (mirrors test()'s own bookkeeping, for an async body that
// cannot be wrapped in a synchronous fn).
function ok(name) {
  process.stdout.write('  ok  ' + name + '\n');
  passed += 1;
}

// ---------------------------------------------------------------------------
// Fixtures: an in-memory baseline store + a planted metric reader.
// ---------------------------------------------------------------------------

// A debt-laden live measurement (mirrors the real Brain: REVIEW_REQUIRED ~25,
// ~50 cross-label dup groups, high orphan mass, a thin JTBD cohort). M3 carries
// BOTH the no_fork boolean (recommender output) AND raw_cross_label_dups (the
// informational baseline count Phase 132 owns reducing).
function debtMetrics() {
  return {
    m1_min_cohort: 5,             // higher_is_better (min frameworks per cohort)
    m2_review_required: 25,       // lower_is_better
    m3_no_fork: true,             // boolean -- recommender returns ONE per query
    m3_raw_cross_label_dups: 50,  // informational; tracked for NEW-dup regression
    m4_max_orphan_rate: 0.42,     // lower_is_better (per-label orphan fraction)
  };
}

// An in-memory baseline store implementing { load(), save(obj) }.
function memStore(initial) {
  let state = initial ? JSON.parse(JSON.stringify(initial)) : null;
  return {
    load: function () { return state ? JSON.parse(JSON.stringify(state)) : null; },
    save: function (obj) { state = JSON.parse(JSON.stringify(obj)); return true; },
    _peek: function () { return state; },
  };
}

// A reader returning a fixed metric set (the injected metric-reader seam).
function fixedReader(metrics) {
  return function () { return JSON.parse(JSON.stringify(metrics)); };
}

// ---------------------------------------------------------------------------
// Test 1: records a baseline on first run (no prior baseline -> exit 0).
// ---------------------------------------------------------------------------
test('Test 1: first run with no baseline RECORDS it and exits 0 (baseline recorded, not a fail)', function () {
  const store = memStore(null);
  const res = gate.runCheck({ reader: fixedReader(debtMetrics()), store: store });
  assert.strictEqual(res.exitCode, 0, 'first run exits 0');
  assert.strictEqual(res.outcome, 'baseline_recorded', 'outcome is baseline_recorded');
  assert.ok(store._peek() !== null, 'a baseline was persisted to the store');
  assert.strictEqual(store._peek().metrics.m2_review_required, 25, 'recorded the measured debt verbatim');
});

// ---------------------------------------------------------------------------
// Test 2: pre-existing debt does NOT fail (baseline == current -> exit 0).
// ---------------------------------------------------------------------------
test('Test 2: a re-read returning the SAME debt-laden values exits 0 (no regression)', function () {
  const baseline = { metrics: debtMetrics(), recorded_at: '2026-06-01T00:00:00Z' };
  const store = memStore(baseline);
  const res = gate.runCheck({ reader: fixedReader(debtMetrics()), store: store });
  assert.strictEqual(res.exitCode, 0, 'pre-existing absolute debt never trips the gate');
  assert.strictEqual(res.outcome, 'no_regression', 'outcome is no_regression');
  assert.deepStrictEqual(res.regressions, [], 'zero regressions');
});

// ---------------------------------------------------------------------------
// Test 3: a planted REGRESSION exits NON-ZERO naming the metric + delta.
// ---------------------------------------------------------------------------
test('Test 3: any metric WORSE than baseline exits non-zero, naming the regressed metric + delta', function () {
  const baseline = { metrics: debtMetrics(), recorded_at: '2026-06-01T00:00:00Z' };

  // (a) REVIEW_REQUIRED rose 25 -> 30 (lower_is_better worsened).
  let worse = debtMetrics(); worse.m2_review_required = 30;
  let res = gate.runCheck({ reader: fixedReader(worse), store: memStore(baseline) });
  assert.strictEqual(res.exitCode, 1, 'rising REVIEW_REQUIRED fails the build');
  assert.strictEqual(res.outcome, 'regression', 'outcome is regression');
  const r2 = res.regressions.find(function (r) { return r.metric === 'm2_review_required'; });
  assert.ok(r2, 'm2 named in regressions');
  assert.strictEqual(r2.baseline, 25, 'baseline value reported');
  assert.strictEqual(r2.current, 30, 'current value reported');

  // (b) orphan-rate rose 0.42 -> 0.55.
  let worse2 = debtMetrics(); worse2.m4_max_orphan_rate = 0.55;
  let res2 = gate.runCheck({ reader: fixedReader(worse2), store: memStore(baseline) });
  assert.strictEqual(res2.exitCode, 1, 'rising orphan-rate fails the build');

  // (c) a NEW cross-label dup group appeared 50 -> 51.
  let worse3 = debtMetrics(); worse3.m3_raw_cross_label_dups = 51;
  let res3 = gate.runCheck({ reader: fixedReader(worse3), store: memStore(baseline) });
  assert.strictEqual(res3.exitCode, 1, 'a new raw cross-label dup group is a regression');

  // (d) a JTBD cohort SHRANK below baseline 5 -> 3 (higher_is_better worsened).
  let worse4 = debtMetrics(); worse4.m1_min_cohort = 3;
  let res4 = gate.runCheck({ reader: fixedReader(worse4), store: memStore(baseline) });
  assert.strictEqual(res4.exitCode, 1, 'a shrinking JTBD cohort is a regression');
});

// ---------------------------------------------------------------------------
// Test 4: improvement ratchets the baseline down and exits 0 (never fails).
// ---------------------------------------------------------------------------
test('Test 4: metrics BETTER than baseline exit 0 and ratchet the baseline toward the improvement', function () {
  const baseline = { metrics: debtMetrics(), recorded_at: '2026-06-01T00:00:00Z' };
  const store = memStore(baseline);
  // REVIEW_REQUIRED dropped 25 -> 18; orphan rate 0.42 -> 0.30; cohort grew 5 -> 7.
  const better = debtMetrics();
  better.m2_review_required = 18;
  better.m4_max_orphan_rate = 0.30;
  better.m1_min_cohort = 7;
  const res = gate.runCheck({ reader: fixedReader(better), store: store });
  assert.strictEqual(res.exitCode, 0, 'improvement is never a failure');
  assert.strictEqual(res.outcome, 'improved', 'outcome is improved');
  // The baseline ratchets toward the better value (so next run guards the gain).
  assert.strictEqual(store._peek().metrics.m2_review_required, 18, 'baseline ratcheted REVIEW_REQUIRED down to 18');
  assert.strictEqual(store._peek().metrics.m1_min_cohort, 7, 'baseline ratcheted cohort up to 7');
});

// ---------------------------------------------------------------------------
// Test 5: M3 measures RECOMMENDER OUTPUT, not raw-graph dup count.
// ---------------------------------------------------------------------------
test('Test 5: M3 asserts recommender returns ONE canonical per query (PASS even with raw graph un-deduped)', function () {
  // Drive M3 over a cross-label-duplicate fixture: the raw graph holds 2
  // un-deduped variants of the same name under different labels, but the
  // recommender returns exactly ONE canonical target for it. M3 must PASS.
  const m3 = gate.computeM3NoFork({
    // a fixture roomState whose correlation_labels index carries the same name
    // under two labels (Framework + Product) -- the cross-label-dup case.
    roomState: {
      brainSections: {
        correlation_labels:
          'HEART Framework | Framework | 8\nHEART Framework | Product | 2',
      },
    },
    queries: [
      { currentFramework: 'HEART Framework' },
    ],
  });
  assert.strictEqual(m3.no_fork, true, 'recommender returns exactly one canonical target per logical query');
  assert.strictEqual(m3.raw_cross_label_dups >= 1, true, 'the raw graph still holds the un-deduped variant pair (informational)');
  // A high raw dup count alone does NOT breach the default gate.
  const baseline = { metrics: debtMetrics(), recorded_at: '2026-06-01T00:00:00Z' };
  const same = debtMetrics(); // raw dups stay 50; no_fork true
  const res = gate.runCheck({ reader: fixedReader(same), store: memStore(baseline) });
  assert.strictEqual(res.exitCode, 0, 'a high pre-existing raw dup count is not a hard-fail in the default mode');
});

// ---------------------------------------------------------------------------
// Test 6: fail-closed on inconclusive (Brain unreachable / null / malformed).
// ---------------------------------------------------------------------------
test('Test 6: an inconclusive read exits NON-ZERO with reason inconclusive (no false-green)', function () {
  // (a) reader returns null (Brain unreachable / no result).
  const baseline = { metrics: debtMetrics(), recorded_at: '2026-06-01T00:00:00Z' };
  let res = gate.runCheck({ reader: function () { return null; }, store: memStore(baseline) });
  assert.strictEqual(res.exitCode, 1, 'a null read fails closed');
  assert.strictEqual(res.outcome, 'inconclusive', 'outcome is inconclusive');

  // (b) reader returns a malformed metric set (missing a required metric).
  let res2 = gate.runCheck({ reader: function () { return { m2_review_required: 25 }; }, store: memStore(baseline) });
  assert.strictEqual(res2.exitCode, 1, 'a malformed metric set fails closed');
  assert.strictEqual(res2.outcome, 'inconclusive', 'malformed is inconclusive');

  // (c) m3_no_fork false -- the recommender FORKED (a true breach of the contract).
  let forked = debtMetrics(); forked.m3_no_fork = false;
  let res3 = gate.runCheck({ reader: fixedReader(forked), store: memStore(baseline) });
  assert.strictEqual(res3.exitCode, 1, 'a recommender fork (no_fork false) fails the gate');
});

// ---------------------------------------------------------------------------
// Test 7: flip-to-blocking is documented + stubbed; default is report-only.
// ---------------------------------------------------------------------------
test('Test 7: default mode is baseline/report-only; absolute-threshold mode is an OFF-by-default post-132 flip', function () {
  // The default mode constant is report-only/baseline.
  assert.strictEqual(gate.DEFAULT_MODE, 'baseline', 'default mode is baseline (report-only)');
  assert.ok(gate.POST_132_ABSOLUTE_THRESHOLDS && typeof gate.POST_132_ABSOLUTE_THRESHOLDS === 'object',
    'the post-132 absolute thresholds are carried as an owner-decision target');
  // The flip mode, when invoked over debt-laden current values, breaches the
  // absolute thresholds (M2 25 > 10). In default mode the same values pass.
  const baseline = { metrics: debtMetrics(), recorded_at: '2026-06-01T00:00:00Z' };
  const flip = gate.runCheck({ reader: fixedReader(debtMetrics()), store: memStore(baseline), mode: 'flip-blocking' });
  assert.strictEqual(flip.exitCode, 1, 'flip-blocking mode hard-fails the absolute pre-existing debt (M2 25 > 10)');
  assert.strictEqual(flip.outcome, 'absolute_breach', 'flip outcome names the absolute breach');

  // In-source provenance: the thresholds are tagged as a post-132 owner target,
  // NOT claimed as audit-verbatim.
  const src = fs.readFileSync(GATE_PATH, 'utf8');
  assert.ok(/POST-132 TARGET/.test(src), 'thresholds tagged POST-132 TARGET in-source');
  assert.ok(/owner sign-off/i.test(src), 'thresholds carry an owner sign-off note');
  assert.ok(!/verbatim from the (?:2026-05-17 )?curation audit/i.test(src),
    'no claim that the thresholds are audit-verbatim');
});

// ---------------------------------------------------------------------------
// Part 8 read-only + no-user-content grep gates on the gate source itself.
// ---------------------------------------------------------------------------
test('Part 8: the gate Cypher is read-only and carries zero user content', function () {
  const src = fs.readFileSync(GATE_PATH, 'utf8');
  assert.ok(!/\b(SET|MERGE|DELETE|DETACH|CREATE)\b/.test(src),
    'no write Cypher verbs anywhere in the gate');
  assert.ok(!/artifact|MINTO|roomDir|MindrianRooms|transcript/.test(src),
    'no user-content surface references in the gate');
  // M3 keys on the recommender output, not raw storage.
  assert.ok(/recommendCanonicalTargets|chain-recommender/.test(src),
    'M3 calls the recommender (output), not raw-graph dup count');
});

// ===========================================================================
// Phase 130.7-03 Task 3 -- Part 8 PHASE-WIDE forbidden-pattern boundary sweep.
// ===========================================================================
// Scan every NEW/CHANGED 130.7 code path for the 5 forbidden-pattern classes
// from the 2026-05-24 brain-boundary-scan-pr-gate spec (room paths, artifact /
// MINTO / ROOM.md bodies, Speaker-N transcript shapes, PII email/phone,
// financial proprietary $N patterns) and assert zero matches in any
// OUTBOUND-BRAIN PAYLOAD construction. This mirrors the Phase 90 5-tripwire
// forbidden-substring sweep + the Phase 110-05 adversarial seed pattern.
//
// The correlation_labels index is a LOCAL artifact (Plan 01); the sweep confirms
// it is NEVER placed in an outbound-Brain payload (a Brain query/ask/sendPacket/
// write/callTool argument).
//
// Calibration: a LOCAL filesystem room-resolution idiom (path.join(os.homedir(),
// 'MindrianRooms') / a ~/MindrianRooms JSDoc note) is LOCAL-only, NOT an outbound
// Brain payload -- it is allow-listed by restricting the room-path class to lines
// that ALSO construct a Brain call. The sweep extracts each file's Brain-payload
// lines (a query/ask/sendPacket/write/callTool call OR a *_CYPHER / question
// constant) and runs the forbidden classes ONLY over those.

const PHASE_130_7_PATHS = [
  'lib/core/correlation.cjs',
  'lib/core/correlation-label-index.cjs',
  'scripts/backfill-correlation-id.cjs',
  'lib/brain/chain-recommender.cjs',
  'bin/local-chain-recommender.cjs',
  'lib/core/navigation/spine-events.cjs',
  'scripts/check-dual-graph-health.cjs',
  'scripts/brain-derive-command.cjs',
];

// The 5 forbidden-pattern classes (the boundary-scan spec). Each is a regex set.
const FORBIDDEN_CLASSES = {
  // 1. Room paths that identify a user's room. (A LOCAL os.homedir() join is
  //    allow-listed below; this class fires only inside a Brain-payload line.)
  room_paths: [/~\/MindrianRooms\//, /\broomDir\b/, /\/room\/[a-z]/i],
  // 2. Artifact / MINTO / ROOM.md bodies (governing-thought / frontmatter shapes).
  artifact_bodies: [/governing_thought\s*[:=]\s*["'`]/, /MINTO\.md/, /ROOM\.md/, /^---\s*$/m],
  // 3. Meeting transcript shapes (speaker labels / Velma JSON).
  transcripts: [/Speaker\s+\d+\s*:/, /\[[A-Z][a-z]+\]\s*:/],
  // 4. PII (emails, phone numbers).
  pii: [/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i, /\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b/],
  // 5. Proprietary financial numbers (a $N / NM / NK money pattern).
  proprietary: [/\$\s?\d[\d,]*(?:\.\d+)?\s?[MK]?\b/, /\b\d+(?:\.\d+)?\s?(?:million|billion)\b/i],
};

// A line that CONSTRUCTS an outbound-Brain payload: a call to one of the Brain
// egress methods, OR a Cypher / question template constant the egress consumes.
function _isBrainPayloadLine(line) {
  return /\.(query|ask|askOp|sendPacket|write|callTool|search|smartSearch)\s*\(/.test(line)
    || /_CYPHER\b/.test(line)
    || /FEEDS_INTO_CYPHER|question template|brain_packet/.test(line);
}

test('Part 8 phase-wide sweep: zero forbidden-pattern matches in any outbound-Brain payload across the 8 paths', function () {
  const offenders = [];
  for (const rel of PHASE_130_7_PATHS) {
    const abs = path.join(REPO_ROOT, rel);
    assert.ok(fs.existsSync(abs), 'phase path exists: ' + rel);
    const lines = fs.readFileSync(abs, 'utf8').split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!_isBrainPayloadLine(line)) continue;
      for (const cls of Object.keys(FORBIDDEN_CLASSES)) {
        for (const re of FORBIDDEN_CLASSES[cls]) {
          if (re.test(line)) {
            offenders.push({ file: rel, lineNo: i + 1, class: cls });
          }
        }
      }
    }
  }
  assert.deepStrictEqual(offenders, [], 'no forbidden pattern in any outbound-Brain payload line');
});

test('Part 8 phase-wide sweep: the LOCAL correlation_labels index is never in an outbound-Brain payload', function () {
  // The correlation_labels index is LOCAL (Plan 01). Assert no file places the
  // literal section key inside a Brain egress call argument.
  const SECTION_KEY = 'correlation_labels';
  const offenders = [];
  for (const rel of PHASE_130_7_PATHS) {
    const abs = path.join(REPO_ROOT, rel);
    const lines = fs.readFileSync(abs, 'utf8').split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (_isBrainPayloadLine(line) && line.indexOf(SECTION_KEY) !== -1) {
        offenders.push({ file: rel, lineNo: i + 1 });
      }
    }
  }
  assert.deepStrictEqual(offenders, [], 'correlation_labels never appears in an outbound-Brain payload line');
});

test('Part 8 phase-wide sweep: the LOCAL room-resolution idiom is LOCAL-only (never a Brain payload)', function () {
  // The os.homedir() + MindrianRooms join in brain-derive-command.cjs is a LOCAL
  // filesystem room resolver. Assert it appears only on path.join / fs lines, not
  // on any Brain egress line (the allow-list calibration the sweep depends on).
  const abs = path.join(REPO_ROOT, 'scripts', 'brain-derive-command.cjs');
  const lines = fs.readFileSync(abs, 'utf8').split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/MindrianRooms/.test(line) && _isBrainPayloadLine(line)) {
      assert.fail('MindrianRooms appears on a Brain-payload line at ' + (i + 1) + ': ' + line.trim());
    }
  }
  // Positive: it does appear (proving the resolver exists) and only on LOCAL lines.
  const hasLocalResolver = lines.some(function (l) { return /MindrianRooms/.test(l) && /path\.join|homedir/.test(l); });
  assert.ok(hasLocalResolver, 'the LOCAL os.homedir() MindrianRooms resolver is present (LOCAL-only)');
});

// ===========================================================================
// Quick task 260819-c9b (WS-G) -- readLiveMetrics() hermetic coverage.
// A fake brainClient object stands in for lib/core/brain-client.cjs; this
// suite must NEVER reach the network.
// ===========================================================================

// A fake brainClient whose query() answers by matching a substring of the
// cypher string to a canned { records: [...] } response (or throws / returns
// a budget-overrun text passthrough, per test case).
function fakeBrainClient(opts) {
  const o = opts || {};
  const calls = [];
  return {
    _calls: calls,
    isAvailable: o.isAvailable || function () { return true; },
    query: async function (cypher, params) {
      calls.push({ cypher: cypher, params: params });
      if (typeof o.query === 'function') return o.query(cypher, params);
      if (/m1_min_cohort/.test(cypher)) return { records: [{ m1_min_cohort: 4 }] };
      if (/m2_review_required/.test(cypher)) return { records: [{ m2_review_required: 12 }] };
      if (/m4_max_orphan_rate/.test(cypher)) return { records: [{ m4_max_orphan_rate: 0.1 }] };
      if (/m3_raw_cross_label_dups/.test(cypher)) return { records: [{ m3_raw_cross_label_dups: 3 }] };
      return null;
    },
  };
}

async function test8_readLiveMetrics_conclusive() {
  const client = fakeBrainClient({});
  const metrics = await gate.readLiveMetrics(client);
  assert.ok(metrics, 'readLiveMetrics returns a conclusive metrics object');
  for (const k of gate.REQUIRED_METRIC_KEYS) {
    assert.ok(Object.prototype.hasOwnProperty.call(metrics, k), 'metrics carries ' + k);
  }
  assert.strictEqual(metrics.m1_min_cohort, 4, 'm1 matches the fake M1 read');
  assert.strictEqual(metrics.m2_review_required, 12, 'm2 matches the fake M2 read');
  assert.strictEqual(metrics.m4_max_orphan_rate, 0.1, 'm4 matches the fake M4 read');
  assert.strictEqual(metrics.m3_raw_cross_label_dups, 3, 'm3 raw matches the fake M3_RAW read (prefers the live number)');
  assert.strictEqual(typeof metrics.m3_no_fork, 'boolean', 'm3_no_fork computed locally (no Brain touch)');
  ok('Test 8: readLiveMetrics returns all five REQUIRED_METRIC_KEYS from four well-formed live reads');
}

async function test9_readLiveMetrics_budget_overrun() {
  const client = fakeBrainClient({
    query: async function (cypher) {
      if (/m4_max_orphan_rate/.test(cypher)) return { text: 'cypherReadOnly exceeded 5000ms' };
      if (/m1_min_cohort/.test(cypher)) return { records: [{ m1_min_cohort: 4 }] };
      if (/m2_review_required/.test(cypher)) return { records: [{ m2_review_required: 12 }] };
      if (/m3_raw_cross_label_dups/.test(cypher)) return { records: [{ m3_raw_cross_label_dups: 3 }] };
      return null;
    },
  });
  const metrics = await gate.readLiveMetrics(client);
  assert.strictEqual(metrics, null, 'the exact live M4 budget-overrun shape makes the whole read inconclusive');
  ok('Test 9: readLiveMetrics returns null when M4 answers with the budget-overrun text shape');
}

async function test10_readLiveMetrics_unavailable_and_throw() {
  const unavailableClient = fakeBrainClient({ isAvailable: function () { return false; } });
  const r1 = await gate.readLiveMetrics(unavailableClient);
  assert.strictEqual(r1, null, 'isAvailable() false -> null');

  const throwingClient = fakeBrainClient({
    query: async function () { throw new Error('boom'); },
  });
  const r2 = await gate.readLiveMetrics(throwingClient);
  assert.strictEqual(r2, null, 'a thrown read error -> null (wrapped, never propagates)');
  ok('Test 10: readLiveMetrics returns null when isAvailable() is false, and null when a read throws');
}

async function test11_readLiveMetrics_m2_bound_param() {
  const client = fakeBrainClient({});
  await gate.readLiveMetrics(client);
  const m2Call = client._calls.find(function (c) { return /m2_review_required/.test(c.cypher); });
  assert.ok(m2Call, 'the M2 read was issued');
  assert.deepStrictEqual(m2Call.params, { review_marker: gate.REVIEW_MARKER },
    'the M2 read receives the bound review_marker param');
  ok('Test 11: the M2 read receives the bound review_marker param');
}

async function runQuickTaskC9bSuite() {
  // Sequential awaits: the summary + process.exit at the bottom of this file
  // must not fire before these async tests settle.
  await test8_readLiveMetrics_conclusive();
  await test9_readLiveMetrics_budget_overrun();
  await test10_readLiveMetrics_unavailable_and_throw();
  await test11_readLiveMetrics_m2_bound_param();

  test('Test 12: makeBrainReader(client) with NO prefetched argument still yields null (fail-closed default regression pin)', function () {
    const client = fakeBrainClient({});
    const reader = gate.makeBrainReader(client);
    assert.strictEqual(reader(), null, 'no prefetched arg -> reader() returns null, unchanged from before the async wiring');
  });

  test('Test 13: makeBrainReader(client, metrics) yields those metrics; feeding it into runCheck on an empty store produces baseline_recorded/exit 0', function () {
    const client = fakeBrainClient({});
    const metrics = {
      m1_min_cohort: 4,
      m2_review_required: 12,
      m3_no_fork: true,
      m3_raw_cross_label_dups: 3,
      m4_max_orphan_rate: 0.1,
    };
    const reader = gate.makeBrainReader(client, metrics);
    assert.deepStrictEqual(reader(), metrics, 'prefetched metrics are returned as-is');
    const res = gate.runCheck({ reader: reader, store: memStore(null) });
    assert.strictEqual(res.outcome, 'baseline_recorded', 'runCheck against an empty store records the prefetched metrics as baseline');
    assert.strictEqual(res.exitCode, 0, 'baseline_recorded exits 0');
  });

  test('Test 14: the source no longer contains the pattern-comprehension degree idiom (regression pin protecting the M4 budget fix)', function () {
    const src = fs.readFileSync(GATE_PATH, 'utf8');
    assert.ok(!/size\(\(n\)--\(\)\)\s*=\s*0/.test(src),
      'the slow pattern-comprehension degree(n) idiom must not return -- it exceeds the 5000ms cypherReadOnly budget');
    assert.ok(/degree\(n\)\s*=\s*0/.test(src),
      'the fast built-in degree(n) = 0 form is present');
  });

  process.stdout.write('\ndual-graph-health.test.cjs: ' + passed + ' assertion groups PASSED\n');
  process.exit(0);
}

runQuickTaskC9bSuite().catch(function (e) {
  process.stderr.write('dual-graph-health.test.cjs: FATAL: ' + (e && e.stack || e) + '\n');
  process.exit(1);
});
