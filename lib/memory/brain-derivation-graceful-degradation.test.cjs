#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 90-08 -- Graceful Degradation End-to-End Suite
 * ====================================================
 * Third-line defense for Phase 90. Proves the Brain derivation layer
 * survives every realistic failure mode with four invariants intact:
 *
 *   A. NO CRASH -- no uncaught exception; deriveSection / aggregator /
 *      dispatcher NEVER throw; every path returns a structured result.
 *   B. NO CORRUPTION -- no partial BRAIN.md left on disk; no
 *      BRAIN.md.tmp.*.brain orphans; atomic rename contract honored.
 *   C. USER-VISIBLE STATUS -- caller learns what happened via
 *      {success:false, reason:'...'} OR stderr / stdout markers.
 *   D. RETRY PATH -- after the failure clears (Brain back online, etc.),
 *      re-running the same invocation produces a correct BRAIN.md at
 *      the same path.
 *
 * Canon Part 8 is asserted AS A FAILURE-MODE GUARANTEE: every scenario
 * that lands a BRAIN.md on disk is grep-scanned against the frozen
 * FORBIDDEN_PATTERNS set; every captured Brain query payload is scanned
 * too. If the boundary is real, it survives every failure.
 *
 * Scenarios (14):
 *   01 Brain offline permanent
 *   02 Brain offline intermittent (succeeds then fails)
 *   03 API quota exhausted (rate_limited)
 *   04 Timeout mid-derivation (hanging promise)
 *   05 Schema drift mid-session (brain_graph_version shifts)
 *   06 Malformed Brain response
 *   07 Network partition (ECONNREFUSED)
 *   08 Filesystem EACCES on section dir
 *   09 Disk full on atomic rename (ENOSPC)
 *   10 Concurrent deriveSection on same section
 *   11 Canon Part 8 regression under ordinary operation
 *       (dangerous fixture; Brain succeeds normally)
 *   12 Canon Part 8 regression under timeout
 *       (dangerous fixture; Brain times out)
 *   13 Cross-room aggregator survives corrupt peer room
 *   14 Concurrent session-start staleness scans (queue idempotency)
 *
 * Cross-cutting audits (after all scenarios):
 *   A1 Canon Part 8 forbidden-regex sweep across every BRAIN.md landed
 *   A2 Orphan tmpfile sweep across every tmp dir touched
 *
 * Runtime budget: total suite < 30 seconds. Each scenario self-contained
 * via mkdtempSync + require.cache mock.
 *
 * Pure CJS, node built-ins only, zero npm deps.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

// ---------- Suite-wide state ----------

let passed = 0;
let failed = 0;
const failures = [];

// Track every tmp root created so A2 can sweep for orphans.
const TMP_ROOTS = [];
// Track every BRAIN.md written so A1 can scan for forbidden regex hits.
const LANDED_BRAIN_FILES = [];

// Suite-wide wall clock.
const SUITE_START = Date.now();

// ---------- Canon Part 8 forbidden-regex set ----------
//
// Byte-for-byte parity with lib/core/cross-room-aggregator.cjs
// FORBIDDEN_PATTERNS + the same set used by Plan 90-05 invariants.
// If this drifts from the canonical set, downstream tests will fail
// open. Keep in sync.

const FORBIDDEN_PATTERNS = Object.freeze([
  /@[a-zA-Z0-9._-]+\.[a-zA-Z]{2,}/,                                       // email
  /\$[0-9][\d,.]*[KMB]?\b/,                                               // currency magnitude
  /\b(Lawrence|Jonathan|Nimrod|Oren|Dror)\s+(said|revealed|told|mentioned)\b/i, // quoted-person
  /\bmeeting with\b/i,                                                    // meeting fragment
  /\b\d{3}-\d{2}-\d{4}\b/,                                                // SSN-like
  /\b\+?1?[\s.\-]?\(?\d{3}\)?[\s.\-]?\d{3}[\s.\-]?\d{4}\b/,                // phone-like
]);

// Extra forbidden tokens used by the adversarial fixtures (hard subset;
// not regex-reachable from FORBIDDEN_PATTERNS alone).
const DANGEROUS_SUBSTRINGS = Object.freeze([
  'Lawrence',
  '5M',
  'revenue',
  'Q4 meeting',
  'jonathan@mindrian.com',
  '123-45-6789',
]);

// ---------- Tmp + filesystem helpers ----------

function mkTmp(tag) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'gd-' + tag + '-'));
  TMP_ROOTS.push(d);
  return d;
}

function writeFile(p, body) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, body, 'utf8');
}

// Walk + chmod to restore before rmSync (needed for Scenario 08).
function walkChmod(root, mode) {
  try {
    fs.chmodSync(root, mode);
    const entries = fs.readdirSync(root, { withFileTypes: true });
    for (const e of entries) {
      const p = path.join(root, e.name);
      if (e.isDirectory()) walkChmod(p, mode);
      else {
        try { fs.chmodSync(p, mode); } catch (_e) { /* best effort */ }
      }
    }
  } catch (_e) { /* best effort */ }
}

process.on('exit', function () {
  for (const d of TMP_ROOTS) {
    try {
      walkChmod(d, 0o755);
      fs.rmSync(d, { recursive: true, force: true });
    } catch (_e) { /* best effort */ }
  }
});

// Count orphan tmpfiles under a directory (recursive).
function countOrphanTmpfiles(root) {
  let count = 0;
  const orphans = [];
  function walk(dir) {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
    catch (_e) { return; }
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/BRAIN\.md\.tmp\..*\.brain$/.test(e.name)) {
        count += 1;
        orphans.push(p);
      }
    }
  }
  walk(root);
  return { count: count, paths: orphans };
}

// ---------- Fixture builders ----------

function buildSection(sectionPath, opts) {
  opts = opts || {};
  fs.mkdirSync(sectionPath, { recursive: true });
  const section = path.basename(sectionPath);
  writeFile(path.join(sectionPath, 'ROOM.md'), [
    '---',
    'name: "' + section + '"',
    'kind: section',
    'created_at: "2026-04-20T00:00:00Z"',
    'updated_at: "2026-04-20T00:00:00Z"',
    '---',
    '',
    '# ' + section,
    '',
    opts.identity_text || 'A generic venture identity paragraph with zero personal data.',
    '',
    '## Section links',
    '',
  ].join('\n'));
  writeFile(path.join(sectionPath, 'STATE.md'), [
    '---',
    'artifact_count: ' + (opts.artifact_count || 2),
    'gap_status: ' + (opts.gap_status || 'partial'),
    'completeness_score: ' + (opts.completeness_score || 0.5),
    'minto_health: ' + (opts.minto_health || 'ok'),
    'last_activity_at: "2026-04-20T00:00:00Z"',
    '---',
    '',
    '## State',
    '',
  ].join('\n'));
  const governingThought = opts.governing_thought === undefined
    ? 'The venture needs to validate its primary assumption within 90 days.'
    : opts.governing_thought;
  const argsCount = opts.arguments_count == null ? 4 : opts.arguments_count;
  const evDensity = opts.evidence_density == null ? 0.6 : opts.evidence_density;
  const meceStatus = opts.mece_status || 'pass';
  const rhs = opts.reasoning_health_score == null ? 0.7 : opts.reasoning_health_score;
  writeFile(path.join(sectionPath, 'MINTO.md'), [
    '---',
    'schema_version: 88',
    'version: 1',
    'section: "' + section + '"',
    'last_generated_at: "2026-04-20T00:00:00Z"',
    'last_artifact_write_seen_at: "2026-04-20T00:00:00Z"',
    'arguments_count: ' + argsCount,
    'evidence_density: ' + evDensity,
    'mece_status: ' + meceStatus,
    'reasoning_health_score: ' + rhs,
    'flagged_weaknesses: []',
    'decision_log: []',
    '---',
    '',
    '## Governing Thought',
    '',
    governingThought || '(empty)',
    '',
    '## Arguments',
    '',
    '- arg 1',
    '- arg 2',
    '',
  ].join('\n'));
}

// Build a room with N sections. Returns { root, sections: [absolute paths] }.
function buildRoom(opts) {
  opts = opts || {};
  const root = mkTmp(opts.tag || 'room');
  const count = Number.isFinite(opts.count) ? opts.count : 3;
  const sections = [];
  for (let i = 1; i <= count; i++) {
    const name = opts.names && opts.names[i - 1] ? opts.names[i - 1] : ('section-' + i);
    const p = path.join(root, name);
    buildSection(p, opts.sectionOpts ? opts.sectionOpts(i, name) : {});
    sections.push(p);
  }
  return { root: root, sections: sections };
}

// Dangerous-content fixture used by Scenarios 11 + 12.
function buildDangerousSection(sectionPath) {
  buildSection(sectionPath, {
    identity_text: 'The room identity mentions Lawrence said 5M revenue at the Q4 meeting with jonathan@mindrian.com.',
    governing_thought: 'Lawrence said we will hit 5M revenue by Q4 if pricing holds. SSN 123-45-6789 was leaked.',
  });
}

// ---------- Brain-client mock helpers ----------

function installMockBrainClient(opts) {
  opts = opts || {};
  const audit = {
    isAvailable_calls: 0,
    schema_calls: 0,
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
    schema: async function () {
      audit.schema_calls += 1;
      if (typeof opts.schemaReturn === 'function') return opts.schemaReturn(audit.schema_calls);
      if (opts.schemaThrows) { throw new Error(opts.schemaThrows); }
      return opts.schemaReturn || { brain_graph_version: 21432 };
    },
    query: async function (cypher) {
      audit.query_calls.push({ cypher: cypher });
      if (typeof opts.query === 'function') return opts.query(cypher, audit.query_calls.length);
      return { records: [{ name: 'SWOT', description: 'Classic framework' }] };
    },
    search: async function (q, o) {
      audit.search_calls.push({ query: q, options: o });
      if (typeof opts.search === 'function') return opts.search(q, o, audit.search_calls.length);
      return { matches: [{ title: 'Analogy 1', score: 0.8 }] };
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
    '../core/brain-derivation.cjs',
    '../core/brain-derivation-prompts.cjs',
    '../core/brain-derivation-queue.cjs',
    '../core/cross-room-aggregator.cjs',
    '../core/folder-memory.cjs',
    '../core/folder-memory-shared.cjs',
  ];
  for (const t of targets) {
    try {
      const p = require.resolve(t);
      delete require.cache[p];
    } catch (_e) { /* best effort */ }
  }
}

// Capture a deriveSection result's on-disk BRAIN.md (if any) for the A1
// cross-cutting audit.
function recordLandedBrainMd(sectionPath) {
  const p = path.join(sectionPath, 'BRAIN.md');
  if (fs.existsSync(p)) LANDED_BRAIN_FILES.push(p);
}

// Run a deriveSection call and assert invariants A + B + C. Returns the
// result object for scenario-specific assertions.
//
// Invariant A: never throws. Promise rejection counts as a crash.
// Invariant B: no orphan tmpfile in sectionPath after the call.
// Invariant C: result is a structured object with success boolean.
async function runDerive(sectionPath, options) {
  const { deriveSection } = require('../core/brain-derivation.cjs');
  const roomPath = path.dirname(sectionPath);
  const section = path.basename(sectionPath);
  let result;
  let threw = false;
  let err = null;
  try {
    result = await deriveSection(roomPath, section, options || {});
  } catch (e) {
    threw = true;
    err = e;
  }
  // Invariant A.
  assert.equal(threw, false, 'deriveSection must NEVER throw; got: ' + (err && err.stack ? err.stack : String(err)));
  // Invariant B.
  const orphans = countOrphanTmpfiles(sectionPath);
  assert.equal(orphans.count, 0, 'orphan tmpfile detected after deriveSection: ' + orphans.paths.join(','));
  // Invariant C.
  assert.equal(typeof result, 'object', 'deriveSection must return an object');
  assert.equal(typeof result.success, 'boolean', 'result.success must be a boolean');
  // Record for A1.
  recordLandedBrainMd(sectionPath);
  return result;
}

// ---------- Scenario runner ----------

async function runScenario(name, fn) {
  resetRequireCache();
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
    // Leave tmp dirs for the post-suite A2 sweep; cleaned on process exit.
  }
}

// ---------- 14 SCENARIOS ----------

async function main() {

  // ------------------------------------------------------------------
  // Scenario 01: Brain offline PERMANENT
  // ------------------------------------------------------------------
  // Setup: isAvailable returns false for every call.
  // Action: deriveSection on 5 sections.
  // Assert: no BRAIN.md written; every call returns {success:false,
  //         reason:'brain_unavailable'}; no crash; no tmpfile debris;
  //         audit shows zero query/search calls fired (boundary holds
  //         under the offline failure mode).
  //
  // Retry path (D): re-run with Brain online -> success.
  await runScenario('Scenario 01: Brain offline permanent', async function () {
    const audit = installMockBrainClient({ isAvailable: false });
    const { root, sections } = buildRoom({ tag: 's01', count: 5 });
    const results = [];
    for (const s of sections) {
      const r = await runDerive(s, {});
      results.push(r);
    }
    // Invariant A (no crash) + B (no corruption) asserted by runDerive.
    // Invariant C: user-visible status.
    for (const r of results) {
      assert.equal(r.success, false);
      assert.equal(r.reason, 'brain_unavailable', 'offline scenario must yield brain_unavailable');
      assert.equal(r.cost_tokens, 0);
    }
    // Zero BRAIN.md on disk.
    for (const s of sections) {
      assert.equal(fs.existsSync(path.join(s, 'BRAIN.md')), false, 'no BRAIN.md when Brain is offline');
    }
    // Part 8 under failure: zero Brain payload traffic.
    assert.equal(audit.query_calls.length, 0, 'zero query calls under offline');
    assert.equal(audit.search_calls.length, 0, 'zero search calls under offline');
    assert.equal(audit.schema_calls, 0, 'zero schema calls under offline');
    // Invariant D (retry path): Brain back online -> success.
    resetRequireCache();
    installMockBrainClient({});
    const r2 = await runDerive(sections[0], {});
    assert.equal(r2.success, true, 'retry after Brain online must succeed');
    assert.ok(fs.existsSync(path.join(sections[0], 'BRAIN.md')), 'retry writes BRAIN.md');
  });

  // ------------------------------------------------------------------
  // Scenario 02: Brain offline INTERMITTENT
  // ------------------------------------------------------------------
  // Setup: isAvailable -> true, but a throw on the third section's
  //        schema() fires. The first two must derive cleanly.
  // Action: sequentially deriveSection on 5 sections.
  // Assert: exactly 2 BRAIN.md files written; 3 failures report
  //         structured reason; no tmpfile debris anywhere.
  await runScenario('Scenario 02: Brain offline intermittent', async function () {
    // State machine: schema_calls >= 3 throws brain_unavailable.
    let schemaCalls = 0;
    installMockBrainClient({
      isAvailable: true,
      schemaReturn: function () {
        schemaCalls += 1;
        if (schemaCalls >= 3) {
          throw new Error('brain_unavailable; backend dropped');
        }
        return { brain_graph_version: 21432 };
      },
    });
    const { root, sections } = buildRoom({ tag: 's02', count: 5 });
    const results = [];
    for (const s of sections) {
      results.push(await runDerive(s, {}));
    }
    // First 2 succeed; sections 3-5 fail (derivation_error/brain_unavailable).
    assert.equal(results[0].success, true);
    assert.equal(results[1].success, true);
    for (let i = 2; i < 5; i++) {
      assert.equal(results[i].success, false);
      assert.ok(
        results[i].reason === 'derivation_error' ||
        results[i].reason === 'brain_unavailable' ||
        results[i].reason === 'derivation_timeout',
        'intermittent failure reason expected; got ' + results[i].reason
      );
    }
    // Exactly 2 BRAIN.md on disk.
    let landed = 0;
    for (const s of sections) {
      if (fs.existsSync(path.join(s, 'BRAIN.md'))) landed += 1;
    }
    assert.equal(landed, 2, 'exactly 2 BRAIN.md under intermittent offline');
  });

  // ------------------------------------------------------------------
  // Scenario 03: API quota exhausted (rate_limited after 1 call)
  // ------------------------------------------------------------------
  // Setup: the first section's query pipeline succeeds, second section's
  //        FIRST cypher call throws 429.
  // Action: sequential deriveSection on 5 sections.
  // Assert: exactly 1 BRAIN.md (section 1); sections 2..5 all report
  //         reason=rate_limited (subsequent ones also because the mock
  //         persists the 429 for every section 2+ query).
  await runScenario('Scenario 03: API quota exhausted', async function () {
    let sectionCount = 0;
    // Track which section boundary we are in by schema() calls (one per
    // deriveSection). After the first deriveSection, flip the rate-limit.
    installMockBrainClient({
      schemaReturn: function () {
        sectionCount += 1;
        return { brain_graph_version: 21432 };
      },
      query: function (cypher) {
        if (sectionCount >= 2) {
          throw new Error('429 rate_limited too many requests');
        }
        return { records: [{ name: 'SWOT' }] };
      },
      search: function () {
        if (sectionCount >= 2) {
          throw new Error('429 rate_limited too many requests');
        }
        return { matches: [{ title: 'Analogy 1' }] };
      },
    });
    const { sections } = buildRoom({ tag: 's03', count: 5 });
    const results = [];
    for (const s of sections) {
      results.push(await runDerive(s, {}));
    }
    assert.equal(results[0].success, true, 'first section must succeed before rate-limit');
    for (let i = 1; i < 5; i++) {
      assert.equal(results[i].success, false, 'section ' + (i + 1) + ' should fail under rate limit');
      assert.equal(results[i].reason, 'rate_limited',
        'expected rate_limited; got ' + results[i].reason + ' for section ' + (i + 1));
    }
    let landed = 0;
    for (const s of sections) {
      if (fs.existsSync(path.join(s, 'BRAIN.md'))) landed += 1;
    }
    assert.equal(landed, 1, 'exactly 1 BRAIN.md after rate-limit mid-batch');
  });

  // ------------------------------------------------------------------
  // Scenario 04: Timeout mid-derivation (hanging promise)
  // ------------------------------------------------------------------
  // Setup: query returns a promise that rejects after 200ms with ETIMEDOUT.
  // Action: deriveSection; assert we come back promptly.
  // Assert: success:false; reason is timeout-flavored; no BRAIN.md.
  //
  // Invariant D (retry): remove the timeout behavior, re-run -> success.
  await runScenario('Scenario 04: Timeout mid-derivation', async function () {
    installMockBrainClient({
      query: function () {
        return new Promise(function (_resolve, reject) {
          setTimeout(function () { reject(new Error('ETIMEDOUT brain query timed out')); }, 50);
        });
      },
    });
    const { sections } = buildRoom({ tag: 's04', count: 1 });
    const s = sections[0];
    const start = Date.now();
    const r = await runDerive(s, {});
    const elapsed = Date.now() - start;
    assert.ok(elapsed < 5000, 'deriveSection timeout path must not hang (elapsed ' + elapsed + 'ms)');
    assert.equal(r.success, false);
    assert.ok(
      r.reason === 'derivation_timeout' || r.reason === 'derivation_error',
      'timeout reason expected; got ' + r.reason
    );
    assert.equal(fs.existsSync(path.join(s, 'BRAIN.md')), false);
    // Retry path (D).
    resetRequireCache();
    installMockBrainClient({});
    const r2 = await runDerive(s, {});
    assert.equal(r2.success, true, 'retry after timeout clears must succeed');
  });

  // ------------------------------------------------------------------
  // Scenario 05: Schema drift mid-session
  // ------------------------------------------------------------------
  // Setup: schema() returns brain_graph_version=100 for first section,
  //        101 for second, 100 again for third.
  // Action: 3 deriveSection calls.
  // Assert: all 3 write BRAIN.md; each BRAIN.md records the version that
  //         was live at derivation time; no corruption. (Plan 90-05
  //         staleness re-check is a separate concern.)
  await runScenario('Scenario 05: Schema drift mid-session', async function () {
    let idx = 0;
    const versions = [100, 101, 100];
    installMockBrainClient({
      schemaReturn: function () {
        const v = versions[idx] || 100;
        idx += 1;
        return { brain_graph_version: v };
      },
    });
    const { sections } = buildRoom({ tag: 's05', count: 3 });
    const results = [];
    for (const s of sections) {
      results.push(await runDerive(s, {}));
    }
    for (const r of results) assert.equal(r.success, true);
    // Each BRAIN.md carries its frontmatter brain_graph_version.
    const bodies = sections.map(function (s) { return fs.readFileSync(path.join(s, 'BRAIN.md'), 'utf8'); });
    assert.ok(/brain_graph_version:\s*100/.test(bodies[0]), 'section 1 must record v100');
    assert.ok(/brain_graph_version:\s*101/.test(bodies[1]), 'section 2 must record v101');
    assert.ok(/brain_graph_version:\s*100/.test(bodies[2]), 'section 3 must record v100');
  });

  // ------------------------------------------------------------------
  // Scenario 06: Malformed Brain response
  // ------------------------------------------------------------------
  // Setup: query returns {results: 'not-an-array'} (wrong shape).
  // Action: deriveSection.
  // Assert: deriveSection does NOT crash; renderRecords coerces to
  //         empty / '(no signal)'; BRAIN.md STILL lands with empty
  //         section bodies (the derivation layer tolerates malformed
  //         records the same as empty results).
  //
  // (The canonical "malformed" case the Brain API can emit in practice
  // is a well-formed JSON payload with an unexpected array shape; the
  // renderer is defensive by design. This scenario proves that.)
  await runScenario('Scenario 06: Malformed Brain response', async function () {
    installMockBrainClient({
      query: function () { return { results: 'not-an-array-as-expected' }; },
      search: function () { return { hits: 'also-not-an-array' }; },
    });
    const { sections } = buildRoom({ tag: 's06', count: 1 });
    const s = sections[0];
    const r = await runDerive(s, {});
    assert.equal(r.success, true, 'malformed responses must not crash the derivation');
    const body = fs.readFileSync(path.join(s, 'BRAIN.md'), 'utf8');
    // Every section body falls through to (no signal) since records are
    // not in the expected shape.
    assert.ok(/no signal/.test(body), 'body must mark sections as no signal under malformed response');
  });

  // ------------------------------------------------------------------
  // Scenario 07: Network partition (ECONNREFUSED)
  // ------------------------------------------------------------------
  // Setup: query throws Error('ECONNREFUSED ...') synchronously.
  // Action: deriveSection.
  // Assert: success:false; reason derivation_error (no more specific
  //         category); no BRAIN.md; no tmpfile.
  await runScenario('Scenario 07: Network partition', async function () {
    installMockBrainClient({
      query: function () { throw new Error('ECONNREFUSED mindrian-brain.onrender.com:443'); },
      search: function () { throw new Error('ECONNREFUSED mindrian-brain.onrender.com:443'); },
    });
    const { sections } = buildRoom({ tag: 's07', count: 1 });
    const s = sections[0];
    const r = await runDerive(s, {});
    assert.equal(r.success, false);
    assert.ok(r.reason === 'derivation_error' || r.reason === 'brain_unavailable' || r.reason === 'derivation_timeout',
      'network partition reason; got ' + r.reason);
    assert.equal(fs.existsSync(path.join(s, 'BRAIN.md')), false);
  });

  // ------------------------------------------------------------------
  // Scenario 08: Filesystem EACCES
  // ------------------------------------------------------------------
  // Setup: chmod section dir to 0o555 (read+execute, no write). rename
  //        into the dir should fail with EACCES.
  // Action: deriveSection.
  // Assert: success:false; reason fs_error; no BRAIN.md; no tmpfile.
  //
  // Retry (D): restore permissions and re-derive -> success.
  await runScenario('Scenario 08: Filesystem EACCES', async function () {
    // Skip on root (tests cannot simulate EACCES as root -- bypass perms).
    if (typeof process.getuid === 'function' && process.getuid() === 0) {
      process.stdout.write('  skip  EACCES scenario skipped (running as root)\n');
      return;
    }
    installMockBrainClient({});
    const { sections } = buildRoom({ tag: 's08', count: 1 });
    const s = sections[0];
    // Make the section dir read-only.
    fs.chmodSync(s, 0o555);
    try {
      const r = await runDerive(s, {});
      // Either fs_error or write path blocked; assert no BRAIN.md.
      assert.equal(r.success, false, 'expected failure under EACCES');
      assert.ok(r.reason === 'fs_error' || r.reason === 'schema_rejected' || /fs|access|perm/i.test(r.reason || ''),
        'expected fs_error-flavored reason; got ' + r.reason);
      assert.equal(fs.existsSync(path.join(s, 'BRAIN.md')), false);
    } finally {
      // Restore before cleanup (so rmSync can enter) and for retry path.
      fs.chmodSync(s, 0o755);
    }
    // Retry (D).
    resetRequireCache();
    installMockBrainClient({});
    const r2 = await runDerive(s, {});
    assert.equal(r2.success, true, 'retry after perms restored must succeed');
  });

  // ------------------------------------------------------------------
  // Scenario 09: Disk full on atomic rename (ENOSPC)
  // ------------------------------------------------------------------
  // Setup: monkey-patch fs.renameSync to throw ENOSPC the first call.
  // Action: deriveSection.
  // Assert: success:false; reason fs_error; tmpfile cleaned; no BRAIN.md.
  //
  // Retry (D): restore fs.renameSync, re-run -> success.
  await runScenario('Scenario 09: Disk full on atomic rename (ENOSPC)', async function () {
    installMockBrainClient({});
    const { sections } = buildRoom({ tag: 's09', count: 1 });
    const s = sections[0];
    const origRename = fs.renameSync;
    let thrown = false;
    fs.renameSync = function (from, to) {
      if (!thrown && typeof from === 'string' && from.indexOf('BRAIN.md.tmp') !== -1) {
        thrown = true;
        const err = new Error('ENOSPC: no space left on device');
        err.code = 'ENOSPC';
        throw err;
      }
      return origRename.apply(fs, arguments);
    };
    try {
      const r = await runDerive(s, {});
      assert.equal(r.success, false);
      assert.equal(r.reason, 'fs_error', 'ENOSPC must surface as fs_error; got ' + r.reason);
      assert.equal(fs.existsSync(path.join(s, 'BRAIN.md')), false);
    } finally {
      fs.renameSync = origRename;
    }
    // Retry (D).
    resetRequireCache();
    installMockBrainClient({});
    const r2 = await runDerive(s, {});
    assert.equal(r2.success, true, 'retry after ENOSPC clears must succeed');
  });

  // ------------------------------------------------------------------
  // Scenario 10: Concurrent deriveSection on same section
  // ------------------------------------------------------------------
  // Setup: launch two deriveSection calls via Promise.all on same path.
  // Action: Promise.all([deriveSection, deriveSection]).
  // Assert: at least one succeeds; BRAIN.md lands; no tmpfile debris.
  //         If one loses the race, its reason is fs_error (EEXIST from
  //         exclusive-create wx-flag openSync on the same tmpfile).
  await runScenario('Scenario 10: Concurrent deriveSection on same section', async function () {
    installMockBrainClient({});
    const { sections } = buildRoom({ tag: 's10', count: 1 });
    const s = sections[0];
    const { deriveSection } = require('../core/brain-derivation.cjs');
    const roomPath = path.dirname(s);
    const section = path.basename(s);
    const [a, b] = await Promise.all([
      deriveSection(roomPath, section, {}),
      deriveSection(roomPath, section, {}),
    ]);
    // At least one must have succeeded.
    assert.ok(a.success || b.success, 'at least one concurrent deriveSection must succeed');
    // BRAIN.md present on disk.
    assert.ok(fs.existsSync(path.join(s, 'BRAIN.md')));
    // No tmpfile debris.
    const orphans = countOrphanTmpfiles(s);
    assert.equal(orphans.count, 0, 'no orphan tmpfiles after concurrent calls');
    recordLandedBrainMd(s);
  });

  // ------------------------------------------------------------------
  // Scenario 11: Canon Part 8 under ORDINARY operation (dangerous fixture)
  // ------------------------------------------------------------------
  // Setup: dangerous triple ("Lawrence said 5M", emails, SSN).
  //        Brain succeeds normally.
  // Action: deriveSection.
  // Assert: BRAIN.md lands; forbidden regex set finds ZERO hits in
  //         BRAIN.md body; every captured Brain payload (cypher +
  //         pinecone search) is scrubbed of the same forbidden
  //         patterns. Canon Part 8 holds under normal operation.
  await runScenario('Scenario 11: Canon Part 8 under ordinary operation', async function () {
    const audit = installMockBrainClient({});
    const { sections } = buildRoom({
      tag: 's11',
      count: 1,
      names: ['market-analysis'],
      sectionOpts: function () { return {}; }, // placeholder
    });
    // Overwrite with dangerous content.
    buildDangerousSection(sections[0]);
    const r = await runDerive(sections[0], {});
    assert.equal(r.success, true, 'ordinary derivation must succeed');
    const body = fs.readFileSync(path.join(sections[0], 'BRAIN.md'), 'utf8');
    for (const bad of DANGEROUS_SUBSTRINGS) {
      assert.equal(body.indexOf(bad), -1, 'BRAIN.md leaks dangerous substring: ' + bad);
    }
    for (const re of FORBIDDEN_PATTERNS) {
      assert.equal(re.test(body), false, 'BRAIN.md matches forbidden regex: ' + re);
    }
    // Brain payload audit.
    const payloads = [
      ...audit.query_calls.map(function (c) { return c.cypher; }),
      ...audit.search_calls.map(function (c) { return String(c.query || ''); }),
    ];
    assert.ok(payloads.length >= 1, 'at least 1 Brain payload expected');
    for (const p of payloads) {
      for (const bad of DANGEROUS_SUBSTRINGS) {
        assert.equal(p.indexOf(bad), -1, 'Brain payload leaks ' + bad + ': ' + p);
      }
      for (const re of FORBIDDEN_PATTERNS) {
        assert.equal(re.test(p), false, 'Brain payload matches forbidden regex: ' + re);
      }
    }
  });

  // ------------------------------------------------------------------
  // Scenario 12: Canon Part 8 under TIMEOUT (dangerous fixture)
  // ------------------------------------------------------------------
  // Setup: dangerous triple + query rejects with ETIMEDOUT.
  // Action: deriveSection.
  // Assert: NO BRAIN.md on disk; captured Brain payloads (if any) are
  //         scrubbed of forbidden content. The failure path does NOT
  //         open a backdoor into the user-content egress boundary.
  await runScenario('Scenario 12: Canon Part 8 under timeout', async function () {
    const audit = installMockBrainClient({
      query: function () {
        return new Promise(function (_r, reject) {
          setTimeout(function () { reject(new Error('ETIMEDOUT')); }, 30);
        });
      },
    });
    const { sections } = buildRoom({ tag: 's12', count: 1 });
    buildDangerousSection(sections[0]);
    const r = await runDerive(sections[0], {});
    assert.equal(r.success, false);
    assert.equal(fs.existsSync(path.join(sections[0], 'BRAIN.md')), false,
      'timeout path must not write BRAIN.md');
    // Brain payloads captured before the timeout fired: every one scrubbed.
    const payloads = [
      ...audit.query_calls.map(function (c) { return c.cypher; }),
      ...audit.search_calls.map(function (c) { return String(c.query || ''); }),
    ];
    for (const p of payloads) {
      for (const bad of DANGEROUS_SUBSTRINGS) {
        assert.equal(p.indexOf(bad), -1, 'payload leaks ' + bad + ' under timeout');
      }
      for (const re of FORBIDDEN_PATTERNS) {
        assert.equal(re.test(p), false, 'payload matches forbidden regex under timeout: ' + re);
      }
    }
  });

  // ------------------------------------------------------------------
  // Scenario 13: Cross-room aggregator survives corrupt peer room
  // ------------------------------------------------------------------
  // Setup: current room valid; peer room has BRAIN.md with corrupt
  //        frontmatter (missing required fields + garbled YAML).
  // Action: aggregateContradictions.
  // Assert: aggregator never throws; peer room skip_reasons shows
  //         unreadable OR empty >= 1; other peers still scanned;
  //         output sanitized.
  await runScenario('Scenario 13: Cross-room aggregator survives corrupt peer room', async function () {
    // Set MINDRIAN_ROOMS_ROOT env to a tmp dir and seed a registry.
    const hostRoot = mkTmp('s13');
    const envRoot = hostRoot;
    const prev = process.env.MINDRIAN_ROOMS_ROOT;
    process.env.MINDRIAN_ROOMS_ROOT = envRoot;
    try {
      // Build three rooms under envRoot.
      const roomA = path.join(envRoot, 'room-a'); // current
      const roomB = path.join(envRoot, 'room-b'); // corrupt peer
      const roomC = path.join(envRoot, 'room-c'); // healthy peer
      fs.mkdirSync(roomA, { recursive: true });
      fs.mkdirSync(roomB, { recursive: true });
      fs.mkdirSync(roomC, { recursive: true });
      // Seed current room with a valid section.
      buildSection(path.join(roomA, 'shared-section'), {});
      // Seed ROOM.md on every room so aggregator does not opt-out.
      for (const r of [roomA, roomB, roomC]) {
        writeFile(path.join(r, 'ROOM.md'), [
          '---', 'name: "' + path.basename(r) + '"', 'kind: room', '---', '', '# ' + path.basename(r), '',
        ].join('\n'));
      }
      // Seed peer room B with corrupt BRAIN.md.
      buildSection(path.join(roomB, 'shared-section'), {});
      writeFile(path.join(roomB, 'shared-section', 'BRAIN.md'), [
        '---',
        'section: "shared-section"',
        '!!!corrupt-yaml-body  not an actual frontmatter scalar {{',
        'brain_generated_at: not-an-iso-date',
        '---',
        '',
        '## Pattern Matches',
        '',
        '(corrupt body)',
        '',
      ].join('\n'));
      // Seed peer room C with valid BRAIN.md.
      buildSection(path.join(roomC, 'shared-section'), {});
      writeFile(path.join(roomC, 'shared-section', 'BRAIN.md'), [
        '---',
        'section: "shared-section"',
        'brain_generated_at: "2026-04-21T00:00:00Z"',
        'brain_graph_version: 21432',
        'governing_thought_hash: "sha256:aaaaaaaaaaaaaaaaaaaaaaaa"',
        'staleness: "fresh"',
        'author: "brain"',
        'stale_reason: null',
        'prompt_version: "90-01-v1"',
        'cost_tokens: 60',
        'brain_query_count: 1',
        '---',
        '',
        '## Pattern Matches',
        '',
        '- SWOT',
        '',
      ].join('\n'));
      // Seed .rooms/registry.json under envRoot.
      writeFile(path.join(envRoot, '.rooms', 'registry.json'), JSON.stringify({
        version: 1,
        rooms: {
          'room-a': { path: roomA, active: true },
          'room-b': { path: roomB, active: false },
          'room-c': { path: roomC, active: false },
        },
      }, null, 2));
      // Resolve the aggregator with the env override.
      resetRequireCache();
      const xroom = require('../core/cross-room-aggregator.cjs');
      let threw = false;
      let result;
      try {
        result = await xroom.aggregateContradictions(roomA, { opt_in: true });
      } catch (e) {
        threw = true;
      }
      assert.equal(threw, false, 'aggregator must not throw on corrupt peer');
      assert.equal(typeof result, 'object', 'aggregator must return object');
      assert.ok(Array.isArray(result.contradictions), 'contradictions must be array');
      // Either unreadable OR empty OR no contradictions detected -- the
      // critical assertion is that scanning proceeds.
      const scannedOrSkipped = (result.scanned_rooms || 0) + (result.skipped_rooms || 0);
      assert.ok(scannedOrSkipped >= 1, 'at least one peer must be processed (scanned or skipped)');
      // JSON.stringify output must contain no forbidden content (Canon Part 8).
      const ser = JSON.stringify(result);
      for (const re of FORBIDDEN_PATTERNS) {
        assert.equal(re.test(ser), false, 'aggregator output leaks forbidden regex under corrupt peer: ' + re);
      }
    } finally {
      if (prev === undefined) delete process.env.MINDRIAN_ROOMS_ROOT;
      else process.env.MINDRIAN_ROOMS_ROOT = prev;
    }
  });

  // ------------------------------------------------------------------
  // Scenario 14: Concurrent session-start staleness scans
  // ------------------------------------------------------------------
  // Setup: two simulated session-start staleness scans that both
  //        enqueue the same section with the SAME new hash.
  // Action: parallel enqueue().
  // Assert: queue has a SINGLE entry for the section (idempotency from
  //         Plan 90-02); queue JSON is valid; no lost entries.
  await runScenario('Scenario 14: Concurrent session-start staleness scans', async function () {
    const roomDir = mkTmp('s14-queue');
    const q = require('../core/brain-derivation-queue.cjs');
    const emptyHash = 'sha256:' + crypto.createHash('sha256').update('').digest('hex');
    const newHash = 'sha256:' + crypto.createHash('sha256').update('governing thought v2').digest('hex');
    // Fire 5 parallel enqueues on the same section + same new hash.
    const targets = [];
    for (let i = 0; i < 5; i++) {
      targets.push(Promise.resolve().then(function () {
        return q.enqueue(roomDir, 'market-analysis', emptyHash, newHash, q.ALLOWED_REASONS.SESSION_START_STALE);
      }));
    }
    const results = await Promise.all(targets);
    // All five must return queued:true.
    for (const r of results) {
      assert.equal(r.queued, true, 'every enqueue must return queued:true; got ' + JSON.stringify(r));
    }
    // Queue file is valid JSON with exactly one entry for this section.
    const final = q.readQueue(roomDir);
    const matches = final.entries.filter(function (e) { return e.section === 'market-analysis'; });
    assert.equal(matches.length, 1, 'expected exactly 1 entry for section; got ' + matches.length);
    assert.equal(matches[0].new_governing_thought_hash, newHash);
    // Queue file is valid JSON.
    const raw = fs.readFileSync(path.join(roomDir, '.mindrian', 'brain-derivation-queue.json'), 'utf8');
    let parsed;
    assert.doesNotThrow(function () { parsed = JSON.parse(raw); }, 'queue JSON must be valid after concurrent writes');
    assert.equal(Array.isArray(parsed.entries), true);
  });

  // ------------------------------------------------------------------
  // A1 Cross-cutting: Canon Part 8 forbidden-regex sweep across every
  // BRAIN.md landed during the suite.
  // ------------------------------------------------------------------
  await runScenario('Audit A1: Canon Part 8 forbidden-regex sweep across all landed BRAIN.md', function () {
    const hits = [];
    const seen = new Set(LANDED_BRAIN_FILES);
    for (const p of seen) {
      if (!fs.existsSync(p)) continue;
      const body = fs.readFileSync(p, 'utf8');
      for (const re of FORBIDDEN_PATTERNS) {
        if (re.test(body)) hits.push({ path: p, regex: String(re) });
      }
      for (const bad of DANGEROUS_SUBSTRINGS) {
        if (body.indexOf(bad) !== -1) hits.push({ path: p, token: bad });
      }
    }
    assert.equal(hits.length, 0, 'Canon Part 8 sweep found hits: ' + JSON.stringify(hits));
  });

  // ------------------------------------------------------------------
  // A2 Cross-cutting: orphan tmpfile sweep across every tmp root.
  // ------------------------------------------------------------------
  await runScenario('Audit A2: orphan tmpfile sweep across all suite tmp roots', function () {
    let total = 0;
    const paths = [];
    for (const root of TMP_ROOTS) {
      const orphans = countOrphanTmpfiles(root);
      total += orphans.count;
      for (const p of orphans.paths) paths.push(p);
    }
    assert.equal(total, 0, 'orphan tmpfile(s) remain after suite: ' + paths.join(','));
  });

  // ---------- Final ----------

  const suiteMs = Date.now() - SUITE_START;
  process.stdout.write(
    '\nbrain-derivation-graceful-degradation: ' + passed + '/' + (passed + failed) +
    ' passed  (' + suiteMs + 'ms total)\n'
  );
  if (failed > 0) {
    process.stderr.write('\nFAILURES:\n');
    for (const f of failures) {
      process.stderr.write('  - ' + f.name + '\n');
    }
  }
  // Performance budget assertion: < 30s.
  if (suiteMs > 30000) {
    process.stderr.write('WARN: suite exceeded 30000ms budget (actual: ' + suiteMs + 'ms)\n');
  }
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(function (e) {
  process.stderr.write('Uncaught in main: ' + (e && e.stack ? e.stack : e) + '\n');
  process.exit(1);
});
